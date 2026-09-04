# Working on Plastic Warfare

Read this first. It is the orientation; `harness/README.md` is the detail.

**Map of this file.** The first six sections are the ones you need before you
touch anything — what the project is, where it stands, how to build, how to
test, how to watch the bots, and the rules that are load-bearing. Everything
after that is the record: the roadmap chapters, then one section per standalone
release NEWEST FIRST (v106 down to v89), then the balance baseline, then the
patterns worth copying. Read the record when you are about to touch the
subsystem it describes; do not read it front to back.

**The one exception to "it is all record":** `## Roadmap 4` is the only
FORWARD-looking chapter in this file. Roadmaps 1-3 are finished history; roadmap
4 is a tentative, unagreed menu of what could come next, written at v103 — one
of its twelve items has since been delivered (item 1, music, at v104) and the
rest are untouched. If the owner asks "what should I build", that is the
section.

## The shape of the project

The game is **assembled from `source/`** into one file, `plastic-warfare.html`
(~8.7MB), by `./build.sh` at the repo root. Everything — simulation, rendering,
audio, UI, netcode — is still one `<script>` block in the shipped file; it is
written as 36 files listed in `source/order.txt`. There are no dependencies.
The recorded sound set (25 voices in 35 mp3 takes, `assets/snd/`, since v92 —
the voices that repeat fastest carry alternates, which is why takes outnumber
voices), the full sprite texture set (218 WebP files, `assets/img/`, since v95)
and their normal maps (218 more, `assets/nrm/`, since v96) all ride inside the
script as base64 — the
double-clicked file stays self-contained. **Four music tracks (`assets/mus/`,
since v104)** ride the same way. `tools/embed_snd.py`, `tools/embed_mus.py` and
`tools/embed_img.py` pack them; the suite asserts the committed files and the
embedded copies stay byte-identical.

**That order is load-bearing.** Read the header of `source/order.txt` before
touching it: hundreds of top-level `const`s, some derived from others, plus a
mutation that runs after the table it edits. Reorder and you can change the
simulation while the diff looks like a file move. `triage.sh` is the check.

**Assets OVERRIDE, they never REPLACE.** Every procedural painter and
synthesised voice stays as the fallback: a missing or undecodable file degrades
to the drawn/synthesised version, and the headless suite (whose shim has no
image decoder and no real WebGL) permanently tests exactly that path. Deleting
a painter deletes its safety net.

**The pre-overhaul game is preserved.** The `classic` branch holds the last
hand-drawn, synthesised version (its game file is byte-identical to v90.2, the
last single-file release, commit `b292773`) — one file, no build, opens
straight in a browser.

The owner has **no coding experience**. Explain things in plain language. Do not
lead with implementation detail unless asked.

## Where the game stands (v107.3, and what a fresh session does)

The game is at **v107.3**. All three roadmaps are COMPLETE: roadmap 1 (v79–v82,
abilities), roadmap 2 (v85–v88.1, full faction-exclusive sets), roadmap 3
(v91–v96 + follow-ups v92.1/v96.1/v97, real art and real sound). v98 through
v103 are standalone owner passes (below), **v104 is the first Roadmap 4 item
delivered** — the soundtrack, which then took four owner feedback passes
(v104.1–v104.4) before it was right — and **v105 is a standalone menu pass**
(the whole roster parades behind the setup screen, and the Field Manual is
painted on the same parade ground), with **v105.1** the owner's feedback pass on
it — two bugs found by playing, one of which had let the BOTS research three
structures the human could not. **v106 is the second Roadmap 4 item delivered**:
the bots use the six unit abilities they owned and never switched on. **v107 is
the third, in part** — two of Roadmap 4 item 2's battlefields: the Bathroom
Floor (a four-corner 72 built around a drained bathtub) and The Attic, the game's
first SIDED map, built for a 2v2 with each team's pair seated inside a walled
compound of destructible level art, and **v107.1** is the owner's feedback pass on
it — the walls pulled in seven rows with a layer more, a second expansion per
base, bots that spare their own compound, mines in the middle — and **v107.2**
is the second, a floor of its own for the Bathroom (a hexagon mosaic in warm
porcelain, because it had been wearing the Kitchen's square grid), and
**v107.3** is the third — the bathtub and the dropped towel, both of which read
as blank white. There is no release in flight.

**Known open fronts.** The full menu is **Roadmap 4** below — twelve items,
ranked, written after a whole-game review at v103. **Three of the twelve have
shipped in whole or in part** — item 1's music half (v104–v104.4), item 4
(v106) and two of item 2's boards (v107); the barks and the other nine items are
untouched. The
headline of it: the systems layer is finished, and what is thin is content (six
PvP maps and one survival board) and balance (two of four armies do not work).
Presentation was the third leg of that and is now half-answered — the game has a
score, but the ground is still the one visual layer with no textures, and one
sound is still the browser's own text-to-speech voice. (v105 repainted the MENU's
parade ground and gave the Field Manual the same backdrop; neither is the
in-match ground, so item 5 is untouched by it.)

- **Map ART, as opposed to map LAYOUT** — Roadmap 4 item 5. The owner deferred
  map art from v97's detail pass ("maps/map art will be handled separately") and
  v103 did NOT close it: v103 fixed where things are PUT, not how they are drawn.
  Terrain (`G.terr`), props and ground art are still the one visual layer fully
  procedural at base resolution — no textures, no normal maps, no lighting.
- **Balance** — Roadmap 4 item 3, and it is **re-measured at v103**: the
  balance section below now carries 32 fresh matches instead of the eleven-release-old
  v90 percentages. Short version: Green 47%, Tan 34%, Gray 9%, Blue 9%.
- **The infantry BARKS** — the tail of Roadmap 4 item 1, and the only part of
  it left. Selecting a soldier speaks through `speechSynthesis`, the browser's
  own TTS voice, which is the one sound in the game outside its art direction.
  Ten recorded barks retire it, and the v92 pipeline takes them unchanged.
- `T26.C`'s air-value question is still open, and is untouched by any of it.

**What a fresh session actually does first.** Nothing here is in flight, so there
is no handover state to reconstruct — start from a clean read:

```sh
cd harness && ./build.sh && ./triage.sh     # ~30s: proves the tree is sound
QUIET=1 ./seg.sh all                        # ~400s: 6,830 checks, expect 0 failures
```

**One known flake, and it is not yours.** `T43.M` fails roughly one run in four,
colliding two gun voices. It fingerprints the SYNTHESISED weapons and those are
jittered with `Math.random` (rule 2 — audio never touches the sim stream), so a
coincidence is possible by construction. Re-run before investigating; the fix,
if anyone wants it, is in the v104 section of `harness/README.md`.

If those are green the repository is exactly as the last release left it, and
whatever the owner asks for next is a fresh vNN starting from `origin/main`. If
they are NOT green, stop and read the failure before touching anything: every
check in this suite was put there by a release that paid for it.

**The map generator was audited at v103 and nothing has touched it since**
(the v103 section below). If you touch `makeMap`, run `harness/audit_maps.js` before and
after — it counts every defect class the audit found, and the residual it should
report is: 3-4 decor-sized art grazes, 2 line props lying in a spill, and one
sandbox seed in twenty sharing ten tiles between two hazards. Anything larger
than that is a regression.

**How a release ships.** One version per PR. Start a fresh branch from
`origin/main`, work it as vNN (or vNN.N for a feedback/repair pass), **bump
`GAME_VER` and `GAME_DATE` in `source/js/01-constants.js`** (since v98 the menu
prints them and the save tag derives from them — one place, both numbers), add a
`tail_vNN.js` with the release's pins (register it in `harness/seg.sh` line ~49
AND `harness/tails.txt`), record the release in `harness/README.md` and update
this file, then push and open a **draft** PR into `main`.

**Four documents move with a release and the fourth is the one that gets
forgotten**: `source/js/01-constants.js` (the two numbers), `harness/README.md`
(the evidence), this file (the orientation), and **`README.md` at the repo root
— the page a PLAYER reads**. It carries the version number, the suite's check
count and a plain-language paragraph per release, and it sat three releases
behind (still saying "version 97") until the post-v100 documentation pass. It is
written for someone with no coding experience: say what changed in the game, not
what changed in the code. The owner reviews —
usually by playing — and says "merge" explicitly. Owner feedback after a
release becomes a vNN.N pass where every finding lands as a change AND a check
(v92.1, v96.1 and v97 are the pattern).

## Before you change anything

```sh
cd harness
./build.sh          # ALWAYS run first. Since v91 this runs ../build.sh too, so
                    # it picks up source/ edits, then regenerates game.js and pw.html.
```

The instruction has not changed and does not need to: `harness/build.sh` chains
to the root build, so editing `source/js/foo.js` and running it is enough for the
tests to see the edit. `plastic-warfare.html`, `game.js` and `pw.html` are all
GENERATED — edit `source/`, never them.

`game.js` and `pw.html` are git-ignored; `plastic-warfare.html` is committed,
because it is what a player opens. `./build.sh --check` at the root asserts the
committed file matches a rebuild of the sources, and `T66.A` runs the same
comparison inside the suite, so the two can never silently drift apart.

**A stale `pw.html` once made nine source-text tests check the previous release
for three versions running** — that is why `build.sh` writes both, and why you
run it before every test pass. And run the FINAL full suite on the final bytes:
a doc comment edited after the last build is enough to fail `--check`.

## Testing

```sh
./triage.sh              # ~25s: "did the simulation move, and which tails care?"
QUIET=1 ./seg.sh all     # full suite in parallel, ~400s. 6,830 checks at v107.3.
QUIET=1 ./seg.sh 1       # or a single segment: 1, 2a, 2b, 2c, 3
python3 verify_v58.py    # 32 extra source-text checks, not part of seg.sh
```

## Watching the bots play

```sh
cd harness
./sim.sh                 # 12 all-AI deathmatches, 2 per map (six maps since v107), ~3min. Writes a report page.
./sim.sh 24              # a bigger batch; SEED0=900 ./sim.sh for a different run
```

## Looking at the maps (v103; seven of them since v107)

```sh
cd harness
./map_shot.sh out 500000 0.42     # one whole-board PNG per map, then READ them
cat shim_head.js game.js audit_maps.js > .audit.js && node .audit.js 40
```

`map_shot.sh` boots a real match per map in headless Chromium, paints the baked
terrain canvas plus every prop into one canvas sized to the WHOLE board, outlines
the board's own rim in magenta so anything drawn outside it is obvious, and leaves
that canvas as the page. `audit_maps.js` is its numeric half: it generates every
map over N seeds and counts each defect class. Neither is pinned and neither is
part of `seg.sh` — like `sim.sh` and the probes, they answer "what does this
actually look like", not "did I break anything". **A layout defect cannot fail the
suite**, which is rule 7 with a whole subsystem behind it.

Two traps in that recipe, both paid for: `plastic-warfare.html` ends with
`</html>` and NO trailing newline, so `head -c -1` before appending a `<script>`
eats the `>` and the injection silently never runs; and do not wait on the `load`
event — on an 8.7MB page of `data:` URLs it sits behind every decode and Chromium's
virtual clock expires first. Poll `ASSETS_STATE`, the gate the Start button uses.

`sim.sh` runs whole matches with a CPU in every seat and builds
`sim_out/battle-report.html` — winners, kills, and what every army produced. It is a
MEASUREMENT tool, not a test: nothing it prints is pinned, and it is not part of
`seg.sh`. Use it to answer "how does this actually play", not "did I break anything".

**Its numbers move a lot between batches, and that is the honest signal.** Eight
matches on the same seeds gave one army 6 wins under one map pairing and 4 under
another. Read a batch as a hint about a direction, and re-run with a different
`SEED0` before believing anything.

**Two probes answer WHY, where `sim.sh` only reports WHAT.**

```sh
./probe_v89.sh           # why a bot bought what it bought: every production decision
./probe_v89.sh 16        # bucketed by the first clause that refused it. 8 matches by
SEED0=2000 ./probe_v89.sh 16      # default, on sim.sh's own seed/map/faction deal
./probe_v99.sh           # order churn: wave cadence, divert-and-return flips, the worst
SEEDS="7 8" MAP=kitchen ./probe_v99.sh   # same-tick mass diversion, and the endgame
./probe_v106.sh          # per-ability usage: for each row of UNIT_TOGGLES, the share of
SEEDS="7 8" ./probe_v106.sh              # carrier-ticks a CPU unit has it switched ON. A row
                         # with carriers and no on-ticks is an ability the bots own and
                         # never use - which is what v106 was written to find
                         # duel readout. 3 matches, ~4min
```

Both stand on `sim.sh`'s footing — nothing they print is pinned, and neither is
part of `seg.sh`. Reach for `probe_v89.sh` before re-pricing anything on a bot's
behalf and `probe_v99.sh` before touching how bots give orders. Each exists
because the release that added it could NOT answer its question from `sim.sh`'s
outcomes: a class share is an outcome, and an outcome is consistent with a dozen
causes. That is the single most reusable lesson in the AI passes — measure the
mechanism, not the outcome.

**Start with `triage.sh`.** It re-runs the pinned hash trails and tells you
whether the simulation actually moved, then ranks the test files by how rare the
identifiers you touched are. Reading the diff is not a substitute: v83's
placement bounds-check looked like a UI guard and moved every trail, while v82
rewrote hundreds of lines of help markup and moved nothing.

If the trails moved, the release needs a **recut and repin** — regenerate the
five baseline tables behind the 42-pin layout gate. Copy the current
`recut_vNN.js` / `repin_vNN.py` pair forward to the new version and delete the
old one; only the current release's one-shots ship.

**The pair in the tree is `recut_v106` / `repin_v106`** — the pair is carried
forward by the release that MOVES the trails, not by every release. Do not read
the version on those two files as the version of the game; read it as "the last
release that had to repin". v106's pair is the ORDINARY shape and the one to copy:
it recuts the five trail tables only, and it walks the 42-pin layout gate as a
REFUSAL. v103's pair (now retired) was the one exception — it recut the layout
pins too and ran that gate as its own inverse, because v103 changed map
generation on purpose. Every other release wants the gate as a refusal, which is
what v106 restored.

**Recut ONCE, on the final bytes.** If you repin, then keep editing the sim, the
tables you wrote are already stale. v99 hit this: a later pacing change moved one
AI trail after the repin, and the clean fix was to restore the five pinned tails
to their previous state (`git checkout origin/main -- tail_v43.js tail_v44.js
tail_v45.js tail_v49.js tail_v62.js`) and cut once against the finished
release.

**The layout gate is not optional.** If any of the 42 map-layout pins move, stop
— that means map generation changed, and repinning trails on top of that hides
the real problem instead of recording it. The one exception is a release whose
SUBJECT is map generation, and there the gate is inverted rather than skipped:
see `recut_v103.js`, which demands the pins moved and names the only board
allowed to hold still.

**Two pin counts, both correct, and they will look like a contradiction.**
`triage.sh` prints "all 30 pins hold"; the recut gate in `recut_vNN.js` asserts
42 and refuses to cut a trail otherwise. 30 is the FAST SUBSET (`tail_v43`'s and
`tail_v62`'s tables, five maps × three seeds each); 42 is every pin, adding
`tail_v28`'s third table of 12, whose config differs (always deathmatch, always
three opponents, no desk). Both gates COUNT their own walk and hard-fail on a
short one — a map quietly dropped from either loop used to print "all pins hold"
having walked fewer, and clean is the answer that stops an investigation.

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
   and building counts, the transcribed cost tables, the derived texture roster
   (T71.A — a new unit fails the suite until the texture pipeline is re-run).
   Update them deliberately and say why in the comment; never loosen one to get
   green.
6. **Record what you measured, including when it contradicts the plan.** The
   harness README is full of findings that went the other way from the scope
   estimate. That is the point of it.
7. **A drawing bug cannot fail the suite, so a frame nobody looked at is a frame
   nobody checked.** `renderGuard` wraps `renderCore` precisely so a render
   throw cannot crash a live match — which also means it cannot go red in
   `seg.sh`. If you touched anything that draws, open the shipped file in a real
   Chromium and READ the screenshot; the recipe (no npm, no server) is in the
   Running section of `harness/README.md`. v100 paid for this rule twice in one
   release.
8. **Measure the mechanism, not the outcome.** Every AI pass that got this wrong
   drew the wrong conclusion: a class share, a win rate and a mean unit cost are
   all outcomes, and each is consistent with a dozen causes. The probes exist
   because `sim.sh`'s outcomes could not distinguish "never chose air" from
   "chose air and could not pay for it".

## Roadmap 4 — the tentative shortlist (proposed at v103; item 1 delivered)

**Nothing here is agreed and nothing here is in flight.** This is the menu that
came out of a whole-game review at v103, written when the owner said they were
running out of ideas. TWO items have since shipped: item 1 (v104–v104.4, bar its
barks) and **item 4 (v106)**. The rest are exactly as written — and item 4 is a
warning about how they were written, because its own inventory of the code was
out of date by two releases when the review made it. Measure before you build.

It is ranked by return on effort, and four of the twelve items rest on
measurements taken at the time rather than on opinion — those are
marked MEASURED and the evidence is in the v103 measurement section of
`harness/README.md`. The full write-up, with the reasoning and the charts, is the
"v104 Shortlist" artifact:
<https://claude.ai/code/artifact/7573b0e0-b949-4c73-a70a-e08f8bb6fc2d>

**The framing, because it decides the ranking.** The SYSTEMS layer is finished:
25 trainable units, 19 buildings, four armies with full exclusive sets, a 9×6
counter matrix, veterancy, a finite economy, four modes, patrol/attack-move/order
queues, day/night, lockstep netcode, textured and per-pixel-lit sprites, a
recorded soundtrack, 6,716 checks. What is thin is everything AROUND it — how
many places you can play, and whether all four armies are worth picking. Every
item below is content, presentation or tuning; none of them needs a new system
invented. (Written at v103, when the "what does it sound like" leg of that was
still empty; item 1 has since answered it.)

### Band 1 — highest return

1. ~~**Music.**~~ **DELIVERED at v104, refined through v104.4** — four Old Guard
   Fife and Drum Corps tracks (menu / build / combat / victory), public domain as
   works of the US federal government, ducking under gunfire through
   `COMBAT_DUCK_T` exactly as this entry predicted, plus Music and Effects faders
   on the audio button. The reasoning, the four owner passes and every trap are
   in the v104 chapter below and in `harness/README.md`; nothing about the score
   is outstanding.
   **What IS still open is the second half of this item, the BARKS.** Infantry
   selection speaks through `speechSynthesis` — the browser's own text-to-speech
   voice, and the one sound in the game outside its art direction. Ten recorded
   barks retire it, the v92 pipeline (render offline, embed as base64) takes them
   unchanged, and `sfxBus` already exists to hang them off. It is the smallest
   unstarted job on this list.
   *Impact medium (barks only) · effort low · balance risk none.*
2. **More battlefields.** **TWO DELIVERED at v107** — the Bathroom Floor and
   The Attic, the latter the first 2v2 board and the first with destructible
   level art; see the v107 chapter for what that took (three leaks in one
   bathtub, all found by a flood fill). The small two-player board and the
   second survival board named below are still open. The original note:
   Four PvP maps and ONE survival map, against 25 units
   and four armies. Maps are the best value on the list: every one reuses the
   existing props, painters, hazards and wildlife; each is point-symmetric by
   construction so it carries almost no balance risk; and `makeMap` has just come
   out of the v103 audit, so it is the cleanest it has ever been. Themes that fit
   the fiction: bathroom tiles, a garage workbench, a bookshelf (the first map
   with real corridors), a patio, a picnic table. **Two specific gaps:** Wave
   Survival is one board wide, so the whole mode is one experience; and every map
   is a four-corner 64 or 72, so a small two-player board would make a ten-minute
   match possible, which is currently the shortest thing the game offers.
   *Impact high · effort medium each · balance risk low.*
3. **Fix Blue, then Gray.** MEASURED at v103, 32 matches: Blue and Gray win 9%
   each against an even share of 25%. See the balance section below for the table
   and the shapes. Half the armies are not worth picking, and this is the most
   tractable item here because it is the one you can measure — `probe_v89.sh`
   before touching a price, per rule 8. *Impact high · effort medium · balance
   risk: it IS the balance.*
4. ~~**Teach the bots the other eight unit abilities.**~~ **DELIVERED at v106.**
   Its inventory was WRONG, which the release records: Called Shot was driven at
   v81 and Broadcast at v86, so the real count was 5 driven and 6 not, and
   "Ripple Fire at a clump" was refuted by measurement (better even against one
   man; always-on is right, as v81 had already said). Six are driven now and the
   probe that proves it is `harness/probe_v106.sh`. What is NOT done and is
   measured as a separate problem: a bot transport is loaded 0.0% of the time, so
   Air Assault has no occasion, and a bot's Command Truck sits with the base, so
   Broadcast rarely fires — both are positioning, not abilities. The original
   note, kept because its reasoning is still the argument for the item:
   MEASURED: `aiTick` drives
   3 of the 11 rows in `UNIT_TOGGLES` — `entrench`, `rally`, `valve`. It never
   uses `smokeCap`, `cshot`, `ripple`, `throttle`, `flat`, `aslt`, `sprint` or
   `bcast`. (It handles the BUILDING abilities well: garrisons, Lockdown,
   Overdrive, Pour, Regroup, the uplink, the balloon bail-out and every
   `RADIO_ABILITIES` call-down.) So a CPU Gray never fires a Called Shot, a CPU
   Tan never charges the Bull, a CPU Blue never sprints — the abilities that give
   each army its character are exactly the ones a player never sees used against
   them. Two payoffs from one job: Hard gets harder without touching a stat, and
   the player learns their own roster by being on the receiving end. Some are
   nearly free (Ripple Fire at a clump, Scramble on aircraft heading home);
   `throttle` needs real judgement, because it silences both of the Bull's guns.
   Measure the MECHANISM (per-ability usage counts), not the win rate.
   *Impact high · effort medium · balance risk: raises bot strength.*

### Band 2 — worth doing

5. **Texture the ground.** The one visual layer roadmap 3 never reached, and the
   largest surface on screen. The four-script pipeline (`dump_base_v95.js` →
   `material_v95.py` → `normal_v96.py` → `embed_img.py`) points at ground tiles
   with no new machinery — five themes, a handful of variants each — and they
   would pick up the v96 band lighting for free, so the lawn would catch an
   explosion's glow the way a tank already does. Band 2 rather than band 1 on
   scope honesty, not on value. *Impact high (visual) · effort high · risk none.*
6. **Give a stalemate a way to end.** MEASURED: 6 of 32 matches ran out the
   clock; median length 13–16 minutes. The economy is already finite (nodes
   deplete and are removed, wrecks pay back 50%) but nothing escalates when the
   map is stripped. Cheapest first: **score the timeout** so it resolves for
   whoever is ahead rather than as a shrug; **wake the wildlife** with a late
   nest surge, which reuses `SURV_WAVES` machinery and fits the fiction; or
   shrink the board, which is the most dramatic and least in keeping.
   *Impact medium · effort low · balance risk low.*
7. **Revive the two defensive doctrines.** MEASURED: `turtle` won 3 of 26 and
   `defensive` 3 of 27, against ~38% for the aggressive pair. v90 fixed
   `defensive` by moving `firstPush` and it has slipped back; `turtle` has
   responded to nothing across several passes, which is itself the finding — a
   doctrine that only turtles cannot win a game whose victory condition is
   elimination. It may need a WAY to win rather than better numbers, which makes
   this and item 6 the same problem from two sides. *Impact medium · effort low ·
   balance risk medium.*
8. **Weather, per map.** v101 proved the seam: one multiply fill over the
   finished world canvas, in the single place both the WebGL compositor and the
   2d fallback consume. Rain on the kitchen tiles, a dust haze over the sandbox,
   a draught through the carpet fibres. Keep it COSMETIC — the moment rain slows
   movement it is a second day/night cycle to balance, and this is meant to be
   the cheap one. *Impact medium · effort low · risk none if cosmetic.*
9. **Two missing keys.** There is no "select my idle Dump Truck" and no "select
   my whole army". Both are reflexes every RTS player has, and the idle-worker
   one pays for itself constantly because a truck that finishes a pile and stands
   still is invisible until income quietly stops. There is keyboard room: after
   v98 the number row is abilities and F1–F9 are groups. *Impact small but daily ·
   effort low · risk none.*

### Band 3 — big swings (each a project, not a release)

10. **A campaign, or any reason to play in order.** Nothing persists between
    matches except the minimap size (`pw_mmsize` is the only `localStorage` key
    in the game). Every ingredient exists — four modes, victory conditions, the
    wave table, testing mode, spectate. What is missing is the frame: a dozen
    hand-set scenarios with a stated objective ("hold the counter five minutes
    with no Barracks", "kill the nest before dawn", "win with Blue"). The small
    version is a scenario list plus a completed flag and is genuinely achievable;
    it would change what the game IS. *Impact: changes the game · effort high ·
    balance risk low.*
11. **A fifth army.** The machinery takes one without inventing anything: an army
    is a `FAC` row, three exclusive units, two exclusive buildings and one
    `RADIO_ABILITIES` row carrying `fac`. It is in band 3 only because **two of
    the four you have do not work** — adding a fifth first means three armies
    nobody picks instead of two. Do item 3 first and this becomes attractive,
    because roadmap 2 already debugged the process. *Impact medium · effort high ·
    balance risk high.*
12. **Height.** The board is perfectly flat; "High Ground" exists as a name (the
    balloon's `HIGH_RG` aura) and nowhere as terrain. Real elevation is the most
    transformative mechanic still missing and by a distance the most dangerous
    thing on this list — it touches pathfinding, line of sight, projectile arcs,
    the fog, the sprite sort order and every painter, and it would put the
    deterministic simulation (the genuinely hard, genuinely tested part of the
    project) back on the table. **The honest advice is don't**, unless the next
    six months are meant to be that. A cheaper 80%: a few impassable raised props
    that block line of sight, so cover means something without the ground moving.
    *Impact transformative · effort very high · balance risk destabilising.*

**The order proposed, if the owner wants one.** The music half of item 1 is
done and needed no repin, as this section predicted. What was next in that plan,
unchanged:

- **the barks** — the rest of item 1, and small enough to ride with anything else;
- **two new battlefields plus a second survival board** (item 2), the best
  value-per-effort left, and the one thing every mode benefits from at once;
- **the armies pass** (items 3 and 4) — Blue, then Gray, then the eight unit
  abilities the bots never use, which raises the ceiling on Hard and shows off
  the fixes at the same time.

None of that is agreed; it is what the v103 review would have done next.

## Roadmap 3 — real art and real sound (COMPLETE, v91–v97)

The game moved from hand-drawn canvases and synthesised audio to textured,
per-pixel-lit sprites and recorded sound, one additive phase per release, while
playing exactly the same. Full evidence and per-phase records are in
`harness/README.md`; what follows is the map of what now exists and the
standing invariants.

**What did NOT change, and must not:** the deterministic core, `srand()`, the
lockstep hash trails, `hashState` / `loadState`, and the rule that a rendering
path never draws from the seeded stream. `update()` runs the game and the
renderer draws it — that seam is deliberate and load-bearing. Every phase
landed with the trails untouched; a render change that moves a trail has a bug.

- **v91 — the split.** `source/` + `order.txt` + root `build.sh`, cut at line
  boundaries and proved byte-identical to the single file. `assetsLoad()` runs
  at page open and only the Start button awaits it, so `newGame()` stays
  synchronous for the hundreds of fixtures that call it. T66.
- **v92 — recorded audio.** `ASSET_MANIFEST.snd` filled with 33 takes,
  decode-on-demand, synthesis the permanent fallback. The takes are
  offline-RENDERED from the tuned synthesis recipes (`tools/render_snd_v92.py`),
  each swappable one file at a time. `file://` refuses relative `fetch()`, which
  is why every asset ships as a `data:` URL inside the page. Ten positional
  one-shot voices are recorded; ambience, engines and UI tones stay synthesised
  on purpose. **`SNDV` is the only mixing desk** — the takes are
  peak-normalised. T67.
- **v92.1 — the audio feedback pass.** Eight owner findings, each a change and
  a check (T68): small arms RICOCHET off armor (`sfxRico`, fed from `applyDmg`,
  Math.random only); nest destruction is SILENT by decision (`sfxNestBreak` is
  deliberately empty — do not "fix" it); a wall dying under fire detonates;
  selection answers are brief; the sniper is pinned the loudest gun.
- **v93/v94 — the WebGL stage.** A dependency-free stage (`25b-webgl.js`)
  presents the 2d-drawn world through real shaders — bloom, tilt-shift, grade,
  vignette — with `compositePost()` the permanent fallback and one `POSTV`
  table feeding both looks. The planned wholesale renderer swap (PixiJS) was
  dropped on a measurement: the cell blit is a minority of the world pass. v94
  isolated the depth-sorted sprite band onto its own canvas, merged through
  `bandPresent()` — the seam lighting later slotted into. Software GL is
  refused (`failIfMajorPerformanceCaveat`; `#forcegl` overrides, `#nogl`
  disables GL entirely). T69, T70.
- **v95 — real textures, whole roster.** Every baked sprite draws from a WebP
  texture in the manifest; the seam is `imgAsset()` in `bakeSprites()`, a hit
  becomes a cell via `cellFromImg()` (identical shape to `bakeCell`, so draw
  sites, shadows and portraits cannot tell), a miss falls back to the painter.
  The textures are offline-rendered FROM the game's own painters
  (`tools/dump_base_v95.js`, roster DERIVED from `U`/`B`/`FAC`) plus a
  material pass (`tools/material_v95.py`) — the relight-everything first cut
  looked WORSE than the painter; the shipped recipe keeps the painter's shading
  and adds only high-frequency material. T71.
- **v96 — normal maps and lighting.** Every texture gained a normal map
  (`tools/normal_v96.py`, SAME rng recipe as the material pass so color grain
  and relief grain agree), the band pass mirrors them onto a second canvas in
  register (`NCTX`; rotating vehicles pick a heading-quantized variant with the
  VECTORS rotated), and the band shader lights per pixel: constant lamp,
  plastic specular, up to ten point lights from explosions, burning ground and
  muzzle flashes — every source vision-gated, because light through fog would
  be a wallhack. **The lighting is a normalized MODULATION: a flat pixel comes
  out exactly as it went in**, so every fallback rung still shows the unlit
  pixels. `LIGHTV` is the one tuning table. T72.
- **v96.1 — the graphics feedback pass.** Three owner findings (T73): the
  walls joined the texture pass (`BARR_BOX`, cells in `SPR.barr`, the hedgehog
  painter the fallback — deliberately no baked cell behind a wall); flame casts
  real light (`LIGHTV.flame` at the stream's midpoint — the muzzle source
  correctly skips weapon class 'f', which had silently meant "no light");
  infantry normal maps regenerated gentler (`KIND_NRM`) — the wash-out was
  data, not shader.
- **v97 — the detail & resolution pass.** "Blurry" and "simplistic" had
  separate causes (T74). Blur: the canvases were CSS-pixel sized, so every
  high-DPI display got a browser-upscaled frame — backing stores are device
  pixels now (`RDPR`, capped at 2, `#dpr1` escape) and RDPR multiplies exactly
  one thing, the renderer's transform; everything else (G.zoom, G.cam, MOUSE,
  audAt, camera clamps) stays in CSS pixels via `vpW()/vpH()`, DERIVED from the
  canvas, so the sim, input math and headless suite (shim pins
  devicePixelRatio=1) are untouched. The bake supersample went `SS` 3 → 4, the
  offline pipeline to RS=8. Simplicity: a deterministic molded-detail kit in
  the painters (`wallPanels`/`roofPanels`/`wallBolts`/`drumAt`/`crateAt`/
  `hullSeam`…, `prism` `opt.det` on all sixteen prism hulls) plus bespoke
  greebles per building, vehicle, trooper, wall, nest and bug — the painters
  are the texture source, so the whole set was re-rendered and the detail shows
  textured AND in the fallback.

**Standing traps for the next renderer/asset session:**

- **A canvas is a replaced element.** `inset:0` positions it but never
  stretches it — a device-pixel canvas needs an explicit CSS size (`glSize`
  owns the GL canvas's), and assigning `style.cssText` after setting it wipes
  the width.
- **The texture pipeline is four scripts, in order:** `dump_base_v95.js`
  (Chromium, renders the painters; clears `ASSETS.img` first because
  `drawBarricade` prefers a texture cell and would re-dump the previous
  release's walls) → `material_v95.py` → `normal_v96.py` (the two MUST share
  the RS/SS grid) → `embed_img.py`. Detail in the painters must be
  deterministic (`dth` hash, no RNG) or it shears against its own normal map.
- **The one supersample constant is `SS`** in `20-render-library.js`; the
  offline RS is 2×SS. T74.C reads real WebP header dimensions and fails if the
  committed set is at the wrong grid.

## v107.3 — the tub and the towel (the third owner pass on v107)

The owner said the bathtub and the white bath mat were overexposed — blank
white. `tail_v107_3.js` (T92, 20 checks; the suite is 6,830 now); full
evidence in the v107.3 section of `harness/README.md`. **No trail moved and no
repin was due**: two painters, and T92.C re-cuts the Bathroom's layout hashes
and pins the towel's rectangle, since a patch is not in the layout hash.

- **A GRADIENT WIDER THAN THE SHAPE IT FILLS HAS NO SHADING IN IT.** The tub's
  floor was one radial gradient of radius `rx*1.414*HW` — **430px** on a basin
  whose own screen radius is **215–299px**. The whole shape sat in the first
  stops, so of three declared stops one was ever visible: a flat white disc,
  ~20 levels of light across it. Every radius is derived from the polygon
  `tubPath` actually walks now (193px, inside even the short axis), and the tub
  is painted as a BASIN — a wall ring in shadow, then the floor inside it —
  because a shape-following ring shades an ellipse evenly where a radial
  gradient cannot. **75 levels** now.
- **The contrast is the check, not the colour.** The "white bath mat" is the
  dropped TOWEL (the coloured mat is a different object and was fine). It stood
  **9 levels of light** off the floor after v107.2 warmed the porcelain; it
  stands **65** now, painted as cloth — body, fold, woven bands, hem, terry pile
  off `dth`, and a shadow.
- **THE FIRST CUT OF THAT FIX CONTAINED THE BUG AGAIN**: the towel's hue was
  rolled off `dth` out of {teal, sand, blue}, and sand on warm cream is the same
  washed-out slab in another hue — it came up on three seeds in four. One hue,
  chosen against the floor, and T92.B asserts the DISTANCE from the floor's own
  tone so a future palette change cannot quietly undo it.
- **One cleanup:** v107.1 and v107.2 had each added a private copy of the
  version pin. Both are deleted rather than bumped — `T75.B` is the one v98
  designed for it. One conscious edit per release is rule 5 working; three
  copies of it are cost.

## v107.2 — the Bathroom Floor's own floor (the second owner pass on v107)

The owner asked for the Bathroom's basic tile design to be changed: it looked
too much like the Kitchen Counter. `tail_v107_2.js` (T91, 22 checks; the suite is
6,810 now); full evidence in the v107.2 section of `harness/README.md`.
**No trail moved and no repin was due** — this is a painter, and T91.C re-cuts
the Bathroom's own v107 layout hashes to prove the map itself is byte-identical.

- **It WAS the kitchen's floor.** Same pattern (a square grout grid), same
  second-tone checkerboard, same gloss sweeps, same cool grey-blue family
  (`#e6ecef` against `#d6dde1`); only the grid's pitch differed, 2 tiles against
  4. **A pattern that differs only in pitch is the same pattern**, so a finer
  grid would have earned the same note a third time.
- **The floor is a HEXAGON MOSAIC now** — 3,465 small hexagons, warm porcelain
  (`#ece6dc`), dark grout, a scattered 8.9% of taupe accent tiles, each tile
  domed by a smaller offset hexagon so it reads as glaze. The ground tiles under
  it went nearly flat (±1.5% from ±9%), because a per-tile wobble under a hex
  grid shows through as a second SQUARE grid.

Three things worth carrying forward:

- **LAY A PATTERN IN WORLD SPACE, NOT ON THE SCREEN.** The iso projection is
  linear, so a regular world hexagon comes out skewed on screen and still tiles
  perfectly — and the mosaic lies DOWN with the board. A screen-space hex grid
  would have been regular and would have read as a sticker over an isometric
  board. The TEST had to learn it too: T91.A's first cut measured neighbour
  spacing in pixels, found three different distances because the projection
  halves y, and called the mosaic irregular. Inverting the projection is the
  whole fix, and it turns the check into the design claim.
- **A lattice has no idea where the mat ends.** Every other floor painter walks
  `0..N` and is bounded for free; this one overruns on all four sides and is
  clipped to the slab. T91.A attributes the clip to the board's own four corners
  rather than counting clips — the bake makes 14, so a count would have passed
  on somebody else's.
- **A recorder that carries stale state answers about the wrong path.** T91's
  canvas proxy tagged each path with the standing fill colour and only updated
  the tag for STRINGS, so the tub's gradient-filled floor inherited the last
  glaze colour and read as one extra hexagon. A non-string must clear the tag.

## v107.1 — the Attic, pulled in (the owner's feedback pass on v107)

Five asks from playing v107's Attic, each a change AND a check. `tail_v107_1.js`
(T90, 35 checks; the suite is 6,787 now); full evidence in the v107.1 section of
`harness/README.md`. **No trail moved and no repin was due** — every change is
gated on the sided map's own flags (`def.t2v2`, `G.map.sides`); the Attic's
three T89.H layout pins were recut as a conscious edit and the Bathroom's held.

- **The walls came in seven rows** (`FRONT` 24 → 17, the wall rows 17-23) **and
  every stretch gained a layer**: hedgehogs 141-170 → 230-254 per map, crates
  24-32 → 38-42. Directly in front of each base the innermost row is CRATES,
  because a hedgehog may not stand within ten tiles of a start and at row 17
  that is exactly the six tiles in front of it.
- **Each base has a second home expansion** on its flank, 17 tiles out toward
  the corner (the contested sites' 1400/1300), and **the natural moved to the
  same flank** — aimed at the centre it stood in the new wall band and would
  have been the doorway. Both sit at rows ≤ 12, so no pocket reaches the wall;
  the four contested mid expansions are outside the walls now.
- **A bot never clears its own half's neutral obstacles on a sided map** — one
  line in `nearestEnemy`, read off `p.start`, which is in the snapshot.
- **Three more mirrored pairs of mines around the middle** (`MID_MINE_PAIRS`,
  `midMines`): measured first at 0-2 within ten tiles of the centre, mean 1.8,
  on some seeds none; 6-12 now. The manual spends it through `data-tune`.

Three things worth carrying forward:

- **A WALL PULLED TOWARD A BASE MEETS THE BASE'S OWN NODES.** The forward pile
  jitters to row 16.5, a crate on row 17 refuses a node within 2.8, and the
  crate wall in front of each base lost one to three of its four pairs on half
  the seeds — read in a frame first, then measured (34-42 crates). The sided
  map's home nodes jitter 1.0 instead of 2.2 now (same draws) and the band is
  38-42. **When you move a line, list what the line's placer refuses and ask
  what now stands inside that radius.**
- **"To the side of each base" and "pull the walls in" were one geometry
  problem.** With the wall at row 17 and the base's own nodes at rows 6-16,
  the only room inside a compound is along the edge, outboard of each base —
  which is also where the natural had to go. The natural on a sided map is
  aimed by the same ladder with a different vector, not by a second placer.
- **A fixture that kills "every unit" twice kills its own subject.** T90.E's
  clearer was dead for four assertions and they all passed, because a dead
  unit object still has a position. The save/load step was the one that
  noticed. Give the sweep a `keep`.

## v107 — the Bathroom Floor and The Attic (Roadmap 4 item 2, in part)

**Two new battlefields, and the first one built for a team battle.**
`tail_v107.js` (T89, 113 checks; the suite is 6,716 now). Full evidence in
the v107 section of `harness/README.md`. **No trail moved and no repin was due**
— every existing layout is byte-identical (the 30- and 42-pin gates both held),
because every new rule is gated on the new maps' own flags.

- **Bathroom Floor** is a standard four-corner 72 on porcelain tile: the shared
  economy and lane passes, and a DRAINED BATHTUB ringing the centre cache — a
  sealed oval of rim segments with two gates at its long ends — plus soap slicks
  (a burn hazard), soapy bathwater (impassable), a bath mat, toiletries, a duck.
- **The Attic** is the game's first SIDED map. `MAPS.attic.t2v2` marks it: its
  four starts are two pairs along the north and south edges (`M.sides`), picking
  it deals the lobby a 2v2 (`menuPickMap`), and `newGame` seats allies on one
  side. Each pair sits inside a partly enclosed COMPOUND: a front line of
  destructible level art — 2x2 neutral `crate` structures, as tough as a Bunker,
  drawn as boxes, a trunk or a bale of magazines — mixed with three staggered
  layers of neutral hedgehogs, three gates a side.
- **Level art that can be shot down is a B row with `lvl:1`**, owned by
  `G.neutral` exactly as the nests and hedgehogs are, so `kill()`, targeting and
  pathing already knew what to do with one. It is painter-only (no texture, no
  baked cell, no manual card, never on a menu); `drawLevelArt` paints it live the
  way `drawBarricade` paints a wall. A bot chews through one at the hedgehog's
  low priority (`t.barr||t.lvl`, one rule); a player never auto-targets one.

Five things worth carrying forward:

- **THE TUB LEAKED THREE TIMES, AND ONLY A FLOOD FILL EVER SAW IT.** A ring of
  blocking props at the bucket fortress's spacing left a passable tile between
  segments at the oval's flat ends; an axis-aligned oval reached to within the
  prop refusal of the mid expansions and lost a segment beside its gates on one
  seed in seven; and the pocket-clearing pass at the foot of `makeMap` handed
  back a rim tile that sat inside an expansion's pocket on one seed in six. Each
  was found by the same instrument — block the gates, flood from a start, ask
  whether the inside is reachable — and each fix is recorded on the rim itself.
  The shipped tub is diagonal, laid by its own placer, and its map jitters the
  mid expansions less (`MAPS.bathroom.midJit`), with the two rnd() draws
  unchanged so nothing else moves. **A sealed ring is a claim, not a shape.**
- **A SIDED MAP BREAKS THE LANE PASSES' QUIET ASSUMPTION.** `edgeClutter` and
  `laneBarr` walk base-to-base PAIRS that on the Attic are TEAMMATES, so they
  would lay a pond and a roadblock between two allies inside one compound. The
  Attic skips them and lays its own lines; `laneClutter`'s "toward the centre"
  walk is fine and is kept. The start ORDER still keeps `[0]<->[1]` and
  `[2]<->[3]` as point mirrors, which is what every mirrored pass relies on.
- **A pair is laid BOTH OR NEITHER.** Laying each crate of a mirrored pair on its
  own merits gave one compound a crate the other did not have on one seed in six.
  That is the v103 drowning rule again: an obstacle one army has and the other
  does not is a balance change smuggled in as scenery.
- **ART-AWARE PICKS, GATED ON THE MAP.** On the Attic, `farPropArt` counts the
  crates and the compound hedgehogs as art, so the compound is laid FIRST and the
  clutter builds around it — a box is never dropped on a wall and the wall is
  never short a crate because a box got there first. Gated on `t2v2` because
  refusing more spots changes which pick a pass accepts, and the other five
  layouts are pinned. The crate placer asks the props-only version: crates stand
  shoulder to shoulder and keep their own overlap rule.
- **RULE 7, FOUR TIMES.** The rim read as a dotted ring (spacing), the bath mat
  and the towel lay across the tub floor (the tub was not a region; now its
  square is registered first), a hedgehog cluster stood IN the tub (the scatter
  annulus crosses it; `barrTile` refuses the oval), and every crate on a front
  row drew the same look (`(tx*3+ty*7)%3` — a multiple of 3 on `tx` made the hash
  blind to x). None could fail a test; all four came out of real frames.

**What sim.sh now measures.** It deals SIX deathmatch maps (12 matches by default,
2 per map), so the balance table below — cut on four maps — is not reproduced by
a default batch any more; `SEED0` and the per-map deal are what changed, not the
matches themselves. On a sided map `sim_dm.js`'s free-for-all seats one army per
spot.

## v106 — the unit abilities a bot never used (Roadmap 4 item 4)

**Six abilities a CPU army owned and never switched on are now driven.**
`tail_v106.js` (T88, 42 checks; the suite is 6,083 now), plus
`harness/probe_v106.sh` — the measurement tool the release is built on. Full
evidence in the v106 section of `harness/README.md`. **Every hash trail moved and
all five trail tables were recut**: this is the first release since v103 to need
a repin, and `recut_v106` / `repin_v106` are the carried-forward pair.

- **Smoke Rounds, Full Throttle, Flat Out and Sprint** went from **0.0% of
  carrier-ticks to 5.4–14.7%, 39.8–43.8%, 10.1–30.2% and 14.4–29.7%.**
- **Ripple Fire** is on for a bot battery — a measurement, not a guess (below).
- **Air Assault** is wired and still reads 0%, for a reason that is measured and
  is not the rule (below).

Five things worth carrying forward:

- **THE ROADMAP NOTE WAS WRONG ABOUT ITS OWN INVENTORY.** Item 4 said `aiTick`
  drives 3 of the 11 toggles and named eight it never used. Called Shot has been
  driven since **v81** and Broadcast since **v86** — both predate the note — so
  the real count was 5 driven, 6 not. Building the instrument first is what
  found that. **T88.A now derives the inventory off `UNIT_TOGGLES`**, so a
  twelfth toggle cannot ship unwired and unremarked.
- **The three that silence guns share one shape, and it is the whole design.**
  Full Throttle, Flat Out and Sprint buy speed by giving up shooting, so each is
  spent on TRAVEL and never on a fight: on only while going somewhere AND while
  the nearest thing it could shoot is further off than it can shoot. Sprint is
  gated widest by a real margin because it is the only one that silences OTHER
  units — every friendly infantryman in radius, not just its carrier.
- **Reusing `nearestEnemy` — the SIM'S OWN acquisition helper — bought a correct
  answer nobody designed.** It honours concealment, so a bot cannot charge past a
  sniper it could not see; and it hands infantry to a unit's SECONDARY, so **a
  charging Bull does not throttle down for foot soldiers.** That is right, and
  `crush80` is why: a charge kills outright any infantryman inside `THROTTLE_R`
  and any barricade, with no damage roll. It stops for what it has to SHOOT.
  A hand-written proximity scan would have got that wrong.
- **"It does not fire" and "the rule is wrong" are different claims, and only
  measurement separates them.** Air Assault still reads 0% — because a bot
  transport is LOADED on **0.0%** of samples (six matches, `maxAboard 0`,
  `carry-jobs 0`): the v48 carry job needs a free transport AND six infantry in
  one wave at one launch. That is a transport-doctrine question, not an ability
  one, and the release says so rather than widening into it. Broadcast's
  0.0–8.5% is the same shape: its truck sits with the base while the fighting is
  elsewhere.
- **AN A/B THAT SWAPS `plastic-warfare.html` IS NOT AN A/B.** `harness/build.sh`
  chains to the root build, which REGENERATES that file from `source/` — so the
  first attempt overwrote the base before a match ran, measured v106 against
  itself, and reported byte-identical win counts for both seed sets. That is
  exactly what a clean null result looks like. **Run the base out of a `git
  worktree`,** and print something from the file you actually ran so the log
  carries its own proof.

**What the outcome measurement can say, and what it cannot.** 32 matches per side
on identical seeds: matches end slightly sooner (medians 994→926s and 769→739s,
one fewer clock-out of 32) and no army moved outside the batch wobble. Every army
got the abilities, so an all-CPU batch cannot answer "are the bots stronger" — it
can only say whether the balance BETWEEN armies moved, and it did not. The
mechanism is the deliverable; rule 8, again.

## v105.1 — two owner bug fixes (the feedback pass on v105)

Both found by the owner playing v105. `tail_v105_1.js` (T87, 30 checks; the suite
is 6,039 now); full evidence in the v105.1 section of `harness/README.md`. **No
trail moved and no repin was due** — one bug is a UI catalog, the other a painter.

- **Three exclusive structures had no research button, and the BOTS could build
  them.** `researchCatalog` was `LAB_ORDER.filter(...)` — the hand-typed list was
  not the catalog's ORDER, it WAS the catalog. Green's Command Post (v86), Tan's
  Foundry (v87) and Gray's Heavy Barricade (v88) were never added to it, so
  three armies in four could not research their second exclusive structure. Blue
  is whole because v85 was the last release that remembered.
- **The menu parade drew hulls with no turrets** — and so did the Field Manual,
  which since v105 is painted on that same parade.

Four things worth carrying forward:

- **THE ASYMMETRY IS THE FINDING, not the missing button.** `aiResearch` builds
  its wishlist off `RESEARCH` and pushes `FAC[p.fac].ub` first; it never reads
  `LAB_ORDER`. So a CPU Green has been putting up Command Posts since v86
  against a human who could not build one, for nineteen releases. Nothing caught
  it because every existing check asked `RESEARCH` or `techAvailable` and both
  were right the whole time. **When a hand-typed list sits between a correct
  table and the player, ask who ELSE reads the table.**
- **A hand-typed list may ORDER a catalog and must not BE one.** `LAB_ORDER`
  still declares the reading order; `researchCatalog` is derived from `RESEARCH`
  + `TECH_BLD` + `techAvailable` and sorts by that list's positions, so a name it
  forgets rides at the end of its own kind instead of falling off the panel.
  T87.A proves that by SPLICING a key out of `LAB_ORDER` at runtime and asserting
  the catalog still offers it — a `const` array is still a mutable one, and that
  turns "is this derived" into something a test can drive rather than read.
- **A turret is not in the baked cell.** It is painted live on top, which is why
  drawing the cell and stopping loses it. `vehTurret(c,key,col,rot)` is the one
  painter now — `drawUnit`'s two branches, `vehPortraitPaint` and `menubgPaint` —
  and its MEMBERSHIP is `TURR_PORTRAIT`'s own key set, which was already the
  answer to "does this hull wear one". So the Rocket Artillery (launcher baked
  into its hull) is refused by the same table that gives the Bull its 1.34, and
  `AA_PIVOT` stopped being restated at each call site. Same shape as v105's
  `heliRotor`, and the same rule: lift it out, never copy it.
- **Two of this pass's own checks were wrong first, both by asserting a SHAPE
  instead of the claim.** One expected a flat ten-key order and failed on Blue,
  who never sees three of those ten. The other measured the Bull's turret
  placement by summing every `translate`/`scale` in the paint log — which
  measures the ARTWORK, since `plSphere` translates internally — and assumed the
  Bull's turret was the Tank's scaled up, which it is not (`tankTurret` draws it
  a longer barrel off its own `big` branch). Both are stated against a control
  now: per-army availability, and the bare painter's own log.

## v105 — the whole roster parades, and the manual joins it (not part of a roadmap)

Two owner asks about the menu. `tail_v105.js` (T86, 36 checks; the suite is
6,009 at that release); full evidence in the v105 section of `harness/README.md`. **No trail
moved and no repin was due** — both asks are presentation, and all 30 layout
pins held.

- **Every unit in the game marches, and there are four times as many of them.**
  `MENUBG_LANES` went from twelve entries over four lanes (only NINE distinct
  units — the Grunt was in all four) to **all 26 rows of `U` over six lanes,
  each unit appearing exactly once**, and from 17 marchers to 70. The private
  cache grew only 56 → 66 cells, and the reason is that one-army rule: nothing
  is baked twice. **Lane 1 is the flight** — the four helicopters and the
  balloon, lifted the same 34px `drawUnit` lifts a flyer, with the shadow left
  on the floor.
- **The Field Manual is painted on the same parade ground.** The backdrop paints
  while the manual is open (including opened from the HUD mid-match), the
  panel's v31 gradient went translucent, and the canvas **climbs to z-index 39**
  while it is serving the manual.

Five things worth carrying forward:

- **THE Z-INDEX IS THE WHOLE TRICK, and it is the half that is easy to miss.**
  `#menuBg` is z-index 1 — under `#setup` (30) and under the HUD (10), which is
  correct for a backdrop. Make the manual (40) translucent without moving the
  canvas and what reads through is the setup screen's own cards, or the live
  HUD, never the parade. `#menuBg.front` at 39 is above both and still under the
  manual. T86.F scrapes all four numbers out of the stylesheet and asserts the
  ORDER, on T65.B's precedent, rather than transcribing any of them.
- **A quantity that changed UNITS took a multiplier with it.** `off` went from an
  absolute pixel gap to a fraction of the wrap span (which is what makes the
  parade spread across a wide window instead of bunching into its first
  1,200px). The frame passed `tick+m.off*.01` for the per-man animation phase —
  correct when `off` was ~1,500, and with `off` in 0..1 it silently became every
  man in the game bobbing in lockstep. Nothing would have failed. **Grep for
  what multiplies a quantity before you change what it measures.**
- **The rotor was LIFTED OUT of `drawUnit`, not copied.** `heliRotor(c,key,rot)`
  paints at the caller's transform so the 1.25 tandem scale stays with the
  caller, and both call sites are asserted to reach it. Its spin is derived from
  the menu clock rather than accumulated on the marcher, so reduced motion
  freezes the blades with everything else.
- **"Is the whole roster on parade" is a question `U` already answers.** T86.A
  is derived, so a 27th unit fails the suite until it is given a lane — the same
  conscious-edit rule as T71.A's texture roster. And an exclusive's colours are
  not the lane's to decide: `menubgFacOf` defers to the manual's `infoFacOf`,
  so there is no second ownership list to fall out of step with `FAC`.
- **Rule 7 paid for itself three times.** 41 marchers passed every check and
  still read as a thin scatter in a real frame (70 is what the frame wanted);
  the first manual scrim at .80/.86/.90 was legible and reduced the parade to
  texture (.70/.77/.82 shipped); and headless Chromium's `--window-size` is not
  the viewport — at 1600x900 `innerHeight` is 813 and the screenshot is 900, so
  the bottom 87px of browser chrome looks exactly like a backdrop that stops
  short of the screen. It reproduces on `origin/main`, which is how it was ruled
  out.

## v104 / v104.1 / v104.2 / v104.3 / v104.4 — the soundtrack (Roadmap 4 item 1)

**The game has music**, and it is the first Roadmap 4 item delivered. Four
recorded tracks by the **United States Army Old Guard Fife and Drum Corps** —
menu march, build-up loop, combat loop, victory fanfare — chosen by the owner by
ear from a 17-track audition page. `tail_v104.js` (T81, 43 checks in the suite; 41 run standalone - two need an AudioContext, which an earlier tail in segment 3 supplies as a stub); full evidence
in the v104 section of `harness/README.md`. **No trail moved and no repin was
due**: music is presentation, and `triage.sh` said "sim unchanged" first time.

- **The licence is first-hand for once.** The Old Guard is a serving US Army
  unit, so its recordings are works of the federal government and public domain
  under 17 USC 105 — not resting on a mirror's CC0 label. That matters because
  the game is one double-clickable file with no credits screen, so an
  attribution licence would have nowhere to put the attribution.
- **`03b-music.js` is client-local presentation, top to bottom.** Nothing is in
  `hashState` or the snapshot, nothing calls `srand()`, and `musTick()` reads the
  game but never writes it — so one player's failed decode cannot desync a
  lockstep match. That is rule 2 and the `G.cam` precedent applied to a
  subsystem it is very tempting to give state to. T81.C asserts all three.
- **It reuses the two audio mechanisms that already existed** rather than
  inventing any: `armsBus` is the pattern for the music bus off `masterGain`,
  and `COMBAT_DUCK_T` — the "guns are going off" clock since v27.1 — does two
  jobs, ducking the score while true and holding the combat track for
  `MUS_COMBAT_T` after it goes quiet so a lull cannot flap the music.
- **`sndLead` already solved the MP3 padding problem at v92.** The plan was OGG
  until Safari's unreliable Vorbis support ruled it out. MP3 then needs the
  encoder padding beaten, and v92 already measures the decoder's leading silence
  off the decoded samples because browsers differ. Music reuses it plus a 0.5s
  margin of real music outside the loop. **Grep for the function that already
  derives it** — the v102 lesson, again.
- **`musTick()` is called ABOVE `frame()`'s `if(!G) return`**, because the menu
  is exactly the `!G` case and would otherwise be the one screen with no music.
  T81.F pins the ordering, not just the call.

**The owner's feedback pass (v104.1), and the first finding is the big one:**

- **The victory sting had never played once.** `decodeAudioData` is async, so
  `musBuf()` answers null on the FIRST ask. A loop hides that — asked every
  frame, the second ask wins, it starts a beat late. A ONE-SHOT does not: it is
  asked once, at the instant it must sound. `ac()` had warmed `ASSETS.snd` since
  v92 and nothing warmed `ASSETS.mus`. **A one-shot asset needs warming in a way
  a loop never reveals.** `musWarm()`, called from `ac()` beside `sndWarm()`.
- **The menu march waited for a hover.** A browser will not start an
  AudioContext before the user interacts, so it cannot play on load — policy,
  not a bug. The bug was that only `menuAudioBind`'s HOVER tick ever called
  `ac()`, so a click on the page background left `AC` null. `musUnlock` listens
  on the document for pointer/touch/key and unbinds itself.
- **The duck buried the one track written to be heard under gunfire.** .45 x
  .38 = .171 during a firefight. Now .75 x .50 = .375. The duck stops music
  MASKING a gun cue; it is not there to silence it.
- **The sting fires on the owner's mop-up rule now** (`musDecided()`): one enemy
  left, and either they hold zero supply or you lead by more than
  `MUS_MOP_DELTA`. Both triggers go through `musVictory()`, which **consumes
  its once-per-match flag only on success** — a sting whose buffer is not ready
  retries rather than being spent. It is a VICTORY sting, so the lead must be
  yours; the owner's wording was direction-free and the name settled it.

**The owner's second pass (v104.2) — an audio mixer, and one real diagnosis:**

- **"Only the build-up music in spectate" was NOT a spectate bug.** The combat
  track was armed by `COMBAT_DUCK_T`, which `sfxGun` sets only AFTER its
  `audFor()` early return — so a shot off-screen arms nothing and the score
  followed the CAMERA rather than the battle. A spectator's camera never chases
  the fighting, which made it total; it was already wrong in a normal match with
  the view away from the front. `musFighting()` reads the sim instead.
  **`COMBAT_DUCK_T` remains right for the DUCK** — that one IS a camera question.
  Two questions, two readings; T83.D pins the separation.
- **The duck, third time — and the answer was not a third number.** .171, then
  .375, and the owner still could not hear it. A firefight is a dozen gun voices
  summing against one music voice, so there is no value that is right for
  everyone. .90 x .62 = .558 is the DEFAULT now and there is a fader.
  **When two tuning passes in a row miss, suspect the listener, not the number.**
- **Music and Effects sliders on the mute button** (`setVol`, `VOL_MAX` 1.5,
  stored in `localStorage` like `pw_mmsize`). They needed `sfxBus`, a node
  meaning "everything except the music", which the game had never had — every
  sound went straight to `masterGain` where music also lives.
- **Two checks were rewritten because their claim reversed on purpose:** the
  sting fires for a spectator now (they watched the whole match). An ELIMINATED
  player still gets nothing — they have a side and it lost.

**The owner's third pass (v104.3) — the sting becomes a track:**

- **Four asks that were one change.** Continuous while the conditions hold,
  continuous over the end-of-match graphs, overriding what is playing, mixed
  like the rest — every one of those is what a TRACK does and a sting cannot.
  So victory is a fourth loop (27.96s, seam 0.43x, the best of the four), and
  `musSting`/`musVictory`/`musVicDone` were removed rather than orphaned.
- **Two independent anti-flicker layers.** A SCHMITT GAP (`MUS_MOP_HYST`):
  start above `MUS_MOP_DELTA`, release below `MUS_MOP_DELTA - MUS_MOP_HYST`.
  And a TRAILING DWELL (`MUS_VIC_HOLD`) past the moment the relaxed rule lets
  go. Supply churns on every death and every build, so one threshold chatters.
- **THE FIRST MEASUREMENT OF THAT LIED AND LOOKED LIKE A PASS.** Driven with the
  human's 4-supply opening army, every margin went negative the moment the enemy
  built anything, so the DWELL held the latch and the gap was never exercised at
  all. **A probe that confirms your expectation is exactly when to ask which
  mechanism produced the result** — test the layers with the other one
  neutralised, or you have tested neither.
- **`endGame` plays nothing.** It records a client-local flag; `musWant` does
  the playing. `musWant` answers '' on `G.over` only when the ending earned no
  victory — which is the defeat screen.

**The owner's fourth pass (v104.4) — the tracks hand over instead of piling up:**

- **A CROSSFADE IS WRONG FOR MUSIC, and it was not even a crossfade.** Measured
  on the v104.3 build through a switch: old build 0.1597 against new combat
  0.1813 at t=0.25 — two marches in different keys at a comparable level — and
  `setTargetAtTime` is ASYMPTOTIC, so the outgoing gain floored at **0.0055 and
  stayed there for the life of the node**. A change of track is SEQUENCED now:
  `MUS_FADE_OUT` (a linear ramp, which actually reaches zero), `MUS_GAP` of real
  silence, then `MUS_FADE_IN`. Same total length; 0 overlapping frames measured.
- **THE FIX CONTAINED THE BUG IT WAS FIXING.** The first cut decided whether a
  gap was needed by reading `musKey` AFTER `musStop()` — which clears it — so it
  always skipped the gap and reproduced the overlay exactly. `const had=!!musKey`
  before the stop is the whole fix. **A sequencer that reads state its own
  previous step just cleared is a shape to watch for**, and T85.B pins the
  ordering rather than the audible result.
- **"In the camera FOV" narrows what v104.2 widened, so both asks had to be
  squared.** `musFighting()` still reads the SIMULATION — that is v104.2's fix,
  and the reason the track is not chosen by whether a sound played — but it is
  gated on `audAt()` for a player, and keeps the WHOLE-MAP reading under
  `G.watch`/`G.spectate`, who have no army for the camera to follow. Collapsing
  those two back together brings back a complaint from either v104.2 or v104.4.
- **`MUS_COMBAT_IN` is the entry buffer to `MUS_COMBAT_T`'s trailing one.** 1.5s
  of sustained fighting before the score commits; measured not armed at 1.35s,
  armed at 1.67s.
- **A live match undoes a hand-set unit state within a second**, so the first
  entry-buffer probe measured `updateUnit` rather than the buffer — while a
  stale count of other attackers made it look like the fight was still on.
  Its headless mirror: a fixture that does not tick has `fog===0` everywhere
  (2 by tick ~10), so every FOV check passes for the wrong reason.

**Two things that cost time and would cost it again:**

- **A `str.replace()` with no assert is a silent no-op.** A constant was
  "changed" by a patch that missed on whitespace and reported nothing, and the
  improvement was credited to it until the value was read back. Every patch in
  this release asserts its anchor first.
- **Rule 7 has an audio form.** You cannot hear a screenshot, but you can read
  the decoded buffer: loading the shipped file in real Chromium and printing
  each track's duration, channels and measured `pwOff` proved the loop points
  land where the cutter put them — and caught that the victory sting carried
  0.56s of the recording's own silence, which `sndLead` skipped so it sounded
  right by accident while wasting a twelfth of the sting's budget. No assertion
  would ever have shown it.

## v103 — the map layout audit (not part of a roadmap)

Three owner asks. Two are one-liners; the third is the release. `tail_v103.js`
(T80, 71 checks), and **`harness/audit_maps.js` + `harness/map_shot.sh` are the
two tools it added** — the numeric half and the looking half. Full evidence in
the v103 section of `harness/README.md`.

- **The artillery barrage walks at 1.5s between shells** (`BARRAGE_GAP`, was
  2.0): the walk closes from 13.6s to 10.6s and nothing else about it moves. The
  manual followed with no edit because the sentence already spent the constant
  through `data-tune="barrGap"`.
- **Every helicopter's selection voice is twice as loud** (`ROTORV` `g` only).
  Chop rate, blade rate, filter, window and the Chinook's tandem beat are what
  tell the three apart, T43.L pins them, and none of them moved.
- **The map audit.** The owner listed six defects and invited a sweep. All six
  reproduced and all six are fixed, plus four more found by sweeping. Measured
  over 40 seeds × 5 maps, before → after: art off the board 162 → 0; blocking
  props drowned in a liquid 379 → 2 (both line props, exempt on purpose); ground
  cover on liquid or under a blocker 2,067 → 0; barricades inside a prop's art
  119 → 0; seeds with two hazard kinds sharing tiles 88 → 2; art drawn through
  art 165 → 4; flat ground regions overlapping → 0.

**Five things worth carrying forward:**

- **"Off colour tiles on one side" was ONE TYPO IN THREE PASSES.** The grass
  mowed-stripes, the carpet vacuum banding and the kitchen's tile gloss all
  anchored their band at `isoX(i,0)` and ran N tiles in +x — which in tile space
  is a strip three tiles DEEP along one edge, so every band stacked into the same
  three rows and layered into a pale wedge at the rim. `isoX(0,i)` is the fix.
  **When a pass claims to sweep the board, check which axis it actually walks.**
- **A pass that gives up takes its last roll blind.** Teaching the hazard picks
  to REJECT a spot crossing another kind cut the clipping by two thirds and then
  stopped, because the lane blob must sit on a lane and kept running out of
  tries. Scoring the ladder and keeping the LEAST BAD roll took the rest to
  nearly zero. That is why `fldGap` returns a MARGIN and `farField` is only its
  yes/no reading.
- **Measure before you "finish the job".** The drowning removal stops at
  impassable LIQUID on purpose: a liquid is a hole in the ground, but quicksand,
  thorns, glue, grease and soda are ground. The same rule over burn hazards would
  have deleted 141 of the Sandbox's 1,150 props, **104 of them the bucket
  fortress's own walls**. The answer there was `KEEP` — ground no hazard may be
  laid over — not deleting the castle.
- **`propArtR` is not a second measurement.** `PROP_BLK`'s header says every
  entry is 0.85× the sprite radius, so the art reads back OUT of the collision
  table. `propBlkR` answers "what does this take away"; `propArtR` answers "how
  much does it COVER". A bookshelf blocks .70 and is drawn over .82, which is
  exactly how a hedgehog ended up standing inside one.
- **The layout gate ran as its own INVERSE, and that is allowed exactly once per
  reason.** v103 changes map generation on purpose, so `recut_v103.js` demands
  the pins MOVED (40 of 42 did; the two that held are `desk:22`, and only the
  Desk may hold). It still refuses a walk of the wrong number of pins. One trail
  table legitimately held — `BASE43_DESK`'s board generates identically, verified
  by hash — and `UNMOVED_OK` carries that reason rather than assuming it.

**The owner's feedback pass on the same release (played before merge):** two
findings, both about how a map READS rather than about geometry, both judged from
real Chromium frames.

- **The Kitchen's whites washed out.** The milk spill's gradient started at
  `#ffffff` with a 50% WHITE sheen over it, on a `#d6dde1` tile floor — a spill
  whose brightest point is pure white has no surface left to shade, so it clipped
  to a flat shape with no rim, no ripple rings and no body. The ramp comes down to
  a cream, the rim darkens, the sheen drops to .26, and the cosmetic puddle and
  the sheet-of-paper patch came down with it. Juice and coffee are untouched.
- **The lawn's barricade arcs.** Measured first: 100.6 tiles/seed in 25.9 clumps,
  mean nearest clump 5.9, clumps as close as 2.0 — long arcs, not scattered cover.
  `BARR_SEP` (8) is how far a NEW random cluster must start from every barricade
  already down, mirror included, **with no fallback** — which is what makes it
  reduce as well as spread, and it is global. The lawn also lays three random
  clusters instead of seven and two lane roadblocks per lane instead of three,
  because it is the one map where dark hedgehogs sit on bright grass. After:
  **60.9 tiles/seed in 17.1 clumps, mean nearest clump 7.5.** `laneBarr` is exempt
  from `BARR_SEP` on purpose: it is laid ACROSS a lane and its position is its job.

**Six older checks were EDITED, not repinned** (rule 5 in both directions):
`T51.B` and `T52.A` carry the barrage cadence and had to be re-stated; `T51.F`
pinned "the collision table does not move a single prop" and v103 makes it drive
placement deliberately, so it was **rewritten to the stronger opposite claim**;
`T40.F`'s hedgehog scan accepted any tile that was not `terrain` and picked one
denied by a wildlife nest once the map moved. The owner pass added two more:
`T45.C` detects a hazard painter by watching for its RIM colour, so a palette
change has to be declared there, and `T46.E` carried ONE barricade band for every
map — the lawn has its own (36-90) now and the other three keep the v74 band.

## v102 — the unit stat card (not part of a roadmap)

The owner asked for clearer unit descriptions in two places, as an icon grid:
the **hover popup inside a production building** and the **panel when one unit
is selected**. ONE builder serves both (`unitCard` in `12-selection-panel.js`),
`tail_v102.js` (T79). Nothing simulated changed and **no trail moved**.

- **Three rows, one block.** Stats (❤️ health, 🔫 DPS, 🎯 range, 👁️ sight) in a
  2-column grid; **damage dealt** in gold, pinned to THREE columns so it always
  reads as two rows of six classes; and a **red "Weak to" row** naming the
  weapon classes that beat this unit's armour. Description under the grid, price
  under that — the owner's stated order.
- **The red row is EXACT, and that is why it is weapon classes.** It is
  `armorScan(armor,true)` verbatim: worst first, with the multiplier, and the
  units carrying that weapon in the pill's tooltip. The first mockup tried a
  per-unit-type "damage received" figure and there is no honest single number
  for it — a class like Infantry carries six weapons. Ask the owner rather than
  averaging; here the answer removed the question.
- **Two readings, on purpose.** `{p}` is the SHOP (type row through that
  faction's mods — Gray buys a 58hp Grunt against Green's 48 — and daylight
  sight, because you are buying it); `{u}` is the FIELD (live health, `rgOf`,
  `viOf`, so night halves the sight cell by itself).
- **The popup is real HTML now.** A `title` attribute cannot carry an icon or a
  colour, so a tile with a card sets no title at all and drives `cardPopShow` /
  `cardPopHide` (named functions, per the v73 rule, because the shim's
  `addEventListener` is a no-op). Structure and research tiles keep their v43
  titles — `tile()` branches on `o.card`, not on what the tile shows.

**The rule-7 payment: DPS was hand-rolled as `dm/rt` and both halves were wrong.**
A live unit carries `dm` but NO `rt` (the reload lives on the type row and
`rtOf` bends it), so every selected unit read **0.0 dps**; and a hand ratio
knows nothing about salvos, so the AA truck read 5.5 against its real 18.0. Both
were caught by looking at one Chromium frame, and neither could ever fail
`seg.sh` — a wrong number is still a number. `unitDPS` and `rtOf` already
existed. **Before deriving a figure for a panel, grep for the function that
already derives it.**

## v101 — the day/night cycle (not part of a roadmap)

The owner's ask, delivered whole: a **10-minute day/night cycle** (`DAY_CYCLE_T`)
of **discrete lighting states** — day, dusk, night, dawn, no gradient, by
explicit instruction — with **every unit's and structure's vision halved at
night** (`NIGHT_VI_MUL`) and **every match starting at a random point in the
cycle** (`G.dayOff`, one srand draw appended LAST in `newGame` on the v59 rule,
hashed and serialized). No unit, price, building or map changed. `tail_v101.js`
(T78); full evidence in the v101 section of `harness/README.md`.

- **One table, one derivation.** `DAY_PHASES` in `02-tunables.js` carries the
  sim half (`ni`) and the render half (`tint`/`tintA`) per row; `dayPhase()` is
  pure arithmetic off `(G.tick + G.dayOff)`, storing and ticking nothing.
  Testing mode is pinned to permanent noon inside `dayPhase` itself, like its
  permanent full vision.
- **Vision has exactly two doors and night multiplies at the doors.** `viOf`
  already carried every unit-vision read; buildings read `b.t.vi` raw at three
  sites, so those got a named door too (`bviOf`) and the fog stamp, `pVision`
  and the HQ placement gate all go through it. Fog reveal, acquisition sweeps,
  High Ground, Forward Observer and AI call-down vision all follow with no edit
  of their own. Weapon range (`rgOf`) and wildlife aggro (`cr.t.vi`) are
  deliberately untouched — night shortens eyes, not guns, and a bug has no fog.
- **The light is ONE multiply fill over the finished world canvas** in
  `renderCore`, after the fog and before the present — the seam both the WebGL
  compositor and the 2d fallback consume, so one site keeps both looks
  identical (the POSTV argument, reused). Day's `tintA:0` is the identity: noon
  is byte-for-byte the pre-v101 frame. HUD, minimap and overlays stay at full
  brightness. The top bar prints the phase; entering and leaving night each
  raise one toast.
- **Every hash trail moved by construction** — a new hashState field plus the
  appended draw — so the carried-forward `recut_v101`/`repin_v101` expects all
  five tables to move (`UNMOVED_OK` empty), and the 42 layout pins held. Six
  old fixtures asserting daytime facts took a one-line noon pin
  (`G.dayOff=0`), T31.E's designed eligibility gate fired and moved its seed
  (600305 → 600307, the v85 remedy), and T75.B took its conscious version bump.

**The rule-7 payment this time: the first dusk/dawn tints were invisible.** At
~0.3 multiply alpha, both transitions read as Day in a real frame, and no test
can see pixels. The shipped alphas (.55) come from READING all four phases as
Chromium screenshots — night also proved the halved fog circle visibly. Tune
`DAY_PHASES` tints only with a screenshot open.

## v100 — three owner bug fixes (not part of a roadmap)

Three things the owner found playing v99 (`tail_v100.js`, T77). No unit, price,
building or map changed. Evidence in the v100 section of `harness/README.md`.

- **Bail drops the crew under parachutes.** `balloonDown` used to create all
  four `BAIL_CREW` men on the tick the button was pressed — four soldiers
  teleporting out of an exploding balloon. It now rides the Paradrop's own
  strike-and-delay machinery (`bailSpot` picks the landing tiles at launch, a
  `kind:'bailout'` strike carries them for `BAIL_FALL_T`, `landBailed` makes
  each man as his canopy touches down) and the SAME canopy routine draws it.
  The strike carries `pi` and no `owner` — the balloon is destroyed before the
  men land — which is why `drawStrikes`' fog gate now resolves the army through
  `pi` as a fallback; without it a bail-out would have been the one call-down
  visible through fog.
- **Wildlife was selectable all along — the panel was throwing.** `pickAt` has
  always returned creatures and `setSel` stored them; `refreshSelPanel` then
  threw on every tick, because a creature is keyed by `species` into `CREATURE`
  and `counterLine` dereferenced `B[undefined].aaOnly`. Fixed at `counterLine`
  (the one place that makes an entity's counter lines) plus a creature branch in
  the panel, and `drawBug` gained the selection ring and a health bar.
  **It exposed a latent bug:** nothing removed a dead creature from `G.sel` —
  `kill()` does that for units and buildings, `updateNeutrals` never did — which
  was unreachable while nothing could select one.
- **Supply crates fall on canopies and can be found.** `DROP_T`'s comment
  already said "under canopy" and nothing drew one. The canopy routine now
  serves four kinds with one switch for what hangs underneath, and the ground
  crate is drawn at `CRATE_SC` (2×) with a `CRATE_GLOW` pulse. `CRATE_R` is
  untouched — a bigger crate is not an easier one to collect, and T77.C drives
  a man to either side of the radius to prove it.

**The trap worth carrying forward, and it cost this release twice.** Both
rendering bugs were caught by looking at ONE real Chromium frame, and neither
would ever fail `seg.sh`: an additive glow drawn inside the sprite band adds
against band content rather than the terrain (the v94 cost), and calling it
above `renderCore`'s own `const inView` threw a temporal-dead-zone error every
frame that `renderGuard` swallowed into a black board and a single toast.
**`renderGuard` means a drawing bug cannot crash the game — and cannot fail a
test either. Run a frame and look at it.**

## v99 — the AI order-discipline pass (not part of a roadmap)

**The bots stop "jittering": the army-wide twitch-and-backtrack the owner saw
was measured to its causes and both are fixed** (`tail_v99.js` T76, and
`harness/probe_v99.sh` is the measurement tool the numbers come from). Nothing
about any unit, price, building or map changed — the release only changes how
the bots COMMAND what they already have. Full evidence in the v99 section of
`harness/README.md`.

- **The wave push was a standing condition, not an event.** Its size trigger
  stayed true once the army outgrew its capped `pushSize` — launching a wave
  never made `readyArmy` smaller — so the block re-fired every aiTick: one bot
  measured **174 "waves" in a ten-minute match, 94% of them 0.6 s apart**,
  each one re-ordering the whole army at a target that rhythmically flapped
  (the `rivalIdx%3` rotation plus `scoreFoes`' srand noise). The push is now
  gated on **wave-liveness**: while the current wave lives, nothing already
  marching is ever re-aimed; when it dies, the remnant is released and the
  next push re-arms on `pr.repeat`'s clock, which is what the code always
  claimed it did.
- **Idle units reinforce; waves are never relaunched at marchers.** The spam's
  one virtue — fresh production swept into the fight — is done honestly now:
  idle ready units march to the standing aim point (`ai.waveDest`) and join
  the wave, ordered once each, with the `defendFrac` home guard held back.
- **The defend recall is a picket now: local, capped, and it hands the march
  back.** One enemy near any building used to turn every non-fighting unit on
  the map toward it (26 at once, measured). A unit now answers only from
  within `AI_DEF_R` (24) tiles of the intruder, at most `AI_DEF_N` (5) per
  intruder, closest first — and a diverted marcher writes `u.savedDest` first,
  so the attack state hands it straight back to its march when the intruder
  dies. A real assault is still met by the auto-acquire, the help response,
  garrisons and towers — the picket is early warning, not the army.
- **Waves pace on the profile's clock.** `sizeReady` launches only the FIRST
  wave now; every later one waits for `pr.repeat`'s cadence — which is what
  that field's doc comment always said, and what stops a tactical retreat from
  being relaunched at the same superior force 0.6 s after it pulled back.
- **Strength is unchanged, measured:** a 16-match A/B on identical seeds moved
  every doctrine and army inside the batch noise the v90 baseline warns about.
  Orders issued fell 49%; the worst same-tick mass diversion fell 26 → 10.

**The v89/v90 trail lesson held again:** the trails moved because the defend
picket reaches the OPENING (first scout contact inside thirty seconds), not
because the push gate does — an opening army hasn't outgrown `pushSize` yet.
And the desk trail held because its one CPU is an ALLY: no foes, no threats,
nothing for v99 to reach (the v99 repin script named that in its `UNMOVED_OK`;
the pair itself has since been carried forward to v101, per the one-shot rule).

**The owner's feedback pass on the same release (played before merge):** with
the jitter gone, the winning bot idled 39–80% of its army through the endgame
— one seed stalemated to the time limit because two stragglers held a 39-man
wave "live" (the busy floor was an absolute 2) and everything else waited on
a gate that could never open. Four changes, T76.G/H/I: the wave's busy floor
**scales** (live while a quarter still moves or fights), a wave that ended
STANDING rolls forward within seconds while a WIPED one keeps the profile's
clock, **the press** walks a live assault across the base one objective at a
time (idle wave members re-march when the aim point clears; a hill-holding
wave never advances off its hill), and **commitment scales with contact** —
CALM (no picket response 45 s) or CRUSH (twice every foe's fighters) halve
the home guard, both quarter it, recent pressure keeps it whole. Measured:
duels of 40–450 s at 39–80% idle became 29–45 s at 6–26%, attacking share
tripled. `probe_v99.sh` now prints the duel readout too.

**Fixture trap, recorded in the README too:** "killing" a unit with `hp=0`
without `kill()` leaves it in the army census — the first cut of T76.B
relaunched a wave off six corpses. And an absolute liveness floor on a group
whose size spans two orders of magnitude is a stall waiting for a big group —
the busy floor had to scale.

## v98 — four owner asks (not part of a roadmap)

Four small things the owner asked for, each landing as a change AND a check
(`tail_v98.js`, T75). Full evidence is the v98 section of `harness/README.md`.

- **The Heavy Barricade is 40 plastic (was 60), its mine roll 15% (was 10%), and
  the mine is visible to its OWNER alone.** The old price made HP-per-plastic flat
  against the cheap wall and what you bought was the aura and the mine; at 40 the
  wall is deliberately better plastic-for-HP, and the constant's comment now says
  that rather than still claiming the old argument. An ALLY no longer sees the
  mine — but `mineArms` is untouched, so a teammate is still not blown up by a
  wall he cannot see. **Sight and safety are two claims and only the first one
  moved**; T75.A drives both.
- **A release stamp in the menu's bottom-right corner.** `GAME_VER` /
  `GAME_DATE` in `01-constants.js`, printed by `menuStamp()`. `GAME_DATE` stays
  ISO and `stampDate` reformats it with a REGEX, never `new Date` — that parses
  as UTC midnight and `getDate()` reads back local, so half the world would have
  been shown the wrong day. It also exposed a hand-typed `v:86` in `saveState`,
  twelve releases stale; the tag is `GAME_VER_N` now.
- **The number row fires the selection panel's ability buttons**, 1-9 down the
  row, through `ABIL_HOT` / `abilAdd` — `MENU_HOT`'s design pointed at the other
  half of the panel, so the panel rebuild IS the context gate. **This is a
  REBINDING**: the control groups moved to F1-F9 (Ctrl+F1-F9 to save) and pause
  moved F9 → F10, because no key in this file may mean two things at once and
  eleven units carry a toggle. The owner chose that from three options.
- **A hover tick and a stronger click** on the setup screen and the Field Manual
  (`sTick`, `sMenuClick`), bound once per host by `menuAudioBind`. The twenty
  per-site `sClick()` calls in those two hosts are DELETED — a delegated click
  plus a per-site one would sound twice. `#manualBtn` keeps its `sClick`: it is
  HUD, and the HUD's voice did not change.

**The re-price is a HUMAN lever, and that bounds what it can have done to the
balance table.** Read off the tables: `aiTick` asks for a faction exclusive once
unless its row carries `mult` (the Bunker and the Turbine have it, the Heavy
Barricade does not), and `aiBarricades` names `'barricade'` at all four of its
sites. A Gray bot puts up ONE heavy wall, ever. `sim.sh` cannot measure this — no
batch was run and none is claimed.

**The trails moved, and the route is the thing to carry forward.** A GRAY-only
re-price moved a green trail, a tan trail and two AI trails. The path is not the
building: `RESEARCH.b_hbarricade`'s cost is DERIVED from `B.hbarricade.cp`, every
trail boots three real CPU opponents (one Gray), and the Gray bot starts that
research at **tick 627** — inside the 900-tick window. "No army in this match can
BUILD it" is not the same claim as "nothing in this match reads its PRICE".

**A `data-tune` slot proves the NUMBER is not a second copy. It proves nothing
about the sentence around it.** The Field Manual said "One in
`<span data-tune="hbarrMineP">`" and that slot returns a PERCENTAGE — right at
10% purely by coincidence, and wrong by a factor of two at 15%. Both the manual
and the wall's own card state a percentage now.

## v90.2 — the HUD legibility pass (not part of the roadmap)

Two interface changes the owner asked for, and a bug the second one uncovered.

- **The message toasts moved from the bottom centre to the top centre.** At
  `bottom:160px` they sat inside the selection panel — 118px minimum, 332 with a
  Construct row — so every toast covered the build menu for five seconds. The new
  offset is `calc(var(--topbarH) + 10px + var(--bannerH))`, which names the
  survival banner's own slot rather than merely happening to clear it.
- **The top bar is twice as tall (42 → 84) with bigger text** (14 → 20), buttons
  (13 → 17) and army dot (14 → 20). Raising the `.tbtn` base is the only part with
  reach: three `.tbtn` buttons live outside the bar and stay put only because each
  overrides both font-size AND padding. `T65.C` asserts all six.
- **The bar's height is a variable now, and that is the point.** Four boxes hang
  off its bottom edge and every one was a hand-typed 50 or 52 that nothing tied
  back to the 42 it came from. `T50.A` transcribed one of them in full and was
  REWRITTEN to the claim it was making, not re-pinned.

**The top screen edge has never scrolled the camera, in any release.** The test
read `MOUSE.y<14&&MOUSE.y>44` — a condition no number satisfies — while the Field
Manual has promised "push the screen edge" since v43. The `44` is the old bar's
height, so doubling the bar meant touching the line anyway. Two lessons:
`TOPBAR_H` is a deliberate second copy of a stylesheet number, allowed only
because `T65.B` scrapes the sheet and asserts they agree (the `data-tune`
contract applied to CSS); and it is the height and NOT the height plus the border,
because the sheet is global `border-box` — the first cut was 86 and only a real
Chromium measurement caught it.

**No trails moved**: the release is stylesheet plus one client-local camera bound.
`T65.D` drives the fixed band through `update()` and, because it moves the camera
inside a sim tick, also asserts `G.cam` is in neither `hashState` nor the snapshot.

## v90.1 — the build-menu pass (not part of the roadmap)

Three interface repairs the owner asked for. Two are display; the third needed a
table field and a rule.

- **Both barricade tiles were blank in every Construct menu, and had been since
  v88.** This is the SAME regression v88.1 fixed in the Field Manual, in the third
  call site that release's own note said it did not reach. `tileURL` hard-coded the
  stub's row as `'barricade'` and passed no `t`, so the Heavy Barricade drew the
  wrong silhouette and the ordinary wall threw into a bare `catch{}` and drew
  nothing. **When a painter starts reading a new field, grep for its callers and do
  not stop at the first one you fix.**
- **The build menu is one row now.** 1240px held twelve tiles and every army's menu
  has been thirteen since v85. The panel's max-width went to 1340 AND the tile
  narrows on three breakpoints, because what the panel is GIVEN is the window minus
  the minimap reserve — at a 1440px window that is 1216 whatever the max-width says.
- **The order is a declared `cat` field on the B row**: producers (Barracks, Garage,
  Helipad, in tech order), then economy, then defence, then the rest, alphabetical
  by the name on the tile inside each shelf. Declared rather than derived because
  "is this economy" has no flag that answers it, and keyed on a flag rather than a
  key because that is the v88 lesson. `T35.E`'s index-1 pin was REWRITTEN to the
  claim it was making, not re-pinned to the new index.
- **One HQ at a time, and a button over the minimap to rebuild it.** The limit is
  `lim:1`, the Radio Tower's field, so `startPlacing`, `structTile` and `execCmd`'s
  build case all honour it already. The button is `startPlacing('hq')` and grants no
  new permission — `placeDeny` is untouched, so the enemy-HQ ring, the spacing rule
  and the build-vision gate all still refuse it.

**The bot's half is correct and, in a real deathmatch, unreachable — measured.**
`aiTick` rebuilds its HQ as the first spend of any tick it holds none, and reserves
the HQ's plastic against everything but trucks while it holds none. Over the
standard 8-match batch: every losing army loses its HQ, spends 10–111 sim-seconds
without one, and reaches a bank of **110–177 median, 308 max against a 500 price** —
`aiFindSpot` was asked for an HQ spot **zero** times. The cause is not the reserve:
the HQ is a `drop` building, so losing it kills the bot's income in the same stroke
and the difficulty assist alone needs ~200 seconds to fund a replacement. **The
lever, if anyone wants this to fire, is income while HQ-less — not the reserve, and
not a discount on the HQ.** The full table is in the v90.1 section of
`harness/README.md`.

**No trails moved**, and the reason is stated rather than assumed this time: every
line added to `aiTick` sits behind a plain scan of `p.blds` that touches no seeded
number while an HQ stands, and no HQ dies inside a 900-tick trail. `tail_v90_1`
T64.F asserts that guard functionally rather than in prose.

## v90 — the AI personality pass (not part of a roadmap)

**The five behaviour profiles now differ in what they BUILD, not just in when they
attack.** Through v89 the construction wish list was almost identical for all five:
a profile could bend it in only three small ways, and three of the five wanted the
same number of guard towers. Four changes:

- **`towers`, a declared trait spanning 1..5** (aggressive 1 → turtle 5), replacing
  a two-branch guess off `defendFrac` and `aggro` that could only return 2, 3 or 4.
  A faction whose STACKING exclusive is defensive follows the same ladder, so Gray's
  Bunker is now a turtle's ring and a rusher's single. "Is it defensive" reads the
  table's own `tower` / `gar` flags — never a key name, per the v88 lesson.
- **`buyTilt`, the pacing half of `armyTilt`** (aggressive 0.00 → turtle 0.60). While
  the bank is short of the priciest unit a producer can currently build, a profile
  with a tilt leaves that share of the gap unspent rather than filling the slot with
  the cheapest thing. `armyTilt` could never do this: it biases the CHOICE among
  options already affordable, and the cheap one is affordable first.
- **`firstPush` +15% on the three non-defensive profiles** (48 / 81 / 98; defensive
  120 and turtle 150 untouched), narrowing the opening gap that makes the two slow
  doctrines lose.
- **A vestigial rolled `aggro` deleted from `makeAIBrain`** — written every match,
  read nowhere — and the stale "(also scales economy push)" note removed from the
  profile doc comment. The income assist reads DIFFICULTY and never read `aggro`.

Two things worth carrying forward:

- **Measure the mechanism, not the outcome — again.** `buyTilt`'s effect on mean unit
  cost is inside the noise of a 16-match batch, because the class mix dominates that
  number (a harasser wanting 38% air out-costs a turtle wanting 50% infantry no
  matter how either shops). What is NOT noisy is how often the tilt actually refuses
  a cheap unit, which `probe_v89.sh` reports per profile: 0% / 5.1% / 10.7% / 15.7% /
  17.6%, monotonic in exactly the profile order. Reach for that before re-tuning it.
- **The first cut of `buyTilt` was inert and the tests said so before the sim did.**
  It was gated on the bank reaching half the top price, borrowed from the faction
  floor's own idiom — but the bank at a production decision runs near 100 plastic, so
  the gate switched the tilt off precisely where it was meant to bite. The real
  anti-stall guard is not a bank threshold at all: it is that a bot **under its
  faction quota never holds out**, because the floor already outranks both reserves
  and stacking a savings tilt on it is the stall `T42.D` exists to catch.

## v89 — the AI air pass (not part of a roadmap)

**The bots now build roughly twice the air and AA they did**, measured on two seed
sets with the same tool on both sides: air 3.6% → 8.6% of production and AA 1.2% →
2.8% on the 16-match batch, with infantry down from 76.0% to 68.3%. Nothing about
any unit's cost, damage or hull changed — this is entirely a change to how the bot
SHOPS.

The finding behind it is the part worth carrying forward: **the bots were not
ignoring their air targets, they were unable to act on them.** They filled their
supply cap with one-supply infantry (`supFree` was 0 at the median helipad decision,
against a supply cap already at its 110 ceiling) and spent their plastic the instant
it arrived (a median bank of 96 against a Huey's 200). Energy, which the cost table
makes look like the obvious culprit at 80 a Huey against a Grunt's 0, was never the
problem — median 2,287. The full write-up is the v89 section of `harness/README.md`.

Three things changed, all in `aiTick` / `AI_PROFILES`:

- **`gRsv`, an expensive-class reserve.** While a class is short and its producer is
  ready to buy, every producer that cannot supply that class holds back the cheapest
  such unit's price AND its supply cost. It is the `saveExp` reserve pointed at a
  class instead of at an outpost, derived per tick, storing and hashing nothing.
- **It ranks classes by shortfall IN PROPORTION to the target**, not by the raw gap.
  The raw gap systematically hands the reserve to whichever class was asked for in
  the largest quantity — measured, vehicles won it twice as often as air on bots
  holding a third of the air they wanted.
- **`mixWant` retuned toward air across all five profiles, and the AA pairs raised.**
  With delivery working these numbers are now the real lever on what a bot flies.
  The profiles keep their ORDER on every axis, and `T31.F` pins that.

Three notes for whoever goes next:

- **`sim.sh` alone could not have found this.** Its class shares are an OUTCOME, and
  an outcome is consistent with a dozen causes. `harness/probe_v89.sh` buckets every
  production decision by the first clause that refused it, which is what separated
  "never chose air" from "chose air and could not pay for it". Reach for it before
  re-pricing anything on the bot's behalf.
- **The trails did not move and no repin was due — but the reason given here was
  WRONG, and v90 corrects it.** This section used to say testing mode boots every
  slot HUMAN so `aiTick` never fires under the trails. It does not: `triage.js`'s
  `cfgTan` / `cfgGreen` never set `test:true`, so every COMBOS trail is a real match
  against three live CPU opponents. What is true is that they run 900 ticks —
  **thirty seconds**. v89's pass needed a helipad or a mid-game bank to bite, and at
  thirty seconds a bot has neither, so it changed nothing inside the window. v90
  moved `firstPush`, which lands squarely inside it, and the trails moved at once.
  Read a clean trail after an AI change as "the opening is unchanged", never as
  "the AI is unchanged".
- **Two doctrines were near-dead** (`defensive`, `turtle`) when this was written.
  Measured again at v90 over 64 matches, defensive recovered to 14.6% and turtle did
  not move (14.5%). See the v90 balance baseline below.

## Where the balance actually stands (32 matches, RE-MEASURED at v103)

**Read this before acting on any faction claim elsewhere in this file or in the
harness README.** The v90 section that used to head this chapter said its own
percentages were stale and demanded a re-measure before anyone quoted one. That
re-measure has now been done, on v103 as merged: **two independent batches of 16
all-CPU matches, every army in every match, so an even game is 25% wins each.**

| army | batch 1 | batch 2 | combined | K/L per batch | units built |
|---|---|---|---|---|---|
| green | 6/16 | 9/16 | **47%** | 1.01 / 1.40 | 7,047 |
| tan | 6/16 | 5/16 | **34%** | 1.36 / 1.12 | 6,316 |
| gray | 2/16 | 1/16 | **9%** | 0.84 / 0.85 | 5,754 |
| blue | 2/16 | 1/16 | **9%** | 0.69 / 0.51 | 7,005 |

Reproduce with `cd harness && ./sim.sh 16` and `SEED0=4200 ./sim.sh 16` — **on
v106 or earlier**: since v107 `sim.sh` deals six maps, so the same seeds land on
different boards. Pass the four-map deal by hand if you need the table again.

**The four findings, restated against the new numbers.**

- **Green has overshot and the v90 hypothesis is unrefuted.** 47% against an even
  25%, top of both batches. v90 guessed the cause: every reserve added at v89/v90
  is a PLASTIC threshold and Green pays 8% less for everything, so it clears all
  of them sooner on every producer all match. **Still not measured** — check it
  with `probe_v89.sh` before re-pricing anything, and if it holds the fix is to
  scale the thresholds by `FAC[p.fac].mods.cost` so a reserve means the same
  thing to every army, NOT to touch Green's discount, which is its identity.
- **Blue is still last, and the shape says where to look.** 9%, and a K/L of
  0.69 and 0.51 — worst in both batches — while building 7,005 units, more than
  anyone except Green. It pays for an army and does not field one. That shape
  (lots of units, poor conversion) points at the −10% hull rather than at any
  single unit. Flagged first at v88.1, restated at v90, and **still untouched
  thirteen releases later.**
- **Gray has joined Blue, and that is NEW.** 9%, K/L 0.84 and 0.85. The v90
  baseline did not flag Gray at all. Its +20% toughness, paid for in speed and
  damage, is not converting.
- **The two defensive doctrines are dead, not merely weak.** `turtle` 3 wins of
  26 and `defensive` 3 of 27, against `harasser` 9/24 and `aggressive` 9/23
  (~38%). v90 recorded `defensive` recovering to 14.6% when `firstPush` moved; it
  has slipped back. `turtle` has now failed to respond to several passes, which
  is the finding: see Roadmap 4 item 7.

**Two caveats, and the first is the project's own house rule.** Sixteen matches
is a hint, not a verdict — but both batches agree on the ORDERING and the gap
between the top pair and the bottom pair is far outside the wobble this file
warns about, so the two-tier split is safe to act on even though any single
percentage is not. Second: these are BOT-against-bot matches and a person plays
differently; it is the only systematic instrument the project has, and it is the
same one every previous baseline used.

**Production mix, stable across both batches:** infantry 56–57%, vehicles 33–34%,
air 7.2–7.5%, AA 2.1–2.3%. v89 moved air from 3.6% to 8.6% and it has held near
that; nothing about the class mix looks broken.

**Match length:** median 769–994 seconds, and **6 of 32 ran out the clock** —
Roadmap 4 item 6.

The v90 reasoning is kept below rather than deleted, because the mechanisms it
records are still the best guesses at WHY, and because the older numbers show
which way things have moved.

### The v90 baseline, kept for its reasoning (64 matches, superseded above)

This was 64 matches on v90 as merged, four seed sets, 64 distinct seeds. The full
table, the reproduction recipe and the reasoning are in the v90 balance section of
`harness/README.md`. Its percentages predate v99's command model and v101's night,
and the v103 table above replaces them; what stays useful is the mechanism each
finding proposes.

Four things a new session should know before touching balance:

- **Green has overshot and it is probably our own doing.** It was average at v88.1
  (+0.4 over its expected wins) and this file said "Green is fine, do not fix it".
  At v90 it is **+10.7**, the strongest army by a wide margin. The hypothesis: every
  reserve added at v89 and v90 is a PLASTIC threshold, and Green pays 8% less for
  everything, so it clears all of them sooner on every producer all match. Not yet
  measured — check it with `probe_v89.sh` before re-pricing anything, and if it
  holds, the fix is to scale the thresholds by `FAC[p.fac].mods.cost` so a reserve
  means the same thing to every army, NOT to touch Green's discount.
- **Blue is still last and nothing has been aimed at it.** K/L 0.63 against 0.65 at
  v88.1, building the most units of any army and getting the least from them. It was
  the first lead in the v88.1 brief, two passes have gone by, and it is untouched.
- **`turtle` is the one doctrine that has responded to nothing** (14.5%, from 9.1%).
  `defensive` recovered to 14.6% from 4.8% when v90 moved `firstPush`, so turtle's
  problem is not its opening — that is the lever that just worked for the other one.
- **`harasser` is now the BEST doctrine** (37.8%, from 21%), because it is the one
  that asks for the most air and could not execute that plan before v89. The
  doctrine spread did not flatten, it reordered — do not assume the old ranking.

**Neither v89 nor v90 has a `tail_vNN.js` of its own**, the first two since v83
without one. Their checks live in the tails that own the subsystems: `tail_v59.js`
(T39.B, T39.I), `tail_v60.js` (T31.F) and `tail_v63.js` (T42.D, T42.F).

## Roadmap 2 and what it left behind (COMPLETE, v85–v88.1)

Every army fields a full exclusive set — two exclusive buildings, an exclusive
unit from the Barracks, the Garage and the Helipad, and its own Radio Tower
call-in. Blue at v85 (Signal Runner, Forward Pad, Rapid Redeploy), Green at v86
(Command Truck, Observation Balloon, Command Post, Supply Drop), Tan at v87
(Firebomb Heli, Foundry, Napalm now Tan-exclusive), Gray at v88 (Choktaw Heli,
Heavy Barricade, Smokescreen). v87.1 (interface repairs) landed between; v88.1
closed the roster question. `tail_v88.js` T62.J states the completion claim
derived off `FAC` rather than transcribed — an army that grew or lost an
exclusive structure fires there.

**The seventh supply slot.** At 25 trainable units the cheap tier holds seven, so
somebody always pays 1 supply. It is the Flamethrower (Tan-exclusive, the better
occupant — three armies in four cannot field the per-supply leader). The Medic
and Sarge are one rank cheaper than at v87; that is roster arithmetic and nobody
has asked for it to change.

**The Machine Gunner is third on infantry damage-per-plastic** (re-priced 112 →
125 at v88.1 so he pays 2 supply again), behind the Flamethrower and the plain
Grunt, on purpose. What he keeps is Entrench and the toughest hull among the
infantry every army can build — `T50.C`/`T63.A` assert both.

Facts a roster change must respect:

- **One faction per version** was the roadmap's rule, and it is why trail
  divergence stayed attributable to a single release each time.
- **`u.abCool` has two users** — v87's Napalm Blast and v88's Paint. The
  duration lives on the table row as `t.abCd`; `makeUnit` writes the clock only
  onto rows that declare one, `updateUnit` ticks it, and it is hashed, serialized
  and zeroed by testing mode. A third ability needs a row and nothing else.
- **The build menu has one key spare.** `MENU_KEYS` holds fourteen and every
  army's Construct menu is thirteen tiles. A fifteenth tile would need a
  fifteenth letter and there is no unclaimed one left. See the v86 note in
  `harness/README.md`. v90.1 SORTED that menu but did not resize it: the keys
  are handed out positionally, so a tile's letter follows its shelf.
- **A new unit or building now also fails T71.A** until the texture pipeline is
  re-run — the conscious step a textured game demands (see the standing traps
  under Roadmap 3).

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
- **An action that fires "once" must be gated on what it PRODUCES, not on the
  condition that motivated it.** v99's wave trigger was `readyArmy >= pushSize`,
  and launching a wave never made `readyArmy` smaller — so it was a standing
  condition re-firing every tick, 174 times in a ten-minute match. The fix is
  always the same shape: gate on the product's liveness (is the wave still
  alive), and give the product a definition of alive that SCALES, because an
  absolute floor on a group whose size spans two orders of magnitude is a stall
  waiting to happen.
- **A delayed arrival is a strike, not a spawn — and reuse the machinery that
  already delays one.** v100's balloon bail-out made four men on the tick the
  button was pressed; it now rides the Paradrop's strike-and-delay path, so one
  canopy routine draws all four kinds of thing that falls. The catch worth
  carrying: a strike whose owner DIES before it lands cannot resolve its army
  through `owner`, so `drawStrikes`' fog gate falls back to `pi` — without it a
  bail-out would have been the one call-down visible through fog.
- **An additive effect adds against whatever layer it is drawn into.** A glow
  inside the depth-sorted sprite band brightens band content, not the terrain
  under it. Pick the layer deliberately, and remember rule 7: it looks wrong in
  a screenshot and passes every assertion.
- **When a global condition scales an existing figure, multiply at the figure's
  own door — and if a read has no door, give it one first.** v101's night
  halves vision inside `viOf`, so fog, acquisition, auras and AI targeting all
  followed from one edit; building vision was read raw off `b.t.vi` at three
  sites, so the release's first move was to name that read (`bviOf`) and route
  the sites through it. Scaling at the call sites instead would have been three
  edits that drift apart the day a fourth reader appears.

## Git

Work on the branch you are told to use, commit with a real explanation of *why*,
push, and open a **draft** pull request. Do not push to `main` directly. If the
branch's previous PR has merged, restart the branch from `origin/main` before
new work — never stack on already-merged history.
