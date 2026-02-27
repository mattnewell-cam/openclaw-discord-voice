#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: notion-append-paragraph.sh <page_id> <text>" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required" >&2
  exit 2
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PAGE_ID="$1"
shift
TEXT="$*"

BODY=$(jq -cn --arg t "$TEXT" '{children:[{object:"block",type:"paragraph",paragraph:{rich_text:[{type:"text",text:{content:$t}}]}}]}')

"$SCRIPT_DIR/notion-api.sh" PATCH "blocks/$PAGE_ID/children" "$BODY"
