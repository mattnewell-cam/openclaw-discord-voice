# Voice Bridge (Discord + TTS + Replies)

Self-hosted bridge that speaks a text channel into Discord voice, and can reply to a transcription channel using OpenAI then post into a reply channel (for TTS).

## Requirements
- Node.js 18+
- Python 3.10+
- **ffmpeg** (for audio conversion)
- Discord bot token
- Bot added to server with: View Channel, Send Messages, Read Message History, Connect, Speak
- **Message Content Intent** enabled in the bot settings

## Setup

### 1) Create Discord bot
- Go to <https://discord.com/developers/applications>
- New Application → Bot → **Enable Message Content Intent**
- Copy the bot token

### 2) Invite bot to your server
Use OAuth2 URL generator with scopes `bot` (no slash commands required).
Give it: View Channels, Read Message History, Send Messages, Connect, Speak.

### 3) Install dependencies
```bash
# ffmpeg (Debian/Ubuntu)
sudo apt-get update && sudo apt-get install -y ffmpeg

npm install
python3 -m venv .venv
./.venv/bin/pip install edge-tts piper-tts pathvalidate
```

### 4) (Optional) Download a Piper voice
```bash
./.venv/bin/python -m piper.download_voices en_GB-northern_english_male-medium --data-dir voices
```

### 5) Configure
Copy `.env.example` → `.env` and fill in:
- DISCORD_TOKEN
- GUILD_ID
- VOICE_CHANNEL_ID
- TEXT_CHANNEL_ID (the channel the TTS bridge will speak)
- TRANSCRIBE_CHANNEL_ID (SeaVoice transcript channel)
- REPLY_CHANNEL_ID (voice-reply channel)
- RELAY_AUTHOR_IDS (OpenClaw bot user ID to mirror)
- ALLOW_BOT_MESSAGES=true (so bot replies are spoken)
- TTS_PROVIDER (edge or piper)
- EDGE_VOICE (if using edge)
- PIPER_MODEL (if using piper)

### 6) Run
```bash
npm start
```

## Notes
- By default it speaks **every message** in TEXT_CHANNEL_ID (excluding bots).
- If you want to only speak certain users, set `SPEAK_USER_IDS` (comma-separated).
- Messages from TRANSCRIBE_CHANNEL_ID are mirrored to REPLY_CHANNEL_ID **only if the author ID is in RELAY_AUTHOR_IDS**.
- Filler-only messages like “mm / ah / oh / yeah” are ignored.
- Transcripts can be **debounced**: set `RELAY_DEBOUNCE_MS` (ms). `0` sends immediately.
- Use a dedicated channel to avoid noise.
- **Edge TTS** voices are much more natural. Suggested UK voices:
  - en-GB-RyanNeural
  - en-GB-SoniaNeural
  - en-GB-LibbyNeural
  - en-GB-MaisieNeural

## Improving prosody
- For Edge TTS: adjust `EDGE_RATE` (e.g. `-10%`), `EDGE_PITCH` (e.g. `-2Hz`).
- For Piper: `PIPER_LENGTH_SCALE` and `PIPER_SENTENCE_SILENCE` still apply.
