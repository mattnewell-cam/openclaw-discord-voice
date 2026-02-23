# OpenClaw Discord Voice (STT + TTS)

Two small services that make Discord voice usable with OpenClaw:

- **vc-transcriber**: joins a voice channel, transcribes with faster‑whisper, posts to a text channel
- **voice-bridge**: speaks a text channel into voice (Edge TTS or Piper), and relays OpenClaw replies

---

## 1) Discord setup (bots + permissions)

You’ll typically want **two bots** (one for STT, one for TTS). You can reuse one bot, but separating them avoids loops.

### Create bots
1. Go to <https://discord.com/developers/applications>
2. **New Application** → add a **Bot**
3. **Enable Message Content Intent** (Bot → Privileged Gateway Intents)
4. Copy the **Bot Token** (you’ll use it in `.env`)

### Invite bots to your server
Use the OAuth2 URL generator in the dev portal:
- Scopes: **bot**
- Permissions:
  - View Channels
  - Read Message History
  - Send Messages
  - Connect
  - Speak

Repeat for both bots.

### Get IDs (guild + channels)
In Discord: **Settings → Advanced → Developer Mode** → ON.
Right‑click and **Copy ID** for:
- **Guild/Server ID**
- **Voice Channel ID**
- **Text Channel ID** (where transcripts/replies go)

---

## 2) Requirements

- Node.js 18+
- Python 3.10+
- ffmpeg

On Ubuntu:
```bash
sudo apt-get update
sudo apt-get install -y ffmpeg python3-venv
```

---

## 3) vc‑transcriber setup (STT)

```bash
cd vc-transcriber
npm install
./scripts/setup.sh
cp .env.example .env
# edit .env
npm start
```

### Key `.env` values
- `DISCORD_TOKEN` (transcriber bot token)
- `GUILD_ID`
- `VOICE_CHANNEL_ID`
- `TEXT_CHANNEL_ID`
- `WHISPER_PYTHON=./.venv/bin/python`
- `WHISPER_MODEL=tiny|base|small|...` (smaller = faster)

### Gated “start/end message” mode
Enable:
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
Set your user ID so bots follow you:
```
LEAVE_ON_USER_IDS=YOUR_USER_ID
```
Behavior:
- When **you join a VC**, bot auto‑joins
- When **no humans remain**, bot leaves

### Commands (text channel)
- `/join` → joins your current VC
- `/beep` → plays two beeps (test audio)

---

## 4) voice‑bridge setup (TTS)

```bash
cd voice-bridge
npm install
python3 -m venv .venv
./.venv/bin/pip install edge-tts piper-tts pathvalidate
cp .env.example .env
# edit .env
npm start
```

### Key `.env` values
- `DISCORD_TOKEN` (bridge bot token)
- `GUILD_ID`
- `VOICE_CHANNEL_ID`
- `TEXT_CHANNEL_ID`

### TTS provider
- **Edge (default)**:
  - `TTS_PROVIDER=edge`
  - `EDGE_VOICE=en-GB-RyanNeural` (or any Edge voice)
- **Piper**:
  - `TTS_PROVIDER=piper`
  - `PIPER_MODEL=voices/<your-model>.onnx`
  - Optional: `PIPER_SPEAKER`, `PIPER_LENGTH_SCALE`, etc.

### Single‑channel setup (recommended)
If you want **one channel** for transcripts + replies:
```
TEXT_CHANNEL_ID=<same channel>
TRANSCRIBE_CHANNEL_ID=
REPLY_CHANNEL_ID=
```
Then restrict who gets spoken:
```
SPEAK_USER_IDS=<OpenClawBotID>
IGNORE_USER_IDS=<TranscriberBotID>
```
This prevents the bridge from reading the transcriber’s output aloud.

---

## 5) OpenClaw integration (optional)

If OpenClaw is replying in the same Discord channel, ensure:
- That channel allows bot messages
- You set a **system prompt** appropriate for voice transcripts

Example (OpenClaw config):
```
"systemPrompt": "You are the voice transcribe assistant. Respond only to clear, direct questions or requests..."
```

---

## 6) Running + logs

Start in background with logs:
```bash
# vc-transcriber
cd vc-transcriber
nohup npm start >> /tmp/vc-transcriber.log 2>&1 &

# voice-bridge
cd voice-bridge
nohup npm start >> /tmp/voice-bridge.log 2>&1 &
```

Tail logs:
```bash
tail -f /tmp/vc-transcriber.log
tail -f /tmp/voice-bridge.log
```

Timing stats (vc‑transcriber):
```bash
grep -n "\[timing\]" /tmp/vc-transcriber.log | tail -n 20
```

---

## 7) Troubleshooting

**No transcripts:**
- Check bot is in the correct VC
- Check permissions (Connect, Speak, Message Content intent)
- Ensure the bot is **not deafened**
- Check `.env` IDs

**Beep not audible:**
- Right‑click bot in VC → **User Volume**
- Ensure you’re not **deafened**
- Confirm your Discord output device

**Crash on opus decode:**
- Use `@discordjs/opus` (not `opusscript`)

---

## Repo layout
- `vc-transcriber/`
- `voice-bridge/`

## Notes
- **No secrets are committed**. Use `.env` locally.
- If you only want STT, you only need `vc-transcriber`.
- If you only want TTS/replies, you only need `voice-bridge`.
