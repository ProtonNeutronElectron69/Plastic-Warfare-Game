/* tail_v92.js - T67: roadmap 3, phase 2. Recorded audio over the synthesis.

     A  every voice the game can ask for has takes, and no take is orphaned
     B  the takes are real mp3 audio, shipped as data: URLs (file://-safe)
     C  the fallback: headless, every sfx voice still synthesises the v90.2 way
     D  nothing recorded is sim state, and nothing new touches srand
     E  assets/snd/ and the embedded table cannot drift apart

   The claim of the release, stated once: a decoded recording OVERRIDES a
   voice, the synthesis remains the voice's fallback, and the simulation
   cannot tell which one played. The hash trails carry the last third of that
   (triage reproduced every pinned combo over this diff); this tail carries
   the rest.

   WHY THE KEYS ARE DERIVED AND NOT TRANSCRIBED. gun_* comes off GUNV and
   boom_* off EXPLV, so a ninth weapon voice or a fifth explosion size FAILS
   HERE until someone renders its takes or consciously decides it stays
   synthesised - the same declare-your-addition pattern as the .bb button
   count. The launch kinds are the one transcribed set, because launchKind()
   builds them from branches rather than a table. */
'use strict';
section('T67 v92: recorded audio, and the synthesis it falls back to');

const fs67 = require('fs');
const LAUNCH67 = ['cannon', 'cannon_hvy', 'mortar', 'aa', 'artyrocket', 'rocket'];
/* v92.1: nest_break left the roster (nest destruction is silent now, by the
   owner's decision - T68.A) and rico joined it (small arms pinging off armor).
   Still seven solos, still 25 bases. */
const SOLO67 = ['flame', 'throw', 'bld_destroy', 'pop', 'rico', 'struct_break', 'whoosh'];
const bases67 = Object.keys(GUNV).map(k => 'gun_' + k)
  .concat(LAUNCH67.map(k => 'launch_' + k))
  .concat(Object.keys(EXPLV).map(k => 'boom_' + k))
  .concat(SOLO67);

/* ---------- A: coverage, both directions ---------- */
{
  section('T67.A every voice has takes, every take has a voice');

  ok(`T67.A the voice set derives to ${bases67.length} bases (8 guns, 6 launches, 4 booms, 7 solos)`,
    bases67.length === 25 && Object.keys(GUNV).length === 8 && Object.keys(EXPLV).length === 4);
  ok('T67.A SNDV declares playback parameters for every base, and no others',
    bases67.every(b => SNDV[b]) && Object.keys(SNDV).every(b => bases67.indexOf(b) >= 0));

  /* the manifest must be EXACTLY the SNDV expansion: base_0 .. base_{n-1} */
  const want = [];
  for (const b of bases67) for (let i = 0; i < (SNDV[b].n || 1); i++) want.push(b + '_' + i);
  const got = Object.keys(ASSET_MANIFEST.snd);
  ok(`T67.A the manifest holds one entry per declared take (${want.length})`,
    want.every(k => ASSET_MANIFEST.snd[k]) && got.length === want.length);
  ok('T67.A ...and nothing else', got.every(k => want.indexOf(k) >= 0));
  ok('T67.A every rapid-fire weapon carries at least two takes, so a burst is not one sample on repeat',
    ['gun_rifle', 'gun_smg', 'gun_hmg', 'gun_vmg', 'gun_amg', 'gun_tower'].every(b => SNDV[b].n >= 2));

  /* every SNDV row is sane: audible but bounded gain, sends in range */
  ok('T67.A every gain sits in (0, 1.3] and every reverb send in [0, 1]',
    Object.keys(SNDV).every(b => {
      const v = SNDV[b];
      return v.g > 0 && v.g <= 1.3 && (v.rev || 0) >= 0 && (v.rev || 0) <= 1 && (v.far || 0) >= 0 && (v.far || 0) <= 1;
    }));
}

/* ---------- B: the takes are real audio, and self-contained ---------- */
{
  section('T67.B the data is mp3, and it ships inside the page');

  /* data: URLs are the load-bearing choice: the README tells the player to
     double-click the file, i.e. file://, where every modern browser refuses
     fetch() of a RELATIVE url. fetch() of a data: url works everywhere, so
     the game stays one self-contained file. A future phase that switches to
     folder urls must consciously retire this pin AND the double-click claim. */
  const urls = Object.keys(ASSET_MANIFEST.snd).map(k => ASSET_MANIFEST.snd[k]);
  ok('T67.B every sound url is a data: url, so the double-clicked file needs no folder beside it',
    urls.length > 0 && urls.every(u => u.indexOf('data:audio/mpeg;base64,') === 0));

  ok('T67.B SND_B64 and the manifest agree key for key',
    Object.keys(SND_B64).length === urls.length && Object.keys(SND_B64).every(k => ASSET_MANIFEST.snd[k]));

  let badB64 = [], badSync = [], total = 0;
  for (const k in SND_B64) {
    let buf = null;
    try { buf = Buffer.from(SND_B64[k], 'base64'); } catch (e) { }
    if (!buf || buf.length < 1024) { badB64.push(k); continue; }
    total += buf.length;
    /* an mp3 stream opens on an 11-bit frame sync; lame writes no ID3 here */
    if (buf[0] !== 0xFF || (buf[1] & 0xE0) !== 0xE0) badSync.push(k);
  }
  ok('T67.B every take decodes from base64 to at least 1 kB of data' + (badB64.length ? ' [' + badB64.slice(0, 3).join(', ') + ']' : ''),
    badB64.length === 0);
  ok('T67.B every take opens on an mp3 frame sync' + (badSync.length ? ' [' + badSync.slice(0, 3).join(', ') + ']' : ''),
    badSync.length === 0);
  ok(`T67.B the whole set stays under half a megabyte of mp3 (${Math.round(total / 1024)} kB)`,
    total > 100 * 1024 && total < 512 * 1024);
}

/* ---------- C: the fallback voice is intact ---------- */
{
  section('T67.C headless, every voice still synthesises the v90.2 way');

  /* under Node there is no fetch, so nothing loads and nothing can decode -
     which makes this suite a permanent test OF the fallback path a player
     hits when a download or a decode fails. */
  ok('T67.C no take is loaded headless, so sndAsset answers null even for a real key',
    sndAsset('gun_rifle_0') === null && sndAsset('boom_huge_0') === null);
  ok('T67.C sndPlay refuses politely: false for a real voice, false for nonsense',
    sndPlay('gun_rifle', {}) === false && sndPlay('no_such_voice', {}) === false);

  /* each positional sfx function asks sndPlay FIRST and keeps its synth
     layers after - checked off the live source, one function at a time, in
     both directions: the recorded branch exists, and at least one synthesis
     primitive survives behind it. */
  const pairs = [
    [sfxGun, "sndPlay('gun_'+"], [sfxFlame, "sndPlay('flame'"], [sfxThrow, "sndPlay('throw'"],
    [sfxLaunch, "sndPlay('launch_'+"], [sfxBoom, "sndPlay('boom_'+"],
    [sfxBuildingDestroy, "sndPlay('bld_destroy'"], [sfxPop, "sndPlay('pop'"],
    [sfxRico, "sndPlay('rico'"], [sfxStructBreak, "sndPlay('struct_break'"],
    [sfxWhoosh, "sndPlay('whoosh'"]
  ];
  for (const [fn, call] of pairs) {
    const src = fn.toString(), at = src.indexOf(call);
    const synthAt = Math.min(...['pimp(', 'pnoise(', 'psweep(', 'ptone(', 'pgrain('].map(p => {
      const i = src.indexOf(p); return i < 0 ? 1e9 : i;
    }));
    ok('T67.C ' + fn.name + ' tries the recording, then falls back to synthesis',
      at >= 0 && synthAt < 1e9 && at < synthAt);
  }
  /* and every voice keeps asking the positional gate before making any noise */
  ok('T67.C every recorded-capable voice still gates on audAt/audFor first',
    pairs.every(([fn]) => /aud(At|For)\(/.test(fn.toString())));
}

/* ---------- D: not sim state, and never seeded ---------- */
{
  section('T67.D a recording may decide what you hear, never what happens');

  G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'tan', opp: 3, seed: 920001 });
  for (let i = 0; i < 60; i++) update(1 / 30);
  const h = hashState(), snap = saveState();
  /* a decoded take arriving mid-match must move nothing the lockstep sees */
  ASSETS.snd.probe67 = { bytes: new ArrayBuffer(8), buf: { duration: 1, pwOff: 0 } };
  const h2 = hashState(), snap2 = saveState();
  delete ASSETS.snd.probe67;
  ok('T67.D a decoded recording changes neither the hash nor the snapshot', h === h2 && snap === snap2);
  ok('T67.D the playback path never touches the seeded stream',
    [sndPlay, sndBuf, sndWarm, sndLead].every(f => f.toString().indexOf('srand') < 0));
  ok('T67.D sndBuf hands the decoder a COPY, so the raw bytes survive a failed decode',
    sndBuf.toString().indexOf('.slice(0)') > 0);
  ok('T67.D playback starts at the measured first audible sample, not at the mp3 padding',
    sndPlay.toString().indexOf('pwOff') > 0 && sndLead.toString().indexOf('getChannelData') > 0);
}

/* ---------- E: the repository cannot drift ---------- */
{
  section('T67.E assets/snd/ and the embedded table are the same bytes');

  /* the mp3s are committed twice on purpose: once as auditable files a human
     can play (and replace, one at a time), once base64 inside 02c-snd-data.js
     where the game actually reads them. This is the check that the two can
     never quietly disagree - the same job ./build.sh --check does for the
     shipped html, one layer further down. */
  let files = [];
  try { files = fs67.readdirSync('../assets/snd').filter(f => f.endsWith('.mp3')).sort(); } catch (e) { }
  const keys = Object.keys(SND_B64).sort();
  ok(`T67.E assets/snd holds exactly the embedded takes (${files.length} files)`,
    files.length === keys.length && files.every((f, i) => f.slice(0, -4) === keys[i]));
  let drifted = [];
  for (const f of files) {
    const disk = fs67.readFileSync('../assets/snd/' + f).toString('base64');
    if (disk !== SND_B64[f.slice(0, -4)]) drifted.push(f);
  }
  ok('T67.E every embedded take is byte-identical to its file - re-run tools/embed_snd.py if not' +
    (drifted.length ? ' [' + drifted.slice(0, 3).join(', ') + ']' : ''), drifted.length === 0);

  const order = fs67.readFileSync('../source/order.txt', 'utf8');
  /* v95: the image data (02d) now ships between the sound data and the audio
     engine, so the pinned run grew by one line rather than being loosened */
  ok('T67.E 02c-snd-data.js ships, between the loader and the audio engine',
    order.indexOf('02b-assets.js\n02c-snd-data.js\n02d-img-data.js\n03-audio.js') >= 0);
  ok('T67.E the generated file says who generates it',
    fs67.readFileSync('../source/js/02c-snd-data.js', 'utf8').indexOf('GENERATED by tools/embed_snd.py') >= 0);
}
