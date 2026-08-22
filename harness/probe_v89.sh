#!/bin/sh
# Batch-run the v89 air probe and print where air production is won or lost.
#
#   ./probe_v89.sh                  8 matches on sim.sh's own seed/map/faction deal
#   ./probe_v89.sh 16               a bigger batch
#   SEED0=2000 ./probe_v89.sh 16    a different run
#
# Same shape as sim.sh, and like sim.sh it is a MEASUREMENT tool: nothing it
# prints is pinned and it is not part of seg.sh. Writes probe_out/probe_N.json
# (git-ignored - it re-runs from the seeds).
set -e
N="${1:-8}"; SEED0="${SEED0:-101}"; JOBS="${JOBS:-$(nproc 2>/dev/null || echo 4)}"
MAPS_DM="backyard kitchen livingroom sandbox"; FACS="green tan gray blue"
case "$N" in ''|*[!0-9]*) echo "usage: ./probe_v89.sh [match-count]" >&2; exit 2 ;; esac
[ "$N" -ge 1 ] || { echo "match count must be at least 1" >&2; exit 2; }
./build.sh > /dev/null
cat shim_head.js game.js probe_v89.js > probev89.js
rm -rf probe_out && mkdir -p probe_out
i=0; running=0
while [ "$i" -lt "$N" ]; do
  n=$((i + 1))
  map=$(echo "$MAPS_DM" | cut -d' ' -f$(( i % 4 + 1 )))
  fac=$(echo "$FACS"    | cut -d' ' -f$(( i % 4 + 1 )))
  seed=$((SEED0 + i * 101))
  MAP="$map" SEED="$seed" FAC0="$fac" node probev89.js > "probe_out/probe_$n.json" &
  i=$n; running=$((running + 1))
  if [ "$running" -ge "$JOBS" ]; then wait; running=0; fi
done
wait
for f in probe_out/probe_*.json; do
  [ -s "$f" ] || { echo "$f is empty - a match failed. Nothing reported." >&2; exit 1; }
done
exec python3 probe_v89_report.py probe_out
