/* ---------------- ENTITIES ---------------- */
let EID=1;
function makeUnit(key,p,x,y,srcBld){
 const t=U[key],m=FAC[p.fac].mods;
 // newly-trained units from an UPGRADED producing building get +HP/+DMG.
 // (only applies to real production, i.e. when srcBld is the upgraded building.)
 let buff=1;
 if(srcBld&&srcBld.upg&&UPGRADES[srcBld.key]&&UPGRADES[srcBld.key].unitBuff)buff=1+UPGRADES[srcBld.key].unitBuff;
 /* v87 THE FOUNDRY. Hull only, and only for what the GARAGE builds - the file's
    own word for "vehicle" is "the thing the Garage produces", so prodBldOf is the
    test rather than a hand-written class list that would have to be revisited
    every time an archetype is added. Multiplies WITH the Garage upgrade rather
    than replacing it: the upgrade is a Garage that builds better, the Foundry is
    an army that does.
    It is deliberately NOT gated on srcBld the way the upgrade above is. The
    upgrade belongs to one building, so it can only mean anything when that
    building is the producer; the Foundry belongs to the army, and "produced while
    it stands" is a fact about the army's industry rather than about which Garage
    the order went to.
    Determinism: this reads p.blds, which every client agrees about (prog and hp
    are both hashed), and it lands on hp as well as mhp - so a client that
    disagreed would diverge in hashState on the very first tick rather than
    silently carrying a different maximum. */
 let fhp=1;
 if(prodBldOf(key)==='garage'&&p.blds&&p.blds.some(b=>b.t.foundry&&b.prog>=1&&b.hp>0))fhp=1+FOUNDRY_HP;
 const hp=Math.round(t.hp*m.hp*buff*fhp);
 const u={id:EID++,kind:'unit',key,t,p,x,y,hp,mhp:hp,
  dm:t.dm*m.dmg*buff,sp:t.sp*m.speed,face:srand()*6.28,tface:0,
  upg:buff>1,
  state:'idle',path:null,wp:0,target:null,cool:0,anchor:{x,y},stuck:0,lastProg:{x,y},
  cargo:0,cargoT:null,node:null,flag:null,lastHit:'b',rot:0,sel:false,ai:{},mining:false,parkAtHQ:false,flash:0,flashAng:0,
  // ability state: entrench (machine gunner) and radio call-down cooldown
  entrenched:false,coneDir:0, // v30: unit abilityCool/radioMode retired - call-downs live on the Radio Tower
  // v29: order queue / patrol loop / hold-position / veterancy (kills, rank)
  oq:[],patrol:null,hold:false,kl:0,vr:0,
  /* v79: seconds since this unit last took damage. Every unit carries it because
     both readers are cross-unit - Sarge's regen reads his own, and a smoking
     mortar reads its neighbours' to find who is under fire. Clamped so it cannot
     drift off into a float where +dt stops changing it. */
  calmT:0};
 // v51: salvo and secondary-weapon state are written ONLY onto the units that carry
 // those table fields, so a match with no AA truck and no Bull snapshots byte-identically.
 if(t.sal)u.salv=t.sal;
 if(t.sec){u.cool2=0;u.target2=null;}
 // v79: ability state, written only onto tables that carry the capability
 if(t.rally)u.onMe=false;
 if(t.smokeCap)u.smoke=false;
 if(t.wf){u.wf=0;u.wfT=0;}
 // v80: the two Tan toggles, written only onto the tables that carry them
 if(t.valve){u.valve=false;u.vrt=0;}
 if(t.throttle)u.thr=false;
 /* v81: the Gray fields, written only onto the tables that carry them. shotT is
    the mirror of calmT - seconds since this man last FIRED, capped the same way
    so it cannot drift into a float where +dt stops changing it. A fresh sniper
    starts cold, i.e. already concealed. */
 if(t.camo)u.shotT=999;
 if(t.cshot)u.cs=false;
 if(t.ripple)u.rip=false;
 /* v82: the Blue fields. mvg is "did he move on his own last update", written
    at the foot of updateUnit and read by the Evasive term in applyDmg; fo is
    "is this passenger firing out", written by his CARRIER every tick, which is
    what saves a passenger needing a back-pointer to the aircraft holding him. */
 if(t.evade)u.mvg=false;
 if(t.flat)u.flat=false;
 /* v85: Sprint. One boolean on the Runner, exactly as Flat Out is one boolean on
    the Bike - the men INSIDE the radius carry nothing of their own, because the
    effect is read off the Runner at the point of use. That is what keeps a squad
    of twenty under a sprint from being twenty extra hashed fields. */
 if(t.sprint)u.spr=false;
 /* v86: the two Green fields, again written only onto the rows that carry them.
    bcast is the Broadcast toggle, one boolean on the truck in the shape Sprint
    already established. fuel is the balloon's gas, in SECONDS remaining, counted
    down in updateUnit - a clock rather than a stamp, so it is readable straight
    off the unit and does not need G.tick to interpret it. */
 if(t.bcast)u.bcast=false;
 if(t.balloon)u.fuel=BALLOON_FUEL;
 /* v87 THE FIRST UNIT COOLDOWN. Written only onto rows that declare one, exactly
    as every ability field above it is, so a match with no Firebomb Heli in it
    snapshots byte-identically to a v86 match. The DURATION lives on the table row
    (t.abCd) rather than in the ability's own code, which is what makes this
    machinery rather than one unit's special case: v88's Paint declares 20 and
    needs nothing else. The building pair it mirrors is b.abilityCool. */
 if(t.abCd)u.abCool=0;
 u.paintT=0; // v88: NOT gated on a table flag, unlike every ability field around it - the mark is worn by units whose own row says nothing about it, so every unit is born unpainted
 if(t.assault)u.aslt=false;
 if(t.cap)u.fo=false;
 // machine gunner faces its entrench cone forward by default
 if(key==='gunner')u.coneDir=u.face;
 // v30: the APC starts with an empty troop bay
 if(t.cap)u.garrison=[];
 p.units.push(u);G.units.push(u);p.stats.built++;
 return u;
}
function makeBuilding(key,p,tx,ty,instant){
 const t=B[key],m=FAC[p.fac].mods;
 // if this building type's upgrade is already researched, it's built upgraded
 const up=UPGRADES[key]&&hasTech(p,'up_'+key);
 const mhp=Math.round(t.hp*m.hp*(up?UPGRADES[key].hp:1));
 const b={id:EID++,kind:'bld',key,t,p,tx,ty,sz:t.sz,x:tx+t.sz/2,y:ty+t.sz/2,
  hp:instant?mhp:20,mhp,prog:instant?1:0,upg:!!up,
  techCur:null,techT:0,
  queue:[],prodT:0,cool:0,abilityCool:0,upT:0,/* v79: upT is the Target Uplink's REMAINING duration; abilityCool stays its cooldown */tface:0,rally:{x:tx+t.sz/2,y:ty+t.sz+1.5},garrison:[],lastHit:'b',sel:false}; // v28: dead pre-v26 'seen' flag removed (was write-only, but serialized)
 for(let y=0;y<t.sz;y++)for(let x=0;x<t.sz;x++)G.map.pass[(ty+y)*G.map.N+(tx+x)]=0;
 pfDirty();
 p.blds.push(b);G.blds.push(b);
 return b;
}
function roster(p,key){
 const base=B[key].prod?B[key].prod.slice():[];
 if(key==='barracks')base.push(...FAC_INF[p.fac]);
 if(key==='garage')base.push(...FAC_VEH[p.fac]);
 if(key==='helipad')base.push(...FAC_AIR[p.fac]);
 // tech gate: a unit with a tech key only appears once that unlock is researched
 return base.filter(k=>!U[k].tech||hasTech(p,U[k].tech));
}
/* v71: the panel shows the FULL faction roster at all times, gated units included,
   so it stops growing as you research. roster() still returns only what is
   trainable right now and is what the AI and every non-panel caller reads. */
function fullRoster(p,key){
 const r=B[key].prod?B[key].prod.slice():[];
 if(key==='barracks')r.push(...FAC_INF[p.fac]);
 if(key==='garage')r.push(...FAC_VEH[p.fac]);
 if(key==='helipad')r.push(...FAC_AIR[p.fac]);
 return r;
}
/* v71: what each Construct host offers. The HQ carries the whole list. The
   Outpost carries a Barricade and a Guard Tower for its own 6-tile zone, plus an
   HQ, which is the ONLY way back into the game once your headquarters dies. */
const CONSTRUCT_OUTPOST=['barricade','guardtower','hq'];
function constructRoster(hostKey){
 return hostKey==='outpost'?CONSTRUCT_OUTPOST.slice():bldRoster(G.human);
}
/* v90.1 MENU ORDER. The roster used to be the order the structures SHIPPED in,
   with each army's exclusives spliced in wherever `ub` happened to land - so the
   Barracks sat beside the Supply Depot and the two walls sat at opposite ends of
   the menu. It is sorted now: what builds units, what pays for them, what shoots
   back, then everything else, alphabetical by the name the tile actually shows
   inside each shelf.
   The three producers are the one shelf that is NOT alphabetical, because their
   order is a tech order and reads as one - Barracks, then Garage, then Helipad,
   which is also the order they unlock in. MENU_PROD is that order; anything with
   cat 'prod' and no entry there sorts after the three by name, so a fourth
   producer is legal without editing this.
   Client-side only: constructRoster is read by refreshSelPanel and by nothing
   else, so the sort touches no seeded stream and nothing hashed. */
const MENU_CATS=['prod','eco','def','misc'];
const MENU_PROD=['barracks','garage','helipad'];
function menuRank(k){const i=MENU_CATS.indexOf(B[k].cat||'misc');return i<0?MENU_CATS.length:i}
function menuCmp(a,b){
 const ra=menuRank(a),rb=menuRank(b);
 if(ra!==rb)return ra-rb;
 if((B[a].cat||'misc')==='prod'){
  const ia=MENU_PROD.indexOf(a),ib=MENU_PROD.indexOf(b);
  const pa=ia<0?MENU_PROD.length:ia,pb=ib<0?MENU_PROD.length:ib;
  if(pa!==pb)return pa-pb;
 }
 return B[a].n<B[b].n?-1:B[a].n>B[b].n?1:0;
}
function bldRoster(p){const r=['barracks','supply','lab','generator','garage','guardtower','helipad','outpost','radiotower',...FAC[p.fac].ub,'barricade','hq'];r.sort(menuCmp);return r}
/* v50: ucost / bcost / rcost are the ONLY three cost sources in the file - every
   deduction, refund, salvage share and UI affordability check reads one of them -
   so testing mode's "free" is three returns and nothing else. G may be null here
   (the setup-screen Field Manual prices units before a match exists). */
function ucost(p,key){if(G&&G.test)return{p:0,e:0};const m=FAC[p.fac].mods.cost;return{p:Math.round(U[key].cp*m),e:Math.round(U[key].ce*m)}}
function bcost(p,key){if(G&&G.test)return{p:0,e:0};const m=FAC[p.fac].mods.cost;return{p:Math.round(B[key].cp*m),e:Math.round(B[key].ce*m)}}

