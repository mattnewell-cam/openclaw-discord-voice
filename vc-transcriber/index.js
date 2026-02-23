import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';
import { EndBehaviorType } from '@discordjs/voice';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import prism from 'prism-media';

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

let currentVoiceChannelId = VOICE_CHANNEL_ID;

const WHISPER_PYTHON = process.env.WHISPER_PYTHON || './.venv/bin/python';
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'small';
const WHISPER_LANGUAGE = process.env.WHISPER_LANGUAGE || 'en';
const WHISPER_DEVICE = process.env.WHISPER_DEVICE || 'cpu';
const WHISPER_COMPUTE_TYPE = process.env.WHISPER_COMPUTE_TYPE || 'int8';

const SILENCE_DURATION_MS = Number(process.env.SILENCE_DURATION_MS || 800);
const MIN_SPEECH_MS = Number(process.env.MIN_SPEECH_MS || 600);

const SPEAK_USER_IDS = (process.env.SPEAK_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const IGNORE_USER_IDS = (process.env.IGNORE_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const LEAVE_ON_USER_IDS = (process.env.LEAVE_ON_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const FILTER_FILLER = (process.env.FILTER_FILLER || 'true').toLowerCase() === 'true';
const DEBUG_VC = (process.env.DEBUG_VC || 'false').toLowerCase() === 'true';

const TRANSCRIBE_REQUIRE_START =
  (process.env.TRANSCRIBE_REQUIRE_START || 'false').toLowerCase() === 'true';
const TRANSCRIBE_EXACT_MATCH =
  (process.env.TRANSCRIBE_EXACT_MATCH || 'false').toLowerCase() === 'true';
const START_PHRASES = parsePhraseList(
  process.env.TRANSCRIBE_START_PHRASES || (TRANSCRIBE_REQUIRE_START ? 'start message' : '')
);
const STOP_PHRASES = parsePhraseList(
  process.env.TRANSCRIBE_STOP_PHRASES || (TRANSCRIBE_REQUIRE_START ? 'stop message,end message' : '')
);

function logDebug(...args) {
  if (DEBUG_VC) console.log('[vc]', ...args);
}

function normalizePhrase(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePhraseList(value) {
  return String(value || '')
    .split(',')
    .map((phrase) => normalizePhrase(phrase))
    .filter(Boolean);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesPhrase(normalizedText, phrases) {
  if (!normalizedText || phrases.length === 0) return false;
  return phrases.some((phrase) => {
    if (TRANSCRIBE_EXACT_MATCH) {
      return normalizedText === phrase;
    }
    const re = new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'i');
    return re.test(normalizedText);
  });
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

let connection = null;
let player = null;
let wantConnected = true;
const activeStreams = new Map();
let gateOpen = !TRANSCRIBE_REQUIRE_START;
let messageBuffer = '';

function isFillerMessage(text) {
  const tokens = text
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z]/g, ''))
    .filter(Boolean);

  if (tokens.length === 0) return true;

  return tokens.every((token) => /^(m+|ah+|oh+|yeah+)$/.test(token));
}

async function transcribeFile(wavPath) {
  return new Promise((resolve, reject) => {
    const args = [
      path.join('scripts', 'transcribe.py'),
      '--file',
      wavPath,
      '--model',
      WHISPER_MODEL,
      '--language',
      WHISPER_LANGUAGE,
      '--device',
      WHISPER_DEVICE,
      '--compute-type',
      WHISPER_COMPUTE_TYPE,
    ];

    const proc = spawn(WHISPER_PYTHON, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';

    proc.stdout.on('data', (data) => (out += data.toString()));
    proc.stderr.on('data', (data) => (err += data.toString()));

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) return resolve(out.trim());
      reject(new Error(err || `transcribe exited with code ${code}`));
    });
  });
}

async function ensureBeep(filePath, frequency = 880, duration = 0.18) {
  try {
    await fs.access(filePath);
    return;
  } catch {}

  await new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=${frequency}:duration=${duration}`,
      '-ac',
      '1',
      '-ar',
      '48000',
      filePath,
    ];
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    proc.stderr.on('data', (data) => (err += data.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `ffmpeg exited with code ${code}`));
    });
  });
}

async function playBeep(frequency) {
  if (!player) return;

  const filePath = path.join(tmpdir(), `vc-beep-${frequency}.wav`);
  try {
    await ensureBeep(filePath, frequency);
  } catch (err) {
    console.error('beep generation failed', err);
    return;
  }

  const resource = createAudioResource(filePath);
  player.play(resource);

  await new Promise((resolve) => {
    const onIdle = () => {
      player.removeListener(AudioPlayerStatus.Idle, onIdle);
      resolve();
    };
    player.on(AudioPlayerStatus.Idle, onIdle);
  });
}

async function handleUserStream(userId, stream) {
  if (IGNORE_USER_IDS.includes(userId)) return;
  if (SPEAK_USER_IDS.length > 0 && !SPEAK_USER_IDS.includes(userId)) return;

  logDebug('speaking start', userId);

  const rawPath = path.join(
    tmpdir(),
    `vc-${userId}-${Date.now()}-${Math.random().toString(16).slice(2)}.raw`
  );
  const wavPath = rawPath.replace('.raw', '.wav');

  const writeStream = (await fs.open(rawPath, 'w')).createWriteStream();
  const decoder = new prism.opus.Decoder({
    rate: 48000,
    channels: 2,
    frameSize: 960,
  });

  try {
    await pipeline(stream, decoder, writeStream);
  } catch (err) {
    console.error('Audio pipeline failed:', err);
    await cleanupFiles(rawPath, wavPath);
    return;
  }

  try {
    const durationMs = await getAudioDurationMs(rawPath);
    logDebug('segment duration', userId, `${Math.round(durationMs)}ms`);
    if (durationMs < MIN_SPEECH_MS) {
      await cleanupFiles(rawPath, wavPath);
      return;
    }

    await convertToWav(rawPath, wavPath);
    const transcript = await transcribeFile(wavPath);
    logDebug('transcript', userId, transcript);

    if (!transcript) {
      await cleanupFiles(rawPath, wavPath);
      return;
    }

    const normalized = normalizePhrase(transcript);

    if (TRANSCRIBE_REQUIRE_START) {
      if (!gateOpen) {
        if (matchesPhrase(normalized, START_PHRASES)) {
          gateOpen = true;
          messageBuffer = '';
          logDebug('gate open', userId, transcript);
          await playBeep(880);
        }
        await cleanupFiles(rawPath, wavPath);
        return;
      }

      if (matchesPhrase(normalized, STOP_PHRASES)) {
        gateOpen = false;
        logDebug('gate closed', userId, transcript);
        await playBeep(660);

        const payload = messageBuffer.trim();
        messageBuffer = '';

        if (payload) {
          const channel = await client.channels.fetch(TEXT_CHANNEL_ID);
          if (channel && channel.isTextBased()) {
            await channel.send(payload);
          }
        }

        await cleanupFiles(rawPath, wavPath);
        return;
      }
    }

    if (FILTER_FILLER && isFillerMessage(transcript)) {
      await cleanupFiles(rawPath, wavPath);
      return;
    }

    if (TRANSCRIBE_REQUIRE_START) {
      messageBuffer = messageBuffer ? `${messageBuffer} ${transcript}` : transcript;
      await cleanupFiles(rawPath, wavPath);
      return;
    }

    const channel = await client.channels.fetch(TEXT_CHANNEL_ID);
    if (channel && channel.isTextBased()) {
      await channel.send(transcript);
    }
  } catch (err) {
    console.error('Transcription failed:', err);
  } finally {
    await cleanupFiles(rawPath, wavPath);
  }
}

async function getAudioDurationMs(rawPath) {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      rawPath,
    ]);

    let out = '';
    proc.stdout.on('data', (data) => (out += data.toString()));
    proc.on('close', () => {
      const seconds = Number(out.trim());
      if (!Number.isFinite(seconds)) return resolve(0);
      resolve(seconds * 1000);
    });
  });
}

async function convertToWav(rawPath, wavPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      '-i', rawPath,
      '-ac', '1',
      '-ar', '16000',
      wavPath,
    ];

    const proc = spawn('ffmpeg', ['-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    proc.stderr.on('data', (data) => (err += data.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `ffmpeg exited with code ${code}`));
    });
  });
}

async function cleanupFiles(...pathsToRemove) {
  await Promise.all(pathsToRemove.map((p) => fs.unlink(p).catch(() => {})));
}

async function connectVoice() {
  wantConnected = true;
  if (!currentVoiceChannelId) {
    throw new Error('VOICE_CHANNEL_ID is not set');
  }
  const channel = await client.channels.fetch(currentVoiceChannelId);
  if (!channel || !channel.isVoiceBased()) {
    throw new Error('VOICE_CHANNEL_ID is not a voice-based channel');
  }

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: GUILD_ID,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

  player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play,
    },
  });

  connection.subscribe(player);

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    if (!wantConnected) return;
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
      if (wantConnected) await connectVoice();
    }
  });

  connection.on('error', async (err) => {
    if (!wantConnected) return;
    console.error('VoiceConnection error:', err);
    try {
      connection.destroy();
    } catch {}
    connection = null;
    if (wantConnected) await connectVoice();
  });

  const receiver = connection.receiver;
  receiver.speaking.on('start', (userId) => {
    if (activeStreams.has(userId)) return;
    logDebug('receiver start', userId);
    const stream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: SILENCE_DURATION_MS,
      },
    });

    activeStreams.set(userId, stream);
    stream.on('end', () => activeStreams.delete(userId));
    stream.on('close', () => activeStreams.delete(userId));
    stream.on('error', (err) => {
      activeStreams.delete(userId);
      console.error('receiver stream error', err);
    });

    handleUserStream(userId, stream).catch((err) => console.error(err));
  });
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await connectVoice();
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.guildId !== GUILD_ID) return;
  if (!message.content || message.content.trim() !== '/join') return;

  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel || !voiceChannel.isVoiceBased()) {
    await message.reply('Join a voice channel first.');
    return;
  }

  currentVoiceChannelId = voiceChannel.id;
  wantConnected = true;
  try {
    connection?.destroy();
  } catch {}
  connection = null;
  await connectVoice();
  await message.reply(`Joined ${voiceChannel.name}.`);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  if (
    newState.channelId &&
    LEAVE_ON_USER_IDS.includes(newState.id) &&
    newState.channelId !== currentVoiceChannelId
  ) {
    currentVoiceChannelId = newState.channelId;
    wantConnected = true;
    try {
      connection?.destroy();
    } catch {}
    connection = null;
    await connectVoice();
    return;
  }

  if (!currentVoiceChannelId) return;

  if (
    oldState.channelId === currentVoiceChannelId &&
    newState.channelId !== currentVoiceChannelId &&
    LEAVE_ON_USER_IDS.includes(oldState.id)
  ) {
    wantConnected = false;
    try {
      connection?.destroy();
    } catch {}
    connection = null;
    return;
  }

  const channel = await client.channels.fetch(currentVoiceChannelId).catch(() => null);
  if (!channel || !channel.isVoiceBased()) return;

  const humans = channel.members.filter((member) => member.user?.bot === false);
  if (DEBUG_VC) {
    const memberList = channel.members.map((m) => `${m.id}:${m.user?.bot ? 'bot' : 'human'}`);
    console.log('[vc] leave-check', {
      channel: channel.id,
      humans: humans.size,
      members: memberList,
    });
  }

  if (humans.size > 0) return;

  wantConnected = false;
  console.log('[vc] leaving (no humans)');
  try {
    connection?.destroy();
  } catch {}
  connection = null;
});

client.login(TOKEN);
