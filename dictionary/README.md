# ECDICT Core 10000

This directory contains a compact 10,000-entry subset generated from
[ECDICT](https://github.com/skywind3000/ECDICT), an English-to-Chinese
dictionary database released under the MIT License.

Entries are selected by BNC/contemporary corpus frequency, require a Chinese
translation, and are limited to common Latin-script words and short phrases.
Translations are shortened to the first three useful lines to keep the remote
payload practical for a desktop client.

The generated data is served directly from this repository. It is not bundled
inside the Windows installer. Run `python scripts/build_dictionary.py` after
placing the upstream `ecdict.csv` at `work/ecdict/ecdict.csv` to regenerate it.

See `ECDICT-LICENSE` for the upstream license.
