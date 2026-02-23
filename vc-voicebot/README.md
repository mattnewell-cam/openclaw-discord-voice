# VC Voicebot (Single Bot STT + TTS)

One Discord bot that:
- **Transcribes** VC speech → text channel
- **Speaks** replies from a text channel → VC (Edge or Piper TTS)

## Requirements
- Node.js 18+
- Python 3.10+
- **ffmpeg**

## Setup
```bash
cd vc-voicebot
npm install
./scripts/setup.sh
cp .env.example .env
```

Fill `.env` with your bot token + IDs.

## Run
```bash
npm start
```

## Key config highlights
- `TEXT_CHANNEL_ID` → where transcripts are posted
- `SPEAK_CHANNEL_ID` → where TTS listens (defaults to TEXT_CHANNEL_ID)
- `YOUR_USER_ID` → only transcribe this speaker
- `OPENCLAW_BOT_ID` → only speak this author (your OpenClaw bot)
- `TRANSCRIBE_REQUIRE_START=true` → enable “start/end message” gating

## Commands
- `/join` → join your current VC
- `/beep` → play two beeps

## Notes
- `WHISPER_MODEL=tiny` is fastest; `base/small` is more accurate.
- Start/stop phrases match **inside** longer transcripts.
