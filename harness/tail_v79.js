'use strict';
/* ===================== v79 =====================
   T53 covers the v79 release, phase 1 of the per-faction ability roadmap:
   every Green exclusive gains one passive and one player toggle.

     A  Sarge, Combat Veteran: regen after calm, and NOT during a fight
     B  Sarge, "On Me!": the radius, the stacking rule, and the price he pays
     C  Mortar, Walking Fire: the ramp, the cap, and the reset
     D  Mortar, Smoke Rounds: the cloud, who it protects, and who it shoots
     E  Radar Tent, Target Uplink: range, vision, duration, cooldown
     F  the new state round-trips, and the toggles are deterministic
     G  the AI actually uses what it was given
     H  derivation: no ability number is written down twice

   WHY THIS TAIL CARRIES THE WEIGHT OF THE RELEASE. The pinned trail tables
   prove almost nothing about v79: recut_v79 measured that no pinned fixture
   anywhere fields a Sarge or a Radar Tent, none ever runs a toggle, and only
   one of the nineteen diverges in the sim at all. Eighteen moved purely because
   hashState widened. Everything that this release actually DOES is tested here
   or it is not tested. */
section('T53 v79: Green abilities (Sarge, Mortar Squad, Radar Tent)');

const DT79 = 1 / 30;
function cfg79(map, mode, seed, opp) { return { map, mode, diff: 'normal', fac: 'green', opp: (opp == null ? 3 : opp), seed }; }
let HTML79 = null;
try { HTML79 = require('fs').readFileSync('pw.html', 'utf8'); } catch (e) { HTML79 = null; }

/* Drop a unit onto the field without going through production. Used everywhere
   below: these are mechanics tests, not economy tests. */
function drop79(u) {
  const i = G.units.indexOf(u); if (i >= 0) G.units.splice(i, 1);
  const j = u.p.units.indexOf(u); if (j >= 0) u.p.units.splice(j, 1);
}
function put79(key, p, x, y) { const u = makeUnit(key, p, x, y); u.hold = true; return u; }
/* Empty the board of anything that could fight back. Without this the passives
   below are measured against noise: a starting Sarge walks into the wildlife,
   kills a roach, and vetRankUp GRANTS HP on a rank-up - which reads exactly like
   a regen that fired early. Every fixture that measures a passive rather than an
   engagement calls this first. */
function quiet79() {
  /* Kill the dens outright rather than sweeping their output. Clearing
     G.neutrals at the top of a tick is not enough on its own: updateNeutrals
     runs INSIDE the same update() and can spawn a roach that reaches a unit
     before the next sweep, which is how a "nothing should touch this unit"
     fixture still lost 10 HP at tick 14. A dead den spawns nothing at all. */
  for (const ns of (G.map.nests || [])) { ns.dead = true; ns.alive = 0; ns.aggro = false; }
  for (const b of G.blds.slice()) if (b.key === 'nest') b.hp = 0;
  G.neutrals = [];
  for (const q of G.players) {
    if (q === G.human) continue;
    for (const u of q.units.slice()) drop79(u);
  }
  for (const u of G.human.units.slice()) if (u.key === 'truck' || u.key === 'grunt') drop79(u);
}
/* Clearing the board once is not enough: the roach dens REGENERATE, so a
   fixture that runs for more than a few seconds has wildlife back on it inside
   the window. Sweeping at the top of every tick is the tail_v66 T45.H idiom and
   it is here for the same reason - it leaves the measured HP movable by exactly
   one thing, which is the passive under test. */
function run79(n) { for (let i = 0; i < n; i++) { G.neutrals = []; update(DT79); } }

/* ---------- A: Combat Veteran ---------- */
section('T53.A Sarge heals himself out of contact, and only out of contact');
{
  ok('T53.A the regen constants are the approved pair', SARGE_REGEN === 1.5 && SARGE_CALM === 8);
  ok('T53.A regen is slower than a Medic, so the Medic is not displaced', SARGE_REGEN < MEDIC_HEAL_RATE);
  ok('T53.A only Sarge carries t.regen',
    U.sarge.regen === 1 && Object.keys(U).filter(k => U[k].regen).length === 1);

  G = null; newGame(cfg79('backyard', 'dm', 790001, 1)); quiet79();
  const s = put79('sarge', G.human, 20.5, 20.5);
  s.hp = s.mhp * 0.5;
  const wounded = s.hp;

  /* inside the calm window nothing may happen yet */
  run79(Math.round((SARGE_CALM - 2) * 30));
  ok('T53.A no regen before the calm window elapses', s.hp === wounded);

  /* past it, he climbs at the stated rate. The rate is measured from a point
     where the window is ALREADY served: measuring across the boundary would
     average two seconds of nothing against two of regen and report half the
     true figure, which is what the first cut of this check did. */
  run79(120);
  ok('T53.A he heals once calm', s.hp > wounded);
  s.calmT = SARGE_CALM + 1;
  const t0 = s.hp;
  run79(120);   // 4 clean seconds, entirely inside the regen window
  const gained = s.hp - t0;
  ok(`T53.A ...at about SARGE_REGEN per second (${(gained / 4).toFixed(2)} vs ${SARGE_REGEN})`,
    Math.abs(gained / 4 - SARGE_REGEN) < 0.05);

  /* a single hit resets the clock, which is the whole point of the passive */
  applyDmg(s, 5, 'b', null);
  ok('T53.A taking a hit resets the calm timer', s.calmT === 0);
  const t1 = s.hp;
  run79(Math.round((SARGE_CALM - 1) * 30));
  ok('T53.A and he does not heal again until the window is served', s.hp === t1);

  /* never past full */
  s.hp = s.mhp; s.calmT = 999;
  run79(60);
  ok('T53.A regen never overshoots max HP', s.hp === s.mhp);

  /* non-vacuity: an ordinary grunt gets none of this. Given its OWN fixture
     rather than run on at the end of the one above - by that point the board has
     had twenty seconds of an AI opponent building and marching on it, and a
     mutation check that can be moved by anything except the mutation is worth
     nothing. */
  G = null; newGame(cfg79('backyard', 'dm', 790011, 1)); quiet79();
  const g = put79('grunt', G.human, 24.5, 24.5);
  g.hp = g.mhp * 0.5; const gw = g.hp; g.calmT = 999;
  run79(120);
  ok('T53.A MUTATION: a unit without t.regen never heals itself', g.hp === gw);
}

/* ---------- B: "On Me!" ---------- */
section('T53.B the broadcast: radius, stacking, and its price');
{
  ok('T53.B the aura constants are the approved set',
    SARGE_AURA === 0.30 && SARGE_AURA_R === 3 && SARGE_SELF === 0.5);

  G = null; newGame(cfg79('backyard', 'dm', 790002, 1)); quiet79();
  const s = put79('sarge', G.human, 20.5, 20.5);
  const near = put79('grunt', G.human, 21.5, 20.5);          // 1 tile: inside
  const far = put79('grunt', G.human, 20.5 + SARGE_AURA_R + 1, 20.5); // outside

  s.onMe = false;
  const nb = dmgBonus(near), fb = dmgBonus(far), sb = dmgBonus(s);
  s.onMe = true;
  const na = dmgBonus(near), fa = dmgBonus(far), sa = dmgBonus(s);

  ok(`T53.B an infantryman inside the radius gains exactly SARGE_AURA (${(na / nb).toFixed(4)})`,
    Math.abs(na / nb - (1 + SARGE_AURA)) < 1e-9);
  ok('T53.B one outside it gains nothing', fa === fb);
  ok(`T53.B Sarge himself pays SARGE_SELF (${(sa / sb).toFixed(4)})`,
    Math.abs(sa / sb - SARGE_SELF) < 1e-9);
  ok('T53.B ...and does not buff himself on top of it', Math.abs(sa - SARGE_SELF) < 1e-9);

  /* the radius is a hard edge measured from Sarge, not a soft falloff */
  const edge = put79('grunt', G.human, 20.5 + SARGE_AURA_R - 0.01, 20.5);
  const out = put79('grunt', G.human, 20.5 + SARGE_AURA_R + 0.01, 20.5);
  ok('T53.B the radius edge is exact', dmgBonus(edge) > 1 && dmgBonus(out) === 1);
  drop79(edge); drop79(out);

  /* vehicles are not infantry: the buff is infantry-only by decision */
  const jeep = put79('jeep', G.human, 21.0, 20.5);
  ok('T53.B a vehicle inside the radius gains nothing (infantry only)', dmgBonus(jeep) === 1);
  drop79(jeep);

  /* APPROVED TO STACK with the Chinook, which is why it is a second multiplier
     rather than another row in the first-carrier-wins transport loop. */
  const heli = makeUnit('chinook', G.human, 21.0, 20.5);
  const both = dmgBonus(near);
  s.onMe = false; const heliOnly = dmgBonus(near);
  s.onMe = true;
  ok('T53.B the Chinook aura alone lifts damage', heliOnly > nb);
  ok(`T53.B the two auras STACK, as decided (${(both / nb).toFixed(4)})`,
    Math.abs(both / nb - (1 + SARGE_AURA) * (1 + U.chinook.aura)) < 1e-9);
  drop79(heli);

  /* it does not stack with ITSELF: two Sarges are one buff */
  const s2 = put79('sarge', G.human, 20.0, 20.5); s2.onMe = true;
  ok('T53.B two broadcasting Sarges do not double up',
    Math.abs(dmgBonus(near) - na) < 1e-9);
  drop79(s2);

  /* an enemy in the radius gets nothing */
  const foe = G.players.find(p => p !== G.human);
  const ef = put79('grunt', foe, 21.0, 20.5);
  ok('T53.B an enemy inside the radius gains nothing', dmgBonus(ef) === 1);
  drop79(ef);

  /* the renderer's predicate agrees with the sim's, which is the only thing
     that stops the glow appearing on a unit that is not actually buffed */
  ok('T53.B the glow predicate matches the damage path', rallied(near) === true && rallied(far) === false);
  ok('T53.B ...and never lights up Sarge himself', rallied(s) === false);
  s.onMe = false;
  ok('T53.B the glow goes out when he stands down', rallied(near) === false);
}

/* ---------- C: Walking Fire ---------- */
section('T53.C consecutive shells on one target ramp, and reset');
{
  ok('T53.C the ramp constants are the approved pair',
    MORT_WF_STEP === 0.08 && MORT_WF_CAP === 0.24);
  ok('T53.C the cap is a whole number of steps', Math.abs(MORT_WF_CAP / MORT_WF_STEP - 3) < 1e-9);
  ok('T53.C only the mortar carries t.wf',
    U.mortar.wf === 1 && Object.keys(U).filter(k => U[k].wf).length === 1);

  G = null; newGame(cfg79('backyard', 'dm', 790003, 1)); quiet79();
  const foe = G.players.find(p => p !== G.human);
  const m = put79('mortar', G.human, 20.5, 20.5);
  const a = put79('grunt', foe, 25.5, 20.5);
  const b = put79('grunt', foe, 25.5, 22.5);

  /* fire four shells at one target and read the ramp off u.wf directly: the
     damage itself lands through a projectile, so the streak counter is the
     honest place to measure the passive. */
  const ramp = [];
  for (let i = 0; i < 4; i++) { m.cool = 0; fireAt(m, a); ramp.push(m.wf); }
  ok(`T53.C the streak counts up and stops at the cap (${ramp.join(',')})`,
    ramp[0] === 0 && ramp[1] === 1 && ramp[2] === 2 && ramp[3] === 3);
  m.cool = 0; fireAt(m, a);
  ok('T53.C and it does not climb past it', m.wf === 3);

  /* switching target spends the ramp rather than banking it */
  m.cool = 0; fireAt(m, b);
  ok('T53.C switching target resets the streak', m.wf === 0 && m.wfT === b.id);

  /* a unit WITHOUT t.wf never grows one */
  const g = put79('grunt', G.human, 21.5, 20.5);
  g.cool = 0; fireAt(g, a); g.cool = 0; fireAt(g, a);
  ok('T53.C MUTATION: a unit without t.wf never ramps', !g.wf);
  drop79(g);
}

/* ---------- D: Smoke Rounds ---------- */
section('T53.D the cloud protects your own and the tube shoots them');
{
  ok('T53.D the smoke constants are the approved set',
    SMOKE_R === 2 && SMOKE_T === 5 && SMOKE_RED === 0.20 && HURT_WINDOW === 2);
  ok('T53.D only the mortar carries t.smokeCap',
    U.mortar.smokeCap === 1 && Object.keys(U).filter(k => U[k].smokeCap).length === 1);

  G = null; newGame(cfg79('backyard', 'dm', 790004, 1)); quiet79();
  const foe = G.players.find(p => p !== G.human);
  const m = put79('mortar', G.human, 20.5, 20.5);

  /* raise a cloud by hand at a known point, exactly as a landed shell does */
  G.strikes.push({ kind: 'smoke', owner: m, pi: G.human.i, x: 30.5, y: 30.5, t: 0 });

  const mine = put79('grunt', G.human, 30.5, 30.5);
  const theirs = put79('grunt', foe, 30.5, 30.5);
  const outside = put79('grunt', G.human, 30.5 + SMOKE_R + 1, 30.5);

  const hitFor = (u) => { const h0 = u.hp; applyDmg(u, 20, 'b', null); const d = h0 - u.hp; u.hp = h0; return d; };
  const dMine = hitFor(mine), dTheirs = hitFor(theirs), dOut = hitFor(outside);

  ok(`T53.D a friendly unit under the cloud takes SMOKE_RED less (${dMine.toFixed(2)} vs ${dOut.toFixed(2)})`,
    Math.abs(dMine / dOut - (1 - SMOKE_RED)) < 1e-9);
  ok('T53.D an ENEMY standing in the same cloud is not protected', Math.abs(dTheirs - dOut) < 1e-9);

  /* buildings are excluded by decision */
  const hq = G.human.blds.find(b => b.key === 'hq');
  if (hq) {
    const ox = hq.x, oy = hq.y;
    G.strikes.push({ kind: 'smoke', owner: m, pi: G.human.i, x: ox, y: oy, t: 0 });
    const h0 = hq.hp; applyDmg(hq, 20, 'b', null); const dB = h0 - hq.hp; hq.hp = h0;
    G.strikes.pop();
    ok('T53.D a structure under a cloud is NOT protected (units only)', Math.abs(dB - 20 * targetDmgMul(null, hq)) < 1e-6);
  }

  /* clouds do not stack with each other */
  G.strikes.push({ kind: 'smoke', owner: m, pi: G.human.i, x: 30.5, y: 30.5, t: 0 });
  ok('T53.D two clouds on one spot do not stack', Math.abs(hitFor(mine) - dMine) < 1e-9);
  G.strikes.pop();

  /* ...but they DO stack with the APC shield: independent sources */
  const apc = makeUnit('apc', G.human, 30.5, 30.5);
  const shielded = hitFor(mine);
  ok(`T53.D smoke multiplies with the APC shield (${shielded.toFixed(2)})`,
    Math.abs(shielded / dOut - (1 - SMOKE_RED) * 0.75) < 1e-9);
  drop79(apc);

  /* the cloud expires on schedule */
  const before = G.strikes.filter(s => s.kind === 'smoke').length;
  run79(Math.round(SMOKE_T * 30) + 10);
  ok(`T53.D the cloud lifts after SMOKE_T (${before} -> ${G.strikes.filter(s => s.kind === 'smoke').length})`,
    before > 0 && G.strikes.filter(s => s.kind === 'smoke').length === 0);
  drop79(mine); drop79(theirs); drop79(outside);
}

section('T53.D2 a smoking tube shells friendlies and stops shooting the enemy');
{
  G = null; newGame(cfg79('backyard', 'dm', 790005, 1)); quiet79();
  const foe = G.players.find(p => p !== G.human);
  const m = put79('mortar', G.human, 20.5, 20.5);
  const enemy = put79('grunt', foe, 25.5, 20.5);
  const hurt = put79('grunt', G.human, 24.5, 20.5);
  const well = put79('grunt', G.human, 24.5, 22.5);

  /* with smoke OFF it takes the enemy */
  m.smoke = false; m.target = null; m.state = 'idle'; m.hold = false;
  for (let i = 0; i < 40; i++) update(DT79);
  ok('T53.D2 high explosive still acquires the enemy', m.target === enemy);

  /* with smoke ON it acquires nothing hostile at all */
  execCmd({ op: 'smoke', pi: G.human.i, a: { ids: [m.id], on: true } });
  ok('T53.D2 switching to smoke drops the enemy target', m.target === null);
  for (let i = 0; i < 60; i++) update(DT79);
  ok('T53.D2 and it never re-acquires one', m.target === null);

  /* it shells whichever friendly is under fire, and only one under fire */
  hurt.calmT = 0; well.calmT = 999;
  ok('T53.D2 it picks the friendly who is under fire', nearestHurtFriend(m) === hurt);
  hurt.calmT = 999;
  ok('T53.D2 ...and picks nobody when nobody is', nearestHurtFriend(m) === null);

  /* the minimum range still applies: it cannot smoke a man on top of it */
  const close = put79('grunt', G.human, 20.9, 20.5); close.calmT = 0;
  ok('T53.D2 a friendly inside the minimum range is not a target', nearestHurtFriend(m) !== close);
  drop79(close);

  /* a smoke shell carries no damage */
  hurt.calmT = 0; m.cool = 0;
  const nProj = G.projs.length;
  fireAt(m, hurt);
  const shell = G.projs[G.projs.length - 1];
  ok('T53.D2 the tube fired', G.projs.length === nProj + 1);
  ok('T53.D2 a smoke shell carries zero damage and zero splash',
    shell.smoke === 1 && shell.dm === 0 && shell.spl === 0);
  ok('T53.D2 ...and it does not bank a Walking Fire ramp', m.wf === 0);

  /* switching back is clean */
  execCmd({ op: 'smoke', pi: G.human.i, a: { ids: [m.id], on: false } });
  ok('T53.D2 switching back to HE drops the friendly target too', m.smoke === false && m.target === null);
}

/* ---------- E: Target Uplink ---------- */
section('T53.E the Radar Tent widens the whole army, briefly');
{
  ok('T53.E the uplink constants are the approved set',
    UPLINK_T === 20 && UPLINK_CD === 120 && UPLINK_RG === 1 && UPLINK_VI === 2);
  ok('T53.E only the Radar Tent carries t.uplink',
    B.radar.uplink === 1 && Object.keys(B).filter(k => B[k].uplink).length === 1);

  G = null; newGame(cfg79('backyard', 'dm', 790006, 1)); quiet79();
  const g = put79('grunt', G.human, 20.5, 20.5);
  ok('T53.E with no uplink the accessors return the table values',
    rgOf(g) === U.grunt.rg && viOf(g) === U.grunt.vi);

  const rad = makeBuilding('radar', G.human, 24, 24); rad.prog = 1;
  ok('T53.E an idle Radar Tent changes nothing', rgOf(g) === U.grunt.rg && upOn(G.human) === false);

  execCmd({ op: 'uplink', pi: G.human.i, a: { bid: rad.id } });
  ok('T53.E firing it starts the duration and the cooldown together',
    rad.upT === UPLINK_T && rad.abilityCool === UPLINK_CD);
  ok('T53.E every unit gains the range and the sight',
    rgOf(g) === U.grunt.rg + UPLINK_RG && viOf(g) === U.grunt.vi + UPLINK_VI);

  /* an unarmed hull must not be handed a weapon range */
  const tr = put79('truck', G.human, 21.5, 20.5);
  ok('T53.E a zero-range hull stays at zero', (U.truck.rg || 0) === 0 && rgOf(tr) === 0);
  drop79(tr);

  /* the enemy gains nothing */
  const foe = G.players.find(p => p !== G.human);
  const ef = put79('grunt', foe, 22.5, 20.5);
  ok('T53.E the enemy army is unaffected', rgOf(ef) === U.grunt.rg);
  drop79(ef);

  /* a second press while it is recharging is refused */
  const wasT = rad.upT;
  execCmd({ op: 'uplink', pi: G.human.i, a: { bid: rad.id } });
  ok('T53.E it cannot be re-fired on cooldown', rad.upT <= wasT);

  /* it expires */
  for (let i = 0; i < UPLINK_T * 30 + 15; i++) update(DT79);
  ok('T53.E the uplink runs out', rad.upT <= 0 && upOn(G.human) === false);
  ok('T53.E ...and the accessors fall back to the table', rgOf(g) === U.grunt.rg);
  ok('T53.E the cooldown is still running', rad.abilityCool > 0);

  /* an incomplete or dead tent grants nothing */
  rad.upT = UPLINK_T; rad.prog = 0.5;
  ok('T53.E an unfinished Radar Tent grants nothing', upOn(G.human) === false);
  rad.prog = 1; rad.hp = 0;
  ok('T53.E a destroyed Radar Tent grants nothing', upOn(G.human) === false);
}

/* ---------- F: the new state is real sim state ---------- */
section('T53.F the six new fields are hashed, serialized and deterministic');
{
  const hs = hashState.toString();
  for (const f of ['u.calmT', 'u.onMe', 'u.smoke', 'u.wf', 'u.wfT', 'b.upT'])
    ok('T53.F hashState reads ' + f, hs.indexOf(f) >= 0);

  G = null; newGame(cfg79('kitchen', 'dm', 790007, 2));
  const s = put79('sarge', G.human, 20.5, 20.5); s.onMe = true;
  const m = put79('mortar', G.human, 21.5, 20.5); m.smoke = true; m.wf = 2; m.wfT = 77;
  const rad = makeBuilding('radar', G.human, 24, 24); rad.prog = 1; rad.upT = 7.5;
  for (let i = 0; i < 30; i++) update(DT79);

  const upAtSave = rad.upT;   // ticked down by the 30 updates above, and ticks on after the save
  const h0 = hashState(), json = saveState();
  const cont = []; for (let i = 1; i <= 120; i++) { update(DT79); if (i % 40 === 0) cont.push(hashState()); }
  loadState(json);
  ok('T53.F save/load restores the same hash', hashState() === h0);
  const back = JSON.parse(json);
  const su = back.units.find(u => u.key === 'sarge'), mu = back.units.find(u => u.key === 'mortar');
  const rb = back.blds.find(b => b.key === 'radar');
  ok('T53.F the snapshot carries the toggles', su && su.onMe === true && mu && mu.smoke === true);
  ok('T53.F ...the Walking Fire streak', mu && mu.wf === 2 && mu.wfT === 77);
  ok('T53.F ...the calm timer', su && typeof su.calmT === 'number');
  /* compared against the value AT SAVE TIME, not the 7.5 it was seeded with and
     not the live one: upT ticks down in updateBld, so the sim has legitimately
     spent some of it before the save and more of it after. */
  ok('T53.F ...and the uplink duration', rb && Math.abs(rb.upT - upAtSave) < 1e-9 && upAtSave < 7.5);
  const cont2 = []; for (let i = 1; i <= 120; i++) { update(DT79); if (i % 40 === 0) cont2.push(hashState()); }
  ok('T53.F and it resumes on the identical trail', cont.length === 3 && cont.every((h, i) => h === cont2[i]));

  /* a pre-v79 save has none of these fields and must still load */
  const old = JSON.parse(json);
  for (const u of old.units) { delete u.calmT; delete u.onMe; delete u.smoke; delete u.wf; delete u.wfT; }
  for (const b of old.blds) delete b.upT;
  loadState(JSON.stringify(old));
  ok('T53.F a pre-v79 save loads with defaults',
    G.units.every(u => u.calmT === 0) && G.blds.every(b => b.upT === 0));
  let threw = false;
  try { for (let i = 0; i < 60; i++) update(DT79); } catch (e) { threw = true; }
  ok('T53.F ...and runs without throwing', !threw);

  /* two runs of one seed with the abilities live agree checkpoint for checkpoint */
  const trail79 = (seed) => {
    G = null; newGame(cfg79('backyard', 'dm', seed, 2));
    const a = put79('sarge', G.human, 20.5, 20.5); a.onMe = true; a.hold = false;
    const b = put79('mortar', G.human, 21.5, 20.5); b.smoke = true; b.hold = false;
    const r = makeBuilding('radar', G.human, 24, 24); r.prog = 1; r.upT = UPLINK_T;
    const t = []; for (let i = 1; i <= 600; i++) { update(DT79); if (i % 150 === 0) t.push(hashState()); }
    return t;
  };
  const x = trail79(790008), y = trail79(790008);
  ok('T53.F a run with every Green ability live is deterministic',
    x.length === 4 && x.every((h, i) => h === y[i]));
}

/* ---------- G: the bots use what they were given ---------- */
section('T53.G the AI runs the two abilities it was wired for');
{
  G = null; newGame(cfg79('backyard', 'dm', 790009, 1));
  const bot = G.players.find(p => p !== G.human && p.ai) || G.players[1];

  /* The bot's rule is DERIVED, not a headcount, so the test derives too: it
     broadcasts exactly when the DPS the radius gains beats the DPS Sarge gives
     up. Asserting "two grunts is enough" here would have re-enshrined the wrong
     reasoning the probe caught. */
  const s = makeUnit('sarge', bot, 30.5, 30.5);
  const lost = unitDPS(U.sarge) * (1 - SARGE_SELF);
  aiTick(bot);
  ok('T53.G a lone Sarge does not broadcast', s.onMe === false);

  /* just under the line: grunts gain 0.91 each against 7.20 given up */
  const perGrunt = unitDPS(U.grunt) * SARGE_AURA;
  const need = Math.floor(lost / perGrunt) + 1;
  ok(`T53.G the grunt break-even is well above two (${need} of them)`, need > 2);
  const mob = [];
  for (let i = 0; i < need - 1; i++) mob.push(makeUnit('grunt', bot, 30.5 + 0.1 * i, 30.6));
  aiTick(bot);
  ok(`T53.G one short of the break-even he stays quiet (${mob.length})`, s.onMe === false);
  mob.push(makeUnit('grunt', bot, 30.4, 30.6));
  aiTick(bot);
  ok(`T53.G at the break-even he broadcasts (${mob.length})`, s.onMe === true);

  /* and it is DPS, not bodies: two flamers clear the bar that eight grunts needed */
  for (const g of mob) { g.x = 60; g.y = 60; }
  aiTick(bot);
  ok('T53.G he stands down when they leave', s.onMe === false);
  /* the flamer break-even is 2.3, so it takes THREE of them - a break-even of
     2.3 is not "two are enough", which is the rounding this check got wrong on
     its first cut. Derived here rather than typed, for that exact reason. */
  const needF = Math.floor(lost / (unitDPS(U.flamer) * SARGE_AURA)) + 1;
  const fl = [];
  for (let i = 0; i < needF; i++) fl.push(makeUnit('flamer', bot, 30.6 - 0.1 * i, 30.5));
  aiTick(bot);
  ok(`T53.G ${needF} flamers clear the bar that took ${mob.length} grunts`,
    s.onMe === true && needF < mob.length);
  for (const f of fl) f.x = 60;

  /* the Radar fires when the army is under fire, not before */
  const rad = makeBuilding('radar', bot, 34, 34); rad.prog = 1;
  for (const u of bot.units) u.calmT = 999;
  aiTick(bot);
  ok('T53.G an unengaged bot does not spend the uplink', rad.upT <= 0);
  for (const u of bot.units.slice(0, 3)) u.calmT = 0;
  aiTick(bot);
  ok('T53.G a bot with three units under fire spends it', rad.upT > 0);

  /* smoke is deliberately NOT wired this release; the bot must not use it */
  const m = makeUnit('mortar', bot, 31.5, 31.5);
  for (let i = 0; i < 5; i++) aiTick(bot);
  ok('T53.G the bot does NOT use Smoke Rounds (deferred by decision)', m.smoke === false);
}

/* ---------- H: derivation ---------- */
section('T53.H no ability number is written down twice');
{
  if (!HTML79) { ok('T53.H pw.html is readable next to the harness', false); }
  else {
    /* the help slots exist and resolve, so the manual cannot drift */
    const SLOTS = ['sargeAura', 'sargeR', 'sargeSelf', 'sargeRegen', 'sargeCalm',
      'wfStep', 'wfCap', 'smokeR', 'smokeT', 'smokeRed', 'upT', 'upCd', 'upRg', 'upVi'];
    const missing = SLOTS.filter(k => !HELP_TUNE[k]);
    ok('T53.H every Green ability number has a help slot' + (missing.length ? ' [' + missing.join(',') + ']' : ''),
      missing.length === 0);
    const bad = SLOTS.filter(k => { const v = helpTuneValue(k); return v == null || v === '' || Number.isNaN(v); });
    ok('T53.H ...and every one of them resolves' + (bad.length ? ' [' + bad.join(',') + ']' : ''), bad.length === 0);
    const unwired = SLOTS.filter(k => HTML79.indexOf('data-tune="' + k + '"') < 0);
    ok('T53.H ...and is actually referenced by the markup' + (unwired.length ? ' [' + unwired.join(',') + ']' : ''),
      unwired.length === 0);

    /* the slots agree with the constants, which is the claim that matters */
    ok('T53.H the slots report the live constants',
      helpTuneValue('sargeAura') === Math.round(SARGE_AURA * 100) &&
      helpTuneValue('smokeRed') === Math.round(SMOKE_RED * 100) &&
      helpTuneValue('upCd') === UPLINK_CD && helpTuneValue('wfCap') === Math.round(MORT_WF_CAP * 100));

    /* the info-card descriptions are derived, not typed: moving a constant has
       to move the string. This is the v76/v77 lesson applied ahead of time. */
    const d0 = U.sarge.d;
    ok('T53.H the Sarge card quotes the live aura', d0.indexOf(String(Math.round(SARGE_AURA * 100)) + '%') >= 0);
    ok('T53.H the mortar card quotes the live smoke reduction',
      U.mortar.d.indexOf(String(Math.round(SMOKE_RED * 100)) + '%') >= 0);
    ok('T53.H the Radar card quotes the live duration',
      B.radar.d.indexOf(String(UPLINK_T) + 's') >= 0);

    /* the panel buttons read the constants too, rather than carrying a copy */
    /* v80: was a fixed 12000-char slice, which v80's five new ability buttons
       pushed the Sarge and mortar tokens straight out of. Bounded by the next
       function now, so the window is the WHOLE of refreshSelPanel and no more:
       still a real claim (the token must sit in the panel builder) and no
       longer a claim that quietly shrinks every time a button is added. */
    const _p0 = HTML79.indexOf('function refreshSelPanel');
    const _p1 = HTML79.indexOf('function unitCapCount', _p0);
    const panel = HTML79.slice(_p0, _p1 > _p0 ? _p1 : _p0 + 12000);
    for (const tok of ['SARGE_AURA', 'SARGE_AURA_R', 'SARGE_SELF', 'SMOKE_RED', 'SMOKE_R', 'SMOKE_T', 'UPLINK_RG', 'UPLINK_VI', 'UPLINK_T', 'UPLINK_CD'])
      ok('T53.H the panel derives ' + tok, panel.indexOf(tok) >= 0);

    /* MUTATION: the derivation checks must be able to fail */
    const keep = SARGE_AURA;
    ok('T53.H MUTATION: a hand-typed 30% would not track the constant',
      'gives +30% damage'.indexOf(String(Math.round(0.45 * 100)) + '%') < 0 && keep === 0.30);
  }
}
