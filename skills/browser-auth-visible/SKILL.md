---
name: browser-auth-visible
description: Use visible host-browser automation for login-required or JS-heavy websites that are not reliably accessible through simple HTML fetches. Trigger when a site requires sign-in, anti-bot checks, interactive UI actions, or dynamic rendering. Enforce GUI session env vars, a fixed fresh-start sequence, and an explicit visibility verdict (OS window diff or user confirmation).
---

# Browser Auth + Visible Session (No-Decision Recipe)

Use this workflow for real websites that need authenticated sessions and live UI.

## Fixed defaults (do not improvise)

- `target: "host"`
- `profile: "openclaw"`
- snapshots: `refs: "aria"`

## Mandatory preflight (run exactly in this order)

Goal: fresh browser + explicit visible/not-visible verdict every time.

1. Apply gateway env vars with one patch:

```json
{
  "env": {
    "vars": {
      "DISPLAY": ":0",
      "XAUTHORITY": "/home/matth/.Xauthority",
      "XDG_RUNTIME_DIR": "/run/user/1000",
      "WAYLAND_DISPLAY": "wayland-0"
    }
  }
}
```

2. Let gateway restart (config.patch triggers restart).
3. `browser.stop` (`target:"host"`, `profile:"openclaw"`).
4. **Always** kill stale `--remote-debugging-port=18800` Chrome processes (no conditional skip).
5. Capture baseline window IDs (OS-level) if possible:
   - `exec`: `command -v wmctrl >/dev/null && wmctrl -lx | awk '/google-chrome|chromium/ {print $1}' | sort -u > /tmp/openclaw-win-before.txt || :`
6. `browser.start` (`target:"host"`, `profile:"openclaw"`).
7. Open probe tab and focus it:
   - `browser.open` → `https://example.org/?openclaw-visible-check=<timestamp>`
   - `browser.focus` same `targetId`
8. Produce a required visibility verdict:
   - Preferred (automatic):
     - `exec`: `command -v wmctrl >/dev/null && wmctrl -lx | awk '/google-chrome|chromium/ {print $1}' | sort -u > /tmp/openclaw-win-after.txt || :`
     - `exec`: `if command -v wmctrl >/dev/null; then new=$(comm -13 /tmp/openclaw-win-before.txt /tmp/openclaw-win-after.txt | wc -l); [ "$new" -gt 0 ] && echo VISIBLE || echo NOT_VISIBLE; else echo UNKNOWN_NO_WMCTRL; fi`
   - Fallback (when wmctrl unavailable): ask user directly: **“Do you see a new Example Domain browser window on your toolbar? yes/no”**.

## Required retry rule

If verdict is `NOT_VISIBLE` (or user says no), do one deterministic retry:

1. `browser.stop` (`target:"host"`, `profile:"openclaw"`)
2. Kill stale `--remote-debugging-port=18800` process(es)
3. `browser.start` (`target:"host"`, `profile:"openclaw"`)
4. Re-open + focus probe tab
5. Re-run visibility verdict

If still not visible after one retry, stop and report failure clearly.

No alternative profiles. No relay attach flow. No `profile:"chrome"`.

## Task workflow after preflight

1. Open/navigate target site with `browser.open`/`browser.navigate` using `target="host"`, `profile="openclaw"`.
2. Snapshot with `refs="aria"`.
3. Interact using `browser.act` against the same `targetId`.
4. Re-snapshot after important transitions (login complete, modal dismissed, next view loaded).

## Use this instead of simple HTML requests when

- Site requires sign-in/session cookies
- Content is JS-rendered and missing in raw fetch output
- Anti-bot or challenge pages appear
- Task needs real UI actions (click/type/upload/drag/hold)

## Stability rules

- Keep one active tab flow per task.
- Reuse the same `targetId` while operating that tab.
- Prefer deterministic actions (`click`, `type`, `press`, `select`) over custom evaluate.
- Use evaluate only for edge cases (custom events, hold interactions, diagnostics).
- Do not claim visibility without a verdict from step 8 (automatic or user-confirmed).
