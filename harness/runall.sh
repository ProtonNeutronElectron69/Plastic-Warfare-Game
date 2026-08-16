#!/bin/bash
for m in backyard kitchen sandbox livingroom; do
  s=$(date +%s)
  # The script is measure_dm4.js; it reads the MAPS variable set here. The name
  # probe_dm4.js this loop used to call has never existed in the bundle, so every
  # iteration wrote an empty .json and a "Cannot find module" .err.
  MAPS=$m node measure_dm4.js > /tmp/dm_$m.json 2>/tmp/dm_$m.err
  # Capture node's status IMMEDIATELY: any command in between, the `date` below
  # included, overwrites $? and the loop then reports rc=0 for every failed run.
  rc=$?
  e=$(date +%s)
  echo "$m rc=$rc secs=$((e-s))" >> /tmp/dm_progress.txt
done
echo "ALLDONE" >> /tmp/dm_progress.txt
