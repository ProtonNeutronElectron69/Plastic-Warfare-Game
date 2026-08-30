/* ============ DAMAGE / DEATH / FX + COUNTER MATRIX ============
   The counter matrix is weapon class x armor class.
   Every point of damage in the game passes through applyDmg, so one table gives the
   whole roster its counter play. Two layers, both static: nothing below is ever
   serialized or hashed, and every value is a literal so it reads as the final
   multiplier with no arithmetic in the way.
     armorOf(tgt)  the target's class: inf / light / medium / heavy / air / bldg / bug
     wcOf(atk)     the shot's class when the caller does not name one
     WVA[wc][ar]   the matrix
     UVA[key]      per-unit overrides; an override REPLACES a cell, never multiplies,
                   and an optional w: guard limits it to one of the unit's weapons.
   The 'x' row is flat 1.00 and is what mines, quicksand, burn DoT and creature bites
   resolve to, so all of those keep their v44 numbers exactly. */
const ARMOR_OF_A={inf:'inf',truck:'light',bike:'light',arty:'light',aa:'light',cmd:'light',jeep:'medium',apc:'medium',tank:'heavy',heli:'air'}; // v86: 'cmd' would fall to the same answer through the default below, and is listed so the Command Truck's class is stated rather than inferred
const ARMOR_LABEL={inf:'Infantry (soft)',light:'Light vehicle',medium:'Medium armor',heavy:'Heavy armor',air:'Aircraft',bldg:'Structure',bug:'Wildlife'};
const ARMOR_ORDER=['inf','light','medium','heavy','air','bldg'];  // display order; 'bug' is flat 1.00 and never listed
function armorOf(tgt){
 if(!tgt)return 'inf';
 if(tgt.kind==='bld')return 'bldg';                       // every structure lumped: HQ, tower, barricade, nest
 if(tgt.kind==='creature')return 'bug';                   // pinned at 1.00 everywhere - survival is untouched by v45
 const t=tgt.t;if(!t)return 'inf';
 return ARMOR_OF_A[t.a]||(t.fly?'air':'light');
}
const WC_BLD={guardtower:'b',bunker:'b',radiotower:'f'};   // v77: the tower's flame call-down is the Napalm Strike (the barrage scores on row q)
function wcOf(a){
 if(!a)return 'x';
 if(a.kind==='unit')return (a.t&&a.t.w)||'x';
 if(a.kind==='bld')return WC_BLD[a.key]||'x';
 return 'x';                                              // creatures, the mine ghost, the environment
}
const WVA={
 //          inf  light medium heavy  air   bldg  bug
 b:{inf:1.00,light:1.00,medium:0.85,heavy:0.60,air:1.00,bldg:0.70,bug:1.00}, // small arms: baseline, poor vs armor & walls
 g:{inf:1.20,light:1.00,medium:0.85,heavy:0.55,air:0.45,bldg:0.80,bug:1.00}, // frag: anti-personnel, cannot touch air
 r:{inf:0.70,light:1.10,medium:1.35,heavy:1.50,air:1.30,bldg:0.90,bug:1.00}, // AT rocket: the armor answer, needs escorts
 s:{inf:0.72,light:1.10,medium:1.20,heavy:1.10,air:0.85,bldg:1.40,bug:1.00}, // v51: cannon vs infantry 0.80 -> 0.72; row 's' is fired only by the Tank and the Bull
 m:{inf:1.15,light:1.00,medium:0.90,heavy:0.70,air:0.40,bldg:1.45,bug:1.00}, // arcing: siege king, not AA
 f:{inf:1.35,light:1.05,medium:0.75,heavy:0.45,air:0.50,bldg:0.90,bug:1.00}, // flame: melts men, useless on plate
 d:{inf:0.70,light:0.80,medium:0.80,heavy:0.85,air:0.30,bldg:1.25,bug:1.00}, // demolition: para HE charge, structures only
 a:{inf:0.00,light:0.00,medium:0.00,heavy:0.00,air:1.60,bldg:0.00,bug:1.00}, // v51: AA missiles. The zeros ARE the air-only rule, not decoration
 q:{inf:0.75,light:1.00,medium:1.00,heavy:1.00,air:1.00,bldg:1.00,bug:1.00}, // v76: artillery barrage. Its own row so no existing row moves
 x:{inf:1.00,light:1.00,medium:1.00,heavy:1.00,air:1.00,bldg:1.00,bug:1.00}  // unclassed: mines, hazards, burn DoT, bites
};
const UVA={
 heli:{w:'b',inf:1.30},                                   // v30: the Huey hoses down infantry
 para:{w:'b',inf:1.30},                                   // v30: SMG only - the AT and HE munitions score on rows r and d
 sniper:{w:'b',inf:1.40,medium:0.35,heavy:0.25},          // v45: pure anti-personnel; a rifle round does not dent a hull
 bazooka:{w:'r',heavy:1.76}                               // v51: 1.60 -> 1.76 (+10% vs heavy armor). Deliberately past the 1.6 band WVA rows are held to; UVA is the override layer and carries the exception
};
// Final multiplier for (unit key, weapon class, armor class). Pure lookup, no live
// entities needed, so the info screen reads the same numbers the sim does and the
// readout can never go stale.
function dmgMulFor(key,wc,ar){
 const o=key&&UVA[key];
 if(o&&(!o.w||o.w===wc)&&o[ar]!=null)return o[ar];
 const row=WVA[wc]||WVA.x;
 return row[ar]!=null?row[ar]:1;
}
/* v46: the readable side of the matrix. counterScan walks a weapon row, armorScan
   walks an armor column, and counterLine turns the pair into two short lines - what
   this thing beats, and what beats it. Every build button, every unlock research
   button, the selection panel and the info card are filled from here, so no counter
   text in the UI is hand-written and none of it can drift from WVA/UVA. Pure lookup:
   no live entity, no sim state, nothing hashed. */
const ARMOR_SHORT={inf:'Infantry',light:'Light veh',medium:'Medium',heavy:'Heavy',air:'Air',bldg:'Buildings',bug:'Wildlife'};
const WC_LABEL={b:'Small arms',g:'Grenades',r:'Rockets',s:'Cannon',m:'Arcing shells',f:'Flame',d:'Demolition',a:'AA missiles',q:'Artillery barrage'};
/* v76: weapon-class ROSTERS, generated rather than hand-written. The field manual
   used to spell each list out in prose, which is how the Bunker, the Paratrooper
   and the whole AA row went missing from it. Sources that are not units carry no
   U row, so they are named here; radiotower is skipped because the tower itself
   never fires, WC_BLD only gives its call-downs a weapon class. */
const WC_CALLDOWN={f:['Napalm Strike'],q:['Artillery Barrage'],d:['Paratrooper HE charge']};
function wcRoster(w){
 const out=[];
 for(const k in U)if(U[k].w===w)out.push(U[k].n);
 for(const k in WC_BLD){if(k==='radiotower')continue;if(WC_BLD[k]===w)out.push(B[k].n);}
 for(const n of (WC_CALLDOWN[w]||[]))out.push(n);
 return out.join(', ');
}
function counterScan(key,wc,strong){ // [armor,mul] pairs, best first
 const out=[];
 for(const ar of ARMOR_ORDER){const m=dmgMulFor(key,wc,ar);if(strong?m>=1.05:m<=0.95)out.push([ar,m]);}
 out.sort((a,b)=>strong?b[1]-a[1]:a[1]-b[1]);
 return out;
}
function armorScan(ar,hurts){ // the same table read down a column: what beats this armor
 const out=[];
 for(const wc in WVA){if(wc==='x')continue;if(wc==='a'&&ar!=='air')continue;const m=WVA[wc][ar];if(hurts?m>=1.05:m<=0.95)out.push([wc,m]);} // v51: an air-only row is not a ground 'resistance', it is a refusal to fire
 out.sort((a,b)=>hurts?b[1]-a[1]:a[1]-b[1]);
 return out;
}
function cMul(v){return (Math.round(v*100)/100).toString()}
function cJoin(list,lbl,cap){return list.slice(0,cap).map(e=>lbl[e[0]]+' \u00d7'+cMul(e[1])).join(', ')}
// two lines, each list capped so a tooltip stays glanceable
function counterLine(kind,key){
 /* v100: WILDLIFE HAS NO KEY. A creature is keyed by `species` into CREATURE,
    not by `key` into U or B, so every call that arrived here with kind
    'creature' dereferenced B[undefined] and threw on `.aaOnly` - which is what
    made a bug unselectable: pickAt returned it correctly and setSel stored it,
    then refreshSelPanel threw before drawing a single line, on that tick and
    on every tick after. Answered here rather than guarded at the call site
    because this function is the ONE place that turns an entity into its two
    counter lines, and the panel, the tooltip and the Field Manual all reach it.
    A creature's armor really is 'bug' (armorOf pins it) and its bite really is
    class 'x' (wcOf answers that for every creature), so both lines below are
    the same derivation every other entity gets, from the creature's own row. */
 if(kind==='creature'){
  const ct=CREATURE[key];
  if(!ct)return ['Unarmed','Armor '+ARMOR_SHORT.bug];
  const hurt=cJoin(armorScan('bug',true),WC_LABEL,2),res=cJoin(armorScan('bug',false),WC_LABEL,2);
  return [ct.dm?'Bites for '+Math.round(ct.dm)+' at '+ct.rg+' tiles'+(ct.burn?', and the bite BURNS':'')+(ct.aoe?', catching everything within '+ct.aoe+' tiles':''):'Unarmed',
          'Armor '+ARMOR_SHORT.bug+' \u2014 hurt by '+(hurt||'nothing in particular')+'; resists '+(res||'nothing')];
 }
 const t=kind==='unit'?U[key]:B[key];
 const ar=kind==='unit'?armorOf({kind:'unit',t}):'bldg';
 const wc=kind==='unit'?t.w:WC_BLD[key];
 let off;
 if(key==='para')off='Swaps munitions: SMG vs infantry, AT vs armor & air, HE vs buildings';
 else if(t.aaOnly)off='Air targets only \u2014 '+ARMOR_SHORT.air+' \u00d7'+cMul(dmgMulFor(key,wc,'air'))+'; cannot fire on the ground at all'; // v51
 else if(!t.dm||!wc)off='Unarmed';
 else off='Strong: '+(cJoin(counterScan(key,wc,true),ARMOR_SHORT,3)||'\u2014')+'  |  Weak: '+(cJoin(counterScan(key,wc,false),ARMOR_SHORT,3)||'\u2014');
 const hurt=cJoin(armorScan(ar,true),WC_LABEL,2),res=cJoin(armorScan(ar,false),WC_LABEL,2);
 return [off,'Armor '+ARMOR_SHORT[ar]+' \u2014 hurt by '+(hurt||'nothing in particular')+'; resists '+(res||'nothing')];
}
// the same two lines for a research card, keyed off what the unlock produces
function techTip(key){
 const r=RESEARCH[key];if(!r||r.kind!=='unlock')return '';
 if(r.bkey)return (B[r.bkey]&&B[r.bkey].dm)?'\n'+counterLine('bld',r.bkey).join('\n'):'';
 const uk=Object.keys(U).find(k=>U[k].tech===key);
 return uk?'\n'+counterLine('unit',uk).join('\n'):'';
}
// wc names the class of THIS shot; omit it and it is derived from the attacker.
// Only the paratrooper needs to name one, because one unit key fires three rows.
function targetDmgMul(attacker,tgt,wc){
 if(!tgt)return 1;
 const w80=wc||wcOf(attacker);
 /* --- v80 ABLATIVE PLATE ---
    The Bull's passive: weapon row 'b' does nothing to it at all. This is the
    defender-side door and therefore covers every applyDmg caller at once,
    including the ones that are easy to forget - WC_BLD maps BOTH the guard
    tower and the bunker onto row 'b', so neither can scratch a Bull, and a
    bunker fires as the BUILDING at a flat 8*HP_SCALE per garrisoned man, so
    loading bazookas into one does not change the row it scores on. The
    Paratrooper is the graceful case: his SMG is row 'b' but paraMun swaps him
    onto AT (row 'r') against armour, so paras still work. Sits ahead of
    dmgMulFor because it also supersedes the UVA overrides (the sniper's
    heavy 0.25 among them). */
 if(w80==='b'&&tgt.kind==='unit'&&tgt.t&&tgt.t.plate)return 0;
 /* --- v86 THE OBSERVATION BALLOON ---
    Sits beside the plate for the same reason and works the same way: a defender-
    side rule that SUPERSEDES the whole matrix rather than multiplying it. Row 'a'
    deals BALLOON_AA and every other row deals nothing at all, so the 1.60 that
    WVA.a.air normally hands an AA missile does not apply - a third is a third, not
    1.6x a third. Everything that is not an AA missile is refused acquisition
    outright at ballOk, so the zero here is the second lock rather than the first,
    in the same shape as row 'a' being zeros across the ground classes. */
 if(tgt.kind==='unit'&&tgt.t&&tgt.t.balloon)return w80==='a'?BALLOON_AA:0;
 return dmgMulFor((attacker&&attacker.kind==='unit')?attacker.key:null,w80,armorOf(tgt));
}
function applyDmg(tgt,amt,type,attacker,wc){
 if(tgt.hp<=0)return 0;
 amt*=targetDmgMul(attacker,tgt,wc);   // v45: wc omitted = derived from the attacker
 // difficulty stat knob: AI shots land harder on Hard, softer on Easy (players unaffected)
 if(attacker&&attacker.p&&attacker.p.ai)amt*=(attacker.p.diff||G.diff||DIFFS.normal).dmg;  // v23: per-slot difficulty

 // ---- v30 APC SHIELD: the carrier and allied infantry within 3 tiles take 25%
 // less damage from every source (never stacks across multiple APCs). v46: keyed on
 // t.shield, not t.cap - the Chinook is a transport too and must NOT inherit this. ----
 if(tgt.kind==='unit'&&tgt.t){
  if(tgt.t.shield)amt*=.75;
  else if(tgt.t.a==='inf'&&!tgt.garrisoned){
   for(const c of G.units){if(c.t.shield&&c.hp>0&&allied(c.p,tgt.p)&&(c.x-tgt.x)**2+(c.y-tgt.y)**2<=9){amt*=.75;break}}
  }
  /* v79 SMOKE. Friendly UNITS only, by decision: a cloud over a building does
     nothing. Clouds never stack with each other (first one wins, as the auras
     do), but this DOES multiply with the APC shield above - two independent
     sources, the same way the dump aura and the transport aura already stack on
     the attacker side. s.pi rather than s.owner because a strike outlives the
     mortar that fired it and loadState resolves a dead owner to null. */
  if(!tgt.garrisoned)for(const s of (G.strikes||[])){
   if(s.kind!=='smoke')continue;
   const sp=G.players[s.pi];
   if(!sp||!allied(sp,tgt.p))continue;
   if((s.x-tgt.x)**2+(s.y-tgt.y)**2<=SMOKE_R*SMOKE_R){amt*=(1-SMOKE_RED);break}
  }
 }
 /* --- THE SMOKESCREEN, ADDED AT v88 ---
    Sits OUT here rather than inside the `tgt.kind==='unit'` block that holds the
    mortar's cloud, because this one covers structures too - which is the single
    largest difference between the two and the reason it could not simply reuse
    that loop with bigger numbers. A square, not a disc, so what the reticle drew
    is what is covered. First screen wins, as every other cloud and aura does; it
    still multiplies with the APC shield, the mortar's smoke and the wall aura,
    on the v79 rule that independent sources stack.
    s.pi rather than s.owner, because a screen outlives the tower that laid it and
    loadState resolves a dead owner to null. */
 if(!(tgt.kind==='unit'&&tgt.garrisoned))for(const sc of (G.strikes||[])){
  if(sc.kind!=='smokescr')continue;
  const sp=G.players[sc.pi];
  if(!sp||!allied(sp,tgt.p))continue;
  const h=sc.n/2,pad=tgt.kind==='bld'?tgt.sz*.5:0;
  if(Math.abs(tgt.x-sc.x)-pad<=h&&Math.abs(tgt.y-sc.y)-pad<=h){amt*=(1-SMOKESCR_RED);break}
 }
 /* --- THE HEAVY BARRICADE'S SHADOW, ADDED AT v88 ---
    Read off the SOURCE at the point of use, like every other aura in the file -
    nothing is ever written onto what it shelters. Three things make it the odd
    one out, all of them by specification:
      it STACKS. Every defender-side reduction before it takes the first source
      it finds and breaks; this one COUNTS them, so four overlapping walls reach
      HBARR_CAP and a fifth is wasted plastic. The cap is on the TOTAL and not on
      the number of walls, so it cannot be walked around by mixing wall types.
      it shelters STRUCTURES AND OTHER WALLS, not just units, which is why it sits
      out here rather than inside the `tgt.kind==='unit'` block above.
      it does NOT shelter itself. "The tiles immediately surrounding it" is the
      owner's wording and it excludes the tile the wall is standing on, which also
      keeps a lone wall honest about its own 150 HP.
    Chebyshev rather than Euclidean, because "immediately surrounding" is a ring
    of eight tiles and not a disc, and measured to the FOOTPRINT edge for
    buildings the way the Command Post and the Forward Pad already measure. */
 if(tgt.p&&G.blds){
  let hb=0;
  for(const wb of G.blds){
   if(!wb.t.hbarr||wb.prog<1||wb.hp<=0||wb===tgt||!allied(wb.p,tgt.p))continue;
   const pad=tgt.kind==='bld'?tgt.sz*.5:0;
   const dx=Math.max(0,Math.abs(wb.x-tgt.x)-pad),dy=Math.max(0,Math.abs(wb.y-tgt.y)-pad);
   if(dx<=HBARR_R&&dy<=HBARR_R)hb+=HBARR_RED;
  }
  if(hb>0)amt*=(1-Math.min(HBARR_CAP,hb));
 }
 /* --- PAINT, ADDED AT v88 ---
    "+25% damage from ALL sources" is one line and it has to be THIS line: applyDmg
    is the single defender-side door, so a multiplier written here is reached by
    every shell, every burn tick, every mine and every crush alike. Written on the
    TARGET as a clock rather than read off the Choktaw the way its Forward Observer
    is, and the difference is deliberate: an aura ends when its source dies, and a
    mark does not - the aircraft that painted a tank may be shot down a second
    later and the tank stays lit for the rest of the ten seconds. That makes
    paintT sim state, so it is hashed AND defaulted in loadState. */
 if(tgt.kind==='unit'&&tgt.paintT>0)amt*=1+PAINT_DMG;
 /* v81 LOCKDOWN. Defender-side, so it sits here beside the smoke reduction
    rather than in the ability path. Keyed on the building's own upT, which
    already ticks down in updateBld for every structure and is already hashed;
    upOn() gates on t.uplink, so a locked-down bunker cannot read as a running
    Radar Tent. */
 if(tgt.kind==='bld'&&tgt.t.lock&&tgt.upT>0)amt*=(1-LOCK_RED);
 /* v82 EVASIVE. Keyed on whether the bike DISPLACED on its own last update,
    not on its state: measured over three matches, 82.3% of a Scout Bike's
    incoming damage lands while it is parked in the attack state shooting and
    only 1.5% under an ordered march, so a state test would have been inert in
    the Shell Shock sense. Displacement covers 17.3%, which is the ceiling on
    what this passive can ever be worth and is recorded in tail_v82. */
 if(tgt.kind==='unit'&&tgt.t.evade&&tgt.mvg)amt*=(1-EVADE_RED);
 /* v80: what this call actually removed, capped at the HP that was there to
    remove. Pressure Valve's recoil is a share of damage DEALT, and overkill is
    not dealt - a 60-point shell into a 4 HP grunt deals 4. */
 const dealt80=Math.min(amt,tgt.hp);
 tgt.hp-=amt;tgt.lastHit=type;
 /* v84 ENCOUNTER LEDGER, written here because this is the single defender-side
    door and amt is final by this line - every multiplier above has been applied,
    so what lands in the ledger is what the class actually did to us. Deterministic
    sim, no srand: lockstep clients compute the same ledger from the same fight. */
 if(attacker&&attacker.kind==='unit'&&tgt.p&&tgt.p.ai&&tgt.p.ai.enc&&!allied(attacker.p,tgt.p)){
  const ar84=armorOf(attacker);
  if(tgt.p.ai.enc[ar84]!=null)tgt.p.ai.enc[ar84]+=amt;
 }
 // v79: seconds-since-damage, read by Sarge's regen and by a smoking mortar's target pick
 if(tgt.kind==='unit')tgt.calmT=0;
 // v25: hitting a wildlife nest structure wakes its swarm (see updateNeutrals)
 if(tgt.kind==='bld'&&tgt.key==='nest'){const pns=G.map.nests[tgt.nsi];if(pns&&!pns.dead)pns.poked=G.tick;}
 // neutral creatures are handled by their own updater; just register the hit
 if(tgt.kind==='creature'){if(tgt.hp<=0){tgt.hp=0;if(attacker&&attacker.kind==='unit'&&attacker.hp>0)vetRankUp(attacker);} // v29: creature kills earn veterancy (they bypass kill())
  else if(!tgt.target&&attacker&&attacker.kind&&attacker.kind!=='mine')tgt.target=attacker;return dealt80;} // v27.1: wildlife ignores mine ghosts too
 if(G.tick-(tgt.lastShrap||0)>3){tgt.lastShrap=G.tick;spawnShrapnel(tgt.x,tgt.y,FAC[tgt.p.fac].color,3+Math.random()*3|0,tgt.kind==='bld'?1.4:1);
  /* v92.1: small arms on hard plate ricochet (owner feedback). Class 'b' only -
     rockets and shells land their own explosions - and only against targets a
     bullet audibly cannot bite: medium/heavy armor and structures, minus the
     nest (a den is wood, and nest destruction is silent by the same decision).
     Rides inside the lastShrap throttle so it can never outpace the sparks the
     player sees; sfxRico thins itself further with Math.random, never srand. */
  const wr92=wc||wcOf(attacker),ar92=armorOf(tgt);
  if(wr92==='b'&&(ar92==='medium'||ar92==='heavy'||(ar92==='bldg'&&tgt.key!=='nest')))sfxRico(tgt.x,tgt.y);
 }
 if(tgt.p.ai)tgt.p.ai.lastHurt=G.tick;
 // ---- LOCAL CALL FOR HELP (v22): nearby idle / attack-moving friendlies converge
 // on the attacker when a unit or building is hit (human's units included). Explicit
 // move orders are never overridden. A damaged truck instead breaks off to bank its
 // cargo at the nearest drop, then resumes mining (worker flight).
 if(attacker&&attacker.kind&&attacker.p&&!allied(attacker.p,tgt.p)&&attacker.hp>0&&tgt.p.units){ // v29: allies never trigger retaliation
  if(tgt.kind==='unit'&&tgt.state==='amove'&&tgt.t.dm&&tgt.key!=='truck'&&!tgt.garrisoned&&!tgt.entrenched&&tgt.hp>0){
   tgt.savedDest=tgt.dest;orderAttack(tgt,attacker); // resumes savedDest after the fight
  }
  if(tgt.kind==='unit'&&tgt.key==='truck'&&tgt.hp>0&&(tgt.fleeT==null||G.tick-tgt.fleeT>90)&&(tgt.state==='togo'||tgt.state==='harvest'||tgt.state==='idle')){
   tgt.fleeT=G.tick;tgt.mining=false;tgt.state='return';tgt.path=null;
  }
  // v26: AI-owned combat units under fire break off low-value pursuits (or plain
  // marches) to return fire on a reachable attacker. Human orders are never
  // overridden; scouts keep scouting; throttled so crossfire can't ping-pong them.
  if(tgt.kind==='unit'&&tgt.p.ai&&tgt.t.dm&&tgt.key!=='truck'&&!tgt.garrisoned&&!tgt.entrenched&&!tgt.smoke&&!tgt.aiRole&&tgt.hp>0
     &&(tgt.state==='attack'||tgt.state==='move')
     &&(tgt.retalT==null||G.tick-tgt.retalT>90)){
   const da2=(attacker.x-tgt.x)**2+(attacker.y-tgt.y)**2,vr=viOf(tgt)+2;
   if(da2<=vr*vr){
    const cur=tgt.target;
    let sw=!cur||cur.hp<=0||cur.kind==='bld'||(cur.t&&!cur.t.dm);
    if(!sw&&cur!==attacker){const dc2=(cur.x-tgt.x)**2+(cur.y-tgt.y)**2;sw=dc2>da2*1.69}
    if(sw&&cur!==attacker){
     if(tgt.state==='move'&&tgt.dest)tgt.savedDest=tgt.dest; // resumes the march after the fight
     tgt.retalT=G.tick;orderAttack(tgt,attacker);
    }
   }
  }
  if((tgt.helpT==null||G.tick-tgt.helpT>45)){
   tgt.helpT=G.tick;const HR2=7*7;
   for(const v of tgt.p.units){
    if(v===tgt||v.garrisoned||v.entrenched||v.smoke||v.hold||v.aiRole||!v.t.dm||v.key==='truck')continue; // v29: held units stay put. v79: a smoking mortar has opted out of enemy targeting exactly as an entrenched gunner has
    if(v.state!=='idle'&&v.state!=='amove')continue;
    if((v.x-tgt.x)**2+(v.y-tgt.y)**2>HR2)continue;
    if(v.state==='amove')v.savedDest=v.dest;
    orderAttack(v,attacker);
   }
  }
 }
 // v27: enemy fire on any of your units or buildings drops a red blip on the minimap
 if(tgt.p===G.human&&attacker&&attacker.p!==G.human&&(attacker.kind==='creature'||(attacker.p&&attacker.p!==G.neutral)))atkPing(tgt.x,tgt.y);
 // alert the player when their own structures are attacked (throttled to ~5s)
 if(tgt.p===G.human&&tgt.kind==='bld'&&!tgt.t.barr&&attacker&&attacker.p&&attacker.p!==G.human){ // v88: neither wall raises the base alarm
  if(!G.underAttackT||G.tick-G.underAttackT>150){G.underAttackT=G.tick;msg('⚠ Your base is under attack!');pingEvent(tgt.x,tgt.y,'#ff6a5a');}
 }
 if(tgt.hp<=0)kill(tgt,attacker);
 // v27.1: never retaliate against the synthetic mine "attacker": it has no
 // position or hp, so chasing it froze ground units and NaN'd flyers
 else if(tgt.kind==='unit'&&tgt.state==='idle'&&attacker&&attacker.kind&&attacker.kind!=='mine'&&tgt.t.dm)orderAttack(tgt,attacker);
 return dealt80;
}
function kill(e,attacker){
 if(attacker&&attacker.p&&attacker.p.stats)attacker.p.stats.kills++;
 if(attacker&&attacker.kind==='unit'&&attacker.hp>0&&!e.t.barr)vetRankUp(attacker); // v29: veterancy (barricades excluded). v88: BOTH walls excluded - a promotion for shooting a wall is a promotion for shooting a heavier wall
 e.p.stats.lost++;
 const col=FAC[e.p.fac].color;
 const melted=e.lastHit==='ex'||e.lastHit==='fire';
 if(e.kind==='unit'){
  // v30: a destroyed APC pops its squad out first, each trooper keeping 85% HP
  /* v82: before this release a garrisoned man could not be hurt at all, so
     nothing ever had to take one out of a hold. Air Assault makes him
     killable in place, and a corpse left in the array reads as an occupied
     seat: the bay counts against the cap, the panel readout lies, and
     apcUnload would later set the corpse to 1 HP without fielding it. */
  if(e.garrisoned){
   for(const c of G.units){const gi=c.garrison?c.garrison.indexOf(e):-1;if(gi>=0){c.garrison.splice(gi,1);break}}
   for(const b of G.blds){const gi=b.garrison?b.garrison.indexOf(e):-1;if(gi>=0){b.garrison.splice(gi,1);break}}
  }
  if(e.t.cap&&e.garrison&&e.garrison.length)apcUnload(e,0.85);
  G.units.splice(G.units.indexOf(e),1);e.p.units.splice(e.p.units.indexOf(e),1);
  if(e.flag)dropFlag(e);
  // salvage: SALVAGE_FRAC of the unit's plastic build cost becomes a mineable wreck
  const salvage=Math.round((U[e.key].cp*FAC[e.p.fac].mods.cost)*SALVAGE_FRAC);
  if(salvage>0)spawnWreck(e.x,e.y,salvage,shade(col,.8));
  if(melted){stampMelt(e.x,e.y,col,e.t.big?16:10);spawnSmoke(e.x,e.y,3)}
  else stampBits(e.x,e.y,col,5);
  spawnShrapnel(e.x,e.y,col,10,1.4);
  // vehicles & aircraft cook off with a real fireball; infantry just burst
  const vehicle=e.t.a!=='inf';
  if(vehicle){spawnExplosion(e.x,e.y,e.t.big?1.3:.9);spawnSmoke(e.x,e.y,e.t.big?3:2,{rise:8,grow:6,life:2.4,r:4,col:'#333'});shakeAt(e.x,e.y,e.t.big?4:2.5);}
  else spawnDust(e.x,e.y,.7);
  if(vehicle)sfxBoom(e.x,e.y,e.t.big?'big':'med');else sfxPop(e.x,e.y);
 } else {
  // --- wildlife nest: smashing the den stops the swarm from respawning (v25) ---
  if(e.key==='nest'){
   G.blds.splice(G.blds.indexOf(e),1);const ni=e.p.blds.indexOf(e);if(ni>=0)e.p.blds.splice(ni,1);
   G.map.pass[e.ty*G.map.N+e.tx]=1;pfDirty();
   const ns=G.map.nests[e.nsi];let ncol='#b08a52';
   if(ns){ns.dead=true;ns.alive=0;ns.aggro=false;if(CREATURE[ns.species])ncol=CREATURE[ns.species].col;}
   stampBits(e.x,e.y,'#b08a52',6);spawnShrapnel(e.x,e.y,ncol,14,1.5);spawnDust(e.x,e.y,1);
   spawnSmoke(e.x,e.y,2,{rise:6,grow:4,life:1.2,r:2.5,col:'#5a4a30'});
   shakeAt(e.x,e.y,2.5);sfxNestBreak(e.x,e.y);
   if(G.sel.includes(e)){G.sel.splice(G.sel.indexOf(e),1);lastSelSig=''}
   return;
  }
  // --- barricade: lightweight teardown (salvages at SALVAGE_FRAC like other structures; still no garrison pop / no elim trigger) ---
  if(e.t.barr){ // v88: t.barr, so the Heavy Barricade takes the same 1x1 teardown rather than the full building blast
   G.blds.splice(G.blds.indexOf(e),1);const bi=e.p.blds.indexOf(e);if(bi>=0)e.p.blds.splice(bi,1);
   G.map.pass[e.ty*G.map.N+e.tx]=1;pfDirty();
   const bcol=e.p===G.neutral?'#5a5a60':col;
   const bsalv=Math.round((B.barricade.cp*FAC[e.p.fac].mods.cost)*SALVAGE_FRAC); // plastic salvage
   if(bsalv>0)spawnWreck(e.x,e.y,bsalv,shade(bcol,.8));
   stampBits(e.x,e.y,bcol,6);spawnShrapnel(e.x,e.y,bcol,12,1.4);spawnDust(e.x,e.y,.8);
   if(melted)spawnSmoke(e.x,e.y,2,{rise:6,grow:4,life:1.3,r:2.5,col:'#444'});
   shakeAt(e.x,e.y,2);sfxStructBreak(e.x,e.y);
   if(G.sel.includes(e)){G.sel.splice(G.sel.indexOf(e),1);lastSelSig=''}
   return;
  }
  // if it was mid-research, release that project so it can be re-researched later
  if(e.techCur){const qi=e.p.techQ.indexOf(e.techCur);if(qi>=0)e.p.techQ.splice(qi,1);e.techCur=null;}
  G.blds.splice(G.blds.indexOf(e),1);e.p.blds.splice(e.p.blds.indexOf(e),1);
  for(let y=0;y<e.sz;y++)for(let x=0;x<e.sz;x++)G.map.pass[(e.ty+y)*G.map.N+(e.tx+x)]=1;
  pfDirty();
  // salvage: SALVAGE_FRAC of the building's plastic build cost becomes mineable wreckage
  const bsalv=Math.round((B[e.key].cp*FAC[e.p.fac].mods.cost)*SALVAGE_FRAC);
  if(bsalv>0){
   // larger buildings drop their salvage as a couple of wreck piles spread across the rubble
   const piles=e.sz>=3?2:1, per=bsalv/piles, wcol=shade(col,.78);
   for(let i=0;i<piles;i++){const ox=(srand()-.5)*(e.sz-1),oy=(srand()-.5)*(e.sz-1);spawnWreck(e.x+ox,e.y+oy,per,wcol);}
  }
  for(const u of e.garrison){ // pop out at half hp
   u.garrisoned=false;u.hp=Math.max(1,u.hp*.5);const sp=spawnSpot(e);u.x=sp.x+srand()-.5;u.y=sp.y+srand()-.5;
  }
  stampMelt(e.x,e.y,col,14+e.sz*5);stampScorch(e.x,e.y,e.sz*14);
  spawnShrapnel(e.x,e.y,col,26,2.2);
  // a big primary blast plus staggered secondary cook-offs across the footprint
  spawnExplosion(e.x,e.y,1.8+e.sz*.2);
  for(let s=0;s<2+e.sz;s++){const ox=(Math.random()-.5)*e.sz,oy=(Math.random()-.5)*e.sz,dl=.06+s*.07;
   setTimeout2(()=>{if(G)spawnExplosion(e.x+ox,e.y+oy,.8+Math.random()*.5)},dl);}
  // thick column of black smoke that lingers over the rubble
  spawnSmoke(e.x,e.y,6+e.sz*2,{rise:10,grow:8,life:2.8+e.sz*.3,r:5,col:'#2e2e2e'});
  shakeAt(e.x,e.y,7);sfxBuildingDestroy(e.x,e.y);
  checkElim(e.p);
 }
 if(G.sel.includes(e)){G.sel.splice(G.sel.indexOf(e),1);lastSelSig=''}
}
function checkElim(p){
 if(p===G.neutral)return;            // the neutral barricade owner is never "eliminated"
 if(!p.alive)return;
 // a player is out once they have no real buildings left — lone barricades don't keep them alive
 if(p.blds.every(b=>b.t.barr)){ // v88: t.barr - an army left holding only HEAVY walls is out on exactly the same rule
  p.alive=false;
  // hand any surviving barricades to the neutral owner so the walls stay (now dark-gray)
  for(const b of p.blds.slice()){p.blds.splice(p.blds.indexOf(b),1);b.p=G.neutral;G.neutral.blds.push(b);}
  msg(`${FAC[p.fac].name} has been eliminated!`);
  // their units surrender (pop into shrapnel)
  for(const u of p.units.slice()){if(u.flag)dropFlag(u);spawnShrapnel(u.x,u.y,FAC[p.fac].color,8,1.2);stampBits(u.x,u.y,FAC[p.fac].color,4);G.units.splice(G.units.indexOf(u),1)}
  p.units.length=0;
  if(G.mode==='ctf'){const f=G.flags.find(f=>f.owner===p);if(f){if(f.carrier)f.carrier.flag=null;G.flags.splice(G.flags.indexOf(f),1)}}
  checkEnd();
 }
}
/* --- deathmatch time limit ---
   Deathmatch elimination requires every non-barricade structure down, which over
   32 measured bot-matches left 31 of 32 armies alive at ten minutes: armies of 3
   to 15 cannot clear bases of 13 to 30 buildings. DM_TIME caps the match and the
   board decides it.
   THE SCORE is standing base value: the sum of the TABLE cp+ce over each team's
   COMPLETED structures. Table values, not bcost(), so Green's 8% discount cannot
   make its base worth less than the identical Tan one. Completed only, matching
   supCap - a foundation is not a building yet. Barricades are excluded on the
   same rule checkElim already applies: a wall does not keep you alive, so it must
   not win you the match either, and 20-plastic hedgehogs would otherwise be the
   cheapest score in the game.
   TIES break on kills, then on team number, which makes the ordering total and
   therefore identical on every lockstep client.
   NO NEW STATE. dmLeft() is a comparison against G.tick. Nothing here is written
   to an entity, added to hashState or encoded into a snapshot; resolution marks
   the losing teams not-alive and hands off to checkEnd, so the human-lost,
   team-survives, spectate and watch-title paths are the ones already tested. */
function dmLeft(){return DM_TIME>0?Math.max(0,DM_TIME-Math.floor(G.tick/30)):0;}
function dmMMSS(v){const m=Math.floor(v/60),r=v-m*60;return m+':'+(r<10?'0':'')+r;}
function dmBaseWorth(p){
 let n=0;
 for(const b of p.blds){
  if(b.prog<1||b.t.barr)continue; // v88: neither wall counts toward base value
  const t=B[b.key];if(t)n+=t.cp+t.ce;
 }
 return n;
}
function dmStandings(){
 const ts={},out=[];
 for(const p of G.players){
  if(!p.alive)continue;
  let e=ts[p.team];
  if(!e){e=ts[p.team]={team:p.team,worth:0,kills:0};out.push(e)}
  e.worth+=dmBaseWorth(p);
  e.kills+=(p.stats&&p.stats.kills)||0;
 }
 out.sort((a,b)=>(b.worth-a.worth)||(b.kills-a.kills)||(a.team-b.team));
 return out;
}
function dmClock(){
 if(G.over||G.test||DM_TIME<=0)return;   // the sandbox has no match to lose
 if(G.tick<DM_TIME*30)return;
 const st=dmStandings();
 if(!st.length){endGame(false);return}
 const win=st[0].team;
 for(const p of G.players)if(p.alive&&p.team!==win)p.alive=false;
 msg('\u23f1 Time! Biggest base standing wins \u2014 '+st.map(e=>'team '+e.team+' \u2b22'+Math.round(e.worth)).join(', '));
 checkEnd();
}
function checkEnd(){
 if(G.over)return;
 if(G.mode==='surv')return; // v33: survival end conditions live in updateSurv
 // v29: TEAM end conditions (identical to the old FFA rules when every team number
 // is distinct). Offline: your side losing its last player ends the match, but a
 // dead human whose teammate fights on spectates with full vision instead of losing.
 // Online: the match runs until one team stands; eliminated locals spectate (v23).
 const aliveTeams=new Set(G.players.filter(p=>p.alive).map(p=>p.team));
 // v55: a spectate match has no local side, so the "your team is gone, you lose"
 // branch would end it the moment army 1 died with three armies still fighting.
 // It simply runs until one team stands; endGame names the survivor.
 if(G.watch){
  if(aliveTeams.size<=1){endGame(true);return}
 } else if(!G.net){
  if(!aliveTeams.has(G.human.team)){endGame(false);return}
  if(aliveTeams.size<=1){endGame(true);return}
  if(!G.human.alive&&!G.spectate){G.spectate=true;msg('You have been eliminated — your team fights on. Spectating.');}
 } else {
  if(!G.human.alive&&!G.spectate&&aliveTeams.size>1){G.spectate=true;msg('You have been eliminated — spectating.');}
  if(aliveTeams.size<=1){endGame(aliveTeams.has(G.human.team));return}
 }
 if(G.mode==='ctf'){
  const ts={};for(const p of G.players)ts[p.team]=(ts[p.team]||0)+p.score;
  for(const t in ts)if(ts[t]>=CTF_TARGET){endGame(+t===G.human.team);return}
 }
 if(G.mode==='koth'){
  const ts={};for(const p of G.players)ts[p.team]=(ts[p.team]||0)+p.kothScore;
  for(const t in ts)if(ts[t]>=KOTH_TARGET){endGame(+t===G.human.team);return}
 }
}
function endGame(win){
 G.over=true;
 /* v104: the sting, and only for a win the local player actually shares in.
    musWant() answers '' from here on, so the loop fades and the fanfare rings
    out over silence. A spectator (G.watch) has no side, so nothing fires. */
 if(win&&!G.watch)musVictory(); // v104.1: once-per-match gate; the mop-up trigger usually beat us to it
 // v55: "win" is meaningless without a local side - name the survivor instead,
 // and print one summary line per army rather than army 1's private stats.
 if(G.watch)watchEndTitle(win);
 else{
  document.getElementById('endTitle').textContent=win?'🏆 VICTORY!':'💀 DEFEAT';
  document.getElementById('endTitle').style.color=win?'#ffe34d':'#ff7d6b';
 }
 const s=G.human.stats;
 if(G.watch)document.getElementById('endStats').innerHTML=G.players.map(p=>`<b style="color:${FAC[p.fac].color}">${FAC[p.fac].name}</b> — built ${p.stats.built}, lost ${p.stats.lost}, kills ${p.stats.kills}${p.alive?'':' <span style="opacity:.6">(eliminated)</span>'}`).join('<br>');
 else document.getElementById('endStats').innerHTML=`Units built: <b>${s.built}</b> &nbsp; Units lost: <b>${s.lost}</b> &nbsp; Enemy kills: <b>${s.kills}</b>${G.mode==='ctf'?`<br>Flag captures: <b>${G.human.score}</b>`:(G.mode==='koth'?`<br>Hill control: <b>${Math.floor(G.human.kothScore)}s</b>`:'')}`;
 buildEndChart(); // v29: end-of-match performance chart
 document.getElementById('overlayCenter').style.display='flex';
}
/* ---------------- END-OF-MATCH CHART ----------------
   Army value / cumulative kills / mining rate over time, one line per player in
   faction colors, metric tabs, per-player toggle chips, auto-scaled axes. Reads
   G.statHist (sim state); everything here is client-side presentation only. */
let CHART={metric:'av',show:[]};
function buildEndChart(){
 const cv=document.getElementById('endChart'),tabs=document.getElementById('chartTabs'),togs=document.getElementById('chartToggles');
 const Hs=G.statHist;
 if(!Hs||Hs.t.length<2){cv.style.display='none';tabs.innerHTML='';togs.innerHTML='';return;}
 cv.style.display='block';
 CHART={metric:'av',show:G.players.map(()=>true)};
 tabs.innerHTML='';togs.innerHTML='';
 const tabBtns=[];
 [['av','Army Value'],['kl','Kills'],['mn','Mining Rate']].forEach(([k,n])=>{
  const b=document.createElement('button');b.className='opt ctab'+(k===CHART.metric?' sel':'');b.textContent=n;
  b.onclick=()=>{CHART.metric=k;tabBtns.forEach(x=>x.classList.remove('sel'));b.classList.add('sel');drawEndChart();sClick();};
  tabBtns.push(b);tabs.appendChild(b);
 });
 G.players.forEach((p,i)=>{
  const b=document.createElement('button');b.className='opt ctog sel';
  b.style.borderColor=FAC[p.fac].color;b.style.color=FAC[p.fac].color;
  b.textContent=FAC[p.fac].name.split(' ')[0]+(matchTeamed()?` (T${p.team})`:'');
  b.onclick=()=>{CHART.show[i]=!CHART.show[i];b.classList.toggle('sel',CHART.show[i]);drawEndChart();sClick();};
  togs.appendChild(b);
 });
 drawEndChart();
}
// the plotted series for player i; mining shows as a RATE (per minute) derived
// from the cumulative totals, the other two metrics plot their samples directly
function chartSeries(i){
 const Hs=G.statHist,r=Hs.rows[i];
 if(CHART.metric!=='mn')return r[CHART.metric];
 const out=[0];
 for(let j=1;j<r.mn.length;j++){const dm=(Hs.t[j]-Hs.t[j-1])/60||1;out.push(Math.max(0,(r.mn[j]-r.mn[j-1])/dm));}
 return out;
}
function niceMax(v){const p=Math.pow(10,Math.floor(Math.log10(Math.max(1,v))));const m=v/p;return (m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10)*p;}
function fmtVal(v){return v>=1000?(v/1000).toFixed(v>=10000?0:1)+'k':''+Math.round(v);}
function fmtTime(s){const m=Math.floor(s/60),ss=Math.round(s%60);return m+':'+(ss<10?'0':'')+ss;}
function drawEndChart(){
 const cv=document.getElementById('endChart'),c=cv.getContext('2d');
 const Hs=G.statHist;if(!Hs||!c)return;
 c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,cv.width,cv.height);
 const L=46,R=12,T=12,B2=26,W=cv.width-L-R,Hh=cv.height-T-B2;
 const n=Hs.t.length,tMax=Hs.t[n-1]||1;
 const series=G.players.map((p,i)=>CHART.show[i]?chartSeries(i):null);
 let yMax=1;for(const s of series)if(s)for(const v of s)if(v>yMax)yMax=v;
 yMax=niceMax(yMax);
 c.font='10px sans-serif';c.lineWidth=1;
 for(let g=0;g<=4;g++){
  const y=T+Hh-Hh*g/4;
  c.strokeStyle='#2b4a66';c.globalAlpha=g===0?.9:.35;
  c.beginPath();c.moveTo(L,y);c.lineTo(L+W,y);c.stroke();c.globalAlpha=1;
  c.fillStyle='#8fb3d9';c.textAlign='right';c.textBaseline='middle';c.fillText(fmtVal(yMax*g/4),L-5,y);
 }
 c.textAlign='center';c.textBaseline='top';
 for(let g=0;g<=4;g++)c.fillText(fmtTime(tMax*g/4),L+W*g/4,T+Hh+5);
 for(let i=0;i<series.length;i++){
  const s=series[i];if(!s)continue;
  c.strokeStyle=FAC[G.players[i].fac].color;c.lineWidth=2;c.beginPath();
  for(let j=0;j<n&&j<s.length;j++){const x=L+W*(Hs.t[j]/tMax),y=T+Hh-Hh*(Math.min(s[j],yMax)/yMax);j?c.lineTo(x,y):c.moveTo(x,y);}
  c.stroke();
 }
 c.textAlign='left';c.textBaseline='alphabetic';
}
document.getElementById('againBtn').onclick=()=>{netTeardown();document.getElementById('overlayCenter').style.display='none';document.getElementById('hud').style.display='none';document.getElementById('setup').style.display='flex';G=null};
document.getElementById('quitBtn').onclick=()=>{netTeardown();document.getElementById('hud').style.display='none';document.getElementById('setup').style.display='flex';G=null};

/* particles */
const PCAP=1200; // hard cap on live particles
function spawnShrapnel(x,y,col,n,pw){
 if(G.parts.length>PCAP)return;
 // a mix of flat plastic flecks (sh) and chunkier tumbling 3D debris (db)
 for(let i=0;i<n;i++){const a=Math.random()*6.28,v=(1+Math.random()*2.4)*pw;
  G.parts.push({t:'sh',x,y,z:6+Math.random()*8,vx:dcos(a)*v,vy:dsin(a)*v,vz:30+Math.random()*55*pw,col,life:.7+Math.random()*.5,w:2+Math.random()*3,ang:Math.random()*6.28,va:(Math.random()-.5)*14})}
 const nd=Math.max(1,n*.4|0);
 for(let i=0;i<nd;i++){const a=Math.random()*6.28,v=(1.4+Math.random()*2.2)*pw;
  G.parts.push({t:'db',x,y,z:5+Math.random()*8,vx:dcos(a)*v,vy:dsin(a)*v,vz:42+Math.random()*70*pw,col,life:.9+Math.random()*.7,w:2.6+Math.random()*3.4,ang:Math.random()*6.28,va:(Math.random()-.5)*18})}
}
// soft drifting smoke puff. opt: {col, rise, grow, life, r}
function spawnSmoke(x,y,n,opt){opt=opt||{};if(G.parts.length>PCAP)return;for(let i=0;i<n;i++)G.parts.push({t:'sm',x:x+(Math.random()-.5),y:y+(Math.random()-.5),z:opt.z!=null?opt.z:4,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.4,vz:(opt.rise!=null?opt.rise:14)+Math.random()*10,life:(opt.life!=null?opt.life:1.2)+Math.random(),r:(opt.r!=null?opt.r:6)+Math.random()*8,grow:opt.grow!=null?opt.grow:6,col:opt.col||null,seed:Math.random()*6.28,rot:(Math.random()-.5)*1.2})}
// rising glowing embers that fade orange->dark
function spawnEmbers(x,y,n,pw){pw=pw||1;if(G.parts.length>PCAP)return;for(let i=0;i<n;i++){const a=Math.random()*6.28,v=(.6+Math.random()*2)*pw;G.parts.push({t:'em',x,y,z:4+Math.random()*6,vx:dcos(a)*v,vy:dsin(a)*v*.6,vz:34+Math.random()*46*pw,life:.5+Math.random()*.6,r:.9+Math.random()*1.4})}}
// expanding flat dust ring kicked along the ground
function spawnDust(x,y,sc){if(G.parts.length>PCAP)return;G.parts.push({t:'du',x,y,life:.5+sc*.12,r0:3*sc,r:3*sc,sc});}
// a single low travelling shockwave ring (bright thin expanding ellipse)
function spawnShock(x,y,sc){if(G.parts.length>PCAP)return;G.parts.push({t:'sw',x,y,life:.32,sc});}
// a turbulent volumetric fireball that boils upward briefly
function spawnFireball(x,y,sc){if(G.parts.length>PCAP)return;for(let i=0;i<Math.max(2,3*sc|0);i++){const a=Math.random()*6.28,sp=(.3+Math.random()*1.1)*sc;G.parts.push({t:'fb',x:x+(Math.random()-.5)*.3,y:y+(Math.random()-.5)*.3,z:5+Math.random()*4,vx:dcos(a)*sp,vy:dsin(a)*sp*.6,vz:24+Math.random()*30,life:.34+Math.random()*.22,r:(7+Math.random()*7)*sc,seed:Math.random()*6.28})}}
/* The signature composite blast: a hot core flash, a boiling fireball, an
   outward shockwave + dust ring on the deck, thick lingering smoke, glowing
   embers and a few sparks. sc scales the whole event. */
function spawnExplosion(x,y,sc){
 sc=sc||1;
 G.parts.push({t:'ex',x,y,life:.36,sc}); // bright core flash (rendered richer below)
 spawnFireball(x,y,sc);
 spawnShock(x,y,sc);
 spawnDust(x,y,Math.max(1,sc));
 spawnSmoke(x,y,Math.max(2,3*sc|0),{rise:16,grow:9,life:1.5,r:5});
 // a couple of slow dark smoke columns linger after big blasts
 if(sc>=1)spawnSmoke(x,y,Math.max(1,sc*1.2|0),{rise:9,grow:7,life:2.2+sc*.4,r:4,col:'#3a3a3a'});
 spawnEmbers(x,y,Math.max(3,5*sc|0),sc);
 sparks(x,y,7,'#ffd86a',Math.max(4,6*sc|0));
}
/* v54: `r` is the SPLASH RADIUS IN TILES of the weapon that fired, and it is
   optional. Omitted, this is the v53 spawn exactly - which is what leaves the
   burn-DoT tick and all three napalm sites untouched. Passed, the burst also
   fills the damage disc at the impact point, which the line-only v53 spawn never
   did: the sim splashes at tgt with radius r while the paint was a thin streak
   between shooter and target.
   G.parts is absent from hashState and from the snapshot encoders, and this runs
   on Math.random rather than the seeded srand stream, so none of it can move a
   same-seed replay. */
function spawnFlame(x,y,tx,ty,r){if(G.parts.length>PCAP)return;
 const jet=r?9:6;
 for(let i=0;i<jet;i++){const t=Math.random();G.parts.push({t:'fl',x:x+(tx-x)*t+(Math.random()-.5)*.4,y:y+(ty-y)*t+(Math.random()-.5)*.4,z:4+t*3,vx:(tx-x)*.25,vy:(ty-y)*.25,vz:8+Math.random()*8,life:.34+Math.random()*.3,r:3+t*7,seed:Math.random()*6.28})}
 if(r>0){
  // bloom: sqrt(rand) spreads uniformly by AREA rather than clumping at the centre.
  // Blob radius is tied to r*HW so a wider weapon paints wider blobs, and the +4
  // floor keeps neighbours overlapping instead of reading as separate dots.
  const px=r*HW;
  for(let i=0;i<14;i++){
   const a=Math.random()*6.28,d=Math.sqrt(Math.random())*r;
   const ox=dcos(a)*d,oy=dsin(a)*d;
   G.parts.push({t:'fl',x:tx+ox,y:ty+oy,z:3+Math.random()*5,vx:ox*.5,vy:oy*.5,vz:10+Math.random()*12,life:.4+Math.random()*.34,r:px*.55+4+Math.random()*4,seed:Math.random()*6.28});
  }
  spawnEmbers(tx,ty,3,.7);
 }
 // a wisp of smoke trails each flame burst
 if(Math.random()<.6)spawnSmoke(x+(tx-x)*.7,y+(ty-y)*.7,1,{rise:10,grow:5,life:.9,r:3,col:'#4a4a4a',z:6});}
/* schedule a callback to fire after `delay` seconds of GAME time (respects pause) */
function setTimeout2(fn,delay){if(G&&G.timers)G.timers.push({fn,t:delay});}
/* a colored, thicker tracer streak used for bullet weapons so fire is easy to see */
function tracer2(x1,y1,z1,x2,y2,z2,col,wide){G.parts.push({t:'tr2',x1,y1,z1,x2,y2,z2,life:.085,col,w:wide||2.2})}
/* muzzle flash: a bright burst at the gun barrel. ang is screen-space firing angle. */
function muzzle(x,y,z,ang,col,sc){G.parts.push({t:'mz',x,y,z,ang,col:col||'#ffe27a',sc:sc||1,life:.11})}
/* impact sparks where a bullet lands */
function sparks(x,y,z,col,n){for(let i=0;i<(n||5);i++){const a=Math.random()*6.28,v=2+Math.random()*4;G.parts.push({t:'sk',x,y,z:z||8,vx:dcos(a)*v,vy:dsin(a)*v*.5,vz:18+Math.random()*30,col:col||'#ffd23f',life:.18+Math.random()*.18})}}
function paintMelt(x,y,col,size){
 const c=G.tctx,sx=isoX(x,y),sy=isoY(x,y),rnd=Math.random;
 c.save();c.globalAlpha=.92;
 for(let i=0;i<6;i++){const ox=(rnd()-.5)*size*1.3,oy=(rnd()-.5)*size*.65,r=size*(.4+rnd()*.5);
  const g=c.createRadialGradient(sx+ox-r*.3,sy+oy-r*.25,r*.1,sx+ox,sy+oy,r);
  g.addColorStop(0,shade(col,1.25));g.addColorStop(.6,col);g.addColorStop(1,shade(col,.62));
  c.fillStyle=g;c.beginPath();c.ellipse(sx+ox,sy+oy,r,r*.5,0,0,7);c.fill()}
 c.globalAlpha=.5;c.fillStyle='#fff';c.beginPath();c.ellipse(sx-size*.25,sy-size*.15,size*.3,size*.1,-.4,0,7);c.fill();
 c.restore();
}
function paintScorch(x,y,r){const c=G.tctx,sx=isoX(x,y),sy=isoY(x,y);c.save();c.globalAlpha=.4;const g=c.createRadialGradient(sx,sy,r*.1,sx,sy,r);g.addColorStop(0,'rgba(20,12,8,.9)');g.addColorStop(1,'rgba(20,12,8,0)');c.fillStyle=g;c.beginPath();c.ellipse(sx,sy,r,r*.5,0,0,7);c.fill();c.restore()}
function paintBits(x,y,col,n){const c=G.tctx;c.save();for(let i=0;i<n;i++){const sx=isoX(x,y)+(Math.random()-.5)*22,sy=isoY(x,y)+(Math.random()-.5)*11;c.fillStyle=Math.random()<.8?col:shade(col,.7);c.translate(sx,sy);c.rotate(Math.random()*6.28);c.fillRect(-2,-1.2,4,2.4);c.setTransform(1,0,0,1,0,0)}c.restore()}
/* --- THE HEAP A SOLD BUILDING LEAVES, ADDED AT v87.1 ---
   The fourth member of the decal family, and it exists because a sold building
   may not drop a resource NODE: selling already paid its owner in cash, and a
   mineable pile would pay twice - which is why sold structures left nothing but
   four flecks of plastic until now. This is scenery. It borrows plSphere so the
   heap reads as the same moulded plastic the salvage wrecks are made of, but it
   lives on the terrain canvas with the scorch marks, so nothing can path to it,
   mine it, select it or serialize it. */
function paintPile(x,y,col,size){
 const c=G.tctx,sx=isoX(x,y),sy=isoY(x,y);
 c.save();c.translate(sx,sy);
 c.globalAlpha=.3;c.fillStyle='#120e0a';c.beginPath();c.ellipse(0,0,size*1.2,size*.52,0,0,7);c.fill();c.globalAlpha=1;
 for(let i=0;i<9;i++){const a=i*1.5+x,ox=Math.cos(a)*size*.7,oy=Math.sin(a)*size*.28,r=size*(.3+.16*Math.sin(a*2));
  plSphere(c,i%3?col:shade(col,.72),ox,oy-r*.3,r,.62,false);}
 c.strokeStyle=shade(col,.5);c.lineWidth=2.2;c.lineCap='round';
 c.beginPath();c.moveTo(-size*.5,-1);c.lineTo(-size*.1,-size*.62);c.stroke();
 c.restore();
 paintBits(x,y,col,6);
}
/* ---------------- FOG HELPERS ----------------
   fogAt: the human-local fog state under a world point (0 unexplored,
   1 explored, 2 visible). UI/cosmetic use only; the sim never branches on it.
   Terrain decals (scorch/melt/bits) landing outside current vision queue up
   and are painted only once the tile is next seen, so fogged ground stays in
   its last-witnessed state. Screen shake is likewise vision-gated. */
function fogAt(x,y){
 if(!G||!G.fog)return 0;
 const N=G.map.N,xi=Math.floor(x),yi=Math.floor(y);
 if(xi<0||yi<0||xi>=N||yi>=N)return 0;
 return G.fog[yi*N+xi];
}
function shakeAt(x,y,v){if(fogAt(x,y)===2)G.shake=Math.max(G.shake,v)}
function ghostInit(){if(!G.ghost)G.ghost={blds:new Map(),nodes:[],nests:[],stampQ:[],goneNodes:[]};return G.ghost}
function queueStamp(s){const q=ghostInit().stampQ;q.push(s);if(q.length>400)q.shift()}
function flushStamps(){
 const q=G.ghost&&G.ghost.stampQ;if(!q||!q.length)return;
 for(let i=q.length-1;i>=0;i--){const s=q[i];if(fogAt(s.x,s.y)!==2)continue;q.splice(i,1);
  if(s.k==='s')paintScorch(s.x,s.y,s.r);else if(s.k==='m')paintMelt(s.x,s.y,s.col,s.r);else if(s.k==='p')paintPile(s.x,s.y,s.col,s.r);else paintBits(s.x,s.y,s.col,s.r)}
}
function stampScorch(x,y,r){if(fogAt(x,y)===2)paintScorch(x,y,r);else queueStamp({k:'s',x,y,r})}
function stampMelt(x,y,col,size){if(fogAt(x,y)===2)paintMelt(x,y,col,size);else queueStamp({k:'m',x,y,col,r:size})}
function stampBits(x,y,col,n){if(fogAt(x,y)===2)paintBits(x,y,col,n);else queueStamp({k:'b',x,y,col,r:n})}
function stampPile(x,y,col,size){if(fogAt(x,y)===2)paintPile(x,y,col,size);else queueStamp({k:'p',x,y,col,r:size})}


/* ---------------- FLAGS (CTF) ---------------- */
function dropFlag(u){const f=u.flag;f.carrier=null;f.x=u.x;f.y=u.y;f.home=false;u.flag=null;
 pingEvent(f.x,f.y,FAC[f.owner.fac].color);
 if(f.owner===G.human)msg('Your flag was dropped — touch it to return it!')}
function updateFlags(){
 for(const f of G.flags){
  if(f.carrier){
   f.x=f.carrier.x;f.y=f.carrier.y;
   const cp=f.carrier.p,myF=G.flags.find(x=>x.owner===cp);
   if(myF&&myF.home&&dhyp(f.carrier.x-myF.hx,f.carrier.y-myF.hy)<1.8){
    cp.score++;f.carrier.flag=null;f.carrier=null;f.x=f.hx;f.y=f.hy;f.home=true;
    pingEvent(f.hx,f.hy,FAC[cp.fac].color);
    msg(cp===G.human?`You captured the ${FAC[f.owner.fac].name.split(' ')[0]} flag! (${cp.score}/${CTF_TARGET})`:`${FAC[cp.fac].name} captured a flag! (${cp.score}/${CTF_TARGET})`);
    updateTopbar();checkEnd();
   }
   continue;
  }
  for(const u of G.units){
   if(u.t.fly||u.garrisoned)continue;
   if(dhyp(u.x-f.x,u.y-f.y)<.95){
    if(!allied(u.p,f.owner)&&!u.flag){ // v29: allies never steal each other's flags
     f.carrier=u;u.flag=f;f.home=false;
     pingEvent(f.x,f.y,FAC[f.owner.fac].color);
     msg(u.p===G.human?'You have the enemy flag! Bring it home!':(f.owner===G.human?'⚠ Your flag has been taken!':''));
     break;
    } else if(allied(u.p,f.owner)&&!f.home){ // v29: a teammate can return your flag
     f.x=f.hx;f.y=f.hy;f.home=true;
     if(f.owner===G.human)msg('Your flag has been returned!');
     break;
    }
   }
  }
 }
}

/* ---------------- KING OF THE HILL ---------------- */
function updateHill(dt){
 const h=G.hill;if(!h)return;
 const r2=h.r*h.r,inZone=new Set();
 for(const u of G.units){if(u.garrisoned)continue;if((u.x-h.x)**2+(u.y-h.y)**2<=r2)inZone.add(u.p);}
 inZone.delete(G.neutral);
 // v29: control is per TEAM — allies on the hill together still hold it. The score
 // accrues to the lowest-index zone player of the controlling team (deterministic),
 // and the TEAM's summed score wins. With distinct teams this is the old FFA rule.
 const zTeams=new Set([...inZone].map(p=>p.team));
 let holder=null;
 if(zTeams.size===1)for(const p of G.players){if(inZone.has(p)){holder=p;break}}
 if(holder!==h.holder){                       // control changed hands
  const prevTeam=h.holder?h.holder.team:null;
  h.holder=holder;
  if((holder?holder.team:null)!==prevTeam){   // hand-offs between allies stay quiet
   if(holder){msg(allied(holder,G.human)?(matchTeamed()?'👑 Your team controls the hill!':'👑 You control the hill!'):`👑 ${FAC[holder.fac].name} controls the hill.`);pingEvent(h.x,h.y,allied(holder,G.human)?'#7CFC6E':FAC[holder.fac].color);}
   else if(inZone.size>1){msg('👑 The hill is contested!');pingEvent(h.x,h.y,'#ffe34d');}
  }
 }
 if(holder){
  holder.kothScore+=dt;
  let ts=0;for(const p of G.players)if(p.team===holder.team)ts+=p.kothScore;
  if(ts>=KOTH_TARGET)endGame(allied(holder,G.human));
 }
}
/* ---------------- EVENT PINGS ---------------- */
// flag an on-map event: shows an expanding ring on the field & minimap, and becomes
// the target of the "jump to last event" hotkey (Space).
function pingEvent(x,y,col){
 if(!G)return;
 G.pings.push({x,y,col:col||'#ffe34d',t:0});
 if(G.pings.length>12)G.pings.shift();
 G.lastEvent={x,y};
}
/* v27: small red minimap blips wherever the enemy is landing hits on your
   units or buildings. Client-local cosmetics like G.pings: never hashed,
   never serialized. Clustered so a running battle reads as a few pulsing
   dots instead of a smear. */
function atkPing(x,y){
 if(!G||!G.atkPings)return;
 for(const p of G.atkPings)if(p.t<1.5&&(p.x-x)**2+(p.y-y)**2<36)return; // one blip per 6-tile cluster per 1.5s
 G.atkPings.push({x,y,t:0});
 if(G.atkPings.length>24)G.atkPings.shift();
 sAtkAlert(); // v27.1: subtle throttled audio nudge
}

