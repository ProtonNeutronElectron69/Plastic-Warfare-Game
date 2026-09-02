/* ---------------- DATA TABLES ---------------- */
/* v85: ub is an ARRAY, on the same footing as uu. Every army is headed for TWO
   exclusive structures, and while it was a bare string the second one had nowhere
   to live - `ub` was read in seven places, three of which compared it with === and
   would have quietly answered "no" for a faction's second building. Changing the
   shape once, ahead of any content, means the seven readers were fixed together
   and the trails could prove the move changed nothing. Wildlife carries an empty
   array rather than an empty string for the same reason uu is already []. */
const FAC={
 green:{name:'Green Army',color:'#4caf50',mods:{cost:.92,hp:1,dmg:1,speed:1},desc:'Balanced forces, 8% cheaper everything.',uu:['sarge','mortar','cmdtruck','balloon'],ub:['radar','cmdpost']},
 tan:{name:'Tan Army',color:'#d2b074',mods:{cost:1,hp:1,dmg:1.15,speed:.95},desc:'+15% damage, slightly slower.',uu:['flamer','bulltank','firebomb'],ub:['dump','foundry']},
 gray:{name:'Gray Army',color:'#9b9ba3',mods:{cost:1,hp:1.2,dmg:.95,speed:.92},desc:'+20% toughness, slightly slower.',uu:['sniper','arty','choktaw'],ub:['bunker','hbarricade']},
 blue:{name:'Blue Army',color:'#4a7de0',mods:{cost:1,hp:.9,dmg:1,speed:1.15},desc:'+15% speed, lighter plastic (-10% HP).',uu:['bike','chinook','runner'],ub:['turbine','fwdpad']},
 bug:{name:'Wildlife',color:'#6e5a2a',mods:{cost:1,hp:1,dmg:1,speed:1},desc:'',uu:[],ub:[]}
};
const U0AURA=0.15; // v82: the Chinook's infantry aura, named ABOVE the table so its own info card can state the figure the row sets rather than a retyped copy of it
const MEDIC_HEAL_RADIUS=2; // tiles. v88.1: MOVED up here from below the table, on U0AURA's rule - the Medic's own info card could not read it from inside the table it is declared after, which is the temporal-dead-zone trap the v86 note records
const U={
 grunt:{n:'Grunt',a:'inf',hp:62,dm:6,rg:3.6,rt:.8,sp:2.3,vi:6,cp:36,ce:0,bt:2.5,w:'b',d:'Basic rifleman'},
 grenadier:{n:'Grenadier',a:'inf',hp:64,dm:9,rg:3.7,rt:1.15,sp:2.25,vi:6,cp:55,ce:0,bt:6,w:'g',spl:1.125,ex:1,tech:'u_grenadier',d:'Lobs frag grenades; minor splash'},
 // v69: cp 115 -> 140. At 115 the Gunner held the best effective DPS per plastic
 // against inf/light/medium/bldg AND, entrenched, beat the Bazooka against heavy
 // armor (14.85 vs 10.76), which is the Bazooka's whole job. The counter matrix
 // cannot function while one generalist wins the specialists' own columns.
 /* v78: hp 125 -> 100, rt .4 -> .5, cp 140 -> 112. A repositioning, not a
    rebalance: he is 20% cheaper, 20% squishier and 20% slower-firing, and his
    cost efficiency does not move at all. Damage per plastic is dm/(rt*cp) and
    0.5*112 === 0.4*140 === 56, so every ratio the suite pins holds by
    arithmetic rather than by luck - the Flamethrower keeps the infantry lead
    at 1.0124x (T26.H, T50.C), the competitive pools stay 4/9/9/2/1/8 (T26.C),
    and entrenched he still loses the Bazooka's own column at 7.78 vs 10.76
    per 100 plastic (T48.C). The v69 paragraph above therefore still holds
    unchanged; it is the reason 112 was chosen over a deeper cut.
    What DOES move is the hull, which no efficiency measure reads: 96 -> 77
    effective. He now dies to roughly a fifth less fire while costing a fifth
    less to replace. RESEARCH.u_gunner rides t.cp at load and follows the price
    down on its own, so the unlock is not repeated here. Measured at v78 the
    unlock goes 109p/76e/11.9s -> 97p/71e/11.3s, and THAT is why fixtures which
    never field a Gunner inside their sampling window still diverge: the bots
    buy the unlock long before they build the man. */
 /* v88.1: 112 -> 125, and the ONLY thing it is for is the supply rank. v88 put a
    25th unit in the roster, which slid SUP_U's quartile cuts one place and left him
    the 7th-cheapest trainable unit - i.e. back on 1 supply, and back to being the
    best per-supply buy in the game, which is the cliff the v69 ladder exists to
    remove. 121 is the least that clears the Flamethrower's 120 and puts him on 2;
    125 is the round number just past it. His reload, hull, range and speed are all
    the v78 figures, untouched.
    THE SEVENTH SLOT DOES NOT DISAPPEAR, it changes hands: the Flamethrower is the
    7th-cheapest now and takes the 1-supply rank. That is strictly the better of
    the two, and for the reason T50.C already records about the damage-per-plastic
    table - the Flamethrower is TAN-EXCLUSIVE, so three armies in four cannot field
    the per-supply leader at all, and his lead over the Bazooka is 1.06x against the
    Gunner's 1.11x. Measured before the edit; see tail_v88_1 T63.A. */
 gunner:{n:'Machine Gunner',a:'inf',hp:100,dm:12,rg:4,rt:.5,sp:1.9,vi:6,cp:125,ce:0,bt:9,w:'b',entrench:1,tech:'u_gunner',d:`Tough, heavy MG. Entrench to fire ${Math.round((ENTRENCH_RATE-1)*100)}% faster in a frontal cone`},
 bazooka:{n:'Bazooka Man',a:'inf',hp:55,dm:30,rg:4.6,rt:2.2,sp:2.1,vi:6,cp:90,ce:0,bt:7,w:'r',spl:.75,ex:1,tech:'u_bazooka',d:'Anti-armour rockets; needs an escort'},
 /* v85 BLUE, Barracks slot. Under a Grunt on both of the numbers that matter -
    46 HP against 62 and 5.0 DPS against 7.5 - and priced ABOVE him at 62, which is
    the shape the owner asked for: what you buy is the two auras, not the pistol.
    The pistol is weapon row 'b', the same small-arms row the Grunt's rifle uses, at
    a shorter 3.2 range; a tenth weapon row for one sidearm would have widened every
    damage table in the file to say nothing new.
    noPace keeps him out of MEDIC_HEAL_RATE's floor - see the note there. */
 runner:{n:'Signal Runner',a:'inf',hp:46,dm:4.5,rg:3.2,rt:.9,sp:2.5,vi:7,cp:62,ce:0,bt:4,w:'b',noPace:1,rnet:1,sprint:1,tech:'u_runner',d:`Signals rather than fights, and is weaker than a Grunt for it. Radio Net: friendly infantry within ${RNET_R} tiles gain +${RNET_VI} sight. Sprint: all of them gain ${Math.round(SPRINT_SPD*100)}% speed, but none may fire`},
 truck:{n:'Dump Truck',a:'truck',hp:130,dm:0,rg:0,rt:0,sp:2.7,vi:5,cp:20,ce:0,bt:8,w:0,d:'Harvests resources'},
 medic:{n:'Medic Truck',a:'truck',hp:135,dm:0,rg:0,rt:0,sp:2.3,vi:6,cp:150,ce:20,bt:11,w:0,heal:1,healR:2,tech:'u_medic',d:`Unarmed. Heals allied units and buildings within ${MEDIC_HEAL_RADIUS} tiles`}, // v29: paces the grunt
 // v78: hp 115 -> 132.25 (+15%, effective hull 88 -> 101) and rt .5 -> .425
 // (-15% reload, DPS 7.26 -> 8.54). 132.25 is the exact +15% rather than a
 // rounded 132 - both round to the same effective hull, and the exact figure
 // stays auditable. Widens two competitive pools it was previously just under
 // (T26.C inf 4 -> 5, bldg 8 -> 9); nothing narrows.
 /* v86 GREEN, Garage slot. Unarmed: what is bought is the map pin and the
    whistle, exactly as the Signal Runner's price is the radio and not the pistol.
    Its own archetype 'cmd' rather than 'truck', because t.a==='truck' means
    HARVESTER at fifteen doors in this file - the idle branch in updateUnit would
    send a command vehicle off to mine, and the Medic only escapes that by carrying
    t.heal. armorOf's fallback answers 'light' for an unknown archetype, which is
    the right class for a soft-skinned lorry, and it is listed in ARMOR_OF_A so the
    row says so rather than relying on a default.
    Priced at 145+20 so the supply quartiles do not move - see the note there. */
 cmdtruck:{n:'Command Truck',a:'cmd',hp:210,dm:0,rg:0,rt:0,sp:2,vi:7,cp:145,ce:20,bt:12,w:0,fwdcmd:1,bcast:1,tech:'u_cmdtruck',d:''}, // d is written in the post-table pass below B, because it names structures and B is declared after U
 jeep:{n:'MG Jeep',a:'jeep',hp:132.25,dm:9,rg:4,rt:.425,sp:3.7,vi:7,cp:130,ce:10,bt:9,w:'b',tech:'u_jeep',d:'Fast machine-gun car'},
 // v51: air defence. sal/srt are the salvo shape (4 missiles 0.22s apart) and rt is the
 // RELOAD that follows it, so DPS is dm*sal/(rt+(sal-1)*srt) - see unitDPS(). aaOnly is
 // the target filter; weapon row 'a' is zero against every ground class as a second lock.
 aatruck:{n:'AA Missile Truck',a:'aa',hp:185,dm:40.8,rg:7,rt:3,sp:2.5,vi:6,cp:180,ce:30,bt:11,w:'a',spl:1.125,ex:1,aaOnly:1,sal:4,srt:.22,tech:'u_aatruck',d:'Air only: a 4-missile salvo, then a 3s reload. Cannot touch a ground target at all'},
 tank:{n:'Tank',a:'tank',hp:270,dm:42,rg:5,rt:2.4,sp:2.4,vi:6,cp:220,ce:40,bt:14,w:'s',spl:1,ex:1,tech:'u_tank',d:'Main battle tank'},
 heli:{n:'Huey',a:'heli',hp:155,dm:12,rg:4.6,rt:.55,sp:4.2,vi:8,cp:200,ce:70,bt:13,w:'b',fly:1,tech:'u_heli',d:'Fast flying gunner'},
 sarge:{n:'Sarge',a:'inf',hp:210,dm:15,rg:4.2,rt:.42,sp:2.6,vi:7,cp:260,ce:60,bt:16,w:'b',lim:1,rally:1,regen:1,tech:'u_sarge',d:`Hero commando, 1 max. Regenerates ${SARGE_REGEN} HP/s after ${SARGE_CALM}s unhit. "On Me!": allied infantry within ${SARGE_AURA_R} tiles gain +${Math.round(SARGE_AURA*100)}% damage, at half his own`},
 mortar:{n:'Mortar Squad',a:'inf',hp:52,dm:36,rg:7.5,mrg:2,rt:3.4,sp:1.9,vi:6,cp:150,ce:0,bt:9,w:'m',spl:1.5,ex:1,wf:1,smokeCap:1,tech:'u_mortar',d:`Arcing shells from far off. Walking Fire ramps consecutive hits on one target +${Math.round(MORT_WF_STEP*100)}% each, to +${Math.round(MORT_WF_CAP*100)}%. Smoke Rounds shell friendlies instead, cutting their damage taken ${Math.round(SMOKE_RED*100)}%`},
 flamer:{n:'Flamethrower',a:'inf',hp:72,dm:13,rg:2.3,rt:.5,sp:2.2,vi:5,cp:120,ce:0,bt:8,w:'f',spl:.625,ex:1,cook:1,valve:1,tech:'u_flamer',d:`Melts infantry up close. Cook-Off leaves what he touches burning at ${COOK_DPS}/s. Pressure Valve: +${Math.round(VALVE_DMG*100)}% damage and +${VALVE_RG} range, at ${Math.round(VALVE_BACK*100)}% of it back on him`},
 bulltank:{n:'"Bull" Heavy Tank',a:'tank',hp:430,dm:60,rg:5,rt:3,sp:1.9,vi:6,cp:391,ce:80.5,bt:18,w:'s',spl:1.25,ex:1,big:1,plate:1,throttle:1,sec:{w:'f',wc:'f',k:.15,rt:.55,rg:2.6,spl:.625},tech:'u_bulltank',d:`Rolling fortress. The hull flamer takes infantry and wildlife, the cannon takes everything else, both at once. Ablative plate ignores small arms outright. Full Throttle adds ${Math.round(THROTTLE_SPD*100)}% speed and crushes infantry and barricades, but silences both guns`},
 sniper:{n:'Sniper',a:'inf',hp:46,dm:55,rg:7.2,rt:3,sp:2.1,vi:9,cp:170,ce:0,bt:9,w:'b',camo:1,cshot:1,tech:'u_sniper',d:`Kills infantry from a long way off. Camouflaged: cannot be targeted until he fires, and is unseen again ${CAMO_T}s after his last shot. Called Shot adds ${Math.round(CS_DMG*100)}% damage but limits him to enemy infantry`},
 arty:{n:'Rocket Artillery',a:'arty',hp:95,dm:70,rg:9,mrg:3,rt:5,sp:1.7,vi:6,cp:320,ce:90,bt:18,w:'m',spl:2.8125,ex:1,shock:1,ripple:1,tech:'u_arty',d:`Siege rockets. Shell Shock adds ${SHOCK_SET}s to the reload of anyone who survives the blast. Ripple Fire trades the shell for ${RIPPLE_N} rockets at ${Math.round(RIPPLE_DM*100)}% each over a wider box, for ${Math.round((RIPPLE_RT-1)*100)}% more reload`},
 // v78: fire rate -20%, which is rt .5 -> .625 (= .5/0.8, exact in binary64),
 // not a 20% cut to the reload. DPS 5.66 -> 4.53. He drops out of three
 // competitive pools he was marginal in (T26.C light and medium 9 -> 8, bldg
 // 9 -> 8 against the widened jeep); intended, and Blue-exclusive.
 bike:{n:'Scout Bike',a:'bike',hp:70,dm:7,rg:3.5,rt:.625,sp:5.1,vi:9,cp:90,ce:5,bt:6,w:'b',evade:1,flat:1,tech:'u_bike',d:`Blazing scout. Evasive: ${Math.round(EVADE_RED*100)}% less damage on any tick he actually moved. Flat Out adds ${Math.round(FLAT_SPD*100)}% speed and +${FLAT_VI} sight, but he cannot fire or be given a target`},
 // v30 additions - table values are pre-load-scale baselines; effective (in-game) numbers in the comments
 apache:{n:'Apache',a:'heli',hp:244,dm:66.9,rg:4.8,rt:1.7,sp:3.8,vi:8,cp:300,ce:110,bt:16,w:'r',spl:.75,ex:1,fly:1,tech:'u_apache',d:'Rocket attack chopper'}, // 170 HP / 30 dmg effective
 /* v88 GRAY, Helipad slot - the last empty cell in FAC_INF/FAC_VEH/FAC_AIR, and
    the last unit roadmap 2 adds. It is the FIRST unit in the file to carry two
    weapons that are both ordinary guns: the Bull has carried a `sec` since v80,
    but its hull flamer is a support weapon bolted to a cannon, whereas the
    Choktaw is genuinely the Huey's machine gun and the Apache's rocket pods on
    one airframe. That is why fireSec stopped assuming a flamethrower at this
    release - see the note there.
    The split falls out of secOwns UNCHANGED: the rockets take armour, aircraft
    and structures, the machine gun takes infantry and wildlife, which is exactly
    the division the Bull's cannon and hose already run under.
    vi 9 is one above every other helicopter, and it is load-bearing rather than
    decorative: Forward Observer and Paint are both about what this aircraft can
    SEE, so its sight radius is the actual reach of both.
    hp 265 -> 203 effective, above the Apache's 187 by specification; with Gray's
    x1.2 hull it fields at 244. Priced at 468 total, which puts it in the top
    supply rank - and moves three existing units down one rank, which is
    unavoidable for ANY 25th trainable unit priced above the Machine Gunner. That
    was measured before the row went in; see the SUP_U note and tail_v88 T62.A. */
 choktaw:{n:'Choktaw Heli',a:'heli',hp:265,dm:58,rg:4.8,rt:1.9,sp:3.5,vi:9,cp:330,ce:120,bt:17,w:'r',spl:.75,ex:1,fly:1,fobs:1,paint:1,abCd:PAINT_CD,sec:{w:'b',wc:'b',k:.22,rt:.5,rg:4.2},tech:'u_choktaw',d:`Two weapons at once: rocket pods for armour and structures, a door gun for infantry. Forward Observer gives friendly arcing weapons +${FOB_RG} tiles against anything it can see. Paint marks a ${PAINT_BOX}×${PAINT_BOX} area for +${Math.round(PAINT_DMG*100)}% damage from EVERY source, ${PAINT_T}s. ${PAINT_CD}s cooldown`},
 /* v87 TAN, Helipad slot. Weapon row 'f', which is the row Tan already lives on -
    the Flamethrower's hose and the Bull's hull flamer both score there - so the
    Firebomb reads as the same army's idea carried into the air rather than as a
    second Apache. Row 'f' is 1.35 into infantry and 0.45 into heavy armour, so it
    is a soft-target weapon that a tank column ignores; that is the point of it.
    Priced above the Observation Balloon so it lands in the top supply rank without
    shoving anything below it across a boundary - see the note on SUP_U.
    abCd is the first entry of its kind in this table: a UNIT ability with a clock.
    See the machinery note at updateUnit. */
 firebomb:{n:'Firebomb Heli',a:'heli',hp:210,dm:52,rg:4.2,rt:1.6,sp:3.6,vi:8,cp:280,ce:90,bt:17,w:'f',spl:1,ex:1,fly:1,scorch:1,fbomb:1,abCd:FB_CD,tech:'u_firebomb',d:`Sows fire from the air. Scorched Earth leaves the ground burning ${SCORCH_T}s under every hit. Napalm Blast drops ${FB_N} bombs within ${FB_R} tiles, each burning ${FB_BURN}s — and the fire takes YOUR men too. ${FB_CD}s cooldown`},
 apc:{n:'APC',a:'apc',hp:287,dm:0,rg:0,rt:0,sp:2.3,vi:6,cp:260,ce:40,bt:14,w:0,rad:.46,cap:10,shield:1,tech:'u_apc',d:'Carries 10 infantry (right-click to load, U to unload). Shields itself and nearby infantry −25%; the squad bails at 85% HP if it dies'}, // 220 HP effective
 // v46: Blue's exclusive, replacing the Gunship. Unarmed tandem-rotor transport - the
 // APC's hull literal (220 effective), the fastest chopper in the game, 15 seats, and a
 // non-stacking +15% damage aura for allied infantry within auraR tiles. It carries no
 // shield flag, so unlike the APC it grants no damage reduction. w:0 pins it to row 'x'.
 chinook:{n:'Chinook',a:'heli',hp:287,dm:0,rg:0,rt:0,sp:4.5,vi:8,cp:300,ce:100,bt:15,w:0,fly:1,cap:15,aura:U0AURA,auraR:3,assault:1,tech:'u_chinook',d:`Unarmed transport: 15 infantry (right-click to load, U to unload). Nearby infantry hit ${Math.round(U0AURA*100)}% harder. Air Assault lets the squad fire from the hold, but pins the aircraft`},
 /* v86 GREEN, Helipad slot, and it REPLACES the observation helicopter the
    roadmap first proposed. The highest sight in the game (above the Radar Tent's
    13, so it beats the buildings as well as the units), unarmed, and drifting at
    half a Mortar Squad's pace. What makes it a balloon rather than a slow
    aircraft is the pair of rules at targetDmgMul and splash: nothing but weapon
    row 'a' may even acquire it, and what does deals BALLOON_AA of its damage.
    It has no unit limit by decision, and BALLOON_FUEL is the brake instead - it
    comes down on its own after three minutes whether or not anyone shot at it,
    and the crash takes the crew with it. Bail is the only way to get them back. */
 balloon:{n:'Observation Balloon',a:'balloon',hp:120,dm:0,rg:0,rt:0,sp:1.2,vi:BALLOON_VI,cp:250,ce:60,bt:14,w:0,fly:1,balloon:1,highg:1,bail:1,tech:'u_balloon',d:''}, // d is written in the post-table pass below B, on the same rule as the Command Truck's
 para:{n:'Paratrooper',a:'inf',hp:171.75,dm:13.35,rg:3.8,rt:.35,sp:2.4,vi:6,cp:0,ce:0,bt:1,w:'b',noTrain:1,d:'Elite drop infantry; swaps SMG / AT / HE by target'} // v42: -25% hp & dps (was 229/17.8); ~132 HP effective under v42 pacing; paradrop-only
};
// Combat pacing: inflate HP and trim damage so engagements run longer (see HP_SCALE/
// DMG_SCALE up top). Done once at load; per-unit values above stay readable as baselines.
for(const k in U){U[k].hp=Math.round(U[k].hp*HP_SCALE);U[k].dm=+(U[k].dm*DMG_SCALE).toFixed(2);}
// Global balance: every unit builds 15% faster. Applied once at load so all
// per-unit bt values above stay readable as their pre-reduction baselines.
for(const k in U)U[k].bt=+(U[k].bt*0.85).toFixed(3);
// Medic heal rate = 10% slower than the lowest-DPS COMBAT unit in the game, then
// scaled by HP_SCALE so sustain keeps pace with the larger health pools.
/* v85: t.noPace was added for the Signal Runner and the reason is worth stating,
   because the trap here is silent and global. This floor is a Math.min over the
   whole roster, so ANY new unit deliberately built weak drags it down for all four
   armies at once - the Runner's 5.0 DPS would have taken the Medic from 5.18 HP/s
   to 3.25, a 37% nerf to a unit nobody was editing, in a Blue release. The
   derivation means "the weakest thing that fights"; a support man carrying a
   sidearm is not that, and says so on his own row rather than being special-cased
   by name here. */
const MEDIC_HEAL_RATE=(function(){
 let lo=Infinity;
 for(const k in U){const t=U[k];if(t.dm>0&&t.rt>0&&!t.heal&&!t.noPace)lo=Math.min(lo,t.dm/t.rt);}
 return lo*0.9*HP_SCALE; // 10% slower than lowest DPS, kept proportional to HP
})();
/* Medic station keeping (v44). A medic that merely tags along with a group spends
   the fight parked outside its own aura, so a moving medic aims at the centroid of
   the escorts it owns rather than at the formation slot the order handed it. Tiles
   throughout; RESCALE rides HP and damage only, so none of this is rescaled. Every
   value is read fresh each tick from hashed state: nothing here is serialized. */
const MEDIC_LEASH=8;         // escorts this close count as company (matches medicHold)
const MEDIC_GROUP_R=6;       // ...and count as THIS medic's group if their dest is this close to its own
const MEDIC_COVER=MEDIC_HEAL_RADIUS+0.25; // "already covered" test, a shade inside the +0.5 heal reach so rim units are not chased
const MEDIC_BAND=0.35;       // dead band around the aim point: stop, do not jitter
const MEDIC_STEER_MAX=5;     // further than this the medic uses its path, not a direct step
const MEDIC_SEP=3.5;         // two medics closer than this shove their aim points apart
const MEDIC_SEP_K=0.6;       // ...by this share of the shortfall (higher id yields, so a pair cannot oscillate)
const MEDIC_WAIT_R=14;       // stragglers under the same order count this far out when deciding to wait
const MEDIC_CATCHUP=1.25;    // speed allowance while closing on the aim point (never applies to ordered travel)
const MEDIC_REPATH=12;       // ticks between repaths when the aim point is around a corner (keyed on tick+id, never the clock)
const MEDIC_SETTLE_R=5;      // arrival scan radius (idle escorts count here, unlike in transit)
const MEDIC_SETTLE_BAND=0.9; // do not re-park on arrival for less than this
const DEPOT_SUP=15; // v83: 10 -> 15, so a base reaches the ceiling on SEVEN depots instead of ten and gives three footprints of buildable ground back. Named above the table on the same rule as BUNK_GAR below
const BUNK_GAR=4; // the Bunker's garrison, named ABOVE the table on the same rule as U0AURA: the row cannot read its own literal while it is being written, so its info card would otherwise have to retype the figure the row sets
/* v90.1 `cat` - which shelf of the Construct menu a structure sits on, DECLARED
   on the row rather than guessed from its other flags. The four shelves are
   MENU_CATS below: what builds units, what pays for them, what shoots back, and
   everything else. It has to be a declared field: "is this economy" has no flag
   that answers it (the Radar Tent carries no eco marker and the Outpost carries
   three), and keying it on the KEY is the v88 mistake the Heavy Barricade cost
   fourteen tests to unlearn. A new row without one lands on 'misc', which is
   where an unclassified structure belongs anyway; T64.A pins that every roster
   row declares one on purpose rather than falling through.

   v90.1 `lim:1` on the HQ - one headquarters per army at a time. The limit is the
   Radio Tower's, i.e. the field every door in the file already honours:
   startPlacing refuses it, structTile greys the tile, and execCmd's build case
   enforces it against a peer that sends anything else. The AI's own rebuild has
   to be guarded separately because aiTick calls placeBuilding directly and never
   goes through execCmd - the same surface v87's Napalm gate hid behind. */
const B={
 hq:{cat:'misc',n:'HQ',hp:1500,sz:3,cp:500,ce:100,bt:25,vi:8,prod:['truck'],drop:1,anywhere:1,sup:10,lim:1,d:`Command centre and drop-off; anchors a ${BUILD_R_HQ}-tile build zone. One at a time — rebuild it from the 🏛 button over the minimap if it falls`},
 barracks:{cat:'prod',n:'Barracks',hp:620,sz:2,cp:160,ce:0,bt:10,vi:5,prod:['grunt','grenadier','bazooka','gunner'],d:'Trains infantry'},
 lab:{cat:'misc',n:'Research Lab',hp:640,sz:2,cp:260,ce:60,bt:14,vi:5,req:'barracks',lab:1,d:''},
 garage:{cat:'prod',n:'Garage',hp:720,sz:3,cp:240,ce:20,bt:14,vi:5,req:'barracks',tech:'b_garage',prod:['jeep','tank','aatruck','medic','apc'],d:'Builds vehicles'},
 helipad:{cat:'prod',n:'Helipad',hp:520,sz:3,cp:220,ce:60,bt:12,vi:5,req:'garage',tech:'b_helipad',prod:['heli','apache'],d:'Builds helicopters'},
 generator:{cat:'eco',n:'Generator',hp:360,sz:2,cp:140,ce:0,bt:8,vi:4,tech:'b_generator',eps:1.6,d:'+1.6 ⚡/sec'},
 supply:{cat:'eco',n:'Supply Depot',hp:420,sz:2,cp:120,ce:0,bt:9,vi:4,sup:DEPOT_SUP,d:`Supply yard: +${DEPOT_SUP} 🪖 supply. No research needed.`},
 guardtower:{cat:'def',n:'Guard Tower',hp:540,sz:1,cp:170,ce:30,bt:10,vi:9,req:'barracks',tech:'b_guardtower',dm:15,rg:7,rt:.6,tower:1,d:'Auto-cannon tower: long sight and reach, fires on its own'},
 radar:{cat:'misc',n:'Radar Tent',hp:420,sz:2,cp:200,ce:50,bt:10,vi:13,req:'barracks',tech:'b_radar',uplink:1,d:`Huge sight, plus enemy blips on the minimap. Target Uplink: +${UPLINK_RG} range and +${UPLINK_VI} sight army-wide for ${UPLINK_T}s`},
 radiotower:{cat:'misc',n:'Radio Tower',hp:588,sz:2,cp:60,ce:200,bt:12,vi:12,req:'barracks',tech:'b_radiotower',lim:1,radio:1,d:'Opens the call-down panel on the right, 1 max. Long sight'}, // v30: 293 HP effective; inverted cost (mostly ⚡)
 dump:{cat:'misc',n:'Munitions Dump',hp:520,sz:2,cp:220,ce:40,bt:10,vi:5,req:'barracks',tech:'b_dump',scuttle:1,d:'+'+Math.round(DUMP_AURA*100)+'% damage to friends within '+DUMP_R+' tiles. Scuttle detonates it for '+SCUTTLE_DM+' over '+SCUTTLE_R+' tiles, '+Math.round(SCUTTLE_FF*100)+'% of it onto your own'},
 /* mult (v85): a bot builds this exclusive in NUMBERS rather than as a single
    signature piece, so it leads the build wish list and gets second and third
    entries later on. It was a name check on 'bunker' and 'turbine' inside aiTick
    until ub became a list; as a table flag the row states its own habit. */
 bunker:{cat:'def',n:'Bunker',hp:820,sz:2,cp:200,ce:0,bt:10,vi:6,req:'barracks',tech:'b_bunker',gar:BUNK_GAR,lock:1,mult:1,d:`Garrisons ${BUNK_GAR} infantry, who fire out and are safe from splash. Lockdown silences them but cuts damage taken ${Math.round(LOCK_RED*100)}% for ${LOCK_T}s`},
 outpost:{cat:'eco',n:'Outpost',hp:780,sz:2,cp:240,ce:20,bt:13,vi:7,req:'barracks',prod:['truck'],drop:1,anywhere:1,expand:1,sup:4,d:`Forward base: builds and refuels Dump Trucks anywhere, and opens a ${BUILD_R_OUTPOST}-tile build zone`},
 turbine:{cat:'eco',n:'Wind Turbine',hp:260,sz:1,cp:110,ce:0,bt:6,vi:4,tech:'b_turbine',eps:2.2,over:1,mult:1,d:`+2.2 ⚡/sec, cheap. Overdrive runs it at ×${OVER_MUL} for ${OVER_T}s, then it makes nothing for ${OVER_OFF}s`},
 /* v85 BLUE, second structure. The passive is the point: NOTHING repaired aircraft
    before this - the Medic Truck heals ground units and buildings, and a damaged
    Huey stayed damaged until it died. So Blue's second building is the only field
    hospital in the game that an aircraft can use, which suits the fastest air force
    in the game. Scramble is the timed half, on the building's existing upT and
    abilityCool exactly as Overdrive and Lockdown already are. */
 fwdpad:{cat:'misc',n:'Forward Pad',hp:480,sz:2,cp:230,ce:70,bt:12,vi:6,req:'garage',tech:'b_fwdpad',pad:1,scram:1,d:`Repairs friendly aircraft within ${PAD_R} tiles at ${PAD_REP} HP/s — nothing else in the game repairs them. Scramble: +${Math.round(SCRAM_SPD*100)}% speed to every aircraft you own for ${SCRAM_T}s`},
 /* v87 TAN, second structure. The passive is a PRODUCTION buff rather than an
    aura, which is what "produced while it stands" means: the hull is baked in at
    makeUnit and the vehicle keeps it if the Foundry burns down an hour later. It
    rides the same door the Garage upgrade's unitBuff already uses, and stacks with
    it - the upgrade is a Garage that builds better, the Foundry is an army that
    does. Pour is the timed half, on the abilityCool every other structure ability
    already uses, and it is instantaneous, so it writes no upT. */
 foundry:{cat:'misc',n:'Foundry',hp:660,sz:2,cp:260,ce:50,bt:13,vi:5,req:'garage',tech:'b_foundry',foundry:1,pour:1,d:`Vehicles built while it stands keep +${Math.round(FOUNDRY_HP*100)}% hull for good. Pour finishes the front vehicle in every Garage at once, at +${Math.round(POUR_COST*100)}% plastic each. ${POUR_CD}s cooldown`},
 /* v86 GREEN, second structure. Both halves are the same radius and the same
    scan, which is why they share CPOST_R: a post is a place your army gets better
    at being, not two overlapping effects with different reaches. The passive is a
    cheaper LADDER rather than extra kill credit, because u.kl is an integer and is
    hashed through hI's |0 - crediting 1.5 kills would advance the state without
    advancing the hash, which is a lockstep divergence with no symptom until it is
    a desync. Regroup is the timed half, on the same abilityCool every other
    structure ability already uses, and is instantaneous rather than a duration:
    there is nothing to run down, so it writes no upT. */
 cmdpost:{cat:'misc',n:'Command Post',hp:640,sz:2,cp:250,ce:60,bt:13,vi:7,req:'barracks',tech:'b_cmdpost',cpost:1,regroup:1,d:`Promotions within ${CPOST_R} tiles cost ${Math.round((1-CPOST_VET)*100)}% fewer kills. Regroup returns ${Math.round(REGROUP_HP*100)}% of maximum HP to everything in that radius. ${REGROUP_CD}s cooldown`},
 /* v88 GRAY, second structure and the last of roadmap 2. It is a `barr` row, and
    that one flag hands it the ordinary wall's entire life at once: click-and-drag
    laying, the 1x1 footprint, the passability block, the lightweight teardown in
    kill(), and its exclusion from veterancy, from the under-attack alert, from
    the base-value sum and from elimination.
    THE COST OF THAT is the reason fourteen tests moved at this release. Every one
    of them asked `key==='barricade'` and meant "is a wall"; with one wall in the
    game those were the same question and now they are not, so they ask t.barr.
    Priced at three times the wall for three times the hull, which makes HP per
    plastic identical - what the extra 40 buys is the aura and the mine, not
    tougher plastic per coin. */
 hbarricade:{cat:'def',n:'Heavy Barricade',hp:HBARR_HP,sz:1,cp:HBARR_COST,ce:0,bt:2.2,vi:0,barr:1,hbarr:1,req:'lab',tech:'b_hbarricade',d:`Reinforced wall, ${HBARR_HP} HP. Everything of yours on the tiles around it — units, structures, other walls — takes ${Math.round(HBARR_RED*100)}% less damage, and overlapping walls STACK to ${Math.round(HBARR_CAP*100)}%. A ${Math.round(HBARR_MINE_P*100)}% chance to bury a mine ${HBARR_MINE_D} tiles forward that only YOU see. Click-and-drag to lay a line.`},
 barricade:{cat:'def',n:'Barricade',hp:BARR_HP,sz:1,cp:BARR_COST,ce:0,bt:1.0,vi:0,barr:1,d:`Czech hedgehog: blocks ground movement, ${BARR_HP} HP, ${BARR_COST} ⬢ each. Click-and-drag to lay a line.`},
 nest:{n:'Wildlife Nest',hp:NEST_HP,sz:1,cp:0,ce:0,bt:1,vi:0,neutralNest:1,d:'A wild critter den. Smash it to stop the swarm from respawning.'}
};
// keep the guard tower in step with the trimmed unit damage (combat-pacing pass)
B.guardtower.dm=+(B.guardtower.dm*DMG_SCALE).toFixed(2);
/* v86: the two Green info cards that name OTHER table rows. The Command Truck's
   card names the three structures Forward Command anchors and the Balloon's names
   the four men who step out of it, and both of those lists are keys - B[k].n and
   U[k].n - which cannot be read from inside the literal that is still being built.
   Written here, in the same post-table style as the guard tower's damage above,
   so both sentences still read off CMD_BLD / BAIL_CREW rather than retyping them.
   Nothing in the sim reads t.d; these are card copy. */
U.cmdtruck.d=`Rolling headquarters, unarmed. Forward Command opens a ${CMD_R}-tile build zone for ${CMD_BLD.length} structures only — ${CMD_BLD.map(k=>B[k].n).join(', ')}. Broadcast: allies within ${BCAST_R} tiles reload ${Math.round(BCAST_RT*100)}% faster, and the truck cannot move`;
U.balloon.d=`The best sight in the game, ${BALLOON_VI} tiles, drifting and unarmed. Only AA missiles reach it, at ${Math.round(BALLOON_AA*100)}% damage, and splash never does — but the gas runs out after ${BALLOON_FUEL}s and the crash kills everyone aboard. High Ground: +${HIGH_RG} range to allies in its vision. Bail puts ${BAIL_CREW.map(k=>U[k].n).join(', ')} on the ground and destroys it`;

// v30: building HP rides the same effective rescale as units & damage, so
// structures fall at exactly the v29 pace. Barricades & nests are excluded
// here because their constants (BARR_HP / NEST_HP) are already rescaled.
for(const k in B){if(B[k].barr||k==='nest')continue;B[k].hp=Math.round(B[k].hp*RESCALE);} // v88: t.barr, not the key - HBARR_HP derives from BARR_HP and is already rescaled through it, so a second pass would have cubed the wall
/* v65 ELECTRICITY PASS: +15% on every unit and building that ALREADY draws
   battery. Guarded on ce>0, so it can never invent an electricity cost for
   something that had none - the Grunt, the Barracks, the Generator and the rest
   of the ce:0 roster are untouched by construction, not by omission. Applied
   once at load in the style of HP_SCALE and the bt*0.85 pass, so the table
   literals above stay readable as their pre-pass baselines.

   Position matters. This runs BEFORE the SUPPLY block and BEFORE the RESEARCH
   catalog, both of which derive from cp+ce, so both re-price themselves. One
   knock-on was intended at v65: the roster median moved 170 -> 171.5 and the
   Medic Truck (150+23=173) crossed it, so a Medic went from 1 supply to 2.
   v69 retired that median for a cost ladder and v70 retired the ladder for a
   quartile RANK, so the pass no longer moves any unit across a fixed threshold
   at all - it feeds the sort the same as every other cost, and a unit's supply
   moves only if its position in the roster moves. The Medic sits at 173 total,
   which is the bottom of the third quartile, so it now costs 3.

   ucost/bcost round on read, so the .5 and .575 tails never reach the UI. */
for(const k in U)if(U[k].ce>0)U[k].ce=+(U[k].ce*1.15).toFixed(3);
for(const k in B)if(B[k].ce>0)B[k].ce=+(B[k].ce*1.15).toFixed(3);
/* ---------------- SUPPLY ----------------
   Structures grant supply, units consume it, SUP_CAP is the hard ceiling no
   amount of building can pass. Every figure below is DERIVED from G.blds and
   G.units on read: nothing here is stored on an entity, hashed by hashState or
   written by the snapshot encoders, so a v53 save loads into v54 unchanged.
   v69 retired a two-bucket split keyed on the roster median (the assertion that
   the constant is gone is a strict string check, so do not name it here), and v70
   retired v69's replacement in turn. The reasoning below still holds and is why
   neither rule is a threshold on absolute cost any more. A two-bucket cost
   keyed on a threshold puts a cliff in per-supply combat value: everything just
   under the line is a bargain and everything just over it is a tax, so optimal
   play was "buy the most expensive 1-supply unit" (the Gunner at 115) rather
   than anything the counter matrix had to say.
   v69 cut the tiers on an ABSOLUTE cost step, which fixed the cliff but left the
   boundaries as fixed points on the cost axis with no regard for the roster's own
   shape: re-pricing a unit could empty a tier or crowd four units into one. v70
   cuts on QUARTILES of the roster sorted by cost instead, so every tier holds a
   fifth of the roster by construction and keeps doing so through any re-pricing.
   Supply is still derived from cost, so rebalancing a unit still moves its supply
   by itself; it now moves by changing the unit's RANK rather than by crossing a
   number.
   Pure arithmetic on the tables: no RNG, no clock, no global state. */
const SUP_CAP=110; // v69: 80 -> 110. v83: the ceiling is UNCHANGED, but DEPOT_SUP went 10 -> 15, so the relation is no longer exact: HQ (10) plus SIX depots is 100, and the SEVENTH crosses the ceiling with 5 of its 15 unused. That waste is the point of the change - the base spends three fewer footprints to field the same army
/* v70 SUPPLY QUARTILES. The trainable roster is sorted by total resource cost
   (cp+ce) and cut into SUP_MAX equal ranks; a unit pays its rank. Evaluated once
   at load, exactly as the median and the ladder were: no RNG, no clock, no entity
   state, nothing hashed, nothing serialized. The roster lands
     1: para, truck, grunt, grenadier, bazooka, bike
     2: flamer, gunner, jeep, mortar, sniper
     3: medic, aatruck, tank, heli, apc
     4: sarge, chinook, arty, apache, bulltank
   Two rules carried over from the retired median, both load-bearing:
   ONLY TRAINABLE UNITS SET THE CUTS. The Paratrooper is cp 0 and drop-only and
   would drag every boundary down. It is still PRICED, against the boundaries the
   trainable roster set, so it can never be fielded free.
   THE SORT IS TOTAL. Ties on cost break on key name, so two units priced the same
   cannot swap tiers between loads. A comparator that returned 0 on a tie would
   leave the order to the engine and put a silent divergence in lockstep. */
const SUP_U=(function(){
 const cost=k=>U[k].cp+U[k].ce;
 const tr=Object.keys(U).filter(k=>!U[k].noTrain).sort((a,b)=>(cost(a)-cost(b))||(a<b?-1:a>b?1:0));
 const n=tr.length,o={};
 tr.forEach((k,i)=>{o[k]=Math.min(SUP_MAX,1+Math.floor(i*SUP_MAX/n))});
 /* the cost at which each quartile opens, so an untrainable unit is placed by
    cost against the same cuts rather than left unranked and defaulting to 1 */
 const cut=[];for(let q=1;q<SUP_MAX;q++)cut.push(cost(tr[Math.floor(q*n/SUP_MAX)]));
 for(const k in U)if(o[k]==null){let r=1;for(const c of cut)if(cost(k)>=c)r++;o[k]=Math.min(SUP_MAX,r)}
 return o;
})();
function supOf(k){return SUP_U[k]||1;}
// only COMPLETED structures grant supply; a depot under construction grants none
function supCap(p){let n=0;for(const b of p.blds)if(b.prog>=1)n+=(b.t.sup||0);return n<SUP_CAP?n:SUP_CAP;}
// garrisoned infantry stay in p.units (they only leave it on death), so they count
function supUsed(p){let n=0;for(const u of p.units)n+=supOf(u.key);return n;}
// queued units are RESERVED. The 60-cap never did this, which let a unit finish
// into a full roster and get dropped at the spawn site with its cost already spent.
function supQueued(p){let n=0;for(const b of p.blds)for(const k of (b.queue||[]))n+=supOf(k);return n;}
function supFree(p){return supCap(p)-supUsed(p)-supQueued(p);}
const FAC_INF={green:['sarge','mortar'],tan:['flamer'],gray:['sniper'],blue:['runner']}; // v85: Blue's Barracks slot was the one empty cell in this table
const FAC_VEH={green:['cmdtruck'],tan:['bulltank'],gray:['arty'],blue:['bike']}; // v86: Green's Garage slot was one of the two empty cells left in this pair
const FAC_AIR={green:['balloon'],tan:['firebomb'],gray:['choktaw'],blue:['chinook']}; // v88: Gray's Helipad slot was the LAST empty cell in the three tables, and it fills here - every army now fields an exclusive out of all three production buildings

/* ---------------- RESEARCH CATALOG ----------------
   Flat tech tree run from the Research Lab. Every entry is available from the
   start (no prerequisite tree), but an UPGRADE entry needs that building type's
   UNLOCK researched first (barracks is free, so its upgrade has no unlock gate).
   Costs are scaled from the unit/building build cost into a 50-200 band with a
   50/50 floor; research TIME (seconds) is scaled the same way. A faster lab
   (its own upgrade) cuts research time. ---------------------------------- */
// scale a build cost into the research band [50,200]
function rscale(v){return clamp(Math.round(50+v*0.42),50,200);}
function rtime(v){return +((7+v*0.018)*1.25).toFixed(1);} // ~9-17s (25% slower research)
const RESEARCH={};
// --- unit unlocks (everything except grunt + dump truck) ---
for(const k in U){
 const t=U[k];if(!t.tech)continue;
 RESEARCH[t.tech]={kind:'unlock',name:t.n,icon:'🔬',
  cp:rscale(t.cp+t.ce*0.5),ce:rscale(Math.max(t.ce, t.cp*0.45)),time:rtime(t.cp+t.ce),
  d:'Unlock production of the '+t.n+'.'};
}
// --- building unlocks (everything except HQ, outpost, barracks, lab) ---
for(const k in B){
 const t=B[k];if(!t.tech)continue;
 RESEARCH[t.tech]={kind:'unlock',name:t.n,icon:'🏗️',bkey:k,
  cp:rscale(t.cp*0.85+t.ce*0.5),ce:rscale(Math.max(t.ce, t.cp*0.4)),time:rtime(t.cp+t.ce),
  d:'Unlock construction of the '+t.n+'.'};
}
// --- building upgrades (one global per type; excludes HQ, outpost, radar) ---
// each upgrade lists the building key it improves and the unlock it requires
// first ('' = no unlock needed, e.g. barracks). hp = max-HP multiplier; for
// producing buildings, unitBuff = +HP/+DMG fraction applied to NEW units; for
// non-producing buildings, eff = effect multiplier; guard tower uses dm/hp.
const UPGRADES={
 barracks:  {req:'',           hp:1.30, unitBuff:0.20, name:'Barracks Upgrade',   d:'Tougher barracks; trains infantry with +20% HP & damage.'},
 garage:    {req:'b_garage',   hp:1.30, unitBuff:0.20, name:'Garage Upgrade',     d:'Tougher garage; builds vehicles with +20% HP & damage.'},
 helipad:   {req:'b_helipad',  hp:1.30, unitBuff:0.20, name:'Helipad Upgrade',    d:'Tougher helipad; builds choppers with +20% HP & damage.'},
 guardtower:{req:'b_guardtower',hp:1.12, dm:1.12,       name:'Guard Tower Upgrade',d:'Guard towers gain +12% HP & +12% damage.'},
 generator: {req:'b_generator',hp:1.30, eff:1.5,        name:'Generator Upgrade',  d:'Sturdier generators producing 50% more electricity.'},
 turbine:   {req:'b_turbine',  hp:1.30, eff:1.5,        name:'Turbine Upgrade',    d:'Sturdier turbines producing 50% more electricity.'},
 dump:      {req:'b_dump',     hp:1.30,                 name:'Munitions Upgrade',  d:'Sturdier dump; damage aura raised from +'+Math.round(DUMP_AURA*100)+'% to +'+Math.round(DUMP_AURA_UP*100)+'%.'},
 bunker:    {req:'b_bunker',   hp:1.30, eff:1.5,        name:'Bunker Upgrade',     d:'Sturdier bunker; garrison capacity raised from 4 to 6.'},
 lab:       {req:'',           hp:1.30, labSpeed:0.6,   name:'Lab Upgrade',        d:'Sturdier lab; research completes 40% faster.'}
};
// register each upgrade as a research entry keyed up_<bld>
for(const bk in UPGRADES){
 const ug=UPGRADES[bk], base=B[bk];
 RESEARCH['up_'+bk]={kind:'upgrade',bkey:bk,reqTech:ug.req,name:ug.name,icon:'⬆️',
  cp:rscale(base.cp*0.6+base.ce*0.5),ce:rscale(Math.max(base.ce,base.cp*0.35)+30),time:rtime(base.cp*0.7+base.ce),
  d:ug.d};
}
// per-faction these unlocks are simply absent (other factions' exclusives never
// appear in that army's catalog). Map each unit/building tech to whether a given
// player can ever research it.
/* v85: the three hand-typed exclusive lists this function used to carry are gone.
   They named the same eight units and four buildings that FAC already names, and
   agreed with it only for as long as someone remembered to edit both - a new
   exclusive added to FAC and not to these lists would have been researchable by
   every army in the game. INFO_FEXCL_U / INFO_FEXCL_B are those two questions
   answered off FAC itself; they are declared far below, which is fine because a
   function body only reads them when it runs. */
function techAvailable(p,key){
 const r=RESEARCH[key];if(!r)return false;
 // unit unlocks: only offer faction-appropriate ones
 if(r.kind==='unlock'&&!r.bkey){
  const uk=Object.keys(U).find(k=>U[k].tech===key);
  if(uk&&INFO_FEXCL_U.includes(uk))return FAC[p.fac].uu.includes(uk);
  return true;
 }
 // building unlocks: faction-exclusive structures only for their owner
 if(r.kind==='unlock'&&r.bkey){
  if(INFO_FEXCL_B.includes(r.bkey))return FAC[p.fac].ub.includes(r.bkey);
  return true;
 }
 // upgrades: available only if the matching building unlock is (or its building is faction-appropriate)
 if(r.kind==='upgrade'){
  if(r.reqTech&&!techAvailable(p,r.reqTech))return false;
  if(INFO_FEXCL_B.includes(r.bkey))return FAC[p.fac].ub.includes(r.bkey);
  return true;
 }
 return true;
}
/* ---- RESEARCH LOCATION ----
   Research is now split across buildings. Unit unlocks and the three army-producing
   upgrades live at the building that makes those units (Barracks/Garage/Helipad);
   everything else — building unlocks + the remaining upgrades — stays at the Lab.
   TECH_BLD[key] = the building key where `key` is researched. */
// which production building trains a given unit (fixed regardless of faction)
function prodBldOf(uk){const t=U[uk];if(t.a==='inf')return 'barracks';if(t.a==='heli'||t.fly)return 'helipad';return 'garage';}
const TECH_BLD={};
(function(){
 for(const key in RESEARCH){
  const r=RESEARCH[key];
  if(r.kind==='unlock'&&!r.bkey){                       // unit unlock -> its producer
   const uk=Object.keys(U).find(k=>U[k].tech===key);
   TECH_BLD[key]=uk?prodBldOf(uk):'lab';
  } else if(r.kind==='unlock'){                          // building unlock -> lab
   TECH_BLD[key]='lab';
  } else {                                               // upgrade
   TECH_BLD[key]=(['barracks','garage','helipad'].includes(r.bkey))?r.bkey:'lab';
  }
 }
})();
function researchBuilding(key){return TECH_BLD[key]||'lab';}
/* v77 D1: B.lab.d claimed the Lab "researches every unit & building unlock". Not
   one unit unlock has lived there since the pre-v43 production-building split -
   TECH_BLD routes all eighteen u_* keys to the Barracks, Garage or Helipad. The
   card is now written FROM TECH_BLD, so a future move of any unlock rewrites it
   rather than leaving it lying. Display copy only: nothing here is hashed. */
B.lab.d=(function(){
 const at=new Set();
 for(const k in TECH_BLD){const r=RESEARCH[k];if(r&&r.kind==='unlock'&&!r.bkey&&TECH_BLD[k]!=='lab')at.add(TECH_BLD[k]);}
 const names=[...at].map(k=>B[k].n).sort();
 return 'Researches structure unlocks and army-wide upgrades'+(names.length?'; unit unlocks happen at the '+names.join(', '):'');
})();
// LAB catalog, grouped for a readable layout: production unlocks, then economy, then
// defence/utility unlocks, then the (non-army) upgrades.
/* v105.1: LAB_ORDER now only ORDERS the catalog; it no longer IS the catalog.
   researchCatalog used to be a filter OVER this list, so a lab-routed unlock that
   nobody remembered to type here had no button anywhere in the game - however
   correct RESEARCH, TECH_BLD and techAvailable all were about it. Three shipped
   that way and stayed that way: the Command Post (v86), the Foundry (v87) and the
   Heavy Barricade (v88), i.e. the SECOND exclusive structure of Green, Tan and
   Gray. Blue's two are here because v85 was the last release that remembered.
   The asymmetry is the part that matters: aiResearch walks RESEARCH and pushes
   FAC[p.fac].ub before anything else, so the BOTS have been researching all three
   since the release that added them, against a human who could not.
   The three keys are APPENDED rather than slotted in, so every button that was
   already on the panel keeps the position it has had since v85. */
const LAB_ORDER=['b_garage','b_helipad','b_generator','b_turbine','b_fwdpad','b_guardtower','b_radar','b_radiotower','b_dump','b_bunker',
                 'b_foundry','b_cmdpost','b_hbarricade',
                 'up_guardtower','up_generator','up_turbine','up_dump','up_bunker','up_lab'];
/* DERIVED from RESEARCH + TECH_BLD + techAvailable: every lab-routed tech this
   player may take is offered, unlocks before upgrades, in LAB_ORDER's order.
   Anything this file forgets to name rides at the end of its own kind instead of
   falling off the panel - a missing name is now a cosmetic ordering question and
   can never again be an unreachable building. */
function researchCatalog(p){
 const out=[];
 for(const k in RESEARCH)if(researchBuilding(k)==='lab'&&techAvailable(p,k))out.push(k);
 const rank=k=>{const i=LAB_ORDER.indexOf(k);return i<0?LAB_ORDER.length:i};
 out.sort((a,b)=>((RESEARCH[a].kind==='upgrade'?1:0)-(RESEARCH[b].kind==='upgrade'?1:0))
                 ||(rank(a)-rank(b))||(a<b?-1:a>b?1:0)); // ties break on key, as SUP_U does
 return out;
}
// the research a given PRODUCTION building offers: its unit unlocks first, then its own upgrade
function bldResearchList(p,bk){
 const out=[];
 for(const key in RESEARCH)if(TECH_BLD[key]===bk&&techAvailable(p,key))out.push(key);
 out.sort((a,b)=>(RESEARCH[a].kind==='upgrade'?1:0)-(RESEARCH[b].kind==='upgrade'?1:0));
 return out;
}
// is a tech researched (or in progress) for player p?
function hasTech(p,key){return p.tech&&p.tech.has(key);}
function techDone(p,key){return p.techDone&&p.techDone.has(key);}
const MAPS={
 backyard:{n:'Backyard Brawl',N:64,theme:'grass',d:'Grass, garden hose, puddles, rocks & mushrooms'},
 kitchen:{n:'Kitchen Counter',N:72,theme:'tile',d:'Checkered tile, spilled milk, cutlery & sugar cubes'},
 sandbox:{n:'Sandbox Standoff',N:64,theme:'sand',d:'Bucket fortress, sand castles & a buried dino'},
 livingroom:{n:'Living Room',N:64,theme:'carpet',d:'Plush carpet, a sofa set, coffee table & toy-block forts'},
 desk:{n:'The Desk',N:72,theme:'desk',survOnly:true,d:'Wave-defense only: books, keyboard, pencils, spilled soda & coffee'}
};

