/* tail_v107.js - T89: two new battlefields (Roadmap 4 item 2, in part).

   BATHROOM FLOOR is a standard four-corner 72: the shared economy prologue, the
   shared lane passes, and its own dressing - a DRAINED bathtub ringing the centre
   cache as a sealed oval of porcelain rim segments with two gates, soap slicks,
   soapy bathwater, a bath mat, a rubber duck. THE ATTIC is the game's first SIDED
   map: its four starts are two pairs along the north and south edges, a team
   battle seats allies together (M.sides + the v107 block in newGame), and each
   pair sits inside a partly enclosed compound of DESTRUCTIBLE LEVEL ART - 2x2
   neutral "crate" structures, Bunker-tough, painter-only - mixed with staggered
   layers of neutral hedgehogs, three gates each.

   What this file pins is the MECHANISM: that the seating rule seats, that the
   compounds enclose without sealing, that the tub seals except at its gates,
   that a crate is a neutral structure on the hedgehog's exact footing (bots chew
   through it at low priority, a player never auto-targets it, killing it frees
   its four tiles and pays nothing), that every new painter is reached, and that
   the two layouts are declared (BASE107_LAYOUTS) so a later change to either
   generator has to say so. Rule 7 was paid on the way: the tub leaked at forty
   tiles before its rim was tightened and rotated, and the bath mat lay across
   the tub floor - both found in a real frame, neither could fail here. */
'use strict';
section('T89 v107: the Bathroom and the Attic');

const DT107=1/30;
function nocmt107(fn){return String(fn).replace(/\/\*[\s\S]*?\*\//g,' ').replace(/(^|[^:])\/\/[^\n]*/g,'$1')}
function cfg107(map,mode,seed,opp,teams){const o={map,mode:mode||'dm',diff:'normal',fac:'green',opp:opp==null?3:opp,seed};if(teams)o.teams=teams;return o}
/* the pathfinder's own reachability: 8-way, no corner cutting, from one tile */
function flood107(pass,N,sx,sy){
 const R=new Uint8Array(N*N),st=[];const ps=(x,y)=>x>=0&&y>=0&&x<N&&y<N&&pass[y*N+x]===1;
 if(!ps(sx,sy))return R;R[sy*N+sx]=1;st.push(sx,sy);
 const D=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
 while(st.length){const y=st.pop(),x=st.pop();for(const [dx,dy] of D){const nx=x+dx,ny=y+dy;if(!ps(nx,ny)||R[ny*N+nx])continue;if(dx&&dy&&(!ps(x+dx,y)||!ps(x,y+dy)))continue;R[ny*N+nx]=1;st.push(nx,ny)}}
 return R;
}
const SEEDS107=[11,22,33,4242,500000,777];

/* ---------- A: the two rows, and the lobby knows them ---------- */
section('T89.A two new battlefields in MAPS, and on the setup screen');
{
 ok('T89.A bathroom: a 72-tile four-corner deathmatch map, theme bath',
    !!MAPS.bathroom&&MAPS.bathroom.N===72&&MAPS.bathroom.theme==='bath'&&!MAPS.bathroom.survOnly&&!MAPS.bathroom.t2v2);
 ok('T89.A attic: a 72-tile map marked t2v2, theme attic, not survival-only',
    !!MAPS.attic&&MAPS.attic.N===72&&MAPS.attic.theme==='attic'&&!MAPS.attic.survOnly&&MAPS.attic.t2v2===true);
 ok('T89.A both are in the generic suite roster (T_MAPS), so T1-T5 and the soaks cover them',
    T_MAPS.includes('bathroom')&&T_MAPS.includes('attic'));
 /* the shim's querySelectorAll answers nothing, but appendChild keeps children */
 const cards=Array.from(document.getElementById('mapRow').children||[]);
 ok('T89.A the setup screen built one card per map ('+cards.length+' of '+Object.keys(MAPS).length+')',
    cards.length===Object.keys(MAPS).length);
 const ac=cards.find(c=>c.dataset&&c.dataset.map==='attic');
 ok('T89.A ...and the Attic card is a normal card, not hidden as survival-only',
    !!ac&&!ac.dataset.survonly);
}

/* ---------- B: the sided seating rule ---------- */
section('T89.B the Attic seats allies together; every other map is untouched');
{
 for(const m of T_MAPS.concat('desk'))if(m!=='attic'){
  const M=makeMap(m,4242);
  ok(`T89.B ${m} declares no sides (four independent corners, as ever)`, M.sides==null);
 }
 const M=makeMap('attic',4242);
 ok('T89.B the Attic declares two sides of two seats each', Array.isArray(M.sides)&&M.sides.length===2&&M.sides.every(s=>s.length===2));
 ok('T89.B each side is one edge: both seats of a side share y, the two sides are mirrors',
    M.sides.every(s=>M.starts[s[0]].y===M.starts[s[1]].y)&&M.starts[M.sides[0][0]].y+M.starts[M.sides[1][0]].y===M.N);
 ok('T89.B the seats sit a third and two thirds of the way along the edge (c2v2)',
    M.sides.every(s=>{const xs=s.map(i=>M.starts[i].x).sort((a,b)=>a-b);return xs[0]===c2v2(M.N,1)&&xs[1]===c2v2(M.N,2)}));
 ok('T89.B the start ORDER keeps the point-mirror pairing the lane passes assume ([0]<->[1], [2]<->[3])',
    M.starts[0].x+M.starts[1].x===M.N&&M.starts[0].y+M.starts[1].y===M.N&&M.starts[2].x+M.starts[3].x===M.N&&M.starts[2].y+M.starts[3].y===M.N);
 // a 2v2 seats each team on its own side, on every seed
 let good=0;const side=p=>p.start.y<G.map.N/2?'N':'S';
 for(let s=0;s<20;s++){G=null;newGame(cfg107('attic','dm',7000+s,3,[1,1,2,2]));
  const t1=G.players.filter(p=>p.team===1),t2=G.players.filter(p=>p.team===2);
  if(t1.length===2&&t2.length===2&&side(t1[0])===side(t1[1])&&side(t2[0])===side(t2[1])&&side(t1[0])!==side(t2[0]))good++;}
 ok('T89.B a 2v2 puts each team on its own side, 20 seeds of 20 ('+good+')', good===20);
 // ...and which side a team gets is DEALT, not fixed
 const sides=new Set();for(let s=0;s<20;s++){G=null;newGame(cfg107('attic','dm',7000+s,3,[1,1,2,2]));sides.add(side(G.players[0]));}
 ok('T89.B ...and which side team 1 draws varies with the seed', sides.size===2);
 G=null;newGame(cfg107('attic','dm',5,3));
 ok('T89.B a free-for-all seats one army per spot', new Set(G.players.map(p=>p.start.x+','+p.start.y)).size===4);
 G=null;newGame(cfg107('attic','dm',5,1));
 ok('T89.B a 1v1 uses two seats of the same side... no: two seats, and they are distinct',
    G.players.length===2&&(G.players[0].start.x!==G.players[1].start.x||G.players[0].start.y!==G.players[1].start.y));
 G=null;newGame(cfg107('attic','dm',5,2,[1,1,2]));
 {const t1=G.players.filter(p=>p.team===1);
  ok('T89.B a 2v1 seats the pair together and the loner on the far side',
     t1.length===2&&side(t1[0])===side(t1[1])&&side(G.players.find(p=>p.team===2))!==side(t1[0]));}
 G=null;newGame({map:'attic',mode:'dm',diff:'normal',fac:'green',opp:3,seed:5,test:1,teams:[1,1,1,1]});
 ok('T89.B testing mode: an all-one-team pick fills both sides rather than stalling', new Set(G.players.map(p=>p.start.x+','+p.start.y)).size===4);
 G=null;newGame(cfg107('attic','surv',5,3));
 ok('T89.B survival rebuilds the starts in the middle and drops the sides', G.map.sides==null&&G.map.starts.every(s=>dhyp(s.x-G.map.N/2,s.y-G.map.N/2)<9));
 const NG=nocmt107(newGame);
 ok('T89.B the seating block is gated on G.map.sides, after the shuffle every other map is pinned to',
    /G\.map\.sides&&G\.map\.sides\.length/.test(NG)&&NG.indexOf('spots[i],spots[j]]=[spots[j],spots[i]]')<NG.indexOf('G.map.sides&&G.map.sides.length'));
}

/* ---------- C: the compounds ---------- */
section('T89.C the Attic\'s compounds enclose without sealing');
{
 let allConn=true,lvlLo=1e9,lvlHi=0,barrLo=1e9,barrHi=0,mirrored=true,overlap=false,nearStart=false,blocked=true,frontOk=true,gatesOk=true;
 for(const sd of SEEDS107){
  const M=makeMap('attic',sd),N=M.N;
  const R=flood107(M.pass,N,Math.round(M.starts[0].x),Math.round(M.starts[0].y));
  if(!M.starts.every(s=>R[Math.round(s.y)*N+Math.round(s.x)]))allConn=false;
  lvlLo=Math.min(lvlLo,M.lvl.length);lvlHi=Math.max(lvlHi,M.lvl.length);
  barrLo=Math.min(barrLo,M.barricades.length);barrHi=Math.max(barrHi,M.barricades.length);
  for(const b of M.lvl){
   if(!M.lvl.some(q=>q.x===N-2-b.x&&q.y===N-2-b.y))mirrored=false;
   if(M.lvl.some(q=>q!==b&&Math.abs(q.x-b.x)<2&&Math.abs(q.y-b.y)<2))overlap=true;
   if(M.starts.some(s=>dhyp(s.x-(b.x+1),s.y-(b.y+1))<9))nearStart=true;
   for(let y=0;y<2;y++)for(let x=0;x<2;x++)if(M.pass[(b.y+y)*N+b.x+x]!==0)blocked=false;
  }
  /* the front row: a LINE with gates. Crates block it in pass; hedgehogs do not
     (barrTile never wrote pass), so read both: a tile is "wall" if pass is 0 or a
     barricade stands on it. The row must be mostly wall, and must have openings. */
  const FRONT=17; // v107.1: was 24; the owner pass pulled the wall in seven rows (T90.A carries the layers)
  for(const ty of [FRONT,N-1-FRONT]){
   let wall=0,open=0;
   for(let tx=0;tx<N;tx++){const w=M.pass[ty*N+tx]===0||M.barricades.some(b=>b.x===tx&&b.y===ty);if(w)wall++;else open++;}
   if(wall<30)frontOk=false;
   if(open<8||open>34)gatesOk=false;
  }
 }
 ok('T89.C every start reaches every other start on every seed (the compounds have gates)', allConn);
 /* v107.1: 19 fixed pairs (was 14) and a layer more on every stretch; a jittered
    home node refuses a pair on some seeds, so the crate floor is 30 not 38 */
 ok(`T89.C crates per map inside the band 30-44 (saw ${lvlLo}-${lvlHi}: 19 fixed pairs plus up to 2 rolled)`, lvlLo>=30&&lvlHi<=44);
 ok(`T89.C hedgehogs per map inside the band 200-280 (saw ${barrLo}-${barrHi}: the layers plus three scattered clusters)`, barrLo>=200&&barrHi<=280);
 ok('T89.C every crate has its point mirror - the two compounds are the same fortress', mirrored);
 ok('T89.C no two crates overlap, and none stands within 9 tiles of a start', !overlap&&!nearStart);
 ok('T89.C every crate footprint is blocked in pass by makeMap itself, so mines and hedgehogs kept clear', blocked);
 ok('T89.C the front row is mostly wall on both sides (30+ of 72 tiles)', frontOk);
 ok('T89.C ...and has between 8 and 34 open tiles: gates, not a sealed line and not open ground', gatesOk);
 // the shared corner-lane passes are skipped on a sided map, and say so
 const MM=nocmt107(makeMap);
 ok('T89.C a sided map skips edgeClutter and laneBarr (they walk teammate pairs) and keeps mines and the scattered clusters',
    /if\(def\.t2v2\)\{mineField\(\);midMines\(MID_MINE_PAIRS\);barrCluster\(3\);\}/.test(MM)); // v107.1: plus the handful around the middle (T90.D)
}

/* ---------- D: the crate is a neutral structure on the hedgehog's footing ---------- */
section('T89.D the Attic Clutter structure');
{
 ok('T89.D B.crate: 2x2, marked lvl, costs nothing, never on a menu (no cat, no tech, no req)',
    !!B.crate&&B.crate.sz===2&&B.crate.lvl===1&&B.crate.cp===0&&!B.crate.cat&&!B.crate.tech&&!B.crate.req);
 ok(`T89.D as tough as a Bunker, through the same RESCALE pass (${B.crate.hp} = ${B.bunker.hp})`, B.crate.hp===B.bunker.hp);
 ok('T89.D not a Field Manual card (INFO_BLDS), like the nest', !INFO_BLDS.includes('crate')&&!INFO_BLDS.includes('nest'));
 ok('T89.D not on any army\'s build roster', Object.keys(FAC).filter(f=>f!=='bug').every(f=>!bldRoster({fac:f}).includes('crate')));
 ok('T89.D no texture is asked of it: nothing in the manifest starts bld_crate_',
    !Object.keys(ASSET_MANIFEST.img).some(k=>k.startsWith('bld_crate_')));
 G=null;newGame(cfg107('attic','dm',4242,3));
 if(!SPR.done)bakeSprites();
 ok('T89.D bakeSprites bakes no cell for it (painter-only, like a wall)', !SPR.bld.crate);
 const M=makeMap('attic',4242);
 const crates=G.neutral.blds.filter(b=>b.key==='crate');
 ok(`T89.D every makeMap footprint became a neutral structure (${crates.length} of ${M.lvl.length})`, crates.length===M.lvl.length);
 ok('T89.D each stands on its footprint, prog 1, at full HP, owned by G.neutral', crates.every(b=>b.p===G.neutral&&b.prog===1&&b.hp===b.mhp&&b.sz===2));
 ok('T89.D and G.blds holds them, so the pathfinder, the fog and the renderer see them', crates.every(b=>G.blds.includes(b)));
 // killing one frees its four tiles and pays nothing
 const cr=crates[0],N=G.map.N,nb=G.blds.length,wrecks=G.map.nodes.filter(n=>n.wreck).length;
 kill(cr);
 ok('T89.D killing one frees all four of its tiles and takes it out of G.blds',
    [0,1,2,3].every(i=>G.map.pass[(cr.ty+(i>>1))*N+cr.tx+(i&1)]===1)&&G.blds.length===nb-1&&!G.neutral.blds.includes(cr));
 ok('T89.D ...leaves no wreck (it cost nothing) and never "eliminates" the neutral owner',
    G.map.nodes.filter(n=>n.wreck).length===wrecks&&G.neutral.alive===true);
 // targeting: a bot chews through it at low priority; a player's men never auto-target it
 {G=null;newGame(cfg107('attic','dm',4242,3));
  const bot=G.players.find(p=>p.ai),hum=G.human;
  /* the compounds mix crates and hedgehogs, and the clearing scan answers the
     NEAREST neutral obstacle whichever kind - so the hedgehogs beside this crate
     are cleared first, and the field is emptied of units */
  /* v107.1: a crate on the ENEMY half - a bot spares the obstacles on its own half
     of a sided map now (T90.E), so the first crate in the list is no longer a
     target the bot will take */
  const c2=G.neutral.blds.find(b=>b.key==='crate'&&(b.y<G.map.N/2)!==(G.players.find(p=>p.ai).start.y<G.map.N/2));
  for(const q of G.neutral.blds.slice())if(q.key!=='crate'&&dhyp(q.x-c2.x,q.y-c2.y)<9)kill(q);
  for(const u of G.units.slice())kill(u);   // a clear field
  const near=nearestFit(c2.x+3.5,c2.y,.4,6)||{x:c2.x+3.5,y:c2.y};
  /* the id decides the clearing share: u.id%BARR_CLEAR_SHARE===0 is a clearer */
  const hu=makeUnit('grunt',hum,near.x,near.y);hu.id=BARR_CLEAR_SHARE*100;
  ok('T89.D a human\'s man never auto-targets one (broken deliberately, like a hedgehog)', nearestEnemy(hu,rgOf(hu)+2)==null);
  kill(hu);
  const bu=makeUnit('grunt',bot,near.x,near.y);bu.id=BARR_CLEAR_SHARE*101;
  const got=nearestEnemy(bu,rgOf(bu)+2);   // the NEAREST crate: c2 or its shoulder-to-shoulder neighbour
  ok('T89.D a bot\'s clearing share targets a crate when nothing else is in reach', !!got&&got.key==='crate'&&got.p===G.neutral);
  bu.id=BARR_CLEAR_SHARE*101+1;
  ok('T89.D ...and only that share does: the other men walk past it', nearestEnemy(bu,rgOf(bu)+2)==null);
  bu.id=BARR_CLEAR_SHARE*101;
  const foe=makeUnit('grunt',G.players.find(p=>p!==bot&&p!==hum&&!allied(p,bot)),near.x+1,near.y+1);
  ok('T89.D ...and a soldier in reach always outranks the crate for the bot (low priority, not near priority)', nearestEnemy(bu,rgOf(bu)+2)===foe);
  const UU=nocmt107(nearestEnemy);
  ok('T89.D the gate is the hedgehog\'s own branch: t.barr||t.lvl, one rule', /b\.t\.barr\|\|b\.t\.lvl/.test(UU));}
 // save/load round-trips the crates
 {G=null;newGame(cfg107('attic','koth',313107,3));for(let i=0;i<200;i++)update(DT107);
  const c3=G.neutral.blds.find(b=>b.key==='crate');c3.hp=Math.round(c3.hp*.4);
  const h0=hashState(),n0=G.neutral.blds.filter(b=>b.key==='crate').length,js=saveState();
  G=null;newGame(cfg107('attic','koth',313107,3));loadState(js);
  ok('T89.D a save with damaged crates loads bit-identical (hash) with every crate back under the neutral owner',
     hashState()===h0&&G.neutral.blds.filter(b=>b.key==='crate').length===n0&&G.neutral.blds.some(b=>b.key==='crate'&&b.hp<b.mhp));}
 // the MECHANISM, driven: an idle bot clearer beside a crate shoots it
 {G=null;newGame(cfg107('attic','dm',9107,3));
  const bot=G.players.find(p=>p.ai);
  const c2=G.neutral.blds.find(b=>b.key==='crate');
  for(const q of G.neutral.blds.slice())if(q.key!=='crate'&&dhyp(q.x-c2.x,q.y-c2.y)<9)kill(q);
  for(const u of G.units.slice())kill(u);
  const near=nearestFit(c2.x+3,c2.y,.4,6)||{x:c2.x+3,y:c2.y};
  const bu=makeUnit('grunt',bot,near.x,near.y);bu.id=BARR_CLEAR_SHARE*200;
  const around=G.neutral.blds.filter(b=>b.key==='crate'&&dhyp(b.x-near.x,b.y-near.y)<7),hp0=around.reduce((a,b)=>a+b.hp,0);
  for(let i=0;i<300;i++)update(DT107);
  const hp1=around.reduce((a,b)=>a+(G.blds.includes(b)?b.hp:0),0);
  ok('T89.D an idle bot clearer beside the wall opens fire on a crate within ten seconds (hp '+hp0+' -> '+hp1+')', hp1<hp0);}
}

/* ---------- E: the bathroom ---------- */
section('T89.E the Bathroom: a sealed tub with two gates around the cache');
{
 let rimLo=1e9,rimHi=0,sealed=true,open=true,inside=true,duck=true,mat=true,kinds=true,tubReg=true;
 for(const sd of SEEDS107){
  const M=makeMap('bathroom',sd),N=M.N,c=N/2,t=M.tub;
  const rim=M.props.filter(p=>p.t==='tubrim');rimLo=Math.min(rimLo,rim.length);rimHi=Math.max(rimHi,rim.length);
  const ct=dcos(t.th),st=dsin(t.th);
  const loc=(x,y)=>{const wx=x-c,wy=y-c;return {u:wx*ct+wy*st,v:-wx*st+wy*ct}};
  const rOf=(x,y)=>{const l=loc(x,y);return Math.sqrt((l.u/t.rx)**2+(l.v/t.ry)**2)};
  // the five cache nodes lie inside the oval
  for(const n of M.nodes)if(dhyp(n.x-c,n.y-c)<8&&rOf(n.x,n.y)>=1)inside=false;
  // interior tiles reachable with the gates open, unreachable with them blocked
  const P=M.pass.slice();
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const l=loc(x+.5,y+.5),r=rOf(x+.5,y+.5);if(r>.85&&r<1.15&&Math.abs(l.v)<2.4)P[y*N+x]=0;}
  const R0=flood107(M.pass,N,Math.round(M.starts[0].x),Math.round(M.starts[0].y)),R1=flood107(P,N,Math.round(M.starts[0].x),Math.round(M.starts[0].y));
  let inN=0,in0=0,in1=0;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){if(rOf(x+.5,y+.5)<.7&&M.pass[y*N+x]===1){inN++;if(R0[y*N+x])in0++;if(R1[y*N+x])in1++;}}
  if(inN===0||in0!==inN)open=false;
  if(in1!==0)sealed=false;
  if(!M.props.some(p=>p.t==='duck'&&rOf(p.x,p.y)<.8))duck=false;
  if(!M.mat||M.mat.x<0||M.mat.y<0||M.mat.x+M.mat.w>N||M.mat.y+M.mat.h>N||dhyp(M.mat.x+M.mat.w/2-c,M.mat.y+M.mat.h/2-c)<t.rx)mat=false;
  if(!M.fields.every(f=>f.kind==='soap'||f.kind==='bathwater')||!M.fields.some(f=>f.kind==='soap')||!M.fields.some(f=>f.kind==='bathwater'))kinds=false;
  for(const p of M.patches)if(p.x<c+10&&p.x+p.w>c-10&&p.y<c+10&&p.y+p.h>c-10)tubReg=false;
 }
 ok(`T89.E the rim is ${rimLo}-${rimHi} porcelain segments on every seed (band 44-52: a .10 step minus two gates)`, rimLo>=44&&rimHi<=52);
 ok('T89.E no hedgehog is ever laid inside the tub (the floor stays open ground)', SEEDS107.every(sd=>{const M=makeMap('bathroom',sd);return !M.barricades.some(b=>tubInside(M.tub,b.x+.5,b.y+.5))}));
 ok('T89.E the tub floor is reachable from a start with the gates open', open);
 ok('T89.E ...and NOT reachable with only the two gate mouths blocked: the rim seals (flood fill, six seeds)', sealed);
 ok('T89.E the whole centre cache lies inside the oval', inside);
 ok('T89.E the rubber duck stands in the tub', duck);
 ok('T89.E the bath mat is on the board and clear of the tub; the towel patch never crosses the tub\'s square', mat&&tubReg);
 ok('T89.E its hazards are soap (code 2) and bathwater (code 3), both present, and nothing else', kinds);
 const MM=nocmt107(makeMap);
 ok('T89.E the rim is laid by its own placer that refuses the pocket-clearing radius, not prop()\'s wider one',
    /dhyp\(e\.x-x,e\.y-y\)<3\.45/.test(MM));
 ok('T89.E the audit exempts rim-to-rim art overlap by name', /tubrim.*tubrim/.test(require('fs').readFileSync('audit_maps.js','utf8')));
}

/* ---------- F: every new painter is reached ---------- */
section('T89.F the painters put something down');
{
 /* a recording context: every fillStyle/strokeStyle string, off the shim canvas */
 function rec107(){
  const cv=document.createElement('canvas');cv.width=200;cv.height=200;
  const base=cv.getContext('2d'),out=[];
  const prox=new Proxy(base,{get(t,k){const v=t[k];return typeof v==='function'?v.bind(t):v},
   set(t,k,v){if((k==='fillStyle'||k==='strokeStyle')&&typeof v==='string')out.push(v);t[k]=v;return true}});
  return {c:prox,out};
 }
 const NEWP=['tubrim','duck','tproll','shampoo','soapbar','sponge','plunger','toothbrush','box','trunk','lampshade','frame','rug'];
 for(const t of NEWP){
  const r=rec107();let err=null;
  try{propBody(r.c,{t,x:0,y:0,r:1,len:6,ang:.4,a:.3,hue:120,rot:.2})}catch(e){err=e}
  ok(`T89.F propBody('${t}') runs and paints (${r.out.length} styles)`, !err&&r.out.length>=2);
  ok(`T89.F ...has a collision entry and a bake box (or is a line prop)`,
     PROP_BLK[t]!=null&&(propBox({t,r:1,len:6})!=null));
 }
 // the level art: three looks, hurt and whole
 {G=null;newGame(cfg107('attic','dm',4242,3));
  const looks=new Set();let err=null,styles=0;
  for(const b of G.neutral.blds.filter(q=>q.key==='crate'))looks.add(lvlArtOf(b));
  ok('T89.F the crates on one map show all three looks (the hash reads x AND y)', looks.size===3);
  for(const v of [0,1,2])for(const hurt of [false,true]){
   const b=G.neutral.blds.find(q=>q.key==='crate'&&lvlArtOf(q)===v);if(!b)continue;
   const hp0=b.hp;if(hurt)b.hp=Math.floor(b.mhp*.3);
   const r=rec107();try{drawBld(r.c,b)}catch(e){err=e}
   styles+=r.out.length;b.hp=hp0;
  }
  ok('T89.F drawBld paints every look, whole and hurt, through drawLevelArt without throwing ('+styles+' styles)', !err&&styles>=30);
  ok('T89.F drawBld takes the lvl branch before the wall branch and the baked-cell path',
     (()=>{const s=nocmt107(drawBld);return s.indexOf('b.t.lvl')<s.indexOf('b.t.barr')&&s.indexOf('b.t.lvl')<s.indexOf('SPR.bld[k]')})());}
 // the terrain bake: the new hazard rims and the new theme strokes, on their own map only
 function bakeColours107(map,seed){
  G=null;newGame(cfg107(map,'dm',seed,1));
  const recd=[],real=document.createElement.bind(document);
  document.createElement=(tag)=>{const cv=real(tag);if(String(tag).toLowerCase()!=='canvas')return cv;const base=cv.getContext('2d');
   const prox=new Proxy(base,{get(t,k){const v=t[k];return typeof v==='function'?v.bind(t):v},
    set(t,k,v){if((k==='fillStyle'||k==='strokeStyle')&&typeof v==='string')recd.push(v);t[k]=v;return true}});
   cv.getContext=()=>prox;return cv};
  try{renderTerrain()}finally{document.createElement=real}
  return recd;
 }
 const RIM107={soap:'rgba(140,128,156,.5)',insulation:'rgba(120,56,80,.5)',bathwater:'rgba(88,118,138,.58)',leak:'rgba(28,24,18,.62)'};
 const THEME107={bath:'rgba(120,138,150,.5)',attic:'rgba(40,26,12,.55)'};
 const DECO107={droplet:'rgba(255,255,255,.86)',hair:'rgba(40,28,16,.75)',mothball:'rgba(0,0,0,.18)',cobweb:'rgba(235,232,222,.42)'};
 const TUB107='rgba(130,150,162,.55)';
 const bath=bakeColours107('bathroom',660107),attic=bakeColours107('attic',660107),lawn=bakeColours107('backyard',660107);
 ok('T89.F bathroom: the soap and bathwater painters were reached', bath.includes(RIM107.soap)&&bath.includes(RIM107.bathwater));
 ok('T89.F attic: the insulation and leak painters were reached', attic.includes(RIM107.insulation)&&attic.includes(RIM107.leak));
 ok('T89.F neither map\'s hazards bleed onto the other, nor onto the lawn',
    !bath.includes(RIM107.insulation)&&!bath.includes(RIM107.leak)&&!attic.includes(RIM107.soap)&&!attic.includes(RIM107.bathwater)&&Object.values(RIM107).every(s=>!lawn.includes(s)));
 ok('T89.F the bath tile grout and the attic floorboards are painted, each on its own theme',
    bath.includes(THEME107.bath)&&attic.includes(THEME107.attic)&&!bath.includes(THEME107.attic)&&!attic.includes(THEME107.bath));
 ok('T89.F the tub floor and its tide line are painted', bath.includes(TUB107));
 ok('T89.F the bath mat is painted (hsla off its own hue)', bath.some(s=>/^hsla\((200|340),40%,62%,\.92\)$/.test(s)));
 ok('T89.F the four new decorations were each reached on their map',
    bath.includes(DECO107.droplet)&&bath.includes(DECO107.hair)&&attic.includes(DECO107.mothball)&&attic.includes(DECO107.cobweb));
 ok('T89.F each of those colour strings is unique to its painter in the shipped file (so the check above means what it says)',
    (()=>{const src=require('fs').readFileSync('pw.html','utf8');return Object.values(DECO107).concat(Object.values(RIM107),Object.values(THEME107),[TUB107]).every(s=>src.split(s).length===2)})());
}

/* ---------- G: the setup screen deals a 2v2 ---------- */
section('T89.G picking the Attic deals the lobby a 2v2');
{
 const keep={map:SETUP.map,opp:SETUP.opp,teams:SETUP.teams.slice(),watch:SETUP.watch};
 SETUP.opp=1;SETUP.teams=[1,2,3,4];SETUP.watch=0;
 /* a shim asymmetry, recorded: refreshTeamRow's v35 snap-back reads
    querySelector('#mapRow .card[data-survonly].sel'), and the shim answers a
    stub element for any selector, so under the shim the map field snaps to
    'backyard' on every refresh. A browser answers null there unless the Desk
    card is lit. The two fields the preset WRITES are asserted here; the map
    field is driven through the non-preset path below, which never refreshes. */
 menuPickMap('attic');
 ok('T89.G menuPickMap(attic): three opponents, You + CPU 1 v CPU 2 + CPU 3',
    SETUP.opp===3&&SETUP.teams.join()==='1,1,2,2');
 ok('T89.G ...and the 3-opponent button is the one lit',
    Array.from(document.querySelectorAll('[data-opp]')).every(b=>(b.classList.contains('sel'))===(b.dataset.opp==='3')));
 SETUP.teams=[1,2,1,2];
 menuPickMap('backyard');
 ok('T89.G picking another map afterwards leaves what you set alone (a starting position, not a lock)',
    SETUP.map==='backyard'&&SETUP.opp===3&&SETUP.teams.join()==='1,2,1,2');
 SETUP.watch=1;SETUP.teams=[1,2,3,4];
 menuPickMap('attic');
 ok('T89.G in spectate mode the preset stays out of the way (the roster is four bots, no seat is yours)',
    SETUP.map==='attic'&&SETUP.teams.join()==='1,2,3,4');
 SETUP.watch=keep.watch;SETUP.map=keep.map;SETUP.opp=keep.opp;SETUP.teams=keep.teams;
 document.querySelectorAll('[data-opp]').forEach(x=>x.classList.toggle('sel',+x.dataset.opp===SETUP.opp));
 refreshTeamRow();
 ok('T89.G the card click routes through menuPickMap (named, so this file can drive it)',
    /menuPickMap\(k\)/.test(require('fs').readFileSync('pw.html','utf8')));
}

/* ---------- H: the two layouts are declared ---------- */
section('T89.H the two generators are pinned: change one, and say so here');
{
 /* the v43 layout hash plus the two things it never had to read: the hedgehog
    tiles and the crate footprints. Cut on the final v107 bytes. */
 function layoutHash107(M){
  let h=2166136261;
  const P=M.pass;for(let i=0;i<P.length;i++)h=hI(h,P[i]);
  for(const n of M.nodes){h=hF(h,n.x);h=hF(h,n.y);h=hS(h,n.t);h=hF(h,n.amt)}
  for(const s of M.starts){h=hF(h,s.x);h=hF(h,s.y)}
  for(const ns of (M.nests||[])){h=hF(h,ns.x);h=hF(h,ns.y)}
  for(const pr of (M.props||[])){h=hF(h,pr.x);h=hF(h,pr.y);h=hS(h,pr.t)}
  for(const b of (M.barricades||[])){h=hI(h,b.x);h=hI(h,b.y)}
  for(const b of (M.lvl||[])){h=hI(h,b.x);h=hI(h,b.y)}
  return h>>>0;
 }
 /* v107.1: the three Attic pins recut (the wall came in seven rows, the home sites
    moved, the mines grew); the Bathroom's three held */
 const BASE107_LAYOUTS={"bathroom:11":2389414214,"bathroom:22":3961821753,"bathroom:33":1983128978,"attic:11":4047237124,"attic:22":1049638336,"attic:33":1806456085};
 for(const m of ['bathroom','attic'])for(const sd of [11,22,33]){
  const got=layoutHash107(makeMap(m,sd)),want=BASE107_LAYOUTS[m+':'+sd];
  ok(`T89.H layout ${m}:${sd} unchanged (${got})`, got===want);
 }
}

/* ---------- I: the measurement tools know the new boards ---------- */
section('T89.I sim.sh, audit_maps.js and map_shot.sh deal the new maps');
{
 const fs=require('fs');
 const sim=fs.readFileSync('sim.sh','utf8'),aud=fs.readFileSync('audit_maps.js','utf8'),shot=fs.readFileSync('map_shot.sh','utf8');
 ok('T89.I sim.sh deals six deathmatch maps, bathroom and attic among them, round-robin over six',
    /MAPS_DM="backyard kitchen livingroom sandbox bathroom attic"/.test(sim)&&/i % 6 \+ 1/.test(sim));
 ok('T89.I audit_maps.js walks both', /'bathroom','attic'\]/.test(aud));
 ok('T89.I map_shot.sh shoots both by default', /desk bathroom attic"/.test(shot));
 ok('T89.I the Field Manual names the Attic as the 2v2 board', />The Attic<\/b> is built for a <b>2v2<\/b>/.test(fs.readFileSync('pw.html','utf8')));
 ok('T89.I survivalSetup prunes crates inside the arena and drops M.sides', /M\.lvl=\(M\.lvl\|\|\[\]\)\.filter/.test(nocmt107(survivalSetup))&&/delete M\.sides/.test(nocmt107(survivalSetup)));
}
