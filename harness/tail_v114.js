/* ============================================================================
   T99 - v114: FOUR GRAPHICAL UPGRADES TO THE v111 BUILDING ANIMATIONS
   The owner asked, playing v113, for: (1) a Guard Tower spotlight that is much
   bigger and actually lights the night in a cone; (2) much bigger, denser smoke
   on the Barracks, bigger still on the Garage and the Foundry, and both of those
   running continuously (the Garage's had been tied to its queue since v111);
   (3) every fluttering flag somewhat larger and more noticeable; (4) Blue's
   Wind Turbine 50% taller with 75% larger blades.

   What this file pins, and the shape of each claim:
   - A  the turbine: TURB_HUB_Y / TURB_BLADE carry the two ratios off the v111
        numbers (-40 and 19), the baked mast reaches the hub, the live rotor
        rides it, the bake box grew to hold it, and the embedded texture AND
        normal map measure the new box - the proof the pipeline was re-run.
   - B  the flags: one painter (bldFlag) for all three, FLAG_K on every call,
        each flag's reach measured off its own log against v111's, the sway
        scaled with it, and the dark edge that makes a green flag show on a
        green roof.
   - C  the smoke: puff counts and top radii per stack, the Foundry > Garage >
        Barracks order the owner asked for, the Garage's column present in
        EVERY state (idle, busy, under construction), and `dense` off by default
        so v111's callers and T96.I's fixture are untouched.
   - D  the spotlight: SPOT_L/SPOT_SP against v111's 44/.3; the cone recorded
        ONLY for a finished tower on a visible tile at night (not by day, not
        under construction, not under fog, not for a bare fixture); nightMask
        driven under a recorder (one sheet of the phase's tint, then every cone
        erased through destination-out); renderCore's tint pass reading the
        list; and the vision numbers untouched - this lights the PICTURE.
   - E  rule 2, for all of it: none of the new painters names the seeded
        stream, and painting a tower at night moves neither srand nor the hash.

   Rule 7 was paid three times before the first frame was right: the first cone
   (110px/.42) read as a modest patch, the first smoke (8/9/11 puffs, r1 9-13)
   read as a wisp because a LINEAR fade left the big old puffs transparent, and
   both were fixed by reading frames, not by changing a check. The numbers are
   pinned as floors relative to v111, not as exact values, so the next tuning
   pass edits the painter and not this file.
   ==========================================================================*/
section('T99 v114: the tower lights the night, the stacks smoke, the flags fly, the turbine grows');

const FS114=require('fs');
let HTML114=null;try{HTML114=FS114.readFileSync('pw.html','utf8')}catch(e){HTML114=null}
const SCRIPT114=HTML114?HTML114.slice(HTML114.indexOf('<script>'),HTML114.indexOf('</script>')):'';
const FACBLD114=Object.keys(B).filter(k=>!B[k].barr&&k!=='nest'&&!B[k].lvl);
const stub114=k=>({key:k,sz:B[k].sz,id:3,tface:.7,prog:1,garrison:[],queue:[]});
/* a recording context: every path op and every fill/stroke with its style
   (T94.D / T96's shape), for bldLive, bldBody and nightMask alike */
function ctxLog114(out){
 const base=document.createElement('canvas').getContext('2d');
 return new Proxy(base,{get(tt,k){
  if(k==='fill'||k==='stroke'||k==='fillRect'||k==='fillText'||k==='strokeRect'||k==='clearRect')return(...a)=>{out.push(k+':'+String(tt.fillStyle)+'|'+String(tt.strokeStyle)+'|'+a.map(v=>typeof v==='number'?v.toFixed(2):v).join(',')+'|a'+(+tt.globalAlpha).toFixed(3)+'|'+tt.globalCompositeOperation)};
  if(k==='moveTo'||k==='lineTo'||k==='arc'||k==='ellipse'||k==='quadraticCurveTo'||k==='closePath'||k==='rotate'||k==='translate')return(...a)=>{out.push(k+':'+a.map(v=>typeof v==='number'?v.toFixed(2):v).join(','))};
  const v=tt[k];return typeof v==='function'?v.bind(tt):v;}});
}
function liveLog114(b,col){const out=[];bldLive(ctxLog114(out),b,col||FAC.green.color);return out}
function bodyLog114(k,col){const out=[];bldBody(ctxLog114(out),k,col||FAC.blue.color,B[k].sz);return out}
const num114=(s,i)=>parseFloat(s.split(':')[1].split(',')[i]);

/* ---------- A: the Wind Turbine ---------- */
section('T99.A the Wind Turbine: 50% taller, 75% longer blades, re-rendered');
{
 const base=HH*.4; // the mast's foot, baseTopY in bldBody
 const hOld=base-(-40),hNew=base-TURB_HUB_Y;
 ok(`T99.A the mast is 50% taller than v111's (${hOld.toFixed(1)}px -> ${hNew.toFixed(1)}px, x${(hNew/hOld).toFixed(3)})`, Math.abs(hNew/hOld-1.5)<.02);
 ok(`T99.A each blade is 75% longer than v111's 19 (${TURB_BLADE}, x${(TURB_BLADE/19).toFixed(3)})`, Math.abs(TURB_BLADE/19-1.75)<.005);
 const body=bodyLog114('turbine');
 ok('T99.A the baked mast reaches the new hub (a lineTo at TURB_HUB_Y) and no longer stops at -40',
    body.some(s=>s.indexOf('lineTo:')===0&&num114(s,1)===TURB_HUB_Y) && !body.some(s=>s.indexOf('lineTo:')===0&&num114(s,1)===-40));
 ok('T99.A the flanges climb the whole mast now (one above -50)', body.some(s=>s.indexOf('moveTo:')===0&&num114(s,1)<-50&&num114(s,1)>TURB_HUB_Y));
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'blue',opp:1,seed:660114});
 const live=liveLog114(stub114('turbine'),FAC.blue.color);
 ok('T99.A the live rotor is translated to the hub the mast reaches', live.some(s=>s==='translate:0.00,'+TURB_HUB_Y.toFixed(2)));
 ok('T99.A ...and its three blades reach TURB_BLADE from the hub (two path corners and one trailing-edge line per blade: nine lineTo)', live.filter(s=>s.indexOf('lineTo:')===0&&num114(s,1)===-TURB_BLADE).length===9);
 ok('T99.A it still spins (a rotate per frame; two ticks paint two frames)', live.some(s=>s.indexOf('rotate:')===0) && (()=>{G.tick=10;const a=liveLog114(stub114('turbine')).join();G.tick=11;return a!==liveLog114(stub114('turbine')).join()})());
 ok(`T99.A the bake box grew with the mast: its top (${BLD_BOX.turbine[1]}) clears the hub by 8+`, BLD_BOX.turbine[1]<=TURB_HUB_Y-8 && BLD_BOX.turbine[1]<-54);
 /* the strongest form of "the texture was re-rendered": the embedded WebP and
    its normal map measure the NEW box at SS=4. The v113 files were 304x360;
    a stale pair would fail here whatever the painter says. (Header reader as
    T74.C's.) */
 function webpDims(b64){
  const b=Buffer.from(b64,'base64');
  for(let i=12;i<b.length-8;){
   const tag=b.toString('ascii',i,i+4),len=b.readUInt32LE(i+4);
   if(tag==='VP8 '){for(let j=i+8;j<i+24;j++)if(b[j]===0x9d&&b[j+1]===0x01&&b[j+2]===0x2a)return{w:b.readUInt16LE(j+3)&0x3fff,h:b.readUInt16LE(j+5)&0x3fff};return null;}
   if(tag==='VP8L'){const bits=b.readUInt32LE(i+9);return{w:1+(bits&0x3fff),h:1+((bits>>14)&0x3fff)};}
   if(tag==='VP8X')return{w:1+b.readUIntLE(i+12,3),h:1+b.readUIntLE(i+15,3)};
   i+=8+len+(len&1);
  }
  return null;
 }
 const bx=BLD_BOX.turbine,W=(bx[2]-bx[0])*SS,Hh=(bx[3]-bx[1])*SS;
 const di=typeof IMG_B64==='object'&&IMG_B64['bld_turbine_blue']?webpDims(IMG_B64['bld_turbine_blue']):null;
 const dn=typeof NRM_B64==='object'&&NRM_B64['bld_turbine_blue']?webpDims(NRM_B64['bld_turbine_blue']):null;
 ok(`T99.A the embedded texture measures the new box at SS=${SS} (${W}x${Hh}; got ${di&&di.w}x${di&&di.h})`, !!di&&di.w===W&&di.h===Hh);
 ok(`T99.A ...and so does its normal map (got ${dn&&dn.w}x${dn&&dn.h}) - the two passes share the grid`, !!dn&&dn.w===W&&dn.h===Hh);
 ok('T99.A the turbine is a Blue exclusive with exactly one texture, as before', !!IMG_B64['bld_turbine_blue'] && !IMG_B64['bld_turbine_green'] && !IMG_B64['bld_turbine_tan'] && !IMG_B64['bld_turbine_gray']);
 const db=SCRIPT114.slice(SCRIPT114.indexOf('function drawBld('),SCRIPT114.indexOf('function drawBld(')+6000);
 ok('T99.A the HP bar and the upgrade chevron sit above the taller rotor, not through it', (db.match(/k==='turbine'\?96/g)||[]).length===2);
}

/* ---------- B: the flags ---------- */
section('T99.B the flags: one painter, 1.45x, a dark edge, the sway scaled with them');
{
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:660114});
 for(let i=0;i<12;i++)update(1/30);
 ok(`T99.B FLAG_K is at least 1.4 (${FLAG_K})`, FLAG_K>=1.4);
 const bl=bldLive.toString();
 ok('T99.B the three flags are painted by bldFlag, each at a FLAG_K scale',
    /bldFlag\(c,col,mx,mtop,1,FLAG_K,/.test(bl) && /bldFlag\(c,col,px,ptop,-1,FLAG_K\*\.85,/.test(bl) && /bldFlag\(c,col,px,ptop,1,FLAG_K\*\.85,/.test(bl) && (bl.match(/bldFlag\(/g)||[]).length===3);
 ok('T99.B the v111 hand-copied pennant paths are gone from bldLive', !/quadraticCurveTo\(mx\+13,mtop\+2\+wv/.test(bl) && !/quadraticCurveTo\(px-10,ptop\+2\+wv/.test(bl) && !/quadraticCurveTo\(px\+11,ptop\+2\+wv/.test(bl));
 /* measured: the flag's REACH from its pole tip (the first moveTo) to the far
    end of its first curve, against what v111 painted (21, 17, 18 px) */
 const reach=k=>{const log=liveLog114(stub114(k));const m=log.find(s=>s.indexOf('moveTo:')===0);const q=log.find(s=>s.indexOf('quadraticCurveTo:')===0);return Math.abs(num114(q,2)-num114(m,0))};
 const old={hq:21,cmdpost:17,outpost:18};
 for(const k of ['hq','cmdpost','outpost'])ok(`T99.B the ${k} flag reaches ${reach(k).toFixed(1)}px off its pole, at least 1.4x v111's ${old[k]}`, reach(k)>=old[k]*1.4);
 ok('T99.B each flag carries the dark edge (a stroke) and the v111 highlight (a lighter fill)',
    ['hq','cmdpost','outpost'].every(k=>{const log=liveLog114(stub114(k));return log.some(s=>s.indexOf('stroke:')===0&&s.indexOf('rgba(20,16,12,.45)')>0)&&log.some(s=>s.indexOf('fill:rgba(255,255,255,.25)')===0&&s.indexOf('lighter')>0)}));
 /* the sway scaled with the flag: over 300 ticks the HQ flag's far corner
    rises and falls by FLAG_K times what v111's 2.5*wind swing gave it */
 let ys=[],wmn=2,wmx=-2;for(let t=0;t<300;t++){G.tick=t;const q=liveLog114(stub114('hq')).find(s=>s.indexOf('quadraticCurveTo:')===0);ys.push(num114(q,3));const w=bldWind({id:3});wmn=Math.min(wmn,w);wmx=Math.max(wmx,w);}
 const swing=Math.max(...ys)-Math.min(...ys),swing111=(wmx-wmn)*2.5;
 ok(`T99.B the HQ flag's sway is FLAG_K times v111's (${swing.toFixed(2)}px against ${swing111.toFixed(2)}, x${(swing/swing111).toFixed(3)})`, Math.abs(swing/swing111-FLAG_K)<.03);
 ok('T99.B the flag flies the way it did: the HQ\'s to the right of its mast, the Command Post\'s to the left',
    (()=>{const h=liveLog114(stub114('hq')),c=liveLog114(stub114('cmdpost'));const d=log=>num114(log.find(s=>s.indexOf('quadraticCurveTo:')===0),2)-num114(log.find(s=>s.indexOf('moveTo:')===0),0);return d(h)>0&&d(c)<0})());
}

/* ---------- C: the smoke ---------- */
section('T99.C the smoke: bigger and denser on the Barracks, bigger again on the Garage and the Foundry, both continuous');
{
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'tan',opp:1,seed:660114});
 for(let i=0;i<12;i++)update(1/30);G.tick=40;
 const col={barracks:'212,206,198',garage:'168,168,176',foundry:'150,140,132'};
 const puffs=(k,b)=>{const log=liveLog114(b||stub114(k),FAC.tan.color);const out=[];for(let i=0;i<log.length;i++)if(log[i].indexOf('fill:rgba('+col[k])===0){const e=log[i-1];if(e&&e.indexOf('ellipse:')===0)out.push({r:num114(e,2),a:parseFloat(log[i].split(',')[3])});}return out};
 const P={};for(const k in col)P[k]=puffs(k);
 // v111 painted 4 / 3 / 4 puffs with top radii 5.2 / 4.4 / 5.6
 ok(`T99.C the Barracks paints at least 24 smoke discs a frame (${P.barracks.length}; v111: 4)`, P.barracks.length>=24);
 ok(`T99.C the Garage at least 28 (${P.garage.length}; v111: 3, and only while busy)`, P.garage.length>=28);
 ok(`T99.C the Foundry at least 36 (${P.foundry.length}; v111: 4)`, P.foundry.length>=36);
 const top=k=>Math.max(...P[k].map(q=>q.r));
 ok(`T99.C the Barracks' biggest puff is at least 1.8x v111's 5.2 (${top('barracks').toFixed(1)})`, top('barracks')>=5.2*1.8);
 ok(`T99.C the owner's order: Foundry (${top('foundry').toFixed(1)}) > Garage (${top('garage').toFixed(1)}) > Barracks (${top('barracks').toFixed(1)})`, top('foundry')>top('garage')&&top('garage')>top('barracks'));
 ok('T99.C every disc is above its chimney and none is invisible', Object.keys(col).every(k=>P[k].every(q=>q.a>0)));
 // continuous: the Garage's column reads NO state - idle, busy, under construction all paint the same count
 const idle=puffs('garage'),busy=puffs('garage',Object.assign(stub114('garage'),{queue:['jeep','tank']})),half=puffs('garage',Object.assign(stub114('garage'),{queue:['jeep'],prog:.5}));
 ok(`T99.C the Garage smokes idle, busy and half-built alike (${idle.length}/${busy.length}/${half.length})`, idle.length===busy.length && busy.length===half.length && idle.length>0);
 const gsrc=bldLive.toString();const gi=gsrc.indexOf("k==='garage'"),gj=gsrc.indexOf('else if',gi+10);
 ok('T99.C ...because the Garage branch no longer reads b.queue at all (the work lamp is its only tell)', gi>0&&gj>gi&&gsrc.slice(gi,gj).indexOf('b.queue')<0);
 ok('T99.C the three stacks are the only callers that ask for a dense column', (gsrc.match(/dense:1/g)||[]).length===3);
 // `dense` is opt-in: v111's shape is exactly what a plain call gets (T96.I's fixture), and the dense fade is flatter
 const plain=[],densel=[];
 G.tick=64; // ph=.8 of an 80-tick life for the one puff of seed 0
 bldSmoke(ctxLog114(plain),10,-20,1,0,{per:80,rise:20,a0:.3});
 bldSmoke(ctxLog114(densel),10,-20,1,0,{per:80,rise:20,a0:.3,dense:1});
 const ell=log=>log.filter(s=>s.indexOf('ellipse:')===0).length, al=log=>parseFloat(log.find(s=>s.indexOf('fill:')===0).split(',')[3]);
 ok(`T99.C a plain call paints one disc per puff, a dense one paints two (${ell(plain)} / ${ell(densel)})`, ell(plain)===1&&ell(densel)===2);
 ok(`T99.C at 80% of a puff's life the dense fade keeps it ${(al(densel)/al(plain)).toFixed(2)}x as opaque as the linear one`, al(densel)>al(plain)*1.5);
}

/* ---------- D: the spotlight ---------- */
section('T99.D the Guard Tower\'s beam: bigger, and a hole in the night for a tower you can see');
{
 ok(`T99.D the cone is at least 2.2x v111's 44px and wider than its .3rad (${SPOT_L}px, ${SPOT_SP}rad)`, SPOT_L>=44*2.2 && SPOT_SP>=.4);
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:660114});
 for(let i=0;i<12;i++)update(1/30);
 const p=G.human,hq=p.blds[0];
 const tw=makeBuilding('guardtower',p,Math.floor(hq.tx)+5,Math.floor(hq.ty)+5,true);tw.prog=1;
 for(let i=0;i<3;i++)update(1/30); // the stamp sees it
 ok('T99.D fixture: the tower stands on a tile its owner can see', fogAt(tw.x,tw.y)===2);
 const cones=(b,day)=>{G.dayOff=day?0:DAY_PHASES[2].t0*30;NIGHT_CONES.length=0;liveLog114(b);const n=NIGHT_CONES.slice();NIGHT_CONES.length=0;return n};
 const c1=cones(tw,false);
 ok('T99.D at night a finished, visible tower records exactly one cone, at SPOT_L/SPOT_SP', c1.length===1 && c1[0].L===SPOT_L && c1[0].sp===SPOT_SP);
 ok('T99.D ...anchored on the lamp under its eave, in iso pixels off the tower\'s own centre', c1.length===1 && Math.abs(c1[0].x-(isoX(tw.x,tw.y)-B.guardtower.sz*HW*.6))<1e-9 && c1[0].y<isoY(tw.x,tw.y));
 ok('T99.D ...and the painted wedge is still there beside it (the lamp core T96.E reads)', liveLog114(tw).some(s=>s.indexOf('fill:rgba(255,245,210,.5)')===0));
 ok('T99.D by day: no cone', cones(tw,true).length===0);
 tw.prog=.4;ok('T99.D under construction: no cone', cones(tw,false).length===0);tw.prog=1;
 ok('T99.D a bare fixture with no position (the manual\'s and the old tails\' shape): no cone, no throw', cones(stub114('guardtower'),false).length===0);
 /* under fog: the same tower object, its tile marked explored-but-unseen, is a
    remembered ghost as far as the viewer is concerned - the v96 rule, light
    through fog is a wallhack, so nothing is recorded */
 const N=G.map.N,fi=Math.floor(tw.y)*N+Math.floor(tw.x),f0=G.fog[fi];
 G.fog[fi]=1;const cf=cones(tw,false);G.fog[fi]=f0;
 ok('T99.D under fog (fogAt 1): no cone', cf.length===0);
 ok('T99.D the sweep: the cone\'s angle moves between ticks', (()=>{G.tick+=20;const a=cones(tw,false)[0].a;G.tick+=40;const b=cones(tw,false)[0].a;G.tick-=60;return a!==b})());
 G.dayOff=0;
 /* nightMask under a recorder: NIGHT_CV is the module's scratch canvas; hand it
    a fake whose context records, feed two cones, and read what it drew */
 const mlog=[];const fake={width:0,height:0,getContext(){return ctxLog114(mlog)}};
 const saved=NIGHT_CV;NIGHT_CV=fake;
 NIGHT_CONES.length=0;NIGHT_CONES.push({x:100,y:80,a:1,L:SPOT_L,sp:SPOT_SP},{x:300,y:120,a:2,L:SPOT_L,sp:SPOT_SP});
 const ph=DAY_PHASES[2];const got=nightMask(ph,50,40,2);NIGHT_CONES.length=0;NIGHT_CV=saved;
 ok('T99.D nightMask answers its canvas, sized to the view', got===fake && fake.width===view.width && fake.height===view.height);
 const sheet=mlog.findIndex(s=>s.indexOf('fillRect:')===0&&s.indexOf(ph.tint)>0&&s.indexOf('source-over')>0);
 ok('T99.D it lays one opaque sheet of the phase\'s own tint first', sheet>=0 && mlog.slice(0,sheet).some(s=>s.indexOf('clearRect:')===0));
 const cuts=mlog.filter((s,i)=>i>sheet&&s.indexOf('fill:')===0&&s.indexOf('destination-out')>0);
 ok(`T99.D then erases each cone twice (a soft edge: full spread at .55, a narrower wedge at 1) - ${cuts.length} cuts for 2 cones`, cuts.length===4 && cuts.filter(s=>/\|a0\.550\|/.test(s)).length===2 && cuts.filter(s=>/\|a1\.000\|/.test(s)).length===2);
 ok('T99.D each wedge starts at the lamp, in screen pixels off the frame\'s camera ((x-cx)*z)', mlog.some(s=>s==='moveTo:100.00,80.00') && mlog.some(s=>s==='moveTo:500.00,160.00'));
 ok('T99.D a wedge is fanned in nine steps to a curved far edge', (()=>{const i=mlog.indexOf('moveTo:100.00,80.00');let n=0;for(let j=i+1;j<mlog.length&&mlog[j].indexOf('lineTo:')===0;j++)n++;return n===9})());
 /* renderCore reads the list: the tint pass multiplies by the mask when there
    are cones and by the v101 fillRect when there are none, under the same
    multiply and the same tintA - which is exactly what T78.D still pins */
 const rc=SCRIPT114.indexOf('function renderCore()'),fog=SCRIPT114.indexOf('c.drawImage(G.fogCv,0,0)',rc),present=SCRIPT114.indexOf('if(worldCv&&!glComposite())compositePost()',fog); // from the fog on, as T78.D does: the `!G` early-out above it carries the same call
 const pass=SCRIPT114.slice(rc,present);
 ok('T99.D renderCore clears the cone list at the top of the frame, before any building is drawn', pass.indexOf('NIGHT_CONES.length=0')>0 && pass.indexOf('NIGHT_CONES.length=0')<pass.indexOf('drawBld('));
 ok('T99.D the tint pass draws the mask when cones were recorded and the v101 fill otherwise, under one multiply and one tintA',
    /if\(NIGHT_CONES\.length\)c\.drawImage\(nightMask\(ph101,cx,cy,z\),0,0\);else c\.fillRect\(0,0,view\.width,view\.height\)/.test(pass) &&
    pass.indexOf("c.globalCompositeOperation='multiply';c.globalAlpha=ph101.tintA;c.fillStyle=ph101.tint;")<pass.indexOf('nightMask(ph101'));
 ok('T99.D the beam changes no vision number: NIGHT_VI_MUL is .5 and neither viOf nor bviOf knows the cone list',
    NIGHT_VI_MUL===0.5 && viOf.toString().indexOf('NIGHT_CONES')<0 && bviOf.toString().indexOf('NIGHT_CONES')<0 && nightVi.toString().indexOf('NIGHT_CONES')<0);
 ok('T99.D nothing simulated reads the cone list (update, hashState, fog stamping)', [update,hashState,updateUnit].every(f=>f.toString().indexOf('NIGHT_CONES')<0));
}

/* ---------- E: rule 2 for the new painters ---------- */
section('T99.E rule 2: the new painters never touch the seeded stream');
{
 const src=[bldFlag,bldSmoke,nightMask,nightWedge,bldLive].map(f=>f.toString()).join('\n');
 ok('T99.E none of bldFlag, bldSmoke, nightMask, nightWedge, bldLive names srand, rnd or Math.random', !/\bsrand\(|\brnd\(|Math\.random/.test(src));
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:660114});
 for(let i=0;i<12;i++)update(1/30);
 const p=G.human,hq=p.blds[0];const tw=makeBuilding('guardtower',p,Math.floor(hq.tx)+5,Math.floor(hq.ty)+5,true);tw.prog=1;
 for(let i=0;i<3;i++)update(1/30);
 G.dayOff=DAY_PHASES[2].t0*30;
 const r0=G.rngS,h0=hashState();
 for(const f of Object.keys(FAC).filter(f=>f!=='bug'))for(const k of FACBLD114)for(let t=0;t<40;t+=3){G.tick+=t;liveLog114(stub114(k),FAC[f].color);G.tick-=t;}
 for(let t=0;t<30;t+=5){G.tick+=t;liveLog114(tw);G.tick-=t;}
 const mlog=[];const fake={width:0,height:0,getContext(){return ctxLog114(mlog)}};const saved=NIGHT_CV;NIGHT_CV=fake;nightMask(DAY_PHASES[2],0,0,1);NIGHT_CV=saved;NIGHT_CONES.length=0;
 ok('T99.E painting every building of every army, the tower at night and the mask leaves srand() and the state hash where they were', G.rngS===r0&&hashState()===h0);
 G.dayOff=0;
}
