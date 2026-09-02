/* tail_v105_1.js - T87: two owner bug reports.

   1. "some of the more recent special structures are locked behind research in
      the Research lab, but don't have a button to research them."

      They were right, and it was worse than a missing button. researchCatalog
      was a FILTER OVER LAB_ORDER, a hand-typed list, so a lab-routed unlock that
      nobody remembered to type there had no button anywhere in the game -
      however correct RESEARCH, TECH_BLD and techAvailable all were about it.

      Audited across all four armies, before the fix:

          army   can research   lab panel offered   unreachable
          green      10                9            b_cmdpost    (v86)
          tan        11               10            b_foundry    (v87)
          gray       11               10            b_hbarricade (v88)
          blue       11               11            none

      i.e. the SECOND exclusive structure of three armies in four. Blue's two are
      there because v85 was the last release that remembered to edit the list.

      AND THE BOTS COULD RESEARCH ALL THREE THE WHOLE TIME. aiResearch builds its
      wishlist off RESEARCH and pushes `FAC[p.fac].ub` before the shared
      structures (step 4 of its plan), so a CPU Green has been putting up Command
      Posts since v86 against a human who could not. A one-sided gap for
      nineteen releases, and no test could see it because every test asked
      RESEARCH or techAvailable, which were both right.

      LAB_ORDER now only ORDERS the catalog. researchCatalog is DERIVED.

   2. "the turrets on tanks aren't showing for the units in the background parade
      on the main menu or the Field Manual."

      A turret is not in the baked hull cell - it is painted live on top, and
      menubgPaint drew the cell and stopped. So every marching Tank, Bull and AA
      Truck was a bare hull, on the menu and (since v105 put the parade behind
      it) in the Field Manual too.

      The fix is the v105 rotor treatment again: vehTurret is lifted out as the
      ONE painter that knows which hull wears a turret, where it sits and how big
      it is, and all four sites go through it - drawUnit's tank branch, its AA
      branch, vehPortraitPaint and now menubgPaint.

   Neither is simulated: triage said "the simulation did NOT move" first time and
   all 30 layout pins held. */

function nocmt105_1(fn){return String(fn).replace(/\/\*[\s\S]*?\*\//g,' ').replace(/(^|[^:])\/\/[^\n]*/g,'$1')}
const FACS105_1=['green','tan','gray','blue'];
function boot105_1(fac,seed){G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:fac,opp:1,seed:seed||105100});return G.human}

section('T87.A v105.1: every lab-routed research this army may take has a button');
{
 /* DERIVED, both sides. "What may this player research at a lab" is a question
    RESEARCH + TECH_BLD + techAvailable already answer; the panel must offer
    exactly that set. A 14th lab building added to B fails here the moment it is
    faction-gated wrong or dropped, rather than shipping invisible. */
 const missing=[],extra=[];
 for(const fac of FACS105_1){
  const p=boot105_1(fac);
  const may=Object.keys(RESEARCH).filter(k=>researchBuilding(k)==='lab'&&techAvailable(p,k));
  const shown=researchCatalog(p);
  for(const k of may)if(shown.indexOf(k)<0)missing.push(fac+':'+k);
  for(const k of shown)if(may.indexOf(k)<0)extra.push(fac+':'+k);
 }
 ok('T87.A no army can be denied a lab tech it is allowed to take'+(missing.length?' :: '+missing.join(', '):''),
    missing.length===0);
 ok('T87.A ...and none is offered one it may not'+(extra.length?' :: '+extra.join(', '):''),
    extra.length===0);

 /* the three the owner actually hit, named because they are the bug report */
 const owner={b_cmdpost:'green',b_foundry:'tan',b_hbarricade:'gray'};
 const wrong=[];
 for(const fac of FACS105_1){
  const cat=researchCatalog(boot105_1(fac));
  for(const k in owner){
   const should=(owner[k]===fac);
   if(cat.indexOf(k)>=0!==should)wrong.push(fac+(should?' lost ':' gained ')+k);
  }
 }
 ok('T87.A the Command Post, Foundry and Heavy Barricade reach their OWN army and no other'
    +(wrong.length?' :: '+wrong.join('; '):''), wrong.length===0);

 /* NON-VACUITY, and it is the whole point of the change: a key LAB_ORDER does
    not name is still offered. Proven by removing one from the list rather than
    by reading the source, then putting it back. */
 {
  const p=boot105_1('green');
  const i=LAB_ORDER.indexOf('b_radar');
  const held=LAB_ORDER.splice(i,1)[0];
  const still=researchCatalog(p).indexOf('b_radar')>=0;
  LAB_ORDER.splice(i,0,held);
  ok('T87.A a lab tech LAB_ORDER forgets is still offered - it orders the catalog, it is not the catalog', still);
  ok('T87.A ...and the list is restored', LAB_ORDER[i]==='b_radar');
 }
}

section('T87.B v105.1: the catalog is still ordered, and the old order is untouched');
{
 const p=boot105_1('blue');
 const cat=researchCatalog(p);
 // unlocks first, upgrades after - the split the panel's two headings rely on
 let seenUp=false,mixed=false;
 for(const k of cat){const up=RESEARCH[k].kind==='upgrade';if(up)seenUp=true;else if(seenUp)mixed=true}
 ok('T87.B unlocks come before upgrades',!mixed);
 /* The unlocks that were already on the panel keep the order they have had
    since v85 - the three new keys were APPENDED for exactly this reason. Checked
    per army against what that army may take, because four of the ten are other
    people's exclusives: Blue never sees the Radar Tent, the Munitions Dump or
    the Bunker at all, and expecting the flat ten was this check's own first bug. */
 const V85=['b_garage','b_helipad','b_generator','b_turbine','b_fwdpad','b_guardtower','b_radar','b_radiotower','b_dump','b_bunker'];
 const slipped=[];
 for(const fac of FACS105_1){
  const q=boot105_1(fac);
  const want=V85.filter(k=>techAvailable(q,k));
  const got=researchCatalog(q).filter(k=>V85.indexOf(k)>=0);
  if(got.join(',')!==want.join(','))slipped.push(fac+': '+got.join(' ')+' want '+want.join(' '));
 }
 ok('T87.B ...and every army\'s pre-existing unlocks are in their v85 order'
    +(slipped.length?' :: '+slipped.join('; '):''), slipped.length===0);
 ok('T87.B the order is deterministic across two reads',
    researchCatalog(p).join(',')===cat.join(','));
 // reading the catalog is a UI question and must never touch the seeded stream
 const before=G.rngS;
 for(const fac of FACS105_1)researchCatalog(G.players.find(q=>q.human)||p);
 ok('T87.B reading the catalog consumes no seeded rng',G.rngS===before);
}

section('T87.C v105.1: the bot could research all three the whole time');
{
 /* Recorded because it is the finding, not just the fix: the gap was ONE-SIDED.
    aiResearch pushes this faction's own ub techs before the shared structures,
    so the plan reaches them without ever consulting LAB_ORDER. */
 const src=nocmt105_1(aiResearch);
 ok('T87.C aiResearch plans this faction\'s own structures off FAC, not off LAB_ORDER',
    /FAC\[p\.fac\]\.ub/.test(src)&&src.indexOf('LAB_ORDER')<0);
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'blue',opp:3,seed:105101});
 for(let i=0;i<4;i++)update(1/30);
 const bots=G.players.filter(q=>!q.human&&q.ai);
 let planned=0,checked=0;
 for(const b of bots){
  aiResearch(b);
  const plan=b.ai.researchPlan||[];
  for(const ub of (FAC[b.fac].ub||[])){
   const tk=B[ub]&&B[ub].tech;if(!tk)continue;
   checked++;if(plan.indexOf(tk)>=0)planned++;
  }
 }
 ok('T87.C every CPU army plans both of its own exclusive structures ('+planned+'/'+checked+')',
    checked>0&&planned===checked);
 G=null;
}

section('T87.D v105.1: one turret painter, four callers');
{
 ok('T87.D vehTurret exists',typeof vehTurret==='function');
 /* MEMBERSHIP IS TURR_PORTRAIT, which is already the answer to "does this hull
    wear a live turret" - so the question is asked in one place for the match,
    the portraits and the parade alike. */
 ok('T87.D it decides off TURR_PORTRAIT rather than a second list of keys',
    nocmt105_1(vehTurret).indexOf('TURR_PORTRAIT[key]')>0);
 const rec=()=>{const log=[],st={};return{log:log,c:new Proxy(st,{get(t,k){
   if(k==='canvas')return{width:64,height:64};
   if(k==='createLinearGradient'||k==='createRadialGradient')return()=>({addColorStop(){}});
   if(k==='getLineDash')return()=>[];
   if(k==='measureText')return()=>({width:6});
   if(k==='getTransform')return()=>({a:1,b:0,c:0,d:1,e:0,f:0});
   if(k in t)return t[k];
   return function(){log.push([k].concat([].slice.call(arguments)))};
  },set(t,k,v){t[k]=v;return true}})}};
 const paints=key=>{const r=rec();const out=vehTurret(r.c,key,'#4caf50',0);return{out:out,log:r.log}};
 const has=(log,fn)=>log.some(e=>e[0]===fn);

 const yes=['tank','bulltank','aatruck'],no=['arty','jeep','apc','truck','heli','balloon','bike'];
 ok('T87.D the three turreted hulls get one ('+yes.join(' ')+')',yes.every(k=>paints(k).out===true));
 ok('T87.D the Rocket Artillery does NOT - its launcher is baked into the hull',paints('arty').out===false);
 ok('T87.D ...nor does anything else that has no turret',no.every(k=>paints(k).out===false));
 ok('T87.D a tank draws the dome and barrel, an AA truck draws its rack',
    has(paints('tank').log,'ellipse')&&has(paints('aatruck').log,'fill'));
 // the two placements that used to be inlined at each call site
 /* the FIRST translate/scale is vehTurret's own placement; everything after it
    belongs to the turret painters (plSphere translates, rr() does not), so a
    naive sum measures the artwork rather than the placement. */
 const first=(log,fn)=>{for(const e of log)if(e[0]===fn)return e[1];return null};
 const tr=log=>first(log,'translate');
 const sc=log=>{const v=first(log,'scale');return v==null?1:v};
 ok('T87.D the AA rack still pivots behind the cab (AA_PIVOT '+AA_PIVOT+')',
    tr(paints('aatruck').log)===AA_PIVOT);
 /* Stated against the BARE painter rather than as "the first scale is 1.34":
    the turret painters scale internally too, so reading the first scale back can
    pass for the wrong reason, and the Bull's turret is not merely the Tank's
    scaled - tankTurret draws it a longer barrel off its own `big` branch. What
    vehTurret is responsible for is the PLACEMENT, so that is what is compared:
    its output must be the bare painter's, with exactly the placement in front. */
 {
  const bare=key=>{const r=rec();tankTurret(r.c,key,'#4caf50');return r.log.map(e=>e.join(':')).join('|')};
  const via=key=>paints(key).log.map(e=>e.join(':')).join('|');
  const S=TURR_PORTRAIT.bulltank;
  ok('T87.D the Bull\'s turret is its own, with one placement scale of TURR_PORTRAIT ('+S+') in front',
     via('bulltank')===('scale:'+S+':'+S+'|'+bare('bulltank')));
  ok('T87.D ...and a plain Tank is placed with no scale at all',
     via('tank')===bare('tank'));
 }
 ok('T87.D ...and 1.34 is not typed a second time inside the painter',
    nocmt105_1(vehTurret).indexOf('1.34')<0);

 /* all four callers, asserted rather than assumed - the parade is the one that
    was missing and the reason this function exists */
 const callers={drawUnit:drawUnit,vehPortraitPaint:vehPortraitPaint,menubgPaint:menubgPaint};
 const cold=[];
 for(const n in callers)if(nocmt105_1(callers[n]).indexOf('vehTurret(')<0)cold.push(n);
 ok('T87.D every painter that draws a vehicle hull reaches it'+(cold.length?' :: '+cold.join(', '):''),
    cold.length===0);
 ok('T87.D drawUnit reaches it from BOTH of its turreted branches (tank and AA)',
    (nocmt105_1(drawUnit).match(/vehTurret\(/g)||[]).length===2);
}

section('T87.E v105.1: the marching column really does get its guns');
{
 menubgBake();
 /* Functional, through the live function: wrap vehTurret, paint the whole
    parade, and read back which marchers asked for a turret and which got one.
    A drawing bug cannot fail seg.sh (rule 7), but a call can be counted. */
 const real=vehTurret;
 const seen=[];
 vehTurret=function(c,key,col,rot){const out=real.apply(null,arguments);seen.push({key:key,rot:rot,out:out});return out};
 let threw=null;
 try{
  const log=[],st={};
  const c=new Proxy(st,{get(t,k){
   if(k==='canvas')return{width:64,height:64};
   if(k==='createLinearGradient'||k==='createRadialGradient')return()=>({addColorStop(){}});
   if(k==='createPattern')return()=>({});
   if(k==='getLineDash')return()=>[];
   if(k==='measureText')return()=>({width:6});
   if(k==='getTransform')return()=>({a:1,b:0,c:0,d:1,e:0,f:0});
   if(k in t)return t[k];
   return function(){log.push(k)};
  },set(t,k,v){t[k]=v;return true}});
  infoStub(()=>{INFO.stub.tick=0;INFO.stub.orgX=0;
   for(const L of MENUBG.lanes)for(const m of L.men)menubgPaint(c,m,11);});
 }catch(e){threw=e}
 vehTurret=real;
 ok('T87.E painting the parade throws nothing'+(threw?' :: '+threw.message:''),!threw);

 const armed=seen.filter(s=>s.out).map(s=>s.key);
 const paradeTurreted=[];
 for(const L of MENUBG.lanes)for(const m of L.men)if(TURR_PORTRAIT[m.key])paradeTurreted.push(m.key);
 ok('T87.E every turreted marcher gets a turret ('+armed.length+' of '+paradeTurreted.length+')',
    paradeTurreted.length>0&&armed.length===paradeTurreted.length);
 ok('T87.E ...and that is the Tank, the Bull and the AA Truck, which all march',
    ['tank','bulltank','aatruck'].every(k=>armed.indexOf(k)>=0));
 ok('T87.E the Rocket Artillery marches and is correctly refused one',
    seen.some(s=>s.key==='arty')&&!seen.some(s=>s.key==='arty'&&s.out));
 ok('T87.E a parade turret rides its hull rather than tracking a target (rot 0)',
    seen.every(s=>!s.rot));
 ok('T87.E nothing that cannot carry a turret asked for one twice',
    seen.length===MENUBG.lanes.reduce((a,L)=>a+L.men.filter(m=>m.t.a!=='inf').length,0));
}

/* RULE 7, again, and both halves were read as real Chromium frames before this
   file was written: the parade with turrets on its Tanks, Bulls and AA trucks;
   the Field Manual preview for all four of tank / bulltank / aatruck / arty,
   which is what proves the drawUnit refactor did not lose a gun; and the Lab
   panel for each of the four armies, which is where the missing buttons now
   are. See the v105.1 section of README.md. */
