import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} from '@discordjs/voice';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const REQUIRED = [
  'DISCORD_TOKEN',
  'GUILD_ID',
  'VOICE_CHANNEL_ID',
  'TEXT_CHANNEL_ID',
];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`Missing env ${key}`);
    process.exit(1);
  }
}

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;
const TEXT_CHANNEL_ID = process.env.TEXT_CHANNEL_ID;
const TRANSCRIBE_CHANNEL_ID = process.env.TRANSCRIBE_CHANNEL_ID || '';
const REPLY_CHANNEL_ID = process.env.REPLY_CHANNEL_ID || TEXT_CHANNEL_ID;
const TTS_PROVIDER = (process.env.TTS_PROVIDER || 'edge').toLowerCase();
const TTS_PYTHON = process.env.TTS_PYTHON || './.venv/bin/python';

const EDGE_VOICE = process.env.EDGE_VOICE || 'en-GB-RyanNeural';
const EDGE_RATE = process.env.EDGE_RATE || '+0%';
const EDGE_PITCH = process.env.EDGE_PITCH || '+0Hz';
const EDGE_VOLUME = process.env.EDGE_VOLUME || '+0%';

const PIPER_MODEL = process.env.PIPER_MODEL || '';
const PIPER_DATA_DIR = process.env.PIPER_DATA_DIR || 'voices';
const PIPER_SPEAKER = process.env.PIPER_SPEAKER || '';
const PIPER_LENGTH_SCALE = process.env.PIPER_LENGTH_SCALE || '';
const PIPER_NOISE_SCALE = process.env.PIPER_NOISE_SCALE || '';
const PIPER_NOISE_W_SCALE = process.env.PIPER_NOISE_W_SCALE || '';
const PIPER_SENTENCE_SILENCE = process.env.PIPER_SENTENCE_SILENCE || '';

const RELAY_AUTHOR_IDS = (process.env.RELAY_AUTHOR_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const RELAY_IGNORE_FILLER = (process.env.RELAY_IGNORE_FILLER || 'true').toLowerCase() === 'true';
const RELAY_DEBOUNCE_MS = Number(process.env.RELAY_DEBOUNCE_MS || 5000);
const ALLOW_BOT_MESSAGES = (process.env.ALLOW_BOT_MESSAGES || 'true').toLowerCase() === 'true';

const MAX_CHUNK = Number(process.env.MAX_CHUNK || 400);
const SPEAK_USER_IDS = (process.env.SPEAK_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const IGNORE_USER_IDS = (process.env.IGNORE_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

// OpenAI reply generation removed; relaying OpenClaw messages instead.
let connection = null;
let player = null;
const queue = [];
let playing = false;

let transcriptBuffer = '';
let transcriptTimer = null;

function normalizeText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitText(text) {
  const clean = normalizeText(text);
  if (!clean) return [];

  if (clean.length <= MAX_CHUNK) return [clean];

  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    chunks.push(clean.slice(start, start + MAX_CHUNK).trim());
    start += MAX_CHUNK;
  }

  return chunks.filter(Boolean);
}

function sanitizeForSpeech(text) {
  if (!text) return '';

  let out = text;

  // Replace markdown links [text](url) -> text
  out = out.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

  // Remove common markdown tokens
  out = out.replace(/[\*_`~>|]/g, '');

  return normalizeText(out);
}

function isFillerMessage(text) {
  const tokens = text
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z]/g, ''))
    .filter(Boolean);

  if (tokens.length === 0) return true;

  return tokens.every((token) => /^(m+|ah+|oh+|yeah+)$/.test(token));
}

function splitDiscordMessage(text, maxLen = 1900) {
  if (text.length <= maxLen) return [text];
  const parts = [];
  let start = 0;
  while (start < text.length) {
    parts.push(text.slice(start, start + maxLen));
    start += maxLen;
  }
  return parts;
}

function synthesizePiper(text, outFile) {
  return new Promise((resolve, reject) => {
    if (!PIPER_MODEL) return reject(new Error('PIPER_MODEL is not set'));

    const args = [
      '-m',
      'piper',
      '-m',
      PIPER_MODEL,
      '--data-dir',
      PIPER_DATA_DIR,
    ];

    if (PIPER_SPEAKER) args.push('--speaker', PIPER_SPEAKER);
    if (PIPER_LENGTH_SCALE) args.push('--length-scale', PIPER_LENGTH_SCALE);
    if (PIPER_NOISE_SCALE) args.push('--noise-scale', PIPER_NOISE_SCALE);
    if (PIPER_NOISE_W_SCALE) args.push('--noise-w-scale', PIPER_NOISE_W_SCALE);
    if (PIPER_SENTENCE_SILENCE) args.push('--sentence-silence', PIPER_SENTENCE_SILENCE);

    args.push('-f', outFile, '--', text);

    const proc = spawn(TTS_PYTHON, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`piper exited with code ${code}`));
    });
  });
}

function synthesizeEdge(text, outFile) {
  return new Promise((resolve, reject) => {
    const args = [
      '-m',
      'edge_tts',
      '--voice',
      EDGE_VOICE,
      '--rate',
      EDGE_RATE,
      '--pitch',
      EDGE_PITCH,
      '--volume',
      EDGE_VOLUME,
      '--text',
      text,
      '--write-media',
      outFile,
    ];

    const proc = spawn(TTS_PYTHON, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`edge-tts exited with code ${code}`));
    });
  });
}

function synthesize(text, outFile) {
  if (TTS_PROVIDER === 'piper') return synthesizePiper(text, outFile);
  return synthesizeEdge(text, outFile);
}

async function playNext() {
  if (playing || queue.length === 0) return;
  playing = true;

  const text = queue.shift();
  const ext = TTS_PROVIDER === 'piper' ? 'wav' : 'mp3';
  const filePath = path.join(
    tmpdir(),
    `tts-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`
  );

  try {
    await synthesize(text, filePath);
    const resource = createAudioResource(filePath, { inputType: StreamType.Arbitrary });
    player.play(resource);

    player.once(AudioPlayerStatus.Idle, async () => {
      await fs.unlink(filePath).catch(() => {});
      playing = false;
      playNext();
    });
  } catch (err) {
    console.error('TTS failed:', err);
    await fs.unlink(filePath).catch(() => {});
    playing = false;
    playNext();
  }
}

function enqueue(text) {
  for (const chunk of splitText(text)) {
    queue.push(chunk);
  }
  playNext();
}

async function relayToReplyChannel(content) {
  const replyChannel = await client.channels.fetch(REPLY_CHANNEL_ID);
  if (!replyChannel || !replyChannel.isTextBased()) {
    throw new Error('REPLY_CHANNEL_ID is not a text channel');
  }

  for (const part of splitDiscordMessage(content)) {
    await replyChannel.send(part);
  }
}

function queueTranscript(text) {
  const normalized = normalizeText(text);
  if (!normalized) return;

  if (RELAY_DEBOUNCE_MS <= 0) {
    if (RELAY_IGNORE_FILLER && isFillerMessage(normalized)) return;
    relayToReplyChannel(normalized).catch((err) => {
      console.error('Relay failed:', err);
    });
    return;
  }

  transcriptBuffer = transcriptBuffer
    ? `${transcriptBuffer} ${normalized}`
    : normalized;

  if (transcriptTimer) clearTimeout(transcriptTimer);
  transcriptTimer = setTimeout(async () => {
    const payload = transcriptBuffer.trim();
    transcriptBuffer = '';
    transcriptTimer = null;

    if (!payload) return;
    if (RELAY_IGNORE_FILLER && isFillerMessage(payload)) return;

    try {
      await relayToReplyChannel(payload);
    } catch (err) {
      console.error('Relay failed:', err);
    }
  }, RELAY_DEBOUNCE_MS);
}

async function connectVoice() {
  const channel = await client.channels.fetch(VOICE_CHANNEL_ID);
  if (!channel || !channel.isVoiceBased()) {
    throw new Error('VOICE_CHANNEL_ID is not a voice-based channel');
  }

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: GUILD_ID,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play,
    },
  });

  connection.subscribe(player);

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      try {
        connection.destroy();
      } catch {}
      connection = null;
      await connectVoice();
    }
  });
}

client.on('messageCreate', async (message) => {
  if (message.channelId === TEXT_CHANNEL_ID) {
    if (!ALLOW_BOT_MESSAGES && message.author.bot) return;
    if (IGNORE_USER_IDS.includes(message.author.id)) return;
    if (SPEAK_USER_IDS.length > 0 && !SPEAK_USER_IDS.includes(message.author.id)) return;
    if (!message.content || !message.content.trim()) return;

    const spoken = sanitizeForSpeech(message.content);
    if (!spoken) return;

    enqueue(spoken);
    return;
  }

  if (TRANSCRIBE_CHANNEL_ID && message.channelId === TRANSCRIBE_CHANNEL_ID) {
    if (!message.content || !message.content.trim()) return;
    if (REPLY_CHANNEL_ID === TRANSCRIBE_CHANNEL_ID) return;
    if (RELAY_AUTHOR_IDS.length === 0) {
      console.error('RELAY_AUTHOR_IDS is not set; refusing to relay transcripts');
      return;
    }
    if (!RELAY_AUTHOR_IDS.includes(message.author.id)) return;
    if (RELAY_IGNORE_FILLER && isFillerMessage(message.content)) return;

    queueTranscript(message.content);
  }
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await connectVoice();
});

client.login(TOKEN);
