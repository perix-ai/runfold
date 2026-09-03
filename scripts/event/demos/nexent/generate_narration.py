"""Optionally regenerate the Nexent demo narration with edge-tts."""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[3]
DEFAULT_OUTPUT_DIR = REPO_ROOT / "build/event-demo/nexent/narration-regenerated"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Regenerate optional neural narration inputs for the Nexent demo."
    )
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--voice")
    parser.add_argument("--rate")
    parser.add_argument("--pitch")
    return parser.parse_args()


async def generate(args: argparse.Namespace) -> None:
    try:
        import edge_tts
    except ImportError as exc:  # pragma: no cover - optional online authoring dependency.
        raise SystemExit(
            "edge-tts is required only for narration regeneration; "
            "install requirements-voice.txt"
        ) from exc

    specification = json.loads(
        (SCRIPT_DIR / "narration.json").read_text(encoding="utf-8")
    )
    output_dir = args.output_dir.expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    voice = args.voice or specification["voice"]
    rate = args.rate or specification["rate"]
    pitch = args.pitch or specification["pitch"]

    for segment in specification["segments"]:
        stem = segment["stem"]
        media = output_dir / f"{stem}.mp3"
        subtitles = output_dir / f"{stem}.srt"
        communicator = edge_tts.Communicate(
            text=segment["text"],
            voice=voice,
            rate=rate,
            pitch=pitch,
            volume="+0%",
        )
        submaker = edge_tts.SubMaker()
        with media.open("wb") as audio:
            async for chunk in communicator.stream():
                if chunk["type"] == "audio":
                    audio.write(chunk["data"])
                elif chunk["type"] in {"WordBoundary", "SentenceBoundary"}:
                    submaker.feed(chunk)
        subtitles.write_text(submaker.get_srt(), encoding="utf-8")
        print(f"{stem}: {media.stat().st_size} bytes")


if __name__ == "__main__":
    asyncio.run(generate(parse_args()))
