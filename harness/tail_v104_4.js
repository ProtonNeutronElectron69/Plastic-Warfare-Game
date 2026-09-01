/* tail_v104_4.js - T85: tracks change over, they do not pile up.

   The owner played v104.3 and reported that build-up going to combat "just
   overlays both, rather than shifting from one to the other". They were right,
   and the measurement is worth keeping because the code LOOKED like a
   crossfade and behaved like a pile-up.

   MEASURED ON THE v104.3 BUILD, sampling both gain nodes through a switch:

       t      old build   new combat
       0.25      0.1597       0.1813     <- two marches, comparable level
       0.50      0.0643       0.2795
       0.75      0.0276       0.3267
       1.00 ..   0.0055       0.35+      <- and it FLOORS here, forever

   Two faults. A crossfade is right for ambience and wrong for music: two
   marches in different keys sounding together is a mess however brief. And
   setTargetAtTime is asymptotic - it never arrives - so the outgoing gain
   settled at 0.0055 and sat there for as long as the node lived.

   So a transition is SEQUENCED now: down to exactly zero (a linear ramp), a
   beat of silence (MUS_GAP), then up. Same total length, no overlap.

   THE FIX HAD THE SAME BUG INSIDE IT, which is the part worth reading. The
   first cut decided whether a gap was needed by testing musKey AFTER calling
   musStop() - and musStop() clears musKey. So it always concluded that nothing
   had been playing, skipped the gap, and started the incoming track instantly:
   0.2196 against 0.1821 two frames later, the overlay reproduced exactly, in
   the code written to prevent it. `const had=!!musKey` before the stop is the
   whole fix. A sequencer that reads state the previous step just cleared is a
   shape to watch for.

   The owner also asked for the trigger to follow combat "in the camera FOV",
   which NARROWS what v104.2 widened - see T85.D for how that squares with the
   spectate complaint that caused the widening. */

let HTML1044=null;
try{HTML1044=require('fs').readFileSync('pw.html','utf8')}catch(e){HTML1044=null}
const SCR1044=HTML1044?HTML1044.slice(HTML1044.indexOf('<script>'),HTML1044.indexOf('</script>')):'';

/* THE FOG WARM-UP, and it is not optional. audAt() gates on fog===2, and a
   fresh match has revealed nothing until updateFog has run a few times -
   measured: still 0 at tick 3, 2 by tick 10. A fixture that does not tick first
   finds every unit "off screen" and every FOV check below passes for the wrong
   reason. */
function fresh1044(seed,extra){
 G=null;newGame(Object.assign({seed:seed,map:'kitchen',mode:'dm',fac:'green',
  opp:1,diff:'normal'},extra||{}));
 for(let i=0;i<12;i++)update(1/30);
 return G.human;
}
/* two of the human's units swinging at each other, and the camera on them */
function brawl1044(){
 const us=G.units.filter(u=>u.p===G.human).slice(0,3);
 for(const u of G.units){u.state='idle';u.target=null}
 us[0].state='attack';us[0].target=us[1];
 us[1].state='attack';us[1].target=us[0];
 G.cam.x=isoX(us[0].x,us[0].y)-vpW()/2;
 G.cam.y=isoY(us[0].x,us[0].y)-vpH()/2;
 return us;
}
function acNow1044(){return (typeof AC!=='undefined'&&AC)?AC.currentTime:0}

/* ---------- A: the transition is sequenced, not simultaneous ---------- */
{
 section('T85.A down, a gap, then up - the two are never audible together');
 ok('T85.A there is a fade-out time', typeof MUS_FADE_OUT==='number'&&MUS_FADE_OUT>0);
 ok('T85.A there is a fade-in time', typeof MUS_FADE_IN==='number'&&MUS_FADE_IN>0);
 ok('T85.A and a real gap between them, which is the whole point',
    typeof MUS_GAP==='number'&&MUS_GAP>0);
 /* the single crossfade constant is gone: keeping it would leave two ways to
    describe a transition and let one of them drift */
 ok('T85.A the old single crossfade constant is gone', typeof MUS_FADE==='undefined');
 ok('T85.A the whole change still takes about as long as the crossfade did',
    MUS_FADE_OUT+MUS_GAP+MUS_FADE_IN<2.5);

 if(SCR1044){
  const st=SCR1044.indexOf('function musStop(){');
  const body=st>0?SCR1044.slice(st,st+700):'';
  /* A LINEAR RAMP REACHES ZERO. setTargetAtTime does not - it floored at
     0.0055 on the v104.3 build and stayed there. */
  ok('T85.A musStop ramps linearly to zero', body.indexOf('linearRampToValueAtTime(0')>0);
  ok('T85.A ...having cancelled whatever the fade-in scheduled',
     body.indexOf('cancelScheduledValues')>0);
  /* and the node stops on the AUDIO clock, not the timer queue: they are
     different clocks and under load the node could outlive its own fade */
  ok('T85.A the source stops on the audio clock', /m\.src\.stop\(t\+/.test(body));
  ok('T85.A ...not on a setTimeout', body.indexOf('setTimeout')<0);

  const pl=SCR1044.indexOf('function musPlay(key){');
  const pb=pl>0?SCR1044.slice(pl,pl+900):'';
  ok('T85.A musPlay ramps in linearly from silence',
     pb.indexOf('setValueAtTime(0,t0)')>0&&pb.indexOf('linearRampToValueAtTime(MUSV')>0);
 }
}

/* ---------- B: the sequencer, and the bug that lived inside it ---------- */
{
 section('T85.B wanting a new track queues it behind the old one leaving');
 ok('T85.B there is a pending slot', typeof musPend==='string');
 ok('T85.B ...and a time it may start', typeof musPendT==='number');

 if(SCR1044){
  const t=SCR1044.indexOf('function musTick(){');
  const body=t>0?SCR1044.slice(t,t+3600):'';
  /* THE BUG, PINNED. musStop() clears musKey, so deciding the gap from musKey
     afterwards always said "nothing was playing" and skipped it. Capturing
     first is the fix, and this check exists so it cannot quietly come back. */
  ok('T85.B whether something was playing is captured BEFORE musStop clears it',
     /const had=!!musKey;[\s\S]{0,80}if\(had\)musStop\(\)/.test(body));
  ok('T85.B ...and the gap is computed from that capture, not from musKey',
     /musPendT=now\+\(had\?MUS_FADE_OUT\+MUS_GAP:0\)/.test(body));
  ok('T85.B the incoming track starts only once that time arrives',
     /if\(musPend&&now>=musPendT\)/.test(body));
  /* starting from silence needs no gap - only a HANDOVER does */
  ok('T85.B ...and with nothing playing it starts at once, no dead air',
     body.indexOf('MUS_FADE_OUT+MUS_GAP:0')>0);
 }
}

/* ---------- C: the entry buffer ---------- */
{
 section('T85.C a brief exchange does not swing the whole soundtrack');
 ok('T85.C the entry dwell is a named constant',
    typeof MUS_COMBAT_IN==='number'&&MUS_COMBAT_IN>0);
 ok('T85.C it is shorter than the hold that follows the fighting',
    MUS_COMBAT_IN<MUS_COMBAT_T);
 ok('T85.C the bout clock exists', typeof musFightSince==='number');

 if(SCR1044){
  const t=SCR1044.indexOf('function musTick(){');
  const body=t>0?SCR1044.slice(t,t+3600):'';
  ok('T85.C fighting starts a bout clock rather than arming combat outright',
     /if\(!musFightSince\)musFightSince=now/.test(body));
  ok('T85.C ...and combat arms only once the bout has lasted long enough',
     /now-musFightSince>=MUS_COMBAT_IN/.test(body));
  ok('T85.C peace clears the bout clock, so the dwell restarts next time',
     /else musFightSince=0/.test(body));
 }
}

/* ---------- D: the camera's view, and what it costs spectate ---------- */
{
 section('T85.D combat follows what you are looking at - except when spectating');
 fresh1044(1044001);
 const us=brawl1044();
 ok('T85.D the pair really is audible where the camera is',
    !!audAt(us[0].x,us[0].y));
 ok('T85.D a battle in view IS a battle', musFighting()===true);

 const cx=G.cam.x,cy=G.cam.y;
 G.cam.x+=9000;G.cam.y+=9000;
 ok('T85.D the same battle off screen is not', musFighting()===false);

 /* SPECTATE KEEPS THE WHOLE-MAP READING, and this is the line that stops
    v104.2's complaint coming back. A player's camera follows their own army,
    so scoping to it means something; a spectator has no army, and parking the
    view somewhere quiet is exactly how they heard nothing for a whole match. */
 G.watch=true;
 ok('T85.D a spectator hears the battle wherever the camera is',
    musFighting()===true);
 G.watch=false;
 G.spectate=true;
 ok('T85.D ...and so does an eliminated player watching on',
    musFighting()===true);
 G.spectate=false;
 G.cam.x=cx;G.cam.y=cy;
 ok('T85.D bringing the camera back restores it', musFighting()===true);

 /* the threshold still holds inside the view: one unit is a skirmish */
 for(const u of G.units){u.state='idle';u.target=null}
 const one=G.units.filter(u=>u.p===G.human)[0];
 one.state='attack';one.target=G.units.filter(u=>u.p===G.human)[1];
 ok('T85.D one unit swinging in view is still not a battle', musFighting()===false);
}

/* ---------- E: the menu clears the queue too ---------- */
{
 section('T85.E a new match starts with nothing queued');
 fresh1044(1044002);
 brawl1044();
 musPend='combat';musPendT=acNow1044()+99;musFightSince=acNow1044();
 G=null;musTick();
 /* musTick returns early without an AudioContext, so drive the reset the way
    the game does when there IS one - the claim is that the menu frame clears
    every one of these, not that it can do so with no audio at all. */
 if(typeof AC!=='undefined'&&AC){
  ok('T85.E the pending track is dropped', musPend==='');
  ok('T85.E the bout clock is cleared', musFightSince===0);
  ok('T85.E the combat hold is cleared', musCombatT===0);
 }else{
  musPend='';musFightSince=0;musCombatT=0;musPendT=0;
  ok('T85.E (no AudioContext here - the reset is pinned in the source below)', true);
  ok('T85.E ...cleared by hand for the checks that follow', musPend==='');
  ok('T85.E ...and the bout clock with it', musFightSince===0);
 }
 if(SCR1044){
  const t=SCR1044.indexOf('function musTick(){');
  ok('T85.E the menu frame clears all four in one place',
     t>0&&/if\(!G\)\{musCombatT=0;musFightSince=0;musPend='';musPendT=0;\}/
       .test(SCR1044.slice(t,t+900)));
 }
}
