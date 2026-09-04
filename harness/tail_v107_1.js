/* tail_v107_1.js - v107.1: the owner's feedback pass on The Attic (T90).
   Five asks, from playing v107: the compounds' walls stood too far out (row 24,
   sixteen rows from the bases), so they come in seven rows to 17; every stretch
   of wall gains a layer; each base gets a second home expansion, "to the side";
   a bot stops chewing through its OWN compound's neutral obstacles; and a
   handful of mines is buried around the middle of the map, where there were
   measured to be none on some seeds.
   What is asserted: the wall's new rows and its extra layer, that the compounds
   still enclose without sealing, that every home site sits INSIDE the wall (the
   natural had to move - aimed at the centre it stood in the wall band), the
   mines (count, mirror, where), the manual's slot, and the bot rule DRIVEN both
   ways: a clearer beside its own wall answers nothing and never opens fire; the
   same clearer beside the enemy's wall clears it; a corner map is untouched.
   The Attic's three layout pins in T89.H were recut for this (a conscious
   edit); the Bathroom's three and the 30/42 corner-map pins held. */
'use strict';
section('T90 v107.1: the Attic, pulled in');

const DT1071=1/30;
function nocmt1071(fn){return String(fn).replace(/\/\*[\s\S]*?\*\//g,' ').replace(/(^|[^:])\/\/[^\n]*/g,'$1')}
function cfg1071(map,mode,seed,opp,teams){const o={map,mode:mode||'dm',diff:'normal',fac:'green',opp:opp==null?3:opp,seed};if(teams)o.teams=teams;return o}
function flood1071(pass,N,sx,sy){
 const R=new Uint8Array(N*N),st=[];const ps=(x,y)=>x>=0&&y>=0&&x<N&&y<N&&pass[y*N+x]===1;
 if(!ps(sx,sy))return R;R[sy*N+sx]=1;st.push(sx,sy);
 const D=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
 while(st.length){const y=st.pop(),x=st.pop();for(const [dx,dy] of D){const nx=x+dx,ny=y+dy;if(!ps(nx,ny)||R[ny*N+nx])continue;if(dx&&dy&&(!ps(x+dx,y)||!ps(x,y+dy)))continue;R[ny*N+nx]=1;st.push(nx,ny)}}
 return R;
}
const SEEDS1071=[11,22,33,4242,500000,777];
const FRONT1071=17;
/* a row's wall tiles: pass 0 (a crate footprint, a prop) or a hedgehog on it */
function rowWall1071(M,ty,x0,x1){let w=0;for(let tx=x0;tx<=x1;tx++)if(M.pass[ty*M.N+tx]===0||M.barricades.some(b=>b.x===tx&&b.y===ty))w++;return w}

/* ---------- A: the wall came in seven rows and gained a layer ---------- */
section('T90.A the front line stands on row 17, not 24, with a layer more on every stretch');
{
 let frontOk=true,oldRowEmpty=true,layersOk=true,cratesOk=true,gateOk=true;const seen=[];
 for(const sd of SEEDS1071){
  const M=makeMap('attic',sd),N=M.N;
  for(const [ty,my] of [[FRONT1071,N-1-FRONT1071]]){
   if(rowWall1071(M,ty,0,N-1)<40||rowWall1071(M,my,0,N-1)<40)frontOk=false;
  }
  /* the OLD innermost row, 24, carries no compound at all now: only what the
     scattered clusters or a field crate happen to put there - never 20 tiles */
  if(rowWall1071(M,24,0,N-1)>=20||rowWall1071(M,N-1-24,0,N-1)>=20)oldRowEmpty=false;
  /* the layers, per stretch (v107 in brackets): x 2-13 rows 17,20,23 [24,27];
     x 18-30 rows 17,19,21,23 [24,26,28]; x 41-53 rows 17,19,21,23 [24,27];
     x 58-69 rows 17,19,21,23 [24,26,28]. A hedgehog row rolls holes, a node can
     refuse a tile, so the claim per row is "carries wall", four tiles or more. */
  const st=[[2,13,[17,20,23]],[18,30,[17,19,21,23]],[41,53,[17,19,21,23]],[58,69,[17,19,21,23]]];
  for(const [x0,x1,rows] of st)for(const ty of rows){
   if(rowWall1071(M,ty,x0,x1)<4||rowWall1071(M,N-1-ty,N-1-x1,N-1-x0)<4)layersOk=false;
  }
  /* every crate is compound (rows 17 or 21 and their mirrors) or field (within
     13.5 of the centre, the loose pairs) - none is left standing at row 24 */
  for(const b of M.lvl){
   const cy=b.y+1,inField=dhyp(b.x+1-N/2,cy-N/2)<=14.5;
   if(!inField&&![FRONT1071,FRONT1071+4,N-2-FRONT1071,N-2-FRONT1071-4].includes(b.y))cratesOk=false;
  }
  /* the crate wall across each base's front: at least three of the four pairs
     stand on row 17 in x 18-25 and x 46-53 (a jittered home node can refuse one) */
  const cw=(x0,x1,ty)=>M.lvl.filter(b=>b.y===ty&&b.x>=x0&&b.x<=x1).length;
  if(cw(18,25,FRONT1071)<3||cw(46,53,FRONT1071)<3||cw(N-2-25,N-2-18,N-2-FRONT1071)<3||cw(N-2-53,N-2-46,N-2-FRONT1071)<3)cratesOk=false;
  /* the three gates are open on row 17: the west 14-17, the centre 33-38, the
     east 54-57 (a scattered cluster may graze one; the flood in B is the proof) */
  const open=(x0,x1,ty)=>{let o=0;for(let tx=x0;tx<=x1;tx++)if(M.pass[ty*N+tx]===1&&!M.barricades.some(b=>b.x===tx&&b.y===ty))o++;return o};
  if(open(14,17,FRONT1071)<3||open(33,38,FRONT1071)<4||open(54,57,FRONT1071)<3)gateOk=false;
  seen.push(rowWall1071(M,FRONT1071,0,N-1));
 }
 ok(`T90.A row 17 is mostly wall on both sides, every seed (${seen.join(',')} of 72 on the north)`, frontOk);
 ok('T90.A row 24, the old front, carries no compound any more (under 20 wall tiles, both sides)', oldRowEmpty);
 ok('T90.A every stretch carries one layer more than v107: 3 on the west rim, 4 on the base fronts and the east rim', layersOk);
 ok('T90.A every crate stands on rows 17/21 (or mirrors) or loose in the field; a crate wall fronts each base', cratesOk);
 ok('T90.A the three gates stay open on the innermost row', gateOk);
 const MM=nocmt1071(makeMap);
 ok('T90.A FRONT is 17 in the generator, and the front-line comment says why the row-17 base fronts are crates', /const FRONT=17;/.test(MM)&&/pulls it in seven rows to 17/.test(String(makeMap)));
}

/* ---------- B: enclosed, not sealed; the mid expansions are outside now ---------- */
section('T90.B the compounds still enclose without sealing');
{
 let allConn=true,midOut=true,mirrored=true;
 for(const sd of SEEDS1071){
  const M=makeMap('attic',sd),N=M.N;
  const R=flood1071(M.pass,N,Math.round(M.starts[0].x),Math.round(M.starts[0].y));
  if(!M.starts.every(s=>R[Math.round(s.y)*N+Math.round(s.x)]))allConn=false;
  for(const e of M.expos.filter(e=>!e.nat))if(!(Math.abs(e.y-N/2)<N/2-FRONT1071-1||Math.abs(e.x-N/2)<10))midOut=false; // the four contested sites: outside both walls
  for(const b of M.lvl)if(!M.lvl.some(q=>q.x===N-2-b.x&&q.y===N-2-b.y))mirrored=false;
  /* the crates only: a hedgehog is refused one at a time (a home node jittered
     onto its tile), and the two compounds' home nodes roll separately, so 5-15
     hedgehogs per seed have no mirror - as at v107 */
 }
 ok('T90.B every start reaches every other start on every seed (the gates are real)', allConn);
 ok('T90.B the four contested mid expansions all lie outside the walls now', midOut);
 ok('T90.B every crate has its point mirror: the two compounds are still the same fortress', mirrored);
}

/* ---------- C: two home sites per base, inside the wall, on the flank ---------- */
section('T90.C each base has a natural on its flank and a second site toward the corner');
{
 let twelve=true,inside=true,flank=true,corner=true,amounts=true,nodes=true;const ys=[];
 for(const sd of SEEDS1071){
  const M=makeMap('attic',sd),N=M.N,c=N/2;
  if(M.expos.length!==12)twelve=false;                   // 4 naturals + 4 corner sites + 4 contested
  if(M.nodes.length!==41)nodes=false;                     // 5 centre + 4x3 home + 8x2 sites
  for(const s of M.starts){
   const north=s.y<c,dx=s.x<c?1:-1;
   const mine=M.expos.filter(e=>e.nat&&(e.y<c)===north&&dhyp(e.x-s.x,e.y-s.y)<20);
   if(mine.length!==2){inside=false;continue}
   /* inside: on the base's side of the wall with room for its pocket (5 clear of
      row 17.5 means y <= 12 on the north), and both further OUT along the edge
      than the base - the natural nearer, the corner site beyond it */
   for(const e of mine){const d=north?e.y:N-e.y;ys.push(+d.toFixed(1));if(d>12.5)inside=false;if((e.x-s.x)*dx>=0)flank=false;}
   const byOut=mine.slice().sort((a,b)=>Math.abs(a.x-s.x)-Math.abs(b.x-s.x));
   const nat=byOut[0],cor=byOut[1];
   if(!(Math.abs(nat.x-s.x)>=7.5&&Math.abs(nat.x-s.x)<=10.5&&Math.abs(cor.x-s.x)>=16&&Math.abs(cor.x-s.x)<=18))corner=false;
   /* the corner site carries the contested sites' amounts, the natural its own */
   const nd=(e)=>M.nodes.filter(n=>dhyp(n.x-e.x,n.y-e.y)<2.6); // node() snaps to a tile centre, so the pair sits 0.9-2.3 from the site's centre
   const pn=nd(nat),pc=nd(cor);
   if(!(pn.length===2&&pc.length===2))amounts=false;
   else{const a=(ns,t)=>ns.find(n=>n.t===t)&&ns.find(n=>n.t===t).max;
    if(!(a(pn,'plastic')===4500&&a(pn,'battery')===3600&&a(pc,'plastic')===2800&&a(pc,'battery')===2600))amounts=false;}
  }
 }
 ok('T90.C twelve expansion sites on every seed: four naturals, four corner sites, four contested', twelve);
 ok('T90.C ...and 41 resource nodes, so no site lost a node to the clamp', nodes);
 ok(`T90.C both home sites of every base sit inside the wall: rows <= 12 from the base's edge (saw ${Math.max(...ys)})`, inside);
 ok('T90.C both are OUTBOARD of the base, along the edge, away from the teammate', flank);
 ok('T90.C the natural is 8-9.5 tiles out and the corner site 16-18, on every start', corner);
 ok('T90.C the natural carries 4500/3600, the corner site 2800/2600 (the contested sites\' amounts)', amounts);
 const MM=String(makeMap);
 ok('T90.C the outboard aim is gated on t2v2 (sided): the corner maps take the old aim at the centre', /const dxc=sided\?-dx\*N:N\/2-s\.x,dyc=sided\?0:N\/2-s\.y/.test(MM)&&/if\(sided\)\{const fx=s\.x-dx\*17;/.test(MM));
 // a corner map's natural still aims at the centre: 11.5-15 tiles out, toward it
 let aimOk=true;
 for(const sd of [11,22]){const M=makeMap('backyard',sd),N=M.N;
  for(const s of M.starts){const nat=M.expos.filter(e=>e.nat).sort((a,b)=>dhyp(a.x-s.x,a.y-s.y)-dhyp(b.x-s.x,b.y-s.y))[0];
   const d=dhyp(nat.x-s.x,nat.y-s.y);if(d<11||d>17.5)aimOk=false;
   if(dhyp(nat.x-N/2,nat.y-N/2)>=dhyp(s.x-N/2,s.y-N/2))aimOk=false;}}
 ok('T90.C Backyard Brawl\'s naturals are where they were: 11-17.5 tiles out, toward the centre', aimOk);
}

/* ---------- D: the handful of mines around the middle ---------- */
section('T90.D the Attic buries a handful of mines around its middle');
{
 let count=true,mid=true,mirror=true,spaced=true,clear=true,others=true;const mids=[];
 for(const sd of SEEDS1071){
  const M=makeMap('attic',sd),N=M.N,c=N/2;
  if(M.mines.length!==MINES_PER_MAP+2*MID_MINE_PAIRS)count=false;
  const m10=M.mines.filter(m=>dhyp(m.x-c,m.y-c)<=10).length;mids.push(m10);
  if(m10<2*MID_MINE_PAIRS)mid=false;
  for(const m of M.mines){
   if(!M.mines.some(q=>Math.abs(q.x-(N-m.x))<1e-9&&Math.abs(q.y-(N-m.y))<1e-9))mirror=false;
   if(M.mines.some(q=>q!==m&&Math.abs(q.x-m.x)<3&&Math.abs(q.y-m.y)<3))spaced=false;
   if(M.pass[Math.floor(m.y)*N+Math.floor(m.x)]!==1)clear=false;
   /* the pair's PRIMARY was tested against nodes and pockets and the mirror was not
      (mineField, since v67: the two halves' nodes roll separately), so the claim is
      the one the generator makes: one of the pair clears */
   const mm={x:N-m.x,y:N-m.y},clr=(q)=>!M.nodes.some(n=>dhyp(n.x-q.x,n.y-q.y)<2.6)&&!M.expos.some(e=>dhyp(e.x-q.x,e.y-q.y)<4.5);
   if(!clr(m)&&!clr(mm))clear=false;
   if(M.starts.some(s=>dhyp(s.x-m.x,s.y-m.y)<MINE_KEEPOUT))clear=false;
  }
 }
 for(const k of ['backyard','kitchen','bathroom'])for(const sd of [11,22])if(makeMap(k,sd).mines.length!==MINES_PER_MAP)others=false;
 ok(`T90.D ${MINES_PER_MAP}+${2*MID_MINE_PAIRS} mines on every seed`, count);
 ok(`T90.D at least ${2*MID_MINE_PAIRS} of them within ten tiles of the centre (saw ${mids.join(',')}; v107 measured 0-2)`, mid);
 ok('T90.D every mine still has its point mirror, three tiles from every other, on open ground, clear of starts, and one of each pair clear of nodes and pockets', mirror&&spaced&&clear);
 ok('T90.D every other map keeps MINES_PER_MAP exactly', others);
 ok('T90.D the extra pairs are laid AFTER mineField on a sided map only', /if\(def\.t2v2\)\{mineField\(\);midMines\(MID_MINE_PAIRS\);barrCluster\(3\);\}/.test(nocmt1071(makeMap)));
 ok('T90.D the manual reads the number off the constant (HELP_TUNE.midMines) and its Landmines line spends it', HELP_TUNE.midMines()===2*MID_MINE_PAIRS&&/hidden mines, and The Attic buries <span data-tune="midMines"><\/span> more around its middle/.test(require('fs').readFileSync('../source/head.html','utf8')));
 ok('T90.D MID_MINE_PAIRS is a small handful', MID_MINE_PAIRS>=2&&MID_MINE_PAIRS<=5);
}

/* ---------- E: a bot never clears its own compound ---------- */
section('T90.E a bot clears the enemy\'s wall and never its own');
{
 /* the hedgehogs beside a crate cleared (the scan answers the NEAREST obstacle of
    either kind) and every unit but `keep` killed - the first cut killed the clearer
    itself on the second call and then went looking for it after a load */
 const clearField=(around,keep)=>{for(const q of G.neutral.blds.slice())if(q.key!=='crate'&&dhyp(q.x-around.x,q.y-around.y)<9)kill(q);for(const u of G.units.slice())if(u!==keep)kill(u);};
 {G=null;newGame(cfg1071('attic','dm',4242,3,[1,1,2,2]));
  const bot=G.players.find(p=>p.ai),N=G.map.N,north=bot.start.y<N/2;
  const own=G.neutral.blds.filter(b=>b.key==='crate'&&(b.y<N/2)===north),foe=G.neutral.blds.filter(b=>b.key==='crate'&&(b.y<N/2)!==north);
  ok('T90.E the fixture: a 2v2, the bot seated on one side, crates on both halves ('+own.length+' own, '+foe.length+' enemy)', own.length>=10&&foe.length>=10&&bot.start.y!==N/2);
  // beside its OWN wall, the clearing share answers nothing
  const c2=own.sort((a,b)=>Math.abs(a.y-bot.start.y)-Math.abs(b.y-bot.start.y))[0];
  clearField(c2);
  const near=nearestFit(c2.x+3.5,c2.y,.4,6)||{x:c2.x+3.5,y:c2.y};
  const bu=makeUnit('grunt',bot,near.x,near.y);bu.id=BARR_CLEAR_SHARE*300;
  ok('T90.E a bot\'s clearer beside its own compound\'s crate answers nothing', nearestEnemy(bu,rgOf(bu)+2)==null);
  // ...nor beside its own hedgehogs
  const hh=G.neutral.blds.filter(b=>b.key==='barricade'&&(b.y<N/2)===north).sort((a,b)=>dhyp(a.x-bu.x,a.y-bu.y)-dhyp(b.x-bu.x,b.y-bu.y))[0];
  if(hh){bu.x=hh.x+1.5;bu.y=hh.y+.5;}
  ok('T90.E ...nor beside its own compound\'s hedgehog', !hh||nearestEnemy(bu,rgOf(bu)+2)==null);
  // an enemy soldier there is still answered: the rule spares obstacles, not enemies
  const enemy=G.players.find(p=>!allied(p,bot));
  const eu=makeUnit('grunt',enemy,bu.x+1,bu.y+1);
  ok('T90.E an enemy soldier beside that wall is still acquired', nearestEnemy(bu,rgOf(bu)+2)===eu);
  kill(eu);
  // beside the ENEMY's wall the same clearer clears
  const c3=foe.sort((a,b)=>dhyp(a.x-N/2,a.y-N/2)-dhyp(b.x-N/2,b.y-N/2))[0];
  clearField(c3,bu);
  const near3=nearestFit(c3.x+3.5,c3.y,.4,6)||{x:c3.x+3.5,y:c3.y};
  bu.x=near3.x;bu.y=near3.y;
  const got=nearestEnemy(bu,rgOf(bu)+2);
  ok('T90.E the same clearer beside the ENEMY compound\'s crate targets it', !!got&&got.key==='crate'&&got.p===G.neutral);
  // a human's men are untouched either way
  const hu=makeUnit('grunt',G.human,near3.x,near3.y);hu.id=BARR_CLEAR_SHARE*301;
  ok('T90.E a human\'s man still never auto-targets one, on either half', nearestEnemy(hu,rgOf(hu)+2)==null);
  // save/load: p.start rides the snapshot, so a loaded match answers the same
  bu.x=near.x;bu.y=near.y;
  const js=saveState();G=null;newGame(cfg1071('attic','dm',4242,3,[1,1,2,2]));loadState(js);
  const bot2=G.players.find(p=>p.i===bot.i),bu2=G.units.find(u=>u.id===bu.id);
  ok('T90.E after a save and load the bot still knows its side (p.start) and still spares its own wall', !!bot2.start&&!!bu2&&nearestEnemy(bu2,rgOf(bu2)+2)==null);
  const UU=nocmt1071(nearestEnemy);
  ok('T90.E the rule is one line in the neutral branch, gated on G.map.sides and read off p.start', /if\(G\.map\.sides&&u\.p\.start&&\(\(u\.p\.start\.y<G\.map\.N\/2\)===\(b\.y<G\.map\.N\/2\)\)\)continue;/.test(UU));}
 // the MECHANISM, driven: an idle clearer beside its own wall never opens fire
 {G=null;newGame(cfg1071('attic','dm',9107,3,[1,1,2,2]));
  const bot=G.players.find(p=>p.ai),N=G.map.N,north=bot.start.y<N/2;
  const c2=G.neutral.blds.filter(b=>b.key==='crate'&&(b.y<N/2)===north).sort((a,b)=>Math.abs(a.y-bot.start.y)-Math.abs(b.y-bot.start.y))[0];
  clearField(c2);
  const near=nearestFit(c2.x+3,c2.y,.4,6)||{x:c2.x+3,y:c2.y};
  const bu=makeUnit('grunt',bot,near.x,near.y);bu.id=BARR_CLEAR_SHARE*400;
  const around=G.neutral.blds.filter(b=>b.key==='crate'&&dhyp(b.x-near.x,b.y-near.y)<7),hp0=around.reduce((a,b)=>a+b.hp,0);
  for(let i=0;i<300;i++)update(DT1071);
  const hp1=around.reduce((a,b)=>a+(G.blds.includes(b)?b.hp:0),0);
  ok('T90.E an idle bot clearer beside its own wall fires on nothing in ten seconds (hp '+hp0+' -> '+hp1+')', hp1===hp0&&hp0>0);}
 // a corner map is untouched: no sides, so a bot still thins the hedgehogs on its own half
 {G=null;newGame(cfg1071('backyard','dm',4242,3));
  const bot=G.players.find(p=>p.ai),N=G.map.N;
  const hh=G.neutral.blds.filter(b=>b.key==='barricade'&&(b.y<N/2)===(bot.start.y<N/2));
  for(const u of G.units.slice())kill(u);
  let got=null;
  for(const b of hh){const near=nearestFit(b.x+1.5,b.y+.5,.4,4);if(!near)continue;const bu=makeUnit('grunt',bot,near.x,near.y);bu.id=BARR_CLEAR_SHARE*500;got=nearestEnemy(bu,rgOf(bu)+2);kill(bu);if(got)break;}
  ok('T90.E Backyard Brawl declares no sides, so a bot clearer still clears a hedgehog on its own half there', G.map.sides==null&&!!got&&got.key==='barricade'&&got.p===G.neutral);}
}

/* ---------- F: the release stamp ---------- */
section('T90.F the release stamp');
ok('T90.F GAME_VER is v107.2', GAME_VER==='v107.2'); // v107.2: bumped with the constants
