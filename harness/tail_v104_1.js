/* tail_v104_1.js - T82: the soundtrack feedback pass.

   Three things the owner found playing v104, each landing here as a change AND
   a check (the v92.1 / v96.1 / v97 pattern).

   ALL THREE WERE INVISIBLE TO THE SUITE, and for the same structural reason:
   the headless shim has no AudioContext and no fetch, so v104's tests could
   assert that the music DEGRADES correctly and never that it WORKS. Every one
   of these was found by playing, root-caused in real Chromium, and only then
   written down here. What follows is therefore mostly checks on the ARITHMETIC
   and the WIRING - the parts that survive without a speaker - plus the source
   text of the two hookups that no headless run can execute.

     1. The menu march waited for a hover. A browser will not start an
        AudioContext before the user interacts, so it cannot play on load - that
        much is policy. But the only thing on the setup screen that ever called
        ac() was menuAudioBind's HOVER tick, so the march began when the pointer
        crossed a button and not when the player clicked anywhere. Measured:
        after a click on the page background, AC was still null.
     2. The score was buried under gunfire. MUS_DUCK .45 against a combat track
        at .38 put the music at .171 during a firefight - which is exactly when
        the player is watching, and exactly the track written to be heard there.
     3. THE VICTORY STING HAD NEVER PLAYED ONCE. decodeAudioData is async, so
        musBuf() returns null on the first ask for a track. The three loops hide
        that (asked every frame, the second ask wins, the loop starts a beat
        late); the sting is asked for once, at the one instant it must sound.
        Measured in Chromium: musSting('victory') returned false with
        ASSETS.mus.victory.buf unset. sndWarm() had covered ASSETS.snd only.

   And the owner re-specified WHEN it should fire, which is the real design
   change here: not at endGame - by then you are reading a results overlay - but
   while you are still playing, at the moment the outcome stops being in doubt. */

let HTML1041=null;
try{HTML1041=require('fs').readFileSync('pw.html','utf8')}catch(e){HTML1041=null}
const SCR1041=HTML1041?HTML1041.slice(HTML1041.indexOf('<script>'),HTML1041.indexOf('</script>')):'';

function cfg1041(seed,opp){return{seed:seed,map:'kitchen',mode:'dm',fac:'green',opp:opp||1,diff:'normal'}}
function fresh1041(seed,opp){G=null;newGame(cfg1041(seed,opp));return G.human}
/* the one enemy of a 1v1, skipping the neutral barricade owner */
function foe1041(){return G.players.find(p=>p!==G.human&&p!==G.neutral&&p.alive&&p.team!==G.human.team)}
/* strip a player's army to exactly `sup` supply worth, by deleting units */
function strip1041(p,sup){
 for(const u of p.units.slice()){
  if(supUsed(p)<=sup)break;
  const i=G.units.indexOf(u);if(i>=0)G.units.splice(i,1);
  p.units.splice(p.units.indexOf(u),1);
 }
 return supUsed(p);
}

/* ---------- A: the first gesture, any gesture ---------- */
{
 section('T82.A the menu march starts on any interaction, not on a hover');
 ok('T82.A three gestures are listened for - pointer, touch and key',
    Array.isArray(MUS_UNLOCK_EV)&&MUS_UNLOCK_EV.length===3
    &&MUS_UNLOCK_EV.indexOf('pointerdown')>=0
    &&MUS_UNLOCK_EV.indexOf('touchstart')>=0
    &&MUS_UNLOCK_EV.indexOf('keydown')>=0);
 /* A NAMED function, on the v73 rule: the shim's addEventListener is a no-op,
    so the only thing a headless run can check is that the handler exists by
    name and that the source binds THAT name. An inline arrow would be
    unreachable to both. */
 ok('T82.A the handler is a named function, so the source text can name it',
    typeof musUnlock==='function');
 ok('T82.A calling it headless is harmless - no context, no throw',
    (()=>{try{musUnlock();return true}catch(e){return false}})());

 if(SCR1041){
  const u=SCR1041.indexOf('function musUnlock(');
  ok('T82.A musUnlock creates the context and starts the march on that gesture',
     u>0&&/function musUnlock\(\)\{[\s\S]{0,120}ac\(\)[\s\S]{0,120}musTick\(\)/.test(SCR1041.slice(u,u+400)));
  ok('T82.A it unbinds itself once a context exists',
     SCR1041.slice(u,u+500).indexOf('removeEventListener')>0);
  /* ON THE DOCUMENT, not on #setup: binding to the setup screen would repeat
     v104's mistake in a wider form - it would still be "interact with the menu"
     rather than "interact at all". */
  const bind=SCR1041.indexOf('document.addEventListener(ev,musUnlock,true)');
  ok('T82.A the listeners are on the document, in capture, not on the menu',
     bind>u);
 }
}

/* ---------- B: the mix under gunfire ---------- */
{
 section('T82.B the score is audible during the fight it was written for');
 const V104_DUCK=.45,V104_COMBAT=.38; // what the owner played and objected to
 ok('T82.B the duck is gentler than the one that buried it', MUS_DUCK>V104_DUCK);
 ok('T82.B it is still a duck, not a no-op', MUS_DUCK>0&&MUS_DUCK<1);
 ok('T82.B the combat track is louder than it was', MUSV.combat>V104_COMBAT);
 const now=MUSV.combat*MUS_DUCK,was=V104_COMBAT*V104_DUCK;
 ok('T82.B under fire the combat loop is at least twice its v104 level',
    now>=2*was);
 /* the ceiling matters as much as the floor: music is the floor of the mix and
    must not start masking the gun cues the duck exists to protect */
 ok('T82.B ...and still sits under the loudest gun in the game',
    now<SNDV.gun_sniper.g);
 ok('T82.B every track still ducks by the same single multiplier',
    Object.keys(MUSV).every(k=>MUSV[k]>0&&MUSV[k]<=1));
}

/* ---------- C: the decodes are warmed, which is what makes the sting exist ---- */
{
 section('T82.C every music track decodes up front, like the takes since v92');
 ok('T82.C musWarm exists', typeof musWarm==='function');
 ok('T82.C it is harmless with nothing loaded, which is the headless case',
    (()=>{try{musWarm();return true}catch(e){return false}})());
 if(SCR1041){
  const a=SCR1041.indexOf('function ac(){');
  const sw=SCR1041.indexOf('sndWarm()',a),mw=SCR1041.indexOf('musWarm(',a);
  ok('T82.C ac() warms the music', a>0&&mw>a);
  /* AFTER sndWarm, because a battle sound is needed sooner than a fanfare */
  ok('T82.C ...alongside the takes, in the same place and after them',
     sw>a&&mw>sw&&mw-sw<600);
  const w=SCR1041.indexOf('function musWarm(');
  ok('T82.C musWarm walks ASSETS.mus and asks musBuf for each',
     w>0&&/function musWarm\(\)\{for\(const k in ASSETS\.mus\)musBuf\(k\)\}/.test(SCR1041.slice(w,w+120)));
 }
}

/* ---------- D: the owner's mop-up rule, driven ---------- */
{
 section('T82.D the fanfare fires when the outcome stops being in doubt');
 ok('T82.D the supply lead that decides a match is a named constant',
    typeof MUS_MOP_DELTA==='number'&&MUS_MOP_DELTA===20);

 fresh1041(1041001);
 ok('T82.D an even opening is not decided', musDecided()===false);

 /* the owner's first clause: the enemy has no army left at all */
 const f=foe1041();
 strip1041(f,0);
 ok('T82.D one enemy left holding zero supply IS decided', musDecided()===true);

 /* the second clause: a lead of more than MUS_MOP_DELTA. The boundary is
    EXCLUSIVE - "exceeds 20" - and a test that does not drive both sides of a
    boundary has not tested it. */
 fresh1041(1041002);
 const me=G.human,fo=foe1041();
 /* makeUnit is (key, player, x, y) - key FIRST. Spawned on top of the
    player's own base so nothing wanders into a hazard mid-check. */
 const mkSup=(p,want)=>{
  const hq=p.blds[0],hx=hq?hq.x:20,hy=hq?hq.y:20;
  let guard=0;
  while(supUsed(p)<want&&guard++<400){
   const u=makeUnit('grunt',p,hx+1,hy+1);
   if(!u)break;
   u.state='idle';
  }
  return supUsed(p);
 };
 strip1041(fo,0);mkSup(fo,10);
 strip1041(me,0);mkSup(me,10+MUS_MOP_DELTA);
 const dEq=supUsed(me)-supUsed(fo);
 ok('T82.D a lead of exactly the delta is NOT decided - the rule says exceeds',
    dEq!==MUS_MOP_DELTA||musDecided()===false);
 mkSup(me,supUsed(me)+2);
 ok('T82.D a lead of more than the delta IS decided',
    supUsed(me)-supUsed(fo)>MUS_MOP_DELTA&&musDecided()===true);

 /* IT IS A VICTORY STING. The same position from the losing side gets silence,
    which is the one thing the owner's wording left open and the name settles. */
 fresh1041(1041003);
 strip1041(G.human,0);
 ok('T82.D the losing side gets no fanfare, whatever the gap',
    musDecided()===false);

 /* everything that is not a decided 1v1 */
 fresh1041(1041004,2);
 strip1041(foe1041(),0);
 ok('T82.D two enemies left is never decided, however one of them is doing',
    musDecided()===false);

 fresh1041(1041005);
 strip1041(foe1041(),0);
 G.over=true;
 ok('T82.D a finished match does not re-fire it', musDecided()===false);
 G.over=false;
 /* v104.2: this asserted the OPPOSITE - that a spectator got no fanfare,
    because they have no side. The owner watched a whole match that way and
    found the silence wrong, so a spectated match is now decided on the same
    delta rule applied between the last two armies, direction-free. T83.E owns
    the detail; this line records that the claim was reversed on purpose. */
 G.watch=true;
 ok('T82.D a spectated match IS decided - no side to take, but an ending to hear',
    musDecided()===true);
 G.watch=false;
 G.spectate=true;
 ok('T82.D an eliminated player watching on gets none either', musDecided()===false);
 G.spectate=false;
 ok('T82.D ...and clearing those flags restores it', musDecided()===true);
}

/* ---------- E: the sting fires once, and a failure is not a firing ---------- */
{
 section('T82.E the once-gate consumes on success only');
 const wasMuted=muted;
 fresh1041(1041101);
 strip1041(foe1041(),0);
 muted=false;musVicDone=false;
 /* headless there is no buffer, so musSting fails. The gate MUST NOT record
    that as the sting having played - that is precisely how v104 lost it. */
 const r=musVictory();
 ok('T82.E a sting that could not sound returns false', r===false);
 ok('T82.E ...and does NOT consume the one firing', musVicDone===false);

 muted=true;
 ok('T82.E muted refuses', musVictory()===false);
 ok('T82.E ...and does not consume it either, so unmuting still earns it',
    musVicDone===false);
 muted=wasMuted;

 musVicDone=true;
 ok('T82.E once it HAS fired, the gate refuses a second', musVictory()===false);

 /* and a new match hands it back */
 G=null;musTick();
 ok('T82.E returning to the menu re-arms it for the next match',
    musVicDone===false);
 fresh1041(1041102);
}

/* ---------- F: the wiring, in the shipped source ---------- */
{
 section('T82.F both triggers go through the one gate');
 if(!SCR1041){
  ok('T82.F (skipped - pw.html not readable)', true);
 }else{
  const t=SCR1041.indexOf('function musTick(){');
  ok('T82.F musTick checks the mop-up rule every frame',
     t>0&&SCR1041.slice(t,t+900).indexOf('musDecided()')>0);
  const eg=SCR1041.indexOf('function endGame(win){');
  ok('T82.F endGame still fires it, as the fallback for a win that never mopped up',
     eg>0&&SCR1041.slice(eg,eg+400).indexOf('musVictory()')>0);
  /* THE BUG THIS PREVENTS: endGame calling musSting directly again would bypass
     the gate and double the fanfare on any match that met both conditions. */
  ok('T82.F ...through musVictory, never musSting directly',
     SCR1041.slice(eg,eg+400).indexOf('musSting(')<0);
  ok('T82.F the reset rides with the combat hold, on the same menu frame',
     t>0&&/if\(!G\)\{musCombatT=0;musVicDone=false;\}/.test(SCR1041.slice(t,t+700)));
 }
 /* this tail's release, or any point release of it - T75.B is the version pin
    and there is no value in a second one drifting beside it */
 ok('T82.F the release stamp is v104 or a point release of it',
    String(GAME_VER).indexOf('v104')===0);
}
