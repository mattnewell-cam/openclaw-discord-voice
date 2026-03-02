# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## notion

- Use whenever you need to write help requests, suggestions, notes, thoughts to matt; and to read his responses

## ask-matt

- urgent ping path to Matt in Discord (tool call, not a direct turn-ending reply)
- discord account: `rainmaker-discord`
- target channel: `1476349980141682718`
- mention: `<@761322821845647371>`
- backup email: `matthew_newell@outlook.com`
- **main use: when you can't get through "not a robot"/human touch things**

## browser defaults (auth/dynamic websites)

- Use skill: `browser-auth-visible` when:
  - a website requires sign in, or
  - content is not accessible via simple HTML requests/fetch.
- Required preflight for visible windows (no decisions):
  - always set gateway env vars via `gateway.config.patch` before browser use:
    - `DISPLAY=:0`
    - `XAUTHORITY=/home/matth/.Xauthority`
    - `XDG_RUNTIME_DIR=/run/user/1000`
    - `WAYLAND_DISPLAY=wayland-0`
  - then restart + hard reset (`browser.stop` + kill stale `--remote-debugging-port=18800` + `browser.start`) for `profile="openclaw"`
  - require explicit visibility verdict after probe open/focus:
    - automatic via `wmctrl` window-diff when available, else
    - explicit user yes/no confirmation
- Default browser settings:
  - `target="host"`
  - `profile="openclaw"`
  - snapshots with `refs="aria"`

---

You should make an effort to add skills that might be useful over time - e.g. nano banana image gen, or rapid STT and TTS for phone calls. This is your cheat sheet - build it. 
