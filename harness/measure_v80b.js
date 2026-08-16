'use strict';
/* v80 SCOPING PROBE B - a controlled read of what row 'b' is worth against a Bull.

   Prepended with tail_v44.js for arena44(). One Bull, parked and unable to shoot
   back (hp topped up is NOT used - the Bull is simply given no target by putting
   the shooters out of its reach where possible, and its own damage is irrelevant
   because we measure the Bull's HP only). For each source we field a fixed count,
   let them shoot for T seconds, and report HP removed.

   The point of the probe: row 'b' is not only the eight units that carry w:'b'.
   WC_BLD maps guardtower AND bunker to 'b' as well, so a full negation also
   zeroes both static defences against a Bull. The tower and bunker arms below
   are the ones that matter for the decision. */

const DT80 = 1 / 30;
const SECS = +(process.env.SECS || 12);
const OUT = [];

function bullArena(seed) {
  G = null;
  newGame(cfg44('kitchen','dm','normal','tan',1,seed));
  for (const mn of (G.map.mines || [])) mn.live = false;
  for (const ns of (G.map.nests || [])) { ns.dead = true; ns.alive = 0; ns.aggro = false; }
  for (const b of G.blds.slice()) if (b.key === 'nest') { b.hp = 0; }
  G.neutrals = [];
  const A = arena44(10, 8, 6, 12);
  return A;
}

/* one arm: `n` copies of `key` (a unit) or one building `bkey`, shooting a Bull */
function arm(label, opts) {
  const A = bullArena(9100);
  if (!A) return OUT.push({ arm: label, err: 'no arena' });
  const foe = G.players.find(p => p !== G.human && p.fac !== 'bug');
  const bull = makeUnit('bulltank', G.human, A.x + 6, A.y + 4);
  bull.hold = true;
  const shooters = [];
  if (opts.key) {
    for (let i = 0; i < opts.n; i++) {
      const s = makeUnit(opts.key, foe, A.x + 3.4 + (i % 4) * 0.6, A.y + 3 + Math.floor(i / 4) * 0.6);
      shooters.push(s);
    }
  } else if (opts.bkey) {
    const b = makeBuilding(opts.bkey, foe, Math.floor(A.x + 2), Math.floor(A.y + 3), true);
    if (b) {
      b.prog = 1;
      if (opts.gar) { for (let i = 0; i < opts.gar; i++) { const g = makeUnit('grunt', foe, b.x, b.y); g.garrisoned = true; b.garrison.push(g); } }
      shooters.push(b);
    }
  }
  const hp0 = bull.hp;
  for (let i = 0; i < SECS * 30 && bull.hp > 0; i++) {
    for (const s of shooters) { if (s.kind === 'unit' && s.hp > 0) { s.hold = true; s.target = bull; s.state = 'attack'; } }
    /* the Bull must not shoot back: a returning cannon shell kills a jeep or a
       bike inside two seconds and the arm then reads 0 through survivorship, not
       through immunity. Both weapons are held down every tick rather than edited
       on the shared type row, which is global. */
    bull.cool = 99; bull.cool2 = 99; bull.target = null; bull.target2 = null;
    bull.hp = Math.min(bull.hp, hp0);
    update(DT80);
  }
  const lost = hp0 - Math.max(0, bull.hp);
  OUT.push({ arm: label, hp0: +hp0.toFixed(0), lost: +lost.toFixed(1), dps: +(lost / SECS).toFixed(2), ttk: lost > 0 ? +(hp0 / (lost / SECS)).toFixed(1) : null });
}

arm('4 grunts', { key: 'grunt', n: 4 });
arm('4 gunners', { key: 'gunner', n: 4 });
arm('2 jeeps', { key: 'jeep', n: 2 });
arm('2 Hueys', { key: 'heli', n: 2 });
arm('1 sniper', { key: 'sniper', n: 1 });
arm('1 Sarge', { key: 'sarge', n: 1 });
arm('2 bikes', { key: 'bike', n: 2 });
arm('1 guard tower', { bkey: 'guardtower' });
arm('1 bunker, 4 grunts', { bkey: 'bunker', gar: 4 });
arm('2 bazookas (row r, control)', { key: 'bazooka', n: 2 });
arm('1 tank (row s, control)', { key: 'tank', n: 1 });

console.log(JSON.stringify({ secs: SECS, arms: OUT }, null, 1));
