#!/bin/sh
# probe_v99.sh - the v99 order-churn measurement over a small seed spread.
# Usage: ./probe_v99.sh            (3 matches, ~4min)
#        SEEDS="7 8" MAP=kitchen ./probe_v99.sh
set -e
cd "$(dirname "$0")"
./build.sh >/dev/null
cat shim_head.js game.js probe_v99.js > pv99.js
for s in ${SEEDS:-101 907 555}; do
  MAP="${MAP:-backyard}" SEED="$s" node pv99.js
done
rm -f pv99.js
