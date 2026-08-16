'use strict';
/* v80 AI POLICY PROBE - is Pressure Valve worth opening, and when is it not?

   The valve is the only one of the three Tan abilities where a bot can hurt
   ITSELF by using it: VALVE_BACK of everything the flamer deals comes back on
   him. A rule has to know two things before it is worth writing - how much more
   the squad kills with it open, and how often the flamer dies doing it. Both
   arms run the same arena, same seed, same fixed enemy; only the toggle moves.

   Prepended with tail_v44.js for arena44(). Read-only instrumentation. */

const DTV = 1 / 30;
const SECS = +(process.env.SECS || 20);
const OUT = [];

function arm(label, opts) {
  G = null;
  newGame(cfg44('kitchen', 'dm', 'normal', 'tan', 1, 9200));
  for (const mn of (G.map.mines || [])) mn.live = false;
  for (const ns of (G.map.nests || [])) { ns.dead = true; ns.alive = 0; ns.aggro = false; }
  const A = arena44(10, 8, 6, 12);
  if (!A) return OUT.push({ arm: label, err: 'no arena' });
  const foe = G.players.find(p => p !== G.human && p.fac !== 'bug');

  const hoses = [];
  for (let i = 0; i < opts.n; i++) {
    const u = makeUnit('flamer', G.human, A.x + 2 + (i % 3) * 0.5, A.y + 3 + Math.floor(i / 3) * 0.5);
    if (opts.valve) u.valve = true;
    hoses.push(u);
  }
  const foes = [];
  for (let i = 0; i < opts.m; i++) {
    foes.push(makeUnit(opts.foe, foe, A.x + 4.2 + (i % 4) * 0.5, A.y + 3 + Math.floor(i / 4) * 0.5));
  }
  const foeHp0 = foes.reduce((s, f) => s + f.hp, 0);
  const ourHp0 = hoses.reduce((s, f) => s + f.hp, 0);

  for (let i = 0; i < SECS * 30; i++) {
    for (const u of hoses) if (u.hp > 0 && (!u.target || u.target.hp <= 0)) { const e = nearestEnemy(u, 8); if (e) { u.target = e; u.state = 'attack'; } }
    update(DTV);
  }
  const foeAlive = foes.filter(f => f.hp > 0);
  const ourAlive = hoses.filter(f => f.hp > 0);
  OUT.push({
    arm: label,
    foeKilled: opts.m - foeAlive.length,
    foeHpRemoved: +(foeHp0 - foeAlive.reduce((s, f) => s + f.hp, 0)).toFixed(0),
    ourLost: opts.n - ourAlive.length,
    ourHpLost: +(ourHp0 - ourAlive.reduce((s, f) => s + f.hp, 0)).toFixed(0)
  });
}

/* The first pass used saturated fixtures - the flamers killed everything in both
   arms, so the damage bonus was pure overkill and only the recoil showed up. These
   ratios put OUTPUT on the critical path: if killing faster means taking less fire
   back, the valve should pay for itself somewhere in here. */
for (const c of [[3, 8, 'grunt'], [4, 12, 'grunt'], [6, 18, 'grunt'], [3, 5, 'gunner'], [4, 8, 'gunner'], [5, 5, 'bazooka']]) {
  arm(c[0] + ' flamers vs ' + c[1] + ' ' + c[2] + ' - valve OFF', { n: c[0], m: c[1], foe: c[2], valve: false });
  arm(c[0] + ' flamers vs ' + c[1] + ' ' + c[2] + ' - valve ON ', { n: c[0], m: c[1], foe: c[2], valve: true });
}

console.log(JSON.stringify({ secs: SECS, arms: OUT }, null, 1));
