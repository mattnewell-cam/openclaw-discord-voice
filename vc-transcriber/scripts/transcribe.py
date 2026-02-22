#!/usr/bin/env python3
import argparse
import sys
from faster_whisper import WhisperModel


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True)
    parser.add_argument("--model", default="small")
    parser.add_argument("--language", default="en")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    args = parser.parse_args()

    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    segments, _ = model.transcribe(
        args.file,
        language=args.language,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    text_parts = [seg.text.strip() for seg in segments if seg.text.strip()]
    transcript = " ".join(text_parts).strip()
    if transcript:
        print(transcript)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
