#!/bin/sh
# map_shot.sh - whole-board pictures of every map, for the EYES. A layout defect
# cannot fail seg.sh (rule 7), so this is a LOOKING tool: nothing it draws is
# pinned and it is not part of seg.sh.
#
#   ./map_shot.sh <outDir> [seed] [scale]      all five maps, whole board
#   MAPS="livingroom" ./map_shot.sh out 500000 1.0
#
# It appends one <script> to a COPY of the shipped file. That script reads the
# map key, the seed and the scale off location.hash, boots a real match, paints
# the baked terrain canvas plus every prop and building into one canvas sized to
# the whole board, and leaves that canvas as the entire page - so Chromium's own
# --screenshot is the whole board.
set -e
OUT=${1:-map_out}; SEED=${2:-500000}; SC=${3:-0.42}
SRC=$(cd "$(dirname "$0")/.." && pwd)/plastic-warfare.html
CHROME=/opt/pw-browsers/chromium
MAPS=${MAPS:-"backyard kitchen sandbox livingroom desk"}
mkdir -p "$OUT"
TMP="$OUT/_shotpage.html"
cp "$SRC" "$TMP"
cat >> "$TMP" <<'JS'
<script>
/* No 'load' listener: on a 6.7MB page full of data: URLs that event can sit
   behind every decode, and Chromium's virtual clock will have run out first.
   Poll the asset loader's own ready flag instead - it is the same gate the
   Start button waits on. */
(function(){
 const q=(location.hash||'#backyard/500000/0.42').slice(1).split('/');
 const map=q[0],seed=parseInt(q[1],10),S=parseFloat(q[2]);
 let n=0;
 const t=setInterval(()=>{
  if(ASSETS_STATE!=='ready'&&n++<400)return;
  clearInterval(t);
  try{
   newGame({map,mode:map==='desk'?'surv':'dm',diff:'normal',fac:'tan',opp:map==='desk'?1:3,seed});
   G.paused=true;G.spectate=true;updateFog();
   setTimeout(()=>{
    try{
     const cv=document.createElement('canvas');
     cv.width=Math.round(G.terr.width*S);cv.height=Math.round(G.terr.height*S);
     const c=cv.getContext('2d');
     c.fillStyle='#141d0e';c.fillRect(0,0,cv.width,cv.height);
     c.setTransform(S,0,0,S,0,0);
     c.drawImage(G.terr,0,0);
     const items=[];
     for(const p of G.map.props)items.push([p.x+p.y,()=>drawProp(c,p)]);
     for(const b of G.blds)items.push([b.x+b.y,()=>drawBld(c,b)]);
     items.sort((a,b)=>a[0]-b[0]);
     for(const it of items){try{it[1]()}catch(e){}}
     /* the board's own edge in magenta: anything drawn outside this diamond is
        off the map, which is exactly one of the defects being hunted */
     c.strokeStyle='#ff2ec4';c.lineWidth=2/S;c.beginPath();
     c.moveTo(isoX(0,0),isoY(0,0));c.lineTo(isoX(G.map.N,0),isoY(G.map.N,0));
     c.lineTo(isoX(G.map.N,G.map.N),isoY(G.map.N,G.map.N));c.lineTo(isoX(0,G.map.N),isoY(0,G.map.N));
     c.closePath();c.stroke();
     document.body.innerHTML='';document.body.style.cssText='margin:0;background:#000';
     document.documentElement.style.background='#000';
     cv.style.cssText='display:block;margin:0';document.body.appendChild(cv);
     document.title='SHOT-READY '+map;
    }catch(e){document.title='SHOT-FAIL draw: '+e.message}
   },900);
  }catch(e){document.title='SHOT-FAIL boot: '+e.message}
 },50);
})();
</script>
JS
for m in $MAPS; do
  W=$(awk -v s="$SC" 'BEGIN{printf "%d", 4744*s+8}')
  H=$(awk -v s="$SC" 'BEGIN{printf "%d", 2408*s+8}')
  "$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
    --window-size=$W,$H --virtual-time-budget=30000 \
    --screenshot="$OUT/$m.png" "file://$TMP#$m/$SEED/$SC" >/dev/null 2>&1
  echo "  $OUT/$m.png"
done
