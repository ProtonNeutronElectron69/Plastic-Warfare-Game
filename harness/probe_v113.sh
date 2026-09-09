#!/bin/sh
# probe_v113.sh - the CONTROLLED balance batches. sim.sh's seeded deal hands the
# five doctrines out unevenly across the four armies (v113 measured Blue drawing
# 'defensive' 12 times in 32 and Tan 5), so its win rates mix "which army" with
# "which doctrine". This holds one still:
#   A  ARMY ONLY   every seat plays 'balanced'; armies rotate through the seats
#   C  DOCTRINE    four of the five doctrines per match, dealt by a Latin rotation
#                  so every army meets every doctrine equally often
#   ./probe_v113.sh            16 A-matches + 20 C-matches (~20 min on 4 cores)
#   SEED0=4200 ./probe_v113.sh a different run.  N_A=8 N_C=10 for a shorter one
# Writes sim_out_A/ and sim_out_C/ (git-ignored) and prints both tables through
# balance_report.py. A measurement, like sim.sh: nothing here is pinned.
set -e
cd "$(dirname "$0")"
SEED0="${SEED0:-101}"; N_A="${N_A:-16}"; N_C="${N_C:-20}"; JOBS="${JOBS:-$(nproc 2>/dev/null || echo 4)}"
MAPS_DM="backyard kitchen livingroom sandbox bathroom attic"; FACS="green tan gray blue"
PROFS_ALL="aggressive balanced defensive harasser turtle"
./build.sh > /dev/null
cat shim_head.js game.js sim_dm.js > sim.js
run() { # dir N profs-function
  d=$1; n=$2; rm -rf "$d"; mkdir -p "$d"; i=0; running=0
  while [ "$i" -lt "$n" ]; do
    m=$((i + 1)); map=$(echo "$MAPS_DM" | cut -d' ' -f$(( i % 6 + 1 ))); fac=$(echo "$FACS" | cut -d' ' -f$(( i % 4 + 1 ))); seed=$((SEED0 + i * 101))
    profs=$($3 "$i")
    MAP="$map" SEED="$seed" FAC0="$fac" PROFS="$profs" node sim.js > "$d/game_$m.json" &
    i=$m; running=$((running + 1)); if [ "$running" -ge "$JOBS" ]; then wait; running=0; fi
  done; wait
  for f in "$d"/game_*.json; do [ -s "$f" ] || { echo "$f is empty - a match failed." >&2; exit 1; }; done
}
allbal() { echo "balanced,balanced,balanced,balanced"; }
latin() { i=$1; out=""; s=0; while [ "$s" -lt 4 ]; do k=$(( (i + s) % 5 + 1 )); out="$out$(echo "$PROFS_ALL" | cut -d' ' -f$k),"; s=$((s+1)); done; echo "${out%,}"; }
OUT_A="${OUT_A:-sim_out_A}"; OUT_C="${OUT_C:-sim_out_C}"   # name the output dirs, so variants can sit side by side (N_A=0 or N_C=0 skips a design)
[ "$N_A" -gt 0 ] && run "$OUT_A" "$N_A" allbal
[ "$N_C" -gt 0 ] && run "$OUT_C" "$N_C" latin
[ "$N_A" -gt 0 ] && { echo "=== A: every seat 'balanced' (the army on its own)  V113_OFF=${V113_OFF:-}"; python3 balance_report.py "$OUT_A"; }
[ "$N_C" -gt 0 ] && { echo; echo "=== C: doctrines dealt evenly across armies  V113_OFF=${V113_OFF:-}"; python3 balance_report.py "$OUT_C"; }
exit 0
