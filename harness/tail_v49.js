/* ================================================================================
   T30 - v49 BLACK-BUILDING FIX + TANK TURRET PORTRAITS

   Two cosmetic defects, both root-caused rather than papered over.

   1) shade() returned an 'rgb(r,g,b)' string, but the molded-plastic primitives
      (prism / hipRoof / gableRoof / plSphere / basePad) re-parse their colour via
      hx2rgb -> parseInt(hex.slice(1),16). On 'rgb(...)' that is NaN, and NaN
      collapses to 0 under the bitwise ops, so 18 call sites painted solid #000000
      where the source plainly asks for a team tint: every building's base pad, the
      HQ upper tier + dome, the barracks walls, the lab body + pod + dome, the
      garage roof, the helipad body + kiosk, the generator housing + vent grille,
      the guard tower platform + roof + turret dome, the radar cabin, the radio
      tower cabin, the bunker body and the barricade rivet. shade() now returns
      '#rrggbb'.

   2) The tank turret has been live-painted since v41 so continuous aim survives
      the bake, which means it never enters SPR.veh - and both portrait paths blit
      that cell and nothing else, so Tank and Bull showed a bare hull. The turret
      block is lifted into tankTurret() and composited over the hull by one shared
      portrait painter.

   A: 7 hash trails byte-identical to the pinned v48 baseline (a cosmetic release
      must not move the sim by one bit)
   B: shade() contract - hex out, channel values unchanged, round-trips through
      hx2rgb, no nested calls and no string surgery on its output anywhere
   C: FUNCTIONAL - sweep every building x faction (+ the barricade) and assert no
      molded primitive is ever handed a colour that parses to pure black
   D: tankTurret - extracted verbatim, team-coloured dome, drawUnit delegates, and
      the barrel still points where the tank fires (the v40 tracker, re-run through
      the new call path)
   E: vehPortraitBox - the hull box widened by the turret's real reach
   F: both portrait paths composite the turret; infantry crop untouched; the
      non-turret vehicles are left alone
   G: no sim impact - snapshot tag, nothing hashed, purity lint
   ================================================================================ */
'use strict';
section('T30 v49: black-building fix + tank turret portraits');

const DT49=1/30;
function cfg49(map,mode,seed,opp){return{map,mode,diff:'normal',fac:'green',opp:(opp==null?3:opp),seed}}
function trail49(c,ticks,every){
 G=null;newGame(c);const out=[];
 for(let i=1;i<=ticks;i++){update(DT49);if(i%every===0)out.push(hashState());}
 return out;
}

/* ---------- A: the sim did not move ---------- */
{
 // captured from v48 before the v49 splice, recut at v51 (which deliberately moves
 // damage and the AI roster). v49's own claim - that a cosmetic release moves
 // nothing - was proven when these passed unedited at v49 and v50.
 const BASE48_TRAILS={
   'backyard:dm:777001': [3293412590, 2461423061, 3957205849, 2528287706, 1952185461, 665163367, 2823446425, 3995879381, 3803286350, 3120541168],
   'kitchen:dm:777001': [1872578999, 837580001, 1989202208, 3499160605, 1529128538, 2042211323, 2591308390, 3722062316, 4228464786, 1908968521],
   'livingroom:dm:777001': [2913426327, 3356393458, 1174216244, 829982397, 1602384182, 2348484538, 354139607, 1998924496, 555977594, 4175332349],
   'sandbox:dm:777001': [1978777834, 1701269474, 2146965278, 567754851, 1150358789, 1637803272, 1036570413, 2202665817, 1300334593, 2694121166],
   'backyard:koth:424243': [3224089064, 3827145162, 2157130175, 2912573285, 1482540606, 3123444136, 3656076415, 2826814325, 1616512885, 3837895316],
   'kitchen:ctf:424243': [14089155, 187479418, 3230219255, 3216701545, 3168331133, 3276210501, 3176759258, 852631876, 1349482749, 1652411123],
   'desk:surv:424243': [2070519055, 861562454, 2812653578, 3214097862, 2113752728, 1990987303, 1502558590, 48537901, 1294703152, 417004470, 1391866811, 2494830455, 2429697125, 3365752735, 1521813210, 3183626869, 2899396261, 784753270, 2973116909, 898625446, 578963932, 3103189448, 1259373076, 3788096767, 816737279, 3356781271],
 };
 const COMBOS49=[
  ['backyard','dm',777001,3,900],
  ['kitchen','dm',777001,3,900],
  ['livingroom','dm',777001,3,900],
  ['sandbox','dm',777001,3,900],
  ['backyard','koth',424243,3,900],
  ['kitchen','ctf',424243,3,900],
  ['desk','surv',424243,1,2400]
 ];
 for(const [m,md,sd,opp,tk] of COMBOS49){
  const key=`${m}:${md}:${sd}`, want=BASE48_TRAILS[key], got=trail49(cfg49(m,md,sd,opp),tk,90);
  ok(`T30.A ${key} hash trail byte-identical to the v54 baseline`,
     !!want&&got.length===want.length&&got.every((v,i)=>v===want[i]));
 }
}

/* ---------- B: the shade() contract ---------- */
{
 const FACS49=['green','tan','gray','blue'];
 // every factor the codebase actually asks shade() for
 const FACTORS=[.42,.5,.55,.6,.62,.66,.68,.7,.74,.78,.8,.82,.85,.86,.9,.92,.96,1.04,1.05,1.06,1.1,1.12,1.14,1.25,1.3,1.32,1.35];
 let hexOK=true, valOK=true, blackOK=true, badV='';
 for(const f of FACS49){
  const col=FAC[f].color, b=hx2rgb(col);
  for(const k of FACTORS){
   const s=shade(col,k);
   if(!/^#[0-9a-f]{6}$/.test(s)){hexOK=false;badV=f+'@'+k+' -> '+s;continue}
   // the channel maths must be exactly what the old rgb() form produced, so every
   // fillStyle / strokeStyle site is pixel-identical to v48
   const want={r:clamp(Math.round(b.r*k),0,255),g:clamp(Math.round(b.g*k),0,255),b:clamp(Math.round(b.b*k),0,255)};
   const got=hx2rgb(s);
   if(got.r!==want.r||got.g!==want.g||got.b!==want.b){valOK=false;badV=f+'@'+k}
   // ...and the whole point: it must survive a round trip through hx2rgb
   if(got.r===0&&got.g===0&&got.b===0)blackOK=false;
  }
 }
 ok('T30.B shade() returns a 6-digit hex string'+(hexOK?'':' ('+badV+')'),hexOK);
 ok('T30.B shade() channel values are unchanged from the v48 rgb() form'+(valOK?'':' ('+badV+')'),valOK);
 ok('T30.B no faction x factor pair round-trips through hx2rgb to pure black',blackOK);
 // the old form must be gone, and nothing may depend on the string's shape
 const ssrc=shade.toString();
 ok('T30.B the rgb() template literal is gone from shade()',!ssrc.includes('rgb(${r}'));
 const all=[bldBody,bldLive,vehBody,drawBarricade,trooperBody,drawBld,drawUnit].map(f=>f.toString()).join('\n');
 ok('T30.B nobody nests shade() inside shade()',!all.includes('shade(shade('));
 ok('T30.B nobody does string surgery on a shade() result',
    !/shade\([^)]*\)\.(replace|slice|substring|split|match|indexOf)/.test(all));
}

/* ---------- C: FUNCTIONAL - no molded primitive is ever handed black ---------- */
{
 G=null;newGame(cfg49('backyard','dm',490100,1));
 const c=document.createElement('canvas').getContext('2d');
 const O={prism,hipRoof,gableRoof,plSphere,basePad};
 const bad=[]; let calls=0;
 const note=(fn,col)=>{
  calls++;
  const t=hx2rgb(String(col));
  if(t.r===0&&t.g===0&&t.b===0)bad.push(fn+'('+col+')');
 };
 prism    =function(cc,col,...a){note('prism',col);return O.prism(cc,col,...a)};
 hipRoof  =function(cc,col,...a){note('hipRoof',col);return O.hipRoof(cc,col,...a)};
 gableRoof=function(cc,col,...a){note('gableRoof',col);return O.gableRoof(cc,col,...a)};
 plSphere =function(cc,col,...a){note('plSphere',col);return O.plSphere(cc,col,...a)};
 basePad  =function(cc,col,...a){note('basePad',col);return O.basePad(cc,col,...a)};
 let drawErr=null;
 try{
  for(const f of ['green','tan','gray','blue']){
   /* v88: skips BOTH walls by the flag, and paints both through drawBarricade -
      the Heavy Barricade has no bldBody of its own either, and it reads t.hbarr to
      decide which silhouette to draw, so the stub has to carry a real `t`. */
   for(const k in B){
    if(B[k].barr)continue;
    bldBody(c,k,FAC[f].color,B[k].sz);
    bldLive(c,{key:k,sz:B[k].sz,id:3,tface:.7,prog:1,garrison:[]},FAC[f].color);
   }
   for(const wk of Object.keys(B).filter(k=>B[k].barr))
    drawBarricade(c,{key:wk,t:B[wk],p:{fac:f},prog:1},0,0);
  }
 }catch(e){drawErr=e}
 finally{prism=O.prism;hipRoof=O.hipRoof;gableRoof=O.gableRoof;plSphere=O.plSphere;basePad=O.basePad;}
 ok('T30.C the whole building set paints without error',!drawErr);
 ok('T30.C the sweep actually exercised the primitives ('+calls+' calls)',calls>150);
 ok('T30.C no molded primitive is handed a colour that parses to pure black'
    +(bad.length?' ('+bad.length+' sites, e.g. '+bad.slice(0,3).join(', ')+')':''),bad.length===0);
 // spot-check the four structures this release was reported against: their bodies
 // must resolve to a real tint of the faction colour, not a neutral
 const bodies=[];
 prism=function(cc,col,...a){bodies.push(col);return O.prism(cc,col,...a)};
 try{ for(const k of ['generator','guardtower','radar','radiotower'])bldBody(c,k,FAC.green.color,B[k].sz); }
 finally{ prism=O.prism; }
 const greeny=bodies.filter(col=>{const t=hx2rgb(String(col));return t.g>t.r&&t.g>t.b});
 ok('T30.C generator / guard tower / radar tent / radio tower read green for Green Army',
    bodies.length>=4&&greeny.length>=4);
}

/* ---------- D: tankTurret ---------- */
{
 ok('T30.D tankTurret exists and drawUnit delegates to it',
    typeof tankTurret==='function'&&drawUnit.toString().includes('tankTurret(c,u.key,col)'));
 ok('T30.D the turret geometry lives in exactly one place',
    !drawUnit.toString().includes("plSphere(c,col,-1,0,6.6,.82,false)"));

 // record the exact primitive sequence: it must be the v41 block verbatim
 function capture(key,col){
  const rec=[];
  const O={plSphere,plLimb,glint};
  const fake={_f:null,
   save(){},restore(){},beginPath(){},fill(){},
   ellipse(x,y,rx,ry){rec.push(['ellipse',fake._f,x,y,rx,ry])},
   get fillStyle(){return fake._f}, set fillStyle(v){fake._f=v}};
  plSphere=function(cc,c2,x,y,r,sq,seam){rec.push(['sphere',c2,x,y,r,sq,seam])};
  plLimb  =function(cc,c2,x1,y1,x2,y2,wd){rec.push(['limb',c2,x1,y1,x2,y2,wd])};
  glint   =function(cc,x,y,r){rec.push(['glint',x,y,r])};
  try{ tankTurret(fake,key,col) } finally { plSphere=O.plSphere;plLimb=O.plLimb;glint=O.glint }
  return rec;
 }
 const eq=(a,b)=>a.length===b.length&&a.every((v,i)=>Array.isArray(v)?eq(v,b[i]):v===b[i]);
 const tk=capture('tank','#4caf50');
 ok('T30.D tank turret = dome, barrel, muzzle cap, glint (v41 geometry verbatim)',
    eq(tk,[['sphere','#4caf50',-1,0,6.6,.82,false],
           ['limb','#2a2a30',3,0,18,0,3],
           ['ellipse','#15151a',18,0,1.4,1.8],
           ['glint',8,-1.4,.8]]));
 const bt=capture('bulltank','#d2b074');
 ok('T30.D the Bull keeps its longer, thicker barrel (19 / 3.6)',
    eq(bt,[['sphere','#d2b074',-1,0,6.6,.82,false],
           ['limb','#2a2a30',3,0,19,0,3.6],
           ['ellipse','#15151a',19,0,1.4,1.8],
           ['glint',8,-1.4,.8]]));
 ok('T30.D the dome takes the team colour, the barrel stays gunmetal',
    tk[0][1]==='#4caf50'&&bt[0][1]==='#d2b074'&&tk[1][1]==='#2a2a30');

 // behavioural: the v40 transform tracker, re-run through the extracted function.
 // The frame at the plLimb('#2a2a30') call IS the turret frame, so the local +x
 // axis must equal screenAng(the aim). This is the world render, unchanged.
 function tracker(){
  let M=[1,0,0,1,0,0]; const st=[]; const base=document.createElement('canvas').getContext('2d');
  const mul=(m,n)=>[m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1], m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3], m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]];
  const api={
   save(){st.push(M.slice()); base.save();},
   restore(){if(st.length)M=st.pop(); base.restore();},
   translate(x,y){M=mul(M,[1,0,0,1,x,y]);},
   rotate(a){M=mul(M,[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);},
   scale(x,y){M=mul(M,[x,0,0,y,0,0]);},
   _M(){return M;}
  };
  return new Proxy(base,{get(t,k){ if(k in api)return api[k]; const v=t[k]; return typeof v==='function'?v.bind(t):v; }});
 }
 const angClose=(a,b)=>{const d=Math.atan2(Math.sin(a-b),Math.cos(a-b));return Math.abs(d)<1e-6;};
 const origPlLimb=plLimb; let barrelDir=null;
 plLimb=function(c,col,x1,y1,x2,y2,wd){ if(col==='#2a2a30'&&c&&c._M){const M=c._M();barrelDir=Math.atan2(M[1],M[0]);} return origPlLimb(c,col,x1,y1,x2,y2,wd); };
 try{
  G=null;newGame(cfg49('backyard','dm',490300,1));
  const tank=makeUnit('tank',G.human,20,20);
  tank.target={x:30,y:24,hp:100,kind:'unit'};tank.face=0.3;tank.tface=1.0;tank.sel=false;tank.healedAt=null;
  tank.tvis=null; barrelDir=null; drawUnit(tracker(),tank);
  ok('T30.D barrel still points along the fire direction through the extracted call',
     barrelDir!==null&&angClose(barrelDir,screenAng(tank.tface)));
  tank.target=null; tank.tvis=null; barrelDir=null; drawUnit(tracker(),tank);
  ok('T30.D untargeted barrel still rests along the hull',
     barrelDir!==null&&angClose(barrelDir,screenAng(tank.face)));
 } finally { plLimb=origPlLimb; }
}

/* ---------- E: vehPortraitBox ---------- */
{
 const close=(a,b)=>Math.abs(a-b)<1e-9;
 // vehicles with no live turret are handed their bake box untouched
 let plainOK=true;
 for(const k of ['jeep','truck','medic','apc','heli','apache','chinook','arty','bike']){
  const bx=VEH_BOX[k],b=vehPortraitBox(k);
  if(!(close(b.x0,bx[0])&&close(b.y0,bx[1])&&close(b.x1,bx[2])&&close(b.y1,bx[3])))plainOK=false;
 }
 ok('T30.E non-turret vehicles keep their bake box exactly',plainOK);
 const t=vehPortraitBox('tank');
 ok('T30.E tank box widens to the barrel tip (16 -> 19.5), y and -x untouched',
    close(t.x0,-16)&&close(t.y0,-13)&&close(t.x1,19.5)&&close(t.y1,13));
 const bl=vehPortraitBox('bulltank');
 ok('T30.E Bull box widens by its 1.34 turret scale (22 -> 27.872)',
    close(bl.x0,-22)&&close(bl.y0,-17)&&close(bl.x1,20.8*1.34)&&close(bl.y1,17));
 ok('T30.E the widened box is strictly bigger than the hull box on both tanks',
    t.x1>VEH_BOX.tank[2]&&bl.x1>VEH_BOX.bulltank[2]);

 // the barrel tip must land inside the padded tile, not clipped at its edge
 for(const [k,Pz,pad] of [['tank',52,6],['tank',56,8],['bulltank',52,6],['bulltank',56,8]]){
  const b=vehPortraitBox(k),bw=b.x1-b.x0,bh=b.y1-b.y0;
  const s2=Math.min((Pz-pad)/bw,(Pz-pad)/bh);
  const ox=(Pz-bw*s2)/2-b.x0*s2;
  const tip=ox+b.x1*s2;
  ok(`T30.E ${k} barrel tip lands inside the ${Pz}px tile`,tip<=Pz+1e-9&&tip>=0);
 }
}

/* ---------- F: both portrait paths composite the turret ---------- */
{
 const pu=portraitURL.toString(), ip=infoPortraitCv.toString();
 ok('T30.F the in-game portrait tile routes vehicles through the shared painter',
    pu.includes('vehPortraitPaint(c,key,fac,P,6)'));
 ok('T30.F the field manual card routes vehicles through the same painter',
    ip.includes('vehPortraitPaint(c,key,fac,Pz,8)'));
 ok('T30.F the infantry head-and-torso crop is untouched in both paths',
    pu.includes('sh*=.62;sw*=.62;')&&ip.includes('sh*=.62;sw*=.62;'));

 if(!SPR.done)bakeSprites();
 ok('T30.F sprite cells are baked, so the portrait paths have a hull to blit',SPR.done===true);

 const O=tankTurret; const seen=[];
 tankTurret=function(c,key,col){seen.push([key,col]);return O(c,key,col)};
 let err=null;
 try{
  seen.length=0; infoPortraitCv('unit','tank','green');
  ok('T30.F the field manual tank card paints exactly one turret, in team colour',
     seen.length===1&&seen[0][0]==='tank'&&seen[0][1]===FAC.green.color);
  seen.length=0; infoPortraitCv('unit','bulltank','tan');
  ok('T30.F the Bull card paints its turret too',
     seen.length===1&&seen[0][0]==='bulltank'&&seen[0][1]===FAC.tan.color);
  seen.length=0; infoPortraitCv('unit','jeep','green'); infoPortraitCv('unit','arty','gray');
  infoPortraitCv('unit','heli','blue'); infoPortraitCv('unit','apc','green');
  ok('T30.F turretless vehicles (jeep / arty / heli / APC) get no turret',seen.length===0);
  seen.length=0; infoPortraitCv('unit','grunt','green');
  ok('T30.F infantry cards are unaffected',seen.length===0);
  // the in-game tile takes the same path (bypass the per-key cache)
  for(const k of Object.keys(PORTRAITS))delete PORTRAITS[k];
  seen.length=0; portraitURL('tank','green');
  ok('T30.F the in-game tank tile composites its turret as well',
     seen.length===1&&seen[0][0]==='tank');
  seen.length=0; portraitURL('jeep','green');
  ok('T30.F the in-game jeep tile does not',seen.length===0);
  for(const k of Object.keys(PORTRAITS))delete PORTRAITS[k];
 }catch(e){err=e}
 finally{ tankTurret=O; }
 ok('T30.F no portrait path throws'+(err?' ('+err.message+')':''),!err);

 // the painter is honest about an unbaked cell instead of drawing a half tile
 const save=SPR.veh.tank.green; SPR.veh.tank.green=null;
 let refused=false;
 try{ refused=vehPortraitPaint(document.createElement('canvas').getContext('2d'),'tank','green',56,8)===false }
 finally{ SPR.veh.tank.green=save }
 ok('T30.F vehPortraitPaint returns false when the hull cell is not baked',refused);
}

/* ---------- G: no sim impact ---------- */
{
 G=null;newGame(cfg49('backyard','dm',490900,1));
 for(let i=0;i<60;i++)update(DT49);
 const snap=JSON.parse(saveState());
 ok('T30.G the snapshot carries a v49-or-later tag',parseFloat(snap.v)>=49);
 const hs=hashState.toString();
 ok('T30.G none of the new names is hashed',
    !hs.includes('tankTurret')&&!hs.includes('TURR_PORTRAIT')&&!hs.includes('vehPortrait'));
 const BANNED49=['Math.random','Math.hypot','Math.pow','Date.now','performance.now','G.tick','srand('];
 const dirty=[];
 for(const [n,f] of [['tankTurret',tankTurret],['vehPortraitBox',vehPortraitBox],
                     ['vehPortraitPaint',vehPortraitPaint],['shade',shade]]){
  const s=f.toString();for(const b2 of BANNED49)if(s.includes(b2))dirty.push(n+' uses '+b2);
 }
 ok('T30.G the v49 paint helpers read nothing but their arguments'
    +(dirty.length?' ('+dirty.join('; ')+')':''),dirty.length===0);
 // a save written after the paint changes still resumes bit-identically
 const before=hashState();
 const json=saveState();
 const trailA=[];for(let i=1;i<=120;i++){update(DT49);if(i%30===0)trailA.push(hashState())}
 loadState(json);
 ok('T30.G load restores the exact pre-save hash',hashState()===before);
 const trailB=[];for(let i=1;i<=120;i++){update(DT49);if(i%30===0)trailB.push(hashState())}
 ok('T30.G the resumed trail is bit-identical',trailA.length===trailB.length&&trailA.every((v,i)=>v===trailB[i]));
}
