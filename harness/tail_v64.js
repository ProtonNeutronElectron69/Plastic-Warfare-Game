/* tail_v64.js - T43: the v64 audio synthesis rewrite.

   MEASURED PROBLEM. The v63 engine had two primitives. pnoise: one noise
   buffer, one biquad, one exponential AD envelope. ptone: one oscillator, one
   pitch sweep, the same envelope. Every sound in the game was three to six
   stacked calls to those two, which produced three audible faults: no transient
   (the fastest attack available was a 1 ms exponential RAMP, a fade rather than
   a snap), no filter motion (pnoise set f.frequency.value once and never moved
   it, so sfxBoom's four sizes were one recipe times a gain multiplier), and no
   variation (identical arguments produced an identical graph every call).

   WHY THIS TAIL EXISTS AT ALL. The shim leaves AudioContext undefined on
   purpose, so at v63 the ONLY audio coverage in the whole harness was T8.4's
   three audAt2 checks: every sfx function early-returned at `!ac()` and nothing
   downstream of it was ever executed, let alone asserted. This tail installs a
   RECORDING mock AudioContext, drives the real game code through it, and then
   asserts on what was actually built.

   That recorder is the point. Source-text assertions on synthesis code are
   worthless for the same reason they are worthless on painters: the comments
   name the very functions under test, so a grep for 'psweep' passes whether or
   not psweep is ever reached. Everything below observes the NODE GRAPH: which
   nodes were created, their types, their frequency automation, their envelope
   breakpoints, their start and stop times and what they connect to.

   Sections:
     A  the recorder itself, and that it can see the graph at all
     B  the four new primitives each build the graph they claim to
     C  eight distinct gun voices, and the transient every one of them opens with
     D  six launch voices, and the splits v63 did not have
     E  explosions: four TOPOLOGIES, monotonic in duration and low-frequency
        energy, and the ground reflection that v63 had no equivalent of
     F  building collapse, and the three death voices that replaced one tick
     G  the distance / zoom absorption model
     H  humanisation: two identical calls must NOT produce identical numbers
     I  the polyphony budget, all three guards
     J  DETERMINISM: no audio path consumes the sim rng
     K  the bus rework, the duck, and the fog gate that must still hold
     L  selection voices: eleven vehicles, eleven buildings
     M  THE HEADLINE, with a mutation check

   Sections H and M carry mutation arms: H re-runs with jitter forced off and
   requires the check to flip, M rebuilds the v63 recipes through the same
   recorder and requires them to fail the distinctness test the v64 ones pass.
   Without those arms a green here would only prove the recorder runs. */
'use strict';
section('T43 v64: audio synthesis rewrite');

/* ============================================================ A: THE RECORDER */
section('T43.A the recording mock AudioContext');

let REC = null;

function mkParam(name, node) {
  const p = {
    _name: name, _node: node, value: 0, _ev: [],
    setValueAtTime(v, t) { p.value = v; p._ev.push(['set', v, t]); return p; },
    linearRampToValueAtTime(v, t) { p.value = v; p._ev.push(['lin', v, t]); return p; },
    exponentialRampToValueAtTime(v, t) { p.value = v; p._ev.push(['exp', v, t]); return p; },
    setTargetAtTime(v, t, c) { p._ev.push(['tgt', v, t, c]); return p; },
    cancelScheduledValues(t) { p._ev.push(['cancel', null, t]); return p; }
  };
  node._params[name] = p;
  return p;
}

function mkNode(kind) {
  const n = {
    kind, _params: {}, _out: [], _startT: null, _stopT: null, _offset: null,
    type: null, buffer: null, curve: null, oversample: null,
    connect(dst) { n._out.push(dst); REC.edges.push([n, dst]); return dst; },
    disconnect() { n._out.length = 0; },
    start(t, off) { n._startT = t; n._offset = off; },
    stop(t) { n._stopT = t; }
  };
  REC.nodes.push(n);
  return n;
}

function MockAC() {
  const self = this;
  this.sampleRate = 48000;
  this.currentTime = 100;
  this.state = 'running';
  this.destination = { kind: 'destination', _out: [], connect() {}, _params: {} };
  this.resume = function () {};
  this.createGain = function () { const n = mkNode('gain'); n.gain = mkParam('gain', n); return n; };
  this.createOscillator = function () {
    const n = mkNode('osc'); n.type = 'sine'; n.frequency = mkParam('frequency', n); n.detune = mkParam('detune', n); return n;
  };
  this.createBufferSource = function () {
    const n = mkNode('bufsrc'); n.loop = false; n.playbackRate = mkParam('playbackRate', n); return n;
  };
  this.createBiquadFilter = function () {
    const n = mkNode('biquad'); n.type = 'lowpass'; n.frequency = mkParam('frequency', n); n.Q = mkParam('Q', n); n.gain = mkParam('gain', n); return n;
  };
  this.createStereoPanner = function () { const n = mkNode('panner'); n.pan = mkParam('pan', n); return n; };
  this.createConvolver = function () { const n = mkNode('convolver'); return n; };
  this.createWaveShaper = function () { const n = mkNode('shaper'); return n; };
  this.createDynamicsCompressor = function () {
    const n = mkNode('comp');
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = mkParam(k, n);
    return n;
  };
  this.createBuffer = function (ch, len, sr) {
    const data = [];
    for (let i = 0; i < ch; i++) data.push(new Float32Array(len));
    return { numberOfChannels: ch, length: len, sampleRate: sr || self.sampleRate, getChannelData(i) { return data[i]; } };
  };
}

/* the game holds AC, NOISE, PINK, IMP and the buses in module-level lets, so a
   clean slate means nulling all of them, not just AC. */
function audioReset() {
  REC = { nodes: [], edges: [] };
  AC = null; masterGain = null; NOISE = null; PINK = null; IMP = null;
  roomBus = null; farBus = null; armsBus = null;
  VOXQ.length = 0; GUNW.length = 0; BOOMW.length = 0; RICOW.length = 0;
  muted = false;
  global.AudioContext = MockAC;
  window.AudioContext = MockAC;
  ac();
  REC = { nodes: [], edges: [] };   // drop the one-time bus construction
}
/* capture everything one call builds */
function cap(fn) {
  const before = REC.nodes.length;
  fn();
  return REC.nodes.slice(before);
}
function advance(dt) { AC.currentTime += dt; }
function ofKind(ns, k) { return ns.filter(n => n.kind === k); }
/* the frequency automation on a node: [[mode,value,time],...] */
function freqEv(n) { return (n._params.frequency && n._params.frequency._ev) || []; }
function gainEv(n) { return (n._params.gain && n._params.gain._ev) || []; }
/* the latest scheduled stop across a capture: how long the sound actually runs */
function spanOf(ns) {
  let t0 = Infinity, t1 = -Infinity;
  for (const n of ns) {
    if (n._startT != null) { if (n._startT < t0) t0 = n._startT; }
    if (n._stopT != null) { if (n._stopT > t1) t1 = n._stopT; }
    for (const k in n._params) for (const e of n._params[k]._ev) if (e[2] != null && e[2] > t1) t1 = e[2];
  }
  return (t1 > -Infinity && t0 < Infinity) ? (t1 - t0) : 0;
}
/* the lowest frequency any oscillator in the capture is asked to produce */
function lowestOsc(ns) {
  let lo = Infinity;
  for (const n of ofKind(ns, 'osc')) for (const e of freqEv(n)) if (e[1] < lo) lo = e[1];
  return lo === Infinity ? null : lo;
}
/* THE DISTINCTNESS RELATION, and why it is a ratio test rather than a string
   fingerprint. Every primitive humanises frequency by +/-6%, so two runs of the
   SAME voice never produce the same numbers and any hash of the raw values would
   report all 24 combat sounds as distinct for free. fvec lifts the
   characteristic frequency of every filter and oscillator in creation order;
   sameVoice calls two captures the same voice when the vectors have equal shape
   and every corresponding entry is within 13%. Two runs of one recipe differ by
   at most 12.4% and must therefore compare EQUAL; two recipes that differ by
   more than 13% anywhere must compare DIFFERENT. T43.C proves both directions. */
function fvec(ns) {
  const v = [];
  for (const n of ns) {
    if (n.kind === 'biquad') { const e = freqEv(n); v.push(e.length ? e[0][1] : n.frequency.value); }
    else if (n.kind === 'osc') { const e = freqEv(n); if (e.length) v.push(e[0][1]); }
  }
  return v;
}
function sameVoice(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) { const r = a[i] / b[i]; if (!(r > 1 / 1.13 && r < 1.13)) return false; }
  return true;
}
/* The GRAPH SHAPE of a capture: node counts by kind plus the filter and
   oscillator types, with no frequencies in it at all. Jitter cannot touch this,
   and neither can a gain multiplier, which is exactly what makes it the right
   instrument for "v63 sized its explosions by scaling one recipe". */
function shape(ns) {
  const p = [];
  for (const k of ['bufsrc', 'osc', 'biquad', 'shaper', 'gain', 'panner']) p.push(k + ofKind(ns, k).length);
  p.push('bq:' + ofKind(ns, 'biquad').map(n => n.type).sort().join(','));
  p.push('osc:' + ofKind(ns, 'osc').map(n => n.type).sort().join(','));
  return p.join('|');
}
/* how many mutually-distinct voices a list of captures contains */
function distinct(vecs) {
  const reps = [];
  for (const v of vecs) { if (!reps.some(r => sameVoice(r, v))) reps.push(v); }
  return reps.length;
}
/* Total scheduled energy below `hz`: peak envelope level times envelope length,
   summed over every oscillator that reaches that low. The envelope lives on the
   GAIN node the oscillator feeds, not on the oscillator, so follow the edge. */
function lowEnergy(ns, hz) {
  let e = 0;
  for (const n of ofKind(ns, 'osc')) {
    let f = Infinity;
    for (const ev of freqEv(n)) if (ev[1] < f) f = ev[1];
    if (f > hz) continue;
    let g = null;
    for (const o of n._out) if (o.kind === 'gain') { g = o; break; }
    if (!g) continue;
    const ev = gainEv(g);
    if (ev.length < 2) continue;
    let pk = 0;
    for (const x of ev) if (x[1] > pk) pk = x[1];
    e += pk * Math.max(0, ev[ev.length - 1][2] - ev[0][2]);
  }
  return e;
}

/* Every positional sfx gates on audAt, which needs a live game AND a fog map
   that has actually been stepped: fog is 0 on the tick newGame returns, so a
   boot with no ticks makes the whole engine silent and every check below
   vacuous. bootAudio boots, steps six ticks, sizes the view and parks the
   camera on the HQ so the source is centred, visible and close. */
let SRC_X = 0, SRC_Y = 0;
function bootAudio(seed, fac) {
  G = null;
  newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: fac || 'green', opp: 1, seed: seed });
  for (let i = 0; i < 6; i++) update(1 / 30);
  view.width = 1200; view.height = 800; G.zoom = 1;
  const hq = G.human.blds.find(b => b.key === 'hq');
  G.cam.x = isoX(hq.x, hq.y) - view.width / 2;
  G.cam.y = isoY(hq.x, hq.y) - view.height / 2;
  SRC_X = hq.x; SRC_Y = hq.y;
  audioReset();
  return hq;
}

{
  audioReset();
  ok('T43.A the mock context installs and ac() returns it', !!AC && AC instanceof MockAC);
  const ns = cap(() => { ptone({ f0: 440, dur: 0.2, gain: 0.3, pure: 1 }); });
  ok('T43.A a ptone call is observable as real nodes', ns.length >= 2);
  ok('T43.A ptone builds an oscillator and a gain', ofKind(ns, 'osc').length === 1 && ofKind(ns, 'gain').length >= 1);
  const osc = ofKind(ns, 'osc')[0];
  ok('T43.A the oscillator is started and stopped', osc._startT != null && osc._stopT != null);
  ok('T43.A the recorder sees the envelope breakpoints', gainEv(ofKind(ns, 'gain')[0]).length >= 3);
  /* non-vacuity: a capture around nothing must record nothing */
  ok('T43.A the recorder can come back empty', cap(() => {}).length === 0);
  /* and muted must build nothing at all */
  muted = true;
  ok('T43.A muted builds no nodes', cap(() => { ptone({ f0: 440, dur: .2 }); pnoise({ freq: 900 }); pimp({ freq: 2000 }); psweep({}); }).length === 0);
  muted = false;
}

/* ==================================================== B: THE NEW PRIMITIVES */
section('T43.B the four new primitives build what they claim');
{
  audioReset();

  /* pimp: THE TRANSIENT. A buffer one-shot through a filter and a saturator,
     under ~20 ms end to end. This is the thing v63 could not make. */
  const imp = cap(() => { pimp({ freq: 2400, gain: .4, drive: 2.2 }); });
  ok('T43.B pimp plays a buffer source', ofKind(imp, 'bufsrc').length === 1);
  ok('T43.B pimp saturates through a waveshaper', ofKind(imp, 'shaper').length === 1);
  ok('T43.B the drive curve is a real transfer curve', !!ofKind(imp, 'shaper')[0].curve && ofKind(imp, 'shaper')[0].curve.length === 512);
  const isrc = ofKind(imp, 'bufsrc')[0];
  ok('T43.B pimp is a genuine transient (under 25 ms of scheduled life)', (isrc._stopT - isrc._startT) <= 0.025);
  ok('T43.B the impulse buffer is short (under 10 ms)', isrc.buffer && isrc.buffer.length < AC.sampleRate * 0.01);
  ok('T43.B the impulse buffer opens at full scale', isrc.buffer && Math.abs(isrc.buffer.getChannelData(0)[0]) === 1);
  ok('T43.B pimp uses a flat gain, not a ramp (the buffer IS the envelope)',
     gainEv(ofKind(imp, 'gain')[0]).length === 0 && ofKind(imp, 'gain')[0].gain.value > 0);

  /* psweep: THE BODY. The defining property is that the filter cutoff MOVES. */
  const sw = cap(() => { psweep({ f0: 4000, f1: 200, sweep: .25, dur: .4, gain: .6 }); });
  const swf = ofKind(sw, 'biquad').filter(n => freqEv(n).length >= 2);
  ok('T43.B psweep automates a filter cutoff', swf.length === 1);
  if (swf.length) {
    const ev = freqEv(swf[0]);
    ok('T43.B the cutoff FALLS across the sound', ev[0][1] > ev[ev.length - 1][1]);
    ok('T43.B it falls by at least a factor of 8', ev[0][1] / ev[ev.length - 1][1] >= 8);
    ok('T43.B the sweep is a ramp, not a jump', ev.some(e => e[0] === 'exp' || e[0] === 'lin'));
    ok('T43.B psweep is a low-pass', swf[0].type === 'lowpass');
  }
  /* the v63 engine could not do this: prove pnoise still does NOT move its filter */
  const pn = cap(() => { pnoise({ freq: 1800, q: 1, dur: .1 }); });
  ok('T43.B pnoise still sets a static cutoff (psweep is the only sweeper)',
     ofKind(pn, 'biquad').every(n => freqEv(n).length === 0));

  /* pink noise is a different buffer from white, and it has more low-end */
  audioReset();
  const w = cap(() => { pnoise({ freq: 900, dur: .1 }); })[0].buffer;
  const p = cap(() => { pnoise({ freq: 900, dur: .1, pink: 1 }); })[0].buffer;
  ok('T43.B the pink buffer is not the white buffer', w !== p);
  function rms(buf, from, to) {
    const d = buf.getChannelData(0); let s = 0, n = 0;
    for (let i = from; i < to; i++) { s += d[i] * d[i]; n++; }
    return Math.sqrt(s / n);
  }
  /* a one-pole difference is a crude high-pass; pink must lose far more of its
     energy to it than white does, which is what "1/f" means in practice */
  function hpLoss(buf) {
    const d = buf.getChannelData(0); let prev = 0, s = 0, s2 = 0;
    for (let i = 0; i < 40000; i++) { const h = d[i] - prev; prev = d[i]; s += h * h; s2 += d[i] * d[i]; }
    return Math.sqrt(s / 40000) / Math.sqrt(s2 / 40000);
  }
  ok('T43.B the pink buffer really is low-frequency weighted', hpLoss(p) < hpLoss(w) * 0.7);
  ok('T43.B both buffers are two seconds long', w.length === AC.sampleRate * 2 && p.length === AC.sampleRate * 2);
  ok('T43.B both buffers are non-silent', rms(w, 0, 20000) > 0.1 && rms(p, 0, 20000) > 0.01);

  /* pgrain: n scattered grains, front-loaded, spread in pan */
  audioReset();
  const gr = cap(() => { pgrain({ n: 12, freq: 2000, span: .6, gain: .1, gdur: .05, spread: .5 }); });
  const gsrc = ofKind(gr, 'bufsrc');
  ok('T43.B pgrain builds one voice per grain', gsrc.length === 12);
  const starts = gsrc.map(n => n._startT).sort((a, b) => a - b);
  ok('T43.B the grains are scattered in time, not stacked', starts[starts.length - 1] - starts[0] > 0.1);
  ok('T43.B every grain lands inside the requested span', starts[starts.length - 1] - starts[0] <= 0.62);
  /* Front-loading, measured over enough grains to be a real test. The bias
     exponent puts ~61% of grains in the first half of the span; the median of a
     single 12-grain call sits well inside one standard deviation of the
     midpoint, so pooling 200 grains is what makes this a measurement rather
     than a coin flip. */
  let early = 0, total = 0;
  for (let r = 0; r < 20; r++) {
    audioReset();
    const g2 = ofKind(cap(() => { pgrain({ n: 10, freq: 2000, span: .6, gain: .1, gdur: .05 }); }), 'bufsrc');
    const base = Math.min.apply(null, g2.map(n => n._startT));
    for (const n of g2) { total++; if (n._startT - base < 0.3) early++; }
  }
  ok('T43.B the scatter is front-loaded [' + Math.round(100 * early / total) + '% in the first half]',
     total >= 200 && early / total > 0.53);
  ok('T43.B the grains are panned apart', new Set(ofKind(gr, 'panner').map(n => n.pan.value)).size >= 6);
  ok('T43.B each grain is short', gsrc.every(n => (n._stopT - n._startT) < .12));
}

/* ======================================================== C: THE GUN VOICES */
section('T43.C eight distinct gun voices');
{
  bootAudio(640001);
  const KINDS = ['rifle', 'smg', 'carbine', 'hmg', 'vmg', 'amg', 'sniper', 'tower'];
  const fp = {};
  for (const k of KINDS) {
    audioReset();
    const ns = cap(() => { sfxGun(SRC_X, SRC_Y, k, null, null); });
    fp[k] = fvec(ns);
    ok('T43.C ' + k + ' builds a real voice', ns.length >= 6);
    /* every weapon opens with a transient: a waveshaped buffer one-shot under 25 ms */
    const trans = ofKind(ns, 'bufsrc').filter(n => n._stopT != null && (n._stopT - n._startT) <= 0.025);
    ok('T43.C ' + k + ' opens with a sub-25 ms transient', trans.length >= 1);
    ok('T43.C ' + k + ' saturates that transient', ofKind(ns, 'shaper').length >= 1);
  }
  const nd = distinct(KINDS.map(k => fp[k]));
  ok('T43.C all eight gun voices are distinct [' + nd + '/8]', nd === 8);
  /* BOTH DIRECTIONS of the relation, or the count above proves nothing: the same
     voice twice must compare EQUAL despite the humanisation, and two different
     voices must compare DIFFERENT. */
  audioReset(); const r1 = fvec(cap(() => sfxGun(SRC_X, SRC_Y, 'rifle', null, null)));
  audioReset(); const r2 = fvec(cap(() => sfxGun(SRC_X, SRC_Y, 'rifle', null, null)));
  ok('T43.C the relation calls one voice equal to itself across the jitter', sameVoice(r1, r2));
  ok('T43.C and it separates the rifle from the sniper', !sameVoice(r1, fp['sniper']));
  ok('T43.C and the SMG from the vehicle MG', !sameVoice(fp['smg'], fp['vmg']));
  /* the specific v63 collision: these six shared ONE voice */
  const collided = ['hmg', 'vmg', 'amg', 'carbine', 'smg', 'tower'];
  ok('T43.C the six weapons that shared v63\u2019s mg voice are now six voices',
     distinct(collided.map(k => fp[k])) === 6);
  /* design intent: the heavy MG and the sniper carry more weight than the light ones */
  audioReset(); const hmgN = cap(() => sfxGun(SRC_X, SRC_Y, 'hmg', null, null));
  audioReset(); const smgN = cap(() => sfxGun(SRC_X, SRC_Y, 'smg', null, null));
  audioReset(); const snpN = cap(() => sfxGun(SRC_X, SRC_Y, 'sniper', null, null));
  ok('T43.C the heavy MG reaches lower than the SMG', lowestOsc(hmgN) < lowestOsc(smgN));
  ok('T43.C the sniper report outlasts the SMG', spanOf(snpN) > spanOf(smgN) * 1.8);
  ok('T43.C the sniper carries a supersonic zip (a second swept filter)',
     ofKind(snpN, 'biquad').filter(n => freqEv(n).length >= 2).length >= 1);

  /* gunKind must actually route the eight, from real units */
  const P = G.human;
  function kindOf(key) { const u = makeUnit(key, P, 5, 5); const k = gunKind(u); const i = G.units.indexOf(u); if (i >= 0) G.units.splice(i, 1); const j = P.units.indexOf(u); if (j >= 0) P.units.splice(j, 1); return k; }
  ok('T43.C gunKind routes the Grunt to rifle', kindOf('grunt') === 'rifle');
  ok('T43.C gunKind routes the Machine Gunner to hmg', kindOf('gunner') === 'hmg');
  ok('T43.C gunKind routes Sarge to carbine', kindOf('sarge') === 'carbine');
  ok('T43.C gunKind routes the MG Jeep to vmg', kindOf('jeep') === 'vmg');
  ok('T43.C gunKind routes the Huey to amg', kindOf('heli') === 'amg');
  ok('T43.C gunKind routes the Scout Bike to smg', kindOf('bike') === 'smg');
  ok('T43.C gunKind routes the Paratrooper to smg', kindOf('para') === 'smg');
  ok('T43.C gunKind routes the Sniper to sniper', kindOf('sniper') === 'sniper');
  ok('T43.C gunKind routes a structure to tower', gunKind({ kind: 'bld', key: 'guardtower', t: {} }) === 'tower');
  /* v63 put all six of these in one bucket; prove the bucket is gone */
  ok('T43.C no two of the six ex-mg units share a gunKind',
     new Set(['gunner', 'jeep', 'heli', 'sarge', 'bike'].map(kindOf)).size === 5);
}

/* ===================================================== D: THE LAUNCH VOICES */
section('T43.D six launch voices');
{
  bootAudio(640002, 'tan');
  const P = G.human;
  function mk(key) { return makeUnit(key, P, 6, 6); }
  ok('T43.D the Tank takes the medium cannon', launchKind(mk('tank'), 's') === 'cannon');
  ok('T43.D the Bull takes its own heavier cannon', launchKind(mk('bulltank'), 's') === 'cannon_hvy');
  ok('T43.D the Mortar Squad takes the mortar', launchKind(mk('mortar'), 'm') === 'mortar');
  ok('T43.D the Rocket Artillery no longer sounds like a mortar', launchKind(mk('arty'), 'm') === 'artyrocket');
  ok('T43.D the AA truck no longer sounds like a bazooka', launchKind(mk('aatruck'), 'a') === 'aa');
  ok('T43.D the Bazooka keeps the rocket voice', launchKind(mk('bazooka'), 'r') === 'rocket');

  const LK = ['cannon', 'cannon_hvy', 'mortar', 'rocket', 'aa', 'artyrocket'];
  const sig = {};
  for (const k of LK) {
    audioReset();
    const ns = cap(() => { sfxLaunch(SRC_X, SRC_Y, k, null, null); });
    sig[k] = fvec(ns);
    ok('T43.D ' + k + ' builds a real voice', ns.length >= 6);
  }
  ok('T43.D all six launch voices are distinct [' + distinct(LK.map(k => sig[k])) + '/6]',
     distinct(LK.map(k => sig[k])) === 6);

  audioReset(); const cn = cap(() => sfxLaunch(SRC_X, SRC_Y, 'cannon', null, null));
  audioReset(); const ch = cap(() => sfxLaunch(SRC_X, SRC_Y, 'cannon_hvy', null, null));
  audioReset(); const mo = cap(() => sfxLaunch(SRC_X, SRC_Y, 'mortar', null, null));
  audioReset(); const ar = cap(() => sfxLaunch(SRC_X, SRC_Y, 'artyrocket', null, null));
  ok('T43.D the Bull\u2019s cannon reaches lower than the Tank\u2019s', lowestOsc(ch) < lowestOsc(cn));
  ok('T43.D the Bull\u2019s cannon rings longer than the Tank\u2019s', spanOf(ch) > spanOf(cn));
  ok('T43.D the mortar is the quiet one (fewest layers)', mo.length < cn.length && mo.length < ar.length);
  ok('T43.D the mortar is built on a high-Q tube resonance',
     ofKind(mo, 'biquad').some(n => n.Q.value >= 4));
  ok('T43.D the artillery salvo outlasts the tank shot', spanOf(ar) > spanOf(cn));
  ok('T43.D every launch sweeps a filter (the muzzle blast body)',
     [cn, ch, ar].every(ns => ofKind(ns, 'biquad').some(n => freqEv(n).length >= 2)));
}

/* ======================================================== E: THE EXPLOSIONS */
section('T43.E four explosion topologies, not four gain multipliers');
{
  const SZ = ['small', 'med', 'big', 'huge'];
  const hq = bootAudio(640003, 'gray');
  /* with no game at all, audAt returns null and nothing is built: prove the gate
     still bites before relying on it for everything below */
  const keep = G; G = null;
  audioReset();
  ok('T43.E with no game state an explosion is silent', cap(() => { sfxBoom(0, 0, 'med'); }).length === 0);
  G = keep;
  const B = {};
  for (const z of SZ) {
    audioReset();
    B[z] = cap(() => { sfxBoom(hq.x, hq.y, z); });
    advance(1.5);
    ok('T43.E ' + z + ' builds a real explosion', B[z].length >= 8);
    ok('T43.E ' + z + ' opens with a transient', ofKind(B[z], 'shaper').length >= 1);
    ok('T43.E ' + z + ' sweeps a filter for its body',
       ofKind(B[z], 'biquad').some(n => freqEv(n).length >= 2));
  }
  /* TOPOLOGY, not gain: small must carry no sub-bass oscillator at all */
  ok('T43.E small carries no sub-bass', (lowestOsc(B.small) == null) || lowestOsc(B.small) > 100);
  ok('T43.E med, big and huge all carry one', ['med', 'big', 'huge'].every(z => lowestOsc(B[z]) < 100));
  /* fundamentals fall as size rises, and nothing goes below 28 Hz */
  ok('T43.E the fundamental falls med > big > huge',
     lowestOsc(B.med) > lowestOsc(B.big) && lowestOsc(B.big) > lowestOsc(B.huge));
  ok('T43.E nothing is written below 28 Hz, jitter included',
     SZ.every(z => lowestOsc(B[z]) == null || lowestOsc(B[z]) >= 27.9));
  ok('T43.E the four fundamental bands cannot overlap under jitter',
     lowestOsc(B.med) > lowestOsc(B.big) * 1.06 && lowestOsc(B.big) > lowestOsc(B.huge) * 1.02);
  /* monotonic in duration and in low-frequency energy */
  ok('T43.E duration is monotonic across the four sizes',
     spanOf(B.small) < spanOf(B.med) && spanOf(B.med) < spanOf(B.big) && spanOf(B.big) < spanOf(B.huge));
  ok('T43.E low-frequency energy is monotonic across the four sizes',
     lowEnergy(B.small, 120) < lowEnergy(B.med, 120) &&
     lowEnergy(B.med, 120) < lowEnergy(B.big, 120) &&
     lowEnergy(B.big, 120) < lowEnergy(B.huge, 120));
  /* the debris field grows with the blast */
  ok('T43.E the debris field grows with size', ofKind(B.small, 'bufsrc').length < ofKind(B.huge, 'bufsrc').length);
  /* THE GROUND REFLECTION. A delayed second thump is what puts a blast on the
     ground; v63 had nothing of the kind. small must not have one, huge has two. */
  function delayedSubs(ns, t0) {
    return ofKind(ns, 'osc').filter(n => n._startT > t0 + 0.04 && freqEv(n).length && freqEv(n)[0][1] < 120).length;
  }
  const t0 = 100;
  ok('T43.E small has no ground reflection', delayedSubs(B.small, t0) === 0);
  ok('T43.E med and big each have one', delayedSubs(B.med, t0) >= 1 && delayedSubs(B.big, t0) >= 1);
  ok('T43.E huge has two', delayedSubs(B.huge, t0) >= 2);
  /* the sizes must differ in SHAPE, not only in level: node counts must differ */
  ok('T43.E the four sizes are four different graphs',
     new Set(SZ.map(z => B[z].length + ':' + ofKind(B[z], 'osc').length)).size === 4);
}

/* ============================================ F: COLLAPSE AND THE DEATH VOICES */
section('T43.F the building collapse and the three death voices');
{
  const hq = bootAudio(640004, 'blue');
  audioReset(); const col = cap(() => { sfxBuildingDestroy(hq.x, hq.y); }); advance(4);
  audioReset(); const hug = cap(() => { sfxBoom(hq.x, hq.y, 'huge'); }); advance(4);
  ok('T43.F a collapse is a bigger event than the biggest explosion', col.length > hug.length);
  ok('T43.F it runs longer than a huge blast', spanOf(col) > spanOf(hug));
  /* the structural groan: detuned sawtooths that sag, and that v63 had no analogue for */
  const saws = ofKind(col, 'osc').filter(n => n.type === 'sawtooth' && freqEv(n).length >= 2 && freqEv(n)[0][1] > freqEv(n)[1][1]);
  ok('T43.F the structural groan is three detuned falling sawtooths', saws.length === 3);
  /* v67: measure the detune with humanisation PINNED. ajit() rides on unseeded
     Math.random at JIT_F = 0.06, and the recipe's nominal f0 values sit ~6% apart,
     so the jittered ranges overlap and two of the three round to the same integer
     on ~3.8% of runs (measured, 400 trials, on the untouched v66 build). That is a
     flaky fixture, not a flaky release: it was failing at this rate before v67 and
     the v67 map rework merely happened to land on a failing draw. Pinning the
     jitter to its centre asserts what the assertion always meant - that the RECIPE
     specifies three distinct oscillators - instead of asserting that a coin came up
     heads. The jitter itself is still covered, deliberately, by T43.H. */
  const _rnd = Math.random;
  let sawF;
  try { Math.random = () => 0.5;
    audioReset();
    const colP = cap(() => { sfxBuildingDestroy(hq.x, hq.y); }); advance(4);
    sawF = ofKind(colP, 'osc')
      .filter(n => n.type === 'sawtooth' && freqEv(n).length >= 2 && freqEv(n)[0][1] > freqEv(n)[1][1])
      .map(n => freqEv(n)[0][1]);
  } finally { Math.random = _rnd; }
  ok('T43.F the pinned capture still finds the three sawtooths', sawF.length === 3);
  ok('T43.F they are detuned against each other', new Set(sawF.map(f => Math.round(f))).size === 3);
  /* non-vacuity: pinning must not have flattened them onto one frequency */
  ok('T43.F the pinned frequencies are genuinely three values, not one repeated',
     sawF.length === 3 && Math.max(...sawF) - Math.min(...sawF) > 1);
  ok('T43.F the groan starts after the detonation', saws.every(n => n._startT > 100.1));
  /* rubble rain: many grains, long after the blast */
  const late = ofKind(col, 'bufsrc').filter(n => n._startT > 100.4);
  ok('T43.F rubble rains for well over a second after the blast', late.length >= 15);
  ok('T43.F the last rubble lands at least 1.5 s in',
     Math.max.apply(null, ofKind(col, 'bufsrc').map(n => n._startT)) > 101.5);
  /* the v63 fundamental fell to 14 Hz, which is headroom nobody hears */
  ok('T43.F the collapse fundamental stops at 28 Hz or above', lowestOsc(col) >= 27.9);

  /* three death voices where v63 had one generic tick - two since v92.1: the
     owner decided a wildlife den breaks SILENTLY, so sfxNestBreak now builds
     nothing on purpose. T68.A carries that claim; here the survivors. */
  audioReset(); const pop = cap(() => { sfxPop(hq.x, hq.y); }); advance(1);
  audioReset(); const stb = cap(() => { sfxStructBreak(hq.x, hq.y); }); advance(1);
  ok('T43.F sfxPop builds a voice', pop.length >= 5);
  ok('T43.F sfxStructBreak builds a voice', stb.length >= 5);
  ok('T43.F the two death voices are two different sounds',
     distinct([fvec(pop), fvec(stb)]) === 2);
  /* the plastic snap: a high-Q resonance is the whole character of it */
  ok('T43.F the plastic pop is built on high-Q resonances',
     ofKind(pop, 'biquad').filter(n => n.Q.value >= 8).length >= 2);
  /* v92.1: the nest-reaches-lower comparison went with the nest voice, and
     the no-detonation pin was REVERSED on purpose: a wall dying under fire is
     a small blast now (the owner heard the old rattle as a chime), and the
     only caller left is combat - selling has used the full teardown since
     v87.1. The transient the old pin forbade is now required. */
  ok('T43.F a wall dying under fire opens on a detonation transient now',
     ofKind(stb, 'shaper').length >= 1 && lowestOsc(stb) < 100);
  ok('T43.F the v63 generic tick is gone from the build', typeof sfxBreak === 'undefined');
}

/* ============================================== G: DISTANCE AND ZOOM MODEL */
section('T43.G distance and zoom absorption');
{
  const hq = bootAudio(640005);
  function centre(z) { G.zoom = z; G.cam.x = isoX(hq.x, hq.y) - view.width / (2 * z); G.cam.y = isoY(hq.x, hq.y) - view.height / (2 * z); }

  centre(1);
  const near = audAt(hq.x, hq.y);
  ok('T43.G audAt returns the new distance field', near && typeof near.d === 'number');
  ok('T43.G it still returns gain and pan', near && typeof near.gain === 'number' && typeof near.pan === 'number');
  ok('T43.G dead centre at full zoom is the closest the model gets', near.d < 0.2);
  /* pull the camera back: the same tile must read as further away */
  centre(0.5);
  const wide = audAt(hq.x, hq.y);
  ok('T43.G zooming out makes the same tile read as more distant', wide.d > near.d + 0.15);
  centre(2.4);
  const tight = audAt(hq.x, hq.y);
  ok('T43.G zooming in brings it back', tight.d < near.d + 1e-9);
  ok('T43.G d is clamped to 0..1', [near, wide, tight].every(a => a.d >= 0 && a.d <= 1));
  /* a source at the edge of the view is further than one in the middle */
  centre(1);
  let edge = null;
  for (let dx = 1; dx < 40 && !edge; dx++) { const a = audAt(hq.x + dx, hq.y); if (a) edge = a; }
  ok('T43.G off-centre reads further than centre', !edge || edge.d >= near.d);

  /* the absorption low-pass: a distant sound gets an extra filter that a close
     one does not, and its cutoff falls as d rises */
  function lpFor(d) {
    audioReset();
    const ns = cap(() => { ptone({ f0: 400, dur: .2, gain: .3, d: d }); });
    const lps = ofKind(ns, 'biquad').filter(n => n.type === 'lowpass');
    return lps.length ? lps[0].frequency.value : null;
  }
  ok('T43.G a source at the camera gets no absorption filter', lpFor(0) === null);
  const l3 = lpFor(0.3), l7 = lpFor(0.7), l10 = lpFor(1.0);
  ok('T43.G a distant source gets one', l3 !== null && l7 !== null && l10 !== null);
  ok('T43.G the cutoff falls as distance rises', l3 > l7 && l7 > l10);
  ok('T43.G it lands at 900 Hz at full distance', Math.abs(l10 - 900) < 1);
  ok('T43.G it is near 18 kHz at the near end', l3 < 18000 && l3 > 3000);
  /* and distance scales the reverb sends */
  function revGain(d) {
    audioReset();
    const ns = cap(() => { ptone({ f0: 400, dur: .2, gain: .3, d: d, rev: .4, far: .5 }); });
    return ofKind(ns, 'gain').map(n => n.gain.value).sort((a, b) => b - a);
  }
  const rNear = revGain(0), rFar = revGain(1);
  ok('T43.G distance pushes more signal into the reverbs', Math.max.apply(null, rFar) > Math.max.apply(null, rNear));
}

/* ============================================================ H: HUMANISATION */
section('T43.H humanisation, with the jitter-off mutation arm');
{
  bootAudio(640012);
  function shotNumbers(kind) {
    audioReset();
    const ns = cap(() => { sfxGun(SRC_X, SRC_Y, kind, null, null); });
    const v = [];
    for (const n of ofKind(ns, 'biquad')) v.push(n.frequency.value);
    for (const n of ofKind(ns, 'osc')) for (const e of freqEv(n)) v.push(e[1]);
    for (const n of ofKind(ns, 'gain')) { for (const e of gainEv(n)) v.push(e[1]); if (!gainEv(n).length) v.push(n.gain.value); }
    for (const n of ns) if (n._startT != null) v.push(n._startT);
    return v.join(',');
  }
  const a1 = shotNumbers('rifle'), a2 = shotNumbers('rifle'), a3 = shotNumbers('rifle');
  ok('T43.H two identical rifle shots do not produce identical numbers', a1 !== a2);
  ok('T43.H nor do three', new Set([a1, a2, a3]).size === 3);
  for (const k of ['hmg', 'sniper', 'vmg', 'tower']) {
    ok('T43.H ' + k + ' varies shot to shot', shotNumbers(k) !== shotNumbers(k));
  }
  /* the shape must be stable even though the numbers are not */
  audioReset(); const s1 = cap(() => sfxGun(SRC_X, SRC_Y, 'rifle', null, null));
  audioReset(); const s2 = cap(() => sfxGun(SRC_X, SRC_Y, 'rifle', null, null));
  ok('T43.H the variation is in the numbers, not the graph', s1.length === s2.length);
  /* jitter must stay inside its stated bounds: +/-6% frequency */
  const F = [];
  for (let i = 0; i < 40; i++) {
    audioReset();
    const ns = cap(() => { ptone({ f0: 1000, dur: .1, gain: .2 }); });
    F.push(freqEv(ofKind(ns, 'osc')[0])[0][1]);
  }
  ok('T43.H frequency jitter stays inside +/-6%', F.every(f => f >= 940 - 1e-6 && f <= 1060 + 1e-6));
  ok('T43.H and it genuinely moves (not all 1000)', new Set(F.map(f => Math.round(f))).size > 10);
  /* MUTATION ARM: pure:1 must switch it off. If this passes too, the check above
     was measuring something other than the humanisation. */
  const P = [];
  for (let i = 0; i < 20; i++) {
    audioReset();
    const ns = cap(() => { ptone({ f0: 1000, dur: .1, gain: .2, pure: 1 }); });
    P.push(freqEv(ofKind(ns, 'osc')[0])[0][1] + ':' + gainEv(ofKind(ns, 'gain')[0])[1][1]);
  }
  ok('T43.H MUTATION: pure:1 produces byte-identical numbers every time', new Set(P).size === 1);
  ok('T43.H MUTATION: and the pure frequency is exactly the one asked for', P[0].indexOf('1000:') === 0);
  /* the UI tones are the ones that must not wander */
  audioReset(); const c1 = cap(() => sClick());
  audioReset(); const c2 = cap(() => sClick());
  ok('T43.H a UI click is pitch-stable', freqEv(ofKind(c1, 'osc')[0])[0][1] === freqEv(ofKind(c2, 'osc')[0])[0][1]);
}

/* ====================================================== I: POLYPHONY BUDGET */
section('T43.I the three polyphony guards');
{
  /* GUARD 1: the gunfire window, tested in isolation. GUNW is the real state
     the real code reads, so priming it with 14 recent timestamps puts the next
     shot over the limit without also filling the voice ceiling, which is what
     makes this a test of THIS guard rather than of all three at once. */
  bootAudio(640006);
  const first = cap(() => sfxGun(SRC_X, SRC_Y, 'sniper', null, null)).length;
  audioReset();
  for (let i = 0; i < 14; i++) GUNW.push(AC.currentTime - 0.01);
  const lean = cap(() => sfxGun(SRC_X, SRC_Y, 'sniper', null, null)).length;
  ok('T43.I a full gun voice is a rich one', first >= 15);
  ok('T43.I sustained fire demotes it to a lean form', lean < first);
  ok('T43.I but never to silence', lean >= 4);
  ok('T43.I the lean form keeps the transient and the body',
     (function () {
       audioReset();
       for (let i = 0; i < 14; i++) GUNW.push(AC.currentTime - 0.01);
       const ns = cap(() => sfxGun(SRC_X, SRC_Y, 'sniper', null, null));
       return ofKind(ns, 'shaper').length >= 1 && ofKind(ns, 'bufsrc').length >= 2;
     })());
  /* and it recovers once the window clears */
  audioReset();
  for (let i = 0; i < 14; i++) GUNW.push(AC.currentTime - 0.5);
  ok('T43.I the full voice returns once the window clears',
     cap(() => sfxGun(SRC_X, SRC_Y, 'sniper', null, null)).length >= first - 2);
  /* integration: the same demotion arrives on its own under real rapid fire */
  audioReset();
  let low = 1e9;
  for (let i = 0; i < 20; i++) { const n = cap(() => sfxGun(SRC_X, SRC_Y, 'vmg', null, null)).length; if (n < low) low = n; }
  ok('T43.I real sustained fire reaches the demoted path by itself', low < first);

  /* GUARD 2: the explosion window, primed the same way. */
  const hq = bootAudio(640013);
  const b1 = cap(() => sfxBoom(hq.x, hq.y, 'big')).length;
  audioReset();
  for (let i = 0; i < 5; i++) BOOMW.push(AC.currentTime - 0.01);
  const bN = cap(() => sfxBoom(hq.x, hq.y, 'big')).length;
  ok('T43.I a rapid string of blasts drops debris and tails', bN < b1);
  ok('T43.I the transient, crack, body and sub survive the demotion', bN >= 10);
  ok('T43.I the demoted blast keeps its sub-bass',
     (function () {
       audioReset();
       for (let i = 0; i < 5; i++) BOOMW.push(AC.currentTime - 0.01);
       return lowestOsc(cap(() => sfxBoom(hq.x, hq.y, 'big'))) < 100;
     })());

  /* guard 3: the hard ceiling. Schedule far more than VOX_CAP without letting
     time advance and the primitives must start refusing. */
  audioReset();
  let built = 0;
  for (let i = 0; i < 200; i++) built += cap(() => { pnoise({ freq: 1000, dur: 2.0, gain: .1 }); }).length;
  ok('T43.I the hard ceiling stops runaway voice creation', built < 200 * 3);
  ok('T43.I VOX_CAP is the stated 48', VOX_CAP === 48);
  ok('T43.I and it lets go once the voices expire', (advance(3), cap(() => { pnoise({ freq: 1000, dur: .1 }); }).length >= 2));
  /* non-vacuity: without the ceiling 200 calls would build 200 sources */
  ok('T43.I MUTATION: the ceiling is what capped it, not the loop',
     built < 200 && built > 0);
}

/* ========================================================= J: DETERMINISM */
section('T43.J no audio path touches the sim rng');
{
  const hq = bootAudio(640007, 'tan');
  /* the sim rng is a pure function of G.seed/G.rngState; snapshot it, run every
     audio entry point in the game, and require it not to have moved. */
  const stateBefore = hashState();
  for (const k of ['rifle', 'smg', 'carbine', 'hmg', 'vmg', 'amg', 'sniper', 'tower']) sfxGun(hq.x, hq.y, k, hq.x + 1, hq.y);
  for (const k of ['cannon', 'cannon_hvy', 'mortar', 'rocket', 'aa', 'artyrocket']) sfxLaunch(hq.x, hq.y, k, hq.x + 1, hq.y);
  for (const z of ['small', 'med', 'big', 'huge']) sfxBoom(hq.x, hq.y, z);
  sfxBuildingDestroy(hq.x, hq.y); sfxPop(hq.x, hq.y); sfxNestBreak(hq.x, hq.y); sfxStructBreak(hq.x, hq.y);
  sfxFlame(hq.x, hq.y, hq.x + 1, hq.y); sfxThrow(hq.x, hq.y, hq.x + 1, hq.y);
  for (let i = 0; i < 8; i++) sfxRico(hq.x, hq.y); // v92.1: prob-gated, so several draws exercise both branches
  /* v77: sfxLaser went with the Magnifying Glass. This list is an enumeration of
     every audio entry point in the game, so a removed cue leaves it, and T52.B
     asserts the function is gone rather than merely unused. */
  sfxWhoosh(hq.x, hq.y);
  for (const k of ['hvytank', 'tank', 'apc', 'arty', 'aa', 'jeep', 'bike', 'diesel']) sEngine(k);
  for (const k of ['heli', 'apache', 'chinook']) sRotor(k);
  for (const b of G.human.blds) sBuildingSelect(b);
  sClick(); sUiTone(); sAtkAlert();
  const stateAfter = hashState();
  ok('T43.J hashState is unmoved by the entire audio surface', stateBefore === stateAfter);
  /* NON-VACUITY: the rng state IS inside hashState, so a single draw must move
     it. Without this the check above would pass on a hash that ignores the rng. */
  const beforeDraw = hashState();
  srand();
  ok('T43.J MUTATION: one srand draw does move hashState', hashState() !== beforeDraw);
  /* and a full sim tick moves it too, so the audio surface really is inert */
  const beforeTick = hashState();
  update(1 / 30);
  ok('T43.J MUTATION: a sim tick moves it as well', hashState() !== beforeTick);
  /* the source-level guarantee: no srand call anywhere in the audio section */
  let src = null;
  try { src = require('fs').readFileSync('pw.html', 'utf8'); } catch (e) { src = null; }
  if (!src) {
    ok('T43.J pw.html is readable next to the harness', false);
  } else {
    const a = src.indexOf('/* ---------------- AUDIO ---------------- */');
    const b = src.indexOf('// --- spoken acknowledgement barks');
    const blk = src.slice(a, b);
    ok('T43.J the audio section contains no srand call at all', a >= 0 && b > a && blk.indexOf('srand(') < 0);
    ok('T43.J it uses Math.random throughout instead', (blk.match(/Math\.random\(/g) || []).length >= 15);
    /* non-vacuity: the sim DOES use srand, so the slice above is a real filter */
    ok('T43.J MUTATION: srand is used elsewhere in the file', (src.match(/srand\(/g) || []).length > 50);
  }
}

/* ================================================== K: THE BUS REWORK + GATE */
section('T43.K the bus rework, the duck, and the fog gate');
{
  REC = { nodes: [], edges: [] };
  AC = null; masterGain = null; NOISE = null; PINK = null; IMP = null;
  roomBus = null; farBus = null; armsBus = null;
  VOXQ.length = 0; GUNW.length = 0; BOOMW.length = 0; RICOW.length = 0; muted = false;
  global.AudioContext = MockAC; window.AudioContext = MockAC;
  const busNodes = cap(() => { ac(); });
  ok('T43.K two convolvers are built, not one', ofKind(busNodes, 'convolver').length === 2);
  ok('T43.K both carry a real stereo impulse response',
     ofKind(busNodes, 'convolver').every(c => c.buffer && c.buffer.numberOfChannels === 2 && c.buffer.length > 1000));
  const irs = ofKind(busNodes, 'convolver').map(c => c.buffer.length).sort((a, b) => a - b);
  ok('T43.K one is short and bright, the other long and dark', irs[1] > irs[0] * 3);
  ok('T43.K the short room is about 0.35 s', Math.abs(irs[0] / AC.sampleRate - 0.35) < 0.02);
  ok('T43.K the long tail is about 1.4 s', Math.abs(irs[1] / AC.sampleRate - 1.4) < 0.05);
  ok('T43.K the two IR channels are decorrelated',
     (function () {
       const c = ofKind(busNodes, 'convolver')[0].buffer;
       const l = c.getChannelData(0), r = c.getChannelData(1);
       let same = 0; for (let i = 0; i < 2000; i++) if (l[i] === r[i]) same++;
       return same < 100;
     })());
  const comp = ofKind(busNodes, 'comp')[0];
  ok('T43.K the compressor was relaxed off ratio 14', comp && comp.ratio.value === 4);
  ok('T43.K its threshold moved to -6 dB', comp && comp.threshold.value === -6);
  ok('T43.K a soft clip sits after it', ofKind(busNodes, 'shaper').length === 1);
  ok('T43.K the clip curve is monotonic and bounded', (function () {
    const c = ofKind(busNodes, 'shaper')[0].curve;
    if (!c) return false;
    for (let i = 1; i < c.length; i++) if (c[i] < c[i - 1]) return false;
    return Math.abs(c[0] + 1) < 0.01 && Math.abs(c[c.length - 1] - 1) < 0.01;
  })());
  ok('T43.K the master target the mute button restores is still 0.9', masterGain.gain.value === 0.9);

  /* the small-arms duck */
  ok('T43.K the small-arms bus exists', !!armsBus);
  const before = armsBus.gain._ev.length;
  duckArms(0.35, 0.25);
  const ev = armsBus.gain._ev.slice(before);
  ok('T43.K an explosion pulls the arms bus down', ev.some(e => e[0] === 'lin' && e[1] < 1));
  ok('T43.K and schedules it back up again', ev.some(e => e[0] === 'tgt' && e[1] === 1));
  ok('T43.K the duck never fully mutes small arms', ev.every(e => e[1] === null || e[1] >= 0.2));
  const busArms = armsBus;
  ok('T43.K gunfire routes through the arms bus, explosions do not', (function () {
    const hq = bootAudio(640008);
    const before2 = REC.edges.length;
    sfxGun(hq.x, hq.y, 'rifle', null, null);
    const gunEdges = REC.edges.slice(before2);
    const before3 = REC.edges.length;
    sfxBoom(hq.x, hq.y, 'big');
    const boomEdges = REC.edges.slice(before3);
    return gunEdges.some(e => e[1] === armsBus) && !boomEdges.some(e => e[1] === armsBus);
  })());

  /* the fog gate must be exactly what it was: this release only grew the return */
  const hq = bootAudio(640009);
  ok('T43.K a visible source is still audible', !!audAt(hq.x, hq.y));
  const N = G.map.N;
  let fogged = null;
  for (let y = 0; y < N && !fogged; y++) for (let x = 0; x < N; x++) if (G.fog[y * N + x] !== 2) { fogged = { x: x + .5, y: y + .5 }; break; }
  ok('T43.K a fogged source is still silent', !fogged || audAt(fogged.x, fogged.y) === null);
  ok('T43.K off-map is still silent', audAt(-5, -5) === null && audAt(N + 5, N + 5) === null);
  ok('T43.K audAt2 still takes the louder end', (function () {
    const a = audAt2(hq.x, hq.y, hq.x, hq.y);
    return !!a && (!fogged || (audAt2(fogged.x, fogged.y, hq.x, hq.y) || {}).gain === audAt(hq.x, hq.y).gain);
  })());
  ok('T43.K a fogged explosion builds nothing', (function () {
    if (!fogged) return true;
    audioReset();
    return cap(() => sfxBoom(fogged.x, fogged.y, 'huge')).length === 0;
  })());
}

/* ==================================================== L: SELECTION VOICES */
section('T43.L eleven vehicle voices and eleven building voices');
{
  const EK = ['hvytank', 'tank', 'apc', 'arty', 'aa', 'jeep', 'bike', 'diesel'];
  const esig = {};
  for (const k of EK) {
    audioReset();
    const ns = cap(() => { sEngine(k); });
    esig[k] = fvec(ns);
    ok('T43.L the ' + k + ' engine builds a voice', ns.length >= 4);
  }
  ok('T43.L all eight ground engines are distinct [' + distinct(EK.map(k => esig[k])) + '/8]',
     distinct(EK.map(k => esig[k])) === 8);
  audioReset(); const hv = cap(() => sEngine('hvytank'));
  audioReset(); const md = cap(() => sEngine('tank'));
  audioReset(); const bk = cap(() => sEngine('bike'));
  ok('T43.L the Bull idles lower than the Tank', lowestOsc(hv) < lowestOsc(md));
  ok('T43.L the Scout Bike revs higher than either', lowestOsc(bk) > lowestOsc(md));

  const RK = ['heli', 'apache', 'chinook'];
  const rsig = {};
  for (const k of RK) {
    audioReset();
    const ns = cap(() => { sRotor(k); });
    const lfos = ofKind(ns, 'osc').filter(n => n.type === 'sine' && n.frequency.value > 0 && n.frequency.value < 40).map(n => n.frequency.value);
    rsig[k] = lfos.slice().sort((a, b) => a - b).concat([ns.length]);
    ok('T43.L the ' + k + ' rotor builds a voice', ns.length >= 6);
    ok('T43.L the ' + k + ' has two blade LFOs', lfos.length === 2);
  }
  ok('T43.L the three rotors are three distinct voices', distinct(RK.map(k => rsig[k])) === 3);
  /* the Chinook is a tandem: its two chop rates must be close enough to beat */
  audioReset();
  const chn = cap(() => sRotor('chinook'));
  const clf = ofKind(chn, 'osc').filter(n => n.frequency.value > 0 && n.frequency.value < 40).map(n => n.frequency.value).sort((a, b) => a - b);
  ok('T43.L the Chinook\u2019s two rotors beat against each other', clf.length === 2 && (clf[1] - clf[0]) < 2);
  audioReset();
  const hli = cap(() => sRotor('heli'));
  const hlf = ofKind(hli, 'osc').filter(n => n.frequency.value > 0 && n.frequency.value < 40).map(n => n.frequency.value).sort((a, b) => a - b);
  ok('T43.L the Huey\u2019s do not (they are an octave apart)', hlf.length === 2 && (hlf[1] - hlf[0]) > 5);

  /* eleven building voices, resolved from real structures */
  bootAudio(640010);
  const P = G.human;
  const MAP = {
    hq: 'command', outpost: 'command', barracks: 'barracks', garage: 'garage', helipad: 'helipad',
    lab: 'lab', guardtower: 'defense', bunker: 'defense', generator: 'power', turbine: 'power',
    supply: 'supply', dump: 'supply', radar: 'radar', radiotower: 'radio', barricade: 'barricade'
  };
  let routed = 0;
  for (const key in MAP) {
    const b = makeBuilding(key, P, 4, 4);
    ok('T43.L ' + key + ' answers with the ' + MAP[key] + ' voice', bldVoice(b) === MAP[key]);
    if (bldVoice(b) === MAP[key]) routed++;
    const i = G.blds.indexOf(b); if (i >= 0) G.blds.splice(i, 1);
    const j = P.blds.indexOf(b); if (j >= 0) P.blds.splice(j, 1);
  }
  ok('T43.L every structure in the game routes to a voice', routed === Object.keys(MAP).length);
  const VOICES = ['command', 'barracks', 'garage', 'helipad', 'lab', 'defense', 'power', 'supply', 'radar', 'radio', 'barricade'];
  const bsig = {};
  for (const key in MAP) {
    if (bsig[MAP[key]]) continue;
    const b = makeBuilding(key, P, 4, 4);
    audioReset();
    const ns = cap(() => { sBuildingSelect(b); });
    bsig[MAP[key]] = fvec(ns);
    const i = G.blds.indexOf(b); if (i >= 0) G.blds.splice(i, 1);
    const j = P.blds.indexOf(b); if (j >= 0) P.blds.splice(j, 1);
  }
  ok('T43.L all eleven building voices are distinct [' + distinct(VOICES.map(v => bsig[v])) + '/11]',
     distinct(VOICES.map(v => bsig[v])) === 11);
  ok('T43.L the radar is a bare two-tone ping', (function () {
    const b = makeBuilding('radar', P, 4, 4);
    audioReset();
    const ns = cap(() => sBuildingSelect(b));
    const i = G.blds.indexOf(b); if (i >= 0) G.blds.splice(i, 1);
    const j = P.blds.indexOf(b); if (j >= 0) P.blds.splice(j, 1);
    return ofKind(ns, 'osc').length === 2 && ofKind(ns, 'bufsrc').length === 0;
  })());

  /* selectionBark routing: the paths v63 collapsed */
  audioReset();
  function bark(key) {
    const u = makeUnit(key, P, 7, 7);
    audioReset();
    const ns = cap(() => { setSel([u]); });
    const iu = G.units.indexOf(u); if (iu >= 0) G.units.splice(iu, 1);
    const ju = P.units.indexOf(u); if (ju >= 0) P.units.splice(ju, 1);
    G.sel = [];
    return fvec(ns);
  }
  const bulls = bark('bulltank'), tanks = bark('tank'), jeeps = bark('jeep'), bikes = bark('bike');
  const apcs = bark('apc'), artys = bark('arty'), aas = bark('aatruck'), trucks = bark('truck');
  const uniqv = distinct([bulls, tanks, jeeps, bikes, apcs, artys, aas, trucks]);
  ok('T43.L eight vehicle selections give eight different sounds [' + uniqv + '/8]', uniqv === 8);
  ok('T43.L the Bull no longer answers like the Tank', !sameVoice(bulls, tanks));
  ok('T43.L the Scout Bike no longer answers like the MG Jeep', !sameVoice(bikes, jeeps));
  ok('T43.L the APC, the artillery and the AA truck no longer answer like a tank',
     !sameVoice(apcs, tanks) && !sameVoice(artys, tanks) && !sameVoice(aas, tanks));
}

/* ============================================================ M: THE HEADLINE */
section('T43.M the headline, with the v63 mutation arm');
{
  /* THE CLAIM: the battlefield no longer sounds like one weapon and one bomb.
     Take every combat sound the game can make, fingerprint each, and require
     them all to be distinct. Then rebuild the v63 recipes through the same
     recorder and require THOSE to collide, which is what makes this a
     measurement rather than a restatement of the code. */
  const fp = fvec;
  const hq = bootAudio(640011, 'gray');
  const ALL = {};
  for (const k of ['rifle', 'smg', 'carbine', 'hmg', 'vmg', 'amg', 'sniper', 'tower']) {
    audioReset(); ALL['gun:' + k] = fp(cap(() => sfxGun(hq.x, hq.y, k, null, null)));
  }
  for (const k of ['cannon', 'cannon_hvy', 'mortar', 'rocket', 'aa', 'artyrocket']) {
    audioReset(); ALL['launch:' + k] = fp(cap(() => sfxLaunch(hq.x, hq.y, k, null, null)));
  }
  for (const z of ['small', 'med', 'big', 'huge']) {
    audioReset(); ALL['boom:' + z] = fp(cap(() => sfxBoom(hq.x, hq.y, z)));
  }
  audioReset(); ALL['collapse'] = fp(cap(() => sfxBuildingDestroy(hq.x, hq.y)));
  audioReset(); ALL['pop'] = fp(cap(() => sfxPop(hq.x, hq.y)));
  /* v92.1: 'nest' left this table - the voice is deliberately silent now,
     and a fingerprint of nothing has no place in a distinctness claim */
  audioReset(); ALL['struct'] = fp(cap(() => sfxStructBreak(hq.x, hq.y)));
  audioReset(); ALL['flame'] = fp(cap(() => sfxFlame(hq.x, hq.y, hq.x + 1, hq.y)));
  audioReset(); ALL['throw'] = fp(cap(() => sfxThrow(hq.x, hq.y, hq.x + 1, hq.y)));

  const keys = Object.keys(ALL);
  const dupes = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    if (sameVoice(ALL[keys[i]], ALL[keys[j]])) dupes.push(keys[i] + '/' + keys[j]);
  }
  const nvoices = distinct(keys.map(k => ALL[k]));
  ok('T43.M every combat sound in the game is distinct [' + nvoices + '/' + keys.length + ']' +
     (dupes.length ? ' [collisions: ' + dupes.slice(0, 4).join(', ') + ']' : ''), dupes.length === 0);
  ok('T43.M that is 23 combat voices where v63 had 12 (24 until v92.1 silenced the nest)', keys.length === 23);

  /* MUTATION ARM. Rebuild the v63 recipes verbatim through this same recorder.
     v63 answered six weapons with 'mg' and four explosion sizes with one recipe
     times a gain, so its fingerprints MUST collide where the v64 ones do not.
     If this arm goes green, the fingerprint is not measuring anything. */
  function v63gun(kind, E) {
    if (kind === 'sniper') {
      pnoise(Object.assign({ freq: 1100, q: 1.2, ft: 'bandpass', gain: .32, dur: .18, rev: .18 }, E));
      ptone(Object.assign({ ft: 'sine', f0: 160, f1: 60, sweep: .14, dur: .16, gain: .26 }, E));
      pnoise(Object.assign({ freq: 2800, q: .7, ft: 'highpass', gain: .13, dur: .05 }, E));
      pnoise(Object.assign({ freq: 620, q: .7, ft: 'bandpass', gain: .12, dur: .3, delay: .05, rev: .3 }, E));
    } else if (kind === 'mg') {
      pnoise(Object.assign({ freq: 2300, q: .9, ft: 'bandpass', gain: .18, dur: .06 }, E));
      ptone(Object.assign({ f0: 130, f1: 70, dur: .05, gain: .10 }, E));
      pnoise(Object.assign({ freq: 3400, q: .6, ft: 'highpass', gain: .06, dur: .02 }, E));
    } else {
      pnoise(Object.assign({ freq: 1750, q: .8, ft: 'bandpass', gain: .26, dur: .09, rev: .12 }, E));
      ptone(Object.assign({ f0: 120, f1: 55, dur: .07, gain: .20 }, E));
      pnoise(Object.assign({ freq: 3200, q: .6, ft: 'highpass', gain: .11, dur: .03 }, E));
      pnoise(Object.assign({ freq: 520, q: .6, ft: 'bandpass', gain: .08, dur: .16, delay: .03, rev: .22 }, E));
    }
  }
  function v63boom(size, E) {
    const S = ({ small: { sub: .7, body: .55, crack: .5, tick: .2, tail: .55, lf: 66, d: .5 }, med: { sub: 1.0, body: .75, crack: .65, tick: .26, tail: .75, lf: 54, d: .68 }, big: { sub: 1.35, body: .95, crack: .8, tick: .32, tail: .95, lf: 44, d: .95 }, huge: { sub: 1.75, body: 1.15, crack: .95, tick: .4, tail: 1.15, lf: 36, d: 1.25 } })[size];
    ptone(Object.assign({ ft: 'sine', f0: S.lf, f1: S.lf * .42, sweep: S.d * .85, dur: S.d, gain: S.sub, atk: .004, rev: .22 }, E));
    ptone(Object.assign({ ft: 'triangle', f0: S.lf * 2.4, f1: S.lf * .9, sweep: S.d * .5, dur: S.d * .6, gain: S.body, atk: .003, rev: .3 }, E));
    pnoise(Object.assign({ freq: 850, q: .7, ft: 'lowpass', gain: S.crack, dur: .14, atk: .001, rev: .4 }, E));
    pnoise(Object.assign({ freq: 2600, q: .5, ft: 'highpass', gain: S.tick, dur: .06, atk: .001 }, E));
    pnoise(Object.assign({ freq: 170, q: .4, ft: 'lowpass', gain: S.tail, dur: S.d * 1.7, atk: .03, delay: .02, rev: .6 }, E));
    if (size === 'big' || size === 'huge') ptone(Object.assign({ ft: 'sine', f0: S.lf * .85, f1: S.lf * .4, sweep: S.d, dur: S.d * 1.2, gain: S.sub * .55, atk: .02, delay: .07, rev: .45 }, E));
  }
  const OLD = {};
  /* the six weapons v63 answered with one voice */
  const SIX = ['gunner', 'jeep', 'heli', 'sarge', 'bike', 'tower'];
  for (const k of SIX) {
    audioReset(); OLD['gun:' + k] = fp(cap(() => v63gun('mg', { lvl: 1, pan: 0 })));
  }
  for (const z of ['small', 'med', 'big']) {
    audioReset(); OLD['boom:' + z] = fp(cap(() => v63boom(z, { lvl: 1, pan: 0 })));
  }
  const oldKeys = Object.keys(OLD);
  const oldDistinct = distinct(oldKeys.map(k => OLD[k]));
  ok('T43.M MUTATION: the v63 recipes collide where the v64 ones do not [' + oldDistinct + '/' + oldKeys.length + ']',
     oldDistinct < oldKeys.length);
  ok('T43.M MUTATION: v63 gave those six weapons literally one voice',
     distinct(SIX.map(k => OLD['gun:' + k])) === 1);
  /* v63 built all four sizes from ONE recipe and scaled it, so the graph shape
     is identical across sizes. v64 gives each size its own topology, which
     section E asserts from the other side. Both halves are measured here so the
     comparison is like for like. */
  audioReset(); const oSmall = shape(cap(() => v63boom('small', { lvl: 1, pan: 0 })));
  audioReset(); const oMed = shape(cap(() => v63boom('med', { lvl: 1, pan: 0 })));
  audioReset(); const nSmall = shape(cap(() => sfxBoom(hq.x, hq.y, 'small')));
  audioReset(); const nMed = shape(cap(() => sfxBoom(hq.x, hq.y, 'med')));
  ok('T43.M MUTATION: v63 small and med were the same graph, scaled', oSmall === oMed);
  ok('T43.M v64 small and med are different graphs', nSmall !== nMed);
  /* and the same six, at v64, are six */
  ok('T43.M the same six weapons are six voices at v64',
     distinct(['hmg', 'vmg', 'amg', 'carbine', 'smg', 'tower'].map(k => ALL['gun:' + k])) === 6);

  /* leave the shim as it was: AudioContext undefined for every later tail */
  muted = false;
  AC = null; masterGain = null; NOISE = null; PINK = null; IMP = null;
  roomBus = null; farBus = null; armsBus = null;
  VOXQ.length = 0; GUNW.length = 0; BOOMW.length = 0; RICOW.length = 0;
  try { delete global.AudioContext; } catch (e) { global.AudioContext = undefined; }
  try { delete window.AudioContext; } catch (e) { window.AudioContext = undefined; }
  ok('T43.M the tail leaves AudioContext undefined for later tails', typeof global.AudioContext === 'undefined');
  ok('T43.M and the game falls back to silence cleanly', ac() === null);
}
