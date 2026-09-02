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
| `source/` | The same game as 36 readable files; `./build.sh` assembles them into the file above. |
| `assets/snd/` | The sound effects as playable mp3 files — they also ride inside the game file, so it stays self-contained. |
| `assets/mus/` | The four soundtrack tracks as playable mp3 files, plus the loop points — they ride inside the game file too. |
| `assets/img/` | The sprite textures as viewable webp images — same deal: they also ride inside the game file. |
| `assets/nrm/` | The textures' normal maps — the per-pixel surface directions the lighting uses. |
| `harness/` | The automated test suite: 89 test files that play the game headlessly and check nothing broke. |
| `harness/README.md` | The full development record — the design decisions, the balance measurements, and the traps learned at every version. |
| `tools/` | The offline pipelines that make the art and sound: the sound renderer, the music loop-cutter and packer, and the four steps that turn the game's own painters into textures and normal maps. |

### A note on the test suite

This project has an unusually thorough safety net for a game of its size. The
harness runs the real game code with the graphics stripped out, simulating
thousands of turns of play across every map, mode and difficulty, and checks
that the results come out identical every time. As of v106 it makes **6,083
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

The game is at **version 106**.

**v106 — the computer players learned six abilities they had never used.** Every
army has unit abilities you can switch on and off — a Bull that charges, a scout
that runs flat out, a mortar that fires smoke to cover your men. The computer
players knew about four of them and simply never touched the rest, so you could
play a hundred matches and never once see a Bull charge you.

That is fixed for six of them: **Smoke Rounds, Full Throttle, Flat Out, Sprint,
Ripple Fire** and **Air Assault**. Each one is used the way it is meant to be —
the three that trade gunfire for speed are switched on while crossing the map and
switched off the instant there is something to shoot, so a computer army never
silences itself in a fight. A charging Bull is the one exception, and on purpose:
it flattens infantry it drives over, so it keeps charging through them and only
stops for things it has to shoot at.

Two payoffs. The hardest difficulty is harder without a single unit being made
stronger, and you get to see your own army's tricks used against you, which is
the best way to learn what they do.

**v105.1 — two bugs found by playing.** The first one mattered: **three
army-exclusive buildings had no button to research them**, so you could never
build them at all — Green's Command Post, Tan's Foundry and Gray's Heavy
Barricade. Worse, the computer players *could* research all three, and had been
doing so for nineteen versions, so this was a gap that only ever ran against you.
Blue was unaffected. All four armies can now research everything they are meant
to, and the list of what a Research Lab offers is worked out from the buildings
themselves, so a new one can never go missing this way again.

The second is cosmetic: the tanks marching in the menu parade (and so behind the
Field Manual too) had **no turrets** — just bare hulls. The Tank, the "Bull" and
the AA Missile Truck now carry their guns on parade, exactly as they do in a
battle.

**v105 — the menu parade shows off the whole army, and the Field Manual joins
it.** The little marching column behind the setup screen used to be nine kinds
of soldier walking in four ranks. It is now **every single unit in the game** —
all 26 of them, in six ranks, four times as many figures on the field, with the
helicopters and the observation balloon flying over the top of it all. Every
unit marches in one army's colours, and the four army-exclusive units always
wear their own army's, so what you are looking at is the actual roster.

The **Field Manual** is now painted on that same parade ground instead of a flat
green panel — including when you open it in the middle of a match. The page
itself is unchanged and just as readable; there is simply an army marching past
behind it.

**v104.4 — the music changes tracks instead of piling up.** When the build-up
music gave way to the combat music, both played at once for a moment and the old
one never quite stopped — it faded down to a whisper and stayed there under
everything else for the rest of the match. Two marches in different keys sounding
together is a mess however brief, so a change of track is now a proper handover:
the old one fades right out, there is a beat of silence, then the new one comes
up. Nothing overlaps.

The combat music also follows what you are actually looking at again. It now
switches on when a fight is going on **in view**, and waits a second and a half
before committing, so two scouts trading a shot at the edge of the screen no
longer swings the whole soundtrack. Spectating is the exception, on purpose: a
spectator has no army for the camera to follow, so they still hear the fighting
wherever it is — which is what v104.2 fixed and this release is careful not to
undo.

**v104.3 — the victory music plays properly now.** It used to be a six-second
fanfare that sounded once and stopped. It is a full looping track like the other
three: it starts when the match is clearly decided, keeps playing while that
stays true, overrides whatever was playing, and carries on under the
end-of-match graphs until you leave for the menu. A defeat screen stays silent.

The fiddly part was stopping it flickering. Supply changes every time a unit
dies or finishes building, so a lead hovering right on the threshold would have
switched the music on and off repeatedly. It now starts at a lead of more than
20 but does not stop until the lead falls below 12, and once it starts it keeps
playing for at least twelve seconds — so a brief counter-attack cannot cut the
music off mid-phrase. The download grew to 8.74 MB, the fanfare now being a
full-length track rather than a snippet.

**v104.2 — volume sliders, and the music finally follows the battle.** The
speaker button in the top bar is now an audio menu: click it for **Music** and
**Effects** sliders, plus mute. Both run from silent to half again louder than
the default, and your browser remembers where you left them. That is the real
answer to "the music is too quiet under gunfire" — a firefight is a dozen guns
sounding at once against a single piece of music, so how loud it *should* be
depends on your speakers and your taste. The default is louder again anyway,
more than three times what v104 shipped.

The other fix explains a puzzle: in spectate mode you only ever heard the
build-up music. The combat track was switching on when the game heard *gunfire
near your camera* — and a spectator's camera does not follow the fighting, so
the music never knew a war was on. It now watches the battle itself, so the
combat track plays when soldiers are actually fighting, wherever you happen to
be looking. Spectators get the victory fanfare too.

**v104.1 — three fixes to the new music.** Playing v104 turned up three things.
The menu march used to wait until your mouse happened to pass over a button —
now *any* click or keypress starts it. (Your browser will not let a page play
sound before you interact with it at all, so that first click is unavoidable;
what was wrong was insisting it be a click on the right thing.) The score used
to duck so far under gunfire that it vanished exactly when you were watching
the fight — it now sits at more than twice its old level during combat, still
under the guns but audibly there. And **the victory fanfare had never once
played**: it was only ever asked for at the single instant it was needed, and
the file had not finished preparing itself by then, so nothing came out. All
four tracks are now made ready the moment the game gets sound.

The fanfare also fires at a better moment. It used to wait for the final
results screen, which is a strange place for a celebration. It now plays while
you are still on the battlefield, at the point the result stops being in doubt
— one enemy left, and either they have no army at all or you are more than 20
supply ahead of them. If you are the one being mopped up, you hear nothing.

**v104 — the game has music.** Until now the only continuous sound in Plastic
Warfare was the hum of a Dump Truck mining, on a game where every gun is a real
recording. It now has a soundtrack: a march on the setup screen, a lighter tune
while you build your base, a drum-driven one when the shooting starts, and a
bugle fanfare when you win. All four are played by the **United States Army Old
Guard Fife and Drum Corps** — real fifes, real marching drums, an actual Army
band — which felt like the only honest choice for a game about plastic soldiers.
Because they are recordings by a serving US Army unit they are public domain, so
they cost nothing and need no credits screen.

The music knows what is happening. It switches to the combat track when a fight
starts and settles back a few seconds after it ends, and it drops back under
gunfire the same way the mining hum already did, so it never fights the guns for
your attention. If your browser cannot play it, the game runs exactly as it did
before, silently — nothing about the battle depends on it. The download grew from
6.8 MB to 8.4 MB, which is the price of four real recordings living inside the
file.

**v103 — a clean-up pass over all five battlefields.** Playing v102 turned up a
list of things that simply looked wrong on the maps, and this release is the
sweep that fixed them. The garden hose on *Backyard Brawl* used to run clean off
the edge of the board and carry on into empty space; it stays on the lawn now.
Three of the maps had a strip of oddly-shaded tiles down one side, which turned
out to be the mowed-lawn stripes, the carpet's vacuum banding and the kitchen
tiles' shine all being painted into the same narrow band at the rim instead of
across the whole floor — they sweep the board properly now. Rocks, sofas, soup
cans and the like no longer spawn stranded in the middle of a puddle of water,
milk or grape juice. Two spills of different kinds no longer bleed through each
other. Big pieces of scenery stop being drawn on top of each other and on top of
the wire barricades. A sheet of paper no longer lands half on the chopping board.
The quicksand stops swallowing the sandcastle on *Sandbox Standoff*. Blades of
grass are no longer scattered across the living-room carpet — they are dust
bunnies now, which is what they were always meant to be. And *Backyard Brawl*'s
pair of terracotta pots is finally a pair: one of the two used to go missing on
most maps.

Two more came out of playing the release before it shipped. The white spills on
*Kitchen Counter* were washing out — a puddle of milk whose brightest point is
pure white has no surface left to shade, so it read as a flat hole in the counter
rather than as a spill; it has its rim, its ripples and its body back, and the
sheet of paper on the counter came down a shade with it. And *Backyard Brawl* had
too many wire barricades, bunched into long arcs: the lawn now lays about **40%
fewer** of them and they keep their distance from each other, so they read as
scattered cover instead of clutter. The roadblocks across the lanes are still
there — that is what they are for. The other three maps keep the barricades they
had; it is the lawn where dark wire on bright grass stood out.

Two smaller things came in the same release: the **Artillery Barrage** now drops
its seven shells 1.5 seconds apart instead of 2, so the whole walk lands in
about ten and a half seconds rather than thirteen and a half and a target has
less time to drive out from under it — the shells themselves are unchanged. And
**selecting a helicopter is twice as loud**, so the rotor answers you over the
noise of a ground fleet.

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

All code, artwork and design in this repository are original work, with one
exception: the four soundtrack tracks are recordings by the **United States Army
Old Guard Fife and Drum Corps** — *The President's March*, *Paddy on the
Handcar*, *Soldier's Farewell / March of War* and *ERAFNAF Fanfare*. The Old
Guard is a serving US Army unit, so its recordings are works of the federal
government and are in the public domain under 17 USC 105. Every other sound in
the game is synthesised or rendered from the game's own recipes.

*Army Men RTS* (2002) was published by 3DO / Global Star Software; this project
is an independent tribute and contains no assets from it.
