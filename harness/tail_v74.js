'use strict';
/* T51 v74: the team-coloured production bar, and prop collision matched to art.

   ONE CHANGE IS UI and cannot move the sim. The other rewrites M.pass at
   map-generation time, which is why this release recuts the LAYOUT hashes as
   well as the trails: layoutHash folds M.pass directly, so a passing layout hash
   could not have proved containment for a release whose whole subject IS the
   passability grid. v67 is the only prior release in that position, and section
   F below states the same thing from the other end, that nothing outside map
   generation moved.

   WHAT IS DELIBERATELY NOT TESTED HERE. Colour as seen. Whether the wash reads
   as "tan" to a player is a rendering question the shim cannot answer; style
   assignments are recorded strings and nothing rasterizes them. What IS testable
   is that the chip stops using the stylesheet's green and starts using the
   OWNING player's colour, that the tint is a real lightening of it, and that
   every faction gets its own. Section A stays inside that line.

   Likewise, "the art lines up" is not asserted from source text. The v74 audit
   measured it by baking each prop on a real canvas and sampling its alpha, which
   needs @napi-rs/canvas and does not belong in the standard suite. What this
   tail pins is the CONTRACT the measurement produced: the table's shape, the
   scaling rule, the arithmetic cliff in blockLine, and the resulting footprints.

   A: the production bar takes the army's colour.
   B: PROP_BLK's shape and propBlkR's scaling rule.
   C: decor really is walkable, and blockers really do own their tile.
   D: the blockLine cliff, and the overhang.
   E: footprints, measured on generated maps against a pinned ceiling.
   F: statelessness, determinism and save/load. */

section('T51 v74: team-coloured production bar, prop collision matched to art');

const DT74 = 1 / 30;
function cfg74(map, mode, seed, opp, fac) {
  return { map, mode, diff: 'normal', fac: fac || 'green', opp: (opp == null ? 1 : opp), seed };
}
function fresh74(seed, opp, map, mode, fac) {
  G = null; newGame(cfg74(map || 'backyard', mode || 'dm', seed, opp, fac));
  return G.human;
}
/* the shim's innerHTML is a plain property, so setting it to '' detaches
   NOTHING and panel columns accumulate across refreshes. Same trap tail_v72 and
   tail_v73 record; any read of panel contents has to detach first. */
function scrub74(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

/* parse 'rgb(r,g,b)' or '#rrggbb' into a channel triple */
function chan74(s) {
  if (!s) return null;
  if (s.charAt(0) === '#') { const n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const m = String(s).match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}

/* ============================================ A: the bar takes the army colour === */
section('T51.A the production wash is the owning army\'s colour');
{
  ok('T51.A both painters exist',
     typeof teamTint === 'function' && typeof paintTeamFill === 'function');

  /* the tint is a LIGHTENING of the colour, not a multiply. shade() would clip
     Green's green channel and swing Blue toward cyan; mixing toward white keeps
     the hue and raises every channel, which is what the pale edge wants. */
  for (const f of ['green', 'tan', 'gray', 'blue']) {
    const base = chan74(FAC[f].color), lit = chan74(teamTint(FAC[f].color));
    ok('T51.A ' + f + ': the tint parses as rgb', !!lit);
    ok('T51.A ' + f + ': every channel is lighter than the base',
       !!lit && lit[0] >= base[0] && lit[1] >= base[1] && lit[2] >= base[2]);
    ok('T51.A ' + f + ': ...and it really moved (not a pass-through)',
       !!lit && (lit[0] + lit[1] + lit[2]) > (base[0] + base[1] + base[2]) + 30);
    ok('T51.A ' + f + ': the tint stays in range',
       !!lit && lit.every(v => v >= 0 && v <= 255));
  }

  /* four factions, four DISTINCT washes. This is the actual bug: every one of
     these was #4caf50 before, because --teamc is a literal Green Army value. */
  const seen = {};
  for (const f of ['green', 'tan', 'gray', 'blue']) {
    const w = { style: {} }, e = { style: {} };
    paintTeamFill(w, e, f);
    ok('T51.A ' + f + ': the wash takes the faction colour', w.style.background === FAC[f].color);
    ok('T51.A ' + f + ': the edge takes the tint', e.style.background === teamTint(FAC[f].color));
    seen[f] = w.style.background;
  }
  ok('T51.A all four armies get a different wash',
     new Set(Object.values(seen)).size === 4);
  ok('T51.A only Green still matches the stylesheet default',
     seen.green === '#4caf50' && seen.tan !== '#4caf50' && seen.gray !== '#4caf50' && seen.blue !== '#4caf50');

  /* an unknown faction must not throw or write undefined; it falls back. */
  {
    const w = { style: {} }, e = { style: {} };
    paintTeamFill(w, e, 'nosuchfaction');
    ok('T51.A an unknown faction falls back rather than writing undefined',
       w.style.background === '#4caf50' && !!e.style.background);
  }
  /* null nodes are tolerated: querySelector can miss in a browser too */
  {
    let threw = false;
    try { paintTeamFill(null, null, 'tan'); } catch (err) { threw = true; }
    ok('T51.A missing nodes do not throw', !threw);
  }
}
{
  /* THE REAL CHIP. A Tan barracks with something in the queue, driven through
     the real refreshSelPanel, and the fill registered for the pump. */
  const p = fresh74(740101, 1, 'backyard', 'dm', 'tan');
  p.res.p = 999999; p.res.e = 999999;
  const hq = p.blds.find(b => b.key === 'hq');
  const bk = makeBuilding('barracks', p, Math.floor(hq.tx) + 5, Math.floor(hq.ty) + 3, true);
  bk.prog = 1;
  bk.queue.push('grunt'); bk.prodT = 0.4;
  G.sel = [bk]; bk.sel = true;
  const before = V71FILL.length;
  lastSelSig = ''; refreshSelPanel();
  ok('T51.A a queued unit registers a fill', V71FILL.length > before);
  const f = V71FILL[V71FILL.length - 1];
  ok('T51.A the queue chip\'s wash carries the Tan colour, not the green default',
     !!f.w && f.w.style.background === FAC.tan.color && f.w.style.background !== '#4caf50');
  ok('T51.A ...and its edge carries the Tan tint',
     !!f.e && f.e.style.background === teamTint(FAC.tan.color));
  /* the fill still drives: colour is applied at creation, height at 60fps.
     v71Fills drops any entry whose node is not isConnected, and the shim has no
     such property, so the test supplies it rather than weakening the pump. */
  f.w.isConnected = true; f.e.isConnected = true;
  v71Fills();
  ok('T51.A the pump still sets the height from prodT',
     !!f.w && String(f.w.style.height).indexOf('%') > 0);
  ok('T51.A ...without disturbing the colour it was given',
     f.w.style.background === FAC.tan.color);
}

/* ================================================= B: the table and the rule === */
section('T51.B PROP_BLK\'s shape and propBlkR\'s scaling rule');
{
  ok('T51.B the table exists and is a plain object',
     typeof PROP_BLK === 'object' && PROP_BLK !== null);
  ok('T51.B every entry is a finite radius, never negative',
     Object.keys(PROP_BLK).every(k => typeof PROP_BLK[k] === 'number' && isFinite(PROP_BLK[k]) && PROP_BLK[k] >= 0));

  /* the decor set, named explicitly. A future edit that quietly gives one of
     these a radius back should fail here and not in a bug report. */
  const DECOR74 = ['mushroom', 'salt', 'gnome', 'sugar', 'blocks', 'shellp', 'can', 'marble', 'lamp', 'eraser'];
  for (const t of DECOR74) ok('T51.B ' + t + ' is decor (zero collision)', PROP_BLK[t] === 0);
  ok('T51.B nothing else in the table is zero',
     Object.keys(PROP_BLK).filter(k => PROP_BLK[k] === 0).sort().join(',') === DECOR74.slice().sort().join(','));

  /* the scaling rule: the table is quoted at sc === 1 and multiplied by the
     prop's own sc, exactly as the art is. This is what lets one entry serve both
     the Living Room books and the Desk books. */
  ok('T51.B a known type reads the table', propBlkR('couch', 9.9, 1) === PROP_BLK.couch);
  ok('T51.B ...and scales with sc', Math.abs(propBlkR('books', 9.9, 1.5) - PROP_BLK.books * 1.5) < 1e-9);
  ok('T51.B an absent sc is treated as 1', propBlkR('couch', 9.9) === PROP_BLK.couch);
  ok('T51.B an unknown type falls back to the call-site radius', propBlkR('nosuchprop', 1.7, 1) === 1.7);
  ok('T51.B ...and the fallback scales too', Math.abs(propBlkR('nosuchprop', 2, 1.5) - 3) < 1e-9);
  ok('T51.B decor stays zero at any scale', propBlkR('can', 1.7, 1.5) === 0);
}

/* ========================================= C: decor is walkable, blockers own a tile === */
section('T51.C decor blocks nothing; a blocker owns its own tile');
{
  const MAPS74 = Object.keys(MAPS), SEEDS74 = [740201, 740202, 740203];
  let decorBlocked = 0, blockerHomeless = 0, decorSeen = 0, blockerSeen = 0;
  for (const m of MAPS74) for (const sd of SEEDS74) {
    const M = makeMap(m, sd), N = M.N;
    for (const pr of M.props) {
      const isLine = (pr.len != null && pr.ang != null);
      if (isLine || !(pr.r > 0)) continue;
      const br = propBlkR(pr.t, pr.r, pr.sc);
      const tx = Math.floor(pr.x), ty = Math.floor(pr.y);
      if (tx < 0 || ty < 0 || tx >= N || ty >= N) continue;
      if (br === 0) { decorSeen++; }
      else { blockerSeen++; if (M.pass[ty * N + tx] !== 0) blockerHomeless++; }
    }
  }
  ok('T51.C the sample actually contains decor props', decorSeen > 0);
  ok('T51.C ...and blocking props', blockerSeen > 0);
  /* block() tests tile CENTRES and a prop sits at a fractional spot, so a radius
     under .71 can miss every centre. Any prop big enough to block at all must
     still own the tile it stands on, or it blocks nothing on some seeds. */
  ok('T51.C every blocking prop owns the tile it stands on', blockerHomeless === 0);

  /* decor is proven walkable the only way that means anything: a map built with
     the decor types forced to a large radius blocks strictly more ground. */
  {
    /* Backyard, because that is where marbles are placed with a radius at all;
       the Living Room scatters them at r === 0 and prop() would gate them out
       before the table was ever consulted. */
    const M1 = makeMap('backyard', 740204);
    let open1 = 0; for (let i = 0; i < M1.pass.length; i++) if (M1.pass[i] === 1) open1++;
    const keep = PROP_BLK.marble;
    PROP_BLK.marble = 2.5;
    const M2 = makeMap('backyard', 740204);
    PROP_BLK.marble = keep;
    let open2 = 0; for (let i = 0; i < M2.pass.length; i++) if (M2.pass[i] === 1) open2++;
    ok('T51.C a decor type given a radius really would block ground', open2 < open1);
    const M3 = makeMap('backyard', 740204);
    let open3 = 0; for (let i = 0; i < M3.pass.length; i++) if (M3.pass[i] === 1) open3++;
    ok('T51.C ...and putting the table back restores the map exactly', open3 === open1);
  }
}

/* ==================================================== D: blockLine's arithmetic === */
section('T51.D the blockLine cliff and the stub overhang');
{
  /* blockLine tests ox*ox+oy*oy against (r+.5)^2 over integer tile offsets, so
     any radius OVER .5 picks up the four neighbours and a line jumps from one
     tile wide to three. Every line prop has to clear that cliff AFTER its sc is
     applied: the Desk pencil carries sc 1.5, which is why its base is .32. */
  const LINE74 = { stick: 1, pencil: 1.5, fork: 1, rake: 1, shovel: 1 };
  for (const t in LINE74) {
    ok('T51.D ' + t + ' stays one tile wide at its largest scale',
       propBlkR(t, 0, LINE74[t]) <= 0.5);
  }
  ok('T51.D the rack is deliberately wide and above the cliff', propBlkR('rack', 0, 1) > 0.5);

  /* the cliff itself, exercised rather than asserted from arithmetic */
  {
    const mk = (r) => {
      const M = { N: 40, pass: new Uint8Array(40 * 40).fill(1) };
      blockLine(M, 10, 20, 8, 0, r);
      let n = 0; for (let i = 0; i < M.pass.length; i++) if (M.pass[i] === 0) n++;
      return n;
    };
    const narrow = mk(0.45), wide = mk(0.55);
    ok('T51.D a radius under .5 lays a single-tile line', narrow > 0 && wide > narrow * 2);
  }

  /* the stub overhang: v74 tightened max(.6,r) to max(.25,r), so a thin limb's
     ends no longer outgrow its middle. Compared at the same radius, the line is
     strictly shorter than the old rule would have made it. */
  {
    const M = { N: 60, pass: new Uint8Array(60 * 60).fill(1) };
    blockLine(M, 20, 30, 10, 0, 0.35);
    let minX = 99, maxX = -99;
    for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) if (M.pass[y * 60 + x] === 0) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
    ok('T51.D the stub overhang is a quarter tile, not .6',
       minX >= 19 && maxX <= 31);
    ok('T51.D ...and the line still spans its full drawn length', minX <= 20 && maxX >= 29);
  }
}

/* ============================================== E: the footprints, on real maps === */
section('T51.E prop footprints on generated maps');
{
  /* The ceiling is pinned from the v74 measurement pass (five maps, seed 701:
     1,920 prop-blocked tiles at v73 became 485). This asserts the release did
     what it claimed and, just as importantly, that a later edit cannot quietly
     put the invisible ground back. Counted from M.props rather than from the
     grid, so hazards, nodes and nests are not folded in. */
  const MAPS74 = Object.keys(MAPS), SEEDS74 = [701];
  const LINE_R74 = { stick: .7, pencil: .8, fork: .8, rack: 1.1, shovel: 1, rake: .8 };
  let tiles = 0, biggest = 0, worst = '';
  for (const m of MAPS74) for (const sd of SEEDS74) {
    const M = makeMap(m, sd), N = M.N;
    for (const pr of M.props) {
      const isLine = (pr.len != null && pr.ang != null);
      const br = isLine ? propBlkR(pr.t, LINE_R74[pr.t] || 0, pr.sc) : (pr.r > 0 ? propBlkR(pr.t, pr.r, pr.sc) : 0);
      if (!(br > 0)) continue;
      let n = 0;
      if (isLine) {
        const seen = new Set(), len = pr.len * (pr.sc || 1), rr2 = (br + .5) * (br + .5), R = Math.ceil(br);
        const cx = dcos(pr.ang), cy = dsin(pr.ang), t0 = -Math.max(.25, br), t1 = len + Math.max(.25, br);
        for (let t = t0; t <= t1; t += .34) {
          const bx = Math.floor(pr.x + cx * t), by = Math.floor(pr.y + cy * t);
          for (let oy = -R; oy <= R; oy++) for (let ox = -R; ox <= R; ox++) {
            if (ox * ox + oy * oy > rr2) continue;
            const tx = bx + ox, ty = by + oy;
            if (tx < 0 || ty < 0 || tx >= N || ty >= N) continue;
            const k = ty * N + tx; if (seen.has(k)) continue; seen.add(k); n++;
          }
        }
      } else {
        for (let y = Math.floor(pr.y - br); y <= pr.y + br; y++) for (let x = Math.floor(pr.x - br); x <= pr.x + br; x++) {
          if (x < 0 || y < 0 || x >= N || y >= N) continue;
          if (dhyp(x + .5 - pr.x, y + .5 - pr.y) <= br) n++;
        }
        if (n === 0) n = 1; // the own-tile floor
      }
      tiles += n;
      if (n > biggest) { biggest = n; worst = pr.t; }
    }
  }
  ok('T51.E props still block real ground (this is not a vacuous pass)', tiles > 200);
  ok(`T51.E prop collision stays far under the v73 footprint (${tiles} tiles, was 1920, ceiling 900)`,
     tiles < 900);
  ok(`T51.E no single prop takes a huge bite (worst ${worst} at ${biggest}, ceiling 60)`,
     biggest < 60);
}

/* ================================================ F: containment and determinism === */
section('T51.F the release is confined to map generation');
{
  /* SAME SEED, SAME MAP. Map generation is the only thing v74 touched in the
     sim, so it has to stay a pure function of (key, seed). */
  const a = makeMap('sandbox', 740301), b = makeMap('sandbox', 740301);
  let same = a.pass.length === b.pass.length;
  for (let i = 0; same && i < a.pass.length; i++) if (a.pass[i] !== b.pass[i]) same = false;
  ok('T51.F map generation is still a pure function of key and seed', same);
  ok('T51.F ...including the prop list', a.props.length === b.props.length);

  /* v103 REWROTE THIS ASSERTION rather than loosening it, because the contract it
     pins is the one that changed - and the replacement is the stronger of the two.
     v74's claim was that collision was DECOUPLED from placement: the call-site r
     drove where a prop went, PROP_BLK only how much ground it took away, and
     moving the table moved nothing. v103 gives placement a second question -
     "how much ground does this piece COVER" - and answers it from propArtR, which
     is PROP_BLK read back through the 0.85 the table's own header documents. So
     the table now drives placement too, deliberately: a neutral barricade keeps
     clear of a bookshelf's art, and a bookshelf keeps clear of a console's.
     A placement that ignored the table would have passed v74's version of this
     check and fails this one. */
  {
    const keep = {};
    for (const k in PROP_BLK) { keep[k] = PROP_BLK[k]; PROP_BLK[k] = 1.234; }
    const c = makeMap('sandbox', 740301);
    for (const k in keep) PROP_BLK[k] = keep[k];
    let moved = c.props.length !== a.props.length;
    for (let i = 0; !moved && i < c.props.length; i++) {
      if (c.props[i].t !== a.props[i].t || c.props[i].x !== a.props[i].x || c.props[i].y !== a.props[i].y) moved = true;
    }
    ok('T51.F the collision table drives placement now, through propArtR (v103)', moved);
    const d = makeMap('sandbox', 740301);
    let back = d.props.length === a.props.length;
    for (let i = 0; back && i < d.props.length; i++) {
      if (d.props[i].t !== a.props[i].t || d.props[i].x !== a.props[i].x || d.props[i].y !== a.props[i].y) back = false;
    }
    ok('T51.F ...and putting the table back puts every prop back where it was', back);
  }

  /* THE UI HALF MOVES NOTHING. Painting the wash is a style write on a detached
     node; hashState must not notice. */
  {
    const p = fresh74(740302, 1, 'backyard', 'dm', 'blue');
    p.res.p = 999999; p.res.e = 999999;
    const hq = p.blds.find(b2 => b2.key === 'hq');
    const bk = makeBuilding('barracks', p, Math.floor(hq.tx) + 5, Math.floor(hq.ty) + 3, true);
    bk.prog = 1; bk.queue.push('grunt');
    G.sel = [bk]; bk.sel = true;
    const h0 = hashState();
    lastSelSig = ''; refreshSelPanel(); v71Fills(); refreshSelPanel();
    ok('T51.F painting the production bar leaves hashState where it found it', hashState() === h0);
  }

  /* SAVE/LOAD. The table is a constant, never serialized, so a round trip has to
     come back identical. */
  {
    const p = fresh74(740303, 1, 'kitchen', 'dm', 'gray');
    for (let i = 0; i < 90; i++) update(DT74);
    const h0 = hashState(), s = saveState();
    loadState(s);
    ok('T51.F a save round trip still reproduces the state hash', hashState() === h0);
  }
}
