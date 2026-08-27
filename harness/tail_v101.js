/* tail_v101.js - T78: the day/night cycle.
   Every match runs a DAY_CYCLE_T-second clock, starts at a random point in it
   (G.dayOff, one srand() draw APPENDED as the last consumer in newGame), and
   flips between the DISCRETE lighting states of DAY_PHASES - no gradient, by
   the owner's design. The one phase that reaches the SIMULATION is night: every
   unit's and structure's vision is cut to NIGHT_VI_MUL through the two doors
   every sim-side vision read already goes through, viOf and the new bviOf.
   Weapon range is deliberately untouched, and so is wildlife: a creature's
   `vi` is an aggro radius, not battlefield vision.

   WHAT THE HEADLESS SUITE CANNOT SEE, stated up front: the tint itself. The
   lighting is one multiply fill over the finished world canvas - the seam both
   compositors consume - and rule 7 applies in full: the phase states were
   checked by LOOKING at real Chromium frames. What this file pins is the
   mechanism: the fill reads DAY_PHASES and never srand, it sits between the
   fog blit and the present, and the sim halves what it claims to halve. */
'use strict';
section('T78 v101: the day/night cycle - discrete light, half vision at night');

const DT101=1/30;
const NIGHT_T0_101=DAY_PHASES.find(p=>p.key==='night').t0;
const cfg101=(seed,fac,extra)=>Object.assign({map:'backyard',mode:'dm',diff:'normal',fac:fac||'green',opp:1,seed},extra||{});
function fresh101(seed,fac,extra){G=null;newGame(cfg101(seed,fac,extra));return G.human}
/* park the clock two seconds into a named phase, whatever G.tick reads */
function setPhase101(key){
 let off=((DAY_PHASES.find(p=>p.key===key).t0+2)*30-G.tick)%(DAY_CYCLE_T*30);
 if(off<0)off+=DAY_CYCLE_T*30;
 G.dayOff=off;
}
function nocmt101(fn){return String(fn).replace(/\/\*[\s\S]*?\*\//g,' ').replace(/(^|[^:])\/\/[^\n]*/g,'$1')}
let HTML101=null;
try{HTML101=require('fs').readFileSync('pw.html','utf8')}catch(e){HTML101=null}
const SCRIPT101=HTML101?HTML101.slice(HTML101.indexOf('<script>'),HTML101.indexOf('</script>')):'';

/* ---------- A: the clock and the table ---------- */
{
 section('T78.A the cycle is 10 minutes of discrete phases, one of them night');
 ok('T78.A the full cycle is 600 sim-seconds - ten minutes', DAY_CYCLE_T===600);
 ok('T78.A the table opens at the top of the cycle', DAY_PHASES[0].t0===0&&DAY_PHASES[0].key==='day');
 ok('T78.A the phases are contiguous and in cycle order',
    DAY_PHASES.every((p,i)=>i===0||p.t0>DAY_PHASES[i-1].t0)&&DAY_PHASES.every(p=>p.t0<DAY_CYCLE_T));
 ok('T78.A it is a HANDFUL of states, which is the owner\'s brief', DAY_PHASES.length>=3&&DAY_PHASES.length<=6);
 ok('T78.A exactly one phase is night', DAY_PHASES.filter(p=>p.ni===1).length===1);
 ok('T78.A night halves the vision - the multiplier is one half', NIGHT_VI_MUL===0.5);
 ok('T78.A daylight is the identity tint, so noon is exactly the pre-v101 frame', DAY_PHASES[0].tintA===0);
 ok('T78.A night is the darkest state in the table',
    DAY_PHASES.every(p=>p.ni===1||p.tintA<DAY_PHASES.find(q=>q.ni===1).tintA));

 fresh101(1010101);
 ok('T78.A a fresh match holds an offset inside the cycle',
    Number.isInteger(G.dayOff)&&G.dayOff>=0&&G.dayOff<DAY_CYCLE_T*30);
 /* the walk: park the clock in each phase and read it back */
 const seen=[];
 for(const p of DAY_PHASES){setPhase101(p.key);seen.push(dayPhase().key)}
 ok('T78.A dayPhase answers every row of its own table', seen.join(',')===DAY_PHASES.map(p=>p.key).join(','));
 /* the flip is at the boundary, not near it */
 G.dayOff=NIGHT_T0_101*30-1-G.tick;
 const before=dayPhase().key;
 G.dayOff+=1;
 ok('T78.A the flip lands exactly on the row\'s t0', before!=='night'&&dayPhase().key==='night');
 /* and the clock wraps: a full cycle later is the same phase */
 const at=dayPhase().key;G.dayOff+=DAY_CYCLE_T*30;
 ok('T78.A the cycle wraps - one full cycle later is the same light', dayPhase().key===at);

 /* THE RANDOM START. Different seeds land at different points; the draw is
    real (harness seeds happen to differ - the claim is the draw exists and is
    the LAST consumer, which the source states below). */
 const offs=new Set();
 for(const s of [1010102,1010103,1010104,1010105])offs.add((fresh101(s),G.dayOff));
 ok('T78.A four seeds land at more than one point in the cycle', offs.size>1);
 if(SCRIPT101){
  const ng=SCRIPT101.indexOf('function newGame(');
  const draw=SCRIPT101.indexOf('G.dayOff=Math.floor(srand()*DAY_CYCLE_T*30)',ng);
  const tower=SCRIPT101.indexOf('placeStartTower',ng);
  const cam=SCRIPT101.indexOf('// camera on human base',ng);
  ok('T78.A the offset is one srand() draw inside newGame', ng>0&&draw>ng);
  ok('T78.A ...APPENDED after the last existing consumer, per the v59 rule',
     draw>tower&&tower>ng&&cam>draw);
 }
}

/* ---------- B: night halves what the sim can SEE ---------- */
{
 section('T78.B at night every unit and structure sees half as far');
 const p=fresh101(1010201);
 const grunt=p.units.find(u=>u.key==='grunt');
 const hq=p.blds.find(b=>b.key==='hq');
 setPhase101('day');
 const dv=viOf(grunt),db=bviOf(hq),dr=rgOf(grunt);
 setPhase101('night');
 ok('T78.B a grunt\'s vision is exactly halved', viOf(grunt)===dv*NIGHT_VI_MUL&&dv>0);
 ok('T78.B the HQ\'s vision is exactly halved', bviOf(hq)===db*NIGHT_VI_MUL&&db>0);
 ok('T78.B ...and bviOf reads the row the fog stamp used to read raw', db===hq.t.vi);
 ok('T78.B weapon RANGE is untouched - night shortens eyes, not guns', rgOf(grunt)===dr&&dr>0);
 /* the best eye in the game halves with everyone else's */
 const bal=makeUnit('balloon',p,hq.tx+3,hq.ty+3);
 setPhase101('day');const bd=viOf(bal);setPhase101('night');
 ok('T78.B the Observation Balloon halves too - no eye is exempt', bd===BALLOON_VI&&viOf(bal)===BALLOON_VI*NIGHT_VI_MUL);
 ok('T78.B dusk and dawn do NOT touch vision - only night does',
    (setPhase101('dusk'),viOf(grunt)===dv)&&(setPhase101('dawn'),viOf(grunt)===dv));

 /* ACQUISITION: an enemy standing between the halved and the full radius is
    found by day and missed by night - the primitive every idle sweep calls. */
 setPhase101('day');
 const foe=G.players[1];
 const eg=makeUnit('grunt',foe,grunt.x+dv-0.7,grunt.y);
 ok('T78.B fixture: the mark stands inside day vision, outside night\'s',
    dhyp(eg.x-grunt.x,eg.y-grunt.y)<dv&&dhyp(eg.x-grunt.x,eg.y-grunt.y)>dv*NIGHT_VI_MUL);
 ok('T78.B by day the sweep finds him', nearestEnemy(grunt,viOf(grunt))===eg);
 setPhase101('night');
 ok('T78.B by night the same sweep comes back empty', nearestEnemy(grunt,viOf(grunt))!==eg);

 /* THE FOG ITSELF: the same board lit at noon and at midnight - the night
    reveal is strictly smaller. */
 const lit=()=>{updateFog();let n=0;for(let i=0;i<G.fog.length;i++)if(G.fog[i]===2)n++;return n};
 setPhase101('day');const litDay=lit();
 setPhase101('night');const litNight=lit();
 ok('T78.B the fog reveal shrinks when night falls', litNight<litDay&&litNight>0);

 /* pVISION, the call-down targeting door: a lone eye in a quiet corner, its
    probe point between the halved and the full radius. The corner is picked
    FARTHEST from the base so no other friendly eye reaches the probe - and the
    fixture asserts that, rather than hoping. */
 const scout=makeUnit('grunt',p,0,0);
 const far=[[8,8],[G.map.N-8,8],[8,G.map.N-8],[G.map.N-8,G.map.N-8]]
  .sort((a,b2)=>(dhyp(b2[0]-hq.x,b2[1]-hq.y))-(dhyp(a[0]-hq.x,a[1]-hq.y)))[0];
 scout.x=far[0];scout.y=far[1];
 const sv=(setPhase101('day'),viOf(scout));
 const px=scout.x+(scout.x<G.map.N/2?1:-1)*(sv-0.7),py=scout.y;
 ok('T78.B fixture: no other friendly eye reaches the probe point',
    p.units.every(u2=>u2===scout||dhyp(u2.x-px,u2.y-py)>viOf(u2)+1)&&
    p.blds.every(b2=>dhyp(b2.x-px,b2.y-py)>bviOf(b2)+b2.sz+1));
 ok('T78.B pVision answers yes at noon', pVision(p,px,py)===true);
 setPhase101('night');
 ok('T78.B ...and no at midnight - call-down targeting shrinks with the eye', pVision(p,px,py)===false);

 /* WILDLIFE IS EXEMPT ON PURPOSE: a creature's vi is an aggro radius, not
    vision - there is no fog for a bug. The sweep it feeds must not read the
    clock. */
 ok('T78.B a creature\'s aggro radius never reads the night',
    nocmt101(nearestIntruder).indexOf('nightVi')<0&&nocmt101(updateNeutrals).indexOf('nightVi')<0);
 ok('T78.B nightVi is a plain multiplier with a zero-stays-zero door', nightVi(0)===0&&(setPhase101('night'),nightVi(8)===4)&&(setPhase101('day'),nightVi(8)===8));
}

/* ---------- C: the offset is sim state on the full contract ---------- */
{
 section('T78.C dayOff is hashed, serialized, defaulted, and pinned in the sandbox');
 fresh101(1010301);
 run(5);
 G.dayOff=4242;
 const h1=hashState(),blob=saveState();
 G.dayOff=4243;
 ok('T78.C two clients disagreeing on the offset disagree in hashState', hashState()!==h1);
 loadState(blob);
 ok('T78.C a snapshot carries it back bit-for-bit', G.dayOff===4242&&hashState()===h1);
 /* a pre-v101 save has no dayOff; zero keeps its clock honest */
 const S=JSON.parse(blob);delete S.dayOff;
 loadState(JSON.stringify(S));
 ok('T78.C a pre-v101 save loads at offset 0 rather than throwing', G.dayOff===0);
 /* SAVE/LOAD ACROSS THE CLOCK: a match cut at night resumes at night */
 fresh101(1010302);
 G.dayOff=(NIGHT_T0_101+5)*30;
 const blob2=saveState();
 ok('T78.C fixture: the cut is taken at night', dayPhase().key==='night');
 G.dayOff=0;
 loadState(blob2);
 ok('T78.C a match saved at night RESUMES at night', dayPhase().key==='night');

 /* THE SANDBOX IS PERMANENT NOON, like its permanent full vision */
 fresh101(1010303,'green',{test:true});
 G.dayOff=(NIGHT_T0_101+5)*30;
 ok('T78.C testing mode pins the clock to day whatever the offset says', dayPhase().key==='day'&&!nightNow());
 const tg=G.human.units.find(u=>u.key==='grunt');
 ok('T78.C ...so sandbox vision is the full daytime figure', viOf(tg)===tg.t.vi);
}

/* ---------- D: the light itself - mechanism checks over the shipped file ---------- */
{
 section('T78.D one multiply fill over the world canvas, from the table, never from srand');
 ok('T78.D pw.html is readable next to the harness', !!HTML101);
 if(SCRIPT101){
  const rc=SCRIPT101.indexOf('function renderCore()');
  const fog=SCRIPT101.indexOf('c.drawImage(G.fogCv,0,0)',rc);
  const tint=SCRIPT101.indexOf("c.globalCompositeOperation='multiply'",rc);
  const present=SCRIPT101.indexOf('if(worldCv&&!glComposite())compositePost()',fog);
  ok('T78.D the tint is drawn inside renderCore', rc>0&&tint>rc);
  ok('T78.D ...AFTER the fog and BEFORE the present, so both compositors inherit it',
     fog>rc&&tint>fog&&present>tint);
  const dpSrc=nocmt101(dayPhase);
  ok('T78.D dayPhase is pure arithmetic off G.tick - no srand, nothing stored',
     dpSrc.indexOf('srand')<0&&dpSrc.indexOf('Math.random')<0);
  const tintLine=SCRIPT101.slice(SCRIPT101.lastIndexOf('\n',tint),SCRIPT101.indexOf('\n',tint));
  ok('T78.D the fill is gated on the phase\'s own tintA, so noon costs nothing',
     /ph101\.tintA>0/.test(SCRIPT101.slice(rc,present))&&/ph101\.tint\b/.test(tintLine+SCRIPT101.slice(tint,tint+200)));
  /* the phase table is the only source of the look - the fill reads no literal colour */
  ok('T78.D the tint colour comes off the DAY_PHASES row, not a second copy',
     /c\.fillStyle=ph101\.tint/.test(SCRIPT101.slice(rc,present)));
  /* the topbar shows the phase and the two flips that matter are announced */
  const tb=SCRIPT101.slice(SCRIPT101.indexOf('function updateTopbar('),SCRIPT101.indexOf('function myHQs('));
  ok('T78.D the top bar prints the phase beside the mode', /ph\.icon\+' '\+ph\.n/.test(tb));
  ok('T78.D night falling and dawn breaking are each announced once',
     /Night falls/.test(tb)&&/Dawn breaks/.test(tb)&&/G\.dayPhaseUI!==ph\.key/.test(tb));
  ok('T78.D ...and the sandbox line stays as it was', /if\(!G\.test\)\{\s*const ph=dayPhase\(\)/.test(tb));
 }
 /* the manual states the two figures off the constants, per rule 3 */
 ok('T78.D the help slots read the constants', HELP_TUNE.cycleMin()===10&&HELP_TUNE.nightViPct()===50);
 if(HTML101){
  ok('T78.D ...and the prose carries both slots',
     HTML101.indexOf('data-tune="cycleMin"')>0&&HTML101.indexOf('data-tune="nightViPct"')>0);
  ok('T78.D the Day & Night entry exists and says what range does NOT do',
     /Day &amp; Night/.test(HTML101)&&/range<\/em> is untouched/.test(HTML101));
 }
}
