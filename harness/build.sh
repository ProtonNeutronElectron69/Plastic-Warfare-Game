#!/bin/sh
# Rebuild game.js from the game file, so the tests always run the real game code.
#
#   ./build.sh                        uses ../plastic-warfare.html
#   ./build.sh /path/to/other.html    uses a different file
#
# It produces two files, neither of which is stored in the repo, because both are
# copies of code that already lives in plastic-warfare.html and a second copy is a
# second thing to accidentally edit:
#
#   game.js   the game's <script> block on its own, which the tails run against
#   pw.html   a copy of the whole game file, because nine tails read 'pw.html'
#             from the working directory to lint the SOURCE TEXT (T41.F, T43.J,
#             T44.F, T49.A/D, T50.A, T53.H, T54.G and the v76/v77 source checks).
#
# Regenerating pw.html here is what keeps the source lints honest. In the v82
# bundle these two files had drifted a version apart - pw.html was still v81
# while game.js was v82 - so every source-text check was linting the PREVIOUS
# release while the behavioural checks ran the current one, and nothing said so.
# Deriving both from one file in one step makes that drift impossible.
#
# Run this first, then ./run.sh or ./seg.sh.
#
# v91 (roadmap 3, phase 1): the game file is GENERATED now - assembled from
# ../source/ by ../build.sh - so this script runs that first. That keeps the one
# instruction everybody already knows ("cd harness && ./build.sh") correct after
# the split: edit a file in source/js/, run this, and the tests see the edit.
# Without the chain the suite would happily test a stale plastic-warfare.html
# against fresh sources, which is exactly the drift the v82 note below describes,
# one level further up. Skipped when the root build is absent (a bundle taking an
# explicit SRC argument, or a checkout from before v91).
set -e

SRC="${1:-../plastic-warfare.html}"

if [ $# -eq 0 ] && [ -x ../build.sh ] && [ -d ../source ]; then
  ../build.sh > /dev/null
fi

[ -f "$SRC" ] || { echo "no such game file: $SRC" >&2; exit 2; }

n=$(grep -c '<script>' "$SRC")
[ "$n" = "1" ] || { echo "expected exactly 1 <script> tag in $SRC, found $n" >&2; exit 2; }

S=$(grep -n '<script>'  "$SRC" | cut -d: -f1)
E=$(grep -n '</script>' "$SRC" | cut -d: -f1)
sed -n "$((S+1)),$((E-1))p" "$SRC" > game.js
cp "$SRC" pw.html

node --check game.js
echo "game.js rebuilt from $SRC ($(wc -c < game.js) bytes) and parses cleanly"
echo "pw.html  refreshed from $SRC ($(wc -c < pw.html) bytes) for the source-text lints"
