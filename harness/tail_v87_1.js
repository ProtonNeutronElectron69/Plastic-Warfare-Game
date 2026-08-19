section('T61 v87.1: three interface repairs');

/* Three unrelated changes, none of which may touch the simulation. That is the
   headline claim and the trails already carry it - triage reported every pinned
   combo reproducing after all three landed. What the trails CANNOT carry is why
   each change is the one that was intended, so:

     A  the drag box wears the local army's colour, read off FAC
     B  a mixed selection offers every toggleable ability any unit in it owns
     C  selling a building tears it down and leaves a heap that is NOT a node

   The trap each section exists for is named where it is checked. The largest is
   in C: the sell path runs inside the simulation, so an FX block that drew a
   single SEEDED number would move the shared RNG stream and desync a live match
   while looking perfectly correct on one machine. */

const DT61 = 1 / 30;
const cfg61 = (fac, seed, opp) => ({ map: 'backyard', mode: 'dm', diff: 'normal', fac: fac || 'green', opp: (opp == null ? 1 : opp), seed });
function fresh61(seed, fac) { G = null; newGame(cfg61(fac, seed)); return G.human; }
function put61(k, p, x, y) { const u = makeUnit(k, p, x, y); u.state = 'idle'; u.path = null; u.target = null; return u; }
/* the shim's innerHTML is a plain property, so setting it to '' detaches NOTHING
   and panel columns accumulate across refreshes - the trap tail_v73 records. */
function scrub61(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
function panel61() { return document.getElementById('prodBtns'); }
/* every .bb button currently hanging off the production column */
function bbs61() {
  const out = [];
  (function walk(n) {
    if (n && typeof n.className === 'string' && n.className.split(' ')[0] === 'bb') out.push(n);
    (n && n.children || []).forEach(walk);
  })(panel61());
  return out;
}
function label61(b) { const m = /<b>([^<]*)<\/b>/.exec(String(b.innerHTML || '')); return m ? m[1] : ''; }
/* the button whose label starts with this text, or undefined */
function btn61(pre) { return bbs61().filter(b => label61(b).indexOf(pre) === 0)[0]; }
/* a function's source with its COMMENTS removed. Every source-text claim below
   is about what the code does, and a comment that merely NAMES the thing it is
   promising not to do would satisfy a plain indexOf - which is exactly how the
   first cut of T61.C passed itself. */
function nocmt61(fn) { return String(fn).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1'); }
/* submitCmd QUEUES; nothing reaches the sim until execCmds drains it. */
function click61(b) { b.onclick(); execCmds(); }

/* ================================================ A: the drag box ============= */
section('T61.A the drag box wears the local army\'s colour');
{
  fresh61(870101, 'green');

  /* COMPUTED, not transcribed: the expected colour is derived from FAC and the
     lift constant the same way the helper derives it, so a palette change moves
     both together instead of turning this red. */
  for (const f of ['green', 'tan', 'gray', 'blue']) {
    G.human.fac = f;
    const want = hx2rgb(shade(FAC[f].color, DRAG_BOX_LIFT));
    const got = dragBoxCol();
    ok(`T61.A the ${f} player's box is ${f}, lifted off FAC`,
      got.r === want.r && got.g === want.g && got.b === want.b);
  }
  G.human.fac = 'green';

  /* MUTATION ARM: the four are actually DIFFERENT. A helper that returned one
     constant would pass every check above and fail this one. */
  {
    const seen = new Set();
    for (const f of ['green', 'tan', 'gray', 'blue']) {
      G.human.fac = f; const c = dragBoxCol(); seen.add(c.r + ',' + c.g + ',' + c.b);
    }
    G.human.fac = 'green';
    ok('T61.A MUTATION: the four armies really do draw four different boxes', seen.size === 4);
  }

  /* the lift is the reason this is worth doing at all: Blue and Gray are the two
     armies whose own hex would read poorly against the board, so the box is
     brighter than the flag it is named for - never darker. */
  for (const f of ['green', 'tan', 'gray', 'blue']) {
    G.human.fac = f;
    const raw = hx2rgb(FAC[f].color), lit = dragBoxCol();
    ok(`T61.A ...and ${f}'s box is no darker than ${f}'s own hex on any channel`,
      lit.r >= raw.r && lit.g >= raw.g && lit.b >= raw.b);
  }
  G.human.fac = 'green';

  /* a WATCH match has no human player at all, so the helper cannot read a
     faction off one. It falls back rather than throwing. */
  {
    const keep = G.human;
    G.human = null;
    let threw = false, c = null;
    try { c = dragBoxCol(); } catch (e) { threw = true; }
    ok('T61.A a spectator\'s drag box does not throw for want of a faction', !threw);
    ok('T61.A ...it falls back to the neutral yellow the box used to be',
      !!c && c.r === DRAG_BOX_NEUTRAL.r && c.g === DRAG_BOX_NEUTRAL.g && c.b === DRAG_BOX_NEUTRAL.b);
    G.human = keep;
  }

  /* the helper is not enough: the renderer has to USE it. Both halves of the
     box - stroke and fill - and the old literal gone from that branch. */
  {
    const src = renderCore.toString();
    const i = src.indexOf('MOUSE.down&&MOUSE.drag');
    ok('T61.A renderCore still has a drag-box branch', i > 0);
    const branch = src.slice(i, i + 400);
    ok('T61.A ...and it reads the helper', branch.indexOf('dragBoxCol()') > 0);
    ok('T61.A ...for the outline AND the wash, not just one of them',
      /strokeStyle=rgba\(/.test(branch) && /fillStyle=rgba\(/.test(branch));
    ok('T61.A ...and the hardcoded yellow is gone from it',
      branch.indexOf('255,236,110') < 0);
  }

  /* the rally-point arrow is the OTHER thing drawn in that yellow and was
     deliberately left alone: it is a marker on the ground, not a selection. */
  ok('T61.A the rally arrow keeps the interface yellow, by decision',
    require('fs').readFileSync('pw.html', 'utf8').indexOf("c.strokeStyle='rgba(255,236,110,.8)'") > 0);
}

/* ================================================ B: the group toggles ======== */
section('T61.B a mixed selection offers every toggle its units own');
{
  /* THE COMPLETENESS CLAIM, derived rather than transcribed. Every single-unit
     toggle in the panel is written as submitCmd('<cmd>',{ids:[e.id],on:!e.<field>}),
     so the panel's own source names the full set. Scraping it and demanding a
     UNIT_TOGGLES row for each is what makes this table PROVABLY complete - and
     it is the check that would have caught the four abilities (On Me!, Called
     Shot, Ripple Fire, Flat Out) that had a single-unit button and no group one
     for five releases. */
  const src = refreshSelPanel.toString();
  const found = [];
  const re = /submitCmd\('([a-z]+)',\{ids:\[e\.id\],on:!e\.([A-Za-z]+)\}\)/g;
  let m; while ((m = re.exec(src))) found.push([m[1], m[2]]);
  ok('T61.B the single-unit panel really does declare a set of toggles', found.length >= 10);
  const missing = found.filter(([c, f]) => !UNIT_TOGGLES.some(a => a.c === c && a.s === f));
  ok('T61.B every single-unit toggle has a UNIT_TOGGLES row' +
     (missing.length ? ' [' + missing.map(x => x[0]).join(', ') + ']' : ''), missing.length === 0);
  ok('T61.B ...and entrench, the one pair-of-commands row, is in the table too',
    UNIT_TOGGLES.some(a => a.c === 'entrench' && a.offc === 'unentrench' && !!a.aim));
  const extra = UNIT_TOGGLES.filter(a => !a.offc && !found.some(([c, f]) => c === a.c && f === a.s));
  ok('T61.B ...and the table invents nothing the panel does not offer alone' +
     (extra.length ? ' [' + extra.map(a => a.c).join(', ') + ']' : ''), extra.length === 0);

  /* every row is well-formed: a flag some unit actually carries, two labels, a
     sub-line that reads the live constants, and a tooltip. */
  {
    const bad = UNIT_TOGGLES.filter(a =>
      !Object.keys(U).some(k => U[k][a.f]) ||
      !a.on || !a.off || a.on === a.off || typeof a.sub !== 'function' || !a.tip);
    ok('T61.B every row names a flag a real unit carries and both of its labels' +
       (bad.length ? ' [' + bad.map(a => a.c).join(', ') + ']' : ''), bad.length === 0);
    let threw = null;
    for (const a of UNIT_TOGGLES) { try { if (!String(a.sub()).length) threw = a.c; } catch (e) { threw = a.c; } }
    ok('T61.B ...and every sub-line renders off the constants without throwing' + (threw ? ' [' + threw + ']' : ''),
      threw === null);
  }

  /* BEHAVIOURAL. A genuinely mixed squad: five unit types carrying five
     different abilities, four of which had no group button before this change. */
  {
    const p = fresh61(870201, 'green');
    p.res.p = 999999; p.res.e = 999999;
    const hq = p.blds.find(b => b.key === 'hq');
    const bx = Math.floor(hq.tx) + 6, by = Math.floor(hq.ty) + 6;
    const gun = put61('gunner', p, bx, by), gun2 = put61('gunner', p, bx + 1, by);
    const sarge = put61('sarge', p, bx + 2, by);
    const snip = put61('sniper', p, bx + 3, by);
    const art = put61('arty', p, bx + 4, by);
    const bike = put61('bike', p, bx + 5, by);
    const grunt = put61('grunt', p, bx + 6, by);   // carries no toggle at all
    scrub61(panel61()); lastSelSig = '';
    setSel([gun, gun2, sarge, snip, art, bike, grunt]);
    const labels = bbs61().map(label61);

    ok('T61.B the mixed squad offers one button per ability present', labels.length === 5);
    ok('T61.B ...including the four that were single-unit only until now',
      labels.some(l => l.indexOf('On Me!') === 0) &&
      labels.some(l => l.indexOf('Called Shot') === 0) &&
      labels.some(l => l.indexOf('Ripple Fire') === 0) &&
      labels.some(l => l.indexOf('Flat Out') === 0));
    ok('T61.B ...and the Entrench button counts only the two gunners',
      labels.some(l => l === 'Entrench (2)'));
    ok('T61.B ...while every other button counts its own one unit',
      labels.filter(l => / \(1\)$/.test(l)).length === 4);
    ok('T61.B the Grunt contributes no button, having no toggle',
      !labels.some(l => /Grunt/.test(l)));

    /* CLICKING ONE MOVES ONLY ITS OWN TYPE. This is the whole of the user-facing
       ask: the button activates the ability for all of THAT unit type selected,
       and leaves every other type in the selection alone. */
    click61(btn61('Ripple Fire'));
    ok('T61.B clicking Ripple Fire ripples the battery', art.rip === true);
    ok('T61.B ...and moves nothing else in the selection',
      !snip.cs && !bike.flat && !sarge.onMe && !gun.entrenched && !gun2.entrenched);

    /* ...and the whole of that type, not the first of it. */
    const snip2 = put61('sniper', p, bx + 3, by + 1);
    scrub61(panel61()); lastSelSig = '';
    setSel([snip, snip2, art]);
    const cs2 = btn61('Called Shot');
    ok('T61.B two snipers get one button that says two', !!cs2 && label61(cs2) === 'Called Shot (2)');
    click61(cs2);
    ok('T61.B ...and it moves both of them', snip.cs === true && snip2.cs === true);
    ok('T61.B ...and still nothing else', art.rip === true);

    /* the label flips, and ANY one already running turns the whole group off -
       so the button is never ambiguous about what it will do. */
    snip2.cs = false;
    scrub61(panel61()); lastSelSig = ''; refreshSelPanel();
    const cs3 = btn61('Free Fire');
    ok('T61.B one sniper running flips the label to the off-form', !!cs3 && label61(cs3) === 'Free Fire (2)');
    click61(cs3);
    ok('T61.B ...and clicking it puts BOTH down', snip.cs === false && snip2.cs === false);
  }

  /* THE FREEZE TRAP. A group button whose state does not ride the selection
     signature prints whatever it said when the panel last rebuilt. Five of the
     eleven rows had a hand-written signature line and four abilities had none at
     all, which is exactly the shape of bug the table removes. Driven per row. */
  {
    const p = fresh61(870202, 'green');
    const hq = p.blds.find(b => b.key === 'hq');
    const bx = Math.floor(hq.tx) + 6, by = Math.floor(hq.ty) + 8;
    const froze = [];
    for (const a of UNIT_TOGGLES) {
      const key = Object.keys(U).find(k => U[k][a.f]);
      const u1 = put61(key, p, bx, by), u2 = put61(key, p, bx + 1, by);
      scrub61(panel61()); lastSelSig = '';
      setSel([u1, u2]);
      const before = lastSelSig;
      u1[a.s] = true;
      refreshSelPanel();
      if (lastSelSig === before) froze.push(a.c);
      u1[a.s] = false;
      G.units.splice(G.units.indexOf(u1), 1); G.units.splice(G.units.indexOf(u2), 1);
      p.units.splice(p.units.indexOf(u1), 1); p.units.splice(p.units.indexOf(u2), 1);
    }
    ok('T61.B every group toggle moves the selection signature' +
       (froze.length ? ' [' + froze.join(', ') + ']' : ''), froze.length === 0);
  }

  /* the p===G.human gate, per row. v55 records why it is p===G.human and not
     p.human: a spectator would otherwise still be offered the button. */
  {
    const p = fresh61(870203, 'green');
    const hq = p.blds.find(b => b.key === 'hq');
    const g1 = put61('gunner', p, Math.floor(hq.tx) + 6, Math.floor(hq.ty) + 10);
    const g2 = put61('gunner', p, Math.floor(hq.tx) + 7, Math.floor(hq.ty) + 10);
    scrub61(panel61()); lastSelSig = ''; setSel([g1, g2]);
    ok('T61.B a player gets the group button', bbs61().length === 1);
    const keep = G.watch; G.watch = true;
    scrub61(panel61()); lastSelSig = ''; refreshSelPanel();
    ok('T61.B ...and a spectator gets none of them', bbs61().length === 0);
    G.watch = keep;
  }

  /* Napalm Blast is deliberately NOT a row: it is a one-shot on a cooldown, and
     its group button counts only the helicopters actually able to fire. Pinned
     because "fold everything into the table" is the obvious wrong next step. */
  {
    ok('T61.B the one-shots stay out of the toggle table',
      !UNIT_TOGGLES.some(a => a.f === 'fbomb' || a.f === 'bail'));
    const p = fresh61(870204, 'tan');
    const hq = p.blds.find(b => b.key === 'hq');
    const h1 = put61('firebomb', p, Math.floor(hq.tx) + 6, Math.floor(hq.ty) + 12);
    const h2 = put61('firebomb', p, Math.floor(hq.tx) + 7, Math.floor(hq.ty) + 12);
    h1.abCool = 0; h2.abCool = FB_CD;
    scrub61(panel61()); lastSelSig = ''; setSel([h1, h2]);
    const l = bbs61().map(label61);
    ok('T61.B ...and the Firebomb button still counts only what can fire',
      l.length === 1 && /Napalm Blast \(1\)$/.test(l[0]));
  }
}

/* ================================================ C: selling ================== */
section('T61.C selling tears the building down and leaves a heap');
{
  /* THE ONE THAT COULD DESYNC A MATCH. sellBuilding runs inside the simulation,
     so every offset in its new effects block has to be Math.random. One srand()
     among them would move the shared stream, and the machine that watched the
     sale and the machine that made it would disagree from that tick on. Driven
     against the live cursor, not read off the source. */
  {
    const p = fresh61(870301, 'green');
    const hq = p.blds.find(b => b.key === 'hq');
    const b = makeBuilding('barracks', p, Math.floor(hq.tx) + 7, Math.floor(hq.ty) + 4, true);
    b.prog = 1; b.hp = b.mhp; b.garrison = [];
    const rng0 = G.rngS, parts0 = G.parts.length;
    sellBuilding(b);
    ok('T61.C selling an empty building draws no seeded number at all', G.rngS === rng0);
    ok('T61.C ...and it really did run the teardown', G.parts.length > parts0 + 20);
    ok('T61.C ...and the building is off the board', G.blds.indexOf(b) < 0 && p.blds.indexOf(b) < 0);
  }
  /* the garrison spill is the ONE seeded thing sellBuilding has always done, and
     it stays seeded - the men land on the field and the field is simulation.
     Pinned so the check above cannot be met by making that part cosmetic too. */
  {
    const p = fresh61(870302, 'green');
    const hq = p.blds.find(b => b.key === 'hq');
    const b = makeBuilding('bunker', p, Math.floor(hq.tx) + 7, Math.floor(hq.ty) + 6, true);
    b.prog = 1; b.hp = b.mhp;
    const man = put61('grunt', p, b.x, b.y);
    man.garrisoned = true; b.garrison = [man];
    const rng0 = G.rngS;
    sellBuilding(b);
    ok('T61.C a garrison still spills on the seeded stream', G.rngS !== rng0);
    ok('T61.C ...and the man is back on the field', man.garrisoned === false);
  }

  /* THE HEAP IS SCENERY. A destroyed building drops mineable salvage; a SOLD one
     was already paid for in cash, so a node would pay twice. That is why sold
     buildings dropped nothing at all before this change, and it is the property
     the new pile must not quietly undo. */
  {
    const p = fresh61(870303, 'green');
    const hq = p.blds.find(b => b.key === 'hq');
    const b = makeBuilding('barracks', p, Math.floor(hq.tx) + 7, Math.floor(hq.ty) + 8, true);
    b.prog = 1; b.hp = b.mhp; b.garrison = [];
    const nodes0 = G.map.nodes.length, wrecks0 = G.map.nodes.filter(n => n.wreck).length;
    const cash0 = p.res.p;
    sellBuilding(b);
    ok('T61.C selling adds no resource node of any kind', G.map.nodes.length === nodes0);
    ok('T61.C ...and no salvage wreck in particular', G.map.nodes.filter(n => n.wreck).length === wrecks0);
    ok('T61.C ...while the refund is still paid', p.res.p > cash0);

    /* CONTRAST, driven: the DESTROYED building on the same board does drop one,
       which is what makes the check above a distinction rather than a tautology. */
    const b2 = makeBuilding('barracks', p, Math.floor(hq.tx) + 10, Math.floor(hq.ty) + 8, true);
    b2.prog = 1; b2.hp = 1; b2.garrison = [];
    const n1 = G.map.nodes.length;
    kill(b2);
    ok('T61.C CONTRAST: destroying the same structure DOES drop salvage', G.map.nodes.length > n1);
  }

  /* the heap is a decal, and decals are fog-aware: one dropped out of vision
     queues and is painted when the ground is next seen. Same machinery as the
     scorch marks, so the sold base of an enemy you cannot see stays hidden. */
  {
    const p = fresh61(870304, 'green');
    ghostInit();
    ok('T61.C stampPile is wired into the decal family', typeof stampPile === 'function' && typeof paintPile === 'function');
    ok('T61.C ...and flushStamps knows the pile kind',
      nocmt61(flushStamps).indexOf("s.k==='p'") > 0);
    const N = G.map.N;
    let fx = -1, fy = -1;
    for (let y = 2; y < N - 2 && fx < 0; y++) for (let x = 2; x < N - 2; x++) if (G.fog[y * N + x] !== 2) { fx = x + .5; fy = y + .5; break; }
    ok('T61.C the board has ground the player cannot see', fx > 0);
    const q0 = G.ghost.stampQ.length;
    stampPile(fx, fy, '#4caf50', 12);
    ok('T61.C a pile dropped out of vision queues rather than painting', G.ghost.stampQ.length === q0 + 1);
    ok('T61.C ...as a pile, not as some other decal', G.ghost.stampQ[G.ghost.stampQ.length - 1].k === 'p');
    ok('T61.C ...and it stays queued while the ground stays dark',
      (flushStamps(), G.ghost.stampQ.length === q0 + 1));
  }

  /* the teardown is the DESTRUCTION teardown, not a new one invented beside it:
     the same five effect families kill() uses on a building, read off the source
     so a future edit to one has to be a decision about both. */
  {
    const src = nocmt61(sellBuilding);
    const want = ['stampMelt', 'stampScorch', 'stampPile', 'spawnShrapnel', 'spawnExplosion', 'spawnSmoke', 'shakeAt', 'sfxBuildingDestroy'];
    const gone = want.filter(w => src.indexOf(w) < 0);
    ok('T61.C the sell path runs the full teardown' + (gone.length ? ' [missing ' + gone.join(', ') + ']' : ''),
      gone.length === 0);
    ok('T61.C ...and the only seeded draws left are the garrison spill\'s two',
      (src.match(/srand\(\)/g) || []).length === 2 &&
      /spawnSpot\(b\);u\.x=sp2\.x\+srand\(\)-\.5;u\.y=sp2\.y\+srand\(\)-\.5/.test(src));
    ok('T61.C ...and it drops no wreck node', src.indexOf('spawnWreck') < 0);
    /* sfxStructBreak did not become dead code - the barricade still uses it */
    ok('T61.C the lighter break sound still has its caller, the barricade',
      nocmt61(kill).indexOf('sfxStructBreak') > 0);
  }

  /* the pile the player sees is the faction's own plastic, shaded the way the
     salvage wrecks are, so a sold Green base reads as Green rubble. */
  {
    const src = nocmt61(sellBuilding);
    ok('T61.C the heap is the seller\'s colour, read off FAC',
      /stampPile\(b\.x,b\.y,shade\(scol,\.78\)/.test(src) && /const scol=FAC\[p\.fac\]\.color/.test(src));
  }
}
