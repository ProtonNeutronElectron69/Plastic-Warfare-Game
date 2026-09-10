/* tail_v62.js - T41: v62 cleanup & organization pass.

   A cleanup release is accepted on the opposite criterion to a feature release:
   the simulation must NOT move. Every baseline in section A was captured from the
   v61 build BEFORE the first splice edit was applied, and there is no repin
   script for this version.

   A: hash trails and map layouts byte-identical to v61.
   B: the dead tracer path is gone at BOTH ends (emitter and renderer branch).
   C: groundLay lays one flat diamond per tile for both call sites (v108: it
      replaced paintIsoTile's bevelled five-fill recipe - see the section).
   D: researchBtn reproduces both of refreshSelPanel's research buttons.
   E: lobSetRosBlock builds the settings + roster block for host and joiner alike.
   F: the FILE MAP lint - every banner in the file is listed, in file order.
   G: the dead markup attributes are gone from the shipped HTML.
   H: the inline vNN: rationale tags were NOT stripped (they carry reasons). */
'use strict';
section('T41 v62: cleanup invariants (behaviour must be identical to v61)');

const BASE62_TRAILS={
  'backyard:dm:777001': [1515676257, 165486437, 3355209706, 307931379, 3469908852, 2596614895, 4026906415, 931758810, 712894804, 3720597298],
  'kitchen:dm:777001': [2890359925, 1330923109, 451641286, 1243176532, 3659745016, 2486020441, 3957077144, 2167310674, 608930249, 3428702616],
  'livingroom:dm:777001': [229500654, 3558171612, 2812525452, 1515811891, 2622156177, 1801311481, 3220563691, 3090632170, 773498396, 1754469101],
  'sandbox:dm:777001': [3275217460, 2006985737, 1147318609, 162116778, 951108797, 1234464264, 2707818317, 3454278149, 3150926458, 3002183509],
  'backyard:koth:424243': [58317665, 417127194, 1327297953, 2257218133, 627003083, 2765423602, 3688871589, 3674700629, 2673181113, 2791613702],
  'kitchen:ctf:424243': [1769106723, 1168064908, 42614749, 2524250675, 1233927814, 1024424038, 1414950428, 3038457653, 1784031669, 3823528324],
  'desk:surv:424243': [4029245739, 846628268, 1499610264, 166830090, 4278902712, 1151672611, 2437056179, 3740070770, 3708062566, 272353999, 264396664, 792212187, 2878701123, 4265448520, 3379214677, 3285736877, 1399457658, 1593250578, 661497634, 2452056279, 3798300502, 4202550933, 2118276398, 2840993318, 1942491689, 1779408945],
};
const BASE62_LAYOUTS={"backyard:11":3719591816,"backyard:22":2665054439,"backyard:33":814280462,"kitchen:11":1830907213,"kitchen:22":1100648813,"kitchen:33":3384451753,"livingroom:11":1200028708,"livingroom:22":777729041,"livingroom:33":150908887,"sandbox:11":1922029737,"sandbox:22":4201466035,"sandbox:33":1831729735,"desk:11":4049871548,"desk:22":864639349,"desk:33":3041133605};
/* ---------- A: BEHAVIOUR EQUALITY vs v61 (the point of the release) ---------- */
const DT62=1/30;
function cfg62(map,mode,seed,opp){return{map,mode,diff:'normal',fac:'tan',opp:(opp==null?3:opp),seed}}
function layoutHash62(){
 let h=2166136261;
 const P=G.map.pass;for(let i=0;i<P.length;i++)h=hI(h,P[i]);
 for(const n of G.map.nodes){h=hF(h,n.x);h=hF(h,n.y);h=hS(h,n.t);h=hF(h,n.amt)}
 for(const s of G.map.starts){h=hF(h,s.x);h=hF(h,s.y)}
 for(const ns of (G.map.nests||[])){h=hF(h,ns.x);h=hF(h,ns.y)}
 for(const pr of (G.map.props||[])){h=hF(h,pr.x);h=hF(h,pr.y);h=hS(h,pr.t)}
 return h>>>0;
}
function trail62(c,ticks,every){
 G=null;newGame(c);const out=[];
 for(let i=1;i<=ticks;i++){update(DT62);if(i%every===0)out.push(hashState());}
 return out;
}
const COMBOS62=[
 ['backyard','dm',777001,3,900],
 ['kitchen','dm',777001,3,900],
 ['livingroom','dm',777001,3,900],
 ['sandbox','dm',777001,3,900],
 ['backyard','koth',424243,3,900],
 ['kitchen','ctf',424243,3,900],
 ['desk','surv',424243,1,2400]
];
for(const [m,md,sd,opp,tk] of COMBOS62){
 const key=`${m}:${md}:${sd}`, want=BASE62_TRAILS[key], got=trail62(cfg62(m,md,sd,opp),tk,90);
 ok(`T41.A ${key} hash trail byte-identical to the v61 baseline`,
    !!want&&want.length===got.length&&want.every((v,i)=>v===got[i]));
}
for(const m of ['backyard','kitchen','livingroom','sandbox','desk'])for(const sd of [11,22,33]){
 G=null;newGame(cfg62(m,m==='desk'?'surv':'dm',sd,m==='desk'?1:3));
 ok(`T41.A layout ${m}:${sd} unchanged`,layoutHash62()===BASE62_LAYOUTS[`${m}:${sd}`]);
}
/* non-vacuity: the comparison above must be capable of failing */
{
 const t=trail62(cfg62('backyard','dm',777001,3),90,90);
 ok('T41.A the trail comparison is not vacuous',
    t.length===1 && t[0]!==0 && t[0]!==BASE62_TRAILS['kitchen:dm:777001'][0]);
}

/* ---------- B: the dead tracer path is gone at both ends ---------- */
section('T41.B dead code: the tracer emitter and its particle type');
ok('T41.B tracer() no longer exists',typeof tracer==='undefined');
ok('T41.B tracer2() is untouched and still the live bullet streak',typeof tracer2==='function');
{
 /* Functional, not source-text: boot a match, fire everything that can fire for
    a while, and prove no particle of type 'tr' is ever produced. If something
    resurrected the emitter this catches it even if the source looks clean. */
 G=null;newGame(cfg62('backyard','dm',777001,3));
 let sawTr=0,sawTr2=0,seen=0;
 for(let i=1;i<=1800;i++){
  update(DT62);
  for(const p of G.parts){seen++;if(p.t==='tr')sawTr++;if(p.t==='tr2')sawTr2++;}
 }
 ok('T41.B no particle of type tr is ever emitted',sawTr===0);
 ok('T41.B the particle stream is non-empty, so the scan is not vacuous',seen>0);
 ok('T41.B tr2 streaks ARE still emitted (the live path survived)',sawTr2>0);
 ok('T41.B the renderer carries no tr branch',
    !/p\.t===['"]tr['"]/.test(renderCore.toString()));
}

/* ---------- C: groundLay ---------- */
/* v108: A CONSCIOUS REWRITE, not a repin. Through v107 this section pinned
   paintIsoTile's five-fill recipe - a diamond and four bevel facets per tile -
   and that recipe IS the molded-plastic look the owner asked to lose: every
   board's floor read as a sheet of bevelled diamonds. The painter is deleted,
   not loosened; the seam it guarded (one ground recipe, two call sites - the
   board's bake and the Field Manual's swatch) survives as groundLay, and this
   section states the same claim against it: one FLAT diamond per tile, no
   facets, full-tile geometry derived off the constants, both callers reaching
   it and neither inlining a tile of its own. tail_v108.js carries the material
   itself. */
section('T41.C groundLay: one ground recipe, two call sites');
function recGround(){ // a path-and-colour recorder over the shim's own permissive context
 const base=document.createElement('canvas').getContext('2d');
 const trace=[];let cur=null,fill='';
 const c=new Proxy(base,{get(t,k){
   if(k==='beginPath')return()=>{cur=[]};
   if(k==='moveTo'||k==='lineTo')return(x,y)=>{if(cur)cur.push([x,y])};
   if(k==='closePath')return()=>{};
   if(k==='fill')return()=>{if(cur&&cur.length)trace.push({pts:cur.slice(),col:fill})};
   const v=t[k];return typeof v==='function'?v.bind(t):v;},
  set(t,k,v){if(k==='fillStyle')fill=typeof v==='string'?v:'';t[k]=v;return true}});
 return {c,trace};
}
{
 const eq=(a,b)=>a.length===b.length&&a.every((p,i)=>Math.abs(p[0]-b[i][0])<1e-9&&Math.abs(p[1]-b[i][1])<1e-9);
 const lay=(th)=>{const r=recGround();groundLay(r.c,th,2,mulberry(1),100,50,7);return r.trace};
 const t=lay('grass');
 const diamonds=t.filter(p=>p.pts.length===4&&/^#[0-9a-f]{6}$/i.test(p.col));
 ok('T41.C one flat diamond per tile, and NO bevel facets: the molded look is gone (v108)',
    diamonds.length===4 && !t.some(p=>p.pts.length===3));
 /* geometry, derived from the tile constants rather than restated as literals:
    tile (0,0) sits on the origin the caller passes, tile (1,0) one tile east */
 ok('T41.C the diamond spans the full tile',
    eq(diamonds[0].pts,[[100,50],[100+HW,50+HH],[100,50+TH],[100-HW,50+HH]]));
 ok('T41.C the second tile lands exactly one tile over',
    eq(diamonds[1].pts,[[100+HW,50+HH],[100+2*HW,50+2*HH],[100+HW,50+HH+TH],[100,50+2*HH]]));
 /* non-vacuity: a different theme paints the same geometry in its own palette */
 const s=lay('sand').filter(p=>p.pts.length===4&&/^#[0-9a-f]{6}$/i.test(p.col));
 ok('T41.C another theme lays the same four tiles in a different palette',
    s.length===4 && eq(s[0].pts,diamonds[0].pts) && s[0].col!==diamonds[0].col);
 ok('T41.C the bevel recipe is deleted from the shipped file, not orphaned',
    (()=>{const src=require('fs').readFileSync('pw.html','utf8');return !src.includes("'rgba(14,22,10,.12)'")&&!src.includes('paintIsoTile(')})());
}
{
 const rt=renderTerrain.toString(), ig=infoGround.toString();
 ok('T41.C renderTerrain lays its ground and its edge through the shared painters and inlines no tile of its own',
    rt.includes('groundLay(c,th,N,rnd,G.orgX,0,') && rt.includes('groundSkirt(c,th,N,rnd,G.orgX,0,DEPTH)') && !rt.includes('lineTo(sx+HW,sy+HH);c.lineTo(sx,sy+TH)'));
 ok('T41.C infoGround does the same at miniature scale, and inlines no tile of its own',
    ig.includes("groundLay(c,'grass',NP,rnd,ox,oy,") && ig.includes("groundSkirt(c,'grass',NP,rnd,ox,oy,INFO_G_DEPTH)") && !ig.includes('lineTo('));
 /* and both still run end to end under the shim */
 G=null;newGame(cfg62('backyard','dm',777001,3));
 let ranT=true,ranI=true;
 try{renderTerrain()}catch(e){ranT=false}
 try{INFO.ground=null;infoGround()}catch(e){ranI=false}
 ok('T41.C renderTerrain still completes',ranT);
 ok('T41.C infoGround still completes and caches its canvas',ranI&&!!INFO.ground);
}

/* ---------- D: researchBtn ---------- */
section('T41.D researchBtn: one builder, two offer sites');
{
 G=null;newGame(cfg62('backyard','dm',777001,3));
 const p=G.players[0];
 const key=researchCatalog(p)[0];
 const e={id:1,p,key:'lab',t:B.lab||{},techCur:null,techT:0,queue:[]};
 const tail=' — ~9s';
 const bt=researchBtn(e,key,tail);
 /* v71: researchBtn returns a sprite tile. State classes ride alongside the base
    class in a real browser, so compare the base rather than the whole string. */
 ok('T41.D returns a .tl tile',!!bt&&bt.className.split(' ')[0]==='tl');
 ok('T41.D the label carries the icon, name and both costs',
    bt.innerHTML.includes(RESEARCH[key].name) &&
    bt.innerHTML.includes('cp')&&bt.innerHTML.includes('ce'));
 ok('T41.D the tooltip is description + the caller tail + the counter tip',
    bt.title.startsWith(RESEARCH[key].d) && bt.title.includes(tail));
 /* the two call sites pass different tails, and both must survive verbatim */
 const rs=refreshSelPanel.toString();
 /* v73 gave researchBtn a fourth argument, so pinning the whole call verbatim
    was pinning the arity as well as the thing under test. What this check owns is
    that the two sites pass DIFFERENT tails and that each tail survives word for
    word, so it stops at the comma. */
 ok('T41.D the lab site passes the bare time clause',
    rs.includes('researchBtn(e,key,` — ~${researchTime(e,key)|0}s`,'));
 ok('T41.D the per-building site passes the longer clause',
    rs.includes('researchBtn(e,key,` — ~${researchTime(e,key)|0}s, runs while you keep producing`,'));
 ok('T41.D refreshSelPanel no longer builds a research button by hand',
    !rs.includes("bt.innerHTML=`<b>${r.icon}"));
 /* affordability gate: rich enables, broke disables */
 const c=rcost(p,key);
 p.res.p=c.p+1;p.res.e=c.e+1;
 const rich=researchBtn(e,key,tail);
 p.res.p=0;p.res.e=0;
 const broke=researchBtn(e,key,tail);
 ok('T41.D the dis class tracks affordability',
    !rich.classList.contains('dis') && broke.classList.contains('dis'));
 /* a locked prerequisite replaces the tail outright, as it did in both copies */
 const upg=researchCatalog(p).find(k=>RESEARCH[k].kind==='upgrade'&&RESEARCH[k].reqTech&&!hasTech(p,RESEARCH[k].reqTech));
 if(upg){
  const lb=researchBtn(e,upg,tail);
  ok('T41.D a locked prerequisite swaps the tail for the "research X first" note',
     lb.title.includes('first)') && !lb.title.includes(tail) && lb.classList.contains('dis'));
 } else {
  ok('T41.D a locked prerequisite swaps the tail (no locked upgrade in this catalog)',true);
 }
}

/* ---------- E: lobSetRosBlock ---------- */
section('T41.E lobSetRosBlock: one settings + roster block, two panels');
{
 const kids=[];
 const P={appendChild(c){kids.push(c);return c}};
 lobSetRosBlock(P);
 ok('T41.E appends exactly three children',kids.length===3);
 ok('T41.E in order: #lobSet, the Lobby subheader, #lobRos',
    kids[0].id==='lobSet' && kids[2].id==='lobRos' &&
    String(kids[1].innerHTML||'').includes('Lobby'));
 const hs=lobOpenHost.toString(), js=lobOpenJoin.toString();
 ok('T41.E the host panel calls it',hs.includes('lobSetRosBlock(P)'));
 ok('T41.E the joiner panel calls it',js.includes('lobSetRosBlock(P)'));
 ok('T41.E neither panel builds the block by hand any more',
    !hs.includes("setBox.id='lobSet'") && !js.includes("setBox.id='lobSet'"));
}

/* ---------- F/G/H: source-level lints over the shipped file ---------- */
section('T41.F the FILE MAP lint, and the dead markup');
{
 let html=null;
 try{html=require('fs').readFileSync('pw.html','utf8')}catch(e){html=null}
 if(!html){
  ok('T41.F pw.html is readable next to the harness',false);
 } else {
  const script=html.slice(html.indexOf('<script>'),html.indexOf('</script>'));
  /* every banner in the file, in file order */
  const banners=[];
  for(const line of script.split('\n')){
   const m=/^\/\*\s+[-=]{4,}\s+(.+?)(?:\s+[-=]{4,})?\s*(?:\*\/)?\s*$/.exec(line);
   if(m&&m[1]&&!/^[-=]+$/.test(m[1]))banners.push(m[1].trim());
  }
  ok('T41.F the file still has its full set of banners',banners.length>=80);
  /* the map body: the block between the FILE MAP header and the closing rule */
  const a=script.indexOf('FILE MAP - every entry'), b=script.indexOf('   ============================================================ */');
  const mapBody=script.slice(a,b);
  const mapLines=mapBody.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('('));
  let cursor=0,missing=[],outOfOrder=[];
  for(const t of banners){
   let found=-1;
   for(let i=cursor;i<mapLines.length;i++){if(mapLines[i].startsWith(t+' ')||mapLines[i]===t){found=i;break}}
   if(found<0){
    /* present, but earlier than it should be? that is an ordering fault, not a gap */
    if(mapLines.some(l=>l.startsWith(t+' ')||l===t))outOfOrder.push(t); else missing.push(t);
   } else cursor=found+1;
  }
  ok('T41.F every banner is listed in the FILE MAP'+(missing.length?' [missing: '+missing.slice(0,4).join(', ')+']':''),missing.length===0);
  ok('T41.F the FILE MAP is in true file order'+(outOfOrder.length?' [out of order: '+outOfOrder.slice(0,4).join(', ')+']':''),outOfOrder.length===0);
  /* non-vacuity: a banner that does not exist must NOT be findable in the map */
  ok('T41.F the lint can fail',!mapLines.some(l=>l.startsWith('BANNER THAT DOES NOT EXIST')));

  /* G: dead markup */
  ok('T41.G #testRow / #watchRow / #netRow are gone',
     !html.includes('id="testRow"')&&!html.includes('id="watchRow"')&&!html.includes('id="netRow"'));
  ok('T41.G the rows themselves survive, styled by .srow',
     (html.match(/class="srow"/g)||[]).length>=3 && html.includes('Spectate Mode'));
   ok('T41.G class="opt tslot" is gone',!html.includes('class="opt tslot"'));
  ok('T41.G all four data-tslot buttons remain',(html.match(/data-tslot="/g)||[]).length===4);

  /* H: the rationale tags were deliberately left alone */
  const vtags=(script.match(/v\d\d(?:\.\d)?\s*:/g)||[]).length;
  ok('T41.H the inline vNN: rationale tags were not stripped (>=380 remain)',vtags>=380);
  /* but the banner TITLES no longer carry version prefixes */
  const versioned=banners.filter(t=>/^v\d\d\b/.test(t)||/\(v\d\d\)$/.test(t));
  ok('T41.H no banner title carries a version prefix or suffix'+(versioned.length?' ['+versioned.join(', ')+']':''),versioned.length===0);
 }
}
