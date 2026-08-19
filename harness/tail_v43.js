/* tail_v43.js - T23: v43 cleanup & foundation pass.
   A: every hash trail and map layout is byte-identical to v42 (a cleanup release
      must not move the simulation; these baselines were captured from the v42
      build before any edit was applied).
   B: the tuning constants are the single source for gameplay, overlay and prose.
   C: the help panel's numbers are filled from those constants at boot.
   D: makeAIBrain is the one AI brain builder (newGame + aiTakeover).
   E: nearestEnemy(u,r,cone) reproduces both v42 scans exactly.
   F: unitCapCount / bldCount match the idioms they replaced.
   G: entity field-set lint - no undocumented field on a live unit or building.
   H: sim-purity lint - core sim functions use only deterministic math.
   I: snapshot tag v:43 and a bit-identical save/load resume. */
'use strict';
section('T23 v43: cleanup invariants (behaviour must be identical to v42)');

const BASE45_TRAILS={
  'backyard:dm:777001': [878166853, 1753763297, 1431950781, 1239215714, 2958341408, 1187649125, 755748859, 1711895297, 1315105786, 2575747334],
  'kitchen:dm:777001': [2087679718, 856119264, 3618923214, 2058115603, 1005216923, 3789097852, 538533377, 1743577667, 3098213793, 2608850475],
  'livingroom:dm:777001': [609462547, 565513189, 2371656829, 225442840, 113201750, 3690818731, 258757364, 2545773778, 4220890855, 1944234028],
  'sandbox:dm:777001': [768672292, 436319292, 1859334160, 194196945, 1625050143, 1226950034, 599475361, 2187372898, 1966448466, 2923646357],
  'backyard:koth:424243': [1891708546, 3507717113, 3746632333, 1932110507, 2048766432, 3125811209, 1730908374, 2783344403, 3382877984, 2534791757],
  'kitchen:ctf:424243': [3912544875, 2757394531, 729788237, 3753707145, 2415661468, 133454543, 4291730329, 2323576116, 2419835360, 3586781928],
  'desk:surv:424243': [1661632587, 2469025864, 3969413972, 3507938602, 3776163843, 4248901972, 806260051, 2291621544, 3516144461, 2367615333, 615537907, 962116119, 2203739645, 3716485660, 445679745, 8947875, 206865495, 3436482747, 2891844524, 518388950, 4259347239, 3039917097, 1823278924, 1846682269, 4212367808, 1837706982],
};
const BASE43_LAYOUTS={"backyard:11":1255837022,"backyard:22":1262884325,"backyard:33":3816844854,"kitchen:11":2736043710,"kitchen:22":317751797,"kitchen:33":3447831333,"livingroom:11":859166094,"livingroom:22":3229224006,"livingroom:33":3594163030,"sandbox:11":3903799714,"sandbox:22":2051225923,"sandbox:33":1330770731,"desk:11":2502437368,"desk:22":864639349,"desk:33":1711599493};
/* ---------- A: BEHAVIOUR EQUALITY vs v42 (the point of the release) ----------
   v43 was a cleanup pass and these were captured from v42; v45 recut them (the
   counter matrix + Gunner cost move damage game-wide) and v48 recut them again
   (the AI overhaul - counter-aware production, support doctrines, call-downs,
   entrenchment, threat triage - moves every AI trail). The LAYOUT baselines
   below are UNTOUCHED through all of it, which is what proves no release since
   has touched map generation. v51 recut them again (cannon vs infantry, bazooka
   vs heavy, the AA truck entering the AI roster, the Bull's second weapon), and
   the 15 layout hashes passed UNEDITED on the pre-repin run. */
const DT43=1/30;
function cfg43(map,mode,seed,opp){return{map,mode,diff:'normal',fac:'tan',opp:(opp==null?3:opp),seed}}
function layoutHash43(){
 let h=2166136261;
 const P=G.map.pass;for(let i=0;i<P.length;i++)h=hI(h,P[i]);
 for(const n of G.map.nodes){h=hF(h,n.x);h=hF(h,n.y);h=hS(h,n.t);h=hF(h,n.amt)}
 for(const s of G.map.starts){h=hF(h,s.x);h=hF(h,s.y)}
 for(const ns of (G.map.nests||[])){h=hF(h,ns.x);h=hF(h,ns.y)}
 for(const pr of (G.map.props||[])){h=hF(h,pr.x);h=hF(h,pr.y);h=hS(h,pr.t)}
 return h>>>0;
}
function trail43(c,ticks,every){
 G=null;newGame(c);const out=[];
 for(let i=1;i<=ticks;i++){update(DT43);if(i%every===0)out.push(hashState());}
 return out;
}
const COMBOS43=[
 ['backyard','dm',777001,3,900],
 ['kitchen','dm',777001,3,900],
 ['livingroom','dm',777001,3,900],
 ['sandbox','dm',777001,3,900],
 ['backyard','koth',424243,3,900],
 ['kitchen','ctf',424243,3,900],
 ['desk','surv',424243,1,2400]
];
for(const [m,md,sd,opp,tk] of COMBOS43){
 const key=`${m}:${md}:${sd}`, want=BASE45_TRAILS[key], got=trail43(cfg43(m,md,sd,opp),tk,90);
 ok(`T23.A ${key} hash trail byte-identical to the v54 baseline`,
    !!want&&want.length===got.length&&want.every((v,i)=>v===got[i]));
}
for(const m of ['backyard','kitchen','livingroom','sandbox','desk'])for(const sd of [11,22,33]){
 G=null;newGame(cfg43(m,m==='desk'?'surv':'dm',sd,m==='desk'?1:3));
 ok(`T23.A layout ${m}:${sd} unchanged`,layoutHash43()===BASE43_LAYOUTS[`${m}:${sd}`]);
}

/* ---------- B: tuning constants are the single source ---------- */
ok('T23.B CTF_TARGET is 3',CTF_TARGET===3);
ok('T23.B build radii are 15 / 6 / 10',BUILD_R_HQ===15&&BUILD_R_OUTPOST===6&&BUILD_R_FOEHQ===10);
ok('T23.B salvage 0.34, sell 0.5',SALVAGE_FRAC===0.34&&SELL_FRAC===0.5);
ok('T23.B SURV_WAVE_N is derived from the wave table',SURV_WAVE_N===SURV_WAVES.length&&SURV_WAVE_N===15);
{
 const pd=placeDeny.toString(), dg=drawGhost.toString(), kl=kill.toString(), sb=sellBuilding.toString();
 ok('T23.B placeDeny reads the named radii',
    pd.includes('<BUILD_R_HQ)')&&pd.includes('<BUILD_R_OUTPOST)')&&pd.includes('<BUILD_R_FOEHQ)'));
 ok('T23.B placeDeny holds no bare radius literals',
    !pd.includes('b.y-fy)<15')&&!pd.includes('b.y-fy)<5)')&&!pd.includes('b.y-fy)<10)'));
 ok('T23.B build-ghost rings read the same radii',
    dg.includes('ring(b.x,b.y,BUILD_R_HQ,')&&dg.includes('ring(b.x,b.y,BUILD_R_OUTPOST,')&&dg.includes('ring(b.x,b.y,BUILD_R_FOEHQ,'));
 ok('T23.B all three death-salvage sites read SALVAGE_FRAC',
    (kl.match(/mods\.cost\)\*SALVAGE_FRAC/g)||[]).length===3&&!kl.includes('mods.cost)*0.34')&&!kl.includes('mods.cost)*0.5'));
 ok('T23.B every sell site reads SELL_FRAC (refund, toast, button)',
    (sb.match(/SELL_FRAC/g)||[]).length===2&&!sb.includes('.p*0.5')&&refreshSelPanel.toString().includes('.p*SELL_FRAC'));
 ok('T23.B HQ / Outpost card text quotes the live radii',
    B.hq.d.includes(BUILD_R_HQ+'-tile')&&B.outpost.d.includes(BUILD_R_OUTPOST+'-tile'));
 ok('T23.B checkEnd + survival scheduler read the constants',
    checkEnd.toString().includes('>=CTF_TARGET')&&updateSurv.toString().includes('S.no<SURV_WAVE_N'));
}

/* ---------- C: help panel is filled from those constants ---------- */
{
 const want={hqR:15,opR:6,foeR:10,koth:150,ctf:3,waves:15,salvagePct:34,sellPct:50,barrCost:20,mines:20};
 let allOK=true;
 for(const k in want)if(helpTuneValue(k)!==want[k])allOK=false;
 ok('T23.C every help slot resolves to its constant',allOK);
 ok('T23.C unknown slot resolves to null',helpTuneValue('nope')===null);
 ok('T23.C salvage slot reflects the v40 change (34, not the old 50)',helpTuneValue('salvagePct')===34);
 let threw=false;try{applyHelpTune()}catch(e){threw=true}
 ok('T23.C applyHelpTune is safe headless (no DOM slots)',!threw);
}

/* ---------- D: one AI brain builder ---------- */
{
 ok('T23.D makeAIBrain exists',typeof makeAIBrain==='function');
 ok('T23.D newGame delegates to it',newGame.toString().includes('makeAIBrain(profKey)'));
 ok('T23.D aiTakeover delegates to it',execCmd.toString().includes('p.ai=makeAIBrain(profKey)'));
 ok('T23.D the duplicated literal is gone',
    !newGame.toString().includes('rivalIdx:Math.floor')&&!execCmd.toString().includes('rivalIdx:Math.floor'));
 G=null;newGame(cfg43('backyard','dm',909090,3));
 const bots=G.players.filter(p=>p.ai);
 const shape=Object.keys(bots[0].ai).sort().join(',');
 ok('T23.D bots still get a full brain',bots.length===3&&bots.every(p=>Object.keys(p.ai).sort().join(',')===shape));
 // a takeover brain must have the same shape as a newGame brain
 const fresh=makeAIBrain('balanced');
 ok('T23.D a directly-built brain has the same field set',Object.keys(fresh).sort().join(',')===shape);
 ok('T23.D profile is copied, not shared',fresh.pr!==AI_PROFILES.balanced&&fresh.profile==='balanced');
 ok('T23.D harassSize stays ordered after jitter',fresh.pr.harassSize[1]>=fresh.pr.harassSize[0]);
 // same rng state in => same brain out (the srand order is part of the contract)
 const s0=G.rngS; const a=makeAIBrain('aggressive'); G.rngS=s0; const b=makeAIBrain('aggressive');
 ok('T23.D brain construction is a pure function of the rng state',
    a.nextPush===b.nextPush&&a.aggro===b.aggro&&a.rivalIdx===b.rivalIdx&&a.t===b.t);
}

/* ---------- E: one target scan for both callers ---------- */
{
 ok('T23.E nearestEnemy takes the cone flag',nearestEnemy.length===3);
 ok('T23.E nearestEnemyCone is a thin wrapper',
    nearestEnemyCone.toString().includes('nearestEnemy(u,r,true)')&&nearestEnemyCone.toString().length<120);
 // reference implementations copied from v42, run against the live board
 /* v67: the references now carry the v66 CPU-only den rule. They did not, and at
    v66 that went unnoticed because seed 515151 happened to put no roused den within
    NEST_AGGRO2 of any sampled unit's cone - the fixture was blind to the release
    rather than confirming it. The v67 map rework moved the dens and six cone scans
    diverged at once, every one of them an AI unit correctly picking a roused den
    that the stale reference skipped. The LIVE behaviour is unchanged in v67.
    Still unmodelled, deliberately: the v51 aaOnly gate and the v52 secondary gate.
    This board samples 0 flying and 0 secondary-weapon units, so modelling them here
    would be untestable code. That is a known blind spot, recorded not fixed. */
 const refDen=(u,b,cone)=>{                     // v66: a den is a target for a CPU
  if(!(u.p&&u.p.ai))return false;               // army only, and only when roused
  const ns=G.map.nests[b.nsi];                  // and only right on top of it
  if(!ns||ns.dead||!ns.aggro)return false;
  const d=(b.x-u.x)**2+(b.y-u.y)**2;
  return d<NEST_AGGRO2&&(!cone||inCone(u,b.x,b.y));
 };
 /* v83: the reference mirrors nearestEnemy's new last-resort slot. A neutral
    hedgehog is collected apart from best/bd and returned only if the sweep found
    nothing, so it can never outrank a real target; a BOT unit whose id falls in
    the clearing share is the only thing that sees one at all. Modelled here
    rather than exempted, because the whole value of T23.E is that the reference
    is an INDEPENDENT statement of the rule - loosening it to ignore barricades
    would stop it testing the branch the release just added. */
 const refPlain=(u,r)=>{
  let best=null,bd=r*r,nb=null,nbd=BARR_CLEAR2;
  for(const e of G.units){if(allied(e.p,u.p)||e.garrisoned)continue;const d=(e.x-u.x)**2+(e.y-u.y)**2;if(d<bd){bd=d;best=e}}
  for(const b of G.blds){if(allied(b.p,u.p))continue;
   if(b.key==='nest'){const d=(b.x-u.x)**2+(b.y-u.y)**2;if(refDen(u,b,false)&&d<bd){bd=d;best=b}continue;}
   if(b.key==='barricade'){
    if(b.p===G.neutral){
     if(!(u.p&&u.p.ai)||(u.id%BARR_CLEAR_SHARE))continue;
     const d=(b.x-u.x)**2+(b.y-u.y)**2;if(d<nbd){nbd=d;nb=b}continue;
    }
    const d=(b.x-u.x)**2+(b.y-u.y)**2;if(d<BARR_AGGRO2&&d<bd){bd=d;best=b}continue;}
   const d=(b.x-u.x)**2+(b.y-u.y)**2;if(d<bd){bd=d;best=b}}
  for(const cr of (G.neutrals||[])){if(cr.hp<=0)continue;const d=(cr.x-u.x)**2+(cr.y-u.y)**2;if(d<bd){bd=d;best=cr}}
  return best||nb;
 };
 const refCone=(u,r)=>{
  let best=null,bd=r*r,nb=null,nbd=BARR_CLEAR2;
  for(const e of G.units){if(allied(e.p,u.p)||e.garrisoned)continue;const d=(e.x-u.x)**2+(e.y-u.y)**2;if(d<bd&&inCone(u,e.x,e.y)){bd=d;best=e}}
  for(const b of G.blds){if(allied(b.p,u.p))continue;
   if(b.key==='nest'){const d=(b.x-u.x)**2+(b.y-u.y)**2;if(refDen(u,b,true)&&d<bd){bd=d;best=b}continue;}
   if(b.key==='barricade'){
    if(b.p===G.neutral){
     if(!(u.p&&u.p.ai)||(u.id%BARR_CLEAR_SHARE))continue;
     const d=(b.x-u.x)**2+(b.y-u.y)**2;if(d<nbd&&inCone(u,b.x,b.y)){nbd=d;nb=b}continue;
    }
    const d=(b.x-u.x)**2+(b.y-u.y)**2;if(d<BARR_AGGRO2&&d<bd&&inCone(u,b.x,b.y)){bd=d;best=b}continue;}
   const d=(b.x-u.x)**2+(b.y-u.y)**2;if(d<bd&&inCone(u,b.x,b.y)){bd=d;best=b}}
  for(const cr of (G.neutrals||[])){if(cr.hp<=0)continue;const d=(cr.x-u.x)**2+(cr.y-u.y)**2;if(d<bd&&inCone(u,cr.x,cr.y)){bd=d;best=cr}}
  return best||nb;
 };
 G=null;newGame(cfg43('backyard','dm',515151,3));
 for(let i=0;i<900;i++)update(DT43);
 let plainOK=true,coneOK=true,checked=0,coneHits=0;
 for(const u of G.units){
  if(checked>=60)break;
  for(const r of [6,12,40]){
   if(nearestEnemy(u,r)!==refPlain(u,r))plainOK=false;
   const saved=u.coneDir;
   for(const dir of [0,1.7,3.4,5.1]){
    u.coneDir=dir;
    const got=nearestEnemy(u,r,true);
    if(got!==refCone(u,r))coneOK=false;
    if(got)coneHits++;
   }
   u.coneDir=saved;
  }
  checked++;
 }
 ok(`T23.E plain scan matches the v42 reference (${checked} units x3 ranges)`,plainOK&&checked>0);
 ok(`T23.E cone scan matches the v42 reference (${coneHits} live hits)`,coneOK&&coneHits>0);
}

/* ---------- F: roster-cap helpers ---------- */
{
 G=null;newGame(cfg43('backyard','dm',616161,1));
 const p=G.human;p.res.p=99999;p.res.e=99999;
 const oldCount=(pl,k)=>pl.units.filter(u=>u.key===k).length+pl.blds.reduce((a,b)=>a+b.queue.filter(q=>q===k).length,0);
 ok('T23.F unitCapCount matches the old idiom on a fresh board',
    ['truck','grunt','sarge'].every(k=>unitCapCount(p,k)===oldCount(p,k)));
 const prod=p.blds.find(b=>b.t.prod&&b.t.prod.length&&b.prog>=1);
 const qk=prod?prod.t.prod[0]:null;
 let queued=0;
 if(prod)for(let i=0;i<3;i++)if(trainUnit(prod,qk))queued++;
 ok('T23.F queued units are counted, not just fielded',
    !!qk&&queued>0&&unitCapCount(p,qk)===oldCount(p,qk)&&unitCapCount(p,qk)>=queued);
 ok('T23.F bldCount matches a plain filter',
    ['hq','barracks','radar','outpost'].every(k=>bldCount(p,k)===p.blds.filter(b=>b.key===k).length));
 ok('T23.F trainUnit still refuses past a unit limit',(()=>{
   const lk=Object.keys(U).find(k=>U[k].lim);
   if(!lk)return true;
   const src=trainUnit.toString();
   return src.includes('unitCapCount(b.p,k)>=U[k].lim');
  })());
}

/* ---------- G: entity field-set lint ----------
   A golden list of every field a live unit / building carries. If a future version
   adds one, this fires and forces a conscious call: hash it, skip it in snapshots,
   or record it here as deliberate client-local state.

   v65 added `garrisoned` and `targetB` to the unit list. NEITHER is new code:
   garrisoned dates from the bunker work and is hashed (hI(h,u.garrisoned?1:0));
   targetB is the v51 secondary weapon's own target and is a snapshot ref field in
   _uRefs. Both were simply absent from every 200-tick sample the old build
   happened to take, and the v65 cost changes moved the AI enough to land on one.
   The conscious call is therefore "already handled, record it here".

   v67 adds `retalT` on exactly the same footing. It is the v26 AI return-fire
   throttle (a G.tick stamp, gating how often a unit under fire may break off).
   It is not in hashState and does not need to be - like helpT/fleeT/hT above it
   only rate-limits a decision whose EFFECTS are hashed - and _encGeneric copies
   it into snapshots by default, so it round-trips. The v67 map rework moved the
   AI onto a 200-tick sample that finally caught one.

   v79 adds six fields, and unlike every entry above them these are NOT
   already-handled strays: they are deliberate new sim state and every one is
   hashed. calmT (seconds since last damage) rides on every unit because both
   readers are cross-unit - Sarge reads his own for regen, a smoking mortar
   reads its neighbours' to find who is under fire. onMe / smoke / wf / wfT are
   written only onto tables carrying the matching capability flag, in the v51
   salv/cool2 style, so a match with no Sarge and no mortar never grows them.
   upT is the Radar Tent's uplink duration, a second timer beside abilityCool
   because one is "how long until I may fire again" and the other is "how long
   this firing has left to run".

   v81 adds three, all hashed and all in the v51 capability style: shotT (the
   seconds-since-last-shot clock the concealment test reads) rides only tables
   carrying camo, cs only those carrying cshot, rip only those carrying ripple.
   No v81 field lands on every unit, so a match with no Gray army grows none of
   them - and the Bunker's Lockdown deliberately reuses upT above rather than
   adding a b.lockT, because that timer already ticks for every structure. */
{
 /* v88: paintT joins the list. It is the first entry here that is NOT gated on a
    table flag - the Choktaw's mark is worn by units whose own row says nothing
    about it, so makeUnit writes it onto every unit rather than onto a few. */
 const KNOWN_UNIT=["ai","aiCarry","aiDigT","aiPatrol","aiRole","aiRoleT","aiWave","aiWp","anchor","aslt","burnDps","burnT","calmT","cargo","cargoT","coneDir","cool","cool2","cs","dest","dm","entrenched","face","flag","flat","flash","flashAng","fleeT","fo","garrisoned","hT","helpT","hold","hp","id","key","kind","kl","lastHit","lastProg","lastShrap","mesc","mhp","onMe","mining","mvg","node","oq","p","paintT","parkAtHQ","parked","path","patrol","retalT","rot","salv","rip","savedDest","sel","shotT","smoke","sp","state","stuck","t","target","target2","targetB","tface","thr","tvis","upg","valve","vr","vrt","wedge","wf","wfT","wp","x","y"];
 const KNOWN_BLD=["abilityCool","burnT","cool","garrison","helpT","hp","id","key","kind","lastHit","lastShrap","mhp","nsi","p","prodT","prog","queue","rally","sel","sz","t","target","techCur","techT","tface","tvis","tx","ty","upT","upg","x","y"];
 const ku=new Set(KNOWN_UNIT), kb=new Set(KNOWN_BLD), newU=new Set(), newB=new Set();
 for(const [m,md,opp,tk] of [['backyard','dm',3,600],['kitchen','ctf',3,400],['desk','surv',1,2000]]){
  G=null;newGame(cfg43(m,md,555001,opp));
  for(let i=1;i<=tk;i++){
   update(DT43);
   if(i%200===0){for(const u of G.units)for(const k in u)if(!ku.has(k))newU.add(k);
                 for(const b of G.blds)for(const k in b)if(!kb.has(k))newB.add(k);}
  }
 }
 ok('T23.G no undocumented unit field appeared'+(newU.size?' ('+[...newU]+')':''),newU.size===0);
 ok('T23.G no undocumented building field appeared'+(newB.size?' ('+[...newB]+')':''),newB.size===0);
 const hs=hashState.toString();
 const HASHED_U=['u.x','u.y','u.hp','u.cool','u.state','u.face','u.entrenched','u.garrisoned','u.hold','u.burnT'];
 ok('T23.G the hashed unit fields are all still read by hashState',HASHED_U.every(f=>hs.includes(f)));
 ok('T23.G cosmetic turret angle stays out of the hash and out of saves',
    !hs.includes('u.tvis')&&SNAP_ENT_SKIP.has('tvis'));
}

/* ---------- H: sim-purity lint ----------
   The COMMANDS banner has always promised that sim execution uses no Math.random,
   no Math.sin/cos/atan2/hypot and no wall clock. Nothing enforced it. These are the
   functions verified clean at v43; FX-spawning paths (applyDmg / splash / kill /
   updateProjs / aiTick) are deliberately absent, they seed client-local particles
   and toasts from Math.random, which is allowed and never touches hashed state.

   v87.1: sellBuilding LEFT this list, deliberately. Selling used to be a puff of
   dust and stopped there; it now runs the same teardown a destroyed building gets,
   which makes it an FX-spawning path exactly like kill() and puts Math.random in
   its body for the cook-off offsets. Dropping it from the list is not dropping the
   guarantee - T61.C drives the property this lint could only approximate, by
   selling an empty building and asserting G.rngS did not move at all, which is the
   thing that would actually desync a match. The lint keeps its teeth here: the
   arm below holds sellBuilding to every banned construct EXCEPT the one the FX
   paths are allowed, so a wall clock or a Math.atan2 creeping in still fires. */
{
 const BANNED=['Math.random','Math.hypot','Math.atan2','Math.sin(','Math.cos(','Date.now','performance.now'];
 const PURE43=[['nearestEnemy',nearestEnemy],['nearestEnemyCone',nearestEnemyCone],['medicHold',medicHold],
  ['moveAlong',moveAlong],['fireAt',fireAt],['updateUnit',updateUnit],['updateBld',updateBld],['findPath',findPath],
  ['updateSurv',updateSurv],['spawnWave',spawnWave],['updateNeutrals',updateNeutrals],['execCmd',execCmd],
  ['hashState',hashState],['makeAIBrain',makeAIBrain],['unitCapCount',unitCapCount],['bldCount',bldCount],
  ['placeDeny',placeDeny],['canPlace',canPlace],['targetDmgMul',targetDmgMul],['trainUnit',trainUnit],
  ['dmgBonus',dmgBonus],['garCap',garCap],['checkEnd',checkEnd]];
 const dirty=[];
 for(const [n,f] of PURE43){const s=f.toString();for(const b of BANNED)if(s.includes(b))dirty.push(n+' uses '+b);}
 ok(`T23.H ${PURE43.length} core sim functions use only deterministic math`+(dirty.length?' ('+dirty.join('; ')+')':''),dirty.length===0);
 ok('T23.H distance math goes through dhyp',placeDeny.toString().includes('dhyp(')&&!placeDeny.toString().includes('Math.hypot'));
 /* the FX paths get ONE exemption, not a blanket one */
 {
  const sb=sellBuilding.toString(),loose=BANNED.filter(b=>b!=='Math.random'&&sb.includes(b));
  ok('T23.H the sell path takes the FX exemption and nothing beyond it'+(loose.length?' ('+loose.join(', ')+')':''),
     loose.length===0);
  ok('T23.H ...and it really is an FX path now, which is why it is exempt',
     sb.includes('spawnExplosion')&&sb.includes('Math.random'));
 }
}

/* ---------- I: snapshot tag + round trip ---------- */
{
 G=null;newGame(cfg43('kitchen','dm',737373,2));
 for(let i=0;i<420;i++)update(DT43);
 const snap=saveState(); // a JSON string
 ok('T23.I snapshot tag is v:43 or newer',JSON.parse(snap).v>=43);
 const before=hashState();
 const trailA=[];for(let i=1;i<=210;i++){update(DT43);if(i%30===0)trailA.push(hashState())}
 loadState(snap);
 ok('T23.I load restores the exact pre-save hash',hashState()===before);
 const trailB=[];for(let i=1;i<=210;i++){update(DT43);if(i%30===0)trailB.push(hashState())}
 ok('T23.I resumed trail is bit-identical',trailA.length===trailB.length&&trailA.every((v,i)=>v===trailB[i]));
}
