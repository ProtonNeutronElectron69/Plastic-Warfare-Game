# Working on Plastic Warfare

Read this first. It is the orientation; `harness/README.md` is the detail.

## The shape of the project

The whole game is **one file**: `plastic-warfare.html` (~920KB). Everything —
simulation, rendering, audio, UI, netcode — lives in the single `<script>` block
inside it. There is no build step for the game itself and no dependencies.

Every graphic is drawn procedurally on a canvas and every sound is synthesised at
runtime. **There are no third-party assets in this repository**, and it must stay
that way.

The owner has **no coding experience**. Explain things in plain language. Do not
lead with implementation detail unless asked.

## Before you change anything

```sh
cd harness
./build.sh          # regenerates game.js AND pw.html from the HTML. ALWAYS run first.
```

`game.js` and `pw.html` are generated and git-ignored, so the game's code exists
in exactly one place. **A stale `pw.html` once made nine source-text tests check
the previous release for three versions running** — that is why `build.sh` writes
both, and why you run it before every test pass.

## Testing

```sh
./triage.sh              # ~25s: "did the simulation move, and which tails care?"
QUIET=1 ./seg.sh all     # full suite in parallel, ~320s. 5,043 checks at v88.1.
QUIET=1 ./seg.sh 1       # or a single segment: 1, 2a, 2b, 2c, 3
python3 verify_v58.py    # 32 extra source-text checks, not part of seg.sh
```

**Start with `triage.sh`.** It re-runs the pinned hash trails and tells you
whether the simulation actually moved, then ranks the test files by how rare the
identifiers you touched are. Reading the diff is not a substitute: v83's
placement bounds-check looked like a UI guard and moved every trail, while v82
rewrote hundreds of lines of help markup and moved nothing.

If the trails moved, the release needs a **recut and repin** — regenerate the
five baseline tables behind the 42-pin layout gate. Copy the current
`recut_vNN.js` / `repin_vNN.py` pair forward to the new version and delete the
old one; only the current release's one-shots ship.

**The layout gate is not optional.** If any of the 42 map-layout pins move, stop
— that means map generation changed, and repinning trails on top of that hides
the real problem instead of recording it.

## Rules that are load-bearing

1. **New simulation state must be hashed AND serialized.** Add it to
   `hashState()` and give it a default in `loadState()`. Miss either and the
   save/load test (T3) fails, or worse, two players desync in a live match.
2. **Never call `srand()` from a rendering or audio path.** `srand()` is the
   shared seeded RNG; audio deliberately uses `Math.random` so it cannot touch
   the simulation stream. Drawing code that consumes `srand()` desyncs the game.
3. **Every number stated in the Field Manual must read off a constant.** Add a
   `HELP_TUNE` slot and a `data-tune` span; the counts are asserted equal.
4. **A derived constant that takes a min or max over a whole table is a trap for
   the next row you add to it.** Before adding a unit, grep for what reads `U` in
   aggregate. At v85 that was `MEDIC_HEAL_RATE` (min DPS across the roster) and
   `SUP_U` (cost quartiles) — the first would have silently cut every Medic in
   the game by 37%. At v86 the same two were checked BEFORE the rows went in, and
   `SUP_U` is why Green's two units are priced where they are: the two costs were
   chosen inside the only bands that leave all 21 existing units on the supply
   ranks they had.
5. **A test that needs a conscious edit is doing its job.** Several pins exist
   precisely so an addition has to be declared: the `.bb` button count, the unit
   and building counts, the transcribed cost tables. Update them deliberately and
   say why in the comment; never loosen one to get green.
6. **Record what you measured, including when it contradicts the plan.** The
   harness README is full of findings that went the other way from the scope
   estimate. That is the point of it.

## What is in flight

**Roadmap 2 (v85–v88) is COMPLETE.** Every army fields a full exclusive set —
two exclusive buildings, an exclusive unit from the Barracks, the Garage and the
Helipad, and its own Radio Tower call-in.

- **v85 — Blue.** Signal Runner, Forward Pad, Rapid Redeploy.
- **v86 — Green.** Command Truck, Observation Balloon, Command Post, Supply Drop.
- **v87 — Tan.** Firebomb Heli, Foundry, Napalm became Tan-exclusive.
- **v88 — Gray.** Choktaw Heli, Heavy Barricade, Smokescreen.

**v87.1 landed between v87 and v88** and is not part of the roadmap: three
interface repairs (team-coloured drag box, `UNIT_TOGGLES` group buttons, the sell
teardown and its plastic heap). None of them moved the simulation.

`tail_v88.js` T62.J states the completion claim in one section, derived off `FAC`
rather than transcribed — so an army that grew a third exclusive structure, or
lost one, fires there.

**v88.1 closed v88's open question and made three display changes.** The Machine
Gunner was re-priced 112 → 125 so he pays 2 supply again; the Forward Pad's
repair rate went 1.6 → 3 HP/s; the Field Manual gallery is cost-ordered and
paints shared entries green and exclusives in their owner's colour; and every
unit and structure description was shortened.

## What v88.1 left behind

**The seventh supply slot.** At 25 trainable units the cheap tier holds seven, so
somebody always pays 1 supply. It is the Flamethrower now rather than the Machine
Gunner, which is the better occupant because he is Tan-exclusive — three armies
in four cannot field the per-supply leader at all. The Medic and Sarge are still
one rank cheaper than they were at v87; that is roster arithmetic and nobody has
asked for it to change.

**The Machine Gunner is third on infantry damage-per-plastic**, behind the
Flamethrower and the plain Grunt, because the re-price broke v78's `rt × cp`
pairing on purpose. What he keeps is Entrench and the toughest hull among the
infantry every army can build, and `T50.C`/`T63.A` assert both so "he is still
worth it" is a checked claim. `T26.C`'s air question is untouched and still open.

Two things to know before the next release:

- **One faction per version** was the roadmap's rule, and it is why trail
  divergence stayed attributable to a single release each time.
- **`u.abCool` has two users now** — v87's Napalm Blast and v88's Paint. The
  duration lives on the table row as `t.abCd`; `makeUnit` writes the clock only
  onto rows that declare one, `updateUnit` ticks it, and it is hashed, serialized
  and zeroed by testing mode. A third ability needs a row and nothing else.
- **The build menu has one key spare.** `MENU_KEYS` holds fourteen and every
  army's Construct menu is now thirteen tiles — all four hold exactly two
  exclusive structures, so they are all the same width. A fifteenth tile would
  need a fifteenth letter and there is no unclaimed one left. See the v86 note in
  `harness/README.md`.

## The patterns worth copying

When adding a faction exclusive, the v85 work is the closest model:

- **An aura is read off the source entity, never written onto the entities it
  affects.** Scan for the source in range at the point of use, the way
  `sprintOn()` / `rnetOn()` and the older `dmgBonus()` loops do. A squad of
  twenty under one aura is still one boolean of state.
- **A "cannot fire" mode drops the target rather than gating the weapon.** A unit
  that keeps its target and merely declines to shoot stands in range doing
  nothing, because the attack state pins its path. See the Full Throttle and
  Sprint blocks in `updateUnit`.
- **Reuse existing state before inventing new state.** Rapid Redeploy borrows
  `u.garrisoned` for its off-map window because that flag already means "not on
  the field" at every door in the file.
- **When the same eight lines appear a seventh time, they are a table.** The
  multi-select panel had six hand-written group-toggle blocks and four abilities
  with no group button at all, purely by shipping order. `UNIT_TOGGLES` (v87.1)
  replaced them, and the completeness check is DERIVED: it scrapes
  `refreshSelPanel`'s own source for the single-unit `submitCmd(...,{ids:[e.id],
  on:!e.<field>})` shape and demands a row for each, both directions. A check that
  reads the code cannot drift from it the way a transcribed list does.
- **An effect added to a SIM function must use `Math.random`, never `srand()`.**
  Rule 2 says never call `srand()` from a rendering path; v87.1 is the mirror.
  `sellBuilding` gained the destruction teardown, and one seeded offset among the
  cook-offs would have desynced a live match while looking correct on one machine.
  The test that catches it drives `G.rngS` across a sell, not the source text.
- **A faction-only call-in is a `fac` field on the shared `RADIO_ABILITIES`
  table**, refused at the `execCmd` door — not a second table, and never relying
  on the panel simply not offering it. All four armies carry one each now, and at
  v87 the Napalm Strike moved INTO that state rather than being added beside it,
  which is the strongest form of the claim. **The bot is the surface that hides:**
  `aiTick` calls `radioNapalm` directly and never through `execCmd`, so it had to
  be taught the same gate separately. Grep for the ability's own function name,
  not just for the mode string.
- **An aura is read off its source; a MARK is written onto its victim.** Every
  aura before v88 asks "is the affected unit in reach of a source", so it ends
  when the source dies. v88's Paint does not: the aircraft can be shot down and
  the tank stays lit. That makes the mark sim state — hashed, serialized, and
  defaulted for EVERY unit rather than for the rows that declare an ability,
  because it is worn by units whose own row says nothing about it.
- **When a table flag would answer, never key a test on a KEY.** The Heavy
  Barricade is the second `barr` row, and fourteen tests that said
  `key==='barricade'` meant "is a wall". Three of them were load-bearing: the
  RESCALE skip (a miss would have cubed the wall's HP), `kill()`'s lightweight
  teardown, and `checkElim` — an army left holding only heavy walls would never
  have been eliminated. Before adding a second row of an existing kind, grep for
  the first one's key.
- **When a function starts reading a new field, grep for its CALLERS.** v88's
  fifteenth wall site was missed by exactly the grep that found the other
  fourteen, because it is a hand-built stub rather than a real entity: it never
  had a `t` to be wrong about, so searching for `key==='barricade'` found it and
  searching for what reads `t` did not. Both wall thumbnails in the Field Manual
  were blank for a whole release, and only became visible when v88.1 reordered
  the gallery and put them first.
- **"Cannot be targeted" needs an acquisition gate AND a damage rule.** v86's
  balloon has both, because a zero multiplier is not a refusal to aim: without
  `ballOk` every rifleman on the map would stand under one forever dealing
  nothing. Splash needed a third line of its own, and the direction is
  counter-intuitive — every rocket in the file lands its damage AS splash, so
  the rule is "skip it unless this burst is an AA missile's".

## Git

Work on the branch you are told to use, commit with a real explanation of *why*,
push, and open a **draft** pull request. Do not push to `main` directly.
