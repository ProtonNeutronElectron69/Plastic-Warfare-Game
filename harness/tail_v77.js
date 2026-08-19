'use strict';
/* ===================== v77 =====================
   T52 covers the v77 release:
     A  the Artillery Barrage at seven shells and half damage
     B  the Magnifying Glass removed WITHOUT residue
     C  the AI call-down cadence, named and measurably livelier
     D  the Desk survival centre ring, up 20 percent
     E  the seven audited defects, each pinned by its derivation
     F  the widened section-D lint: false claims that carry no number

   Section F is the point of the release. Every defect the v76 and v77 audits
   found was the same defect twice over: a fact written next to the constant it
   described, which then moved. v76 caught the numeric ones because a number is
   easy to compare. D1, D3, D4 and D6 carried no number at all - "researches
   every unit unlock", a dead field, a banner naming the wrong abilities - and
   sailed through. F is what makes those fail here instead of shipping. */
section('T52 v77: barrage x7, magnify removed, AI cadence, Desk economy, lint');

const DT77 = 1 / 30;
function cfg77(map, mode, seed, opp) { return { map, mode, diff: 'normal', fac: 'green', opp: (opp == null ? 3 : opp), seed }; }
let HTML77 = null;
try { HTML77 = require('fs').readFileSync('pw.html', 'utf8'); } catch (e) { HTML77 = null; }

/* ---------- A: the barrage at seven shells, half damage each ---------- */
section('T52.A the barrage walks seven half-weight shells');
{
  ok('T52.A the shipped v77 barrage numbers',
    BARRAGE_N === 7 && BARRAGE_DMG === 105 && BARRAGE_GAP === 2.0 &&
    BARRAGE_FLY === 1.6 && BARRAGE_R === 3 && BARRAGE_BOX === 10);
  ok('T52.A seven shells is more than the v76 three, at exactly half the weight',
    BARRAGE_N === 7 && BARRAGE_DMG * 2 === 210);
  /* both consequences were surfaced at scope and taken deliberately; pinning them
     means a later "fix" to either one has to be a decision, not a drift */
  ok('T52.A the walk runs the full 13.6s it was scoped to',
    Math.abs((BARRAGE_FLY + (BARRAGE_N - 1) * BARRAGE_GAP) - 13.6) < 1e-9);
  ok('T52.A total damage rose 630 -> 735, as disclosed',
    BARRAGE_N * BARRAGE_DMG === 735);

  G = null; newGame(cfg77('backyard', 'dm', 770101, 3));
  const p = G.players[0];
  const tw = makeBuilding('radiotower', p, Math.round(p.start.x + 4), Math.round(p.start.y + 4), true);

  /* the srand draw count is the determinism-critical number: three draws per
     shell, so the stream advances by exactly 3*N and by nothing else */
  let draws = 0; const _sr = srand;
  srand = function () { draws++; return _sr(); };
  radioBarrage(tw, 30, 30);
  srand = _sr;
  ok('T52.A firing consumes exactly three srand draws per shell', draws === 3 * BARRAGE_N);

  const s = G.strikes.find(z => z.kind === 'barrage');
  ok('T52.A it schedules BARRAGE_N shells', !!s && s.sh.length === BARRAGE_N);
  ok('T52.A one shell every BARRAGE_GAP after the arc',
    !!s && s.sh.every((z, i) => Math.abs(z.at - (BARRAGE_FLY + i * BARRAGE_GAP)) < 1e-9));
  ok('T52.A every impact stays inside the box',
    !!s && s.sh.every(z => Math.abs(z.x - s.cx) <= BARRAGE_BOX / 2 && Math.abs(z.y - s.cy) <= BARRAGE_BOX / 2));
  ok('T52.A no two shells share an impact point',
    !!s && new Set(s.sh.map(z => z.x + ':' + z.y)).size === BARRAGE_N);

  /* damage still runs weapon row q, at the new per-shell weight */
  const hit = (key, dist) => {
    const u = makeUnit(key, G.players[1], 30 + dist, 30);
    const b = u.hp; splash(30, 30, BARRAGE_R, BARRAGE_DMG, 'ex', tw, 'q'); const got = b - u.hp; u.hp = 0;
    return got;
  };
  ok('T52.A a direct hit on armor is one full half-weight shell',
    Math.abs(hit('tank', 0) - BARRAGE_DMG) < 1e-6);
  ok('T52.A infantry still take the row q shade',
    Math.abs(hit('grunt', 0) - BARRAGE_DMG * WVA.q.inf) < 1e-6);

  /* the panel copy is derived now, not typed */
  const bar = RADIO_ABILITIES.find(a => a.mode === 'barrage');
  ok('T52.A the panel copy counts the shells off the constant',
    bar.panel.indexOf(BARRAGE_N + ' heavy shells') === 0);
  ok('T52.A and the manual slot agrees with the sim',
    String(helpTuneValue('barrN')) === String(BARRAGE_N) &&
    String(helpTuneValue('barrDmg')) === String(BARRAGE_DMG));
}

/* ---------- B: the Magnifying Glass is gone, with no residue ---------- */
section('T52.B the Magnifying Glass removal left nothing behind');
{
  ok('T52.B the ability row is gone', !radioAbility('magnify'));
  // v85: three survivors plus Blue's Rapid Redeploy. The claim is the removal, so
  // it is stated as "magnify is absent from a table of N", not as a bare count.
  // v86: N is five - Green's Supply Drop is the second faction row.
  ok('T52.B and the roster is the three survivors, plus the two added since',
    RADIO_ABILITIES.length === 5 && !RADIO_ABILITIES.some(a => a.mode === 'magnify'));
  ok('T52.B radioMagnify is not a function any more', typeof radioMagnify === 'undefined');
  ok('T52.B its audio cue went with it', typeof sfxLaser === 'undefined');
  ok('T52.B the flame roster no longer names it',
    !wcRoster('f').includes('Magnifying Glass') && wcRoster('f').includes('Napalm Strike'));
  ok('T52.B the manual ability list no longer names it',
    !radioAbilityList().includes('Magnifying Glass') &&
    !String(helpTuneValue('radioList')).includes('Magnifying Glass'));

  /* the command path must treat it as an invented mode, not a silent no-op that
     still spends the charge */
  G = null; newGame(cfg77('backyard', 'dm', 770102, 3));
  const p = G.players[0];
  const tw = makeBuilding('radiotower', p, Math.round(p.start.x + 4), Math.round(p.start.y + 4), true);
  execCmd({ pi: p.i, op: 'radio', a: { bid: tw.id, mode: 'magnify', x: p.start.x, y: p.start.y } });
  ok('T52.B a magnify order now spends nothing and pushes no strike',
    tw.abilityCool === 0 && !G.strikes.length);

  /* nothing anywhere still produces a laser strike */
  G = null; newGame(cfg77('backyard', 'dm', 770103, 3));
  for (let i = 0; i < 900; i++) update(DT77);
  ok('T52.B no laser strike exists after a live match segment',
    !(G.strikes || []).some(z => z.kind === 'laser'));

  if (HTML77) {
    const residue = [
      ['the ability row', /\{mode:'magnify'/],
      ['radioMagnify', /function radioMagnify/],
      ['the audio cue', /sfxLaser/],
      ['the laser strike kind', /'laser'/],
      ['the command dispatch', /a\.mode==='magnify'/],
      ['the targeting overlay', /rt\.mode==='magnify'/],
      ['the roster entry', /'Magnifying Glass'/]
    ];
    for (const [what, re] of residue) ok('T52.B ' + what + ' is gone from the source', !re.test(HTML77));
    ok('T52.B the residue scan is not vacuous',
      /radioNapalm/.test(HTML77) && /radioBarrage/.test(HTML77) && /radioParadrop/.test(HTML77));
  } else {
    ok('T52.B the shipped markup was readable off disk', false);
  }
}

/* ---------- C: the AI call-down cadence ---------- */
section('T52.C the AI cadence constants are named and are actually read');
{
  ok('T52.C the three tunables exist with their shipped values',
    AI_RADIO_CLUMP === 45 && AI_RADIO_FRIENDLY === 25 && AI_RADIO_WAIT === 8);
  ok('T52.C the clump gate loosened and the dither shortened against v76',
    AI_RADIO_CLUMP < 90 && AI_RADIO_WAIT < 25);

  if (HTML77) {
    ok('T52.C the gate reads the constants, not literals',
      /hostile>=AI_RADIO_CLUMP&&friendly<AI_RADIO_FRIENDLY/.test(HTML77) &&
      !/hostile>=90&&friendly<25/.test(HTML77));
    ok('T52.C the dither reads its constant',
      /ai\.radioReadyT\+AI_RADIO_WAIT/.test(HTML77) && !/ai\.radioReadyT\+25/.test(HTML77));
  } else {
    ok('T52.C the shipped markup was readable off disk', false);
  }

  /* Behavioural, not just structural. At v76 the clump branch was dead content:
     zero napalm across sixteen measured bot-matches.

     v81 WIDENED THIS FROM ONE SEED TO TWO, and the reason is worth the lines.
     v77 sampled seed 4075 alone. On the v81 build 4075 no longer fires the
     branch, and the fix was NOT to loosen the claim. Six seeds measured on both
     builds, clump call-downs (napalm + barrage) per 24000-tick match:

       seed   4075  4076  4077  4078  4079  4080   total
       v80       1     0     5     4     2     3      15
       v81       0     0     2     0     3     0       5

     The branch is plainly still reachable; the ONE-seed sample was simply not
     what demonstrated it.

     v82 CORRECTED THE READING ABOVE, and the correction matters more than the
     table does. v81 concluded the fall was systematic because deleting the five
     Gray flags at boot reproduced v80 exactly. That proves the flags cause the
     divergence; it does not prove the divergence suppresses call-downs. Isolated
     at v82, no single flag restores the count (camo 4, Called Shot 8, Shell Shock
     6, Lockdown 5, against a v81 baseline of 5 and 15 with all five gone), and on
     six seeds nobody had looked at the v80-equivalent build scores 8 while v81
     scores 11 - the sign reverses. Six seeds cannot resolve a count this sparse.
     The fall was a property of the seed set, not of the release.

     Two seeds rather than six because each arm is a full 24000-tick match and
     segment 3 has to finish inside one container call; 4077 and 4079 are the
     two that fire on BOTH builds, so the arm is not cut to fit v81. */
  const SEEDS77 = [4077, 4079];
  let nap = 0, bar = 0, para = 0;
  const _n = radioNapalm, _b = radioBarrage, _p = radioParadrop;
  radioNapalm = function (...a) { nap++; return _n(...a); };
  radioBarrage = function (...a) { bar++; return _b(...a); };
  radioParadrop = function (...a) { para++; return _p(...a); };
  for (const sd of SEEDS77) {
    G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'green', seed: sd, watch: true });
    for (let i = 0; i < 24000; i++) { update(DT77); if (G.over) break; }
  }
  radioNapalm = _n; radioBarrage = _b; radioParadrop = _p;
  ok('T52.C the bots do fire call-downs in a full match', (nap + bar + para) > 0);
  ok(`T52.C and the clump branch is reachable, which it was not at v76 (${nap + bar} across ${SEEDS77.length} seeds)`, (nap + bar) > 0);
}

/* ---------- D: the Desk survival starter economy ---------- */
section('T52.D the Desk centre ring carries 20 percent more');
{
  G = null; newGame({ map: 'desk', mode: 'surv', diff: 'normal', fac: 'green', opp: 1, seed: 424243 });
  const N = G.map.N, c = N / 2;
  const ring = G.map.nodes.filter(n => dhyp(n.x - c, n.y - c) < 12);
  const corner = G.map.nodes.filter(n => dhyp(n.x - c, n.y - c) >= 12);
  const amtsOf = (arr, t) => [...new Set(arr.filter(n => n.t === t).map(n => n.amt))];

  ok('T52.D the ring is one plastic-and-battery pair per army plus a spare',
    ring.filter(n => n.t === 'plastic').length === 3 && ring.filter(n => n.t === 'battery').length === 3);
  ok('T52.D the ring plastic is the v76 3510 plus 20 percent',
    amtsOf(ring, 'plastic').length === 1 && amtsOf(ring, 'plastic')[0] === 4212 &&
    Math.round(3510 * 1.2) === 4212);
  ok('T52.D the ring batteries are the v76 2100 plus 20 percent',
    amtsOf(ring, 'battery').length === 1 && amtsOf(ring, 'battery')[0] === 2520 &&
    Math.round(2100 * 1.2) === 2520);
  ok('T52.D the wave-zone corner pairs are deliberately UNCHANGED',
    amtsOf(corner, 'plastic').length === 1 && amtsOf(corner, 'plastic')[0] === 3240 &&
    amtsOf(corner, 'battery').length === 1 && amtsOf(corner, 'battery')[0] === 2340);
  ok('T52.D every node still starts full', G.map.nodes.every(n => n.amt === n.max));

  /* the ring scales with the army count, so a four-army Desk game gets five pairs
     and the same per-node amounts - the scope was the amount, not the count */
  G = null; newGame({ map: 'desk', mode: 'surv', diff: 'normal', fac: 'green', opp: 3, seed: 424243 });
  const ring4 = G.map.nodes.filter(n => dhyp(n.x - G.map.N / 2, n.y - G.map.N / 2) < 12);
  ok('T52.D a four-army Desk still gets one pair per army plus a spare, at the new amounts',
    ring4.filter(n => n.t === 'plastic').length === 5 &&
    ring4.filter(n => n.t === 'battery').length === 5 &&
    ring4.every(n => n.amt === (n.t === 'plastic' ? 4212 : 2520)));
}

/* ---------- E: the seven audited defects ---------- */
section('T52.E the seven audited defects, each fixed by derivation');
{
  /* D1 - the Lab has not researched a unit unlock since the pre-v43 split */
  const unitUnlocksAtLab = Object.keys(TECH_BLD).filter(k =>
    RESEARCH[k] && RESEARCH[k].kind === 'unlock' && !RESEARCH[k].bkey && TECH_BLD[k] === 'lab');
  ok('T52.E D1 no unit unlock actually lives at the Lab', unitUnlocksAtLab.length === 0);
  ok('T52.E D1 and the card no longer says one does',
    !/every unit/.test(B.lab.d) && B.lab.d.includes('structure unlocks'));
  ok('T52.E D1 the card names the buildings TECH_BLD really routes them to',
    B.lab.d.includes(B.barracks.n) && B.lab.d.includes(B.garage.n) && B.lab.d.includes(B.helipad.n));
  ok('T52.E D1 the claim is derived, so a moved unlock rewrites it',
    ['u_grunt', 'u_tank', 'u_heli'].every(k => !RESEARCH[k] || TECH_BLD[k] !== 'lab'));

  /* D2 - the info card kept a shorter second copy of WC_LABEL */
  ok('T52.E D2 every live weapon row has a name',
    Object.keys(WVA).filter(k => k !== 'x').every(k => !!WC_LABEL[k]));
  ok('T52.E D2 the info card weapon line reads WC_LABEL',
    ['grunt', 'tank', 'aatruck', 'mortar', 'flamer', 'bazooka', 'grenadier'].every(k => {
      const m = infoStatsHtml('unit', k).match(/<b>Weapon<\/b><span>([^<]*)</);
      return !!m && m[1] === WC_LABEL[U[k].w];
    }));
  ok('T52.E D2 the rows that had no name now have one',
    WC_LABEL.d === 'Demolition' && WC_LABEL.q === 'Artillery barrage');
  ok('T52.E D2 an unarmed unit still prints no weapon row',
    !/<b>Weapon<\/b>/.test(infoStatsHtml('unit', 'truck')));

  /* D3 - a dead second copy of the guard tower's weapon class */
  ok('T52.E D3 no building row carries a weapon class of its own',
    Object.keys(B).every(k => B[k].w === undefined));
  ok('T52.E D3 WC_BLD is the only source, and still answers',
    wcOf({ kind: 'bld', key: 'guardtower' }) === WC_BLD.guardtower &&
    wcOf({ kind: 'bld', key: 'bunker' }) === WC_BLD.bunker);
  ok('T52.E D3 the tower still deals small-arms damage through it',
    dmgMulFor('guardtower', wcOf({ kind: 'bld', key: 'guardtower' }), 'heavy') === WVA.b.heavy);

  /* D4 - UPGRADES.dump.eff was dead, and did not match the literal it described */
  ok('T52.E D4 the aura has one source', DUMP_AURA === 0.15 && DUMP_AURA_UP === 0.30 && DUMP_R === 9);
  ok('T52.E D4 the dead eff field is gone from the dump upgrade', UPGRADES.dump.eff === undefined);
  ok('T52.E D4 eff survives only where something reads it',
    Object.keys(UPGRADES).every(k => UPGRADES[k].eff === undefined || !!(B[k].eps || B[k].gar)));
  ok('T52.E D4 both card strings derive from the constants',
    B.dump.d === '+' + Math.round(DUMP_AURA * 100) + '% damage to friends within ' + DUMP_R + ' tiles'
      + '. Scuttle detonates it for ' + SCUTTLE_DM + ' over ' + SCUTTLE_R + ' tiles, and your own men take '
      + Math.round(SCUTTLE_FF * 100) + '% of it' &&   /* v80: the card grew a second sentence; every number in it still derives */
    UPGRADES.dump.d.includes('+' + Math.round(DUMP_AURA * 100) + '%') &&
    UPGRADES.dump.d.includes('+' + Math.round(DUMP_AURA_UP * 100) + '%'));
  {
    /* and the damage site is bit-identical to the literals it replaced */
    G = null; newGame(cfg77('backyard', 'dm', 770401, 1));
    const p = G.players[0];
    const d = makeBuilding('dump', p, Math.round(p.start.x + 5), Math.round(p.start.y + 5), true);
    const u = makeUnit('grunt', p, d.x + 1, d.y + 1);
    const base = dmgBonus(u); d.upg = true; const up = dmgBonus(u);
    u.x = d.x + DUMP_R; const out = dmgBonus(u);
    ok('T52.E D4 the aura still multiplies by exactly 1.15 and 1.30',
      base === 1.15 && up === 1.30 && out === 1);
  }

  /* D5 - garCap and the info card derived the same number two ways */
  ok('T52.E D5 garCap reads the upgrade table',
    garCap({ t: B.bunker, key: 'bunker', upg: false }) === B.bunker.gar &&
    garCap({ t: B.bunker, key: 'bunker', upg: true }) === Math.round(B.bunker.gar * UPGRADES.bunker.eff));
  ok('T52.E D5 the shipped capacity is still four and six',
    garCap({ t: B.bunker, key: 'bunker', upg: false }) === 4 &&
    garCap({ t: B.bunker, key: 'bunker', upg: true }) === 6);
  ok('T52.E D5 the info card and garCap now agree by construction',
    infoStatsHtml('bld', 'bunker').includes(
      B.bunker.gar + ' infantry (' + garCap({ t: B.bunker, key: 'bunker', upg: true }) + ' upgraded)'));
  ok('T52.E D5 the APC troop bay still short-circuits ahead of the upgrade path',
    garCap({ t: U.apc, key: 'apc', upg: true }) === U.apc.cap);

  /* D6 - the FILE MAP banner never picked up the v76 barrage */
  if (HTML77) {
    const line = (HTML77.match(/RADIO TOWER CALL-DOWNS[^\n]*/) || [''])[0];
    ok('T52.E D6 the banner names the barrage it has shipped since v76', /barrage/i.test(line));
    ok('T52.E D6 and no longer names the removed ability', !/magnify/i.test(line));
  } else {
    ok('T52.E D6 the shipped markup was readable off disk', false);
  }

  /* D7 - the survival starter-economy sentence was only true off the Desk */
  if (HTML77) {
    ok('T52.E D7 the flat two-and-two claim is gone',
      !/Two plastic piles and two batteries sit by the flag/.test(HTML77));
    ok('T52.E D7 and the Desk branch is described',
      /The Desk rings the flag/.test(HTML77));
  } else {
    ok('T52.E D7 the shipped markup was readable off disk', false);
  }
}

/* ---------- F: the widened lint ---------- */
section('T52.F the manual lint now catches claims that carry no number');
{
  /* v76's section D compared NUMBERS, which is why four of this release's seven
     defects walked straight past it. Each check below is a shape of false claim
     that a number comparison cannot see. */

  /* F1: no card may name a research location the tech table contradicts. */
  {
    const bad = [];
    for (const k in U) {
      const t = U[k];
      if (!t.tech) continue;
      const real = B[TECH_BLD[t.tech] || 'lab'].n;
      const card = infoStatsHtml('unit', k);
      const m = card.match(/<b>Unlock<\/b><span>Research at the ([^<]*)</);
      if (m && m[1] !== real) bad.push(k + ': card says ' + m[1] + ', TECH_BLD says ' + real);
    }
    ok('T52.F1 every unit card names the building that really researches it',
      bad.length === 0);
    ok('T52.F1 the scan is not vacuous - it saw units with real unlocks',
      Object.keys(U).filter(k => U[k].tech).length > 10);
  }

  /* F2: no description may claim a research scope the tech table denies. This is
     D1 exactly: "researches every unit unlock" carried no number to compare. */
  {
    const bad = [];
    for (const k in B) {
      const d = B[k].d || '';
      if (!/[Rr]esearch/.test(d)) continue;
      if (/every unit|all unit|unit unlock/i.test(d) && !/researched at the/i.test(d)) {
        const owns = Object.keys(TECH_BLD).some(t =>
          RESEARCH[t] && RESEARCH[t].kind === 'unlock' && !RESEARCH[t].bkey && TECH_BLD[t] === k);
        if (!owns) bad.push(k);
      }
    }
    ok('T52.F2 no structure claims a unit-unlock scope it does not own', bad.length === 0);
  }

  /* F3: no table field may be dead. This is D3 and D4: B.guardtower.w and
     UPGRADES.dump.eff were both correct-looking and both never read. */
  ok('T52.F3 no building row carries a weapon class WC_BLD does not own',
    Object.keys(B).every(k => B[k].w === undefined));
  ok('T52.F3 no upgrade carries an eff no reader consults',
    Object.keys(UPGRADES).every(k => UPGRADES[k].eff === undefined || !!(B[k].eps || B[k].gar)));
  ok('T52.F3 no upgrade carries a unitBuff on a building that produces nothing',
    Object.keys(UPGRADES).every(k => UPGRADES[k].unitBuff === undefined || !!B[k].prod));

  /* F4: no prose may name an ability, unit or building that does not exist. This
     is D6 and the whole magnify sweep. */
  if (HTML77) {
    const helpStart = HTML77.indexOf('<div id="helpBox">');
    const help = helpStart < 0 ? '' : HTML77.slice(helpStart, HTML77.indexOf('</div>', helpStart));
    ok('T52.F4 the manual markup was located', help.length > 500);
    const liveNames = new Set([...RADIO_ABILITIES.map(a => a.name),
      ...Object.keys(U).map(k => U[k].n), ...Object.keys(B).map(k => B[k].n)]);
    const retired = ['Magnifying Glass', 'Radio Operator', 'Gunship'];
    const named = retired.filter(n => !liveNames.has(n) && help.includes(n));
    ok('T52.F4 the manual names no retired ability or unit', named.length === 0);
    /* and the FILE MAP banners may not name one either */
    const banners = HTML77.split('\n').filter(l => /\.{10,}/.test(l)).join('\n');
    /* the FULL name, not its first word: "Radio Operator" shares a first word with
       the live RADIO TOWER CALL-DOWNS banner, and matching on that alone made this
       check fail on a correct build. */
    const inBanner = retired.filter(n => !liveNames.has(n) &&
      new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(banners));
    ok('T52.F4 no FILE MAP banner names one either', inBanner.length === 0);
    ok('T52.F4 the banner scan is not vacuous', banners.length > 2000);
  } else {
    ok('T52.F4 the shipped markup was readable off disk', false);
  }

  /* F5: every hand-countable fact about the ability roster must be a slot. This
     is the "Those three need vision" class. */
  ok('T52.F5 the vision count is a slot, and it counts the live table',
    helpTuneValue('radioVis') ===
      ['none', 'one', 'two', 'three', 'four', 'five', 'six'][RADIO_ABILITIES.filter(a => a.vision).length]);
  if (HTML77) {
    ok('T52.F5 the manual does not hand-count the vision abilities',
      !/Those (one|two|three|four|five) need vision/.test(HTML77) &&
      /data-tune="radioVis"/.test(HTML77));
  }

  /* F6: the v76 slot checks still hold, and every slot the markup asks for
     resolves to something non-empty. Kept here so section F is self-contained. */
  if (HTML77) {
    const asked = new Set((HTML77.match(/data-tune="([a-zA-Z]+)"/g) || []).map(s => s.slice(11, -1)));
    asked.delete('key');
    ok('T52.F6 every slot the manual asks for resolves to something',
      [...asked].every(k => helpTuneValue(k) != null && String(helpTuneValue(k)).length > 0));
    ok('T52.F6 the slot scan is not vacuous', asked.size >= 20);
  }
}
