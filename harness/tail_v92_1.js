/* tail_v92_1.js - T68: the v92.1 audio repairs, from the owner's first listen.

   v92 shipped the recorded-audio pipeline; the owner then PLAYED it and sent
   back eight findings. This tail turns each decision into a checked claim, so
   none of them can quietly regress into the take set or the voice code:

     A  a wildlife den breaks in silence - deliberately
     B  small arms PING off armor: the ricochet, and both of its gates
     C  the sniper is the loudest gun in the set, by decision
     D  the reverb sends stay under their new ceilings (the "hollow" fix)
     E  selection is brief: a bare rotor for aircraft, one diesel family for
        ground vehicles - still eight distinct engines and three rotors
     F  the infantry say the two new lines

   Everything here leans on tail_v64's capture rig (cap/audioReset/bootAudio),
   which runs earlier in the same segment - the same fake-AC instrument that
   pinned the v64 voices now pins their v92.1 repairs. */
'use strict';
section('T68 v92.1: the audio pass the owner sent back');

/* ---------- A: the silent nest ---------- */
{
  section('T68.A nest destruction is silent, and it is a decision, not a bug');
  const hq = bootAudio(921001);
  ok('T68.A sfxNestBreak builds NOTHING at a visible tile',
    cap(() => { sfxNestBreak(hq.x, hq.y); }).length === 0);
  ok('T68.A ...because its body is empty, not because a gate happened to refuse',
    !/p(imp|noise|tone|grain|sweep)\(|sndPlay\(/.test(sfxNestBreak.toString()));
  ok('T68.A the call site in kill() survives, so the silence lives in ONE place',
    kill.toString().indexOf('sfxNestBreak(') > 0);
  ok('T68.A and the take set carries no nest audio to un-silence by accident',
    !SND_B64.nest_break_0 && !ASSET_MANIFEST.snd.nest_break_0 && !SNDV.nest_break);
}

/* ---------- B: the ricochet ---------- */
{
  section('T68.B small arms ping off armor - gated twice, fed from applyDmg');
  const hq = bootAudio(921002);

  /* the voice itself: prob-gated and budget-capped, so drive it in bulk */
  const ns = cap(() => { for (let i = 0; i < 60; i++) sfxRico(hq.x, hq.y); });
  ok('T68.B sixty chances at a visible tile ring at least once', ns.length > 0);
  ok('T68.B ...and far from sixty times - the thinning is real (' + ns.length + ' nodes)',
    ns.length < 60 * 4);
  {
    const N = G.map.N; let fogged = null;
    for (let y = 0; y < N && !fogged; y++) for (let x = 0; x < N; x++) if (G.fog[y * N + x] !== 2) { fogged = { x: x + .5, y: y + .5 }; break; }
    ok('T68.B a fogged ricochet is silent - the positional gate holds',
      !fogged || cap(() => { for (let i = 0; i < 40; i++) sfxRico(fogged.x, fogged.y); }).length === 0);
  }
  ok('T68.B the recorded take is asked first, the ping synthesises as fallback',
    sfxRico.toString().indexOf("sndPlay('rico'") >= 0 && sfxRico.toString().indexOf('pimp(') > 0);
  ok('T68.B three takes ship, so repeated pings are not one sample',
    SNDV.rico.n === 3 && !!SND_B64.rico_0 && !!SND_B64.rico_2);

  /* the FEED: applyDmg, bullets only, hard targets only. Driven, not read -
     the v90.1 lesson is that a guard asserted in prose is a guard unverified. */
  audioReset();
  function hits(key, wc, n) {
    const u = makeUnit(key, G.human, hq.x, hq.y);
    const got = cap(() => { for (let i = 0; i < (n || 90); i++) { G.tick += 4; applyDmg(u, .01, wc, null, wc); } });
    const ui = G.units.indexOf(u); if (ui >= 0) G.units.splice(ui, 1);
    const pi = G.human.units.indexOf(u); if (pi >= 0) G.human.units.splice(pi, 1);
    return got.length;
  }
  ok('T68.B ninety bullets into a Tank ring', hits('tank', 'b') > 0);
  ok('T68.B bullets into a Grunt never ring - flesh is not plate', hits('grunt', 'b') === 0);
  ok('T68.B rockets into a Tank never ring - they land their own explosion', hits('tank', 'r') === 0);
  ok('T68.B the gate excludes the nest by name, alongside the armor classes',
    /ar92==='medium'\|\|ar92==='heavy'\|\|\(ar92==='bldg'&&tgt\.key!=='nest'\)/.test(applyDmg.toString()));
  ok('T68.B the feed rides inside the lastShrap throttle, not beside it',
    applyDmg.toString().indexOf('sfxRico') > applyDmg.toString().indexOf('lastShrap=G.tick'));
}

/* ---------- C + D: the mix decisions ---------- */
{
  section('T68.C the sniper is the loudest gun; T68.D the wash stays cut');
  const guns = Object.keys(SNDV).filter(k => k.indexOf('gun_') === 0);
  ok('T68.C gun_sniper out-gains every other gun in the set',
    guns.every(k => k === 'gun_sniper' || SNDV[k].g < SNDV.gun_sniper.g));
  /* the "hollow reverb" fix: small arms sends were roughly halved and the
     rendered room slapback removed from the takes. These ceilings are the
     declared new values - raising one is a conscious edit here first. */
  ok('T68.D every small-arms voice keeps rev<=.15 and far<=.30',
    guns.concat(['flame', 'throw', 'pop', 'rico']).every(k => (SNDV[k].rev || 0) <= .15 && (SNDV[k].far || 0) <= .30));
  ok('T68.D no explosion sends past rev .32 / far .60',
    ['boom_small', 'boom_med', 'boom_big', 'boom_huge', 'bld_destroy'].every(k => SNDV[k].rev <= .32 && SNDV[k].far <= .60));
}

/* ---------- E: brief selection voices ---------- */
{
  section('T68.E selection answers briefly: bare rotors, one diesel family');
  bootAudio(921003);

  /* aircraft: the turbine and gearbox whine layers are gone; what remains is
     the rotor itself, and it ends inside three quarters of a second */
  ok('T68.E sRotor builds no tone layers any more', sRotor.toString().indexOf('ptone') < 0);
  for (const k of ['heli', 'apache', 'chinook']) {
    audioReset();
    const ns = cap(() => { sRotor(k); });
    ok('T68.E the ' + k + ' answer ends inside 0.75 s (' + spanOf(ns).toFixed(2) + ')',
      ns.length > 0 && spanOf(ns) <= .75);
  }

  /* ground vehicles: every kind is the SAME voice family (chug + one breath
     of intake noise), told apart by engine size. The fundamentals sit on a
     ladder every rung of which clears T43.L's 13% distinctness band without
     leaning on jitter. T43.L still proves the eight ARE distinct and that
     the Bull idles lowest and the Bike highest; these are the new claims. */
  ok('T68.E sEngine is one diesel family - no bespoke sawtooth stacks left',
    sEngine.toString().indexOf('sawtooth') < 0 && sEngine.toString().indexOf('chug(') > 0);
  {
    const fs = Object.keys(DIESELV).map(k => DIESELV[k].f).sort((a, b) => a - b);
    let ladder = true;
    for (let i = 1; i < fs.length; i++) if (fs[i] / fs[i - 1] < 1.15) ladder = false;
    ok('T68.E the eight fundamentals are each >=15% apart (' + fs.join(', ') + ')', ladder);
  }
  for (const k of ['hvytank', 'tank', 'apc', 'arty', 'aa', 'jeep', 'bike', 'diesel']) {
    audioReset();
    const ns = cap(() => { sEngine(k); });
    ok('T68.E the ' + k + ' answer ends inside 0.7 s (' + spanOf(ns).toFixed(2) + ')',
      ns.length > 0 && spanOf(ns) <= .7);
  }
  /* the one deliberate exception: a balloon has no engine to idle (v86) */
  audioReset();
  ok('T68.E the Observation Balloon still answers with its burner, not a diesel',
    sEngine.toString().indexOf("kind==='balloon'") > 0 && cap(() => { sEngine('balloon'); }).length > 0);
}

/* ---------- F: the new bark lines ---------- */
{
  section('T68.F the infantry say the two new lines');
  ok('T68.F "Ready to move." and "Ready to fight." joined the pool',
    BARKS_INF.indexOf('Ready to move.') >= 0 && BARKS_INF.indexOf('Ready to fight.') >= 0);
  ok('T68.F ...as additions - the six v64 lines all survive',
    ['Yes sir!', 'Ready!', 'Standing by.', 'Awaiting orders.', 'Reporting in.', 'Sir!'].every(l => BARKS_INF.indexOf(l) >= 0));
}
