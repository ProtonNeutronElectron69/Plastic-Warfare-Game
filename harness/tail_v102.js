/* tail_v102.js - T79: the unit stat card, in the two places the owner asked for
   it - the hover popup inside a production building, and the selection panel
   when one unit is selected.

   THE CLAIM THIS FILE DEFENDS is that the card is DERIVED and not transcribed.
   Every figure on it comes from the function the simulation itself uses: the
   yellow multipliers from dmgMulFor, the red row from armorScan, the DPS from
   unitDPS through rtOf, the sight from viOf. So the checks below are not "does
   it print 1.35" - a transcribed card would pass that. They MUTATE the source
   table and demand the card moves with it, which only a derived card can do.

   AND THE BUG THIS RELEASE PAID FOR, pinned in C: the first cut computed DPS as
   dm/rt by hand. A live entity carries `dm` but NO `rt` - the reload lives on
   the type row and is bent by rtOf - so every selected unit read 0.0 dps, and a
   salvo weapon like the AA truck read a third of its real output because a
   hand-rolled ratio does not know about t.sal. Both were invisible to the suite
   until a real Chromium frame showed a Grunt at 0.0, which is rule 7 twice over:
   unitDPS and rtOf already existed and the card had no business re-deriving
   either. */
'use strict';
section('T79 v102: the unit stat card - derived, in the popup and the panel');

const DT102=1/30;
const cfg102=(fac,seed)=>({map:'backyard',mode:'dm',diff:'normal',fac:fac||'green',opp:1,seed});
function fresh102(seed,fac){G=null;newGame(cfg102(fac,seed));return G.human}
const pills102=(h,cls)=>(h.match(new RegExp('ucp '+cls,'g'))||[]).length;
/* every ucv value in document order, which is the order the card lays them out */
function vals102(h){return (h.match(/class="ucv">([^<]*)</g)||[]).map(x=>/">([^<]*)</.exec(x)[1])}
function scrub102(){const pb=document.getElementById('prodBtns');while(pb&&pb.firstChild)pb.removeChild(pb.firstChild);return pb}
function tiles102(pb){const out=[];(function w(n){if(n&&typeof n.className==='string'&&n.className.split(' ')[0]==='tl')out.push(n);(n&&n.children||[]).forEach(w)})(pb);return out}
let HTML102=null;
try{HTML102=require('fs').readFileSync('pw.html','utf8')}catch(e){HTML102=null}

/* ---------- A: the yellow row IS dmgMulFor, for every unit in the game ---------- */
{
 section('T79.A damage dealt is the counter matrix, not a copy of it');
 const p=fresh102(1020101,'green');
 ok('T79.A pw.html is readable next to the harness', !!HTML102);
 let bad=[],shapeBad=[];
 for(const k in U){
  const h=unitCard(k,{p});
  if(pills102(h,'ucd')!==CARD_CAT.length)shapeBad.push(k);
  const t=U[k],armed=!!(t.dm&&t.w);
  const got=(h.match(/ucp ucd[^>]*>[\s\S]*?class="ucv">([^<]*)</g)||[]).map(x=>/class="ucv">([^<]*)</.exec(x)[1]);
  CARD_CAT.forEach(([c],i)=>{
   const want=armed?('×'+dmgMulFor(k,t.w,c).toFixed(2)):'—';
   if(got[i]!==want)bad.push(k+':'+c+' got '+got[i]+' want '+want);
  });
 }
 ok('T79.A every unit shows exactly '+CARD_CAT.length+' damage-dealt pills'+(shapeBad.length?' ('+shapeBad.slice(0,3)+')':''),shapeBad.length===0);
 ok('T79.A ...and every one equals dmgMulFor for that class'+(bad.length?' ['+bad.slice(0,3).join('; ')+']':''),bad.length===0);
 ok('T79.A the six classes are the game\'s own armour order',
    CARD_CAT.map(c=>c[0]).join(',')===ARMOR_ORDER.join(','));

 /* MUTATION: move the table and the card must move with it. A transcribed card
    passes every check above and fails this one. */
 const keep=WVA.b.medium;
 try{
  WVA.b.medium=0.11;
  ok('T79.A MUTATION: re-scoring small arms moves the Grunt\'s card',
     unitCard('grunt',{p}).indexOf('×0.11')>0);
 } finally { WVA.b.medium=keep; }
 ok('T79.A ...and the table is restored', WVA.b.medium===keep&&unitCard('grunt',{p}).indexOf('×0.11')<0);
}

/* ---------- B: the red row IS armorScan ---------- */
{
 section('T79.B the threat row names what actually beats this unit');
 const p=fresh102(1020201,'green');
 let bad=[];
 for(const k in U){
  const h=unitCard(k,{p});
  const want=armorScan(armorOf({kind:'unit',t:U[k]}),true);
  const got=(h.match(/ucp uct[^>]*>[\s\S]*?class="ucl">([^<]*)<[\s\S]*?class="ucv">([^<]*)</g)||[])
    .map(x=>{const m=/class="ucl">([^<]*)<[\s\S]*?class="ucv">([^<]*)</.exec(x);return [m[1],m[2]]});
  if(got.length!==want.length){bad.push(k+' count '+got.length+'/'+want.length);continue}
  want.forEach(([wc,m],i)=>{
   if(got[i][0]!==WC_LABEL[wc]||got[i][1]!=='×'+m.toFixed(2))bad.push(k+':'+wc);
  });
 }
 ok('T79.B every unit\'s threat row equals armorScan, in order'+(bad.length?' ['+bad.slice(0,3).join('; ')+']':''),bad.length===0);
 ok('T79.B ...worst first, which is what makes the row scannable',
    (()=>{const w=armorScan('inf',true);return w.length>1&&w[0][1]>=w[1][1]})());
 /* it names WEAPONS, and the tooltip names who carries them - the whole reason
    the row is weapon-classed rather than a per-unit-type average */
 const g=unitCard('grunt',{p});
 ok('T79.B a threat pill carries the units that field that weapon',
    g.indexOf('carried by: '+wcRoster('f'))>0);
 ok('T79.B every threat class has an icon of its own',
    armorScan('inf',true).every(([wc])=>!!CARD_WC[wc])&&Object.keys(CARD_WC).length>=8);

 const keep=WVA.f.inf;
 try{
  WVA.f.inf=2.44;
  ok('T79.B MUTATION: making flame worse for infantry moves the Grunt\'s threat row',
     unitCard('grunt',{p}).indexOf('×2.44')>0);
 } finally { WVA.f.inf=keep; }
}

/* ---------- C: the shop shows the TYPE, the field shows the MAN ---------- */
{
 section('T79.C the two readings differ on purpose');
 const p=fresh102(1020301,'green');
 const hpCell=h=>vals102(h)[0], dpsOf=h=>{const m=/class="ucv">([^<]*)<\/span><span class="ucu">dps/.exec(h);return m?m[1]:null};
 const sightOf=h=>{const m=h.match(/class="ucv">([\d.]+)<\/span><span class="ucu">tiles<\/span>/g)||[];return m.length?/">([\d.]+)</.exec(m[m.length-1])[1]:null};

 /* the shop applies the buying faction's own hull and damage modifiers */
 ok('T79.C Gray buys a tougher Grunt than Green does',
    Number(hpCell(unitCard('grunt',{p:{fac:'gray'}})))>Number(hpCell(unitCard('grunt',{p:{fac:'green'}}))));
 ok('T79.C ...by exactly the faction modifier, not a guess',
    hpCell(unitCard('grunt',{p:{fac:'gray'}}))===String(Math.round(U.grunt.hp*FAC.gray.mods.hp)));
 ok('T79.C Tan buys a harder-hitting one, on the same rule',
    Number(dpsOf(unitCard('grunt',{p:{fac:'tan'}})))>Number(dpsOf(unitCard('grunt',{p:{fac:'green'}}))));

 /* the field reads the live entity */
 const u=p.units.find(x=>x.key==='grunt');
 u.hp=u.mhp*0.5;
 ok('T79.C a selected unit reads health remaining over its maximum',
    hpCell(unitCard('grunt',{u}))===Math.ceil(u.hp)+'/'+Math.round(u.mhp));
 ok('T79.C ...and its sight through viOf, not off the row',
    sightOf(unitCard('grunt',{u}))===String(viOf(u)));

 /* v101 rides along: after dark the field card shortens, the shop card does not.
    THE CLOCK IS PINNED FIRST, and this fixture is why the rule exists: the match
    is dealt a random point in the cycle, seed 1020301 opens at NIGHT, and the
    "daylight" baseline was silently a halved one until this line was added. */
 G.dayOff=(DAY_PHASES[0].t0+2)*30-G.tick; if(G.dayOff<0)G.dayOff+=DAY_CYCLE_T*30;
 ok('T79.C fixture: the baseline really is taken in daylight', !nightNow());
 const daySight=sightOf(unitCard('grunt',{u})), dayShop=sightOf(unitCard('grunt',{p}));
 G.dayOff=(DAY_PHASES.find(x=>x.key==='night').t0+2)*30-G.tick;
 if(G.dayOff<0)G.dayOff+=DAY_CYCLE_T*30;
 ok('T79.C fixture: the clock really is at night', nightNow());
 ok('T79.C at night the selected unit\'s sight halves on the card',
    Number(sightOf(unitCard('grunt',{u})))===Number(daySight)*NIGHT_VI_MUL);
 ok('T79.C ...while the shop still quotes the daylight figure, because you are buying it',
    sightOf(unitCard('grunt',{p}))===dayShop);
 G.dayOff=0;

 /* THE BUG THIS RELEASE PAID FOR - both halves of it */
 ok('T79.C a live unit reads a real DPS: it has no .rt, so a hand-rolled dm/rt read 0',
    u.rt===undefined&&Number(dpsOf(unitCard('grunt',{u})))>0);
 ok('T79.C ...and it is the game\'s own unitDPS, so a SALVO is not read as one shot',
    U.aatruck.sal>1&&
    dpsOf(unitCard('aatruck',{p:{fac:'green'}}))===unitDPS(U.aatruck).toFixed(1)&&
    unitDPS(U.aatruck)>U.aatruck.dm/U.aatruck.rt);
 /* rtOf is the door, so everything that bends a reload is already inside it */
 const gn=makeUnit('gunner',p,u.x+1,u.y);
 const standing=Number(dpsOf(unitCard('gunner',{u:gn})));
 gn.entrenched=true;
 ok('T79.C an entrenched gunner reads the faster rate the fire site really gives him',
    Math.abs(Number(dpsOf(unitCard('gunner',{u:gn})))-standing*ENTRENCH_RATE)<0.15);
}

/* ---------- D: the edges ---------- */
{
 section('T79.D unarmed, air-only, and the shapes that could have thrown');
 const p=fresh102(1020401,'green');
 const medic=unitCard('medic',{p});
 const dealt102=h=>(h.match(/ucp ucd[^>]*>[\s\S]*?class="ucv">([^<]*)</g)||[])
   .map(x=>/class="ucv">([^<]*)</.exec(x)[1]);
 ok('T79.D an unarmed unit deals nothing, and says so with dashes rather than zeros',
    !U.medic.dm&&dealt102(medic).every(v=>v==='—')&&dealt102(medic).length===CARD_CAT.length);
 ok('T79.D ...and its DPS and range are dashed too, because it has no weapon',
    vals102(medic).filter(v=>v==='—').length>=3);
 ok('T79.D ...and still says what hurts it, because being unarmed is not being safe',
    pills102(medic,'uct')===armorScan(armorOf({kind:'unit',t:U.medic}),true).length);
 const aa=unitCard('aatruck',{p});
 ok('T79.D an air-only unit reads x0.00 on the ground - the zeros ARE the rule',
    U.aatruck.aaOnly&&(aa.match(/×0\.00/g)||[]).length>=5&&aa.indexOf('×1.60')>0);
 ok('T79.D ...and those zero pills are greyed, not shouted in gold',
    (aa.match(/ucp ucd ucnil/g)||[]).length>=5);
 ok('T79.D ...and the pill says WHY, rather than leaving a bare zero',
    aa.indexOf('cannot fire on them at all')>0);
 let threw=null;
 try{for(const k in U)unitCard(k,{p});unitCard('grunt',{});unitCard('nosuchunit',{p})}catch(e){threw=e.message}
 ok('T79.D every unit, an empty option bag and an unknown key all answer without throwing',threw===null);
 ok('T79.D an unknown key answers empty rather than half a card',unitCard('nosuchunit',{p})==='');
}

/* ---------- E: the popup, and the title it replaced ---------- */
{
 section('T79.E the production popup');
 const p=fresh102(1020501,'green');
 const bar=makeBuilding('barracks',p,Math.floor(p.start.x)+4,Math.floor(p.start.y)+4,true);
 bar.prog=1;bar.hp=bar.mhp;
 const pb=scrub102();
 setSel([bar]);lastSelSig='';refreshSelPanel();
 const tl=tiles102(pb);
 const carded=tl.filter(b=>b.dataset&&b.dataset.card==='1');
 ok('T79.E the Barracks offers unit tiles, and they carry cards',tl.length>0&&carded.length>0);
 ok('T79.E a tile with a card sets NO title - a native tooltip under a custom one is two tooltips',
    carded.every(b=>!b.title));
 ok('T79.E ...while structure and research tiles keep the title they have had since v43',
    tl.filter(b=>!(b.dataset&&b.dataset.card==='1')).every(b=>!!b.title));

 const pop=unitCardPop('grunt',p,U.grunt.d);
 ok('T79.E the popup carries the card',/class="uc"/.test(pop)&&pills102(pop,'ucd')===CARD_CAT.length);
 ok('T79.E ...with the description BELOW the grid, which is the order asked for',
    pop.indexOf('ucdesc')>pop.indexOf('ucweak'));
 ok('T79.E ...and the price under that',pop.indexOf('ucfoot')>pop.indexOf('ucdesc'));
 ok('T79.E plastic wears the plastic colour here exactly as it does on the tile',
    /class="cp">⬢/.test(pop)&&HTML102&&/\.cardPop \.ucfoot \.cp\{color:#ffb95e/.test(HTML102));
 ok('T79.E the price is the one the player would actually pay',
    pop.indexOf('⬢ '+ucost(p,'grunt').p)>0);
 /* show / hide, driven directly: the shim's addEventListener is a no-op, which is
    why the popup's body lives in named functions (the v73 rule) */
 const el=cardPopShow(pop,null);
 ok('T79.E cardPopShow puts the card on screen',el.style.display==='block'&&/ucweak/.test(el.innerHTML));
 cardPopHide();
 ok('T79.E ...and cardPopHide takes it away again',el.style.display==='none');
 ok('T79.E the popup cannot swallow a click meant for the board',
    !!HTML102&&/\.cardPop\{[^}]*pointer-events:none/.test(HTML102));
 ok('T79.E it is drawn opaque, because it sits over the panel\'s own text',
    !!HTML102&&/\.cardPop\{[^}]*background:#0e140a/.test(HTML102));
 /* THE STUCK-POPUP CASE: the panel rebuild replaces every tile, so a tile under
    the mouse is destroyed without firing its own mouseleave. Nothing would take
    the popup down again, and it would hang there for the rest of the match. */
 cardPopShow(pop,null);
 lastSelSig='';refreshSelPanel();
 ok('T79.E a panel rebuild takes the popup down with the tile it belonged to',
    cardPopEl().style.display==='none');
 ok('T79.E ...at the teardown itself, not by chasing the node',
    /if\(sig===lastSelSig\)return;lastSelSig=sig;[\s\S]{0,420}?cardPopHide\(\);/.test(String(refreshSelPanel)));
}

/* ---------- F: the selection panel ---------- */
{
 section('T79.F the selection panel');
 const p=fresh102(1020601,'green');
 const u=p.units.find(x=>x.key==='grunt');u.hp=u.mhp*0.4;
 setSel([u]);lastSelSig='';refreshSelPanel();
 const h=String(document.getElementById('selInfo').innerHTML||'');
 ok('T79.F a selected unit gets the card',/class="uc"/.test(h)&&pills102(h,'ucd')===CARD_CAT.length);
 ok('T79.F ...showing the health it has left',h.indexOf(Math.ceil(u.hp)+'/'+u.mhp+' HP')>0);
 ok('T79.F ...and the card supersedes the two v46 counter lines for a unit',
    h.indexOf('Armor '+ARMOR_SHORT.inf+' — hurt by')<0);
 /* a BUILDING is not a unit and keeps what it had */
 const hq=p.blds.find(b=>b.key==='hq');
 setSel([hq]);lastSelSig='';refreshSelPanel();
 const bh=String(document.getElementById('selInfo').innerHTML||'');
 ok('T79.F a building keeps its counter lines and takes no card',
    bh.indexOf('Armor '+ARMOR_SHORT.bldg)>0&&!/class="uc"/.test(bh));
 /* wildlife still reads, which is v100's fix and must not regress */
 const ns=(G.map.nests||[])[0];
 let cthrew=null;
 if(ns){const cr=spawnCreature(ns);try{setSel([cr]);lastSelSig='';refreshSelPanel()}catch(e){cthrew=e.message}}
 ok('T79.F selecting wildlife still does not throw',cthrew===null);
}

/* ---------- G: it is UI, and touches nothing the simulation owns ---------- */
{
 section('T79.G the card is client-local, like every panel before it');
 const p=fresh102(1020701,'green');
 const u=p.units.find(x=>x.key==='grunt');
 const src=String(unitCard)+String(unitCardPop)+String(cardPill)+String(cardDPS)+String(cardPopShow);
 ok('T79.G nothing in the card path draws from the seeded stream',
    src.indexOf('srand')<0);
 const rng=G.rngS,h0=hashState();
 for(const k in U){unitCard(k,{p});unitCardPop(k,p,U[k].d)}
 unitCard('grunt',{u});cardPopShow('x',null);cardPopHide();
 ok('T79.G building every card in the game moves neither the RNG nor the hash',
    G.rngS===rng&&hashState()===h0);
 ok('T79.G the popup is not sim state: it is not hashed and not serialized',
    String(hashState).indexOf('cardPop')<0&&String(saveState).indexOf('cardPop')<0);
 /* the layout contract the owner signed off on, asserted where it actually lives */
 if(HTML102){
  ok('T79.G damage-dealt is pinned to three columns, so it always reads as two rows of three',
     /\.ucdeal\{display:grid;grid-template-columns:repeat\(3,auto\)/.test(HTML102));
  ok('T79.G ...and the stat grid to two',
     /\.ucstats\{display:grid;grid-template-columns:repeat\(2,auto\)/.test(HTML102));
  ok('T79.G dealt is gold and the threat row is red, from the HUD\'s own palette',
     /\.ucp\.ucd \.ucv\{color:#ffd24d\}/.test(HTML102)&&/\.ucp\.uct \.ucv\{color:#ff6a5a\}/.test(HTML102));
 }
}
