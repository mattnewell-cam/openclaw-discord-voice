# OpenClaw Voicebot for Discord

Openclaw is finally hands-free! This bot joins a specified voice chat when you do, transcribes your speech to text in a chat with Openclaw, then reads Openclaw's response back to you. 

- **vc-voicebot/** does **both** STT + TTS

---

## Usage (day‑to‑day)

**Join VC**
- Join your configured voice channel.
- The bot should auto‑join when `YOUR_USER_ID` enters. If it doesn’t, run `/join` in the text channel.

**Send a voice message to OpenClaw**
1) Say **“start message”** in VC
2) Wait for the **beep** (gate open)
3) Speak your message naturally
4) Say **“end message”** to finish (gate closes + sends)

**What happens next**
- Your speech is transcribed into the text channel.
- OpenClaw replies in the same channel.
- The bot speaks OpenClaw’s reply back in VC.

Notes:
- You can edit your start/end phrases in `.env` (`TRANSCRIBE_START_PHRASES`, `TRANSCRIBE_STOP_PHRASES`).
- It can help to say them twice: **“start message, start message”** / **“end message, end message.”**
- Saying **“start message”** again **restarts** the buffer.
- Keep talking between start/end if you want a single combined message.

---

## Setup

### 0) Get the code

**Recommended (git):**
```bash
git clone https://github.com/mattnewell-cam/openclaw-discord-voicebot.git
cd openclaw-discord-voicebot
```

**Alternative (ZIP):**
- Click **Code → Download ZIP** on GitHub
- Unzip it and `cd` into the extracted folder (e.g. `openclaw-discord-voicebot-main`)

---

### 1) Create the bot and invite to server

1. Go to <https://discord.com/developers/applications>
2. **New Application** → add a **Bot**
3. Sidebar: Bot → Reset Token and copy it → Save changes
4. Scroll down → Enable Message Content Intent
5. Sidebar: OAuth2 → Scopes: **bot**
6. Scroll down to Bot Permissions → select:
  - View Channels
  - Read Message History
  - Send Messages
  - Connect
  - Speak
7. Scroll down to Generated URL and copy it
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
cd openclaw-discord-voicebot/vc-voicebot

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
YOUR_USER_ID=
OPENCLAW_BOT_ID=
```

### STT (Whisper)
```
WHISPER_PYTHON=./.venv/bin/python
WHISPER_MODEL=tiny|base|small|...
(Default: tiny)
WHISPER_LANGUAGE=en
```
Smaller model = faster `whisper_ms`.

### Start/stop gating (always on)
```
TRANSCRIBE_START_PHRASES=start message,stop message,so message,start the message,star message,strong message
TRANSCRIBE_STOP_PHRASES=end message,and message
```
Behavior:
- Saying **“start message”** opens/restarts the buffer
- Saying **“end message”** closes and sends the buffer
- Words **between** are sent as **one combined message**

### Auto‑join / auto‑leave
Auto‑join/leave follows `YOUR_USER_ID` (no separate setting).

### OpenClaw allowlist (important)
If your OpenClaw Discord config uses `groupPolicy: "allowlist"`, you must add the **voicebot’s bot user ID** to the allowlist or OpenClaw will ignore its messages.

### TTS (Edge / Piper)
```
TTS_PROVIDER=edge
TTS_PYTHON=./.venv/bin/python
```
If you use **Piper**:
```
TTS_PROVIDER=piper
```
Defaults for voice/model live in `vc-voicebot/scripts/edge_tts.py` and `vc-voicebot/scripts/piper_tts.py`.

### Filtering (recommended)
- `YOUR_USER_ID` → only transcribe your voice
- `OPENCLAW_BOT_ID` → only speak OpenClaw replies
- Keep `ALLOW_BOT_MESSAGES=true`

---

## 5) Run

```bash
# run from vc-voicebot/
npm start
```

---

## 7) Commands (text channel)

- `/join` → join your current VC
- `/beep` → play two beeps to confirm audio

---

## 8) Logs + timing

```bash
# start in background
nohup npm start >> /tmp/vc-voicebot.log 2>&1 &

# follow logs
tail -f /tmp/vc-voicebot.log

# timing stats
grep -n "\[timing\]" /tmp/vc-voicebot.log | tail -n 20
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
- `vc-voicebot/` → **single‑bot STT + TTS**
