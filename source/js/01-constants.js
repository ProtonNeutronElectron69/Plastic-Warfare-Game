/* ---------------- CONSTANTS & MATH HELPERS ---------------- */
/* v98: the release stamp the main menu prints in its corner. TWO constants and
   not one string, because the menu prints them apart and a test reads them
   apart. GAME_DATE is ISO on purpose - it is what the repository can check
   against a commit, and menuStamp() is the only place it is ever rewritten for
   a human to read. Neither is sim state: nothing here is hashed, serialized or
   sent over the wire, and a peer on a different build is caught by the protocol
   check that already exists rather than by this. Bump BOTH every release. */
const GAME_VER='v100';
const GAME_DATE='2026-08-27';
/* the same version as a NUMBER, for the save-snapshot tag. That tag was a
   hand-typed `v:86` in saveState twelve releases after v86 - a second copy of
   the version that nothing tied back to the first, which is the trap this whole
   pair exists to close. Derived rather than declared: a vNN.N release keeps the
   integer of its NN, which is what a snapshot tag has always meant. Nothing
   reads it back (loadState ignores it and it is not hashed); it is a label on
   the blob, and T49.E pins both of those. */
const GAME_VER_N=parseInt(String(GAME_VER).slice(1),10)||0;
const TW=64, TH=32, HW=TW/2, HH=TH/2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
// Fisher-Yates shuffle (returns the same array, shuffled in place).
function shuffle(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(srand()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}

/* ---------------- DETERMINISTIC CORE ----------------
   Online lockstep requires every client to compute bit-identical floats.
   Math.sin/cos/atan2/hypot are NOT specified bit-exactly and differ between JS
   engines, so every sim-side call goes through these replacements instead. They
   use only IEEE-exact operations (+ - * / sqrt floor), which ARE identical on
   every conforming engine. Accuracy is ~1e-10, far beyond gameplay needs.
   srand() is the seeded sim RNG (mulberry32 with its state living on G so it
   serializes and resyncs with the match). Render/audio/particle code keeps
   using Math.random freely; it must NEVER call srand (stream alignment). */
const D_2PI=6.283185307179586, D_PI=3.141592653589793, D_HPI=1.5707963267948966;
function dsin(x){
 if(!isFinite(x))return 0;
 x=x-Math.floor(x/D_2PI)*D_2PI;                       // wrap to [0,2PI)
 if(x>D_PI)x-=D_2PI;                                  // [-PI,PI]
 if(x>D_HPI)x=D_PI-x; else if(x<-D_HPI)x=-D_PI-x;     // fold to [-PI/2,PI/2]
 const z=x*x;
 // Taylor to x^15 (max err ~6e-12 on the folded range); coefficients are exact
 // parse-time divisions, so the polynomial evaluates identically everywhere.
 return x*(1+z*(-1/6+z*(1/120+z*(-1/5040+z*(1/362880+z*(-1/39916800+z*(1/6227020800+z*(-1/1307674368000))))))));
}
function dcos(x){return dsin(x+D_HPI);}
const D_SQ3=1.7320508075688772, D_T15=0.2679491924311227, D_PI6=0.5235987755982988;
function datanCore(z){ // |z| <= 1
 let neg=false; if(z<0){z=-z;neg=true;}
 // reduce (T15,1] onto [-T15,T15] via atan(z)=pi/6+atan((z*sqrt3-1)/(z+sqrt3))
 const r=z>D_T15?D_PI6+datanCore0((z*D_SQ3-1)/(z+D_SQ3)):datanCore0(z);
 return neg?-r:r;
}
function datanCore0(z){ // |z| <= tan(pi/12), Taylor to z^15 (err ~1e-11)
 const z2=z*z;
 return z*(1+z2*(-1/3+z2*(1/5+z2*(-1/7+z2*(1/9+z2*(-1/11+z2*(1/13+z2*(-1/15))))))));
}
function datan2(y,x){
 if(x>0)return datanF(y/x);
 if(x<0)return y>=0?datanF(y/x)+D_PI:datanF(y/x)-D_PI;
 return y>0?D_HPI:(y<0?-D_HPI:0);
}
function datanF(z){ // full-range atan
 if(!isFinite(z))return z>0?D_HPI:-D_HPI;
 if(z>1)return D_HPI-datanCore(1/z);
 if(z<-1)return -D_HPI-datanCore(1/z);
 return datanCore(z);
}
function dhyp(a,b){return Math.sqrt(a*a+b*b);} // Math.hypot is not IEEE-exact; sqrt is
function srand(){
 let t=G.rngS=(G.rngS+0x6D2B79F5)|0;
 t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);
 return ((t^t>>>14)>>>0)/4294967296;
}


/* ---- combat pacing (longer engagements) ----
   HP is inflated and per-hit damage trimmed so time-to-kill grows and the health/DPS
   spread widens; fights last noticeably longer without changing any relative match-ups.
   Applied uniformly at load (see the U-table pass below). Mines and the medic keep pace
   with the bigger HP pools by riding HP_SCALE too. */
/* v30 RESCALE: every effective HP and damage number in the game shrinks by
   ×300/602 (≈0.498) so the biggest unit card (the Bull) reads exactly 300 HP.
   ONE factor rides unit HP, unit & tower damage, building HP, wildlife, nests,
   barricades, mines, strike damage and the medic heal rate, so every
   time-to-kill is proportionally identical to v29 - nothing dies faster or
   slower in relative terms, the numbers are just half the size. */
const RESCALE=300/602;
const TURR_SLEW={tank:4.5,bulltank:3.0,aatruck:4.0}; // v41: cosmetic turret slew rate (rad/s) per tank key; visual only, never hashed/serialized
const HP_SCALE=1.54*RESCALE;        // v42: unit HP; legacy 1.4 pacing +10% (Option B), folded with the v30 rescale (Bull now ~330)
const DMG_SCALE=0.81*RESCALE;       // v42: unit & guard-tower damage; legacy 0.9 -10% (Option B), folded with the rescale
/* ---- map-update tunables (mines / barricades / economy) ---- */
/* v61: a node is now deducted EXACTLY what the drop-off banks. The old 0.75
   haulage loss meant a pile lost 60 to deliver 45, so the remaining figure
   printed over every node overstated its real yield by a third. Retired to 1.0
   rather than deleted: it stays the one place a haulage loss could come back,
   and the v55 drop-off test reads it. */
const TRUCK_DROP_MUL=1;
/* v61: the load a truck carries, per resource. Was a bare 60 for both.
   plastic 45 - the delivered figure v60 already produced (60 * 0.75), so plastic
             income is flat. The fill is shorter than v60's, so a round trip is
             ~0.75s quicker: a few percent up, in the wanted direction.
   battery 23 - against v60's delivered 45, a 49% cut. Electricity was the
             runaway resource; every army was plastic-bound with power to spare.
   Read through cargoCap() so a null cargoT (an empty truck) still answers. */
const CARGO_CAP={plastic:45,battery:23};
function cargoCap(t){return CARGO_CAP[t]||CARGO_CAP.plastic;}
/* v61's two ends of findNode's battery lean (a -6 pull under 200 electricity and
   a +12 push over 400) were retired at v75 along with v22's hard filter under 120.
   All three were absolute thresholds on ONE resource. Their symmetric replacement
   is the resource servo, which has to be declared next to findNode rather than
   here because it derives its reference ratio from U and B. */
const MINE_DMG=360*HP_SCALE, MINE_R=3.2; // landmine dmg tracks HP so a direct hit still one-shots a tank
const MINE_TRIG=0.62;               // a ground unit within this many tiles of a mine sets it off
const MINES_PER_MAP=20;             // ~20 mines scattered per map (laid as 10 mirrored pairs)
const MINE_KEEPOUT=14;              // v67: tiles of clear ground around EVERY start before a mine may be buried
/* v67: was 12, which is inside the natural-expansion ring (the site lands
   11.5-13.5 tiles out), so mines were being buried on the approach to your
   own second base. 14 still fills all 20 mines on every seed measured. */
const HAZ_SC=0.80;                  // v67: linear scale on every terrain-hazard blob (0.80 linear = 0.64 area)
/* v76: 7.0 -> 4.9 (a 30% cut). Damage per SECOND a code-2 terrain hazard deals to
   any ground unit or wildlife standing in it. Named because updateHazards sweeps
   units and creatures separately and the two literals could drift apart. */
const HAZ_DPS=4.9;
/* Applied ONCE, inside field(), so all 17 call sites inherit it and none of
   the per-call rnd() rolls move. Hazards at 1.0 covered 18.6-21.7% of the
   board; the maps read as clutter rather than as terrain. */
const BARR_HP=50;                   // barricade hit points (v30: rescaled from 100)
const BARR_COST=20;                 // plastic per barricade segment
const BARR_CLEAR2=6.0*6.0;   // v83: how close a BOT unit must be to bother knocking down one of the map's neutral hedgehogs
const BARR_CLEAR_SHARE=4;    // ...and one unit id in this many will, so an army thins the clutter as it passes instead of every man stopping at once
const BARR_AGGRO2=3.3*3.3;          // units only auto-target a barricade within this range (lets them break through)
/* v77 D4: the Munitions Dump aura had THREE copies of itself - a bare 1.30/1.15
   pair at the damage site, prose in B.dump.d and in the upgrade blurb, and an
   UPGRADES.dump.eff of 2.0 that no reader ever consulted (the three .eff readers
   are the two eps income sites and the info card's garrison line, and the dump
   has neither eps nor gar). Worse, 2.0 did not even describe the literal it was
   meant to: 1.30/1.15 is 1.13. One source now. 1+0.15 and 1+0.30 are exactly the
   doubles 1.15 and 1.30, so the damage site is bit-identical. */
const DUMP_AURA=0.15;               // damage bonus to allies inside DUMP_R of a Munitions Dump
const DUMP_AURA_UP=0.30;            // ...and once the Munitions Upgrade is researched
const DUMP_R=9;                     // aura radius in tiles
const NEST_HP=140;                  // v25: wildlife nest structure hit points (v30: rescaled from 280)
/* v77: DESK SURVIVAL ECONOMY. These four amounts were bare literals inside
   survivalSetup and were ALSO retyped in three harness tails, which is how a 20%
   ring change turned into six unrelated test failures. One home, so a later
   balance pass moves the number once. The ring is the starter base beside the
   flag; the corner pairs sit out in the wave zone and were deliberately left
   alone by the v77 scope. Map data, not sim state: nothing here is hashed by
   hashState, though layoutHash DOES hash node.amt, which is why the three Desk
   layout baselines move with this edit and the twelve others do not. */
const DESK_RING_P=4212;             // v37 3510, v77 +20%
const DESK_RING_E=2520;             // v37 2100, v77 +20%
const DESK_CORNER_P=3240;           // v37, unchanged at v77
const DESK_CORNER_E=2340;           // v37, unchanged at v77
const NEST_REGEN=1350;              // v66: ticks between reserve top-ups at a living den (45s at 30/s)
const NEST_AGGRO2=8*8;              // v66: how close an AI unit will break a den that is swarming it
/* v68 MOVEMENT ROBUSTNESS tunables. All six are pathing/steering only: none of
   them enters hashState, the snapshot encoder or loadState. */
const PF_UNSTICK_R=3;               // v68: tiles of spiral scan when depenetrating a wedged mover
const PF_SPAWN_R=4;                 // v68: same scan, wider, for a creature drawn onto blocked ground
const CLR_CAP=9;                    // v68: clearance grid saturates here (fits Uint8, 9 is past any corridor that matters)
const CLR_PEN=[0,1.5,0.5,0,0,0,0,0,0,0]; // v68: extra A* step cost by clearance. Indices 1 and 2 are the wall-huggers
const CLR_TTL=120;                  // v68: backstop rebuild cadence in ticks, in case a pass write ever escapes pfDirty()
const NODE_DOCK_N=8;                // v68: dock slots on a resource node's ring
const NODE_DOCK_R=1.6;              // v68: ring radius. 70.5% of slots stand-able across all maps, no node with zero
const NODE_REACH=2.0;               // v68: was a bare 1.75 - a truck parked on the 1.6 ring has to count as arrived
const NODE_REPATH=12;               // v68: ticks between a truck's post-arrival re-aims at its node (keyed on tick+id, never the clock)
const MINE_OWNER={kind:'mine',key:null,p:null}; // synthetic "attacker" for mine blasts (no kill credit, hits everyone)
// landmine damage by distance from the blast centre (1-shots a tank on a direct hit,
// a jeep on an adjacent tile, a grunt ~2 tiles out, falling to nothing by ~3 tiles)
function mineDmg(d){return MINE_DMG*Math.max(0,1-d/MINE_R);}

