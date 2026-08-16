#!/bin/sh
# Rebuild game.js from the game file, so the tests always run the real game code.
#
#   ./build.sh                        uses ../plastic-warfare.html
#   ./build.sh /path/to/other.html    uses a different file
#
# game.js is the game's <script> block on its own. It is deliberately NOT stored
# in the repo: it is a copy of code that already lives in plastic-warfare.html,
# and a second copy is a second thing to accidentally edit. Run this first, then
# ./run.sh or ./seg.sh.
set -e

SRC="${1:-../plastic-warfare.html}"
[ -f "$SRC" ] || { echo "no such game file: $SRC" >&2; exit 2; }

n=$(grep -c '<script>' "$SRC")
[ "$n" = "1" ] || { echo "expected exactly 1 <script> tag in $SRC, found $n" >&2; exit 2; }

S=$(grep -n '<script>'  "$SRC" | cut -d: -f1)
E=$(grep -n '</script>' "$SRC" | cut -d: -f1)
sed -n "$((S+1)),$((E-1))p" "$SRC" > game.js

node --check game.js
echo "game.js rebuilt from $SRC ($(wc -c < game.js) bytes) and parses cleanly"
