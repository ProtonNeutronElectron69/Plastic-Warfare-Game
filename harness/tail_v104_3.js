/* tail_v104_3.js - T84: the victory music becomes a track.

   The owner asked for four things, and together they say "stop treating this as
   a sting": play continuously while the win conditions hold, keep playing over
   the end-of-match graphs, override whatever else is going, mix like any other
   part of the score - and do not chatter on the boundary of the conditions.

   The first three are one change. A sting is a fire-and-forget one-shot on its
   own node, deliberately outside the track machinery so nothing can crossfade
   it away; everything asked for here is what a TRACK does. So victory is a
   fourth loop now, cut by the same script, chosen by musWant, crossfaded and
   ducked with the rest. musSting/musVictory/musVicDone are gone rather than
   left lying around unused, and T84.F pins their absence.

   THE FOURTH IS THE INTERESTING ONE. Supply moves every time a unit dies or
   finishes building, and the rule sits right on that churn, so a single
   threshold would flap the music on and off around a lead of 20. Two layers
   answer it and they are independent, which is why T84.C and T84.D test them
   SEPARATELY:

     1. A SCHMITT GAP. Start above MUS_MOP_DELTA, do not stop until the lead
        falls below MUS_MOP_DELTA - MUS_MOP_HYST. An 8-wide dead band.
     2. A TRAILING DWELL of MUS_VIC_HOLD seconds past the moment the relaxed
        rule stops holding.

   A NOTE ON HOW THIS WAS MEASURED, because the first attempt lied. Driving it
   with the human's opening army (4 supply) made every margin NEGATIVE the
   moment the enemy built anything, so the latch held on the DWELL alone and
   never exercised the gap at all - and it looked like a pass. The checks below
   build the human up to ~48 supply first, so the margin can actually sit in the
   12..20 band where the gap is the only thing deciding, and they neutralise one
   layer while testing the other. A test that cannot fail for the reason it
   claims has not tested anything. */

let HTML1043=null;
try{HTML1043=require('fs').readFileSync('pw.html','utf8')}catch(e){HTML1043=null}
const SCR1043=HTML1043?HTML1043.slice(HTML1043.indexOf('<script>'),HTML1043.indexOf('</script>')):'';

function fresh1043(seed,extra){
 G=null;newGame(Object.assign({seed:seed,map:'kitchen',mode:'dm',fac:'green',
  opp:1,diff:'normal'},extra||{}));
 return G.human;
}
function foe1043(){
 return G.players.find(p=>p!==G.human&&p!==G.neutral&&p.alive&&p.team!==G.human.team);
}
/* set a player's army to exactly `n` supply: strip, then rebuild with grunts */
function setSup1043(p,n){
 for(const u of p.units.slice()){
  const i=G.units.indexOf(u);if(i>=0)G.units.splice(i,1);
 }
 p.units.length=0;
 const hq=p.blds[0],hx=hq?hq.x:20,hy=hq?hq.y:20;
 let guard=0;
 while(supUsed(p)<n&&guard++<400){
  const u=makeUnit('grunt',p,hx+1,hy+1);
  if(!u)break;
  u.state='idle';
 }
 return supUsed(p);
}
/* the margin the rule actually reads */
function margin1043(){return supUsed(G.human)-supUsed(foe1043())}

/* ---------- A: a fourth loop, cut like the other three ---------- */
{
 section('T84.A victory is a loop now, not a 6.5 second one-shot');
 ok('T84.A it carries loop points at last', !!MUS_LOOP.victory);
 ok('T84.A ALL FOUR tracks loop', ['menu','build','combat','victory']
    .every(k=>MUS_LOOP[k]&&MUS_LOOP[k].end>MUS_LOOP[k].start));
 const L=MUS_LOOP.victory.end-MUS_LOOP.victory.start;
 ok('T84.A the loop is tens of seconds, in line with the rest', L>20&&L<40);
 ok('T84.A it keeps the same margin outside the loop as the others',
    MUS_LOOP.victory.start===MUS_LOOP.menu.start);
 /* it is a continuous track now, so it sits at a track's level rather than a
    sting's - it runs for minutes on the results screen, not six seconds */
 ok('T84.A its level is in the band the other tracks occupy',
    MUSV.victory>MUSV.build&&MUSV.victory<=Math.max(MUSV.menu,MUSV.combat)+.06);
}

/* ---------- B: the two anti-flicker constants ---------- */
{
 section('T84.B the boundary is a band, not a line');
 ok('T84.B the hysteresis is a named constant', typeof MUS_MOP_HYST==='number');
 ok('T84.B the dwell is a named constant', typeof MUS_VIC_HOLD==='number');
 ok('T84.B the dead band is real', MUS_MOP_HYST>0);
 /* and NARROWER than the trigger, or the release threshold goes negative and
    the music could never stop while you held any lead at all */
 ok('T84.B ...and narrower than the lead that starts it', MUS_MOP_HYST<MUS_MOP_DELTA);
 ok('T84.B the dwell is seconds, long enough to outlast a skirmish',
    MUS_VIC_HOLD>=5);
}

/* ---------- C: the Schmitt gap, with the dwell neutralised ---------- */
{
 section('T84.C the latch holds through the boundary and releases below it');
 fresh1043(1043001);
 const me=G.human,fo=foe1043();
 setSup1043(me,48);
 const ENTER=MUS_MOP_DELTA, REL=MUS_MOP_DELTA-MUS_MOP_HYST;
 ok('T84.C the human has an army big enough to sit in the band',
    supUsed(me)>ENTER+8);

 /* DOWN. musVicUntil is zeroed each step so the dwell cannot be what holds it -
    this isolates the gap, which is the whole point of the check. */
 musVicOn=false;musVicUntil=0;
 setSup1043(fo,supUsed(me)-(ENTER+8));
 musVicTick();
 ok('T84.C a clear lead starts it', margin1043()>ENTER&&musVicOn===true);

 const band=[];
 for(let want=ENTER-1;want>REL;want--){
  setSup1043(fo,supUsed(me)-want);
  musVicUntil=0;musVicTick();
  band.push(musVicOn);
 }
 ok('T84.C inside the band it keeps playing, though it would not START there',
    band.length>0&&band.every(v=>v===true)&&musDecided(false)===false);

 setSup1043(fo,supUsed(me)-(REL-1));
 musVicUntil=0;musVicTick();
 ok('T84.C below the release threshold it lets go',
    margin1043()<REL&&musVicOn===false);

 /* UP again: it must not re-arm anywhere inside the band, only above ENTER */
 const up=[];
 for(let want=REL+1;want<ENTER;want++){
  setSup1043(fo,supUsed(me)-want);
  musVicUntil=0;musVicTick();
  up.push(musVicOn);
 }
 ok('T84.C ...and coming back up it stays off all the way through the band',
    up.length>0&&up.every(v=>v===false));
 setSup1043(fo,supUsed(me)-(ENTER+1));
 musVicUntil=0;musVicTick();
 ok('T84.C only a lead past the trigger starts it again', musVicOn===true);
}

/* ---------- D: the dwell, on its own ---------- */
{
 section('T84.D once playing it outlasts a brief counter-attack');
 fresh1043(1043002);
 const me=G.human,fo=foe1043();
 setSup1043(me,48);setSup1043(fo,0);
 musVicOn=false;musVicUntil=0;musVicTick();
 ok('T84.D an enemy with no army starts it', musVicOn===true);

 /* now make BOTH readings false and leave the dwell alone */
 setSup1043(fo,supUsed(me));
 musVicTick();
 ok('T84.D the rule is false in both its readings now',
    musDecided(false)===false&&musDecided(true)===false);
 ok('T84.D ...and yet it is still playing, held by the dwell', musVicOn===true);
 /* the dwell is an AC clock; the shim has no advancing one, so expire it
    explicitly rather than pretending to wait */
 musVicUntil=(typeof AC!=='undefined'&&AC?AC.currentTime:0)-1;
 musVicTick();
 ok('T84.D only when the dwell expires does it stop', musVicOn===false);
}

/* ---------- E: it outranks the other tracks, and outlives G.over ---------- */
{
 section('T84.E victory overrides what is playing, and runs on the end screen');
 const wasMuted=muted;
 fresh1043(1043003);
 muted=false;musVicOn=false;musVicEnd=false;
 ok('T84.E an ordinary match asks for build', musWant()==='build');

 musVicOn=true;
 ok('T84.E ...and victory overrides it', musWant()==='victory');
 /* the combat hold is the thing it most has to beat: a mop-up is still a fight */
 musCombatT=(typeof AC!=='undefined'&&AC?AC.currentTime:0)+30;
 ok('T84.E it overrides the COMBAT loop too, which is the point',
    musWant()==='victory');
 musCombatT=0;

 /* THE END SCREEN. Before v104.3 musWant answered '' the moment G.over was
    true - the sting had fired and the loop was let go. Now the victory track
    is the one thing that keeps playing there. */
 G.over=true;
 ok('T84.E it keeps playing once the match is over', musWant()==='victory');
 musVicOn=false;
 ok('T84.E a match that ended WITHOUT it is silent - a defeat screen',
    musWant()==='');
 G.over=false;

 /* but mute and pause still win, because they are not about the music */
 musVicOn=true;G.paused=true;
 ok('T84.E pause still silences it', musWant()==='');
 G.paused=false;
 muted=true;
 ok('T84.E mute still silences it', musWant()==='');
 muted=wasMuted;musVicOn=false;
}

/* ---------- F: the sting is gone, and the end flag replaced it ---------- */
{
 section('T84.F the one-shot machinery is removed, not orphaned');
 ok('T84.F musSting no longer exists', typeof musSting==='undefined');
 ok('T84.F musVictory no longer exists', typeof musVictory==='undefined');
 ok('T84.F musVicDone no longer exists', typeof musVicDone==='undefined');
 ok('T84.F the latch and the end flag took their place',
    typeof musVicOn==='boolean'&&typeof musVicEnd==='boolean'
    &&typeof musVicTick==='function');

 /* endGame records WHETHER the ending earns the music; it no longer plays it */
 fresh1043(1043004);
 musVicEnd=false;
 endGame(true);
 ok('T84.F a win sets the end flag', musVicEnd===true);
 fresh1043(1043005);
 musVicEnd=false;
 endGame(false);
 ok('T84.F a loss does not', musVicEnd===false);

 if(SCR1043){
  const eg=SCR1043.indexOf('function endGame(win){');
  const seg=SCR1043.slice(eg,eg+700);
  ok('T84.F endGame sets the flag', eg>0&&seg.indexOf('musVicEnd=')>0);
  ok('T84.F ...and plays nothing itself', seg.indexOf('musSting')<0&&seg.indexOf('musPlay')<0);
  const t=SCR1043.indexOf('function musTick(){');
  ok('T84.F musTick updates the latch BEFORE musWant reads it',
     t>0&&SCR1043.indexOf('musVicTick()',t)>0
     &&SCR1043.indexOf('musVicTick()',t)<SCR1043.indexOf('const want=musWant()',t));
 }
}

/* ---------- G: a new match starts clean ---------- */
{
 section('T84.G returning to the menu re-arms everything');
 fresh1043(1043006);
 setSup1043(G.human,48);setSup1043(foe1043(),0);
 musVicOn=false;musVicUntil=0;musVicTick();
 ok('T84.G latched during the mop-up', musVicOn===true);
 endGame(true);
 ok('T84.G and the end flag is set', musVicEnd===true);
 /* the menu is the one moment every match boundary passes through - the same
    place the combat hold is cleared, for the same reason (v104.1's leak) */
 G=null;musVicTick();
 ok('T84.G the menu clears the latch', musVicOn===false);
 ok('T84.G ...and the end flag', musVicEnd===false);
 ok('T84.G ...and the dwell', musVicUntil===0);
 ok('T84.G so the setup screen plays the march', musWant()==='menu');
}
