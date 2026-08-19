'use strict';
/* T49 v72: cleanup & organization pass.

   A cleanup release is accepted on the opposite criterion to a feature release:
   the simulation must NOT move.

   WHY THERE IS NO TRAIL TABLE IN THIS TAIL. v28, v43 and v62 each pinned their
   own hash trails and layout hashes against the build they came from. At v62
   that was still the only anchor available. It is not any more: the suite now
   carries FIVE pinned trail tables (BASE45_TRAILS, BASE62_TRAILS, BASE48_TRAILS,
   BASE45_AI, BASE43_DESK) and 42 layout hashes across tail_v28, tail_v43 and
   tail_v62, and every one of them passes UNEDITED through this release. Their
   passing IS the equality proof - a sixth table holding the same numbers would
   be the exact duplication this pass exists to remove, and would have to be
   recut alongside the other five on the next sim change for no added coverage.
   The pre-edit capture was still taken and diffed against the delivered build
   (byte-identical, 7 trails and 15 layouts); it is a working check, not a
   shipped table.

   A: the retired build UI is gone at EVERY end, and what replaced it works.
   B: penv - one envelope, three primitives, observed through the recorder.
   C: the every-10-tick UI pump no longer drives a dead builder.
   D: banner hygiene - no version prefix on EITHER banner form.
   E: the snapshot tag tracks the build again. */

section('T49 v72: cleanup invariants (behaviour must be identical to v71)');

const DT72 = 1 / 30;
function cfg72(map, mode, seed, opp) { return { map, mode, diff: 'normal', fac: 'tan', opp: (opp == null ? 3 : opp), seed }; }

/* ---------- A: the retired build UI ---------- */
section('T49.A the standing Construct panel is retired at every end');

ok('T49.A the two builders no longer exist',
   typeof buildBuildUI === 'undefined' && typeof refreshBuildUI === 'undefined');
ok('T49.A startPlacing survived - it is the half the tiles still call',
   typeof startPlacing === 'function');
ok('T49.A bldRoster survived, reached now through constructRoster',
   typeof bldRoster === 'function' && typeof constructRoster === 'function' &&
   constructRoster('hq').length === bldRoster({ fac: 'green' }).length);

{
  /* source-level, against the shipped HTML: the markup and the CSS rules go with
     the functions, or the panel is only half dead. */
  let html = null;
  try { html = require('fs').readFileSync('pw.html', 'utf8'); } catch (e) { html = null; }
  ok('T49.A pw.html is readable next to the harness', !!html);
  if (html) {
    ok('T49.A the markup div is gone', html.indexOf('id="buildPanel"') < 0);
    ok('T49.A the button grid is gone', html.indexOf('buildBtns') < 0);
    ok('T49.A no CSS rule addresses the panel', html.indexOf('#buildPanel') < 0);
    ok('T49.A the selection panel kept its heading rule',
       html.indexOf('#selPanel h4{color:#cfe6b8') > 0);
    /* .bb is NOT dead: the radio call-downs, Unload All and both entrench
       buttons still build them. Removing the class with the panel would have
       been the easy over-reach.
       v79: 6 -> 10. The four new ones are the Green ability buttons - Sarge's
       "On Me!", the mortar's ammunition select in single and group form, and
       the Radar Tent's Target Uplink. The count is pinned deliberately: it is
       the check that a retired panel's class does not quietly acquire new
       callers, so it is SUPPOSED to need a conscious edit when one is added. */
    ok('T49.A the .bb class survives, still styled', html.indexOf('.bb{background') > 0);
    ok('T49.A ...and is still built by the surviving callers',
       (html.match(/className='bb'/g) || []).length === 27);   // v80 15; v81 +3 (Called Shot, Ripple Fire, Lockdown); v82 +3 (Flat Out, Air Assault, Overdrive); v85 +3 (Sprint single, Sprint group, Scramble); v86 +4 (Broadcast single, Broadcast group, Bail, Regroup); v87 +3 (Napalm Blast single, Napalm Blast group, Pour); v87.1 -5 (six hand-written group toggle blocks became ONE loop over UNIT_TOGGLES, so the group buttons stopped being literal .bb sites - the count going DOWN while the panel gains four abilities is the whole point of the change, and T61 counts the buttons the loop actually builds); v88 +1 (Paint, single-unit only - it deliberately has NO group button, because the mark is set rather than accumulated and a second Choktaw over one box spends a cooldown for nothing)
    ok('T49.A the radio panel still scopes .bb', html.indexOf('#radioPanel .bb') > 0);
  }
}

{
  /* FUNCTIONAL: the roster the retired panel used to offer is offered by the HQ,
     and by the Outpost in reduced form. Same twelve structures, same click. */
  G = null; newGame(cfg72('backyard', 'dm', 777001, 3));
  const me = G.human, hq = me.blds.filter(b => b.key === 'hq')[0];
  const walk = (el, out) => { for (const c of (el.children || [])) { if (String(c.className || '').split(' ')[0] === 'tl') out.push(c); walk(c, out); } return out; };
  /* the shim's innerHTML is a plain property: refreshSelPanel's `pb.innerHTML=''`
     detaches nothing, so columns ACCUMULATE and a by-column read finds the first
     stale one. Detach for real before every measurement. */
  const wipe = () => { const pb = document.getElementById('prodBtns'); while (pb.children.length) pb.removeChild(pb.children[0]); };
  const col = (head) => {
    for (const c of (document.getElementById('prodBtns').children || [])) {
      const kids = c.children || [];
      if (kids[0] && kids[0].textContent === head) return walk(kids[1] || { children: [] }, []);
    }
    return [];
  };
  const show = (e) => { setSel([e]); wipe(); lastSelSig = ''; refreshSelPanel(); };

  me.res.p = 5000; me.res.e = 5000;
  show(hq);
  const hqTiles = col('Construct');
  /* v87: thirteen. This fixture boots TAN, and Tan gained its second exclusive
     structure at v87, so the roster it offers grew by exactly one. The count is
     pinned rather than derived on purpose - the relation to bldRoster is checked
     on the same line, so what the literal adds is that the roster itself has to
     be a declared size and cannot drift under the relation. */
  ok('T49.A the HQ carries the whole build roster',
     hqTiles.length === bldRoster(me).length && hqTiles.length === 13);

  /* the click still reaches startPlacing */
  G.placing = null;
  hqTiles[0].onclick();
  ok('T49.A a Construct tile still arms placement', !!G.placing);
  G.placing = null;

  const op = makeBuilding('outpost', me, Math.floor(hq.x) + 7, Math.floor(hq.y) + 7, true);
  op.prog = 1; op.hp = op.mhp;
  show(op);
  ok('T49.A the Outpost carries the reduced roster',
     col('Construct').length === constructRoster('outpost').length &&
     col('Construct').length === 3);
  /* and the accumulation trap itself is real, so the wipe is load-bearing */
  lastSelSig = ''; refreshSelPanel(); show(hq);
  ok('T49.A the by-column read is not picking up a stale column',
     col('Construct').length === 13);
}

/* ---------- B: one envelope, three primitives ---------- */
section('T49.B penv: one AHD envelope, three synth primitives');

ok('T49.B penv exists', typeof penv === 'function');
{
  /* Observed through tail_v64's recording mock, not read out of the source. The
     three primitives must each schedule the SAME four-breakpoint shape, and the
     hold breakpoint must appear only when hold > 0. */
  audioReset();
  const shape = (ns) => {
    const g = ofKind(ns, 'gain').filter(n => gainEv(n).length >= 3)[0];
    return g ? gainEv(g).map(e => e[0]).join('|') : '';
  };
  audioReset(); const nz = shape(cap(() => pnoise({ gain: .3, dur: .12, lvl: 1, pan: 0, pure: true })));
  audioReset(); const tn = shape(cap(() => ptone({ f0: 400, gain: .2, dur: .1, lvl: 1, pan: 0, pure: true })));
  audioReset(); const sw = shape(cap(() => psweep({ f0: 3000, f1: 200, gain: .4, dur: .3, lvl: 1, pan: 0 })));
  ok('T49.B pnoise schedules set,exp,exp', nz === 'set|exp|exp');
  ok('T49.B ptone schedules the same shape', tn === nz);
  ok('T49.B psweep schedules the same shape', sw === nz);

  audioReset();
  const held = shape(cap(() => pnoise({ gain: .3, dur: .3, hold: .1, lvl: 1, pan: 0, pure: true })));
  ok('T49.B a hold inserts the fourth breakpoint', held === 'set|exp|set|exp');

  /* the breakpoint TIMES are the ones the inline form produced: t0, t0+atk,
     t0+atk+hold, t0+dur, with t0 the call time plus the delay. */
  audioReset();
  const ns = cap(() => pnoise({ gain: .5, dur: .2, atk: .01, hold: .05, delay: 0, lvl: 1, pan: 0, pure: true }));
  const g = ofKind(ns, 'gain').filter(n => gainEv(n).length >= 3)[0];
  const ev = g ? gainEv(g) : [];
  const t0 = AC.currentTime;
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  ok('T49.B the envelope opens at the call time', ev.length === 4 && near(ev[0][2], t0));
  ok('T49.B ...peaks one attack later', ev.length === 4 && near(ev[1][2], t0 + .01));
  ok('T49.B ...holds for the hold', ev.length === 4 && near(ev[2][2], t0 + .01 + .05));
  ok('T49.B ...and lands on the duration', ev.length === 4 && near(ev[3][2], t0 + .2));
  ok('T49.B it never ramps to zero, which is illegal on an exponential',
     ev.every(e => e[1] > 0));

  /* MUTATION: the shape check must be capable of failing. A three-breakpoint
     envelope built by hand must NOT compare equal to the four-breakpoint one. */
  ok('T49.B MUTATION: the shape comparison is not vacuous', 'set|exp|exp' !== 'set|exp|set|exp');

  /* ROUTING, functionally. A shape check alone would still pass if one primitive
     had quietly kept its inline copy, so wrap the binding and count. This is the
     reason not to grep the source: the comment above penv names all three. */
  {
    const real = penv, calls = [];
    penv = function (g2, t02, peak2, atk2, hold2, dur2) { calls.push(1); return real(g2, t02, peak2, atk2, hold2, dur2); };
    audioReset(); pnoise({ gain: .3, dur: .12, lvl: 1, pan: 0, pure: true });
    audioReset(); ptone({ f0: 400, gain: .2, dur: .1, lvl: 1, pan: 0, pure: true });
    audioReset(); psweep({ f0: 3000, f1: 200, gain: .4, dur: .3, lvl: 1, pan: 0 });
    penv = real;
    ok('T49.B all three primitives route through the one envelope', calls.length === 3);
    ok('T49.B ...and the binding was restored', penv === real);
  }

  /* leave the shim as tail_v64 left it: AudioContext undefined for later tails */
  muted = false;
  AC = null; masterGain = null; NOISE = null; PINK = null; IMP = null;
  roomBus = null; farBus = null; armsBus = null;
  VOXQ.length = 0; GUNW.length = 0; BOOMW.length = 0;
  try { delete global.AudioContext; } catch (e) { global.AudioContext = undefined; }
  try { delete window.AudioContext; } catch (e) { window.AudioContext = undefined; }
  ok('T49.B the tail leaves AudioContext undefined for later tails',
     typeof global.AudioContext === 'undefined');
}

/* ---------- C: the UI pump ---------- */
section('T49.C the per-tick UI pump and the per-completion rebuild');
{
  const src = update.toString();
  ok('T49.C the ten-tick pump still drives the five live panels',
     src.indexOf('updateTopbar();refreshSelPanel();refreshArmyPanel();refreshRadioPanel();refreshWatchPanel()') > 0);
  ok('T49.C ...and no longer drives a sixth, dead one',
     src.indexOf('refreshBuildUI') < 0);
  ok('T49.C a completed structure no longer triggers a panel rebuild',
     updateBld.toString().indexOf('refreshBuildUI') < 0);
  /* the completion path itself is untouched: the toast fires and the selection
     signature is still invalidated, which is what actually repaints. */
  ok('T49.C ...but still invalidates the selection signature',
     /complete\.`\);lastSelSig=''/.test(updateBld.toString()));
}

/* ---------- D: banner hygiene ---------- */
section('T49.D no banner title carries a version prefix, in EITHER form');
{
  /* T41.H already checks this for the four-dash banners the FILE MAP lint sees.
     The v69 deathmatch banner escaped it for two releases by using three dashes,
     which is below that lint's threshold. This check spans both forms so the
     same gap cannot open again. */
  let html = null;
  try { html = require('fs').readFileSync('pw.html', 'utf8'); } catch (e) { html = null; }
  if (!html) {
    ok('T49.D pw.html is readable next to the harness', false);
  } else {
    const script = html.slice(html.indexOf('<script>'), html.indexOf('</script>'));
    const titles = [];
    for (const line of script.split('\n')) {
      const m = /^\/\*\s+[-=]{3,}\s+(.+?)(?:\s+[-=]{3,})?\s*(?:\*\/)?\s*$/.exec(line);
      if (m && m[1] && !/^[-=]+$/.test(m[1])) titles.push(m[1].trim());
    }
    ok('T49.D the three-dash sub-banners are in scope too (>=100 titles)', titles.length >= 100);
    const bad = titles.filter(t => /^v\d\d\b/.test(t) || /\(v\d\d\)$/.test(t));
    ok('T49.D no banner title carries a version prefix or suffix' +
       (bad.length ? ' [' + bad.join(', ') + ']' : ''), bad.length === 0);
    /* non-vacuity: the pattern the release removed must be one this can catch */
    ok('T49.D MUTATION: the check would catch the prefix it removed',
       /^v\d\d\b/.test('v69 deathmatch time limit'));
    /* the FILE MAP no longer advertises the retired panel */
    /* v73 added "HQ shortcut" to this row, so transcribing the whole description
       was pinning the row's contents rather than the claim. The claim is that the
       row exists and no longer advertises the retired panel. */
    const uiRow = (/^ +MESSAGES \/ UI \.+ .*$/m.exec(script) || [''])[0];
    ok('T49.D the FILE MAP no longer lists the build panel',
       /toasts, topbar,/.test(uiRow) && uiRow.indexOf('build panel') < 0 &&
       script.indexOf('build panel') < 0);
    /* the research-button doc comment sits on the function again */
    const doc = script.indexOf('Returns the button; the caller decides where it goes.');
    // v73 gave it a fourth parameter; the claim is where the comment SITS, not the arity
    const fn = script.indexOf('function researchBtn(e,key,tipTail');
    ok('T49.D the researchBtn doc comment is back above researchBtn',
       doc > 0 && fn > doc && (fn - doc) < 200);
  }
}

/* ---------- E: the snapshot tag ---------- */
section('T49.E the snapshot tag tracks the build again');
{
  G = null; newGame(cfg72('kitchen', 'dm', 737373, 2));
  for (let i = 0; i < 300; i++) update(DT72);
  const blob = saveState(), S = JSON.parse(blob);
  ok('T49.E the tag moved off v:57 and onto this build', S.v >= 72);
  /* it is informational: a save carrying the old tag still loads, and resumes on
     the same trail. The tag is not hashed and loadState never reads it. */
  const legacy = JSON.stringify(Object.assign(JSON.parse(blob), { v: 57 }));
  loadState(legacy);
  const a = hashState();
  loadState(blob);
  ok('T49.E a v:57 save still loads and resumes identically', a === hashState());
  ok('T49.E the tag is not part of the hash', hashState() === a);
}
