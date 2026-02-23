#!/usr/bin/env bash
set -euo pipefail

python3 -m venv .venv
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install faster-whisper edge-tts piper-tts pathvalidate

echo "Setup complete."
