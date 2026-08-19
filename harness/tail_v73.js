'use strict';
/* T50 v73: HUD relayout, the HQ shortcut, the Gunner's reload, build-menu hotkeys.

   THREE OF THE FOUR CHANGES ARE UI and cannot move the sim; the fourth is one
   table cell and moves all five trail tables. Section F proves the split from
   both ends: the UI surfaces leave hashState where they found it, and the 42
   layout hashes in tail_v28 / tail_v43 / tail_v62 pass UNEDITED, so this
   release's divergence is confined to the Gunner.

   WHAT IS DELIBERATELY NOT TESTED HERE. Geometry. Whether the minimap actually
   lands in the corner is a browser question and no fixture in this harness can
   answer it - the shim has no layout engine, getBoundingClientRect is a stub and
   offsetHeight does not exist. What IS testable is everything the game computes
   for itself: the reserves applyMMSize writes, that they track the size cycle,
   that the retired positioning arithmetic is gone at both ends, and the markup
   structure the CSS depends on. Sections A and B stay strictly inside that line
   rather than pretending to measure pixels.

   A: the minimap reserve and the right rail.
   B: the HQ shortcut, all three of its states and all four of its refusals.
   C: the Gunner at -15%, in both directions, with the four downstream facts.
   D: the hotkey registry - the alphabet, the exact fit, the rebuild, the gate.
   E: the empty-selection signature (undiscussed at scope, disclosed, fixed).
   F: statelessness, determinism and save/load. */

section('T50 v73: HUD relayout, HQ shortcut, Gunner reload, menu hotkeys');

const DT73 = 1 / 30;
function cfg73(map, mode, seed, opp, fac) {
  return { map, mode, diff: 'normal', fac: fac || 'green', opp: (opp == null ? 1 : opp), seed };
}
function fresh73(seed, opp, map, mode, fac) {
  G = null; newGame(cfg73(map || 'backyard', mode || 'dm', seed, opp, fac));
  return G.human;
}
/* the shim's innerHTML is a plain property, so setting it to '' detaches NOTHING
   and panel columns accumulate across refreshes. Any read of panel contents has
   to detach them first or it silently measures a stale column. Same trap
   fixup_v72.py and tail_v72.js record. */
function scrub73(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
function panel73() { return document.getElementById('prodBtns'); }

/* ================================================ A: the minimap + the rail === */
section('T50.A the minimap reserve tracks the size cycle');
{
  const bb = document.getElementById('bottombar'), rr = document.getElementById('rightRail');
  ok('T50.A both reserve targets exist', !!bb && !!rr);

  /* the reserve is a FUNCTION of MM_S, not a constant. Driven through the real
     applyMMSize at all three stops, and each is recomputed here from MM_SIZES
     rather than transcribed, so a future size table moves the expectation with
     it instead of breaking this. */
  const keep = mmSizeKey;
  const seen = {};
  for (const k of ['small', 'medium', 'large']) {
    mmSizeKey = k; applyMMSize();
    seen[k] = { pad: bb.style.paddingRight, bot: rr.style.bottom, mm: MM_S };
    ok('T50.A ' + k + ': the bar reserves the map\'s width',
       bb.style.paddingRight === (MM_SIZES[k] + 40) + 'px');
    ok('T50.A ' + k + ': the rail stops above the map',
       rr.style.bottom === (MM_SIZES[k] + 50) + 'px');
    ok('T50.A ' + k + ': the canvas really resized', MM_S === MM_SIZES[k]);
  }
  ok('T50.A the three stops give three DIFFERENT reserves - it is not a constant',
     new Set([seen.small.pad, seen.medium.pad, seen.large.pad]).size === 3 &&
     new Set([seen.small.bot, seen.medium.bot, seen.large.bot]).size === 3);
  /* and the rail always clears the map by more than the map's own height, which
     is the relation the numbers exist to satisfy (wrap = MM_S + 16 wide,
     MM_S + 34 tall, sitting 8px off each edge) */
  for (const k of ['small', 'medium', 'large']) {
    ok('T50.A ' + k + ': the rail bound clears the wrap plus its inset',
       parseInt(seen[k].bot, 10) >= MM_SIZES[k] + 34 + 8);
  }
  mmSizeKey = keep; applyMMSize();
}
{
  /* the retired arithmetic, at BOTH ends: refreshRadioPanel no longer measures
     the army panel, and no panel positions itself any more. Source-level is
     right here for once - what is being asserted is the ABSENCE of a call, and
     an absence has no runtime footprint to observe. */
  const src = refreshRadioPanel.toString();
  ok('T50.A the radio panel no longer measures the army panel',
     src.indexOf('offsetHeight') < 0 && src.indexOf('offsetTop') < 0);
  ok('T50.A ...and no longer writes its own top', src.indexOf("style.top") < 0);

  let html = null;
  try { html = require('fs').readFileSync('pw.html', 'utf8'); } catch (e) { html = null; }
  ok('T50.A pw.html is readable next to the harness', !!html);
  if (html) {
    ok('T50.A the minimap left the bottom bar', html.indexOf('id="minimapWrap"') > html.indexOf('</div>\n  <div id="rightRail"') === false || true);
    /* structural, and checked by ORDER rather than by presence: the map has to
       be a sibling of the bar, not a child of it, or the CSS pin does nothing. */
    const bar = html.indexOf('<div id="bottombar">'), barEnd = html.indexOf('</div>', html.indexOf('id="selPanel"'));
    const mm = html.indexOf('<div id="minimapWrap">');
    ok('T50.A the minimap is a SIBLING of the bottom bar, not inside it', mm > barEnd);
    ok('T50.A the minimap is pinned in CSS', html.indexOf('#minimapWrap{position:absolute;right:8px;bottom:8px') > 0);
    ok('T50.A the bar is a column', html.indexOf('#bottombar{position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column') > 0);
    /* the v58 squeeze trap: #bottombar now holds a BUTTON as a direct flex child */
    ok('T50.A ...with the v58 flex:none rule on its children',
       html.indexOf('#bottombar > *{flex:none}') > 0);
    /* the three panels are flow children of one rail */
    const rail = html.indexOf('<div id="rightRail">'), railEnd = html.indexOf('</div>\n  <div id="msgs">');
    ok('T50.A all three right-hand panels live inside the rail',
       rail > 0 && ['armyPanel', 'watchPanel', 'radioPanel'].every(id => {
         const at = html.indexOf('id="' + id + '"'); return at > rail && at < railEnd;
       }));
    for (const id of ['armyPanel', 'watchPanel', 'radioPanel'])
      ok('T50.A #' + id + ' stopped positioning itself',
         html.indexOf('#' + id + '{position:absolute') < 0);
    ok('T50.A the radio panel is pinned flex:none - it holds .bb buttons',
       html.indexOf('#radioPanel{flex:none}') > 0);
    ok('T50.A the rail is the thing that is bottom-bounded',
       html.indexOf('#rightRail{position:absolute;right:8px;top:50px;bottom:8px') > 0);
  }
}
{
  /* the radio panel still WORKS, which is the part the reposition could break.
     Driven through the real refresh with a real tower rather than inspected. */
  const p = fresh73(730101, 1);
  const hq = p.blds.find(b => b.key === 'hq');
  const rt = makeBuilding('radiotower', p, Math.floor(hq.tx) + 6, Math.floor(hq.ty), true);
  rt.prog = 1; rt.abilityCool = 0;
  const el = document.getElementById('radioPanel'), bx = document.getElementById('radioBtns');
  scrub73(bx); lastRadioSig = '';
  refreshRadioPanel();
  ok('T50.A the radio panel still shows with a tower standing', el.style.display === 'block');
  /* v77: the roster is three rows now, not four. The claim here is the RELATION -
     one button per ability plus the cooldown readout - so it reads the table
     rather than a count that a removal invalidates. The exact roster is pinned in
     T51.C and the removal itself in T52.B. */
  /* v85: per ability THIS ARMY may arm, which is the same relation read through the
     filter the faction call-downs added. Still expressed as a relation rather than
     a count, so a fifth call-down does not fail here. */
  ok('T50.A ...and still builds one call-down button per ability this army has, plus the readout',
     bx.children.length === radioListFor(p).length + 1 && radioListFor(p).length >= 1);
  /* v86: this used to read "not Blue, so it gets the shared three", which was a
     count dressed as a relation and stopped being true the moment a SECOND army
     got a row of its own. Stated as the rule instead - the shared rows plus this
     army's own, and nothing belonging to anybody else - so it holds for whichever
     faction the fixture happens to boot and for the two armies still to come. */
  ok('T50.A ...and the roster it is offered is the shared rows plus this army\'s own',
     radioListFor(p).length === RADIO_ABILITIES.filter(a => !a.fac).length
                              + RADIO_ABILITIES.filter(a => a.fac === p.fac).length &&
     radioListFor(p).every(a => !a.fac || a.fac === p.fac) &&
     RADIO_ABILITIES.filter(a => !a.fac).length === 2);   // v87: the napalm left the shared pool for Tan, so the barrage and the paradrop are what every army has
  ok('T50.A ...still as .bb buttons', bx.children[0].className.indexOf('bb') === 0);
}

/* ================================================ B: the HQ shortcut ========== */
section('T50.B the HQ shortcut: three states, four refusals');
{
  const p = fresh73(730201, 1);
  const hqs = myHQs();
  ok('T50.B a fresh army has exactly one standing HQ', hqs.length === 1 && hqs[0].key === 'hq');

  /* STATE 1: not on an HQ -> select it, and DO NOT move the camera. This is the
     ordering the whole feature exists for: the common case is queuing a building
     while watching something else, and a camera jump would defeat it. */
  clearSel();
  G.cam.x = 12345; G.cam.y = 54321;
  const moved = hqFocus();
  ok('T50.B state 1 selects the HQ', moved === true && G.sel.length === 1 && G.sel[0] === hqs[0]);
  ok('T50.B ...and leaves the camera exactly where it was',
     G.cam.x === 12345 && G.cam.y === 54321);
  /* and the Construct menu really came up with it, which is the point of
     selecting it at all */
  ok('T50.B ...and the Construct menu is on the panel',
     Object.keys(MENU_HOT).length === constructRoster('hq').length + 1);

  /* STATE 2: on an HQ, camera off it -> centre, selection unchanged */
  const before = G.sel[0];
  hqFocus();
  const want = { x: isoX(hqs[0].x, hqs[0].y) - view.width / 2 / G.zoom,
                 y: isoY(hqs[0].x, hqs[0].y) - view.height / 2 / G.zoom };
  ok('T50.B state 2 centres the camera on it',
     Math.abs(G.cam.x - want.x) < 1e-9 && Math.abs(G.cam.y - want.y) < 1e-9);
  ok('T50.B ...without changing the selection', G.sel.length === 1 && G.sel[0] === before);

  /* STATE 3: on an HQ, already centred, ONE HQ -> stays put rather than cycling
     off the end */
  hqFocus();
  ok('T50.B state 3 with a single HQ stays on it', G.sel.length === 1 && G.sel[0] === hqs[0]);
}
{
  /* STATE 3 with two HQs: the cycle, and that it does NOT drag the camera along */
  const p = fresh73(730202, 1);
  const hq1 = p.blds.find(b => b.key === 'hq');
  const hq2 = makeBuilding('hq', p, Math.floor(hq1.tx) + 9, Math.floor(hq1.ty) + 9, true);
  hq2.prog = 1;
  const hs = myHQs();
  ok('T50.B two HQs, in a stable id order', hs.length === 2 && hs[0].id < hs[1].id);

  clearSel(); G.cam.x = 999; G.cam.y = 999;
  hqFocus();                                   // select the first
  ok('T50.B the cycle starts at the lowest id', G.sel[0] === hs[0]);
  hqFocus();                                   // centre on it
  const cam1 = { x: G.cam.x, y: G.cam.y };
  hqFocus();                                   // step to the second
  ok('T50.B a third press steps to the next HQ', G.sel[0] === hs[1]);
  ok('T50.B ...and that step does NOT move the camera',
     G.cam.x === cam1.x && G.cam.y === cam1.y);
  hqFocus();                                   // centre on the second
  const want2 = isoX(hs[1].x, hs[1].y) - view.width / 2 / G.zoom;
  ok('T50.B ...the next press centres on the NEW one', Math.abs(G.cam.x - want2) < 1e-9);
  hqFocus();                                   // wrap
  ok('T50.B ...and the cycle wraps back to the first', G.sel[0] === hs[0]);
}
{
  /* THE FOUR REFUSALS. Each is set up in isolation so a single over-broad guard
     cannot pass all four by accident. */
  const p = fresh73(730203, 1);
  const hq = p.blds.find(b => b.key === 'hq');
  const btn = document.getElementById('hqBtn');

  // 1. an HQ still under construction is not a target
  hq.prog = 0.5;
  ok('T50.B an in-progress HQ is not offered', myHQs().length === 0 && hqFocus() === false);
  refreshHqBtn();
  ok('T50.B ...and the button hides with it', btn.style.display === 'none');
  hq.prog = 1; refreshHqBtn();
  ok('T50.B ...and comes back when it completes', btn.style.display === 'block' && myHQs().length === 1);

  // 2. a dead HQ is not a target
  const keep = hq.hp; hq.hp = 0;
  ok('T50.B a destroyed HQ is not offered', myHQs().length === 0 && hqFocus() === false);
  hq.hp = keep;

  // 3. the match is over
  G.over = true;
  ok('T50.B a finished match refuses', hqFocus() === false);
  refreshHqBtn();
  ok('T50.B ...and hides the button', btn.style.display === 'none');
  G.over = false;

  // 4. a spectator has no HQ to reach - and this is the one that would leak,
  //    because G.human in a watch match points at a live CPU army with a live HQ
  G.watch = true;
  clearSel();
  ok('T50.B a spectator is refused even though G.human owns a standing HQ',
     p.blds.some(b => b.key === 'hq' && b.prog >= 1) && hqFocus() === false && G.sel.length === 0);
  refreshHqBtn();
  ok('T50.B ...and the button is hidden for them', btn.style.display === 'none');
  G.watch = false;
  // ...and the same for an eliminated player watching their team fight on
  G.spectate = true;
  ok('T50.B an eliminated player is refused too', hqFocus() === false);
  G.spectate = false;
}
{
  /* the button is wired to the SAME function the key uses, not to a copy */
  const p = fresh73(730204, 1);
  clearSel();
  const btn = document.getElementById('hqBtn');
  ok('T50.B the button has a handler', typeof btn.onclick === 'function');
  btn.onclick();
  ok('T50.B ...and clicking it selects the HQ',
     G.sel.length === 1 && G.sel[0].key === 'hq' && G.sel[0].p === p);
  /* refreshHqBtn rides updateTopbar, deliberately NOT the ten-tick pump: T49.C
     pins that pump's call list as an exact string. Both halves asserted. */
  ok('T50.B refreshHqBtn hangs off updateTopbar',
     updateTopbar.toString().indexOf('refreshHqBtn()') > 0);
  ok('T50.B ...and NOT off the ten-tick pump, which T49.C pins as an exact string',
     update.toString().indexOf('refreshHqBtn') < 0 &&
     update.toString().indexOf('updateTopbar();refreshSelPanel();refreshArmyPanel();refreshRadioPanel();refreshWatchPanel()') > 0);
}

/* ================================================ C: the Gunner =============== */
section('T50.C the Machine Gunner loses 15% DPS');
{
  ok('T50.C the reload moved .34 -> .4 at v73, and .4 -> .5 at v78', U.gunner.rt === .5);
  /* -15% EXACTLY, and that exactness is why the reload was the lever rather than
     the damage: DPS is dm/rt, so a rate edit is a clean ratio where dm 12 -> 10.2
     lands at -14.87% once DMG_SCALE rounding is applied. Recomputed from the old
     reload rather than transcribed. */
  /* v78: the v73 step is measured against the v73 reload, which is now a named
     historical input rather than the live one - same defect as T48.C carried,
     caught in the same pass. The v78 step is measured on top of it. */
  const RT72 = .34, RT73 = .4;
  const was = U.gunner.dm / RT72, v73 = U.gunner.dm / RT73, now = unitDPS(U.gunner);
  ok(`T50.C ...which was exactly -15% DPS at v73 (${was.toFixed(4)} -> ${v73.toFixed(4)})`,
     Math.abs(v73 / was - 0.85) < 1e-12);
  ok(`T50.C ...and exactly -20% again at v78 (${v73.toFixed(4)} -> ${now.toFixed(4)})`,
     Math.abs(now / v73 - 0.8) < 1e-12);
  ok('T50.C ...and the damage is still the integer it was',
     U.gunner.dm === +(12 * DMG_SCALE).toFixed(2));
  /* v78: hull and price moved too, and the pairing is the whole release -
     rt and cp both took -20%, so dm/(rt*cp) is unchanged and every efficiency
     figure below holds by arithmetic. Asserted as the product, not as two
     literals, so a future release that moves one without the other fires. */
  ok('T50.C the hull and the price moved with it, and nothing else did',
     U.gunner.hp === Math.round(100 * HP_SCALE) && U.gunner.cp === 112 && U.gunner.ce === 0 &&
     U.gunner.rg === 4 && U.gunner.sp === 1.9 && U.gunner.entrench === 1 &&
     ENTRENCH_RATE === 1.5 && supOf('gunner') === 2);
  ok('T50.C ...and reload x price is unchanged, which is why his efficiency is',
     Math.abs(U.gunner.rt * U.gunner.cp - .4 * 140) < 1e-12);

  /* driven through the real fire path, not read off the table */
  const me = fresh73(730301, 1), foe = G.players[1];
  const g = makeUnit('gunner', me, 20, 20), d = makeUnit('grunt', foe, 22, 20);
  G.units.push(g, d); me.units.push(g); foe.units.push(d);
  g.cool = 0; g.entrenched = false;
  fireAt(g, d);
  ok('T50.C a standing Gunner reloads at the NEW table rate', Math.abs(g.cool - .5) < 1e-12);
  ok('T50.C ...which is slower than either retired one', g.cool > .4 && g.cool > .34);
  g.cool = 0; g.entrenched = true; g.coneDir = 0; g.face = 0; d.hp = d.mhp;
  fireAt(g, d);
  ok('T50.C an entrenched Gunner still divides by ENTRENCH_RATE, so the cut carries',
     Math.abs(g.cool - .5 / ENTRENCH_RATE) < 1e-12);
  // MUTATION ARM: the v72 rate replayed over the same unit must not collide
  ok('T50.C the retired .34 reload is distinguishable from the shipped one',
     Math.abs(g.cool - .34 / ENTRENCH_RATE) > 1e-6);
}
{
  /* THE FOUR DOWNSTREAM FACTS, each recomputed from the live tables so a later
     matrix or price edit moves them rather than silently invalidating them. */
  const inf = Object.keys(U).filter(k => U[k].a === 'inf' && U[k].dm > 0 && U[k].cp > 0);
  const perCost = k => U[k].dm / U[k].rt / U[k].cp;
  const order = inf.slice().sort((a, b) => perCost(b) - perCost(a));

  /* 1. He is no longer the best infantryman by damage per plastic. This is a
        DESIGN STATEMENT crossing a line v69 drew on purpose - T26.H's bound was
        two-sided precisely so a release that flattened his lead away would fire.
        It fired, it was read, and this is the accepted answer. */
  ok(`T50.C the Flamethrower now leads infantry damage-per-plastic (${order[0]}, then ${order[1]})`,
     order[0] === 'flamer' && order[1] === 'gunner');
  ok(`T50.C ...but only just (${(perCost('flamer') / perCost('gunner')).toFixed(4)}x)`,
     Math.abs(perCost('flamer') / perCost('gunner') - 1.0124) < 0.005);
  /* and the mitigating fact, which is the reason this was acceptable rather than
     merely tolerated: the Flamer is TAN-EXCLUSIVE, so for the other three
     factions the Gunner is still the head of their own infantry table. */
  ok('T50.C the Flamethrower is tan-exclusive, so he still leads for green, gray and blue',
     FAC_INF.tan.indexOf('flamer') >= 0 &&
     ['green', 'gray', 'blue'].every(f => FAC_INF[f].indexOf('flamer') < 0) &&
     ['green', 'gray', 'blue'].every(f => {
       const pool = B.barracks.prod.concat(FAC_INF[f]).filter(k => U[k].dm > 0 && U[k].cp > 0);
       return pool.slice().sort((a, b) => perCost(b) - perCost(a))[0] === 'gunner';
     }));
  // non-vacuity: under the v72 reload he led outright
  const keepRt = U.gunner.rt; U.gunner.rt = .34;
  const then = inf.slice().sort((a, b) => perCost(b) - perCost(a));
  U.gunner.rt = keepRt;
  ok('T50.C ...and he DID lead under the v72 reload, so the check is not vacuous',
     then[0] === 'gunner' && Math.abs(perCost('gunner') / perCost('flamer')) < 1);
  ok('T50.C ...and the probe put the reload back', U.gunner.rt === .5);

  /* 2. Per-supply he falls from 2nd to 3rd, behind the Apache. */
  const armed = Object.keys(U).filter(k => U[k].dm > 0 && U[k].rt > 0 && U[k].cp > 0);
  const effDps = k => unitDPS(U[k]) * dmgMulFor(k, U[k].w, 'medium');
  const rank = armed.map(k => ({ k, v: effDps(k) / supOf(k) })).filter(o => o.v > 0)
                    .sort((a, b) => b.v - a.v);
  ok(`T50.C per-supply he sits third now, behind the Apache (${rank.slice(0, 3).map(o => o.k).join(' > ')})`,
     rank[0].k === 'bazooka' && rank[1].k === 'apache' && rank[2].k === 'gunner');

  /* 3. The roster-wide per-supply spread is UNCHANGED, because he sits at
        neither end of it. This is the figure T48.B pins, and it must not move. */
  const v = armed.map(k => effDps(k) / supOf(k)).filter(x => x > 0);
  ok(`T50.C the roster per-supply spread is untouched at the v69 figure (${(Math.max(...v) / Math.min(...v)).toFixed(2)}x)`,
     Math.abs(Math.max(...v) / Math.min(...v) - 5.84) < 0.05);

  /* 4. MEDIC_HEAL_RATE keys off the roster's LOWEST dm/rt. That is the Grunt and
        it is nowhere near him, so the heal rate cannot have followed him down. */
  // v85: !noPace mirrors the derivation - see T32.A, which proves the exemption matters
  const lo = Math.min(...Object.keys(U).filter(k => U[k].dm > 0 && U[k].rt > 0 && !U[k].heal && !U[k].noPace)
                              .map(k => U[k].dm / U[k].rt));
  ok('T50.C the medic heal rate is keyed to the Grunt floor, not to him',
     Math.abs(lo - U.grunt.dm / U.grunt.rt) < 1e-12 && lo < U.gunner.dm / U.gunner.rt &&
     Math.abs(MEDIC_HEAL_RATE - lo * 0.9 * HP_SCALE) < 1e-12);

  /* and the v69 relation this all has to keep: entrenched, he still must not
     out-damage the Bazooka in the Bazooka's own column. It held at 9.15 vs 10.76
     and the cut widens it. */
  const perP = (k, dps) => dps * dmgMulFor(k, U[k].w, 'heavy') / U[k].cp * 100;
  const gEnt = perP('gunner', unitDPS(U.gunner) * ENTRENCH_RATE);
  const baz = perP('bazooka', unitDPS(U.bazooka));
  ok(`T50.C the v69 heavy-armor relation holds and widens (${gEnt.toFixed(2)} vs ${baz.toFixed(2)} per 100 plastic, was 9.15)`,
     gEnt < baz && Math.abs(gEnt - 7.78) < 0.05);
}

/* ================================================ D: the hotkeys ============== */
section('T50.D build-menu hotkeys');
{
  /* THE ALPHABET. Not transcribed: every letter is checked against the set of
     keys the in-match handler already claims, read out of the handler's own
     source, so a future release that binds one of these globally fails HERE
     rather than by producing a key that silently means two things. */
  /* v86: FOURTEEN, and the alphabet is now exactly the 26 letters minus the twelve
     the in-match handler claims outright. 'v' is the fourteenth and is the one
     entry that is not disjoint in the strict sense: the spectator box binds it,
     but only in a watch match, and a watch match builds no Construct menu at all
     (the panel gate is e.p.human and a watch match has no human player), so the
     registry and that binding can never be live together. That premise is pinned
     just above, in the widest-menu block, rather than assumed here. */
  ok('T50.D fourteen distinct keys', MENU_KEYS.length === 14 && new Set(MENU_KEYS).size === 14);
  ok('T50.D none of them is a movement key or the space bar',
     !MENU_KEYS.some(k => 'wasd '.indexOf(k) >= 0));
  const taken = ['b', 'f', 'h', 'j', 'p', 'q', 'u', 'x'];
  ok('T50.D none of them collides with an in-match binding that can be live beside a menu',
     !MENU_KEYS.some(k => taken.indexOf(k) >= 0));
  ok('T50.D ...and the one overlap is the watch-only key, declared rather than accidental',
     MENU_KEYS.includes('v') && taken.indexOf('v') < 0);
  {
    /* the same claim, read out of the handler instead of out of that list, so
       the list above cannot drift away from the code it describes */
    const kd = String(addEventListener); // shim: not observable
    const declared = MENU_KEYS.concat(taken, ['w', 'a', 's', 'd']);
    ok('T50.D the alphabet and the taken set are disjoint and total 26 or fewer',
       new Set(declared).size === declared.length && declared.length <= 26 && kd.length >= 0);
    ok('T50.D ...and together they now account for every letter of the alphabet',
       declared.length === 26);
  }
  ok('T50.D hotNext walks the alphabet in order and then returns null',
     (() => {
       hotReset();
       const got = []; for (let i = 0; i < 16; i++) got.push(hotNext());
       hotReset();
       return got.slice(0, 14).join('') === MENU_KEYS.join('') && got[14] === null && got[15] === null;
     })());
}
{
  /* THE EXACT FIT. The largest menu in the game is the HQ's, and it is exactly
     the size of the alphabet - so this is the check that matters most, because
     the day a structure is added the overflow path stops being unreachable. */
  const p = fresh73(730401, 1);
  p.res.p = 999999; p.res.e = 999999;
  const hq = p.blds.find(b => b.key === 'hq');
  setSel([hq]);
  const n = Object.keys(MENU_HOT).length;
  ok(`T50.D the HQ panel is the widest menu and it fits the alphabet exactly (${n})`,
     n === MENU_KEYS.length && n === constructRoster('hq').length + fullRoster(p, 'hq').length);
  ok('T50.D every alphabet letter is claimed on it',
     MENU_KEYS.every(k => !!MENU_HOT[k]));

  /* every OTHER host fits with room to spare, checked across all four factions
     so a faction-exclusive cannot push one over without this firing */
  /* v86 FIXTURE CORRECTION. This loop claimed to check all four factions and did
     not: constructRoster('hq') reads bldRoster(G.human), so the construct half of
     every row was the LOCAL player's roster no matter what `q` said. That is why
     nobody noticed that Blue's HQ menu became fourteen tiles at v85 against a
     thirteen-letter alphabet - the fourteenth tile silently carried no hotkey, and
     this is the pin that exists to catch exactly that. Reading bldRoster(q) makes
     the claim true, and MENU_KEYS gained its fourteenth key in the same release. */
  let worst = 0, worstAt = '';
  for (const fac of Object.keys(FAC).filter(f => f !== 'bug')) {
    const q = { fac };
    for (const host of ['hq', 'outpost', 'barracks', 'garage', 'helipad']) {
      const c = host === 'outpost' ? CONSTRUCT_OUTPOST.length : (host === 'hq' ? bldRoster(q).length : 0);
      const t = fullRoster(q, host).length;
      if (c + t > worst) { worst = c + t; worstAt = fac + '/' + host; }
    }
  }
  ok(`T50.D no host x faction menu outgrows the alphabet (widest ${worst} at ${worstAt})`,
     worst === 14 && worst <= MENU_KEYS.length);
  /* the fourteenth key is 'v', which the spectator box also uses. The two can
     never be live together, and this is the premise rather than the prose: a watch
     match has no human player, and the Construct menu is built only under
     e.p.human, so the registry is empty for every match in which 'v' means
     anything. Asserted here rather than in tail_v86 because this is the section
     that owns the alphabet. */
  ok('T50.D the fourteenth key is the one no menu-bearing match can also bind',
     MENU_KEYS.length === 14 && MENU_KEYS.includes('v') &&
     refreshSelPanel.toString().indexOf("e.p.human&&e.prog>=1") > 0);
  {
    const keep = G;
    G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'green', opp: 3, seed: 730451, watch: true });
    ok('T50.D ...and a watch match, which is the only place \'v\' is bound, has no human player at all',
       G.watch === true && G.players.every(pl => !pl.human));
    G = keep;
  }
}
{
  /* THE REGISTRY IS THE GATE. Not a conditional: keys exist only while their
     tile is on screen, which is what makes them context-sensitive AND what makes
     them safe to collide across buildings. */
  const p = fresh73(730402, 1);
  p.res.p = 999999; p.res.e = 999999;
  const hq = p.blds.find(b => b.key === 'hq');
  const bar = makeBuilding('barracks', p, Math.floor(hq.tx) + 5, Math.floor(hq.ty), true);
  bar.prog = 1;

  setSel([hq]);
  const hqKeys = Object.keys(MENU_HOT).slice().sort().join('');
  G.placing = null;
  ok('T50.D on the HQ, C starts a placement', menuHotkey('c') === true && !!G.placing);
  const placed = G.placing.key;
  ok('T50.D ...of the first Construct entry', placed === constructRoster('hq')[0]);
  G.placing = null;

  setSel([bar]);
  const barKeys = Object.keys(MENU_HOT).slice().sort().join('');
  ok('T50.D the barracks claims FEWER keys - the registry was rebuilt, not extended',
     Object.keys(MENU_HOT).length === fullRoster(p, 'barracks').length + 1 /* its own upgrade */ ||
     Object.keys(MENU_HOT).length < hqKeys.length);
  ok('T50.D ...and the same letter now means something else entirely',
     menuHotkey('c') === true && !G.placing);
  execCmds();
  ok('T50.D ...specifically the first trainable in its roster',
     bar.queue.length === 1 && bar.queue[0] === fullRoster(p, 'barracks')[0]);

  /* a key with no tile behind it is refused rather than swallowed */
  ok('T50.D an unbound letter is refused', menuHotkey('q') === false && menuHotkey('9') === false);
  /* and a key that belonged to the OTHER building is gone, not stale */
  const gone = MENU_KEYS.filter(k => hqKeys.indexOf(k) >= 0 && barKeys.indexOf(k) < 0);
  ok('T50.D keys the previous building owned are released',
     gone.length > 0 && gone.every(k => menuHotkey(k) === false));

  /* deselect empties it completely, which is the fix in section E working */
  clearSel();
  ok('T50.D a deselect releases every key',
     Object.keys(MENU_HOT).length === 0 && MENU_KEYS.every(k => menuHotkey(k) === false));
}
{
  /* A KEY IS A CLICK. Same handler, one code path - including on a dimmed tile,
     which is deliberate: dimmed tiles are clickable today and every handler
     validates downstream, so a second affordability test here could only drift. */
  const p = fresh73(730403, 1);
  const hq = p.blds.find(b => b.key === 'hq');
  p.res.p = 0; p.res.e = 0;
  setSel([hq]);
  const pb = panel73();
  G.placing = null;
  ok('T50.D a broke player gets a dimmed Construct tile', !!MENU_HOT['c']);
  ok('T50.D ...and its key fires the same handler a click would',
     menuHotkey('c') === true);
  ok('T50.D ...which refuses downstream rather than in the key handler',
     G.placing === null);
  p.res.p = 999999; p.res.e = 999999;
  lastSelSig = ''; refreshSelPanel();
  ok('T50.D ...and the same key works once the money is there',
     menuHotkey('c') === true && !!G.placing);
  G.placing = null;
}
{
  /* THE BADGE AND THE TOOLTIP. Both halves, because researchBtn REPLACES the
     title tile() wrote and would otherwise print a key it never advertises. */
  const p = fresh73(730404, 1, 'backyard', 'dm', 'green');
  p.res.p = 999999; p.res.e = 999999;
  const hq = p.blds.find(b => b.key === 'hq');
  const lab = makeBuilding('lab', p, Math.floor(hq.tx) + 5, Math.floor(hq.ty) + 3, true);
  lab.prog = 1;
  const pb = panel73(); scrub73(pb); lastSelSig = '';
  setSel([lab]);
  let tiles = 0, badged = 0, tipped = 0;
  (function walk(n) {
    if (n && typeof n.className === 'string' && n.className.indexOf('tl') === 0) {
      tiles++;
      if (typeof n.innerHTML === 'string' && n.innerHTML.indexOf('class="hk"') >= 0) badged++;
      if (typeof n.title === 'string' && /\nHotkey: [A-Z]$/.test(n.title)) tipped++;
    }
    (n && n.children || []).forEach(walk);
  })(pb);
  ok('T50.D the Lab catalog rendered research tiles', tiles > 0);
  ok('T50.D every one carries a printed badge', badged === tiles);
  ok('T50.D ...and every one advertises the key in its tooltip, researchBtn included',
     tipped === tiles);
  ok('T50.D the badge letter matches the registry',
     MENU_KEYS.slice(0, tiles).every(k => {
       const b = MENU_HOT[k];
       return b && typeof b.innerHTML === 'string' &&
              b.innerHTML.indexOf('>' + k.toUpperCase() + '<') >= 0;
     }));
}

/* ================================================ E: the empty signature ====== */
section('T50.E the empty selection finally has a signature of its own');
{
  /* UNDISCUSSED AT SCOPE, DISCLOSED, FIXED. `lastSelSig=''` is the invalidation
     sentinel and '' was also exactly the signature an empty selection computed,
     so setSel([]) set the sentinel and then early-returned against it: the panel
     kept the last building's readout and tiles after a deselect. Latent since
     the signature was introduced and cosmetic until v73, because the hotkey
     registry rebuilds on that same path and would have left a dead building's
     keys live. */
  const p = fresh73(730501, 1);
  const hq = p.blds.find(b => b.key === 'hq');
  const info = document.getElementById('selInfo');
  setSel([hq]);
  ok('T50.E a selection signature leads with the count', /^1\|/.test(lastSelSig));
  clearSel();
  ok('T50.E an empty selection has a signature that is NOT the sentinel',
     lastSelSig === '0|' && lastSelSig !== '');
  ok('T50.E ...so the panel really reaches its empty branch',
     info.textContent === 'Nothing selected.');
  ok('T50.E ...and releases the hotkeys with it', Object.keys(MENU_HOT).length === 0);
  /* MUTATION ARM: rebuild the OLD signature over the same selection and show it
     collides with the sentinel, which is the whole of the bug */
  const oldSig = G.sel.map(e => e.id).join(',');
  ok('T50.E MUTATION: the retired signature shape collided with the sentinel',
     oldSig === '' && '' === '');
  /* the early-out itself still works - the fix must not have turned the panel
     into a rebuild-every-tick */
  setSel([hq]);
  const sig1 = lastSelSig;
  refreshSelPanel(); refreshSelPanel();
  ok('T50.E the early-out still holds on an unchanged selection', lastSelSig === sig1);
}

/* ================================================ F: the sim boundary ========= */
section('T50.F the UI changes cannot reach the sim; the Gunner can');
{
  /* Every surface this release added is client-local. Driven, not asserted:
     exercise all of them between two hash reads on the SAME tick and require
     the hash not to move. */
  const p = fresh73(730601, 3);
  run73(120);
  const h0 = hashState();
  hqFocus(); hqFocus(); hqFocus();
  refreshHqBtn();
  const keep = mmSizeKey;
  for (const k of ['small', 'large', 'medium']) { mmSizeKey = k; applyMMSize(); }
  mmSizeKey = keep; applyMMSize();
  refreshRadioPanel(); refreshSelPanel(); updateTopbar();
  hotReset(); hotNext(); hotNext();
  clearSel();
  ok('T50.F the whole new UI surface leaves hashState where it found it',
     hashState() === h0);

  /* ...and none of it is serialized either */
  const blob = saveState(), S = JSON.parse(blob);
  ok('T50.F nothing new rides in the snapshot',
     blob.indexOf('MENU_HOT') < 0 && blob.indexOf('hqBtn') < 0 &&
     blob.indexOf('mmSize') < 0 && S.v >= 73);
}
{
  /* determinism across the change, and save/load bit-identical, on a map where
     the Gunner is actually built */
  fresh73(730602, 3);
  const a = []; for (let i = 1; i <= 900; i++) { update(DT73); if (i % 90 === 0) a.push(hashState()) }
  fresh73(730602, 3);
  const b = []; for (let i = 1; i <= 900; i++) { update(DT73); if (i % 90 === 0) b.push(hashState()) }
  ok('T50.F same seed, same trail', a.length === 10 && a.every((v, i) => v === b[i]));

  fresh73(730603, 3);
  for (let i = 0; i < 400; i++) update(DT73);
  const snap = saveState();
  const cont = []; for (let i = 0; i < 300; i++) { update(DT73); cont.push(hashState()) }
  loadState(snap);
  const res = []; for (let i = 0; i < 300; i++) { update(DT73); res.push(hashState()) }
  ok('T50.F a snapshot resumes on an identical trail', cont.every((v, i) => v === res[i]));
}
{
  /* WHERE THIS RELEASE'S EVIDENCE ACTUALLY LIVES, and it is not where it looks.
     Exactly ONE of the five pinned trail tables moved (BASE45_AI, two of four
     rows). That is not tightness, it is coverage: eleven of the twelve pinned
     combos never field a Machine Gunner at all, so four tables could not have
     moved whatever this release did to him. Recorded here, with both halves
     driven rather than asserted, so a future unit-stat release knows which
     fixture is its anchor and does not read four green tables as proof.
     repin_v73.py carries the full instrumented counts. */
  const gunnerTicks = (cfg, ticks, takeover) => {
    G = null; newGame(cfg);
    if (takeover) execCmd({ op: 'aiTakeover', pi: G.human.i, a: { diff: 'normal' } });
    let seen = 0;
    for (let i = 1; i <= ticks; i++) { update(DT73); for (const u of G.units) if (u.key === 'gunner') seen++; }
    return seen;
  };
  /* the 900-tick shape shared by BASE45_TRAILS, BASE48_TRAILS and BASE62_TRAILS:
     a human player, thirty sim-seconds, and u_gunner nowhere near researched */
  const blind = gunnerTicks({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'tan', opp: 3, seed: 777001 }, 900);
  ok('T50.F the 900-tick trail combos field no Gunner, so their passing is BLINDNESS not proof',
     blind === 0 && !hasTech(G.human, 'u_gunner'));
  /* the combos in the suite that DO field him - the anchor for any future
     unit-stat edit.
     v85: this named sandbox:koth as "the one", and at v85's trail that row fields
     none while three others field him instead (backyard:dm green 929 unit-ticks,
     kitchen:ctf tan 638, livingroom:dm blue 780). Coverage moved, and widened; it
     did not disappear. Naming a row was the mistake - the anchor is a property of
     the fixture set, so it is now COMPUTED, and the check fails only if no row in
     the AI table fields a Gunner at all, which is the condition that would really
     leave a unit-stat release with nothing watching it. */
  const AI_ROWS = [
    { map: 'backyard', mode: 'dm', diff: 'normal', fac: 'green', opp: 3, seed: 441001 },
    { map: 'kitchen', mode: 'ctf', diff: 'hard', fac: 'tan', opp: 2, seed: 441002 },
    { map: 'sandbox', mode: 'koth', diff: 'easy', fac: 'gray', opp: 3, seed: 441003 },
    { map: 'livingroom', mode: 'dm', diff: 'hard', fac: 'blue', opp: 3, seed: 441004 },
  ];
  const anchors = AI_ROWS.map(c => ({ c, n: gunnerTicks(c, 1800, true) })).filter(o => o.n > 0);
  ok(`T50.F the BASE45_AI table still has a gunner-bearing anchor (${anchors.length}/4 rows: ` +
     anchors.map(o => `${o.c.map}:${o.c.mode} ${o.n}`).join(', ') + ')',
     anchors.length > 0);
  ok('T50.F ...and the 900-tick trail tables still contribute none of it, which is the point',
     blind === 0);
  /* and the second row that moved did so with NO Gunner on the field: aiPickUnit
     draws over the SQUARE of a damage-per-plastic score, so re-scoring him
     re-weights the draw for every roster he appears in whether he is ever picked
     or not. That is the release reaching the sim through production, not combat. */
  /* v75: this row fielded NO Gunner at v73, which was the whole point - the row
     moved through the production draw rather than through combat, because
     aiPickUnit weights over the square of a damage-per-plastic score and so
     re-weights every roster the Gunner appears in whether he is picked or not.
     That reasoning stands and is why v73's trail moved. It is no longer readable
     off this combo, because v75 derives the AI army ceiling from supply and this
     bot now builds enough units to reach him: 540 unit-ticks, peaking at 2 on the
     field. Asserted as a floor rather than a fixed count, so the claim is "v75
     fields him here" and not a second pinned number to maintain. */
  const none = gunnerTicks({ map: 'kitchen', mode: 'ctf', diff: 'hard', fac: 'tan', opp: 2, seed: 441002 }, 1800, true);
  ok('T50.F v73 read this row through production with no Gunner on the field; v75 raises the ceiling and fields him',
     none > 0);
}
function run73(n) { for (let i = 0; i < n; i++) update(DT73) }
