'use strict';
/* v81 SCOPING PROBE 3 - constants for Called Shot, Shell Shock, Ripple Fire and
   Lockdown, measured rather than reasoned.

   Every arm runs the same arena on the same seed and moves exactly one thing.
   Emulation notes:
     - Called Shot: +30% is applied as a u.dm scale (dmgBonus is the real door,
       but the measured quantity is identical); the infantry-only restriction is
       emulated by refusing non-infantry targets at acquisition.
     - Ripple Fire: U.arty's salvo/reload/splash cells are moved for the arm and
       restored after it, and fireAt is called with a jittered synthetic aim
       point so the three rockets land across a box. Jitter draws from srand(),
       never Math.random().
     - Shell Shock: applyDmg is wrapped to add the reload setback on survivors
       of an arty hit, which is where the real one would sit.
   Prepend: preamble.js + tail_v44.js (arena44/cfg44). */

const DTP = 1 / 30;
const SEC = s => Math.round(s * 30);
const OUT = { calledShot: [], shellShock: [], ripple: [], lockdown: [] };
const R2 = n => +n.toFixed(1);
const RIPD = +(process.env.RIPD || 1 / 3);   // per-rocket share of the base shell

function setup(seed, w, h) {
  G = null;
  newGame(cfg44('kitchen', 'dm', 'normal', 'gray', 1, seed || 8131));
  for (const mn of (G.map.mines || [])) mn.live = false;
  for (const ns of (G.map.nests || [])) { ns.dead = true; ns.alive = 0; ns.aggro = false; }
  const A = arena44(w || 16, h || 12, 6, 12);
  return A ? { A, foe: G.players.find(p => p !== G.human && p.fac !== 'bug') } : null;
}

/* ---------------- A: CALLED SHOT ---------------- */
function calledShot(label, mix, on) {
  const S = setup(8131); if (!S) return;
  const { A, foe } = S;
  const sn = [];
  for (let i = 0; i < 3; i++) {
    const u = makeUnit('sniper', G.human, A.x + 2 + i * 0.6, A.y + 5);
    if (on) u.dm *= 1.30;
    sn.push(u);
  }
  const fo = [];
  mix.forEach((k, i) => fo.push(makeUnit(k, foe, A.x + 8 + (i % 4) * 0.7, A.y + 4 + Math.floor(i / 4) * 0.7)));
  for (const f of fo) orderMove(f, A.x + 2, A.y + 5, true);
  for (let i = 0; i < SEC(25); i++) {
    for (const u of sn) {
      if (u.hp <= 0) continue;
      if (u.target && u.target.hp > 0 && (!on || armorOf(u.target) === 'inf')) continue;
      let best = null, bd = rgOf(u) ** 2;
      for (const e of G.units) {
        if (allied(e.p, u.p) || e.garrisoned || e.hp <= 0) continue;
        if (on && armorOf(e) !== 'inf') continue;
        const d = (e.x - u.x) ** 2 + (e.y - u.y) ** 2; if (d < bd) { bd = d; best = e; }
      }
      u.target = best; u.state = best ? 'attack' : 'idle';
    }
    update(DTP);
  }
  OUT.calledShot.push({
    arm: label, calledShot: !!on,
    infKilled: fo.filter(f => f.hp <= 0 && armorOf(f) === 'inf').length,
    otherKilled: fo.filter(f => f.hp <= 0 && armorOf(f) !== 'inf').length,
    foeHpLeft: R2(fo.reduce((s, f) => s + Math.max(0, f.hp), 0)),
    snipersLost: sn.filter(u => u.hp <= 0).length
  });
}

/* ---------------- B: SHELL SHOCK ----------------
   v81 rerun. The first cut wrote tgt.cool = max(cool, add), which is inert by
   construction: a grunt's whole reload is 0.8s, so a floor at 0.5s can never
   sit above what he already has on the clock. The quantity measured is now the
   SHOTS the shelled squad actually got off, not damage into a 40000 HP wall,
   and both shapes are on the table: additive on top of the current clock, and
   a floor. */
function shellShock(add, shape) {
  const S = setup(8132, 20, 14); if (!S) return;
  const { A, foe } = S;
  const bar = makeBuilding('barracks', G.human, Math.floor(A.x + 3), Math.floor(A.y + 8)); bar.prog = 1; bar.hp = bar.mhp = 40000;
  /* the shelled squad has to SURVIVE for suppression to be the thing measured -
     the first rerun killed all eight inside two seconds and every arm then read
     16 shots, which is lethality, not Shell Shock. HP is inflated 20x purely so
     the clock, not the body count, is what moves. */
  const guns = [];
  for (let i = 0; i < 6; i++) { const g = makeUnit('gunner', foe, A.x + 4 + (i % 3) * 0.7, A.y + 5 + Math.floor(i / 3) * 0.7); g.hp = g.mhp = g.mhp * 20; guns.push(g); }
  const arty = [];
  for (let i = 0; i < 2; i++) { const u = makeUnit('arty', G.human, A.x + 14, A.y + 5 + i * 0.8); u.hold = true; arty.push(u); }
  let shocked = 0, shots = 0;
  const _ad = applyDmg, _fa = fireAt;
  applyDmg = function (tgt, amt, type, attacker, wc) {
    const r = _ad(tgt, amt, type, attacker, wc);
    if (add > 0 && attacker && attacker.kind === 'unit' && attacker.key === 'arty' &&
      tgt && tgt.kind === 'unit' && tgt.hp > 0 && !tgt.garrisoned) {
      tgt.cool = shape === 'add' ? tgt.cool + add : Math.max(tgt.cool, add);
      shocked++;
    }
    return r;
  };
  fireAt = function (u, tgt) { if (u && u.p === foe) shots++; return _fa(u, tgt); };
  let dealt = 0;
  try {
    const hp0 = bar.hp;
    for (let i = 0; i < SEC(30); i++) {
      for (const u of arty) if (u.hp > 0 && (!u.target || u.target.hp <= 0)) { const e = nearestEnemy(u, rgOf(u)); if (e) { u.target = e; u.state = 'attack'; } }
      for (const g of guns) if (g.hp > 0 && (!g.target || g.target.hp <= 0)) orderAttack(g, bar);
      update(DTP);
    }
    dealt = hp0 - bar.hp;
  } finally { applyDmg = _ad; fireAt = _fa; }
  OUT.shellShock.push({
    setbackSecs: add, shape: add > 0 ? shape : 'none', gruntsAlive: guns.filter(g => g.hp > 0).length,
    shotsTheSquadGotOff: shots, damageIntoTheBarracks: R2(dealt), shockApplications: shocked
  });
}

/* ---------------- C: RIPPLE FIRE ---------------- */
function ripple(label, mode, foeSpread, vsBld, rtMul) {
  const S = setup(8133, 20, 14); if (!S) return;
  const { A, foe } = S;
  const keep = { rt: U.arty.rt, spl: U.arty.spl, sal: U.arty.sal, srt: U.arty.srt };
  if (mode === 'ripple') { U.arty.rt = keep.rt * rtMul; U.arty.spl = keep.spl * 1.6; U.arty.sal = 3; U.arty.srt = 0.35; }
  const _fa = fireAt;
  if (mode === 'ripple') fireAt = function (u, tgt) {
    if (u.key === 'arty' && tgt) {
      const jx = (srand() - 0.5) * 3.2, jy = (srand() - 0.5) * 3.2;
      return _fa(u, { x: tgt.x + jx, y: tgt.y + jy, id: tgt.id || 0, kind: tgt.kind, hp: tgt.hp, t: tgt.t, p: tgt.p });
    }
    return _fa(u, tgt);
  };
  let out;
  try {
    const arty = [];
    for (let i = 0; i < 2; i++) { const u = makeUnit('arty', G.human, A.x + 11, A.y + 5 + i * 0.9); u.hold = true; if (mode === 'ripple') u.dm = u.dm * RIPD; arty.push(u); }
    let tgtBld = null; const fo = [];
    if (vsBld) { tgtBld = makeBuilding('barracks', foe, Math.floor(A.x + 4), Math.floor(A.y + 4)); tgtBld.prog = 1; tgtBld.hp = tgtBld.mhp = 40000; }
    /* HP inflated 20x for the same reason the Shell Shock fixture does it: at
       stock HP both arms wipe the squad and the reading saturates at the squad's
       own pool instead of at what the salvo delivers. */
    else for (let i = 0; i < 8; i++) { const g = makeUnit('grunt', foe, A.x + 4 + (i % 4) * foeSpread, A.y + 4 + Math.floor(i / 4) * foeSpread); g.hp = g.mhp = g.mhp * 20; fo.push(g); }
    const hp0 = vsBld ? tgtBld.hp : fo.reduce((s, f) => s + f.hp, 0);
    for (let i = 0; i < SEC(30); i++) {
      for (const u of arty) if (u.hp > 0 && (!u.target || u.target.hp <= 0)) { u.target = vsBld ? tgtBld : (fo.find(f => f.hp > 0) || null); u.state = u.target ? 'attack' : 'idle'; }
      update(DTP);
    }
    const hp1 = vsBld ? tgtBld.hp : fo.reduce((s, f) => s + Math.max(0, f.hp), 0);
    out = { arm: label, mode, rtMul: mode === 'ripple' ? rtMul : 1, damageIn30s: R2(hp0 - hp1), killed: vsBld ? 0 : fo.filter(f => f.hp <= 0).length };
  } finally { fireAt = _fa; U.arty.rt = keep.rt; U.arty.spl = keep.spl; if (keep.sal === undefined) { delete U.arty.sal; delete U.arty.srt; } else { U.arty.sal = keep.sal; U.arty.srt = keep.srt; } }
  OUT.ripple.push(out);
}

/* ---------------- D: LOCKDOWN ---------------- */
function lockdown(label, red, secs, heavy) {
  const S = setup(8134, 20, 14); if (!S) return;
  const { A, foe } = S;
  const bk = makeBuilding('bunker', G.human, Math.floor(A.x + 4), Math.floor(A.y + 6)); bk.prog = 1; bk.hp = bk.mhp;  // a fresh building starts at construction HP; prog alone does not fill it, and the first cut died at 0.5s because of it
  for (let i = 0; i < 4; i++) { const g = makeUnit('grunt', G.human, bk.x, bk.y); g.garrisoned = true; bk.garrison.push(g); }
  /* two fixtures, because they answer different questions: the light attack is
     one the bunker WINS (does locking down cost more DPS than it saves?) and the
     heavy one is an attack it loses (does locking down buy survival time?). */
  const nb = heavy ? 10 : 4, ng = heavy ? 8 : 4;
  const att = [];
  for (let i = 0; i < nb; i++) att.push(makeUnit('bazooka', foe, A.x + 10 + (i % 2) * 0.8, A.y + 3 + i * 0.7));
  for (let i = 0; i < ng; i++) att.push(makeUnit('grunt', foe, A.x + 11 + (i % 2) * 0.8, A.y + 7 + i * 0.7));
  const _ad = applyDmg;
  let lockT = red > 0 ? secs : 0;
  applyDmg = function (tgt, amt, type, attacker, wc) {
    if (tgt === bk && lockT > 0) amt *= (1 - red);
    return _ad(tgt, amt, type, attacker, wc);
  };
  let died = -1;
  try {
    for (const a of att) orderAttack(a, bk);
    for (let i = 0; i < SEC(45); i++) {
      if (lockT > 0) { lockT -= DTP; bk.target = null; bk.cool = Math.max(bk.cool, 0.05); }
      for (const a of att) if (a.hp > 0 && (!a.target || a.target.hp <= 0)) orderAttack(a, bk);
      update(DTP);
      if (bk.hp <= 0 && died < 0) { died = i / 30; break; }
    }
  } finally { applyDmg = _ad; }
  OUT.lockdown.push({
    arm: label + (heavy ? ' [heavy attack]' : ' [light attack]'), reduction: red, lockSecs: red > 0 ? secs : 0,
    bunkerDiedAtSec: died < 0 ? null : R2(died), bunkerHpLeft: R2(Math.max(0, bk.hp)),
    attackersKilled: att.filter(a => a.hp <= 0).length
  });
}

const ONLY = process.env.ONLY || 'acbd';
if (ONLY.includes('a')) {
  for (const on of [false, true]) {
    calledShot('3 snipers vs 6 grunts', ['grunt', 'grunt', 'grunt', 'grunt', 'grunt', 'grunt'], on);
    calledShot('3 snipers vs 4 grunts + 2 jeeps', ['grunt', 'grunt', 'jeep', 'grunt', 'grunt', 'jeep'], on);
  }
}
if (ONLY.includes('b')) { shellShock(0, 'none'); for (const sh of ['max', 'add']) for (const add of [0.5, 1.0, 1.5, 2.25]) shellShock(add, sh); }
if (ONLY.includes('c')) {
  for (const vsB of [false, true]) for (const sp of [0.7, 2.4]) {
    if (vsB && sp === 2.4) continue;
    ripple((vsB ? 'vs barracks' : 'vs 8 grunts spread ' + sp), 'normal', sp, vsB, 1);
    for (const m of (process.env.RTS?process.env.RTS.split(',').map(Number):[1.0, 1.2, 1.4])) ripple((vsB ? 'vs barracks' : 'vs 8 grunts spread ' + sp), 'ripple', sp, vsB, m);
  }
}
if (ONLY.includes('d')) {
  for (const hv of [false, true]) {
    lockdown('no lockdown', 0, 0, hv);
    for (const r of [0.5, 0.65, 0.8]) lockdown('lockdown ' + Math.round(r * 100) + '%', r, 10, hv);
  }
}
console.log(JSON.stringify(OUT, null, 1));
