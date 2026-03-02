---
name: browser-click-hold
description: Perform click-and-hold (long press) interactions in headed browser flows. Use when websites require holding the left/right/middle mouse button to trigger UI behavior.
---

# Browser Click-and-Hold

Use this skill when a site needs a real "press and hold" interaction instead of a normal click.

## When to use

- Drag handles that start only after a hold
- Hold-to-confirm controls
- Mouse button test pages
- Any UI that reacts differently to `mousedown` vs `mouseup`

## Preferred flow (headed browser)

1. Open/navigate with `browser` on `target="host"` **and explicit `profile:"openclaw"`**.
   - Do not rely on implicit/default profile selection for host flows.
2. Get a snapshot to identify the target area.
3. Run `browser.act` with `kind:"evaluate"` and dispatch mouse events with a delay between down/up.
4. Verify the state changes during hold and again after release.

## Reusable evaluate snippet

Replace `SELECTOR_HERE`, `HOLD_MS`, and `BUTTON` before running.

```js
async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const selector = "SELECTOR_HERE";   // e.g. '#mouse-container'
  const holdMs = HOLD_MS;              // e.g. 1200
  const buttonName = "BUTTON";        // 'left' | 'middle' | 'right'

  const buttonMap = { left: 0, middle: 1, right: 2 };
  const button = buttonMap[buttonName] ?? 0;

  const el = document.querySelector(selector);
  if (!el) return { ok: false, error: `Element not found: ${selector}` };

  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  const buttonsMask = button === 0 ? 1 : button === 1 ? 4 : 2;

  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: x, clientY: y }));
  el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y, buttons: 0 }));

  el.dispatchEvent(new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button,
    buttons: buttonsMask,
  }));

  await sleep(holdMs);

  el.dispatchEvent(new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button,
    buttons: 0,
  }));

  return { ok: true, selector, holdMs, button: buttonName };
}
```

## Validation pattern

- Check a target UI state before hold (e.g., opacity/class/text).
- Check again during hold.
- Check once more after release.
- If no change, retry with:
  - longer hold (`1500-2500ms`),
  - the actual interactive child element instead of container,
  - `right` or `middle` button when needed.

## Notes

- Keep this interaction in headed mode (`target="host"`) when sites are sensitive.
- Use minimal hold duration that reliably triggers behavior.
- If anti-bot logic blocks synthetic events, fall back to drag/click flows where possible.
