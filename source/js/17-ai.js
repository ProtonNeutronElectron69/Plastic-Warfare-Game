/* ---------------- AI ---------------- */
// modest defensive walling: a fairly defensive AI occasionally lays a short barricade
// line a few tiles in front of its base/outpost, facing the nearest enemy. capped &
// gated on spare plastic so it never starves the army or walls itself in.
function aiBarricades(p){
 const ai=p.ai,pr=ai.pr||AI_PROFILES.balanced;
 const wallCap=pr.defendFrac>=0.35?8:(pr.defendFrac>=0.2?5:3);
 const have=p.blds.filter(b=>b.key==='barricade').length;
 if(have>=wallCap)return;
 if(!p.blds.some(b=>b.key==='barracks'&&b.prog>=1))return;   // not in the opening
 const cost=bcost(p,'barricade').p;
 if(p.res.p<cost+220+(p.ai&&p.ai.saveExp?170:0)+(p.ai&&p.ai.saveHQ?bcost(p,'hq').p:0))return;  // keep army funded first, and the headquarters ahead of both (v90.1)
 if(ai.nextBarr==null)ai.nextBarr=20+Math.floor(srand()*40);
 if(ai.t<ai.nextBarr)return;
 ai.nextBarr=ai.t+40+Math.floor(srand()*60);            // bursts, not every tick
 const anchor=p.blds.find(b=>b.key==='outpost'&&b.prog>=1)||p.blds.find(b=>b.key==='hq');
 if(!anchor)return;
 // aim at the nearest enemy building, else map centre
 let tx=G.map.N/2,ty=G.map.N/2,bd=1e9;
 for(const q of G.players){if(q===p||!q.alive||allied(q,p))continue;for(const b of q.blds){const d=(b.x-anchor.x)**2+(b.y-anchor.y)**2;if(d<bd){bd=d;tx=b.x;ty=b.y;}}}
 const dx=tx-anchor.x,dy=ty-anchor.y,L=dhyp(dx,dy)||1,ux=dx/L,uy=dy/L;
 const px=-uy,py=ux,dist=4+srand()*2,cx=anchor.x+ux*dist,cy=anchor.y+uy*dist;
 const seg=2+Math.floor(srand()*2);                     // 2-3 segments wide
 for(let s=-(seg>>1);s<=seg>>1;s++){
  if(p.res.p<cost)break;
  const bx=Math.round(cx+px*s),by=Math.round(cy+py*s);
  if(bx<2||by<2||bx>=G.map.N-2||by>=G.map.N-2)continue;
  if(canPlace(p,'barricade',bx,by))placeBuilding(p,'barricade',bx,by);
 }
}
/* ---------------- AI TACTICAL HELPERS ---------------- */
// nearest passable, non-quicksand tile centre to (x,y); used to snap AI destinations
// (staging, waves, scouts, harass, skirmish) and to step idle units out of hazards.
// Falls back to the input point if nothing safe is found within 6 tiles.
function safeSpot(x,y){
 const N=G.map.N,bx=clamp(Math.floor(x),1,N-2),by=clamp(Math.floor(y),1,N-2);
 const ok=(tx,ty)=>tx>=1&&ty>=1&&tx<N-1&&ty<N-1&&passable(tx,ty)&&G.map.fld[ty*N+tx]!==2;
 if(ok(bx,by))return{x:bx+.5,y:by+.5};
 for(let r=1;r<=6;r++)for(let oy=-r;oy<=r;oy++)for(let ox=-r;ox<=r;ox++){
  if(Math.max(Math.abs(ox),Math.abs(oy))!==r)continue;
  if(ok(bx+ox,by+oy))return{x:bx+ox+.5,y:by+oy+.5};
 }
 return{x,y};
}
// ---- coarse INFLUENCE MAP: per-player combat power on an 8-tile cell grid ----
// rebuilt lazily once per game tick and shared by every AI. Powers three v22
// behaviors: tactical retreat (waves back off when locally outgunned), soft-spot
// targeting (waves hit weakly defended ground) and safer truck dispatch.
const INF_CELL=8;
function influence(){
 if(G.inf&&G.inf.t===G.tick)return G.inf;
 const N=G.map.N,W=Math.ceil(N/INF_CELL);
 const arr=G.players.map(()=>new Float32Array(W*W));
 const cell=(x,y)=>Math.min(W-1,Math.max(0,x/INF_CELL|0))+Math.min(W-1,Math.max(0,y/INF_CELL|0))*W;
 for(const u of G.units){if(u.garrisoned||!u.t.dm||u.hp<=0)continue;if(!u.p||u.p.i<0)continue;arr[u.p.i][cell(u.x,u.y)]+=u.t.dm*(u.hp/u.mhp);}
 for(const b of G.blds){if(!b.t.dm||b.prog<1||b.hp<=0)continue;if(!b.p||b.p.i<0)continue;arr[b.p.i][cell(b.x,b.y)]+=b.t.dm*1.3;}
 G.inf={t:G.tick,W,arr};
 return G.inf;
}
// summed combat power near (x,y) from pl's perspective: foe=true -> enemies, false -> own
function powAt(pl,x,y,foe){
 const I=influence(),W=I.W,cx=Math.min(W-1,Math.max(0,x/INF_CELL|0)),cy=Math.min(W-1,Math.max(0,y/INF_CELL|0));
 let s=0;
 for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
  const nx=cx+ox,ny=cy+oy;if(nx<0||ny<0||nx>=W||ny>=W)continue;
  const w=(ox||oy)?0.45:1;
  for(const q of G.players){if(!q.alive||q.i<0)continue;if(foe?(q!==pl):(q!==pl?false:true))s+=I.arr[q.i][ny*W+nx]*w;}
 }
 return s;
}
/* ---- COUNTER-AWARE PRODUCTION ----
   The bot reads its grudge target's army as an hp-weighted armor-class mix, then
   scores every affordable roster option through the v45 matrix: dps x expected
   multiplier per plastic. armyTilt bends the score instead of hard-picking roster
   ends (the old picks indexed roster ORDER, so a green 'heavy' bot took the 150
   mortar over the 260 Sarge). 15% of picks stay random so compositions vary.
   Live sim state only; nothing here is cached, serialized or hashed. The tilt
   exponent uses sqrt(sqrt()) - correctly rounded per IEEE 754, which the pow
   intrinsic is not - so the score is bit-identical across engines in lockstep. */
function aiFoeArmorMix(p){
 const ai=p.ai,q=(ai&&ai.grudge&&ai.grudge.alive)?ai.grudge:null;
 const mix={inf:0,light:0,medium:0,heavy:0,air:0};let tot=0;
 if(q)for(const u of q.units){
  if(u.key==='truck'||u.garrisoned||u.hp<=0)continue;
  const ar=armorOf(u);if(mix[ar]==null)continue;
  mix[ar]+=u.hp;tot+=u.hp;
 }
 if(tot>0)for(const k in mix)mix[k]/=tot;else mix.inf=1; // no intel yet: assume soft targets
 /* v84: earned intel blended OVER the live census rather than replacing it. The
    weight grows with the evidence, so a bot that has fought nobody behaves exactly
    as it did before v84, and ENC_CAP keeps the live read a say even at full
    confidence. Replacing outright was rejected: the census is perfect intel on the
    grudge target, and discarding it would make the bot WORSE at the one thing it
    was already good at. */
 const enc84=ai&&ai.enc;
 if(enc84){
  let et=0;for(const k in enc84)et+=enc84[k];
  if(et>0){
   /* ENC_CAP holds the live census a say - but only when there IS one. With the
      grudge target's army dead or unbuilt, tot was 0 and the line above fell back
      to the flat guess mix.inf=1; capping earned evidence against a guess would
      have a bot that has taken nothing but tank fire still read a quarter
      infantry. Evidence beats a guess outright, so the cap lifts exactly there. */
   const w=(tot>0)?Math.min(1,et/ENC_FULL)*ENC_CAP:1;
   for(const k in mix)mix[k]=(1-w)*mix[k]+w*(enc84[k]/et);
  }
 }
 return mix;
}
/* v59: composition class of a unit key. Air is tested first because a chopper is
   air whatever its 'a' field says, and the AA truck gets its own class so the
   insurance floor can be reasoned about apart from the vehicle share. */
function aiUnitClass(k){
 const t=U[k];
 if(!t)return 'inf';
 if(t.fly)return 'air';
 if(t.a==='aa')return 'aa';
 if(t.a==='inf')return 'inf';
 return 'veh';
}
/* v59: support units are fielded by their own doctrines in aiTick and are excluded
   from the army filter there, so they must not vote on composition either. */
/* v86: the Command Truck and the Observation Balloon join it. Both are unarmed, so
   aiPickUnit would never draw either of them anyway (its score is dps per plastic
   and theirs is zero); what this membership actually buys is that neither counts
   as a LINE FIGHTER in the army census, the ceiling or the composition vote, which
   is exactly what it buys for the Chinook. The two hand-typed copies of this list
   that used to sit in aiTick now read the table instead - they named the same four
   keys and would have quietly answered "line fighter" for these two. */
const AI_SUPPORT={truck:1,medic:1,apc:1,chinook:1,cmdtruck:1,balloon:1};
/* v75 AI ARMY CEILING, DERIVED FROM SUPPLY.
   The v69 ceiling grew on ai.t alone - 12 + minutes/3, clamped at 52 - and had no
   relationship to the supply system at all. Measured over 17,607 building-tick
   production decisions across three ten-minute four-player matches: the cap
   refused 33.8% of them and supply refused 2.4%, and a traced bot's supCap peaked
   at 44 of an available 110 because the only reason it ever built a depot was to
   restore six points of headroom it then never spent. So the game had two
   ceilings, the human played against the 110 and the bot against about 14.

   Reading supCap puts both on the same one, and makes the Supply Depot the growth
   lever for the bot exactly as it is for the human. The loop closes on its own:
   a bot fielding to this ceiling drives supFree down to about the pad, which is
   already what the depot block above tests, so no second trigger is needed.

   AI_SUP_UNIT is DERIVED, not guessed - the mean supply rank over the trainable
   COMBAT roster, which is the population this ceiling counts. AI_SUPPORT is
   excluded because aiTick excludes those four from its army count too, and their
   supply is charged against the reserve below instead. It re-derives itself if a
   unit is re-priced into another quartile, in the style of MEDIC_HEAL_RATE.

   The reserve is read LIVE rather than fixed: the support units a bot actually
   fields (up to nine trucks at 1, three medics at 3, a carrier at 3 or 4) already
   sit in p.units, so summing them is exact and self-correcting where a constant
   would drift. AI_SUP_PAD is the headroom on top, one 4-supply unit, so the bot
   never fields itself into a position where the next thing it wants cannot fit.

   AI_ARMY_FLOOR is v69's OPENING cap, kept so the early game is untouched: a bot
   with only an HQ has 10 supply, and trainUnit's supFree gate stops it long before
   twelve fighters, so the floor can never over-produce - it only stops the new
   formula from being TIGHTER than v74 was at minute zero. AI_ARMY_CEIL is v69's
   52, demoted from a design limit to a safety stop; a full 110 supply reaches
   about 34 by this formula on Normal, so it is not normally reachable.
   The difficulty multiplier stays where it was, on the ceiling rather than on the
   supply: a Hard bot runs right up against its supply, an Easy one holds back.
   Pure arithmetic over the tables and over p.blds / p.units: no RNG, no clock,
   nothing stored, nothing hashed. */
const AI_SUP_PAD=4;
const AI_ARMY_FLOOR=12;
const AI_ARMY_CEIL=52;
const AI_SUP_UNIT=(function(){
 let n=0,t=0;
 for(const k in U){
  if(U[k].noTrain||AI_SUPPORT[k]||!(U[k].dm>0))continue;
  n++;t+=supOf(k);
 }
 return n>0?t/n:2;
})();
function aiArmyCap(p){
 let sup=0;
 for(const u of p.units)if(AI_SUPPORT[u.key])sup+=supOf(u.key);
 const room=supCap(p)-sup-AI_SUP_PAD;
 const d=((p.diff||G.diff)||DIFFS.normal).army;
 const base=room>0?Math.floor(room/AI_SUP_UNIT*d):0;
 /* v69's bank pressure is unchanged and still additive. With supply as the real
    ceiling it can no longer over-produce anything - trainUnit's supFree gate has
    the last word - so the term now means "a rich bot may run at its ceiling"
    rather than "a rich bot is given a bigger one". */
 const c=base+Math.min(AI_BANK_CAP,(p.res.p/AI_BANK_STEP|0));
 return c<AI_ARMY_FLOOR?AI_ARMY_FLOOR:(c>AI_ARMY_CEIL?AI_ARMY_CEIL:c);
}
/* v60: the three selection constants, named rather than buried as literals in
   aiPickUnit / aiTick so the harness can read them and a tuning pass has one
   place to go.
   AI_EXPLORE  share of picks that ignore scoring entirely. 0.15 through v59;
               cut because the weighted draw below now does the variety work,
               and the uniform draw was the only thing that could put a mortar
               squad in front of a tank.
   AI_SAT_A    saturation coefficient: how hard a key's own share of the army
               discounts the next copy of it. At 0.6 a key already holding half
               the army is discounted 23%.
   AI_RICH_P   plastic bank above which a bot puts up a second barracks and
               garage. Production is army-cap bound, not plastic bound (measured
               at v59: healthy bots sit at 17-20 units against a cap of 15 and
               bank 3000-5300 plastic), so the second pair buys replacement
               speed and a second independent pick per tick, not a bigger army.
   AI_FAC_FLOOR v63: the share of the fighting army a bot keeps in its own
               faction's exclusive units. A quota rather than a bias, because
               the value function's gap is far too wide for a bias to cross:
               measured at v62 the exclusives held 0.6% of Green's army and 0.4%
               of Gray's, and the draw weight is the SQUARE of a score that
               priced a Mortar Squad at ~23% of a Machine Gunner ON THAT RUN.
               v78: tense fixed. Both figures are a dated v62 reading of a
               score the tuning tables move, not a live claim - the Gunner's
               own price and reload have moved twice since. Deliberately
               profile-independent - every personality wants the same 18%. */
const AI_EXPLORE=0.08, AI_SAT_A=0.6, AI_RICH_P=1200, AI_FAC_FLOOR=0.18;
/* v89: the composition classes aiUnitClass can return, in a FIXED order. The
   reserve below picks the neediest of them, and picking by object-key iteration
   would make that choice depend on which class the bot happened to unlock first.
   A literal list keeps the comparator total and engine-independent, the way the
   producer sort is already careful to be. */
const AI_CLASSES=['inf','veh','air','aa'];
/* v89 EXPENSIVE-CLASS RESERVE.
   AI_RSV_SHORT how far under target a class must sit before the bot starts
                banking for it. Matched to the 0.04 the producer stand-down
                already uses, so "short enough to act on" means one thing in
                both halves of the composition gate.
   Measured over eight probed bot-matches at v88.1: the barracks failed its
   affordability filter on 15.4% of its production chances, the garage on 44.7%
   and the helipad on 45.8%. Plastic was never being RATIONED between the three -
   it was being spent the instant it arrived, and a Grunt at 36 is affordable on
   a tick where a Huey at 200 is not. So the target mixes were asking for air and
   being refused delivery rather than being ignored: a balanced bot wanted 16.0%
   of its army in the air and held 6.4%, a turtle wanted 7.0% and held 0.6%.
   Standing the cheap producer DOWN cannot fix that. That gate only fires when a
   class is OVER target, and air sat under target for whole matches while the bank
   never once reached the price.
   This is the saveExp reserve pointed at a CLASS instead of at an outpost.

   PLASTIC WAS THE SMALLER HALF. Probing again with the reserve in, at a helipad
   decision that had already cleared the plastic filter the bank held a median of
   3,278 plastic - and supFree held 0. Below three, the price of a Huey in SUPPLY,
   on 71.4% of them, against a supCap already pinned at the 110 ceiling. The bot
   was not too poor to fly; it was full. Infantry at one supply a head reaches the
   cap first and holds it, and an aircraft can only ever be bought in the gap left
   by something dying, which the next Grunt closes at a third of the price.
   So the reserve holds BOTH resources, and both for as long as the class is short.
   The supply half is what actually moves air, and it costs nothing to be generous
   with: holding three points free is invisible on a tick where twenty are free, and
   is the whole game on a tick where none are. */
const AI_RSV_SHORT=0.04;
/* v90: how close to a producer's top price the bank must be before buyTilt starts
   holding out for it - an anti-stall floor, so a broke bot buys what it can instead
   of hoarding for something far off. Cut from the faction floor's own half-price
   idiom to a quarter after measuring: the bank at a production decision runs near
   100 plastic, and against a 239 Sarge a half-price gate switched the tilt off in
   exactly the band where it was supposed to bite, leaving the whole feature inert.
   The real guard against stalling is the faction-quota test beside it, not this. */
const AI_TILT_REACH=0.25;
/* v84 ENCOUNTER LEDGER. aiFoeArmorMix has always read a LIVE census of the grudge
   target's surviving units: perfect intel on one rival, no memory, and nothing at
   all from the other two in a three-opponent match. A wave of infantry that wipes
   a bot's army leaves no trace the moment it dies, which is exactly the signal a
   player means by "they keep coming at me with infantry".
   The ledger is damage TAKEN, per armour class, decaying. Damage rather than
   headcount because it is self-limiting - a unit that never fires never distorts
   the mix - and because it needs no new scan: applyDmg is already the one
   defender-side door. It feeds the SAME mix the scoring already consumes, so no
   new term joins aiPickUnit and the counter matrix does the work it always did. */
const ENC_HALF=75;    // seconds for a class's weight to fall by half
const ENC_FULL=1200;  // damage from one class before the ledger is trusted as far as ENC_CAP
const ENC_CAP=0.75;   // ...and the most of the mix it may ever supply, so live intel always keeps a say
const ENC_DECAY=Math.pow(0.5,(18/30)/ENC_HALF); // per AI tick, and aiTick runs every 18 sim ticks at 30Hz. Derived, never typed: a hand-written figure would drift the moment either cadence moved

/* v59: the incoming half of the intel picture. aiFoeArmorMix says what the grudge
   target is MADE of; this says what it SHOOTS with, as DPS shares keyed by unit so
   the UVA overrides (the Huey's 1.30 on infantry, the Sniper's 0.35 on medium) are
   not flattened into their weapon rows. Same blindness rules as the armor mix:
   trucks, garrisoned riders and corpses do not vote. No rng, no fog. */
function aiFoeWeaponMix(p){
 const ai=p.ai,q=(ai&&ai.grudge&&ai.grudge.alive)?ai.grudge:null;
 const acc={};
 let tot=0;
 if(q)for(const u of q.units){
  if(u.garrisoned||u.hp<=0||!u.t||!(u.t.dm>0))continue;
  const d=unitDPS(u.t);
  if(!(d>0))continue;
  const w=u.t.w||'x',id=u.key+'|'+w;
  if(!acc[id])acc[id]={key:u.key,w:w,share:0};
  acc[id].share+=d;tot+=d;
 }
 const out=[];
 if(tot>0)for(const id in acc){acc[id].share/=tot;out.push(acc[id]);}
 else out.push({key:'grunt',w:'b',share:1});
 return out;
}
/* v59: can any rival actually put something in the air? Capability, not sightings -
   a helipad counts whether or not it has finished, so the answer to air arrives
   with the pad rather than with the first gunship overhead. Reads rival rosters
   directly, exactly as aiFoeArmorMix already does; touches no fog and no rng. */
function aiFoeAirCap(p){
 for(const q of G.players){
  if(q===p||!q.alive||allied(q,p))continue;
  for(const u of q.units)if(u.t&&u.t.fly&&u.hp>0)return true;
  for(const b of q.blds)if(b.key==='helipad')return true;
 }
 return false;
}
/* v59: which composition classes this bot can put into production RIGHT NOW, read
   off its completed production buildings. This is the denominator every target
   share is renormalized over - assessed across ALL the bot's buildings, never off
   a single roster, or a barracks-only bot would read its army as 100% on target
   and a bot with a helipad would still be judged against an inf-only target. */
function aiProdClasses(p){
 const cls={};
 for(const b of p.blds){
  if(b.prog<1||!b.t.prod||b.key==='hq'||b.key==='outpost')continue;
  for(const k of roster(p,b.key)){
   if(AI_SUPPORT[k]||U[k].noTrain)continue;
   cls[aiUnitClass(k)]=1;
  }
 }
 return cls;
}
/* v59: profile targets renormalized over `cls`. The AA share is not a profile
   constant but a reaction: dormant until the grudge target actually flies, then
   scaled by how much of its army does. */
function aiMixWant(pr,cls,airShare){
 const mw=pr.mixWant||{inf:1,veh:0,air:0},want={};
 let tot=0;
 for(const c in cls){
  const v=(c==='aa')?(airShare>0.05?clamp(0.06+airShare*0.5,0.06,0.22):0):(mw[c]||0);
  want[c]=v;tot+=v;
 }
 if(tot>0)for(const c in want)want[c]/=tot;
 return want;
}
/* v59: current shares of the fighting army over the same class set. Counts, not
   plastic and not supply: the mix the player actually sees on screen. */
function aiMixHave(p,cls){
 const have={};
 let n=0;
 for(const u of p.units){
  if(AI_SUPPORT[u.key]||u.garrisoned||u.hp<=0)continue;
  const c=aiUnitClass(u.key);
  if(cls[c]==null)continue;
  have[c]=(have[c]||0)+1;n++;
 }
 if(n>0)for(const c in have)have[c]/=n;
 return have;
}
/* v60: the per-KEY half of the composition picture. aiMixHave says how the army
   splits across classes; this says how it splits across the units inside them,
   which is the axis v59 had no view of at all. Same blindness rules as aiMixHave
   - support units, riders and corpses do not vote - so the two read the same
   army. No rng, nothing cached, nothing hashed. */
function aiKeyShare(p){
 const sh={};
 let n=0;
 for(const u of p.units){
  if(AI_SUPPORT[u.key]||u.garrisoned||u.hp<=0)continue;
  sh[u.key]=(sh[u.key]||0)+1;n++;
 }
 if(n>0)for(const k in sh)sh[k]/=n;
 return sh;
}
/* v63: what fraction of the fighting army is made of THIS faction's exclusive
   units. Same blindness rules as aiMixHave and aiKeyShare - support units,
   riders and corpses do not vote - so all three read the same army; that is also
   what keeps Blue's Chinook out of the count, since a transport must not be able
   to satisfy a fighting-army quota by itself. A faction with no exclusives
   (Wildlife) returns 1, i.e. its floor is vacuously met and it is never gated.
   No rng, nothing cached, nothing hashed. */
function aiFacShare(p){
 const uu=FAC[p.fac]&&FAC[p.fac].uu;
 if(!uu||!uu.length)return 1;
 let n=0,ex=0;
 for(const u of p.units){
  if(AI_SUPPORT[u.key]||u.garrisoned||u.hp<=0)continue;
  n++;if(uu.indexOf(u.key)>=0)ex++;
 }
 return n>0?ex/n:0;
}
/* v63: does this building's roster hold a faction exclusive the bot would
   actually field as a line fighter? Support keys are excluded on purpose - the
   Chinook is in Blue's exclusive list but is filtered out of `opts` by its own
   doctrine, so counting it would exempt Blue's helipad for nothing. */
function aiBldHasFac(p,bkey){
 const uu=FAC[p.fac]&&FAC[p.fac].uu;
 if(!uu||!uu.length)return false;
 for(const k of roster(p,bkey)){
  if(AI_SUPPORT[k]||U[k].noTrain)continue;
  if(uu.indexOf(k)>=0)return true;
 }
 return false;
}
function aiPickUnit(p,pr,opts){
 if(!opts.length)return null;
 // v51: the armor mix consumes NO rng, so hoisting it above the exploration draw
 // leaves the srand stream exactly where v48 put it.
 const mix=aiFoeArmorMix(p);
 // v59: the incoming rows, read here for the same reason the armor mix is read
 // here - neither consumes rng, so the srand stream stays where v48 put it.
 const wmix=aiFoeWeaponMix(p);
 const fighters=p.units.filter(u=>u.t.dm>0&&!u.garrisoned);
 let pool=opts;
 /* v59 ANTI-AIR INSURANCE. Through v58 the exclusion below was a deadlock: no bot
    ever flew, so no bot ever bought air defence, so the first chopper of the match
    met nothing at all. Once ANY rival CAN fly, the profile now holds a standing
    floor of trucks and that floor outranks the exclusion. While nobody can fly the
    v51 rule stands untouched, which is what keeps an all-ground match clean. */
 let aaHave=0;
 for(const u of p.units)if(u.key==='aatruck'&&!u.garrisoned&&u.hp>0)aaHave++;
 const aaPair=pr.aa||[1,1];
 // Thresholds are 6 and 16 fighters, not 10 and 24: measured bot armies run 8-12
 // under v59 pacing, so the higher pair was unreachable and the floor never fired.
 const aaFloor=(fighters.length<6||!aiFoeAirCap(p))?0:(fighters.length>=16?Math.max(aaPair[0],aaPair[1]):aaPair[0]);
 const aaShort=aaHave<aaFloor&&opts.indexOf('aatruck')>=0;
 // An air-only unit is dead weight against a ground army, so it leaves the pool
 // entirely - including the exploration draw - until the foe actually flies something.
 if(mix.air<0.08&&!aaShort){const g=opts.filter(k=>!U[k].aaOnly);if(g.length)pool=g;}
 // v59: insurance is a hard priority, so it short-circuits ahead of the draws.
 if(aaShort)return 'aatruck';
 /* v63 FACTION FLOOR. The value function is damage-per-plastic and a faction's
    signature pieces are priced above the line units they compete with, so
    through v62 they lost essentially every draw they entered. While the
    exclusive share sits under AI_FAC_FLOOR and this pool can supply one, the
    pool narrows to the exclusives and the weighted draw below runs inside it.
    The draw is untouched; only the set it draws from moves - which is why a
    faction with two exclusives still chooses BETWEEN them on merit. Ranks below
    the AA insurance above: that answers a threat, this answers a doctrine.
    Consumes no rng, so it cannot desync two clients in lockstep. */
 if(aiFacShare(p)<AI_FAC_FLOOR){
  const uu=FAC[p.fac].uu,fx=pool.filter(k=>uu.indexOf(k)>=0);
  if(fx.length)pool=fx;
 }
 if(pool.length===1)return pool[0];
 if(srand()<AI_EXPLORE)return pool[Math.floor(srand()*pool.length)]; // v60: 0.15 -> AI_EXPLORE; the draw below carries variety now
 // anti-air floor: while the foe fields real air power and our own AA share is
 // thin, only weapon rows that can answer it (b/r/s) stay eligible.
 if(mix.air>0.2){
  let aaN=0;for(const u of fighters)if('brsa'.indexOf(u.t.w||'')>=0)aaN++;
  if(fighters.length&&aaN/fighters.length<0.5){
   const f=pool.filter(k=>'brsa'.indexOf(U[k].w)>=0); // v51: row 'a' is the dedicated answer
   if(f.length)pool=f;
  }
 }
 /* v59: within-pool composition bias. This layer only bites on a pool that spans
    classes (the garage's vehicles against its AA truck); a uniform multiplier
    cannot trade a barracks grunt for a helipad gunship, which is why aiTick also
    gates production at the BUILDING level. Both layers read the same targets. */
 const pcls=aiProdClasses(p);
 for(const k of pool)pcls[aiUnitClass(k)]=1;
 const want=aiMixWant(pr,pcls,mix.air),have=aiMixHave(p,pcls);
 const kshare=aiKeyShare(p);
 // v60: cumulative weights for the draw below, in place of a running maximum.
 const wkey=[],wcum=[];
 let wsum=0;
 for(const k of pool){
  const t=U[k],dps=unitDPS(t); // v51: salvo-aware, identical to dm/rt for every other unit
  if(dps<=0)continue;
  let eff=0;for(const ar in mix)eff+=mix[ar]*dmgMulFor(k,t.w,ar);
  let s=dps*eff/(t.cp+t.ce*0.5);
  /* v59 SURVIVABILITY. Through v58 the score was damage-per-plastic and nothing
     else, so a hull that shrugs off the incoming rows was valued only for what it
     shot. Effective HP is the hull divided by what the grudge target's weapons
     actually do to THIS armor class, referenced to the grunt, under a square root
     so the term tilts rather than dominates. A tank reads 0.60x incoming from a
     rifle line and is priced accordingly; a bazooka-heavy foe correctly takes the
     shine back off it. */
  const myAr=ARMOR_OF_A[t.a]||(t.fly?'air':'light');
  let inc=0;
  for(const e of wmix)inc+=e.share*dmgMulFor(e.key,e.w,myAr);
  const ehp=t.hp/Math.max(0.15,inc);
  s*=Math.sqrt(ehp/U.grunt.hp);
  /* v59: shortfall bias toward whichever class the army is short of. Clamped both
     ways so a class that is merely unfashionable is discouraged, never banned. */
  const c=aiUnitClass(k);
  s*=clamp(1+2.2*((want[c]||0)-(have[c]||0)),0.35,2.6);
  /* v60 SATURATION. The class bias above cannot see inside a class, so a barracks
     that has already fielded nine Gunners rated the tenth exactly as highly as the
     first. Dividing by the key's own share of the fighting army makes each further
     copy a little less attractive than the last. It bends a run; it never bans a
     unit, because the share it divides by can never reach 1 for the key being
     scored while any other unit is alive. */
  s/=1+AI_SAT_A*(kshare[k]||0);
  if(pr.armyTilt==='heavy')s*=Math.sqrt(Math.sqrt((t.cp+t.ce*0.5)/100)); // lean pricey, gently
  else if(pr.armyTilt==='fast')s*=t.sp/3;                                // lean mobile
  else if(pr.armyTilt==='cheap')s*=Math.sqrt(Math.sqrt(100/(t.cp+t.ce*0.5))); // v59: lean cheap
  else if(pr.armyTilt==='range')s*=Math.sqrt(t.rg/4);                    // v59: lean long-ranged
  /* v60: a weight, not a running maximum. Zero-scoring options (an AA truck
     against an all-ground army scores a hard 0 through the matrix) contribute a
     zero-width band and can never be drawn. */
  wsum+=s*s;wkey.push(k);wcum.push(wsum);
 }
 /* v60 WEIGHTED DRAW, replacing argmax + jitter. The jitter was +-10% against
    measured in-roster score gaps of 1.7x and wider, so it could never reach across
    and one key took every pick the exploration draw did not - three keys held 72.6%
    of every army at v59. Each option now takes a band proportional to the SQUARE of
    its score: still firmly biased toward the best unit (gunner ~53% of a six-unit
    barracks roster) but with the rest of the roster genuinely reachable (grunt 18,
    sarge 14, bazooka 8, grenadier 6). The square is a multiply rather than
    the pow intrinsic - correctly rounded per IEEE 754, which pow is not - so two
    clients in lockstep draw the same unit. */
 if(!(wsum>0))return opts[Math.floor(srand()*opts.length)];
 const r=srand()*wsum;
 for(let i=0;i<wcum.length;i++)if(r<wcum[i])return wkey[i];
 return wkey[wkey.length-1];
}
function aiTick(p){
 const ai=p.ai;if(!p.alive)return;
 const pr=ai.pr||AI_PROFILES.balanced; // behavior profile (fallback for safety)
 ai.t++;
 if(ai.enc)for(const k in ai.enc)ai.enc[k]*=ENC_DECAY; // v84: old intel fades, so the mix tracks the fight rather than the whole match
 // ---- MOOD SHIFT (v22): one per bot per match, so personalities bend mid-game.
 // Passive profiles get a surprise all-in window; aggressive ones pause to mass up.
 if(!ai.moodDone&&ai.t>ai.moodAt){
  ai.moodDone=true;
  if(pr.aggro<0.9){pr.aggro=Math.min(1.35,pr.aggro*1.6);ai.pushSize=Math.max(5,Math.round(ai.pushSize*0.6));ai.nextPush=Math.min(ai.nextPush,ai.t+8);}
  else{ai.nextPush=ai.t+60+srand()*40;ai.pushSize=Math.min(pr.pushCap,ai.pushSize+4);}
 }
 const drops=p.blds.filter(b=>b.t.drop&&b.prog>=1);
 const hq=drops[0]||p.blds.find(b=>b.key==='hq');
 // light economy assist so the AI stays competitive without micro. The RATE is a pure
 // difficulty stat (eco), not a profile trait, so profiles differ only in playstyle.
 const eco=((p.diff||G.diff)||DIFFS.normal).eco;  // v23: per-slot difficulty
 p.res.p+=1.5*eco;p.res.e+=.45*eco;
 const has=k=>p.blds.some(b=>b.key===k);
 const count=k=>p.blds.filter(b=>b.key===k).length;
 const lowE=p.res.e<60;
 // v22: once the expansion timer fires, save plastic for the outpost by raising
 // the spending floor on discretionary buildings and army production.
 const maxOut=G.map.N>=64?3:2;
 const saveExp=ai.saveExp=ai.t>ai.nextExpand&&has('barracks')&&count('outpost')<maxOut;

 /* ---- REBUILD THE HEADQUARTERS ----
    Added at v90.1. A bot that loses its HQ is in the same hole the human was in before the
    minimap button: every build anchor placeDeny knows is a structure, and the
    two structures exempt from that rule were reachable only from a menu the bot
    does not use. checkElim does not finish it off either - an army holding a
    Barracks and a Guard Tower is still alive - so it stood on what was left
    until it was ground down. It is the FIRST spend of the tick because nothing
    else the bot can buy is worth more than being able to build again.
    The guard is the point: `noHQ` is a plain scan of p.blds, and while it is
    false nothing below it runs, so a bot that still has its HQ does not draw a
    single number out of the seeded stream. That is the same discipline the
    supply block above states - and it is why the pinned trails, which are thirty
    seconds long and in which no HQ ever dies, are untouched by any of this.
    placeBuilding is called directly here, as everywhere else in aiTick, so the
    lim:1 rule execCmd enforces for the human has to be re-stated on this side:
    the noHQ test IS that restatement. */
 const noHQ=ai.saveHQ=!p.blds.some(b=>b.key==='hq');
 /* The reserve, mirroring saveExp's: while it has no headquarters the bot holds
    the HQ's plastic back from discretionary spending. Without it the feature is
    dead on the bot's side and would look like it worked - v89 measured the median
    bank at a production decision near 100 against a Huey's 200, and this is 500.
    Trucks are deliberately NOT gated by it: they are how the bank reaches 500. */
 const hqRsv=noHQ?bcost(p,'hq').p:0;
 if(noHQ){
  const hc=bcost(p,'hq');
  if(p.res.p>=hc.p&&p.res.e>=hc.e){
   const hspot=aiFindSpot(p,'hq',hq||p.blds[0]);
   if(hspot)placeBuilding(p,'hq',hspot.x,hspot.y);
  }
 }

 // ---- TRUCKS / ECONOMY ----
 const trucks=p.units.filter(u=>u.key==='truck');
 // scale truck count with number of drop buildings (HQ + outposts)
 const wantTrucks=Math.min(9,2+drops.length*2); // v22: expansions add real economy
 const truckBld=drops.find(b=>!b.queue.length)||hq;
 if(truckBld&&trucks.length<wantTrucks&&p.res.p>=80&&(!truckBld.queue||!truckBld.queue.length))trainUnit(truckBld,'truck');
 for(const tr of trucks)if(tr.state==='idle'){const n=findNode(tr);if(n)orderHarvest(tr,n)}

 // ---- SUPPLY: never let the army stall on headroom. Ahead of the wish list
 // below because that loop breaks after one placement attempt per tick.
 // Depots still UNDER CONSTRUCTION count toward both tests. supCap only sees
 // prog>=1, so without the pending term the bot re-places every single tick
 // until the first one tops out and buries its own base in depots.
 // The guards run BEFORE aiFindSpot so a bot that needs nothing never touches
 // the seeded stream.
 (function(){
  let pend=0;for(const b of p.blds)if(b.prog<1)pend+=(b.t.sup||0);
  if(supFree(p)+pend>=6||supCap(p)+pend>=SUP_CAP)return;
  if(p.res.p<bcost(p,'supply').p+40)return;
  const sspot=aiFindSpot(p,'supply',hq);
  if(sspot)placeBuilding(p,'supply',sspot.x,sspot.y);
 })();

 // ---- BASE BUILDINGS ----
 // defensive/turtle profiles invest in more static defense; aggressive build fewer
 /* v90: a declared profile trait spanning 1..5 rather than a two-branch guess off
    defendFrac and aggro, which could only return 2, 3 or 4 and gave three of the
    five profiles the same ring. The fallback keeps a pre-v90 save loading: its
    stored profile has no towers field, and 3 is the value the old expression gave
    every profile that was neither a turtle nor a rusher. */
 const towerWant=pr.towers||3;
 // lab is built early (right after barracks) so the AI can start unlocking its tree
 /* v59: [key,needed] pairs rather than a key list plus a needed expression that
    could not tell the two guardtower entries apart.
    v60: the pad sits BETWEEN the first two towers. Asking for the pair up front
    still blocked it - measured at v59, two of eight bots (both defensive) had no
    helipad at all at minute 10 and so never built a single aircraft. One tower
    goes up, then the pad, then the second tower; the entry further down the list
    still tops the ring up to the profile's full towerWant. */
 /* v63: the Bunker and the Turbine are the two faction structures that actually
    SCALE - a second bunker is a second garrison, a second turbine is more power -
    so for Gray and Blue they move up beside the garage, the bot wants a pair, and
    a rich bot wants three. The Radar Tent and the Munitions Dump do not stack
    usefully (one radar already lights the map; a second dump's aura does not add),
    so Green and Tan keep their v62 slot and their single. The PAIR sits ahead of
    the full guard-tower ring rather than behind it: measured behind it, Gray
    finished a 600s match with exactly one bunker because a turtle wants four
    towers first, and a bunker is itself a defensive structure, so it earns the
    slot ahead of a third and fourth tower. The trailing standalone
    turbine entry goes with it: it was dead for the other three factions already,
    since techAvailable gates b_turbine to its owner, and for Blue the [ub,N]
    entries now subsume it. */
 /* v85: ub is a list, and "does this one get built in numbers" is now a table flag
    (B[k].mult) rather than a name check on 'bunker' or 'turbine'. Both readings had
    to change together: a hard-coded pair of names cannot answer the question for a
    second exclusive, and would have silently given every new structure the single
    late slot. The pass order below is unchanged for the four v84 factions - the
    mult entries lead, the singles sit after the radio tower - so this is a
    reshaping, not a reprioritising. */
 const ubs=FAC[p.fac].ub||[];
 /* v89: moving the pad UP this list was tried and reverted - it changed nothing,
    to the last decimal, across eight probed matches. The pad is not gated by its
    position here but by its RESEARCH: the loop skips any entry whose tech is not in
    yet, so the pad is passed over silently until b_helipad lands, and by then the
    bot can afford it wherever it sits. Anything that wants aircraft on the field
    sooner has to move b_helipad up aiResearch's plan, not this one. */
 /* v90: a stacking exclusive that is DEFENSIVE - it shoots or it garrisons, read
    off the table's own tower/gar flags rather than by naming 'bunker' - now climbs
    the SAME ladder the guard tower does (1, then min(2,towerWant), then towerWant),
    so a turtle rings itself with bunkers and a rusher puts up one. One that is not
    defensive keeps the flat 1/2/3 it has had since v63: Blue's Turbine is power,
    and a turtle needs no more electricity than a rusher does. Keying this on the
    flags is the v88 lesson applied forward - the Heavy Barricade is the second
    'barr' row, and fourteen tests that meant "is a wall" had said key==='barricade'. */
 const defStack=k=>!!(B[k].tower||B[k].gar);
 const wish=[['barracks',1],['lab',1],['generator',2],['garage',1]];
 for(const ub of ubs)if(B[ub].mult)wish.push([ub,1]);
 wish.push(['guardtower',1],['helipad',1],['guardtower',Math.min(2,towerWant)],['radiotower',1]); // v48: +radiotower
 for(const ub of ubs)if(!B[ub].mult)wish.push([ub,1]);
 for(const ub of ubs)if(B[ub].mult)wish.push([ub,defStack(ub)?Math.min(2,towerWant):2]);
 wish.push(['guardtower',towerWant],['generator',2]);
 /* v60: a bot banking more plastic than it can spend puts up a second barracks and
    garage. Appended rather than inserted, so it is the lowest priority in the list
    and a poor bot's order of business is untouched. */
 if(p.res.p>=AI_RICH_P){wish.push(['barracks',2],['garage',2]);for(const ub of ubs)if(B[ub].mult)wish.push([ub,defStack(ub)?towerWant:3]);}
 for(const [k,needed] of wish){
  if(count(k)>=needed)continue;
  if(B[k].req&&!has(B[k].req))continue; // v59: was break, which blocked the whole tail
  // tech gate: the AI can't build a structure whose unlock it hasn't researched yet
  if(B[k].tech&&!hasTech(p,B[k].tech))continue;
  if(B[k].eps&&!ubs.includes(k)&&!lowE&&p.res.e>120)continue; /* only build power when needed - except (v63) this faction's own signature structure, which is built for identity rather than for load. v85: "is this a power building" reads B[k].eps rather than naming the generator and the turbine, which is the same two rows and stays right if a third is ever added */
  if(k==='radiotower'&&p.res.e<260)continue; // v48: the uplink is priced in ⚡ - wait for a surplus, never stall the list on it
  const c=bcost(p,k);
  if(p.res.p>=c.p+80+(saveExp?200:0)+hqRsv&&p.res.e>=c.e){const spot=aiFindSpot(p,k,hq);if(spot){placeBuilding(p,k,spot.x,spot.y);break}}
  // v59: was an unconditional break. Nothing later in the list is more expensive
  // than something earlier, so falling through can only ever reach something
  // CHEAPER that the bot can actually afford this tick.
  continue;
 }

 // ---- RESEARCH: keep idle labs busy unlocking the army, then upgrading it ----
 aiResearch(p);

 // ---- EXPANSION (v22): forward Outposts at uncovered nodes, re-armed over the match.
 // Up to 2-3 (map-size dependent); the timer re-arms after each placement and keeps
 // trying after an outpost dies or its node runs dry.
 if(ai.t>ai.nextExpand&&has('barracks')&&count('outpost')<maxOut&&p.res.p>=bcost(p,'outpost').p+30){
  const spot=aiOutpostSpot(p);
  if(spot){placeBuilding(p,'outpost',spot.x,spot.y);ai.nextExpand=ai.t+130+srand()*130;}
  else ai.nextExpand=ai.t+60; // nothing uncovered right now; check again later
 }
 // protect each outpost with a forward guard tower (at most one placement per tick)
 const outpost=p.blds.find(b=>b.key==='outpost'&&b.prog>=1);
 if(hasTech(p,'b_guardtower')&&has('barracks')&&p.res.p>=bcost(p,'guardtower').p+120){
  for(const op of p.blds){
   if(op.key!=='outpost'||op.prog<1)continue;
   const nearTurret=p.blds.some(b=>b.key==='guardtower'&&dhyp(b.x-op.x,b.y-op.y)<8);
   if(!nearTurret){const spot=aiFindSpot(p,'guardtower',op);if(spot){placeBuilding(p,'guardtower',spot.x,spot.y);break}}
  }
 }

 // ---- DEFENSIVE WALLS: lay a few barricades in front of the base toward the threat ----
 aiBarricades(p);

 // ---- ARMY PRODUCTION (always keep barracks/garage/helipad busy) ----
 const army=p.units.filter(u=>!AI_SUPPORT[u.key]&&!u.garrisoned); // v48: carriers & medics are support, not line fighters. v86: read off AI_SUPPORT rather than a second hand-typed copy of it
 const prodBlds=p.blds.filter(b=>b.prog>=1&&b.t.prod&&b.key!=='hq'&&b.key!=='outpost');
 /* v59 COMPOSITION GATE. Two problems fixed at once. First, prodBlds was in p.blds
    order, i.e. BUILD order, so the barracks always had first claim and drained the
    pool below the garage's affordability filter - expensive producers starved
    structurally. Second, nothing anywhere compared the army it had against the army
    it wanted. Buildings are now served worst-shortfall first, ties going to the
    pricier roster, and a building whose best class is already over target stands
    down entirely as long as something else is short. */
 const gCls=aiProdClasses(p);
 const gWant=aiMixWant(pr,gCls,aiFoeArmorMix(p).air);
 const gHave=aiMixHave(p,gCls);
 const bShort=b=>{
  let d=-9;
  for(const k of roster(p,b.key)){
   if(AI_SUPPORT[k]||U[k].noTrain)continue;
   const c=aiUnitClass(k);
   if(!gCls[c])continue;
   const v=(gWant[c]||0)-(gHave[c]||0);
   if(v>d)d=v;
  }
  return d;
 };
 const bTop=b=>{
  let m=0;
  for(const k of roster(p,b.key)){
   if(AI_SUPPORT[k]||U[k].noTrain)continue;
   const v=U[k].cp+U[k].ce*0.5;
   if(v>m)m=v;
  }
  return m;
 };
 const gShort={},gTop={};
 for(const b of prodBlds){gShort[b.id]=bShort(b);gTop[b.id]=bTop(b);}
 // Sort is a pure comparator over precomputed numbers, so it consumes no rng and
 // cannot reorder differently between two clients on the same tick. Building id
 // breaks exact ties, which keeps it total rather than merely weak.
 prodBlds.sort((a,b)=>(gShort[b.id]-gShort[a.id])||(gTop[b.id]-gTop[a.id])||(a.id-b.id));
 const gAnyShort=prodBlds.some(b=>gShort[b.id]>0);
 /* v63: read the faction floor ONCE per tick rather than per building - it is a
    property of the army, not of the producer, and the loop below must not see it
    change halfway through. */
 const gFacShort=aiFacShare(p)<AI_FAC_FLOOR;
 /* v89: while a class is short and its own producer is standing there unable to
    pay, every producer that CANNOT supply that class must leave the price of the
    cheapest such unit in the bank. Re-derived per tick from the tables, p.res and
    p.blds: it stores nothing, hashes nothing, and consumes no rng, so it cannot
    desync two clients in lockstep.
    Three guards keep it a pause rather than a stall. The producer that would spend
    it must have a free queue slot, because plastic held against a full queue buys
    nothing. The shortfall must clear AI_RSV_SHORT, so a class that is merely a
    little behind never freezes the barracks. And the sum held is the CHEAPEST
    option of the class rather than the one the pick would most like, so the bot
    banks for a Huey and not for an Apache. Once the bank clears that price the
    reserve lifts by itself - the producer sort above already serves the shortest
    class first, so the very next pass spends it. */
 const gRsv=(function(){
  const cheap={},csup={};
  for(const b of prodBlds){
   if(b.queue.length>=2)continue;   // plastic or supply held against a full queue buys nothing
   for(const k of roster(p,b.key)){
    if(AI_SUPPORT[k]||U[k].noTrain)continue;
    const c=aiUnitClass(k);
    if(!gCls[c])continue;
    if(U[k].lim&&p.units.filter(u=>u.key===k).length>=U[k].lim)continue;
    const cp=ucost(p,k).p;
    if(cheap[c]==null||cp<cheap[c]){cheap[c]=cp;csup[c]=supOf(k);}
   }
  }
  /* The neediest class is the one furthest below target IN PROPORTION to that
     target, not in raw share. Ranking on the raw gap hands the reserve to whichever
     class was asked for in the largest quantity: probed at v88.1 the reserve chose
     vehicles on 25.4% of ticks and air on 13.6%, even on bots holding a third of
     the air they wanted, purely because a 0.32 vehicle target can be 0.10 adrift
     while a 0.17 air target cannot be adrift by more than 0.17 in the first place.
     The absolute floor stays as the ENTRY test, so a class a hair under target
     still does not freeze anyone; the proportion only decides who wins once more
     than one class is genuinely short. */
  let bc=null,bd=0;
  for(const c of AI_CLASSES){
   if(cheap[c]==null)continue;
   const w=gWant[c]||0,d=w-(gHave[c]||0);
   if(d<=AI_RSV_SHORT||w<=0)continue;
   const rel=d/w;
   if(rel>bd){bd=rel;bc=c;}
  }
  /* Both halves stand for as long as the class is short. Lifting the plastic half
     the moment the bank touched the price made it a race rather than a reserve -
     the bank was released, the cheap producer took it back before the pricey one
     was reached again, and the measured bank at a helipad decision sat at a median
     of 106 against a Huey's 200, tick after tick. It is not a saving when anyone
     may spend it. */
  return bc===null?null:{cls:bc,p:cheap[bc],s:csup[bc]};
 })();
 /* v75: the ceiling is aiArmyCap(p), derived from this bot's own supply capacity
    rather than from the clock. Profiles still shape army size via wave/commit
    behaviour below, and the difficulty multiplier still rides the ceiling. */
 const armyCap=aiArmyCap(p);
 if(army.length<armyCap){
  for(const b of prodBlds){
   if(b.queue.length>=2)continue;
   /* v59: over target while something else is short - stand down this tick.
      v63: unless this is the only kind of building that can put the faction's
      signature units on the field and the army is under the floor. Gray's Rocket
      Artillery and Tan's Bull are both GARAGE units, so an infantry-leaning
      profile parked the one producer that could ever build them; the pick-level
      floor above could not help, because the pick was never reached. */
   if(gAnyShort&&gShort[b.id]<-0.04&&!(gFacShort&&aiBldHasFac(p,b.key)))continue;
   /* v89: two reserves now stack on this filter, and the faction floor outranks
      both - exactly as it already outranked the expansion one. An exclusive the
      bot is under quota on is bought at its own price and nothing is held back
      against it; everything else pays the expansion reserve, plus the class
      reserve whenever it is not itself the class being banked for. */
   const bSup=supFree(p); // read once per producer: trainUnit spends it as the loop goes
   /* v90 BUY TILT. The profile's appetite for holding out, as a share of the gap
      between a unit's price and the priciest one this producer can build RIGHT NOW
      (roster() is tech-gated, so the bot never banks for a Sarge it cannot train).
      An aggressive bot is 0 and buys the moment anything is affordable, so it
      floods cheap bodies early; a turtle is 0.6 and arrives later with fewer,
      pricier, tougher ones. armyTilt could not do this on its own - it biases the
      CHOICE among options already affordable, and the cheap one is affordable
      first, so the expensive one never saw a tick where it was the only candidate.
      Derived per tick from ucost and the roster; stores nothing, hashes nothing,
      consumes no rng. Skipped outright at 0, so a rusher pays nothing for it. */
   const bTilt=pr.buyTilt||0;
   let topP=0;
   if(bTilt>0)for(const k of roster(p,b.key)){
    if(AI_SUPPORT[k]||U[k].noTrain)continue;
    const v=ucost(p,k).p;if(v>topP)topP=v;
   }
   /* Two guards, and the FIRST is the one that matters. A bot under its faction
      quota does not hold out at all: the floor already outranks both reserves
      above, its whole job is to get signature units onto the field, and a savings
      tilt stacked on top of it is the stall this file guards against twice over
      (the v59 wish list falls through rather than parking on what it cannot
      afford; the floor itself waits for an exclusive only while the bank is past
      half its price). The second is a plain anti-stall floor: nowhere near the top
      price, the bot buys what it can rather than hoarding for something a long way
      off. Measured, the bank at a production decision sits near 100, so this
      threshold decides whether the tilt does anything at all - at half the top
      price it never fired and the feature was inert. */
   const bHold=bTilt>0&&!gFacShort&&p.res.p>=topP*AI_TILT_REACH;
   const opts=roster(p,b.key).filter(k=>!AI_SUPPORT[k]) /* v86: the same four keys, off the table rather than retyped */ .filter(k=>{
    const c=ucost(p,k),fx=gFacShort&&FAC[p.fac].uu.indexOf(k)>=0;
    let rsv=(fx?0:(saveExp?170:0))+hqRsv,sup=0; // v90.1: the HQ reserve is NOT waived by the faction floor - a bot with no headquarters wants the headquarters
    if(!fx&&gRsv&&aiUnitClass(k)!==gRsv.cls){rsv+=gRsv.p;sup=gRsv.s;}
    if(!fx&&bHold&&topP>c.p)rsv+=bTilt*(topP-c.p); // ...and hold out for the better one
    if(bSup-supOf(k)<sup)return false; // leave the short class room to land
    return p.res.p>=c.p+rsv&&p.res.e>=c.e&&(!U[k].lim||p.units.filter(u=>u.key===k).length<U[k].lim);
   });
   /* v63: the floor's other half - "only exclusives while under the floor" has to
      mean waiting for one, or the cheap line unit wins every tick by default. */
   if(gFacShort&&aiBldHasFac(p,b.key)&&!opts.some(k=>FAC[p.fac].uu.indexOf(k)>=0)){
    let cheap=1e9;
    for(const k of roster(p,b.key)){
     if(AI_SUPPORT[k]||U[k].noTrain||FAC[p.fac].uu.indexOf(k)<0)continue;
     if(U[k].lim&&p.units.filter(u=>u.key===k).length>=U[k].lim)continue;
     const c=ucost(p,k);
     if(c.p<cheap)cheap=c.p;
    }
    if(cheap<1e9&&p.res.p>=cheap*0.5)continue;
   }
   if(opts.length){
    // v48: counter-aware pick - dps x matrix effectiveness per plastic against the
    // grudge target's current mix, tilted by profile (see aiPickUnit above).
    const pick=aiPickUnit(p,pr,opts);
    if(pick)trainUnit(b,pick);
   }
  }
 }

 // ---- v48 SUPPORT PRODUCTION: medics, APCs and Blue's Chinook. None of these
 // count toward armyCap or wave size (the army filter above excludes them); the
 // doctrines below field them. One support unit per tick at most.
 const qCount=k=>p.blds.reduce((n,b)=>n+(b.queue?b.queue.filter(q2=>q2===k).length:0),0);
 const supTrain=(k,bk)=>{
  /* v75: was !x.queue.length, i.e. an IDLE producer. See splice_v75.py patch 6:
     with the army ceiling now derived from supply the garage is rarely idle, and
     an idle-only rule stopped support production outright. 3 is one slot past the
     2 the army block fills to, so support always has a slot the army block cannot
     take; trainUnit's limit of 5 remains the hard stop. */
  const b=p.blds.find(x=>x.key===bk&&x.prog>=1&&x.queue.length<3);
  if(!b)return false;
  const c=ucost(p,k);
  if(p.res.p<c.p+(saveExp?170:0)+hqRsv||p.res.e<c.e)return false;
  return trainUnit(b,k);
 };
 const infN=army.filter(u=>u.t.a==='inf').length;
 // medics: one per 8 fighters, cap 3
 if(hasTech(p,'u_medic')&&p.units.filter(u=>u.key==='medic').length+qCount('medic')<Math.min(3,Math.floor(army.length/8)))supTrain('medic','garage');
 // APCs: one per 10 infantry, cap 2 (any faction)
 else if(hasTech(p,'u_apc')&&p.units.filter(u=>u.key==='apc').length+qCount('apc')<Math.min(2,Math.floor(infN/10)))supTrain('apc','garage');
 // Chinook: Blue's air ferry, one, once there is a squad worth carrying
 if(hasTech(p,'u_chinook')&&infN>=8&&p.units.filter(u=>u.key==='chinook').length+qCount('chinook')<1)supTrain('chinook','helipad');
 /* v86: Green's two support vehicles, one each, on the same shape as the Chinook
    line above. Both are gated on there being an ARMY to support rather than on a
    clock: a Broadcast over nobody and a High Ground over nobody are both worth
    exactly nothing, and a bot that bought either at minute two would be a bot that
    had spent a Sniper's worth of plastic on an empty field. The balloon's own
    three-minute fuse is why it waits for a real army too - it is a consumable, and
    burning one early is burning it. */
 if(hasTech(p,'u_cmdtruck')&&army.length>=6&&p.units.filter(u=>u.key==='cmdtruck').length+qCount('cmdtruck')<1)supTrain('cmdtruck','garage');
 if(hasTech(p,'u_balloon')&&army.length>=10&&p.units.filter(u=>u.key==='balloon').length+qCount('balloon')<1)supTrain('balloon','helipad');

 // ---- THREAT RESPONSE: defend the base if enemies are close to any building ----
 // v48: collect the nearest intruders (up to three) and split the defenders
 // round-robin across them, so one scout can no longer drag the whole home army.
 let threats=[];
 for(const e of G.units){
  if(allied(e.p,p)||e.garrisoned||e.hp<=0||hid81(e,p))continue; // v29: allies are no threat. v81: and a concealed man does not trip a bot into defending
  let dd=1e9;
  for(const b of p.blds){const d=(e.x-b.x)**2+(e.y-b.y)**2;if(d<dd)dd=d;}
  if(dd<14*14)threats.push({e,d:dd});
 }
 threats.sort((a,b2)=>a.d-b2.d);
 threats=threats.slice(0,3).map(t=>t.e);
 if(threats.length){
  ai.defend=G.tick;ai.phase='defend';
  // committed scouts/harassers keep their orders; entrenched gunners hold their cone
  /* v99: the recall is LOCAL now. This loop used to pull every idle or marching
     unit the bot owned, from anywhere on the map - one enemy scout brushing an
     outpost turned the whole mid-march army around, and when the scout died or
     left, the wave logic turned it back: the second half of the owner's jitter
     report. A unit answers only from within AI_DEF_R of the intruder it is
     assigned; the home guard the launch held back is by construction near the
     base, so the base is still defended, and a wave deep in enemy territory
     finishes its job instead of abandoning it to chase a bike.
     A marcher that does respond writes u.savedDest first, the help-response
     idiom from applyDmg: when the intruder dies, the attack state hands the
     unit straight back to the march it was on, instead of leaving it idle in
     the yard. */
  /* v99: ...and PROPORTIONATE. Even split round-robin across three threats, the
     old loop ordered EVERY eligible unit in radius - twenty men lunging at one
     bike, measured. Each intruder now draws at most AI_DEF_N responders, the
     closest first, each sent at the nearest intruder with quota left; everyone
     past the quota keeps doing what it was doing. A real assault is met by the
     layers that always met it - the per-unit auto-acquire, the help response in
     applyDmg, the garrison and the towers - this block is the early-warning
     picket, not the whole defense. */
  const resp=[];
  for(const u of army){
   if(u.aiRole||u.entrenched)continue;
   if(u.state!=='idle'&&u.state!=='amove'&&!(u.state==='move'&&!u.target))continue;
   let bd=1e9;
   for(const th of threats){const d=dhyp(u.x-th.x,u.y-th.y);if(d<bd)bd=d;}
   if(bd<=AI_DEF_R)resp.push({u,d:bd});
  }
  resp.sort((a,b2)=>a.d-b2.d);
  const quota=threats.map(()=>AI_DEF_N);
  for(const r of resp){
   let bi=-1,bd=1e9;
   for(let i=0;i<threats.length;i++){if(quota[i]<=0)continue;const d=dhyp(r.u.x-threats[i].x,r.u.y-threats[i].y);if(d<bd){bd=d;bi=i}}
   if(bi<0)break;
   quota[bi]--;
   if((r.u.state==='amove'||r.u.state==='move')&&r.u.dest)r.u.savedDest=r.u.dest;
   orderAttack(r.u,threats[bi]);
  }
 }

 const foes=G.players.filter(q=>q!==p&&q.alive&&!allied(q,p)); // v29: allies are never foes
 // free fighters available for offense = army minus flag carriers minus units already
 // assigned a scouting/harassment role (those run their own independent behavior below)
 const readyArmy=army.filter(u=>!u.flag&&!u.aiRole);

 // helper: score foes for targeting. lower = more attractive. weaker & closer foes
 // are preferred; vsAI(>1) makes a bot favor hitting OTHER bots over the human; a
 // standing 'grudge' biases toward a chosen rival so rivalries persist for a while.
 const scoreFoes=()=>foes.map(q=>{
  let s=q.blds.length*100+dhyp(q.start.x-p.start.x,q.start.y-p.start.y)+srand()*200;
  if(q.ai)s/=pr.vsAI;                 // prefer attacking AIs when vsAI>1
  if(ai.grudge===q)s*=0.6;            // lean toward the current rival
  return {q,s};
 }).sort((a,b2)=>a.s-b2.s);

 // periodically (re)roll a grudge so alliances/rivalries shift across a long match
 if(foes.length&&(ai.grudge==null||!ai.grudge.alive||ai.t>ai.grudgeT)){
  const sc=scoreFoes();ai.grudge=sc[0].q;ai.grudgeT=ai.t+90+srand()*120;
 }

 // ============ v48 RADIO TOWER: napalm the clumps, paradrop the economy ============
 // When the shared cooldown comes back the bot waits up to AI_RADIO_WAIT AI-ticks
 // (~5s at v77) for a strike-grade target - dense hostile power with neither its
 // own nor an ally's army underneath - and failing that spends the charge on a
 // paradrop against the scored foe's softest economy target.
 // Influence is read per-player (unlike powAt's everyone-else foe view) so a
 // teammate's army brawling with the enemy is never carpet-bombed.
 const radio=p.blds.find(b=>b.t.radio&&b.prog>=1&&b.hp>0&&b.abilityCool<=0);
 if(radio&&foes.length){
  if(ai.radioReadyT==null)ai.radioReadyT=ai.t;
  let fired=false;
  const I2=influence(),W2=I2.W;
  const powOf=(q2,x,y)=>{ // 3x3 weighted read of ONE player's influence at (x,y)
   const cx=Math.min(W2-1,Math.max(0,x/INF_CELL|0)),cy=Math.min(W2-1,Math.max(0,y/INF_CELL|0));
   let s=0;
   for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
    const nx=cx+ox,ny=cy+oy;if(nx<0||ny<0||nx>=W2||ny>=W2)continue;
    s+=I2.arr[q2.i][ny*W2+nx]*((ox||oy)?0.45:1);
   }
   return s;
  };
  let nt=null,ns2=0;
  for(const q of foes)for(const e of q.units){
   if(e.garrisoned||e.hp<=0)continue;
   let hostile=0,friendly=0;
   for(const q2 of G.players){if(!q2.alive||q2.i<0)continue;const v=powOf(q2,e.x,e.y);if(allied(q2,p))friendly+=v;else hostile+=v;}
   if(hostile>=AI_RADIO_CLUMP&&friendly<AI_RADIO_FRIENDLY&&hostile>ns2){ns2=hostile;nt=e;}
  }
  /* v76: the same scored clump now chooses between two munitions. Armor and
     structures shrug off flame (row f bottoms out at 0.45 vs heavy) and take the
     barrage at full value, so a clump that is mostly hard targets gets shells and
     everything else still gets fire. The scorer above is unchanged. */
  if(nt&&pVision(p,nt.x,nt.y)){
   let hard=0,soft=0;
   for(const q3 of foes)for(const e3 of q3.units){
    if(e3.garrisoned||e3.hp<=0)continue;
    if(dhyp(e3.x-nt.x,e3.y-nt.y)>5)continue;
    if(e3.t.a==='inf')soft++;else hard++;
   }
   for(const q3 of foes)for(const b3 of q3.blds){if(b3.hp>0&&b3.key!=='barricade'&&dhyp(b3.x-nt.x,b3.y-nt.y)<=5)hard++;}
   /* v87: the bot picked between these two munitions without ever asking whether
      it owns them, which was harmless while both were shared and is not now that
      napalm is Tan's. radioAllowed is the same gate execCmd refuses a human at, so
      a Green, Gray or Blue bot simply shells a clump it would once have burned.
      Written as a fallback rather than as a second branch because the barrage is
      the munition every army has: there is no case where a bot has napalm and not
      the barrage. */
   if(hard>soft||!radioAllowed(p,'napalm'))radioBarrage(radio,nt.x,nt.y);else radioNapalm(radio,nt.x,nt.y);
   fired=true;
  }
  else if(ai.t>ai.radioReadyT+AI_RADIO_WAIT){
   /* v86: a bot that owns the Supply Drop and is BROKE spends the charge on its
      own economy instead of on a speculative paradrop. Read off res.p rather than
      off a phase or a timer, so it is self-correcting: the moment the bank
      recovers the tower goes back to being an offensive charge. Dropped on its own
      HQ, which is the one place on the map its units are guaranteed to walk over -
      a crate nobody collects is 500 plastic left lying in a field. */
   /* v88: a Gray bot spends the charge DEFENSIVELY when enough of its own army is
      being shot in one place. Read off calmT - the "seconds since last hit" clock
      every unit already carries and the same signal the Radar Tent's uplink reads
      - so it is self-correcting: the moment the shooting stops the tower goes back
      to being an offensive charge. radioAllowed is the gate, exactly as the napalm
      branch above uses it, because aiTick never passes through execCmd. */
   const scr88=radioAllowed(p,'smokescr')&&(function(){
    const hurt=[];
    for(const u of p.units)if(u.hp>0&&!u.garrisoned&&u.calmT<HURT_WINDOW)hurt.push(u);
    if(hurt.length<SCR_AI_N)return null;
    const h=SMOKESCR_BOX/2;
    let best=null,bn=0;
    for(const a of hurt){
     let n=0;
     for(const b of hurt)if(Math.abs(b.x-a.x)<=h&&Math.abs(b.y-a.y)<=h)n++;
     if(n>bn){bn=n;best=a}
    }
    return bn>=SCR_AI_N?best:null;
   })();
   if(scr88){
    radioSmokescreen(radio,clamp(scr88.x,2,G.map.N-3),clamp(scr88.y,2,G.map.N-3));fired=true;
   }
   else{
   const drop86=radioAllowed(p,'supply')&&p.res.p<AI_DROP_FLOOR;
   if(drop86){
    const hq86=p.blds.find(b=>b.key==='hq'&&b.hp>0);
    const dx86=hq86?hq86.x:p.start.x, dy86=hq86?hq86.y:p.start.y;
    radioSupply(radio,clamp(dx86,2,G.map.N-3),clamp(dy86,2,G.map.N-3));fired=true;
   }
   else{
   
   // paradrop: a harvesting truck, else an outpost, else the nearest non-HQ structure
   const tq=scoreFoes()[0].q;
   let hit=null,hd3=1e9;
   for(const e of tq.units){if(e.key==='truck'&&e.hp>0){const d=dhyp(e.x-p.start.x,e.y-p.start.y);if(d<hd3){hd3=d;hit={x:e.x,y:e.y}}}}
   if(!hit)for(const b of tq.blds){if(b.key==='outpost'){hit={x:b.x,y:b.y};break}}
   if(!hit){let bd3=1e9;for(const b of tq.blds){if(b.key==='hq')continue;const d=dhyp(b.x-p.start.x,b.y-p.start.y);if(d<bd3){bd3=d;hit={x:b.x,y:b.y}}}}
   if(!hit&&tq.blds.length)hit={x:tq.blds[0].x,y:tq.blds[0].y};
   if(hit){radioParadrop(radio,clamp(hit.x,2,G.map.N-3),clamp(hit.y,2,G.map.N-3));fired=true;}
   }
   }
  }
  if(fired)ai.radioReadyT=null;
 } else ai.radioReadyT=null;

 // ---- v48: defensive profiles man their bunker (garrison idle infantry to cap;
 // the >=0.28 floor keeps jittered 'defensive' brains inside). The half-HP bail-out
 // in updateBld already covers the exit, so nobody is ever ordered back out. ----
 if(pr.defendFrac>=0.28){
  for(const bk2 of p.blds){
   if(bk2.key!=='bunker'||bk2.prog<1||bk2.hp<=0)continue;
   const cap2=garCap(bk2);
   let n2=bk2.garrison.length;
   for(const u2 of p.units)if(u2.state==='enterB'&&u2.targetB===bk2)n2++; // inbound boarders count
   if(n2>=cap2)continue;
   const free2=readyArmy.filter(u=>u.t.a==='inf'&&u.state==='idle'&&!u.entrenched).slice(0,cap2-n2);
   for(const u2 of free2){clearPlans(u2,true);u2.state='enterB';u2.targetB=bk2;u2.path=null;u2.target=null;}
  }
 }

 // ============ SCOUTING: send a lone fast unit to poke at enemy territory ============
 if(pr.scout&&foes.length&&ai.t>ai.nextScout&&ai.phase!=='defend'){
  ai.nextScout=ai.t+pr.scoutEvery*(0.7+srand()*0.6);
  // a scout already out? only send another if it's gone
  const haveScout=army.some(u=>u.aiRole==='scout');
  if(!haveScout){
   // prefer the fastest cheap unit on hand for scouting
   const cand=readyArmy.filter(u=>(u.state==='idle'||u.state==='amove')&&!u.entrenched).sort((a,b2)=>(b2.t.sp-a.t.sp)||(a.t.cp-b2.t.cp)); // v48: dug-in gunners are not scouts
   const scout=cand[0];
   if(scout){
    scout.aiRole='scout';scout.aiRoleT=ai.t+30; // expires (~18s); then rejoins the army
    const tgt=scoreFoes()[Math.floor(srand()*Math.min(foes.length,2))].q;
    // sweep a few waypoints around the target base instead of a beeline
    scout.aiPatrol=[
     safeSpot(tgt.start.x,tgt.start.y),
     safeSpot(clamp(tgt.start.x+(srand()-.5)*16,2,G.map.N-3),clamp(tgt.start.y+(srand()-.5)*16,2,G.map.N-3)),
     safeSpot((p.start.x+tgt.start.x)/2,(p.start.y+tgt.start.y)/2)
    ];scout.aiWp=0;
    orderMove(scout,scout.aiPatrol[0].x,scout.aiPatrol[0].y,true);
   }
  }
 }

 // ============ HARASSMENT: small detachment hits economy / outposts / stragglers ====
 if(pr.harass&&foes.length&&ai.t>ai.nextHarass&&ai.phase!=='defend'){
  ai.nextHarass=ai.t+pr.harassEvery*(0.7+srand()*0.6);
  const partySize=pr.harassSize[0]+Math.floor(srand()*(pr.harassSize[1]-pr.harassSize[0]+1));
  // only harass if we can spare the bodies (keep enough for the defend fraction)
  const sparePool=readyArmy.filter(u=>(u.state==='idle'||u.state==='amove')&&!u.entrenched); // v48: dug-in gunners stay dug in
  if(sparePool.length>=partySize+2){
   const tgt=scoreFoes()[Math.floor(srand()*Math.min(foes.length,2))].q;
   // aim at the juiciest soft target: a harvesting truck, then an outpost, then a
   // production/eco building, falling back to the nearest structure.
   let hit=null,hd=1e9;
   for(const e of tgt.units){if(e.key==='truck'){const d=dhyp(e.x-p.start.x,e.y-p.start.y);if(d<hd){hd=d;hit={x:e.x,y:e.y,ent:e}}}}
   if(!hit)for(const b of tgt.blds){if(b.key==='outpost'){hit={x:b.x,y:b.y,ent:b};break}}
   if(!hit){let bd=1e9;for(const b of tgt.blds){if(b.key==='hq')continue;const d=dhyp(b.x-p.start.x,b.y-p.start.y);if(d<bd){bd=d;hit={x:b.x,y:b.y,ent:b}}}}
   if(!hit&&tgt.blds.length){const b=tgt.blds[0];hit={x:b.x,y:b.y,ent:b}}
   if(hit){
    const party=sparePool.sort((a,b2)=>(b2.t.sp-a.t.sp)).slice(0,partySize);
    for(const u of party){
     u.aiRole='harass';u.aiRoleT=ai.t+22; // short raid (~13s), then rejoin
     // attack-move toward the soft target so they engage anything on the way
     const hd2=safeSpot(clamp(hit.x+(srand()-.5)*4,2,G.map.N-3),clamp(hit.y+(srand()-.5)*4,2,G.map.N-3));
     orderMove(u,hd2.x,hd2.y,true);
    }
   }
  }
 }

 // ============ SKIRMISH (v22): contest mid-map ground between waves ============
 // small squads sent to fight over resource nodes / the hill between main pushes.
 // Target choice leans hard on vsAI, which is what actually produces bot-vs-bot
 // fights away from the bases instead of everyone only ever marching at the human.
 if(foes.length&&ai.t>ai.nextSkirm&&ai.phase!=='defend'){
  ai.nextSkirm=ai.t+40+srand()*55;
  const pool=readyArmy.filter(u=>(u.state==='idle'||u.state==='amove')&&!u.entrenched); // v48: dug-in gunners stay dug in
  if(pool.length>=6){
   let tq=null,ts=1e18;
   for(const q of foes){
    let s=dhyp(q.start.x-p.start.x,q.start.y-p.start.y)+srand()*80;
    if(q.ai)s/=(pr.vsAI*pr.vsAI+0.5);
    if(ai.grudge===q)s*=0.7;
    if(s<ts){ts=s;tq=q}
   }
   const mx=(p.start.x+tq.start.x)/2,my=(p.start.y+tq.start.y)/2;
   let node=null,nd=1e9;
   for(const n of G.map.nodes){if(n.amt<=0)continue;const d=(n.x-mx)**2+(n.y-my)**2;if(d<nd){nd=d;node=n}}
   let dst=node?{x:node.x,y:node.y}:((G.mode==='koth'&&G.hill)?{x:G.hill.x,y:G.hill.y}:{x:mx,y:my});
   dst=safeSpot(dst.x,dst.y);
   const party=pool.slice().sort((a,b2)=>dhyp(a.x-dst.x,a.y-dst.y)-dhyp(b2.x-dst.x,b2.y-dst.y)).slice(0,2+(srand()*2|0));
   for(const u of party){u.aiRole='skirmish';u.aiRoleT=ai.t+26;const d2=safeSpot(dst.x+(srand()-.5)*3,dst.y+(srand()-.5)*3);orderMove(u,d2.x,d2.y,true);}
  }
 }

 // ---- maintain active roles: expire them, retarget scouts along their patrol ----
 for(const u of army){
  if(!u.aiRole)continue;
  if(ai.t>u.aiRoleT){
   // a feint that has run its course visibly withdraws toward home
   if(u.aiRole==='feint'){const fh=safeSpot(p.start.x+(srand()-.5)*6,p.start.y+(srand()-.5)*6);orderMove(u,fh.x,fh.y,true);}
   u.aiRole=null;u.aiPatrol=null;continue;} // role done -> back to army
  if(u.aiRole==='scout'&&u.aiPatrol){
   // advance to next patrol waypoint once we reach the current one
   if((u.state==='idle')||((u.state==='move'||u.state==='amove')&&u.dest&&dhyp(u.x-u.dest.x,u.y-u.dest.y)<2.5)){
    u.aiWp=(u.aiWp+1);
    if(u.aiWp>=u.aiPatrol.length){u.aiRole=null;u.aiPatrol=null;}
    else orderMove(u,u.aiPatrol[u.aiWp].x,u.aiPatrol[u.aiWp].y,true);
   }
  }
  // a harasser whose target is dead and is now idle just expires early
  if((u.aiRole==='harass'||u.aiRole==='skirmish')&&u.state==='idle')u.aiRoleT=Math.min(u.aiRoleT,ai.t+3);
 }

 // ---- v48 TRANSPORT DOCTRINE: a tasked carrier (APC or Chinook) holds for its
 // squad to board, hauls it to the wave's aim point, and unloads on arrival, when
 // the hull drops under 60%, or when its path ends. The squad lands attack-moving
 // and tagged into its wave so tactical retreat can pull it back with the rest. ----
 for(const c of p.units){
  if((c.key!=='apc'&&c.key!=='chinook')||!c.aiCarry)continue;
  const job=c.aiCarry;
  if(c.hp<=0){c.aiCarry=null;continue}
  if(!job.go){
   const aboard=c.garrison?c.garrison.length:0;
   const inbound=p.units.some(u2=>u2.state==='enterU'&&u2.targetB===c);
   if(aboard>=job.n||(ai.t>job.boardT&&aboard>0)){job.go=1;const d3=safeSpot(job.x,job.y);orderMove(c,d3.x,d3.y,false);}
   else if(ai.t>job.boardT&&!inbound)c.aiCarry=null; // the squad died on the way to the ramp
  } else if(dhyp(c.x-job.x,c.y-job.y)<6||c.hp<c.mhp*0.6||c.state==='idle'){
   const squad=(c.garrison||[]).slice();
   if(squad.length)apcUnload(c);
   for(const u2 of squad){
    if(u2.hp<=0||u2.garrisoned)continue;
    u2.aiWave=job.wid||0;
    const d4=safeSpot(clamp(job.x+(srand()-.5)*4,2,G.map.N-3),clamp(job.y+(srand()-.5)*4,2,G.map.N-3));
    orderMove(u2,d4.x,d4.y,true);
   }
   c.aiCarry=null;
   const hm=safeSpot(p.start.x+(srand()-.5)*4,p.start.y+(srand()-.5)*4);
   orderMove(c,hm.x,hm.y,false); // the empty hull flies home out of the fight
  }
 }

 // ---- OFFENSE: stage, then push in waves; don't full-retreat on a scratch ----
 /* v99: A PUSH IS AN EVENT, NOT A STANDING CONDITION. The trigger below fired
    whenever the army was big enough (sizeReady) - and nothing about launching a
    wave ever made it smaller: the committed units stay in readyArmy, so once an
    army outgrew its capped pushSize the block fired on EVERY aiTick, re-ordering
    the entire wave every 0.6 seconds for the rest of the match. Each firing also
    re-rolled the target (the rivalIdx%3 rotation, scoreFoes' srand noise, the
    koth/ctf rolls), so two of every three ticks aimed at one foe and the third at
    another - which is the army-wide "jitter" the owner reported: every unit not
    in a fight veering the same way at once, then turning back. Measured before
    the fix: one bot launched 174 "waves" in a 10-minute match, 94% of them one
    aiTick apart; the design cadence in pr.repeat is 34-155 aiTicks.
    The gate is WAVE-LIVENESS, not the phase flag, because the threat response
    flips phase to 'defend' while a wave is mid-march and the push must not
    relaunch through that door either. A wave is live while three of its units
    survive and two are still going somewhere or fighting; when it falls under
    that, the remnant is released (aiWave=0, so the stage drift regroups it) and
    the phase machine returns to 'build' - which is what re-arms the next push,
    on pr.repeat's clock or the size trigger, exactly as the comment above the
    trigger always claimed. */
 const wu99=ai.waveId?p.units.filter(u=>u.aiWave===ai.waveId&&u.hp>0):[];
 const waveBusy99=wu99.filter(u=>u.state==='attack'||u.state==='move'||u.state==='amove').length;
 /* the busy floor SCALES with the wave (v99 owner feedback): an absolute
    floor of two let a couple of stragglers hold a forty-man wave "live" for
    hundreds of seconds - measured on one seed at wu=39, busy=3 for over six
    minutes, the army idling beside the last enemy base while three units
    chewed on it, reinforcements marching to the stale aim point and idling
    too. A wave is an assault while a QUARTER of it is still moving or
    fighting; under that it has arrived, and dissolving it is what re-aims
    everybody - the still-busy few included, whose auto-acquire re-engages
    them the moment the relaunch points them anywhere near a target. */
 const waveLive=wu99.length>=3&&waveBusy99>=Math.max(2,Math.ceil(wu99.length*0.25));
 /* v99 owner feedback: A WAVE THAT ENDED STANDING ROLLS FORWARD. Dissolution
    reaches here two ways, and they must not pace alike. A wave that was WIPED
    (under three survivors) regroups on the profile's clock, exactly as before.
    A wave that went quiet with its men still standing has WON its objective -
    the aim point is razed and there is nothing left in acquisition range - and
    waiting out the full pr.repeat there is how the winning bot was measured
    idling 39-69% of its army through the endgame while three units chewed the
    last base. The clock is pulled to a two-second breath instead; the next
    launch re-targets through scoreFoes as ever, and its closest-first slice
    means the survivors at the front lead the next objective. A tactical
    retreat never passes through here (it zeroes aiWave and sets 'build'
    itself), so its deliberately raised clock is untouched. */
 if(ai.phase==='attack'&&!waveLive){
  for(const u of wu99)u.aiWave=0;
  ai.phase='build';
  if(wu99.length>=3)ai.nextPush=Math.min(ai.nextPush,ai.t+4);
 }
 const defendHold=pr.defendHold;
 if(ai.phase!=='defend'||G.tick-ai.defend>defendHold){
  if(ai.phase==='defend'&&G.tick-ai.defend>defendHold)ai.phase=waveLive?'attack':'build'; // v99: a defend interrupt hands back to the wave still out there, so its retreat watch and reinforcement resume
  /* time OR size based trigger so they don't sit forever. v99: SIZE LAUNCHES THE
     OPENING, THE CLOCK PACES THE REST - which is what pr.repeat's own doc comment
     ("AI-tick gap between main waves") always described. sizeReady used to stay
     armed after every wave, so the tactical retreat's pull-back was relaunched at
     the same superior force one aiTick later: the army turned for home and
     turned straight back, the retreat-shaped half of the jitter. Every wave
     after the first now waits for nextPush, which the launch sets to the
     profile's cadence and the retreat deliberately raises. */
  const sizeReady=readyArmy.length>=ai.pushSize&&!ai.waveId;
  const timeReady=ai.t>ai.nextPush;
  /* commit the army minus a home-guard fraction - SCALED BY CONTACT (v99 owner
     feedback). defendFrac is the profile's guard under threat; holding a
     turtle's 45% of the army at home while the last enemy base burns is where
     the other half of the endgame idling came from. Two cheap reads decide the
     posture: CALM is no threat response for 45 seconds (ai.defend is the sim
     tick the picket last fired, 0 if never), CRUSH is fielding at least twice
     the fighters every surviving foe holds together. Either alone halves the
     guard, both quarter it, and a bot under recent pressure keeps the full
     fraction - which is the "high contact" end of the same dial. The same
     fraction feeds the reinforcement guard below, so the launch and the
     trickle agree on what stays home. */
  const foeFight99=foes.reduce((n,q)=>n+q.units.filter(u2=>u2.t.dm&&!u2.garrisoned).length,0);
  const calm99=G.tick-ai.defend>1350;
  const crush99=readyArmy.length>=foeFight99*2+4;
  const gFrac99=pr.defendFrac*((calm99&&crush99)?0.25:(calm99||crush99)?0.5:1);
  const commitN=Math.max(4,Math.ceil(readyArmy.length*(1-gFrac99)));
  if(!waveLive&&foes.length&&(sizeReady||timeReady)&&readyArmy.length>=Math.max(4,Math.round(ai.pushSize*0.6))){
   ai.rivalIdx++;
   const scored=scoreFoes();
   // pick from the best two, rotating, so attention spreads between rivals over time
   const tgt=(scored.length>1&&ai.rivalIdx%3===0)?scored[1].q:scored[0].q;
   let dest={x:tgt.start.x,y:tgt.start.y};
   /* v99 owner feedback: raze76 records the wave's PURPOSE. A wave aimed at a
      structure advances its aim point across the base as objectives fall (the
      press, below); a wave holding the hill or hunting the flag must NOT be
      walked off its objective toward the nearest shed the moment it arrives -
      at the hill there is no enemy building within reach by design. */
   let raze76=1;
   // v22 soft-spot targeting: weigh distance against local defensive power, so waves
   // hit the enemy's weakest-defended structure instead of always the nearest one
   let bs2=1e18;for(const b of tgt.blds){const s=dhyp(b.x-p.start.x,b.y-p.start.y)*0.6+powAt(p,b.x,b.y,true)*0.12;if(s<bs2){bs2=s;dest={x:b.x,y:b.y}}}
   if(G.mode==='ctf'){const f=G.flags.find(f=>f.owner===tgt);if(f&&srand()<.65){dest={x:f.x,y:f.y};raze76=0}}
   if(G.mode==='koth'&&G.hill&&srand()<.75){dest={x:G.hill.x,y:G.hill.y};raze76=0} // fight over the hill
   dest=safeSpot(dest.x,dest.y);
   // keep the home guard back; send the rest (closest units lead the charge)
   const wave=readyArmy.slice().sort((a,b2)=>dhyp(a.x-dest.x,a.y-dest.y)-dhyp(b2.x-dest.x,b2.y-dest.y)).slice(0,commitN);
   // FEINT (v22, rare, once per bot): the "wave" is a bluff that advances then withdraws
   const feint=!ai.feintDone&&wave.length>=6&&srand()<0.18;
   // SPLIT PRONG (v22): big waves sometimes hit two weak points at once
   let alt=null;
   if(!feint&&wave.length>=10&&srand()<0.35){
    let as2=1e18;for(const b of tgt.blds){if(dhyp(b.x-dest.x,b.y-dest.y)<8)continue;const s=powAt(p,b.x,b.y,true);if(s<as2){as2=s;alt={x:b.x,y:b.y}}}
    if(alt)alt=safeSpot(alt.x,alt.y);
   }
   ai.waveId++;ai.waveT=ai.t;
   const half=alt?Math.floor(wave.length/2):0;
   // v48: a free transport scoops part of the wave's infantry and hauls it in.
   // The Chinook overshoots the aim point by 6 tiles (an air ferry drops BEHIND
   // the target); the APC drives straight at it. Boarding, transit and the unload
   // run in the transport-doctrine block above on later ticks.
   let riders=null;
   if(!feint){
    const carrier=p.units.find(u2=>(u2.key==='apc'||u2.key==='chinook')&&u2.hp>0&&!u2.aiCarry&&(!u2.garrison||!u2.garrison.length));
    if(carrier){
     const cap3=carrier.t.cap||10,rl=[];
     for(const u2 of wave){if(rl.length>=cap3)break;if(u2.t.a==='inf'&&!u2.entrenched)rl.push(u2);}
     if(rl.length>=6){
      let jx=dest.x,jy=dest.y;
      if(carrier.key==='chinook'){
       const dx3=dest.x-p.start.x,dy3=dest.y-p.start.y,L3=dhyp(dx3,dy3)||1;
       const ov=safeSpot(clamp(dest.x+dx3/L3*6,2,G.map.N-3),clamp(dest.y+dy3/L3*6,2,G.map.N-3));
       jx=ov.x;jy=ov.y;
      }
      for(const u2 of rl){clearPlans(u2,true);u2.state='enterU';u2.targetB=carrier;u2.path=null;u2.target=null;}
      carrier.aiCarry={x:jx,y:jy,n:rl.length,boardT:ai.t+12,go:0,wid:ai.waveId};
      riders=new Set(rl);
     }
    }
   }
   wave.forEach((u,i)=>{
    if(riders&&riders.has(u))return; // boarding the transport; the doctrine delivers them
    const d0=(alt&&i<half)?alt:dest;
    let ax=d0.x,ay=d0.y;
    if(u.t.rg>=6){ // v48: siege pieces (mortar/arty/sniper) stand off 3 tiles and bombard
     const bx3=p.start.x-d0.x,by3=p.start.y-d0.y,bL=dhyp(bx3,by3)||1;
     ax=d0.x+bx3/bL*3;ay=d0.y+by3/bL*3;
    }
    const d2=safeSpot(clamp(ax+(srand()-.5)*5,2,G.map.N-3),clamp(ay+(srand()-.5)*5,2,G.map.N-3));
    if(feint){u.aiRole='feint';u.aiRoleT=ai.t+13;}
    else u.aiWave=ai.waveId;
    orderMove(u,d2.x,d2.y,true);
   });
   if(feint){ai.feintDone=true;ai.nextPush=ai.t+16+srand()*20;}
   else{
    ai.phase='attack';
    ai.waveDest={x:dest.x,y:dest.y}; // v99: the standing aim point reinforcements march on. Plain data on the brain: _encAi copies it, loadState spreads it back
    ai.waveRaze=raze76;              // ...and whether the press below may advance it
    ai.pushSize=Math.min(pr.pushCap,ai.pushSize+pr.pushGrow);
    ai.nextPush=ai.t+pr.repeat[0]+srand()*pr.repeat[1];
    // v48: medics ride along - ordered at the same point, their v44 station
    // keeping handles formation, coverage and settling from there.
    for(const m2 of p.units)if(m2.key==='medic'&&!m2.garrisoned&&m2.hp>0)orderMove(m2,dest.x,dest.y,false);
   }
   if(tgt===G.human){pingEvent(dest.x,dest.y,'#ff6a5a');setTimeout(()=>{if(G&&!G.over)msg(`⚠ ${FAC[p.fac].name} is on the move!`)},(2+Math.random()*3)*1000);}
  }
 }
 /* v99: REINFORCE THE WAVE INSTEAD OF RELAUNCHING IT. The old every-tick push
    had one virtue: freshly built units were swept toward the fight continuously.
    With the push an event again, that job is done honestly - while a wave is
    live, an IDLE ready unit that is not on it marches to the standing aim point
    and joins the wave (aiWave, so the tactical retreat covers it too). Only idle
    units are ordered, once each - a unit ordered here is 'amove' next tick and
    the guard refuses it - so nothing already moving is ever re-aimed, which is
    the whole point of the release. The home guard keeps its defendFrac share:
    the closest-to-home idles stay, counted against the same fraction the launch
    held back. (The old `readyArmy<3 -> regroup` else-branch this replaces was
    nearly unreachable - readyArmy counts the whole army, home guard included -
    and the wave-liveness bookkeeping above is now the real end-of-wave door.) */
 if(waveLive&&ai.waveDest&&ai.phase==='attack'){
  /* THE PRESS (v99 owner feedback). A live assault walks the enemy base one
     objective at a time: when no enemy building stands within 8 tiles of the
     aim point any more, the point advances to the nearest one still standing,
     and every wave member idling at the OLD objective is re-marched at the new
     one. Idle members only, once per advance - the busy ones keep the fight
     they are in and follow on later cycles - so the churn is bounded by how
     fast objectives actually fall. Without this, the men who finished first
     stood at the rubble while a dozen teammates fought on: the wave was
     correctly LIVE, so neither dissolution nor reinforcement could reach them.
     A holding wave (waveRaze=0: the hill, the flag) never advances - standing
     idle ON the objective is that wave's whole job - but its stragglers more
     than 8 tiles out are still pulled in. */
  if(ai.waveRaze){
   let nx76=0,ny76=0,nd76=1e18;
   for(const q of foes)for(const b of q.blds){const d=(b.x-ai.waveDest.x)**2+(b.y-ai.waveDest.y)**2;if(d<nd76){nd76=d;nx76=b.x;ny76=b.y}}
   if(nd76<1e18&&nd76>64)ai.waveDest={x:nx76,y:ny76};
  }
  for(const u of wu99){
   if(u.state!=='idle'||u.entrenched)continue;
   if(dhyp(u.x-ai.waveDest.x,u.y-ai.waveDest.y)<=8)continue;
   const d2=safeSpot(clamp(ai.waveDest.x+(srand()-.5)*5,2,G.map.N-3),clamp(ai.waveDest.y+(srand()-.5)*5,2,G.map.N-3));
   orderMove(u,d2.x,d2.y,true);
  }
  const idles=readyArmy.filter(u=>u.state==='idle'&&!u.entrenched&&u.aiWave!==ai.waveId&&dhyp(u.x-ai.waveDest.x,u.y-ai.waveDest.y)>10);
  /* the guard here reads the same contact dial the launch does - recomputed
     because the launch's consts are block-scoped, kept identical on purpose */
  const foeF99=foes.reduce((n,q)=>n+q.units.filter(u2=>u2.t.dm&&!u2.garrisoned).length,0);
  const gF99=pr.defendFrac*(((G.tick-ai.defend>1350)&&(readyArmy.length>=foeF99*2+4))?0.25:((G.tick-ai.defend>1350)||(readyArmy.length>=foeF99*2+4))?0.5:1);
  const guardN=Math.ceil(readyArmy.length*gF99);
  if(idles.length>guardN){
   idles.sort((a,b2)=>dhyp(a.x-p.start.x,a.y-p.start.y)-dhyp(b2.x-p.start.x,b2.y-p.start.y)); // closest-to-home stay as the guard
   for(const u of idles.slice(guardN)){
    u.aiWave=ai.waveId;
    const d2=safeSpot(clamp(ai.waveDest.x+(srand()-.5)*5,2,G.map.N-3),clamp(ai.waveDest.y+(srand()-.5)*5,2,G.map.N-3));
    orderMove(u,d2.x,d2.y,true);
   }
  }
 }
 // ---- TACTICAL RETREAT (v22): a committed wave that walks into locally superior
 // force pulls back and regroups instead of feeding units in piecemeal ----
 if(ai.phase==='attack'&&ai.waveId&&ai.t>ai.waveT+8&&ai.t%3===0){
  const wu=p.units.filter(u=>u.aiWave===ai.waveId&&u.hp>0);
  if(wu.length>=3){
   let cx=0,cy=0;for(const u of wu){cx+=u.x;cy+=u.y}cx/=wu.length;cy/=wu.length;
   if(dhyp(cx-p.start.x,cy-p.start.y)>14){
    const foePow=powAt(p,cx,cy,true),usPow=powAt(p,cx,cy,false)+1;
    if(foePow>usPow*1.9){
     const back=safeSpot((p.start.x+cx)/2,(p.start.y+cy)/2);
     for(const u of wu){u.aiWave=0;const d2=safeSpot(back.x+(srand()-.5)*4,back.y+(srand()-.5)*4);orderMove(u,d2.x,d2.y,true);}
     ai.phase='build';ai.nextPush=Math.max(ai.nextPush,ai.t+16+srand()*18);
    }
   }
  }
 }
 // idle fighters drift to a ROTATING forward stance (v22: outpost / toward the grudge
 // / the hill / the classic mid-lane point) so the army doesn't pile up in one lump
 // outside the base, and never stages inside a hazard field
 if(ai.phase==='build'||ai.phase==='defend'){
  if(!ai.stagePt||ai.t>ai.stageT){
   ai.stageT=ai.t+30+srand()*40;
   const opts=[{x:(p.start.x+G.map.N/2)/2,y:(p.start.y+G.map.N/2)/2}];
   if(G.mode==='koth'&&G.hill)opts.push({x:G.hill.x,y:G.hill.y});
   if(outpost)opts.push({x:outpost.x,y:outpost.y});
   if(ai.grudge&&ai.grudge.alive)opts.push({x:(p.start.x*2+ai.grudge.start.x)/3,y:(p.start.y*2+ai.grudge.start.y)/3});
   const o=opts[Math.floor(srand()*opts.length)];
   ai.stagePt=safeSpot(o.x,o.y);
  }
  const stage=ai.stagePt;
  for(const u of readyArmy){
   if(u.state==='idle'&&dhyp(u.x-stage.x,u.y-stage.y)>6){
    const d2=safeSpot(stage.x+(srand()-.5)*4,stage.y+(srand()-.5)*4);
    orderMove(u,d2.x,d2.y,true);
   }
  }
 }

 // ---- v48: gunners dig in - idle within 4 tiles of the stage point for ~3
 // AI-ticks, then entrench facing the nearest foe's home ground. Any later move
 // order (a wave, a rotated stage point, the survival recall below) packs them
 // up automatically via orderMove. aiDigT is movement-only: never hashed. ----
 if(ai.stagePt&&(ai.phase==='build'||ai.phase==='defend')){
  for(const u of readyArmy){
   if(!u.t.entrench||u.entrenched)continue;
   if(u.state!=='idle'||dhyp(u.x-ai.stagePt.x,u.y-ai.stagePt.y)>4){u.aiDigT=null;continue}
   if(u.aiDigT==null){u.aiDigT=ai.t+3;continue}
   if(ai.t<u.aiDigT)continue;
   let fx2=G.map.N/2,fy2=G.map.N/2,fd2=1e18;
   for(const q of foes){const d=(q.start.x-u.x)**2+(q.start.y-u.y)**2;if(d<fd2){fd2=d;fx2=q.start.x;fy2=q.start.y}}
   u.coneDir=datan2(fy2-u.y,fx2-u.x);u.face=u.coneDir;u.entrenched=true;u.state='idle';u.path=null;u.target=null;u.aiDigT=null;
  }
 }

 /* --- v79: Sarge broadcasts only when the broadcast actually pays ---
    DERIVED, not a headcount. The first cut of this used "two allied infantry in
    radius", on the reasoning that two men at +30% out-earn the half share Sarge
    gives up. That reasoning was simply wrong, and measuring it is what showed
    it: Sarge gives up 7.20 DPS, a grunt gains 0.91, so the real break-even is
    EIGHT grunts - or 2.5 gunners, or 2.3 flamers, because it depends entirely
    on what is standing there. A fixed count cannot express that, so the bot
    compares the two sides directly. unitDPS is the same salvo-aware figure the
    info card and aiPickUnit read, so this cannot drift from what the shop says.
    CONSEQUENCE, recorded rather than tuned around: bots hold a mean of 1.15
    infantry inside 3 tiles, so a CPU Sarge will broadcast rarely and only into
    a real clump. That is the honest reading of the ability as specified. */
 for(const u of readyArmy){
  if(!u.t.rally||u.garrisoned)continue;
  const lost79=unitDPS(u.t)*(1-SARGE_SELF);
  let gain79=0;
  for(const v of p.units){
   if(v===u||v.hp<=0||v.garrisoned||v.t.a!=='inf')continue;
   if((v.x-u.x)**2+(v.y-u.y)**2<=SARGE_AURA_R*SARGE_AURA_R)gain79+=unitDPS(v.t)*SARGE_AURA;
  }
  u.onMe=gain79>lost79;
 }
 /* --- v80: the Flamethrower's pressure valve, wired to what it MEASURES as,
    not to what it sounds like. It sounds like a damage steroid; against
    infantry it is a way to kill your own flamers, because his hit already
    overkills a grunt and the recoil is charged on damage dealt regardless. It
    pays only where the extra damage is actually absorbed, which is buildings.
    Reading u.target rather than a role or a phase keeps this stateless: the
    valve opens on the tick he is pointed at a structure and shuts on the tick
    he is not, so nothing has to be remembered, expired, or serialized. */
 for(const u of p.units){
  if(!u.t.valve||u.garrisoned||u.hp<=0)continue;
  const tg80=u.target;
  if(!tg80||tg80.hp<=0){u.valve=false;u.vrt=0;continue}
  if(tg80.kind==='bld'){u.valve=u.hp>=u.mhp*VALVE_AI_FLOOR;u.vrt=0;continue}
  /* INFANTRY: a coin flip, by owner's decision, and deliberately NOT conditioned
     on whether it helps. Rolled ONCE per engagement rather than once per AI
     tick - a per-tick flip would strobe the valve several times a second, churn
     the hash and read as a bug rather than as a choice. u.vrt remembers which
     target the flip was made against, so acquiring a new man re-rolls and
     staying on the same one does not. srand() is the seeded RNG the rest of the
     bot already draws from; Math.random() here would desync lockstep instantly. */
  /* infantry is handled at acquisition in updateUnit, NOT here: aiTick runs
     once every 18 ticks and a flamer's engagements turn over faster than that,
     so rolling on this cadence left most of them never rolled at all - the
     coin came up open on a measured 14.3% of infantry engagements rather than
     the specified 50%. This block must therefore leave an infantry engagement
     alone rather than closing the valve the sim just opened. */
  if(tg80.kind==='unit'&&armorOf(tg80)==='inf')continue;
  u.valve=false;u.vrt=0;
 }
 /* ============ v106: THE FIVE ABILITIES A BOT OWNED AND NEVER USED ============
    Measured first, with harness/probe_v106.sh: over four all-CPU matches, Smoke
    Rounds, Full Throttle, Flat Out, Air Assault and Sprint each read 0.0% of
    carrier-ticks while their carriers were on the field in numbers (57 mortars,
    33 bikes, 59 runners in single matches). Entrench, On Me!, the valve and
    Called Shot were already driven, so this block is the rest of the roster -
    Roadmap 4 item 4.

    THE THREE THAT SILENCE GUNS SHARE ONE SHAPE, and it is the whole design:
    Full Throttle, Flat Out and Sprint all buy speed by giving up shooting, so
    each is spent on TRAVEL and never on a fight. A carrier switches on only
    while it is actually going somewhere (state move/amove with a dest) and only
    while the nearest thing it could shoot is further away than it can shoot -
    then switches off the moment either stops being true. Nothing is remembered
    between ticks, so nothing has to expire or be serialized: every rule here
    reads the world and writes one boolean, exactly as the v80 valve does.
    nearestEnemy is the SIM'S OWN acquisition helper, so concealment, balloons
    and the AA/secondary filters are honoured rather than re-implemented - a
    bot cannot charge past a sniper it would not have been able to see. */

 /* SMOKE ROUNDS. The cost is total: a smoking mortar deals no damage and
    acquires nothing at all (updateUnit gates acquisition on !u.smoke), so this
    is not "use it when it might help" but "use it when the thing it protects is
    worth the whole gun". The count is allies UNDER FIRE inside the mortar's own
    firing envelope - rgOf/mrg, the same envelope nearestHurtFriend will pick the
    shot from, so a mortar can never switch to smoke and then find nothing it can
    reach. HURT_WINDOW is the same "under fire" the Radar Tent and the Command
    Truck already read. */
 for(const u of p.units){
  if(!u.t.smokeCap||u.garrisoned||u.hp<=0)continue;
  const rg=rgOf(u),minR=u.t.mrg||0;
  let n106=0;
  for(const v of p.units){
   if(v===u||v.hp<=0||v.garrisoned||v.calmT>=HURT_WINDOW)continue;
   const d=dhyp(v.x-u.x,v.y-u.y);
   if(d<=rg&&d>=minR)n106++;
  }
  u.smoke=n106>=SMOKE_AI_N;
 }

 /* FULL THROTTLE. The Bull charges while it is crossing the map and throttles
    down to fight, which is what the ability is for: +30% on the approach, and
    both guns back the moment anything is in reach. THROTTLE_AI_PAD is measured
    off rgOf rather than typed as a tile count, so re-ranging the Bull moves the
    hand-over with it. u.thr also nulls its target every tick in updateUnit, so
    leaving it on in contact would be a Bull that drives through a fight without
    firing - the one failure this gate exists to prevent. */
 for(const u of p.units){
  if(!u.t.throttle||u.garrisoned||u.hp<=0)continue;
  const going=(u.state==='move'||u.state==='amove')&&!!u.dest;
  u.thr=going&&!nearestEnemy(u,rgOf(u)+THROTTLE_AI_PAD);
 }

 /* FLAT OUT. Same shape, same reason, and the Scout Bike gets more out of it
    than the Bull does: +2 sight on top of the speed, on the unit whose whole job
    is finding things. A scouting bike is travelling by definition, so this fires
    for most of a scout's run and stops the instant it finds what it went to
    find. */
 for(const u of p.units){
  if(!u.t.flat||u.garrisoned||u.hp<=0)continue;
  const going=(u.state==='move'||u.state==='amove')&&!!u.dest;
  u.flat=going&&!nearestEnemy(u,rgOf(u)+FLAT_AI_PAD);
 }

 /* SPRINT. The same shape again but the widest gate by a distance, because this
    is the only one of the three that silences OTHER units: every friendly
    infantryman within SPRINT_R stops acquiring, not just the Runner. So the test
    is not "can the Runner shoot something" but "is anything near at all", at
    SPRINT_AI_R (8) against his own 3.2 range - a foe closing at ~2 tiles/s is
    still two aiTicks from contact when the whistle goes down. */
 for(const u of p.units){
  if(!u.t.sprint||u.garrisoned||u.hp<=0)continue;
  const going=(u.state==='move'||u.state==='amove')&&!!u.dest;
  u.spr=going&&!nearestEnemy(u,SPRINT_AI_R);
 }

 /* AIR ASSAULT. The opposite trade to the three above: it buys FIRE by giving up
    movement, so it is spent when the transport has arrived and its squad has
    something to shoot. It is also the only one here that must be switched off
    for the bot to keep playing - orderMove REFUSES a pinned aircraft (13-orders
    line 3), so a transport left open would never march again. Reading the world
    every tick rather than remembering a decision is what makes that safe: the
    tick after the last enemy near it dies, it closes and can be ordered. */
 for(const u of p.units){
  if(!u.t.assault||u.garrisoned||u.hp<=0)continue;
  u.aslt=!!(u.garrison&&u.garrison.length&&nearestEnemy(u,ASSAULT_AI_R));
 }

 /* RIPPLE FIRE, and this one is a MEASUREMENT overturning a guess rather than a
    new rule. Roadmap 4 item 4 proposed "Ripple Fire at a clump"; v81 had already
    recorded that it "measured better than single fire in every arm, so a rule
    would only ever be a way of saying always on". v81 was right and the clump
    framing is wrong, re-measured at v106 over 60 sim-seconds x 3 seeds of one
    Rocket Artillery against a fixed target block:

        targets   single   ripple   ripple/single
           1        265      353        1.33
           2        124      347        2.79
           3        198      217        1.09
           6        270      315        1.17

    Better even against ONE man, because the salvo's bursts are 1.6x wider than
    the single shell's (RIPPLE_SPL) while the scatter is only +-RIPPLE_BOX, so a
    rocket landing off the aim point still covers it. So a bot's battery always
    ripples. The HUMAN default is untouched - single fire is still what a Rocket
    Artillery rolls off the line with, and the button still says so. */
 for(const u of p.units){
  if(!u.t.ripple||u.hp<=0)continue;
  u.rip=true;
 }
 /* Called Shot is not in this block: it lives in the sim, at acquisition, for
    the reason the v80 valve does - aiTick runs once every 18 ticks and a target
    turns over faster than that. */
 /* --- v81: Lockdown, spent only on a bunker that is LOSING. Measured: locking
    down a fight the bunker was going to win costs more in forgone garrison
    fire than it saves in damage, so the rule is a health floor rather than a
    presence-of-enemies test. */
 for(const b of p.blds){
  if(!b.t.lock||b.prog<1||b.hp<=0||b.abilityCool>0||b.upT>0)continue;
  if(!b.garrison.length||b.hp>b.mhp*LOCK_AI_FLOOR)continue;
  b.upT=LOCK_T;b.abilityCool=(G&&G.test)?0:LOCK_CD;b.target=null;
 }
 /* --- v79: the Radar Tent fires its uplink when the army is actually in a
    fight. "Under fire" is read off calmT, the same field the mortar reads, so
    the bot needs no new state and no new cadence of its own. Three units taking
    hits inside HURT_WINDOW is a firefight; one is a scout being shot at. */
 /* --- v86: the three Green rules. All three are read off LIVE state and none of
    them needs anything remembered between ticks, in the shape the v79-v81 rules
    settled on.
    Broadcast is spent on a firefight the truck is already parked beside, because
    the cost is that the truck cannot move: opening the net on the march would
    strand it, and closing it again the moment the shooting stops is what keeps it
    from being a permanent pin. Under fire is calmT, the same field the Radar Tent
    and the mortar read.
    Regroup is a heal, so it waits for something to heal rather than for something
    to shoot: three units inside the radius genuinely hurt, not three merely in
    contact. Spending it on a scratch is spending a minute of cooldown on nothing.
    Bail is the one rule that is simply correct play - four men on the ground beat
    four men in a fireball - so a bot gets its crew out with BAIL_AI_T seconds of
    gas to spare. p.units is walked as a COPY because balloonDown splices it. */
 for(const u of p.units){
  if(!u.t.bcast||u.garrisoned||u.hp<=0)continue;
  let n86=0;
  for(const v of p.units){if(v===u||v.hp<=0||v.garrisoned||v.calmT>=HURT_WINDOW)continue;if((v.x-u.x)**2+(v.y-u.y)**2<=BCAST_R*BCAST_R)n86++;}
  const want86=n86>=BCAST_AI_N;
  if(want86&&!u.bcast){u.bcast=true;u.path=null;u.dest=null;u.savedDest=null;u.state='idle';u.anchor={x:u.x,y:u.y};}
  else if(!want86&&u.bcast)u.bcast=false;
 }
 for(const b of p.blds){
  if(!b.t.regroup||b.prog<1||b.hp<=0||b.abilityCool>0)continue;
  let hurt86=0;
  for(const u of p.units){
   if(u.hp<=0||u.garrisoned||u.hp>=u.mhp*REGROUP_AI_FLOOR)continue;
   const dx=Math.max(0,Math.abs(u.x-b.x)-b.sz*.5),dy=Math.max(0,Math.abs(u.y-b.y)-b.sz*.5);
   if(dx*dx+dy*dy<=CPOST_R*CPOST_R)hurt86++;
  }
  if(hurt86<REGROUP_AI_N)continue;
  b.abilityCool=(G&&G.test)?0:REGROUP_CD;
  for(const u of p.units){
   if(u.hp<=0||u.garrisoned||u.hp>=u.mhp)continue;
   const dx=Math.max(0,Math.abs(u.x-b.x)-b.sz*.5),dy=Math.max(0,Math.abs(u.y-b.y)-b.sz*.5);
   if(dx*dx+dy*dy>CPOST_R*CPOST_R)continue;
   u.hp=Math.min(u.mhp,u.hp+u.mhp*REGROUP_HP);u.healedAt=G.tick;
  }
 }
 for(const u of p.units.slice()){
  if(!u.t.bail||u.garrisoned||u.hp<=0)continue;
  if(u.fuel!=null&&u.fuel<=BAIL_AI_T)balloonDown(u,true);
 }
 /* --- v87: the two Tan rules.
    NAPALM BLAST is scored the way the tower's own strike is - on a CLUMP - because
    that is what it is, and it is the same trap in miniature: an area weapon spent
    on one man is spent. The count is of enemies inside the blast disc, and the
    friendly count is a veto rather than a discount, since the burn does not care
    whose men are standing in it and a bot that traded evenly would be trading its
    own line for the enemy's at a helicopter's price. Read live off positions, so
    there is nothing to remember and nothing to expire.
    POUR is spent on a bot that is BANKED rather than on one that is desperate: the
    surcharge buys time, and time is only worth plastic to somebody who has plastic
    spare. A poor bot pouring is a poor bot buying nothing twice. */
 for(const u of p.units){
  if(!u.t.fbomb||u.garrisoned||u.hp<=0||(u.abCool||0)>0)continue;
  let foe87=0,own87=0;
  for(const e of G.units){
   if(e.hp<=0||e.garrisoned||e.t.fly)continue;
   if((e.x-u.x)**2+(e.y-u.y)**2>FB_R*FB_R)continue;
   if(allied(e.p,u.p))own87++;else foe87++;
  }
  if(foe87>=FB_AI_CLUMP&&own87<=FB_AI_OWN)napalmBlast(u);
 }
 /* v88: the Choktaw paints, and the bot has to be taught it SEPARATELY for the
    same reason v87 records about the Napalm Blast - aiTick calls the ability
    function directly and never through execCmd, so the door that refuses a human
    is not on this path at all. Grep for the function name, not for the mode.
    The box is anchored on the densest 2x2 of enemy ground units the aircraft can
    actually see, walked in a fixed order over G.units with no RNG, and it paints
    only when the box is worth the twenty-second cooldown. */
 for(const u of p.units){
  if(!u.t.paint||u.garrisoned||u.hp<=0||(u.abCool||0)>0)continue;
  const vi=viOf(u);
  let bestN=0,bx=0,by=0;
  for(const anchor of G.units){
   if(anchor.hp<=0||anchor.garrisoned||allied(anchor.p,u.p))continue;
   if((anchor.x-u.x)**2+(anchor.y-u.y)**2>vi*vi)continue;
   const x0=Math.floor(anchor.x),y0=Math.floor(anchor.y);
   let n88=0;
   for(const e of G.units){
    if(e.hp<=0||e.garrisoned||allied(e.p,u.p))continue;
    if(e.x>=x0&&e.x<x0+PAINT_BOX&&e.y>=y0&&e.y<y0+PAINT_BOX)n88++;
   }
   if(n88>bestN){bestN=n88;bx=x0;by=y0}
  }
  if(bestN>=PAINT_AI_N)paintArea(u,bx,by);
 }
 for(const b of p.blds){
  if(!b.t.pour||b.prog<1||b.hp<=0||b.abilityCool>0)continue;
  if(p.res.p<AI_POUR_BANK)continue;
  let q87=0;
  for(const g of p.blds)if(g.key==='garage'&&g.prog>=1&&g.hp>0&&g.queue&&g.queue.length)q87++;
  if(q87<AI_POUR_N)continue;
  execCmd({op:'pour',pi:p.i,a:{bid:b.id}});
 }
 const rad79=p.blds.find(b=>b.t.uplink&&b.prog>=1&&b.hp>0&&b.abilityCool<=0&&b.upT<=0);
 if(rad79){
  let hit79=0;
  for(const u of p.units)if(u.hp>0&&!u.garrisoned&&u.calmT<HURT_WINDOW)hit79++;
  if(hit79>=3){rad79.upT=UPLINK_T;rad79.abilityCool=(G&&G.test)?0:UPLINK_CD;}
 }

 // ---- v33: survival - keep the army home near the central defend point ----
 if(G.mode==='surv'&&G.surv){const cx=G.surv.fx,cy=G.surv.fy;for(const u of readyArmy){if(u.state==='idle'&&dhyp(u.x-cx,u.y-cy)>16){const d2=safeSpot(cx+(srand()-.5)*8,cy+(srand()-.5)*8);orderMove(u,d2.x,d2.y,true);}}}

 // ---- CTF flag logic ----
 if(G.mode==='ctf'){
  const f=G.flags.find(f=>f.owner===p);
  // recover our own dropped flag
  if(f&&!f.home&&!f.carrier){const near=readyArmy.slice().sort((a,b2)=>dhyp(a.x-f.x,a.y-f.y)-dhyp(b2.x-f.x,b2.y-f.y)).slice(0,3);for(const u of near)orderMove(u,f.x,f.y,true);}
  // chase down whoever is carrying our flag
  if(f&&f.carrier){const near=readyArmy.slice(0,5);for(const u of near)orderAttack(u,f.carrier);}
  // keep a couple of defenders parked on our home flag against any rival
  if(f&&f.home){
   const guards=readyArmy.filter(u=>dhyp(u.x-f.hx,u.y-f.hy)<7);
   if(guards.length<2){const free=readyArmy.filter(u=>u.state==='idle').slice(0,2-guards.length);for(const u of free)orderMove(u,f.hx+(srand()-.5)*3,f.hy+(srand()-.5)*3,true);}
  }
 }
}
// ---- AI RESEARCH: drive the bot's buildings through a sensible tech order ----
// Builds a per-player priority list once (cached on ai.researchPlan), then each tick
// assigns the next still-needed tech to an idle building of the RIGHT type (unit
// unlocks + army upgrades go to the Barracks/Garage/Helipad that owns them; building
// unlocks + the other upgrades go to a Lab). Unlocks come before upgrades; army buffs
// are favoured. Production buildings research in parallel with their unit output.
function aiResearch(p){
 const ai=p.ai;
 if(!ai.researchPlan){
  // assemble an ordered wishlist of research keys this faction can take
  const plan=[];
  const push=k=>{if(RESEARCH[k]&&techAvailable(p,k)&&!plan.includes(k))plan.push(k);};
  // 1) core production-building unlocks (so the AI's garage/helipad come online)
  /* v59: unlock a production building and then IMMEDIATELY its cheapest unit.
     Through v58 both building unlocks came first and the unit list led with the
     Tank, so a bot stood next to a finished garage holding an EMPTY roster for a
     minute or more (measured: garage complete at 240s, first vehicle unlock ~330s)
     and the helipad gate below let only Blue get that far at all. */
  push('b_garage');
  push('u_jeep');
  push('b_helipad'); // v59: was gated on FAC_AIR[fac].length, i.e. Blue alone
  push('u_heli');
  /* 2) v63: this faction's exclusive units (its signature power pieces), moved
     up from behind all ten line units below. Cheapest of the pair first. This is
     a PRIORITY list and not a sequence - the assignment loop further down falls
     through anything it cannot afford rather than breaking - so a 320p Rocket
     Artillery sitting at the front cannot stall the Gunner behind it. The
     comparator is total (cost, then key name) and consumes no rng. */
  FAC[p.fac].uu.slice().sort((a,b)=>((U[a].cp+U[a].ce*0.5)-(U[b].cp+U[b].ce*0.5))||(a<b?-1:1))
   .forEach(uk=>{if(U[uk]&&U[uk].tech)push(U[uk].tech)});
  // 3) bread-and-butter combat units
  ['u_tank','u_jeep','u_gunner','u_bazooka','u_grenadier','u_heli','u_aatruck','u_medic','u_apache','u_apc'].forEach(push); // v30: Apache replaces the retired Radio Operator; v48: +APC (transport doctrine)
  // 4) economy + defensive structure unlocks, this faction's OWN structure first (v63)
  for(const ub of (FAC[p.fac].ub||[]))if(B[ub]&&B[ub].tech)push(B[ub].tech);
  ['b_generator','b_turbine','b_fwdpad','b_cmdpost','b_foundry','b_guardtower','b_radiotower','b_dump','b_bunker','b_radar'].forEach(push); // v48: +radio tower (napalm/paradrop call-downs). v85: +forward pad; techAvailable gates it to Blue, so the other three armies skip it exactly as they already skip the turbine. v86: +command post, gated to Green the same way. v87: +foundry, gated to Tan
  // 5) upgrades — army buffs first, then the lab, then the rest
  ['up_barracks','up_garage','up_helipad','up_lab','up_guardtower','up_dump','up_bunker','up_generator','up_turbine'].forEach(push);
  ai.researchPlan=plan;
 }
 for(const key of ai.researchPlan){
  if(hasTech(p,key)||p.techQ.includes(key))continue;
  if(!canResearch(p,key))continue; // upgrade prereqs / availability
  // find an idle building of the type that owns this research
  const bk=researchBuilding(key);
  const b=p.blds.find(x=>x.key===bk&&x.prog>=1&&!x.techCur);
  if(!b)continue; // no eligible building yet; skip to the next affordable option
  const c=rcost(p,key);
  // keep a plastic buffer so research doesn't starve unit/building production
  if(p.res.p>=c.p+60+(p.ai&&p.ai.saveExp?170:0)+(p.ai&&p.ai.saveHQ?bcost(p,'hq').p:0)&&p.res.e>=c.e){startResearch(b,key);break;} // one assignment per tick. v90.1: research waits while the HQ is down
 }
}
function aiFindSpot(p,key,anchor){
 anchor=anchor||p.blds[0];if(!anchor)return null;
 // v61: rings 2-4 are dead ground against a 3x3 anchor once the spacing rule is
 // in, and the walk now runs out to 14 - the last ring wholly inside BUILD_R_HQ's
 // strict <. 24 samples per ring rather than 16 holds the acceptance rate up.
 for(let r=5;r<15;r++)for(let i=0;i<24;i++){const a=srand()*6.28;const tx=Math.floor(anchor.x+dcos(a)*r),ty=Math.floor(anchor.y+dsin(a)*r);if(canPlace(p,key,tx,ty))return{x:tx,y:ty};}
 return null;
}
// pick a resource node away from home (not already covered by a drop) and find buildable
// ground beside it for a forward outpost.
function aiOutpostSpot(p){
 const home=p.start;
 let best=null,bestScore=-1;
 for(const n of G.map.nodes){
  if(n.amt<=0||n.wreck)continue;
  const dHome=dhyp(n.x-home.x,n.y-home.y);
  if(dHome<14)continue; // too close to home; we already mine those
  let covered=false;for(const b of p.blds)if(b.t.drop&&dhyp(b.x-n.x,b.y-n.y)<12){covered=true;break}
  if(covered)continue;
  // prefer nearer (reachable) nodes and plastic over battery
  const score=(n.t==='plastic'?60:40)-dHome*0.4;
  if(score>bestScore){bestScore=score;best=n}
 }
 if(!best)return null;
 for(let r=2;r<6;r++)for(let i=0;i<18;i++){const a=srand()*6.28;const tx=Math.floor(best.x+dcos(a)*r),ty=Math.floor(best.y+dsin(a)*r);if(canPlace(p,'outpost',tx,ty))return{x:tx,y:ty};}
 return null;
}

/* ---------------- GHOST STORE ----------------
   Client-local last-seen snapshots (excluded from hashState and saveState,
   like fog itself). While a tile is in vision its enemy buildings, resource
   piles and nests are re-snapshotted; under partial fog the renderer draws
   these frozen ghosts instead of live objects. A building destroyed while
   fogged keeps standing as a ghost until the player re-scouts the tile. */
function snapBld(b){return{kind:'bld',ghost:1,id:b.id,key:b.key,t:b.t,p:b.p,x:b.x,y:b.y,tx:b.tx,ty:b.ty,sz:b.sz,hp:b.hp,mhp:b.mhp,prog:b.prog,upg:b.upg,tface:b.tface||0,cool:0,target:null,garrison:[],queue:[],prodT:0,sel:false,healedAt:null,rally:null}} // v27.1: freeze live-anim fields so ghosted towers/bunkers render safely
function ghostRefresh(){
 const gh=ghostInit(),live=new Set();
 for(const b of G.blds){live.add(b.id);if(b.p!==G.human&&fogAt(b.x,b.y)===2)gh.blds.set(b.id,snapBld(b))}
 for(const [id,g] of gh.blds)if(fogAt(g.x,g.y)===2&&!live.has(id))gh.blds.delete(id); // re-scouted rubble: drop the ghost
 G.map.nodes.forEach((n,i)=>{if(fogAt(n.x,n.y)!==2)return;const g=gh.nodes[i]||(gh.nodes[i]={kind:'node',ghost:1,t:n.t,x:n.x,y:n.y,max:n.max,col:n.col});g.amt=n.amt;g.wreck=n.wreck});
 gh.goneNodes=(gh.goneNodes||[]).filter(g=>fogAt(g.x,g.y)!==2); // v30.1: re-scouted mined-out piles are really gone
 (G.map.nests||[]).forEach((ns,i)=>{if(fogAt(ns.x,ns.y)!==2)return;const g=gh.nests[i]||(gh.nests[i]={kind:'nest',ghost:1,x:ns.x,y:ns.y,r:ns.r,species:ns.species,aggro:false});g.dead=ns.dead;g._spr=ns._spr});
}
