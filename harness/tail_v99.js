/* tail_v99.js - T76: the AI order-discipline pass. The owner watched the bots
   "jitter" - every unit not in a fight veering the same way at once, then
   turning back onto its old heading - and the cause was measured, not guessed
   (probe_v99.sh is the tool, and its numbers are in the README):

   THE WAVE PUSH WAS A STANDING CONDITION. Its trigger fired whenever the army
   was big enough, and launching a wave never made the army smaller, so once a
   bot outgrew its capped pushSize the block fired on EVERY aiTick - 174 waves
   in one ten-minute match, 94% of them one aiTick apart, against a design
   cadence of 34-155. Every firing re-ordered the whole committed army and
   re-rolled the target (the rivalIdx%3 rotation plus scoreFoes' srand noise),
   which is exactly an army-wide twitch with a rhythm. The defend recall was
   the other half: one intruder near any building pulled every idle or marching
   unit the bot owned, from anywhere on the map.

     A  a push is an EVENT: launched once, never re-aimed while it lives
     B  the wave ends when the WAVE ends, and the next push re-arms
     C  reinforcement: idle units join the fight; marching units are never re-aimed
     D  the defend picket: local, capped, and it hands the march back
     E  the phase machine survives a defend interrupt mid-wave
     F  it is all sim state: serialized, and the trigger still fires at all

   Nothing in this release touches a unit, a price, a building or the map;
   it is entirely a change to how the bots COMMAND what they already have. */
'use strict';
section('T76 v99: the AI order-discipline pass');

const DT99=1/30;
function cfg99(map,mode,seed,opp,fac){return{map,mode,diff:'normal',fac:fac||'green',opp:(opp==null?3:opp),seed}}
function put99(k,p,x,y){const u=makeUnit(k,p,x,y);u.state='idle';u.anchor={x,y};u.path=null;u.target=null;return u}
function bot99(){return G.players.find(p=>p.ai)}
function foe99(p){return G.players.find(q=>q!==p&&q.alive&&!allied(q,p))}
/* a bot prepared for a controlled wave launch, the T29.F idiom: no feint roll,
   no scouts or harass parties stealing fighters, no home guard held back unless
   the check is ABOUT the guard, and the timers parked where the fixture wants
   them. */
function armBot99(p,o){
 const ai=p.ai;
 ai.pr.scout=false;ai.pr.harass=false;ai.feintDone=true;
 ai.pr.defendFrac=(o&&o.guard)||0;
 ai.phase='build';ai.pushSize=4;ai.nextPush=0;ai.waveId=0;
 return ai;
}
function squad99(p,n,dx,dy){
 const out=[];const hq=p.blds.find(b=>b.key==='hq');
 for(let i=0;i<n;i++)out.push(put99('grunt',p,hq.tx+(dx||0)+(i%4),hq.ty+(dy||3)+((i/4)|0)));
 return out;
}
const wave99=(p)=>p.units.filter(u=>u.aiWave===p.ai.waveId&&u.hp>0);

/* ---------- A: a push is an event ---------- */
{
 section('T76.A a push launches once and is never re-aimed while it lives');
 G=null;newGame(cfg99('backyard','dm',990101,3));
 const p=bot99(),ai=armBot99(p);
 const gsA=squad99(p,6);
 aiTick(p);
 /* the wave commits the whole ready army - my six grunts AND the bot's starting
    squad - so the claim is membership and motion, never an exact count */
 ok('T76.A the wave went out: waveId advanced, the squad is committed and marching',
    ai.waveId===1&&ai.phase==='attack'&&gsA.every(u=>u.aiWave===1)&&
    wave99(p).length>=6&&wave99(p).every(u=>u.state==='amove'||u.state==='attack'));
 ok('T76.A ...and the launch wrote the standing aim point down',
    !!ai.waveDest&&typeof ai.waveDest.x==='number'&&typeof ai.waveDest.y==='number');
 /* the spam reproduction: the army still outgrows pushSize (sizeReady TRUE) and
    the clock is left ringing (nextPush=0, timeReady TRUE) - the exact state the
    v98 block re-fired in, every aiTick, forever. */
 ai.nextPush=0;
 const dests=wave99(p).map(u=>({id:u.id,x:u.dest.x,y:u.dest.y}));
 for(let i=0;i<5;i++)aiTick(p);
 ok('T76.A five aiTicks later, with both triggers held TRUE, no second wave launched',
    ai.waveId===1);
 ok('T76.A ...and not one marching unit was re-aimed',
    dests.every(d=>{const u=p.units.find(x=>x.id===d.id);return u&&u.dest&&u.dest.x===d.x&&u.dest.y===d.y;}));
}

/* ---------- B: the wave ends when the wave ends ---------- */
{
 section('T76.B the wave dissolving is what re-arms the next push');
 G=null;newGame(cfg99('backyard','dm',990201,3));
 const p=bot99(),ai=armBot99(p);
 squad99(p,6);
 aiTick(p);
 ok('T76.B fixture: a live wave', ai.waveId===1&&ai.phase==='attack');
 /* the wave dies in the field - through kill(), the way the sim removes the
    dead. hp=0 alone leaves a corpse in p.units and the army census counts it,
    which is a fixture lying to the code it tests. */
 for(const u of wave99(p)){u.hp=0;kill(u,null);}
 ai.nextPush=0;
 aiTick(p);
 ok('T76.B the phase machine saw the wave die and went back to build',
    ai.phase!=='attack'&&ai.waveId===1);
 /* the retreat's pull-back stays pulled back: with the army big enough for a
    push (the old sizeReady) but the clock deliberately raised - exactly the
    state a tactical retreat leaves behind - nothing relaunches. Size launches
    the OPENING wave; every wave after the first goes on pr.repeat's clock. */
 squad99(p,6);
 ai.phase='build';ai.pushSize=4;ai.nextPush=ai.t+999;
 aiTick(p);
 ok('T76.B a retreated army is not relaunched by its own size: the clock paces waves after the first',
    ai.waveId===1);
 /* fresh fighters, ringing clock: the next push must actually fire - this is
    the arm that proves the gate did not simply weld the trigger shut */
 ai.nextPush=0;ai.phase='build';
 aiTick(p);
 ok('T76.B ...and the NEXT wave launches: the trigger is gated, not dead',
    ai.waveId===2&&wave99(p).length>=4);
 /* survivors of a spent wave are released for the stage drift to regroup */
 G=null;newGame(cfg99('backyard','dm',990202,3));
 const p2=bot99(),ai2=armBot99(p2);
 squad99(p2,6);
 aiTick(p2);
 const wv2=wave99(p2);
 const live2=wv2.slice(-2);                          // two limp home, the rest die
 for(const u of wv2.slice(0,-2)){u.hp=0;kill(u,null);}
 for(const u of live2){u.state='idle';u.path=null;u.target=null;}
 aiTick(p2);
 ok('T76.B a spent wave\'s survivors are released rather than owned forever',
    ai2.phase!=='attack'&&live2.every(u=>u.aiWave===0));
}

/* ---------- C: reinforcement ---------- */
{
 section('T76.C idle units reinforce the fight; nobody moving is ever re-aimed');
 G=null;newGame(cfg99('backyard','dm',990301,3));
 const p=bot99(),ai=armBot99(p);
 squad99(p,6);
 aiTick(p);
 ok('T76.C fixture: a live wave with a written aim point', ai.waveId===1&&!!ai.waveDest);
 /* fresh production appears at home while the wave besieges */
 const fresh=squad99(p,4,-2,5);
 aiTick(p);
 ok('T76.C the idle men joined the wave: same waveId, marching at its aim point',
    fresh.every(u=>u.aiWave===ai.waveId&&u.state==='amove')&&
    fresh.every(u=>dhyp(u.dest.x-ai.waveDest.x,u.dest.y-ai.waveDest.y)<8));
 const dests=fresh.map(u=>({id:u.id,x:u.dest.x,y:u.dest.y}));
 aiTick(p);
 ok('T76.C ...ordered ONCE: the next tick re-aims nobody already moving',
    dests.every(d=>{const u=p.units.find(x=>x.id===d.id);return u&&u.dest&&u.dest.x===d.x&&u.dest.y===d.y;}));
 /* the home guard: with a defendFrac the closest-to-home share stays */
 G=null;newGame(cfg99('backyard','dm',990302,3));
 const p2=bot99(),ai2=armBot99(p2,{guard:0.5});
 ai2.pushSize=4;
 squad99(p2,6);
 aiTick(p2);
 ok('T76.C fixture: wave out with a 50% guard fraction', ai2.waveId===1);
 const fresh2=squad99(p2,4,-2,5);
 aiTick(p2);
 const stayed=fresh2.filter(u=>u.state==='idle').length;
 ok('T76.C ...and a guard share of the idles is actually held home',stayed>0&&stayed<fresh2.length+1);
}

/* ---------- D: the defend picket ---------- */
{
 section('T76.D the recall is local, capped, and hands the march back');
 ok('T76.D the picket reaches past the 14-tile detection ring it serves',
    AI_DEF_R>14&&AI_DEF_N>=3);
 G=null;newGame(cfg99('backyard','dm',990401,3));
 const p=bot99(),ai=armBot99(p);
 ai.nextPush=ai.t+999;ai.pushSize=99;                 // no waves in this fixture
 const hq=p.blds.find(b=>b.key==='hq');
 const gs=squad99(p,10);
 const en=foe99(p);
 const scout=put99('bike',en,hq.tx+8,hq.ty+8);        // one intruder, inside the detection ring
 aiTick(p);
 /* the rest of the yard is NOT necessarily idle - the stage drift legitimately
    walks idle units to the staging point on this same tick. The claim is that
    nobody past the quota was sent AT the intruder. */
 const engaged=p.units.filter(u=>u.state==='attack'&&u.target===scout);
 ok('T76.D one intruder draws at most AI_DEF_N defenders, not the yard',
    engaged.length>0&&engaged.length<=AI_DEF_N);
 /* a marcher beyond the radius keeps its march */
 G=null;newGame(cfg99('backyard','dm',990402,3));
 const p2=bot99(),ai2=armBot99(p2);
 ai2.nextPush=ai2.t+999;ai2.pushSize=99;
 const hq2=p2.blds.find(b=>b.key==='hq');
 const en2=foe99(p2);
 const sc2=put99('bike',en2,hq2.tx+8,hq2.ty+8);
 /* the marcher stands on the FAR side of the map from the intruder - derived
    from the intruder's own position, because hq-offset placement clamps into
    the radius when the base sits in a corner (measured: 22 tiles on seed
    990402's slot). The premise is asserted, not assumed. */
 const fx=clamp(sc2.x<G.map.N/2?sc2.x+32:sc2.x-32,3,G.map.N-4);
 const fy=clamp(sc2.y<G.map.N/2?sc2.y+32:sc2.y-32,3,G.map.N-4);
 const far=put99('grunt',p2,fx,fy);
 orderMove(far,clamp(fx+4,3,G.map.N-4),fy,true);
 const fd={x:far.dest.x,y:far.dest.y};
 ok('T76.D fixture premise: the marcher really is outside the picket radius',
    dhyp(far.x-sc2.x,far.y-sc2.y)>AI_DEF_R+4);
 aiTick(p2);
 ok('T76.D a march beyond AI_DEF_R of the intruder is not abandoned for it',
    far.state==='amove'&&far.dest.x===fd.x&&far.dest.y===fd.y);
 /* a marcher inside the radius fights, then RESUMES: the savedDest handoff */
 G=null;newGame(cfg99('backyard','dm',990403,3));
 const p3=bot99(),ai3=armBot99(p3);
 ai3.nextPush=ai3.t+999;ai3.pushSize=99;
 const hq3=p3.blds.find(b=>b.key==='hq');
 const mar=put99('grunt',p3,hq3.tx+4,hq3.ty+4);
 const mx=clamp(hq3.tx+30,2,G.map.N-3),my=clamp(hq3.ty+30,2,G.map.N-3);
 orderMove(mar,mx,my,true);
 const en3=foe99(p3);
 const sc3=put99('bike',en3,hq3.tx+8,hq3.ty+8);
 aiTick(p3);
 ok('T76.D a marcher inside the radius answers, march written down first',
    mar.state==='attack'&&mar.target===sc3&&!!mar.savedDest&&mar.savedDest.x===mx&&mar.savedDest.y===my);
 sc3.hp=0;
 update(DT99);
 ok('T76.D ...and when the intruder dies the march resumes where it left off',
    mar.state==='amove'&&mar.dest.x===mx&&mar.dest.y===my);
}

/* ---------- E: the phase machine under interruption ---------- */
{
 section('T76.E a defend interrupt hands back to the wave still in the field');
 G=null;newGame(cfg99('backyard','dm',990501,3));
 const p=bot99(),ai=armBot99(p);
 squad99(p,6);
 aiTick(p);
 ok('T76.E fixture: a live wave', ai.phase==='attack'&&wave99(p).length>=6);
 ai.phase='defend';ai.defend=G.tick-Math.ceil(ai.pr.defendHold)-1;
 aiTick(p);
 ok('T76.E the expired interrupt returns to ATTACK while the wave lives, not to build',
    ai.phase==='attack');
 for(const u of wave99(p))u.hp=0;
 ai.phase='defend';ai.defend=G.tick-Math.ceil(ai.pr.defendHold)-1;
 aiTick(p);
 ok('T76.E ...and to BUILD once it does not', ai.phase==='build');
}

/* ---------- F: state discipline ---------- */
{
 section('T76.F the aim point is sim state and the trigger still lives');
 G=null;newGame(cfg99('backyard','dm',990601,3));
 const p=bot99(),ai=armBot99(p);
 squad99(p,6);
 aiTick(p);
 const wd={x:ai.waveDest.x,y:ai.waveDest.y},wid=ai.waveId,wn=wave99(p).length;
 const blob=saveState();
 loadState(blob);
 const p9=G.players[p.i];
 ok('T76.F waveDest and the wave rings survive a save/load untouched',
    !!p9.ai.waveDest&&p9.ai.waveDest.x===wd.x&&p9.ai.waveDest.y===wd.y&&p9.ai.waveId===wid&&
    p9.units.filter(u=>u.aiWave===wid).length===wn);
 /* the guard is on wave-LIVENESS, not on the phase flag: a defend interrupt mid
    wave must not reopen the push door. Both triggers held true, phase defend. */
 const ai9=p9.ai;
 ai9.phase='defend';ai9.defend=G.tick;ai9.nextPush=0;
 aiTick(p9);
 ok('T76.F a defend interrupt mid-wave does not reopen the push door',
    ai9.waveId===wid);
 /* MUTATION arm: pretend the wave is gone and the same state must push at once -
    the gate reads the wave, so erasing the wave IS opening the gate. */
 for(const u of p9.units)u.aiWave=0;
 ai9.phase='build';ai9.nextPush=0;
 aiTick(p9);
 ok('T76.F MUTATION: erase the wave and the same triggers fire at once',
    ai9.waveId===wid+1);
}
