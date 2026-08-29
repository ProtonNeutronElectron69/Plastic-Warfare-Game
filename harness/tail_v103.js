/* tail_v103.js - T80: the barrage's cadence, the rotor's level, and the map
   audit pass.

   THE MAP HALF IS THE BULK OF THIS FILE, and what it defends is a set of claims
   about EVERY seed rather than about one. The owner played v102 and listed what
   looked wrong on the boards - art walking off the edge, off-colour tiles down
   one side, hazards clipping through hazards, blocking art standing inside an
   impassable spill, big art drawn through other art, and clumps of GRASS on the
   living-room carpet. Every one of those reproduced, was measured over 200 map
   generations by harness/audit_maps.js, and is fixed here.

   So the checks below GENERATE MAPS and assert over all of them. That matters
   because none of these defects can fail a rendering test: renderGuard means a
   drawing bug cannot crash the game and cannot go red in seg.sh either (rule 7).
   What CAN be asserted is the geometry the drawing is done from, and that is
   what this file asserts - the only claim left to a screenshot is whether the
   ground-banding passes look like stripes, and that one was read in Chromium.

   TWO THINGS WORTH CARRYING FORWARD, both recorded here because they cost time:

   1. THE "OFF COLOUR TILES ON ONE SIDE" DEFECT WAS ONE TYPO IN THREE PASSES.
      A band started at tile (i,0) and ran N tiles in +x, which is a strip three
      tiles deep along ONE EDGE of the board - so all 22 mowed stripes stacked
      into the same three rows and the rest of the lawn got none. isoX(0,i) is
      the whole fix. When a pass claims to sweep the board, check which axis it
      actually walks.
   2. A PASS THAT GIVES UP TAKES ITS LAST ROLL BLIND. Teaching the hazard picks
      to reject a spot that crosses another kind cut the clipping by two thirds
      and no further, because the lane pass - which must sit on a lane - kept
      running out of tries and stamping wherever its final roll landed. Scoring
      the ladder and keeping the LEAST BAD roll took the remainder to almost
      nothing. fldGap returns a margin instead of a boolean for exactly that. */
'use strict';
section('T80 v103: barrage cadence, rotor level, and the map layout audit');

const KEYS103=['backyard','kitchen','sandbox','livingroom','desk'];
const SEEDS103=[500000,507919,515838,523757,531676,539595,547514,555433];
function maps103(n){const out=[];for(const k of KEYS103)for(const s of SEEDS103.slice(0,n||SEEDS103.length))out.push([k,s,makeMap(k,s)]);return out}
/* the tiles prop() actually took: a disc for an ordinary prop, blockLine's
   capsule for a line prop. Written here rather than imported because the point
   is to check the generator against an independent reading of its own rules. */
/* the prop types every map lays as point-symmetric pairs - propPairs, and the two
   terracotta-pot corners. Anything laid as a chain or a loose scatter (the hose,
   marbles, the sandcastle ring, the train) is deliberately not on this list. */
/* the props a map is BUILT AROUND, exempt from the drowning removal on purpose:
   deleting one costs the map its centrepiece where deleting a rock costs a rock.
   KEEP inside makeMap is the belt (no hazard is laid over them); this is the
   braces, because a cluster's second lobe is placed relative to its first and can
   still reach ground the first one was steered away from. */
const ANCHOR103={keep:1,bowl:1,table:1};
const PAIRED103=['rock','mushroom','couch','chair','console','shelf','can','plate','mug',
 'toaster','star','beachball','books','slipper','remote','soccer','gnome','wcan','lamp',
 'dumptruck','salt','chips','eraser','keyboard','shellp','pot'];
function ptiles103(M,p){
 const N=M.N,br=propBlkR(p.t,p.r,p.sc),out=[];
 if(br<=0)return out;
 if(p.len){const cx=dcos(p.ang),cy=dsin(p.ang),sc=p.sc||1,R=Math.ceil(br),rr=(br+.5)*(br+.5);
  for(let t=-Math.max(.25,br);t<=p.len*sc+Math.max(.25,br);t+=.34){
   const bx=Math.floor(p.x+cx*t),by=Math.floor(p.y+cy*t);
   for(let oy=-R;oy<=R;oy++)for(let ox=-R;ox<=R;ox++){if(ox*ox+oy*oy>rr)continue;
    const tx=bx+ox,ty=by+oy;if(tx>=0&&ty>=0&&tx<N&&ty<N)out.push(ty*N+tx);}}
  return out;}
 const tx=Math.floor(p.x),ty=Math.floor(p.y);
 if(tx>=0&&ty>=0&&tx<N&&ty<N)out.push(ty*N+tx);
 for(let y=Math.floor(p.y-br);y<=p.y+br;y++)for(let x=Math.floor(p.x-br);x<=p.x+br;x++){
  if(x<0||y<0||x>=N||y>=N)continue;
  if(dhyp(x+.5-p.x,y+.5-p.y)<=br)out.push(y*N+x);}
 return out;
}
function fcovers103(f,x,y){const ddx=x+.5-f.cx,ddy=y+.5-f.cy,rm=blobRadius(f.blob,datan2(ddy,ddx));
 const nx=ddx/(f.rx*rm),ny=ddy/(f.ry*rm);return nx*nx+ny*ny<=1}
function nocmt103(fn){return String(fn).replace(/\/\*[\s\S]*?\*\//g,' ').replace(/(^|[^:])\/\/[^\n]*/g,'$1')}
let SRC103=null;
try{SRC103=require('fs').readFileSync('pw.html','utf8')}catch(e){SRC103=null}

/* ---------- A: the artillery barrage walks faster ---------- */
{
 section('T80.A the barrage: 1.5s between shells, and nothing else moved');
 /* TRANSCRIBED on purpose, like every other price and cadence in this suite:
    the owner set this number and a future release changing it has to come here
    and say so. */
 ok('T80.A BARRAGE_GAP is 1.5s (was 2.0 through v102)', BARRAGE_GAP===1.5);
 ok('T80.A the shell count, damage, blast and box are untouched',
    BARRAGE_N===7 && BARRAGE_DMG===105 && BARRAGE_R===3 && BARRAGE_BOX===10 && BARRAGE_FLY===1.6);

 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'tan',opp:1,seed:1030101});
 const p=G.human;
 const u=makeUnit('grunt',p,20,20);   // any owner will do: radioBarrage reads u.p
 G.strikes.length=0;
 radioBarrage(u,30,30);
 const st=G.strikes[G.strikes.length-1];
 ok('T80.A a barrage strike carries exactly BARRAGE_N shells', !!st && st.sh.length===BARRAGE_N);
 let gaps=[],ok0=!!st&&Math.abs(st.sh[0].at-BARRAGE_FLY)<1e-9;
 if(st)for(let i=1;i<st.sh.length;i++)gaps.push(+(st.sh[i].at-st.sh[i-1].at).toFixed(6));
 ok('T80.A the first shell still lands after the BARRAGE_FLY arc', ok0);
 ok('T80.A every later shell is BARRAGE_GAP behind the one before it ['+gaps.join(',')+']',
    gaps.length===BARRAGE_N-1 && gaps.every(g=>Math.abs(g-BARRAGE_GAP)<1e-9));
 const walk=BARRAGE_FLY+(BARRAGE_N-1)*BARRAGE_GAP;
 ok('T80.A the whole walk is '+walk.toFixed(1)+'s, down from 13.6', Math.abs(walk-10.6)<1e-9);

 /* the Field Manual states this number, and rule 3 says it must READ the
    constant rather than carry a second copy of it. */
 ok('T80.A the manual\'s barrGap slot returns the constant itself', HELP_TUNE.barrGap()===BARRAGE_GAP);
 ok('T80.A ...and the manual sentence spends it through data-tune, not in prose',
    !SRC103 || (SRC103.indexOf('data-tune="barrGap"')>0 && SRC103.indexOf('2.0s apart')<0));
}

/* ---------- B: the selection rotor answers twice as loud ---------- */
{
 section('T80.B the helicopter selection voice, doubled');
 /* v92.1's values, transcribed from the release that tuned them, so "twice as
    loud" is a checked claim about a specific before and not a vibe. */
 const V92={heli:.26,apache:.24,chinook:.30};
 let bad=[];
 for(const k in V92)if(Math.abs(ROTORV[k].g-V92[k]*2)>1e-9)bad.push(k+' '+ROTORV[k].g+' want '+(V92[k]*2));
 ok('T80.B every rotor\'s level is exactly double its v92.1 value'+(bad.length?' ['+bad.join('; ')+']':''), bad.length===0);
 ok('T80.B the three are still ordered chinook > heli > apache, as v92.1 tuned them',
    ROTORV.chinook.g>ROTORV.heli.g && ROTORV.heli.g>ROTORV.apache.g);
 /* what makes the three tellable apart is NOT the level - T43.L pins the chop
    and blade rates, the filter and the tandem beat - so this release must not
    have moved any of them. */
 ok('T80.B chop, blade, filter and window are untouched',
    ROTORV.heli.chop===11 && ROTORV.heli.blade===22 && ROTORV.heli.lp===320 && ROTORV.heli.dur===.45 &&
    ROTORV.apache.chop===14 && ROTORV.apache.blade===28 && ROTORV.apache.lp===280 && ROTORV.apache.dur===.48 &&
    ROTORV.chinook.chop===8.5 && ROTORV.chinook.blade===9.3 && ROTORV.chinook.lp===240 && ROTORV.chinook.dur===.60);
 ok('T80.B the diesel voices did NOT come with it - this was an air-only ask',
    DIESELV.tank.g===.24 && DIESELV.hvytank.g===.26 && DIESELV.bike.g===.18);
 ok('T80.B sRotor still reads its level off the table rather than a literal',
    !SRC103 || /const R=ROTORV\[kind\]\|\|ROTORV\.heli/.test(SRC103));
 /* rule 2's mirror: the audio path may never draw from the seeded stream. */
 const r0=G?G.rngS:null;
 if(G){sRotor('heli');sRotor('chinook');}
 ok('T80.B selecting an aircraft consumes no srand()', !G || G.rngS===r0);
}

/* ---------- C: nothing is drawn off the board ---------- */
{
 section('T80.C art stays on the board');
 /* The garden hose was the case the owner saw: its wave was centred on a fixed
    y of 6 while its amplitude rolls to 16, so a third of every backyard's hose
    was laid out in the void past the north rim - 162 off-board props over 40
    seeds, the loudest single count in the audit. */
 let offP=[],offD=[],offL=[],offR=[];
 for(const [k,s,M] of maps103()){
  for(const p of M.props){
   if(p.x<0||p.y<0||p.x>=M.N||p.y>=M.N)offP.push(k+'/'+s+': '+p.t);
   /* a LINE prop is drawn len*sc tiles from its origin, and the pick only ever
      tested the origin - the garden hose's defect one layer down, and it put
      pencils out past the Desk's rim. inB is symmetric about the centre, so the
      mirror's far end is the point mirror of this one and one test covers both. */
   if(!p.len)continue;
   const L=p.len*(p.sc||1),ex=p.x+dcos(p.ang)*L,ey=p.y+dsin(p.ang)*L;
   if(ex<0||ey<0||ex>=M.N||ey>=M.N)offL.push(k+'/'+s+': '+p.t+' ends at '+ex.toFixed(1)+','+ey.toFixed(1));
  }
  for(const d of M.deco)if(d.x<0||d.y<0||d.x>=M.N||d.y>=M.N)offD.push(k+'/'+s+': '+d.t);
  /* the flat regions were sized off N and positioned off N independently, so the
     widest roll hung a tile or two past the east and south rims. reg() clamps. */
  const R=[].concat(M.patches||[],M.board?[M.board]:[],M.sandPatch?[M.sandPatch]:[],
                    M.rug?[M.rug]:[],M.blanket?[M.blanket]:[]);
  for(const r of R)if(r.x<0||r.y<0||r.x+r.w>M.N||r.y+r.h>M.N)offR.push(k+'/'+s+': '+r.w.toFixed(1)+'x'+r.h.toFixed(1)+' at '+r.x.toFixed(1)+','+r.y.toFixed(1));
 }
 ok('T80.C no prop is placed outside the board'+(offP.length?' ['+offP.slice(0,3).join('; ')+']':''), offP.length===0);
 ok('T80.C no line prop is DRAWN off the board either'+(offL.length?' ['+offL.slice(0,3).join('; ')+']':''), offL.length===0);
 ok('T80.C no decoration is placed outside the board'+(offD.length?' ['+offD.slice(0,3).join('; ')+']':''), offD.length===0);
 ok('T80.C no flat ground region hangs over the rim'+(offR.length?' ['+offR.slice(0,3).join('; ')+']':''), offR.length===0);
 /* the hose specifically: its trough must clear the edge for EVERY amplitude the
    roll can produce, which is a claim about the centring and not about a seed. */
 let hoseLow=1e9,hoseHigh=-1e9,seen=0;
 for(let s=0;s<24;s++){const M=makeMap('backyard',900000+s*613);
  for(const p of M.props)if(p.t==='hose'){seen++;hoseLow=Math.min(hoseLow,p.y);hoseHigh=Math.max(hoseHigh,p.y);}}
 ok('T80.C the hose is still laid across the lawn ('+seen+' segments over 24 seeds)', seen>300);
 ok('T80.C ...and every segment sits inside the board [y '+hoseLow.toFixed(1)+'..'+hoseHigh.toFixed(1)+']',
    hoseLow>=2 && hoseHigh<=62);
}

/* ---------- D: blocking art never stands inside an impassable spill ---------- */
{
 section('T80.D no blocking prop drowned inside a liquid hazard');
 /* "completely inside" is the test literally: every tile the prop took is a tile
    the liquid took too. That is also why the removal hands nothing back - the
    v67 lesson (dropping the OBJECT must never leave its tiles behind) is
    satisfied for free, because the liquid owns every one of them. */
 let drowned=[],lost=[];
 for(const [k,s,M] of maps103()){
  for(const p of M.props){
   if(p.len)continue;                       // a capsule with one end in a spill is not "inside" it
   if(ANCHOR103[p.t])continue;              // the map's centrepiece, exempt by design - see below
   const ts=ptiles103(M,p);
   if(ts.length&&ts.every(i=>M.fld[i]===3))drowned.push(k+'/'+s+': '+p.t);
  }
  /* THE SYMMETRY CLAIM, and it is measured as PARITY. Every type below is laid
     as a point-symmetric pair, so an odd count of one on a finished board means
     exactly one half of some pair went missing - which is one army holding cover
     the other does not, a balance change smuggled in as a cosmetic fix. Drop the
     mirror clause from the drowning pass and this goes from 0 to 48 over these
     boards; leave the terracotta pots at their old hard-coded corners and it goes
     to 45 on the backyard alone. Both were measured, both are fixed. */
  for(const t of PAIRED103){const n=M.props.filter(p=>p.t===t).length;
   if(n%2)lost.push(k+'/'+s+': '+t+'='+n);}
 }
 ok('T80.D no disc-blocking prop is completely under an impassable liquid'+(drowned.length?' ['+drowned.slice(0,3).join('; ')+']':''),
    drowned.length===0);
 ok('T80.D every mirrored prop type survives in PAIRS, so the two sides match'+(lost.length?' ['+lost.slice(0,3).join('; ')+']':''),
    lost.length===0);
 /* and the exemption above is a real one, not a hole: every map still HAS the
    prop it is built around, on every board. This is the check that would have
    caught the regression the exemption exists for - the Sandbox lost its
    sandcastle on 9 seeds in 40 the first time the drowning pass ran without it. */
 let noAnchor=[];
 for(const [k,s,M] of maps103()){
  const want=k==='sandbox'?'keep':k==='kitchen'?'bowl':k==='livingroom'?'table':null;
  if(want&&!M.props.some(p=>p.t===want))noAnchor.push(k+'/'+s+' lost its '+want);
 }
 ok('T80.D every map still has the prop it is built around'+(noAnchor.length?' ['+noAnchor.slice(0,3).join('; ')+']':''),
    noAnchor.length===0);
 /* THE FEATURE FLOOR. Every guard added this release can only ever REMOVE, and
    v25.1 and v66 both record a stricter pick quietly eating a map's props. These
    are the LOWEST counts measured after the release over 100 boards per map,
    minus a margin - a future guard that starts costing a map its furniture fails
    here first. They are low numbers on purpose: prop counts on one seed swing by
    a factor of two, so a floor tight enough to catch a 5% regression would fire
    on an ordinary board instead. What this catches is a pass that starts eating
    whole categories, which is the failure v25.1 and v66 both record. */
 const FLOOR={backyard:34,kitchen:16,sandbox:21,livingroom:30,desk:19};
 let thin=[];
 for(const [k,s,M] of maps103()){if(M.props.length<FLOOR[k])thin.push(k+'/'+s+': '+M.props.length+' < '+FLOOR[k]);}
 ok('T80.D every map still carries its props'+(thin.length?' ['+thin.slice(0,3).join('; ')+']':''), thin.length===0);
 let noHaz=[];
 for(const [k,s,M] of maps103())if(M.fields.length<4)noHaz.push(k+'/'+s+': '+M.fields.length);
 ok('T80.D ...and its hazards'+(noHaz.length?' ['+noHaz.slice(0,3).join('; ')+']':''), noHaz.length===0);
}

/* ---------- E: ground cover the finished board contradicts ---------- */
{
 section('T80.E ground cover is pruned against the finished board');
 let onLiq=0,onBlk=0,tot=0;
 for(const [k,s,M] of maps103()){
  for(const d of M.deco){tot++;const i=Math.floor(d.y)*M.N+Math.floor(d.x);
   if(M.fld[i]===3)onLiq++;else if(!M.pass[i])onBlk++;}
 }
 ok('T80.E there is still plenty of ground cover ('+tot+' decorations)', tot>2800);
 ok('T80.E none of it floats on an impassable liquid ('+onLiq+')', onLiq===0);
 ok('T80.E none of it hides under a blocker ('+onBlk+')', onBlk===0);
 /* The prune runs LAST, after sealPockets, because only then are pass and fld
    final - and it is allowed to exist at all only because a decoration is ART.
    If a decoration ever became sim state this check is the one that should
    stop the release. */
 ok('T80.E a decoration is art: deco is in neither hashState nor the save',
    !SRC103 || (nocmt103(hashState).indexOf('deco')<0 && nocmt103(saveState).indexOf('deco')<0));
 G=null;newGame({map:'livingroom',mode:'dm',diff:'normal',fac:'tan',opp:1,seed:1030501});
 const h0=hashState();const kept=G.map.deco.length;
 G.map.deco.length=0;
 ok('T80.E ...and dropping every decoration moves no hash', hashState()===h0 && kept>0);
}

/* ---------- F: art overlapping art ---------- */
{
 section('T80.F big art no longer drawn through other art');
 /* propArtR is the release's one new derivation and the whole point of it is
    that it is NOT a second measurement: PROP_BLK's header says every entry is
    0.85x the sprite radius the type was baked at, so the art reads back out of
    the collision table and the two can never drift. */
 ok('T80.F propArtR inverts PROP_BLK rather than restating it',
    Math.abs(propArtR('couch',1.7)-PROP_BLK.couch/PROP_ART_K)<1e-9 &&
    Math.abs(propArtR('shelf',1.3)-PROP_BLK.shelf/PROP_ART_K)<1e-9);
 ok('T80.F a 0 entry means "about a unit\'s own radius", not "no art"',
    propArtR('marble',0)===PROP_ART_MIN && PROP_ART_MIN>0);
 ok('T80.F art is always at least as wide as the collision it was derived from',
    Object.keys(PROP_BLK).every(t=>propArtR(t,1)>=propBlkR(t,1)-1e-9));
 ok('T80.F ...and it scales with the prop, like the collision does',
    Math.abs(propArtR('books',2.25,1.5)-propArtR('books',2.25)*1.5)<1e-9);

 /* the owner's example: a neutral barricade standing inside a bookshelf. The
    barricade pass has always refused a BLOCKED tile, and a bookshelf is drawn
    wider than it blocks - which is the whole gap. 65 of 40 Living Room seeds. */
 let inArt=[];
 for(const [k,s,M] of maps103()){
  for(const p of M.props){const r=propArtR(p.t,p.r,p.sc);if(r<=0||p.len)continue;
   for(const b of M.barricades)if(dhyp(b.x+.5-p.x,b.y+.5-p.y)<r)inArt.push(k+'/'+s+': '+p.t);}
 }
 ok('T80.F no neutral barricade stands inside a prop\'s art'+(inArt.length?' ['+inArt.slice(0,3).join('; ')+']':''), inArt.length===0);
 let barr=0;for(const [k,s,M] of maps103())barr+=M.barricades.length;
 ok('T80.F ...and the barricade clusters are still there ('+barr+' tiles)', barr>500);

 /* and the paired passes keep their own art clear of art already standing. The
    residual measured over 200 generations is a handful of decor-sized grazes
    (a marble against a rock), so the bound is on the BIG art. */
 let heavy=[];
 for(const [k,s,M] of maps103()){
  const bp=M.props.filter(p=>!p.len&&propArtR(p.t,p.r,p.sc)>=0.8);
  for(let i=0;i<bp.length;i++)for(let j=i+1;j<bp.length;j++){
   const a=bp[i],b=bp[j];
   if(a.t===b.t&&(a.t==='hose'||a.t==='wall'||a.t==='traincar'))continue;  // drawn chains, by design
   const sum=propArtR(a.t,a.r,a.sc)+propArtR(b.t,b.r,b.sc);
   if(dhyp(a.x-b.x,a.y-b.y)<sum*0.8)heavy.push(k+'/'+s+': '+a.t+' & '+b.t);
  }
 }
 ok('T80.F no two pieces of large art are drawn through each other'+(heavy.length?' ['+heavy.slice(0,3).join('; ')+']':''), heavy.length===0);

 /* the flat ground regions are the same defect one layer down: a chopping board,
    a sheet of paper, a mouse pad, a raked sand patch, a mulch patch and a picnic
    blanket, each dropped at a raw random rectangle. The fix is ordering as much
    as it is retrying - a hard-coded rectangle rolls nothing, so declaring the
    fixed ones FIRST costs no draw and is what gives the roll something to avoid. */
 let regs=[];
 for(const [k,s,M] of maps103()){
  const R=[].concat(M.patches||[],M.board?[M.board]:[],M.sandPatch?[M.sandPatch]:[],
                    M.rug?[M.rug]:[],M.blanket?[M.blanket]:[]);
  for(let i=0;i<R.length;i++)for(let j=i+1;j<R.length;j++){const a=R[i],b=R[j];
   if(a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h)regs.push(k+'/'+s);}
 }
 ok('T80.F no two flat ground regions are painted over each other'+(regs.length?' ['+regs.slice(0,3).join('; ')+']':''), regs.length===0);
 let noReg=[];
 for(const [k,s,M] of maps103()){
  if(k==='backyard'&&!M.sandPatch)noReg.push(k+'/'+s+' lost its raked sand');
  if(k==='kitchen'&&!M.board)noReg.push(k+'/'+s+' lost its chopping board');
  if(k==='livingroom'&&!M.rug)noReg.push(k+'/'+s+' lost its rug');
  if(k!=='livingroom'&&(M.patches||[]).length<1)noReg.push(k+'/'+s+' lost its patches');
 }
 ok('T80.F ...and every map still has the regions it is dressed with'+(noReg.length?' ['+noReg.slice(0,3).join('; ')+']':''), noReg.length===0);
}

/* ---------- G: hazards of different kinds ---------- */
{
 section('T80.G hazards of different kinds stop clipping through each other');
 /* Same-kind lobes are DELIBERATE - the per-map clusters are built out of them,
    and that is what makes a spill read as a spill rather than an ellipse. Two
    KINDS crossing is the defect: a milk spill with a grease slick drawn through
    it. Measured before: 27/27/31 seeds of 40 on kitchen, sandbox and living
    room. The bound below is what the release actually achieves. */
 let worst=0,worstAt='',total=0;
 for(const [k,s,M] of maps103()){
  const own=new Int16Array(M.N*M.N).fill(-1);let clip=0;
  M.fields.forEach((f,fi)=>{const ext=Math.max(f.rx,f.ry)*1.4;
   for(let y=Math.max(0,Math.floor(f.cy-ext));y<=Math.min(M.N-1,f.cy+ext);y++)
   for(let x=Math.max(0,Math.floor(f.cx-ext));x<=Math.min(M.N-1,f.cx+ext);x++){
    if(!fcovers103(f,x,y))continue;
    const i=y*M.N+x;
    if(own[i]>=0&&M.fields[own[i]].kind!==f.kind)clip++;else own[i]=fi;}});
  total+=clip;if(clip>worst){worst=clip;worstAt=k+'/'+s}
 }
 ok('T80.G no board has two hazard KINDS sharing more than a rim ('+worst+' tiles, worst '+worstAt+')', worst<=10);
 ok('T80.G ...and across all '+(KEYS103.length*SEEDS103.length)+' boards it stays a rounding error ('+total+' tiles)', total<=24);
 /* KEEP is the other half: ground no hazard may be laid over at all. The Sandbox's
    bucket fortress rings the middle at radius 8.6 and the quicksand annulus starts
    at 8, so the pits swallowed 104 of the castle's own wall and tower props over
    40 seeds. It rides inside fldGap, so every pick that scores gets it free. */
 let buried=0,castle=0;
 for(const [k,s,M] of maps103()){
  if(k!=='sandbox')continue;
  for(const p of M.props){
   if(p.t!=='wall'&&p.t!=='tower')continue;castle++;
   const i=Math.floor(p.y)*M.N+Math.floor(p.x);
   if(M.fld[i])buried++;
  }
 }
 ok('T80.G the bucket fortress is still built ('+castle+' walls and towers)', castle>120);
 ok('T80.G ...and almost none of it stands in a quicksand pit ('+buried+' of '+castle+')', buried*10<castle);
 ok('T80.G FLD_GAP is the one number every hazard pick reads', FLD_GAP>1 && FLD_GAP<1.5);
 /* the mechanism, not the outcome: fldGap returns a MARGIN, which is what lets a
    pass that cannot find a clear spot take the least bad roll it saw instead of
    its last roll blind. A boolean-only guard measured two thirds of this. */
 ok('T80.G three passes score their ladder rather than giving up: the lane blob,\n   the edge blob, and fieldPairs when its widening ladder finds nothing',
    !SRC103 || (/fldGap\(/.test(SRC103) && (SRC103.match(/if\(g>bg\)\{bg=g;best=q\}/g)||[]).length===3));
}

/* ---------- H: the living room's ground cover is dust, not grass ---------- */
{
 section('T80.H the living room scatters dust bunnies, not clumps of grass');
 /* This line has said "dust-bunny" since v25 and has been scattering 'tuft' -
    the backyard's clump of bright green grass blades - across a carpet the whole
    time. The owner named it by sight. */
 let carpetTufts=0,carpetDust=0,lawnTufts=0;
 for(const [k,s,M] of maps103()){
  for(const d of M.deco){
   if(k==='livingroom'&&d.t==='tuft')carpetTufts++;
   if(k==='livingroom'&&d.t==='dust')carpetDust++;
   if(k==='backyard'&&d.t==='tuft')lawnTufts++;
  }
 }
 ok('T80.H there is no grass on the carpet ('+carpetTufts+')', carpetTufts===0);
 ok('T80.H the carpet has its dust instead ('+carpetDust+' over '+SEEDS103.length+' seeds)', carpetDust>200);
 ok('T80.H the backyard still has its lawn ('+lawnTufts+')', lawnTufts>500);
 ok('T80.H the dust bunny has a painter of its own, beside the tuft it replaced',
    !SRC103 || (/d\.t==='dust'/.test(SRC103) && /d\.t==='tuft'/.test(SRC103)));
}

/* ---------- I: the ground-banding passes sweep the board ---------- */
{
 section('T80.I the mowed stripes, the carpet banding and the tile gloss sweep the whole board');
 /* THE DEFECT THE OWNER CALLED "off color tiles on 1 side", and it cannot be
    asserted in pixels here - the headless shim has no canvas that paints. What
    CAN be asserted is the geometry, and it is the geometry that was wrong: a
    band anchored at isoX(i,0) runs N tiles along +x and is only three tiles deep
    in y, so every band lands in the same strip at one edge. Anchored at
    isoX(0,i) it runs the board's full width at depth i, which is what a stripe
    is. The picture was read in Chromium; this pins the line that draws it. */
 ok('T80.I every banding pass is anchored on the (0,i) axis, not (i,0)',
    !SRC103 || ((SRC103.match(/const sx=isoX\(0,i\),sy=isoY\(0,i\)/g)||[]).length===3 &&
                !/const sx=isoX\(i,0\),sy=isoY\(i,0\)/.test(SRC103)));
 ok('T80.I the grass alternation counts BANDS, not tiles - the loop steps 3',
    !SRC103 || /\(\(i\/3\)\|0\)%2\?'#ffffff'/.test(SRC103));
 ok('T80.I the tile gloss is a sweep across the board, not a 30px sliver',
    !SRC103 || SRC103.indexOf('c.lineTo(sx+HW*8,sy+HH*8);c.lineTo(sx+HW*8-30')<0);
}

/* ---------- J: what this release did NOT touch ---------- */
{
 section('T80.J the sim, the seeded stream and the save are untouched');
 /* makeMap runs on the MAP's own mulberry stream, not on srand(), so a map that
    generates differently must still leave the shared seeded stream where it
    found it - otherwise every seeded match in the game shifts under it. */
 G=null;newGame({map:'kitchen',mode:'dm',diff:'normal',fac:'green',opp:1,seed:1031001});
 const r0=G.rngS;
 makeMap('sandbox',424243);makeMap('livingroom',777001);
 ok('T80.J generating a map consumes nothing from the shared seeded stream', G.rngS===r0);
 ok('T80.J every map still generates a connected, playable board',
    KEYS103.every(k=>{const M=makeMap(k,606061);
     let free=0;for(let i=0;i<M.pass.length;i++)if(M.pass[i])free++;
     /* the Desk lays no PvP economy here at all - survivalSetup carves its own
        arena and its own nodes - so it is the one map with an empty node list. */
     return free>M.N*M.N*0.4 && M.starts.length===4 && (k==='desk'||M.nodes.length>0)}));
 /* no unit, price or building moved this release - the barrage's cadence is the
    only simulated number in it, and the rotor is audio. */
 ok('T80.J no unit or building price moved',
    U.grunt.cp===36 && U.tank.cp===220 && B.barracks.cp===160 && B.hbarricade.cp===40);
 ok('T80.J the hazard scale is where v67 left it - this release moved WHERE a\n   hazard goes, never how big it is', HAZ_SC===0.80);
}
