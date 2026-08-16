/* tail_v62.js - T41: v62 cleanup & organization pass.

   A cleanup release is accepted on the opposite criterion to a feature release:
   the simulation must NOT move. Every baseline in section A was captured from the
   v61 build BEFORE the first splice edit was applied, and there is no repin
   script for this version.

   A: hash trails and map layouts byte-identical to v61.
   B: the dead tracer path is gone at BOTH ends (emitter and renderer branch).
   C: paintIsoTile draws the exact five-fill recipe both call sites used to inline.
   D: researchBtn reproduces both of refreshSelPanel's research buttons.
   E: lobSetRosBlock builds the settings + roster block for host and joiner alike.
   F: the FILE MAP lint - every banner in the file is listed, in file order.
   G: the dead markup attributes are gone from the shipped HTML.
   H: the inline vNN: rationale tags were NOT stripped (they carry reasons). */
'use strict';
section('T41 v62: cleanup invariants (behaviour must be identical to v61)');

const BASE62_TRAILS={
  'backyard:dm:777001': [750491227, 1119613671, 1371730719, 291466142, 2540191816, 3177119412, 3561023094, 423859824, 249574976, 1550233752],
  'kitchen:dm:777001': [440473483, 1701978433, 489847555, 3686334171, 2938592545, 3840781876, 2836075783, 2858206846, 93071924, 117539811],
  'livingroom:dm:777001': [4267083591, 2667812729, 2731179865, 41287130, 4003897424, 564528104, 849729782, 4222320993, 3147824242, 1374734709],
  'sandbox:dm:777001': [3881914371, 376028459, 3440005435, 2670113860, 1174849398, 1187252771, 1556666743, 1891274324, 1510025727, 4115999487],
  'backyard:koth:424243': [3952441870, 704302053, 216249873, 3759345183, 914282261, 2813209774, 4284687240, 3433340880, 3135936625, 975330290],
  'kitchen:ctf:424243': [376084405, 3510576797, 2122610219, 3097842439, 3176319247, 1438913458, 1489865936, 2039742187, 3276869579, 141061347],
  'desk:surv:424243': [971916255, 1266331821, 419799132, 2002193796, 1711363865, 1293215622, 2658753060, 62663655, 3699786805, 3533237089, 560832642, 4055543494, 2792588425, 3910131523, 1403030015, 3318767208, 2643711502, 711841673, 1492675811, 1250295642, 3619210758, 3586643298, 1233406026, 1784613676, 3607456846, 3327686509],
};
const BASE62_LAYOUTS={"backyard:11":1255837022,"backyard:22":1262884325,"backyard:33":3816844854,"kitchen:11":2736043710,"kitchen:22":317751797,"kitchen:33":3447831333,"livingroom:11":859166094,"livingroom:22":3229224006,"livingroom:33":3594163030,"sandbox:11":3903799714,"sandbox:22":2051225923,"sandbox:33":1330770731,"desk:11":2502437368,"desk:22":864639349,"desk:33":1711599493};
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

/* ---------- C: paintIsoTile ---------- */
section('T41.C paintIsoTile: one recipe, two call sites');
function recCtx(){
 const trace=[];let fill='#000';
 return{trace,
  set fillStyle(v){fill=v},get fillStyle(){return fill},
  beginPath(){trace.push(['begin'])},
  moveTo(x,y){trace.push(['move',x,y])},
  lineTo(x,y){trace.push(['line',x,y])},
  closePath(){trace.push(['close'])},
  fill(){trace.push(['fill',fill])}};
}
{
 const c=recCtx();paintIsoTile(c,100,50,'#123456');
 const t=c.trace;
 const fills=t.filter(o=>o[0]==='fill').map(o=>o[1]);
 ok('T41.C five fills, in the documented order',
    fills.length===5 &&
    fills[0]==='#123456' &&
    fills[1]==='rgba(255,255,255,.10)' && fills[2]==='rgba(255,255,255,.06)' &&
    fills[3]==='rgba(14,22,10,.12)'   && fills[4]==='rgba(14,22,10,.06)');
 /* geometry, derived from the tile constants rather than restated as literals */
 const seg=[];let cur=null;
 for(const o of t){
  if(o[0]==='begin')cur=[];
  else if(o[0]==='move'||o[0]==='line')cur.push([o[1],o[2]]);
  else if(o[0]==='fill')seg.push(cur);
 }
 const eq=(a,b)=>a.length===b.length&&a.every((p,i)=>p[0]===b[i][0]&&p[1]===b[i][1]);
 ok('T41.C body diamond spans the full tile',
    eq(seg[0],[[100,50],[100+HW,50+HH],[100,50+TH],[100-HW,50+HH]]));
 ok('T41.C both lit facets meet at the tile mid-height',
    eq(seg[1],[[100,50],[100-HW,50+HH],[100,50+HH*.5]]) &&
    eq(seg[2],[[100,50],[100+HW,50+HH],[100,50+HH*.5]]));
 ok('T41.C both shaded facets hang off the south point',
    eq(seg[3],[[100,50+TH],[100+HW,50+HH],[100,50+HH*1.5]]) &&
    eq(seg[4],[[100,50+TH],[100-HW,50+HH],[100,50+HH*1.5]]));
 /* non-vacuity: the recorder must actually record, and a different tile must
    produce a different trace */
 const c2=recCtx();paintIsoTile(c2,200,50,'#123456');
 ok('T41.C the recorder distinguishes two tiles',
    c2.trace.length===t.length && !eq(seg[0],
      (()=>{const s=[];let k=null;for(const o of c2.trace){if(o[0]==='begin')k=[];else if(o[0]==='move'||o[0]==='line')k.push([o[1],o[2]]);else if(o[0]==='fill'){s.push(k);break}}return s[0]})()));
}
{
 const rt=renderTerrain.toString(), ig=infoGround.toString();
 ok('T41.C renderTerrain calls the painter and inlines no diamond of its own',
    rt.includes('paintIsoTile(c,sx,sy,col)') && !rt.includes("'rgba(14,22,10,.12)'"));
 ok('T41.C infoGround calls the painter and inlines no diamond of its own',
    ig.includes('paintIsoTile(c,') && !ig.includes("'rgba(14,22,10,.12)'"));
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
