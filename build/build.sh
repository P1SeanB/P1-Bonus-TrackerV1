#!/bin/sh
# Reproducible build: original v21 index.html → spec v2.7 edits → inline modules.
set -e; cd "$(dirname "$0")/.."
cp build/index.orig.html index.html
python3 build/patch1.py
python3 build/patch2.py
python3 build/patch3.py
python3 build/assemble.py
