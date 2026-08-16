/* tail_v28.js — T9: v28 cleanup invariants.
   Cross-version guarantees against baselines captured from the v27.1 build:
   all 12 map/seed layout hashes byte-identical (map generation is untouched).
   The v27.1 TRAIL-equality block was retired at v29: teams, medic speed, and
   new hashState fields intentionally change sim trails. Plus: the dead
   pre-v26 'seen' flag is gone from live entities AND from snapshots, old
   saves that still carry seen:false load cleanly, the snapshot tag is v:28,
   and the factored helpers (fxGatePos / audFor) exist and behave. */
'use strict';
section('T9 v28: cleanup invariants, cross-version layout + trail equality');

/* baselines captured from v27.1 game.js (tail_baseline.js, seeds 11/22/33
   for layouts; seed 777001, checkpoints every 90 ticks, for trails) */
// v36: backyard/kitchen/sandbox rebaselined — the v36 blockLine fix intentionally changed
// line-prop collision on those maps. livingroom has no line-props, so it stays byte-identical
// to v27.1 below, which proves the change is localized to line-prop passability.
const V271_LAYOUTS={"backyard:11":1255837022,"backyard:22":1262884325,"backyard:33":3816844854,"kitchen:11":2736043710,"kitchen:22":317751797,"kitchen:33":3447831333,"sandbox:11":3903799714,"sandbox:22":2051225923,"sandbox:33":1330770731,"livingroom:11":859166094,"livingroom:22":3229224006,"livingroom:33":3594163030};
const DT9=1/30;
function cfg9(map,seed){return{map,mode:'dm',diff:'normal',fac:'tan',opp:3,seed}}
function layoutHash9(){
 let h=2166136261;
 const P=G.map.pass;for(let i=0;i<P.length;i++)h=hI(h,P[i]);
 for(const n of G.map.nodes){h=hF(h,n.x);h=hF(h,n.y);h=hS(h,n.t);h=hF(h,n.amt)}
 for(const s of G.map.starts){h=hF(h,s.x);h=hF(h,s.y)}
 for(const ns of (G.map.nests||[])){h=hF(h,ns.x);h=hF(h,ns.y)}
 for(const pr of (G.map.props||[])){h=hF(h,pr.x);h=hF(h,pr.y);h=hS(h,pr.t)}
 return h>>>0;
}

/* ---- cross-version layout equality (12 combos) ---- */
for(const key of Object.keys(V271_LAYOUTS)){
 const [m,seed]=key.split(':');
 G=null;newGame(cfg9(m,+seed));
 ok(`T9 layout ${key} stable (v36 baseline)`,layoutHash9()===V271_LAYOUTS[key]);
}

/* ---- dead 'seen' flag is gone: live entities, snapshots, tag ---- */
G=null;newGame(cfg9('backyard',424242));
for(let i=0;i<300;i++)update(DT9);
ok('T9 live buildings carry no seen field',G.blds.length>0&&G.blds.every(b=>!('seen' in b)));
ok('T9 live units carry no seen field',G.units.length>0&&G.units.every(u=>!('seen' in u)));
const json9=saveState();
ok('T9 snapshot JSON contains no "seen" key',json9.indexOf('"seen"')===-1);
ok('T9 snapshot tag is v:28+',JSON.parse(json9).v>=28); // monotonic: future bumps stay green

/* ---- old saves carrying seen:false still load, hash-equivalent ---- */
const h9=hashState();
const legacy=JSON.parse(json9);
for(const b of legacy.blds)b.seen=false;   // what every v27.1-era save carries
for(const u of legacy.units)u.seen=false;  // what a loaded-then-saved v27.1 game carries
legacy.v=27.1;
let loadErr=null;
try{G=null;newGame(cfg9('backyard',424242));loadState(JSON.stringify(legacy));}catch(e){loadErr=e}
ok('T9 legacy save with seen:false loads clean',!loadErr);
ok('T9 legacy save resumes on the same hash',!loadErr&&hashState()===h9);
const t9a=[];for(let i=1;i<=150;i++){update(DT9);if(i%30===0)t9a.push(hashState())}
G=null;newGame(cfg9('backyard',424242));loadState(json9);
const t9b=[];for(let i=1;i<=150;i++){update(DT9);if(i%30===0)t9b.push(hashState())}
ok('T9 legacy and v28 saves resume on identical trails',t9a.length===5&&t9a.every((h,i)=>h===t9b[i]));

/* ---- factored helpers exist and behave ---- */
ok('T9 fxGatePos exists',typeof fxGatePos==='function');
const gp1=fxGatePos({x:3,y:4});
ok('T9 fxGatePos passes through own-position particles',gp1.x===3&&gp1.y===4);
const gp2=fxGatePos({x1:0,y1:0,x2:2,y2:4});
ok('T9 fxGatePos midpoints segment-only particles',gp2.x===1&&gp2.y===2);
ok('T9 audFor exists',typeof audFor==='function');
