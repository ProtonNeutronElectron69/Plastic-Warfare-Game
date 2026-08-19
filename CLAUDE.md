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
QUIET=1 ./seg.sh all     # full suite in parallel, ~320s. 4,683 checks at v86.
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

**Roadmap 2 (v85–v88): every army fields a full exclusive set** — two exclusive
buildings, an exclusive unit from the Barracks, the Garage and the Helipad, and
its own Radio Tower call-in.

- **v85 — Blue. LANDED.** Signal Runner, Forward Pad, Rapid Redeploy.
- **v86 — Green. LANDED.** Command Truck, Observation Balloon, Command Post,
  Supply Drop.
- **v87 — Tan. NEXT.** Firebomb Heli, Foundry, Napalm becomes Tan-exclusive.
- **v88 — Gray.** Choktaw Heli, Heavy Barricade, Smokescreen.

**The full specification for v87–v88 is written down and settled**, including
every clarification the owner gave. It is in `harness/README.md` under *Roadmap
2: the remaining three armies*. **Build it as written** — it is decided, not
proposed. Do not re-ask the questions it already answers.

Two things to know before starting one of them:

- **One faction per version.** Self-contained, so trail divergence stays
  attributable to a single release.
- **`u.abCool` does not exist yet.** Cooldown abilities on units were originally
  ruled out and the owner later overrode that, but neither v85 nor v86 needed
  one — Sprint and Broadcast are sustained modes, and Bail is instantaneous and
  destroys the unit offering it. The machinery must be built when the first one
  lands — Tan's Napalm Blast at v87.
- **The build-menu alphabet is now exactly full.** `MENU_KEYS` holds fourteen
  keys and the widest menu is fourteen tiles. Tan and Gray reach fourteen too
  when they get their second structure, so nothing more is needed — but a new
  structure on top of roadmap 2 would need a fifteenth key, and there is no
  unclaimed letter left. See the v86 note in `harness/README.md`.

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
- **A faction-only call-in is a `fac` field on the shared `RADIO_ABILITIES`
  table**, refused at the `execCmd` door — not a second table, and never relying
  on the panel simply not offering it. Two armies carry one each now, so the
  field's meaning is exercised rather than being a special case for Blue.
- **"Cannot be targeted" needs an acquisition gate AND a damage rule.** v86's
  balloon has both, because a zero multiplier is not a refusal to aim: without
  `ballOk` every rifleman on the map would stand under one forever dealing
  nothing. Splash needed a third line of its own, and the direction is
  counter-intuitive — every rocket in the file lands its damage AS splash, so
  the rule is "skip it unless this burst is an AA missile's".

## Git

Work on the branch you are told to use, commit with a real explanation of *why*,
push, and open a **draft** pull request. Do not push to `main` directly.
