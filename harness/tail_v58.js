/* ---------------------------------------------------------------------------
   T-v58: menu backdrop (MENUBG).
   The module is a pure UI/render layer that only paints while #setup is shown.
   These checks pin (a) that it bakes into its OWN cache and leaves the real
   SPR pipeline cold, (b) that it cannot perturb the sim, (c) that the paint
   loop is inert whenever the menu is not on screen, and (d) the flex-squeeze
   guard that cost two rounds during mockup.
   --------------------------------------------------------------------------- */
section('v58 menu backdrop');

/* ---- 1. mount ---- */
{
 ok('v58 MENUBG defined', typeof MENUBG === 'object' && MENUBG);
 ok('v58 backdrop canvas created', !!MENUBG.cv);
 ok('v58 canvas carries the menuBg id', MENUBG.cv.id === 'menuBg');
 ok('v58 canvas sized to the window (' + MENUBG.cv.width + 'x' + MENUBG.cv.height + ')', MENUBG.cv.width === innerWidth && MENUBG.cv.height === innerHeight);
 ok('v58 canvas parented to body', MENUBG.cv.parentNode === document.body);
}

/* ---- 2. the private bake never touches the real sprite pipeline ---- */
{
 // Earlier tails have already run the real bake, so cold-start the pipeline
 // first or every assertion below passes for the wrong reason. Restored to
 // exactly what was found at the end of the block.
 const saved = { done: SPR.done, inf: SPR.inf, veh: SPR.veh, bld: SPR.bld };
 SPR.done = false; SPR.inf = {}; SPR.veh = {}; SPR.bld = {};
 MENUBG.ready = false; MENUBG.cells = { inf: {}, veh: {} };

 menubgBake();
 ok('v58 roster bake completes', MENUBG.ready);
 ok('v58 bake leaves SPR.done false', SPR.done === false);
 ok('v58 bake writes no SPR.inf entries', Object.keys(SPR.inf).length === 0);
 ok('v58 bake writes no SPR.veh entries', Object.keys(SPR.veh).length === 0);
 ok('v58 bake writes no SPR.bld entries', Object.keys(SPR.bld).length === 0);
 ok('v58 bake did fill its own cache', Object.keys(MENUBG.cells.inf).length > 0);

 // control: from the same cold start, the real bake fills exactly what the
 // menu bake left alone, so the four assertions above are not vacuous
 bakeSprites();
 ok('v58 control: bakeSprites fills SPR from cold (' + Object.keys(SPR.inf).length + ' inf keys)',
    SPR.done === true && Object.keys(SPR.inf).length > 0 && Object.keys(SPR.bld).length > 0);

 SPR.done = saved.done; SPR.inf = saved.inf; SPR.veh = saved.veh; SPR.bld = saved.bld;
 ok('v58 sprite pipeline restored for later tails', SPR.done === saved.done && SPR.inf === saved.inf);
}

/* ---- 3. roster: size, and faction exclusives kept with their home army ---- */
{
 let cells = 0;
 for (const k in MENUBG.cells.inf) for (const f in MENUBG.cells.inf[k]) cells += MENUBG.cells.inf[k][f].length;
 for (const k in MENUBG.cells.veh) for (const f in MENUBG.cells.veh[k]) cells += 1;
 ok('v58 roster is 56 baked cells (got ' + cells + ')', cells === 56);

 // the full table, for the ratio the scope was approved on
 const facs = Object.keys(FAC).filter(f => f !== 'bug');
 let full = 0;
 for (const k in U) full += (U[k].a === 'inf' ? 5 * facs.length : facs.length);
 for (const k in B) if (k !== 'barricade') full += facs.length;
 ok('v58 roster is under a quarter of the full table (' + cells + '/' + full + ')', cells < full * 0.25);

 // every exclusive appears only under the army that owns it
 const owner = {};
 for (const f of facs) { for (const u of (FAC[f].uu || [])) owner[u] = f; }
 let misplaced = [];
 for (const k in MENUBG.cells.inf) {
  if (!owner[k]) continue;
  for (const f in MENUBG.cells.inf[k]) if (f !== owner[k]) misplaced.push(k + '@' + f);
 }
 ok('v58 exclusives stay with their army' + (misplaced.length ? ' :: ' + misplaced.join(',') : ''), misplaced.length === 0);
 ok('v58 Sarge baked green', !!MENUBG.cells.inf.sarge && !!MENUBG.cells.inf.sarge.green);
 ok('v58 Flamethrower baked tan', !!MENUBG.cells.inf.flamer && !!MENUBG.cells.inf.flamer.tan);
 ok('v58 Sniper baked gray', !!MENUBG.cells.inf.sniper && !!MENUBG.cells.inf.sniper.gray);

 ok('v58 four ranks', MENUBG.lanes.length === 4);
 const men = MENUBG.lanes.reduce((a, L) => a + L.men.length, 0);
 ok('v58 seventeen marchers (got ' + men + ')', men === 17);
}

/* ---- 4. painting: no throw, and G is left exactly as found ---- */
{
 const setup = document.getElementById('setup');
 setup.style.display = 'flex';
 const gBefore = G;
 let threw = null;
 try { for (let i = 0; i < 8; i++) menubgFrame(1000 + i * 16.7); } catch (e) { threw = e; }
 ok('v58 eight menu frames paint without throwing' + (threw ? ' :: ' + threw.message : ''), !threw);
 ok('v58 G unchanged by painting', G === gBefore);
 ok('v58 canvas shown while the menu is up', MENUBG.cv.style.display === 'block');

 // the stub swap must unwind even when a painter blows up
 const g2 = G;
 try { infoStub(() => { throw new Error('boom') }); } catch (e) {}
 ok('v58 infoStub restores G after a throw', G === g2);
}

/* ---- 5. inert whenever the menu is not on screen ---- */
{
 const setup = document.getElementById('setup');
 setup.style.display = 'none';
 menubgFrame(2000);
 ok('v58 canvas hides itself when the menu is down', MENUBG.cv.style.display === 'none');

 setup.style.display = 'flex';
 document.hidden = true;
 menubgFrame(2100);
 ok('v58 canvas hides itself for a backgrounded tab', MENUBG.cv.style.display === 'none');
 document.hidden = false;
 menubgFrame(2200);
 ok('v58 canvas returns when the tab does', MENUBG.cv.style.display === 'block');
 setup.style.display = 'none';
}

/* ---- 6. the module cannot perturb the sim ---- */
{
 // same seed, same ticks, with and without a pile of menu frames in between
 G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'green', opp: 1, seed: 5858 });
 for (let i = 0; i < 60; i++) update(1 / 30);
 const clean = hashState();

 G = null;
 const setup = document.getElementById('setup');
 setup.style.display = 'flex';
 for (let i = 0; i < 50; i++) menubgFrame(9000 + i * 16.7);
 setup.style.display = 'none';
 newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'green', opp: 1, seed: 5858 });
 for (let i = 0; i < 60; i++) update(1 / 30);
 const after = hashState();

 ok('v58 50 menu frames do not shift a same-seed trail (' + clean + ')', clean === after);

 // non-vacuity: the trail is sensitive, so an equal hash means something
 G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'green', opp: 1, seed: 5859 });
 for (let i = 0; i < 60; i++) update(1 / 30);
 ok('v58 control: a different seed really does move the trail', hashState() !== clean);
 G = null;
}

/* ---- 7. private rng, and a layout that is the same every time ---- */
{
 const a = menubgRng(1234), b = menubgRng(1234);
 let same = true; for (let i = 0; i < 50; i++) if (a() !== b()) same = false;
 ok('v58 private rng is deterministic', same);

 const snap = MENUBG.lanes.map(L => L.men.map(m => m.key + ':' + Math.round(m.off)).join(',')).join('|');
 menubgColumn();
 const snap2 = MENUBG.lanes.map(L => L.men.map(m => m.key + ':' + Math.round(m.off)).join(',')).join('|');
 ok('v58 the marching column rebuilds identically', snap === snap2);
}

/* the stylesheet guarantees (scoping, the squeeze guard, the infoBtn attribute)
   are static properties of the HTML, not of the extracted script, so they are
   asserted by verify_v58.py rather than here. */
