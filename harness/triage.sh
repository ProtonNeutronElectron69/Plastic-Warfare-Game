#!/bin/sh
# Which segments does this change actually need? Measures rather than guesses.
#
#   ./triage.sh              compare the working tree against HEAD
#   ./triage.sh HEAD~1       compare against an older commit
#
# Runs ~25,000 simulated ticks (about 25s) against 633,000 for the full suite.
set -e
./build.sh > /dev/null
cat shim_head.js game.js triage.js > tri.js
exec node tri.js "$@"
