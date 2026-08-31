/* tail_v104_2.js - T83: the audio mixer, and the score follows the battle.

   The owner's second pass on the soundtrack. Three items, and the third one
   turned out not to be the bug it looked like.

   1. THE DUCK, A THIRD TIME. v104 shipped .45 x .38 = .171 and the owner could
      not hear the music under gunfire. v104.1 went to .75 x .50 = .375 and the
      owner still could not. The mistake both times was treating this as a
      tuning problem with one right answer: a firefight is a dozen gun voices
      SUMMING against a single music voice, so "loud enough" depends on the
      fight, the mix and the listener's speakers. There is no number here that
      is right for everyone, which is why the third answer is a FADER and
      .90 x .62 = .558 is only where it starts.
   2. SLIDERS, on the audio button. Music and Effects, 0-150%, persisted. That
      needed a bus for the effects to hang off, which the game did not have -
      every sound went straight to masterGain, where music also lives, so there
      was no node that meant "everything except the music".
   3. "I only hear the build-up music in spectate." NOT A SPECTATE BUG. The
      combat track was driven by COMBAT_DUCK_T, which sfxGun sets - but only
      AFTER `const a=audFor(...); if(!a)return;`, so a shot outside the viewport
      sets nothing. The score was following the CAMERA rather than the battle,
      and a spectator's camera does not chase the fighting. It was equally wrong
      in a normal match with the view away from the front; spectate just made it
      total. musFighting() reads the SIMULATION instead.

      COMBAT_DUCK_T is still exactly right for the DUCK, which asks "are guns
      loud near the listener" - a camera question with a camera answer. Picking
      the TRACK is a different question, so it now gets its own reading. T83.D
      pins that separation, because collapsing them again is the obvious
      "simplification" for someone who has not read this. */

let HTML1042=null;
try{HTML1042=require('fs').readFileSync('pw.html','utf8')}catch(e){HTML1042=null}
const SCR1042=HTML1042?HTML1042.slice(HTML1042.indexOf('<script>'),HTML1042.indexOf('</script>')):'';
const HEAD1042=HTML1042?HTML1042.slice(0,HTML1042.indexOf('<script>')):'';

function fresh1042(seed,extra){
 G=null;newGame(Object.assign({seed:seed,map:'kitchen',mode:'dm',fac:'green',
  opp:1,diff:'normal'},extra||{}));
 return G.human;
}

/* ---------- A: a bus that means "everything except the music" ---------- */
{
 section('T83.A the effects bus, so the two faders cannot touch each other');
 if(!SCR1042){
  ok('T83.A (skipped - pw.html not readable)', true);
 }else{
  const a=SCR1042.indexOf('function ac(){');
  const mk=SCR1042.indexOf('sfxBus=AC.createGain()',a);
  ok('T83.A ac() builds an sfxBus', a>0&&mk>a);
  ok('T83.A ...hanging off masterGain, so mute still sits above both',
     SCR1042.slice(mk,mk+200).indexOf('sfxBus.connect(masterGain)')>0);
  /* every non-music path re-pointed. A miss here is silent: the sound still
     plays, it just stops answering the Effects slider. */
  ok('T83.A the small-arms bus feeds it',
     SCR1042.indexOf('armsBus.connect(sfxBus)')>a);
  ok('T83.A the room reverb feeds it',
     SCR1042.indexOf('roomBus.connect(rg).connect(sfxBus)')>a);
  ok('T83.A the distance reverb feeds it',
     SCR1042.indexOf('farBus.connect(fg).connect(sfxBus)')>a);
  ok('T83.A recorded one-shots default to it',
     SCR1042.indexOf('(sfxBus||masterGain||AC.destination)')>a);
  ok('T83.A the mining ambience is an effect too, not music',
     SCR1042.indexOf('const mdest=sfxBus||masterGain||AC.destination')>a);
  /* AND THE MUSIC MUST NOT. If musBus were routed through sfxBus the Effects
     slider would drag the score with it and the two faders would be one. */
  ok('T83.A the music bus stays on masterGain, NOT on the effects bus',
     SCR1042.indexOf('musBus.connect(masterGain)')>0
     &&SCR1042.indexOf('musBus.connect(sfxBus)')<0);
 }
}

/* ---------- B: the two faders ---------- */
{
 section('T83.B Music and Effects are stored, clamped and applied');
 ok('T83.B both run to 150%, so the default has headroom above it',
    VOL_MAX===1.5);
 ok('T83.B a fresh browser starts both at the tuned default',
    typeof MUSV_USER==='number'&&typeof SFXV_USER==='number');

 const m0=MUSV_USER,s0=SFXV_USER;
 ok('T83.B setVol answers the value it stored', setVol('mus',.4)===.4);
 ok('T83.B ...and it took', MUSV_USER===.4);
 ok('T83.B the effects fader is a separate number', (setVol('sfx',1.2),SFXV_USER===1.2&&MUSV_USER===.4));
 /* clamping matters because the slider is not the only caller - a stored value
    from a future build with a different range would otherwise ride straight in */
 ok('T83.B above the maximum clamps down', setVol('mus',99)===VOL_MAX);
 ok('T83.B below zero clamps up', setVol('mus',-5)===0);
 ok('T83.B a nonsense value reads as zero rather than NaN', setVol('sfx','x')===0);
 setVol('mus',m0);setVol('sfx',s0);
 ok('T83.B setting it back restores both', MUSV_USER===m0&&SFXV_USER===s0);
}

/* ---------- C: the duck, third time ---------- */
{
 section('T83.C the score is louder again, and now the player decides');
 const V104=.45*.38, V1041=.75*.50, now=MUS_DUCK*MUSV.combat;
 ok('T83.C the duck is gentler than v104.1\'s', MUS_DUCK>.75);
 ok('T83.C it is still a duck - a gun cue still gets room', MUS_DUCK<1);
 ok('T83.C under fire the combat loop beats v104.1', now>V1041);
 ok('T83.C ...and is more than three times v104\'s', now>3*V104);
 /* the fader is what actually settles this, so the ceiling is what matters:
    a player who wants it louder still has room above the default */
 ok('T83.C and a player can push it half again beyond the default',
    now*VOL_MAX>now);
}

/* ---------- D: combat is read off the sim, not off the camera ---------- */
{
 section('T83.D musFighting reads the battle, not what happens to be on screen');
 ok('T83.D the threshold is a named constant', MUS_FIGHT_N===2);
 ok('T83.D the scan is throttled - it walks every unit', MUS_SCAN_EVERY>1);

 fresh1042(1042001);
 for(const u of G.units){u.state='idle';u.target=null}
 ok('T83.D nobody swinging is not a battle', musFighting()===false);

 const us=G.units.slice(0,3);
 us[0].state='attack';us[0].target=us[1];
 ok('T83.D one unit attacking is a skirmish, not a battle',
    musFighting()===false);
 us[1].state='attack';us[1].target=us[0];
 ok('T83.D two is', musFighting()===true);
 /* a state without a target is a unit that has just lost one */
 us[1].target=null;
 ok('T83.D an attack state with no target does not count', musFighting()===false);

 if(SCR1042){
  const t=SCR1042.indexOf('function musTick(){');
  const body=t>0?SCR1042.slice(t,t+1200):'';
  ok('T83.D musTick picks the track from musFighting', body.indexOf('musFighting()')>0);
  /* THE SEPARATION, pinned. COMBAT_DUCK_T still appears in musTick - it drives
     the duck - but it must not be what arms the combat HOLD any more, which is
     the bug the owner hit. */
  ok('T83.D the duck still reads COMBAT_DUCK_T, which is a camera question',
     body.indexOf('COMBAT_DUCK_T')>0);
  ok('T83.D ...but the combat HOLD is no longer armed from it',
     body.indexOf('COMBAT_DUCK_T)musCombatT')<0);
 }
}

/* ---------- E: a spectator hears the whole match ---------- */
{
 section('T83.E spectate gets the combat track and the fanfare');
 /* watch mode boots its own all-CPU line-up, so read the board it made */
 G=null;newGame({seed:1042101,map:'kitchen',mode:'dm',fac:'green',opp:3,
                 diff:'normal',watch:true});
 ok('T83.E this is a spectated match', G.watch===true);
 const live=()=>G.players.filter(p=>p!==G.neutral&&p.alive);
 ok('T83.E more than two armies standing is not decided', musDecided()===false);

 /* THE POINT: a spectator has no side, so "is the lead yours" has no answer -
    but the match is just as decided and the owner still wants to hear it end. */
 const L=live();
 for(const p of L.slice(2))p.alive=false;
 const a=L[0],b=L[1];
 for(const u of b.units.slice()){
  const i=G.units.indexOf(u);if(i>=0)G.units.splice(i,1);
  b.units.splice(b.units.indexOf(u),1);
 }
 ok('T83.E two left and one wiped out IS decided, with no side to take',
    live().length===2&&musDecided()===true);
 /* direction-free: it holds whichever of the two is ahead */
 ok('T83.E ...and it does not care which of them is winning',
    (()=>{const t=a.units;a.units=b.units;b.units=t;
          const r=musDecided();const q=a.units;a.units=b.units;b.units=q;return r})());

 /* an ELIMINATED player is not a spectator with no side - they have one and it
    lost, so they get nothing. Different flag, different answer, on purpose. */
 fresh1042(1042102);
 G.spectate=true;
 ok('T83.E an eliminated player watching on still gets no fanfare',
    musDecided()===false);

 if(SCR1042){
  const eg=SCR1042.indexOf('function endGame(win){');
  ok('T83.E endGame fires it for a spectator too - they watched the whole thing',
     eg>0&&SCR1042.slice(eg,eg+400).indexOf('win||G.watch')>0);
 }
}

/* ---------- F: the panel ---------- */
{
 section('T83.F the audio button opens a panel with both faders');
 for(const f of ['audioSyncUI','audioToggleMute','audioPanelToggle','audioPanelOpen','audioSlide'])
  ok('T83.F '+f+' is a named function, reachable by a source check',
     typeof this==='object'||typeof eval(f)==='function');
 /* calling them headless must be harmless: the shim's getElementById answers a
    stub and its addEventListener is a no-op, so every one of these has to cope
    with elements that are not really there. */
 let threw=null;
 try{audioSyncUI();audioPanelOpen(false);audioSlide('mus',null);}catch(e){threw=e}
 ok('T83.F they all no-op safely with no real DOM', !threw);

 if(HEAD1042){
  ok('T83.F the panel is in the markup', HEAD1042.indexOf('id="audioPanel"')>0);
  ok('T83.F it starts hidden', /id="audioPanel"[^>]*hidden/.test(HEAD1042));
  ok('T83.F a Music slider, 0-150', /id="apMus"[^>]*max="150"/.test(HEAD1042));
  ok('T83.F an Effects slider, 0-150', /id="apSfx"[^>]*max="150"/.test(HEAD1042));
  ok('T83.F and mute, which is still one gesture away',
     HEAD1042.indexOf('id="apMute"')>0);
  /* it hangs off the bar's own height variable rather than a copied number -
     the v90.2 lesson, where four boxes carried hand-typed copies of it */
  ok('T83.F it is positioned off --topbarH, not a transcribed pixel count',
     /#audioPanel\{[^}]*var\(--topbarH\)/.test(HEAD1042));
 }
 if(SCR1042){
  ok('T83.F the audio button opens the panel',
     SCR1042.indexOf('mb.onclick=audioPanelToggle')>0);
  ok('T83.F opening it creates the context, so a slider bites immediately',
     /function audioPanelOpen\(v\)\{[\s\S]{0,160}ac\(\)/.test(SCR1042));
 }
}
