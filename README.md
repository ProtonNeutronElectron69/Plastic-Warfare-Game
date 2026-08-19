# Plastic Warfare

A real-time strategy game about little plastic army men fighting across the
household — the backyard, the kitchen counter, a sandbox, the living room floor.
It is a from-scratch tribute to the 2002 game *Army Men RTS*, with its own units,
its own balance and its own take on the toy-soldier look.

The whole game is a **single HTML file**. No installer, no download, no account,
no internet connection needed.

**▶ To play: download `plastic-warfare.html` and double-click it.** It opens in
your web browser and you are straight into the setup screen.

---

## The four armies

Each army plays differently, and each one fields exclusive units and buildings
of its own. Every exclusive entity has a permanent **passive** and an **ability**
you use during the battle.

| Army | Character | Exclusive units | Exclusive buildings | Own call-in |
|---|---|---|---|---|
| 🟢 **Green Army** | Balanced — everything costs 8% less | Sarge, Mortar Squad, Command Truck, Observation Balloon | Radar Tent, Command Post | Supply Drop |
| 🟤 **Tan Army** | +15% damage, slightly slower | Flamethrower, "Bull" Heavy Tank | Munitions Dump | — |
| ⚪ **Gray Army** | +20% tougher, slightly slower | Sniper, Rocket Artillery | Bunker | — |
| 🔵 **Blue Army** | +15% speed, lighter plastic (−10% health) | Scout Bike, Chinook, Signal Runner | Wind Turbine, Forward Pad | Rapid Redeploy |

Blue and Green have a *full* exclusive set. Tan and Gray are being brought up to
the same shape at v87 and v88 — see the version history below.

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
| `harness/` | The automated test suite: 60+ test files that play the game headlessly and check nothing broke. |
| `harness/README.md` | The full development record — the design decisions, the balance measurements, and the traps learned at every version. |
| `tools/` | The scripts used to build one version from the previous one. |

### A note on the test suite

This project has an unusually thorough safety net for a game of its size. The
harness runs the real game code with the graphics stripped out, simulating
thousands of turns of play across every map, mode and difficulty, and checks
that the results come out identical every time. As of v82 it makes **over 2,300
individual checks** in its first segment alone, and over 4,500 across all five.

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

The game is at **version 86**.

**Roadmap 1 (v79–v82) — complete.** Every exclusive unit and building that
existed then got one passive and one toggleable ability: Green at v79, Tan at
v80, Gray at v81, Blue at v82.

**Roadmap 2 (v85–v88) — in progress.** Every army gets two exclusive buildings,
an exclusive unit out of the Barracks, the Garage *and* the Helipad, and a Radio
Tower call-in of its own. **Blue landed at v85 and Green at v86**; Tan is v87 and
Gray v88. The specification for both outstanding armies is already written down
and settled — see *Roadmap 2: the remaining three armies* in
[`harness/README.md`](harness/README.md).

The full version-by-version record, including what was tried and rejected and
why, is in [`harness/README.md`](harness/README.md). If you are picking this
project up fresh, start with [`CLAUDE.md`](CLAUDE.md).

## Credits

All code, artwork and design in this repository are original work. *Army Men RTS*
(2002) was published by 3DO / Global Star Software; this project is an
independent tribute and contains no assets from it.
