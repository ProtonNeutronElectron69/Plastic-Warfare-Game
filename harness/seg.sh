#!/bin/sh
# Plastic Warfare segmented harness runner.
#
#   ./seg.sh all              every segment IN PARALLEL, one summary (use this)
#   ./seg.sh 1|2a|2b|2c|3     one segment
#   QUIET=1 ./seg.sh all      failures and totals only, no per-section headers
#
# v83: `all` runs the five segments as concurrent node processes. The split into
# segments exists because the suite overruns a single CONTAINER CALL, not because
# the segments depend on each other - they are independent processes over the same
# read-only inputs, so running them together is free wall time. Measured on a
# 4-core box: 705s serial, 353s parallel, byte-identical results. 2b is started
# first because it is the long pole at ~298s on its own; the other four finish
# inside it.
#
# v83: segments 2a/2b/2c/3 take helpers.js where they used to take tail_v44.js and
# tail_v47.js in full. They only ever wanted six symbols out of those two tails
# (cfg44, arena44 and its closure, host47/chan47/walk47), but prepending the whole
# tails re-ran every test inside them once per segment - 127 checks and 12,432
# simulated ticks each time, four times over. Those tests still run, once, in
# segment 1, which is where they belong. helpers.js declares and executes nothing.
# It must NEVER ride alongside tail_v44.js: `let CARVE44` twice will not parse.
#
# v78 four-segment note, still current. Segment 2 is split at tail_v59 because
# v78 widened T39.I's air-target mutation arm from 2 seeds to 6 - twelve 18000-tick
# censuses in one tail, which overruns a single container call on its own. tail_v59
# therefore runs ALONE as 2b. The seed count was NOT cut back to fit the runner:
# the six seeds are the evidence the arm needs to clear its own noise floor. That
# one check is 234,000 of the suite's 633,000 simulated ticks - 37% - and is the
# only place a large number lives if wall time ever has to come down further.
set -e

seg_files() {
  case "$1" in
   1) echo "shim_head.js game.js tail_tests.js tail_expo.js \
      tail_v26.js tail_v27.js tail_v27_1.js tail_v28.js tail_v29.js tail_v30.js tail_v30_1.js \
      tail_v32.js tail_v33.js tail_v34.js tail_v35.js tail_v36.js tail_v37.js tail_v39.js \
      tail_v40.js tail_v41.js tail_v42.js tail_v43.js tail_v44.js tail_v44_1.js tail_v45.js \
      tail_v46.js tail_v47.js tail_v48.js tail_v49.js tail_v50.js tail_v51.js tail_v52.js \
      tail_end.js" ;;
   2a) echo "shim_head.js game.js preamble.js helpers.js \
      tail_v53.js tail_v54.js tail_v55.js tail_v56.js tail_v57.js tail_v58.js tail_end.js" ;;
   2b) echo "shim_head.js game.js preamble.js helpers.js \
      tail_v59.js tail_end.js" ;;
   2c) echo "shim_head.js game.js preamble.js helpers.js \
      tail_v60.js tail_v61.js tail_v62.js tail_v63.js tail_end.js" ;;
   3) echo "shim_head.js game.js preamble.js helpers.js \
      tail_v64.js tail_v65.js tail_v66.js tail_v67.js tail_v68.js tail_v69.js \
      tail_v72.js tail_v73.js tail_v74.js tail_v75.js tail_v76.js tail_v77.js tail_v79.js tail_v80.js tail_v81.js tail_v82.js tail_v84.js tail_v85.js tail_v86.js tail_v87.js \
      tail_end.js" ;;
   *) return 1 ;;
  esac
}

run_seg() {
  seg_files "$1" > /dev/null 2>&1 || { echo "unknown segment: $1" >&2; return 2; }
  cat $(seg_files "$1") > "seg$1.js"
  node "seg$1.js"
}

case "$1" in
 all)
  # 2b first: it is the long pole and everything else fits inside it
  rc=0
  for s in 2b 1 3 2c 2a; do
    ( run_seg "$s" > ".seg$s.out" 2>&1 ) &
    eval "pid_$s=\$!"
  done
  for s in 2b 1 3 2c 2a; do
    eval "wait \$pid_$s" || rc=1
  done
  total_p=0; total_f=0
  for s in 1 2a 2b 2c 3; do
    line=$(grep -E '^PASS:' ".seg$s.out" || echo "PASS: 0   FAIL: ?")
    p=$(echo "$line" | sed -n 's/^PASS: *\([0-9]*\).*/\1/p')
    f=$(echo "$line" | sed -n 's/.*FAIL: *\([0-9?]*\).*/\1/p')
    printf 'segment %-3s %s\n' "$s" "$line"
    grep -E '^  FAIL: ' ".seg$s.out" | sed 's/^/    /' || true
    total_p=$((total_p + ${p:-0}))
    case "$f" in ''|*[!0-9]*) rc=1 ;; *) total_f=$((total_f + f)) ;; esac
  done
  echo "=================================="
  echo "TOTAL  PASS: $total_p   FAIL: $total_f"
  [ "$total_f" = "0" ] || rc=1
  exit $rc ;;
 1|2a|2b|2c|3) run_seg "$1" ;;
 *) echo "usage: ./seg.sh all | 1 | 2a | 2b | 2c | 3   (QUIET=1 for failures only)" >&2; exit 2 ;;
esac
