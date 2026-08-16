#!/bin/bash
for m in backyard kitchen sandbox livingroom; do
  s=$(date +%s)
  MAPS=$m node probe_dm4.js > /tmp/dm_$m.json 2>/tmp/dm_$m.err
  e=$(date +%s)
  echo "$m rc=$? secs=$((e-s))" >> /tmp/dm_progress.txt
done
echo "ALLDONE" >> /tmp/dm_progress.txt
