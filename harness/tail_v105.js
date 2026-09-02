/* tail_v105.js - T86: the whole roster parades, and the Field Manual is painted
   on the same parade ground.

   Two owner asks, one release.

   1. "the unit parade should include all units from the game, and the density
      should be higher". Both halves are MENUBG_LANES. The roster half is
      checked DERIVED off U rather than transcribed - every row of U marches,
      exactly once, so a 27th unit fails this file until somebody puts it in a
      lane. The density half is 17 marchers -> 41, plus the change that does
      most of the work: `off` is a fraction of the wrap span, so the men are
      dealt evenly across the window instead of bunching into the first
      1,500px of it and leaving a wide window half empty.

   2. "the Field Manual should have the same background as the menu screen".
      The parade canvas paints while the manual is open, the manual's panel
      went translucent, and the canvas CLIMBS to z-index 39 while it is
      serving the manual. That last part is the whole trick and the easy thing
      to get wrong: at its usual z-index 1 the parade sits under #setup (30)
      and under the in-match HUD (10), so a translucent manual would have read
      the menu's own cards - or the live HUD - and not the parade at all.

   Nothing here is simulated: triage said "the simulation did NOT move" on the
   first run and no repin was due. The checks that matter to the sim are still
   v58's (G untouched, SPR untouched, trails unmoved); this file is about what
   is on screen, which is also why it ends with a note about rule 7. */

function nocmt105(fn){return String(fn).replace(/\/\*[\s\S]*?\*\//g,' ').replace(/(^|[^:])\/\/[^\n]*/g,'$1')}
let HTML105=null;
try{HTML105=require('fs').readFileSync('pw.html','utf8')}catch(e){HTML105=null}
const CSS105=HTML105?HTML105.slice(0,HTML105.indexOf('</style>')):'';
const rule105=sel=>{
 const m=new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\{[^}]*\\}').exec(CSS105);
 return m?m[0]:'';
};
const zOf105=sel=>{const m=/z-index:(\d+)/.exec(rule105(sel));return m?parseInt(m[1],10):-1};

/* the deferred bake: at page load menubgBake rides requestIdleCallback, which
   the shim does not run, so a segment that does not contain tail_v58 arrives
   here with an empty column. It is idempotent and this is the same call the
   idle callback makes. */
menubgBake();

section('T86.A v105: every unit in the game is on the parade ground');
{
 /* DERIVED, not transcribed: the question "is the whole roster marching" is
    one U already answers. A new unit row fails here - which is the point, and
    the same conscious-edit rule T71.A applies to the texture roster. */
 const laneKeys=[];
 for(const L of MENUBG_LANES)for(const k of L.roster)laneKeys.push(k);
 const missing=Object.keys(U).filter(k=>laneKeys.indexOf(k)<0);
 const dupes=laneKeys.filter((k,i)=>laneKeys.indexOf(k)!==i);
 ok('T86.A every row of U marches ('+laneKeys.length+' of '+Object.keys(U).length+')'+
    (missing.length?' :: missing '+missing.join(','):''), missing.length===0);
 ok('T86.A ...and none of them marches twice'+(dupes.length?' :: '+dupes.join(','):''),
    dupes.length===0);
 ok('T86.A ...which includes the two that are never bought - the Paratrooper and the Balloon',
    laneKeys.indexOf('para')>=0 && laneKeys.indexOf('balloon')>=0);

 /* a roll of n keys from a roster of n leaves one out about a third of the
    time, so the lane deals them round-robin and every lane is at least as
    long as its roster. Both halves are checked: the rule, and the result. */
 const short=MENUBG_LANES.filter(L=>L.n<L.roster.length).map(L=>L.fac+':'+L.n);
 ok('T86.A no lane is shorter than its own roster'+(short.length?' :: '+short.join(','):''),
    short.length===0);
 const onField=new Set();
 for(const L of MENUBG.lanes)for(const m of L.men)onField.add(m.key);
 ok('T86.A ...so every unit is actually IN the laid-out column, not merely listed ('+onField.size+')',
    onField.size===Object.keys(U).length);
}

section('T86.B v105: one army each, and the exclusives keep their own');
{
 /* The lane table says which army a SHARED unit wears. An exclusive's army is
    not the lane's to decide, and menubgFacOf does not decide it either - it
    defers to the manual's infoFacOf, which reads FAC. So there is no second
    ownership list to fall out of step with the first. */
 const owner={};
 for(const f of Object.keys(FAC)) for(const u of (FAC[f].uu||[])) owner[u]=f;
 const wrong=[];
 for(const L of MENUBG.lanes)for(const m of L.men){
  const want=owner[m.key]||MENUBG_LANES[MENUBG.lanes.indexOf(L)].fac;
  if(m.fac!==want)wrong.push(m.key+'@'+m.fac+' want '+want);
 }
 ok('T86.B every marcher wears the right army'+(wrong.length?' :: '+wrong.join('; '):''),
    wrong.length===0);
 ok('T86.B menubgFacOf defers to the Field Manual rather than to the lane',
    menubgFacOf('sniper','blue')==='gray' && menubgFacOf('chinook','tan')==='blue' &&
    menubgFacOf('grunt','tan')==='tan' && menubgFacOf('grunt','gray')==='gray');

 /* the cache is the reason the roster could more than double in kinds and grow
    by ten cells: nothing is baked in two armies. v58 pins the total; this pins
    the shape that keeps the total small. */
 const twice=[];
 for(const kind of ['inf','veh'])
  for(const k in MENUBG.cells[kind])
   if(Object.keys(MENUBG.cells[kind][k]).length>1)twice.push(k);
 ok('T86.B no unit is baked in two armies'+(twice.length?' :: '+twice.join(','):''),
    twice.length===0);
 ok('T86.B ...and every marcher has the cell it needs',
    MENUBG.lanes.every(L=>L.men.every(m=>m.t.a==='inf'
     ? !!(MENUBG.cells.inf[m.key]&&MENUBG.cells.inf[m.key][m.fac])
     : !!(MENUBG.cells.veh[m.key]&&MENUBG.cells.veh[m.key][m.fac]))));
}

section('T86.C v105: the density half of the ask');
{
 const men=MENUBG.lanes.reduce((a,L)=>a+L.men.length,0);
 ok('T86.C the parade is denser than the v58 one it replaces ('+men+' against 17)', men>17*2);

 /* offsets are FRACTIONS of the wrap span now. The old pixel gap (200-290px
    per man) meant a 2,600px window had its whole back half empty however many
    men were in the lane, which is the thing the owner was actually seeing. */
 const bad=[];
 for(const L of MENUBG.lanes)for(const m of L.men)if(!(m.off>=0&&m.off<1))bad.push(m.key+':'+m.off);
 ok('T86.C every offset is a 0..1 fraction of the span'+(bad.length?' :: '+bad.join(','):''),
    bad.length===0);

 /* the density claim itself, measured the way the frame lays them out: at any
    window width no lane may leave a gap bigger than two even slots. */
 const worst={w:0,gap:0,fac:''};
 for(const W of [900,1500,2600,3800]){
  const span=W+700;
  for(let i=0;i<MENUBG.lanes.length;i++){
   const L=MENUBG.lanes[i];
   const xs=L.men.map(m=>m.off*span).sort((a,b)=>a-b);
   let g=xs[0]+(span-xs[xs.length-1]);           // the wrap gap
   for(let j=1;j<xs.length;j++)g=Math.max(g,xs[j]-xs[j-1]);
   const slot=span/L.men.length;
   if(g/slot>worst.gap){worst.gap=g/slot;worst.w=W;worst.fac=MENUBG_LANES[i].fac}
  }
 }
 ok('T86.C ...so no lane leaves a hole wider than two slots at any window '+
    '(worst '+worst.gap.toFixed(2)+' slots, '+worst.fac+' at '+worst.w+'px)', worst.gap<2);
}

section('T86.D v105: the six things that fly do not march on the floor');
{
 /* derived off t.fly, so an aircraft added to U and dropped into a walking
    lane fails here rather than moonwalking across the menu. */
 const flight=MENUBG_LANES[0];
 const flyKeys=Object.keys(U).filter(k=>U[k].fly);
 ok('T86.D lane 1 is exactly the flyers ('+flight.roster.join(' ')+')',
    flyKeys.length===flight.roster.length && flyKeys.every(k=>flight.roster.indexOf(k)>=0));
 const grounded=[];
 for(let i=1;i<MENUBG_LANES.length;i++)
  for(const k of MENUBG_LANES[i].roster)if(U[k].fly)grounded.push(k);
 ok('T86.D ...and nothing that flies is in a walking lane'+(grounded.length?' :: '+grounded.join(','):''),
    grounded.length===0);

 /* FUNCTIONAL, through a recording context: this release's drawing claims
    cannot fail seg.sh by looking wrong (rule 7), but they CAN be read off the
    calls the painter makes. */
 const rec105=()=>{
  const log=[],store={};
  const c=new Proxy(store,{get(t,k){
   if(k==='canvas')return {width:64,height:64};
   if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>({addColorStop(){}});
   if(k==='createPattern')return ()=>({});
   if(k==='getLineDash')return ()=>[];
   if(k==='measureText')return ()=>({width:6});
   if(k==='getTransform')return ()=>({a:1,b:0,c:0,d:1,e:0,f:0});
   if(k in t)return t[k];
   return function(){log.push([k].concat([].slice.call(arguments)))};
  },set(t,k,v){t[k]=v;return true}});
  return {c:c,log:log};
 };
 const paint105=key=>{
  let man=null;
  for(const L of MENUBG.lanes)for(const m of L.men)if(m.key===key&&!man)man=m;
  const r=rec105();
  infoStub(()=>{INFO.stub.tick=0;INFO.stub.orgX=0;menubgPaint(r.c,man,12)});
  return r.log;
 };
 /* only the translates at depth 0 count: offsetSil and contactShadow do their
    own translating inside a save/restore, and a naive sum reads a ground
    vehicle's shadow offset as a lift. */
 const lift=log=>{let y=0,d=0;for(const e of log){
  if(e[0]==='save')d++;else if(e[0]==='restore')d--;
  else if(e[0]==='translate'&&d===0)y+=(e[2]||0);}
  return y};
 const has=(log,fn)=>log.some(e=>e[0]===fn);

 const heliLog=paint105('heli'),tankLog=paint105('tank'),ballLog=paint105('balloon');
 ok('T86.D a flyer is lifted off the ground, the same 34px drawUnit lifts one (got '+lift(heliLog).toFixed(1)+')',
    lift(heliLog)<-30 && lift(heliLog)>-38);
 ok('T86.D ...and a ground vehicle is not (got '+lift(tankLog).toFixed(1)+')', lift(tankLog)===0);
 ok('T86.D the balloon is NOT turned to face anywhere - it is a gas envelope (v86)',
    !has(ballLog,'rotate') && has(tankLog,'rotate'));
 ok('T86.D a helicopter turns its blades', has(heliLog,'stroke'));
 ok('T86.D ...through the match\'s own rotor, not a second copy of it',
    typeof heliRotor==='function' &&
    nocmt105(drawUnit).indexOf('heliRotor(')>0 &&
    nocmt105(menubgPaint).indexOf('heliRotor(')>0);
 /* the spin is DERIVED from the menu clock rather than accumulated on the fake
    unit, so the reduced-motion path (which freezes that clock) freezes the
    rotor with it instead of leaving one thing turning on a still picture. */
 const still=[];
 for(const L of MENUBG.lanes)for(const m of L.men)if(m.u.rot!==0)still.push(m.key);
 ok('T86.D ...and it never writes back to the marcher'+(still.length?' :: '+still.join(','):''),
    still.length===0);
 ok('T86.D painting the whole parade throws nothing', (()=>{
   let threw=null;
   const r=rec105();
   try{infoStub(()=>{INFO.stub.tick=0;INFO.stub.orgX=0;
    for(const L of MENUBG.lanes)for(const m of L.men)menubgPaint(r.c,m,7)})}catch(e){threw=e}
   return !threw;
  })());
}

section('T86.E v105: the Field Manual is painted on the parade ground');
{
 const setup=document.getElementById('setup'),panel=document.getElementById('infoPanel');
 const wasSetup=setup.style.display,wasOpen=panel.classList.contains('open');
 const wasG=G;

 setup.style.display='none';panel.classList.remove('open');
 menubgFrame(50000);
 ok('T86.E with neither screen up the backdrop is still inert',
    MENUBG.cv.style.display==='none' && menubgOn()===0);

 setup.style.display='flex';
 menubgFrame(50020);
 ok('T86.E the menu still gets it, at its own depth',
    MENUBG.cv.style.display==='block' && !MENUBG.cv.classList.contains('front'));

 panel.classList.add('open');
 menubgFrame(50040);
 ok('T86.E the manual gets the same parade', MENUBG.cv.style.display==='block' && menubgOn()===2);
 ok('T86.E ...and the canvas climbs above the screen it was opened from',
    MENUBG.cv.classList.contains('front'));

 /* opened from the HUD mid-match it is the same path, and the parade must not
    be able to disturb the match it is covering. */
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:105105});
 for(let i=0;i<20;i++)update(1/30);
 const before=hashState(),gRef=G;
 setup.style.display='none';
 let threw=null;
 try{for(let i=0;i<10;i++)menubgFrame(51000+i*16.7)}catch(e){threw=e}
 ok('T86.E it paints behind a manual opened MID-MATCH'+(threw?' :: '+threw.message:''),
    !threw && MENUBG.cv.style.display==='block' && MENUBG.cv.classList.contains('front'));
 ok('T86.E ...leaving the match exactly as it found it', G===gRef && hashState()===before);

 panel.classList.remove('open');
 menubgFrame(52000);
 ok('T86.E closing the manual hides the parade and drops it back down',
    MENUBG.cv.style.display==='none' && !MENUBG.cv.classList.contains('front'));

 G=null;setup.style.display=wasSetup;if(wasOpen)panel.classList.add('open');
 G=wasG;
}

section('T86.F v105: the stacking order, read off the stylesheet');
{
 /* SCRAPED rather than transcribed, on T65.B's precedent: the numbers that
    have to agree are all in the sheet, so the check reads them from it. The
    claim is an ORDER, and it is the whole reason the .front class exists. */
 if(HTML105){
  const hud=zOf105('#hud'),setupZ=zOf105('#setup'),front=zOf105('#menuBg.front'),
        info=zOf105('#infoPanel'),base=zOf105('#menuBg');
  ok('T86.F the sheet still declares all five depths ('+[base,hud,setupZ,front,info].join('/')+')',
     [base,hud,setupZ,front,info].every(z=>z>0));
  ok('T86.F a backdrop is a backdrop: at rest it is under the menu and under the HUD',
     base<hud && base<setupZ);
  ok('T86.F serving the manual it is above BOTH of them...', front>setupZ && front>hud);
  ok('T86.F ...and still under the manual itself', front<info);

  const ip=rule105('#infoPanel');
  const stops=ip.match(/rgba?\([^)]*\)/g)||[];
  const alphas=stops.map(s=>{const p=s.split(',');return s.indexOf('rgba')===0?parseFloat(p[3]):1});
  ok('T86.F the manual\'s panel is translucent, so the parade reads through it ('+alphas.join(',')+')',
     alphas.length>=3 && alphas.every(a=>a<1));
  ok('T86.F ...but not so thin that the page stops being readable', alphas.every(a=>a>=.5));
  ok('T86.F the two text-heaviest regions carry a wash of their own',
     /background:rgba/.test(rule105('#infoControls')) && /background:rgba/.test(rule105('#infoStats')));
  ok('T86.F the manual is still the top layer of the two',
     info>front);
 } else {
  ok('T86.F stylesheet unavailable in this run - skipped', true);
 }
}

/* RULE 7, and it is the whole of this release: a drawing bug cannot fail
   seg.sh. Everything above reads calls, tables and stylesheet numbers. The
   parade and the manual were both READ as real Chromium screenshots at
   1600x900 and 1280x720 before this file was written - see the v105 section
   of README.md for what those frames showed and what they changed. */
