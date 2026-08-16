# Plastic Warfare headless test harness (updated at v84)

Upload this bundle at the start of a session so the harness does not need rebuilding.

## THE FACTION ABILITY ROADMAP (read this first if you are picking up mid-project)

v79 is phase 1 of 4. Every faction-exclusive unit and structure gets ONE passive
and ONE player-toggleable ability. Green landed at v79, Tan at v80, Gray at v81
and Blue at v82, so THE ROADMAP IS COMPLETE. The whole scope was approved up
front, so the phases below are DECIDED, not proposals - build them as written
unless the owner says otherwise. Nothing below is outstanding; it is kept as the
record of what each phase was told to build and what each one actually cost.

### The two structural decisions that govern all four phases

  1a  A UNIT toggle is a SUSTAINED MODE WITH A TRADE-OFF, shaped like the
      gunner's `entrenched`: one boolean, one hash slot, one command pair, NO
      cooldown. A STRUCTURE ability is a timed activated one on the building's
      existing `abilityCool`. Rejected alternative: cooldown abilities on units,
      which would need a new hashed u.abCool plus snapshot work.
  2a  Where an entity already HAS a defining passive (Munitions Dump aura,
      Bunker garrison, Wind Turbine power, Chinook infantry aura, Radar sight),
      that existing effect IS its passive - name and document it, do not stack a
      new one on top. Only the toggle is new.
  7a  One faction per version, self-contained, so trail divergence stays
      attributable.

### v80 - TAN ARMY (LANDED)

  FLAMETHROWER
    passive  Cook-Off: his hits set the target burning. Rides applyBurn/burnT,
             which are ALREADY hashed and serialized and currently written only
             by napalm - so this costs no new state. Confirmed at v79 that the
             flamer does not burn today.
    toggle   Pressure Valve: +50% damage and +1 range while on. THE COST IS NOT
             A HULL CUT: half of the damage he deals to enemies is applied back
             to the flamethrower unit itself. (Owner overrode the original
             "+50% damage taken" proposal with this. Build it as written.)
             The +1 range is why v79 built rgOf() - route it, do not add a
             second door.

  "BULL" HEAVY TANK
    passive  Negates ALL damage from small-arms fire. (Owner overrode the
             proposed flat "ablative skirts" subtraction with a full negation
             keyed on the weapon class. Weapon class 'b' is the bullet row;
             check wcOf/WVA before choosing the test.)
    toggle   Full Throttle: +30% speed, crushes infantry and barricades it
             drives over, and HOLDS FIRE entirely while rolling.

  MUNITIONS DUMP
    passive  the existing damage aura (DUMP_AURA / DUMP_AURA_UP within DUMP_R).
    ability  Scuttle: detonates the dump. 400 damage, blast radius 4, and 25% of
             that damage to FRIENDLY units and structures. (Owner chose Scuttle
             over the proposed Ammo Surge.) Note it destroys your own building,
             so the ability path has to handle the structure dying inside its
             own effect.

### v81 - GRAY ARMY (LANDED)

  SNIPER
    passive  Camouflaged: the sniper is not seen if he has not fired within the
             past 5 seconds. SHIPPED AT v81, and the block that stood over it
             from the day the scope was set was resting on a false premise -
             see the v81 note below. It needed no visibility grid at all.
    toggle   Called Shot: he targets ONLY other infantry, and gains +30% damage.
             (Owner overrode the proposed "highest-value target, -25% fire rate".)

  ROCKET ARTILLERY
    passive  Shell Shock: survivors of the blast have their reload set back.
             Costs NO new state - u.cool is already hashed, so this just adds to
             the existing cooldown on hit.
    toggle   Ripple Fire: a three-rocket salvo at a third damage each over a
             wider box, then a longer reload. Reuses the sal/srt salvo machinery
             the AA truck already has.

  BUNKER
    passive  the existing garrison, plus the already-implemented fact that
             garrisoned infantry are exempt from splash. Name it, do not change it.
    ability  Lockdown: the garrison stops firing and the bunker takes heavily
             reduced damage for a while.

### v82 - BLUE ARMY (LANDED)

  SCOUT BIKE
    passive  Evasive: reduced damage taken while moving.
    toggle   Flat Out: +30% speed and +2 vision, cannot fire and cannot take
             attack orders.

  CHINOOK
    passive  the existing +15% infantry damage aura.
    toggle   Loaded infantry can FIRE OUT of the Chinook, but the Chinook cannot
             move while it runs. (Owner overrode the proposed Fast Rope.) Note
             garrisoned units are currently position-synced to the carrier and
             skipped by most targeting; firing out cuts against several
             `garrisoned` guards, so audit those before scoping.
             THE GARRISON-GUARD AUDIT LIST, walked at v82. SHIPPED as
             Air Assault, and the warning above was FALSE - see the v82 note
             below. Every guard on the list is candidate-side or defender-side
             and NOT ONE of them blocks a passenger from firing:
               nearestEnemy, nearestSec, the tower/bunker scan, splash(), the
               retaliation and call-for-help sweeps, updateFog, pVision,
               dmgBonus's transport aura, the APC shield in applyDmg, and v80's
               crush80 and scuttle80. v81 added none.
             Of these, exactly ONE was edited at v82 and it was an owner
             decision rather than a requirement: splash() now finds a passenger
             who is firing out. The one door that actually had to move is not on
             the list at all - updateUnit's garrison early return.

  WIND TURBINE
    passive  the existing power output.
    ability  Overdrive: TRIPLE output for 20 seconds, then the turbine goes
             OFFLINE for 70 seconds.

### Machinery v79 already built that the later phases should reuse

  rgOf(u) / viOf(u)   the ONE door for range and vision modifiers. v80's
                      Pressure Valve and v82's Flat Out both go through it.
  upOn(p)             the "does this army have an effect running" scan shape.
  u.calmT             seconds since last damage, on every unit, hashed.
  dmgBonus(u)         the single attacker-side buff point.
  applyDmg()          the single defender-side point; also where calmT resets.
  G.strikes           a generic hashed+serialized timed-effect list. v79 added
                      kind:'smoke'. NEITHER Scuttle nor Lockdown used it, and the
                      roadmap's claim that they could was wrong in both cases.
                      Scuttle shipped at v80 as an instantaneous sweep and never
                      touched it. Lockdown was scoped at v81 as the one that
                      genuinely needed it and then did not: b.upT already ticks
                      down in updateBld for EVERY building, is already hashed and
                      already serialized, and upOn() gates on t.uplink so a
                      locked-down bunker cannot read as a running Radar Tent. A
                      strike entry would have cost MORE state, not less.
  b.abilityCool / b.upT   the structure cooldown / duration pair.
  The command pattern     see cases 'onme' / 'smoke' / 'uplink' in execCmd.
  The button pattern      see refreshSelPanel: single-unit, group, and building.

### Things that WILL need a conscious edit every phase

  - tail_v43 KNOWN_UNIT / KNOWN_BLD allowlists, for each new entity field.
  - tail_v44 BASE44_MKEYS, if a field lands on every unit.
  - tail_v72 T49.A pins the `className='bb'` caller count (10 at v79). Every new
    ability button moves it. It is SUPPOSED to need a conscious bump.
  - Section comments: THREE dashes, and no vNN prefix in a banner title.
  - HELP_TUNE slots plus data-tune spans for every new number, and the info-card
    `d:` strings derived from the constants rather than typed.

### Two lessons from v79 worth not relearning

  - The trail tables will move everywhere and prove almost nothing, because
    hashState widens each phase. Cut a legacy-shaped hash to separate widening
    from real divergence (see the v79 note below), and put the actual evidence
    in the phase's own tail.
  - Do the ARITHMETIC on any AI heuristic. v79's bot rally rule shipped its first
    cut on "two infantry is the break-even", which was reasoning rather than
    arithmetic and was wrong by a factor of four.

### Known open question carried out of v80, still open at v82

  T39.I's live census is a single-sample check on seed 590070. Widening it to the
  six seeds SEEDS59 already defines costs five extra 18000-tick matches in segment
  2b and therefore needs a further split of 2b. DECIDED AT v81: not widened. It
  passes on the v81 build and remains fragile by choice; when it next goes red the
  answer is still the split, not a loosened gate. NOT REVISITED AT v82: it passes
  on the v82 build unchanged and the decision above stands.

### Known open question carried out of v79

  The Sarge broadcast is shipped as a human-micro tool: a CPU Sarge never uses
  it, because the honest break-even is 8 grunts and bots hold a mean of 1.15
  infantry inside 3 tiles. Approved to ship that way. If bots should benefit it
  is a SARGE_SELF question or an AI-clustering question, not a bug.

### Standing backlog, unrelated to the roadmap

  APC movement blocking (~15%); late-game air production underperforms;
  spectator HUD rendering; hardcoded napalm/paradrop literals in panel strings.

## Assembly (working file at ../plastic-warfare.html)
    ./build.sh

build.sh does what the three commands below used to do by hand, and does them
from ONE source, which is the point of it:

    S=$(grep -n '<script>' pw.html | cut -d: -f1); E=$(grep -n '</script>' pw.html | cut -d: -f1)
    sed -n "$((S+1)),$((E-1))p" pw.html > game.js
    node --check game.js

It writes BOTH game.js (what the tails execute) and pw.html (what the nine
source-text tails read: T41.F, T43.J, T44.F, T49.A/D, T50.A, T53.H, T54.G and
the v76/v77 checks), each derived from ../plastic-warfare.html in the same step.
Neither is committed.

Doing it in one step is not tidiness. In the v82 bundle pw.html was still the
v81 build while game.js was v82, so every source-text check was linting the
PREVIOUS release while the behavioural checks ran the current one. T49.A's
`className='bb'` pin was the check that caught it once the two were realigned:
it still read 18, the v81 figure, against a v82 file carrying 21. Regenerating
both from one file makes that particular silence impossible.

## Running (v43: one runner, one tail list)
    ./run.sh                 standard suite        (4785 checks at v79; overruns one call)
    ./seg.sh 1 / 2a / 2b / 2c / 3   the same suite in FOUR segments (see the v78 note)
    ./run.sh mini            + 4-combo mini soak   (the pre-delivery gate)
    ./run.sh full            + 36-combo soak       (~2.5min)
    ./run.sh render render_tail_v66.js             (60 checks; real canvas, needs @napi-rs/canvas)
    ./run.sh render render_tail_v54.js             (25 checks; real canvas, needs @napi-rs/canvas)
    ./run.sh render render_tail_v51.js             (60 checks; real canvas, needs @napi-rs/canvas)
    ./run.sh render render_tail_v49.js             (125 checks; real canvas, needs @napi-rs/canvas)
    ./run.sh render render_tail_v33.js             (9 checks; real canvas)
    ./run.sh render render_tail_v32.js             (2 checks; real canvas)
    node browser_check_v73.js <abs path to pw.html> [png]   HUD GEOMETRY, real Chromium
        VIEWS=1920x1080,1280x800 SIZES=small,medium,large node browser_check_v73.js ...
        Needs an ABSOLUTE path (file:// rejects a bare filename) and
        npm i puppeteer-core @sparticuz/chromium. One viewport x three sizes
        is ~38 checks and fits a single container call; the full 3x3 does not.

The real-canvas dependency is not preinstalled in a fresh container:
    npm i @napi-rs/canvas

The tail load order lives in `tails.txt` and nowhere else. Adding a version means
adding ONE line there; run.sh appends the soak tail and tail_end.js itself. If you
need the raw command, run.sh prints nothing magic:

    cat shim_head.js game.js $(grep -v '^#' tails.txt) tail_end.js > harness.js && node harness.js

`tail_v62.js` reads `pw.html` off disk for its source-level lints (the FILE MAP
coverage check and the dead-markup check), so run from this directory.

## What is NOT in this bundle, deliberately (v62, still true at v72)
Spent one-shots are not carried forward. A repin is spent the moment its trails are
cut, and an old splice only applies to a build that no longer exists. Only the
CURRENT release's splice ships here (`splice_v76.py`); every prior one was delivered
as its own artifact at the time.
(At v78 the current splice is `splice_v78.py`; the v78 recut/repin one-shots ship
alongside it as this release's own records, and v77's were dropped.)

Fixups are the exception to the "spent" rule and DO ship, one release deep, because
their headers record shim behaviour that is not written down anywhere else:
`fixup_v76.py` (the T26.A / T29.E / T50.A record: adding weapon row `q` for the
barrage broke three shape assertions written against a nine-row WVA; the v48
call-down fixture's clump is eight tanks, which now correctly draws shells rather
than fire, so both branches are pinned instead of one replacing the other; and
the panel's button count became `RADIO_ABILITIES.length + 1`) and `fixup_v75.py`
(the T50.F record: a v73 fixture whose claim was true of v73 and is no
longer readable off that combo, because v75 raises the AI ceiling enough that the bot
now fields the Gunner it was asserted never to field) is a record and is not
re-runnable. `fixup_v72.py` and `fixup_v71.py` were pruned at v75 - both are more than
one release deep now, and the shim asymmetries they recorded (innerHTML detaches
nothing so panel columns accumulate; querySelectorAll returns []; classList is a Set
independent of className) are written into the shim_head entry below.

**Packaging slip worth knowing about.** The v71 tar shipped `splice_v70.py`, not
`splice_v71.py` - the swap was missed at cut time. It broke nothing, since the splice
in the bundle is a reference copy and every splice is delivered separately anyway,
but it means a session that trusts the bundle to hold "the current splice" was one
version behind. Check the swap when cutting the tar.

## v78 note: segment 2 split three ways, and why the seed count did NOT shrink
v78 widened `T39.I`'s air-target mutation arm from 2 seeds to 6. That is twelve
18000-tick censuses in a single tail, and `tail_v59` overruns a container call on
its own because of it. `seg.sh` is therefore `1 | 2a | 2b | 2c | 3`, with
`tail_v59` running ALONE as 2b. The obvious alternative - trim the seeds until the
tail fits - was rejected: the six seeds ARE the evidence, and cutting them to suit
a runner is the loosening the widening exists to avoid.

The widening itself is not a repin of a failing check. Measured over six seeds on
BOTH builds before anything was touched, air's share of everything trained is
  v77  live 4.01%  zeroed 2.58%   (per-seed live 2.28% .. 5.88%)
  v78  live 3.76%  zeroed 2.28%   (per-seed live 1.42% .. 5.39%)
on effectively identical total production (2843 vs 2845 units). v78 sits inside
v77's own seed spread, so there is no v78 air regression; there is a test
under-powered for the air share the game actually runs at, which is the standing
air-production question surfacing as sampling noise. The 0.85 gate is UNTOUCHED
and the widened arm passes on v77 (2.58% < 3.41%) as well as v78 (2.28% < 3.20%),
so it is not a fix cut to fit this release.

## v78 note: the trails moved through RESEARCH, not through a fielded unit
v78 moves three unit stat rows, and every trail table moved - but `recut_v78.js`
instrumented `makeUnit` per fixture and twelve of the seventeen field NONE of the
three changed units inside their sampling window. No fixture anywhere fields a
jeep or a bike. So the divergence was traced rather than assumed: on
`backyard:dm:777001` the state is byte-identical through tick 310 (units,
buildings, nodes, projectiles, wildlife and `G.rngS` all agree) and at 311 a bot
opens the Gunner unlock holding 89 plastic where it used to hold 77.

`RESEARCH.u_gunner` is derived from `t.cp` by `rscale`/`rtime` at load, so a price
edit reprices the unlock: 109p/76e/11.9s -> 97p/71e/11.3s. The bots buy the unlock
long before they build the man, which is why a 30-second PvP fixture that never
trains a Gunner still diverges. Generalising: on any release that touches a unit
PRICE, expect every AI fixture to move whether or not it fields that unit, and do
not read "the trail moved" as evidence the stat edit landed. The census in
`recut_v78.js` is what carries that evidence.

## v78 note: two assertions were borrowing a live value for a historical input
`T48.C` proves the Gunner DID out-damage the Bazooka under v68. Its three v68
inputs are the price (115), the entrench multiplier (2.0) and the reload (.34) -
but it pinned only the first two and read the reload off the LIVE table. It
reproduced v69's stated 14.85 purely because `rt` still happened to be .4. v73
moved the reload and it still passed; v78 moved it again and it failed. That is a
defect surfacing, not a release breaking, and it was FIXED (all three v68 numbers
named, 14.85 asserted) rather than repinned. `T50.C`'s -15% arm carried the same
pattern against .34 and was fixed in the same pass. Worth a grep on any tail that
compares "then" against "now": a historical arm that reads a tunable live is
vacuous the moment that tunable moves.

## v78 note: the layout baselines did NOT move
v78 is three unit stat rows. It writes no prop, no node and nothing that touches
`M.pass`. All 15 layout hashes passed UNEDITED in both `tail_v43` and `tail_v62`
(30 pins), and `recut_v78.js` refuses to emit anything at all unless they do -
the gate runs BEFORE the first trail is cut. v67 and v74 remain the ONLY two
documented exceptions to the standing rule.

## v76 note: the layout baselines did NOT move
v76 is the terrain-hazard rate, the Artillery Barrage call-down and a manual /
info-card correction pass. It changes the damage a placed hazard deals, never
where a hazard is placed, and touches no prop, no node and nothing that writes
`M.pass`. All 15 layout hashes in `tail_v62` (and all 42 across tail_v28 /
tail_v43 / tail_v62) passed UNEDITED through both pre-repin runs. v67 and v74
remain the ONLY two documented exceptions to the standing rule.

## v76 note: the repin took TWO passes, and why
`repin_v76.py` repinned five tables; two of them were cut wrong, because
`recut_v76.js` assumed every table is captured by "boot a match and hash it".
Two are not:
  * `BASE45_AI` is an ALL-BOT match. `tail_v44` issues an `aiTakeover` on the
    human slot before the first tick. Cut without it, you capture a different
    game.
  * `BASE43_DESK` rewinds `U.gunner.cp` to its pre-v45 price of 90 AND rederives
    `RESEARCH.u_gunner` from it (unlock cost and duration are functions of unit
    cost at load), then boots `cfg45`, which is **tan**, not green. Three
    load-bearing conditions.
`recut_v76b.js` + `repin_v76b.py` are the correction record. This is the v68
lesson one layer down: the cfgs are not interchangeable and neither are the
capture preambles. A recut script must mirror each fixture verbatim.

## v84 note: T43's voice-distinctness checks are flaky, and it is not v84's doing

Adding tail_v84 to segment 3 appeared to break two audio checks - once as T43.C
"all eight gun voices are distinct [7/8]", once as T43.M with
"collisions: gun:smg/gun:amg". A tail that runs LAST cannot fail a check that ran
earlier, so it was worth chasing rather than repinning around.

It is a pre-existing flake. The audio path uses Math.random deliberately and by
design (it must never touch srand - T43.J pins that), and tail_v64's own comment
at the humanisation section states the hazard outright: the jitter is JIT_F=0.06
while "the recipe's nominal f0 values sit ~6% apart". The jitter is the same
magnitude as the spacing between voices, so two recipes can land on top of each
other by chance, and which check catches it depends on which pair collided.

Measured: three runs of segment 3 WITHOUT tail_v84 - clean, clean, clean. Three
runs WITH it - clean, clean, clean, at 1,362. The two failures came from runs
launched through seg.sh, and a suite that is now run in parallel simply gets more
rolls of that die.

Not fixed here, because it is a test-fragility question rather than a v84 one.
The fix, if it is wanted, is the pattern tail_v64 ALREADY uses fifty lines further
down for its jitter-off mutation arm: pin Math.random to a fixed value (or a
seeded generator) across the fingerprint capture, so the distinctness claim is
about the RECIPES rather than about one lucky roll of the humanisation.

## v84: the encounter ledger, and what was ALREADY there

The brief was "make the AI react to what it keeps meeting". Most of that already
existed and it is worth writing down before anyone builds it a second time.
aiPickUnit has scored counters since v51:

    let eff=0; for(const ar in mix) eff += mix[ar]*dmgMulFor(k,t.w,ar);
    let s = dps*eff/(t.cp+t.ce*0.5);        // offensive counter
    s *= Math.sqrt(ehp/U.grunt.hp);          // defensive counter, vs the foe's rows
    s *= clamp(1+2.2*(want[c]-have[c]),0.35,2.6);
    s /= 1+AI_SAT_A*(kshare[k]||0);

Against a pure-infantry foe that already prices the Flamethrower at 0.1181
damage-per-plastic against the Tank's 0.0209 - 5.6x - and the draw is
proportional to the SQUARE of the score. "Tan builds more flamers, Green builds
fewer tanks" was shipped behaviour, not a gap.

The gap was the INPUT. aiFoeArmorMix read a live census of ai.grudge's surviving
units: perfect intel on one rival, nothing from the other two in a three-army
match, and no memory at all - an infantry wave that wipes a bot's army stops
counting the instant it dies.

So v84 changes what the mix is made of, not what is done with it. p.ai.enc is
damage TAKEN per armour class, decaying on ENC_HALF, written at the single
defender-side door in applyDmg and blended over the live census with a weight
that grows as evidence accumulates. No new term joins the scoring.

Three properties fell out of the existing machinery rather than needing work:
persistence (_encAi copies every key it does not special-case, and loadState
spreads the decoded brain back, so the ledger survives a save with no encoder
edit - which T3 requires), determinism (applyDmg is deterministic sim and the
ledger reads no rng, so lockstep clients compute the same figures), and multi-
rival coverage (damage arrives from whoever actually attacks, grudge or not).

## v84 measurement: what actually moved, and what did not

measure_v84.js runs a bot against a scripted opponent fed one armour class, and
reports what it produced. Three seeds, 14,000 ticks, before and after:

    vs air     AA Missile Truck   0.9% -> 8.7%   (+7.8)   the dedicated answer
    vs heavy   Bazooka Man       11.1% -> 17.0%  (+5.9)   1.76x into heavy
    vs heavy   Grunt             45.1% -> 36.3%  (-8.8)   0.60x into heavy
    vs medium  Bazooka Man        5.5% ->  9.8%  (+4.3)   1.35x into medium
    vs heavy   Flamethrower      15.9% -> 12.9%  (-3.0)   0.45x into heavy
    vs air     Flamethrower      20.7% -> 18.0%  (-2.7)   0.50x into air

AND AGAINST INFANTRY, NOTHING MOVED AT ALL. Not "moved a little" - the rosters
came out byte-identical. That is not a failure and it is worth understanding:
the pre-v84 no-intel fallback was already `mix.inf=1`, so blending an
infantry-only ledger over an assume-infantry guess is an identity. The ledger can
only add information where the old default was WRONG, which is every diet except
the one it happened to guess. Anyone who later wants the infantry case to move
should change that fallback, not the ledger.

That finding also set the cap rule. Capping earned evidence at ENC_CAP against a
census that does not exist would leave a bot which has taken nothing but tank
fire still reading a quarter infantry, purely from the guess. So the cap lifts
when tot===0: evidence beats a guess outright, and it only shares the mix with a
census the bot can actually see. Lifting it took the air row from +4.8 to +7.8
and the medium row from +2.3 to +4.3.

## v84 trap: a measurement harness can be wrong in the direction you want

The first cut of measure_v84 spawned six of whatever the diet was. Six grunts is
216 plastic; six tanks is 1,596. The tank diet applied seven times the pressure,
the bot's economy collapsed under it, and the run reported 242 units built
against infantry versus 39 against tanks - of which 92% were grunts. Read
uncritically that says "tanks make the bot build grunts", which is a counter
response, and it would have been reported as a result. It is nothing of the sort:
a bot losing its economy buys the cheapest thing available whatever it is facing.
Waves are sized by plastic now, so the diets differ in COMPOSITION and not in
force.

Two smaller ones in the same file: it labelled rows from the config faction while
measuring the bot (reporting GREEN over a roster of Gray snipers), and the
human->bot faction mapping it then "measured" to fix that was an artefact of
running four newGames in one process with state carried between them. The bot
faction is seed-dependent; the harness now searches the seed space for the army
it wants and labels every row from bot.fac read at runtime.

## v83: running the suite for less, without running less of it

Measured on a 4-core box, whole suite, before any of this: 705 seconds serial,
633,488 simulated ticks, 4,964 reported checks.

    segment 1   125s   165,128 ticks   2,331 checks
    segment 2a   29s    33,923           620
    segment 2b  298s   247,032           175
    segment 2c  105s    84,800           367
    segment 3   148s   102,605         1,471

Two things came out of that profile and both are now fixed.

FIRST, 508 of those 4,964 checks were the same 127 run four times. seg.sh
prepended tail_v44 and tail_v47 IN FULL to segments 2a, 2b, 2c and 3 to borrow
six symbols - cfg44, arena44 with its scan/carve/recarve closure, and
host47/chan47/walk47 - and paid 127 checks and 12,432 ticks for them each time.
helpers.js now carries those six and nothing else; the tails themselves still
run, once, in segment 1. The suite reports 4,456 now, and that is not a loss of
coverage, it is the duplication leaving the count. Segment 1 is unchanged at
2,331 and the other four each dropped exactly 127.

SECOND, `./seg.sh all` runs the five segments as concurrent processes. They were
only ever split because the suite overruns a single CONTAINER CALL - they are
independent processes over read-only inputs. 705s -> 320s, byte-identical
results. 2b is launched first because it is the long pole; everything else lands
inside it. QUIET=1 drops the per-section headers, leaving failures and totals.

The floor is now segment 2b, and 234,000 of the suite's 633,000 ticks are ONE
check: T39.I's six-seed air-target arm. That was widened deliberately at v78 and
kept at v81 and v82 with the reasoning recorded above. It is not touched here.
It is simply worth knowing that it is 37% of the bill, and that it is the only
place left where a large number lives.

## v83: choosing the right segments up front, mechanically

`./triage.sh [git-ref]` answers the question that used to be judgement, in about
25 seconds against the full suite's 705.

  1. DID THE SIMULATION MOVE? Re-runs the pinned trail combos and the 30 layout
     pins and compares. This cannot be read off a diff and should never be
     guessed: v83's placement bounds check looks like a UI guard and moved every
     trail, while v82's help-panel work rewrote hundreds of lines of markup and
     moved nothing. A trail that differs is conclusive - run everything, and the
     release needs a repin. A trail that reproduces is strong but not absolute:
     it proves these combos are unchanged, not that no combo anywhere could
     differ.

  2. WHICH TAILS NAME WHAT YOU TOUCHED? Identifiers on the changed lines,
     intersected with the names the build actually declares, matched against
     every tail, and RANKED BY RARITY - a name two tails mention is a pointer, a
     name half of them mention is noise. Starred rows name a rare identifier.

Run against v83's own gameplay diff it stars tail_v43 (BARR_CLEAR2,
BARR_CLEAR_SHARE - T23.E, the differential check) and tail_v61 (DEPOT_SUP,
SUP_CAP - T40.D), with tail_v54 next. Those are exactly the three files that
release had to edit, and tail_v61 is the one that was MISSED at the time,
because it sits in a segment nobody thought the change touched.

Two dead ends worth not repeating, both found by running the thing:
  - Taking every word on a changed line drowns in prose. A comment reading "the
    ceiling is reached on seven depots" contributes ceiling, reached and depots;
    every tail says one of those somewhere; the map named all five segments,
    which is the same as naming none.
  - Filtering against declared names is not enough on its own if game.js is
    scanned WITH its comments: a comment reading "the edges that leaked: only a
    column can wrap" registers `leaked` as a declared property. And a diff line
    sitting inside a multi-line block comment carries no comment marker of its
    own, so stripping line by line never reaches it. Both sides go through one
    stripper that tracks block comments across lines.

## v83 note: the depot change deletes an equality on purpose, in three places

DEPOT_SUP went 10 -> 15 with SUP_CAP left alone at 110. The point was base
FOOTPRINT, not army size: the ceiling now costs seven depots where it cost ten,
and the three that come back are buildable ground in a base that was cluttered
with them.

What that costs is the clean relation v69 chose the 110 ceiling FOR. Six depots
reach 100 and the seventh crosses with 5 of its 15 unused, so "an HQ plus N
depots reaches the ceiling exactly" is simply no longer true. Three checks
asserted that equality and all three were rewritten to assert the bracket and the
COUNT instead - T35.B and T35.C in tail_v54, and T40.D in tail_v61, which is a
second copy of the same invariant in a different tail and was found only because
segment 2c was run. A release that touches supply must expect to edit both.

Rejected: raising SUP_CAP to 115 to restore the exact relation on seven depots.
It is a one-line change and it does restore the tidiness, but it also hands every
army 5 more supply, which is a balance change nobody asked for. The waste is the
honest price of the footprint, and it is recorded here rather than tuned away.

## v83 note: the bot's hedgehog clearing is a FALLBACK SLOT, not a near target

The obvious way to let a CPU army clear the map's neutral barricades is to drop
the `if(b.p===G.neutral)continue` in nearestEnemy and let them compete on
distance like anything else. That would have been wrong: a hedgehog two tiles
away would then outrank a soldier ten tiles away, and a bot would spend its
attack walking into scenery.

They are collected in a slot of their own - nbarr/nbd, bounded by BARR_CLEAR2 -
and the function returns `best||nbarr`. A barricade is therefore answered only by
a unit that found nothing else AT ALL in range, which is what "low priority"
actually means. Only a bot sees them (`u.p&&u.p.ai`), and only one unit id in
BARR_CLEAR_SHARE, so an army thins clutter as it passes instead of every man
stopping at once.

Keyed on u.id, never on srand(). A targeting scan that consumed the sim RNG would
move every trail in the suite for no gameplay reason, and would make the next
release's trail diff unreadable.

## v83 note: the out-of-bounds placement bug was a row-major WRAP, and only two edges leaked

placeDeny swept a footprint against G.map.pass with no bounds check at all,
resting on the idea that an out-of-range read comes back undefined. That is true
for a ROW and false for a COLUMN. pass is flat and row-major, so at tx+x === N
the index (ty+y)*N+(tx+x) is exactly (ty+y+1)*N - the first tile of the next row -
and tx = -1 lands on the last tile of the previous one. Where the tile it wrapped
onto happened to be passable, the placement was allowed and the building went up
off the map.

Measured on backyard before the fix: tx=N-1 and tx=-1 both passed the gate, and
every out-of-range ty was already refused. So it is the EAST and WEST edges that
leaked, and the corners are simply where a player notices, not where the fault
lives. One `if(tx<0||ty<0||tx+sz>N||ty+sz>N)` up front is the whole fix.

## v83 traps learned

  - T23.E is a DIFFERENTIAL test, not a trail. It reimplements nearestEnemy as an
    independent reference and asserts the real one matches over 60 units x 3
    ranges x 4 cone directions. A change to the real function fails it, and the
    fix is to mirror the new rule in the reference - exempting the reference from
    barricades would have made it stop testing the branch v83 just added. It is
    the only check in the suite that behaves this way; everything else that broke
    was a pinned number.
  - The supply invariant lives in TWO tails. T35.B/T35.C (tail_v54) and T40.D
    (tail_v61) assert the same relation from different fixtures, and only the
    first pair is in segment 2a. Running the segments the change "obviously"
    touches is how the second one gets missed.
  - Five trail tables, four files, and tail_v44_1 is not one of them: T25.F reads
    tail_v44's BASE45_AI rather than carrying its own. Repinning by "one table per
    failing check" would have looked for a sixth table that does not exist.
  - The layout gate is 42 pins, not 30. recut_v78's gate covered tail_v43 and
    tail_v62; tail_v28 carries a third table of 12 with a different config (always
    dm, always 3 opponents, no desk). tail_v72's note already counted all three.

## v83 repin: the tables, the gate, and what the one-shots are

`recut_v83.js` cut five tables and `repin_v83.py` wrote them into four tails:

    BASE45_TRAILS   tail_v43   T23.A
    BASE45_AI       tail_v44   T24.I, and tail_v44_1's T25.F reads the same one
    BASE43_DESK     tail_v45   T26.G, the Gunner-at-90 fixture
    BASE48_TRAILS   tail_v49   T30.A, block-scoped and faction 'green'
    BASE62_TRAILS   tail_v62   T41.A, the same run as BASE45_TRAILS

Two guards, both learned from the v76 repin that cut two of five tables wrong:

  1. The layout gate runs BEFORE the first trail and emits nothing if any of the
     42 pins moved. v83 writes no prop, node or nest, so a moved layout hash would
     mean the release is not what it says it is, and repinning on top of that
     would bury the evidence. All 42 held.
  2. BASE45_TRAILS and BASE62_TRAILS are cut INDEPENDENTLY and then asserted
     equal. They are the same run pinned twice; if they ever disagree, one of the
     two tails is lying about what it tests. repin_v83.py re-checks the equality
     from the JSON before writing, along with every key set and sample count.

The v76 lesson is the reason both exist: a recut that assumes every table is
"boot a match and hash it" gets BASE43_DESK wrong (it needs the Gunner at 90 and
RESEARCH.u_gunner rebuilt from that price) and BASE45_AI wrong (it needs the
human seat handed to the AI first). Both are reproduced explicitly.

## v82 note: firing out of the Chinook was never blocked on what the roadmap said

Second time in three releases, and the same shape as Camouflaged. The roadmap held
that "garrisoned units are position-synced to the carrier and skipped by most
targeting; firing out cuts against several `garrisoned` guards", and listed eleven.
Walked at v82 rather than inherited: every one of the eleven is CANDIDATE-side or
DEFENDER-side, and not one blocks a passenger from firing. The single door that
does is updateUnit's `if(u.garrisoned)return;`, which is not on the list.

Counted rather than reasoned, 40s fixture, 8 grunts firing out of a parked Chinook
in front of a barracks, a guard tower, a Bull, 4 mortars and 4 grunts:

       7  nearestEnemy        enemy scan passed over him
     240  nearestSec          hull flamer passed over him
     377  splash              blast skipped him
      32  APC shield          skipped him (would have been -25%)
      22  orderAttack ONTO a firing passenger   <- NO GUARD
      32  retaliation + help sweep DID reach him (hits landed)
       0  updateFog / pVision / crush80 / scuttle80  (never reached)

The last two rows are the finding. orderAttack guards hid81 and mainOk but NOT
`tgt.garrisoned`, and the retaliation block and call-for-help sweep both take
`attacker` by reference. So a passenger who shoots is locked onto and shot back by
his victim and his victim's neighbours, already, with no edit: 4 of 6 died inside
the aircraft in a 30s rifle fight. The trade-off the spec did not even ask for
falls out of the sim as it stands.

WHAT IT COST: the branch itself is one function driven by the CARRIER at the
position-sync line, which is why a passenger needs no back-pointer to the aircraft
holding him. Everything else is toggle plumbing.

TWO THINGS THE AUDIT FOUND THAT THE LIST DID NOT NAME:

  - dmgBonus's transport aura guards the aura SOURCE and never the recipient, and
    a passenger sits at distance 0 from his own carrier. So a man firing out
    collects the Chinook's +15% automatically. Measured x1.150 aboard, identical
    to standing beside it. No edit; disclosed rather than discovered later.
  - A passenger dying inside is NEW STATE. Before v82 a garrisoned man could not
    be hurt at all, so nothing ever removed a corpse from a hold. Measured: 2 of 8
    corpses persisted, the bay read 8/15 with 6 alive, which counts against the
    cap and lies in the panel, and apcUnload would later set a corpse to 1 HP
    without fielding it. This is the one place the feature had to pay, and it is
    the only edit in v82 that is a fix rather than a feature.

EXPOSURE, by owner decision: splash() now finds a passenger who is firing out; the
APC shield and smoke cover deliberately still do not. Gated on the firing flag, so
a bunker garrison and a quiet APC squad keep the exemption unchanged.

## v82 note: Air Assault is strong and the "cannot move" clause is the only brake

Measured with the carrier's HP inflated 40x so the clock is the free variable:

                              shots   dmg>foe   paxAlive
  15 grunts on the ground       343       962      4/15
  15 grunts firing out          486      1362     12/15

Against a defended base, real HP everywhere: firing out kills a barracks at 8.5s
losing nobody, versus 18.4s on the ground, and never scratches the guard tower
because the tower spends the fight on the Chinook.

The brake is the aircraft. Real HP, four attackers, time to kill a parked Chinook:
AA trucks 0.7s, apaches 1.9s, tanks 7.4s, gunners 8.1s, grunts never inside 40s.
So "cannot move" is a real clause against anything that can hurt a helicopter and
no clause at all against pure small arms. Recorded, not tuned around.

## v82 note: Evasive has a 17.3% ceiling and the definition is the whole ability

"Reduced damage taken while moving" needs a definition and the definition decides
whether the passive exists. Damage-weighted over three full Blue-bot matches:

  82.3%   attack, standing still
  15.6%   attack, displaced this tick
   1.5%   amove
   0.4%   idle

A Scout Bike takes 82.7% of its damage parked. So the passive can only ever touch
17.3% of what kills a bike, whatever the reduction: at EVADE_RED 0.50 that is 8.7%
less damage over a match, and buying even 15% would need an 87% reduction.

SHIPPED on displacement (does the bike's own update move it), NOT on the state
name. A state test would have covered 1.5% and been inert in exactly the sense the
first Shell Shock probe was inert. The ceiling is asserted in T56.B so this cannot
be re-scoped by feel later.

Implementation note worth keeping: the flag is written at the FOOT of updateUnit,
comparing against a stash taken at the top, so it describes a whole update rather
than a half-finished one and is therefore independent of where the reader sits in
the unit order. It is hashed, because it feeds a damage multiplier.

## v82 note: Overdrive is a net LOSS, deliberately, and the bot rule was measured away

Arithmetic first, because it decided whether to write an AI rule at all. Over one
OVER_CD cycle a turbine gains 2*eps*OVER_T and gives up eps*OVER_OFF:

  turbine eps 2.20   burst +88   offline -154   NET  -66  over 90s
  upgraded eps 3.30  burst +132  offline -231   NET  -99  over 90s

Break-even burst at a 70s offline is 35s; the spec says 20s. Overdrive buys the
electricity EARLIER, it does not buy more of it. Shipped at the specified numbers
and asserted as a net loss in T56.G so nobody reads it as a power boost. The lever
if it should ever become net-positive is OVER_OFF < 2*OVER_T; declined.

The AI rule was the one v82 item scoped for a measurement pass, and the
measurement said not to write it. Across three Blue-bot matches a bot's training
options were blocked by ENERGY alone 0.4% of the time and by plastic 61.2%,
against a median energy bank of 2156. An energy-starvation floor would fire on
nothing, and on the rare occasion it fired it would trade 88 now for 154 later.
Unwired, like Ripple Fire at v81 and the Sarge broadcast at v79, and asserted as
deliberate rather than left looking like an omission.

## v82 note: the trails moved everywhere and proved nothing, exactly as expected

Four slots were added to hashState (u.flat, u.aslt, u.fo, u.mvg), so all five
pinned trail tables moved. Classified before repinning with a legacy-shaped hash
built by string surgery on the LIVE hashState rather than typed out by hand, so
anything else that had moved in hashState would still be present in the legacy
shape and would still show up:

  all ten classified trails      HASH WIDENING ONLY
  bike-samples in any of them    0

Not one pinned trail fields a Scout Bike, including the Blue AI arm, which runs
only 1800 ticks. So the trail tables say nothing whatever about Evasive, the only
v82 mechanic that can move a bot match, and the real evidence lives in tail_v82.
This is the v79 lesson restated: cut the legacy hash, then put the evidence in the
phase's own tail.

Layout baselines were NOT recut. v82 is sim-only and the map-gen pass is untouched.

## v82 traps learned

- repin_v82.py's FIRST CUT DELETED 300 LINES of tail_v49. It located the end of a
  table by searching for `};` at the DECLARATION's own indent. BASE48_TRAILS is
  declared at one space and closed at column 0, so the search ran past the real
  end and matched a later `};`, swallowing everything between - including a
  `const O=` that the rest of the tail depends on. Segment 1 caught it as
  "ReferenceError: O is not defined", four tails downstream of the damage. Scan
  for the first line whose STRIPPED content is exactly `};`; do not assume the
  closing brace shares the declaration's indent. And keep a copy of any tail a
  repin touches, or restore from the uploaded tar as this one had to.
- THERE ARE FIVE PINNED TRAIL TABLES, NOT FOUR. BASE43_DESK in tail_v45 is a bare
  array rather than a keyed table, so a grep shaped around `const BASEnn_...={`
  misses it. Segment 1 caught that too. The five are BASE45_TRAILS (tail_v43),
  BASE45_AI (tail_v44), BASE43_DESK (tail_v45), BASE48_TRAILS (tail_v49) and
  BASE62_TRAILS (tail_v62).
- A `const` READ BY A TABLE MUST BE DECLARED ABOVE IT. U0AURA was spliced in just
  before FAC_AIR, which sits after the unit table that reads it, so the table
  literal hit it in the temporal dead zone and the file threw at BOOT rather than
  at use. Module-scope tables are built in source order; splice a constant they
  read ABOVE the table, not merely somewhere earlier in the file than its use.
- A PROBE FIXTURE THAT LETS THE CARRIER DIE MEASURES A GROUND FIGHT. The first
  Air Assault probe had the Chinook destroyed inside the window in five arms of
  nine; apcUnload dumped the squad and "loaded" and "fireout" converged on the
  same numbers, which read as a clean negative result. Same family as the v81
  Shell Shock probe defect: inflate the HP of whatever must survive for the
  variable under test to be the free one.

## v81 note: Camouflaged was never blocked on what the roadmap said it was

The roadmap held this passive back from the day the scope was set, on the grounds
that "is not seen" needs per-player visibility and the sim has none. The premise
was wrong. The passive as WRITTEN is uniform across every hostile army - he is
concealed from all enemies or from none - so the per-player half of the question
is the allied() test that every acquisition door already runs. No grid, no
per-observer state, no fog read, no pVision work.

What it actually cost: one hashed scalar (u.shotT, the mirror of calmT) and a
predicate at six sim doors plus one client door.

  nearestEnemy      idle sighting, attack-move sighting, the entrench cone
  nearestSec        the Bull's hull flamer
  the updateBld scan   guard tower and garrisoned bunker
  orderAttack       player orders, AI orders, retaliation, the help sweep
  the aiTick threat list
  visibleToHuman    rendering, minimap, hover, click-to-attack, the heal picker

Two of the four callers the roadmap named need NO gate, and that is a finding
rather than an omission: firing zeroes shotT, so the retaliation block and the
call-for-help sweep can always answer the man who just shot. And visibleToHuman
turned out to be the single client door for all of rendering, picking and the
minimap, so the "an enemy human can still see and click him" problem is one test.

Perf was never the issue either: the acquisition loops run ~445k candidate
iterations per 6000 ticks, so a key-comparison short-circuit is ~1.3M cheap tests
per 18000-tick match against a 5.7s/6000-tick baseline.

## v81 note: Camouflaged is an approach tool and nothing else, and that is measured

Shipped as specified, with the numbers on the record so nobody re-scopes it by
feel later. Census over three seeds with a Gray bot, 12000 ticks each: 39 snipers
trained, 1268 sniper-samples, 333 of them inside a hostile unit's or tower's
acquisition reach. Of those 333, 311 were HOT - he had fired within CAMO_T. The
passive blanks 6.6% of the moments he is in danger, because his reload is 3s and
the window is 5s, so an engaged sniper is never concealed.

The fixture says the same thing, three modes on one seed:

  3 snipers vs 6 grunts     identical in all three
  3 snipers vs 4 gunners    identical in all three
  2 snipers vs 3 jeeps      identical in all three
  1 sniper crosses a 4-grunt picket, never firing:
      off              dies, 42 damage taken
      concealed        survives untouched
      + 2.5-tile reveal   dies

So it does exactly one thing: an unengaged sniper can walk past enemies. A
proximity reveal would delete even that, which is why none was built.

Tightening the WINDOW alone does nothing - 5s, 3s and 2s give byte-identical
fights - because concealment blocks acquisition and never breaks a lock somebody
already has. Only "hiding also drops held targets" makes it bite, and then it
bites hard (CAMO_T 2 + drop: 3 snipers vs 4 gunners goes from 2 killed / 3 lost
to 4 killed / 1 lost). Both levers were offered and declined; the shipped build
retains held targets deliberately.

## v81 note: the first Shell Shock measurement was a probe defect, not a weak mechanic

Worth recording because a decision was very nearly made against it. The first
probe wrote `tgt.cool = max(cool, add)`. A grunt's whole reload is 0.8s and a
gunner's is 0.5s, so a floor at 0.5 or 1.0 can never sit above what the target is
already holding - inert by construction. The same fixture also killed the shelled
squad inside two seconds, so what it measured was lethality. Both arms read
identical numbers and it looked like a clean negative result.

Rerun with the squad surviving (HP inflated 20x so the CLOCK is the free
variable), 2 arty on 6 gunners over 30s, 72 shock applications per arm. Shots the
squad got off, baseline 342:

  setback   as a floor   added to the clock
  0.5s         324              276
  1.0s         294              210
  1.5s         258              138
  2.25s        216               48

SHOCK_SET ships at 1.0s additive, i.e. -39% suppression on a saturated squad.
Additive is the honest reading of "reload set back" and is the only shape whose
effect size is not silently capped by the target's own reload.

## v81 note: Ripple Fire ships as a strict upgrade, by owner decision

Measured damage delivered in 30s, 2 arty, HP inflated so the reading is not capped
by the target pool:

                          normal   x1.0   x1.2   x1.3   x1.4
  8 grunts, tight            698    1021   1021    978     700
  8 grunts, spread           380     697    448    404     245
  barracks                   273     572    477    440     361
  (rockets at RIPPLE_DM 0.50 each; the x-columns are the reload multiplier)

At the specified third-damage rockets the toggle was worse than plain fire in
every arm, which is the Pressure Valve trap again. The owner raised per-rocket
damage to one half and set the reload at x1.30. At those numbers ripple beats
single fire everywhere measured (+40% tight, +6% spread, +61% on a structure), so
it is a mode with no trade-off, contrary to structural decision 1a. x1.4 was the
multiplier that restored a real trade (parity tight, -36% spread, +33% structure)
and was declined. Recorded, not tuned around.

## v81 note: Lockdown is a losing-fight button, and the bot rule says so

10-second lock, same arena, two fixtures:

                    light attack (bunker wins)   heavy attack (bunker loses)
  no lockdown            274 HP left             dies at 8.0s, kills 5
  50%                    142 HP left             dies at 12.5s, kills 2
  65%                    187 HP left             dies at 14.1s, kills 3
  80%                    231 HP left             dies at 16.2s, kills 4

Locking down a fight the bunker was winning costs more in forgone garrison fire
than it saves in damage - every arm ends with LESS health than doing nothing.
Shipped at LOCK_RED 0.65 (+76% survival for two fewer kills), and the bot rule is
a health floor rather than a presence-of-enemies test, because the floor is the
only thing that distinguishes the two fixtures. An empty bunker never spends it:
there is no fire to trade away.

## v81 note, CORRECTED AT v82: the call-down fall was the seed set, not the release

This section replaces the v81 note of the same name. The v81 note is not softened
here, it is withdrawn: its conclusion was wrong, and the reasoning that produced it
is worth keeping precisely because it looked airtight.

v81 measured clump call-downs (napalm + barrage) per 24000-tick match on six seeds
and found 15 on v80 against 5 on v81. It then deleted the five Gray capability
flags at boot, reproduced v80 EXACTLY on all six seeds - identical counts and
identical match lengths - and concluded the fall was the Gray abilities. That
isolation arm proves the flags cause the DIVERGENCE. It does not prove the
divergence suppresses call-downs, and that gap is the whole error.

Isolated at v82, one flag deleted per arm, six seeds each:

  arm            4075  4076  4077  4078  4079  4080   total
  v81 baseline      0     0     2     0     3     0       5
  camo off          1     0     1     1     1     0       4
  cshot off         4     1     1     1     0     1       8
  shock off         1     0     2     0     3     0       6
  lock off          0     0     2     0     3     0       5
  all five off      1     0     5     4     2     3      15

Nothing restores it. The largest single recovery is Called Shot at +3. Lockdown
reproduces baseline tick for tick on all six seeds, which means it never fires in
these matches at all. Removing four of the five leaves you nearer v81 than v80.
Ripple Fire needed no arm: it is unwired for the AI, so a bot-versus-bot match
never toggles it - excluded on construction rather than on measurement.

The out-of-sample arm settles it. On six seeds nobody had looked at, 4081-4086:

  v80-equivalent (all five flags off)   2  1  2  0  1  2   =  8
  v81 baseline                          3  0  2  3  2  1   = 11

The sign reverses. Per-seed counts run 0 to 5, the v80-equivalent build swings
from 15 to 8 on a seed change alone, and the four single-flag arms spread 4 to 8
around a baseline of 5. Six seeds cannot resolve a count this sparse.

STANDING QUESTION, CLOSED by owner decision at v82: accepted. There is no ability
to isolate and no defect to fix. If it is ever reopened the test is more seeds on
both builds, not more isolation arms. The comment inside tail_v77 that carried the
v81 conclusion was corrected at v82 as well; a test file asserting a false reason
is worse than one asserting none.

THE GENERAL LESSON, which is why this note is long. "Deleting X reproduces the old
build exactly" proves CAUSATION OF DIVERGENCE and nothing more. To claim a metric
moved because of X, the metric has to survive a sample it was not chosen on. v81
had six seeds and a plausible mechanism, and neither is evidence.

## v81 traps learned

- Unit ids are REUSED across newGame, so a probe keeping a per-id stamp table
  between arms reads a stale stamp as "fired in the future" and silently disables
  the very thing under test. The first camo fixture showed all three modes
  identical and looked like a clean negative result; it was this.
- A comment naming the host RNG inside a function trips the banned-token purity
  lint on its own prose. Same shape as the v42 "string assertions match prose"
  trap, one layer further in: describe the seeded draw, do not name the other one.
- makeBuilding leaves a structure at CONSTRUCTION health; setting prog=1 does not
  fill it. A Lockdown fixture read "bunker dies at 0.5s" until hp=mhp was set.
- A per-tick AI rule that reads u.target must live in the sim, not aiTick. The
  bot's Called Shot rule was written in aiTick first and read null every time,
  because aiTick issues orders before it and the 18-tick cadence is slower than a
  target turns over. Same lesson as the v80 valve, learned again.
- Section IDs collide across releases: tail_v80 already owned T54.A-G, so
  tail_v81 was renumbered to T55 before delivery.

## v80 note: what the roadmap said about burnT was wrong, and it mattered

The roadmap recorded that applyBurn/burnT were "currently written only by
napalm". They are not, and were not: napalm runs its own per-cell ground fire
(s.burn plus a direct applyDmg) and never touches burnT. The only writer before
v80 was the fire ant. The conclusion the roadmap drew from it (Cook-Off costs no
new state) survives, but the confirmation test had to be aimed at wildlife
instead of at a call-down.

That miss hid a second one. burnDps has always been SERIALIZED - the snapshot
encoder is a skip-list, not an allowlist - but was never HASHED. Harmless while
the fire ant was the only writer, because it always wrote 7.2. Cook-Off is a
second writer at a different value, so from v80 a client resyncing mid-burn
would have silently disagreed about how hard the burn ticks. Hashed at v80 as a
fix riding the release.

## v80 note: Ablative Plate is wider than "small arms" sounds

Row 'b' is not just the eight units carrying w:'b'. WC_BLD maps BOTH the guard
tower and the bunker onto it, so from v80 no structure in the game can hurt a
Bull. A bunker in particular fires as the BUILDING, at a flat 8*HP_SCALE per
garrisoned man, so loading it with bazookas does not change the row it scores
on and does not counter a Bull.

Measured before the decision, one muzzled Bull, twelve seconds per arm:

  4 gunners           22.26 DPS      bunker + 4 grunts   20.87 DPS
  2 bazookas (ctrl)   21.31 DPS      2 Hueys             10.65 DPS
  1 tank (control)     7.77 DPS      1 guard tower        5.75 DPS

A garrisoned bunker was the best anti-Bull static defence in the game, level
with two bazookas and 2.7x a Tank. It is now zero. The Paratrooper is the
graceful case and the intended counter-play: his SMG is row 'b' but paraMun
swaps him to AT (row 'r') against armour, so paras still work.

## v80 note: Pressure Valve measured as a trap, and the AI rule is deliberate

At the originally approved VALVE_BACK of 0.50 the valve was a net LOSS in every
arm measured - against gunners it killed FEWER enemies (7 vs 10) while losing
the whole squad (6 vs 2). The mechanism: a flamer deals ~40 DPS into infantry,
so 0.50 charges him ~20 HP/sec against an ~83 pool, and dead flamers deal no
damage. Owner retuned to 0.25.

Even at 0.25 it does not pay against infantry - twelve arms across six ratios,
never an improvement. The reason is overkill: a flamer hit already kills a
grunt, so the damage bonus buys nothing while the recoil is charged in full. It
pays clearly against STRUCTURES, which absorb the whole increase:

  barracks     6.4s -> 4.3s to raze,  0 flamers lost either way
  guard tower  5.9s -> 3.7s to raze,  1 flamer lost -> 0, because the tower
               dies before it finishes shooting back

The bot therefore opens it on buildings above VALVE_AI_FLOOR health. Against
infantry it is a flat VALVE_AI_INF_P coin flip BY OWNER'S DECISION, explicitly
not conditioned on benefit. Recorded rather than tuned around: roughly half of
CPU Tan flamers engaging infantry now pay the recoil, so Tan bot flamer
attrition is up.

TRAP, and the reason the roll is not in aiTick. aiTick runs once every 18 ticks;
a flamer's engagements turn over faster than that, so rolling on that cadence
left most engagements never rolled at all and produced a measured 14.3% instead
of 50%. The roll lives in the sim at acquisition, keyed on u.vrt so it fires
once per engagement rather than once per tick, and draws from srand(). Measured
43.9% after the move; the residual is engagements that begin and end inside one
tick.

## v80 note: T39.I's live census is a single-sample check

T39.I asserts aa > 0 from ONE match on seed 590070. During v80 it went red, and
the fix was NOT to touch it. Six seeds on both builds:

  seed      590070  590071  590072  590073  590074  590075   total
  v79 AA         8       8      10      11       2       5      44
  v80 AA         0      11       9       8       5       9      42

v80 had not regressed AA production; the check samples a quantity that ranges
0 to 11, and v79 itself scores 2 on seed 590074, one draw from failing
identically. It passes again on the final v80 build only because later sim
changes reshuffled that seed. It remains fragile and will bite again. Widening
it to the six seeds SEEDS59 already defines is the fix; it costs five extra
18000-tick matches in a segment that already cannot finish inside one container
call, so it needs to land together with a further split of 2b. NOT DONE, still
open.

## v80 traps learned

- A TOP-LEVEL banner comment must not carry a version prefix. T49.D anchors its
  regex at column 0, so indented sub-banners inside functions are out of scope
  and may say v80; the two at column 0 could not. This is the cousin of the
  four-dash FILE MAP trap.
- Test windows that slice a FIXED character count from a function silently
  shrink as the function grows. T53.H sliced 12000 chars from refreshSelPanel;
  v80's five new buttons pushed the Sarge and smoke tokens out of it. Rebounded
  to the next function, so the window is the whole builder and cannot
  under-read again.
- saveState() already returns a STRING. JSON.stringify-ing it again escapes
  every quote and makes field-presence assertions read false.
- The Bull's CANNON does not own infantry (the v52 split); the hull flamer does,
  at rg 2.6. A grunt parked at cannon range is a target the Bull ignores, so a
  fixture that puts one there cannot test whether the Bull is holding fire.
- splash() skips allied entities outright. Any ability specified to hurt
  friendlies needs its own sweep; that skip is load-bearing for every other
  caller and must not be parameterised away.

## v79 note: EVERY pinned trail moved, and 18 of 19 sims were untouched

v79 is the first release where the hash moved everywhere while almost nothing
behaved differently, so the distinction is worth keeping written down.

There are two independent reasons a trail hash can move:
  1. hashState WIDENED. v79 added calmT to every unit and upT to every building,
     so the VALUE changes in every fixture whether or not anything behaved
     differently. Bookkeeping.
  2. BEHAVIOUR changed, wherever a Green exclusive is on the field.

recut_v79.js separated them by also cutting a V78-SHAPED hash - v78's hashState
transcribed, six fields short - and checking it against the baselines the tails
still carried. Result: 18 of 19 fixtures reproduced the v78 baseline EXACTLY, so
their sim is provably untouched; exactly one (livingroom:dm:hard:blue:3:441004)
genuinely diverged, and it is one of the three AI fixtures that builds mortars.

Transcribing a function is normally the thing to avoid. It was safe here because
the duplicate is SELF-VALIDATING: a mistranscription cannot reproduce 20+
checkpoints of the old baseline by accident. It was a one-shot and is not in
this tar.

THE PART THAT MATTERS FOR THE NEXT RELEASE. No pinned fixture anywhere fields a
Sarge or a Radar Tent, none ever runs a toggle, and two of the three fixtures
that DO build mortars still did not diverge (a tube needs two consecutive shells
on one target before Walking Fire moves a number, and 1800 ticks was not enough).
So the trail tables carry almost NO evidence about v79. tail_v79.js is where the
release is actually tested. Expect the same shape at v80/v81/v82: the ability
phases will move every trail and prove nothing by doing so.

## v79 note: the AI break-even was wrong, and measuring it is what showed it

The bot's "On Me!" policy shipped its first cut as "two allied infantry in
radius is the break-even". That was reasoning, not arithmetic, and it was wrong.
Sarge gives up 7.20 DPS while broadcasting; a grunt gains 0.91, so the real
figure is EIGHT grunts - or 3 gunners, or 3 flamers, because it depends entirely
on who is standing there. A fixed count cannot express that, so the policy now
compares unitDPS on both sides directly.

MEASURED CONSEQUENCE, shipped deliberately: a CPU Sarge now broadcasts 0% of the
time across 12 spectate matches, down from 2.2% under the wrong rule. Bots hold a
mean of 1.15 infantry inside 3 tiles and never reach the bar. The bot is
correctly declining a losing trade - the toggle is a human-micro tool as
specified. Approved to ship this way; it is a balance question (SARGE_SELF) or an
AI-clustering question, not a bug. The Radar Tent policy is healthy by contrast:
13 uplink fires, live 18.4% of radar uptime.

## v79 trap: four-dash section comments are FILE MAP banners

Already written down before v79 and it bit anyway, so it is repeated here at the
top: a comment opened with FOUR or more dashes around a title is read as a FILE
MAP banner by T41.F, and T49.D additionally rejects any banner title carrying a
vNN prefix in EITHER the three- or four-dash form. Eleven v79 comments tripped
the first and two tripped the second. Ordinary section comments take THREE
dashes and no version prefix; the version goes in the body prose.

## v79 trap: veterancy heals, so a passive-regen fixture measures noise

vetRankUp GRANTS HP on a rank-up. A fixture that parks a unit on the map and
watches its HP is therefore measuring wildlife kills as well as the passive under
test, which read exactly like a regen firing early. Worse, roach dens REGENERATE,
so clearing G.neutrals once is not enough, and clearing it at the top of each
tick is still not enough because updateNeutrals runs INSIDE the same update() and
can spawn a roach that reaches the unit before the next sweep. tail_v79's
quiet79() pins the dens DEAD (ns.dead / ns.alive=0 / nest structure hp=0) rather
than sweeping their output. Use it for anything that measures HP over time.

## v76 note: strikes lost their clock in every snapshot, since v30
`SNAP_ENT_SKIP` drops the key `t` because on a unit or building `t` is the TYPE
row, rebuilt from `key` on load. Strikes share the generic encoder, but a
strike's `t` is elapsed seconds. It was dropped, came back `undefined`, went NaN
on the next `s.t+=dt`, and every branch keyed on it stalled: the laser front, the
napalm bomblet cadence and burn expiry, and the new barrage schedule. `hashState`
hashes `s.t`, so a match saved (or a client resynced) mid-strike diverged from
tick zero. Confirmed on the v75 build for laser and napalm alike, so it is not a
v76 regression; fixed at v76 because the barrage inherits it. `_encStrike` now
restores the field explicitly rather than removing it from the skip set, which
would put a whole type table into every serialized unit. `T51.G` pins all four
call-downs plus the pre-v76-save path.

## v82 note: tail_v82 rides segment 3, and the check count

Segment 3 carries tail_v82 alongside tail_v79, tail_v80 and tail_v81. No further
split was needed: segment 3 finishes inside one container call at v82 pace. The
five segments at v82 run 2331 / 618 / 175 / 366 / 1471 = 4961 checks, 0 failures.

## v79 note: tail_v79 rides segment 3

tail_v79.js is 232 checks and joins segment 3, which lands at 1295 and still
fits one container call. It needs no helper prepend of its own: it is already
downstream of tail_v44 (arena44) and tail_v47 (host47) in that segment, and it
defines its own fixtures rather than borrowing either.

## v75 note: three segments, not two
The v73 halves stopped fitting at v75: segment 2 overran a single container call
outright. `seg.sh` now cuts the suite into thirds - 1 is unchanged, and the old
segment 2 is split at tail_v63 / tail_v64. Segments 2 AND 3 both need the shared
preamble plus `tail_v44.js` (for `arena44()`) and `tail_v47.js` (for `host47()`).
`tail_v47.js` must NOT be prepended to a segment that already contains it: it
declares with `const` and redeclaration throws, which is why it appears in 2 and 3
but never in 1. Counts at v75: 2329 / 904 / 982. At v76: 2331 / 904 / 1110.

## v75 note: the layout baselines did NOT move, and that is the point again
v75 is veterancy rungs, an AI army ceiling read off `supCap`, and a two-sided
harvest servo. It touches no prop, no hazard, no node and nothing that writes
`M.pass`, so map generation is bit-identical. All three layout tables passed
UNEDITED through the pre-repin run and `repin_v75.py` deliberately does not carry
them. v67 and v74 remain the ONLY two documented exceptions to the standing rule.

## v68 note: the layout baselines did NOT move, and that is the point
v67 was the exception that proved the rule - it touched map generation, so its 42
layout hashes had to be recut. v68 touches none: it is pathing, steering and
separation only. All 42 layout hashes passed UNEDITED through the pre-repin run,
which is exactly the evidence the standing rule exists to produce - this release's
divergence is confined to the sim. Only the five trail tables moved.

## v68 note: the suite no longer fits one container call
At ~500s the standard suite exceeds a single tool invocation in a fresh container.
`./run.sh` is unchanged and still correct end to end; if you need it segmented,
note that the tails are NOT fully independent - `tail_tests.js` defines the shared
preamble (`ok`, `section`, `DT`, `cfg`, `run`, `boundsOK`, `T_MAPS` and friends) and
`tail_v58.js` reads `host47()` out of `tail_v47.js`. A segmented run must supply
those or it will throw rather than quietly under-count. Segmenting faithfully
reproduces the single-run total, which is how the v68 count was confirmed.

## v68 note: the sim is ~24% slower, deliberately
The clearance term in A* means added step costs, which loosens the heuristic and
expands more nodes. Measured 3756ms -> 4661ms per 100 sim-seconds headless. The
cheaper penalty ladder (0.8/0.25) recovers most of the time but gives back most of
the benefit - trucks blocked near a node went 1.45% at the shipped 1.5/0.5 against
2.44% at 0.8/0.25 - so the shipped ladder was kept. In absolute terms pathfinding is
~21 calls per sim-second at ~0.54ms, about 1.2% of a wall-clock second.

## v68 note: recut_v68.js honours each tail's FACTION
(recut_v68.js and repin_v68.py are BOTH spent one-shots and ship outside this tar,
as records. The lesson below is the part worth keeping.)
Three of the trail tables use the same seven map/mode/seed combos and the same
900/2400-tick sampling, which makes them look interchangeable. They are not:
`cfg43` and `cfg62` boot **tan**, `cfg49` boots **green**. Two of the tables were
byte-equal only because two of the cfgs agreed. Recutting all three from one run
silently repins T23.A and T41.A onto the wrong army's match, which is exactly what
happened on the first pass at v68 and was caught by the post-repin run. recut_v68.js
now runs each table from its own cfg and asserts both the equality that should hold
(the two tan tables) and the inequality that must (tan vs green).

## Contents

v82 adds tail_v82.js (T56). recut_v82.js and repin_v82.py are one-shot records
that ship beside the release and are NOT carried forward in this bundle, per the
standing rule; probe_v82_chin2.js, probe_v82_audit.js, probe_v82_bike2.js,
probe_v82_calldown.js and probe_v82_od.js are the scoping probes behind the v82
notes above and are likewise records rather than harness machinery.
- run.sh         harness runner: ./run.sh [standard|mini|full|render <tail>]
- tail_v79.js    T53, the v79 Green ability release. Sections A-H: Sarge's regen and
                 broadcast, the mortar's Walking Fire and Smoke Rounds, the Radar
                 Tent's Target Uplink, the six new hashed fields round-tripping, the
                 AI policy, and the derivation lint. Carries quiet79() / run79(),
                 which any future fixture measuring HP over time should reuse - see
                 the veterancy trap note above.
- tail_v81.js    T55, the v81 Gray ability release. Sections A-H: the tunables and
                 their help slots, Camouflaged across its six sim doors and one
                 client door, Called Shot, Shell Shock, Ripple Fire's salvo doors,
                 the Bunker's named passive and Lockdown, the AI policy, and the
                 state hygiene lint. Carries quiet81(), the arena fixture the Gray
                 checks share.
- tails.txt      the ONE tail load order list, read by run.sh
- pw.html        the v79 game file
- game.js        the extracted script body of pw.html (regenerate after any splice)
- shim_head.js   universal DOM/canvas Proxy shim (live firstChild, real remove(), navigator defineProperty, bare global listeners; AudioContext/speechSynthesis intentionally absent, the game's guards handle it)
                 THREE KNOWN ASYMMETRIES, each of which has cost a run: querySelectorAll
                 EXISTS but returns [] unconditionally; classList is a Set fully
                 independent of className; innerHTML is a plain property, so setting it
                 to '' detaches nothing and children accumulate. A fixture that measures
                 DOM contents must detach them itself and must not assume the two class
                 surfaces agree.
- measure_v68.js not a tail: the MOVEMENT probe, added at v68. Wraps moveAlong and
                 creatureStep so a "movement tick" is exactly a tick on which the game
                 asked a mover to advance, and reports blocked-step rates by unit
                 radius, by unit key, for trucks near their own node, and for wildlife.
                 This is the probe that scoped v68; re-run it before touching steering.
- measure_v63.js not a tail: the FACTION probe, added at v63. Boots all-CPU watch
                 matches and reports, per faction, the sim-second each exclusive unlock
                 completed, the exclusive share of the late-game army AND of everything
                 built, and the number of the faction's own structure left standing.
                 This is the probe the v63 scope was measured against.
                     cat shim_head.js game.js measure_v63.js > m.js
                     TICKS=18000 SEEDS=901,902,903 node m.js
                 MAPS / TICKS / SEEDS / DIFF are env overrides.
- measure_v60.js not a tail: the composition probe. Boots all-CPU watch matches and
                 reports the fighting army by CLASS and by KEY over a late-game window, plus
                 helipad/first-aircraft timings and per-profile banks.
                     cat shim_head.js game.js measure_v60.js > m.js
                     TICKS=18000 SEEDS=901 node m.js
                 MAPS / TICKS / SEEDS / DIFF are env overrides.
- splice_v75.py  the CURRENT release's splice, as a reference copy
- seg.sh         the THREE-segment runner (v75: the halves no longer fit either)
- preamble.js    tail_tests.js lines 6-26, the shared fixture preamble, for segments 2 and 3
- fixup_v75.py   spent one-shot: the four v75 fixture repairs, kept for its header
- measure_v75.js A/B probe for the v75 systems: supply reached, army size and value,
                 production idle share, the plastic/battery split of DELIVERED tonnage
                 (wrapped on meterDrop, which is exact and needs no sampling), the
                 veterancy distribution and whether the match resolved.
                     cat shim_head.js game.js measure_v75.js > m.js
                     TICKS=12000 SEEDS=901 node m.js
                 MAPS / TICKS / SEEDS are env overrides. Concatenate it with a v74
                 game.js to get the other arm of the comparison.
- measure_v75b.js replicates tail_v63's T42.H census (same two seeds, same map, same
                 400-second horizon) so a change that competes with the AI's building
                 wish list can be checked without paying for a full segment run.
- browser_check_v73.js  real-Chromium HUD geometry gate (v73). Nothing headless can
                 answer whether the minimap lands in the corner: the shim has no layout
                 engine, getBoundingClientRect is a stub and offsetHeight does not exist.
- verify_v58.py  static structural check on the setup-screen backdrop markup
- browser_check.js / browser_check_match.js / probe.js / scope.js / shot.js
                 optional real-Chromium checks; pulled through npm, not run by run.sh
- tail_tests.js  T1 boot every map x mode; T2 determinism dual-run hash trails; T3 save/load bit-identical resume; T4 medium soak with AI-activity assertions
- tail_expo.js   T5 v25 expansion layout invariants across 3 seeds per map (natural per start at 10.5-17.3 tiles interior-ward, 4 guarded mid sites on cardinal lanes, plastic+battery pair within 2.6 of each centre, pockets with 18+ open tiles and a 3x3 buildable square)
- tail_v26.js    T6 v26 behavior: ghost-store lifecycle (last-seen freeze, destroyed-while-fogged persistence, re-scout cleanup), deferred terrain decals, vision-gated shake, AI retaliation rules (target switch / throttle / range / scout & human exemptions), projectile cls+cal tags, render smoke tests with ghosts and fogged munitions in frame
- tail_v27.js    T7 v27 UI features
- tail_v27_1.js  T8 v27.1 fixes (ghost render safety, mine retaliation, tracers, audio, blips v2)
- tail_v28.js    T9 v28 cleanup invariants + cross-version layout equality vs v27.1
- tail_v29.js    T10 v29 queues/patrol/hold/veterancy/sell/teams/stat-history suite
- tail_v30.js    T11 v30 rescale/Apache/Huey/APC/radio-tower/paratrooper suite
- tail_v30_1.js  T12 v30.1 bugfix suite (APC render fallback, ghost-node index alignment + gone-ghost lifecycle, radio cooldown recovery, position-resolved queued harvests)
- tail_v32.js    T13 v32 placement overhaul: proximity auras (HQ 10 / Outpost 4, centre-to-centre via dhyp), enemy-HQ 10-tile exclusion ring (team-ally exempt, in-progress counts), barricades now aura-bound, HQ+Outpost anywhere-with-vision, instrumented AI soak (every placement legal at call time), aura-ring render smoke
- tail_v33.js    T14 v33 wave survival: central cluster + white-flag + arena + starter-economy invariants across maps x ally-counts, CREATURE table (renamed bee, 4 new species, rescale + custom fields), wave scheduler & composition (mouse counts fixed, others x diff.army x jitter), roach/mouse frontal cleave, fire-ant burn DoT, win/lose + checkEnd guard, AI-leash + live-wave combat soak, determinism dual-run + save/load with a wave airborne
- tail_v34.js    T15 v34 survival tuning + fixes: tower/bunker wildlife targeting, wave-table ratio locks, solo (1-player) boot across maps, edge-spawn perimeter/determinism, starter plastic 2340 / battery 1400, solo dual-run + save/load with the loadState re-carve pinned by a nest-count check
- tail_v35.js    T16 v35 The Desk (survival-only map): survOnly registry gate + T_MAPS exclusion; curated economy at 1/2/4 players (centre ring of (players+1) plastic + (players+1) batteries inside the arena, plus one exposed plastic+battery pair ~45% toward each of the 4 corners); spilled-soda re-skin of sand (fld code 2: slows 0.5x, does not block, inherits every code-2 rule) + impassable water (code 3); wave spawn/combat; determinism dual-run + save/load bit-identical (rebuilt Desk economy on load)
- tail_v36.js    T17 v36 bug fixes + rebalance: splash() now damages neutral creatures/wildlife (B1); blockLine() lays a solid gap-free 4-connected wall over the full drawn extent, sealing a diagonal flood (B2); creatures (nest+wave, all modes) route around geometry via findPath + wall-slide/perp-nudge/wedge-hop recovery, only invoking A* when a straight step is blocked (B3); +20% hp/DPS on ant/bee/fireant/wasp/roach with fireant burn 5->6, mouse untouched (D1); wave table +20% round with mice fixed (D2); Desk corner pairs 45%->70% out and +20% richer (D3); Desk clutter 50% more + 1.5x bigger via optional prop.sc, other maps byte-identical (A1/A2); creature-pathfinding determinism dual-run + save/load resume with non-serialized path fields
- tail_v37.js    T18 v37 balance + bigger models: Desk resource piles +50% (Desk-only: centre ring 3510/2100, corner pairs 3240/2340; non-desk starters untouched); wave table +20% INCLUDING mice (2/4/4/4/8 -> 2/5/5/5/10); ant/bee/fireant/wasp/roach +20% hp & DPS across all maps/modes with fireant burn 6->7.2, mouse untouched; mouse model 4x + roach model 2x (visual only — drawBug scales body+shadow, render smoke + movement sanity confirm gameplay is unchanged)
- tail_v39.js    T19 v39 player-count wave scaling (waves scale with the number of defenders)
- tail_v40.js    T20 v40 miscellaneous pass: resource piles are left-click selectable when IN VISION
- tail_v41.js    T21 v41 tank turret decoupling: for a==='tank' (Tank + Bull) the hull keeps its
- tail_v42.js    T22 v42 misc balance + medics: KOTH victory 75 -> 150 s; paratrooper -25% hp &
- tail_v43.js    T23 v43 cleanup & foundation pass: 7 map/mode hash trails and 15 map/seed
- tail_v44.js    T24 v44 medic station keeping (also owns BASE45_AI, the pinned AI-only trails)
- tail_v44_1.js  T25 v44.1 an order issued to a medic on its own overrides station keeping
- tail_v45.js    T26 v45 unit counter matrix: an 8x7 weapon-class x armor-class table replacing the
- tail_v46.js    T27 v46 the Chinook: the Gunship is gone from all eight registries and the
- tail_v47.js    T28 v47 the shared live lobby: snapshot shape (four slots, sid order, host
- tail_v48.js    T29 v48 the AI overhaul: aiPickUnit/aiFoeArmorMix exist, are pure functions
- tail_v49.js    T30 v49 the black-building fix + tank turret portraits: 7 hash trails pinned
- tail_v50.js    T31 v50 testing mode: the setup-screen sandbox toggle (SETUP.test -> G.test).
- tail_v51.js    T32 v51 the AA Missile Truck, the Bull's hull flamethrower and two
- tail_v52.js    T33 v52 the Bull's cannon and flamer own DIFFERENT target classes:
- tail_v53.js    T34 v53 linear splash falloff and every splash radius +25%: the
- tail_v54.js    T35 v54 supply economy, the Depot Yard and flame density: the
- render_tail_v54.js    real-canvas gate for v54: the Depot Yard hull rasterizes for
- render_tail_v51.js    real-canvas gate for the AA truck: the baked hull carries NO
- render_tail_v49.js    real-canvas PIXEL gate for the v49 fix: rasterizes every building x
- render_tail_v32.js    optional real-canvas aura-ring pixel checks: cat shim_head.js game.js render_tail_v32.js > rc.js && node rc.js
- render_tail_v33.js    optional real-canvas checks: every new wave creature + the white defend flag rasterize, mouse boss HP bar renders, full render() with a wave in frame is clean: cat shim_head.js game.js render_tail_v33.js > rc.js && node rc.js
- tail_v55.js    T36 v55 SPECTATE MODE: a local match with four bots and no
- tail_v56.js    T37 v56 SPECTATOR SPEED (0.75x/1x/1.25x/1.5x/2x, watch matches
- tail_v57.js    T38 v57 PW2 CODES, ONE LOBBY CODE, ONE REPLY BOX. The codec is
- tail_minisoak.js  reduced 4-combo x 3600-tick soak (v30 shipping gate)
- tail_soak.js   full matrix: 4 maps x 3 modes x 3 difficulties x cycled factions, 3600 ticks each
- tail_end.js    summary + exit code (nonzero on any failure)
- tail_v27.js adds T7: minimap attack blips, minimap size cycling, selection
- tail_v27_1.js adds T8: ghost-building render safety (snapBld freezes tface/
- tail_v33.js: two assertions retuned for the rebalance - wave-1 count window is now
- tail_v40's salvage source check and tail_v42's four build-zone source checks now
- tail_v59.js    T39 v59 AI army composition: the helipad unlock for every faction, the
                 survivability term in aiPickUnit, the wish-list fallthrough, per-profile
                 mixWant with a +-10% per-match roll, renormalization over buildable classes
- tail_v60.js    T31 v60 AI unit diversity: AI_EXPLORE / AI_SAT_A / AI_RICH_P, aiKeyShare,
                 the weighted draw over squared scores in place of argmax + jitter, the
                 second barracks/garage for a plastic-rich bot, balanced gets armyTilt heavy
- tail_v61.js    T40 v61 economy: per-resource truck loads (plastic 45 / battery 23), a node
                 paying exactly what it delivers, SUP_CAP 80, BUILD_GAP building spacing,
                 the findNode glut term, aiFindSpot rings 5-14
- tail_v62.js    T41 v62 cleanup: hash trails + layouts byte-identical to v61, the dead
- tail_v63.js    T42 v63 faction identity: the AI_FAC_FLOOR quota and its two readers (aiFacShare / aiBldHasFac, blind to support units, riders and corpses, so Blue's Chinook cannot satisfy a fighting-army floor on its own); the aiPickUnit pool narrowing and that it switches off above the floor and on pools with no exclusive in them; the production stand-down exemption (the reason Gray's artillery read zero in 16 of 20 logged v62 games); the wait-and-bank behaviour with its half-price reach guard, plus the expansion-surcharge waiver; research order (exclusives ahead of the Tank, cheaper of the pair first, own structure leading the structure group, no foreign exclusives leaking in); the wish list (bunker and turbine scale to a pair and a rich third and are exempt from the power gate, radar and dump deliberately do not); Gray's Rocket Artillery splash 1.875 -> 2.8125 pinned AND landed in the sim via an annulus target the old radius could not reach, with friendly fire re-checked at the larger radius. Sections B, C and H each carry a mutation arm that stubs aiFacShare to always report "at quota", so no green can come from a match that would have built exclusives anyway.
- tail_v64.js    T43 v64 audio synthesis rewrite. This is the first tail in the harness that
                 exercises the audio engine AT ALL: the shim leaves AudioContext undefined on
                 purpose, so up to v63 every sfx function early-returned at `!ac()` and the only
                 coverage anywhere was T8.4's three audAt2 checks. T43 installs a RECORDING mock
                 AudioContext, drives the real game code through it, and asserts on the node graph
                 that comes out: which nodes were created, their types, their frequency automation,
                 their envelope breakpoints, their start/stop times and what they connect to.
                 Nothing here is a source-text assertion, for the same reason those are useless on
                 painters (the comments name the functions under test, so a grep for `psweep`
                 passes whether or not psweep is ever reached). Sections: A the recorder itself;
                 B the four new primitives (pimp is a genuine sub-25 ms transient, psweep really
                 does automate a falling cutoff and pnoise really does not, the pink buffer really
                 is 1/f, pgrain scatters front-loaded); C eight distinct gun voices plus gunKind
                 routing from real units; D six launch voices; E four explosion TOPOLOGIES with
                 monotonic duration and low-frequency energy, the 28 Hz floor, and the delayed
                 ground reflection (small has none, huge has two); F the five-stage collapse and
                 the three death voices that replaced one generic tick; G the distance/zoom
                 absorption model; H humanisation; I the three polyphony guards, each primed and
                 tested in isolation; J determinism; K the bus rework, the duck and the fog gate;
                 L eleven vehicle and eleven building selection voices; M the headline.
                 Because every primitive jitters frequency by +/-6%, a string fingerprint would
                 report all 24 combat sounds as distinct for free, so distinctness is a RATIO
                 relation instead: two captures are the same voice when their frequency vectors
                 have equal shape and every entry is within 13%. T43.C proves both directions of
                 that relation, and H, I, J and M each carry a mutation arm: pure:1 must switch the
                 jitter off, one srand draw must move hashState, and the v63 recipes rebuilt through
                 the same recorder must COLLIDE where the v64 ones do not (v63 gave six weapons
                 literally one voice, and sized its four explosions by scaling one recipe).
                 tracer path gone at both ends, paintIsoTile / researchBtn / lobSetRosBlock
                 factorings pinned functionally, the FILE MAP coverage lint, dead markup

- tail_v65.js    T44 v65 menu legibility / placement / economy / spin: the setup scrim
                 lightened at every stop with the controls carrying their own contrast,
                 BUILD_GAP 2 -> 1 and the outpost zone 5 -> 6 (both measured through
                 placeDeny, the zone as a FLIP SET so the HQ's own zone cannot inflate
                 the reading), the +15% electricity pass over all 21 ce>0 entries with a
                 ce:0 guard mutation arm, the Grunt at 36 with every other plastic cost
                 pinned, and both halves of the spin fix: nest wildlife driven through the
                 real updateNeutrals with the OLD rule replayed over the same wob
                 trajectory as the mutation arm, and the field manual holding its pose
                 while the rotor and the gun sweep still turn
- tail_v66.js    T45 v66 the map rework: field code 1 (tall grass) is extinct - no
                 producer, no consumer, no tile on any map, with a mutation arm on the
                 scan; the themed hazard pair per map (backyard thorns/puddle, kitchen
                 grease/milk, living room glue/juice, sandbox sand/water, desk
                 soda/coffee) checked for kind, code and stamped grid; the painters
                 proven REACHED through a recording context rather than a source grep,
                 including that no map paints another map's palette and that the deleted
                 grass painter is never reached; the pond-shrink filter tested BY CODE
                 (the v65 name test let drained milk/juice/coffee keep a drawn footprint
                 over dry ground) with a thinness metric shown able to fail; barricade
                 totals and lane share; a hazard on every adjacent-corner lane; six-pair
                 start reachability and no walled-off node over 32 maps; a mirrored roach
                 pair on every map including the Desk; nest regen refilling losses only,
                 stopping at count, never reviving a smashed den, with the dens under
                 test pinned unbreakable and their creatures swept each tick so `alive`
                 can move only by the rule being measured; CPU den engagement with all
                 three negative cases (dormant den, out of reach, player-owned unit); and
                 the statelessness claim - the nest snapshot row unchanged, a
                 regen-crossing run deterministic, and save/load resuming across a refill
                 tick on the identical trail
- render_tail_v66.js   real-canvas gate for the v66 painters: T45.C proves each branch is
                 reached, this proves the pixels land. Samples each hazard's footprint on a
                 real 2D context for opacity, near-black fraction, difference from clean
                 ground, and difference from the map's other hazard; then checks that the
                 three liquids sharing the pond painter and the four burn hazards sharing
                 the goo painter do not collapse onto each other. Picks the largest
                 UNOBSTRUCTED field of a kind: the Living Room's biggest juice pool has a
                 glue spill across it and reads as glue's near-white, which would be a
                 false failure now and a false pass the day a palette really did collapse
- tail_v67.js    T46 v67 hazard declutter + landmine distribution
- tail_v68.js    T47 v68 movement robustness: the clearance term in A*, depenetration,
                 and truck docking. Scoped against measure_v68.js; re-run that probe
                 before touching steering again
- tail_v69.js    T48 v69 the economy binds where it should: the supply ladder and the
                 cliff it removes, the Gunner entrench rate, the AI bank-pressure term
                 on armyCap, and the deathmatch clock
- tail_v75.js    T52 v75 per-class veterancy rungs, an AI army ceiling read off supCap,
                 and the two-sided resource servo. A walks BOTH ladders and proves the
                 choice comes off the unit type, with every trainable unit resolving to
                 exactly one of the two frozen arrays. B pins the derivation (AI_SUP_UNIT
                 recomputed from the roster and compared), that the match clock is gone,
                 monotonicity in supCap, both clamps, the LIVE support reserve (fielding
                 medics costs ceiling and killing them gives it back), and the real gate.
                 C is the servo: sign, normalisation, closed range, relative scale, and
                 the same both-ends claim T40.H makes, driven through findNode. D asserts
                 the three retired thresholds are gone AS EXPRESSIONS, not as words - a
                 /lean/ test passes v74 and fails v75 for the wrong reason, because the
                 prose still says "lean" while explaining what replaced it. E is the sim
                 boundary and the v74 save round-trip.
- tail_v74.js    T51 v74 the team-coloured production bar and prop collision matched to
                 art. Colour AS SEEN is out of scope (the shim rasterizes nothing); what
                 is pinned is that the chip stops using the stylesheet's green and takes
                 the owning player's, plus PROP_BLK's shape, propBlkR's scaling rule, the
                 blockLine cliff and the resulting footprints.
- tail_v73.js    T50 v73 HUD relayout, the HQ shortcut, the Gunner's reload and build-menu
                 hotkeys. Sections A and B stay strictly inside what the game COMPUTES
                 (the reserves applyMMSize writes and that they track the size cycle) and
                 leave geometry to browser_check_v73.js, which says so in both files.
                 C pins the -15% in both directions with the four downstream facts. D owns
                 the hotkey alphabet, the EXACT fit against the widest menu, the rebuild
                 and the gate. E is the empty-selection signature. F is the sim boundary.
- tail_v72.js    T49 v72 cleanup invariants: the retired Construct panel is gone at
                 every end and what replaced it works, penv is the one envelope for all
                 three synth primitives (proven by wrapping the binding, not by grep),
                 the ten-tick UI pump drives five live panels and no dead sixth, no
                 banner title carries a version prefix in EITHER dash form, and the
                 snapshot tag tracks the build again

## Release ledger, v26 to v54
Full notes for these lived here until v62 and were dropped: they described builds
that no longer exist, and each release's reasoning is preserved verbatim in its own
`splice_vNN.py` docstring, which you hold as a delivered artifact. What is kept is
the index, so a search knows which version to go looking in.

- **v26**
- **v27**
- **v27.1**
- **v28** cleanup & organization pass
- **v29** features
- **v30**
- **v30.1** bugfix pass; no makeMap changes, all seeds/layouts preserved
- **v32**
- **v33**
- **v34**
- **v35** "The Desk", a Wave-Survival-only map
- **v36**
- **v37**
- **v38**
- **v39**
- **v40**
- **v41**
- **v43** cleanup & organization pass; NO gameplay change
- **v44** medic truck station keeping
- **v44.1** bugfix: an issued order outranks station keeping
- **v45** unit counter matrix
- **v46** the Chinook, generated counter text, the Field Manual in a match
- **v47** the shared live lobby: roster, ready-up, chat
- **v48** the AI overhaul: every unit in the toolbox
- **v49** black-building fix + tank turret portraits) — COSMETIC ONLY
- **v50** testing mode) — NO CHANGE TO A NORMAL MATCH
- **v51** the AA Missile Truck, the Bull's second weapon, two rebalance cells
- **v52** the Bull's two weapons split the target list; +15% cost
- **v53** linear splash falloff; every splash radius +25%
- **v54** supply economy, the Depot Yard, denser flame

## v55 notes
- Snapshot tag is now `v:55` and `watch` rides beside `test`; a pre-v55 save has
  no such key and loads as a normal match.
- NO REPIN. v55 is purely additive and every branch is gated on `G.watch`, so the
  whole pinned-trail estate passes unedited. If a future release finds itself
  needing a repin for a watch-only change, something has leaked out of the gate.
- Verification run at v55 was REDUCED by request: node --check, the static splice
  assertions, tail_v55.js and the full standard suite (2652 checks, 0 failures,
  ~165s). The mini/full soaks and every real-canvas tail were NOT run.
- `G.meter` is client-local income telemetry (never hashed, never serialized,
  rebuilt on load) in the same family as `G.atkPings` and the ghost store. It is
  fed by ONE gated line in the truck drop-off, so a normal match never allocates
  it. `G.watchHide` is client-local too.
- The mining figure is what the TRUCKS delivered. Generator/turbine output is a
  separate `+n` term because it is income but not mining, and the AI's difficulty
  eco trickle (`1.5*eco` plastic, `0.45*eco` energy per AI tick) is deliberately
  excluded from both - a bot's resources will therefore climb faster than its
  reported mining rate, which is correct, not a bug.
- Spectate and testing mode are mutually exclusive at the setup screen: one hands
  you every army, the other hands you none.
- Known-blind, same as v50's note on refreshTeamRow: the setup-screen wiring
  (`[data-watch]` handlers, the relabelled slot chips, the hidden count row) is
  querySelectorAll-driven and the shim returns [], so it is covered by source lint
  only. The forcing of the army count is NOT in that blind spot - it lives in
  newGame and is tested there.

## v56 notes
- Snapshot tag is now `v:56`. Nothing new is serialized; the bump is the usual
  monotonic increment. Tail files now assert the tag as a FLOOR (`>=`) rather than
  an exact figure - the exact bump is pinned by each release's splice script, so a
  tag bump no longer breaks the previous release's tail (it broke tail_v55's
  `S.v===55` on the first v56 run).
- The speed multiplier is applied AFTER the 100ms frame-delta clamp, so catch-up
  stays bounded at 6 steps per frame even at 2x. If that ordering is ever
  reversed, a slow frame at 2x can bank arbitrary work; splice_v56.py asserts the
  ordering statically because no runtime test in the suite would notice.
- `G.wspeed` is client-local like `G.watchHide` and `G.meter`: never hashed, never
  serialized, reset to 1x by watchInit on every boot. It is read by exactly five
  code sites, which splice_v56.py counts.
- The speed chips live inside the spectator box, so V hides them too; `[` and `]`
  are the always-live path and each change prints a msg() so the feedback survives
  a hidden box.
- Verification run at v56 was MINIMUM by request: node --check, the static splice
  assertions, tail_v56.js and one standard-suite run (2691 checks, 0 failures,
  ~110s), plus three mutations. No soaks, no render tails.

## v57 notes (short codes, one lobby code, one reply box)
- Snapshot tag is now `v:57`. Nothing new is serialized: lobby ids, seat picks,
  offer blobs and the codes themselves are setup-screen state that is gone by the
  time `newGame` runs. splice_v57.py asserts textually that neither `hashState`
  nor `saveState` can see any of it, and T38.H proves the same seed still opens on
  the same hash and runs the same 60-tick trail.
- THE CODES. v56 shipped an SDP as base64(JSON): the 32-byte fingerprint written
  out as 64 ASCII hex characters, addresses and mDNS UUIDs as quoted strings, the
  whole thing then inflated 4/3. PW2 writes the same facts as bytes. Measured on
  the shipped build, against an SDP shaped like Chrome's default output:

      one open seat    398 -> 131      three open seats   1194 (3 codes) -> 374 (1)
      two open seats   796 -> 252      reply              398 -> 131 (106 lean)

  A three-seat lobby code is shorter than a single v56 invite was.
- THE FLOOR IS REAL. What must travel is a 32-byte DTLS fingerprint, ~29 bytes of
  ICE credentials and at least one candidate: ~90 bytes, ~120 base64 characters.
  Nothing gets this to a six-character room code without a rendezvous server, and
  the fingerprint cannot be truncated - it is matched against the peer's actual
  certificate, so a short one simply fails to connect. Mutation M13 truncates it
  to 16 bytes and fails 40 checks.
- THE REPLY CANNOT GO AWAY, and this is worth writing down so it is not
  re-litigated: each side has to learn the other's fingerprint and ICE
  credentials, and a freshly loaded page has credentials nobody can predict or
  cache. With no server in the middle, leg two is hand-carried. v57 makes it one
  paste in each direction instead of four clicks and two manual text selections.
- ONE CODE, MANY SEATS. Every open seat's offer is bundled into a single
  seat-tagged code, so the host copies once into a group chat instead of sending
  three friends three different codes. The envelope carries a 16-bit lobby id, so
  a reply from a different lobby is refused rather than mis-seated, and each blob
  is self-delimiting so the bundle needs no length table.
- ONE PASTE BOX. A reply names its lobby and its seat, so `lobTakeReply` routes it
  without being told which slot it belongs to, and connects with no button. It
  refuses six specific ways: unreadable, a lobby code pasted into the reply box, a
  foreign lobby id (with both ids named), a slot that is not open, a seat that is
  already taken, and a seat whose invite is no longer live. One attempt per
  distinct paste, so a keystroke does not spam the status line.
- The slot rows now hold NO text boxes. That kills the v47 hazard T28.K was
  written for - a settings click re-rendering the rows underneath a half-pasted
  reply - because the box the paste sits in is above them and lobRenderSlots
  cannot reach it. repin_v57.py rewrites T28.K to pin the new shape.
- CANDIDATE POLICY. At most 3 candidates travel, one per family, reflexive first.
  A laptop with six interfaces used to write six candidate lines into every code
  and the extras never won a check. mDNS host candidates ARE kept (Chrome resolves
  a peer's .local name on the same LAN, so dropping them would break same-Wi-Fi
  play), packed as the UUID's own 16 bytes rather than 42 characters of text.
- A v56 code is refused by name. Both players must be on the same file anyway -
  a mixed-build match would desync on the first tick - so `pw2Read` says the code
  came from an older build rather than connecting and failing mysteriously later.
- `lobRefresh` repaints the code box on every state change, so the advertised
  seats always match the seated players; a seat that fills drops out of the code
  and a peer that drops takes its spent offer with it.
- Verification at v57: node --check; the 21 static splice assertions; the standard
  suite (2769 checks, 0 failures); the mini soak gate (2785, 0); and 14 mutations,
  every one failing cleanly and specifically. No render tails - v57 draws nothing.


## v58: the menu backdrop

Two verification stages were added at v58.

### Static: `verify_v58.py`
    python3 verify_v58.py                          # 32 checks (defaults to ./pw.html)
Asserts properties of the DOCUMENT that the extracted script cannot see: that
the new chrome is scoped to `#setup` so in-match UI keeps v57 styling, that the
shared `.opt` / `.card` / `.ctog` base rules survive untouched, that no `#setup`
rule reintroduces an overflow clip, and that the MENUBG module never writes
`SPR`, never calls `bakeSprites`, and never references the sim.

### Browser: real Chromium, pulled through npm only
    npm i puppeteer-core @sparticuz/chromium
    node browser_check.js       <file.html> [png]   28 chrome/backdrop/layout checks
    node browser_check_match.js <file.html>          4 match-boot checks
    node scope.js               <file.html>          in-match controls kept v57 styling
    node probe.js               <file.html>          control geometry
    node shot.js                <file.html> <png>    screenshot

This stage exists because the squeeze bug below is invisible to every other
stage: the CSS parsed, the script ran, the canvas painted, and the buttons were
still wrong.

## Trap: #setup is an overflowing column flex box

`#setup` is `display:flex; flex-direction:column` and the menu is taller than the
window (scrollHeight ~1290 at 900px). Every DIRECT child is therefore shrinkable.
Controls inside `.srow` are grandchildren and safe; `#startBtn` and `#infoBtn`
sit directly in the column and are not.

`min-height:auto` normally stops a flex item collapsing below its content, but
that automatic minimum only applies while `overflow` is `visible`. Adding
`overflow:hidden` to clip a rounded pseudo-element silently switches it off.
Measured: START 60px -> 32px, Field Manual 40px -> 22px, labels clipped.

Two rules, both required, both pinned by verify_v58.py:
  - clip pseudo-elements with their own `border-radius`, never an overflow clip
  - `#setup > *{flex:none}`

## Trap: string assertions match prose

Two assertions fired on their own comments during v58 (`overflow:hidden` in a
CSS comment explaining why not to use it; `update()` in a JS comment saying the
module is not reachable from it). Keep the assertion strict and reword the
prose; do not loosen the check.

## v58 sprite bake

`bakeSprites` is synchronous and monolithic: 288 cells. The marching column
needs 56. The menu therefore bakes its own roster with `bakeCell` into
`MENUBG.cells` and never sets `SPR.done`, so the real pipeline still does the
full table exactly once, later, at match start or when the Field Manual opens.
`tail_v58.js` cold-starts `SPR` before asserting this, because earlier tails have
already run the real bake and the assertion would otherwise pass vacuously.

## v59 notes (AI army composition)

v58 bots fielded 78% infantry / 20% vehicles / 1% air / 1% AA, measured over 18
bots across 4 maps and 4 factions at ten minutes each. Four independent causes,
all fixed in v59:

1. `b_helipad` reached the research plan only when `FAC_AIR[fac]` was non-empty,
   which is Blue alone. Thirteen of eighteen bots could never build a helipad.
2. `aiPickUnit` scored damage-per-plastic with no durability term, which cheap
   infantry wins by 3-4x regardless of the counter matrix.
3. The building wish loop ended in an unconditional `break`, so the first
   eligible-but-unaffordable entry (guardtower, ahead of helipad) blocked the
   whole tail indefinitely.
4. Production buildings were served in `p.blds` order, i.e. build order, so the
   barracks always had first claim on plastic and drained the pool below the
   garage's affordability filter.

Plus the steering layer this all feeds: per-profile target composition
(`mixWant`), rolled +-10% once per bot per match, enforced at the
building-selection level because each building picks only from its own roster.
This release moved the sim; `repin_v59.py` recut the trails.

## v60 notes (AI unit diversity)

v59 fixed which CLASSES bots field and not which UNITS. Measured over 16 bots on
4 maps at ten minutes each, sampling the fighting army every 30s across minutes
5-10, three keys held 72.6% of every army (grunt 31.6, gunner 20.6, jeep 20.4)
and the signature pieces were absent outright: tank 1.5, bazooka 0.6, mortar 0.1,
and sniper / sarge / flamer / arty / bulltank at zero.

Research was NOT the cause. Instrumented unlock times showed every one of those
units available well inside minute 5. The bots held the roster and never bought
from it. The cause was the selection rule: `aiPickUnit` scored every option and
took the single highest with a +-10% tie-break jitter, and measured score gaps
inside one roster run 1.7x and wider, so the jitter could never reach across the
gap. Five changes, seven edits: the `AI_EXPLORE` / `AI_SAT_A` / `AI_RICH_P`
constants; `aiKeyShare()`; a saturation term and a weighted draw over the SQUARE
of each score in place of argmax-plus-jitter; the helipad moving between the two
guard towers in the wish list, with a second barracks and garage for a bot with
more plastic than it can spend; and `armyTilt:'heavy'` for the balanced profile,
which was the only one with no lean and shared the aggressive profile's garage
output as a result. Sim-moving; `repin_v60.py` recut the trails.

## v61 notes (economy rebalance, supply ceiling, building spacing)

Five changes, fourteen edits.

- **Truck loads are per resource, and a node pays exactly what it delivers.**
  Through v60 a truck carried 60 of either resource and the drop-off banked
  `cargo*TRUCK_DROP_MUL` (0.75), so a pile lost 60 to deliver 45 and every node's
  printed remaining figure overstated its real yield by a third. The multiplier
  retired to 1.0 (kept as a named knob; T36.E reads it) and the cap became a
  per-type table: plastic 45, which is exactly the v60 delivered figure, and
  battery 23, a 49% cut. The shorter plastic fill makes a round trip about 0.75s
  quicker, so plastic income rises a few percent.
- The harvest block was reordered. It read the cap before the cargo-type reset,
  which was harmless while both types shared one number and goes negative the
  moment they do not. The reset now runs first and the take is floored at zero,
  which also absorbs a v60 save whose truck is carrying 60 into a 45 cap.
- **SUP_CAP 70 -> 80.**
- **Building spacing.** `placeDeny` had no building-to-building test at all;
  overlap was caught only because `makeBuilding` zeroes `G.map.pass` under the
  footprint, so any two structures could sit flush. Every structure now needs
  `BUILD_GAP` clear tiles between its footprint and every other footprint,
  measured as a Chebyshev gap so a diagonal corner pinch is rejected too.
  Barricades are exempt from each other only. Placement-gating only: a pre-v61
  save whose base is packed tight loads and stands exactly as it was.
- **The battery lean became symmetric.** `findNode` only ever PULLED trucks
  toward batteries below 200 e and did nothing above it, so a power-rich army
  kept mining whichever pile was nearest. At or above `E_GLUT` the battery piles
  now cost `E_GLUT_PEN` extra tiles: soft, not a ban.
- `aiFindSpot` rings 2-12 became 5-14 with 24 samples per ring rather than 16,
  because the inner rings are dead ground against a 3x3 HQ under the spacing rule.

Sim-moving; `repin_v61.py` recut the trails.

## v62 notes (cleanup & organization pass; NO gameplay change)

The third of its kind after v28 and v43, and the acceptance criterion is the
inverse of a normal release: same-seed replays must NOT diverge. `tail_v62.js`
T41.A pins 7 map/mode hash trails and 15 map/seed layout hashes against baselines
captured from the v61 build before the first edit was applied. All byte-identical,
and there is no repin script for this version.

- **Dead code, removed at both ends.** `tracer()` pushed a `{t:'tr'}` particle and
  had no callers; v27.1 moved every fire path to `tracer2()`. The `'tr'` branch in
  the particle renderer was therefore unreachable too, since `tracer()` was the
  only thing in the file that could produce one. Removing an emitter without its
  renderer branch leaves a half-dead path for a future caller to resurrect, so
  both went. T41.B proves it functionally: 1800 ticks of a live match, no `'tr'`
  particle ever produced, `'tr2'` streaks still flowing.
- **Dead markup.** `#testRow` / `#watchRow` / `#netRow` were ids no CSS rule and no
  script line ever selected (the rows are styled by `.srow`, their buttons found
  by `data-` attributes), and `class="tslot"` had no rule and no handler. Four
  attributes, no behaviour.
- **Three factorings, all render or UI, none reachable from the sim.**
  `paintIsoTile(c,sx,sy,col)` absorbs the five-fill iso tile recipe that was
  byte-identical in `renderTerrain`'s tile loop and `infoGround`'s miniature
  patch, whose own comment already said it mirrored the big board.
  `researchBtn(e,key,tipTail)` absorbs the research button that `refreshSelPanel`
  built twice, identical but for the tooltip's trailing clause, which becomes the
  argument. `lobSetRosBlock(P)` absorbs the settings + roster block that
  `lobOpenHost` and `lobOpenJoin` built line-for-line the same; both locals were
  write-only in both (everything downstream finds these elements by id).
- **All three are pinned FUNCTIONALLY, not by source text.** T41.C drives
  `paintIsoTile` through a recording context and checks the five fill styles in
  order and all five polygons against `HW`/`HH`/`TH` rather than restated
  literals. A source-text assertion on a painter matches the painter's own
  comment; this does not.
- **Comment structure.** The FILE MAP had drifted to 49 of the file's 87 sections
  and out of file order besides, worse than the 22-of-70 that triggered the v43
  regeneration. It is rebuilt over every banner in true order. The orphan
  `DAMAGE / DEATH / FX` banner (it sat directly above the PARATROOPER banner and
  therefore labelled nothing; the functions it names begin 148 lines further down)
  merges onto the counter matrix. Version prefixes came off 14 section titles;
  v43 stripped 17 of these and they grew back. Three banners whose title sat off
  the rule line were normalized so the lint can read them.
- **The map now has a lint.** T41.F reads the banners out of the live `pw.html`
  and fails if any is missing from the FILE MAP or listed out of order. This is
  the third hand regeneration and should be the last.
- **The inline `vNN:` rationale tags were deliberately left alone**, all 434 of
  them, exactly as v43 decided: only a handful are pure changelog and the rest
  carry reasons. T41.H asserts they are still there, so a future pass cannot
  quietly strip them.

### Non-vacuity, checked three ways
A cleanup pass that asserts "nothing changed" is worthless if the assertion
cannot fail, so each headline claim was mutated against the delivered build:
changing the harvest rate from `20*dt` to `21*dt` fails all seven T41.A trails;
deleting one FILE MAP line fails T41.F and names the missing banner
(`[missing: PROJECTILES]`); moving one FILE MAP line up fails the ordering check
and names it (`[out of order: PROJECTILES]`).

### Bundle pruning
Ten `repin_*.py` and seven superseded `splice_v54..v60.py`, 224 KB, left the
harness: no tail imports them, a repin is spent the moment its trails are cut,
and an old splice only applies to a build that no longer exists. This README's
per-version notes for v26 to v54 went with them, replaced by an index; each of
those releases' reasoning survives verbatim in its own splice docstring, which
was delivered as an artifact at the time. README 141 KB -> 23 KB.

### Verification actually run at v64
Syntax check, static splice assertions (8 edits: two span replacements pinned by
md5 plus six exact-count subs, and roughly seventy post-conditions), and the full
runtime tail suite at **3336 checks / 0 failures** (3088 at v63 plus 248 new; none
of the existing checks moved). The new tail was also run five times back to back
to confirm the humanisation does not make it flaky. Mini soak, full soak and the
real-canvas render tails were skipped this session to conserve credits, per
standing preference.

That is defensible here because v64 changes what the game SOUNDS like and nothing
about what it DOES: no sim code was touched, `tail_v62` section A's pinned hash
trails pass unedited, and T43.J asserts from both ends that the entire audio
surface leaves `hashState()` where it found it.

Two real faults were caught by the suite rather than by inspection, and both are
worth remembering:

  - `sfxGun`, `sfxLaunch`, `sfxBoom` and `sfxBuildingDestroy` now consult the
    polyphony budget and the duck BEFORE any primitive runs, and both of those
    dereference `AC`. The v63 versions were safe only because every individual
    layer re-checked `ac()` for itself. Before the context is unlocked `AC` is
    null, so T3 crashed outright. Each entry point gates first now, `voxOk` and
    `aBudget` are null-safe, and splice_v64 asserts all six.
  - T41.F reads any line matching `/* ==== title` as a FILE MAP banner, so the
    section comments inside the audio block have to use three dashes, not four.
    With four, every one of them demanded its own row in the map. splice_v64
    asserts that the audio block exposes exactly one banner and that it is AUDIO.

## v69 notes (the economy binds where it should)

Four approved changes and one approved NON-change. Scoped from a measurement pass
over 32 bot-matches (4 skirmish maps x 2 seeds x 4 bots, 18000 ticks, normal).

- **D2 AI bank pressure.** `armyCap` grew on `ai.t` alone, and `ai.t` advances
  1.667/s, so the cap was 12+minutes/3: **15 at ten minutes** against a supply
  ceiling of 80. The measured consequence was that the match leader ended holding
  **4,500-12,000 plastic it could not convert into anything** (backyard s901 tan:
  `a23/15 sup51/72 P11995`), so a won match stalled instead of closing. The cap now
  adds `min(AI_BANK_CAP, p.res.p/AI_BANK_STEP|0)` - 500 plastic per point, capped
  at +12. `supFree` is still the real ceiling; this only stops the idling.
- **D3 the supply ladder.** `SUP_U` was 1 or 2 keyed on the roster median (171.5),
  which puts a cliff in per-supply value: optimal play was "buy the most expensive
  1-supply unit", i.e. the Gunner at 115. Now
  `clamp(1+floor((cp+ce)/SUP_STEP),1,SUP_MAX)` at 110/4, and `SUP_CAP` 80 -> 110
  (HQ plus ten depots reaches it exactly, the same clean relation the 80 ceiling had
  at seven). The median constant is REMOVED, not left dangling.
- **D4 the Gunner.** cp 115 -> 140 and the entrench bonus 2.0x -> 1.5x as a named
  `ENTRENCH_RATE`. The relation the release exists for: an entrenched Gunner must
  not out-damage the Bazooka against heavy armor per plastic. Before **14.85 vs
  10.76**; after **9.15 vs 10.76**. T48.C pins both directions.
- **D5 NO vehicle stat changes**, deliberately, and asserted rather than claimed
  (T48.F). The vehicle line loses on plastic and wins on supply; D2/D3 change which
  binds, so any tank number scoped now would be measured against an economy about
  to move.
- **D6 the deathmatch limit.** 31 of 32 bots were alive at ten minutes, because
  elimination needs every non-barricade structure down and armies of 3-15 cannot
  clear bases of 13-30 buildings. `DM_TIME` 1200 sim seconds; at the limit the team
  with the greatest standing base value wins, ties on kills, then on team number.

### The scope estimate for D3 was WRONG, and the tail records it
The scope said the roster-wide per-supply spread would narrow 4.7x -> 2.9x. That
figure came from a hand-picked subset. Measured over the whole armed roster
(effective DPS vs medium armor, per supply) it **widens, 4.76x -> 5.84x**:

    OLD  gunner 12.10  apache 10.72  flamer 7.88 ... grunt 2.57  arty 2.54
    NEW  bazooka 7.43  gunner  6.05  apache 5.36 ... sniper 1.29  arty 1.27

The ladder closes the TOP (the Gunner stops leading the table outright and drops to
second) and opens the BOTTOM, because siege units now pay 3-4 supply for
single-target DPS that was never their point - artillery at splash 2.8125 and range
9 does not appear in this measure at all. T48.B pins both figures and names the
bottom three (arty, mortar, sniper) so this is a **standing v70 question** rather
than something to be rediscovered by surprise.

### Two traps re-encountered, both already in this file
- **String assertions match prose.** `absent("SUP_MEDIAN")` fired on the splice's
  own explanatory comment saying the constant had been removed. Reworded the prose;
  the check stayed strict.
- **Three dashes, not four.** The new `dmClock` block opened with a 16-dash banner
  and T41.F immediately demanded a FILE MAP row for it (and T41.H flagged the `v69`
  prefix). Same lesson the v64 audio block learned. Ordinary section comments use
  THREE dashes. `splice_v69.py` now asserts this directly.

### A gap in the segmentation note above
The README says a segmented run needs `tail_tests.js` lines 6-26 and `tail_v47.js`.
It also needs **`tail_v44.js`**, because `tail_v51.js` defines
`arena51 = (W,H,clr) => arena44(W,H,0,clr||10)`. A segment containing v51 without
v44 throws rather than under-counting. Note `tail_v47.js` must NOT be prepended to a
segment that already contains it: `SETUP47` is a `const` and redeclares.

### Verification actually run at v69 (REDUCED by request)
`node --check`; the 15 static splice edits with ~30 post-conditions (including the
D5 non-change pins and the no-new-banner check); and the full standard suite run in
two segments: **1828 + 1937 - 44 overlap = 3721 checks, 0 failures**. The overlap is
`tail_v44.js`, prepended to segment 2 as the helper described above and measured
alone at 44 checks so the total is faithful rather than inflated. Mini soak, full
soak and the real-canvas render tails were NOT run.

The **42 layout hashes passed UNEDITED**, which is the point: v69 is tables, AI
production and end conditions and touches `makeMap` not at all, so their passing is
the evidence the divergence is confined to the sim. Only the five trail tables
moved. `recut_v69.js` cut each from its OWN cfg (cfg43/cfg62 tan, cfg49 green) and
asserts both the equality that should hold and the inequality that must, plus a
non-vacuity check that the v68 trail did NOT reproduce.

### Superseded assertions, rewritten rather than loosened
`repin_v69.py` made 20 edits: the five trail tables, plus every assertion that
pinned the retired median or the old Gunner price. Each was rewritten to pin the NEW
rule in the same shape as the old one - the ladder is tested as a rule with an
independent recomputation, not as a transcription of its output - across
`tail_v45` (WANT_POOL widened 3/5/4 -> 7/7/8, the price, the lead figure, the card),
`tail_v52` (the whole-roster cost table), `tail_v54` (the supply model, the depot
arithmetic, the reservation figures), `tail_v61` (the ceiling) and `tail_v65` (the
median block and the plastic column).

- tail_v69.js   T48 v69: the tunables; the ladder and the cliff it removes, with the
                per-supply spread recorded honestly in BOTH directions; the entrench
                rate driven through a real `fireAt` with the retired 2.0x rule as the
                mutation arm; the Gunner-vs-Bazooka heavy relation proven in both
                directions (it holds now, and did NOT under the v68 price and rate);
                the bank term driven through the real production gate, including
                that the stop is the cap and not an empty wallet, and that support
                units are exempt by design; the deathmatch clock - what the score
                counts and refuses to count (incomplete structures, barricades, a
                faction discount), the total ordering, the tick it fires on and the
                tick before, the testing-mode exemption; and statelessness, dual-run
                determinism and save/load across the clock's read.

## v70 notes (supply by quartile)

One change, and one large caveat.

**The change.** v69 priced supply on an ABSOLUTE cost step (`SUP_STEP` 110), so the
tier boundaries were fixed points on the cost axis and the roster's own shape had no
say in where they fell - a re-pricing pass could empty a tier or crowd four units
into one. v70 prices on RANK: the trainable roster is sorted by total resource cost
and cut into `SUP_MAX` quartiles, and a unit pays its quartile.

    1  para, truck, grunt, grenadier, bazooka, bike
    2  flamer, gunner, jeep, mortar, sniper
    3  medic, aatruck, tank, heli, apc
    4  sarge, chinook, arty, apache, bulltank

Two units move against v69: **Medic Truck 2 -> 3** and **Sergeant Bull 3 -> 4**.
Everything else lands where the step ladder already put it. `SUP_STEP` is removed,
not left dangling. `SUP_MAX` survives but changes meaning, from "the clamp that
stops the Bull reaching 5" to "how many ranks the roster is cut into"; nothing is
clamped down any more, because a rank cannot exceed `SUP_MAX` by construction.

Two rules carried over from the retired median, both load-bearing and both asserted:
only TRAINABLE units set the cuts (the Paratrooper is cp 0 and drop-only and would
drag every boundary down, but is still PRICED against the cuts so it can never be
fielded free); and the sort is TOTAL, ties breaking on key name, because a
comparator returning 0 on equal costs would leave the order to the engine and put a
silent divergence into lockstep.

### RESOLVED AT v71 - this section is history, not a live warning
v70 shipped applied-and-syntax-checked only, with the harness unrun and five trail
tables (`BASE45_TRAILS`, `BASE62_TRAILS`, `BASE48_TRAILS`, `BASE45_AI`,
`BASE43_DESK`) knowingly stale: supply is read by the AI's production gate
(`supFree` / `supQueued` / `supCap`), so moving the Medic and the Bull changed what
the bots build. `repin_v70.py` deliberately did not recut them, on the rule that a
recut is a measurement and a measurement is verification.

That was cleared at v71: the tables were recut against a real run and the suite is
green on all five. **Do not act on the paragraph above.** It is kept because the
rule it states is the useful part - a release that cannot be measured does not get
its baselines moved - and because a future reader finding a "STALE" heading with no
resolution attached would reasonably assume the worst.

The 42 layout hashes are unaffected: v70 touches one derived table and nothing in
`makeMap`.

### A trap worth recording
`splice_v69.py` left two stray backslashes inside a JS block comment (`\"buy the
most expensive...\"`), harmless in itself but enough to defeat three attempts at an
exact-match edit over that line. The fix was structural rather than more escaping:
the v70 doc edit was split into a head and a tail that route around the offending
line entirely. When a literal will not match and the text contains escapes, split
the edit rather than escalating the escaping.

## v71 notes (sprite build panels)

Every build / train / research button became a landscape SPRITE TILE: the baked
sprite in a well, plastic and electricity (plus supply for units, plus research time
for research) on the top row, the name on a banner across the bottom. Progress is a
rising semi-transparent wash over the sprite rather than a percentage - army colour
for the production queue, orange for research. Groups keep headings and sit side by
side as columns so the panel stays flat.

The two structural changes underneath the cosmetics:

**Train and unlock merged into one tile.** An un-researched unit stays on the panel
wearing a grey sprite, a corner microscope and the RESEARCH price; clicking it starts
the research. The roster is therefore the full faction list at all times and no
longer grows as you research. A structure tile cannot mean that, because structures
still gate through the Lab, so a locked structure wears a padlock instead and says so
in its tooltip - promising an interaction that does not exist is worse than no mark.

**The standing Construct panel was retired.** The build menu moved under the HQ, and
under the OUTPOST in reduced form: Barricade and Guard Tower inside the outpost's own
6-tile zone, plus an HQ anywhere the player has BUILDING vision. That last rule is
the recovery path when your HQ dies.

Nothing here enters `hashState`, a snapshot encoder or the sim. `placeDeny` is
untouched - the HQ already carried `anywhere:1` - so the new building-vision rule is
a UI gate in `canPlaceUI`, sitting exactly where the fog gate sits and carrying the
same advisory status. Trail baselines did not move.

`v71Fills()` exists because `refreshSelPanel` early-outs on `lastSelSig` and rebuilds
wholesale when it does run; driving a 60fps wash through it would recreate every
`<img>` every frame. The wash is written onto cached nodes from the render loop.

### Two shim asymmetries this release exposed
Recorded here because they are not written down anywhere else and both cost a run:
`querySelectorAll` EXISTS on the shim but returns `[]` unconditionally, and
`classList` is a `Set` fully independent of `className`. The second one reached the
game code, which is why `tile()` sets its base class by assignment and its state
classes through `classList.add`.

## v72 notes (cleanup & organization pass; NO gameplay change)

The fourth of these, after v28, v43 and v62. Accepted on the inverted criterion: the
simulation must not move.

**No repin, and no new trail table.** v28, v43 and v62 each pinned their own trails
and layouts against the build they came from, because at the time that was the only
anchor available. It is not any more. The suite carries five pinned trail tables and
42 layout hashes across `tail_v28`, `tail_v43` and `tail_v62`, and every one passes
UNEDITED through this release - their passing IS the equality proof. A sixth table
holding the same numbers would be exactly the duplication this pass exists to remove,
and would have to be recut alongside the other five on the next sim change for no
added coverage. A pre-edit capture (7 trails, 15 layouts) was still taken and diffed
against the delivered build; it came back byte-identical. It is a working check, not
a shipped table.

**A. The dead build UI, retired at every end.** v71 rehomed Construct and hid the
standing panel with `display:none!important` but left `buildBuildUI` and
`refreshBuildUI` standing and wired into nine call sites, including the every-10-tick
UI pump and every structure completion - a full DOM rebuild of twelve buttons nobody
could see. Gone: both functions, all nine calls, the markup div, three CSS rules, and
`watchInit`'s inline display toggle, which was already redundant against the
`!important` rule. `.bb` SURVIVES: the radio call-downs, Unload All and both entrench
buttons still build them. `bldRoster` survives too, reached now only through
`constructRoster`.

**B.** `tile()`'s `(o.team?'':'')` ternary - both arms empty, no caller ever passed
`team`.

**C. One audio envelope, three primitives.** The four-line exponential AHD breakpoint
sequence was byte-identical in `pnoise`, `ptone` and `psweep` and was the only real
duplication left in the file. Factored to `penv()`, bit-identical by association: the
inline form read `(t+dl)+atk`, the helper takes `t0=t+dl` and reads `t0+atk`. T49.B
proves the routing by WRAPPING THE BINDING and counting calls, not by grepping the
source - the comment above `penv` names all three primitives, which is precisely the
trap the "string assertions match prose" section below describes.

**D. Stale comments and banners.** The `researchBtn` doc comment was orphaned at v71,
sitting above the `TILEART` block two functions from what it documents. Two banner
titles still carried version prefixes (`v69` on the deathmatch clock, `v45` on the
Field Manual counter readout); both escaped T41.H because they use three dashes and
that lint's threshold is four. T49.D now spans BOTH dash forms, so the gap cannot
reopen. The FILE MAP's MESSAGES / UI line no longer advertises the build panel.

**E. The snapshot tag.** It read `v:57` for fifteen versions because `tail_v57` T38.H
pinned it with an exact equality while every other tag check in the suite is
monotonic. Same repair v28 made to T8: T38.H became `>=57` and the tag moved to 72.
`loadState` never reads `S.v` and the tag is not hashed; T49.E proves a `v:57` save
still loads and resumes on an identical hash.

### The third shim asymmetry
`innerHTML` is a plain property on the shim element, so `refreshSelPanel`'s
`pb.innerHTML=''` clears the string and DETACHES NOTHING. Panel columns accumulate
across refreshes and a by-column read silently measures the first stale one. Any
fixture that measures panel contents must detach the children itself first; both
`fixup_v72.py` and `tail_v72.js` do. This is the same family as the v71 pair above.

### Deliberately NOT done
The 19 three-dash sub-banners stay invisible to the T41.F FILE MAP lint. Promoting
them would mean 19 new map rows for doc comments that label functions, not sections.
T49.D covers the specific rot that let a version prefix through, which is the part
that actually went wrong. The 303 inline `vNN:` rationale tags stay: they carry
reasons, not changelog.


## v73 notes (HUD relayout, the HQ shortcut, one balance cell, menu hotkeys)

Four approved changes. Three are UI; the fourth is one table cell and is why this
release has a repin.

**A. The minimap is pinned bottom-right.** It was a flex child of `#bottombar`
sitting AFTER `#selPanel`, and `#selPanel` is capped at 1240px, so on a wide screen
the map parked at ~1256px rather than at the edge. Two consequences were paid for
rather than ignored: `applyMMSize` now writes a `paddingRight` onto `#bottombar`
sized from the live `MM_S` (176 / 220 / 284 at S / M / L) so the panel cannot slide
under it, and the three right-hand panels became flow children of ONE
bottom-bounded `#rightRail` column. That retires `refreshRadioPanel`'s
`offsetTop + offsetHeight` arithmetic: a flex column stacks them for free.
`#radioPanel` is pinned `flex:none` because it holds `.bb` buttons and the v58
squeeze trap applies to any flex child that does.

**B. The HQ shortcut.** A button at the left edge of the bottom bar, above the
selection panel, plus `Q`. `#bottombar` became a column so "above" is true at any
panel height. Three states, and the ordering is the feature: press once to select
without moving the camera (the common case is queuing a building while watching a
fight), again to centre, again to step to your next HQ. Four refusals, each tested
in isolation: an in-progress HQ, a destroyed one, a finished match, and a spectator
- that last one matters because `G.human` in a watch match points at a live CPU
army with a live HQ. `refreshHqBtn` hangs off `updateTopbar`, deliberately NOT off
the ten-tick pump, because T49.C pins that pump's call list as an exact string.

**C. Machine Gunner -15% DPS.** `rt .34 -> .4`. The reload was the lever rather
than the damage because DPS is `dm/rt`, so a rate edit is exact: 0.34/0.4 = 0.85 on
the nose, where `dm 12 -> 10.2` lands at -14.87% once `DMG_SCALE` rounding applies.

**D. Build-menu hotkeys.** Every Construct, Train, Unlock and Research tile carries
a letter, printed top-left and appended to the tooltip. The alphabet is
`C E G I K L M N O R T Y Z` - exactly the thirteen letters no in-match binding
claims - assigned positionally. Context-sensitivity is not a gate: the registry is
rebuilt with the panel, so a key exists only while its tile is on screen, which is
also what makes keys safe to collide across buildings. A key calls the tile's own
`onclick`, dimmed or not, so a key and a click are ONE code path and every handler
validates downstream as it already did.

### The alphabet has no headroom, and that is asserted rather than hoped
The widest menu in the game is the HQ's: 12 Construct tiles plus the Dump Truck =
13, against 13 keys. `hotNext()` returns null past the end and the tile carries no
key, so the failure mode is graceful - but that path is unreached today and both
`splice_v73.py` and T50.D assert the 13 from the live tables, so the day a
structure is added this fails loudly instead of dropping a key in silence.

### Undiscussed at scope, disclosed: the empty selection had no signature
`lastSelSig=''` is the invalidation sentinel, and `''` was also exactly the
signature an empty selection computed. `setSel([])` therefore set the sentinel and
then early-returned against it: `refreshSelPanel` never reached
`info.textContent='Nothing selected.'` and the panel kept the last building's
readout and tiles after a deselect. Latent since the signature was introduced and
cosmetic until now - but the hotkey registry rebuilds on that same path, so left
alone it would have left a dead building's keys live and firing at something no
longer selected. The signature now leads with the selection COUNT, so `'0|'` cannot
collide with the sentinel. T50.E owns it.

### ELEVEN OF THE TWELVE PINNED TRAIL COMBOS NEVER FIELD A MACHINE GUNNER
This is the v52 lesson in a new costume and it is the most important note here.
Exactly one of the five trail tables moved (`BASE45_AI`, two of four rows), which
looks like a beautifully localized release. It is not. Instrumented Gunner
unit-ticks over each pinned combo's own sampling window:

    BASE45_TRAILS / BASE48_TRAILS / BASE62_TRAILS   7 combos each ... all 0
    BASE43_DESK                                     desk:surv ....... 0
    BASE45_AI                                       4 combos ........ 0, 0, 1330, 0

900 ticks is 30 sim-seconds and `u_gunner` is not researched anywhere near that
early, so four of the five tables COULD NOT have moved no matter what this release
did to him. Their passing unedited is blindness, not proof.

The one row worth studying is `kitchen:ctf`, which moved with ZERO Gunner
unit-ticks. `aiPickUnit` scores damage-per-plastic and draws over the SQUARE of the
score, so changing his score re-weights the draw for every roster he appears in
whether or not he is ever the unit that comes out. The release reaches the sim
through the AI's production rule, not through combat.

So v73's localization claim does NOT rest on the four blind tables. It rests on the
42 layout hashes (untouched; `makeMap` is not edited) and on T50.F, which drives the
entire new UI surface between two reads of `hashState` on the same tick.

**No sixth table was added.** After the recut, `BASE45_AI` is the non-blind anchor
for unit-stat edits - it is the only table in the suite whose bots reach
`u_gunner`. A new table over the same ground would be the duplication v72 spent a
release removing. T50.F records WHICH combos are gunner-bearing instead, so the next
release knows where its evidence lives.

### AIR IS DOWN TO ONE COMPETITIVE ANSWER - a standing v74 question
T26.C measures, per armor class, how many units sit within 55% of the best
effective-DPS-per-plastic. The Gunner's cut moved four of the six:

    light  7 -> 9    medium 7 -> 9     the release LANDING: the generalist that was
                                       winning those columns came down to the field
    heavy  3 -> 2                      the release WORKING: he was never meant to be
                                       an armor answer and T48.C exists to stop him
    air    2 -> 1                      NOT the release working

He falls from 64% to 54% of the AA Missile Truck against a 55% cut, and the AA
truck is `aaOnly`. Aircraft are now answered competitively by exactly one unit and
that unit can shoot nothing else. The blanket "no class is uncounterable" invariant
is kept INTACT for the other five classes; air is pulled out into its own named
check, bounded on BOTH sides at the measured 54% so further erosion fires and so
does a fix. The margin is one percentage point: **-10.5% would have left him at 57%
and held the pool at 2.**

### Superseded assertions, rewritten rather than loosened
`repin_v73.py` recut one table and re-aimed five assertion groups. The one worth
knowing about is `tail_v69` T48.B: that section isolates the SUPPLY RULE by
evaluating both rules over one roster, and v73 moved the roster underneath it. It
now restores the v72 reload for the length of its own measurement and puts it back
(asserted), so every figure in B survives UNEDITED - they are statements about the
ladder, not about the Gunner. The live v73 figures live in T50.C where they belong.
`tail_v45` T26.H is the opposite case: v69's two-sided bound was written precisely
to fire if a later release flattened the Gunner's lead away, it fired, it was read,
and it is repinned on the Flamethrower's new 1.0124x lead - still two-sided. He is
still first for green, gray and blue, because the Flamethrower is tan-exclusive.

### Verification actually run at v73
`node --check`; `splice_v73.py`'s 34 edits with ~40 post-conditions (including the
alphabet-vs-widest-menu check computed from the live `bldRoster`); the standard
suite in two segments, **2322 + 1683 - 44 - 83 overlap = 3878 checks, 0 failures**
(the overlaps are `tail_v44.js` and `tail_v47.js`, prepended to segment 2 as the
helpers the note below describes and each measured alone so the total is faithful);
and `browser_check_v73.js` in real Chromium at **1920x1080, 1366x768 and 1280x800 x
small/medium/large, 90 geometry checks, 0 failures**. The 42 layout hashes passed
UNEDITED. Mini soak, full soak and the real-canvas render tails were NOT run.
