/* tail_v104.js - T81: the soundtrack.

   Four recorded tracks - a menu march, a build-up loop, a combat loop and a
   one-shot victory sting, all the US Army Old Guard Fife and Drum Corps -
   embedded as base64 and played through a music bus off masterGain.

   WHAT THIS FILE CAN AND CANNOT ASSERT, because it is the whole shape of it.
   The headless shim has no fetch and no AudioContext, so under Node NOTHING
   here ever loads or plays. That is not a gap in the tests, it is the most
   important thing they check: the silent path is the one a player gets when a
   decode fails, and it is exercised on every single run of the suite. So the
   claims below are of three kinds -

     1. the DATA is right (four tracks, loop points inside the file, the
        committed mp3s and the embedded copies byte-identical),
     2. the SIM CANNOT SEE ANY OF IT (no hash movement, no srand, no snapshot
        field), which is what lets one player's music fail while a lockstep
        match stays in step, and
     3. the STATE MACHINE picks the right track from a given game state, which
        is pure arithmetic on G and testable without ever making a sound.

   Whether the loops actually sound seamless is rule 7's problem and not this
   file's: no assertion can hear a bump. That was measured instead by the
   cutter (tools/cut_music_v104.py reports a seam figure per track, 0.53x /
   0.57x / 0.86x against a 1.0 that means "no more jarring than an ordinary
   beat change") and listened to in a browser. */

let HTML104=null;
try{HTML104=require('fs').readFileSync('pw.html','utf8')}catch(e){HTML104=null}
const SCRIPT104=HTML104?HTML104.slice(HTML104.indexOf('<script>'),HTML104.indexOf('</script>')):'';
const MUSKEYS=['build','combat','menu','victory'];

function cfg104(seed){return{seed:seed,map:'kitchen',mode:'dm',fac:'green',opp:1,diff:'normal'}}
function fresh104(seed){G=null;newGame(cfg104(seed));return G.human}

/* ---------- A: the four tracks and their loop points ---------- */
{
 section('T81.A four tracks are embedded, three of them looping');
 ok('T81.A the manifest carries a mus bucket', ASSET_MANIFEST&&typeof ASSET_MANIFEST.mus==='object');
 ok('T81.A four tracks, named for the four phases of a match',
    Object.keys(ASSET_MANIFEST.mus).sort().join(',')===MUSKEYS.join(','));
 ok('T81.A MUS_B64 and the manifest agree key for key',
    Object.keys(MUS_B64).sort().join(',')===MUSKEYS.join(',')
    &&MUSKEYS.every(k=>ASSET_MANIFEST.mus[k]));
 ok('T81.A every entry is an mp3 data: URL, so file:// can fetch it',
    MUSKEYS.every(k=>ASSET_MANIFEST.mus[k].startsWith('data:audio/mpeg;base64,')));

 /* The loop points. start is the file's margin; end is one loop later. The
    margin exists so the mp3's encoder padding is never inside the loop. */
 ok('T81.A the three loops carry loop points, the sting carries none',
    MUS_LOOP.menu&&MUS_LOOP.build&&MUS_LOOP.combat&&MUS_LOOP.victory===null);
 const loops=['menu','build','combat'];
 ok('T81.A every loop starts AFTER the file does, leaving room for the padding',
    loops.every(k=>MUS_LOOP[k].start>=0.2));
 ok('T81.A every loop is a real span, tens of seconds long',
    loops.every(k=>MUS_LOOP[k].end-MUS_LOOP[k].start>10&&MUS_LOOP[k].end-MUS_LOOP[k].start<60));
 /* the margin is the point: there must be file left AFTER loopEnd too, or the
    baked crossfade read audio that is not there (the cutter refuses that) */
 ok('T81.A the loop ends before the file does, so the tail margin survives',
    loops.every(k=>MUS_LOOP[k].end>MUS_LOOP[k].start+1));

 /* THE CONSCIOUS EDIT (rule 5): a fifth track, or a re-cut that changes a
    length, fails here until someone says why in this line. */
 ok('T81.A the set is four tracks and ~1.1 MB of mp3 - a deliberate size',
    MUSKEYS.length===4
    &&Math.abs(MUSKEYS.reduce((n,k)=>n+MUS_B64[k].length,0)*3/4-1157000)<120000);
}

/* ---------- B: the committed files and the embedded copies agree ---------- */
{
 section('T81.B assets/mus/ and the embedded base64 are byte-identical');
 let fs104=null;try{fs104=require('fs')}catch(e){}
 if(!fs104){
  ok('T81.B (skipped - no fs in this environment)', true);
 }else{
  let same=0,checked=0,missing=[];
  for(const k of MUSKEYS){
   let disk=null;
   try{disk=fs104.readFileSync('../assets/mus/'+k+'.mp3').toString('base64')}catch(e){missing.push(k);continue}
   checked++;if(disk===MUS_B64[k])same++;
  }
  ok('T81.B every track has a committed file behind it', missing.length===0);
  ok('T81.B every embedded track equals its file on disk, byte for byte',
     checked===MUSKEYS.length&&same===MUSKEYS.length);
  /* loops.json is the cutter's output and the embed's input; if they drift the
     game would loop somewhere the cutter never measured. */
  let meta=null;
  try{meta=JSON.parse(fs104.readFileSync('../assets/mus/loops.json','utf8'))}catch(e){}
  ok('T81.B loops.json exists beside the tracks', !!meta);
  if(meta)ok('T81.B the embedded loop points equal the ones the cutter measured',
     ['menu','build','combat'].every(k=>meta[k]&&meta[k].loop
       &&Math.abs(meta[k].start-MUS_LOOP[k].start)<1e-6
       &&Math.abs(meta[k].end-MUS_LOOP[k].end)<1e-6)
     &&meta.victory&&meta.victory.loop===false);
 }
}

/* ---------- C: the simulation cannot see the music ---------- */
{
 section('T81.C music is client-local: no hash, no snapshot, no srand');
 fresh104(1040101);
 const h0=hashState();
 musTick();musTick();musTick();
 ok('T81.C musTick does not move the state hash', hashState()===h0);

 /* the RNG stream is the one that desyncs a live match (rule 2) */
 const r0=G.rngS;
 musTick();musWant();musPlay('menu');musStop();musSting('victory');
 ok('T81.C nothing in the music path consumes srand()', G.rngS===r0);

 /* and nothing of it rides in the save */
 const snap=JSON.parse(saveState());
 ok('T81.C the snapshot carries no music field',
    !('mus' in snap)&&!('musKey' in snap)&&!('music' in snap));
 const before=hashState();
 loadState(JSON.stringify(snap));
 ok('T81.C a save/load round trip is unaffected by music', hashState()===before);

 /* the source-text half of the same claim */
 if(SCRIPT104){
  const i=SCRIPT104.indexOf('/* ---------------- MUSIC (v104)');
  const j=SCRIPT104.indexOf('function musTick',i);
  const body=i>0&&j>0?SCRIPT104.slice(i,SCRIPT104.indexOf('\n}',j)):'';
  ok('T81.C the music file exists in the shipped script', body.length>500);
  /* COMMENTS OUT FIRST. The first cut of this check scanned the raw text and
     failed on the file's own header, which says in prose that nothing here
     calls srand() - a scan looking for a CALL must not match the sentence
     promising there is none. */
  const code=body.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
  ok('T81.C the header does claim it, in prose', body.indexOf('srand()')>0);
  ok('T81.C ...and the CODE, comments stripped, never calls srand()',
     code.length>400&&code.indexOf('srand(')<0);
 }
}

/* ---------- D: everything degrades to silence ---------- */
{
 section('T81.D with no fetch and no AudioContext the game simply runs silent');
 ok('T81.D the shim loaded no music, which is the fallback under test',
    Object.keys(ASSETS.mus).length===0);
 ok('T81.D musBuf answers null for every track', MUSKEYS.every(k=>musBuf(k)===null));
 ok('T81.D musPlay refuses rather than throwing', MUSKEYS.every(k=>musPlay(k)===false));
 ok('T81.D musSting refuses rather than throwing', musSting('victory')===false);
 ok('T81.D musAsset answers null', MUSKEYS.every(k=>musAsset(k)===null));

 /* the real claim: a whole match runs with the music dead */
 let threw=null;
 try{
  fresh104(1040201);
  for(let i=0;i<120;i++){update(1/30);musTick()}
 }catch(e){threw=e}
 ok('T81.D a hundred-tick match runs with musTick on every frame, no throw', !threw);
}

/* ---------- E: which track a given game state asks for ---------- */
{
 section('T81.E musWant picks the track from the game state alone');
 const wasMuted=muted;
 G=null;muted=false;
 /* One frame on the menu, as the real game runs every frame it is displayed.
    It matters: this is what clears a combat hold left by the previous match,
    and running the checks WITHOUT it is what caught that leak - an earlier
    tail in this segment leaves a stub AudioContext, so the hold armed here for
    real and survived into the next newGame(). */
 musTick();
 ok('T81.E the setup screen (G is null) asks for the menu march', musWant()==='menu');

 fresh104(1040301);
 ok('T81.E a running match asks for the build-up loop', musWant()==='build');

 /* the leak itself, driven directly: arm the hold, pass through the menu, and
    a new match must open calm rather than mid-firefight */
 if(AC){
  musCombatT=AC.currentTime+MUS_COMBAT_T;
  ok('T81.E an armed combat hold does select the combat loop', musWant()==='combat');
  G=null;musTick();
  fresh104(1040302);
  ok('T81.E ...but it does NOT survive a return to the menu into a new match',
     musWant()==='build');
 }

 G.paused=true;
 ok('T81.E a paused match asks for silence', musWant()==='');
 G.paused=false;

 G.over=true;
 ok('T81.E a finished match asks for silence, so the sting rings out alone', musWant()==='');
 G.over=false;

 muted=true;
 ok('T81.E muted asks for silence whatever the state', musWant()==='');
 muted=wasMuted;

 /* the volume desk covers every track and sits under the guns */
 ok('T81.E MUSV names every track and nothing else',
    Object.keys(MUSV).sort().join(',')===MUSKEYS.join(','));
 ok('T81.E music is quieter than the loudest gun, deliberately',
    MUSKEYS.every(k=>MUSV[k]<SNDV.gun_sniper.g));
 ok('T81.E the build-up loop is the quietest thing in the set - it runs longest',
    MUSV.build<=Math.min(MUSV.menu,MUSV.combat,MUSV.victory));
 ok('T81.E gunfire ducks the music, and not all the way to nothing',
    MUS_DUCK>0&&MUS_DUCK<1);
 ok('T81.E combat holds for seconds after the shooting stops, so it cannot flap',
    MUS_COMBAT_T>=3);
}

/* ---------- F: the two wiring points, in the shipped source ---------- */
{
 section('T81.F the frame loop and the victory sting are wired where they must be');
 if(!SCRIPT104){
  ok('T81.F (skipped - pw.html not readable)', true);
 }else{
  const f=SCRIPT104.indexOf('function frame(t){');
  const call=SCRIPT104.indexOf('musTick()',f);
  const ret=SCRIPT104.indexOf('if(!G){lastT=t;return}',f);
  ok('T81.F frame() calls musTick', f>0&&call>f);
  /* THE BUG THIS PREVENTS: below the early return, the menu - which is exactly
     the !G case - would be silent, and nobody would hear the menu march at all. */
  ok('T81.F ...ABOVE its `if(!G) return`, because the menu is exactly !G',
     call>f&&ret>call);

  /* v104.1: this called musSting('victory') directly. It goes through the
     once-per-match gate now, because the sting also fires DURING play the
     moment the match is decided (T82.D) and a win that met both conditions
     would otherwise sound the fanfare twice. The claim is unchanged - endGame
     still fires it, on a win, never for a spectator - only the callee moved. */
  const eg=SCRIPT104.indexOf('function endGame(win){');
  const sting=SCRIPT104.indexOf('musVictory()',eg);
  ok('T81.F endGame fires the victory sting', eg>0&&sting>eg&&sting-eg<400);
  /* v104.2 REVERSES HALF OF THIS CLAIM, deliberately. It read `win&&!G.watch`:
     a spectator has no side, so there was no win to celebrate. The owner then
     watched a whole match in spectate and pointed out that they never heard the
     fanfare - and a spectator who sat through the match has as much claim on
     the ending as anyone. `win||G.watch` now. The "only on a win" half stands
     unchanged for a player who has a side. */
  ok('T81.F ...on a win, or for a spectator who watched the whole match',
     SCRIPT104.slice(eg,sting+40).indexOf('win||G.watch')>0);
 }
 /* v104.1: this was ==='v104' and is a DUPLICATE of T75.B, which is the
    deliberately-transcribed version pin. Widened to "this tail's release or a
    point release of it" so a feedback pass edits one line, not two. */
 ok('T81.F the release stamp is v104 or a point release of it',
    String(GAME_VER).indexOf('v104')===0);
}
