# OpenClaw Discord Voice (Single Bot STT + TTS)

One service, one bot: it joins a VC, transcribes speech to text, and speaks replies back into the VC.

- **vc-transcriber/** now does **both** STT + TTS
- **voice-bridge/** is legacy (two‑bot setup) and can be ignored

---

## 1) Discord setup (bot + permissions)

### Create the bot
1. Go to <https://discord.com/developers/applications>
2. **New Application** → add a **Bot**
3. **Enable Message Content Intent** (Bot → Privileged Gateway Intents)
4. Copy the **Bot Token**

### Invite the bot to your server
Use OAuth2 URL generator:
- Scopes: **bot**
- Permissions:
  - View Channels
  - Read Message History
  - Send Messages
  - Connect
  - Speak

### Get IDs (guild + channels)
Enable Developer Mode in Discord, then right‑click and **Copy ID**:
- **Guild/Server ID**
- **Voice Channel ID**
- **Text Channel ID** (where transcripts go)

---

## 2) Requirements

- Node.js 18+
- Python 3.10+
- ffmpeg

Ubuntu:
```bash
sudo apt-get update
sudo apt-get install -y ffmpeg python3-venv
```

---

## 3) Install + Run (single bot)

```bash
cd vc-transcriber
npm install
./scripts/setup.sh
cp .env.example .env
# edit .env
npm start
```

---

## 4) Configuration (.env)

### Core
```
DISCORD_TOKEN=
GUILD_ID=
VOICE_CHANNEL_ID=
TEXT_CHANNEL_ID=
SPEAK_CHANNEL_ID=   # optional; defaults to TEXT_CHANNEL_ID
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

# Only speak these authors in SPEAK_CHANNEL_ID
TTS_SPEAK_USER_IDS=OPENCLAW_BOT_ID
ALLOW_BOT_MESSAGES=true
```

---

## 5) Commands (text channel)

- `/join` → join your current VC
- `/beep` → play two beeps to confirm audio

---

## 6) Logs + timing

```bash
# start in background
nohup npm start >> /tmp/vc-transcriber.log 2>&1 &

# follow logs
tail -f /tmp/vc-transcriber.log

# timing stats
grep -n "\[timing\]" /tmp/vc-transcriber.log | tail -n 20
```

---

## 7) Troubleshooting

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
- `voice-bridge/` → legacy two‑bot bridge (optional)
