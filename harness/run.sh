#!/bin/sh
# Plastic Warfare headless harness runner (v43+).
#   ./run.sh                 standard suite
#   ./run.sh mini            standard + the 4-combo mini soak (pre-delivery gate)
#   ./run.sh full            standard + the 36-combo soak
#   ./run.sh render <tail>   real-canvas render tail (needs @napi-rs/canvas)
# Assemble game.js from the working file first:
#   S=$(grep -n '<script>' pw.html | cut -d: -f1); E=$(grep -n '</script>' pw.html | cut -d: -f1)
#   sed -n "$((S+1)),$((E-1))p" pw.html > game.js && node --check game.js
set -e
MODE="${1:-standard}"
TAILS=$(grep -v '^[[:space:]]*#' tails.txt | grep -v '^[[:space:]]*$')
case "$MODE" in
  standard) EXTRA=""                ; OUT=harness.js ;;
  mini)     EXTRA="tail_minisoak.js"; OUT=harness_ms.js ;;
  full)     EXTRA="tail_soak.js"    ; OUT=harness_full.js ;;
  render)
    [ -n "$2" ] || { echo "usage: ./run.sh render <render_tail.js>" >&2; exit 2; }
    cat shim_head.js game.js "$2" > rc.js
    exec node rc.js ;;
  *) echo "unknown mode: $MODE (standard|mini|full|render)" >&2; exit 2 ;;
esac
cat shim_head.js game.js $TAILS $EXTRA tail_end.js > "$OUT"
exec node "$OUT"
