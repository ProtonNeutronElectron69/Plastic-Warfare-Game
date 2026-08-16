#!/bin/sh
# v78 four-segment runner (was v75 thirds). Segment 2 split at tail_v59: v78 widened
# T39.I's air-target mutation arm from 2 seeds to 6, which is twelve 18000-tick
# censuses in one tail and overruns a single container call on its own. tail_v59 therefore
# runs ALONE as 2b; the seed count was not cut back to fit the runner, because the
# six seeds are the evidence the arm needs to clear its own noise floor.
# Original v75 note follows.
# v75 thirds runner (replaced the v73 halves). Segment 2 at v75 pace overruns a single container call, so
# the v73 halves are split into thirds. Segments 2 and 3 are both fed the shared
# preamble plus the two helper tails the README names (tail_v44 for arena44,
# tail_v47 for host47); tail_v47 must NOT be prepended to a segment that already
# contains it, which is why it appears in 2 and 3 but not in 1.
set -e
case "$1" in
 1) cat shim_head.js game.js tail_tests.js tail_expo.js \
      tail_v26.js tail_v27.js tail_v27_1.js tail_v28.js tail_v29.js tail_v30.js tail_v30_1.js \
      tail_v32.js tail_v33.js tail_v34.js tail_v35.js tail_v36.js tail_v37.js tail_v39.js \
      tail_v40.js tail_v41.js tail_v42.js tail_v43.js tail_v44.js tail_v44_1.js tail_v45.js \
      tail_v46.js tail_v47.js tail_v48.js tail_v49.js tail_v50.js tail_v51.js tail_v52.js \
      tail_end.js > seg1.js; exec node seg1.js ;;
 2a) cat shim_head.js game.js preamble.js tail_v44.js tail_v47.js \
      tail_v53.js tail_v54.js tail_v55.js tail_v56.js tail_v57.js tail_v58.js \
      tail_end.js > seg2a.js; exec node seg2a.js ;;
 2b) cat shim_head.js game.js preamble.js tail_v44.js tail_v47.js \
      tail_v59.js \
      tail_end.js > seg2b.js; exec node seg2b.js ;;
 2c) cat shim_head.js game.js preamble.js tail_v44.js tail_v47.js \
      tail_v60.js tail_v61.js tail_v62.js tail_v63.js \
      tail_end.js > seg2c.js; exec node seg2c.js ;;
 3) cat shim_head.js game.js preamble.js tail_v44.js tail_v47.js \
      tail_v64.js tail_v65.js tail_v66.js tail_v67.js tail_v68.js tail_v69.js \
      tail_v72.js tail_v73.js tail_v74.js tail_v75.js tail_v76.js tail_v77.js tail_v79.js tail_v80.js tail_v81.js tail_v82.js \
      tail_end.js > seg3.js; exec node seg3.js ;;
 *) echo "usage: ./seg.sh 1|2a|2b|2c|3" >&2; exit 2 ;;
esac
