# Plastic Warfare — bot-sim balance findings (24 matches, v88.1)

Handoff brief for a fresh Claude Code session continuing balance work.
Everything here is measured, reproducible, and comes with its caveats attached.

## Repo state

- Game version **v88.1**, roadmap 2 complete (every army has its full exclusive set)
- Suite green: `seg.sh all` **5,043 pass / 0 fail**, `verify_v58.py` 32/0, `triage.sh` clean
- **No game code was changed to produce any of this.** The matches were run against
  `plastic-warfare.html` at v88.1 as shipped; every commit involved touched `harness/` only.
  Check `git log --oneline -- plastic-warfare.html` to confirm the game has not moved since.
- Single branch (`main`). Working branches are auto-deleted on merge.

## How this was produced / how to reproduce

```sh
cd harness
./sim.sh 8                 # batch A, SEED0 defaults to 101
SEED0=2000 ./sim.sh 16     # batch B
```

`sim.sh` plays all-AI deathmatches using the game's own v55 spectate mode (`watch:true`),
which seats a CPU in every slot so all four factions field one army each. Behaviour
profiles are dealt by `newGame` itself, from a **seeded shuffle without replacement** —
four of the five profiles per match, never a repeat within a match. The seed is the only
control surface; every match re-runs identically from it.

Writes `sim_out/battle-report.html` plus `sim_out/game_N.json` per match (both git-ignored —
they regenerate from the seeds). Prints a summary table to stdout.

Roughly 30–70s per match; 16 matches ≈ 5 min on 4 cores. Only **4 deathmatch maps** exist
(`desk` is `survOnly`), so a batch spreads round-robin across backyard / kitchen /
livingroom / sandbox.

## THE HEADLINE — read this before any other number

**The doctrine draw is wildly uneven, and it dominates raw win counts. Ranking the
factions by wins is wrong.** Four profiles are dealt from five each match, so over 24
matches each army's hand drifts a lot — and here it drifted hard enough to invert the
apparent standings.

Doctrine strength across all 96 army-slots:

| doctrine | wins / draws | win rate |
|---|---|---|
| balanced | 9 / 17 | **52.9%** |
| aggressive | 8 / 17 | **47.1%** |
| harasser | 4 / 19 | 21.1% |
| turtle | 2 / 22 | 9.1% |
| defensive | 1 / 21 | **4.8%** |

So `aggressive` + `balanced` are the strong hands and `defensive` + `turtle` are near-dead.
Now look at who got dealt them:

| army | strong draws (of 24) | weak draws | actual wins | expected wins | **delta** | K/L |
|---|---|---|---|---|---|---|
| tan | 7 | 12 | 10 | 5.47 | **+4.53** | **1.51** |
| green | 4 | 11 | 5 | 4.58 | +0.42 | 0.79 |
| gray | 10 | 10 | 5 | 6.71 | −1.71 | 0.93 |
| blue | 13 | 10 | 4 | 7.24 | **−3.24** | **0.65** |

*Expected wins* = Σ over doctrines of (times that army drew it × that doctrine's win rate) —
what an average army would have won from that exact hand. The four expectations sum to
exactly 24.00, matching the 24 actual wins.

**What this changes:**

- **Tan is the strongest army**, and it is not close. +4.5 wins over its hand, best K/L at
  1.51, and it won on **all five doctrines** including `defensive` and `turtle`, which
  almost never win for anyone.
- **Blue is the weakest.** It drew the best hand of anyone (13 strong of 24) and still
  finished last. Most damning single cell: **Blue went 2/10 on `aggressive`**, while green
  went 3/3 and tan 2/2 on the same doctrine.
- **Green is roughly average, NOT weak.** It got the worst hand in the batch (only 4 strong
  draws; 20 of its 24 slots were weak-or-mid) and still landed on expectation. Green's ugly
  0.79 K/L is substantially a draw artifact, not an army property.

## Per-match results (all 24)

```
#   batch  seed   map               winner win doctrine     len  kills  end
1   A      101    Backyard Brawl    tan    harasser        8:55    551  elimination
2   A      202    Kitchen Counter   tan    balanced       12:12    782  elimination
3   A      303    Living Room       green  aggressive     11:05    609  elimination
4   A      404    Sandbox Standoff  green  balanced       11:03    752  elimination
5   A      505    Backyard Brawl    green  aggressive      7:46    473  elimination
6   A      606    Kitchen Counter   gray   balanced       14:52    894  elimination
7   A      707    Living Room       gray   aggressive     10:50    622  elimination
8   A      808    Sandbox Standoff  green  harasser        7:46    515  elimination
9   B      2000   Backyard Brawl    tan    balanced       11:17    726  elimination
10  B      2101   Kitchen Counter   blue   aggressive     19:07   1161  elimination
11  B      2202   Living Room       tan    harasser       10:55    688  elimination
12  B      2303   Sandbox Standoff  tan    harasser       13:00    886  elimination
13  B      2404   Backyard Brawl    blue   turtle         11:54    687  elimination
14  B      2505   Kitchen Counter   gray   balanced       20:00   1328  time
15  B      2606   Living Room       blue   aggressive     12:03    742  elimination
16  B      2707   Sandbox Standoff  gray   balanced       12:21    652  elimination
17  B      2808   Backyard Brawl    tan    aggressive     10:45    712  elimination
18  B      2909   Kitchen Counter   tan    turtle         17:31   1169  elimination
19  B      3010   Living Room       blue   balanced        9:44    598  elimination
20  B      3111   Sandbox Standoff  tan    defensive      17:59   1132  elimination
21  B      3212   Backyard Brawl    gray   balanced       11:22    674  elimination
22  B      3313   Kitchen Counter   green  aggressive     13:26    988  elimination
23  B      3414   Living Room       tan    balanced       11:35    721  elimination
24  B      3515   Sandbox Standoff  tan    aggressive     10:53    774  elimination
```

## Faction totals

Batch A and B are shown separately because **the gap between them is itself the finding** —
the same code, different seeds, opposite-looking standings.

```
-- BATCH A (8 matches, SEED0=101) --
army    wins  win%  kills   lost   K/L  units  blds   inf%   veh%  air%   aa%   elim
green      4    50   1834   1432  1.28   1516   216   60.0   31.1   6.3   2.6    4/8
tan        2    25   1449   1252  1.16   1223   154   63.3   31.6   4.3   0.8    6/8
gray       2    25   1298   1142  1.14   1105   181   74.2   21.5   2.9   1.4    6/8
blue       0     0    617   1569  0.39   1346   176   65.4   32.4   1.2   1.0    8/8

-- BATCH B (16 matches, SEED0=2000) --
army    wins  win%  kills   lost   K/L  units  blds   inf%   veh%  air%   aa%   elim
green      1     6   2155   3631  0.59   3299   366   65.9   31.1   2.1   0.9  15/16
tan        8    50   4923   2973  1.66   3174   427   62.8   31.1   4.8   1.4   8/16
gray       3    19   3468   4004  0.87   3706   423   70.6   26.1   2.3   1.0  13/16
blue       4    25   3092   4126  0.75   4043   420   64.6   30.6   3.9   0.9  12/16

-- COMBINED (24 matches, 96 army-slots) --
army    wins  win%  kills   lost   K/L  units  blds   inf%   veh%  air%   aa%   elim
green      5    21   3989   5063  0.79   4815   582   64.0   31.1   3.4   1.5  19/24
tan       10    42   6372   4225  1.51   4397   581   62.9   31.2   4.6   1.2  14/24
gray       5    21   4766   5146  0.93   4811   604   71.4   25.1   2.4   1.1  19/24
blue       4    17   3709   5695  0.65   5389   596   64.8   31.1   3.2   1.0  20/24

```

## Doctrine table (combined, with the profile knobs)

```
doctrine     drawn  wins  win%  k/match  l/match   K/L  u/match  aggro  1stPush  tilt   wantMix inf/veh/air
aggressive      17     8    47      241      215  1.12      228   1.25       42  cheap  68/26/6
balanced        17     9    53      302      206  1.47      216   1.00       70  heavy  50/33/17
defensive       21     1     5      159      224  0.71      199   0.70      120  heavy  38/50/12
harasser        19     4    21      172      193  0.89      184   0.95       85  fast   40/30/30
turtle          22     2     9      136      209  0.65      191   0.55      150  range  60/32/8
```

`aggro`, `1stPush` (in AI-ticks), `tilt` and `wantMix` are read off `AI_PROFILES` in the game source.
Note the shape: **win rate tracks aggression almost monotonically** — 1.25 aggro → 47%, 1.00 → 53%,
0.95 → 21%, 0.70 → 5%, 0.55 → 9%. The two slowest openers (`defensive` firstPush 120, `turtle` 150)
are the two that lose. A four-way FFA punishes turtling hard; a bot that has not pushed by the
time two neighbours have traded is simply behind on map.

## Faction x doctrine win matrix (wins/draws)

```
army      aggres   balanc   defens   harass   turtle
green        3/3      1/1      0/6      1/9      0/5
tan          2/2      3/5      1/6      3/5      1/6
gray         1/2      4/8      0/5      0/4      0/5
blue        2/10      1/3      0/4      0/1      1/6
```

Cells are small (green 3/3 on aggressive is n=3). Treat as directional.

## Doctrine draws by faction (the confound, raw)

```
army     aggres  balanc  defens  harass  turtle  total
green         3       1       6       9       5     24
tan           2       5       6       5       6     24
gray          2       8       5       4       5     24
blue         10       3       4       1       6     24
```

## Wins by map

```
map                 green    tan   gray   blue    n  meanLen
Backyard Brawl          1      3      1      1    6    10:20
Kitchen Counter         1      2      2      1    6    16:11
Living Room             1      2      1      2    6    11:02
Sandbox Standoff        2      3      1      0    6    12:10
```

No map looks broken. Kitchen Counter runs much longer (16:11 mean vs ~10-12 elsewhere) and is
where the single time-cap match landed.

## Unit production (combined 24)

```
unit                  cls    cost  green    tan   gray   blue  total  exclusive-to
Grunt                 inf      36   1592    977   1804   1199   5572  
MG Jeep               veh     130    811    705    545    308   2369  
Dump Truck            veh      20    571    502    553    490   2116  
Grenadier             inf      55    533    290    624    423   1870  
Signal Runner         inf      62      0      0      0   1127   1127  blue
Machine Gunner        inf     125    200    211    291    345   1047  
Flamethrower          inf     120      0    943      0      0    943  tan
Scout Bike            veh      90      0      0      0    746    746  blue
Paratrooper           inf       -     50    195    165    230    640  
Mortar Squad          inf     150    564      0      0      0    564  green
Bazooka Man           inf      90    121    150     98    167    536  
Sniper                inf     170      0      0    453      0    453  gray
Huey                  air     200    110    108     71    114    403  
Medic Truck           veh     150     43     66     53     78    240  
AA Missile Truck      aa      180     70     54     53     52    229  
Tank                  veh     220     42     54     26     37    159  
Apache                air     300     39     31     19     50    139  
Firebomb Heli         air     280      0     64      0      0     64  tan
APC                   veh     260      9     18     13     15     55  
"Bull" Heavy Tank     veh     391      0     29      0      0     29  tan
Choktaw Heli          air     330      0      0     27      0     27  gray
Sarge                 inf     260     24      0      0      0     24  green
Command Truck         veh     145     22      0      0      0     22  green
Rocket Artillery      veh     320      0      0     16      0     16  gray
Observation Balloon   air     250     14      0      0      0     14  green
Chinook               air     300      0      0      0      8      8  blue
```

## Structure production (combined 24)

```
structure               cost  green    tan   gray   blue  total  exclusive-to
Barricade                 20    107    110    115    112    444  
Outpost                  240     91     80     94     80    345  
Supply Depot             120     83     93     83     76    335  
Guard Tower              170     80     87     75     66    308  
Barracks                 160     45     43     44     42    174  
Generator                140     32     44     32     37    145  
Garage                   240     34     39     37     32    142  
Research Lab             260     25     24     24     25     98  
Helipad                  220     24     18     17     23     82  
Radio Tower               60     27     17     17     20     81  
Wind Turbine             110      0      0      0     69     69  blue
Bunker                   200      0      0     39      0     39  gray
Heavy Barricade           60      0      0     27      0     27  gray
Radar Tent               200     21      0      0      0     21  green
Munitions Dump           220      0     15      0      0     15  tan
Forward Pad              230      0      0      0     14     14  blue
Command Post             250     13      0      0      0     13  green
Foundry                  260      0     11      0      0     11  tan
```

## Match length / end conditions

```
end reasons: {"elimination":23,"time":1}
length: min 7:46  mean 12:26  max 20:00  (DM_TIME cap 20:00)
```

## Faction modifiers (reference, read off `FAC`)

```
green  {"cost":0.92,"hp":1,"dmg":1,"speed":1}
       uu: sarge, mortar, cmdtruck, balloon
       ub: radar, cmdpost
tan    {"cost":1,"hp":1,"dmg":1.15,"speed":0.95}
       uu: flamer, bulltank, firebomb
       ub: dump, foundry
gray   {"cost":1,"hp":1.2,"dmg":0.95,"speed":0.92}
       uu: sniper, arty, choktaw
       ub: bunker, hbarricade
blue   {"cost":1,"hp":0.9,"dmg":1,"speed":1.15}
       uu: bike, chinook, runner
       ub: turbine, fwdpad
```

## Leads worth pulling, ranked

These are hypotheses with evidence, not conclusions. Each says what to check first.

**1. Blue underperforms its hand by ~3 wins, worst K/L (0.65), most units built (5,389).**
Blue produces the most and gets the least: 3,709 kills against 5,695 losses. Its roster
leans on two cheap exclusives — Signal Runner (1,127 built) and Scout Bike (746) — plus a
−10% HP modifier, so it trades constantly and badly. Look at whether the Blue exclusives
are priced for what they survive, and at the `-10% HP / +15% speed` trade generally. The
2/10 record on `aggressive` is the sharpest single symptom: the strongest doctrine in the
game barely works for Blue.

**2. Two of five doctrines are near-dead (`defensive` 4.8%, `turtle` 9.1%).**
That is 43 of 96 army-slots dealt a profile that wins under one time in ten. This is an AI
tuning question, not a faction one, and it is the single biggest source of noise in every
faction comparison — fixing it makes every future batch more informative. Start at
`AI_PROFILES` (`firstPush` 120/150 vs 42/70 for the winners) and `aiTick`'s expansion gate
(`expand:false` on both losing profiles).

**3. Nobody builds air; anti-air is near-zero.**
Across 96 armies: **air 3.4% of production, AA 1.2%**. Huey 403, Apache 139, and the four
exclusive helis total 99 across 24 matches. AA Missile Truck: 229. This is the standing
`T26.C` question showing up in play rather than in a test. Either air is overpriced for
what it does, or `aiPickUnit`'s dps-per-plastic score structurally under-rates it — check
the scoring before touching unit costs, because the bot may simply never be choosing air
regardless of price.

**4. Tan overperforms by +4.5 wins and leads K/L at 1.51.**
The `+15% damage / −5% speed` modifier plus the Flamethrower (943 built, 2nd-most-built
infantry in the game after Grunt) looks strong. Worth checking whether Tan is over-tuned
before nerfing anyone else — with four armies, one being too strong and three looking weak
is the same observation twice.

**5. Green is fine. Do not "fix" it.**
Its raw numbers look bad (5 wins, 0.79 K/L) purely because it drew 20 weak-or-mid hands out
of 24. Draw-adjusted it lands within half a win of expectation. An earlier read of a single
16-match batch called Green the weakest army; that was a draw artifact and it is wrong.

## Caveats — what this data cannot support

- **Do not rank factions on raw wins.** The draw dominates at this sample size. Use the
  draw-adjusted delta, or K/L, or run enough matches that draws even out.
- **The draw-adjusted numbers are an improvement, not a verdict.** Doctrine win rates are
  estimated from the same 96 slots they are then used to correct, and the faction × doctrine
  cells are tiny (n=1 to n=10).
- **Batch-to-batch swing is large and real.** Green took 4/8 in batch A and 1/16 in batch B.
  An earlier ad-hoc 8-match run (different map/seed pairing, same seeds) gave Green 6/8.
  Always re-run with a different `SEED0` before believing a direction.
- **`sim.sh` is a measurement tool, not a test.** Nothing it prints is pinned and it is not
  part of `seg.sh`. It cannot tell you whether you broke anything — `triage.sh` and
  `seg.sh` do that.
- **These are bots, not players.** Every finding is about how the AI plays v88.1. A unit the
  bot never builds may still be fine in human hands, and vice versa.

## If you change game code

Follow `CLAUDE.md` — the short version:

1. `cd harness && ./build.sh` before anything else (regenerates `game.js` AND `pw.html`).
2. `./triage.sh` (~25s) — did the simulation move, and which tails care?
3. If trails moved, the release needs a **recut and repin**, and the 42-pin layout gate must
   hold first. If layout pins move, stop: map generation changed.
4. `QUIET=1 ./seg.sh all` (~320s, 5,043 checks) plus `python3 verify_v58.py` (32 checks).
5. New sim state must be added to **both** `hashState()` and `loadState()`.
6. Never call `srand()` from a rendering or audio path; never use it in a sim function that
   should be `Math.random` (and vice versa).
7. Every number stated in the Field Manual must read off a constant (`HELP_TUNE` + `data-tune`).
8. Re-run `./sim.sh` after a balance change and compare against the tables above — but change
   **one thing at a time**, or the batch noise will swallow the signal.
