/* ---------------- AUDIO ---------------- */
/* v64 SYNTHESIS REWRITE. The v63 engine had exactly two primitives, pnoise (one
   noise buffer, one biquad, one exponential AD envelope) and ptone (one
   oscillator, one pitch sweep, the same envelope), and every sound in the game
   was three to six stacked calls to those two. Three consequences, all audible:

     no transient      the fastest attack available was a 1 ms exponential RAMP,
                       which is a fade, not a snap. A real muzzle report starts
                       with a sub-2 ms impulse carrying energy to 12 kHz. Nothing
                       in the old engine could produce one, so every weapon read
                       as a filtered thump.
     no filter motion  the "whoomph" of a detonation is a low-pass cutoff falling
                       from ~4 kHz to ~150 Hz over a few hundred ms. pnoise set
                       f.frequency.value once and never moved it, so all four
                       explosion sizes were one recipe times a gain multiplier.
     no variation      identical arguments produced an identical graph every
                       call, which is precisely what makes a machine gun read as
                       a repeated tick rather than a burst.

   The fix is four new primitives (pimp, psweep, pgrain, plus pink noise), a
   distance/zoom absorption model, per-call humanisation, a polyphony budget so
   the richer voices cannot choke a late-game fight, and a bus rework that stops
   the master compressor from flattening the peaks that make a blast feel big.

   DETERMINISM: every random draw in this section is Math.random. The SIM rng,
   named srand, is never reached from anywhere below, so nothing about how the
   game sounds can move a pinned hash trail. splice_v64 asserts the absence of
   the literal call as a post-condition, and T43.J asserts it at runtime. */
let AC=null, muted=false, masterGain=null, NOISE=null, PINK=null, IMP=null;
let sfxBus=null; // v104.2: everything that is NOT music, so the two have separate faders
let roomBus=null, farBus=null, armsBus=null;
/* Two reverbs rather than one. The old single 0.55 s bus had to serve both a
   rifle report and a building collapse; a short bright room reads as "close" and
   a long dark tail reads as "far", and having both lets one sound sit in both at
   different amounts, which is what actually produces depth. */
function makeIR(dur,decay,dark,taps){
 const rl=Math.max(8,Math.floor(AC.sampleRate*dur)),ib=AC.createBuffer(2,rl,AC.sampleRate);
 for(let ch=0;ch<2;ch++){
  const cd=ib.getChannelData(ch);let lp=0;
  for(let i=0;i<rl;i++){const w=(Math.random()*2-1)*Math.pow(1-i/rl,decay);lp+=(w-lp)*dark;cd[i]=lp;}
  /* sparse early reflections: the cue the ear uses for room size */
  if(taps)for(const tp of taps){const ix=Math.floor(tp[0]*AC.sampleRate);if(ix<rl)cd[ix]+=tp[1]*(ch?-1:1);}
 }
 return ib;
}
/* tanh soft clip. The v63 chain relied on a ratio-14 compressor to catch peaks,
   which pumps and swallows exactly the explosion transients this pass exists to
   restore. The compressor is now gentle (ratio 4) and this catches the rest. */
function softCurve(){
 const n=1024,c=new Float32Array(n),k=Math.tanh(1.6);
 for(let i=0;i<n;i++){const x=(i/(n-1))*2-1;c[i]=Math.tanh(x*1.6)/k;}
 return c;
}
function ac(){
 if(!AC){
  try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return null;}
  try{
   masterGain=AC.createGain();masterGain.gain.value=0.9;
   const comp=AC.createDynamicsCompressor();
   comp.threshold.value=-6;comp.knee.value=10;comp.ratio.value=4;comp.attack.value=0.003;comp.release.value=0.18;
   const clip=AC.createWaveShaper();clip.curve=softCurve();try{clip.oversample='2x';}catch(e){}
   masterGain.connect(comp).connect(clip).connect(AC.destination);
   /* v104.2: one bus for every sound that is not music. The music bus hangs off
      masterGain beside it, so the Effects and Music sliders are a gain each and
      neither can touch the other. Mute stays on masterGain, above both. */
   sfxBus=AC.createGain();sfxBus.connect(masterGain);
   sfxBus.gain.value=(typeof SFXV_USER==='number')?SFXV_USER:1; // the stored fader, applied at birth
   /* small-arms sub-bus. Explosions and launches duck it for ~250 ms, which is
      the single cheapest trick in game audio for making a blast feel enormous:
      the blast is not louder, the gunfire around it gets out of the way. */
   armsBus=AC.createGain();armsBus.gain.value=1;armsBus.connect(sfxBus);
   /* short bright room, for anything happening close to the camera */
   roomBus=AC.createConvolver();
   roomBus.buffer=makeIR(0.35,2.2,0.55,[[0.011,0.7],[0.019,-0.5],[0.031,0.4],[0.047,-0.3]]);
   const rg=AC.createGain();rg.gain.value=0.85;roomBus.connect(rg).connect(sfxBus);
   /* long dark tail, for distance and for the big low-frequency events */
   farBus=AC.createConvolver();
   farBus.buffer=makeIR(1.4,2.8,0.16,null);
   const fg=AC.createGain();fg.gain.value=0.7;farBus.connect(fg).connect(sfxBus);
  }catch(e){masterGain=null;roomBus=null;farBus=null;armsBus=null;sfxBus=null;}
  /* v92: the context exists, so the recorded takes can finally decode - kick
     them all now, once, off the critical path. By the first battle sound they
     are long ready; until then sndPlay answers false and synthesis covers. */
  if(AC)sndWarm();
  /* v104.1: and the music, for the same reason and one sharper. A loop that
     decodes late merely starts late and nobody notices. The VICTORY STING is
     asked for exactly once, at the one instant it must play - and decodeAudioData
     is async, so musBuf() answered null and the sting never played once in the
     whole of v104. Warming it here is what makes it exist. */
  if(AC&&typeof musWarm==='function')musWarm();
 }
 if(AC&&AC.state==='suspended'){try{AC.resume();}catch(e){}}
 return AC;
}
function noiseBuf(){if(NOISE)return NOISE;if(!AC)return null;const len=AC.sampleRate*2;NOISE=AC.createBuffer(1,len,AC.sampleRate);const d=NOISE.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;return NOISE;}
/* Pink (1/f) noise via a one-pole cascade. White noise filtered down still has a
   thin, hissy core; pink has the low-frequency weight that makes a detonation
   body and a collapse rumble sound like mass moving rather than like static. */
function pinkBuf(){
 if(PINK)return PINK;if(!AC)return null;
 const len=AC.sampleRate*2;PINK=AC.createBuffer(1,len,AC.sampleRate);const d=PINK.getChannelData(0);
 let b0=0,b1=0,b2=0;
 for(let i=0;i<len;i++){
  const w=Math.random()*2-1;
  b0=0.99765*b0+w*0.0990460;b1=0.96300*b1+w*0.2965164;b2=0.57000*b2+w*1.0526913;
  d[i]=(b0+b1+b2+w*0.1848)*0.22;
 }
 return PINK;
}
/* A 6 ms one-shot: full-scale first sample then a sixth-power decay. This is the
   transient the old engine had no way to make, and it is the difference between
   a gunshot and a thump. Built once and reused; playback is 3 nodes. */
function impBuf(){
 if(IMP)return IMP;if(!AC)return null;
 const n=Math.max(16,Math.floor(AC.sampleRate*0.006));
 IMP=AC.createBuffer(1,n,AC.sampleRate);const d=IMP.getChannelData(0);
 for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,6);
 d[0]=1;
 return IMP;
}
/* --- humanisation. Applied inside the primitives so every recipe gets it for
   free; pass pure:1 to opt out (the UI tones do, so a click stays a click). --- */
function ajit(v,amt){return v*(1+(Math.random()*2-1)*amt);}
const JIT_F=0.06, JIT_G=0.12, JIT_T=0.003;
/* --- polyphony budget. The v64 voices carry two to three times the layers of
   the v63 ones, and a late-game fight can ask for 30 shots a second. Three
   guards: a hard ceiling on scheduled voices, and two rolling windows that
   demote gunfire and explosions to a lean form under sustained load. --- */
let VOXQ=[], GUNW=[], BOOMW=[];
const VOX_CAP=48;
function voxOk(){
 if(!AC)return false;
 const t=AC.currentTime;let n=0;
 for(let i=0;i<VOXQ.length;i++)if(VOXQ[i]>t)VOXQ[n++]=VOXQ[i];
 VOXQ.length=n;
 return n<VOX_CAP;
}
function voxAdd(endT){VOXQ.push(endT);}
function aBudget(win,limit,span){
 if(!AC)return true;
 const t=AC.currentTime;
 while(win.length&&t-win[0]>span)win.shift();
 win.push(t);
 return win.length<=limit;
}
/* explosions and launches pull the small-arms bus down and let it back up */
function duckArms(amt,rel){
 if(!armsBus||!AC)return;
 const t=AC.currentTime;
 try{
  armsBus.gain.cancelScheduledValues(t);
  armsBus.gain.setValueAtTime(armsBus.gain.value,t);
  armsBus.gain.linearRampToValueAtTime(Math.max(0.2,1-amt),t+0.02);
  armsBus.gain.setTargetAtTime(1,t+0.02+(rel||0.25),0.12);
 }catch(e){}
}
/* --- routing. aout applies the distance low-pass, picks the bus and pans;
   rsend feeds the two reverbs. d is the 0..1 distance factor from audAt. --- */
function aout(node,pan,d,bus){
 const dest=(bus==='arms'&&armsBus)?armsBus:(sfxBus||masterGain||AC.destination);
 let n=node;
 if(d!=null&&d>0.02){
  /* air absorption: 18 kHz at the camera, 900 Hz at the far edge of the model */
  const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=18000*Math.pow(0.05,d);lp.Q.value=0.4;
  n.connect(lp);n=lp;
 }
 if(AC.createStereoPanner&&pan!=null&&Math.abs(pan)>0.001){
  const p=AC.createStereoPanner();try{p.pan.value=clamp(pan,-1,1);}catch(e){}
  n.connect(p).connect(dest);
 }else n.connect(dest);
}
function rsend(node,amt,far,d){
 const dd=(d||0);
 if(amt&&roomBus){const rs=AC.createGain();rs.gain.value=amt*(1+1.5*dd);node.connect(rs).connect(roomBus);}
 if(far&&farBus){const fs=AC.createGain();fs.gain.value=far*(0.55+1.2*dd);node.connect(fs).connect(farBus);}
}
// positional gate: a world SFX is audible only when its tile is currently in vision
// (fog===2) AND on screen. returns {gain,pan,d} (gain fades across a 90px edge band,
// pan follows horizontal screen position, d is the 0..1 absorption distance), or
// null when it should be silent.
function audAt(x,y){
 if(!G||!G.map||!G.fog)return null;
 const N=G.map.N;if(x<0||y<0||x>=N||y>=N)return null;
 if(G.fog[(Math.floor(y)*N+Math.floor(x))]!==2)return null;
 const z=G.zoom,sx=(isoX(x,y)-G.cam.x)*z,sy=(isoY(x,y)-G.cam.y)*z;
 const W=vpW(),H=vpH(),M=90; // v97: the ear listens in CSS px, like the eye aims
 if(sx<-M||sx>W+M||sy<-M||sy>H+M)return null;
 const dx=sx<0?-sx:(sx>W?sx-W:0),dy=sy<0?-sy:(sy>H?sy-H:0);
 const gain=clamp(1-Math.max(dx,dy)/M,0,1);
 const pan=clamp(((sx/W)*2-1)*0.6,-1,1);
 /* v64 absorption distance. Two terms, both client-local and neither hashed:
    how far the source sits from the middle of the view in world units, and how
    far the camera itself has pulled back. Zoomed out, the whole battle should
    sound further away, which is both correct and a useful readability cue. */
 const dw=dhyp(sx-W*0.5,sy-H*0.5)/Math.max(0.25,z);
 const d=clamp(clamp(dw/900,0,1)*0.72+clamp((1.25-z)/0.75,0,1)*0.34,0,1);
 return {gain,pan,d};
}
/* v27.1: weapon audibility. A shot is audible if EITHER end of the tracer is
   in vision and on screen (edge-of-fog firefights used to be half-silent).
   The louder end wins, and its pan is used. */
function audAt2(x1,y1,x2,y2){
 const a=audAt(x1,y1),b=audAt(x2,y2);
 if(!a)return b;if(!b)return a;
 return a.gain>=b.gain?a:b;
}
/* v28: shared gate for target-aware weapon sfx: the louder tracer end when a
   target position is given, else the muzzle alone. */
function audFor(x,y,tx,ty){return tx!=null?audAt2(x,y,tx,ty):audAt(x,y)}
/* v92, roadmap 3 phase 2: recorded one-shots. sndPlay() answers true only
   when a decoded recording is in hand; every positional sfx* voice below asks
   it FIRST and synthesises the v90.2 way when the answer is false - the
   assets-override rule applied to sound. Three things are deliberate here:
     - the recording plays DRY through the same aout()/rsend() chain as the
       synthesis, so the fog gate, distance absorption, panning, ducking and
       both reverbs treat a recording and a synthesised voice identically;
     - every random draw is Math.random, exactly as in the synthesis (rule 2:
       nothing below may ever touch srand, and T43.J asserts it at runtime);
     - nothing decoded is sim state. A client that failed a decode falls back
       to synthesis and the lockstep match must not care. */
/* Per-voice playback parameters. The files are peak-normalised, so RELATIVE
   LOUDNESS lives here, not in the takes; rev/far mirror each recipe's own
   sends; n is how many alternate takes assets/snd/ holds (rapid-fire weapons
   carry two so a burst is not one sample on repeat - the ±4% rate jitter and
   the ±12% gain jitter below do the rest). T67 asserts n and the manifest
   agree in both directions. */
/* v92.1: every send here was CUT after the owner's first listen - small arms
   roughly halved, launches and explosions by about a third. The v92 values
   doubled the space: the takes already carried a rendered room slapback (also
   removed) and the live convolvers were layered on top, which is the "hollow
   reverb effect" the feedback named. T68.D pins the new ceilings so the wash
   cannot quietly creep back. gun_sniper's gain is deliberately the largest of
   the guns - "louder, crack tone" was the ask - and T68.C pins THAT. */
const SNDV={
 gun_rifle:  {g:.44,rev:.08,far:.15,n:2,bus:'arms'},
 gun_smg:    {g:.34,rev:.06,far:.10,n:2,bus:'arms'},
 gun_carbine:{g:.50,rev:.10,far:.18,n:1,bus:'arms'},
 gun_hmg:    {g:.52,rev:.11,far:.20,n:2,bus:'arms'},
 gun_vmg:    {g:.38,rev:.07,far:.11,n:2,bus:'arms'},
 gun_amg:    {g:.34,rev:.10,far:.22,n:2,bus:'arms'},
 gun_sniper: {g:.80,rev:.15,far:.30,n:1,bus:'arms'},
 gun_tower:  {g:.46,rev:.12,far:.22,n:2,bus:'arms'},
 flame:      {g:.42,rev:.08,far:.10,n:1,bus:'arms'},
 throw:      {g:.14,rev:.04,far:0,  n:1,bus:'arms'},
 launch_cannon:    {g:.78,rev:.18,far:.30,n:1},
 launch_cannon_hvy:{g:.88,rev:.18,far:.38,n:1},
 launch_mortar:    {g:.48,rev:.15,far:.12,n:1},
 launch_aa:        {g:.40,rev:.10,far:.12,n:1},
 launch_artyrocket:{g:.75,rev:.25,far:.40,n:1},
 launch_rocket:    {g:.58,rev:.18,far:.28,n:1},
 boom_small: {g:.58,rev:.18,far:.20,n:2,rjit:.06},
 boom_med:   {g:.82,rev:.25,far:.35,n:1,rjit:.05},
 boom_big:   {g:.98,rev:.28,far:.50,n:1,rjit:.04},
 boom_huge:  {g:1.12,rev:.32,far:.60,n:1,rjit:.03},
 bld_destroy:{g:1.15,rev:.28,far:.60,n:1,rjit:.03},
 pop:        {g:.26,rev:.04,far:0,  n:2,rjit:.08,bus:'arms'},
 rico:       {g:.28,rev:.05,far:.08,n:3,rjit:.10,bus:'arms'},
 struct_break:{g:.55,rev:.20,far:.25,n:1,rjit:.05},
 whoosh:     {g:.52,rev:.25,far:.40,n:1}
};
/* Decode on demand, cache into the buf slot the loader left null. The copy is
   not optional: decodeAudioData DETACHES the ArrayBuffer it is handed, and the
   raw bytes must stay whole. Decode failure is remembered and final for the
   session - the voice simply stays synthesised, which is the designed answer
   for a browser that cannot read the codec. */
function sndBuf(key){
 const a=sndAsset(key);if(!a)return null;
 if(a.buf)return a.buf;
 if(!a.pend&&!a.err&&AC){
  a.pend=1;
  try{AC.decodeAudioData(a.bytes.slice(0),b=>{b.pwOff=sndLead(b);a.buf=b;},()=>{a.err=1;});}
  catch(e){a.err=1;}
 }
 return a.buf||null;
}
/* mp3 decoders return the encoder's padding as real leading silence, and how
   much of it survives DIFFERS PER BROWSER (measured ~15-20 ms in Chromium at
   v92) - so measure it off the decoded samples instead of assuming, and start
   playback at the first audible one. A weapon whose report lands 20 ms after
   its tracer reads as broken; this is the line that prevents it. */
function sndLead(b){
 try{
  const ch=b.getChannelData(0),n=ch.length;
  for(let i=0;i<n;i++)if(ch[i]>.003||ch[i]<-.003)return i/b.sampleRate;
 }catch(e){}
 return 0;
}
/* kick every decode at the first user gesture (ac() calls this once, when the
   context is born) so the takes are ready before the first battle sound asks */
function sndWarm(){for(const k in ASSETS.snd)sndBuf(k)}
function sndPlay(key,o){
 const V=SNDV[key];if(!V)return false;
 if(muted||!ac()||!voxOk())return false;
 const n=V.n||1;
 const buf=sndBuf(n>1?key+'_'+((Math.random()*n)|0):key+'_0');if(!buf)return false;
 const t=AC.currentTime,dl=(o&&o.delay)||0;
 const src=AC.createBufferSource();src.buffer=buf;
 const rate=1+(Math.random()*2-1)*(V.rjit==null?.04:V.rjit);
 try{src.playbackRate.value=rate;}catch(e){}
 const g=AC.createGain();
 g.gain.value=Math.max(.0001,ajit((V.g||.4)*(o&&o.lvl!=null?o.lvl:1),JIT_G));
 src.connect(g);aout(g,o&&o.pan,o&&o.d,V.bus);rsend(g,V.rev,V.far,o&&o.d);
 const off=buf.pwOff||0,dur=(buf.duration-off)/rate;
 src.start(t+dl,off);src.stop(t+dl+dur+.05);
 voxAdd(t+dl+dur+.05);
 return true;
}
/* --- low-level synth primitives. Callers pass lvl (0..1 from audAt), pan, d
   (absorption), rev/far (the two reverb sends) and bus ('arms' or master). --- */
/* v72: the exponential AHD envelope all three primitives open with - silence,
   snap to peak, optional hold, decay back to silence. It was inlined verbatim in
   pnoise, ptone and psweep. Breakpoint-for-breakpoint identical to what it
   replaces: the inline form read (t+dl)+atk and this reads t0+atk with t0=t+dl,
   which associates the same way, so no float moves. .0001 rather than 0 because
   exponentialRampToValueAtTime cannot ramp to or from zero. */
function penv(g,t0,peak,atk,hold,dur){
 g.gain.setValueAtTime(.0001,t0);
 g.gain.exponentialRampToValueAtTime(peak,t0+atk);
 if(hold>0)g.gain.setValueAtTime(peak,t0+atk+hold);
 g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
}
function pnoise(o){
 if(muted||!ac()||!voxOk())return;
 const buf=o.pink?pinkBuf():noiseBuf();if(!buf)return;
 const t=AC.currentTime,pure=!!o.pure;
 const dl=(o.delay||0)+(pure?0:Math.random()*JIT_T);
 const src=AC.createBufferSource();src.buffer=buf;
 const f=AC.createBiquadFilter();f.type=o.ft||'bandpass';
 f.frequency.value=Math.max(20,pure?(o.freq||1800):ajit(o.freq||1800,JIT_F));
 if(o.q!=null)f.Q.value=o.q;
 let node=src.connect(f);
 if(o.freq2){const f2=AC.createBiquadFilter();f2.type=o.ft2||'bandpass';f2.frequency.value=Math.max(20,o.freq2);if(o.q2!=null)f2.Q.value=o.q2;node=node.connect(f2);}
 if(o.drive){const ws=AC.createWaveShaper();ws.curve=driveCurve(o.drive);node=node.connect(ws);}
 const g=AC.createGain();
 const base=(o.gain||.3)*(o.lvl==null?1:o.lvl);
 const peak=Math.max(.0001,pure?base:ajit(base,JIT_G));
 const dur=o.dur||.12,atk=Math.min(o.atk||.004,dur*.5),hold=Math.min(o.hold||0,Math.max(0,dur-atk-.005));
 penv(g,t+dl,peak,atk,hold,dur);
 node.connect(g);aout(g,o.pan,o.d,o.bus);rsend(g,o.rev,o.far,o.d);
 src.start(t+dl,Math.random()*1.4);src.stop(t+dl+dur+.03);
 voxAdd(t+dl+dur+.03);
}
function ptone(o){
 if(muted||!ac()||!voxOk())return;
 const t=AC.currentTime,pure=!!o.pure;
 const dl=(o.delay||0)+(pure?0:Math.random()*JIT_T);
 const osc=AC.createOscillator();osc.type=o.ft||'sine';
 const jf=pure?1:(1+(Math.random()*2-1)*JIT_F);
 const f0=(o.f0||200)*jf,f1=(o.f1!=null?o.f1:(o.f0||200))*jf,sw=o.sweep||o.dur||.1;
 osc.frequency.setValueAtTime(f0,t+dl);
 if(f1!==f0)osc.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dl+sw);
 const g=AC.createGain();
 const base=(o.gain||.2)*(o.lvl==null?1:o.lvl);
 const peak=Math.max(.0001,pure?base:ajit(base,JIT_G));
 const dur=o.dur||.1,atk=Math.min(o.atk||.005,dur*.5),hold=Math.min(o.hold||0,Math.max(0,dur-atk-.005));
 penv(g,t+dl,peak,atk,hold,dur);
 let node=osc.connect(g);
 if(o.drive){const ws=AC.createWaveShaper();ws.curve=driveCurve(o.drive);node=node.connect(ws);}
 aout(node,o.pan,o.d,o.bus);rsend(node,o.rev,o.far,o.d);
 osc.start(t+dl);osc.stop(t+dl+dur+.03);
 voxAdd(t+dl+dur+.03);
}
/* waveshaper curves are pure functions of the drive amount, so cache them */
const DRIVEC={};
function driveCurve(k){
 const key=k.toFixed(2);
 if(DRIVEC[key])return DRIVEC[key];
 const n=512,c=new Float32Array(n),norm=Math.tanh(k);
 for(let i=0;i<n;i++){const x=(i/(n-1))*2-1;c[i]=Math.tanh(x*k)/norm;}
 DRIVEC[key]=c;return c;
}
/* THE TRANSIENT. A 6 ms impulse through a filter and a saturator: 3 nodes, under
   2 ms of audible attack, energy all the way up. Every weapon and every
   explosion starts with one of these, and it is the single biggest reason the
   v64 gunfire reads as gunfire rather than as a filtered thump. */
function pimp(o){
 if(muted||!ac()||!voxOk())return;
 const buf=impBuf();if(!buf)return;
 const t=AC.currentTime,dl=(o.delay||0)+Math.random()*JIT_T;
 const src=AC.createBufferSource();src.buffer=buf;
 const f=AC.createBiquadFilter();f.type=o.ft||'highpass';
 f.frequency.value=Math.max(20,ajit(o.freq||2000,JIT_F));
 if(o.q!=null)f.Q.value=o.q;
 let node=src.connect(f);
 const ws=AC.createWaveShaper();ws.curve=driveCurve(o.drive||2);node=node.connect(ws);
 const g=AC.createGain();
 g.gain.value=Math.max(.0001,ajit((o.gain||.3)*(o.lvl==null?1:o.lvl),JIT_G));
 node.connect(g);aout(g,o.pan,o.d,o.bus);rsend(g,o.rev,o.far,o.d);
 src.start(t+dl);src.stop(t+dl+.02);
 voxAdd(t+dl+.02);
}
/* THE BODY. Noise through a low-pass whose cutoff FALLS across the sound. This
   is the "whoomph": a detonation is a cutoff collapsing from a few kHz to a
   couple of hundred Hz, and no amount of static filtering imitates it. */
function psweep(o){
 if(muted||!ac()||!voxOk())return;
 const buf=(o.pink==null?true:o.pink)?pinkBuf():noiseBuf();if(!buf)return;
 const t=AC.currentTime,dl=(o.delay||0)+Math.random()*JIT_T;
 const src=AC.createBufferSource();src.buffer=buf;
 const f=AC.createBiquadFilter();f.type=o.ft||'lowpass';
 const f0=Math.max(30,ajit(o.f0||3500,JIT_F)),f1=Math.max(25,o.f1||200),sw=o.sweep||(o.dur||.3)*.8;
 f.frequency.setValueAtTime(f0,t+dl);
 f.frequency.exponentialRampToValueAtTime(f1,t+dl+sw);
 if(o.q!=null)f.Q.value=o.q;
 let node=src.connect(f);
 if(o.drive){const ws=AC.createWaveShaper();ws.curve=driveCurve(o.drive);node=node.connect(ws);}
 const g=AC.createGain();
 const peak=Math.max(.0001,ajit((o.gain||.4)*(o.lvl==null?1:o.lvl),JIT_G));
 const dur=o.dur||.3,atk=Math.min(o.atk||.003,dur*.5),hold=Math.min(o.hold||0,Math.max(0,dur-atk-.005));
 penv(g,t+dl,peak,atk,hold,dur);
 node.connect(g);aout(g,o.pan,o.d,o.bus);rsend(g,o.rev,o.far,o.d);
 src.start(t+dl,Math.random()*1.4);src.stop(t+dl+dur+.03);
 voxAdd(t+dl+dur+.03);
}
/* THE SCATTER. n short grains spread over a window with a front-loaded bias:
   debris, rubble rain, shell casings, track clank, wire rattle. Built on pnoise
   so the polyphony budget applies to grains exactly as to anything else. */
function pgrain(o){
 const n=o.n||8,span=o.span||.5,fade=o.fade==null?1.1:o.fade,bias=o.bias||1.4;
 for(let i=0;i<n;i++){
  const r=Math.random();
  pnoise({
   freq:(o.freq||2200)*(0.5+Math.random()*1.3),
   q:o.q||6, ft:o.ft||'bandpass',
   gain:(o.gain||.1)*(0.35+Math.random()*0.9)*Math.pow(1-i/n,fade),
   dur:o.gdur||.05, atk:.001,
   delay:(o.delay||0)+Math.pow(r,bias)*span,
   lvl:o.lvl, pan:(o.pan||0)+(Math.random()-.5)*(o.spread||.3),
   d:o.d, rev:o.rev, far:o.far, bus:o.bus, pink:o.pink
  });
 }
}
// amplitude-chopped low tone for a diesel idle (rate Hz chug).
function chug(dur,rate,freq,gain,pan){
 if(muted||!ac()||!voxOk())return;const t=AC.currentTime;
 const osc=AC.createOscillator();osc.type='sawtooth';osc.frequency.setValueAtTime(freq*.8,t);osc.frequency.exponentialRampToValueAtTime(freq,t+.1);
 const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;
 const g=AC.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.05);g.gain.setValueAtTime(gain,t+dur-.1);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 const lfo=AC.createOscillator();lfo.type='square';lfo.frequency.value=rate;const lfoG=AC.createGain();lfoG.gain.value=.5;const dc=AC.createGain();dc.gain.value=.5;
 lfo.connect(lfoG).connect(dc.gain);lfo.start(t);lfo.stop(t+dur+.05);
 osc.connect(lp).connect(dc).connect(g);aout(g,pan);osc.start(t);osc.stop(t+dur+.05);
 voxAdd(t+dur+.05);
}
/* --- weapon + explosion sounds (positional; gate first) ----
   gunKind resolves eight distinct weapon voices where v63 had three. The v63
   'mg' bucket alone covered the Machine Gunner, the MG Jeep, the Huey, Sarge,
   the Scout Bike, the Guard Tower and every bunker garrison, which is most of
   the reason the battlefield sounded like one weapon. */
function gunKind(u){
 if(!u||u.kind==='bld')return 'tower';
 const k=u.key;
 if(k==='sniper')return 'sniper';
 if(k==='gunner')return 'hmg';
 if(k==='sarge')return 'carbine';
 if(k==='jeep')return 'vmg';
 if(u.t&&u.t.fly)return 'amg';
 if(k==='bike'||k==='para')return 'smg';
 if(k==='runner')return 'smg'; // v85: a sidearm is the closest thing in the voice set to a pistol; 'rifle' would have made the lightest weapon in the game the loudest-sounding infantry shot
 return 'rifle';
}
/* launchKind splits the v63 three into six: the Bull's cannon is not the Tank's,
   the Rocket Artillery's salvo is not a Bazooka, and an AA missile leaving a
   rail is not either of them. */
function launchKind(u,w){
 if(w==='s')return u.t.big?'cannon_hvy':'cannon';
 if(w==='m')return u.key==='arty'?'artyrocket':'mortar';
 if(w==='a')return 'aa';
 return 'rocket';
}
/* Per-weapon voice tables. Layers are ordered transient, body, thump, air, tail,
   action; a voice omits what it does not need. Rapid-fire weapons are
   deliberately LEAN (a squad of Machine Gunners at the table reload puts tens
   of shots a second through the mixer) and take their character from filter
   shape rather than from layer count; slow weapons get the full stack.
   v78: the sentence used to quote 0.34 s, which the v73 reload change had
   already retired and v78 moves again. The order of magnitude is the whole
   argument here, so the literal is gone rather than corrected. */
const GUNV={
 rifle:{imp:{freq:2600,gain:.34,drive:2.2},
  body:{freq:1500,q:.9,ft:'bandpass',gain:.30,dur:.085,rev:.10},
  thump:{f0:135,f1:52,sweep:.06,dur:.09,gain:.22},
  air:{freq:4200,q:.5,ft:'highpass',gain:.13,dur:.028},
  tail:{freq:620,q:.7,ft:'bandpass',gain:.10,dur:.22,delay:.035,rev:.30,far:.5},
  act:{freq:3100,q:9,ft:'bandpass',gain:.05,dur:.04,delay:.075}},
 smg:{imp:{freq:3200,gain:.26,drive:2.6},
  body:{freq:2100,q:1.1,ft:'bandpass',gain:.22,dur:.05},
  thump:{f0:165,f1:70,sweep:.035,dur:.05,gain:.13},
  air:{freq:5200,q:.5,ft:'highpass',gain:.09,dur:.02},
  tail:{freq:900,q:.8,ft:'bandpass',gain:.06,dur:.13,delay:.03,rev:.22}},
 carbine:{imp:{freq:2200,gain:.38,drive:2.0},
  body:{freq:1150,q:.8,ft:'bandpass',gain:.32,dur:.10,rev:.12},
  thump:{f0:118,f1:46,sweep:.07,dur:.11,gain:.28},
  air:{freq:3800,q:.5,ft:'highpass',gain:.14,dur:.03},
  tail:{freq:520,q:.6,ft:'bandpass',gain:.12,dur:.28,delay:.045,rev:.34,far:.6},
  act:{freq:2700,q:8,ft:'bandpass',gain:.06,dur:.05,delay:.09}},
 hmg:{imp:{freq:1500,gain:.40,drive:1.8},
  body:{freq:900,q:.7,ft:'lowpass',gain:.34,dur:.11,atk:.002,rev:.16,pink:1},
  thump:{f0:88,f1:34,sweep:.09,dur:.14,gain:.34},
  thump2:{ft:'triangle',f0:176,f1:70,sweep:.06,dur:.09,gain:.16},
  air:{freq:2600,q:.5,ft:'highpass',gain:.10,dur:.035},
  tail:{freq:400,q:.5,ft:'bandpass',gain:.14,dur:.34,delay:.05,rev:.40,far:.7},
  act:{freq:1900,q:7,ft:'bandpass',gain:.05,dur:.06,delay:.10}},
 vmg:{imp:{freq:2800,gain:.28,drive:2.4},
  body:{freq:1750,q:1.0,ft:'bandpass',gain:.24,dur:.06},
  thump:{f0:128,f1:56,sweep:.05,dur:.07,gain:.18},
  air:{freq:4600,q:.5,ft:'highpass',gain:.10,dur:.022},
  tail:{freq:700,q:.7,ft:'bandpass',gain:.08,dur:.18,delay:.03,rev:.26}},
 amg:{imp:{freq:3400,gain:.24,drive:2.8},
  body:{freq:2400,q:.9,ft:'bandpass',gain:.21,dur:.05},
  thump:{f0:150,f1:62,sweep:.04,dur:.06,gain:.12},
  air:{freq:6000,q:.5,ft:'highpass',gain:.10,dur:.02},
  tail:{freq:1100,q:.5,ft:'bandpass',gain:.07,dur:.30,atk:.02,delay:.02,rev:.45,far:.9}},
 sniper:{imp:{freq:3000,gain:.50,drive:3.0},
  body:{freq:1000,q:.8,ft:'bandpass',gain:.38,dur:.16,rev:.20},
  thump:{f0:150,f1:46,sweep:.12,dur:.18,gain:.30},
  air:{freq:5000,q:.5,ft:'highpass',gain:.18,dur:.045},
  zip:{f0:9000,f1:1200,sweep:.10,dur:.12,gain:.12,delay:.02},
  tail:{freq:430,q:.5,ft:'bandpass',gain:.16,dur:.55,delay:.06,rev:.55,far:1.0},
  act:{freq:2400,q:10,ft:'bandpass',gain:.06,dur:.06,delay:.16}},
 tower:{imp:{freq:2000,gain:.32,drive:2.0},
  body:{freq:1300,q:.9,ft:'bandpass',gain:.28,dur:.08,rev:.18},
  thump:{f0:105,f1:42,sweep:.06,dur:.10,gain:.24},
  air:{freq:3600,q:.5,ft:'highpass',gain:.11,dur:.03},
  tail:{freq:480,q:.5,ft:'bandpass',gain:.13,dur:.40,delay:.05,rev:.50,far:.8}}
};
function sfxGun(x,y,kind,tx,ty){
 if(muted||!ac())return;
 const a=audFor(x,y,tx,ty);if(!a)return;
 const lvl=a.gain,pan=a.pan,d=a.d;
 if(AC)COMBAT_DUCK_T=AC.currentTime+1.2;
 const V=GUNV[kind]||GUNV.rifle;
 const full=aBudget(GUNW,14,0.12);
 /* v92: a decoded take wins; the layers below are the fallback voice. The
    budget window above is fed either way, so sustained-fire accounting does
    not depend on which path a shot took. */
 if(sndPlay('gun_'+(GUNV[kind]?kind:'rifle'),{lvl,pan,d}))return;
 const E={lvl,pan,d,bus:'arms'};
 pimp(Object.assign({},V.imp,E));
 pnoise(Object.assign({},V.body,E));
 /* lean form under sustained fire: transient plus body only. The ear tracks the
    attack, so dropping the tails costs far less than dropping shots. */
 if(!full)return;
 if(V.thump)ptone(Object.assign({ft:'sine'},V.thump,E));
 if(V.thump2)ptone(Object.assign({},V.thump2,E));
 if(V.air)pnoise(Object.assign({},V.air,E));
 if(V.zip)psweep(Object.assign({ft:'lowpass',pink:false},V.zip,E));
 if(V.tail)pnoise(Object.assign({},V.tail,E));
 if(V.act)pnoise(Object.assign({},V.act,E));
}
function sfxFlame(x,y,tx,ty){
 const a=audFor(x,y,tx,ty);if(!a)return;
 const lvl=a.gain,pan=a.pan,d=a.d,E={lvl,pan,d,bus:'arms'};
 if(sndPlay('flame',{lvl,pan,d}))return;
 /* ignition whoosh: the cutoff falling is what makes it read as a gout of fuel
    catching rather than as a band of static */
 psweep(Object.assign({f0:3000,f1:300,sweep:.12,dur:.34,gain:.26,atk:.015,rev:.16},E));
 pnoise(Object.assign({freq:380,q:.5,ft:'lowpass',gain:.26,dur:.36,atk:.03,pink:1},E));
 pgrain(Object.assign({n:6,freq:3200,q:5,span:.30,gain:.06,gdur:.03,spread:.25},E));
 ptone(Object.assign({ft:'sawtooth',f0:140,f1:52,sweep:.18,dur:.22,gain:.12},E));
}
function sfxThrow(x,y,tx,ty){
 const a=audFor(x,y,tx,ty);if(!a)return;
 const lvl=a.gain,pan=a.pan,d=a.d,E={lvl,pan,d,bus:'arms'};
 if(sndPlay('throw',{lvl,pan,d}))return;
 pnoise(Object.assign({freq:1400,q:1.2,gain:.07,dur:.07},E));
 pnoise(Object.assign({freq:3600,q:6,gain:.04,dur:.04,delay:.03},E));
 ptone(Object.assign({ft:'sine',f0:900,f1:640,sweep:.12,dur:.14,gain:.03,delay:.05,atk:.03},E));
}
/* Launch voices. These are loud events, so they duck the small-arms bus and
   then sit on the master bus themselves rather than in the ducked path. */
function sfxLaunch(x,y,kind,tx,ty){
 if(muted||!ac())return;
 const a=audFor(x,y,tx,ty);if(!a)return;
 const lvl=a.gain,pan=a.pan,d=a.d,E={lvl,pan,d};
 if(AC){COMBAT_DUCK_T=AC.currentTime+1.2;duckArms(kind==='mortar'?.12:.28,.22);}
 if(sndPlay('launch_'+kind,{lvl,pan,d}))return;
 if(kind==='cannon'||kind==='cannon_hvy'){
  const hv=kind==='cannon_hvy';
  pimp(Object.assign({freq:hv?1000:1200,gain:hv?.62:.55,drive:2.2},E));
  psweep(Object.assign({f0:hv?4200:5000,f1:hv?200:260,sweep:hv?.14:.10,dur:hv?.22:.16,gain:hv?.66:.55,atk:.002,rev:.30,far:.5},E));
  ptone(Object.assign({ft:'sine',f0:hv?48:62,f1:hv?18:24,sweep:hv?.30:.22,dur:hv?.48:.34,gain:hv?.85:.70,atk:.004,rev:.18,far:.6},E));
  ptone(Object.assign({ft:'triangle',f0:hv?96:124,f1:hv?38:48,sweep:hv?.18:.14,dur:hv?.26:.20,gain:hv?.42:.34,atk:.003},E));
  pnoise(Object.assign({freq:3000,q:.5,ft:'highpass',gain:.18,dur:.04},E));
  pnoise(Object.assign({freq:300,q:.4,ft:'lowpass',gain:.30,dur:hv?1.15:.80,atk:.05,delay:.04,rev:.55,far:.9,pink:1},E));
  pgrain(Object.assign({n:4,freq:1600,q:7,span:.35,gain:.05,gdur:.05,delay:.18},E));
 }else if(kind==='mortar'){
  /* hollow tube: a high-Q resonance is the whole character of the sound */
  pimp(Object.assign({freq:700,gain:.18,drive:1.4},E));
  ptone(Object.assign({ft:'sine',f0:230,f1:80,sweep:.10,dur:.16,gain:.30,rev:.25},E));
  pnoise(Object.assign({freq:380,q:5,gain:.16,dur:.22,atk:.004,rev:.30},E));
  pnoise(Object.assign({freq:1100,q:3,gain:.07,dur:.07},E));
 }else if(kind==='aa'){
  pimp(Object.assign({freq:2600,gain:.26,drive:2.4},E));
  psweep(Object.assign({f0:8000,f1:1400,sweep:.10,dur:.16,gain:.26,atk:.006,pink:false},E));
  ptone(Object.assign({ft:'sawtooth',f0:500,f1:2600,sweep:.22,dur:.26,gain:.08},E));
  ptone(Object.assign({ft:'sine',f0:700,f1:2400,sweep:.28,dur:.30,gain:.05,atk:.04,rev:.2},E));
  pnoise(Object.assign({freq:4000,q:.5,ft:'highpass',gain:.12,dur:.03},E));
 }else if(kind==='artyrocket'){
  pimp(Object.assign({freq:1400,gain:.42,drive:2.2},E));
  psweep(Object.assign({f0:7000,f1:400,sweep:.30,dur:.46,gain:.48,atk:.02,rev:.35,far:.6},E));
  ptone(Object.assign({ft:'sawtooth',f0:180,f1:900,sweep:.40,dur:.48,gain:.16,atk:.02},E));
  ptone(Object.assign({ft:'sine',f0:70,f1:30,sweep:.26,dur:.40,gain:.40,rev:.20,far:.5},E));
  pnoise(Object.assign({freq:340,q:.4,ft:'lowpass',gain:.26,dur:1.0,atk:.08,delay:.08,rev:.60,far:1.0,pink:1},E));
  pgrain(Object.assign({n:5,freq:2600,q:7,span:.30,gain:.06,gdur:.04},E));
 }else{
  pimp(Object.assign({freq:1800,gain:.30,drive:2.0},E));
  psweep(Object.assign({f0:6000,f1:700,sweep:.18,dur:.26,gain:.34,atk:.012,rev:.22},E));
  ptone(Object.assign({ft:'sawtooth',f0:260,f1:1500,sweep:.26,dur:.30,gain:.09,atk:.02},E));
  pnoise(Object.assign({freq:2600,q:.5,ft:'highpass',gain:.14,dur:.05},E));
  ptone(Object.assign({ft:'sine',f0:90,f1:40,sweep:.12,dur:.18,gain:.22},E));
  pnoise(Object.assign({freq:900,q:.5,ft:'bandpass',gain:.10,dur:.50,atk:.06,delay:.06,rev:.40,far:.7},E));
 }
}
/* EXPLOSIONS. v63 had one recipe and four gain multipliers, so small/med/big/
   huge were the same sound louder. Each size now has its own TOPOLOGY: small
   carries no sub-bass and no ground reflection at all, med adds both, big
   doubles the debris field, and huge gets a second ground slap and a rubble
   rain that outlasts the blast. Fundamentals fall 70 / 55 / 42 / 33 Hz and
   nothing is written below 28 Hz, which is speaker excursion nobody hears. */
const EXPLV={
 small:{lf:0,lf2:0,bodyF0:3200,bodyF1:380,bodySw:.10,bodyD:.16,bodyG:.38,
        impF:2600,impG:.34,impDr:2.4, crackF:3000,crackG:.26,crackD:.05,
        debN:5, debF:2800,debSpan:.18,debG:.07, tailF:260,tailD:.35,tailG:.18,tailR:.30,tailX:.35,
        slap:0, duck:.18},
 med:{lf:55,lf2:41,bodyF0:3600,bodyF1:220,bodySw:.18,bodyD:.30,bodyG:.62,
      impF:2000,impG:.46,impDr:2.1, crackF:2400,crackG:.34,crackD:.07,
      debN:9, debF:2400,debSpan:.34,debG:.09, tailF:170,tailD:.70,tailG:.30,tailR:.50,tailX:.70,
      slap:{f0:92,f1:44,sweep:.10,dur:.16,gain:.34,delay:.055}, duck:.30},
 big:{lf:42,lf2:34.5,bodyF0:3800,bodyF1:160,bodySw:.26,bodyD:.42,bodyG:.82,
      impF:1700,impG:.55,impDr:1.9, crackF:2100,crackG:.42,crackD:.09,
      debN:14,debF:2200,debSpan:.55,debG:.11, tailF:140,tailD:1.30,tailG:.42,tailR:.60,tailX:1.0,
      slap:{f0:70,f1:38,sweep:.14,dur:.22,gain:.48,delay:.07}, duck:.34},
 huge:{lf:33,lf2:30,bodyF0:4200,bodyF1:120,bodySw:.34,bodyD:.55,bodyG:1.05,
       impF:1500,impG:.62,impDr:1.8, crackF:1900,crackG:.50,crackD:.11,
       debN:20,debF:2000,debSpan:.80,debG:.13, tailF:120,tailD:2.20,tailG:.55,tailR:.70,tailX:1.0,
       slap:{f0:62,f1:30,sweep:.16,dur:.26,gain:.60,delay:.075}, duck:.42}
};
function sfxBoom(x,y,size){
 if(muted||!ac())return;
 const a=audAt(x,y);if(!a)return;
 const lvl=a.gain,pan=a.pan,d=a.d,E={lvl,pan,d};
 const sz=EXPLV[size]?size:'med',S=EXPLV[sz];
 if(AC){COMBAT_DUCK_T=AC.currentTime+1.2;duckArms(S.duck,sz==='huge'?.45:.28);}
 const full=aBudget(BOOMW,5,0.20);
 if(sndPlay('boom_'+sz,{lvl,pan,d}))return;
 /* 1 transient: the leading edge, under 2 ms */
 pimp(Object.assign({freq:S.impF,gain:S.impG,drive:S.impDr},E));
 /* 2 crack: the sharp high-frequency shell of the blast */
 pnoise(Object.assign({freq:S.crackF,q:.6,ft:'highpass',gain:S.crackG,dur:S.crackD,atk:.001,rev:.18},E));
 /* 3 body: cutoff collapsing from kHz to a couple of hundred Hz */
 psweep(Object.assign({f0:S.bodyF0,f1:S.bodyF1,sweep:S.bodySw,dur:S.bodyD,gain:S.bodyG,atk:.002,rev:.35,far:.5},E));
 /* 4 sub, with an octave up so it still reads on a laptop. small has none. */
 if(S.lf){
  /* lf2 is an explicit floor per size rather than a ratio: the +/-6% humanisation
     has to be able to swing each size's fundamental without any two bands
     touching and without the lowest of them dropping under 28 Hz. */
  const lo=S.lf2;
  ptone(Object.assign({ft:'sine',f0:S.lf,f1:lo,sweep:S.bodyD*1.4,dur:S.bodyD*1.6,gain:S.bodyG*1.35,atk:.004,rev:.20,far:.6},E));
  ptone(Object.assign({ft:'triangle',f0:S.lf*2,f1:lo*1.7,sweep:S.bodyD*.9,dur:S.bodyD*1.1,gain:S.bodyG*.58,atk:.003,rev:.25},E));
 }
 if(!full)return;
 /* 5 debris scatter */
 pgrain(Object.assign({n:S.debN,freq:S.debF,q:6,span:S.debSpan,gain:S.debG,gdur:.05,spread:.45,delay:.02},E));
 /* 6 tail: the long low rumble, mostly in the far reverb */
 pnoise(Object.assign({freq:S.tailF,q:.4,ft:'lowpass',gain:S.tailG,dur:S.tailD,atk:.03,delay:.02,rev:S.tailR,far:S.tailX,pink:1},E));
 /* 7 ground reflection. Delaying a second thump by 55-75 ms is what puts the
    blast ON the ground rather than floating in the air. */
 if(S.slap)ptone(Object.assign({ft:'sine',atk:.006,rev:.35,far:.6},S.slap,E));
 if(sz==='huge'){
  ptone(Object.assign({ft:'sine',f0:50,f1:32,sweep:.20,dur:.34,gain:.38,atk:.01,delay:.145,rev:.40,far:.7},E));
  pgrain(Object.assign({n:12,freq:900,q:4,span:1.60,gain:.08,gdur:.09,delay:.35,spread:.6,fade:.6},E));
 }
}
/* A STRUCTURE COMING DOWN is not a big explosion; it is a detonation followed by
   a building failing. Five stages: blast, structural groan (detuned saws falling
   through a low-pass, the sound of a frame giving way), collapse rumble, rubble
   rain, and dust settling. The v63 version put its fundamental at 34 down to
   14 Hz, most of which is inaudible on headphones and merely eats headroom;
   this one lands at 30 Hz and stops there. */
function sfxBuildingDestroy(x,y){
 if(muted||!ac())return;
 const a=audAt(x,y);if(!a)return;
 const lvl=a.gain,pan=a.pan,d=a.d,E={lvl,pan,d};
 if(AC){COMBAT_DUCK_T=AC.currentTime+1.6;duckArms(.50,.60);}
 if(sndPlay('bld_destroy',{lvl,pan,d}))return;
 /* 1 the detonation */
 pimp(Object.assign({freq:1300,gain:.70,drive:1.8},E));
 pnoise(Object.assign({freq:1900,q:.6,ft:'highpass',gain:.52,dur:.12,atk:.001,rev:.20},E));
 psweep(Object.assign({f0:4400,f1:130,sweep:.30,dur:.50,gain:1.05,atk:.002,rev:.35,far:.6},E));
 ptone(Object.assign({ft:'sine',f0:44,f1:30,sweep:.60,dur:1.00,gain:1.45,atk:.004,rev:.25,far:.8},E));
 ptone(Object.assign({ft:'triangle',f0:88,f1:52,sweep:.40,dur:.60,gain:.62,atk:.003,rev:.30},E));
 ptone(Object.assign({ft:'sine',f0:64,f1:32,sweep:.18,dur:.28,gain:.55,atk:.008,delay:.075,rev:.35,far:.7},E));
 /* 2 structural groan: three detuned saws sagging through a low-pass */
 ptone(Object.assign({ft:'sawtooth',f0:142,f1:58,sweep:.85,dur:.95,gain:.17,atk:.10,delay:.15,rev:.35},E));
 ptone(Object.assign({ft:'sawtooth',f0:151,f1:62,sweep:.90,dur:.95,gain:.15,atk:.12,delay:.17,rev:.35},E));
 ptone(Object.assign({ft:'sawtooth',f0:97,f1:41,sweep:.80,dur:.90,gain:.13,atk:.11,delay:.16,rev:.30},E));
 pnoise(Object.assign({freq:300,q:12,gain:.16,dur:.70,atk:.14,delay:.18,rev:.40},E));
 /* 3 collapse rumble */
 pnoise(Object.assign({freq:130,q:.4,ft:'lowpass',gain:.58,dur:1.80,atk:.10,delay:.35,rev:.65,far:1.0,pink:1},E));
 /* 4 rubble rain, front-loaded and long */
 pgrain(Object.assign({n:22,freq:1400,q:5,span:1.60,gain:.10,gdur:.07,delay:.45,spread:.6,fade:.8},E));
 pgrain(Object.assign({n:8,freq:600,q:3,span:1.20,gain:.09,gdur:.11,delay:.55,spread:.5,pink:1},E));
 /* 5 dust settling */
 pnoise(Object.assign({freq:5200,q:.4,ft:'highpass',gain:.05,dur:1.20,atk:.35,delay:1.10,rev:.45,far:.6},E));
}
/* PLASTIC DEATH. These are toy soldiers: a figure taking a hit should crack like
   polystyrene and then clatter onto the mat, not tick. High-Q resonances do the
   work; the whole voice is cheap because infantry die in numbers. */
function sfxPop(x,y){
 const a=audAt(x,y);if(!a)return;
 const lvl=a.gain,pan=a.pan,d=a.d,E={lvl,pan,d,bus:'arms'};
 if(sndPlay('pop',{lvl,pan,d}))return;
 pimp(Object.assign({freq:4200,gain:.16,drive:1.6},E));
 pnoise(Object.assign({freq:3400,q:12,gain:.13,dur:.035},E));
 pnoise(Object.assign({freq:1800,q:8,gain:.08,dur:.05,delay:.02},E));
 ptone(Object.assign({ft:'triangle',f0:420,f1:180,sweep:.04,dur:.06,gain:.05},E));
 pgrain(Object.assign({n:3,freq:1200,q:7,span:.16,gain:.05,gdur:.04,delay:.05,spread:.25},E));
}
/* v92.1: SILENT, by the owner's decision - smashing a wildlife den makes no
   sound at all. The function stays (kill() still calls it, and T43.J's
   enumeration of audio entry points still drives it) so the decision lives
   HERE, visible, rather than as a deleted call site someone later "fixes" by
   wiring a voice back in. T68.A asserts it builds nothing. */
function sfxNestBreak(x,y){}
/* v92.1: small arms striking armor - the metallic ricochet the owner asked
   for. Gated the same way as every positional voice, then thinned twice: a
   probability draw (most hits spark silently) and a rolling window, because
   applyDmg fires far more often than any weapon report. Both draws are
   Math.random - this is called from SIM code, and one draw from the seeded
   rng here would desync a live match (the v87.1 sell-teardown lesson). */
let RICOW=[];
function sfxRico(x,y){
 if(Math.random()>=.35)return;
 const a=audAt(x,y);if(!a)return;
 if(!aBudget(RICOW,6,0.3))return;
 const lvl=a.gain,pan=a.pan,d=a.d,E={lvl,pan,d,bus:'arms'};
 if(sndPlay('rico',{lvl,pan,d}))return;
 /* fallback ping: tiny clang, falling whistle, thin zing - no long rings */
 pimp(Object.assign({freq:3200,gain:.14,drive:2.2},E));
 ptone(Object.assign({ft:'sine',f0:2400,f1:700,sweep:.16,dur:.20,gain:.07},E));
 pnoise(Object.assign({freq:4200,q:9,gain:.06,dur:.05},E));
}
/* a barricade destroyed in combat. v92.1 REDESIGN: this used to be wire and
   sheet metal rattling down with "no detonation anywhere in it" - the v64
   brief, written when the same voice also played on a SOLD structure. Selling
   has used the full building teardown since v87.1, so the only thing left
   calling this is a wall dying under fire, and the owner heard the rattle as
   a chime. It is a small blast with masonry crunch now, recorded take and
   synth fallback alike. */
function sfxStructBreak(x,y){
 const a=audAt(x,y);if(!a)return;
 const lvl=a.gain,pan=a.pan,d=a.d,E={lvl,pan,d};
 if(sndPlay('struct_break',{lvl,pan,d}))return;
 pimp(Object.assign({freq:1600,gain:.22,drive:2.0},E));
 psweep(Object.assign({f0:2800,f1:180,sweep:.12,dur:.22,gain:.30,atk:.002,rev:.18},E));
 ptone(Object.assign({ft:'sine',f0:80,f1:38,sweep:.12,dur:.18,gain:.22},E));
 pgrain(Object.assign({n:9,freq:1500,q:4,span:.34,gain:.10,gdur:.05,spread:.35},E));
}
function sfxWhoosh(x,y){
 const a=audAt(x,y);if(!a)return;
 const lvl=a.gain,pan=a.pan,d=a.d,E={lvl,pan,d};
 if(sndPlay('whoosh',{lvl,pan,d}))return;
 psweep(Object.assign({f0:6000,f1:200,sweep:.42,dur:.55,gain:.28,atk:.06,rev:.35,far:.7},E));
 pnoise(Object.assign({freq:700,q:.4,ft:'lowpass',gain:.20,dur:.50,atk:.06,rev:.30,pink:1},E));
 ptone(Object.assign({ft:'sine',f0:90,f1:50,sweep:.40,dur:.50,gain:.18,atk:.05,rev:.20,far:.5},E));
 pgrain(Object.assign({n:5,freq:3400,q:4,span:.35,gain:.05,gdur:.05,delay:.10,spread:.5},E));
}
// --- UI / selection sounds (NOT positional: interface feedback, always centered + audible) ---
// pure:1 keeps the humanisation off these: a click that wanders in pitch reads as a fault.
function sClick(){if(muted||!ac())return;ptone({ft:'sine',f0:900,dur:.05,gain:.04,pure:1});}
function sUiTone(){if(muted||!ac())return;ptone({ft:'sine',f0:600,dur:.06,gain:.05,pure:1});}
/* --- the menu's own chrome, added at v98 ---
   A tick under the cursor and a clack under the click. Both are `pure`, on
   sClick's own rule: an interface sound that wanders in pitch reads as a fault
   rather than as feedback.
   sTick is deliberately the quietest voice in the file - it fires on every
   button the cursor crosses, and a hover sound you NOTICE is a hover sound you
   will hate by the third menu. sMenuClick is the answer to it and is the
   stronger of the pair by design: a bright transient for the contact and a
   short falling body under it, roughly twice sClick's level. sClick is
   unchanged and still owns every in-match button; these two own the setup
   screen and the Field Manual. */
function sTick(){if(muted||!ac())return;ptone({ft:'sine',f0:1650,dur:.022,gain:.020,pure:1});}
function sMenuClick(){
 if(muted||!ac())return;
 ptone({ft:'sine',f0:1250,dur:.032,gain:.052,pure:1});
 ptone({ft:'triangle',f0:520,f1:300,sweep:.05,dur:.085,gain:.075,pure:1});
}
/* THE MENU'S HOVER/CLICK DELEGATION, bound once per host.
   One delegated pair per host and NOT a line inside every handler: the setup
   screen builds its faction cards, map cards and whole online-lobby panel at
   runtime, and the Field Manual rebuilds its gallery on every tab - a per-site
   call would have to be remembered into each of them, which is the v90.1 trap
   (a painter grew a new argument and the fifteenth caller was missed for a
   whole release). A delegated listener cannot be forgotten by a button that has
   not been written yet.
   mouseover BUBBLES and fires again for every child inside a card, so the tick
   is gated on the closest interactive ancestor actually CHANGING - otherwise
   sliding across a card's three lines of text ticks three times. A move onto
   dead space inside the host clears the memory (so returning to the same button
   ticks again) and mouseleave clears it on the way out. mouseenter would not
   bubble at all and could not be delegated.
   The click sound REPLACES the sClick() the menu's own handlers used to make
   one by one; those calls are gone in this release, so a click still makes
   exactly one sound. Everything inside the HUD keeps sClick(). */
const MENU_HIT='button,.card,.icell';
let menuHoverEl=null;
function menuAudioBind(host){
 if(!host||!host.addEventListener)return false;
 host.addEventListener('mouseover',e=>{
  const el=(e&&e.target&&e.target.closest)?e.target.closest(MENU_HIT):null;
  if(el===menuHoverEl)return;
  menuHoverEl=el;
  if(el&&!el.disabled)sTick();
 });
 host.addEventListener('mouseleave',()=>{menuHoverEl=null});
 host.addEventListener('click',e=>{
  const el=(e&&e.target&&e.target.closest)?e.target.closest(MENU_HIT):null;
  if(el&&!el.disabled)sMenuClick();
 });
 return true;
}
/* v27.1: soft two-tone nudge when a fresh attack blip lands on the minimap.
   Non-positional UI sound, quiet, and throttled hard: one nudge every few
   seconds no matter how hot the battle gets. */
let lastAtkSnd=-1e9;
function sAtkAlert(){
 if(muted||!ac())return;
 if(AC.currentTime-lastAtkSnd<3.5)return;lastAtkSnd=AC.currentTime;
 ptone({ft:'sine',f0:340,f1:220,sweep:.16,dur:.18,gain:.07,pure:1});
 ptone({ft:'sine',f0:880,dur:.05,gain:.045,delay:.03,pure:1});
}
/* --- selection voices. v63 answered twenty unit keys with four branches and
   sixteen buildings with three tone variants, which is why selecting anything
   sounded like selecting anything else. --- */
/* v92.1: selecting an aircraft answers with a BRIEF rotor and nothing else -
   the turbine and gearbox whine layers are gone and the windows are roughly
   half their v64 length, by the owner's decision. What still tells the three
   apart is the rotor itself: chop and blade rates, the filter, and the
   Chinook's tandem beat. T43.L pins all of that, so the differentiation is a
   checked claim rather than a hope. */
/* v103: every rotor's level DOUBLED on the owner's instruction - the answer was
   too quiet against the ground fleet's diesels. Only `g` moved: chop and blade
   rates, the filter and the Chinook's tandem beat are what tell the three apart
   and T43.L pins those, so the three stay exactly as distinguishable as they
   were and stay in the same loudness ORDER as each other. */
const ROTORV={
 heli:{chop:11,blade:22,lp:320,dur:.45,g:.52},
 apache:{chop:14,blade:28,lp:280,dur:.48,g:.48},
 chinook:{chop:8.5,blade:9.3,lp:240,dur:.60,g:.60}
};
function sRotor(kind){
 if(muted||!ac()||!voxOk())return;const buf=noiseBuf();if(!buf)return;
 const R=ROTORV[kind]||ROTORV.heli,t=AC.currentTime,dur=R.dur;
 const src=AC.createBufferSource();src.buffer=buf;src.loop=true;
 const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=R.lp;
 const g=AC.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(R.g,t+.08);g.gain.setValueAtTime(R.g,t+dur-.14);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 /* blade chop: two stacked LFOs. On the Chinook the two rates are close enough
    to beat against each other, which is what a tandem rotor actually does. */
 const lfo=AC.createOscillator();lfo.type='sine';lfo.frequency.value=R.chop;const lfoG=AC.createGain();lfoG.gain.value=.55;
 const lfo2=AC.createOscillator();lfo2.type='sine';lfo2.frequency.value=R.blade;const lfoG2=AC.createGain();lfoG2.gain.value=kind==='chinook'?.5:.2;
 const dc=AC.createGain();dc.gain.value=.45;
 lfo.connect(lfoG).connect(dc.gain);lfo2.connect(lfoG2).connect(dc.gain);lfo.start(t);lfo2.start(t);lfo.stop(t+dur+.05);lfo2.stop(t+dur+.05);
 src.connect(lp).connect(dc).connect(g);aout(g,0);src.start(t,Math.random());src.stop(t+dur+.05);
 voxAdd(t+dur+.05);
}
/* v92.1: selecting any ground vehicle answers with a BRIEF diesel idle - one
   voice family, differentiated by engine size rather than by eight bespoke
   layer stacks, by the owner's decision. Each row is (chug rate, fundamental,
   window, level); the fundamentals sit on a geometric ladder ~20% apart so
   every pair stays past the 13% distinctness band T43.L tests with, the Bull
   idles lowest and slowest, the Scout Bike highest and fastest, and T43.L
   pins the ordering. The Observation Balloon keeps its burner: it is the one
   answer here with no engine at all (v86), and a gas bag idling like a lorry
   would be exactly the wrong thing. */
const DIESELV={
 hvytank:{rate:6,  f:70, dur:.55,g:.26},
 tank:   {rate:7.5,f:85, dur:.50,g:.24},
 diesel: {rate:8.5,f:102,dur:.50,g:.24},
 apc:    {rate:10, f:122,dur:.45,g:.20},
 arty:   {rate:9,  f:147,dur:.45,g:.20},
 aa:     {rate:11, f:176,dur:.42,g:.19},
 jeep:   {rate:12.5,f:211,dur:.40,g:.18},
 bike:   {rate:14, f:253,dur:.35,g:.18}
};
function sEngine(kind){
 if(muted||!ac())return;
 /* v86: the Observation Balloon - a burner roar over rope creak, unchanged at
    v92.1 on purpose: a balloon has no engine to idle. */
 if(kind==='balloon'){
  pnoise({freq:520,q:.6,ft:'lowpass',gain:.20,dur:.70,atk:.14,pink:1});
  pnoise({freq:180,q:.5,ft:'lowpass',gain:.11,dur:.55,atk:.20});
  ptone({ft:'sine',f0:64,f1:52,sweep:.5,dur:.60,gain:.08,atk:.18});
  pgrain({n:2,freq:900,q:5,span:.34,gain:.03,gdur:.05,spread:.3});
  return;
 }
 const D=DIESELV[kind]||DIESELV.diesel;
 chug(D.dur,D.rate,D.f,D.g,0);
 /* one breath of intake noise so the idle is not a bare buzz */
 pnoise({freq:Math.min(2200,D.f*9),q:1.2,gain:.05,dur:D.dur*.8,atk:.05});
}
/* which of the eleven building voices a structure answers with */
function bldVoice(e){
 const k=e.key;
 if(k==='hq'||k==='outpost')return 'command';
 if(k==='barracks')return 'barracks';
 if(k==='garage')return 'garage';
 if(k==='helipad')return 'helipad';
 if(k==='lab')return 'lab';
 if(k==='guardtower'||k==='bunker')return 'defense';
 if(k==='generator'||k==='turbine')return 'power';
 if(k==='supply'||k==='dump')return 'supply';
 if(k==='radar')return 'radar';
 if(k==='radiotower')return 'radio';
 if(B[k]&&B[k].barr)return 'barricade';   // v88: both walls share the icon and the placement sound
 return e.t.tower?'defense':(e.t.prod?'garage':'supply');
}
function sBuildingSelect(e){
 if(muted||!ac())return;
 const v=bldVoice(e);
 if(v==='command'){
  /* radio squelch, then a rising two-note with authority under it */
  pnoise({freq:2400,q:4,gain:.05,dur:.04});
  pnoise({freq:5000,q:.5,ft:'highpass',gain:.03,dur:.05,delay:.03});
  ptone({ft:'square',f0:160,dur:.07,gain:.09,delay:.05});
  ptone({ft:'square',f0:240,dur:.11,gain:.09,delay:.11});
  ptone({ft:'sine',f0:80,dur:.16,gain:.07,delay:.05});
 }else if(v==='barracks'){
  pnoise({freq:500,q:.6,ft:'lowpass',gain:.13,dur:.06});
  pnoise({freq:500,q:.6,ft:'lowpass',gain:.10,dur:.06,delay:.09});
  ptone({ft:'sine',f0:1650,f1:1900,sweep:.10,dur:.13,gain:.04,delay:.07,atk:.02});
 }else if(v==='garage'){
  pgrain({n:5,freq:2800,q:9,span:.10,gain:.07,gdur:.022,spread:.2});
  pnoise({freq:1200,q:6,gain:.09,dur:.05,delay:.10});
  ptone({ft:'square',f0:120,dur:.09,gain:.06,delay:.10});
 }else if(v==='helipad'){
  chug(.24,13,110,.12,0);
  ptone({ft:'sine',f0:60,f1:120,sweep:.18,dur:.22,gain:.10});
  ptone({ft:'sawtooth',f0:600,f1:1500,sweep:.20,dur:.22,gain:.03,atk:.05});
 }else if(v==='lab'){
  ptone({ft:'sine',f0:420,f1:1400,sweep:.16,dur:.18,gain:.05});
  pnoise({freq:3000,q:8,gain:.03,dur:.05,delay:.05});
  ptone({ft:'square',f0:2200,dur:.04,gain:.03,delay:.14});
 }else if(v==='defense'){
  ptone({ft:'sawtooth',f0:220,f1:150,sweep:.12,dur:.15,gain:.07});
  ptone({ft:'sine',f0:90,dur:.10,gain:.06});
  pnoise({freq:2600,q:10,gain:.07,dur:.04,delay:.12});
 }else if(v==='power'){
  ptone({ft:'sine',f0:60,dur:.26,gain:.10,atk:.06});
  ptone({ft:'sine',f0:120,dur:.24,gain:.06,atk:.07});
  ptone({ft:'sawtooth',f0:240,f1:300,sweep:.20,dur:.22,gain:.025,atk:.08});
 }else if(v==='radar'){
  /* a sonar ping, deliberately the most identifiable sound in the set */
  ptone({ft:'sine',f0:1250,dur:.30,gain:.06,atk:.004,rev:.50,far:.8});
  ptone({ft:'sine',f0:1875,dur:.18,gain:.025,atk:.004,rev:.40});
 }else if(v==='radio'){
  pnoise({freq:1800,q:1.2,gain:.07,dur:.10});
  pnoise({freq:4000,q:.5,ft:'highpass',gain:.04,dur:.12,delay:.02});
  ptone({ft:'sine',f0:900,f1:600,sweep:.08,dur:.10,gain:.04,delay:.08});
 }else if(v==='barricade'){
  pgrain({n:6,freq:3200,q:12,span:.14,gain:.06,gdur:.02,spread:.4});
  ptone({ft:'square',f0:260,f1:190,sweep:.06,dur:.08,gain:.03});
 }else{
  pnoise({freq:420,q:.6,ft:'lowpass',gain:.15,dur:.09,atk:.002});
  ptone({ft:'sine',f0:140,f1:70,sweep:.07,dur:.11,gain:.10});
  pgrain({n:3,freq:1500,q:7,span:.12,gain:.05,gdur:.04,delay:.05});
 }
}
// --- spoken acknowledgement barks via the browser speech engine (no audio files) ---
let SPV=[],lastBark=-1e9;
function loadVoices(){try{SPV=speechSynthesis.getVoices()||[];}catch(e){SPV=[];}}
if(typeof speechSynthesis!=='undefined'){loadVoices();try{speechSynthesis.onvoiceschanged=loadVoices;}catch(e){}}
function pickVoice(){if(!SPV.length)return null;return SPV.find(v=>/^en/i.test(v.lang)&&/(male|david|daniel|fred|alex|guy|james|george|mark|tom)/i.test(v.name))||SPV.find(v=>/^en/i.test(v.lang))||SPV[0];}
const BARKS_INF=['Yes sir!','Ready!','Standing by.','Awaiting orders.','Reporting in.','Sir!','Ready to move.','Ready to fight.']; // v92.1: last two added by the owner
const BARKS_SARGE=['Sarge here!','Let\u2019s move!','Lock and load.','Ready for action.'];
function sVoiceBark(e){
 if(muted)return;
 if(typeof speechSynthesis==='undefined'){sUiTone();return;}
 const now=(typeof performance!=='undefined'?performance.now():Date.now());if(now-lastBark<350)return;lastBark=now;
 try{
  speechSynthesis.cancel();
  const lines=e.key==='sarge'?BARKS_SARGE:BARKS_INF;
  const ut=new SpeechSynthesisUtterance(lines[Math.floor(Math.random()*lines.length)]);
  ut.rate=1.05;ut.pitch=e.key==='sarge'?0.7:0.85;ut.volume=0.85;
  const v=pickVoice();if(v)ut.voice=v;
  speechSynthesis.speak(ut);
 }catch(e2){sUiTone();}
}
// pick ONE representative entity from a selection so box-selecting many units plays a single bark.
function pickBarkSubject(list){const mine=list.filter(e=>e.p===G.human);const pool=mine.length?mine:list;return pool.find(e=>e.kind==='unit'&&e.t.a!=='truck')||pool.find(e=>e.kind==='unit')||pool[0];}
function selectionBark(list){
 if(muted||!G||!list||!list.length)return;
 const e=pickBarkSubject(list);if(!e)return;
 if(e.p!==G.human){sUiTone();return;}
 if(e.kind==='bld'){sBuildingSelect(e);return;}
 const t=e.t,k=e.key;
 /* v64: eleven vehicle voices where v63 had four. The Bull does not answer like
    a Tank, an Apache does not answer like a Huey, and the Chinook's tandem
    rotors beat against each other the way a real one does. */
 if(t.balloon)sEngine('balloon'); // v86: a gas bag has no rotor, so it must not answer as one
 else if(t.fly)sRotor(k==='apache'||k==='choktaw'?'apache':(k==='chinook'?'chinook':'heli')); // v88: the Choktaw takes the Apache's heavier rotor, being the heavier gunship
 else if(t.a==='cmd')sEngine('diesel'); // v86: the Command Truck is a lorry and answers like one
 else if(k==='bike')sEngine('bike');
 else if(t.a==='jeep')sEngine('jeep');
 else if(t.a==='truck')sEngine('diesel');
 else if(t.a==='apc')sEngine('apc');
 else if(t.a==='arty')sEngine('arty');
 else if(t.a==='aa')sEngine('aa');
 else if(t.a==='inf')sVoiceBark(e);
 else sEngine(t.big?'hvytank':'tank');
}
// --- continuous dump-truck mining ambience: two shared loops (plastic grind vs battery
//     hum), each whose gain + pan follow the visible, actively-mining trucks of that type. ---
let MINE={plastic:null,battery:null};
let COMBAT_DUCK_T=0; // v27.1: mining ambience ducks until this AC time after combat sfx
function buildMineVoice(kind){
 if(!ac())return null;const buf=noiseBuf();if(!buf)return null;const t=AC.currentTime;
 const g=AC.createGain();g.gain.value=0;
 const pan=AC.createStereoPanner?AC.createStereoPanner():null;
 if(kind==='plastic'){
  // low mechanical grind plus a slower bandpassed scrape/clatter
  const s1=AC.createBufferSource();s1.buffer=buf;s1.loop=true;
  const hp=AC.createBiquadFilter();hp.type='highpass';hp.frequency.value=42;
  const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=300;
  const lfo=AC.createOscillator();lfo.type='sine';lfo.frequency.value=6;const lg=AC.createGain();lg.gain.value=.5;const b1=AC.createGain();b1.gain.value=.7;
  lfo.connect(lg).connect(b1.gain);lfo.start(t);
  s1.connect(hp).connect(lp).connect(b1).connect(g);s1.start(t);
  const s2=AC.createBufferSource();s2.buffer=buf;s2.loop=true;
  const bp=AC.createBiquadFilter();bp.type='bandpass';bp.frequency.value=850;bp.Q.value=.8;
  const lfo2=AC.createOscillator();lfo2.type='sine';lfo2.frequency.value=3.1;const lg2=AC.createGain();lg2.gain.value=.6;const b2=AC.createGain();b2.gain.value=.4;
  lfo2.connect(lg2).connect(b2.gain);lfo2.start(t);
  s2.connect(bp).connect(b2).connect(g);s2.start(t);
 }else{
  // electrical hum (60/120 Hz) plus a high sizzle/crackle
  const o1=AC.createOscillator();o1.type='sawtooth';o1.frequency.value=60;
  const bp1=AC.createBiquadFilter();bp1.type='bandpass';bp1.frequency.value=170;bp1.Q.value=.6;
  const h1=AC.createGain();h1.gain.value=.55;o1.connect(bp1).connect(h1).connect(g);o1.start(t);
  const o2=AC.createOscillator();o2.type='square';o2.frequency.value=120;const lp2=AC.createBiquadFilter();lp2.type='lowpass';lp2.frequency.value=520;const h2=AC.createGain();h2.gain.value=.14;o2.connect(lp2).connect(h2).connect(g);o2.start(t);
  const s3=AC.createBufferSource();s3.buffer=buf;s3.loop=true;
  const hpz=AC.createBiquadFilter();hpz.type='highpass';hpz.frequency.value=3200;
  const lz=AC.createOscillator();lz.type='square';lz.frequency.value=13;const lzg=AC.createGain();lzg.gain.value=.7;const bz=AC.createGain();bz.gain.value=.2;
  lz.connect(lzg).connect(bz.gain);lz.start(t);
  s3.connect(hpz).connect(bz).connect(g);s3.start(t);
 }
 const mdest=sfxBus||masterGain||AC.destination; // v104.2: the mining loop is an effect, not music
 if(pan)g.connect(pan).connect(mdest);else g.connect(mdest);
 return {gain:g,pan:pan};
}
function updateMineAmbience(){
 if(!AC)return;
 const acc={plastic:{g:0,p:0},battery:{g:0,p:0}};
 if(!muted&&G&&G.human&&!G.paused&&!G.over){
  for(const u of G.human.units){
   if(u.t.a!=='truck'||!u.mining)continue;
   const a=audAt(u.x,u.y);if(!a)continue;
   const kind=(u.node&&u.node.t==='battery')?'battery':'plastic';
   acc[kind].g+=a.gain;acc[kind].p+=a.pan*a.gain;
  }
 }
 for(const kind in acc){
  const s=acc[kind];let target=0,pan=0;
  if(s.g>0){target=0.7*Math.min(.18,.10+.04*Math.log2(1+s.g));pan=s.p/s.g;} // v27.1: roughly half the old ceiling
  if(target>0&&AC.currentTime<COMBAT_DUCK_T)target*=.35; // v27.1: mining yields to nearby combat
  if(target>0&&!MINE[kind])MINE[kind]=buildMineVoice(kind);
  const v=MINE[kind];if(!v)continue;
  try{v.gain.gain.setTargetAtTime(target,AC.currentTime,.12);}catch(e){}
  if(v.pan)try{v.pan.pan.setTargetAtTime(clamp(pan,-1,1),AC.currentTime,.14);}catch(e){}
 }
}

