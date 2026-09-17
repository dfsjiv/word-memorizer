"""Build a compact, high-frequency dictionary from the ECDICT CSV dataset."""

import csv
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "work" / "ecdict" / "ecdict.csv"
OUTPUT = ROOT / "dictionary" / "ecdict-core.json"
LIMIT = 10_000
WORD_PATTERN = re.compile(r"[A-Za-z][A-Za-z .'-]{0,39}")


def number(value: str) -> int:
    try:
        parsed = int(value)
        return parsed if parsed > 0 else 9_999_999
    except (TypeError, ValueError):
        return 9_999_999


def compact_lines(value: str, limit: int) -> str:
    lines = [line.strip() for line in value.replace("\\n", "\n").splitlines() if line.strip()]
    preferred = [line for line in lines if not line.startswith("[网络]")]
    return "\n".join((preferred or lines)[:limit])


def main() -> None:
    csv.field_size_limit(sys.maxsize)
    selected: dict[str, tuple[int, dict[str, object]]] = {}

    with SOURCE.open("r", encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            word = (row.get("word") or "").strip()
            translation = compact_lines(row.get("translation") or "", 3)
            if not translation or not WORD_PATTERN.fullmatch(word):
                continue

            rank = min(number(row.get("frq") or ""), number(row.get("bnc") or ""))
            if rank == 9_999_999 and not (row.get("tag") or row.get("oxford")):
                continue

            key = word.casefold()
            entry = {
                "word": word,
                "phonetic": (row.get("phonetic") or "").strip(),
                "meaning": translation,
                "definition": compact_lines(row.get("definition") or "", 2),
                "tags": (row.get("tag") or "").split(),
                "rank": None if rank == 9_999_999 else rank,
            }
            previous = selected.get(key)
            if previous is None or rank < previous[0]:
                selected[key] = (rank, entry)

    entries = [item[1] for item in sorted(selected.values(), key=lambda item: (item[0], str(item[1]["word"]).casefold()))[:LIMIT]]
    payload = {
        "name": "ECDICT Core 10000",
        "source": "https://github.com/skywind3000/ECDICT",
        "license": "MIT",
        "entryCount": len(entries),
        "entries": entries,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(entries):,} entries to {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
