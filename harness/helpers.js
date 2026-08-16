/* helpers.js - the fixture helpers that segments 2a, 2b, 2c and 3 borrow.
 *
 * These segments need six symbols from tail_v44 and tail_v47: cfg44, arena44
 * (with its scan/carve/recarve closure), and host47/chan47/walk47. Until v83
 * seg.sh got them by prepending BOTH TAILS IN FULL, which re-ran every test in
 * them once per segment: measured at 127 checks and 12,432 simulated ticks each
 * time, four times over - 508 duplicate checks and roughly 40 seconds a run,
 * for three functions.
 *
 * The bodies below are lifted verbatim from those two tails, which still run in
 * segment 1 and remain the place their behaviour is actually asserted. Nothing
 * here executes: it is declarations only, so including it costs nothing but the
 * parse.
 *
 * NEVER put this file in the same bundle as tail_v44.js - `let CARVE44` would be
 * declared twice and the bundle would not parse. Segment 1 takes the real tails;
 * every other segment takes this.
 */
function cfg44(map,mode,diff,fac,opp,seed){return{map,mode,diff,fac:fac||'green',opp:opp||3,seed}}

/* A controlled arena: plain passable ground, no hazard field, clear of anybody
   else's units and buildings. Mines are defused by the caller so a stray blast
   cannot turn a coverage measurement into a body count. */
function arenaScan44(W,H,LEN,clr){
 /* v66: neutral BARRICADES are excluded from the clearance set. The clearance is
    here to keep anything that can move, shoot, heal or spawn away from a coverage
    measurement; a hedgehog does none of those, it just blocks tiles, and the
    passableR test above already refuses to run the corridor through one. With ~90
    of them per map a flat 10-tile keep-out left no corridor at all on most seeds,
    which turned every coverage check into a null-arena failure. Wildlife dens stay
    in the set: they DO spawn things that bite. */
 const N=G.map.N,r=0.34,others=[...G.units.filter(u=>u.p!==G.human),...G.blds.filter(b=>!(b.p===G.neutral&&b.t.barr))];
 for(let ty=4;ty<N-4-H;ty++)for(let tx=4;tx<N-4-LEN-W;tx++){
  let ok2=true;
  for(let oy=-1;oy<=H&&ok2;oy++)for(let ox=-1;ox<=W+LEN&&ok2;ox++){
   const px=tx+ox+0.5,py=ty+oy+0.5;
   if(!passableR(px,py,r)||fieldAt(px,py)!==0){ok2=false;break}
   for(const f of others)if(dhyp(f.x-px,f.y-py)<clr){ok2=false;break}
  }
  if(ok2)return{x:tx+0.5,y:ty+0.5};
 }
 return null;
}
/* v66: when the scan finds nothing, CARVE the arena instead of returning null.
   The v66 map rework roughly doubled hazard coverage and took barricades from ~18
   to ~90 tiles, and a 22x5 hazard-free corridor no longer exists on ANY seed of
   ANY map - checked over 40 seeds x 4 maps, zero hits. That is a correct map and a
   fixture that had quietly been relying on open ground.

   These are formation tests: what they need is a controlled strip, not a strip the
   generator happened to leave lying around. So pick the emptiest legal position,
   clear its tiles, drop the hazard fields and dens that overlap it, and put every
   neutral structure inside it through the game's own kill() path so no bookkeeping
   is skipped. Nothing that can move, shoot, heal or spawn is carved away: the
   position is still chosen to stand clear of those by `clr`, and if no position
   can, this returns null and the caller still fails loudly. */
function arenaCarve44(W,H,LEN,clr){
 const N=G.map.N,M=G.map;
 const live=[...G.units.filter(u=>u.p!==G.human),...G.blds.filter(b=>b.p!==G.neutral)];
 /* PAD: the scan window is the strip the caller asked for; a carve can afford to
    be generous, and needs to be. A marching pack spreads past its formation box,
    so a strip cleared to exactly the requested rectangle puts hazards right where
    the flanks end up and the coverage numbers pick that up as a medic failure. */
 const PAD=4,w=W+LEN+2+PAD*2,h=H+2+PAD*2;
 let best=null,bd=-1;
 for(let ty=5;ty<N-5-h;ty++)for(let tx=5;tx<N-5-w;tx++){
  const cx=tx+w/2,cy=ty+h/2;
  let d=1e9;
  for(const f of live)d=Math.min(d,dhyp(f.x-cx,f.y-cy));
  for(const st of M.starts)d=Math.min(d,dhyp(st.x-cx,st.y-cy));
  if(d>bd){bd=d;best={tx,ty}}
 }
 if(!best||bd<clr)return null;
 const x0=best.tx,y0=best.ty,x1=best.tx+w-1,y1=best.ty+h-1;
 const inRect=(x,y)=>x>=x0-1&&x<=x1+1&&y>=y0-1&&y<=y1+1;
 /* Neutral structures go through kill(), which is both the game's own removal path
    AND the only one that survives a snapshot: buildings are restored from the save,
    and a den killed this way comes back dead because ns.dead round-trips by index.
    M.nests and M.fields are deliberately NOT spliced - loadState rebuilds both from
    the seed, so a shortened array would re-index the nest snapshot and corrupt the
    reload. Killing is enough; the arrays keep their shape. */
 for(const b of G.blds.slice())if(b.p===G.neutral&&inRect(b.x,b.y))kill(b);
 CARVE44={x0,y0,x1,y1};
 recarve44();
 // the carve must actually have worked; a silent half-clear would poison the measurement
 const r=0.34;
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(!passableR(x+0.5,y+0.5,r)||fieldAt(x+0.5,y+0.5)!==0)return null;
 return{x:x0+PAD+1.5,y:y0+PAD+1.5};
}
function arena44(W,H,LEN,clr){CARVE44=null;return arenaScan44(W,H,LEN,clr)||arenaCarve44(W,H,LEN,clr)}
/* The tile clearing, on its own and re-appliable. loadState regenerates terrain
   from the seed by design and only the PASS grid rides in the snapshot, so the
   hazard grid a carve cleared comes back on reload. Any fixture that carves and
   then reloads has to re-impose its own scenery; the sim state under test is
   untouched by this, and the carve is a pure function of the map, so re-applying
   it reproduces the same grid exactly. */
let CARVE44=null;
function recarve44(){
 if(!CARVE44)return false;
 const N=G.map.N,M=G.map,{x0,y0,x1,y1}=CARVE44;
 for(let y=y0-1;y<=y1+1;y++)for(let x=x0-1;x<=x1+1;x++){
  if(x<0||y<0||x>=N||y>=N)continue;
  M.pass[y*N+x]=1;M.fld[y*N+x]=0;
 }
 return true;
}

/* ---- from tail_v47: the lobby fixture helpers ---- */
function chan47(){
 const c={sent:[],onmessage:null,onclose:null,onerror:null,closed:false,
  send(s){c.sent.push(JSON.parse(s))},
  close(){if(c.closed)return;c.closed=true;if(c.onclose)c.onclose()}};
 return c;
}
function feed47(ch,obj){if(ch.onmessage)ch.onmessage({data:JSON.stringify(obj)})}
function last47(ch,key){for(let i=ch.sent.length-1;i>=0;i--)if(ch.sent[i][key]!==undefined)return ch.sent[i];return null}
function walk47(el,out){out=out||[];if(!el)return out;out.push(el);for(const c of (el.children||[]))walk47(c,out);return out}
function host47(){ // a fresh host lobby on known settings
 SETUP.mode='dm';SETUP.map='backyard';SETUP.fac='green';
 lobOpenHost();
 return LOBBY;
}
