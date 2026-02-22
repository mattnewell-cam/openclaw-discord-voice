# VC Transcriber (Discord)

Joins a Discord voice channel, captures audio, transcribes with **faster-whisper**, and posts text to a channel.

## Requirements
- Node.js 18+
- Python 3.10+
- **ffmpeg**

## Setup
```bash
cd /home/matth/.openclaw/workspace/vc-transcriber
npm install
./scripts/setup.sh
cp .env.example .env
```

Fill `.env` with your bot token + channel IDs.

## Run
```bash
npm start
```

## Notes
- `WHISPER_MODEL=small` is a good accuracy/speed balance on CPU.
- If you have a GPU, set `WHISPER_DEVICE=cuda` and `WHISPER_COMPUTE_TYPE=float16`.
