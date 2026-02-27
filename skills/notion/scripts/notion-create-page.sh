#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: notion-create-page.sh <parent_page_id> <title> [first_paragraph]" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required" >&2
  exit 2
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PARENT_PAGE_ID="$1"
TITLE="$2"
FIRST_PARAGRAPH="${3:-}"

if [[ -n "$FIRST_PARAGRAPH" ]]; then
  BODY=$(jq -cn --arg p "$PARENT_PAGE_ID" --arg t "$TITLE" --arg c "$FIRST_PARAGRAPH" '{parent:{page_id:$p},properties:{title:{title:[{type:"text",text:{content:$t}}]}},children:[{object:"block",type:"paragraph",paragraph:{rich_text:[{type:"text",text:{content:$c}}]}}]}')
else
  BODY=$(jq -cn --arg p "$PARENT_PAGE_ID" --arg t "$TITLE" '{parent:{page_id:$p},properties:{title:{title:[{type:"text",text:{content:$t}}]}}}')
fi

"$SCRIPT_DIR/notion-api.sh" POST pages "$BODY"
