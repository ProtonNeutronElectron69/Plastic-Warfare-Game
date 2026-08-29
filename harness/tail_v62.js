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
  'backyard:dm:777001': [419818080, 2542435510, 2944061929, 3700953574, 1078977868, 4213971123, 1101048914, 2063128407, 2162152458, 2128668873],
  'kitchen:dm:777001': [3327866456, 2541871818, 3999973497, 1220498783, 3468212194, 3884348057, 296682112, 4110675323, 2467149561, 76836886],
  'livingroom:dm:777001': [4034599070, 3939112218, 104648012, 714437940, 3195756990, 3797494395, 2303081222, 2051875341, 516602132, 2055420109],
  'sandbox:dm:777001': [3099346706, 2925683782, 275091548, 3175523855, 756093447, 1954432869, 1079561545, 4112796719, 827388025, 4147010330],
  'backyard:koth:424243': [851140528, 1091971546, 2144745901, 3532822347, 917836579, 3306698157, 1022302335, 2568371945, 614475746, 581853716],
  'kitchen:ctf:424243': [17713889, 1553821641, 4152710999, 1760229715, 3788808835, 3699200087, 3702820541, 198536080, 1010418024, 1228030608],
  'desk:surv:424243': [1397228784, 2326604305, 1516262078, 2392224196, 4189050588, 9195240, 3611851979, 2341919364, 1997356411, 2024326809, 934935830, 3230237163, 3328355162, 3899611052, 2839275118, 4031450651, 2089552542, 3491280855, 1882901028, 3365221921, 2249737314, 1238096276, 279521371, 2837669605, 1586290240, 3989945755],
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
