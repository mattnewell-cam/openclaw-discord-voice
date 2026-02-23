#!/usr/bin/env python3
import argparse
import subprocess
import sys

VOICE = "en-GB-RyanNeural"
RATE = "+0%"
PITCH = "+0Hz"
VOLUME = "+0%"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    cmd = [
        sys.executable,
        "-m",
        "edge_tts",
        "--voice",
        VOICE,
        "--rate",
        RATE,
        "--pitch",
        PITCH,
        "--volume",
        VOLUME,
        "--text",
        args.text,
        "--write-media",
        args.out,
    ]
    subprocess.run(cmd, check=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
