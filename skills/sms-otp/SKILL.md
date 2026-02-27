---
name: sms-otp
description: Fetch one-time passcodes (OTP) from inbound SMS during automation flows. Use when a task needs to wait for a verification code and continue in the same run, especially account signups, login verification, and phone confirmation steps.
---

# SMS OTP Skill

Use this skill when rainmaker needs an OTP **as a tool result** (not a separate chat turn).

## Required environment

Set these for rainmaker:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

## Main script

- `scripts/wait-for-sms-code.py`

### Typical call

```bash
python3 skills/sms-otp/scripts/wait-for-sms-code.py \
  --to "+15595748899" \
  --timeout 180 \
  --interval 3
```

### Optional filters

- `--from "+1..."` to restrict sender.
- `--regex '(?<!\\d)\\d{6}(?!\\d)'` to customize code matching.
- `--digits 4`/`--digits 8` as shorthand for fixed-length OTP.

## Behavior

1. Snapshot current inbound messages for the target number.
2. Poll Twilio until a **new** inbound SMS arrives.
3. Extract OTP from message body.
4. Return JSON to stdout with `code`, `sid`, `from`, `to`, `body`, and `receivedAt`.

## Guardrails

- Prefer test mode and non-production accounts while validating flows.
- Keep timeouts explicit; do not wait forever.
- If no code arrives, fail clearly and let caller decide retry/abort.
- Never print secrets in logs or chat output.
