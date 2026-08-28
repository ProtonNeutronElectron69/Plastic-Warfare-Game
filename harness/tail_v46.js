/* ================================================================================
   T27 - v46 THE CHINOOK, GENERATED COUNTER TEXT, AND THE IN-MATCH FIELD MANUAL

   A: the Gunship is gone from every registry and the Chinook took its slot in each
   B: the Chinook's stats, pinned, including the two relationships that define it
      (hull == the APC's, faster than every other chopper)
   C: the troop bay - load, cap enforcement, unload, over-water refusal, bail-out
   D: the aura - radius, non-stacking, infantry only, multiplies with the Dump,
      dead / enemy carriers inert, and nothing new hashed or serialized
   E: the APC shield moved to t.shield and did NOT come with the transport
   F: no bot ever trains one
   G: the counter text is generated, matches the sim's own lookup, and is on every
      surface the player reads
   H: the Field Manual opens inside a live match without touching the simulation
   I: determinism dual-run + save/load with a loaded Chinook airborne
   ================================================================================ */
section('T27 v46: Chinook transport, generated counter text, in-match Field Manual');

const DT46=1/30;
function cfg46(map,mode,seed,opp){return{map,mode,diff:'normal',fac:'blue',opp:(opp==null?1:opp),seed}}
function fresh46(seed,map){G=null;newGame(cfg46(map||'backyard','dm',seed));run(30);}
function put46(k,p,x,y){const u=makeUnit(k,p,x,y);u.state='idle';u.anchor={x,y};u.path=null;u.target=null;return u}
function drop46(u){const i=G.units.indexOf(u);if(i>=0)G.units.splice(i,1);const j=u.p.units.indexOf(u);if(j>=0)u.p.units.splice(j,1);}

/* ---------- A: the roster swap, everywhere ---------- */
{
 ok('T27.A the Gunship is out of the unit table and the Chinook is in',
    !U.gunship&&!!U.chinook&&!RESEARCH.u_gunship&&!!RESEARCH.u_chinook);
 ok('T27.A Blue trains it and no other army can',
    FAC.blue.uu.includes('chinook')&&FAC_AIR.blue[0]==='chinook'&&
    Object.keys(FAC).filter(f=>f!=='blue').every(f=>!(FAC[f].uu||[]).includes('chinook')));
 ok('T27.A the faction-exclusive research gate follows it',
    techAvailable({fac:'blue'},'u_chinook')&&!techAvailable({fac:'green'},'u_chinook')&&
    !techAvailable({fac:'gray'},'u_chinook')&&!techAvailable({fac:'tan'},'u_chinook'));
 ok('T27.A it appears on the Helipad roster only once Blue has researched it',
    (function(){var p={fac:'blue',tech:new Set()};
     var before=roster(p,'helipad').indexOf('chinook')>=0;
     p.tech.add('u_chinook');
     return !before&&roster(p,'helipad').indexOf('chinook')>=0;})());
 ok('T27.A the manual lists it as a Blue exclusive',
    INFO_FEXCL_U.indexOf('chinook')>=0&&INFO_FEXCL_U.indexOf('gunship')<0&&infoFacOf('unit','chinook')==='blue');
 ok('T27.A it has a bake box and a render scale of its own',
    !!VEH_BOX.chinook&&!VEH_BOX.gunship&&uScale({key:'chinook'})===1.28);
 ok('T27.A the derived unlock priced itself off the new cost',
    RESEARCH.u_chinook.cp===200&&RESEARCH.u_chinook.ce===107&&RESEARCH.u_chinook.time===18.1);
 ok('T27.A it is researched and built at the Helipad',
    researchBuilding('u_chinook')==='helipad'&&prodBldOf('chinook')==='helipad');
}

/* ---------- B: the stats ---------- */
{
 const t=U.chinook;
 ok('T27.B the hull is the APC\u2019s, literal for literal',t.hp===U.apc.hp&&t.hp===Math.round(287*HP_SCALE));
 ok('T27.B it is the fastest chopper in the game',
    t.sp===4.5&&Object.keys(U).filter(k=>k!=='chinook'&&U[k].a==='heli').every(k=>U[k].sp<t.sp));
 ok('T27.B fifteen seats',t.cap===15&&garCap({t:t})===15);
 ok('T27.B unarmed, and unarmed all the way down to the matrix',
    t.dm===0&&t.rg===0&&t.rt===0&&!t.w&&wcOf({kind:'unit',key:'chinook',t:t})==='x'&&
    ARMOR_ORDER.every(ar=>dmgMulFor('chinook','x',ar)===1));
 ok('T27.B it flies, and classifies as aircraft',t.fly===1&&armorOf({kind:'unit',t:t})==='air');
 ok('T27.B cost and build time (ce 100 -> 115 at v65)',t.cp===300&&t.ce===115&&Math.abs(t.bt-15*0.85)<1e-9);
 ok('T27.B the aura strength and radius live on the table, not in the code',
    t.aura===.15&&t.auraR===3&&
    dmgBonus.toString().indexOf('v.t.aura')>0&&dmgBonus.toString().indexOf('v.t.auraR')>0);
 fresh46(460001);
 {
  const bl=G.players.filter(p=>p.fac==='blue')[0];
  const c=makeUnit('chinook',bl,30,30);
  ok('T27.B a Blue Chinook still takes the faction modifiers',
     !!bl&&Math.abs(c.mhp-Math.round(U.chinook.hp*FAC.blue.mods.hp))<1.01&&
     Math.abs(c.sp-U.chinook.sp*FAC.blue.mods.speed)<1e-9);
 }
}

/* ---------- C: the troop bay ---------- */
{
 fresh46(460002);
 const me=G.human;
 const ch=put46('chinook',me,30,30);
 ok('T27.C a fresh Chinook has an empty bay',Array.isArray(ch.garrison)&&ch.garrison.length===0);

 const sq=[];for(let i=0;i<16;i++)sq.push(put46('grunt',me,30.4+i*.05,30));
 submitCmd('garrison',{ids:sq.map(u=>u.id),bid:ch.id,x:ch.x,y:ch.y});execCmds();run(150);
 ok('T27.C it loads fifteen and refuses the sixteenth',
    ch.garrison.length===15&&sq.filter(u=>u.garrisoned).length===15);
 ok('T27.C passengers ride position-synced with the airframe',
    ch.garrison.every(u=>Math.abs(u.x-ch.x)<.01&&Math.abs(u.y-ch.y)<.01));

 submitCmd('unloadu',{ids:[ch.id]});execCmds();
 ok('T27.C unload empties the bay onto ground they can stand on',
    ch.garrison.length===0&&sq.filter(u=>u.garrisoned).length===0&&
    sq.every(u=>passableR(u.x,u.y,unitRad(u))));

 ok('T27.C the drop search is wider for something that flies',
    dropOk.toString().indexOf('c.t.fly?8:4')>0&&apcUnload.toString().indexOf('c.t.fly?8:4')>0);
 {
  const N=G.map.N,wx=Math.floor(N/2),wy=Math.floor(N/2),save=[];
  for(let oy=-9;oy<=9;oy++)for(let ox=-9;ox<=9;ox++){
   const x=wx+ox,y=wy+oy;if(x<0||y<0||x>=N||y>=N)continue;
   save.push([x,y,G.map.pass[y*N+x]]);G.map.pass[y*N+x]=0;
  }
  const drowned=put46('chinook',me,wx+.5,wy+.5);
  ok('T27.C a carrier with nothing but water under it reports no drop zone',!dropOk(drowned));
  for(const e of save)G.map.pass[e[1]*N+e[0]]=e[2];
  ok('T27.C ...and the same carrier can drop again the moment there is ground',dropOk(drowned));
  drop46(drowned);
 }

 fresh46(460003);
 const me2=G.human;
 const ch2=put46('chinook',me2,34,34);
 const sq2=[];for(let i=0;i<4;i++)sq2.push(put46('grunt',me2,34.4+i*.05,34));
 submitCmd('garrison',{ids:sq2.map(u=>u.id),bid:ch2.id,x:ch2.x,y:ch2.y});execCmds();run(150);
 ok('T27.C pre-crash: four aboard',ch2.garrison.length===4);
 ch2.hp=5;applyDmg(ch2,999,'b',null);
 ok('T27.C a downed Chinook drops its squad at 85% health, on ground they can walk on',
    G.units.indexOf(ch2)<0&&sq2.every(u=>!u.garrisoned&&G.units.indexOf(u)>=0&&
      Math.abs(u.hp-u.mhp*0.85)<.01&&passableR(u.x,u.y,unitRad(u))));
}

/* ---------- D: the aura ---------- */
{
 fresh46(460004);
 const me=G.human;
 const foe=G.players.filter(p=>p!==me)[0];

 const g=put46('grunt',me,20,20);
 ok('T27.D with no carrier about, a grunt is on its base damage',dmgBonus(g)===1);

 const ch=put46('chinook',me,20,20);
 ok('T27.D standing under one, it hits 15% harder',Math.abs(dmgBonus(g)-1.15)<1e-12);

 const at=d=>{ch.x=20+d;ch.y=20;return dmgBonus(g)};
 ok('T27.D the aura reaches exactly three tiles and stops',
    Math.abs(at(2.9)-1.15)<1e-12&&Math.abs(at(3.0)-1.15)<1e-12&&at(3.001)===1);
 ch.x=20;ch.y=20;

 const ch2=put46('chinook',me,20.2,20);
 ok('T27.D a second carrier adds nothing - the aura does not stack',Math.abs(dmgBonus(g)-1.15)<1e-12);
 drop46(ch2);

 const veh=put46('jeep',me,20,20),tk=put46('tank',me,20,20);
 ok('T27.D it steadies infantry and nothing else',dmgBonus(veh)===1&&dmgBonus(tk)===1);
 drop46(veh);drop46(tk);

 ch.hp=0;
 ok('T27.D a wreck steadies nobody',dmgBonus(g)===1);
 ch.hp=ch.mhp;

 const foeCh=put46('chinook',foe,20,20);
 ch.x=80;ch.y=80;
 ok('T27.D an enemy carrier is no help at all',dmgBonus(g)===1);
 const wasTeam=foe.team;foe.team=me.team;
 ok('T27.D a team-mate\u2019s carrier is',Math.abs(dmgBonus(g)-1.15)<1e-12);
 foe.team=wasTeam;drop46(foeCh);
 ch.x=20;ch.y=20;

 {
  const b=makeBuilding('dump',me,Math.floor(g.x)+1,Math.floor(g.y)+1);b.prog=1;b.upg=false;
  ok('T27.D the Munitions Dump and the Chinook stack multiplicatively',
     Math.abs(dmgBonus(g)-1.15*1.15)<1e-12);
  b.upg=true;
  ok('T27.D ...and an upgraded Dump stacks the same way',Math.abs(dmgBonus(g)-1.30*1.15)<1e-12);
  const i=G.blds.indexOf(b);if(i>=0)G.blds.splice(i,1);
  const j=me.blds.indexOf(b);if(j>=0)me.blds.splice(j,1);
 }

 {
  fresh46(460005);
  const p1=G.human,p2=G.players.filter(p=>p!==G.human)[0];
  const shoot=withCarrier=>{
   const a=put46('grunt',p1,40,40),d=put46('grunt',p2,41,40);
   let c=null;if(withCarrier)c=put46('chinook',p1,40,40);
   a.cool=0;const h0=d.hp;fireAt(a,d);const got=h0-d.hp;
   drop46(a);drop46(d);if(c)drop46(c);
   return got;
  };
  const bare=shoot(false),buffed=shoot(true);
  ok('T27.D a rifle shot fired under the rotors really does land 15% harder',
     bare>0&&Math.abs(buffed/bare-1.15)<1e-9);
 }

 ok('T27.D dmgBonus stays pure - no wall clock, no Math.random, no hypot',
    ['Math.random','Math.hypot','Math.atan2','Math.sin(','Math.cos(','Date.now','performance.now']
      .every(b=>dmgBonus.toString().indexOf(b)<0));
 ok('T27.D the aura is table data, so nothing new is hashed or serialized',
    hashState.toString().indexOf('aura')<0&&
    (function(){const all=saveState();return all.indexOf('"aura"')<0&&all.indexOf('"auraR"')<0;})());
}

/* ---------- E: the shield stayed with the APC ---------- */
{
 fresh46(460006);
 const me=G.human;
 ok('T27.E only the APC carries the shield flag',
    U.apc.shield===1&&!U.chinook.shield&&Object.keys(U).filter(k=>U[k].shield).length===1);
 ok('T27.E the gate reads the flag, not the troop bay',
    applyDmg.toString().indexOf('tgt.t.shield')>0&&applyDmg.toString().indexOf('c.t.shield')>0&&
    applyDmg.toString().indexOf('tgt.t.cap')<0&&applyDmg.toString().indexOf('c.t.cap')<0);
 {
  const apc=put46('apc',me,50,50),h0=apc.hp;applyDmg(apc,40,'b',null);
  ok('T27.E an APC still takes 25% less, exactly as in v45',Math.abs((h0-apc.hp)-30)<.01);
  const g=put46('grunt',me,50.5,50),g0=g.hp;applyDmg(g,40,'b',null);
  ok('T27.E ...and still shelters the infantry beside it',Math.abs((g0-g.hp)-30)<.01);
  drop46(apc);drop46(g);
 }
 {
  const ch=put46('chinook',me,60,60),h0=ch.hp;applyDmg(ch,40,'b',null);
  ok('T27.E the Chinook takes full damage: no inherited shield',Math.abs((h0-ch.hp)-40)<.01);
  const g=put46('grunt',me,60.5,60),g0=g.hp;applyDmg(g,40,'b',null);
  ok('T27.E ...and shelters nobody either',Math.abs((g0-g.hp)-40)<.01);
 }
}

/* ---------- F: bots leave it alone ---------- */
{
 /* v86: the exclusion list stopped being a chain of name tests inside aiTick and
    became a read of AI_SUPPORT, which is the table that already answered the
    question - two hand-typed copies of four keys would have silently called the
    Command Truck and the Observation Balloon line fighters. The check follows the
    fact rather than the spelling: ask the table, and assert the combat pick really
    consults it rather than merely having it in scope. */
 ok('T27.F the transport is on the AI production exclusion list',
    !!AI_SUPPORT.chinook&&aiTick.toString().indexOf('AI_SUPPORT[k]')>0);
 let built=0,blueSeen=false;
 for(const seed of [460101,460102]){
  G=null;newGame({map:'backyard',mode:'dm',diff:'hard',fac:'green',opp:3,seed:seed});
  const blue=G.players.filter(p=>p.fac==='blue'&&p.ai)[0];
  if(blue){blueSeen=true;blue.tech.add('b_helipad');blue.tech.add('u_chinook');}
  run(2700);
  for(const p of G.players)if(p.ai){
   built+=p.units.filter(u=>u.key==='chinook').length;
   for(const b of p.blds)built+=(b.queue||[]).filter(q=>q.k==='chinook').length;
  }
 }
 ok('T27.F a Blue bot handed the tech and 90 seconds never fields or queues one',blueSeen&&built===0);
}

/* ---------- G: generated counter text, on every surface ---------- */
{
 ok('T27.G counterLine returns two filled lines for everything in the game',
    Object.keys(U).every(k=>{const l=counterLine('unit',k);return l.length===2&&!!l[0]&&!!l[1]})&&
    Object.keys(B).every(k=>{const l=counterLine('bld',k);return l.length===2&&!!l[0]&&!!l[1]}));
 ok('T27.G an unarmed unit says so instead of inventing a bonus',
    counterLine('unit','chinook')[0]==='Unarmed'&&counterLine('unit','truck')[0]==='Unarmed'&&
    counterLine('unit','apc')[0]==='Unarmed'&&counterLine('bld','turbine')[0]==='Unarmed');
 ok('T27.G the paratrooper is described by all three munitions, not just its SMG',
    counterLine('unit','para')[0].indexOf('SMG')>=0&&counterLine('unit','para')[0].indexOf('AT')>=0&&
    counterLine('unit','para')[0].indexOf('HE')>=0);
 ok('T27.G every second line opens with the thing\u2019s own armor class',
    Object.keys(U).every(k=>counterLine('unit',k)[1].indexOf('Armor '+ARMOR_SHORT[armorOf({kind:'unit',t:U[k]})])===0)&&
    Object.keys(B).every(k=>counterLine('bld',k)[1].indexOf('Armor Buildings')===0));
 {
  let bad=[];
  for(const k in U){
   const t=U[k];if(!t.dm||!t.w||k==='para'||t.aaOnly)continue; // v51: an air-only unit prints its own line, like the para; T32 checks that one
   const line=counterLine('unit',k)[0];
   const best=counterScan(k,t.w,true)[0],worst=counterScan(k,t.w,false)[0];
   if(best&&line.indexOf(ARMOR_SHORT[best[0]]+' \u00d7'+cMul(best[1]))<0)bad.push(k+' strong');
   if(worst&&line.indexOf(ARMOR_SHORT[worst[0]]+' \u00d7'+cMul(worst[1]))<0)bad.push(k+' weak');
  }
  ok('T27.G the printed multipliers come straight from dmgMulFor'+(bad.length?' ('+bad.slice(0,4).join(', ')+')':''),
     bad.length===0);
 }
 ok('T27.G a rocket trooper reads as the armor answer and a rifleman does not',
    counterLine('unit','bazooka')[0].indexOf('Heavy \u00d71.76')>0&&
    counterLine('unit','grunt')[0].indexOf('Weak: ')>=0&&
    counterLine('unit','grunt')[0].indexOf('Heavy \u00d70.6')>0);
 ok('T27.G the armor line reads the table down a column, not off a hand-written list',
    counterLine('unit','tank')[1].indexOf('Rockets \u00d7'+cMul(WVA.r.heavy))>0&&
    counterLine('unit','grunt')[1].indexOf('Flame \u00d7'+cMul(WVA.f.inf))>0&&
    counterLine('unit','heli')[1].indexOf('Rockets \u00d7'+cMul(WVA.r.air))>0);
 ok('T27.G each line is capped so a tooltip stays glanceable',
    Object.keys(U).every(k=>counterLine('unit',k).every(l=>l.length<=115))&&
    Object.keys(B).every(k=>counterLine('bld',k).every(l=>l.length<=115)));
 ok('T27.G the retired hand-written bonus text is gone from every description',
    Object.keys(U).every(k=>(U[k].d||'').indexOf('(+ vs')<0));

 fresh46(460007);
 {
  const me=G.human,hq=me.blds.filter(b=>b.key==='hq')[0];
  /* v71: #prodBtns holds .grp COLUMNS; the tiles are one level down. Walking
     .children rather than querySelectorAll, which the shim stubs to a bare []. */
  const walk71=(el,out)=>{for(const c of (el.children||[])){
    if(String(c.className||'').split(' ')[0]==='tl')out.push(c);walk71(c,out)}return out};
  /* a named column's tiles. grp() lays each column out as [.gsub header,.gitems]. */
  const col71=(head)=>{
   for(const col of (document.getElementById('prodBtns').children||[])){
    const kids=col.children||[];
    if(kids[0]&&kids[0].textContent===head)return walk71(kids[1]||{children:[]},[]);
   }
   return [];
  };
  /* the shim's innerHTML is a plain property, so refreshSelPanel's `pb.innerHTML=''`
     does NOT detach anything and columns ACCUMULATE across refreshes. Clear for real
     before reading, or the first stale column is what gets measured. */
  const wipe71=()=>{const pb=document.getElementById('prodBtns');
    while(pb.children.length)pb.removeChild(pb.children[0])};
  /* v72: the standing Construct panel is retired, so the structure roster is read
     where it now lives - the HQ's Construct column. BY COLUMN, not by walking the
     whole panel: the HQ also trains a Truck, and a unit tile says 'Armor
     Infantry' where a structure tile says 'Armor Buildings'. */
  setSel([hq]);wipe71();lastSelSig='';refreshSelPanel();
  const tips=col71('Construct').map(c=>c.title||'');
  ok('T27.G every structure build tile carries its counter lines',
     tips.length>0&&tips.every(t=>t.indexOf('Armor Buildings')>0));
  ok('T27.G the Construct column is the full roster, not a stub',
     tips.length===constructRoster('hq').length);

  const bar=makeBuilding('barracks',me,Math.floor(hq.x)+4,Math.floor(hq.y)+4);bar.prog=1;
  setSel([bar]);wipe71();lastSelSig='';refreshSelPanel();
  /* v102 REWRITTEN, not loosened. Through v101 a train tile carried its counter
     facts as two lines inside the native `title` string, and this read them there.
     The stat card replaced that surface outright - a tile with a card sets NO
     title, because a native tooltip firing under a custom one is two tooltips for
     one hover - so the old assertion was testing a mechanism the game no longer
     uses. The CLAIM is unchanged and is what is checked here: every unit a
     building trains still carries its counter facts, and they are still derived
     from the same two tables rather than written out. Structure tiles keep their
     titles and their own check above, which is why that one still reads `title`. */
  const ptiles=walk71(document.getElementById('prodBtns'),[]).filter(c=>c.dataset&&c.dataset.card==='1');
  ok('T27.G every unit a building trains carries them on its train button - as the v102 card',
     ptiles.length>0&&fullRoster(me,'barracks').every(k=>{
       const h=unitCard(k,{p:me});
       return h.indexOf('ucp ucd')>0&&h.indexOf('ucp uct')>0;
     }));
  ok('T27.G ...and the tile drops the title rather than carrying both',
     ptiles.every(c=>!c.title));
  ok('T27.G a research card explains what it unlocks in the same terms',
     techTip('u_bazooka').indexOf('Armor Infantry')>0&&techTip('u_chinook').indexOf('Unarmed')>0&&
     techTip('b_guardtower').indexOf('Armor Buildings')>0&&techTip('b_generator')==='');
  ok('T27.G a selected structure prints them under its description',
     (document.getElementById('selInfo').innerHTML||'').indexOf('Armor Buildings')>0);

  const g=put46('grunt',me,Math.floor(hq.x)+6,Math.floor(hq.y)+6);
  setSel([g]);lastSelSig='';refreshSelPanel();
  const info=document.getElementById('selInfo').innerHTML||'';
  /* v102: same rewrite, same reason - the two text lines under a unit's
     description became the card. The facts are asserted through the card's own
     numbers: what a Grunt does to heavy armour, and the weapon that beats his. */
  ok('T27.G a selected unit prints them under its description - as the v102 card',
     info.indexOf(U.grunt.d)>0&&info.indexOf('ucp ucd')>0&&info.indexOf('ucp uct')>0&&
     info.indexOf('×'+dmgMulFor('grunt','b','heavy').toFixed(2))>0&&
     info.indexOf(WC_LABEL[armorScan('inf',true)[0][0]])>0);
  ok('T27.G ...while a BUILDING still prints the two lines, which is why they stay',
     (()=>{setSel([hq]);lastSelSig='';refreshSelPanel();
       return (document.getElementById('selInfo').innerHTML||'').indexOf('Armor Buildings')>0})());
 }
 ok('T27.G the info card still reads the same lookup, and states the transport rules',
    counterList('bazooka','r',true).indexOf(ARMOR_LABEL.heavy)>=0&&
    infoStatsHtml('unit','chinook').indexOf('Transports 15 infantry')>0&&
    infoStatsHtml('unit','chinook').indexOf('deal 15% more damage')>0&&
    infoStatsHtml('unit','apc').indexOf('Shields itself')>0&&
    infoStatsHtml('unit','chinook').indexOf('Shields itself')<0);
}

/* ---------- H: the manual, opened mid-match ---------- */
{
 fresh46(460008);
 run(60);
 const gBefore=G,before=hashState();
 ok('T27.H the board is not redrawn behind the open panel',frame.toString().indexOf('if(!INFO.open)render()')>0);
 let threw=null;
 try{
  openInfo();
  ok('T27.H it opens without disturbing the match',INFO.open===true&&G===gBefore&&hashState()===before);
  ok('T27.H the close button reads for a match, not for the menu',
     (document.getElementById('infoClose').textContent||'').indexOf('Close')>0);
  /* v88.1 RETIRED this behaviour deliberately. A shared unit is shared, and
     painting the Grunt in whichever army happens to be selected made the manual
     say something about ownership that is not true. The gallery draws one colour
     for "anyone can build this" and the owning army's colour for "only they can",
     which is the distinction it exists to draw. The mid-match behaviour that DOES
     survive is the one that matters - the panel opens over a live match without
     disturbing it, which the lines around this one check. */
  ok('T27.H a shared unit is Green whoever is reading it, not the reader\u2019s own army',
     infoFacOf('unit','grunt')==='green'&&INFO_COMMON_FAC==='green');
  ok('T27.H ...while an exclusive still shows in its OWN army\u2019s colours',
     infoFacOf('unit','sniper')==='gray'&&infoFacOf('unit','runner')==='blue'&&
     infoFacOf('bld','foundry')==='tan'&&infoFacOf('bld','cmdpost')==='green');
  infoShowTab('units');infoSelect('unit','chinook');
  ok('T27.H the Chinook has a card of its own in the grid',
     INFO.key==='chinook'&&!!INFO.fake&&INFO.fake.t===U.chinook);
  infoLoop();infoLoop();
  ok('T27.H the preview loop hands the real G back every time',G===gBefore&&G!==INFO.stub);
  infoShowTab('blds');infoShowTab('controls');infoShowTab('units');
 }catch(e){threw=e.message}
 ok('T27.H opening, drawing and tabbing through it mid-match throws nothing',threw===null);
 run(30);
 closeInfo();
 ok('T27.H closing puts the board back',INFO.open===false&&G===gBefore);
 const after=hashState();
 run(30);
 ok('T27.H the simulation ran the whole time it was open',after!==before&&hashState()!==after);
}

/* ---------- I: determinism + save/load with a loaded Chinook in the air ---------- */
{
 const stage=function(){
  G=null;newGame(cfg46('kitchen','dm',460009,1));
  const me=G.players[0],foe=G.players[1];
  const put=(k,p,x,y)=>{const u=makeUnit(k,p,x,y);u.state='idle';u.anchor={x,y};return u};
  const cx=G.map.N/2,cy=G.map.N/2;
  const ch=put('chinook',me,cx-6,cy);
  const sq=[];for(let i=0;i<6;i++)sq.push(put('grunt',me,cx-5.6+i*.05,cy));
  submitCmd('garrison',{ids:sq.map(u=>u.id),bid:ch.id,x:ch.x,y:ch.y});execCmds();
  for(let i=0;i<90;i++)update(DT46);
  ['gunner','bazooka','flamer'].forEach((k,i)=>put(k,me,cx-5,cy-1+i*.8));
  ['tank','jeep'].forEach((k,i)=>put(k,foe,cx+3,cy-1+i));
  orderMove(ch,cx+2,cy,false);
  for(const u of me.units)if(u.t.dm)orderMove(u,cx+3,cy,true);
  for(const u of foe.units)if(u.t.dm)orderMove(u,cx-3,cy,true);
  return ch;
 };
 const trail=n=>{const t=[];for(let i=1;i<=n;i++){update(DT46);if(i%40===0)t.push(hashState())}return t};
 const c1=stage();
 ok('T27.I the transport went up loaded',c1.garrison.length===6&&c1.t.fly===1);
 const a=trail(600);
 stage();const b=trail(600);
 ok('T27.I a fight fought under the rotors is deterministic across two runs',
    a.length===b.length&&a.every((h,i)=>h===b[i]));
 ok('T27.I ...and something actually happened',a.some((h,i)=>i&&h!==a[i-1]));

 stage();trail(240);
 const snap=saveState(),h0=hashState();
 const cont=trail(200);
 loadState(snap);
 ok('T27.I save/load restores the identical state, bay and all',hashState()===h0);
 const ch2=G.units.filter(u=>u.key==='chinook')[0];
 ok('T27.I the loaded bay survived the round trip',
    !ch2||ch2.garrison.every(u=>u.garrisoned&&Math.abs(u.x-ch2.x)<.01));
 const cont2=trail(200);
 ok('T27.I ...and resumes on the identical trail',cont.length===cont2.length&&cont.every((h,i)=>h===cont2[i]));
 ok('T27.I the snapshot carries a v46-or-later tag',parseFloat(JSON.parse(snap).v)>=46);
}
