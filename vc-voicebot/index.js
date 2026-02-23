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
  StreamType,
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
const SPEAK_CHANNEL_ID = process.env.SPEAK_CHANNEL_ID || process.env.REPLY_CHANNEL_ID || TEXT_CHANNEL_ID;

let currentVoiceChannelId = VOICE_CHANNEL_ID;

const WHISPER_PYTHON = process.env.WHISPER_PYTHON || './.venv/bin/python';
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'tiny';
const WHISPER_LANGUAGE = process.env.WHISPER_LANGUAGE || 'en';
const WHISPER_DEVICE = process.env.WHISPER_DEVICE || 'cpu';
const WHISPER_COMPUTE_TYPE = process.env.WHISPER_COMPUTE_TYPE || 'int8';

const SILENCE_DURATION_MS = Number(process.env.SILENCE_DURATION_MS || 800);
const MIN_SPEECH_MS = Number(process.env.MIN_SPEECH_MS || 600);

const BEEP_DURATION = Number(process.env.BEEP_DURATION || 0.35);
const BEEP_AMPLITUDE = Number(process.env.BEEP_AMPLITUDE || 0.9);
const BEEP_VERSION = 'v2';

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

const MAX_CHUNK = Number(process.env.MAX_CHUNK || 400);
const ALLOW_BOT_MESSAGES = (process.env.ALLOW_BOT_MESSAGES || 'true').toLowerCase() === 'true';

const YOUR_USER_ID = (process.env.YOUR_USER_ID || '').trim();
const OPENCLAW_BOT_ID = (process.env.OPENCLAW_BOT_ID || '').trim();

const LEAVE_ON_USER_IDS = (process.env.LEAVE_ON_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const FILTER_FILLER = (process.env.FILTER_FILLER || 'true').toLowerCase() === 'true';
const DEBUG_VC = (process.env.DEBUG_VC || 'false').toLowerCase() === 'true';
const TIMING_LOG = (process.env.TIMING_LOG || 'false').toLowerCase() === 'true';

const TRANSCRIBE_REQUIRE_START = true;
const TRANSCRIBE_EXACT_MATCH =
  (process.env.TRANSCRIBE_EXACT_MATCH || 'false').toLowerCase() === 'true';
const START_PHRASES = parsePhraseList(
  process.env.TRANSCRIBE_START_PHRASES || 'start message'
);
const STOP_PHRASES = parsePhraseList(
  process.env.TRANSCRIBE_STOP_PHRASES || 'stop message,end message'
);

function logDebug(...args) {
  if (DEBUG_VC) console.log('[vc]', ...args);
}

function logTiming(...args) {
  if (TIMING_LOG) console.log('[timing]', ...args);
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

function phraseRegex(phrase) {
  const parts = phrase.split(/\s+/).map(escapeRegex).filter(Boolean);
  return new RegExp(`\\b${parts.join('\\W+')}\\b`, 'i');
}

function findPhraseInText(text, phrases, { requireStart = false } = {}) {
  if (!text || phrases.length === 0) return null;

  for (const phrase of phrases) {
    const re = phraseRegex(phrase);
    const match = text.match(re);
    if (!match) continue;
    if (requireStart && match.index !== 0) continue;
    const before = text.slice(0, match.index).trim();
    const after = text.slice(match.index + match[0].length).trim();
    return { phrase, before, after, match };
  }
  return null;
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
const ttsQueue = [];
let ttsPlaying = false;

function isFillerMessage(text) {
  const tokens = text
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z]/g, ''))
    .filter(Boolean);

  if (tokens.length === 0) return true;

  return tokens.every((token) => /^(m+|ah+|oh+|yeah+)$/.test(token));
}

function normalizeText(text) {
  return String(text || '')
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

  // Strip URLs
  out = out.replace(/https?:\/\/\S+/gi, '');

  // Remove common markdown tokens
  out = out.replace(/[\*_`~>|]/g, '');

  return normalizeText(out);
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

async function playNextTts() {
  if (ttsPlaying || ttsQueue.length === 0) return;
  if (!player) return;

  ttsPlaying = true;

  const text = ttsQueue.shift();
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
      ttsPlaying = false;
      playNextTts();
    });
  } catch (err) {
    console.error('TTS failed:', err);
    await fs.unlink(filePath).catch(() => {});
    ttsPlaying = false;
    playNextTts();
  }
}

async function enqueueTts(text) {
  for (const chunk of splitText(text)) {
    ttsQueue.push(chunk);
  }

  if (!player && wantConnected) {
    try {
      await connectVoice();
    } catch (err) {
      console.error('TTS connect failed:', err);
      return;
    }
  }

  if (!player) return;
  await playNextTts();
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

async function ensureBeep(filePath, frequency = 880, duration = BEEP_DURATION, amplitude = BEEP_AMPLITUDE) {
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
      `sine=frequency=${frequency}:duration=${duration}:sample_rate=48000`,
      '-filter:a',
      `volume=${amplitude}`,
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

  const filePath = path.join(
    tmpdir(),
    `vc-beep-${frequency}-${Math.round(BEEP_DURATION * 1000)}-${Math.round(BEEP_AMPLITUDE * 100)}-${BEEP_VERSION}.wav`
  );
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
  if (YOUR_USER_ID && userId !== YOUR_USER_ID) return;

  logDebug('speaking start', userId);

  const t0 = Date.now();
  let captureMs = 0;

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
    captureMs = Date.now() - t0;
  } catch (err) {
    console.error('Audio pipeline failed:', err);
    await cleanupFiles(rawPath, wavPath);
    return;
  }

  try {
    const tProbe = Date.now();
    const durationMs = await getAudioDurationMs(rawPath);
    const probeMs = Date.now() - tProbe;
    logDebug('segment duration', userId, `${Math.round(durationMs)}ms`);
    if (durationMs < MIN_SPEECH_MS) {
      await cleanupFiles(rawPath, wavPath);
      return;
    }

    const tConvert = Date.now();
    await convertToWav(rawPath, wavPath);
    const convertMs = Date.now() - tConvert;

    const tWhisper = Date.now();
    const transcript = await transcribeFile(wavPath);
    const whisperMs = Date.now() - tWhisper;
    logDebug('transcript', userId, transcript);

    if (!transcript) {
      await cleanupFiles(rawPath, wavPath);
      return;
    }

    const spoken = transcript.trim();
    if (!spoken) {
      await cleanupFiles(rawPath, wavPath);
      return;
    }

    if (TRANSCRIBE_REQUIRE_START) {
      const startMatch = findPhraseInText(spoken, START_PHRASES);
      const stopMatch = findPhraseInText(spoken, STOP_PHRASES);

      if (!gateOpen) {
        if (startMatch) {
          gateOpen = true;
          messageBuffer = '';
          logDebug('gate open', userId, transcript);
          await playBeep(880);
          logTiming({
            event: 'start',
            userId,
            capture_ms: captureMs,
            probe_ms: probeMs,
            convert_ms: convertMs,
            whisper_ms: whisperMs,
            total_ms: Date.now() - t0,
            transcript: spoken.slice(0, 80),
          });

          if (startMatch.after && !(FILTER_FILLER && isFillerMessage(startMatch.after))) {
            messageBuffer = startMatch.after;
          }
        } else if (DEBUG_VC) {
          console.log('[vc] start-match-miss', transcript);
        }
        await cleanupFiles(rawPath, wavPath);
        return;
      }

      if (stopMatch) {
        if (stopMatch.before && !(FILTER_FILLER && isFillerMessage(stopMatch.before))) {
          messageBuffer = messageBuffer ? `${messageBuffer} ${stopMatch.before}` : stopMatch.before;
        }

        gateOpen = false;
        logDebug('gate closed', userId, transcript);
        await playBeep(660);

        const payload = messageBuffer.trim();
        messageBuffer = '';

        let sendMs = 0;
        if (payload) {
          const channel = await client.channels.fetch(TEXT_CHANNEL_ID);
          if (channel && channel.isTextBased()) {
            const tSend = Date.now();
            await channel.send(payload);
            sendMs = Date.now() - tSend;
          }
        }

        logTiming({
          event: 'stop',
          userId,
          capture_ms: captureMs,
          probe_ms: probeMs,
          convert_ms: convertMs,
          whisper_ms: whisperMs,
          send_ms: sendMs,
          total_ms: Date.now() - t0,
          transcript: spoken.slice(0, 80),
        });

        await cleanupFiles(rawPath, wavPath);
        return;
      }

      if (startMatch) {
        messageBuffer = '';
        logDebug('gate restart', userId, transcript);
        await playBeep(880);
        if (startMatch.after && !(FILTER_FILLER && isFillerMessage(startMatch.after))) {
          messageBuffer = startMatch.after;
        }
        await cleanupFiles(rawPath, wavPath);
        return;
      }
    }

    if (FILTER_FILLER && isFillerMessage(spoken)) {
      await cleanupFiles(rawPath, wavPath);
      return;
    }

    if (TRANSCRIBE_REQUIRE_START) {
      messageBuffer = messageBuffer ? `${messageBuffer} ${spoken}` : spoken;
      logTiming({
        event: 'buffer',
        userId,
        capture_ms: captureMs,
        probe_ms: probeMs,
        convert_ms: convertMs,
        whisper_ms: whisperMs,
        total_ms: Date.now() - t0,
        transcript: spoken.slice(0, 80),
      });
      await cleanupFiles(rawPath, wavPath);
      return;
    }

    const channel = await client.channels.fetch(TEXT_CHANNEL_ID);
    let sendMs = 0;
    if (channel && channel.isTextBased()) {
      const tSend = Date.now();
      await channel.send(spoken);
      sendMs = Date.now() - tSend;
    }

    logTiming({
      event: 'send',
      userId,
      capture_ms: captureMs,
      probe_ms: probeMs,
      convert_ms: convertMs,
      whisper_ms: whisperMs,
      send_ms: sendMs,
      total_ms: Date.now() - t0,
      transcript: spoken.slice(0, 80),
    });
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
  gateOpen = !TRANSCRIBE_REQUIRE_START;
  messageBuffer = '';
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
  if (message.guildId !== GUILD_ID) return;
  if (!message.content) return;

  const content = message.content.trim();

  if (content === '/join') {
    if (message.author.bot) return;
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
    return;
  }

  if (content === '/beep') {
    if (message.author.bot) return;
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel || !voiceChannel.isVoiceBased()) {
      await message.reply('Join a voice channel first.');
      return;
    }

    if (!connection || currentVoiceChannelId !== voiceChannel.id) {
      currentVoiceChannelId = voiceChannel.id;
      wantConnected = true;
      try {
        connection?.destroy();
      } catch {}
      connection = null;
      await connectVoice();
    }

    await playBeep(880);
    await playBeep(660);
    await message.reply('Beep.');
    return;
  }

  if (message.channelId !== SPEAK_CHANNEL_ID) return;
  if (message.author?.id === client.user?.id) return;
  if (!ALLOW_BOT_MESSAGES && message.author.bot) return;
  if (OPENCLAW_BOT_ID && message.author.id !== OPENCLAW_BOT_ID) return;
  if (!content) return;

  const spoken = sanitizeForSpeech(content);
  if (!spoken) return;

  await enqueueTts(spoken);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  if (
    newState.channelId &&
    LEAVE_ON_USER_IDS.includes(newState.id) &&
    (newState.channelId !== currentVoiceChannelId || !connection || !wantConnected)
  ) {
    currentVoiceChannelId = newState.channelId;
    wantConnected = true;
    if (DEBUG_VC) console.log('[vc] auto-join', newState.channelId);
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
    gateOpen = false;
    messageBuffer = '';
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
  gateOpen = false;
  messageBuffer = '';
  console.log('[vc] leaving (no humans)');
  try {
    connection?.destroy();
  } catch {}
  connection = null;
});

client.login(TOKEN);
