#!/bin/sh
# probe_v106.sh - per-ability usage for the bots. A MEASUREMENT, not a test:
# nothing it prints is pinned and it is not part of seg.sh.
#   ./probe_v106.sh                    3 matches
#   SEEDS="7 8" MAP=kitchen ./probe_v106.sh
set -e
cd "$(dirname "$0")"
./build.sh >/dev/null
cat shim_head.js game.js probe_v106.js > pv106.js
for s in ${SEEDS:-101 907 555}; do
  MAP="${MAP:-backyard}" SEED="$s" node pv106.js
done
rm -f pv106.js
