# Plastic Warfare

A real-time strategy game about little plastic army men fighting across the
household — the backyard, the kitchen counter, a sandbox, the living room floor.
It is a from-scratch tribute to the 2002 game *Army Men RTS*, with its own units,
its own balance and its own take on the toy-soldier look.

The whole game is a **single HTML file**. No installer, no download, no account,
no internet connection needed.

**▶ To play: download `plastic-warfare.html` and double-click it.** It opens in
your web browser and you are straight into the setup screen.

Prefer the original hand-drawn look? The classic (v90.2) game — the last
version before the textured-and-lit overhaul — lives unchanged on the
[`classic` branch](https://github.com/ProtonNeutronElectron69/Plastic-Warfare-Game/tree/classic).

---

## The four armies

Each army plays differently, and each one fields exclusive units and buildings
of its own. Every exclusive entity has a permanent **passive** and an **ability**
you use during the battle.

| Army | Character | Exclusive units | Exclusive buildings | Own call-in |
|---|---|---|---|---|
| 🟢 **Green Army** | Balanced — everything costs 8% less | Sarge, Mortar Squad, Command Truck, Observation Balloon | Radar Tent, Command Post | Supply Drop |
| 🟤 **Tan Army** | +15% damage, slightly slower | Flamethrower, "Bull" Heavy Tank, Firebomb Heli | Munitions Dump, Foundry | Napalm Strike |
| ⚪ **Gray Army** | +20% tougher, slightly slower | Sniper, Rocket Artillery, Choktaw Heli | Bunker, Heavy Barricade | Smokescreen |
| 🔵 **Blue Army** | +15% speed, lighter plastic (−10% health) | Scout Bike, Chinook, Signal Runner | Wind Turbine, Forward Pad | Rapid Redeploy |

All four armies now have a *full* exclusive set: an exclusive unit out of the
Barracks, the Garage and the Helipad, two exclusive buildings, and one call-in of
their own.

A few examples of what those abilities actually do:

- The **Sniper** is invisible unless he has fired in the last 5 seconds.
- The **Flamethrower** sets his targets alight, and his Pressure Valve trades
  half the damage he deals back onto himself.
- The **"Bull" Heavy Tank** ignores rifle fire completely, and at Full Throttle
  crushes infantry under its treads but cannot shoot while rolling.
- The **Scout Bike** takes half damage on any moment he is actually moving.
- The **Observation Balloon** has the best sight on the board and nothing but an
  anti-air missile can touch it — but the gas runs out after three minutes and it
  falls, so bail the crew out before it does.
- The **Firebomb Heli** sets the ground alight wherever it hits, and its Napalm
  Blast burns *your* men as readily as theirs.
- The **Chinook**'s squad can fire out of the open hold — but the aircraft is
  pinned in place while they do.
- The **Wind Turbine** can be overdriven to triple power for 20 seconds, and
  then produces nothing at all for 70. It is a net loss on purpose: it buys you
  the electricity *earlier*, not *cheaper*.
- The **Signal Runner** is weaker and worse-armed than a plain rifleman on
  purpose — what you are buying is his radio. His Sprint speeds up every
  friendly infantryman around him, and stops all of them from firing.
- The **Forward Pad** repairs aircraft, which nothing else in the game does.

## Modes and maps

**💥 Deathmatch · 🚩 Capture the Flag · 👑 King of the Hill · 🛡️ Wave Survival**

Played across *Backyard Brawl*, *Kitchen Counter*, *Sandbox Standoff*,
*Living Room*, and *The Desk* (wave survival only). There is also a
host/join mode for playing against another person.

---

## What is in this repository

| Path | What it is |
|---|---|
| `plastic-warfare.html` | **The game.** This is the whole thing — open it to play. |
| `source/` | The same game as 34 readable files; `./build.sh` assembles them into the file above. |
| `assets/snd/` | The sound effects as playable mp3 files — they also ride inside the game file, so it stays self-contained. |
| `assets/img/` | The sprite textures as viewable webp images — same deal: they also ride inside the game file. |
| `assets/nrm/` | The textures' normal maps — the per-pixel surface directions the lighting uses. |
| `harness/` | The automated test suite: 80+ test files that play the game headlessly and check nothing broke. |
| `harness/README.md` | The full development record — the design decisions, the balance measurements, and the traps learned at every version. |
| `tools/` | The offline pipelines that make the art and sound: the sound renderer, and the four steps that turn the game's own painters into textures and normal maps. |

### A note on the test suite

This project has an unusually thorough safety net for a game of its size. The
harness runs the real game code with the graphics stripped out, simulating
thousands of turns of play across every map, mode and difficulty, and checks
that the results come out identical every time. As of v102 it makes **5,694
individual checks** across its five segments.

That is what makes it safe to keep changing the game: if a change breaks
something subtle three systems away, the tests say so before you ever see it.

### Running the tests

You need [Node.js](https://nodejs.org) installed. Then, in the `harness` folder:

```sh
./build.sh     # copy the game's code out of the HTML file, ready to test
./run.sh       # run the standard suite
```

The full suite is long, so it is also split into five smaller chunks that can be
run one at a time:

```sh
./seg.sh 1     # then 2a, 2b, 2c, 3
```

`build.sh` regenerates `game.js` from `plastic-warfare.html`. That generated file
is deliberately not stored here, so the game's code lives in exactly one place
and there is no way to edit the wrong copy by accident.

---

## Version history

The game is at **version 102**.

**v102 — you can finally see what a unit is good at.** Hovering a unit inside a
Barracks, Garage or Helipad now opens a proper card instead of a line of plain
text: health, damage per second, weapon range and sight as icons, then a row of
six icons showing how hard that unit hits infantry, light vehicles, medium and
heavy armour, aircraft and buildings — in gold. Under that, in red, is the thing
the card is really for: **what beats this unit**, named outright. A Grunt reads
"Flame ×1.35, Grenades ×1.20, Arcing shells ×1.15", so you know what not to walk
him into. Selecting a single unit on the battlefield shows the same card, with
the health it has left and — after dark — the shorter sight it currently has.

**v101 — day and night come to the battlefield.** Every match now runs a full
day/night cycle: ten minutes takes you through daylight, an orange dusk, a long
blue night and a pale dawn, and every battle starts at a random time of day. At
night, every unit and structure on the board — yours and the enemy's alike —
sees only half as far: the lit circle around your army closes in, guns stop
picking up targets they can no longer see, and scouting before you attack
matters twice as much. Weapons shoot exactly as far as they always did, so a
target you can point at is still a target you can hit. The top bar shows the
current phase, and a message tells you when night falls and when dawn breaks.
Testing Mode stays at permanent noon so nothing surprises you while you
experiment.

**v100 — three fixes from playing.** Bailing the Observation Balloon's crew out
now floats the four men down under parachutes, where before they simply appeared
on the ground the instant you pressed the button. Wildlife can be selected and
read like anything else — clicking a creature used to break the selection panel
silently. And Green's Supply Drop crates come down under canopies of their own,
drawn twice the size with a soft green pulse so you can actually find them.

**v99 — the bots stop twitching, and they finish the job.** Whole enemy armies
used to jerk in one direction and back again: a bot was re-ordering every unit it
owned about twice a second, at a target that kept changing its mind. An attack is
launched once now and left to fight it out; new production reinforces the attack
already under way instead of starting another one; and a single enemy scout near
a building calls a handful of nearby defenders rather than turning the entire map
around. A second pass fixed what that exposed — the bot that was winning would
idle most of its army while three or four units mopped up. It now commits harder
or holds more back depending on how much enemy contact it is actually under, and
walks an assault through a base one objective at a time.

**v98 — four small changes.** Gray's **Heavy Barricade** costs 40 plastic instead
of 60 and buries a mine 15% of the time instead of 10% — and that mine is now
visible to its owner alone. The main menu carries a small version-and-date stamp
in the bottom-right corner. The number keys **1–9** fire the ability buttons on
the selection panel, which meant control groups moved to **F1–F9** (Ctrl+F1–F9 to
save one) and pause moved to **F10**. And the setup screen and Field Manual answer
with a light tick as the mouse crosses a button and a firmer click when you press
one.

**v97 — the detail & resolution pass.** The game renders at your display's
real pixel density now (high-DPI screens used to get an upscaled, soft
frame), sprites bake at a third more resolution, and every building,
vehicle, soldier, wall and creature gained molded detail — panel seams,
bolts, roof equipment, yard clutter, kit on the troopers, litter round the
nests — drawn into the painters and re-rendered into the whole texture set.

**Roadmap 3 (v91–v96) — complete.** The whole game moved to real art and real
sound while playing exactly the same: the code split into readable source
files with a build step (v91), every sound effect became a recorded take
(v92), the renderer gained a WebGL stage (v93–v94), every unit and structure
got a real texture (v95), and everything is lit per pixel — explosions and
fires now cast light on what stands near them (v96). The pre-overhaul game is
preserved on the `classic` branch.

**Roadmap 1 (v79–v82) — complete.** Every exclusive unit and building that
existed then got one passive and one toggleable ability: Green at v79, Tan at
v80, Gray at v81, Blue at v82.

**Roadmap 2 (v85–v88) — complete.** Every army got two exclusive buildings, an
exclusive unit out of the Barracks, the Garage *and* the Helipad, and a Radio
Tower call-in of its own. Blue landed at v85, Green at v86, Tan at v87 and **Gray
at v88**, which closed it.

One consequence is deliberate and visible in the table above: the **Napalm Strike**
used to belong to every army and is now Tan's alone. Every army has exactly one
call-in nobody else can use, plus the two shared ones.

**v88 — Gray.** The **Choktaw Heli** carries two weapons at once and fires both:
rocket pods for armour and structures, a door gun for infantry. Its *Forward
Observer* gives friendly mortars and rocket artillery +2 tiles of reach against
anything the Choktaw can see, and its *Paint* marks a 2×2 area where everything
of the enemy's takes +25% damage from every source for 10 seconds. The **Heavy
Barricade** is a 150 HP wall whose shadow cuts damage to everything of yours
beside it by 15%, stacking up to 60% — and one in ten of them buries a mine
toward the enemy that only your army can see and that your own men can walk over.
The **Smokescreen** call-in lays a 7×7 cloud in which your units *and your
structures* take 40% less damage for 10 seconds.

One side effect was worth knowing about, because it was a real balance change and
not a bug: adding a 25th trainable unit slid the supply-cost quartiles, so the
Machine Gunner, the Medic and Sarge each cost one supply less than they used to.
No price for the Choktaw avoided it. **v88.1 fixed the part of that which
mattered** — see below.

**v88.1 — four small updates.** The **Machine Gunner** is re-priced 112 → 125
plastic so he pays 2 supply again, which was the one consequence of v88's roster
growth worth undoing: at 1 supply he was the best value-per-supply unit in the
game. The seventh cheap-tier slot passes to the Flamethrower instead, who is
Tan-only, so three armies in four cannot field the leader at all. The **Forward
Pad** now repairs aircraft at 3 HP/s instead of 1.6 — at the old rate a damaged
Apache sat on the pad for two minutes, which is longer than the match phase it is
bought for. The **Field Manual** gallery is reordered and recoloured: units run
Barracks, then Garage, then Helipad, cheapest first in each group, structures run
cheapest to dearest, and everything any army can build is drawn in green while
each army's exclusives keep their own colour. And every unit and structure
description was rewritten shorter.

Reordering that gallery turned up a bug v88 had shipped: both barricade
thumbnails had been rendering blank, and nobody could see it while they sat in
the middle of the list.

**v87.1 — three interface repairs**, off the roadmap and touching no simulation.
The drag-selection box is drawn in your army's colour instead of a fixed yellow;
a mixed selection now offers a button for *every* toggleable ability any unit in
it owns, where four of the eleven were single-unit only; and selling a building
plays the same teardown a destroyed one does and leaves a heap of plastic behind
— scenery, not salvage, because the refund already paid for it.

The full version-by-version record, including what was tried and rejected and
why, is in [`harness/README.md`](harness/README.md). If you are picking this
project up fresh, start with [`CLAUDE.md`](CLAUDE.md).

## Credits

All code, artwork and design in this repository are original work. *Army Men RTS*
(2002) was published by 3DO / Global Star Software; this project is an
independent tribute and contains no assets from it.
