#!/usr/bin/env python3
import argparse
import asyncio
import sys
import edge_tts

VOICE = "en-GB-RyanNeural"
RATE = "+0%"
PITCH = "+0Hz"
VOLUME = "+0%"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args()


async def run(text: str, out_path: str):
    communicate = edge_tts.Communicate(
        text,
        VOICE,
        rate=RATE,
        pitch=PITCH,
        volume=VOLUME,
    )
    await communicate.save(out_path)


def main():
    args = parse_args()
    asyncio.run(run(args.text, args.out))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
