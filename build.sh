#!/bin/sh
# Plastic Warfare source build: source/ -> plastic-warfare.html
#
#   ./build.sh            rebuild plastic-warfare.html from source/
#   ./build.sh --check    rebuild into a temp file and diff it; touch nothing
#
# Added at v91 (roadmap 3, phase 1). Until then the game WAS
# plastic-warfare.html, hand-edited; it is now assembled from source/head.html,
# the JavaScript files named in source/order.txt, and source/tail.html.
#
# THE ORDER IS LOAD-BEARING. See the header of source/order.txt: the file holds
# hundreds of top-level consts, some derived from others, and at least one
# post-table mutation. Reordering can change the simulation while looking like a
# file move. `cd harness && ./triage.sh` is what catches it.
#
# THE OUTPUT IS EXACT. The split was made by cutting the v90.2 file at line
# boundaries, so a rebuild of the unmodified sources reproduces that file BYTE
# FOR BYTE. tail.html deliberately carries no trailing newline, because the
# original file ends without one. `--check` is the assertion; tail_v91 drives it.
set -e
cd "$(dirname "$0")"

SRC=source
OUT=plastic-warfare.html

[ -d "$SRC/js" ] || { echo "no $SRC/js - are you in the repo root?" >&2; exit 2; }

# read order.txt, skipping blanks and comments
files=$(sed 's/#.*//' "$SRC/order.txt" | grep -v '^[[:space:]]*$' || true)
[ -n "$files" ] || { echo "$SRC/order.txt named no files" >&2; exit 2; }

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

cat "$SRC/head.html" > "$tmp"
n=0
for f in $files; do
  [ -f "$SRC/js/$f" ] || { echo "missing $SRC/js/$f (named in order.txt)" >&2; exit 2; }
  cat "$SRC/js/$f" >> "$tmp"
  n=$((n + 1))
done
cat "$SRC/tail.html" >> "$tmp"

# it has to PARSE. A concatenation that produces broken JavaScript would
# otherwise only show up as a blank page in a browser.
if command -v node > /dev/null 2>&1; then
  # plain CommonJS on purpose: --input-type=module has no require, which made
  # this check fail on a build that was in fact perfect.
  PW_TMP="$tmp" node -e '
    const fs=require("fs");
    const h=fs.readFileSync(process.env.PW_TMP,"utf8");
    const a=h.indexOf("<script>"), b=h.indexOf("</script>");
    if(a<0||b<0){console.error("no <script> block in the output");process.exit(1)}
    new Function(h.slice(a+8,b));
  ' || { echo "build.sh: the assembled script does not parse" >&2; exit 1; }
fi

if [ "$1" = "--check" ]; then
  if cmp -s "$tmp" "$OUT"; then
    echo "$OUT is byte-identical to a rebuild of $SRC/ ($n files)"
  else
    echo "$OUT DIFFERS from a rebuild of $SRC/ - the sources and the built file are out of step" >&2
    echo "  built $(wc -c < "$tmp") bytes, committed $(wc -c < "$OUT") bytes; run ./build.sh to resync" >&2
    exit 1
  fi
else
  cp "$tmp" "$OUT"
  echo "$OUT rebuilt from $SRC/ ($n files, $(wc -c < "$OUT") bytes)"
fi
