#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: notion-query-database.sh <database_id> [json_payload]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DATABASE_ID="$1"
PAYLOAD="${2:-{}}"

"$SCRIPT_DIR/notion-api.sh" POST "databases/$DATABASE_ID/query" "$PAYLOAD"
