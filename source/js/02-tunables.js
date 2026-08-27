/* ---------------- AI BEHAVIOR PROFILES ----------------
   Each profile is a personality assigned (without replacement) to a CPU player at
   the start of the match. Fields:
     aggro       overall willingness to commit to attacks. v90: the trailing
                 "(also scales economy push)" was stale and is gone - the bots'
                 income assist in aiTick reads the DIFFICULTY multiplier (eco) and
                 has never read this. Two live readers remain: the mid-match mood
                 shift, and towers' old derivation, which v90 also retires.
     pushBase    base army size before a main attack wave launches
     pushGrow    how much the required wave size grows after each wave
     pushCap     ceiling on wave size
     firstPush   AI-tick delay before the first wave is even considered
     repeat      [min,extra] AI-tick gap between main waves
     defendHold  FRAMES the AI stays in 'defend' after taking a hit (~30 = 1s)
     defendFrac  fraction of the standing army it will NOT commit (home guard)
     scout       sends lone scouts toward enemies (vision/harass pressure)
     scoutEvery  AI-tick gap between scout dispatches
     harass      peels small detachments to hit economy/outposts
     harassEvery AI-tick gap between harassment parties
     harassSize  [min,max] units per harassment party
     expand      whether it wants a forward outpost
     vsAI        bias toward attacking OTHER CPU players (1 = neutral; >1 favors AIs)
     armyTilt    v48: a score multiplier on the counter-aware pick - 'heavy' leans pricey,
                 'fast' leans mobile, 'cheap' leans cheap, 'range' leans long-ranged,
                 null = neutral (see aiPickUnit)
     mixWant     v59: target composition of the FIGHTING army by unit COUNT, split
                 inf / veh / air. Renormalized over the classes the bot can actually
                 build right now, so a bot with no helipad never starves its infantry
                 chasing an air quota it cannot fill. Rolled +-10% per class once per
                 bot per match in makeAIBrain, then renormalized back to 1.
     aa          v59: [lo,hi] anti-air trucks held as insurance once ANY rival can
                 fly - lo from 10 fighters, the larger of the pair from 24. Dormant
                 while nobody can fly, so an all-ground match carries no dead weight.
     towers      v90: how many Guard Towers the profile rings its base with - and,
                 for a faction whose STACKING exclusive is defensive, how many of
                 those too (Gray's Bunker; Blue's Turbine is power and keeps its
                 flat pair). A declared personality trait spanning 1..5. Through
                 v89 it was derived from defendFrac and aggro and could only ever
                 come out 2, 3 or 4, so three of the five profiles shared a value.
     buyTilt     v90: how much of the gap up to the priciest unit this producer can
                 CURRENTLY build the bot leaves in the bank rather than spending on
                 a cheaper one. 0 buys the instant anything is affordable, so the
                 army is many cheap bodies arriving early; 0.6 holds out, so it is
                 fewer, pricier, tougher ones arriving later. This is the pacing
                 half of armyTilt, which only ever biased the CHOICE between things
                 the bot could already afford - and the cheap unit is affordable
                 first, so the pricey one never got a tick where it was the option.
   NOTE: timing fields are in AI-TICKS. aiTick runs ~every 0.6s, so e.g. firstPush:45 ≈ 27s.
*/
/* v89 AIR RETUNE. The v59 target mixes were written before anything measured
   whether they were ever DELIVERED, and they were not: probed over eight bot
   matches at v88.1, air was 4.2% of everything built and AA 1.8%, while the
   profiles between them asked for 6% to 30%. Two ratchets did it, and both are
   fixed above - the bot filled its supply cap with one-supply infantry so a
   three-supply Huey had nowhere to land, and it spent its plastic the instant it
   arrived so it never held the 200 the Huey costs.
   With the reserve carrying supply as well as plastic the mixes are honoured, so
   the numbers below are now the actual lever on what a bot flies rather than a
   wish. Infantry comes down across all five and air goes up across all five; the
   personalities keep their ORDER on every axis, so a harasser is still the one
   that lives in the air and an aggressive bot is still the one that floods bodies.
   The AA pairs rise with them. That floor is the only PRE-EMPTIVE air defence in
   the file - aiPickUnit scores an AA truck at a hard zero until something is
   actually flying, so the standing pair is what puts a launcher on the field
   before the first gunship arrives rather than after it. It stays dormant until a
   rival can fly at all, so an all-ground match still carries no dead weight. */
const AI_PROFILES={
 aggressive:{aggro:1.25,pushBase:6, pushGrow:2,pushCap:30,firstPush:48, repeat:[34,22], defendHold:150,defendFrac:0.10,scout:true, scoutEvery:60, harass:true, harassEvery:26,harassSize:[2,3],expand:true, vsAI:1.0,armyTilt:'cheap',mixWant:{inf:0.60,veh:0.25,air:0.15},aa:[1,2],towers:1,buyTilt:0.00},
 balanced:  {aggro:1.0, pushBase:7, pushGrow:3,pushCap:28,firstPush:81, repeat:[55,34], defendHold:220,defendFrac:0.18,scout:true, scoutEvery:80, harass:true, harassEvery:46,harassSize:[2,3],expand:true, vsAI:1.1,armyTilt:'heavy',mixWant:{inf:0.42,veh:0.32,air:0.26},aa:[2,3],towers:3,buyTilt:0.30},
 defensive: {aggro:0.7, pushBase:11,pushGrow:4,pushCap:26,firstPush:120,repeat:[78,48], defendHold:330,defendFrac:0.35,scout:false,scoutEvery:130,harass:false,harassEvery:130,harassSize:[2,2],expand:false,vsAI:1.0,armyTilt:'heavy',mixWant:{inf:0.32,veh:0.46,air:0.22},aa:[2,4],towers:4,buyTilt:0.50},
 harasser:  {aggro:0.95,pushBase:9, pushGrow:2,pushCap:22,firstPush:98, repeat:[60,38], defendHold:190,defendFrac:0.15,scout:true, scoutEvery:34, harass:true, harassEvery:20,harassSize:[3,4],expand:true, vsAI:1.2,armyTilt:'fast', mixWant:{inf:0.33,veh:0.29,air:0.38},aa:[2,3],towers:2,buyTilt:0.15},
 turtle:    {aggro:0.55,pushBase:14,pushGrow:4,pushCap:30,firstPush:150,repeat:[95,60], defendHold:380,defendFrac:0.45,scout:false,scoutEvery:170,harass:false,harassEvery:170,harassSize:[2,2],expand:false,vsAI:0.9,armyTilt:'range',mixWant:{inf:0.50,veh:0.30,air:0.20},aa:[2,4],towers:5,buyTilt:0.60}
};
/* ---------------- DIFFICULTY ----------------
   The PROFILES above decide HOW a bot plays (build order, wave timing, scouting,
   posture). DIFFICULTY is the orthogonal knob that scales the bots' raw strength:
   how much free economy they get, how large an army they may field, and how hard
   their shots land. Nothing here changes playstyle — only stats. */
const DIFFS={
 easy:  {name:'Easy',   eco:0.55, army:0.70, dmg:0.85, d:'Bots get less economy, smaller armies & softer hits.'},
 normal:{name:'Normal', eco:1.0,  army:1.0,  dmg:1.0,  d:'A fair fight — no stat handicaps either way.'},
 hard:  {name:'Hard',   eco:1.6,  army:1.35, dmg:1.15, d:'Bots out-produce you, field bigger armies & hit harder.'}
};
/* ---------------- KING OF THE HILL ---------------- */
const KOTH_R=5;        // hill control radius (tiles) at map centre
const KOTH_TARGET=150; // seconds of SOLE control needed to win
/* ---------------- VICTORY & PLACEMENT TUNABLES ----------------
   v43: one home for the numbers that used to be repeated across gameplay checks,
   HUD strings, the build-ghost overlay and the help panel. Every consumer reads
   these, including the HQ/Outpost card text and the help panel (HELP_TUNE below),
   so a balance edit here can no longer leave stale prose behind. Values are
   unchanged from v42. */
const WATCH_ARMIES=4;    // v55: a spectate match always fields this many bots
const WATCH_RATE_N=21;   // v55: 1 Hz income samples kept => a 20-second mining-rate window
const WATCH_SPEEDS=[0.75,1,1.25,1.5,2]; // v56: spectator pacing. 1 must be a member - watchInit resets to it
const CTF_TARGET=3;      // flag captures needed to win Capture the Flag
const BUILD_R_HQ=15;     // friendly-HQ build zone radius (tiles, centre to centre)
const BUILD_R_OUTPOST=6; // v65: 5 -> 6. friendly-Outpost build zone radius (tiles)
const BUILD_R_FOEHQ=10;  // no-build exclusion ring around an ENEMY HQ (tiles)
const BUILD_GAP=1;       // v61/v65: 2 -> 1. clear tiles required between any two building footprints
const SALVAGE_FRAC=0.34; // share of plastic build cost left as a mineable wreck on death
const SELL_FRAC=0.5;     // share of plastic build cost refunded when selling a structure
/* v69 BALANCE tunables. None of these is stored on an entity, hashed by
   hashState or written by a snapshot encoder: every one is read fresh from the
   tables or from G.tick, so a v68 save loads into v69 and simply re-prices
   itself. DM_TIME in particular is a comparison against G.tick and not a
   countdown field, which is why the deathmatch limit needs no new state. */
const ENTRENCH_RATE=1.5; // v69: 2.0 -> 1.5. The gunner's dug-in fire-rate multiplier, named rather than a bare 0.5 at the fire site
const SUP_MAX=4;         // v70: how many QUARTILES the trainable roster is cut into. Was v69's ladder ceiling; the absolute cost step it capped is gone
const DM_TIME=1200;      // v69: deathmatch time limit in SIM seconds (20:00). 0 disables the limit entirely
const AI_BANK_STEP=500;  // v69: banked plastic per extra point of AI army cap
const AI_BANK_CAP=12;    // v69: most the bank term may add, so a runaway bot cannot uncap itself outright
/* v77 AI CALL-DOWN CADENCE. Measured across 16 v76 bot-matches: 37 fires, of which
   ZERO were napalm and three were barrage - the clump branch was effectively dead
   content. It was not failing on its power threshold (the 75th percentile of the
   best clump was 101.5, comfortably over the old 90) but on VISION: only 38 of 414
   decision points had the best clump in sight at all. A lower threshold therefore
   does not carpet-bomb harder, it picks a NEARER clump that the bot can actually
   see. AI_RADIO_WAIT is the dither before the paradrop fallback; at 25 ticks it
   accounted for essentially all 583s of ready-but-idle tower time. None of the
   three is stored on an entity, hashed, or serialized. */
const AI_RADIO_CLUMP=45;   // v77: 90 -> 45. Hostile influence needed under a clump before it earns a strike
const AI_RADIO_FRIENDLY=25;// unchanged: allied influence above this means a friendly army is in the blast
const AI_RADIO_WAIT=8;     // v77: 25 -> 8 AI-ticks (~15s -> ~5s) before the charge goes to a paradrop instead
/* v79 GREEN ABILITIES. Phase 1 of the per-faction ability roadmap: every Green
   exclusive gets one passive and one toggle. Unlike the v69/v77 tunables above,
   these DO have entity state behind them (u.calmT / u.onMe / u.smoke / u.wf /
   u.wfT / b.upT), all hashed and serialized - see the makeUnit and hashState
   edits. The numbers themselves live here and nowhere else: the info cards, the
   panel buttons and the help slots all read these tokens, so a tuning pass moves
   one literal and every surface follows.

   SIZING NOTES, so the next pass knows what these were chosen against:
   SARGE_REGEN is deliberately under MEDIC_HEAL_RATE (2.089/s at v79), so the
   hero sustains himself between fights without displacing the Medic inside one.
   SARGE_AURA_R is 3 because a probe over 4 maps x 3 seeds put a mean of 1.15
   allied infantry inside 3 tiles of a live Sarge and 1.92 inside 5; 3 is a
   micro reward by construction, which is the intent.
   SMOKE_T is 5 against the mortar's 3.4s reload, so one mortar cannot keep a
   cloud standing by itself and two nearly can. */
const SARGE_AURA=0.30;     // "On Me!" damage bonus, allied infantry only
const SARGE_AURA_R=3;      // ...within this many tiles of Sarge
const SARGE_SELF=0.5;      // ...and Sarge's own damage is multiplied by this while it runs
const SARGE_REGEN=1.5;     // Combat Veteran: HP per second, once he has been calm for
const SARGE_CALM=8;        // ...this many seconds without taking a hit
const HURT_WINDOW=2;       // a unit counts as "under fire" for this many seconds after its last hit
const MORT_WF_STEP=0.08;   // Walking Fire: damage added per consecutive shell at one target
const MORT_WF_CAP=0.24;    // ...and the ceiling that ramp stops at
const SMOKE_R=2;           // smoke cloud radius in tiles
const SMOKE_T=5;           // ...and how many seconds it stands
const SMOKE_RED=0.20;      // damage reduction for friendly UNITS under a cloud (buildings are excluded)
const UPLINK_T=20;         // Target Uplink duration in seconds
const UPLINK_CD=120;       // ...and its cooldown, held on the Radar Tent's existing abilityCool
const UPLINK_RG=1;         // range added to every unit of the owning army while it runs
const UPLINK_VI=2;         // ...and vision
/* v80 TAN ABILITIES. Phase 2 of 4, same shape as the Green block above: the
   numbers live here and nowhere else, and the info cards, the panel buttons and
   the help slots all read these tokens rather than restating them.

   SIZING NOTES, so the next pass knows what these were chosen against:
   COOK_DPS is 6 against a flamer who already does ~40 DPS into infantry (14.95
   after the Tan +15%, times the 1.35 flame-vs-infantry cell, at a .5 reload),
   so Cook-Off is a ~15% passive and not a second weapon. It ticks on row 'x'
   at a flat 1.00 like every other damage-over-time in the file.
   THROTTLE_R is 0.62 because the Bull's own hull radius is 0.42 (t.big) and an
   infantryman's is 0.26: contact is at 0.68, so 0.62 crushes what is genuinely
   under the tracks rather than what is merely beside them.
   SCUTTLE_R is 4 against DUMP_R of 9 - the blast covers a fraction of the aura
   it replaces, so scuttling is a denial tool and not an area-attack opener. */
const COOK_DPS=6;          // Cook-Off: burn damage per second left on what the Flamethrower hits
const VALVE_DMG=0.50;      // Pressure Valve: damage added while the valve is open
const VALVE_RG=1;          // ...and range, routed through rgOf() like the uplink is
const VALVE_BACK=0.25;     // ...and the share of the damage he DEALS that comes back onto him
const THROTTLE_SPD=0.30;   // Full Throttle: speed added while the Bull is rolling
const THROTTLE_R=0.62;     // ...and the radius under the hull that crushes what it drives over
const VALVE_AI_FLOOR=0.45; // ...and the share of his health a BOT keeps in hand before opening it (buildings only)
const VALVE_AI_INF_P=0.50; // ...and a bot's flat odds of opening it on infantry, benefit or not
const SCUTTLE_DM=400;      // Scuttle: damage at the centre of the blast
const SCUTTLE_R=4;         // ...its radius in tiles
const SCUTTLE_FF=0.25;     // ...and the share of it that FRIENDLY units and structures take
const CAMO_T=5;            // Camouflaged: seconds without firing before the Sniper stops being acquired
const CS_DMG=0.30;         // Called Shot: damage added while he is restricted to infantry
const SHOCK_SET=1.0;       // Shell Shock: seconds ADDED to a survivor's reload clock, on top of what it already reads
const RIPPLE_N=3;          // Ripple Fire: rockets per salvo
const RIPPLE_SRT=0.35;     // ...seconds between them
const RIPPLE_DM=0.50;      // ...each one's share of the base shell
const RIPPLE_SPL=1.6;      // ...how much wider each burst is
const RIPPLE_BOX=1.6;      // ...and the half-width of the box they scatter across
const RIPPLE_RT=1.30;      // ...and the reload multiplier that pays for all of it
const LOCK_RED=0.65;       // Lockdown: the share of incoming damage the bunker stops taking
const LOCK_T=10;           // ...for how long, held on the building's existing upT
const LOCK_CD=45;          // ...and its cooldown, on the shared abilityCool
const LOCK_AI_FLOOR=0.50;  // ...and the share of its health a BOT lets a bunker fall to before locking it down
const EVADE_RED=0.50;      // Evasive: the share of incoming damage a Scout Bike stops taking on a tick he actually moved
const FLAT_SPD=0.30;       // Flat Out: speed added while he runs flat out
const FLAT_VI=2;           // ...and the sight it adds, on top of whatever the uplink is already giving him
const OVER_MUL=3;          // Overdrive: what the Wind Turbine's output is multiplied by while it runs
const OVER_T=20;           // ...for how long, held on the building's existing upT
const OVER_OFF=70;         // ...and how long it then produces NOTHING
const OVER_CD=OVER_T+OVER_OFF; // ...so the cooldown on the shared abilityCool ends exactly when the dead window does. Derived, never typed: the offline test reads abilityCool, and a hand-typed cooldown that drifted from the sum would leave the turbine either dead past its own button or alive before it
/* v85 BLUE, SECOND PASS. The v79-v82 blocks gave every faction's EXISTING
   exclusives a passive and a toggle; this one begins the second roadmap, in which
   every army fields an exclusive out of the Barracks, the Garage and the Helipad,
   two exclusive structures, and a call-down of its own. Blue is first, and Blue
   was already covered in the Garage (Scout Bike) and the Helipad (Chinook), so
   what lands here is the Barracks slot, the second structure and the call-down.

   SIZING NOTES, so the next pass knows what these were chosen against:
   SPRINT_R and RNET_R are both 4 rather than Sarge's 3 because the Runner is not a
   fighter - there is no micro reward in holding him at the front, so his radius has
   to reach the squad he is running alongside rather than the one he is leading.
   SPRINT_SPD is 0.30, the same figure Flat Out already pays for on the Scout Bike
   and at the same price (nobody inside it may fire), so Blue's two speed modes read
   as one idea rather than two.
   PAD_REP was 1.6 HP/s at v85, deliberately under MEDIC_HEAL_RATE's 2.089 so the
   Pad read as the quiet half of the building. v88.1 raises it to 3, which is
   deliberately ABOVE the Medic's rate, and the reason the ordering flipped is that
   1.6 made the capability technically present and practically unusable: a Huey
   taken to a sliver sat on the pad for over a minute and an Apache for two, which
   is longer than the match phase either aircraft is bought for. At 3 those become
   about 36 and 62 seconds - still slow enough that a damaged flight is a real
   commitment, but inside the window a player will actually wait out.
   It does NOT make the Pad a better Medic. The Medic follows the fight and heals
   anything on legs; the Pad is a 2x2 building that cannot move and repairs only
   what flies, which nothing else in the game repairs at all. Those are different
   capabilities and the rate ordering between them was never load-bearing.
   It is a post-HP_SCALE rate, directly comparable to MEDIC_HEAL_RATE, which is why
   it is not scaled again at the point of use.
   LIFT_MAX is the owner's figure. LIFT_T is 1.6s because the paradrop canopy
   animation already runs on a 0.8s fall, so a lifted squad spends about as long
   under silk as a Paratrooper does and the two call-downs read alike. */
const RNET_R=4;        // Radio Net: friendly infantry this close to a Signal Runner...
const RNET_VI=1;       // ...see this much further. A passive: there is no flag to set
const SPRINT_R=4;      // Sprint: how far the Runner's whistle carries
const SPRINT_SPD=0.30; // ...the speed every friendly infantryman inside it gains
const PAD_R=6;         // Forward Pad: friendly aircraft within this many tiles...
const PAD_REP=3;       // ...are repaired this many HP per second, whoever built them
const SCRAM_SPD=0.40;  // Scramble: speed added to EVERY aircraft this army owns
const SCRAM_T=12;      // ...for how long, held on the building's existing upT
const SCRAM_CD=60;     // ...and its cooldown, on the shared abilityCool
const LIFT_MAX=20;     // Rapid Redeploy: the most infantry one call can airlift
const LIFT_T=1.6;      // ...and how long they are off the map before the canopies open
/* v86 GREEN, SECOND PASS. Green already fielded two Barracks exclusives (Sarge and
   Mortar Squad) and one structure (Radar Tent), so what lands here is the Garage
   slot, the Helipad slot, the second structure and the call-down.

   SIZING NOTES, on the same rule as the v85 block above - these were chosen
   against something, and the next pass should know what.
   CMD_R is 5 against the Outpost's 6, and it anchors THREE keys rather than the
   whole catalogue: a truck that could plant a Garage would be a cheaper Outpost
   with wheels. Barricade, guard tower and barracks is the owner's list and it is
   held in CMD_BLD rather than tested by name at the door, so the door states the
   rule once and the rule is readable from the table.
   BCAST_RT is 0.20 read as a 20% SHORTER reload (rt*0.8), which is what "reload
   20% faster" says. The v78 Gunner note is the opposite case and worth not
   confusing with this one: a 20% lower FIRE RATE there was rt/0.8, because a rate
   and its reload move inversely.
   BALLOON_VI is 16, above the Radar Tent's 13, because "highest vision in the
   game" has to beat the buildings as well as the units.
   BALLOON_AA is a FINAL multiplier and supersedes WVA.a.air's 1.60 the way the
   Bull's plate supersedes a whole row - an AA truck deals a third of its damage
   to a balloon, not 1.6x a third. Measured against the numbers that matter: one
   AA Missile Truck takes a full balloon down in about 15 seconds, which is a real
   answer without being an instant one, and BALLOON_FUEL kills it in 180 regardless.
   CPOST_VET is a multiplier on the LADDER rather than a bonus on the credit,
   because u.kl is an integer and hashed as one - see the note at vetSteps.
   DROP_P and DROP_E are the owner's figures. CRATE_R is 0.9 rather than a tile so
   a crate is collected by walking over it and not by passing nearby. */
const CMD_R=5;             // Forward Command: how far a Command Truck anchors a build zone...
const CMD_BLD=['barricade','guardtower','barracks']; // ...and the only structures it will anchor
const BCAST_R=5;           // Broadcast: allied units within this many tiles...
const BCAST_RT=0.20;       // ...reload this much faster, and the truck cannot move while it runs
const BALLOON_VI=16;       // Observation Balloon: the highest sight in the game, buildings included
const BALLOON_FUEL=180;    // ...seconds of gas, after which it crashes and everyone aboard is lost
const BALLOON_AA=1/3;      // ...the share of an AA missile it takes; every other weapon row does nothing at all
const HIGH_RG=1;           // High Ground: the range allies inside its vision gain
const BAIL_CREW=['grunt','gunner','grenadier','bazooka']; // Bail: the four men who step out, and the balloon is destroyed
/* v100: how long the crew hangs under silk before their boots hit. 0.8s is the
   paradrop canopy's own fall time (the renderer's one hard-coded 0.8 divisor),
   so a bail-out reads as a paradrop - which is the whole of the owner's brief.
   The men are created on landing, not on the button, so this is a real delay in
   the simulation and not a decoration over an instant spawn. */
const BAIL_FALL_T=0.8;   // ...and how long they spend under the canopy on the way down
const CPOST_R=8;           // Command Post: the radius of both halves - the veterancy aura and Regroup
const CPOST_VET=0.7;       // ...the share of the usual kills a promotion costs inside it
const REGROUP_HP=0.25;     // Regroup: the share of its own maximum HP each unit is handed back
const REGROUP_CD=60;       // ...and its cooldown, on the building's existing abilityCool
const DROP_P=500;          // Supply Drop: what the plastic crate carries...
const DROP_E=500;          // ...and what the electricity crate carries
const DROP_T=1.2;          // ...how long the pair are under canopy before they touch down
const CRATE_R=0.9;         // ...and how close one of YOUR units must come to collect one
/* v100: the crate was drawn at roughly a man's footprint and read as scenery on
   a busy field - the owner could not find his own supplies. CRATE_SC scales the
   whole painter, canopy included, and the pulse is a glow the crate wears on the
   ground so the eye catches it from across the map. Pure presentation: the
   collection radius is still CRATE_R, so a bigger crate is not an easier one to
   pick up, and nothing about the drop is hashed. */
const CRATE_SC=2;          // ...how much bigger than life the crate is drawn
const CRATE_GLOW=0.30;     // ...and the amplitude of the green pulse around it
/* The four BOT thresholds. Named here with the abilities they spend rather than
   buried in aiTick, on the same rule as LOCK_AI_FLOOR and VALVE_AI_INF_P. */
const BCAST_AI_N=3;        // Broadcast: allies under fire inside the radius before a bot pins its truck
const REGROUP_AI_N=3;      // Regroup: hurt units inside the radius before a bot spends it...
const REGROUP_AI_FLOOR=0.7;// ...counting a unit as hurt below this share of its own health
const BAIL_AI_T=6;         // Bail: seconds of gas left at which a bot gets its crew out rather than losing them
const AI_DROP_FLOOR=120;   // Supply Drop: the plastic a bot must be under before it calls for crates instead of a strike
/* v87 TAN, SECOND PASS. Tan already fielded a Barracks exclusive (Flamethrower)
   and a Garage one (the Bull), so what lands here is the Helipad slot, the second
   structure, and the call-down - which Tan does not gain so much as INHERIT, since
   the Napalm Strike leaves the shared pool and becomes Tan's alone.

   THE FIRST UNIT COOLDOWN IN THE GAME lands here too. Roadmap 1 ruled cooldown
   abilities on units out and the owner overrode that for roadmap 2; v85's Sprint
   and v86's Broadcast are sustained modes and v86's Bail destroys the unit that
   offers it, so none of them needed a clock. Napalm Blast does. See t.abCd.

   SIZING NOTES, on the same rule as the v85 and v86 blocks above.
   FB_CD, FB_N and FB_R are the owner's figures: 30 seconds, ten blasts, three
   tiles. FB_DM and FB_SPL are the tower napalm's own bomblet (32 over 1.3 tiles)
   rounded to 30, because a unit ability that hit harder per blast than the
   army-wide call-down would make the call-down pointless.
   FB_BURN is 8 against the tower napalm's 3, which is the whole of "prolonged":
   the RATE is the same constant for both, so the Firebomb's field is not a hotter
   fire, it is a fire that stays.
   SCORCH_DPS is deliberately under GROUND_DPS. Scorched Earth fires on every hit
   and the call-down fires once, so the passive has to be worth less per tile or
   it is simply a better napalm on a 1.6-second reload.
   FOUNDRY_HP is 0.10 against the Garage upgrade's 0.20, and it stacks with it:
   the upgrade is a Garage that builds better, the Foundry is an army that does.
   POUR_COST is half the vehicle's plastic again, which is the price of the ~14
   build-seconds it skips. */
const FB_CD=30;        // Napalm Blast: seconds before it may be used again, on the new u.abCool
const FB_N=10;         // ...blasts per use
const FB_R=3;          // ...scattered on random tiles within this many tiles of the helicopter
const FB_DM=30;        // ...each one hitting this hard
const FB_SPL=1.3;      // ...over this radius
const FB_BURN=8;       // ...and the PROLONGED burn each one leaves on the ground
const SCORCH_T=4;      // Scorched Earth: seconds the ground burns under one of the Firebomb's hits
const SCORCH_DPS=3;    // ...and how hard that fire burns
const GROUND_DPS=4.3;  // the shared ground-fire rate: the tower's napalm and the Blast both burn at it
const NAPALM_T=3;      // ...and how long the TOWER's napalm leaves a tile burning, against FB_BURN
const FOUNDRY_HP=0.10; // Foundry: the hull a Garage vehicle gains for being built while one stands
const POUR_COST=0.5;   // Pour: the surcharge, as a share of the poured vehicle's plastic cost
const POUR_CD=45;      // ...and the cooldown, on the building's existing abilityCool
/* The four BOT thresholds, named here on the same rule as v86's and LOCK_AI_FLOOR's. */
const FB_AI_CLUMP=3;   // Napalm Blast: enemy ground units inside the disc before a bot empties its racks...
const FB_AI_OWN=1;     // ...and the most of its OWN it will accept standing in the fire
const AI_POUR_BANK=900;// Pour: the plastic a bot must be holding before it buys time with it...
const AI_POUR_N=2;     // ...and how many Garages must have something queued to be worth the cooldown
/* --- THE OBSERVER, THE WALL AND THE SMOKE: GRAY, ADDED AT v88 ---
   The last army of roadmap 2, and the last release of it. Three pieces, and the
   shape of each is decided by a door the file already has rather than by new
   machinery: the Choktaw's second weapon is the Bull's `sec` row, its Paint is
   the v87 `u.abCool` clock, and both the barricade's aura and the smokescreen
   are defender-side multipliers in applyDmg beside the APC shield, the mortar's
   smoke and Lockdown.

   SIZING NOTES, on the same rule as the v85, v86 and v87 blocks above.
   FOB_RG is the owner's figure: +2 tiles. It applies only to INDIRECT fire,
   which the file already spells `t.mrg` - the minimum-range flag the Mortar
   Squad and the Rocket Artillery carry - rather than to a hand-written pair of
   unit keys that a third arcing weapon would have to be remembered into.
   PAINT_DMG, PAINT_BOX, PAINT_T and PAINT_CD are the owner's four: +25% from
   every source, a 2x2 box, ten seconds, twenty of cooldown. The cooldown is
   TWO THIRDS the Napalm Blast's 30 because Paint does no damage of its own -
   it is worth nothing at all unless something else is already shooting.
   HBARR_HP is triple BARR_HP by specification. HBARR_RED is 15% per wall and
   HBARR_CAP is 60%, so FOUR overlapping walls reach the ceiling and a fifth is
   wasted plastic; the cap is what stops a solid block of them from being
   arithmetically unkillable, and it is a cap on the TOTAL rather than on the
   count so it cannot be walked around by mixing in the cheap barricade.
   HBARR_MINE_P is the one-time roll and HBARR_MINE_D the three tiles in front.
   v98: the wall is 40 rather than 60 and the roll 15% rather than 10%, both by
   the owner's decision. The 60 was chosen so HP-per-plastic came out flat
   against the ordinary barricade and the aura and the mine were what the extra
   bought; at 40 the wall is DELIBERATELY better plastic-for-HP than the cheap
   one, which is the whole point of a re-price. It stays a Gray exclusive behind
   a Lab and a research project, so the cheap wall is still what the other three
   armies lay and still what Gray lays before the tech lands.
   SMOKESCR_BOX is 7 by specification and SMOKESCR_RED is 40% against the
   Mortar's SMOKE_RED of 20% over a 2-tile radius for 5 seconds. That gap is
   INTENDED and is written down here so a later balance pass reads it as a
   decision: the call-down costs a Radio Tower and the shared RADIO_CD, the
   mortar's costs one loaded tube. SMOKESCR_T matches the Mortar's cloud in
   kind but not in size - ten seconds against five. */
const FOB_RG=2;          // Forward Observer: tiles of extra reach for friendly INDIRECT fire on a spotted target
const PAINT_DMG=0.25;    // Paint: the extra damage a painted unit takes, from every source
const PAINT_BOX=2;       // ...over this many tiles square
const PAINT_T=10;        // ...for this many seconds
const PAINT_CD=20;       // ...and the cooldown, on the v87 u.abCool clock
const HBARR_HP=BARR_HP*3;// Heavy Barricade: triple the ordinary wall
const HBARR_COST=40;     // ...v98: 60 -> 40, so it is now twice the wall's plastic for three times its HP, and the aura and the mine ride on top
const HBARR_RED=0.15;    // ...damage taken cut per wall in reach, STACKING with the others
const HBARR_CAP=0.60;    // ...but never past this in total, however many overlap
const HBARR_R=1.5;       // ...the reach itself: the ring of tiles immediately around a 1x1 wall
const HBARR_MINE_P=0.15; // ...v98: 0.10 -> 0.15, the one-time roll on completion that buries a mine
const HBARR_MINE_D=3;    // ...that many tiles in front, front being the nearest enemy HQ
const SMOKESCR_BOX=7;    // Smokescreen: the side of the square it covers
const SMOKESCR_RED=0.40; // ...damage cut for friendly units AND structures inside it
const SMOKESCR_T=10;     // ...and how many seconds it stands
/* The BOT threshold, named here on the same rule as v86's and v87's. */
const SCR_AI_N=4;        // Smokescreen: friendly units under fire in one box before a bot calls it
const PAINT_AI_N=3;      // Paint: enemy ground units inside the box before a bot spends the Choktaw's cooldown on it
/* v99: how far a bot's soldier will answer a base intrusion from. Threats are
   detected within 14 tiles of a building; 24 covers the base, its walls and the
   staging ground outside them, and deliberately NOT a wave halfway across the
   map - the map-wide recall was half of the jitter the release fixes. */
const AI_DEF_R=24;       // defend recall: tiles from the intruder inside which a unit responds
const AI_DEF_N=5;        // ...and how many respond per intruder, closest first - the picket, not the army
/* ---------------- DAY / NIGHT CYCLE ----------------
   v101: the battlefield clock. A full cycle takes DAY_CYCLE_T sim-seconds and every
   match starts at a random point in it (G.dayOff, drawn from srand() in newGame,
   hashed and serialized like any other sim state). The cycle is a HANDFUL OF
   DISCRETE STATES the game flips between, by the owner's design - no continuous
   gradient. DAY_PHASES is the whole table: contiguous, in cycle order, each row
   owning the stretch from its t0 (sim-seconds from cycle start) to the next
   row's. `ni:1` marks the one phase that bends the SIMULATION: at night every
   unit's and structure's vision is cut to NIGHT_VI_MUL through nightVi(), which
   viOf and bviOf apply - fog reveal, auto-acquisition, the balloon's High
   Ground, the Choktaw's spotting and the call-down vision test all follow,
   because every sim-side vision read already goes through those two doors.
   Weapon RANGE is deliberately untouched: a unit ordered onto a target it
   cannot see for itself still shoots at full reach, exactly as attacking into
   fog has always worked.
   tint/tintA are RENDER-ONLY (the same way CREATURE rows carry `col`): the one
   multiply fill renderCore lays over the finished world canvas, which both the
   WebGL compositor and the 2d fallback then consume - one site, both paths.
   Phase lookup is derived from (G.tick + G.dayOff) alone: pure integer math,
   nothing stored, so two lockstep clients and a loaded save agree for free.
   Testing mode pins the clock to the first row (permanent day) on the same rule
   that gives the sandbox full vision and free buildings. */
const DAY_CYCLE_T=600;   // sim-seconds for one full day/night cycle (10 minutes)
const NIGHT_VI_MUL=0.5;  // vision multiplier for every unit and structure at night
const DAY_PHASES=[
 {key:'day',  n:'Day',  icon:'☀️', t0:0,  ni:0, tint:'#ffffff',tintA:0},
 /* the two transition tints were first cut at ~.3 alpha and were invisible in a
    real frame next to Day - rule 7's screenshot pass is where these numbers
    come from, not arithmetic */
 {key:'dusk', n:'Dusk', icon:'🌆', t0:240,ni:0, tint:'#e07840',tintA:.55},
 {key:'night',n:'Night',icon:'🌙', t0:300,ni:1, tint:'#31497e',tintA:.86},
 {key:'dawn', n:'Dawn', icon:'🌅', t0:540,ni:0, tint:'#c9a0c0',tintA:.55}
];
function dayPhase(){
 if(!G||G.test)return DAY_PHASES[0]; // the sandbox is permanent noon, like its permanent full vision
 const s=((G.tick+(G.dayOff||0))/30)%DAY_CYCLE_T;
 let ph=DAY_PHASES[0];
 for(const p of DAY_PHASES)if(s>=p.t0)ph=p;
 return ph;
}
function nightNow(){return dayPhase().ni===1}
function nightVi(v){return nightNow()?v*NIGHT_VI_MUL:v}
/* Help-panel slots. The static help markup carries <span data-tune="key"> holes;
   applyHelpTune fills them once at boot. Pure UI: nothing here is hashed. */
const HELP_TUNE={
 hqR:()=>BUILD_R_HQ, opR:()=>BUILD_R_OUTPOST, foeR:()=>BUILD_R_FOEHQ,
 koth:()=>KOTH_TARGET, ctf:()=>CTF_TARGET, waves:()=>SURV_WAVE_N,
 salvagePct:()=>Math.round(SALVAGE_FRAC*100), sellPct:()=>Math.round(SELL_FRAC*100),
 barrCost:()=>BARR_COST, mines:()=>MINES_PER_MAP, gap:()=>BUILD_GAP,
 /* v69: the deathmatch limit and the entrench multiplier are slots for the same
    reason BUILD_GAP is - a balance edit must not leave stale prose behind. */
 dmMin:()=>Math.round(DM_TIME/60), entrench:()=>ENTRENCH_RATE,
 /* v65: BUILD_GAP is 1, so "clear tiles" can no longer be baked into the help
    markup. The noun is a slot like the number is. */
 gapT:()=>BUILD_GAP===1?'tile':'tiles',
 /* v76: every slot below exists because the same fact was ALSO written out in
    prose and drifted. The veterancy rungs moved at v75 and the manual still
    printed the pre-v75 ladder; the bazooka override moved at v51; the weapon
    rosters were hand-typed and had four omissions. */
 vetInf:()=>VET_INF.join(' / '), vetVeh:()=>VET_VEH.join(' / '),
 bazHeavy:()=>UVA.bazooka.heavy.toFixed(2),
 rockHeavy:()=>WVA.r.heavy.toFixed(2), rockMed:()=>WVA.r.medium.toFixed(2),
 radioList:()=>radioAbilityList(), radioCd:()=>radioCDText(),
 /* v77: the manual used to hand-count the abilities that need line of sight,
    which is exactly the kind of fact that goes stale the moment an ability is
    added or removed - as one just was. The word, not just the number, is
    derived, so the sentence reads as English either way. */
 radioVis:()=>{const n=RADIO_ABILITIES.filter(a=>a.vision).length;return ['none','one','two','three','four','five','six'][n]||String(n);},
 barrN:()=>BARRAGE_N, barrDmg:()=>BARRAGE_DMG, barrR:()=>BARRAGE_R, barrBox:()=>BARRAGE_BOX+'\u00d7'+BARRAGE_BOX,
 barrInf:()=>WVA.q.inf.toFixed(2), barrGap:()=>BARRAGE_GAP,
 wcB:()=>wcRoster('b'), wcG:()=>wcRoster('g'), wcR:()=>wcRoster('r'), wcS:()=>wcRoster('s'),
 wcM:()=>wcRoster('m'), wcF:()=>wcRoster('f'), wcA:()=>wcRoster('a'), wcQ:()=>wcRoster('q'),
 aaAir:()=>WVA.a.air.toFixed(2),
 labBlds:()=>LAB_ORDER.filter(k=>k.indexOf('b_')===0&&!INFO_FEXCL_B.includes(k.slice(2))).map(k=>B[k.slice(2)].n).join(', '),
 /* v79: the Green ability numbers, so the help prose cannot drift from the
    constants the sim reads. Percentages are formatted here rather than in the
    markup for the same reason. */
 sargeAura:()=>Math.round(SARGE_AURA*100), sargeR:()=>SARGE_AURA_R,
 sargeSelf:()=>Math.round((1-SARGE_SELF)*100), sargeRegen:()=>SARGE_REGEN, sargeCalm:()=>SARGE_CALM,
 wfStep:()=>Math.round(MORT_WF_STEP*100), wfCap:()=>Math.round(MORT_WF_CAP*100),
 smokeR:()=>SMOKE_R, smokeT:()=>SMOKE_T, smokeRed:()=>Math.round(SMOKE_RED*100),
 upT:()=>UPLINK_T, upCd:()=>UPLINK_CD, upRg:()=>UPLINK_RG, upVi:()=>UPLINK_VI,
 /* v80: the Tan ability numbers. Same rule as the Green slots above - the
    manual states these facts in prose and prose drifts, so it reads them. */
 cookDps:()=>COOK_DPS, valveDmg:()=>Math.round(VALVE_DMG*100), valveRg:()=>VALVE_RG,
 valveBack:()=>Math.round(VALVE_BACK*100), thrSpd:()=>Math.round(THROTTLE_SPD*100),
 scDm:()=>SCUTTLE_DM, scR:()=>SCUTTLE_R, scFf:()=>Math.round(SCUTTLE_FF*100),
 camoT:()=>CAMO_T, csDmg:()=>Math.round(CS_DMG*100), shockSet:()=>SHOCK_SET,
 ripN:()=>RIPPLE_N, ripDm:()=>Math.round(RIPPLE_DM*100), ripRt:()=>Math.round((RIPPLE_RT-1)*100),
 lockRed:()=>Math.round(LOCK_RED*100), lockT:()=>LOCK_T, lockCd:()=>LOCK_CD,
 /* v82: the Blue ability numbers. Same rule as every slot above it. */
 evadeRed:()=>Math.round(EVADE_RED*100), flatSpd:()=>Math.round(FLAT_SPD*100), flatVi:()=>FLAT_VI,
 overMul:()=>OVER_MUL, overT:()=>OVER_T, overOff:()=>OVER_OFF, overCd:()=>OVER_CD,
 /* The garrison and transport figures the Gray and Blue manual entries quote.
    Read off the live tables rather than retyped, on the same rule as every slot
    above: the Chinook's capacity was a typed "15" in the transport paragraph
    until these landed, which is exactly the drift the slots exist to prevent. */
 bunkGar:()=>B.bunker.gar, chinCap:()=>U.chinook.cap, chinAura:()=>Math.round(U.chinook.aura*100),
 /* Shell Shock is the one ability figure that reads as a bare "1", so it needs
    the plural handled the way BUILD_GAP's gapT already does it. */
 shockSetT:()=>SHOCK_SET===1?'second':'seconds',
 /* The napalm grid and the paradrop headcount, which the help prose used to type
    out. Declared far below this table, which is fine: a slot body only runs when
    applyHelpTune calls it, exactly as plateRow already reaches wcRoster. */
 napBox:()=>NAPALM_BOX, paraN:()=>PARA_N,
 /* v85: the second Blue pass. Same rule as every slot above - the manual states
    these in prose, and prose drifts the moment one of the constants is tuned. */
 rnetR:()=>RNET_R, rnetVi:()=>RNET_VI,
 sprintR:()=>SPRINT_R, sprintSpd:()=>Math.round(SPRINT_SPD*100),
 padR:()=>PAD_R, padRep:()=>PAD_REP,
 scramSpd:()=>Math.round(SCRAM_SPD*100), scramT:()=>SCRAM_T, scramCd:()=>SCRAM_CD,
 liftMax:()=>LIFT_MAX,
 /* v86: the Green numbers. Same rule as every slot above - the manual states
    these in prose, and prose drifts the moment one of the constants is tuned.
    cmdBlds reads the names off B rather than retyping them, so the sentence and
    the placement door can never disagree about which three it anchors. */
 cmdR:()=>CMD_R, cmdBlds:()=>CMD_BLD.map(k=>B[k].n).join(', '),
 bcastR:()=>BCAST_R, bcastRt:()=>Math.round(BCAST_RT*100),
 ballVi:()=>BALLOON_VI, ballFuel:()=>BALLOON_FUEL,
 ballAa:()=>Math.round(BALLOON_AA*100), highRg:()=>HIGH_RG,
 bailCrew:()=>BAIL_CREW.map(k=>U[k].n).join(', '),
 cpostR:()=>CPOST_R, cpostVet:()=>Math.round((1-CPOST_VET)*100),
 regroupHp:()=>Math.round(REGROUP_HP*100), regroupCd:()=>REGROUP_CD,
 dropP:()=>DROP_P, dropE:()=>DROP_E,
 /* v87: the Tan numbers. Same rule as every slot above it. */
 fbCd:()=>FB_CD, fbN:()=>FB_N, fbR:()=>FB_R, fbDm:()=>FB_DM, fbBurn:()=>FB_BURN,
 scorchT:()=>SCORCH_T, scorchDps:()=>SCORCH_DPS, groundDps:()=>GROUND_DPS,
 foundryHp:()=>Math.round(FOUNDRY_HP*100), pourCost:()=>Math.round(POUR_COST*100), pourCd:()=>POUR_CD,
 /* v88 GRAY. Every number the Field Manual prints for the last army reads off
    its constant here, on the rule the v85-v87 slots above were added under. */
 fobRg:()=>FOB_RG, paintDmg:()=>Math.round(PAINT_DMG*100), paintBox:()=>PAINT_BOX,
 paintT:()=>PAINT_T, paintCd:()=>PAINT_CD,
 hbarrHp:()=>HBARR_HP, hbarrRed:()=>Math.round(HBARR_RED*100), hbarrCap:()=>Math.round(HBARR_CAP*100),
 hbarrMineP:()=>Math.round(HBARR_MINE_P*100), hbarrMineD:()=>HBARR_MINE_D,
 scrBox:()=>SMOKESCR_BOX, scrRed:()=>Math.round(SMOKESCR_RED*100), scrT:()=>SMOKESCR_T,
 plateRow:()=>wcRoster('b'),
 /* v101: the day/night figures, on the rule every slot above was added under -
    the manual states them in prose and prose drifts the moment one is tuned. */
 cycleMin:()=>Math.round(DAY_CYCLE_T/60), nightViPct:()=>Math.round(NIGHT_VI_MUL*100)
};
function helpTuneValue(k){const f=HELP_TUNE[k];return f?f():null}
function applyHelpTune(){ // returns how many slots were filled (0 under the headless shim)
 try{
  const box=document.getElementById('helpBox');
  if(!box||typeof box.querySelectorAll!=='function')return 0;
  const slots=box.querySelectorAll('[data-tune]');if(!slots||!slots.length)return 0;
  let n=0;
  for(const s of slots){
   const k=(s.getAttribute&&s.getAttribute('data-tune'))||(s.dataset&&s.dataset.tune);
   const v=helpTuneValue(k);if(v!=null){s.textContent=String(v);n++}
  }
  return n;
 }catch(e){return 0}
}
function mulberry(s){return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// sample an organic blob's rim multiplier at an angle (smoothly interpolated).
// blob is a Float32Array of per-segment radius multipliers (see makeMap.makeBlob).
function blobRadius(blob,ang){if(!blob)return 1;const SEG=blob.length;let t=(ang/6.283)*SEG;t=((t%SEG)+SEG)%SEG;const i=Math.floor(t),f=t-i;const a=blob[i],b=blob[(i+1)%SEG];const s=f*f*(3-2*f);return a+(b-a)*s;}
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
/* v49: shade MUST return hex, not 'rgb(r,g,b)'. Canvas accepts either, but the
   molded-plastic primitives (prism / hipRoof / gableRoof / plSphere / basePad)
   re-parse their colour through hx2rgb -> parseInt(hex.slice(1),16), which is NaN
   on 'rgb(...)' and collapses to 0 under the bitwise ops: 18 call sites were
   painting solid black where the source asks for a team tint. Every shade() result
   is either a fillStyle/strokeStyle (identical either way) or an hx2rgb input. */
function shade(hex,f){const n=parseInt(hex.slice(1),16);let r=(n>>16)&255,g=(n>>8)&255,b=n&255;r=clamp(Math.round(r*f),0,255);g=clamp(Math.round(g*f),0,255);b=clamp(Math.round(b*f),0,255);return'#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1)}

