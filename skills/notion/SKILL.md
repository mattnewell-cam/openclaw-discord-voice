---
name: notion
description: Work with Notion pages and databases via the Notion API. Use when asked to capture notes in Notion, append updates to a page, create pages under a parent page, or query/update a Notion database.
---

# Notion Skill

Use the helper scripts in `scripts/` for reliable Notion API calls.

## Token and headers

- Prefer `NOTION_API_TOKEN`.
- Fallbacks supported by scripts: `NOTION_TOKEN`, `NOTION_API_KEY`.
- API version is pinned to `2022-06-28`.

## Quick workflows

1. **Append text to an existing page**
   - Run `scripts/notion-append-paragraph.sh <page_id> "text"`.

2. **Create a child page under a parent page**
   - Run `scripts/notion-create-page.sh <parent_page_id> "Title" "Optional first paragraph"`.

3. **Query a database**
   - Run `scripts/notion-query-database.sh <database_id> [json_filter]`.
   - Example filter: `'{"filter":{"property":"Status","status":{"equals":"Todo"}}}'`.

4. **Raw API call (advanced)**
   - Run `scripts/notion-api.sh <METHOD> <endpoint> [json_body]`.
   - Endpoint examples: `pages`, `blocks/<block_id>/children`, `databases/<database_id>/query`.

## Guardrails

- Validate IDs before calling (32 hex chars, with or without dashes).
- Keep writes minimal and explicit; avoid bulk destructive updates unless directly requested.
- For large notes, split into multiple paragraph blocks instead of one giant block.
