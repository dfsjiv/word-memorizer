# ECDICT Layered Dictionary

This directory contains frequency tiers and compressed alphabetic shards generated from
[ECDICT](https://github.com/skywind3000/ECDICT), an English-to-Chinese
dictionary database released under the MIT License.

Entries require a Chinese translation and are limited to Latin-script words and
short phrases. Frequency tiers allow the client to cache the top 3,000, 10,000,
30,000, or 100,000 entries. Compressed alphabetic shards provide on-demand
GitHub lookup across the larger dataset when a word is not cached locally.

The generated data is served directly from this repository. It is not bundled
inside the Windows installer. Run `python scripts/build_dictionary.py` after
placing the upstream `ecdict.csv` at `work/ecdict/ecdict.csv` to regenerate it.

See `ECDICT-LICENSE` for the upstream license.
