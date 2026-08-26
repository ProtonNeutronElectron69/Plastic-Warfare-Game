# Plastic Warfare headless test harness (updated at v96.1)

This is the development record: every release, what it was told to build, what it
actually cost, and the traps learned. If you are new to the project, read
`../CLAUDE.md` first — it is the short orientation and points back here.

## THE FACTION ABILITY ROADMAP (read this first if you are picking up mid-project)

### Roadmap 3 (COMPLETE at v96): real art and real sound.

The owner has decided to take the game to **textured sprites with per-pixel
lighting and recorded audio**. The short version and the phase list are in
`../CLAUDE.md`; this section is the evidence, the alternatives that were weighed,
and the detail a phase-1 session needs.

**Scope, stated as a boundary rather than a wish.** Isometric 2D stays. The
camera, the maps, the fog, the UI, the simulation and the AI stay. What changes
is where sprites come from, what draws them, and where sounds come from.

**The alternative that was rejected, and why.** Actual 3D models with real lights
was considered and turned down: it rewrites how everything is positioned and
drawn, discards the toy-soldier art direction, and puts the deterministic sim -
the genuinely hard, genuinely tested part of this project - at risk for a visual
outcome that normal-mapped 2D also reaches. Full game engines (Phaser, Unity,
Godot) were rejected for the same reason at a larger scale: they bring their own
game loop and state model, and this project's value is a lockstep simulation with
5,167 pinned checks around it. A 2D WebGL RENDERER (PixiJS) replaces `frame()`
and leaves `update()` alone; an ENGINE would want to own both.

**The four measurements the decision rests on.** Taken at v90.2, reproducible:

| what | measured | why it matters |
|---|---|---|
| does the sim draw? | `update()` never calls a painter | the renderer is replaceable in isolation |
| assertions touching drawing | **124 of 3,694** (~3%) | 97% of the safety net is renderer-agnostic |
| sprite pipeline | `bakeSprites()` → `bakeCell` → blit `cell.cv` | an atlas pipeline already, just generated not loaded |
| audio surface | 13 `sfx*` fns, each called 2-10x, all behind `audAt(x,y)` | recorded sound changes 13 bodies and no call site |

Reproduce the second one with:

```sh
cd harness
grep -h '^ *ok(' tail_*.js | wc -l
grep -h '^ *ok(' tail_*.js | grep -c 'SPR\.\|Portrait\|draw\|paint\|bake\|render'
```

**A fifth thing already in place:** the post-processing pass renders the world to
an offscreen buffer and composites it with tilt-shift, bloom, a grade and a
vignette. The "render to a target, then process the target" shape a shader
pipeline needs is not new work.

#### Phase 1 LANDED at v91. What a phase-2 session needs to know

The split is done: 30 files under `source/js/`, an explicit `source/order.txt`,
a root `./build.sh` that concatenates them into `plastic-warfare.html`, and
`harness/build.sh` chained to it so `cd harness && ./build.sh` still does the
right thing. `ASSET_MANIFEST` exists and is empty.

**It was proved inert three ways, and the first is the one to copy.** The split
was cut at LINE BOUNDARIES out of the v90.2 file rather than retyped, so
reassembling the sources reproduces that file **byte for byte** - the commit that
introduced `source/` changes `plastic-warfare.html` by zero bytes. `./build.sh
--check` asserts it from the shell and `T66.A` asserts it inside the suite, so
the sources and the shipped file cannot drift. On top of that: all 42 layout pins
and every hash trail reproduce, and the suite went 5,167 → 5,202 with no failures.

Verify a stale build really is caught before trusting it, the way this release
did: append a comment to any file in `source/js/`, do NOT rebuild, and run
`./build.sh --check` — it exits 1 and names the byte difference, and `T66.A`
fails twice.

**Two seams phase 2 inherits, both already in place:**

- `sndAsset(key)` returns `{bytes,buf}` or **null**, and null means "synthesise
  it the way v90.2 did". The loader stores RAW BYTES rather than a decoded
  `AudioBuffer` on purpose: decoding needs an `AudioContext`, and this project
  creates one only inside the first user gesture because browsers refuse it
  before. Phase 2 decodes on demand and caches into the `buf` slot.
- All 13 `sfx*` functions already ask `audAt(x,y)` for `{gain,pan,d}` before they
  make any noise. Recorded sound replaces what happens after that call and
  nothing before it, so positional audio, distance falloff and the fog gate keep
  working with no edit.

**The seam phase 2 must not break** is the one `T66.C` pins: `newGame()` is
synchronous and hundreds of fixtures call it that way. The load is kicked off at
page open (`assetsLoad();` at the end of the boot) and only the Start button
awaits it. If phase 2 ever makes `newGame` wait, the entire suite has to become
asynchronous — so don't.

`ASSETS`, `ASSET_MANIFEST` and `ASSETS_STATE` are client-local and must stay
that way. `T66.C` writes an asset in and asserts neither `hashState` nor
`saveState` moves. The reason is not tidiness: two clients in a lockstep match
can legitimately hold different assets — one of them may have failed a download —
and the match still has to agree tick for tick. **An asset may decide what a
player sees or hears and must never decide what happens.**

#### Phase 2 LANDED at v92: recorded audio. What it shipped, and what was measured

The seams phase 1 left were exactly right and none of them moved: the loader,
`sndAsset()`, the raw-bytes-until-gesture rule and the `audAt` gate are all
untouched. What v92 added: `assets/snd/` with 33 mp3 takes across 25 voices
(362 kB), `tools/render_snd_v92.py` (the renderer that made them),
`tools/embed_snd.py` (packs them into `source/js/02c-snd-data.js` as base64),
and in `03-audio.js` a `SNDV` per-voice parameter table plus three functions —
`sndBuf` (decode on demand, cached into the `buf` slot), `sndLead` (see below)
and `sndPlay` (plays a take through the same `aout()`/`rsend()` chain as the
synthesis). Ten positional one-shot voices ask `sndPlay` first and synthesise
when it answers false: `sfxGun`, `sfxFlame`, `sfxThrow`, `sfxLaunch`,
`sfxBoom`, `sfxBuildingDestroy`, `sfxPop`, `sfxNestBreak`, `sfxStructBreak`,
`sfxWhoosh`. The trails and all 42 layout pins reproduce over the diff, which
was the acceptance test: audio may decide what a player hears, never what
happens. That claim was also driven end-to-end rather than argued: the shipped
file opened from `file://` in a real Chromium, a deathmatch booted, the real
call sites fired recorded takes (`gun_rifle:true` ... `bld_destroy:true`, and
an off-map shot correctly silenced by the `audAt` gate before `sndPlay` was
ever consulted), and the browser match hashed **2521820048** at tick 30 —
bit-identical to the same seed run headless with no audio in existence.

**The count in the decision table was wrong, and is corrected rather than kept:
there are 10 `sfx*` functions, not 13.** The claim "recorded sound changes N
bodies and no call site" survives at 10. The continuous voices — the two mining
ambience loops, the engine/rotor/building selection answers, the speech barks
and the UI tones — stay synthesised on purpose: they are loops, models and
speech, not one-shots, and nothing about the override architecture is waiting
on them.

**Finding 1: the double-click instruction is load-bearing, and it forced the
data: URL design.** The README's first line to a player is "download
`plastic-warfare.html` and double-click it" — a `file://` page, and every
modern browser refuses `fetch()` of a RELATIVE url there. So a manifest of
`'assets/snd/rifle.mp3'` entries would have meant NOBODY who plays the game the
documented way ever hears the recorded audio, silently, with the fallback
masking it. `fetch()` of a `data:` url works everywhere (verified in the real
Chromium this session, from an actual `file://` page), so the takes ride inside
the shipped file as `data:audio/mpeg;base64,` entries, generated into an
ordinary source file so the build stays pure concatenation and T66.A's
byte-for-byte pin holds. The price is honest and measured: the shipped file
went 1,079,645 → 1,582,424 bytes (+47%), all of it the sound set. mp3 rather
than wav is why it is only that: the same takes as 22 kHz wav were 1,010 kB
against 362 kB. T67.B pins the `data:` scheme so a future phase cannot retire
it without also consciously retiring the double-click claim.

**Finding 2: mp3 encoder padding is real, browser-dependent, and handled at
runtime, not at encode time.** A LAME-encoded one-shot decodes with its
encoder delay returned as leading silence — measured 13–20 ms across the set
in Chromium — and how much survives differs per decoder. A gunshot that lands
20 ms after its tracer reads as broken. `sndLead()` therefore scans each
decoded buffer once for the first sample above 0.003 and playback starts
there (`buf.pwOff`), which is robust in every browser because it measures the
decode actually in hand. A browser that cannot decode mp3 at all fails into
`a.err` and that voice stays synthesised for the session — the fallback is the
error handler.

**What these takes are, stated plainly: rendered, not recorded.** This
session's network reached package registries and nothing else, so no
rights-clean field recordings were obtainable — and shipping audio nobody has
rights to is not on the table. The takes are offline renders
(`tools/render_snd_v92.py`, numpy/scipy, deterministic per-key seeds) of the
SAME layer recipes the live engine plays — the part tuned by ear across
v64–v88 — with processing the realtime graph cannot afford: 4th-order swept
filters, modal resonators for the plastic crack and shell-casing rings, debris
fields at 2-4x the grain density, and a per-file mastering chain. Rapid-fire
weapons carry two takes each (plus ±4% rate and ±12% gain jitter per shot) so
a burst is not one sample on repeat. **Nobody in this session could LISTEN to
them** — QA was decode metrics and spectral sanity, not ears — so the owner's
first listen is the real acceptance test. The two knobs if something sounds
wrong: per-voice loudness lives ONLY in `SNDV` (the files are peak-normalised),
and any single take can be replaced or deleted (drop/remove the file in
`assets/snd/`, run `tools/embed_snd.py`, then `./build.sh`) — a deleted take
falls back to synthesis for that voice alone, take counts permitting, and
T67.E refuses a repo where the folder and the embedded table disagree.

`tail_v92.js` (T67) carries the checks: coverage derived off `GUNV`/`EXPLV`
both directions (a ninth gun voice fails until it gets takes or a conscious
decision), mp3 frame-sync and size bounds, recorded-branch-before-synthesis
asserted per function off the live source, the not-sim-state probe, and the
folder/table byte-equality. The suite grew 5,202 → 5,234, all green at v92.

#### v92.1: the owner's first listen, and what it changed

v92's own record said it plainly: "the owner's first listen is the real
acceptance test." It happened, and it returned eight findings. Every one
became a change and a check (`tail_v92_1.js`, T68), and three of them
corrected decisions this harness had PINNED the other way - those pins were
rewritten to the new claims, not loosened. What the feedback taught, finding
by finding:

- **"Small arms on armor sound glassy, should be a metallic ping."** Two
  faults hiding under one report. First, the v92 gun takes carried baked
  sine-partial "shell casing" and "bolt" rings (3-5 kHz, 30-50 ms) - long
  clean partials read as GLASS, and firing at armor exposes them because no
  infantry pops mask the shot. Removed; the gun mechanism is damped filtered
  noise now. Second, the game had NO impact sound at all - only death sounds -
  so the ping the owner expected had nowhere to come from. v92.1 adds one:
  `sfxRico` (three takes + synth fallback), fed from `applyDmg` inside the
  existing per-target `lastShrap` throttle, gated to weapon class 'b' against
  medium/heavy/bldg targets (nests excluded by name), then thinned by a 35%
  Math.random draw and a 6-per-0.3 s budget window. Measured through the real
  feed in Chromium: 30 bullet hits on a Tank produced 6 pings. Both gates are
  DRIVEN in T68.B - bullets on a Grunt and rockets on a Tank must ring zero
  times - because the v90.1 lesson is that a guard asserted in prose is a
  guard unverified.
- **"Armored buildings dying chime instead of exploding."** The Heavy
  Barricade dies through `sfxStructBreak`, whose v64 brief was "pulled apart,
  no detonation" - written when the same voice also played on a SOLD
  structure. Selling has used the full teardown since v87.1, so combat was
  the only caller left, and its comb resonator + modal ring-downs are a
  chime by construction. Redesigned as a small blast with masonry crunch,
  recorded take and synth fallback alike, and T43.F's "no detonation
  transient" pin was REVERSED on purpose. The full building collapse also
  contributed: its three detuned-saw groan, ported verbatim from the live
  recipe, renders too clean offline and rings - the groan is torn pink noise
  through a falling low-pass now, pitchless, with nothing to ring.
- **"Hollow reverb on small arms and some explosions."** The v92 takes baked
  a 14 ms room slapback into every gunshot AND the live convolvers were
  layered on top - space applied twice. The baked room layer is gone and
  every send was cut (small arms roughly halved, explosions by about a
  third); T68.D pins the new ceilings so the wash cannot creep back.
- **"Nests should be silent."** `sfxNestBreak` is an empty function now, the
  take and its `SNDV` row are deleted, and the decision is pinned from both
  sides: T68.A asserts the body is empty AND that the kill() call site
  survives, so the silence lives in exactly one place. T43.F/T43.M dropped
  the nest from their distinctness claims (23 combat voices, was 24).
- **"Helicopter selection: just a brief rotor." / "Vehicle selection: just a
  brief diesel."** The rotor answers lost their turbine and gearbox whine
  layers and halved their windows; what differentiates the three is the
  rotor itself (chop/blade rates, the Chinook's tandem beat - all still
  pinned by T43.L). The eight ground-vehicle answers collapsed from bespoke
  layer stacks to ONE diesel family (`DIESELV`): chug rate, fundamental,
  window and level per kind, with the fundamentals on a geometric ladder
  ~20% apart so every pair clears T43.L's 13% distinctness band without
  leaning on jitter. The Bull still idles lowest and slowest, the Scout Bike
  highest and fastest, and T68.E asserts every answer ends inside 0.7-0.75 s.
  The one deliberate exception: the Observation Balloon keeps its v86 burner,
  because it is the one "vehicle" with no engine to idle.
- **"Add 'Ready to move' / 'Ready to fight'."** In `BARKS_INF`, additively -
  T68.F checks the six v64 lines all survive.
- **"Sniper should be a louder crack."** Its take is redesigned around a twin
  supersonic crack (the N-wave's two shocks 4 ms apart) with a broad 3-7 kHz
  whip band and only a modest thump, and its `SNDV` gain is now deliberately
  the largest of the guns (.80 against the rifle's .44) - T68.C pins
  "loudest gun in the set" as an inequality over the whole table.

Suite at v92.1: 5,266 checks, all green (5,238 at v92), trails and all 42
layout pins reproduce - the ricochet call sits in `applyDmg`, but
both of its random draws are Math.random and T43.J drives the whole audio
surface, `sfxRico` included, across a hash comparison.

#### Phase 3, first cut, LANDED at v93: the WebGL stage - and the measurement that re-planned the phase

**What shipped.** A dependency-free WebGL present+post stage
(`source/js/25b-webgl.js`, ~250 lines): the world still renders through the
UNTOUCHED 2d code into `worldCv`, and `glComposite()` uploads that frame and
runs the whole post pass as real shaders - bright-pass + separable gaussian
bloom, the tilt-shift bands, the overlay/soft-light grade and the vignette -
on a WebGL canvas that sits UNDER `#view` in the DOM, so input and the
screen-space overlays never move. The phase 1-2 rule applied to renderers:
**GL overrides, it never replaces.** `compositePost()` is the permanent
fallback (headless, old browsers, a lost context, `#nogl` in the URL), and
both compositors read their tuning from one new `POSTV` table so the two
looks cannot drift - T69.B pins both consumers, and T69.D pins that the file
is still one self-contained script with no external anything.

**Measured in Chromium, from a double-clicked file:** the GL stage comes
alive, and the same tick of the same seed screenshotted through GL and
through `#nogl` differs by a **mean 2.02/255 per channel (p95 = 4/255)**,
concentrated in the tilt bands where the blur algorithms legitimately differ
- visually the same game. The sim hash at that tick is **identical under
both renderers**, and T69.C drives a render pass across a hash comparison
headless. Suite 5,286/5,286 (5,266 at v92.1), all trails and layout pins reproduce.

**The measurement that re-planned the phase, recorded because it contradicts
the plan above.** The phase-3 sketch imagined swapping the renderer wholesale
("PixiJS is the pick... draw sites blit cell.cv"). Read on the ground at v93,
the cell blit is a MINORITY of the world pass: `renderCore` plus the entity
painters contain hundreds of immediate-mode vector and gradient draws that
are not sprites at all - twelve airborne particle types built from radial
gradients and additive blending, per-projectile vector art, per-entity effect
glows (heal aura, paint brackets, rally pulse) interleaved INSIDE the
depth-sorted pass, independent turret sub-transforms, strike and targeting
overlays. No sprite batcher replaces that cheaply, and a scene-graph library
would fight the immediate-mode shape of all of it while adding ~450 kB that
must ride inside the single file. So phase 3 became incremental: **first the
pipeline (this cut), then the sprite band inside it.** The second cut - the
depth-sorted item pass drawn by GL between a 2d underlay and a 2d overlay,
which is the part phases 4 and 5 actually need on the GPU - has a concrete
seam now: `glComposite` owns the frame, and the band migrates into it without
the vector FX ever needing to leave canvas. Phase 4 (real textures) does NOT
wait on that: the bake pipeline is renderer-agnostic, and a loaded texture
blits through the 2d path exactly as a procedural cell does.

#### Phase 3, second cut, LANDED at v94: the sprite band, and what it cost

**What shipped.** The depth-sorted item pass - every shadow, prop, node,
building, unit, creature and loose flag - now draws on its OWN transparent
canvas (`sprCv`), under the same camera transform as the scene, and lands on
the scene in exactly one source-over blit. That blit goes through
`bandPresent()`: the answer is either the band canvas itself (headless,
`#nogl`, no usable GL) or a GL-processed copy from an offscreen context of
its own - today a declared PASSTHROUGH shader, premultiplied in and out.
**The passthrough IS the deliverable**: band canvas → texture → program →
back into the 2d merge, proven pixel-faithful end to end. Phase 5 swaps that
shader for per-pixel lighting against a normal band and changes nothing else
about the frame. One code path in both renderers: the band is ALWAYS
isolated, so the suite exercises the real structure headless. T70 carries
the pins.

**Why the frame is sliced HERE and nowhere else.** The plan said "2d underlay
→ GL sprites → 2d overlay" - and the overlay half of that dies on a
measurement: the combat FX above the band (tracer glows, embers, fireballs,
muzzle flashes) draw ADDITIVELY against whatever is beneath them, sprites
included. Rasterize them onto a separate transparent layer and their
interaction with the scene is unrecoverable - every explosion would change.
So everything after the band merge still draws directly on the composed
scene, additive semantics exact. The band itself contains 39 additive draws,
but nearly all are specular highlights over the entity's OWN body -
band-internal, unaffected. The exposed remainder is the ground auras (heal
glow, rally pulse), and the screenshot diff put the whole concession at a
**mean 0.048/255 per channel, p95 = 0** against the v93 renderer. That is
the cut's entire visual cost, and it is invisible.

**Two corrections this measurement round forced, recorded because that is
the point of this file:**

- **The v93 "mean 2.02/255" GL-vs-2d figure was inflated by the DOM.** The
  message toasts fade on wall-clock, so two runs seconds apart photograph
  different toast stacks - the diff heatmap put almost the whole difference
  inside the toast boxes. Toasts excluded, GL-vs-2d is a **mean 0.58/255**.
  Lesson for every future screenshot comparison: hide `#msgs` first.
- **Software GL is now REFUSED, on a measurement.** On this GPU-less box a
  forced CPU-rasterized GL frame costs ~74 ms against ~44 ms for the whole
  2d path - the machine without real GL is exactly the machine the 2d
  fallback exists for. Both stages therefore create their contexts with
  `failIfMajorPerformanceCaveat:true` (`#forcegl` overrides, for testing;
  this container's GL reports non-caveated, so the refusal itself could not
  be demonstrated here - the attribute is standard and browser-judged).
  These container numbers say nothing about real GPUs, where the whole
  pipeline is a few texture uploads and seven trivial passes.

Suite 5,303/5,303; every trail and all 42 layout pins reproduce; the sim
hash is identical across v93-2d, v94-2d, v94-GL of the same tick.

#### Phase 4 LANDED at v95: real textures for the whole roster

**What shipped.** Every baked sprite in the game now draws from a real
texture instead of the runtime vector painter: all ten infantry rows at
five walk frames each, all sixteen vehicle hulls, and all seventeen baked
buildings - in all four army colours for a shared row, in the owner's
colour alone for a faction exclusive (the bake creates cells in the other
colours too, but no army can ever field them, so the painter keeps those).
The wildlife nest is the one baked-table exception: it belongs to the bug
faction, which the sprite bake itself excludes, so its cells are never
blitted and a texture for it would be dead weight. 212 files, committed
twice on purpose exactly like the sounds: as auditable images in
`assets/img/` and as base64 data: URLs in the generated
`source/js/02d-img-data.js` (`tools/embed_img.py`), because the
double-clicked file:// page can decode a data: URL and nothing else. T71.B
holds the two byte-identical; T71.A derives the full roster from `U`/`B`/
`FAC` in both directions, so adding a unit now FAILS the suite until the
texture pipeline is re-run - the conscious step a textured game demands.

**WebP, on a measurement.** The full roster as PNG is ~5.8 MB before
base64 grows it 4/3 inside the shipped file. Lossy WebP at quality 95 is
4-6x smaller at a mean error under 0.7/255 on covered pixels - invisible
at game zoom - and the override architecture already handles the
hypothetical browser that cannot decode one: a failed decode lands in
`ASSETS_FAILED` and that sprite paints procedurally, exactly like a
missing file. `embed_img.py` carries per-entry mime (`IMG_MIME`), so webp
and png can coexist and a future hand-made texture can be dropped in as
either.

**The seam is three lines in `bakeSprites()`.** Each bake site asks
`imgAsset('inf_<key>_<fac>_<frame>' / 'veh_<key>_<fac>' / 'bld_<key>_<fac>')`
first; a hit becomes a cell through `cellFromImg()`, which returns exactly
the `{cv,sil,ax,ay,w,h}` shape `bakeCell()` returns, so the draw sites, the
shadow pass and the portraits cannot tell the two apart - measured in
Chromium: the baked cell is pixel-identical to the PNG (mean diff 0), and
`hashState()` is unchanged across a textured frame. A miss falls back to the
painter, which is what the whole headless suite permanently exercises (the
shim has no `Image`).

**Where the textures come from, honestly.** No rights-clean art is
obtainable from this container (registry-only network), and no generic pack
would match the molded-army-men look or survive per-faction tinting - so the
textures are OFFLINE-RENDERED by two committed tools: the game's own
painters drawn at 6x supersample in headless Chromium
(`tools/dump_base_v95.js`, which DERIVES the 212-sprite roster from
`U`/`B`/`FAC` so a new row is picked up automatically), then a deterministic
Python material pass (`tools/material_v95.py`) that adds what a vector
painter cannot - bump-lit plastic grain in patches, a mold seam down
infantry and vehicles, sparse scratches, worn edges on painted detail
lines, micro-occlusion, a molded-color swirl - and finishes with the exact
`enrichCell` numbers so a textured cell sits beside procedural neighbours
without a style seam. Every random draw is seeded from kind_key alone: an
army-man of every colour comes off the same mold, and a walk cycle must not
boil between frames. The first cut of that pass relit the whole sprite from
a distance-field dome and looked WORSE than the painter (washed out, forms
pillowed); the shipped recipe keeps the painter's own shading as the light
and adds only high-frequency material. Same lesson as v92's audio: generate
from the tuned recipes, ship as swappable files, let the owner's eye be the
acceptance test - the owner reviewed the eight-sprite first cut and asked
for the whole roster on its look.

**Three rails, all driven by T71:**

- **A bake that ran early re-bakes once.** The field manual can bake from
  the main menu before the page-open `assetsLoad()` resolves; the `.then`
  now calls `rebakeIfAssetsLate()`, which rebuilds `SPR` exactly once if the
  bake preceded the assets. Client-local by design: two players may re-bake
  at different wall times, or never.
- **The missing-asset warn gates on `Image`, not `fetch`** - because Node 22
  HAS a global fetch, so the v92 comment "headless has no fetch" was wrong
  in a way that only started to matter when img entries (which need `Image`,
  absent under the shim) began landing in `ASSETS_FAILED` on every harness
  run.
- **The Choktaw's tail was clipped off every sprite since v88** - it never
  had a `VEH_BOX` entry, so it baked in the 48-wide default while its
  painter reaches x=-31.3. Found because the texture had to be authored in
  the sprite's true box; fixed with `choktaw:[-33,-16,18,16]`, which also
  widens its portrait. Display-only.

Suite green with three pins consciously rewritten (T66.C boot line, T66.D
"no texture in the bake" - the claim phase 4 exists to overturn - and
T67.E's order.txt run growing one line); trails and all 42 layout pins
reproduce untouched.

#### Phase 5 LANDED at v96: per-pixel lighting, and the roadmap is complete

**What shipped.** Every v95 texture gained a normal-map companion - a
second image recording which way each pixel's surface faces - rendered by
`tools/normal_v96.py` from the same base renders and, critically, WITH THE
SAME RNG RECIPE as the material pass, so the grain a pixel shows in color
is the grain it shows in relief. 212 maps, lossy WebP q92 (745 kB; on
smooth direction fields the encode error is ~1% of tilt, invisible in
shading), committed in `assets/nrm/` and embedded as `NRM_B64` by the same
`tools/embed_img.py` run that packs the textures.

**The frame's shape, filled in exactly where v94 said it would be.** The
band pass now keeps a second canvas in register with the color band: the
three cell-blit sites mirror each sprite's normal map through `NCTX`,
reading the exact transform off the color context - which is also how a
rotating vehicle picks a pre-rotated variant of its map (`nrmRot`,
16 headings, vectors rotated in the values, cached lazily per cell),
because canvas rotation turns pixel POSITIONS but not the directions
stored in them. `bandPresent()`'s v94 passthrough became the lighting
shader: constant lamp (the painters' own LIGHT, given altitude), a plastic
specular, and up to `LIGHTV.max` point lights, all fed from the one
`LIGHTV` table.

**The claim the phase rests on: lighting is a MODULATION, not a new look.**
The shader normalizes its lamp so a flat pixel - no normal map, a
procedural fallback cell, live-drawn gear, a failed decode - comes out
exactly as it went in. The fallback ladder never changes appearance class:
no GL is v95 pixels directly, GL without maps is v95 pixels through the
shader, GL with maps is v95 plus relief. Measured in Chromium: the
lighting-only A/B (same page, same GL post, maps on/off) moves a mean
0.69/255 over the frame with every changed pixel inside a sprite
silhouette, and the marginal frame cost of the lit path against the flat
GL path is zero within noise.

**The showpiece: the battlefield casts light.** `bandLightsCollect()`
gathers, fresh each frame, the explosion core flashes (`G.parts` t:'ex',
by remaining life), the burning ground (`G.strikes[].burn`, clustered by
4x4 tile buckets so a napalm field is a few steady lights rather than a
lottery over the cap, flickering on `G.tick`), and muzzle flashes
(`u.flash`). EVERY source is vision-gated - an explosion or a shot you
cannot see lights nothing, because light through fog would be a wallhack.
Client-local throughout: no srand, nothing hashed, nothing serialized;
two clients may disagree about every light and still agree tick for tick.

**One edge found by its own A/B:** a frame where lighting turns off while
the GL hop still runs must not inherit the previous frame's normal band
and lights - the stale-state clear in renderCore (T72.C) exists because
the first A/B screenshot pair showed exactly that haunting.

Suite green with T70's passthrough pins consciously rewritten (the claim
v94 existed to set up, not a loosening) and T71/T67-style scoping edits;
T72 carries the new pins. Trails and all 42 layout pins reproduce
untouched.

#### v96.1 - the graphics feedback pass

**The owner played v96 and sent back three findings; each is a change and a
check** (`tail_v96_1.js`, T73 - the v92.1 pattern applied to pixels).

- **The walls had no textures - correctly, and wrongly.** Both barricades
  are live-painted rather than baked (v88's decision), so the v95 pass
  skipped them by structure. They join now on their own terms: a texture
  cell per colour - the shared wall in all four army colours plus the
  map's NEUTRAL dark gray, the Heavy Barricade in Gray's alone - blitted
  by `drawBarricade` itself, with the hedgehog painter as the fallback
  (there is deliberately no baked procedural cell behind a wall; the
  painter IS the fallback, as it has been since v88). The bake box is the
  painter's measured extent plus margin (`BARR_BOX`), the same probe the
  Choktaw fix used. T71.A's derived roster grew the wall rule in the same
  edit as the generator, so they cannot drift.
- **Flame cast almost no light.** Two causes, both real: the burn-cell
  source shipped timid (r 64 / i .34 reads as nothing in play), and a
  flame WEAPON mid-stream cast nothing at all - the muzzle-flash source
  skips weapon class 'f' (that skip is for the star sprite, correct), and
  no burn cell exists under a plain flamethrower. `LIGHTV.fire` was raised
  to r 90 / i .75 and a new `LIGHTV.flame` source (r 120 / i .85) lights a
  flame weapon at its stream's MIDPOINT - the glow sits on what is being
  burned, not on the nozzle. Pinned as an ORDER (flame > flash), not just
  numbers.
- **Infantry lighting washed out half the figure.** Data, not shader: a
  tiny silhouette makes the distance-transform molding dome steep
  everywhere, so most of a lit infantryman sat at the lamp's maximum. The
  fix is a per-kind override in `normal_v96.py` (`KIND_NRM`: inf nz 2.4
  to 3.6, dome and painted-shape weights down ~40%) and 125 regenerated
  maps; measured on the A/B, the lit grunt keeps its face shading instead
  of blowing through it.

#### What phase 1 looked like before it landed, kept for the reasoning

#### Phase 1 is the only phase with a structural risk, and it lands on `main`

Phase 1 is `source/*.js` + a concatenating build + an async asset-load step,
shipped with an EMPTY manifest and no visual change. Three things about it:

- **It belongs on `main`, not on the renderer branch.** If the branch forks
  first, `main` keeps editing `plastic-warfare.html` while the branch holds
  `source/*.js`, and every subsequent gameplay fix becomes a hand-merge across a
  file split. Land the split, then fork.
- **Its acceptance test is `triage.sh`.** A file reorganisation is supposed to be
  bit-identical. If any of the 42 layout pins or any hash trail moves, the
  concatenation order does not match the current file order and the sim has
  silently changed. 321 top-level `const`s, some derived from others, and at
  least one post-table mutation (`B.guardtower.dm=` runs AFTER the `B` literal)
  make this a real hazard rather than a theoretical one.
- **The async problem is the actual new work.** `bakeSprites()` is synchronous
  and `newGame()` is called synchronously by hundreds of fixtures across the
  tails. Asset loading is not synchronous. Phase 1 has to introduce a load phase
  that the headless suite can skip or resolve instantly, without that skip
  becoming a second code path the tests then fail to cover.

#### The rule that protects the suite: assets OVERRIDE, they never REPLACE

Every procedural painter stays. `bakeSprites` prefers a loaded texture and falls
back to `trooperBody` / `vehBody` / `bldBody` when one is absent. Three payoffs:
the game still runs with a missing file, art can be replaced one unit at a time
(phase 4 is 25 independent steps, not one), and the ~124 drawing assertions keep
testing a path that still exists. The headless shim has no image decoder and no
WebGL context; deleting the painters deletes those checks with them.

#### What phase 3 must not do

Swap the renderer while the ART IS UNCHANGED. Phase 3 draws the same
procedurally-baked cells through WebGL, so any visual difference is the
renderer's doing and nothing else. This is the same discipline the v89 and v90
notes keep arriving at from the other direction: change one thing, measure the
mechanism, and do not let two changes share one verification.

### Roadmap 1 (v79-v82): every existing exclusive gets a passive and a toggle. LANDED.

v79 is phase 1 of 4. Every faction-exclusive unit and structure gets ONE passive
and ONE player-toggleable ability. Green landed at v79, Tan at v80, Gray at v81
and Blue at v82, so ROADMAP 1 IS COMPLETE. The whole scope was approved up
front, so the phases below are DECIDED, not proposals - build them as written
unless the owner says otherwise. Nothing below is outstanding; it is kept as the
record of what each phase was told to build and what each one actually cost.

### Roadmap 2 (v85-v88): every army fields a full exclusive set. IN PROGRESS.

The owner's target state, approved in full before v85 began: **all four armies
have two unique buildings (each with an ability), at least one unique unit out of
the Barracks, the Garage AND the Helipad (each with a passive and an ability),
and one unique Radio Tower call-in.** Same cadence as roadmap 1 - ONE FACTION PER
VERSION, so trail divergence stays attributable (rule 7a below still governs).

**Blue landed at v85, Green at v86 and Tan at v87.** Gray is v88 and is the last.
The full specification for it is in "Roadmap 2: the remaining three armies" below;
it is DECIDED, not proposed. The v86 and v87 entries there are left in place as the
record of what each was told to build, exactly as the roadmap-1 phases are.

Rule 1a below was OVERRIDDEN BY THE OWNER for roadmap 2: cooldown abilities on
units are now in scope, and the `u.abCool` machinery they need is to be built
when the first one lands (Tan's Napalm Blast at v87, Gray's Paint at v88). v85
needed none of it - Sprint is a sustained mode in the roadmap-1 shape - and v86
needed none either: Broadcast is a sustained mode, and Bail is an instantaneous
one-shot that destroys the unit offering it, so there is nothing to recharge. The
machinery LANDED AT v87 and is `t.abCd` / `u.abCool` - see the v87 note below.
Gray's Paint needs `abCd:20` on its row and nothing else.

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

## Roadmap 2: all four armies (COMPLETE at v88)

Blue landed at v85, Green at v86, Tan at v87 and Gray at v88. The specification
below is kept VERBATIM as it was written and agreed, so what each release was
told to build can still be read against what it cost - the per-release notes
further down are the other half of that record.

### v86 - GREEN ARMY

  COMMAND TRUCK (Garage). Fairly slow.
    Passive `Forward Command` - a mobile build anchor that permits **only
    barricade, guard tower and barracks** placements near it. Nothing else.
    Toggle `Broadcast` - allies within 5 tiles reload 20% faster; the truck is
    pinned in place while it runs.
  OBSERVATION BALLOON (Helipad, REPLACES the proposed observation helicopter).
    Highest vision in the game. **Only weapons in the `a` / AA-missile row can
    target it, and at 1/3 damage**; splash never touches it. Drifts slowly. Runs
    out of fuel after ~3 minutes and crashes; the crash destroys it and kills
    everyone aboard - it does NOT auto-Bail. NO unit limit.
    Passive `High Ground` - allies within its vision get +1 range.
    Ability `Bail` - spawns 1 Grunt, 1 Machine Gunner, 1 Grenadier and 1 Bazooka
    Man on the ground beneath it, and destroys the balloon.
  COMMAND POST (second structure).
    Passive - units within 8 tiles gain veterancy faster.
    Ability `Regroup` - nearby units gain 25% HP. The "instantly reloads" clause
    from the original proposal is DELETED; do not reinstate it.
  SUPPLY DROP (call-in). Two green crates, one carrying 500 plastic and one 500
    electricity. Only the owning player's units collect them. Instant on pickup.
    No expiry.

### v86 - GREEN ARMY. LANDED. See the v86 notes below for what it cost.

### v87 - TAN ARMY. LANDED. See the v87 notes below for what it cost.

  FIREBOMB HELI (Helipad).
    Passive `Scorched Earth` - its hits leave the ground burning.
    Ability `Napalm Blast` - 10 napalm blasts on 10 random tiles within a 3-tile
    radius of the helicopter, with a prolonged burn on enemy units, structures
    AND empty ground. **30-second cooldown - this is the first unit ability that
    needs `u.abCool`, so that machinery lands here.** The burn damages friendlies.
  FOUNDRY (second structure).
    Passive - vehicles produced while it stands get +10% HP.
    Ability `Pour` - the next vehicle in every Garage completes instantly, at a
    plastic surcharge.
  NAPALM BECOMES TAN-EXCLUSIVE. It leaves the shared pool; Fuel-Air Bomb is
    dropped entirely. Green, Gray and Blue keep Barrage + Paradrop + their own;
    Tan gets Barrage + Paradrop + Napalm. The `fac` field v85 added to
    RADIO_ABILITIES is the mechanism - see below.

### v88 - GRAY ARMY. LANDED, and roadmap 2 is finished. See the v88 notes below.

  CHOKTAW HELI (Helipad). Carries the Huey machine gun (row `b`) AND the Apache
    rocket pods (row `r`) - use the Bull's `sec` secondary-weapon machinery. HP
    above the Apache's 187.
    Passive `Forward Observer` - friendly indirect fire gets +2 range against
    anything it can see.
    Ability `Paint` - paints enemy units in a player-chosen 2x2 tile area;
    painted units take **+25% damage from ALL sources** for 10s. 20s cooldown.
  HEAVY BARRICADE (second structure). Triple the normal barricade's HP (50 ->
    150). A **-15% damage aura, STACKABLE, capped at 60% total**, on the tiles
    immediately surrounding it, applying to structures and other barricades as
    well as units. **NO activated ability.**
    On construction, a ONE-TIME 10% roll spawns an invisible mine 3 tiles "in
    front" of it (front = facing the nearest enemy HQ). This is a **NEW mine type
    that only Gray can see and that does not detonate on Gray units**; same damage
    as the existing mine.
  SMOKESCREEN (call-in). 7x7 tiles, **-40% damage** to friendly units AND
    structures inside, 10 seconds. Deliberately stronger than the Mortar's Smoke
    Rounds (SMOKE_RED 0.2, radius 2, 5s, units only) - that is intended, not an
    oversight to be balanced away.

## harness note: the report's generated prose has now been wrong three times

Every one of these was in a sentence the page writes about itself, none was in a
number the simulation produced, and every one was found by running the tool on a
dataset it had not been written against. The count is the point: this is not a bug
that got fixed, it is a CLASS of bug that keeps producing new instances.

- **Two coincidences of the first batch** were baked in as facts: that the army
  producing the most units was also the one trading worst, and that the champion had
  won and lost on the same doctrine. Neither held on the second batch.
- **A literal `'0 wins from '`** in the "never won" card. Two batches running, the
  weakest doctrine happened to have won nothing, so the hard-coded zero was true by
  accident. At 16 matches `defensive` won once and the card stated a figure that was
  simply false, under a heading that was also false. It now reads the count and
  relabels itself "Weakest doctrine" when it is not zero.
- **A list that was never deduplicated**, which is invisible at four matches and
  printed "harasser and harasser and defensive and defensive and defensive" at
  sixteen. The same paragraph named one army twice ("Tan drew it 5 times; Tan drew it
  5") whenever the champion was also the army that drew the weakest doctrine most.

The rule that falls out: **a generated sentence is a claim, and it needs the same
evidence as a generated number.** It is worse than a number in one specific way -
it reads perfectly against the data it was written from, so reviewing the page you
generated tells you nothing. Only a second dataset does. Both `sim_report.js` and the
notes now branch on the condition instead of asserting it, and any batch of a size
the page has not seen before is worth reading once, in full, before believing it.

**A blank page was the other failure mode, and it now cannot ship.** A quoted string
wrapped across a line inside a template literal is a syntax error, and the resulting
page loads, paints its empty shell and fills in nothing - no title, no tables, no
error a reader would see as anything but an odd blank report. `sim_report.js` now
compiles the page's script block with `new Function` before writing (compiles, does
not run) and refuses to emit a page that cannot execute. Verified by injecting that
exact bug: exit 2, and the message names the block.

## v90.2: the HUD legibility pass, and a top edge that never scrolled

Two things the owner asked for. The second one uncovered a bug that has been in
the file since edge scrolling was written.

**The message toasts were 160px off the BOTTOM, which is inside the selection
panel.** The panel is 118px at its minimum and stands 8px off the bottom edge, and
with a Construct row open it measures 332 — so five seconds of toast landed on the
build menu every time anything happened, which is exactly when the player is
reading it. They are at the top centre now. The only other thing that claims that
space is the survival banner, and the toasts clear it BY CONSTRUCTION rather than
by luck: the offset is `calc(var(--topbarH) + 10px + var(--bannerH))`, so it names
the banner's own slot. Measured in Chromium at 6px clearance with the banner up.

**The bar is twice as tall (42 → 84) and everything in it scaled with it** — text
14 → 20, buttons 13 → 17, the army dot 14 → 20. Raising the `.tbtn` base is the
only part with a blast radius: three `.tbtn` buttons live OUTSIDE the bar
(`#hqBtn`, `#mmSizeBtn`, `#hqPlaceBtn`) and stay put only because each overrides
both font-size and padding. `T65.C` asserts all six overrides rather than trusting
them, because dropping either one would silently inflate a button in a corner.

**The height is a variable now, and that is the real change.** Four boxes hang off
the bar's bottom edge — the right rail, the help box, the survival banner and now
the toasts — and every one of them was a hand-typed `50` or `52` that nothing tied
back to the `42` they came from. Doubling the bar meant finding all four by eye.
They derive from `--topbarH` now, and `T65.B` asserts that none of them states a
literal top. `T50.A` transcribed `#rightRail{...top:50px;bottom:8px` in full and
was REWRITTEN to the claim it was making (the rail is the box that carries the
bottom bound), not re-pinned to the new string.

### v90.2 finding: the top screen edge has never scrolled, in any release

The edge-scroll test read:

```js
if(MOUSE.y<14&&MOUSE.y>44)G.cam.y-=spd;
```

**No number is both below 14 and above 44.** The branch is unreachable, and has
been since it was written, while the Field Manual has promised "push the screen
edge" since v43. Nobody reported it because a dead scroll direction feels like a
game that simply does not scroll that way — there is no error, no visual tell, and
the other three edges work.

The intent is legible from the dead constant: `44` is the OLD bar's height (42 plus
its 2px border, back when the sheet was not border-box about it), so the rule
wanted "a 14px band starting where the chrome ends". Both halves are fixed, and the
bound is `TOPBAR_H` rather than a literal because this release is what made 44
wrong twice over.

Three things worth carrying forward:

- **`TOPBAR_H` is a deliberate second copy of a number the stylesheet also states,
  and it is only allowed because a test enforces the agreement.** CSS cannot be
  read from the script, and the edge band has to know where the bar ends. `T65.B`
  scrapes `--topbarH` out of `pw.html` and asserts the constant equals it — the
  same contract `data-tune` / `HELP_TUNE` has held for the Field Manual since v43.
- **It is the height, NOT the height plus the border.** The sheet opens with a
  global `*{box-sizing:border-box}`, so the declared height IS the outer height.
  The first cut of `TOPBAR_H` was 86 and it took a real Chromium measurement to
  catch — a two-pixel error in a scroll band is not something any test or any
  player would ever report, which is why the constant was measured rather than
  reasoned about.
- **A dead branch is worth asserting as arithmetic, not as prose.** `T65.D`
  reproduces the old condition over every screen row and shows it is satisfied by
  none, then drives the real one through `update()` at six mouse positions. The
  functional half also has to state what it is NOT touching: it moves the camera
  inside a sim tick, which would be a lockstep divergence if the camera were sim
  state, so the section asserts `G.cam` is in neither `hashState` nor the
  snapshot rather than relying on a comment three files away that says so.

No trails moved: the whole release is stylesheet plus one client-local camera
bound. `sim.sh` was not re-run and did not need to be — nothing here is reachable
from `aiTick`.

## v90.1: three interface repairs, and one of them reaches the simulation

The owner asked for three things: the two barricade tiles were blank in every
army's Construct menu, the menu itself stood two rows tall over the middle of the
battlefield, and losing your HQ locked you out of building anything at all. The
first two are pure display. The third turned out to need a table field, a sim
door and a bot rule, and it is the only part of the release worth arguing about.

**The wall thumbnails were the v88.1 regression, in the call site v88.1's own note
said it did not reach.** `tail_v88_1` fixed `infoPortraitCv`, the Field Manual's
painter, and its comment says in as many words: *"T30.C's sweep was fixed to pass a
real row at v88; this call site is the one it does not reach."* There was a THIRD
call site — `tileURL`, which paints the Construct and Train tiles — carrying both of
the same two faults:

- the stub was hard-coded to `{key:'barricade'}`, so the Heavy Barricade drew the
  ordinary hedgehog's silhouette on the occasions it drew anything at all;
- it passed no `t`, and `drawBarricade` reads `b.t.hbarr` on its fifth line, so the
  ORDINARY wall threw immediately — into a bare `catch(err){}` that turned the
  exception into a blank data URL.

Two tiles, four armies, three releases, and nothing said so. The lesson is v88's
own, stated one level up: **when a painter starts reading a new field, grep for its
CALLERS, and do not stop at the first one you fix.** `tail_v90_1` T64.C covers the
tile path directly — it spies on `drawBarricade` and asserts both the key it was
handed and that `b.t === B[b.key]`, because the shim has no `toDataURL` and the
returned URL is `null` whether the paint worked or not.

**The menu was two rows because 1240px holds twelve tiles and every army's menu is
thirteen.** That has been true since v85, when Blue's second exclusive took the
roster to thirteen — the same release the fourteenth hotkey was added for. Widening
`max-width` to 1340 is only half of it: what the panel is GIVEN is the window minus
`applyMMSize`'s minimap reserve, so at a 1440px window it is handed 1216 whatever
its max-width says. The tile narrows on three breakpoints (96 → 86 → 78 → 70px)
rather than the row wrapping. T64.B derives the requirement from the stylesheet's
own numbers — tile width, gap, padding, border, roster length — so a later resize
cannot leave the check agreeing with a menu that has started wrapping again.

**The order is a declared `cat` field on the B row, not a guess off its flags.**
Producers, economy, defence, then the rest; alphabetical by the name the tile shows
inside each shelf; the three producers keep tech order (Barracks, Garage, Helipad)
because that is what they read as. It has to be declared: "is this economy" has no
flag that answers it — the Radar Tent carries no eco marker and the Outpost carries
three — and keying it on the key is the mistake the Heavy Barricade cost fourteen
tests to unlearn at v88. `T35.E` was the one pin that moved: it asserted the Supply
Depot sat at index 1, which after a sort is a position nobody chose. It was
REWRITTEN to the claim it was actually making (the depot outranks the Lab) rather
than re-pinned to the new index, which would only have pinned the sort to itself.

**One HQ at a time is `lim:1`, i.e. the Radio Tower's field**, which means every
door in the file already honours it: `startPlacing` refuses it, `structTile` greys
the tile, and `execCmd`'s build case enforces it against a peer sending anything
else. The bot is the surface that hides — `aiTick` calls `placeBuilding` directly
and never goes through `execCmd`, which is v87's Napalm lesson restated for a
structure — so its limit is a separate scan of `p.blds`.

**The rebuild button grants no new permission.** It is `startPlacing('hq')` hung on
the minimap header, which is the one piece of chrome on screen whatever is
selected; with no HQ standing there is nothing left to select that carries a
Construct menu. `placeDeny` is untouched: the enemy-HQ exclusion ring, the
footprint and spacing rules and the build-vision gate all still refuse it. T64.E
asserts that by name.

### v90.1 measurement: the bot's rebuild is CORRECT and, in a real deathmatch, unreachable

This is the part worth carrying forward, and it is the v89 shape again: the
mechanism is not the thing to measure.

`aiTick` now rebuilds the HQ as the first spend of any tick in which the bot holds
none, and holds the HQ's plastic back from buildings, units, research and walls
while it holds none — the `saveExp` reserve pointed at a structure. Without that
reserve the feature would be dead and would still LOOK built: v89 measured the
median bank at a production decision near 100, and an HQ is 500.

Instrumented over the standard 8-match batch (`SEED0=101`, the four DM maps),
counting only bots and sampling once a sim-second:

| what | measured |
|---|---|
| bots that lost an HQ | 3 per match — every army that loses does |
| sim-seconds a bot spends with no HQ | 10 to 111 each, 55–143 per match in total |
| bank while HQ-less | **median 110–177, max 308**, against a 500 price |
| times `aiFindSpot` was asked for an HQ spot | **0** |
| rebuilds | **0** |

The reserve is working — the median bank while HQ-less sits well above v89's ~100
baseline — and it is still not enough, for a reason that has nothing to do with
the reserve. **A bot that loses its HQ has lost its economy in the same stroke.**
The HQ is a `drop` building, so its trucks have nowhere to deliver; `wantTrucks`
falls to 2 and `truckBld` is undefined, so nothing is even queued. The only income
left is the difficulty assist, `1.5 × eco` per aiTick at one aiTick every 18 game
ticks — about 2.5 plastic a second, so **200 seconds to a 500 HQ**. The bots
survive 10 to 111.

Two bots got within 200 of the price (banks of 282 and 308), so it is marginal
rather than absurd, and a bot that loses its HQ to a raid while its army and its
outposts are intact WILL rebuild. It just never happens in a game that is already
being lost, which is when a headquarters usually falls.

**The lever, if anyone wants the bot rebuild to actually fire, is income while
HQ-less, not the reserve.** Do not reach for a discount on the HQ: the owner asked
for it at normal cost, and the human's button is the deliverable this release was
actually for. Measure with the probe shape above — count `aiFindSpot` asks by key
and sample the bank, exactly as `probe_v89.sh` buckets production decisions —
before changing anything, because the class of "it looks built and does nothing" is
what both v89 and v90 were about.

**No trails moved and no repin was due, and this time the reason is stated rather
than assumed** (v89's was wrong and v90 corrected it). Every line this release adds
to `aiTick` is behind `noHQ`, a plain scan of `p.blds` that draws nothing from the
seeded stream while it is false. The trails are 900 ticks — thirty seconds — and no
HQ dies inside them. T64.F asserts that guard functionally by counting
`aiFindSpot` calls by key rather than leaving it as prose here, with a mutation arm
that kills the HQ and shows the same probe firing on the very next tick.

## v90 BALANCE BASELINE: 64 matches, and it supersedes the 24-match brief

Every faction conclusion in this repo before this section came from a **24-match**
read taken at v88.1. This is **64 matches** on v90 as merged (`fc60077`), four seed
sets of sixteen (`SEED0` 5000 / 7000 / 9000 / 11000), 64 distinct seeds verified, no
match counted twice. Where the two disagree, this one wins on sample size alone.

Reproduce with `./sim.sh 16` at each of those four seeds and combine the
`sim_out/game_N.json` records into one directory before running the reporter -
`sim.sh` wipes `sim_out` on every run, so copy each batch out before the next.

### Doctrine

| doctrine | drawn | wins | win% | kills/match |
|---|---|---|---|---|
| harasser | 45 | 17 | **37.8%** | 238 |
| aggressive | 54 | 17 | 31.5% | 230 |
| balanced | 54 | 15 | 27.8% | 227 |
| defensive | 48 | 7 | 14.6% | 153 |
| turtle | 55 | 8 | 14.5% | 159 |

**`defensive` recovered and `turtle` did not.** At v88.1 they sat at 4.8% and 9.1%
and this file called both near-dead. v90's `firstPush` pass lifted defensive to
14.6%; turtle is statistically where it was. Whatever is wrong with turtle is not
its opening, because the opening is the thing that moved for the other one.

**`harasser` is now the best doctrine, up from 21%.** It is the profile that asks
for the most air (38%), so this is the clearest single confirmation that v89's
delivery fix works - the doctrine whose plan depended on aircraft could not execute
it before and now can. Note what that means for future comparisons: the doctrine
spread did not flatten, it REORDERED.

### Army, draw-adjusted

Ranking armies on raw wins is wrong here for the same reason it was at v88.1: the
doctrine deal is uneven and dominates. *Expected* is what an average army takes from
that exact hand, so it only reallocates wins that actually happened.

| army | wins | expected | delta | K/L | line units built | hand (agg/bal/har/def/tur) |
|---|---|---|---|---|---|---|
| green | 26 | 15.30 | **+10.70** | 1.19 | 11,128 | 15/12/8/15/14 |
| gray | 17 | 16.32 | +0.68 | 1.06 | 9,795 | 14/14/12/10/14 |
| tan | 11 | 15.62 | −4.62 | 1.02 | 9,437 | 10/12/13/15/14 |
| blue | 10 | 16.76 | **−6.76** | 0.63 | 12,639 | 15/16/12/8/13 |

**Green has overshot, and it is probably v89/v90's own doing.** At v88.1 Green was
average (+0.42 on 24 matches) and this file explicitly said "Green is fine, do not
fix it". It is now the strongest army by a wide margin, on the second-weakest hand.

The hypothesis, stated as one because it is not yet measured: **every reserve added
at v89 and v90 is denominated in plastic, and Green pays 8% less for everything.**
`gRsv` holds the price of the cheapest short-class unit; `buyTilt` holds a share of
the gap up to a producer's top price. Both thresholds are prices, so Green clears
each of them sooner than anyone else, on every producer, for the whole match. No
other faction modifier interacts with a spending threshold at all.

**Check the mechanism before re-pricing anything.** `probe_v89.sh` reports the
reserve's target class and the tilt's hold rate per bot; the question to ask it is
whether Green's producers spend a smaller share of their ticks blocked by either
reserve than the other three armies' do. If they do, the fix belongs in how the
thresholds are computed - scaling them by `FAC[p.fac].mods.cost` would make the
reserve mean the same thing to every army - and NOT in Green's cost modifier, which
is a design identity that predates all of this.

**Blue is untouched by two passes and is still last.** K/L 0.63 against 0.65 at
v88.1, and it builds the MOST units of any army (12,639) while getting the least out
of them. The air work did nothing for it. This was the first lead in the v88.1 brief
and it is still open, still unexamined, and now the single clearest defect.

### What held, across all four seed sets

Air **8.4%** of line production and AA **2.7%**, against 3.6% / 1.2% at v88.1 - the
same figures the 16-match tuning batches gave (8.6/2.8 and 8.4/2.7), so this is not
seed-specific. Infantry **69.2%**, down from 76.0%. Mean match length **13:40**,
up from about 13:20 at v88.1 and well under the 20:00 cap; five of 64 hit the cap.

### Where v89 and v90's checks live

Neither release has a `tail_vNN.js` of its own - the first two since v83 without
one. Their checks went into the tails that already own the subsystems they touch,
which keeps each claim next to the code it is about but costs the usual "what does
this release assert?" grep:

- `tail_v59.js` - T39.B and T39.I, the transcribed `mixWant` pins and the mutation
  arm proving the air targets drive air production
- `tail_v60.js` - T31.F, extended at v90 to pin the `towers` spread, the `buyTilt`
  ordering, the `firstPush` values and the deleted rolled `aggro`
- `tail_v63.js` - T42.D, the anti-stall guard that bounds `buyTilt`, and T42.F, the
  defensive-stacking ladder

## v90 finding: the hash trails cover the AI's OPENING, not the AI

v89's section below, and `CLAUDE.md` with it, claimed the pinned trails never fire
`aiTick` because testing mode boots every slot human. **That is wrong.** `triage.js`
builds its COMBOS trails with `cfgTan` / `cfgGreen`, neither of which sets
`test:true`, so every one of them is a real match against three live CPU opponents.

What is true is the window. They run 900 ticks and sample every 90: **thirty
seconds**. At thirty seconds a bot owns a barracks and maybe a garage, has no
helipad, and is still on its opening build. That is why v89's pass held them —
target mixes, the AA floor and the class reserve all need a helipad or a mid-game
bank before they do anything — and why v90 moved eighteen combos by touching one
number, `firstPush`, which fires at about twenty-five seconds.

The rule to carry: **a clean trail after an AI change means the opening is unchanged,
not that the AI is unchanged.** Neither v89 nor v90 is a counterexample to the other;
they are the two sides of a thirty-second boundary nobody had written down.

## v90 finding: a "save up for better units" lever has two failure modes, and the first cut hit both

`buyTilt` makes a profile hold back part of the gap up to the priciest unit its
producer can currently build, instead of filling the slot with the cheapest thing.
The first cut was gated on the bank reaching **half** that top price, borrowed
deliberately from the faction floor's own `cheap*0.5` idiom so that "near enough to
be worth waiting for" would mean one thing in both places.

**It was inert.** Measured, the bank at a production decision runs near 100 plastic;
against a 239-plastic Sarge the half-price gate is 120, so the tilt switched off in
exactly the band where it was supposed to bite. The sim showed a defensive bot's mean
unit cost going DOWN, and it took a mechanism probe to see that the reason was "it
never fired" rather than anything about the scoring.

The second failure mode is the opposite one and `T42.D` catches it: a bot **under its
faction quota** that also holds out for a pricier unit buys nothing at all. The fix
is not a bank threshold — it is that the quota outranks the tilt, exactly as it
already outranks both v89 reserves. The bank threshold survives only as a coarse
anti-stall floor, cut to a quarter.

**Measure the mechanism, not the outcome.** `buyTilt`'s effect on mean unit cost is
inside the noise of a 16-match batch, because the class mix dominates that number: a
harasser wanting 38% air out-costs a turtle wanting 50% infantry however either
shops. How often the tilt actually refuses a cheap unit is not noisy at all, and
`probe_v89.sh` now reports it per profile:

| profile | buyTilt | producer-ticks it held back |
|---|---|---|
| aggressive | 0.00 | 0% (never eligible, by design) |
| harasser | 0.15 | 5.1% |
| balanced | 0.30 | 10.7% |
| defensive | 0.50 | 15.7% |
| turtle | 0.60 | 17.6% |

Monotonic in exactly the profile order, on 16 matches; the extremes reproduce on a
second seed set (aggressive 0%, turtle 16.6%) while the middle two swap, which is
what eight matches buys. Within-class unit cost moves the way the tilt intends where
the price spread is wide enough to show it - defensive's mean vehicle cost 131.6 to
138.9, turtle's 120.4 to 123.8, aggressive unmoved at 115 - and is lost in the noise
on infantry, where most of the roster sits between 33 and 160.

**Guard-tower counts are a want, not a count.** `towers` sets what the profile asks
for, but what gets BUILT also carries the per-outpost tower rule, which is
independent of the profile, plus rebuilds after losses. Aggressive drops (3.55 to
2.18 per match) and defensive climbs (3.21 to 5.29), but the middle three do not
sort cleanly and should not be expected to.

## v89 finding: the bots were not ignoring air, they were unable to buy it

`sim.sh` said air was 3.6% of everything built and AA 1.2%, against profile targets
asking for 6% to 30%. The obvious readings were that air is overpriced or that
`aiPickUnit` structurally under-rates it. **Both were wrong, and `probe_v89.sh` is
the tool that says so** - it buckets every production decision by the FIRST clause
that refused it, which an outcome table cannot do.

What actually refused, at v88.1, in order of size:

1. **Supply.** At a helipad decision that had the plastic in hand, `supFree` was 0
   on the median and under a Huey's 3 on **71.4%** of them - with `supCap` already
   pinned at its 110 ceiling, so there was no depot left to build. Infantry at one
   supply a head reaches the cap first and holds it. An aircraft could only ever be
   bought in the gap left by something dying, and the next Grunt closed that gap at
   a third of the price.
2. **Plastic, but not the way it looks.** Over all helipad decisions the bank held a
   median of **96** against a Huey's 200. The bot was not saving badly; it was not
   saving at all, because a Grunt at 36 is affordable on every tick and drains the
   till before the expensive producer is reached again.
3. **Energy was never the problem** - and this is the one worth recording, because
   it is the one the cost table makes look damning. A Huey costs 80 energy and a
   Grunt costs 0, so power reads like the obvious culprit; measured, energy at a
   helipad decision sat at a median of **2,287** and blocked 4.7% of them. The
   generator policy that looks too stingy on paper is fine in play.

The fix is one mechanism, `gRsv` in `aiTick`: while a class is short and its own
producer is ready to buy, every producer that cannot supply that class holds back
the cheapest such unit's price **and its supply cost**. It is the `saveExp` reserve
pointed at a class instead of at an outpost, derived per tick from the tables and
`p.res`, storing nothing and hashing nothing.

Two things about it were got wrong first and are worth not repeating:

- **A reserve that lifts when the bank touches the price is a race, not a reserve.**
  The first cut released the plastic the moment it reached 200; the cheap producer
  took it back before the pricey one came round again, and the measured bank stayed
  at 106 tick after tick. Both halves now stand for as long as the class is short.
- **Ranking classes by RAW shortfall hands the reserve to whichever class was asked
  for in the largest quantity.** Measured, it chose vehicles on 25.4% of ticks and
  air on 13.6%, on bots holding a third of the air they wanted - because a 0.32
  vehicle target can be 0.10 adrift and a 0.17 air target cannot be. Ranking on the
  shortfall *in proportion to the target* fixes it; the absolute floor stays as the
  entry test.

With delivery working, the target mixes became the real lever and were retuned
toward air (`AI_PROFILES`), and the standing AA pairs rose with them - that floor is
the only PRE-EMPTIVE air defence in the file, because `aiPickUnit` scores an AA truck
at a hard zero until something is actually flying.

Measured end to end on identical seeds, same tool both sides:

| batch | inf | veh | air | aa |
|---|---|---|---|---|
| 16 matches @ SEED0=2000, v88.1 | 76.0% | 19.2% | 3.6% | 1.2% |
| ...same seeds, v89 | 68.3% | 20.3% | **8.6%** | **2.8%** |
| 8 matches @ SEED0=101, v88.1 | 73.6% | 20.7% | 4.0% | 1.7% |
| ...same seeds, v89 | 69.0% | 19.9% | **8.5%** | **2.6%** |

Two side effects, both real and neither aimed at. Matches run about 90 seconds
longer (13:21 to 14:53 on the 16-match batch), which is what a real air-and-AA layer
costs in attrition. And the faction spread flattened hard on batch B - v88.1 had Tan
on 8 wins and Green on 1, v89 had 5/4/4/3 - which is consistent with air being a
rock-paper-scissors layer that was missing, but is one batch and should not be
believed without re-running on a third seed set.

**One thing was tried and reverted: moving the helipad up `aiTick`'s wish list.** It
changed nothing, to the last decimal, across eight probed matches. The pad is not
gated by its position in that list but by its RESEARCH - the loop skips any entry
whose tech is not in yet, so the pad is passed over silently until `b_helipad` lands,
and by then the bot can afford it wherever it sits. Anything wanting aircraft on the
field sooner has to move `b_helipad` up `aiResearch`'s plan instead. `T31.D` and
`T39.J` both pin the pad's position between the two guard towers, so that revert was
also the thing that kept them green.

`probev89.js` and `probe_out/` are git-ignored on the same rule as `sim.js`: they
regenerate from the seeds. The probe MIRRORS `aiTick`'s own filter in order to name
which clause refused, and that copy has to be kept in step with the original - if the
two drift, the probe reports on a bot that does not exist.

## harness note: sim.sh, and what eight bot matches can and cannot tell you

`./sim.sh` plays whole deathmatches with a CPU in every seat and writes
`sim_out/battle-report.html`. Three tracked pieces: `sim_dm.js` runs ONE match and
prints a JSON record, `sim_report.js` turns a directory of those into the page, and
`sim_page.html` IS the page - the report generator only substitutes the data, so the
page is edited as ordinary HTML rather than as strings inside a script.

**It needed almost no new mechanism, because the game already had all of it.** v55's
spectate flag (`watch:true`) seats a CPU in slot 0 like the rest, so the roster is
all bots and every faction fields exactly one army; without it slot 0 is a human seat
with no brain, a sitting duck that decides the match by not playing. And `newGame`
already deals behaviour profiles from a seeded shuffle WITHOUT replacement, so a
four-army match always gets four different ones of the five. Assigning profiles in
the tool would have been a second mechanism racing the game's own. The seed is the
whole control surface and a match re-runs identically from it.

Do NOT reach for `G.test` to get bots: testing mode boots every slot HUMAN, so no
slot is handed an AI brain and `aiTick` never fires at all.

**The results move much more than eight matches suggests.** Two batches on the SAME
eight seeds, differing only in which map each seed ran on, gave Green 6 wins in one
and 4 in the other. Turtle went 0-for-8 in both, then won a match in a four-game
batch on different seeds. The profile deal is the loudest term: four drawn from five
means the counts drift every batch, and a profile that never wins dragging one army
down twice as often as another is enough to reorder the table. Any claim off one
batch wants a second batch on a different `SEED0` before it is worth writing down.

**Two bugs here were only findable by running the tool on a SECOND dataset**, and
both were in the generated prose rather than the numbers. The page writes its own
summary paragraphs off the data; the first cut of those was written while looking at
one batch, and it silently baked in two coincidences of that batch - that the army
which produced the most units was also the one that traded worst, and that the
champion had won and lost on the same doctrine. On the second batch the first read
as one army's unit count followed by another army's kills, and the second asserted an
overlap that was not there. A generated sentence is as capable of being confidently
wrong as a generated number, and it does not look wrong on the batch it was written
against. The fix in both cases was to branch on the condition instead of assuming it.
A four-way tie on wins now reports as a tie, too, rather than naming whichever army
sorted first.

`sim.js`, `simrep.js` and `sim_out/` are git-ignored on the same rule as `tri.js`:
they regenerate from the seeds, so committing them would put a second, staler copy of
a reproducible result in the tree.

## harness note: triage's layout gate could report clean on a short walk

The recut one-shot (`recut_v90.js` at the time of writing; the file is carried
forward and renamed each release, so read whichever single `recut_vNN.js` ships)
walks 42 layout pins and refuses to cut a single trail unless
`checked === 42`. `triage.js` walks the fast subset of 30 - the same two tables,
minus tail_v28's third - and until now counted nothing. The printed verdict was a
string literal: `all 30 pins hold`, whatever the loop had actually done.

Measured rather than argued. Drop one map from the list the loop iterates and run
the old code: it prints `all 30 pins hold - map generation untouched` and exits 0,
having walked 24. That is the one direction a gate must never fail in. Every other
way triage can break is loud - a moved hash names itself, a null trail table
reports every combo as moved - but a short walk is silently clean, and clean is
the answer that ends the investigation.

The loop now counts what it walks, asserts 30, and REPORTS the count off
`layoutChecked` instead of a literal, so the number cannot drift from the walk the
way the literal already could. Two guards went in beside it that the recut gate
does not have, both of which turn a misleading answer into an accurate one:
`pinned()` returns null in triage where it exits 2 in the recut, so an unreadable
table is now fatal at the call site rather than a TypeError; and a table missing a
pin for a key would have compared a hash against `undefined` and reported the pin
as MOVED - a map-generation alarm raised by a gap in the baseline. All three fire
on their own failure mode, checked against mutated copies, exit 2 each.

One thing deliberately left alone. `pinned()` is still non-fatal for the TRAIL
check above the layout loop, where a table that stopped parsing makes `same()`
return false for every combo - so triage would announce that the simulation moved
and a repin is due when what actually broke is the harness. It is loud, and it is
wrong in the expensive direction rather than the dangerous one. Worth a pass if
anyone is in there, but it is not what this change touched.

## v88.1 note: four small updates, and the regression the third one exposed

Four unrelated requests. Only ONE reaches the simulation - the Machine Gunner's
price - and that one is why this release recuts trails. The other three are
display, and the interesting thing about them is that reordering a gallery found
a bug v88 shipped and nothing caught.

### 1. The Machine Gunner, 112 -> 125 plastic

This closes the standing v89 question the v88 note left open, and it closes it
the way that note listed first. v88's 25th trainable unit slid SUP_U's quartile
cuts one place and left him the 7th-cheapest, i.e. back on 1 supply and back to
being the best per-supply buy in the game. 125 clears the Flamethrower's 120,
which makes him 8th and puts him on 2.

**The seventh slot does not disappear, it changes hands.** At 25 units the cheap
tier holds seven, so somebody is always in it, and it is the Flamethrower now.
That is strictly the better occupant and for a reason the file already records:
he is TAN-EXCLUSIVE, so three armies in four cannot field the per-supply leader
at all, and his lead over the Bazooka is 1.06x against the Gunner's 1.11x. The
roster-wide spread comes back 9.51x -> 6.19x, against 5.84x from v69 to v87; the
residual is the Medic and Sarge, still one rank cheaper, which is not this edit's
to move.

**It is a real efficiency cut and is recorded as one.** v78 paired the reload and
the price so `rt x cp` held at 56 and his damage-per-plastic did not move. This
release breaks that pairing deliberately: the reload stays at .5, so `rt x cp`
goes to 62.5 and his efficiency falls 10.4%. The consequences, all measured:

  - he drops to THIRD on infantry damage-per-plastic, behind the Flamethrower AND
    the plain Grunt (1.1299x and 1.0851x). T26.H and T50.C are re-aimed on the
    same two-sided shape v73's crossing was;
  - for green, gray and blue the head of their own infantry table is the GRUNT
    now, where it used to be the Gunner;
  - T26.C's air runner-up changes identity, not standing: the Grunt is the second
    best answer to aircraft at 53% of the AA truck, where the Gunner was. The
    pool is still one and the v74 question is still open;
  - the v69 heavy-armour relation widens again, 7.78 -> 6.97 against the
    Bazooka's unmoved 10.76, which is the safe direction.

What he keeps is what none of those measures can see, and T50.C and T63.A both
assert it now rather than leaving it as consolation: Entrench, a 1.5x fire rate
in a cone nothing else in the roster has, and the toughest hull among the
infantry every army can build.

### 2. The Forward Pad, 1.6 -> 3 HP/s

v85 set PAD_REP deliberately UNDER MEDIC_HEAL_RATE so the Pad read as the quiet
half of the building. The ordering is deliberately reversed now, and the reason
is that 1.6 made the capability technically present and practically unusable: a
Huey taken to a sliver sat on the pad for over a minute and an Apache for two,
which is longer than the match phase either aircraft is bought for. At 3 those
are about 36 and 62 seconds.

It does not make the Pad a better Medic, and T58.C is re-aimed on that rather
than on the rate ordering: the Medic follows the fight and heals anything on
legs, the Pad is a fixed 2x2 that repairs only what flies, and nothing else in
the game repairs that at all. The rate ordering between two different
capabilities was never load-bearing.

### 3. The Field Manual gallery: one colour for shared, the owner's for exclusive

`infoFacOf` returned the READER's own army for anything shared, so a Grunt was
painted Tan to a Tan player. That made the manual say something about ownership
that is not true, and it made the same tile change colour between two readings of
the same page - the one thing a reference must not do. The default is `green`
now, exclusives keep their owner's colour, and the function no longer reads `G`
at all. T27.H's "it shows YOUR army" claim was the v46 behaviour and is
deliberately retired; what survives is the half that matters, which is that the
panel opens over a live match without disturbing it.

### 4. The gallery order, and the regression it exposed

Both lists were `Object.keys` order - the order things were ADDED to the game,
which is a development record and not a reading order. Units are grouped by
`prodBldOf` (Barracks, Garage, Helipad) and run cheapest to dearest inside each
group; structures are one run, cheapest to dearest. Both sorts break ties on key
name for the reason SUP_U's does: the Garage and the Outpost are both 263, and a
gallery that reshuffles between loads is one nobody can point at. The drop-only
Paratrooper sorts LAST in his group whatever he costs, because cp 0 put a free
unit at the head of the Barracks column and that reads as "the cheapest thing you
can build", which is the one thing he is not.

**THE REGRESSION.** Putting the cheapest structures first landed the two walls in
the first two cells, and both were blank. Two faults, both shipped at v88:

  - `drawBarricade` gained a `b.t.hbarr` test at v88 to pick its silhouette, and
    the manual's thumbnail stub passed no `t` - so the ORDINARY wall threw inside
    `infoPortraitCv`'s try and drew nothing;
  - the stub was keyed `key==='barricade'`, so the Heavy Barricade fell through to
    `SPR.bld`, which is empty for a wall because neither wall is baked - it drew
    nothing either.

The fifteenth key-based wall test, in other words, plus a stub that v88's own
sweep fix did not reach. T30.C was taught to pass a real row at v88 and that
covered the sweep; this call site is the one it does not touch, so T63.E covers
it directly, with a mutation arm that shows a row-less stub really does throw.

**The lesson is the v88 one, one layer down.** "Grep for the first one's key"
found fourteen sites. It did not find this one, because this site is a
CONSTRUCTED STUB rather than a real entity - it never had a `t` to be wrong
about, so a search for `key==='barricade'` found it and a search for what reads
`t` did not. When a function starts reading a new field, the thing to grep for is
its CALLERS, not the field.

### The description pass

Every unit and structure card was rewritten shorter. The longest unit card went
356 -> 327 characters and the longest structure 291 -> 257. Three cards that
carried typed numbers now read constants instead - the Machine Gunner's entrench
multiplier, the Medic's radius and the Barricade's HP and price - and
`MEDIC_HEAL_RADIUS` moved above the U table to make the second of those possible,
on U0AURA's rule: it was declared BELOW the table it is read from, which is the
temporal-dead-zone trap the v86 note records.

T63.F pins the pass as a PROPERTY rather than as transcribed lengths, which would
rot on the next word changed: no card past 340 characters, every figure still
reads a live constant (21 of them driven), the two derived cards still read their
lists off the tables, and nothing leaked a `${...}`, an `undefined` or a `NaN`.

### The census that needed six seeds, again

T42.H's Gray bunker count read 0.25 against its 0.5 floor. Measured per seed over
eight on this build:

    blue 2,2,2,2,2,3,2,1     gray 1,0,0,0,2,3,0,3

Gray's count is LUMPY - four of the eight seeds build none at all - so a
four-sample mean of it is noise, which is exactly what the v86 note says a
two-sample mean of it was. Running means: 4 -> 0.250, 5 -> 0.600, 6 -> 1.000,
7 -> 0.857, 8 -> 1.125. Six is the smallest set that clears the floor and stays
clear, so the seed count is widened rather than the floor lowered - the same
decision v86 made, on the same evidence, one step further along.

### repin_v88_1 learned that an unchanged table can be correct

`BASE43_DESK` came back byte-identical and the repin script exited on it as a
suspected re-run. It was right to be suspicious and wrong about this table: the
Desk trail is cut from a fixture that forces `U.gunner.cp=90` before it runs, so
the one thing this release changed in the simulation cannot reach it. The script
now carries an `UNMOVED_OK` map naming that table and the reason; anything not in
it that comes back unchanged is still a hard failure.

### Verification actually run at v88.1
`./build.sh`; `node --check`; `./triage.sh` before and after - **all 42 layout
pins hold**; `recut_v88_1.js` + `repin_v88_1.py` regenerated four of the five
baseline tables behind that gate (the v88 pair was rolled forward and deleted);
`QUIET=1 ./seg.sh all` = 2350 / 501 / 48 / 234 / 1910 = **5,043 checks, 0
failures** (tail_v88_1 contributes 46); `python3 verify_v58.py` 32 passed. Driven
in real Chromium at 1400x900: the Field Manual opens on both tabs, the unit
gallery reads Barracks / Garage / Helipad cheapest-first with the exclusives in
their own colours, the structure gallery runs Barricade to HQ, both wall
thumbnails render, the Gunner's card shows 125, and `REN_ERRS` stayed empty. The
real-canvas render tails were NOT run.

## v88 note: what v88 actually added, and the derivation that could NOT be held

Gray's set, and with it roadmap 2 is finished: every army now fields an exclusive
out of the Barracks, the Garage and the Helipad, holds two exclusive structures,
and carries one Radio Tower call-down nobody else can see. T62.J states that as
one section, derived off FAC rather than transcribed.

  CHOKTAW HELI (Helipad, Gray). 265/58 pre-scale -> 203 HP effective, above the
    Apache's 187 by specification, and 244 once Gray's x1.2 hull is on it. It is
    the FIRST unit in the game carrying two ordinary guns: rocket pods (row 'r',
    the Apache's) as the main weapon and a door gun (row 'b') as a `sec`.
    The split needed NO change to secOwns. The Bull's cannon already hands
    infantry and wildlife to its hull flamer, so the Choktaw's rockets hand the
    same two classes to its door gun and keep armour, aircraft and structures.
    What DID need changing is fireSec, which had three of the Bull's facts baked
    into it - spawnFlame, splash on row 'f', and the hose's sound. It reads sc.w
    now, the way fireAt reads u.t.w, and the Bull's path is byte-identical.
    vi 9, one above every other helicopter, and load-bearing rather than
    decorative: both its abilities are about what it can SEE.
  FORWARD OBSERVER. +2 tiles to friendly INDIRECT fire against anything the
    Choktaw can see. This is the first aura in the file that asks about the
    TARGET rather than about the unit receiving it, and that decides its whole
    shape: rgOf takes an optional second argument, and a call with no target -
    an acquisition sweep, the entrenched cone, the ring the renderer draws - gets
    the unextended range, which is correct rather than an omission because
    nothing has been spotted yet.
    "Indirect" is `t.mrg`, the minimum-range flag the Mortar Squad and the Rocket
    Artillery already carry. That is the file's own word for an arcing weapon, so
    a third one added later is covered without being remembered into a list.
  PAINT. A 2x2 box, +25% damage from ALL sources for 10s, 20s cooldown on the
    v87 u.abCool clock - which is the proof v87 built machinery and not one
    helicopter's special case: the Choktaw's row declares `abCd:PAINT_CD` and
    nothing else new was needed. "From ALL sources" is one line, and it has to be
    the line in applyDmg, because that is the single defender-side door every
    shell, burn tick, mine and crush already routes through.
    Written onto the VICTIM as a clock rather than read off the Choktaw the way
    Forward Observer is, and the difference is deliberate: an aura ends when its
    source dies and a mark does not. Repainting RESTARTS the clock rather than
    stacking, which is why Paint has no group button - a second Choktaw over one
    box spends a cooldown for nothing.
  HEAVY BARRICADE (second structure, Gray). 150 HP, three times the wall at
    three times the plastic, so HP per plastic is flat and what the extra 40
    buys is the aura and the mine. NO activated ability, by specification.
    The aura is -15% damage taken on the ring of tiles around it, STACKING to a
    ceiling of 60%, and covering structures and other walls as well as units. It
    is the first defender-side reduction in the file that COUNTS its sources
    instead of taking the first and breaking, and the cap is on the TOTAL rather
    than on the number of walls so it cannot be walked around by mixing wall
    types. It does not shelter itself: "the tiles immediately surrounding it" is
    the owner's wording and it excludes the tile the wall stands on.
    On completion a one-time 10% roll buries a mine 3 tiles toward the nearest
    enemy HQ. It joins G.map.mines with two extra fields - `gray` and `pi` - so
    the existing sweep, hash and serializer carry it; the sweep consults mineArms
    and lets the owner's army walk over it, and the renderer draws it for that
    army alone. The map's own scattered mines carry neither field and behave
    exactly as they always did.
  SMOKESCREEN (call-in, Gray). 7x7, -40% to friendly units AND structures, 10s.
    A `fac` row on the shared RADIO_ABILITIES table refused at the execCmd door.
    It sits OUTSIDE the `tgt.kind==='unit'` block that holds the mortar's cloud,
    because covering structures is the single largest difference between the two
    and is the reason it could not reuse that loop with bigger numbers.

### THE DERIVATION THAT MOVED, and why no price could have held it

Rule 4 says a constant derived as a min or a max over the whole table is a trap
for the next row. Both traps were measured BEFORE the row went in, as the rule
requires. MEDIC_HEAL_RATE held - the Choktaw's dm/rt is 12.3 against the Grunt's
3.03, nowhere near the floor. **SUP_U did not hold, and could not have.**

The Choktaw is the roster's 25th trainable unit. 25 does not divide by four, so
the quartile cuts slide from after the 6th/12th/18th to after the 7th/13th/19th,
and the three units sitting exactly ON the old cuts each drop one rank:

    gunner  2 -> 1        medic  3 -> 2        sarge  4 -> 3

All three fell by one, none rose, and nothing else moved. The sweep that
established this ran every total cost from 10 to 700 against the v87 build and
counted the movers:

    total <= 111 ...... 0 move   (cheaper than the Machine Gunner)
    112 .. ~299 ....... 1 moves  (gunner)
    ~300 .. ~382 ...... 2 move   (+ medic)
    >= ~383 ........... 3 move   (+ sarge)

The only clean band is under the Machine Gunner's 112, which is not a price a
gunship can be given. The alternative was to re-price the Machine Gunner - an
edit to an existing unit this release was not asked to make, cascading through
T50.C, T26.H and the whole v73/v78 record - so the movement is RECORDED rather
than engineered around. tail_v88 T62.A reproduces the sweep rather than quoting
it, so the claim cannot rot.

### THE CONSEQUENCE, stated plainly because it is the largest thing v88 did

The Machine Gunner at 1 supply is once again the best per-supply buy in the game
by 63% over the Bazooka, and the roster-wide per-supply spread widens 5.84x ->
9.51x. That is precisely the cliff the v69 ladder was built to remove, and it has
partially reopened - not because the ladder stopped working but because the
roster grew past a multiple of four.

T48.B and T50.C are rewritten around it rather than repinned quietly. Both stay
two-sided, so a further widening fires and so does a fix. **This is a standing
v89 question**, in the same shape as v73's `air:1`: a named, measured, recorded
consequence that a later release has to decide about, not a defect in v88.

The obvious levers, none of them taken here because none is v88's to take:
  - price the Machine Gunner over the new tier-1 boundary (dearer than the
    Flamethrower's 120), which puts him back on 2 and costs nothing else;
  - add a 26th, 27th and 28th trainable unit, which restores a multiple of four;
  - or make SUP_U cut on absolute cost bands rather than on roster rank, which
    is the v69 -> v70 change in reverse and would need its own release.

### The fourteen tests that said "the barricade" and meant "a wall"

The Heavy Barricade is a `barr` row, and that one flag hands it the ordinary
wall's whole life: drag laying, the 1x1 footprint, the passability block, the
lightweight teardown in kill(), and its exclusion from veterancy, from the
under-attack alert, from the base-value sum and from elimination.

The cost of that is that FOURTEEN tests keyed on `key==='barricade'` had to move
to `t.barr`. Every one of them meant "is a wall" and with one wall in the game
those were the same question. Three of the fourteen were load-bearing:

  - the RESCALE pass skipped 'barricade' because BARR_HP is already rescaled.
    HBARR_HP derives from BARR_HP, so a missed skip would have CUBED the wall.
  - kill()'s lightweight teardown. A heavy wall falling through to the full
    building blast would have spawned a garrison pop and an elimination check.
  - checkElim. An army left holding only heavy walls would never have been
    eliminated, and a deathmatch would never have ended.

Two source-text tests broke on the rename and were RE-AIMED, not relaxed:
tail_v40's T20.5 slices kill() between the nest branch and the wall branch, and
its indexOf now searches FROM the nest marker because `!e.t.barr` also appears on
the veterancy line above it. tail_v49's T30.C paint sweep skipped one wall by key
and handed drawBarricade a stub with no `t`; it now sweeps both walls off the
flag and passes a real row, which is also how the heavy wall's own art got
covered.

### Two traps this release walked into and out of

  - **A COMMENT tripped the sim-purity lint.** T23.H matches the SOURCE TEXT of
    the functions on its list for `Math.random`, and updateBld is on that list.
    The mine roll uses srand() correctly, but the comment explaining WHY named
    `Math.random` in prose and the lint cannot tell code from commentary. Same
    shape as v87.1's nocmt61 helper, in the opposite direction. Reworded.
  - **The new unit's name collided with a retired one.** The first cut called it
    the "Choktaw" Gunship, and T52.F4 refuses any manual that names a retired
    unit - one of which is Blue's old **Gunship**. The check is a plain substring
    and it was right to fire: a reader would have had the same collision. Renamed
    to **Choktaw Heli**, which is what the roadmap specified in the first place
    and matches Tan's Firebomb Heli. T52.F4 gained an arm asserting no LIVE unit
    name contains a retired one.

### Also moved, measured rather than assumed

  - **The competitive pool: medium 8 -> 9**, and the ninth member IS the Choktaw.
    Every other class unmoved, and no existing unit entered or left any pool.
    A release that adds an armed unit and widens exactly the column that unit
    belongs in is the release landing, so it is repinned at the measured figure.
    AIR IS STILL 1 - the Choktaw's rockets read 1.30 into air but its DPS per
    plastic sits under the 55% cut, so the standing v74 question is untouched.
  - **RES_REF 0.2317 -> 0.2392** (+3.2%), the harvester's plastic:electricity
    preference. The Heavy Barricade is excluded from it, on the flag, for the
    same reason the ordinary wall always was.
  - **AI_SUP_UNIT 2.444 -> 2.421**, the bot's average combat-unit supply cost.
  - **USCALE gained four rows.** The Choktaw, the Firebomb, the Balloon and the
    Command Truck were all falling through to 1.0 - a pre-existing v86/v87 gap
    found while the Choktaw's own art was being drawn, and fixed for all four.

### Verification actually run at v88
`./build.sh`; `node --check`; `./triage.sh` before and after - **all 42 layout
pins hold**, which is the gate that had to pass before a single trail was recut;
`recut_v88.js` + `repin_v88.py` regenerated the five baseline tables behind that
gate (the v87 pair was rolled forward and deleted); `QUIET=1 ./seg.sh all` =
2349 / 500 / 48 / 233 / 1859 = **4,989 checks, 0 failures** (tail_v88 contributes
127); `python3 verify_v58.py` 32 passed. Driven in real Chromium at 1400x900:
Gray's Helipad offers the Choktaw, its panel shows the Paint button and its
cooldown readout, a paint call marked 4 of 4 enemies in the box, the Radio Tower
panel lists Barrage / Paradrop / Smokescreen, a Heavy Barricade line and a buried
mine both render, and `REN_ERRS` stayed empty throughout. The real-canvas render
tails were NOT run.

## v87.1 note: three interface repairs, and the one that could have desynced a match

Off the roadmap, requested between v87 and v88, and none of the three touches the
simulation: triage reported every pinned combo reproducing and all layout pins
holding after all three landed. That is the acceptance criterion the release was
built against, not a happy accident, and it is what let v88 stay Gray's.

**1. The drag box wears your army's colour.** `dragBoxCol()` sits with the other
colour utilities and reads `FAC[G.human.fac].color` at the point of use, lifted
by `DRAG_BOX_LIFT` (1.3) so Blue and Gray still read against the board. A watch
match has no human player at all, so it falls back to `DRAG_BOX_NEUTRAL` - the
same yellow the box has always been. The rally-point arrow was deliberately left
in that yellow and T61.A pins it: it is a marker on the ground, not a selection.

**2. `UNIT_TOGGLES`: eleven rows where there were six hand-written blocks.**
Eleven units carry a toggleable ability. SEVEN had a group block in the
multi-select panel and FOUR did not - On Me!, Called Shot, Ripple Fire and Flat
Out - purely because of the order they shipped in. A mixed selection silently
dropped abilities that the same units offered one at a time, and had done since
v81. Every one of those blocks was the same eight lines, so they are one table
and one loop now, and the panel offers every toggle any selected unit owns.

  - **The completeness check is derived, not transcribed.** Every single-unit
    toggle in the panel is written `submitCmd('<cmd>',{ids:[e.id],on:!e.<field>})`,
    so the panel's own source names the full set. T61.B scrapes
    `refreshSelPanel.toString()` for that shape and demands a `UNIT_TOGGLES` row
    for each, in both directions. That is the check that would have caught the
    four missing group buttons five releases ago, and it is why a twelfth toggle
    cannot ship with a single-unit button and no group one.
  - **Entrench is the one row that is a PAIR of commands** (`entrench` /
    `unentrench`) and the only one whose "on" needs an aimed direction, so it
    carries `offc` and `aim` and the loop keeps that branch byte-identical to the
    block it replaced.
  - **Napalm Blast is deliberately NOT a row** and stays hand-written below the
    loop: it is a one-shot on a cooldown, and its button counts only the
    helicopters actually off cooldown rather than the ones selected. "Fold
    everything into the table" is the obvious wrong next step, so T61.B pins it.
  - **The signature is driven off the same table.** Five of the eleven had a
    hand-written `lastSelSig` line and four had none, which is the freeze trap the
    Overdrive pair records: a group button whose state does not ride the signature
    prints whatever it said when the panel last rebuilt. T61.B drives all eleven.
  - **`.bb` went DOWN, 31 to 26.** T49.A counts literal `className='bb'` sites, and
    six blocks collapsing into one loop removes five of them while the panel gains
    four abilities. The pin needed a conscious edit in the unusual direction; T61
    counts the buttons the loop actually builds, which is what the pin was proxying
    for all along.

**3. Selling looks like a teardown, and leaves a heap.** `sellBuilding` ran a puff
of dust and four flecks of plastic, so a structure the player deliberately removed
simply blinked out. It now runs the same effects `kill()` runs on a building -
melt, scorch, shrapnel, the primary blast and its staggered cook-offs, the smoke
column, the shake and `sfxBuildingDestroy` - plus a heap of plastic.

  - **THE ONE THAT COULD HAVE DESYNCED A MATCH.** `sellBuilding` runs INSIDE the
    simulation. Every offset in the new block is `Math.random`; one `srand()`
    among them would have moved the shared stream, and the machine that watched
    the sale and the machine that made it would have disagreed from that tick on -
    while looking perfectly correct on one machine. T61.C drives it against the
    live cursor: sell an empty building, `G.rngS` must not move at all. The
    garrison spill stays seeded, and is pinned separately so the first check
    cannot be met by making that part cosmetic too.
  - **The heap is a DECAL, not a node.** `paintPile`/`stampPile` are the fourth
    member of the scorch/melt/bits family, with a `k:'p'` branch in `flushStamps`,
    so a pile dropped out of vision queues and paints when the ground is next seen.
    It borrows `plSphere` so it reads as the same moulded plastic the salvage
    wrecks are made of. It may NOT be a `spawnWreck` node: the refund already paid
    for this building and a mineable pile would pay twice, which is exactly why
    sold buildings dropped nothing at all before now. T61.C pins the node count
    unchanged AND, as a contrast on the same board, that destroying the same
    structure does drop salvage.
  - **T23.H needed a conscious edit, and got a replacement rather than a hole.**
    The v43 sim-purity lint lists functions that may use no `Math.random`, no wall
    clock and no `Math.atan2`/`hypot`/`sin`/`cos`; `sellBuilding` was on it and
    FX-spawning paths (`kill`, `applyDmg`, `splash`, `aiTick`) were always exempt.
    Selling became an FX path, so it left the list - but the lint keeps its teeth:
    a new arm holds `sellBuilding` to every banned construct EXCEPT the one the FX
    paths are allowed, and T61.C drives the property the lint could only
    approximate. Dropping a name off a purity list is only safe when something
    stronger takes its place.

### Verification actually run at v87.1
`./build.sh`; `node --check`; `./triage.sh` twice (before and after the tail work)
- **all layout pins hold, every pinned trail combo reproduces, no repin due**;
`QUIET=1 ./seg.sh all` = 2343 / 495 / 48 / 235 / 1721 = **4842 checks, 0 failures**
(tail_v87_1 contributes 59); `python3 verify_v58.py` 32 passed. Driven in real
Chromium at 1400x900: the Blue drag box measured `rgb(96,163,255)`, a mixed
six-unit selection rendered exactly the five expected buttons
(`Entrench (2)`, `On Me! (1)`, `Called Shot (1)`, `Ripple Fire (1)`, `Flat Out (1)`),
a sold Barracks added 0 nodes and moved `G.rngS` by 0, and `REN_ERRS` stayed empty
across the teardown. The real-canvas render tails were NOT run.

## v87 note: what v87 actually added, and the four seams worth knowing

  FIREBOMB HELI (Helipad, Tan). 280 plastic + 90 battery, weapon row `f` - the row
    Tan already lives on, since the Flamethrower's hose, the Bull's hull flamer and
    the tower's napalm all score there. 1.35 into infantry and 0.45 into heavy
    armour, so a tank column ignores it; that is the point of it. It hits softer
    than the Apache (13.12 DPS against 15.88) because it also carries the ability.
    Passive `Scorched Earth` - every hit leaves the GROUND burning for 4s.
    Ability `Napalm Blast` - 10 blasts on random tiles within 3 of itself, each
    leaving 8 seconds of fire that burns friendly units and structures as readily
    as enemy ones. 30-second cooldown, and THE FIRST UNIT COOLDOWN IN THE GAME.
  FOUNDRY (Tan's second structure). 260 + 50. Vehicles produced while it stands
    roll out with +10% hull, permanently. `Pour` finishes the vehicle at the front
    of every Garage queue at once for 50% of each one's plastic on top, 45s.
  THE NAPALM STRIKE CHANGED HANDS. It left the shared pool and is Tan's alone. It
    did not move to a second table and did not gain a second mechanism: it gained
    the `fac` field v85 put on the row for exactly this. Gray is down to the two
    shared call-downs until v88 gives it the Smokescreen; that is the roadmap
    working, not a gap. The Fuel-Air Bomb the roadmap said to drop was never built,
    so there was nothing to remove.

**Seam 1 - `u.abCool` is MACHINERY, and the duration lives on the table row.**
Roadmap 1 ruled cooldown abilities on units out; the owner overrode that for
roadmap 2, and v85's Sprint, v86's Broadcast and v86's Bail all turned out not to
need it - two sustained modes and a one-shot that destroys the unit offering it.
Napalm Blast does. The row declares `abCd` and `makeUnit` writes `u.abCool` only
onto rows that declare one, so a match with no Firebomb in it snapshots exactly as
a v86 match did. It is ticked in `updateUnit` for the same reason `updateBld` ticks
`b.abilityCool` for EVERY building rather than inside a branch: a timer parked in a
branch never runs out. It is hashed, serialized, defaulted for a pre-v87 save, and
zeroed by testing mode. **v88's Paint needs `abCd:20` on its row and nothing else.**

**Seam 2 - `napalmBurn` was generalised by three fields, and every default
reproduces the v30 napalm exactly.** `s.bdps` is the burn rate (`GROUND_DPS`, which
was a bare 4.3 until a second caller forced it to be named), `s.ff` is friendly
fire, and `s.gnd` is "this fire is on the ground and cannot reach an aircraft".
With `ff` set the allied test **disappears** rather than being inverted -
indiscriminate is the absence of a side, not the other side. The tower's napalm is
deliberately NOT given `gnd`: changing what the call-down does to a loitering
aircraft is not this release's business, and the asymmetry is declared rather than
accidental.

**Seam 3 - "prolonged" is the DURATION, not a hotter fire.** The Firebomb's blast
and the tower's napalm burn at the same `GROUND_DPS`; what differs is `FB_BURN` 8
against `NAPALM_T` 3. `NAPALM_T` is new only in the sense that the 3 was a literal
in two places before. Scorched Earth is the exception and burns at `SCORCH_DPS` 3,
under the shared rate, because it fires on every hit and the call-down fires once:
a passive on a 1.6-second reload has to be worth less per tile or it is simply a
better napalm.

**Seam 4 - the Foundry is a PRODUCTION buff and not an aura, and it rides the door
the Garage upgrade already used.** "Produced while it stands" means the hull is
baked in at `makeUnit` and the vehicle keeps it if the Foundry burns down an hour
later - `T60.D` drives exactly that. "Vehicle" is `prodBldOf(key)==='garage'`, the
file's own answer to what a Garage builds, rather than a hand-written class list
that would need revisiting every time an archetype is added. It multiplies with the
upgrade rather than replacing it: the upgrade is a Garage that builds better, the
Foundry is an army that does. Determinism is free here and worth stating: the buff
lands on `hp` as well as `mhp`, and `hp` is hashed, so a client that disagreed about
whether a Foundry was standing would diverge on the tick the vehicle spawned rather
than silently carrying a different maximum for the rest of the match.

## v87 note: the price is 383.5 because the quartile cuts did not move

The v86 note records that two new rows had to be priced into bands that left all 21
existing units on the rank they had. v87 adds ONE row and the arithmetic is tighter,
not looser. At 23 trainable units the cuts land after the 6th, 12th and 18th; at 24
they land after the 6th, 12th and 18th as well, because 24 divides by four and 23's
`floor()` happened to land in the same three places. **The boundaries did not move at
all**, so the only insertion point that shifts nobody across one is past the LAST
boundary - the new unit has to be dearer than Sarge (329). 280+103.5 = 383.5 puts the
Firebomb between Sarge and the Chinook, and nothing moved.

`MEDIC_HEAL_RATE` was exposed for real this time, unlike at v86: the Firebomb is
ARMED, so it enters the `Math.min` over everything that fights. It clears the floor
comfortably (13.12 against the Grunt's 3.03 in scaled units) and the Grunt still
sets it. T60.A asserts the SOURCE rather than just the value, so a future row that
undercut the Grunt would name itself.

`AI_SUP_UNIT` moved 2.353 -> 2.444, which is the mean supply rank over the trainable
combat roster doing exactly what it is derived to do when a rank-4 fighter joins.
Nothing pins it, by design.

## v87 note: a call-down changing hands has FIVE surfaces, and the bot is the one that hides

Making the napalm Tan's is one word on one row - `fac:'tan'` - because v85 put the
field there and routed every UI surface through `radioListFor(p)`. Four surfaces
took it for free: the panel, the Field Manual list, the vision gate and `execCmd`'s
refusal at the command door.

The fifth did not. `aiTick` reaches `radioNapalm(radio,...)` **directly**, never
through `execCmd`, so it never consulted `radioAllowed`. That was harmless while
both munitions were shared and would have had three of the four armies' bots
calling down a strike they do not own. It is now written as a fallback rather than
a second branch - `if(hard>soft||!radioAllowed(p,'napalm'))` - because the barrage
is the munition every army has and there is no case where a bot owns the napalm and
not the barrage.

**Generalises, and matters at v88:** a faction gate is only as good as its least
obvious reader, and the bot's is the one that does not go through the door the
player's does. Grep for the ability's own function name, not just for the mode
string.

## v87 note: three fixtures were reading a faction they only incidentally had

None of these were v87 regressions in the sim. All three had picked an army for
reasons that had nothing to do with what they were testing, and the napalm changing
hands is what surfaced it.

  T11 (tail_v30) booted GREEN and fired the napalm through five checks about the
    strike machinery. It now boots TAN - the same 293 HP tower, since Tan's hp mod
    is also x1 - and carries a new check for the refusal a non-Tan tower now gets,
    so the reason it changed army is a checked fact rather than a comment.
  T29.E (tail_v48) needed a TAN BOT, and the first attempt at fixing it made the
    mistake worth recording: `cfg48`'s `fac` is the HUMAN's faction, so asking for
    a Tan human is precisely the way to guarantee there is no Tan bot. With the
    default green human the three bots are gray, tan and blue. It now selects by
    faction through a new `bot48f(fac)`, and the fallback arm - a Gray bot shelling
    the same clump off the same seed - is a check of its own.
  T31.H (tail_v50) fired the napalm to prove that TESTING MODE does not charge a
    cooldown while the VISION rule still applies. The claim was never about the
    napalm; it now uses the barrage, which is vision-gated and shared by every
    army, so it can never be broken again by a call-down changing hands.

## v87 trap: an indiscriminate weapon has to be told what "indiscriminate" excludes

The Napalm Blast burns friendlies by design. The first cut burned the helicopter
that dropped it: the Firebomb hovers over its own fire, `ff` removes the allied
test, and nothing else was stopping it. `s.gnd` is the answer - a fire on the ground
burns what is on the ground - and it is why the flag exists at all rather than being
implied by `ff`.

The measurement that found it is worth recording separately, because the first three
attempts to measure it were all wrong. Running `update()` for 200 ticks and reading
the helicopter's HP showed it taking damage - from **wildlife**, which had wandered
over and bitten it, and on one run the Firebomb's HP went UP because a veterancy
promotion raised its maximum mid-measurement. The burn is now measured by driving
`updateStrikes()` alone, and the fixture carries `burn87()` for it. That is the v85
heal-rate lesson and the v86 crate lesson in a third shape: **a fixture that measures
one thing inside `update()` is measuring the whole match.**

## v87 traps learned

  - **A generalised function must reproduce its FIRST caller exactly.** `napalmBurn`
    gained three fields and every default is the v30 behaviour, including the one
    that looks like a fix: the allied test still runs against a DEAD owner, because
    a dead-but-referenced tower still has `.p` and cutting the burn short when the
    tower fell would be a balance change dressed as a null guard. What did change is
    a genuine null guard for the RELOAD case, where `loadState` resolves a dead
    owner to null and the old code threw inside `update()` and took the tick with it.
  - **`ucost` returns 0 in testing mode**, so any ability priced as a share of a
    unit cost is free in the sandbox. That is consistent with everything else there
    and is not a bug, but a fixture that asserts a non-zero charge must not run in
    testing mode.
  - **A pour must not lift the supply cap.** The queue entry was reserved when it was
    queued; a pour that fielded a unit past the cap would be a way of buying supply
    with plastic. Refusing leaves the unit in the queue to finish normally.
  - **A fixture that stands a victim in a fire before taking a snapshot has no victim
    after the reload.** T60.F stands the man on a cell that is still alight AFTER
    loading, read off the reloaded strike, rather than before.
  - **T43.M's voice-collision flake is still there** and still not this release's
    doing - `gun:smg/gun:amg`, exactly the pair the v84 note names. Three clean
    re-runs of segment 3 either side of it.

## v87 note: tail_v87 rides segment 3, and the check count

Segment 3 carries tail_v87 alongside tail_v79 through tail_v86. No further split was
needed. The five segments at v87 run 2341 / 495 / 48 / 235 / 1662 = 4781 checks,
0 failures, plus verify_v58.py's 32 and the six real-canvas tails
(60 / 25 / 60 / 164 / 9 / 4). v87.1 added tail_v87_1 to the same segment: 2343 /
495 / 48 / 235 / 1721 = 4842. v88 added tail_v88 to it as well: 2349 / 500 / 48 /
233 / 1859 = 4989. v88.1 adds tail_v88_1 to the same segment and two seeds to
T42.H's census in 2c: 2350 / 501 / 48 / 234 / 1910 = 5043. Segment 3 now carries
twelve tails and is still not the long pole - 2b's single tail_v59 remains that,
for the reason the seg.sh header gives.

## v86 note: what v86 actually added, and the four seams worth knowing

  COMMAND TRUCK (Garage, Green). 145 plastic + 20 battery, no weapon at all, and
    the slowest wheeled thing in the game at sp 2.0. Its own archetype `a:'cmd'`
    rather than `'truck'`, because `t.a==='truck'` means HARVESTER at fifteen doors
    in the file and the idle branch in `updateUnit` would send a command vehicle
    off to mine; the Medic escapes that only by carrying `t.heal`.
    Passive `Forward Command` - a build anchor that travels, on `CMD_R` 5 tiles,
    carrying `CMD_BLD` and nothing else: barricade, guard tower, barracks. The list
    is a constant read by the placement door and by the info card, so the sentence
    the player reads and the rule the sim enforces are the same three names.
    Toggle `Broadcast` - allies within 5 tiles reload 20% faster and the truck
    cannot move while it runs.
  OBSERVATION BALLOON (Helipad, Green). 250 + 60, vision 16 - above the Radar
    Tent's 13, so it is the best sight in the game and not merely among units.
    Only weapon row `a` may ACQUIRE it and it takes a flat third from what does;
    splash never reaches it; and `BALLOON_FUEL` 180 seconds later it falls on its
    own and the crew is lost. No unit limit, by decision - the clock is the limit.
    Passive `High Ground` - allies inside its vision get +1 range.
    Ability `Bail` - four men on the ground, and the balloon is destroyed.
  COMMAND POST (Green's second structure). 250 + 60. Passive: units within 8 tiles
    promote on 30% fewer kills. Ability `Regroup`: every unit in that radius is
    handed 25% of its OWN maximum HP back, at once, on a 60-second cooldown.
  SUPPLY DROP (Radio Tower call-in, Green only). Two crates, 500 plastic and 500
    electricity, collected by walking over them, and only by the owning army.

**Seam 1 - the three auras are read off their sources, exactly as v85's pair are.**
`bcastOn`, `highOn` and `cpostOn` scan for the source at the point of use and write
nothing onto the entities they affect. A twenty-man line under a Broadcast is still
one boolean on one truck. Where they differ from `rnetOn`/`sprintOn` is the missing
infantry gate: a reload, a weapon range and a promotion belong to vehicles and
aircraft as much as to men, so there is no class to leave on the first line. The
flag test still leads inside each loop and is undefined on every unit in the file
except the two Green vehicles, so the body stays one property read per unit.

**Seam 2 - Broadcast lives in `rtOf`, which IS the reload.** Ripple Fire's longer
reload and an entrenched gunner's divided one both resolve through it, so one door
covers all three shapes and leaves `srtOf` - the INTER-salvo spacing, a cadence and
not a reload - alone. The one shot in the file that does not come through `rtOf` is
the Paratrooper's, whose munition carries its own `rt` exactly as it carries its own
range past `rgOf`; a drop-only unit standing outside both doors is v30 behaviour and
was left as it is.

**Seam 3 - the balloon needed BOTH an acquisition gate and a damage rule, and the
damage rule alone would not have done.** `ballOk` is the gate, shaped like `aaOk`
and `csOk` but read the other way round - it is a property of the TARGET restricting
who may hold it, where those two are properties of the shooter. It is consulted at
`mainOk`, at `nearestEnemy` and at the tower/bunker scan; `wcOf` answers for a
building as well as a unit, so the guard tower and the bunker are covered by the
same line. Without it every rifleman on the map would stand under a balloon forever
dealing nothing, because a zero multiplier is not a refusal to aim.
`splash` needed its own line for a reason that is easy to get backwards: EVERY
rocket in this file, the AA row included, does all of its damage as splash on
impact - `updateProjs` never applies a direct hit - so "splash never touches it"
could not be implemented as "skip balloons in splash". It is implemented as "skip
balloons unless this burst is an AA missile's", which is both sentences at once.

**Seam 4 - the Command Post spends the veterancy LADDER, not the kill credit.**
`u.kl` is a count of kills, it is hashed through `hI`, and `hI` does `v|=0` - so
crediting 1.5 kills for one under the aura would advance the serialized state and
NOT advance the hash. That is a lockstep divergence with no symptom at all until
two clients disagree about a promotion. A cheaper ladder keeps `kl` an integer,
needs no new state anywhere, and says the same thing. The reduced rungs are derived
per rung off `VET_INF` / `VET_VEH` rather than typed as a second pair of arrays, so
re-tuning either cannot leave a stale copy behind.

## v86 note: two new units, and the roster-wide derivations were checked FIRST

The v85 trap generalises to "any derived constant that takes a min or a max over a
whole table is a trap for the next row added to it", and v86 adds two rows. Both
readers of `U` in aggregate were checked before either row went in:

  `MEDIC_HEAL_RATE` - a `Math.min` over the DPS of everything that fights. Both new
    units are unarmed (`dm: 0`), so the guard `t.dm>0` excludes them and the floor
    is untouched at 2.0894 HP/s. Note this is NOT the `noPace` exemption the Signal
    Runner needed: neither row carries it, and T59.A asserts that, so the reason the
    Medic did not move is the honest one.
  `SUP_U` - quartile RANKS over the trainable roster sorted by cost. This one really
    was at risk: an insertion re-ranks everything after it, and the roster went 21 ->
    23, which moves the cuts from after the 6th/11th/16th to after the 6th/12th/18th.
    For all 21 existing units to keep the rank they had, exactly one arrival has to
    land before the Medic and exactly one between the Medic and Sarge. **The two
    prices were then chosen to make that true**: 145+23 = 168 puts the Command Truck
    between the Mortar Squad (150) and the Sniper (170), and 250+69 = 319 puts the
    Balloon between the APC (306) and Sarge (329). Measured after the fact: nothing
    moved tier. T59.A transcribes the pre-v86 ranks and carries the counterfactual -
    price the Command Truck at 20 and the roster really does re-tier - so the two
    costs cannot drift into a silent re-pricing of somebody else's supply.

`AI_SUP_UNIT` (the mean supply rank over the trainable COMBAT roster) reads the same
`dm>0` guard as the Medic floor and is likewise unmoved.

## v86 trap: the build-menu alphabet ran out at v85, and the pin that should have caught it was reading the wrong thing

`MENU_KEYS` held thirteen letters, chosen at v73 as EXACTLY the ones no in-match
binding claims. The HQ's panel is the build roster plus its Dump Truck tile, and the
build roster is eleven fixed keys plus that army's exclusive structures - so the
moment Blue got a second structure at v85 its HQ menu was **fourteen tiles against
thirteen keys**, and the fourteenth tile silently carried no hotkey. `hotNext`
returns null past the end and the tile is built without a key, so nothing failed.

T50.D exists to catch precisely that, and it did not, because the loop that claims
to check "every host x faction" computed the construct half with
`constructRoster('hq')` - which reads `bldRoster(G.human)`, the LOCAL player's
roster, no matter what faction the loop was iterating. Every row of that sweep
measured Green. Green was still thirteen at v85, so the sweep read 13 and passed.

Both halves are fixed in this release. The fixture reads `bldRoster(q)` so the claim
it makes is the claim it checks, and `MENU_KEYS` gains a fourteenth key. Fourteen is
the whole roadmap's width, not a step on the way to more: every army ends roadmap 2
with two exclusive structures, so Tan and Gray reach fourteen at v87 and v88 and
nothing reaches fifteen.

**The fourteenth key is `v`, and it is not free in the strict sense the other
thirteen are** - the spectator box toggles on it. The two can never be live
together, and not by luck: the Construct menu is built only under `e.p.human`, and
a watch match has no human player at all, so the registry is empty for the whole of
every match in which `v` means anything. That premise is PINNED rather than argued
in prose - T50.D boots a watch match and asserts no player in it is human - because
it is the kind of claim that quietly stops being true.

## v86 measurement: T42.H's two-seed census was seed-lucky, and both builds were measured

T42.H reads "how many of its SCALING structures does each army finish inside one
400-second match", over two seeds. At v86 it read blue 2.50 / gray 0.00 and failed
on Gray's 0.5 floor - in a release that adds nothing to Gray at all.

Measured over six seeds on BOTH builds rather than argued about:

    v85   blue 1.00   gray 1.67
    v86   blue 2.33   gray 0.83

The pair is roughly conserved (2.67 -> 3.16). What happened is a redistribution
between two armies, not Gray losing the ability to build bunkers: v86 moves the
shared RNG stream everywhere, because a Green bot now researches and fields three
more things and every draw after it shifts. A two-sample mean of a small count
cannot tell "redistributed" from "regressed", which is the same fault T31.E and
T50.F were found to have at v85.

`SEEDS63` is now four seeds rather than two (gray 0.75, blue 2.50). Four rather
than six is the time budget: each seed is a 400-second match and the section runs
the census twice, so six would put ~120 seconds on segment 2c for a third decimal
place. **Expect this section to need re-measuring at v87 and v88 for the same
reason**, and re-measure both builds rather than adjusting the floor.

## v86 note: the crates are the first new top-level list since G.strikes

`G.crates` is hashed, serialized and swept once per tick by `updateCrates`. It is a
list rather than a strike because a strike is a TIMED effect that is spliced out when
its schedule runs out, and a crate has no schedule at all - the owner's rule is "no
expiry", so it lies where it lands until somebody walks over it. The strike that
drops the pair carries `pi` rather than leaning on its owner, exactly as the v79
smoke cloud does and for the same reason: the crates can land after the tower that
called them is rubble, and `loadState` resolves a dead owner to null.

Hashing it is not optional. Two clients disagreeing about whether a crate has been
collected is a 500-plastic divergence, and a list that is hashed and not serialized
fails the save/load test by construction - T59.F drives both directions, including
collecting a crate that has been through a snapshot.

## v86 trap: a fixture that stands a unit in a live match is measuring the match

The first cut of T59.E stood an enemy Grunt on a crate, ran one tick of the real
match, and asserted the crate was still there AND the Grunt still alive. It failed:
the Grunt was at -171 HP by the end of the tick, having spawned on a buried landmine
(`MINE_DMG` is 276). The refusal it meant to test was never exercised - it was
reading a corpse.

The rule is now driven through `updateCrates()` directly, the real function called on
its own, and the claim that the MAIN LOOP drives that sweep is a separate check with
a live tick on a crate of its own. This is the v85 heal-rate lesson in a second
shape: either drive the one function under test, or key the measurement on something
the rest of the match cannot supply.

## v86 traps learned

  - **A `d:` string on a table row cannot name another table.** `U.cmdtruck.d` wants
    the NAMES of the three structures Forward Command anchors and `U.balloon.d` wants
    the names of the four men Bail spawns; `B` is declared after `U`, and `U` is not
    initialised while its own literal is being built, so both are template literals
    reading a const in its temporal dead zone. Both are written in a post-table pass
    below `B`, in the same style as `B.guardtower.dm`, so they still read off
    `CMD_BLD` / `BAIL_CREW` rather than retyping the lists. HELP_TUNE slots do NOT
    have this problem - a slot body only runs when `applyHelpTune` calls it, which is
    why `plateRow` can already reach `wcRoster`.
  - **A three-dash banner at column zero is a banner.** T49.D scans for
    `/^\/\*\s+[-=]{3,}\s+(.+?)/`, so a top-level `/* --- v86 SOMETHING ---` comment is
    a FILE MAP title and is refused for carrying a version prefix. An INDENTED one is
    not, which is why the dozen `/* --- v86 ... ---` blocks inside functions are fine
    and the one at column zero was not.
  - **A comment cannot follow `.filter(k=>{` on the same line.** Dropping a `//`
    explanation after an arrow-function brace ate the body of the AI production
    filter and produced an "Illegal continue statement" two hundred lines away. Use a
    `/* */` comment or put it on its own line.
  - **The suite has two hand-typed copies of `AI_SUPPORT` in `aiTick`**, and both had
    to become reads of the table before two new support units could be added -
    otherwise the Command Truck and the Observation Balloon would have counted as
    line fighters in the army census, the ceiling and the composition vote. T27.F and
    T29.A pinned the SPELLING of those two lists and were rewritten to pin the fact.
  - **A fresh match already fields two Grunts.** A fixture that counts `p.units` by
    key to see what an ability spawned will read them as crew; count against the set
    of ids that existed before instead.

## v86 note: render_tail_v32 had been failing since BUILD_R_HQ moved, on every build

Not a v86 regression - measured on the v85 build first, identical failure. The
fixture painted `drawGhost` onto a fixed 560x420 canvas with the comment "so the
10-ring lands on-canvas". `BUILD_R_HQ` was 10 when that was written and is 15 now:
at 15 tiles the ring's widest points sit 480 px out against a 280 px half-width,
and its top and bottom arcs sit 240 px out against a 210 px half-height, so NONE of
it landed. The check read 0 green pixels and had been dead ever since.

The canvas is now sized off `BUILD_R_HQ` itself, so a further re-tune of the build
zone moves the canvas with it. Two v86 checks were added beside it for the Command
Truck's travelling ring, and they carry a trap worth knowing: the placement GHOST is
drawn in the faction colour, and for Green that is green, so a cross-key comparison
measures the FOOTPRINT rather than the ring. Both checks compare the same key with
the truck on the field and off it.

render_tail_v49 gained a v86 block of its own: the two new hulls through the same
near-black / team-hue classifier the buildings already use, and the supply crate,
which is scored differently on purpose - its body is a fixed olive green and NOT the
faction colour, because what has to read at a glance is which resource is in it
rather than whose it is. The Command Post needed no edit there: section 3 already
walks `for(const key in B)`.

The six real-canvas tails at v86: 60 / 25 / 60 / 152 / 9 / 4, all green. They need
`npm i @napi-rs/canvas`, which is not preinstalled in a fresh container.

## v86 note: the snapshot tag moved 73 -> 86

`saveState` writes a `v` field that T49.E calls "the tag that tracks the build". It
had read 73 since v73 because no release since had changed the snapshot's SHAPE.
v86 adds a top-level `crates` list to it, so the tag moves. Old saves still load:
`loadState` reads `S.crates || []`, and a pre-v86 save honestly carries none. The
tag is not part of `hashState` and never has been.

## v86 note: tail_v86 rides segment 3, and the check count

Segment 3 carries tail_v86 alongside tail_v79 through tail_v85. No further split was
needed. The five segments at v86 run 2337 / 494 / 48 / 237 / 1567 = 4683 checks,
0 failures, plus verify_v58.py's 32.

## v85 note: the FAC.ub refactor was landed and PROVED neutral before any content

v85 needed `FAC[].ub` to become an array, because Blue was getting a second
exclusive structure and `ub` was a bare string with seven readers - three of which
compared it with `===` and would have quietly answered "no" for any army's second
building.

The refactor was landed FIRST, on its own, with Blue still holding one structure,
and `./triage.sh` was run against it: **every pinned trail combo reproduced and all
42 layout pins held**, so the shape change provably moved nothing. Only then did
the content go in. That ordering costs one 25-second triage run and is worth
repeating for any future refactor of a table every subsystem reads: when the suite
went red afterwards it was already known that none of it could be the refactor.

Three hand-typed lists died with it, and their death is the point: `techAvailable`
carried its own copy of the eight exclusive units and (twice) the four exclusive
buildings. They agreed with FAC only for as long as someone remembered to edit
both - a new exclusive added to FAC and not to those lists would have been
researchable by every army in the game. They now read `INFO_FEXCL_U` /
`INFO_FEXCL_B`, which are derived off FAC itself.

`ubScale` also went: "does a bot build this one in numbers" was a name check on
`'bunker'` and `'turbine'`, which cannot answer the question for a second
structure. It is now the table flag `B[k].mult`, so a row states its own habit.

## v85 trap: a new unit can silently retune a unit nobody was editing

`MEDIC_HEAL_RATE` is derived as "10% slower than the lowest-DPS unit in the game",
a `Math.min` over the whole roster. The Signal Runner is deliberately weak - 5.0
DPS against the Grunt's 7.5 - so **adding him would have cut every Medic in the
game from 2.089 HP/s to 1.30, a 37% nerf, in a release nobody thought was touching
the Medic.**

Caught by T32.A, which exists for exactly this ("a salvo unit reads low on that
formula, so this is the pin that stops a future salvo weapon silently retuning
every medic in the game") and fired on the first full run. The fix is a `noPace`
flag on the row, meaning "excluded from the combat-pacing floor", because the
derivation means *the weakest thing that fights* and a support man with a sidearm
is not that. T32.A now also asserts the COUNTERFACTUAL - drop the exemption and the
Runner really does become the floor - so the flag cannot become decorative.

**Generalises:** any derived constant that takes a min or max over a whole table is
a trap for the next row added to that table. Before adding a unit, grep for what
reads `U` in aggregate. At v85 that was `MEDIC_HEAL_RATE` (min DPS) and `SUP_U`
(cost quartiles). The supply quartiles were checked by hand in advance and moved
nothing - the Runner at 62 plastic lands in the cheap tier and displaces nobody -
but the check was made, not assumed.

## v85 note: 21 units means the supply tiers can no longer be equal

`SUP_U` cuts the trainable roster into `SUP_MAX` ranks and T35.A asserted each rank
held exactly a fifth. That was only ever true because the roster had 20 entries and
20 divides by 4. At 21 it is 6/5/5/5.

T35.A now asserts the PROPERTY rather than the coincidence: no tier is more than
one unit off another, and the remainder falls to the cheap end (which is where
`floor()` puts it by construction). The next unit added will not fail here for no
reason.

The same size assumption was hiding in T48.B, which reconstructed the retired
median rule as `(v[9]+v[10])/2` - the median of a twenty-element list and nothing
else. At 21 that silently became "the average of the 10th and 11th cheapest", which
is not the middle of anything. Written as a real median it is correct at any size,
and **the direction of that section's headline finding flipped**: at v69 the ladder
measured wider than the median rule (5.84x vs 4.76x) and that was recorded as the
scope estimate having been wrong; over a 21-unit roster it measures NARROWER (5.84x
vs 7.04x). The ladder's own figure did not move at all. Adding one cheap, very
low-DPS unit costs the two-bucket rule far more than the quartile rule, because a
bucket keyed on an absolute threshold hands him the same 1 supply it hands the
Bazooka. That is precisely the cliff the ladder was built to remove, so v69's
reasoning was right and its roster was just too small to show it.

## v85 note: what v85 actually added, and the two seams worth knowing

  SIGNAL RUNNER (Barracks, Blue). 46 HP / 5.0 DPS against a Grunt's 62 / 7.5, and
    priced ABOVE him at 62 plastic, because what is bought is the radio. The
    pistol is weapon row `b` at shorter reach - a tenth weapon row for one sidearm
    would have widened every damage table in the file to say nothing new.
    Passive `Radio Net` - friendly infantry within 4 tiles get +1 sight.
    Toggle `Sprint` - every friendly infantryman within 4 tiles, himself included,
    gets +30% speed, and NONE of them may fire, take an attack order or acquire a
    target while it runs.
  FORWARD PAD (Blue's second structure). Repairs friendly aircraft within 6 tiles
    at 1.6 HP/s - **the only aircraft repair in the game**; the Medic Truck has
    always healed ground units and buildings only. Deliberately under the Medic's
    2.089. Ability `Scramble` - every aircraft the army owns, anywhere on the map,
    gains +40% speed for 12s, on the building's existing `upT`/`abilityCool`.
  RAPID REDEPLOY (Radio Tower call-in, Blue only). Airlifts up to 20 SELECTED
    infantry anywhere, even in fog, under paradrop canopies. Creates nobody.

**Seam 1 - the auras are read off the RUNNER, never written onto the men.** Sprint
and Radio Net both scan for a Runner in range at the point of use (`spOf`, `viOf`),
in the same shape as the Sarge and Chinook loops in `dmgBonus`. That is what keeps
a sprinting platoon of twenty from carrying twenty copies of the same fact through
`hashState` and the snapshot: the whole feature is ONE boolean, `u.spr`. The
infantry gate comes first in both scanners, so every vehicle and aircraft leaves on
the first line; inside the loop the flag test leads, and it is `undefined` on every
unit in the file except a Signal Runner.

**Seam 2 - the redeploy borrows `u.garrisoned` for its off-map window.** It needed
no new hashed field, because `garrisoned` already means "not on the field" at every
door: targeting skips them, splash skips them, the renderer skips them, `applyDmg`
never reaches them. A man in the air is exactly that. He is in no building's
garrison list, which is safe because nothing ever searches for a garrisoned unit's
carrier - the strike is the only thing that knows, and strikes ARE serialized, so a
snapshot cut mid-flight lands the squad on schedule after a reload. T58.E drives
that end to end, because a squad stranded off the board forever is the obvious way
for this to go wrong.

`RADIO_ABILITIES` gained a `fac` field rather than a second table: a row with no
`fac` belongs to everybody, a row with one belongs to that army. Every surface goes
through `radioListFor(p)`, and `execCmd` refuses a foreign mode at the command door
rather than relying on the panel not offering it - the panel is client-local and a
peer can send whatever it likes. **v87 uses this same field to make Napalm
Tan-exclusive; do not build a second mechanism for it.**

## v85 note: three fixtures were measuring the wrong thing, and the roster growing exposed it

None of these were v85 regressions. All three were checks that had quietly become
seed-lucky or name-bound, and a moved trail is what surfaced them.

  T31.E ("a rich bot adds a second producer") took `bots[0]` and `bots[1]` in list
    order. At v85's trail every bot on seed 600303 already held two barracks by
    tick 1800, so the headline check was green on a pair it had before the money
    arrived, and only "...and it is a real gain" was still telling the truth. It
    now CHOOSES bots that do not already have a pair, and fails loudly if fewer
    than two qualify.
  T50.F named `sandbox:koth` as "the one gunner-bearing combo" and the anchor for
    any future unit-stat release. At v85 that row fields none - and three OTHER
    rows now field him (backyard:dm 929 unit-ticks, kitchen:ctf 638,
    livingroom:dm 780). Coverage moved and WIDENED. Naming a row was the mistake;
    the anchor set is now computed, and the check fails only if no row fields him
    at all, which is the condition that would really matter.
  T42.H counted `b.key === FAC[p.fac].ub`, which silently became false for every
    army once `ub` was an array. It now counts the army's SCALING structures
    (`B[k].mult`), which is what the threshold always meant.

T42.H also records a REAL behavioural change, not a fixture fault: Blue's turbines
per match fell 1.5 -> 1.0. Blue's second exclusive takes the wish-list slot the
non-scaling structures have always had, just after the radio tower, which puts it
ahead of the second turbine - so within one match's clock a Blue bot now buys a
Forward Pad's worth of progress where it used to buy a second turbine. Measured
over six backyard seeds rather than the two that section runs: 1.00 flat, and Gray
(whose list did not change) is unmoved at 1.67. The WANT is untouched and is still
proved for free in T42.F. **Expect the same drop for Green, Tan and Gray as each
gains its second structure at v86-v88.**

## v85 trap: measuring a heal rate inside a firefight measures the firefight

The first cut of T58.C parked a helicopter on a Forward Pad in a live match, ran
the real update loop for a second, and reported the pad repairing at **-4.86 HP/s**.
An enemy rifleman had found the aircraft at tick 22.

The rate is now measured through `updateBld(pad, dt)` directly - the real function,
called on its own - and the main loop gets a separate check that COUNTS the ticks
on which a hurt aircraft gains exactly `PAD_REP*dt`. A tick where a shot lands is
simply not one of the ticks counted. Keying on the exact per-tick figure rather
than on "did it gain" also isolates the pad from the other things that move an
aircraft's HP: the out-of-range control in that same fixture was caught taking a
single +11 from a veterancy rung.

**Generalises:** any fixture that measures a RATE inside `update()` is measuring
the whole match. Either drive the one function under test, or key the measurement
on the exact expected delta so everything else falls out of the sample.

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

v90.2 adds tail_v90_2.js (T65), riding segment 3 and listed last in tails.txt.
Sections A-D: the toasts at the top centre and clear of the survival banner by
construction, the bar's height stated once with four boxes derived from it, the
doubled bar and the six overrides that keep the raise from leaking outside it, and
the top edge-scroll band - dead in every release before this one - driven through
update() with a mutation arm that reproduces the impossible condition.

v90.1 adds tail_v90_1.js (T64), riding segment 3 and listed last in tails.txt. It
is the first release tail since tail_v88_1.js — v89 and v90 deliberately had none
and put their checks in the tails that own the subsystems, which was right for two
pure AI passes and is not right for a release that adds a table field, a sim door
and two pieces of chrome. Sections A-F: the Construct menu's declared shelves and
the sort over them, the panel width derived from the stylesheet's own numbers, the
wall thumbnails in the TILE painter (the call site v88.1 could not reach), the HQ's
lim:1 at all three doors with a mutation arm that lifts the limit, the rebuild
button and the permissions it does NOT grant, and the bot's rebuild plus the guard
the untouched trails rest on.

v87 adds tail_v87.js (T60). recut_v87.js and repin_v87.py are this release's
one-shot recut pair, carried forward from the v86 pair and replacing it, per the
standing rule that only the CURRENT release's one-shots ship. v86's tail_v86.js
(T59) stays, as every release tail does.

v82 added tail_v82.js (T56). recut_v82.js and repin_v82.py were one-shot records
that shipped beside the release and are NOT carried forward in this bundle;
probe_v82_chin2.js, probe_v82_audit.js, probe_v82_bike2.js,
probe_v82_calldown.js and probe_v82_od.js are the scoping probes behind the v82
notes above and are likewise records rather than harness machinery.
- run.sh         harness runner: ./run.sh [standard|mini|full|render <tail>]
- tail_v87.js    T60, the v87 Tan release. Sections A-H: the tables and the supply
                 band the Firebomb's price had to land in, the u.abCool machinery
                 stated as machinery rather than as one unit's case, Scorched Earth
                 and Napalm Blast including who the fire does and does not burn, the
                 Foundry's baked-in hull and Pour, the Napalm Strike changing hands
                 at all five of its surfaces, the burning ground through a snapshot
                 with a dead owner, and the two bot rules driven rather than read.
- tail_v86.js    T59, the v86 Green release. Sections A-H: the tables and the two
                 roster-wide derivations that had to be checked before two rows went
                 into U, the Command Truck's travelling build anchor and Broadcast at
                 the rtOf door, the Observation Balloon across all four of its
                 targeting doors plus the fuel clock and Bail, the Command Post's
                 cheaper veterancy ladder and Regroup, the Supply Drop's crates
                 through a snapshot, and the four bot rules driven rather than read.
- tail_v85.js    T58, the v85 Blue release and the FAC.ub refactor. Sections A-F:
                 ub as a list and every reader that took the change, the Signal
                 Runner's two auras and the three doors Sprint closes, the Forward
                 Pad's repair and Scramble, Rapid Redeploy including a snapshot cut
                 mid-flight, and the manual slots.
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
