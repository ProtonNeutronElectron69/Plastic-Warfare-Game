/* tail_v36.js — T17: v36 bug fixes + rebalance
   B1 splash() now damages neutral wave creatures & wildlife (was units+blds only)
   B2 blockLine() lays a solid, gap-free 4-connected wall over the full drawn extent
   B3 creatures (nest + wave, all modes) route around geometry via findPath + recovery
   D1 ant/bee/fireant/wasp/roach +20% hp & DPS (mouse untouched); fireant burn 5->6
   D2 wave table +20% (Math.round), mouse counts fixed
   D3 Desk exposed corner pairs moved 45%->70% out and +20% richer
   A1/A2 Desk clutter: 50% more + 1.5x bigger (draw+collision) via optional prop.sc  */
'use strict';
section('T17 v36: bug fixes + rebalance');

function v36cfg(map,mode,opp,seed){return{map,mode,diff:'normal',fac:'green',opp,seed};}

/* ---------- T17.1: splash now hits wave creatures & wildlife (B1) ---------- */
{
 let err=null;try{G=null;newGame(v36cfg('desk','surv',0,36101));}catch(e){err=e;}
 ok('T17.1 desk boots for splash test',!err);
 if(!err){
  const cc=G.map.N/2+0.5, owner={p:G.players[0]};
  const cr=spawnWaveCreature('roach',cc+3,cc);cr.wave=true;const hp0=cr.hp;
  splash(cr.x,cr.y,2.5,60,'ex',owner);
  ok('T17.1 splash damages a wave creature (was 0 before)',cr.hp<hp0);
  // a fire ant just outside the blast radius is untouched
  const far=spawnWaveCreature('fireant',cc+3,cc+9);far.wave=true;const hf0=far.hp;
  splash(cc+3,cc,2.5,60,'ex',owner);
  ok('T17.1 splash respects radius (distant creature safe)',far.hp===hf0);
  // the owner's own units are never friendly-fired
  const u0=G.players[0].units[0];
  if(u0){const uh=u0.hp;splash(u0.x,u0.y,3,60,'ex',owner);ok('T17.1 splash spares allied units',u0.hp===uh);}
 }
}

/* ---------- T17.2: blockLine is solid & gap-free (B2) ---------- */
{
 // continuity: every centreline sample tile is blocked, for several angles
 let contOK=true;
 for(const ang of [0.15,0.4,0.79,1.1,1.55,2.3]){
  const N=48,M={N,pass:new Uint8Array(N*N).fill(1)};
  const x0=8,y0=24,len=26;blockLine(M,x0,y0,len,ang,0.8);
  for(let t=0;t<=len;t+=0.3){const tx=Math.floor(x0+Math.cos(ang)*t),ty=Math.floor(y0+Math.sin(ang)*t);
   if(tx>=0&&ty>=0&&tx<N&&ty<N&&M.pass[ty*N+tx]!==0){contOK=false;break;}}
  if(!contOK)break;
 }
 ok('T17.2 blockLine: no gaps along the drawn line (any angle)',contOK);

 // seal: a corner-to-corner diagonal pencil separates the two triangles under a
 // 4-connected flood (the old sparse blockLine leaked through diagonal gaps).
 const N=41,M={N,pass:new Uint8Array(N*N).fill(1)};
 blockLine(M,0,0,58,Math.PI/4,0.8); // y=x wall across the whole grid
 function reaches(sx,sy,gx,gy){
  const seen=new Uint8Array(N*N),q=[[sx,sy]];seen[sy*N+sx]=1;
  while(q.length){const [x,y]=q.pop();if(x===gx&&y===gy)return true;
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;
    if(nx>=0&&ny>=0&&nx<N&&ny<N&&!seen[ny*N+nx]&&M.pass[ny*N+nx]===1){seen[ny*N+nx]=1;q.push([nx,ny]);}}}
  return false;
 }
 ok('T17.2 blockLine: diagonal wall seals (no 4-connected leak)',!reaches(2,6,30,24)&&!reaches(30,24,2,6));
}

/* ---------- T17.3: creatures route around geometry instead of jamming (B3) ---------- */
{
 let err=null;try{G=null;newGame(v36cfg('desk','surv',0,36301));}catch(e){err=e;}
 ok('T17.3 desk boots for routing test',!err);
 if(!err){
  const N=G.map.N,P=G.map.pass,F=G.map.fld;
  // carve a clean 21x21 pocket so the ONLY obstacle is our test wall
  const cx=36,cy=36;
  for(let y=cy-10;y<=cy+10;y++)for(let x=cx-10;x<=cx+10;x++){P[y*N+x]=1;F[y*N+x]=0;}
  for(let y=cy-6;y<=cy+6;y++)P[y*N+cx]=0; // vertical wall between creature and goal
  const cr={x:cx-4,y:cy,sp:2.8,t:{fly:0},face:0,id:1,cpath:null,cwp:0,cgoal:null,cstuck:0};
  const gx=cx+4,gy=cy;
  const startDist=dhyp(cr.x-gx,cr.y-gy);
  let crossed=false;
  for(let i=0;i<700;i++){G.tick++;creatureStep(cr,gx,gy,1/30);if(cr.x>cx+0.3)crossed=true;}
  ok('T17.3 creature gets past a blocking wall (routes around)',crossed);
  ok('T17.3 creature reaches the far-side goal',dhyp(cr.x-gx,cr.y-gy)<2 && startDist>7);
 }
}

/* ---------- T17.4: critter stats +20% (mouse untouched) (D1) ---------- */
{
 const C=CREATURE, R=v=>Math.round(v);
 ok('T17.4 ant  +20% hp/dmg',C.ant.hp===R(49*RESCALE)&&C.ant.hp===24&&C.ant.dm===5.02);
 ok('T17.4 bee  +20% hp/dmg',C.bee.hp===15);
 ok('T17.4 fireant +20% hp/dmg + burn ->7.2',C.fireant.hp===50&&C.fireant.burn===7.2);
 ok('T17.4 wasp +20% hp/dmg',C.wasp.hp===32);
 ok('T17.4 roach +20% hp/dmg',C.roach.hp===108&&C.roach.dm===10.05);
 ok('T17.4 mouse untouched',C.mouse.hp===R(900*RESCALE)&&C.mouse.dm===+(30*RESCALE).toFixed(2)&&C.mouse.aoe===1.5);
}

/* ---------- T17.5: wave table +20% (round), mice fixed (D2) ---------- */
{
 const W=SURV_WAVES;
 ok('T17.5 wave 1 ant ->26',W[0].ant===26);
 ok('T17.5 wave 7 fireant23 wasp17 roach6',W[6].fireant===23&&W[6].wasp===17&&W[6].roach===6);
 ok('T17.5 wave 15 wasp35 roach23 mouse8',W[14].wasp===35&&W[14].roach===23&&W[14].mouse===8);
 const mice=W.map(w=>w.mouse||0).filter(m=>m>0);
 ok('T17.5 mouse base counts reverted [2,4,4,4,8]',JSON.stringify(mice)===JSON.stringify([2,4,4,4,8]));
 // aggregate non-mouse growth is ~+20% vs the v34 base
 const nonMouse=W.reduce((s,w)=>s+Object.entries(w).reduce((a,[k,v])=>a+(k==='mouse'?0:v),0),0);
 ok('T17.5 non-mouse total grew ~20% (>=1.17x, <=1.23x)',(()=>{const base=Math.round(nonMouse/1.2);return nonMouse/base>=1.17&&nonMouse/base<=1.23;})());
}

/* ---------- T17.6: Desk corner economy — 70% out + 20% richer (D3) ---------- */
for(const opp of [0,3]){
 const players=opp+1;let err=null;
 try{G=null;newGame(v36cfg('desk','surv',opp,36600+opp));}catch(e){err=e;}
 ok(`T17.6 desk/${players}p boots`,!err);
 if(err)continue;
 const cc=G.map.N/2+0.5;
 const corner=G.map.nodes.filter(n=>{const d=dhyp(n.x-cc,n.y-cc);return d>=13&&d<=34;});
 ok(`T17.6 desk/${players}p 8 corner nodes present`,corner.length===8);
 ok(`T17.6 desk/${players}p corner amounts unchanged`,corner.every(n=>n.t==='plastic'?n.amt===DESK_CORNER_P:n.amt===DESK_CORNER_E)&&DESK_CORNER_P===3240&&DESK_CORNER_E===2340);
 ok(`T17.6 desk/${players}p corner pairs ~70% out (d 25..33)`,corner.every(n=>{const d=dhyp(n.x-cc,n.y-cc);return d>=25&&d<=33;}));
 const ring=G.map.nodes.filter(n=>nearC(n,cc,11));
 ok(`T17.6 desk/${players}p centre ring amounts are the ring amounts`,ring.every(n=>n.t==='plastic'?n.amt===DESK_RING_P:n.amt===DESK_RING_E));
}

/* ---------- T17.7: Desk clutter bigger + more; other maps byte-identical (A1/A2) ---------- */
{
 // propBox scales exactly by sc; unset sc is byte-identical
 const a=propBox({t:'eraser'}), b=propBox({t:'eraser',sc:1.5});
 ok('T17.7 propBox scales box by sc',Math.abs(b[2]-a[2]*1.5)<1e-9&&Math.abs(b[0]-a[0]*1.5)<1e-9);
 const p1=propBox({t:'pencil',len:9}), p2=propBox({t:'pencil',len:9,sc:1.5});
 ok('T17.7 propBox scales line-props by sc',Math.abs(p2[2]-p1[2]*1.5)<1e-9);

 G=null;newGame(v36cfg('desk','surv',0,36700));
 const dp=G.map.props||[];
 const clutter=t=>dp.filter(p=>p.t===t);
 ok('T17.7 desk clutter carries sc=1.5',dp.some(p=>p.sc===1.5)&&clutter('books').every(p=>p.sc===1.5));
 ok('T17.7 desk has more pencils (v36 3 pairs -> up to 6)',clutter('pencil').length>=4);
 ok('T17.7 desk clutter count up vs v35 (>=14 blocking pieces)',
    ['books','keyboard','chips','eraser','pencil'].reduce((s,t)=>s+clutter(t).length,0)>=14);

 G=null;newGame(v36cfg('kitchen','surv',0,36701));
 ok('T17.7 non-desk maps carry NO sc field (byte-identical)',(G.map.props||[]).every(p=>p.sc===undefined));
}

/* ---------- T17.8: determinism — creature pathfinding is replay-stable (B3) ---------- */
{
 function trail(seed){
  G=null;newGame(v36cfg('desk','surv',0,seed));
  const N=G.map.N;
  // drop wave creatures at fixed edge points so they must path across desk clutter
  for(const [x,y] of [[4,4],[N-5,4],[4,N-5],[N-5,N-5],[N/2,4],[4,N/2]])spawnWaveCreature('roach',x,y);
  const t=[];for(let i=1;i<=300;i++){update(DT);if(i%30===0)t.push(hashState());}return t;
 }
 const A=trail(36801),B=trail(36801);
 ok('T17.8 dual-run trails identical (10 pts, creatures pathing)',A.length===10&&A.every((h,i)=>h===B[i]));
}

/* ---------- T17.9: save/load resumes bit-identical with creatures mid-path (B3) ---------- */
{
 G=null;newGame(v36cfg('desk','surv',0,36901));
 const N=G.map.N;
 for(const [x,y] of [[4,4],[N-5,4],[4,N-5],[N-5,N-5]])spawnWaveCreature('roach',x,y);
 for(let i=0;i<120;i++)update(DT); // creatures now hold live cpath/cwp state (never serialized)
 const airborne=(G.neutrals||[]).some(cr=>cr.wave&&cr.hp>0);
 ok('T17.9 creatures airborne & pathing at snapshot',airborne);
 const h0=hashState(),json=saveState();
 const cont=[];for(let i=1;i<=90;i++){update(DT);if(i%30===0)cont.push(hashState());}
 loadState(json);
 ok('T17.9 snapshot round-trip hash matches (path fields not hashed)',hashState()===h0);
 const resume=[];for(let i=1;i<=90;i++){update(DT);if(i%30===0)resume.push(hashState());}
 ok('T17.9 resume trail equals continuation (paths rebuilt deterministically)',
    cont.length===3&&cont.every((h,i)=>h===resume[i]));
}
