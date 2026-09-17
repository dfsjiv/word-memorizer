"""Build a compact, high-frequency dictionary from the ECDICT CSV dataset."""

import csv
import gzip
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "work" / "ecdict" / "ecdict.csv"
OUTPUT = ROOT / "dictionary"
TIER_SIZES = [3_000, 10_000, 30_000, 100_000]
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

    entries = [item[1] for item in sorted(selected.values(), key=lambda item: (item[0], str(item[1]["word"]).casefold()))]
    OUTPUT.mkdir(parents=True, exist_ok=True)
    tiers = []
    offset = 0
    for size in TIER_SIZES:
        tier_entries = entries[offset:size]
        filename = f"tier-{size}.json"
        payload = {"from": offset, "to": size, "entries": tier_entries}
        target = OUTPUT / filename
        target.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        tiers.append({"size": size, "from": offset, "file": filename, "entryCount": len(tier_entries)})
        print(f"Wrote tier {offset:,}–{size:,}: {target.stat().st_size:,} bytes")
        offset = size

    shards: dict[str, list[dict[str, object]]] = {}
    for entry in entries:
        letter = str(entry["word"])[0].lower()
        shards.setdefault(letter, []).append(entry)
    shard_manifest = []
    shard_dir = OUTPUT / "shards"
    shard_dir.mkdir(exist_ok=True)
    for letter, shard_entries in sorted(shards.items()):
        filename = f"{letter}.json.gz"
        target = shard_dir / filename
        content = json.dumps({"letter": letter, "entries": shard_entries}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        with gzip.open(target, "wb", compresslevel=9) as stream:
            stream.write(content)
        shard_manifest.append({"letter": letter, "file": f"shards/{filename}", "entryCount": len(shard_entries)})
        print(f"Wrote shard {letter}: {len(shard_entries):,} entries, {target.stat().st_size:,} bytes")

    manifest = {
        "name": "ECDICT layered dictionary",
        "source": "https://github.com/skywind3000/ECDICT",
        "license": "MIT",
        "entryCount": len(entries),
        "tiers": tiers,
        "shards": shard_manifest,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote manifest for {len(entries):,} unique entries")


if __name__ == "__main__":
    main()
