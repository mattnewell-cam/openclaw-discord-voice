---
name: ask-matt
description: Ask Matt for input without ending your current turn. Sends a Discord ping and a backup email.
---

# Ask Matt Skill

Use this when you're blocked and need Matt's input **mid-task**.

## What to do

1. Send a Discord ping with the `message` tool (primary path).
2. Send a backup email via AgentMail script (secondary path).
3. Continue working; do not stop the turn just because you asked.

## 1) Discord ping (primary)

Use `message` tool with:

- `action`: `send`
- `channel`: `discord`
- `accountId`: `rainmaker-discord`
- `target`: `1476349980141682718` (the Rainmaker↔Matt Discord channel)
- `message` format:

```text
<@761322821845647371> [ask-matt] {question}
Context: {one short line, optional}
```

## 2) Backup email (secondary)

Run:

```bash
node skills/ask-matt/scripts/send-ask-matt-email.js "{question}" "{optional context}"
```

Default recipient is `matthew_newell@outlook.com`.

The script reads AgentMail credentials from (in order):

1. `ASK_MATT_AGENTMAIL_API_KEY`
2. `AGENTMAIL_API_KEY`
3. `STATE-OF-AFFAIRS.md`

## Rules

- Keep asks short and specific.
- One clear question per ask.
- Use only when truly blocked or when clarification materially improves output.
- For non-urgent notes, use Notion flow instead.
