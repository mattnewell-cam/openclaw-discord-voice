#!/usr/bin/env python3
"""Wait for a new inbound SMS on a Twilio number and extract an OTP code.

Outputs JSON on success.
Exit codes:
  0 success
  2 bad input / missing credentials
  3 timeout
  4 Twilio/API error
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Set


def fail(msg: str, code: int) -> None:
    print(json.dumps({"ok": False, "error": msg}), file=sys.stderr)
    raise SystemExit(code)


def twilio_list_messages(account_sid: str, auth_token: str, params: Dict[str, str]) -> List[Dict[str, Any]]:
    query = urllib.parse.urlencode(params)
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json?{query}"

    auth_raw = f"{account_sid}:{auth_token}".encode("utf-8")
    auth_hdr = base64.b64encode(auth_raw).decode("ascii")

    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Basic {auth_hdr}")

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        fail(f"Twilio request failed: {e}", 4)

    try:
        payload = json.loads(body)
    except Exception as e:
        fail(f"Failed to parse Twilio JSON response: {e}", 4)

    msgs = payload.get("messages")
    if not isinstance(msgs, list):
        fail("Twilio response missing 'messages' list", 4)
    return msgs


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Wait for a new inbound Twilio SMS and extract OTP code")
    ap.add_argument("--to", required=True, help="Twilio destination number that receives OTP (E.164, e.g. +15551234567)")
    ap.add_argument("--from", dest="from_number", help="Optional sender number filter (E.164)")
    ap.add_argument("--timeout", type=int, default=180, help="Max wait time in seconds (default: 180)")
    ap.add_argument("--interval", type=float, default=3.0, help="Polling interval in seconds (default: 3)")
    ap.add_argument("--regex", default=r"(?<!\\d)\\d{6}(?!\\d)", help="Regex used to extract OTP from SMS body")
    ap.add_argument("--digits", type=int, choices=range(3, 11), metavar="N", help="Shortcut for exact N-digit OTP regex")
    ap.add_argument("--page-size", type=int, default=20, help="Twilio message page size (default: 20)")
    ap.add_argument("--account-sid", default=os.getenv("TWILIO_ACCOUNT_SID"), help="Twilio Account SID (or env TWILIO_ACCOUNT_SID)")
    ap.add_argument("--auth-token", default=(os.getenv("TWILIO_AUTH_TOKEN") or os.getenv("TWILIO_AUTH")), help="Twilio Auth Token (env TWILIO_AUTH_TOKEN or TWILIO_AUTH)")
    ap.add_argument("--verbose", action="store_true", help="Print polling debug logs to stderr")
    return ap.parse_args()


def normalize_num(s: str) -> str:
    return s.strip().replace(" ", "")


def main() -> None:
    args = parse_args()

    account_sid = (args.account_sid or "").strip()
    auth_token = (args.auth_token or "").strip()
    to_num = normalize_num(args.to)
    from_num = normalize_num(args.from_number) if args.from_number else None

    if not account_sid or not auth_token:
        fail("Missing Twilio credentials. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.", 2)
    if not to_num.startswith("+"):
        fail("--to must be E.164 format, e.g. +15551234567", 2)
    if from_num and not from_num.startswith("+"):
        fail("--from must be E.164 format, e.g. +15551234567", 2)
    if args.timeout <= 0:
        fail("--timeout must be > 0", 2)
    if args.interval <= 0:
        fail("--interval must be > 0", 2)

    otp_pattern = args.regex
    if args.digits is not None:
        otp_pattern = rf"(?<!\\d)\\d{{{args.digits}}}(?!\\d)"

    try:
        otp_re = re.compile(otp_pattern)
    except re.error as e:
        fail(f"Invalid regex: {e}", 2)

    base_params = {
        "To": to_num,
        "PageSize": str(args.page_size),
    }

    # Snapshot currently visible messages so we only act on truly new ones.
    initial = twilio_list_messages(account_sid, auth_token, base_params)
    seen_sids: Set[str] = {
        str(m.get("sid"))
        for m in initial
        if m.get("sid")
    }

    if args.verbose:
        print(f"[sms-otp] baseline seen={len(seen_sids)} to={to_num}", file=sys.stderr)

    deadline = time.time() + args.timeout

    while time.time() < deadline:
        msgs = twilio_list_messages(account_sid, auth_token, base_params)

        for m in msgs:
            sid = str(m.get("sid") or "")
            if not sid or sid in seen_sids:
                continue

            seen_sids.add(sid)

            direction = str(m.get("direction") or "")
            if direction not in ("inbound", "inbound-api"):
                continue

            msg_from = normalize_num(str(m.get("from") or ""))
            if from_num and msg_from != from_num:
                continue

            body = str(m.get("body") or "")
            match = otp_re.search(body)
            if not match:
                if args.verbose:
                    print(f"[sms-otp] new SMS sid={sid} but no OTP match", file=sys.stderr)
                continue

            out = {
                "ok": True,
                "code": match.group(0),
                "sid": sid,
                "from": msg_from,
                "to": normalize_num(str(m.get("to") or "")),
                "body": body,
                "receivedAt": m.get("date_created") or m.get("date_sent") or None,
                "direction": direction,
            }
            print(json.dumps(out, ensure_ascii=False))
            return

        time.sleep(args.interval)

    fail(f"Timed out after {args.timeout}s waiting for SMS OTP on {to_num}", 3)


if __name__ == "__main__":
    main()
