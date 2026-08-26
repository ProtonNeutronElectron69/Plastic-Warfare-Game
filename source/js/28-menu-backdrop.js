/* ==================== MENU BACKDROP (MENUBG) ====================
   A decorative isometric floor with four ranks of troops marching across it,
   painted behind the setup screen. Pure UI/render layer:

   - It only paints while #setup is displayed, which is exactly when G is null.
     During a match the canvas is display:none and the loop returns immediately.
   - It bakes its own small roster with bakeCell and keeps the cells in a
     private cache. It never writes SPR and never sets SPR.done, so the real
     bake path (bakeSprites, called at match start and by the Field Manual) is
     untouched and still does the full 288-cell table exactly once, later.
     The menu roster is 56 cells, ~19% of that, and it is deferred to an idle
     callback so the floor paints on the first frame.
   - Its rng is a private mulberry stream, never the sim's.
   - Painting a trooper mirrors drawUnit's infantry branch (baked body cell,
     then trooperGear on top at the same gear scale) rather than calling
     drawUnit, because drawUnit reads SPR and would fall back to the live
     drawTrooper path while SPR is still empty. The call is wrapped in
     infoStub anyway, so any G read inside the painters sees the stub and G is
     restored in a finally within the same synchronous callback.
   Nothing here is hashed, serialized, or reachable from the sim step. */
const MENUBG={cv:null,c:null,cells:{inf:{},veh:{}},lanes:[],tile:null,pat:null,
 ready:false,W:0,H:0,dpr:1,t0:0};
const MENUBG_RM=(typeof matchMedia==='function')&&matchMedia('(prefers-reduced-motion: reduce)').matches;
/* faction-exclusive units stay with their home army, same rule the manual uses */
const MENUBG_LANES=[
 {y:.20,s:.90,v:.010,fac:'gray', roster:['grunt','gunner','sniper'],       n:5},
 {y:.41,s:1.15,v:.014,fac:'tan',  roster:['grunt','bazooka','flamer'],     n:5},
 {y:.63,s:1.50,v:.020,fac:'green',roster:['grunt','gunner','sarge'],       n:4},
 {y:.83,s:1.85,v:.028,fac:'blue', roster:['grunt','bazooka','tank'],       n:3}
];
function menubgRng(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
/* private roster bake: bakeCell only, SPR untouched */
function menubgBake(){
 if(MENUBG.ready)return;
 for(const L of MENUBG_LANES){
  const col=FAC[L.fac].color;
  for(const key of L.roster){
   if(U[key].a==='inf'){
    if(!MENUBG.cells.inf[key])MENUBG.cells.inf[key]={};
    if(MENUBG.cells.inf[key][L.fac])continue;
    const set=[];
    for(let i=0;i<5;i++){const bob=i*.5-1;set.push(bakeCell(-22,-31,22,10,cc=>trooperBody(cc,key,col,bob)));}
    MENUBG.cells.inf[key][L.fac]=set;
   }else{
    if(!MENUBG.cells.veh[key])MENUBG.cells.veh[key]={};
    if(MENUBG.cells.veh[key][L.fac])continue;
    const bx=VEH_BOX[key]||[-24,-16,24,16];
    MENUBG.cells.veh[key][L.fac]=bakeCell(bx[0],bx[1],bx[2],bx[3],cc=>vehBody(cc,key,col));
   }
  }
 }
 menubgColumn();
 MENUBG.ready=true;
}
/* the marching ranks: fixed layout from a private stream, so the scene is the
   same every time the menu opens */
function menubgColumn(){
 const r=menubgRng(0x9ab3);
 MENUBG.lanes.length=0;
 for(const L of MENUBG_LANES){
  const men=[];
  for(let i=0;i<L.n;i++){
   const key=L.roster[(r()*L.roster.length)|0];
   const t=U[key];
   men.push({key:key,t:t,fac:L.fac,id:3+i*2,off:i*(200+r()*90),
    u:{kind:'unit',key:key,t:t,p:{fac:L.fac,human:false},x:0,y:0,face:0,id:3+i*2,
       hp:t.hp,mhp:t.hp,sel:false,vr:0,hold:false,rot:0,flash:0,mining:false,cargo:0,
       path:[1],wp:0,healedAt:null,target:null,tface:0,garrison:[],entrenched:false}});
  }
  MENUBG.lanes.push({y:L.y,s:L.s,v:L.v,men:men});
 }
}
/* one floor diamond at 3x the board tile; the lattice repeats exactly every
   DW x DH, so createPattern('repeat') has no seam */
function menubgFloor(){
 if(MENUBG.tile)return MENUBG.tile;
 const DW=TW*3,DH=TH*3,A='#3d6b34',B2='#335a2c';
 const cv=document.createElement('canvas');cv.width=DW;cv.height=DH;
 const c=cv.getContext('2d');
 const dia=(x,y,f)=>{c.fillStyle=f;c.beginPath();c.moveTo(x,y-DH/2);c.lineTo(x+DW/2,y);c.lineTo(x,y+DH/2);c.lineTo(x-DW/2,y);c.closePath();c.fill()};
 c.fillStyle=A;c.fillRect(0,0,DW,DH);
 dia(DW/2,DH/2,B2);dia(0,0,A);dia(DW,0,A);dia(0,DH,A);dia(DW,DH,A);
 const cent=[[DW/2,DH/2],[0,0],[DW,0],[0,DH],[DW,DH]];
 for(const d of cent){                       // bevel facets, as renderTerrain does per tile
  c.save();c.beginPath();
  c.moveTo(d[0],d[1]-DH/2);c.lineTo(d[0]+DW/2,d[1]);c.lineTo(d[0],d[1]+DH/2);c.lineTo(d[0]-DW/2,d[1]);
  c.closePath();c.clip();
  c.fillStyle='rgba(255,255,255,.07)';
  c.beginPath();c.moveTo(d[0],d[1]-DH/2);c.lineTo(d[0]-DW/2,d[1]);c.lineTo(d[0],d[1]);c.closePath();c.fill();
  c.fillStyle='rgba(10,18,7,.11)';
  c.beginPath();c.moveTo(d[0],d[1]+DH/2);c.lineTo(d[0]+DW/2,d[1]);c.lineTo(d[0],d[1]);c.closePath();c.fill();
  c.restore();
 }
 c.strokeStyle='rgba(16,30,11,.30)';c.lineWidth=1.4;
 for(const d of cent){
  c.beginPath();
  c.moveTo(d[0],d[1]-DH/2);c.lineTo(d[0]+DW/2,d[1]);c.lineTo(d[0],d[1]+DH/2);c.lineTo(d[0]-DW/2,d[1]);
  c.closePath();c.stroke();
 }
 const r=menubgRng(0x4411);
 for(let i=0;i<900;i++){
  c.fillStyle=r()<.5?'rgba(214,240,150,.10)':'rgba(22,42,14,.12)';
  c.fillRect(r()*DW,r()*DH,1.5,1.5);
 }
 MENUBG.tile=cv;return cv;
}
/* mirrors drawUnit's infantry / vehicle branches against the private cache */
function menubgPaint(c,m,tick){
 const col=FAC[m.fac].color,ang=screenAng(0);
 const moving=true,bob=Math.sin(tick*.6+m.id*2);
 if(m.t.a==='inf'){
  const set=MENUBG.cells.inf[m.key]&&MENUBG.cells.inf[m.key][m.fac];
  if(!set)return;
  const fr=set[Math.max(0,Math.min(4,Math.round((bob+1)*2)))];
  try{skewSil(c,fr,0,1,2,.62,.42,.30);contactShadow(c,0,1.5,8.5,4,.24);}catch(e){}
  c.drawImage(fr.cv,-fr.ax,-fr.ay,fr.w,fr.h);
  const gs=m.key==='sarge'?1.18:(m.key==='gunner'?1.16:1);
  c.save();if(gs!==1)c.scale(gs,gs);c.translate(0,bob*.9);
  try{trooperGear(c,m.u,col,ang)}catch(e){}
  c.restore();
 }else{
  const cell=MENUBG.cells.veh[m.key]&&MENUBG.cells.veh[m.key][m.fac];
  if(!cell)return;
  try{offsetSil(c,cell,0,0,.26,ang);contactShadow(c,0,1,14,6,.16);}catch(e){}
  c.rotate(ang);
  c.drawImage(cell.cv,-cell.ax,-cell.ay,cell.w,cell.h);
 }
}
function menubgResize(){
 MENUBG.dpr=Math.min(window.devicePixelRatio||1,2);
 MENUBG.W=innerWidth;MENUBG.H=innerHeight;
 MENUBG.cv.width=Math.max(1,MENUBG.W*MENUBG.dpr|0);
 MENUBG.cv.height=Math.max(1,MENUBG.H*MENUBG.dpr|0);
 MENUBG.pat=null;
}
function menubgFrame(t){
 requestAnimationFrame(menubgFrame);
 const setup=document.getElementById('setup');
 const on=setup.style.display!=='none'&&!document.hidden;
 const want=on?'block':'none';
 if(MENUBG.cv.style.display!==want)MENUBG.cv.style.display=want;
 if(!on)return;
 if(MENUBG.W!==innerWidth||MENUBG.H!==innerHeight)menubgResize();
 const c=MENUBG.c,W=MENUBG.W,H=MENUBG.H;
 const ms=MENUBG_RM?0:(t-MENUBG.t0);
 c.setTransform(MENUBG.dpr,0,0,MENUBG.dpr,0,0);
 c.clearRect(0,0,W,H);
 // floor: cover-scaled so the tile is cropped, never letterboxed
 const DW=TW*3,DH=TH*3;
 if(!MENUBG.pat)MENUBG.pat=c.createPattern(menubgFloor(),'repeat');
 const s=Math.max(.55,Math.min(1.7,Math.max(W/1500,H/860)));
 const dx=-((ms*.014)%DW),dy=-((ms*.007)%DH);
 c.save();c.scale(s,s);c.translate(dx,dy);
 c.fillStyle=MENUBG.pat;c.fillRect(-dx,-dy,W/s+2,H/s+2);c.restore();
 // the ranks
 if(MENUBG.ready){
  const tick=ms*.03,zoom=Math.max(.75,Math.min(1.35,H/860));
  infoStub(()=>{
   INFO.stub.tick=tick;INFO.stub.orgX=0;
   for(const L of MENUBG.lanes){
    const y=H*L.y,sc=L.s*zoom;
    for(const m of L.men){
     const span=W+700,x=((ms*L.v+m.off)%span)-350;
     c.save();c.translate(x,y+(x-W/2)*.045);c.scale(sc,sc);
     menubgPaint(c,m,tick+m.off*.01);
     c.restore();
    }
   }
  });
 }
 // depth haze sits ON TOP of the ranks so a rank and its shadow recede together
 const hz=c.createLinearGradient(0,0,0,H);
 hz.addColorStop(0,'rgba(20,34,14,.42)');hz.addColorStop(.42,'rgba(20,34,14,.14)');
 hz.addColorStop(.75,'rgba(12,20,8,.10)');hz.addColorStop(1,'rgba(6,12,4,.34)');
 c.fillStyle=hz;c.fillRect(0,0,W,H);
 const vg=c.createRadialGradient(W/2,H*.46,Math.min(W,H)*.18,W/2,H*.46,Math.max(W,H)*.78);
 vg.addColorStop(0,'rgba(6,12,4,.04)');vg.addColorStop(1,'rgba(4,8,3,.46)');
 c.fillStyle=vg;c.fillRect(0,0,W,H);
}
function menubgInit(){
 const cv=document.createElement('canvas');cv.id='menuBg';
 document.body.insertBefore(cv,document.body.firstChild);
 MENUBG.cv=cv;MENUBG.c=cv.getContext('2d');MENUBG.t0=performance.now();
 addEventListener('resize',menubgResize);
 menubgResize();
 // the floor paints on frame 1; the roster bake is deferred so it never
 // stalls first paint. It is ~19% of the full table and does not pre-empt
 // bakeSprites, which still runs in full at match start.
 const bake=()=>{try{menubgBake()}catch(e){}};
 if(window.requestIdleCallback)requestIdleCallback(bake,{timeout:600});else setTimeout(bake,80);
 requestAnimationFrame(menubgFrame);
}
menubgInit();
applyHelpTune(); // v43: fill the help panel's tuning slots from the constants
/* v91: start fetching assets the moment the page is up, and do not wait for it.
   The player still has to choose an army, a map and a mode, which is many
   seconds; the Start button awaits this same promise and normally finds it
   already settled. Deliberately fire-and-forget - assetsLoad never rejects, and
   a missing file falls back to the procedural painter it always used.
   v95: one thing does wait on it - if the sprite bake ran before the textures
   arrived (the field manual can bake from this very menu), re-bake once. */
assetsLoad().then(rebakeIfAssetsLate);
requestAnimationFrame(frame);
