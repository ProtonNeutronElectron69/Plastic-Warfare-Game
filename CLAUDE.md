# Working on Plastic Warfare

Read this first. It is the orientation; `harness/README.md` is the detail.

## The shape of the project

The game is **assembled from `source/`** into one file, `plastic-warfare.html`
(~6.7MB), by `./build.sh` at the repo root. Everything — simulation, rendering,
audio, UI, netcode — is still one `<script>` block in the shipped file; it is
written as 34 files listed in `source/order.txt`. There are no dependencies.
The recorded sound set (33 mp3 takes, `assets/snd/`, since v92), the full
sprite texture set (218 WebP files, `assets/img/`, since v95) and their normal
maps (`assets/nrm/`, since v96) all ride inside the script as base64 — the
double-clicked file stays self-contained. `tools/embed_snd.py` and
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

## Where the game stands (v97, and what a fresh session does)

The game is at **v97**. All three roadmaps are COMPLETE: roadmap 1 (v79–v82,
abilities), roadmap 2 (v85–v88.1, full faction-exclusive sets), roadmap 3
(v91–v96 + follow-ups v92.1/v96.1/v97, real art and real sound). There is no
release in flight.

**Known open fronts, none started:**

- **Maps and map art.** The owner explicitly deferred these from v97's detail
  pass ("maps/map art will be handled separately"). Terrain (`G.terr`), props
  and ground art are the one visual layer still fully procedural at base
  resolution.
- **Balance.** The v90 baseline below still stands: Green likely overshoots via
  the plastic-threshold reserves, Blue is last and untouched, `turtle` has
  responded to nothing. Measure with `probe_v89.sh` before re-pricing anything.
- `T26.C`'s air-value question is still open.

**How a release ships.** One version per PR. Start a fresh branch from
`origin/main`, work it as vNN (or vNN.N for a feedback/repair pass), add a
`tail_vNN.js` with the release's pins (register it in `harness/seg.sh` line ~49
AND `harness/tails.txt`), record the release in `harness/README.md` and update
this file, then push and open a **draft** PR into `main`. The owner reviews —
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
QUIET=1 ./seg.sh all     # full suite in parallel, ~320s. 5,395 checks at v97.
QUIET=1 ./seg.sh 1       # or a single segment: 1, 2a, 2b, 2c, 3
python3 verify_v58.py    # 32 extra source-text checks, not part of seg.sh
```

## Watching the bots play

```sh
cd harness
./sim.sh                 # 8 all-AI deathmatches, 2 per map, ~2min. Writes a report page.
./sim.sh 16              # a bigger batch; SEED0=900 ./sim.sh for a different run
```

`sim.sh` runs whole matches with a CPU in every seat and builds
`sim_out/battle-report.html` — winners, kills, and what every army produced. It is a
MEASUREMENT tool, not a test: nothing it prints is pinned, and it is not part of
`seg.sh`. Use it to answer "how does this actually play", not "did I break anything".

**Its numbers move a lot between batches, and that is the honest signal.** Eight
matches on the same seeds gave one army 6 wins under one map pairing and 4 under
another. Read a batch as a hint about a direction, and re-run with a different
`SEED0` before believing anything.

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
   and building counts, the transcribed cost tables, the derived texture roster
   (T71.A — a new unit fails the suite until the texture pipeline is re-run).
   Update them deliberately and say why in the comment; never loosen one to get
   green.
6. **Record what you measured, including when it contradicts the plan.** The
   harness README is full of findings that went the other way from the scope
   estimate. That is the point of it.

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

## Where the balance actually stands (64 matches, measured at v90)

**Read this before acting on any faction claim elsewhere in this file or in the
harness README.** Everything written before it came from a 24-match read at v88.1.
This is 64 matches on v90 as merged, four seed sets, 64 distinct seeds. The full
table, the reproduction recipe and the reasoning are in the v90 balance section of
`harness/README.md`. (v91–v97 were render/audio-only and cannot have moved it.)

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

## Git

Work on the branch you are told to use, commit with a real explanation of *why*,
push, and open a **draft** pull request. Do not push to `main` directly. If the
branch's previous PR has merged, restart the branch from `origin/main` before
new work — never stack on already-merged history.
