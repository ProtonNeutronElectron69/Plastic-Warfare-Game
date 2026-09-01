/* ---------------- MUSIC (v104) ----------------
   Four recorded tracks, one per phase of a match: the menu march, the build-up
   loop, the combat loop, and a one-shot victory sting. All four are the United
   States Army Old Guard Fife and Drum Corps.

   THE WHOLE FILE IS CLIENT-LOCAL PRESENTATION. Nothing here is in hashState()
   or the save snapshot, nothing here calls srand(), and musTick() reads the
   game but never writes it - so two machines whose music is out of step (one
   muted, one whose decode failed) still run bit-identical simulations. That is
   rule 2 and the G.cam precedent, applied to a subsystem that is very tempting
   to give state to.

   IT IS ALSO ENTIRELY OPTIONAL, in the assets-override sense the whole project
   is built on. No AudioContext, muted, a manifest that never loaded, a decode
   that failed - every one of those leaves musBuf() answering null and the game
   playing exactly as it did at v103, silently. The headless suite has no fetch,
   so that silent path is the one it exercises on every run, permanently. */

/* Per-track gain. This is the mixing desk for music and the ONLY one - the
   files are peak-normalised, so a track that sits wrong is fixed here and not
   by re-encoding it (the v92 rule for SNDV, which this deliberately mirrors).
   Music sits well under the guns on purpose: it is the floor of the mix, not a
   layer of it. */
const MUSV={menu:.60,build:.38,combat:.62,victory:.66};
/* TRACKS DO NOT CROSSFADE. v104 faded the outgoing track down while fading the
   incoming one up, which is right for ambience and wrong for music: two marches
   in different keys and tempos sounding together is a mess, however briefly.
   Measured on the v104.3 build - 0.25s into a build->combat switch the old track
   sat at 0.16 against the new one's 0.18, both plainly audible, and the owner
   reported it "just overlays both". Worse, setTargetAtTime is asymptotic and
   never arrives: the outgoing gain floored at 0.0055 and stayed there.

   So a transition is SEQUENCED - down, a beat of silence, then up - and the
   ramps are linear so they reach exactly zero. */
const MUS_FADE_OUT=0.55; // seconds to take the outgoing track to silence
const MUS_GAP=0.30;      // silence between the two, so they never sound together
const MUS_FADE_IN=0.85;  // seconds to bring the incoming track up
/* THE DUCK, THIRD TIME. v104 shipped .45 x .38 = .171 and the owner could not
   hear it. v104.1 went to .75 x .50 = .375 and the owner still could not. The
   mistake in both was treating this as a tuning problem with one right answer:
   a firefight is a dozen gun voices SUMMING against one music voice, so what
   "loud enough" means depends on the fight, the mix and the listener's speakers.
   So .90 x .62 = .558 is now only the DEFAULT, and the player has a fader
   (MUSV_USER / SFXV_USER, the Music and Effects sliders). A duck of .90 is a dip
   that keeps a gun cue clear rather than a hole the score falls into. */
const MUS_DUCK=.90;      // how far music drops under gunfire (multiplier)
const MUS_COMBAT_T=7;    // seconds of quiet before combat relaxes back to build
const MUS_COMBAT_IN=1.5; // seconds of fighting before the score commits to combat
const MUS_MOP_DELTA=20;  // supply-used lead that means the match is decided
/* v104.3 ANTI-FLICKER, two layers, because supply moves every time a unit dies
   or finishes building and the raw rule sits right on that churn.
   1. A SCHMITT GAP. The track starts at a lead of more than MUS_MOP_DELTA but
      does not stop until the lead falls below MUS_MOP_DELTA - MUS_MOP_HYST, so
      a lead hovering at 20 cannot chatter the music on and off.
   2. A TRAILING DWELL. Once playing it holds MUS_VIC_HOLD seconds past the
      moment the relaxed rule stops being true - long enough that a brief
      counter-attack does not cut the fanfare mid-phrase. */
const MUS_MOP_HYST=8;    // how far the lead must fall back before it stops
const MUS_VIC_HOLD=12;   // seconds it keeps playing after the rule lets go
const MUS_FIGHT_N=2;     // units swinging before the score calls it a battle
const MUS_SCAN_EVERY=10; // frames between sim scans; the hold is seconds long
const VOL_MAX=1.5;       // both sliders run 0..150%, so 100% has headroom above it

let musBus=null;         // gain node, hangs off masterGain like armsBus
let musNow=null;         // {src,gain,key} currently playing, or null
let musKey='';           // what musNow is, '' when nothing plays
let musDuckT=0;          // AC time until which music stays ducked
let musCombatT=0;        // AC time until which the match counts as "in combat"
let musVicOn=false;      // the latched victory reading - see musVicTick
let musVicUntil=0;       // AC time before which the latch will not let go
let musVicEnd=false;     // the match ENDED in a way that earns the victory track
let musScanF=0;          // frame counter for the throttled battle scan
let musFightSince=0;     // AC time this bout of fighting was first seen
let musPend='';          // track waiting for the outgoing one to finish leaving
let musPendT=0;          // AC time it may start

/* The two faders, 0..VOL_MAX, 1 = the tuned default. Persisted per browser like
   pw_mmsize, and read the same defensive way - a browser with storage blocked
   gets the defaults and everything still works. */
let MUSV_USER=(function(){try{const v=parseFloat(localStorage.getItem('pw_musvol'));
 return (isFinite(v)&&v>=0&&v<=VOL_MAX)?v:1}catch(e){return 1}})();
let SFXV_USER=(function(){try{const v=parseFloat(localStorage.getItem('pw_sfxvol'));
 return (isFinite(v)&&v>=0&&v<=VOL_MAX)?v:1}catch(e){return 1}})();

/* Set and store one fader. `which` is 'mus' or 'sfx'. Applying is immediate and
   separate from storing, so a browser that refuses localStorage still gets the
   slider it just moved. */
function setVol(which,v){
 v=Math.max(0,Math.min(VOL_MAX,+v||0));
 if(which==='sfx'){SFXV_USER=v;try{localStorage.setItem('pw_sfxvol',String(v))}catch(e){}
  if(AC&&sfxBus)try{sfxBus.gain.setTargetAtTime(v,AC.currentTime,.05)}catch(e){}}
 else{MUSV_USER=v;try{localStorage.setItem('pw_musvol',String(v))}catch(e){}
  musDuckT=-1;                    // force musTick to re-apply the bus gain
 }
 return v;
}

/* Decode on demand and cache, exactly as sndBuf does for the takes. Returns
   null for every reason a track might not be there, and null is always a legal
   answer - the caller falls back to silence. */
function musBuf(key){
 const a=ASSETS.mus&&ASSETS.mus[key];
 if(!a||a.err)return null;
 if(!a.buf&&!a.pend&&AC){
  a.pend=1;
  try{AC.decodeAudioData(a.bytes.slice(0),b=>{b.pwOff=sndLead(b);a.buf=b;},()=>{a.err=1;});}
  catch(e){a.err=1;}
 }
 return a.buf||null;
}

/* Kick every music decode once, the moment there is a context to decode with -
   the mirror of sndWarm(), and called from the same place in ac().

   THIS IS WHAT MADE THE VICTORY STING EXIST. decodeAudioData is asynchronous,
   so musBuf() returns null on the FIRST call for a track and the buffer only
   arrives a moment later. The three loops hide that completely: they are asked
   for repeatedly, every frame, so the second ask succeeds and all that happens
   is the loop starts a beat late. The sting is asked for once, at the single
   instant it must sound - so through the whole of v104 it answered null and
   played never. Measured in Chromium: musSting('victory') returned false with
   ASSETS.mus.victory.buf still unset. */
function musWarm(){for(const k in ASSETS.mus)musBuf(k)}

/* The music bus. Built lazily off masterGain so this file needs no edit inside
   ac()'s own try block - if masterGain is null (no context, or the bus block
   threw) there is simply no music, which is the fallback. */
function musGain(){
 if(musBus)return musBus;
 if(!AC||!masterGain)return null;
 try{musBus=AC.createGain();musBus.gain.value=1;musBus.connect(masterGain);}
 catch(e){musBus=null;}
 return musBus;
}

/* Start `key`, crossfading out whatever is playing. A loop gets its loop points
   from MUS_LOOP, OFFSET BY THE DECODER'S OWN LEADING SILENCE (b.pwOff, measured
   by sndLead): an mp3's encoder padding decodes as real silence and how much
   survives differs per browser, so the file's 0.5 s margin plus this offset is
   what keeps the loop landing on music instead of on padding. Both points move
   by the same offset, so the loop LENGTH is exact either way. */
function musPlay(key){
 if(musKey===key)return true;
 const g=musGain();if(!g)return false;
 const buf=musBuf(key);if(!buf)return false;
 musStop(); // a safety net: the sequencer in musTick has already emptied musNow
 let src,gain;
 try{
  src=AC.createBufferSource();src.buffer=buf;
  gain=AC.createGain();gain.gain.value=0;
  src.connect(gain).connect(g);
  const L=(typeof MUS_LOOP!=='undefined')?MUS_LOOP[key]:null,off=buf.pwOff||0;
  if(L){src.loop=true;src.loopStart=off+L.start;src.loopEnd=off+L.end;}
  src.start(0,off);
  const t0=AC.currentTime;
  gain.gain.setValueAtTime(0,t0);
  gain.gain.linearRampToValueAtTime(MUSV[key]||.4,t0+MUS_FADE_IN);
 }catch(e){return false}
 musNow={src:src,gain:gain,key:key};musKey=key;
 return true;
}

/* Take the current track to SILENCE and stop it. Two deliberate choices:

   A LINEAR RAMP, not setTargetAtTime. The exponential approach is asymptotic -
   it never arrives - and measurement showed the outgoing gain flooring at
   0.0055 and sitting there for as long as the node lived. linearRampToValueAtTime
   reaches exactly zero at a time we choose.

   src.stop() ON THE AUDIO CLOCK, not a setTimeout. The audio thread and the
   timer queue are different clocks; scheduling the stop where the ramp lands
   means the node cannot outlive its own fade under load. */
function musStop(){
 const m=musNow;musNow=null;musKey='';
 if(!m||!AC)return;
 try{
  const t=AC.currentTime,g=m.gain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value,t);
  g.linearRampToValueAtTime(0,t+MUS_FADE_OUT);
  m.src.stop(t+MUS_FADE_OUT+0.05);
 }catch(e){}
}

/* THE LATCH. Updated once a frame from musTick; musWant only reads it.

   v104.3 REPLACES THE STING ENTIRELY. Victory used to be a 6.5s one-shot fired
   on its own node by musSting/musVictory, deliberately outside the track
   machinery so nothing could crossfade it away. The owner asked for the
   opposite: continuous while the match is decided, continuous over the
   end-of-match graphs, overriding whatever is playing, and mixed like any other
   part of the score. That is a TRACK, so it is one - a fourth loop, chosen by
   musWant, crossfaded and ducked with the rest. musSting and musVictory are
   gone rather than left unused.

   Note the order: the end-of-match case is checked FIRST and never lets go,
   because once the results screen is up there is no rule left to re-evaluate -
   the match is over and the music simply plays until you leave for the menu. */
function musVicTick(){
 if(!G){musVicOn=false;musVicUntil=0;musVicEnd=false;return}
 if(musVicEnd){musVicOn=true;return}
 const now=AC?AC.currentTime:0;
 if(musVicOn){
  if(musDecided(true))musVicUntil=now+MUS_VIC_HOLD;   // still true: push the dwell out
  else if(now>=musVicUntil)musVicOn=false;            // and only then let go
 }else if(musDecided(false)){
  musVicOn=true;musVicUntil=now+MUS_VIC_HOLD;
 }
}

/* IS A BATTLE HAPPENING? Read off the simulation, not off what you can hear.

   THIS IS THE SPECTATE BUG, and it was never really a spectate bug. Through
   v104.1 the combat track was driven by COMBAT_DUCK_T, which every weapon sets
   - but sfxGun returns BEFORE setting it when the shot is off-screen, because
   audFor() answers null outside the viewport. So the score followed the CAMERA
   rather than the battle: park the view away from the fighting and the music
   never knew a war was on. In spectate the camera does not chase the action at
   all, which is why the owner watched a whole match on the build-up loop.

   COMBAT_DUCK_T is still exactly right for the DUCK - that asks "are guns loud
   near the listener", which is a camera question. Choosing the TRACK is a
   different question with a different answer, so it gets its own reading. */
function musFighting(){
 if(!G||!G.units)return false;
 /* IN THE CAMERA'S VIEW, which is the owner's wording and a narrowing of what
    v104.2 shipped. That release widened this to the whole map to fix spectate
    hearing nothing; in a normal match the effect was that a battle you were not
    watching still changed your music. audFor/audAt is the door that already
    answers "can the listener hear something at this spot" - viewport plus fog -
    so the score reuses it rather than inventing a second notion of on-screen.

    SPECTATE KEEPS THE WHOLE-MAP READING. A player's camera follows their own
    battle, so scoping to it is meaningful; a spectator has no army and no
    reason for the camera to be anywhere in particular, which is exactly the
    case that reported silence for a whole match at v104.2. */
 const fov=!(G.watch||G.spectate)&&typeof audAt==='function';
 let n=0;
 for(const u of G.units){
  if(u.state!=='attack'||!u.target)continue;
  if(fov&&!audAt(u.x,u.y))continue;
  if(++n>=MUS_FIGHT_N)return true;
 }
 return false;
}

/* THE FIRST GESTURE, ANY GESTURE.

   A browser refuses to start an AudioContext until the user has interacted, so
   the menu march genuinely cannot play on load - that part is policy, not a
   bug. What WAS a bug is which interactions counted. Through v104 the only
   thing on the setup screen that ever called ac() was menuAudioBind's hover
   tick, so the music began when the pointer happened to cross a button and not
   before: the owner reported it "only triggers when the mouse hovers over a
   menu button", and a click on the page background left AC null (measured).

   One listener each for pointer, touch and key, on the document, removing
   themselves once a context exists. Guarded on addEventListener because the
   headless shim's is a no-op and there is no document to bind in Node. */
const MUS_UNLOCK_EV=['pointerdown','touchstart','keydown'];
function musUnlock(){
 if(!ac())return;
 musTick();                       // start the march on this very gesture
 if(typeof document!=='undefined'&&document.removeEventListener)
  for(const ev of MUS_UNLOCK_EV)document.removeEventListener(ev,musUnlock,true);
}
if(typeof document!=='undefined'&&document.addEventListener)
 for(const ev of MUS_UNLOCK_EV)document.addEventListener(ev,musUnlock,true);

/* Has the human effectively won already? The owner's rule, and the reason it
   is not simply "the match ended": by the time endGame fires you are looking at
   the results overlay, and a fanfare there is a stinger on a title card. This
   fires while you are still playing, at the moment the outcome stops being in
   doubt - one enemy left, and either they have no army at all or you are more
   than MUS_MOP_DELTA supply ahead of them. What remains is mopping up buildings.

   It is a VICTORY sting, so it only fires when the lead is YOURS; the same
   position seen from the losing side gets nothing. Spectators have no side and
   are excluded, as they already were at endGame. */
function musDecided(sustain){
 if(!G||G.over||typeof supUsed!=='function')return false;
 /* `sustain` asks the RELAXED question - "is this still true enough to keep
    playing" rather than "is it true enough to start". The gap between the two
    is the hysteresis; asking one question with two thresholds is what stops
    the boundary chattering. */
 const gap=sustain?(MUS_MOP_DELTA-MUS_MOP_HYST):MUS_MOP_DELTA;
 /* SPECTATING (v104.2). A watcher has no side, so "is the lead yours" has no
    answer - but the match is just as decided and the owner still wants to hear
    it. Two players left, the same delta rule between them, direction-free. */
 if(G.watch){
  const live=G.players.filter(p=>p!==G.neutral&&p.alive);
  if(live.length!==2)return false;
  const a=supUsed(live[0]),b=supUsed(live[1]);
  return a===0||b===0||Math.abs(a-b)>gap;
 }
 if(G.spectate)return false;      // eliminated: your side is not the one mopping up
 const me=G.human;
 if(!me||!me.alive)return false;
 const foes=G.players.filter(p=>p!==me&&p!==G.neutral&&p.alive&&p.team!==me.team);
 if(foes.length!==1)return false;
 const mine=supUsed(me),theirs=supUsed(foes[0]);
 if(mine<=theirs)return false;
 return theirs===0||(mine-theirs)>gap;
}

/* Fire the sting, at most once per match.

   The flag is consumed only on SUCCESS, so a sting asked for before its buffer
   finished decoding is retried on the next frame rather than silently spent -
   which is the same failure that made v104's sting inaudible, now unable to
   swallow the event even if warming were ever to miss. muted does not consume
   it either: unmuting while the mop-up is still on still earns the fanfare. */
/* Which track the game wants RIGHT NOW. Pure reading - no game state is
   written, and the answer is derived every frame rather than stored, which is
   the same discipline gRsv and the auras use. '' means silence. */
function musWant(){
 if(muted)return '';
 if(!G)return 'menu';                 // the setup screen: G is null exactly then
 if(G.paused)return '';               // pause still silences everything
 /* VICTORY OUTRANKS EVERYTHING BELOW IT (v104.3) - it overrides the combat and
    build loops while the match is being mopped up, and it is the one track that
    keeps playing once G.over is true, under the end-of-match graphs. */
 if(musVicOn)return 'victory';
 if(G.over)return '';                 // over WITHOUT a victory: the defeat screen is silent
 /* No AudioContext is a question for musTick, not for this function: what the
    game WANTS and what the machine CAN PLAY are two claims, and folding them
    together here made a running match ask for silence under the headless shim
    (T81.E). The combat clock is an AC time, so it is guarded rather than
    assumed. */
 return (AC&&AC.currentTime<musCombatT)?'combat':'build';
}

/* Called every frame from frame(), BEFORE its `if(!G) return` - the menu needs
   music too, and that early return is why this cannot live below it.

   COMBAT_DUCK_T is the existing "guns are going off near the camera" signal,
   set by every weapon and explosion since v27.1 and already used to pull the
   mining loop down. Music reads the same clock for two different jobs: it ducks
   while it is true, and it holds the combat track for MUS_COMBAT_T seconds
   after it goes quiet, so a firefight does not flap the score back and forth
   between two tracks every time there is a lull. */
function musTick(){
 if(!AC||!musGain())return;
 /* THE COMBAT HOLD IS PER MATCH, and forgetting that was a real bug rather
    than a test artifact. musCombatT is module state that outlives a match, so
    a player who finished one firefight, quit, and started again inside
    MUS_COMBAT_T seconds opened the new match on the COMBAT track - the game
    remembering shooting that happened in a match that no longer exists.
    Returning to the menu is the one moment every match boundary passes
    through (againBtn and quitBtn both set G=null), so it is where the hold is
    cleared. T81.E drives exactly this. */
 if(!G){musCombatT=0;musFightSince=0;musPend='';musPendT=0;}
 musVicTick();                 // v104.3: update the latch BEFORE musWant reads it
 const want=musWant();
 /* THE ENTRY BUFFER. The trailing hold (MUS_COMBAT_T) has always kept the
    combat track on after the shooting stops; this is the other side of it -
    fighting has to persist MUS_COMBAT_IN seconds before the score commits, so a
    single exchange between two scouts does not swing the whole soundtrack.
    The scan is throttled: it walks every unit, and both buffers are seconds
    long, so three reads a second is ample. */
 const now=AC.currentTime;
 if(G&&!G.over&&!G.paused&&(musScanF++%MUS_SCAN_EVERY)===0){
  if(musFighting()){
   if(!musFightSince)musFightSince=now;
   if(now-musFightSince>=MUS_COMBAT_IN)musCombatT=now+MUS_COMBAT_T;
  }else musFightSince=0;
 }

 /* THE TRANSITION IS SEQUENCED, and this is the whole of it. Wanting a
    different track starts the outgoing one leaving and QUEUES the incoming one;
    it starts only once the fade-out and the gap have both elapsed, so the two
    are never audible together. Re-deciding mid-transition just re-queues. */
 if(want!==musKey&&want!==musPend){
  /* CAPTURE THIS FIRST. musStop() clears musKey, so reading it afterwards to
     decide whether a gap is needed always answered "nothing was playing" and
     the incoming track started instantly - which is the overlay all over again,
     in the very code written to prevent it. Measured: 0.21 against 0.18 two
     frames after the switch, before this line existed. */
  const had=!!musKey;
  if(had)musStop();                          // begin the exit
  musPend=want;
  musPendT=now+(had?MUS_FADE_OUT+MUS_GAP:0);
 }
 if(musPend&&now>=musPendT){
  const k=musPend;musPend='';
  if(k)musPlay(k);
 }
 const duck=(AC.currentTime<COMBAT_DUCK_T)?MUS_DUCK:1;
 if(duck!==musDuckT){
  musDuckT=duck;
  try{musBus.gain.setTargetAtTime(duck*MUSV_USER,AC.currentTime,.25);}catch(e){}
 }
}
