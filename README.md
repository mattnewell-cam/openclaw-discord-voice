# OpenClaw Voice Chat in Discord

Openclaw is finally hands-free! This bot joins a specified voice chat when you do, transcribes your speech to text in a chat with Openclaw, then reads Openclaw's response back to you. 

- **vc-transcriber/** does **both** STT + TTS

---

## Setup

### 1) Create the bot and invite to server

1. Go to <https://discord.com/developers/applications>
2. **New Application** → add a **Bot**
3. Reset the **Bot Token** and copy it
4. Sidebar → Bot → **Enable Message Content Intent**
5. Sidebar → OAuth2 → Scopes: **bot**
6. Scroll down to Bot Permissions → select:
  - **View Channels**
  - **Read Message History**
  - **Send Messages**
  - **Connect**
  - **Speak**
7. Scroll down → **copy URL**
8. Go to URL, authorise, and add it to your server
---

### 2) Requirements

- Node.js 18+
- Python 3.10+
- ffmpeg

Ubuntu:
```bash
sudo apt-get update
sudo apt-get install -y ffmpeg python3-venv
```

---

### 3) Install (single bot)

```bash
cd openclaw-discord-voice/vc-transcriber

npm install
./scripts/setup.sh
cp .env.example .env
```

---

### 4) Configuration (.env)

### Core
```
DISCORD_TOKEN=
GUILD_ID=
VOICE_CHANNEL_ID=
TEXT_CHANNEL_ID=
TTS_SPEAK_USER_IDS=OPENCLAW_BOT_ID
```

### STT (Whisper)
```
WHISPER_PYTHON=./.venv/bin/python
WHISPER_MODEL=tiny|base|small|...
WHISPER_LANGUAGE=en
```
Smaller model = faster `whisper_ms`.

### Start/stop gating
```
TRANSCRIBE_REQUIRE_START=true
TRANSCRIBE_START_PHRASES=start message,stop message
TRANSCRIBE_STOP_PHRASES=end message,and message
TRANSCRIBE_EXACT_MATCH=false
```
Behavior:
- Any transcript containing **“start message”** opens/restarts the buffer
- Any transcript containing **“end message”** closes and sends the buffer
- Words **between** are sent as **one combined message**

### Auto‑join / auto‑leave
```
LEAVE_ON_USER_IDS=YOUR_USER_ID
```
Bot auto‑joins when you enter VC, and leaves when you leave.

### TTS (Edge / Piper)
```
TTS_PROVIDER=edge
TTS_PYTHON=./.venv/bin/python
EDGE_VOICE=en-GB-RyanNeural
```
If you use **Piper**:
```
TTS_PROVIDER=piper
PIPER_MODEL=voices/<your-model>.onnx
PIPER_DATA_DIR=voices
```

### Author filtering (recommended)
```bash
# Only transcribe these VC speakers
SPEAK_USER_IDS=YOUR_USER_ID

# Only speak OpenClaw replies in the text channel
TTS_SPEAK_USER_IDS=OPENCLAW_BOT_ID
ALLOW_BOT_MESSAGES=true
```

---

## 5) Run

```bash
# run from vc-transcriber/
npm start
```

---

## 6) Usage (voice workflow)

1) Say **“start message”** in VC
2) Wait for the **beep** (gate open)
3) Speak your message naturally
4) Say **“end message”** to finish (gate closes + sends)

Notes:
- Saying **“start message”** again **restarts** the buffer
- You can keep it open for multiple sentences before ending

---

## 7) Commands (text channel)

- `/join` → join your current VC
- `/beep` → play two beeps to confirm audio

---

## 8) Logs + timing

```bash
# start in background
nohup npm start >> /tmp/vc-transcriber.log 2>&1 &

# follow logs
tail -f /tmp/vc-transcriber.log

# timing stats
grep -n "\[timing\]" /tmp/vc-transcriber.log | tail -n 20
```

---

## 9) Troubleshooting

**No transcripts:**
- Bot is in the correct VC
- Message Content intent enabled
- Bot not deafened
- IDs are correct

**No TTS audio:**
- Bot has **Speak** permission
- Your Discord output device isn’t muted
- Bot user volume isn’t at 0%

**Opus decode crashes:**
- Use `@discordjs/opus` (already in package.json)

---

## Repo layout
- `vc-transcriber/` → **single‑bot STT + TTS**
