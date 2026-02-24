#!/usr/bin/env bash
set -euo pipefail

# Run from vc-voicebot/
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKDIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SERVICE_DST="/etc/systemd/system/openclaw-voicebot.service"
USER_NAME="$(whoami)"
NPM_PATH="$(command -v npm)"

if [[ -z "${NPM_PATH}" ]]; then
  echo "npm not found in PATH. Install Node.js 18+ first." >&2
  exit 1
fi

SERVICE_CONTENT="[Unit]
Description=OpenClaw Discord Voicebot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${USER_NAME}
WorkingDirectory=${WORKDIR}
ExecStart=${NPM_PATH} start
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
"

echo "Installing systemd service to ${SERVICE_DST}..."
echo "This will ask for your sudo password."

printf "%s" "${SERVICE_CONTENT}" | sudo tee "${SERVICE_DST}" > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-voicebot

echo "Done. Service is running and will start on boot."
echo "Logs: sudo journalctl -u openclaw-voicebot -f"
