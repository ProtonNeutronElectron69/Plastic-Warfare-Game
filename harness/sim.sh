#!/bin/sh
# Run a batch of all-AI deathmatches and build the battle report.
#
#   ./sim.sh                 12 matches, 2 on each of the 6 deathmatch maps (v107: was 8 over 4)
#   ./sim.sh 24              24 matches, 4 on each
#   SEED0=900 ./sim.sh       same shape, a different run (seeds decide everything)
#   JOBS=2 ./sim.sh          cap the parallelism (default: nproc)
#
# Writes sim_out/game_N.json per match, sim_out/battle-report.html for the page,
# and prints a summary table. Both are git-ignored: the matches re-run from their
# seeds, so the results are reproducible rather than worth committing.
#
# One match is ~30-70s of wall time. The default 12 take about three minutes on
# four cores. There are SIX deathmatch maps since v107 - desk is survOnly,
# wave-defense only - so the per-map count is the batch size over six. The
# Attic is dealt like the others: sim_dm.js runs a free-for-all, and on a sided
# map that seats one army per spot.
set -e
N="${1:-12}"
SEED0="${SEED0:-101}"
JOBS="${JOBS:-$(nproc 2>/dev/null || echo 4)}"
MAPS_DM="backyard kitchen livingroom sandbox bathroom attic"
FACS="green tan gray blue"

case "$N" in ''|*[!0-9]*) echo "usage: ./sim.sh [match-count]" >&2; exit 2 ;; esac
[ "$N" -ge 1 ] || { echo "match count must be at least 1" >&2; exit 2; }

./build.sh > /dev/null
cat shim_head.js game.js sim_dm.js > sim.js
rm -rf sim_out && mkdir -p sim_out

# Deal maps round-robin so the batch is balanced whatever N is, and rotate which
# army holds slot 0: that seat always draws team 1, and the deathmatch time limit
# breaks ties on team number. Rotating it keeps that edge from landing on one army.
i=0
running=0
while [ "$i" -lt "$N" ]; do
  n=$((i + 1))
  map=$(echo "$MAPS_DM" | cut -d' ' -f$(( i % 6 + 1 )))
  fac=$(echo "$FACS"    | cut -d' ' -f$(( i % 4 + 1 )))
  seed=$((SEED0 + i * 101))
  MAP="$map" SEED="$seed" FAC0="$fac" node sim.js > "sim_out/game_$n.json" &
  i=$n
  running=$((running + 1))
  if [ "$running" -ge "$JOBS" ]; then wait; running=0; fi
done
wait

for f in sim_out/game_*.json; do
  [ -s "$f" ] || { echo "$f is empty - a match failed. Nothing reported." >&2; exit 1; }
done
cat shim_head.js game.js sim_report.js > simrep.js
PW_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo '')" exec node simrep.js sim_out
