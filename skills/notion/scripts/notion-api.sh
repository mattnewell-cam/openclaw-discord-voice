#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  notion-api.sh <METHOD> <endpoint> [json_body]

Examples:
  notion-api.sh GET pages/<page_id>
  notion-api.sh PATCH blocks/<block_id>/children '{"children":[...]}'
  notion-api.sh POST databases/<db_id>/query '{"filter":{...}}'
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -lt 2 ]]; then
  usage
  exit 0
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "error: curl is required" >&2
  exit 2
fi

METHOD="$1"
ENDPOINT="$2"
BODY="${3:-}"

TOKEN="${NOTION_API_TOKEN:-${NOTION_TOKEN:-${NOTION_API_KEY:-}}}"
if [[ -z "$TOKEN" ]]; then
  echo "error: set NOTION_API_TOKEN (or NOTION_TOKEN / NOTION_API_KEY)" >&2
  exit 2
fi

URL="https://api.notion.com/v1/${ENDPOINT#/}"

if [[ -n "$BODY" ]]; then
  curl -sS -X "$METHOD" "$URL" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Notion-Version: 2022-06-28" \
    -H "Content-Type: application/json" \
    --data "$BODY"
else
  curl -sS -X "$METHOD" "$URL" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Notion-Version: 2022-06-28"
fi
