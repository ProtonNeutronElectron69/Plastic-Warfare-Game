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
const MUSV={menu:.60,build:.38,combat:.62,victory:.70};
const MUS_FADE=1.8;      // seconds to crossfade one track into the next
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
const MUS_MOP_DELTA=20;  // supply-used lead that means the match is decided
const MUS_FIGHT_N=2;     // units swinging before the score calls it a battle
const MUS_SCAN_EVERY=10; // frames between sim scans; the hold is seconds long
const VOL_MAX=1.5;       // both sliders run 0..150%, so 100% has headroom above it

let musBus=null;         // gain node, hangs off masterGain like armsBus
let musNow=null;         // {src,gain,key} currently playing, or null
let musKey='';           // what musNow is, '' when nothing plays
let musDuckT=0;          // AC time until which music stays ducked
let musCombatT=0;        // AC time until which the match counts as "in combat"
let musVicDone=false;    // the sting is once per match, whichever trigger fires
let musScanF=0;          // frame counter for the throttled battle scan

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
 musStop();
 let src,gain;
 try{
  src=AC.createBufferSource();src.buffer=buf;
  gain=AC.createGain();gain.gain.value=0;
  src.connect(gain).connect(g);
  const L=(typeof MUS_LOOP!=='undefined')?MUS_LOOP[key]:null,off=buf.pwOff||0;
  if(L){src.loop=true;src.loopStart=off+L.start;src.loopEnd=off+L.end;}
  src.start(0,off);
  gain.gain.setTargetAtTime(MUSV[key]||.4,AC.currentTime,MUS_FADE/3);
 }catch(e){return false}
 musNow={src:src,gain:gain,key:key};musKey=key;
 return true;
}

/* Fade the current track out and let it stop itself. The node is released by
   the timeout, not kept in a list: nothing else ever needs to find it again. */
function musStop(){
 const m=musNow;musNow=null;musKey='';
 if(!m||!AC)return;
 try{
  m.gain.gain.setTargetAtTime(0,AC.currentTime,MUS_FADE/4);
  const s=m.src;setTimeout(()=>{try{s.stop()}catch(e){}},MUS_FADE*1000);
 }catch(e){}
}

/* The sting. Fire-and-forget on its own node so it is not the "current track"
   and cannot be crossfaded out from under itself. */
function musSting(key){
 const g=musGain();if(!g)return false;
 const buf=musBuf(key);if(!buf)return false;
 try{
  const src=AC.createBufferSource();src.buffer=buf;
  const gn=AC.createGain();gn.gain.value=MUSV[key]||.6;
  src.connect(gn).connect(g);src.start(0,buf.pwOff||0);
 }catch(e){return false}
 return true;
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
 let n=0;
 for(const u of G.units){
  if(u.state==='attack'&&u.target&&++n>=MUS_FIGHT_N)return true;
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
function musDecided(){
 if(!G||G.over||typeof supUsed!=='function')return false;
 /* SPECTATING (v104.2). A watcher has no side, so "is the lead yours" has no
    answer - but the match is just as decided and the owner still wants to hear
    it. Two players left, the same delta rule between them, direction-free. */
 if(G.watch){
  const live=G.players.filter(p=>p!==G.neutral&&p.alive);
  if(live.length!==2)return false;
  const a=supUsed(live[0]),b=supUsed(live[1]);
  return a===0||b===0||Math.abs(a-b)>MUS_MOP_DELTA;
 }
 if(G.spectate)return false;      // eliminated: your side is not the one mopping up
 const me=G.human;
 if(!me||!me.alive)return false;
 const foes=G.players.filter(p=>p!==me&&p!==G.neutral&&p.alive&&p.team!==me.team);
 if(foes.length!==1)return false;
 const mine=supUsed(me),theirs=supUsed(foes[0]);
 if(mine<=theirs)return false;
 return theirs===0||(mine-theirs)>MUS_MOP_DELTA;
}

/* Fire the sting, at most once per match.

   The flag is consumed only on SUCCESS, so a sting asked for before its buffer
   finished decoding is retried on the next frame rather than silently spent -
   which is the same failure that made v104's sting inaudible, now unable to
   swallow the event even if warming were ever to miss. muted does not consume
   it either: unmuting while the mop-up is still on still earns the fanfare. */
function musVictory(){
 if(musVicDone||muted)return false;
 if(!musSting('victory'))return false;
 musVicDone=true;
 return true;
}

/* Which track the game wants RIGHT NOW. Pure reading - no game state is
   written, and the answer is derived every frame rather than stored, which is
   the same discipline gRsv and the auras use. '' means silence. */
function musWant(){
 if(muted)return '';
 if(!G)return 'menu';                 // the setup screen: G is null exactly then
 if(G.over)return '';                 // the sting has already played; let it ring
 if(G.paused)return '';
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
 if(!G){musCombatT=0;musVicDone=false;}
 const want=musWant();
 if(musDecided())musVictory(); // v104.1: the fanfare lands while you are still playing
 /* the battle scan is throttled - it walks every unit, and the hold it feeds
    is MUS_COMBAT_T seconds long, so three reads a second is ample */
 if(G&&!G.over&&!G.paused&&(musScanF++%MUS_SCAN_EVERY)===0&&musFighting())
  musCombatT=AC.currentTime+MUS_COMBAT_T;
 if(want!==musKey){if(want)musPlay(want);else musStop();}
 const duck=(AC.currentTime<COMBAT_DUCK_T)?MUS_DUCK:1;
 if(duck!==musDuckT){
  musDuckT=duck;
  try{musBus.gain.setTargetAtTime(duck*MUSV_USER,AC.currentTime,.25);}catch(e){}
 }
}
