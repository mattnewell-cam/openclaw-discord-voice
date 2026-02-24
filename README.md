# OpenClaw Voicebot for Discord

Openclaw is finally hands-free! This bot joins a specified voice chat when you do, transcribes your speech to text in a chat with Openclaw, then reads Openclaw's response back to you. 

---

## Usage
*(Setup instructions beneath).*

**Start the bot**
Navigate to your openclaw-discord-bot/vc-voicebot folder, then:
```bash
# run from vc-voicebot/
npm start
```

**Join VC**
- Join your configured voice channel.
- The bot should auto‑join when `YOUR_USER_ID` enters. If it doesn’t, run `/join` in the text channel.

**Send a voice message to OpenClaw**
1) Say **“start message”** in VC
2) Wait for the **beep** (gate open)
3) Speak your message clearly and naturally
4) Say **“end message”** to finish (gate closes + sends)

**What happens next**
- Your speech is transcribed into the text channel.
- OpenClaw replies in the same channel.
- The bot speaks OpenClaw’s reply back in VC.

Notes:
- You can edit your start/end phrases in `.env` (`TRANSCRIBE_START_PHRASES`, `TRANSCRIBE_STOP_PHRASES`).
- It can help to say them twice: **“start message, start message”** / **“end message, end message.”**
- Saying **“start message”** again **restarts** the buffer.

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
- Rename it `openclaw-discord-voicebot` so later commands work

---

### 1) Create the bot and invite to server

1. Go to <https://discord.com/developers/applications>
2. **New Application** → add a **Bot**
3. Sidebar: Bot → Reset Token, copy it (we'll need this later) → Save changes
4. Scroll down → Enable Message Content Intent
5. Sidebar: OAuth2 → Scopes: **bot**
6. Scroll down to Bot Permissions → select:
  - View Channels
  - Read Message History
  - Send Messages
  - Connect
  - Speak
7. Scroll down to Generated URL and copy it
8. Go to URL, authorise, and add it to your personal server
---

### 2) OpenClaw integration

In your server:
- Add the **OpenClaw bot** to the same server as the voicebot.
- Pick a **text channel** where OpenClaw replies (e.g. `#transcripts`). This must be the same channel you’ll set as `TEXT_CHANNEL_ID`.
- Pick a **voice channel** for speaking/listening (set `VOICE_CHANNEL_ID`).

If OpenClaw uses an allowlist, add the **voicebot’s bot user ID** there (see config notes below).

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

### 3) Install

```bash
cd openclaw-discord-voicebot/vc-voicebot

npm install
./scripts/setup.sh
cp .env.example .env
```

---

### 4) Configure .env

Discord token is the one you copied during the bot setup. If you have lost it, you can get another one by going back to <https://discord.com/developers/applications> → Bot → Reset token

For the others, first turn Discord Developer Mode on (Discord → Settings → Advanced). Then you can get IDs by right clicking a server, channel or user and selecting "Copy ID". Paste them into this section of .env:

```
DISCORD_TOKEN=
GUILD_ID=
VOICE_CHANNEL_ID=
TEXT_CHANNEL_ID=
YOUR_USER_ID=
OPENCLAW_BOT_ID=
```

Optional configurations are detailed at the bottom of this README.

---

### 5) Run

```bash
# run from vc-voicebot/
npm start
```

---

## Additional Configurations

**STT (Whisper)**
```
WHISPER_PYTHON=./.venv/bin/python
WHISPER_MODEL=tiny|base|small|...
(Default: tiny)
WHISPER_LANGUAGE=en
```
Smaller model = faster responds to "start/end message" but slightly worse transcriptions.

**Start/stop gating (always on)**
```
TRANSCRIBE_START_PHRASES=start message,stop message,so message,start the message,star message,strong message
TRANSCRIBE_STOP_PHRASES=end message,and message
```
Note: "stop message" is included as a start phrase as it is a frequent mis-transcription of "start message". 

Auto‑join / auto‑leave
Auto‑join/leave follows `YOUR_USER_ID` (no separate setting).

**TTS (Edge / Piper)**
```
TTS_PROVIDER=edge
TTS_PYTHON=./.venv/bin/python
```
If you use **Piper**:
```
TTS_PROVIDER=piper
```
Defaults for voice/model live in `vc-voicebot/scripts/edge_tts.py` and `vc-voicebot/scripts/piper_tts.py`.

---

## Logs + timing

```bash
# start in background
nohup npm start >> /tmp/vc-voicebot.log 2>&1 &

# follow logs
tail -f /tmp/vc-voicebot.log

# timing stats
grep -n "\[timing\]" /tmp/vc-voicebot.log | tail -n 20
```

---

## Troubleshooting

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
