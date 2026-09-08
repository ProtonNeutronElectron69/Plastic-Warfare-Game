#!/bin/sh
# hud_shot.sh - ONE IN-MATCH FRAME, for the EYES. Rule 7's tool.
#
# `renderGuard` means a drawing bug cannot crash the game and cannot fail
# seg.sh either, so a frame nobody looked at is a frame nobody checked. The
# npm-free Chromium recipe has been in README.md's Running section since v100,
# but it only gets you the MENU: every release from v107 to v110 then hand-rolled
# the same boot-and-inject script to see an actual match, and re-paid the same
# three traps. This is that script, kept.
#
#   ./hud_shot.sh out/frame.png
#   SELECT=hq FAC=gray ./hud_shot.sh out/panel.png
#   DAY=night JS='spawnExplosion(G.human.blds[0].x+3,G.human.blds[0].y-3,2.2)' ./hud_shot.sh out/night.png
#
# Everything is an env var so the JS hook stays the last word:
#   MAP     backyard | kitchen | sandbox | livingroom | desk | bathroom | attic
#   FAC     green | tan | gray | blue          MODE  dm | surv
#   SEED    match seed          OPP   opponents        TEST  1 = testing mode (default 1; DAY forces it off, trap 4)
#   SIZE    WxH (default 1700x1000)
#   TICKS   update() calls before the shot (default 12 - SEE THE FOG TRAP BELOW)
#   RICH    1 = all research granted and 9e9 of both resources (default 1)
#   SELECT  a building key: selects it, making one beside the HQ if none stands
#   DAY     day | dusk | night | dawn   (pins G.dayOff, v101)
#   JS      any snippet, run after boot and before the ticks
#
# THE THREE TRAPS, all paid for by an earlier release:
#  1. plastic-warfare.html ends with </html> and NO trailing newline, so the
#     `head -c -1` idiom eats the '>' and the injection silently never runs.
#     Append to a COPY and leave the file alone.
#  2. Do NOT wait on the `load` event: on an 8.7MB page of data: URLs it sits
#     behind every decode and Chromium's virtual clock expires first. Poll
#     ASSETS_STATE, which is the gate the Start button uses.
#  3. A fixture that does not tick has fog===0 EVERYWHERE, so anything
#     vision-gated (lights, the minimap, acquisition) reads as absent for the
#     wrong reason. TICKS defaults to 12 because the stamp needs ~10. JS therefore
#     runs AFTER the ticks, not before - a particle spawned before them ages out
#     (an explosion's life is 0.36s and 12 ticks are 0.40s).
#  4. TESTING MODE IS PINNED TO PERMANENT NOON inside dayPhase (v101), so DAY
#     switches it off for you. That also restores the fog, which is usually what
#     you wanted anyway if you are asking for night.
#  5. THE TICK YOU SET IN JS IS NOT THE TICK THAT RENDERS (v111). The
#     --virtual-time-budget below lets the game loop run ~30s (~900 ticks) past
#     the injected renderCore(), and in testing mode a queued unit is built
#     INSTANTLY - so "a Garage with a jeep on the bench" is an idle Garage by
#     the time the frame is taken, and a blinking lamp is at whatever phase the
#     clock reached. Pose a state that survives thirty seconds (TEST=0 and a
#     nine-deep queue, say), and read a blink across two frames, not one.
# The title is set to SHOT-READY / SHOT-FAIL <message>; --dump-dom instead of
# --screenshot prints it when a frame comes back blank.
set -e
OUT=${1:?usage: ./hud_shot.sh <out.png>}
SIZE=${SIZE:-1700x1000}; W=${SIZE%x*}; H=${SIZE#*x}
SRC=$(cd "$(dirname "$0")/.." && pwd)/plastic-warfare.html
CHROME=${CHROME:-/opt/pw-browsers/chromium}
mkdir -p "$(dirname "$OUT")"
TMP="$(dirname "$OUT")/_hudpage.html"
cp "$SRC" "$TMP"
cat >> "$TMP" <<JS
<script>
(function(){
 var CFG={map:'${MAP:-backyard}',fac:'${FAC:-green}',mode:'${MODE:-dm}',
          seed:${SEED:-951200},opp:${OPP:-1},test:${TEST:-1},
          ticks:${TICKS:-12},rich:${RICH:-1},select:'${SELECT:-}',day:'${DAY:-}'};
 var n=0;
 var t=setInterval(function(){
  if(ASSETS_STATE!=='ready'&&n++<400)return;      // trap 2
  clearInterval(t);
  try{
   /* trap 4: testing mode is pinned to permanent noon INSIDE dayPhase (v101),
      so asking for a time of day has to switch it off. */
   if(CFG.day)CFG.test=0;
   newGame({map:CFG.map,mode:CFG.mode,diff:'normal',fac:CFG.fac,opp:CFG.opp,seed:CFG.seed,test:!!CFG.test});
   var p=G.human;
   if(CFG.rich){p.res.p=9e9;p.res.e=9e9;for(var k in RESEARCH)if(techAvailable(p,k))p.tech.add(k);}
   if(CFG.day){var i=DAY_PHASES.findIndex(function(d){return d.n.toLowerCase().indexOf(CFG.day)===0});
               if(i>=0)G.dayOff=Math.round(DAY_CYCLE_T*i/DAY_PHASES.length*30);}
   var hq=p.blds.find(function(b){return b.key==='hq'}),focus=hq;
   if(CFG.select){
    focus=p.blds.find(function(b){return b.key===CFG.select});
    if(!focus){focus=makeBuilding(CFG.select,p,Math.floor(hq.tx)+6,Math.floor(hq.ty)+6,true);focus.prog=1;}
   }
   for(var i2=0;i2<CFG.ticks;i2++)update(1/30);   // trap 3
   $JS
   G.cam.x=isoX(focus.x,focus.y)-innerWidth/2;G.cam.y=isoY(focus.x,focus.y)-innerHeight/2;
   if(CFG.select){lastSelSig='';setSel([focus]);refreshSelPanel();}
   renderCore();
   setTimeout(function(){document.title='SHOT-READY '+CFG.map+'/'+CFG.fac+(CFG.select?'/'+CFG.select:'')},1500);
  }catch(e){document.title='SHOT-FAIL '+e.message;}
 },50);
})();
</script>
JS
"$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --window-size=$W,$H --virtual-time-budget=30000 \
  --screenshot="$OUT" "file://$TMP" >/dev/null 2>&1
echo "  $OUT"
