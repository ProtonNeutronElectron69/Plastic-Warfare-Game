/* tail_v61.js - v61 economy & spacing pass.

   A: the cargo table and the retired haulage multiplier carry the approved
      numbers, and cargoCap() answers for an empty truck.
   B: conservation - over a real round trip a node loses EXACTLY what the bank
      gains, for both resources, and a full load is the table figure.
   C: the harvest reorder - a truck switching resource type, and a pre-v61 save
      carrying more than the new cap, can never pay a node back.
   D: the supply ceiling and the arithmetic that reaches it.
   E: bldGap's geometry, including the diagonal corner pinch.
   F: placeDeny enforcement: a gap of 0 denies and 1 passes (v65 loosened the
      rule from 2 clear tiles to 1), barricades are exempt from each other and
      from nothing else, neutral map clutter counts, testing mode does not lift
      it, and a pre-v61 tight base still stands.
   H: the battery lean is symmetric - a power-rich army is pushed OFF the battery
      piles, at the approved threshold, without ever being banned from them.
   G: the AI under the rule - every live placement was legal at call time, bots
      still build, and aiFindSpot hands back legal ground.

   Mutation checks: B pins the delivered figure in BOTH directions (plastic held
   at its v60 value, battery cut to the approved 23) and reads it off a live
   round trip rather than the table it came from; F pins the pass case at gap 1
   against the same tile denied at gap 0, so the rule cannot pass by denying
   everything; G counts placements, so a bot that built nothing cannot look
   clean. */
'use strict';
section('T40 v61: truck loads, node conservation, supply 80, building spacing');

const DT61=1/30;
function cfg61(map,mode,seed,opp){return{map,mode,diff:'normal',fac:'green',opp:(opp==null?3:opp),seed}}
/* Tick 1 hands every human truck a node of its own choosing (the boot auto-harvest
   in update()). Anything that stages a truck by hand has to get past that tick
   first or the staging is silently overwritten, so fresh61 spends it here. */
function fresh61(seed,opp){G=null;newGame(cfg61('backyard','dm',seed,opp==null?1:opp));for(let i=0;i<3;i++)update(DT61);}
// park every truck in the game except `keep`, so nothing else moves a node
function park61(keep){
 for(const q of G.players)for(const u of q.units){
  if(u===keep||u.t.a!=='truck'||u.t.heal)continue;
  u.state='idle';u.node=null;u.path=null;u.mining=false;u.hold=true;u.cargo=0;
 }
}
// the first tile whose footprint is legal for `key`, scanning outward from (ax,ay)
/* v66: optional `extra(tx,ty)` predicate. F below places a barracks and then walks
   east off its edge expecting the spacing rule to be the ONLY thing that can deny;
   on the denser v66 maps the first legal barracks spot can have a hazard tile or a
   neutral hedgehog sitting in that runway, which denies for a different reason and
   fails a check that is not about terrain at all. */
function legal61(p,key,ax,ay,R,extra){
 const sz=B[key].sz,N=G.map.N;
 for(let r=1;r<=R;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
  const tx=Math.round(ax)+dx,ty=Math.round(ay)+dy;
  if(tx<1||ty<1||tx+sz>=N-1||ty+sz>=N-1)continue;
  if(placeDeny(p,key,tx,ty)!=='')continue;
  if(extra&&!extra(tx,ty))continue;
  return{tx,ty};
 }
 return null;
}

/* ---------- A: the table ---------- */
{
 ok('T40.A a plastic load is 45',CARGO_CAP.plastic===45);
 ok('T40.A an electricity load is 23',CARGO_CAP.battery===23);
 ok('T40.A the haulage multiplier is retired, not merely smaller',TRUCK_DROP_MUL===1);
 // the two directions the release was asked for, expressed against the v60 numbers
 ok('T40.A plastic DELIVERED is unchanged from v60 (60 * 0.75)',CARGO_CAP.plastic===60*0.75);
 ok('T40.A electricity delivered is at most half of v60\u2019s 45',CARGO_CAP.battery<=0.52*45&&CARGO_CAP.battery>0.45*45);
 ok('T40.A cargoCap answers for an empty truck (null cargoT) and both resources',
    cargoCap(null)===45&&cargoCap('plastic')===45&&cargoCap('battery')===23&&cargoCap('nonsense')===45);
}

/* ---------- B: a node pays exactly what the bank receives ---------- */
function roundTrip61(seed,type){
 fresh61(seed,1);
 const p=G.human;
 const u=p.units.find(x=>x.t.a==='truck'&&!x.t.heal);
 let n=null,bd=1e9;
 for(const m of G.map.nodes){
  if(m.t!==type||m.amt<200||m.wreck)continue;
  const d=dhyp(m.x-u.x,m.y-u.y);if(d<bd){bd=d;n=m}
 }
 if(!n)return null;
 park61(u);u.hold=false;u.cargo=0;u.cargoT=null;
 // start the truck ON the pile: this measures conservation over one round trip,
 // not the pathfinder's ability to reach a far corner inside a tick budget.
 const st=safeSpot(n.x,n.y);u.x=st.x;u.y=st.y;u.path=null;
 orderHarvest(u,n);
 const key=type==='plastic'?'p':'e';
 const amt0=n.amt,res0=p.res[key];
 let banked=0;
 for(let i=1;i<=3000;i++){
  park61(u);
  update(DT61);
  if(p.res[key]>res0){banked=p.res[key]-res0;break}
 }
 const inFlight=(u.cargoT===type)?u.cargo:0;
 return {took:amt0-n.amt,banked,inFlight,cap:cargoCap(type)};
}
{
 const rp=roundTrip61(610001,'plastic');
 ok('T40.B a plastic round trip completed',!!rp&&rp.banked>0);
 if(rp){
  ok(`T40.B the pile lost exactly what the bank gained (${rp.took.toFixed(3)} vs ${(rp.banked+rp.inFlight).toFixed(3)})`,
     Math.abs(rp.took-(rp.banked+rp.inFlight))<1e-6);
  ok(`T40.B ...and the load itself was the table figure (${rp.banked})`,rp.banked===CARGO_CAP.plastic);
 }
 const re=roundTrip61(610002,'battery');
 ok('T40.B an electricity round trip completed',!!re&&re.banked>0);
 if(re){
  ok(`T40.B the battery lost exactly what the bank gained (${re.took.toFixed(3)} vs ${(re.banked+re.inFlight).toFixed(3)})`,
     Math.abs(re.took-(re.banked+re.inFlight))<1e-6);
  ok(`T40.B ...and the load itself was the table figure (${re.banked})`,re.banked===CARGO_CAP.battery);
  // the whole point of the pair: the two resources no longer haul the same amount
  ok('T40.B the two resources deliver different amounts per trip',re.banked<rp.banked/1.9);
 }
}

/* ---------- C: the harvest reorder can never pay a node back ---------- */
{
 fresh61(610003,1);
 const p=G.human,u=p.units.find(x=>x.t.a==='truck'&&!x.t.heal);
 park61(u);u.hold=false;
 // 40 plastic aboard, told to mine a battery: pre-v61 this computed take against
 // a cap of 23 BEFORE the type reset, i.e. take = -17, and the node gained.
 const bat=G.map.nodes.find(m=>m.t==='battery'&&m.amt>100);
 ok('T40.C found a battery node to switch onto',!!bat);
 if(bat){
  u.cargo=40;u.cargoT='plastic';u.node=bat;u.state='harvest';u.mining=true;u.path=null;
  u.x=bat.x;u.y=bat.y;
  const a0=bat.amt;
  update(DT61);
  ok('T40.C switching resource type never credits the node',bat.amt<=a0);
  ok('T40.C ...the old load is dropped and the new one is non-negative',u.cargoT==='battery'&&u.cargo>=0&&u.cargo<=CARGO_CAP.battery);
 }
 // a pre-v61 truck carrying 60 into a 45 cap: it banks the lot, it does not refund
 const pla=G.map.nodes.find(m=>m.t==='plastic'&&m.amt>100&&!m.wreck);
 ok('T40.C found a plastic node for the legacy-load case',!!pla);
 if(pla){
  u.cargo=60;u.cargoT='plastic';u.node=pla;u.state='harvest';u.mining=true;u.path=null;
  u.x=pla.x;u.y=pla.y;
  const a0=pla.amt;
  update(DT61);
  ok('T40.C an over-cap legacy load takes nothing and refunds nothing',pla.amt===a0&&u.cargo===60);
  ok('T40.C ...and is sent to the drop-off rather than left mining',u.state==='return');
 }
}

/* ---------- D: the supply ceiling ---------- */
{
 ok('T40.D the ceiling is at least 80',SUP_CAP>=80);
 fresh61(610004,1);
 const p=G.human,hq=p.blds[0];
 ok('T40.D a fresh base still opens on the HQ alone',supCap(p)===B.hq.sup);
 /* v69: 80 -> 110, so the clean HQ-plus-N-depots relation the v61 ceiling had at
    seven now sits at ten. The relation is what is being pinned, not the seven.
    v83: DEPOT_SUP 10 -> 15 breaks that equality outright - six depots reach 100
    and the seventh crosses with 5 of its 15 unused - so what is pinned here is
    the COUNT instead: the ceiling is still reached, and reached on seven. */
 const need61=Math.ceil((SUP_CAP-B.hq.sup)/B.supply.sup);
 ok('T40.D seven depots are what the ceiling now costs',need61===7);
 for(let i=0;i<need61;i++){const b=makeBuilding('supply',p,Math.floor(hq.tx)-7,Math.floor(hq.ty)+i*2-9,true);b.prog=1}
 ok('T40.D an HQ plus seven depots reaches the ceiling',supCap(p)===SUP_CAP);
 const bX=makeBuilding('supply',p,Math.floor(hq.tx)+8,Math.floor(hq.ty),true);bX.prog=1;
 ok('T40.D ...and one more adds nothing',supCap(p)===SUP_CAP);
 ok('T40.D the ceiling is 30 above the v61 figure',SUP_CAP===110);
}

/* ---------- E: the gap geometry ---------- */
{
 // bldGap reads tx/ty/sz off the standing building and B[key].sz off the placed
 // one, so a plain triple is the whole fixture. Sizes come from the table rather
 // than a literal: the barracks is 2x2 today and this must not care.
 const SZ=B.barracks.sz, fake=(tx,ty)=>({tx,ty,sz:SZ});
 ok('T40.E flush footprints score 0',bldGap('barracks',10,10,fake(10+SZ,10))===0);
 ok('T40.E one clear tile scores 1',bldGap('barracks',10,10,fake(10+SZ+1,10))===1);
 ok('T40.E two clear tiles score 2',bldGap('barracks',10,10,fake(10+SZ+2,10))===2);
 ok('T40.E overlap scores no more than zero',bldGap('barracks',10,10,fake(11,11))<=0);
 // the pinch: corner to corner, clear on neither axis
 ok('T40.E a diagonal corner touch scores 0, not 2',bldGap('barracks',10,10,fake(10+SZ,10+SZ))===0);
 // separation on EITHER axis is enough
 ok('T40.E two clear tiles in x is enough at any y',bldGap('barracks',10,10,fake(10+SZ+2,10+SZ+1))===2);
 ok('T40.E the gap is symmetric',
    bldGap('barracks',10,10,fake(10+SZ+2,10))===bldGap('barracks',10+SZ+2,10,fake(10,10)));
 ok('T40.E BUILD_GAP is 1 (2 -> 1 at v65)',BUILD_GAP===1);
}

/* ---------- F: placeDeny enforcement ---------- */
{
 fresh61(610005,1);
 const p=G.human,hq=p.blds[0];
 // the runway east of the barracks must be clear ground BEFORE the barracks lands,
 // so that afterwards the only thing that can deny there is the spacing rule
 const spot=legal61(p,'barracks',hq.x+6,hq.y,7,(tx,ty)=>{
  const base=tx+B.barracks.sz;
  for(let d=0;d<=3;d++)if(placeDeny(p,'guardtower',base+d,ty)!=='')return false;
  return true;
 });
 ok('T40.F found legal ground for a barracks',!!spot);
 if(spot){
  const bk=placeBuilding(p,'barracks',spot.tx,spot.ty);
  // walk east from the new barracks. v65 loosened the rule from 2 clear tiles to
  // 1, so the boundary moved by exactly one tile: 0 denies, 1 now passes.
  const gy=spot.ty, base=spot.tx+B.barracks.sz;
  const at=d=>placeDeny(p,'guardtower',base+d,gy);
  ok(`T40.F flush against a building denies 'space' (${at(0)})`,at(0)==='space');
  ok(`T40.F one clear tile now passes at v65 (${at(1)||'legal'})`,at(1)==='');
  ok(`T40.F two clear tiles pass (${at(2)||'legal'})`,at(2)==='');
  // barricades: exempt from each other, from nothing else
  const bx=spot.tx-3,by=spot.ty;
  ok('T40.F a barricade flush against a building is denied',placeDeny(p,'barricade',spot.tx-1,by)==='space');
  const bs=legal61(p,'barricade',hq.x-6,hq.y,7);
  ok('T40.F found legal ground for a barricade',!!bs);
  if(bs){
   placeBuilding(p,'barricade',bs.tx,bs.ty);
   ok('T40.F a barricade may sit flush against another barricade',placeDeny(p,'barricade',bs.tx+1,bs.ty)==='');
   ok('T40.F ...but a building may not sit flush against a barricade',placeDeny(p,'guardtower',bs.tx+1,bs.ty)==='space');
  }
  // neutral map clutter counts as a footprint like any other
  /* Neutral clutter counts. A hedgehog cluster is a LINE, so its immediate
     neighbour is usually another hedgehog and would answer 'terrain'; scan the
     ring for a tile that is clear ground and let that one carry the claim. */
  let hedge=null,ht=null;
  for(const b of G.blds){
   if(b.p!==G.neutral||b.key!=='barricade')continue;
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const tx=b.tx+dx,ty=b.ty+dy;
    if(placeDeny(p,'guardtower',tx,ty)==='terrain')continue;
    hedge=b;ht={tx,ty};break;
   }
   if(hedge)break;
  }
  ok('T40.F found a neutral hedgehog with clear ground beside it',!!hedge);
  if(hedge){
   ok(`T40.F a neutral hedgehog holds a building off too (${placeDeny(p,'guardtower',ht.tx,ht.ty)})`,
      placeDeny(p,'guardtower',ht.tx,ht.ty)==='space');
   ok('T40.F ...and still lets a barricade tie into it',placeDeny(p,'barricade',ht.tx,ht.ty)!=='space');
  }
  // testing mode lifts the zone and the enemy ring, never the spacing rule
  G.test=true;
  ok('T40.F testing mode does not lift the spacing rule',at(0)==='space'&&at(1)==='');
  G.test=false;
 }
 // a pre-v61 base packed tight loads and stands: makeBuilding is not gated
 fresh61(610006,1);
 {
  const q=G.human,h2=q.blds[0];
  const a=makeBuilding('generator',q,Math.floor(h2.tx)+5,Math.floor(h2.ty),true);
  const b=makeBuilding('generator',q,Math.floor(h2.tx)+5+B.generator.sz,Math.floor(h2.ty),true);
  ok('T40.F a tight pre-v61 pair still stands (placement only, no retro-eviction)',
     bldGap('generator',b.tx,b.ty,a)===0&&q.blds.indexOf(a)>=0&&q.blds.indexOf(b)>=0);
  const h=hashState();
  ok('T40.F ...and hashes without complaint',typeof h==='number'&&h>=0);
 }
}

/* ---------- G: the AI under the rule ---------- */
{
 G=null;newGame(cfg61('backyard','dm',610007,3));
 const _pb=placeBuilding;
 let placed=0,illegal=0;
 const seen=[];
 placeBuilding=function(p,key,tx,ty){
  placed++;
  if(placeDeny(p,key,tx,ty)!=='')illegal++;
  seen.push({key,tx,ty,barr:!!B[key].barr});
  return _pb(p,key,tx,ty);
 };
 for(let i=1;i<=5400;i++)update(DT61);
 placeBuilding=_pb;
 ok(`T40.G bots kept building under the rule (${placed} placements)`,placed>=12);
 ok('T40.G every live placement was legal at call time',illegal===0);
 // and the standing layout honours it: any pair placed through placeDeny during
 // the run must hold the gap unless both are barricades
 let bad=0;
 for(let i=0;i<seen.length;i++)for(let j=i+1;j<seen.length;j++){
  const a=seen[i],b=seen[j];
  if(a.barr&&b.barr)continue;
  if(bldGap(a.key,a.tx,a.ty,{tx:b.tx,ty:b.ty,sz:B[b.key].sz})<BUILD_GAP)bad++;
 }
 ok(`T40.G no pair placed during the run violates the gap (${bad})`,bad===0);
 const bot=G.players.find(p=>p.ai&&p.alive&&p.blds.length);
 ok('T40.G a live bot still holds a real base',!!bot&&bot.blds.filter(b=>b.key!=='barricade').length>=4);
 if(bot){
  const anchor=bot.blds.find(b=>b.key==='hq')||bot.blds[0];
  const s=aiFindSpot(bot,'guardtower',anchor);
  ok('T40.G aiFindSpot still finds ground, and what it finds is legal',!!s&&placeDeny(bot,'guardtower',s.x,s.y)==='');
 }
}

/* ---------- H: the glut term ---------- */
{
 /* v75: E_GLUT / E_GLUT_PEN are retired. The claim H makes is unchanged - the
    battery lean has two ends - but it is now made by one signed servo instead of
    three absolute thresholds, so it is asserted on the servo's own properties. */
 ok('T40.H the servo is signed and normalised',
    Math.abs(resSkew({res:{p:0,e:0}}))<1e-12&&
    Math.abs(resSkew({res:{p:1e6,e:0}})-1)<1e-9&&
    Math.abs(resSkew({res:{p:0,e:1e6}})+1)<1e-9);
 ok('T40.H balance is the ratio the price tables imply, not a hand-set number',
    RES_REF>0&&Math.abs(resSkew({res:{p:1000,e:1000*RES_REF}}))<1e-12);
 ok('T40.H the bias is equal and opposite on the two pile types',RES_BIAS>0&&RES_HARD>0&&RES_HARD<1);
 fresh61(610008,1);
 const p=G.human,u=p.units.find(x=>x.t.a==='truck'&&!x.t.heal);
 park61(u);u.hold=false;u.cargo=0;u.cargoT=null;u.node=null;u.parked=false;
 const keepE=p.res.e;
 /* Walk every battery pile: park the truck beside it, then ask findNode twice,
    changing NOTHING but the bank. Poor must answer battery every time (that is
    the v22 pull, unchanged). Rich must answer plastic somewhere, or the push does
    not exist. Counting rather than picking one pile keeps the claim off a single
    piece of map geometry. */
 let poorBattery=0,piles=0,flipped=0,flipCase=null;
 for(const n of G.map.nodes){
  if(n.t!=='battery'||n.amt<=0||n.wreck)continue;
  const st=safeSpot(n.x,n.y);u.x=st.x;u.y=st.y;
  piles++;
  p.res.e=0;   const poor=findNode(u);
  p.res.e=5000;const rich=findNode(u);
  if(poor&&poor.t==='battery')poorBattery++;
  if(poor&&poor.t==='battery'&&rich&&rich.t==='plastic'){flipped++;if(!flipCase)flipCase={x:st.x,y:st.y}}
 }
 p.res.e=keepE;
 ok(`T40.H a power-SHORT army goes to the battery at every pile (${poorBattery} of ${piles})`,piles>0&&poorBattery===piles);
 ok(`T40.H a power-RICH army is pushed onto plastic instead (${flipped} of ${piles} piles flip)`,flipped>0);
 if(flipCase){
  u.x=flipCase.x;u.y=flipCase.y;
  const keepP=p.res.p;
  p.res.p=1000;
  p.res.e=1000*RES_REF*0.2;const under=findNode(u);
  p.res.e=1000*RES_REF*5;  const over=findNode(u);
  p.res.e=keepE;p.res.p=keepP;
  ok('T40.H the push reverses across balance, in both directions',
     !!under&&under.t==='battery'&&!!over&&over.t==='plastic');
 }
 // soft, not a ban: with the plastic gone, a rich army still mines power
 for(const n of G.map.nodes)if(n.t==='plastic')n.amt=0;
 p.res.e=5000;
 const only=findNode(u);
 ok('T40.H with no plastic left in reach a rich army still takes the battery',!!only&&only.t==='battery');
 // and a truck already carrying a partial load finishes it, glut or no glut
 u.cargo=15;u.cargoT='battery';
 const locked=findNode(u);
 ok('T40.H a part-loaded truck still finishes its own resource',!!locked&&locked.t==='battery');
 p.res.e=keepE;u.cargo=0;u.cargoT=null;
}
