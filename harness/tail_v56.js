/* tail_v56.js — T37: SPECTATOR SPEED TOGGLE.

   The whole release is one expression in frame(): the multiplier goes on the way
   INTO the fixed-step accumulator, never on the step that comes out. So what has
   to be proved is exactly that - that 2x runs the same ticks twice as fast
   rather than one twice-as-big tick - plus the usual gating and the fact that
   nothing here is hashed or serialized.

   frame() is drivable headless: INFO.open short-circuits render(), and the loop
   only needs a rising millisecond stamp. Feeding it 50ms slices keeps every call
   under the 100ms clamp, so the tick counts below are the real pacing.        */

section('T37 spectator speed: the intake scales, the step does not');

// how many sim ticks does N ms of wall clock buy at this speed? lastT and acc are
// module-level and carry across calls, so the clock only ever moves forward and
// the accumulator is drained before each measurement.
let WT=0;
function ticksOver(ms,speed,watch){
 G=null;
 newGame(watch===false?cfg('backyard','dm','normal','green',3,5601)
                      :{map:'backyard',mode:'dm',diff:'normal',fac:'green',seed:5601,watch:1});
 INFO.open=true;                       // frame() skips render()
 if(speed!=null)G.wspeed=speed;
 WT+=1000;frame(WT);acc=0;             // rebase the clock, then start from an empty bank
 const t0=G.tick,end=WT+ms;
 while(WT<end){WT+=50;frame(WT)}
 INFO.open=false;
 return G.tick-t0;
}

ok('T37 the five rungs, exactly as asked',WATCH_SPEEDS.join()==='0.75,1,1.25,1.5,2');
ok('T37 real time is one of them',WATCH_SPEEDS.indexOf(1)>=0);

G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',seed:5602,watch:1});
ok('T37 a match opens at real time',G.wspeed===1);

// PACING: 1000ms at 1x is 30 ticks; each rung scales that, within one tick of
// rounding from the leftover in the accumulator.
// (the counts land one tick shy of the ideal - the final step falls a hair under
// the threshold in floating point - so every figure is asserted to within a tick,
// and the ratios are taken over 3s where that rounding is noise.)
{
 const base=ticksOver(1000,1);
 ok(`T37 1x buys 30 ticks per second (got ${base})`,Math.abs(base-30)<=1);
 for(const v of WATCH_SPEEDS){
  const n=ticksOver(1000,v),want=Math.round(30*v);
  ok(`T37 ${v}x buys ~${want} ticks per second (got ${n})`,Math.abs(n-want)<=1);
 }
 const long1=ticksOver(3000,1);
 ok('T37 2x is twice 1x',Math.abs(ticksOver(3000,2)/long1-2)<0.05);
 ok('T37 0.75x is three quarters of 1x',Math.abs(ticksOver(3000,0.75)/long1-0.75)<0.05);
 ok('T37 1.5x sits between them',(()=>{const n=ticksOver(3000,1.5);return n>ticksOver(3000,1.25)&&n<ticksOver(3000,2)})());
}
// THE POINT: same ticks, sooner. A watch match stepped at 2x must produce the
// identical hash trail to the same match at 1x - the sim never learns the speed.
{
 // 5ms slices keep the tick granularity at 1 even at 2x, so every checkpoint is
 // taken at exactly the same tick number in all three runs (an overshoot would
 // compare tick 32 against tick 30 and fail for the wrong reason).
 const trail=(speed)=>{
  G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'tan',seed:5603,watch:1});
  INFO.open=true;G.wspeed=speed;
  WT+=1000;frame(WT);acc=0;
  const out=[];let next=30,guard=0;
  while(out.length<8&&guard++<20000){
   WT+=5;frame(WT);
   if(G.tick===next){out.push(hashState());next+=30}
  }
  INFO.open=false;return out;
 };
 const a=trail(1),b=trail(2),c=trail(0.75);
 ok('T37 2x yields the identical hash trail to 1x',a.length===8&&a.every((h,i)=>h===b[i]));
 ok('T37 0.75x yields the identical hash trail to 1x',a.every((h,i)=>h===c[i]));
}
// the setters
{
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',seed:5604,watch:1});
 ok('T37 setting an offered rung takes',watchSpeedSet(1.5)===true&&G.wspeed===1.5);
 ok('T37 an arbitrary multiplier is refused',watchSpeedSet(3)===false&&G.wspeed===1.5);
 ok('T37 a garbage value is refused',watchSpeedSet('fast')===false&&G.wspeed===1.5);
 watchSpeedSet(1);
 ok('T37 stepping up walks the list',watchSpeedStep(1)&&G.wspeed===1.25);
 ok('T37 stepping down walks back',watchSpeedStep(-1)&&G.wspeed===1);
 watchSpeedSet(2);watchSpeedStep(1);
 ok('T37 the top rung clamps',G.wspeed===2);
 watchSpeedSet(0.75);watchSpeedStep(-1);
 ok('T37 the bottom rung clamps',G.wspeed===0.75);
 // the chip row
 buildSpeedRow();
 const row=document.getElementById('watchSpeed');
 ok('T37 one chip per rung',row.children.length===WATCH_SPEEDS.length);
 ok('T37 the chips are labelled',row.children.map(c=>c.textContent).join()==='0.75x,1x,1.25x,1.5x,2x');
 ok('T37 the live rung is lit, alone',row.children.filter(c=>/\bon\b/.test(c.className)).length===1);
 ok('T37 ...and it is the right one',/\bon\b/.test(row.children[0].className));
 row.children[4].onclick();
 ok('T37 clicking a chip sets the speed',G.wspeed===2&&/\bon\b/.test(row.children[4].className));
 ok('T37 ...and unlights the old one',!/\bon\b/.test(row.children[0].className));
}
// gating: outside a watch match there is no speed control at all
{
 G=null;newGame(cfg('backyard','dm','normal','green',3,5605));
 ok('T37 watch OFF: no speed is set',G.wspeed===undefined);
 ok('T37 watch OFF: the setter refuses',watchSpeedSet(2)===false);
 ok('T37 watch OFF: the stepper refuses',watchSpeedStep(1)===false);
 G.wspeed=2; // even if something forced it, frame() must ignore it
 const n=ticksOver(1000,2,false);
 ok(`T37 watch OFF: a stray speed does not change the pacing (got ${n})`,Math.abs(n-30)<=1);
}
// client-local, like the meter and the hide flag
{
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',seed:5606,watch:1});
 run(300);
 const h0=hashState();
 for(const v of WATCH_SPEEDS){G.wspeed=v;ok(`T37 ${v}x moves no hashed state`,hashState()===h0)}
 G.wspeed=1;
 const json=saveState();
 ok('T37 the speed is absent from the snapshot',json.indexOf('wspeed')<0);
 ok('T37 the snapshot tag is at least v:56',JSON.parse(json).v>=56); // exact bump pinned by splice_v56.py
 loadState(json);
 ok('T37 a load leaves the match runnable',G.watch===true&&G.players.length===WATCH_ARMIES);
}
