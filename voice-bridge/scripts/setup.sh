#!/usr/bin/env bash
set -euo pipefail

VOICE=${1:-en_GB-northern_english_male-medium}
DATA_DIR=${2:-voices}

python3 -m venv .venv
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install edge-tts piper-tts pathvalidate
./.venv/bin/python -m piper.download_voices "$VOICE" --data-dir "$DATA_DIR"

echo "Setup complete. Voice: $VOICE (Edge TTS installed)"
