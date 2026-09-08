/* ============================================================================
   T96 - v111: EVERY FACTION BUILDING MOVES A LITTLE
   The owner asked for a small, subtle animation on every faction building
   (barricades exempt): a flag in the wind, a glowing light, a little smoke.
   Measured on v110 first: ten of the seventeen already had a live part in
   bldLive (three flags, the Lab's dome and aerial, the Helipad's corner lights,
   the Generator's panel, the Turbine's blades, the tower's turret, the Radar's
   dish, the Foundry's spout) and SEVEN had none - Barracks, Garage, Supply
   Depot, Radio Tower, Munitions Dump, Bunker (a garrison count is text, not
   motion), Forward Pad. All seven carry one now, the ten carry a second idea, and three helpers were added beside
   bldLive: bldWind (ONE breeze for every flag, the tarp and the windsock),
   bldSmoke (deterministic rising puffs) and bldBlink (a lamp on a duty cycle).

   The claims here are the render layer's standing rules, driven rather than
   read: the clock is G.tick and the building's id and never the seeded stream
   (rule 2); a state-driven tell (the Garage's exhaust, the Bunker's slits, the
   tower's night cone, the pad's ring) shows in exactly the state it claims;
   and the fixtures the Field Manual (INFO.stub) and three older tails hand
   bldLive - a bare {key,sz,id}, a stub G with no units - still paint.

   The Forward Pad's windsock moved OUT of the baked hull into the live pass,
   so its texture was re-rendered through the v95 pipeline (one file, and the
   pipeline was shown to reproduce two untouched siblings byte-for-byte first).
   ==========================================================================*/
section('T96 v111: every faction building moves a little');

/* a recording canvas: every path op and every fill/stroke with its style, so a
   frame can be compared to another frame as text. Same shape as T94.D. */
function bldLog111(b,col,G0){
 const out=[];const base=document.createElement('canvas').getContext('2d');
 const c=new Proxy(base,{get(tt,k){
  if(k==='fill'||k==='stroke'||k==='fillRect'||k==='fillText'||k==='strokeRect')return(...a)=>{out.push(k+':'+String(tt.fillStyle)+'|'+String(tt.strokeStyle)+'|'+a.map(v=>typeof v==='number'?v.toFixed(2):v).join(',')+'|a'+(+tt.globalAlpha).toFixed(3))};
  if(k==='moveTo'||k==='lineTo'||k==='arc'||k==='ellipse'||k==='quadraticCurveTo'||k==='closePath'||k==='rotate')return(...a)=>{out.push(k+':'+a.map(v=>typeof v==='number'?v.toFixed(2):v).join(','))};
  const v=tt[k];return typeof v==='function'?v.bind(tt):v;}});
 const real=G;if(G0)G=G0;
 try{bldLive(c,b,col||FAC.green.color)}finally{G=real}
 return out;
}
const FACBLD111=Object.keys(B).filter(k=>!B[k].barr&&k!=='nest'&&!B[k].lvl); // the faction buildings: walls exempt by the ask, nests and level art are not anyone's
const stub111=k=>({key:k,sz:B[k].sz,id:3,tface:.7,prog:1,garrison:[],queue:[]});

/* ---------- A: coverage, derived off B, and "it actually moves" ---------- */
section('T96.A every faction building has a live branch, and every branch changes frame to frame');
{
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:660111});
 for(let i=0;i<12;i++)update(1/30);
 const src=bldLive.toString();
 const missing=FACBLD111.filter(k=>src.indexOf(`k==='${k}'`)<0);
 ok(`T96.A all ${FACBLD111.length} faction buildings have a branch in bldLive (missing: ${missing.join(',')||'none'})`, missing.length===0 && FACBLD111.length===17);
 ok('T96.A the roster is DERIVED: the two walls are excluded by t.barr, the nest and the level art by what they are - a 19th building fails here until it moves',
    FACBLD111.indexOf('barricade')<0 && FACBLD111.indexOf('hbarricade')<0 && FACBLD111.indexOf('nest')<0 && FACBLD111.indexOf('crate')<0);
 /* over a 120-tick sweep every building paints at least two DIFFERENT frames.
    At NIGHT, because the Guard Tower's tick-driven part is its night cone (by
    day its only live part is the turret, which follows tface, not the clock). */
 const still=[];const t0=G.tick;G.dayOff=DAY_PHASES[2].t0*30;
 const frames={};
 for(const k of FACBLD111){
  const seen=new Set();frames[k]=[];
  for(let t=0;t<120;t++){G.tick=t0+t;const log=bldLog111(stub111(k));seen.add(log.join('\n'));frames[k].push(log);}
  if(seen.size<2)still.push(k);
 }
 G.tick=t0;G.dayOff=0;
 ok(`T96.A none of them stands still across 120 ticks (still: ${still.join(',')||'none'})`, still.length===0);
 // and the seven the owner's ask found empty each carry the kind of thing promised, in some frame of the sweep (a lamp is dark most of its cycle)
 const want={barracks:'ellipse',supply:'lineTo',radiotower:'arc',dump:'ellipse',bunker:'ellipse',fwdpad:'lineTo',garage:'arc'};
 const bad=Object.keys(want).filter(k=>!frames[k].some(log=>log.some(s=>s.indexOf(want[k]+':')===0)));
 ok(`T96.A the seven that stood still on v110 paint geometry now (${bad.join(',')||'all seven'})`, bad.length===0);
}

/* ---------- B: rule 2 - the render layer never touches the stream ---------- */
section('T96.B the animations read G.tick and the building id, never srand()');
{
 const src=[bldLive,bldWind,bldSmoke,bldBlink].map(f=>f.toString()).join('\n');
 ok('T96.B none of the four names srand, rnd or Math.random', !/\bsrand\(|\brnd\(|Math\.random/.test(src));
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:660111});
 for(let i=0;i<12;i++)update(1/30);
 const r0=G.rngS,h0=hashState();
 for(const f of Object.keys(FAC).filter(f=>f!=='bug'))for(const k of FACBLD111)for(let t=0;t<40;t+=3){G.tick+=t;bldLog111(stub111(k),FAC[f].color);G.tick-=t;}
 ok('T96.B painting every building of every army over forty ticks leaves srand() and the state hash where they were', G.rngS===r0&&hashState()===h0);
 let same=true;for(const k of FACBLD111)if(bldLog111(stub111(k)).join()!==bldLog111(stub111(k)).join())same=false;
 ok('T96.B one tick paints the same frame twice: two lockstep clients draw the same smoke', same);
}

/* ---------- C: the Garage smokes only while it is building something ---------- */
section('T96.C the Garage\'s exhaust is a tell: puffs while the queue is live, none when idle');
{
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:660111});
 const puffs=log=>log.filter(s=>s.indexOf('fill:rgba(168,168,176')===0).length;
 const idle=stub111('garage'),busy=Object.assign(stub111('garage'),{queue:['jeep']});
 ok('T96.C idle: no exhaust', puffs(bldLog111(idle))===0);
 ok('T96.C a vehicle on the bench: three puffs a frame', puffs(bldLog111(busy))===3);
 ok('T96.C a Garage still under construction does not smoke, whatever is queued', puffs(bldLog111(Object.assign({},busy,{prog:.5})))===0);
 const lamp=log=>log.some(s=>s.indexOf('fill:rgba(255,232,160')===0);
 ok('T96.C the work lamp glows either way', lamp(bldLog111(idle))&&lamp(bldLog111(busy)));
 // the flicker: over 200 ticks the lamp's alpha dips (the bad wire) at least once and hums the rest
 const alphas=[];for(let t=0;t<200;t++){G.tick=t;const s=bldLog111(idle).find(s=>s.indexOf('fill:rgba(255,232,160')===0);alphas.push(parseFloat(s.split(',')[3]));}
 ok('T96.C ...on a bad wire: a dip below a third of its hum, and a hum that never goes out', Math.min(...alphas)<Math.max(...alphas)*.4 && alphas.every(a=>a>0));
}

/* ---------- D: the Bunker's slits glow only with men inside ---------- */
section('T96.D the Bunker: periscope always, slit glow only while garrisoned, brighter when fuller');
{
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:660111});
 const glow=log=>log.filter(s=>s.indexOf('fill:rgba(255,200,90')===0);
 const scope=log=>log.some(s=>s.indexOf('fill:#9fd8ff')===0);
 const empty=stub111('bunker');
 ok('T96.D empty: the periscope head paints and the slits are dark', scope(bldLog111(empty)) && glow(bldLog111(empty)).length===0);
 const men=n=>Object.assign(stub111('bunker'),{t:B.bunker,garrison:new Array(n).fill({})});
 ok('T96.D one man inside: all three slits glow', glow(bldLog111(men(1))).length===3);
 const a=n=>parseFloat(glow(bldLog111(men(n)))[0].split(',')[3]);
 ok(`T96.D a full bunker glows brighter than one man (${a(1).toFixed(3)} -> ${a(BUNK_GAR).toFixed(3)})`, a(BUNK_GAR)>a(1)*1.3);
 // the periscope scans: its eye moves between ticks and comes back - a sweep, not a spin
 const xs=[],ys=[];for(let t=0;t<320;t+=10){G.tick=t;const log=bldLog111(empty);const i=log.findIndex(s=>s.indexOf('fill:#9fd8ff')===0);const e=log[i-1].split(':')[1].split(',');xs.push(parseFloat(e[0]));ys.push(parseFloat(e[1]));}
 ok('T96.D the periscope eye sweeps back and forth (a scan, not a spin: it revisits positions)', new Set(xs.map(x=>x.toFixed(1))).size>3 && new Set(xs.map(x=>x.toFixed(1))).size<xs.length && (Math.max(...xs)-Math.min(...xs))+(Math.max(...ys)-Math.min(...ys))>2.5);
}

/* ---------- E: the tower's spotlight is a night thing ---------- */
section('T96.E the Guard Tower\'s spotlight sweeps at night and is off by day');
{
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:660111});
 for(let i=0;i<12;i++)update(1/30);
 const cone=log=>log.some(s=>s.indexOf('fill:rgba(255,245,210,.5)')===0); // the lamp's hot core, painted only with the cone
 const turret=log=>log.some(s=>s.indexOf('fill:#1a1a1c')===0);            // the muzzle, painted always
 G.dayOff=0;ok('T96.E by day: turret yes, cone no', turret(bldLog111(stub111('guardtower'))) && !cone(bldLog111(stub111('guardtower'))) && !nightNow());
 G.dayOff=DAY_PHASES[2].t0*30;ok('T96.E at night: turret and cone', nightNow() && turret(bldLog111(stub111('guardtower'))) && cone(bldLog111(stub111('guardtower'))));
 const ang=t=>{G.tick=t;const log=bldLog111(stub111('guardtower'));const i=log.findIndex(s=>s.indexOf('fill:rgba(255,245,210,.5)')===0);return log.slice(0,i).filter(s=>s.indexOf('lineTo:')===0).pop()}; // the cone's far edge is the last lineTo before the lamp core
 ok('T96.E ...and it sweeps: the cone\'s far edge moves between ticks', ang(20)!==ang(60));
 G.dayOff=0;
 // testing mode is permanent noon (v101), so the sandbox never shows the cone
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:660111,test:true});
 G.dayOff=DAY_PHASES[2].t0*30;
 ok('T96.E testing mode is pinned to noon, so no cone there either', !cone(bldLog111(stub111('guardtower'))));
}

/* ---------- F: the Forward Pad - the windsock moved, the ring beats on a repair ---------- */
section('T96.F the Forward Pad: the sock is live and fills with the wind; the ring beats while repairing');
{
 const bb=bldBody.toString(),bl=bldLive.toString();
 ok('T96.F the sock\'s orange left the baked hull and lives in the overlay', bb.indexOf("#e8663a")<0 && bl.indexOf("#e8663a")>0);
 ok('T96.F the mast stays baked - it does not move', bb.indexOf('windsock MAST')>0);
 ok('T96.F the texture in the tree is the re-rendered one: the pad is a Blue exclusive with exactly one file, and it is embedded', 
    typeof IMG_B64==='object' && !!IMG_B64['bld_fwdpad_blue'] && !IMG_B64['bld_fwdpad_green']);
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:660111});
 for(let i=0;i<12;i++)update(1/30);
 // the sock's tip follows the breeze: find a strong and a slack tick and compare its reach
 const tip=t=>{G.tick=t;const log=bldLog111(stub111('fwdpad'));const i=log.findIndex(s=>s.indexOf('fill:#e8663a')===0);return Math.max(...log.slice(0,i).filter(s=>s.indexOf('lineTo:')===0).map(s=>parseFloat(s.split(':')[1])))};
 let hi=0,lo=0,hw=-2,lw=2;for(let t=0;t<600;t++){G.tick=t;const w=bldWind({id:3});if(w>hw){hw=w;hi=t}if(w<lw){lw=w;lo=t}}
 ok(`T96.F the sock reaches further in a gust than in a lull (wind ${hw.toFixed(2)} -> x ${tip(hi).toFixed(1)}; ${lw.toFixed(2)} -> ${tip(lo).toFixed(1)})`, tip(hi)>tip(lo)+3);
 // the repair ring, driven through the same filter updateBuilding's repair loop uses
 const p=G.human;const pad=makeBuilding('fwdpad',p,Math.floor(p.blds[0].tx)+8,Math.floor(p.blds[0].ty)+8,true);pad.prog=1;
 const ring=()=>bldLog111(pad).some(s=>s.indexOf('stroke:')===0&&s.indexOf('rgba(120,255,150')>0);
 ok('T96.F nothing on the pad: no ring', !ring());
 const h=makeUnit('heli',p,pad.x,pad.y);h.hp=h.mhp*.5;
 ok('T96.F a hurt friendly aircraft on the pad: the ring beats', ring());
 h.hp=h.mhp;ok('T96.F ...healed: it stops', !ring());
 h.hp=h.mhp*.5;h.x=pad.x+PAD_R+B.fwdpad.sz;ok('T96.F ...out of the pad\'s reach: it stops', !ring());
 h.x=pad.x;h.p=G.players.find(q=>q!==p);ok('T96.F ...an enemy aircraft on it: nothing', !ring());
 h.p=p;const j=makeUnit('jeep',p,pad.x,pad.y);j.hp=j.mhp*.5;h.hp=h.mhp;
 ok('T96.F ...a hurt jeep is not an aircraft: nothing (t.fly is the whole filter, as in the repair loop)', !ring());
 kill(h);kill(j);
}

/* ---------- G: one breeze ---------- */
section('T96.G bldWind is the one breeze every flag, the tarp and the sock read');
{
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:660111});
 let mn=2,mx=-2;for(let t=0;t<6000;t++){G.tick=t;const w=bldWind({id:5});mn=Math.min(mn,w);mx=Math.max(mx,w);}
 ok(`T96.G bounded in [-1,1] and actually swings (${mn.toFixed(2)}..${mx.toFixed(2)})`, mn>=-1&&mx<=1&&mn<-.6&&mx>.6);
 const bl=bldLive.toString();
 ok('T96.G the three old per-flag clocks are gone from bldLive', !/Math\.sin\(G\.tick\*\.1[12]\+b\.id\)\*2/.test(bl));
 ok('T96.G the wind is read ONCE at the head of bldLive and every branch that needs it reads that', (bl.match(/bldWind\(/g)||[]).length===1 && (bl.match(/\bwind\b/g)||[]).length>=8);
 // functional: the HQ's flag and the Command Post's flag lean the same way on the same tick
 const wv=(k,amp)=>{const log=bldLog111(stub111(k));const q=log.find(s=>s.indexOf('quadraticCurveTo:')===0);const m=log.find(s=>s.indexOf('moveTo:')===0);return (parseFloat(q.split(':')[1].split(',')[1])-parseFloat(m.split(':')[1].split(',')[1])-2)/amp};
 let agree=true;for(let t=0;t<200;t+=13){G.tick=t;if(Math.abs(wv('hq',2.5)-wv('cmdpost',2.2))>.01)agree=false;} // the log rounds to 2 decimals
 ok('T96.G the HQ and the Command Post flags read the same wind value on every tick sampled', agree);
}

/* ---------- H: the fixtures that already hand bldLive less than a building ---------- */
section('T96.H the manual\'s stub and a bare {key,sz,id} still paint every building');
{
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:660111});
 let err=null;
 try{for(const k of FACBLD111)for(const f of ['green','tan','gray','blue']){bldLog111({key:k,sz:B[k].sz,id:2},FAC[f].color);bldLog111({key:k,sz:B[k].sz,id:2,garrison:[],queue:[],prog:1,tface:0},FAC[f].color);}}catch(e){err=e}
 ok('T96.H a bare fixture (T8, T20.3, T30.B\'s shape) paints every building of every army'+(err?' ['+err.message+']':''), !err);
 err=null;const stubG={tick:7,orgX:0,neutral:null,human:null,units:[],blds:[]}; // INFO.stub's exact shape at v111
 try{for(const k of FACBLD111)bldLog111({key:k,sz:B[k].sz,id:1,prog:1},FAC.green.color,stubG);}catch(e){err=e}
 ok('T96.H the Field Manual\'s stub G (no units, no human) paints every building'+(err?' ['+err.message+']':''), !err);
 ok('T96.H INFO.stub is still that shape', INFO.stub.units.length===0 && INFO.stub.human===null && 'tick' in INFO.stub);
}

/* ---------- I: the smoke helper ---------- */
section('T96.I bldSmoke: deterministic puffs that rise, fade and lean with the wind');
{
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:660111});
 const run=(seed,wind)=>{const o=[];const base=document.createElement('canvas').getContext('2d');const c=new Proxy(base,{get(tt,k){if(k==='ellipse')return(...a)=>{o.push({x:a[0],y:a[1],r:a[2],a:parseFloat(String(tt.fillStyle).split(',')[3])})};const v=tt[k];return typeof v==='function'?v.bind(tt):v}});
  bldSmoke(c,10,-20,4,seed,{per:80,rise:20,wind:wind||0,a0:.3});return o};
 ok('T96.I same seed, same puffs; another seed, other puffs', JSON.stringify(run(3))===JSON.stringify(run(3)) && JSON.stringify(run(3))!==JSON.stringify(run(4)));
 const P=run(3);
 ok('T96.I four puffs, each at or above its chimney, each with alpha in (0,.3]', P.length===4 && P.every(q=>q.y<=-20+1e-9&&q.a>0&&q.a<=.3+1e-9));
 ok('T96.I the older a puff the bigger and fainter: radius and alpha run opposite ways', (()=>{const s=P.slice().sort((a,b)=>b.y-a.y);for(let i=1;i<s.length;i++)if(s[i].r<s[i-1].r-1e-9)return false;return true})());
 const lean=w=>run(3,w).reduce((s,q)=>s+q.x,0)/4;
 ok('T96.I a wind leans the column downwind', lean(1)>lean(0)+.5 && lean(-1)<lean(0)-.5);
}
