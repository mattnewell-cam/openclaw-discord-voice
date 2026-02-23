#!/usr/bin/env python3
import argparse
import subprocess
import sys

PIPER_MODEL = "voices/en_GB-northern_english_male-medium.onnx"
PIPER_DATA_DIR = "voices"
PIPER_SPEAKER = ""
PIPER_LENGTH_SCALE = "0.95"
PIPER_NOISE_SCALE = ""
PIPER_NOISE_W_SCALE = ""
PIPER_SENTENCE_SILENCE = "0.12"


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
        "piper",
        "-m",
        PIPER_MODEL,
        "--data-dir",
        PIPER_DATA_DIR,
    ]

    if PIPER_SPEAKER:
        cmd += ["--speaker", PIPER_SPEAKER]
    if PIPER_LENGTH_SCALE:
        cmd += ["--length-scale", PIPER_LENGTH_SCALE]
    if PIPER_NOISE_SCALE:
        cmd += ["--noise-scale", PIPER_NOISE_SCALE]
    if PIPER_NOISE_W_SCALE:
        cmd += ["--noise-w-scale", PIPER_NOISE_W_SCALE]
    if PIPER_SENTENCE_SILENCE:
        cmd += ["--sentence-silence", PIPER_SENTENCE_SILENCE]

    cmd += ["-f", args.out, "--", args.text]

    subprocess.run(cmd, check=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
