/* ================================================================================
   T33 - v52 THE BULL'S TWO WEAPONS OWN DIFFERENT TARGET CLASSES

   A: cost +15%, and nothing else in the roster moved
   B: the class split has exactly ONE definition, and it says what it should
   C: acquisition - the cannon walks past infantry and wildlife to reach armor
   D: orders - ignored for classes it gave away, attack-move on the player path
   E: SIMULTANEITY, the explicit requirement: both weapons hot, on separate targets
   F: what the split costs on Desk, measured and pinned so it cannot surprise us
   G: determinism and save/load with both weapons live

   WHY THIS TAIL CARRIES THE WHOLE RELEASE: v52 moved no pinned hash trail, and that
   is NOT evidence of localization. Instrumenting all seven pinned combos shows zero
   bull-ticks and no Tan AI in any of them - the fixtures simply never field a Bull,
   so they could not have moved whatever v52 did. Everything below is the real gate.

   NON-VACUITY: see the mutation table in the README - six mutations of the shipped
   build each produce clean, specific failures here.
   ================================================================================ */
section('T33 v52: the Bull\u2019s cannon and flamer own different target classes');

const DT52=1/30;
function cfg52(map,mode,seed,opp,fac){return{map,mode,diff:'normal',fac:fac||'tan',opp:(opp==null?3:opp),seed}}
function quiet52(){for(const mn of (G.map.mines||[]))mn.live=false}
function foe52(){return G.players.find(p=>p!==G.human)}
function mkCr52(sp,x,y){
 const c={id:EID++,kind:'creature',species:sp,t:CREATURE[sp],p:G.neutral,x,y,
  hp:CREATURE[sp].hp,mhp:CREATURE[sp].hp,target:null,cool:0,face:0,wave:1};
 G.neutrals.push(c);return c;
}

/* ---------- A: cost ---------- */
{
 const b=U.bulltank;
 ok('T33.A the Bull costs 391 plastic / 92.575 battery',b.cp===391&&b.ce===92.575);
 // 340*1.15 is 390.99999999999994 in IEEE754, so this is a tolerance test on purpose.
 // v65: battery now carries the v52 +15% AND the v65 electricity pass, i.e. 70*1.15*1.15.
 ok('T33.A that is the v52 +15% on both, plus the v65 power pass on battery',
    Math.abs(b.cp-340*1.15)<1e-9&&Math.abs(b.ce-70*1.15*1.15)<1e-3);
 ok('T33.A the unlock re-derived from the new cost',
    RESEARCH.u_bulltank.cp===rscale(b.cp+b.ce*0.5)&&
    RESEARCH.u_bulltank.ce===rscale(Math.max(b.ce,b.cp*0.45))&&
    RESEARCH.u_bulltank.time===rtime(b.cp+b.ce));
 ok('T33.A the derived unlock actually moved (114 -> 124 battery, 18 -> 19.6s at v65)',
    RESEARCH.u_bulltank.ce===124&&Math.abs(RESEARCH.u_bulltank.time-19.6)<1e-9);
 // transcription of every v51 unit cost, so a stray edit to another unit fails here
 // Transcribed from the shipped v65 build, not from memory: a stray edit to ANY
 // unit's cost fails right here. v65 moved the Grunt (+20% plastic) and every
 // ce>0 entry (+15% battery), so this table was re-cut at that release; the ce:0
 // roster is listed at 0 deliberately, since the power pass is guarded on ce>0
 // and must never have invented a cost for them.
 // v69: the Gunner moved 115 -> 140 as an approved decision, so the record
 // advances. Everything else is byte-identical to the v65 cut.
 // v78: and again, 140 -> 112, alongside a matching -20% on his reload so his
 // damage per plastic does not move at all. Still the only mover.
 const V65={grunt:[36,0],grenadier:[55,0],gunner:[112,0],bazooka:[90,0],truck:[20,0],
  medic:[150,23],jeep:[130,11.5],aatruck:[180,34.5],tank:[220,46],heli:[200,80.5],sarge:[260,69],
  mortar:[150,0],flamer:[120,0],bulltank:[391,92.575],sniper:[170,0],arty:[320,103.5],bike:[90,5.75],
  apache:[300,126.5],apc:[260,46],chinook:[300,115],para:[0,0],
  // v85: the Signal Runner joins the record. 62 plastic and no battery - priced
  // ABOVE the Grunt he is weaker than, because what is bought is the two auras.
  runner:[62,0],
  /* v86: Green's two. Both prices were chosen INSIDE a band rather than picked
     for feel, and the band is the supply ladder: SUP_U cuts the trainable roster
     into quartiles by cp+ce, so a new unit's cost decides its own supply AND can
     shove every unit past it into another tier. 168 total lands the Command Truck
     between the Mortar Squad and the Sniper and 319 lands the Balloon between the
     APC and Sarge, which is exactly where the two gaps are - see T35.A, which
     asserts all twenty-one existing units kept the rank they had. */
  cmdtruck:[145,23],balloon:[250,69]};
 const drift=[];
 for(const k in U)if(V65[k]&&(U[k].cp!==V65[k][0]||U[k].ce!==V65[k][1]))drift.push(k);
 ok('T33.A the whole v65 cost roster is intact'+(drift.length?' (drift: '+drift.join(', ')+')':''),
    drift.length===0&&Object.keys(V65).length===Object.keys(U).length);
}

/* ---------- B: one definition of the split ---------- */
{
 G=null;newGame(cfg52('backyard','dm',52001,1));quiet52();
 const A=arena44(3,3,0,14),foe=foe52();
 const bull=makeUnit('bulltank',G.human,A.x,A.y);
 const tank=makeUnit('tank',G.human,A.x,A.y+8);          // control: no secondary
 const gr=makeUnit('grunt',foe,A.x+1,A.y);
 const tk=makeUnit('tank',foe,A.x+2,A.y);
 const hl=makeUnit('heli',foe,A.x+3,A.y);
 const aat=makeUnit('aatruck',foe,A.x+4,A.y);
 const bld=makeBuilding('barracks',foe,Math.floor(A.x)+6,Math.floor(A.y)+6,true);
 const ant=mkCr52('ant',A.x+1,A.y+1);

 ok('T33.B the flamer owns infantry and wildlife',secOwns(bull,gr)&&secOwns(bull,ant));
 ok('T33.B and nothing else: not armor, not aircraft, not a soft-skin, not a structure',
    !secOwns(bull,tk)&&!secOwns(bull,hl)&&!secOwns(bull,aat)&&!secOwns(bull,bld));
 ok('T33.B a unit with no secondary owns nothing, so every other unit is untouched',
    !secOwns(tank,gr)&&!secOwns(tank,ant)&&!secOwns(makeUnit('grunt',G.human,A.x,A.y+9),gr));
 ok('T33.B mainOk is exactly aaOk minus the secondary\u2019s classes',
    [gr,tk,hl,aat,bld,ant].every(e=>mainOk(bull,e)===(aaOk(bull,e)&&!secOwns(bull,e))));
 // v51 inlined the class test in nearestEnemy as well; that duplicate is what would
 // let the two weapons drift apart, so assert it exists in exactly one place.
 const src=nearestEnemy.toString()+secValid.toString()+mainOk.toString();
 ok('T33.B the class test is not duplicated into any consumer',
    !src.includes("armorOf(e)==='inf'")&&!src.includes("kind==='creature'")&&
    nearestEnemy.toString().includes('secOwns(u,e)')&&secValid.toString().includes('secOwns(u,e)'));
 ok('T33.B secOwns is a pure CLASS test - it ignores hp, garrisoning and range',
    (()=>{const dead={kind:'unit',t:U.grunt,hp:0,garrisoned:true};
          return secOwns(bull,dead)===true&&secValid(bull,dead)===false})());
}

/* ---------- C: acquisition ---------- */
{
 G=null;newGame(cfg52('backyard','dm',52002,1));quiet52();
 const A=arena44(3,3,0,16),foe=foe52();
 const bull=makeUnit('bulltank',G.human,A.x,A.y);
 const gr=makeUnit('grunt',foe,A.x+1.2,A.y);             // MUCH nearer
 const tk=makeUnit('tank',foe,A.x+4.0,A.y);
 ok('T33.C the cannon walks past nearer infantry to reach armor',nearestEnemy(bull,10)===tk);
 G.units.splice(G.units.indexOf(tk),1);
 ok('T33.C with only infantry in range the cannon acquires nothing at all',nearestEnemy(bull,10)===null);
 const ant=mkCr52('ant',A.x+1,A.y+1);
 ok('T33.C wildlife is not a cannon target either',nearestEnemy(bull,10)===null&&ant.hp>0);
 const hl=makeUnit('heli',foe,A.x+3,A.y+1);
 ok('T33.C aircraft still are',nearestEnemy(bull,10)===hl);
 G.units.splice(G.units.indexOf(hl),1);
 const bld=makeBuilding('barracks',foe,Math.floor(A.x)+5,Math.floor(A.y),true);
 ok('T33.C and structures still are',nearestEnemy(bull,12)===bld);
 // controls: every other unit must be completely unaffected
 const tank=makeUnit('tank',G.human,A.x,A.y+8);
 const tgtOfTank=nearestEnemy(tank,20);
 ok('T33.C control: a plain Tank happily acquires a class the Bull\u2019s cannon refuses',
    !!tgtOfTank&&secOwns(bull,tgtOfTank)&&nearestEnemy(bull,20)!==tgtOfTank);
 const aa=makeUnit('aatruck',G.human,A.x,A.y+10);
 ok('T33.C control: the AA truck still refuses everything on the ground',nearestEnemy(aa,20)===null);
}

/* ---------- D: orders ---------- */
{
 G=null;newGame(cfg52('backyard','dm',52003,1));quiet52();
 const A=arena44(3,3,0,16),foe=foe52();
 const bull=makeUnit('bulltank',G.human,A.x,A.y);
 const gr=makeUnit('grunt',foe,A.x+2,A.y);
 const tk=makeUnit('tank',foe,A.x+4,A.y);
 const ant=mkCr52('ant',A.x+2,A.y+1);

 bull.state='idle';bull.target=null;
 orderAttack(bull,gr);
 ok('T33.D an order on infantry is ignored outright',bull.target===null&&bull.state==='idle');
 orderAttack(bull,ant);
 ok('T33.D an order on wildlife is ignored too',bull.target===null&&bull.state==='idle');
 orderAttack(bull,tk);
 ok('T33.D an order on armor is taken',bull.target===tk&&bull.state==='attack');

 // retaliation must not drag a 1.9-speed heavy at a rifleman
 bull.state='idle';bull.target=null;bull.dest=null;
 applyDmg(bull,5,'b',gr);
 ok('T33.D being shot by infantry does not hand the cannon a target',bull.target===null);

 // the player path is the one place it converts, so a Bull walks into flamer range
 bull.state='idle';bull.target=null;bull.dest=null;
 execCmd({op:'attack',pi:G.human.i,a:{ids:[bull.id],tid:gr.id}});
 ok('T33.D a hand-issued order on infantry becomes an attack-move to the spot',
    bull.state==='amove'&&bull.dest&&Math.abs(bull.dest.x-gr.x)<1e-9);

 // a v51 save can hold a Bull mid-fight with an infantry target
 bull.state='attack';bull.target=gr;bull.dest=null;
 updateUnit(bull,DT52);
 ok('T33.D a stale infantry target left by a v51 save is dropped on the first tick',
    bull.target!==gr);
}

/* ---------- E: SIMULTANEITY ---------- */
{
 G=null;newGame(cfg52('backyard','dm',52004,1));quiet52();
 const A=arena44(3,3,0,16),foe=foe52();
 const bull=makeUnit('bulltank',G.human,A.x,A.y);
 const gr=makeUnit('grunt',foe,A.x+1.5,A.y);            // inside 2.6, flamer
 const tk=makeUnit('tank',foe,A.x+4.2,A.y);             // inside 5, cannon
 for(const v of [gr,tk]){v.hp=v.mhp=1e6}
 const h0={gr:gr.hp,tk:tk.hp};
 let bothHotOnSameTick=false;
 for(let i=0;i<150;i++){
  const a={gr:gr.hp,tk:tk.hp};
  G.tick++;updateUnit(bull,DT52);updateProjs(DT52);
  if(gr.hp<a.gr&&tk.hp<a.tk)bothHotOnSameTick=true;
 }
 ok('T33.E the cannon works armor while the flamer works infantry, in one window',
    tk.hp<h0.tk&&gr.hp<h0.gr);
 ok('T33.E they hold DIFFERENT targets at the same time',
    bull.target===tk&&bull.target2===gr);
 ok('T33.E neither cooldown gates the other',
    bull.cool!=null&&bull.cool2!=null&&bull.cool<=U.bulltank.rt+1e-9&&bull.cool2<=U.bulltank.sec.rt+1e-9);

 // and the same against wildlife, which is the survival case
 G=null;newGame(cfg52('desk','surv',52005,1));quiet52();
 const hq=G.human.blds.find(b=>b.key==='hq');
 const b2=makeUnit('bulltank',G.human,hq.x+3,hq.y+3);
 const roach=mkCr52('roach',b2.x+1.3,b2.y);
 const foe2=G.players.find(p=>p!==G.human&&p!==G.neutral);
 const rh=roach.hp;
 for(let i=0;i<80;i++){G.tick++;updateUnit(b2,DT52);updateProjs(DT52)}
 ok('T33.E the flamer alone handles wildlife, and it does handle it',
    roach.hp<rh&&b2.target2===roach&&b2.target!==roach);
}

/* ---------- F: what the split costs, measured and pinned ---------- */
{
 const b=U.bulltank,sc=b.sec;
 const cannonVsBug=b.dm*WVA.s.bug/b.rt, flameVsBug=b.dm*sc.k*WVA.f.bug/sc.rt;
 ok('T33.F the cannon could still out-damage the flamer against wildlife (8.07 vs 6.61 DPS)',
    Math.abs(cannonVsBug-8.07)<0.02&&Math.abs(flameVsBug-6.61)<0.02&&cannonVsBug>flameVsBug);
 // This is the deliberate trade v52 makes. Pinned so it is a visible decision in the
 // suite rather than something rediscovered on Desk three releases from now: handing
 // wildlife to the flamer drops the Bull from 14.68 to 6.61 DPS against it, and costs
 // it 5-tile reach and 1.0 splash in exchange for 2.6-tile reach and 0.5 splash.
 ok('T33.F handing wildlife to the flamer costs the Bull 55% of its anti-swarm DPS',
    Math.abs((cannonVsBug+flameVsBug)-14.68)<0.03&&
    Math.abs(1-flameVsBug/(cannonVsBug+flameVsBug)-0.55)<0.02&&
    sc.rg<b.rg&&sc.spl<b.spl);
 ok('T33.F against infantry it is still a clear upgrade over the plain Tank',
    (b.dm*sc.k*dmgMulFor('bulltank','f','inf')/sc.rt)>(U.tank.dm*dmgMulFor('tank','s','inf')/U.tank.rt));
}

/* ---------- G: determinism and save/load ---------- */
{
 function run52(ticks){
  G=null;newGame(cfg52('backyard','dm',52006,1));quiet52();
  const A=arena44(3,3,0,16),foe=foe52();
  const bull=makeUnit('bulltank',G.human,A.x,A.y);
  makeUnit('grunt',foe,A.x+1.5,A.y);
  const tk=makeUnit('tank',foe,A.x+4.2,A.y);
  orderAttack(bull,tk);
  const tr=[];for(let i=1;i<=ticks;i++){update(DT52);if(i%60===0)tr.push(hashState())}
  return tr;
 }
 const r1=run52(480),r2=run52(480);
 ok('T33.G a Bull working two targets replays bit-identically',
    r1.length===8&&r1.every((v,i)=>v===r2[i]));

 G=null;newGame(cfg52('backyard','dm',52006,1));quiet52();
 const A=arena44(3,3,0,16),foe=foe52();
 const bull=makeUnit('bulltank',G.human,A.x,A.y);
 makeUnit('grunt',foe,A.x+1.5,A.y);
 const tk=makeUnit('tank',foe,A.x+4.2,A.y);
 orderAttack(bull,tk);
 for(let i=0;i<180;i++)update(DT52);
 const blob=saveState(),h0=hashState();
 const contd=[];for(let i=0;i<150;i++){update(DT52);contd.push(hashState())}
 loadState(blob);
 ok('T33.G the snapshot restores to the same hash',hashState()===h0);
 const after=[];for(let i=0;i<150;i++){update(DT52);after.push(hashState())}
 ok('T33.G and the resumed trail is bit-identical',after.every((v,i)=>v===contd[i]));
 ok('T33.G snapshot tag is monotonic and at least 52',JSON.parse(blob).v>=52);
 ok('T33.G loading still does not stamp target2 onto units without a secondary',
    G.units.filter(u=>!u.t.sec).every(u=>!('target2' in u)));

 const dirty=[];
 for(const [n,f] of [['secOwns',secOwns],['secValid',secValid],['mainOk',mainOk]]){
  const src=f.toString();
  for(const b of ['Math.random','Math.hypot','Date.now','performance.now'])if(src.includes(b))dirty.push(n+' uses '+b);
 }
 ok('T33.G the three predicates use only deterministic math'+(dirty.length?' ('+dirty.join('; ')+')':''),
    dirty.length===0);
}
