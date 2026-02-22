# OpenClaw Discord Voice (STT + TTS)

Two small services that make Discord voice usable with OpenClaw:

- **vc-transcriber**: joins a voice channel, transcribes with faster‑whisper, posts to a text channel
- **voice-bridge**: speaks a text channel into voice (Edge TTS), and relays OpenClaw replies from a transcript channel to a reply channel

## Requirements
- Node.js 18+
- Python 3.10+
- ffmpeg
- Discord bot tokens

## Repo layout
- `vc-transcriber/`
- `voice-bridge/`

## Quick start (vc-transcriber)
```bash
cd vc-transcriber
npm install
./scripts/setup.sh
cp .env.example .env
# fill DISCORD_TOKEN, GUILD_ID, VOICE_CHANNEL_ID, TEXT_CHANNEL_ID
npm start
```

## Quick start (voice-bridge)
```bash
cd voice-bridge
npm install
python3 -m venv .venv
./.venv/bin/pip install edge-tts piper-tts pathvalidate
cp .env.example .env
# fill DISCORD_TOKEN, GUILD_ID, VOICE_CHANNEL_ID, TEXT_CHANNEL_ID,
# TRANSCRIBE_CHANNEL_ID, REPLY_CHANNEL_ID, RELAY_AUTHOR_IDS
npm start
```

## Notes
- **No secrets are committed**. Use `.env` locally.
- If you only want STT, you only need `vc-transcriber`.
- If you only want TTS/replies, you only need `voice-bridge`.
