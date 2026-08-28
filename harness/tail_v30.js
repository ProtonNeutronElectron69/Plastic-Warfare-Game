/* tail_v30.js — T11: v30 suite.
   Rescale (one effective factor 300/602 on units/buildings/wildlife/strikes),
   Apache & Huey bonuses, paratrooper munitions, APC transport (load/unload/
   aura/bail-out/serialization), radio tower (vision-gated call-downs, shared
   180s cooldown, build limit, sell), napalm buff (coverage + burn), scripted
   determinism, and snapshot round-trips of the new state. */
'use strict';
section('T11 v30: rescale / Apache / Huey / APC / radio tower / paratroopers');

/* ================= static tables: the one-factor rescale ================= */
ok('T11 radio operator unit removed',!U.radio);
ok('T11 v42: bulltank tops units at 330 effective HP',U.bulltank.hp===330);
ok('T11 v42: grunt 48 effective HP',U.grunt.hp===48);
ok('T11 v42: tank 207 effective HP',U.tank.hp===207);
ok('T11 HQ 748 HP',B.hq.hp===748);
ok('T11 bunker 409 HP',B.bunker.hp===409);
ok('T11 turbine 130 HP',B.turbine.hp===130);
ok('T11 barricade 50 / nest 140',BARR_HP===50&&NEST_HP===140);
ok('T11 wildlife rescaled (v37 +20%)',CREATURE.ant.hp===24&&CREATURE.bee.hp===15);
// v42 Option B decouples the two: unit hp +10% (1.4->1.54), unit dmg -10% (0.9->0.81),
// so vs the v29 baseline (86.8 hp / 5.4 dm) the grunt hp/dmg ratio is now 1.1/0.9.
{const rH=U.grunt.hp/86.8,rD=U.grunt.dm/5.4;
 ok('T11 v42: hp +10% / dmg -10% split (ratio 1.1/0.9)',Math.abs(rH/rD-1.1/0.9)<0.02);}
ok('T11 v42: new units land on approved effective stats',
   U.apache.hp===187&&U.apc.hp===220&&U.para.hp===132&&B.radiotower.hp===293);
ok('T11 v42: apache effective ~27 dmg (-10%)',Math.abs(U.apache.dm-27)<0.05);
ok('T11 radio tower inverted cost + limit (ce 200 -> 230 at v65)',B.radiotower.cp===60&&B.radiotower.ce===230&&B.radiotower.lim===1);
ok('T11 shared cooldown is 180s',RADIO_CD===180);
ok('T11 rosters updated',!B.barracks.prod.includes('radio')&&B.garage.prod.includes('apc')&&B.helipad.prod.includes('apache'));
ok('T11 lab offers the tower',LAB_ORDER.includes('b_radiotower')&&!!RESEARCH.b_radiotower&&!!RESEARCH.u_apache&&!!RESEARCH.u_apc);
ok('T11 heli renamed Huey',U.heli.n==='Huey');
ok('T11 APC oversized + 10-man bay',U.apc.rad===.46&&U.apc.cap===10);
ok('T11 sprite scale entries live',uScale({key:'apache'})===1.18&&uScale({key:'apc'})===1.15&&uScale({key:'para'})===.85);

/* ================= damage-bonus matrix + munition select ================= */
{const mkA=k=>({kind:'unit',key:k,t:U[k]});
 const tInf={kind:'unit',t:{a:'inf'}},tTank={kind:'unit',t:{a:'tank'}},
       tHeli={kind:'unit',t:{a:'heli',fly:1}},tBld={kind:'bld',t:{}};
 /* v45 re-pin: these five per-key exceptions became rows of the counter matrix, so the
    v30 identities are re-stated against it. mkA now carries t so wcOf can read t.w, and
    the paratrooper is asked per munition because one key now fires three rows. */
 ok('T11 apache rockets still crack armor & rotors, still not infantry',
    targetDmgMul(mkA('apache'),tTank)===1.5&&targetDmgMul(mkA('apache'),tHeli)===1.3&&targetDmgMul(mkA('apache'),tInf)===0.7);
 ok('T11 huey +30% vs infantry only',
    targetDmgMul(mkA('heli'),tInf)===1.3&&targetDmgMul(mkA('heli'),tTank)===0.6);
 ok('T11 para keeps a bonus on all three munitions',
    targetDmgMul(mkA('para'),tInf,'b')===1.3&&targetDmgMul(mkA('para'),tTank,'r')===1.5&&targetDmgMul(mkA('para'),tBld,'d')===1.25);
 ok('T11 bazooka/flamer bonuses carried forward, larger (bazooka vs heavy 1.60 -> 1.76 at v51)',
    targetDmgMul(mkA('bazooka'),tTank)===1.76&&targetDmgMul(mkA('flamer'),tInf)===1.35);
 ok('T11 munition auto-select',
    paraMun(tBld)===PARA_MUN.he&&paraMun(tTank)===PARA_MUN.at&&paraMun(tInf)===PARA_MUN.smg&&paraMun(null)===PARA_MUN.smg);
 ok('T11 HE charge is the slow long-cycle throw',PARA_MUN.he.gsp<PARA_MUN.at.gsp&&PARA_MUN.he.rt>PARA_MUN.at.rt&&PARA_MUN.he.k===7.5);}

/* ================= runtime: radio tower call-downs =================
   v87: THIS BLOCK IS TAN NOW, and the change is forced rather than cosmetic. The
   Napalm Strike left the shared pool at v87 and belongs to Tan alone, so a Green
   tower is refused it at the command door and every napalm check below would have
   been testing the refusal instead of the strike. Tan carries the same hp mod as
   Green (x1), so the 293 HP the tower is pinned at is unmoved, and nothing else in
   the block reads the faction. The refusal itself is asserted on its own, just
   below, so the reason this fixture changed army is a checked fact rather than a
   note in a comment. */
G=null;newGame(cfg('backyard','dm','normal','tan',3,909001));G.dayOff=0; /* v101: this fixture asserts daytime vision facts - pin the clock to noon */
const hu=G.human;
const rt2=makeBuilding('radiotower',hu,Math.floor(hu.blds[0].tx)+5,Math.floor(hu.blds[0].ty),true);
ok('T11 tower builds at 293 HP (tan mods hp x1, as green\'s was)',rt2.prog>=1&&rt2.mhp===293&&rt2.abilityCool===0);
// find a genuinely fogged point for the vision gate
let fx=-1,fy=-1;
outer:for(let y=4;y<G.map.N-4;y+=6)for(let x=4;x<G.map.N-4;x+=6){if(!pVision(hu,x,y)){fx=x;fy=y;break outer;}}
ok('T11 found a fogged test point',fx>=0);
const s0=G.strikes.length;
submitCmd('radio',{bid:rt2.id,mode:'napalm',x:fx,y:fy});execCmds();
ok('T11 fogged napalm rejected by the sim',G.strikes.length===s0&&rt2.abilityCool<=0);
submitCmd('radio',{bid:rt2.id,mode:'napalm',x:rt2.x+3,y:rt2.y+3});execCmds();
ok('T11 in-vision napalm fires + 180s shared cooldown',G.strikes.length===s0+1&&Math.abs(rt2.abilityCool-RADIO_CD)<0.5);
{const s=G.strikes[G.strikes.length-1];
 ok('T11 napalm covers ~70% of the 10x10 with a burn list',s.kind==='napalm'&&s.cells.length>=55&&s.cells.length<=85&&Array.isArray(s.burn));}
/* v87: and the other half of the same fact - the army that no longer owns it is
   refused at the command door, not merely left out of the panel. */
{const g2=G.players.find(p2=>p2!==hu&&p2.fac!=='tan');
 if(!g2)ok('T11 a non-Tan army was fielded to test the napalm refusal against',false);
 else{
  const gt=makeBuilding('radiotower',g2,Math.floor(g2.start.x)+4,Math.floor(g2.start.y)+4,true);
  gt.prog=1;gt.hp=gt.mhp;gt.abilityCool=0;
  const n0=G.strikes.length;
  execCmd({op:'radio',pi:g2.i,a:{bid:gt.id,mode:'napalm',x:gt.x+2,y:gt.y+2}});
  ok('T11 v87: a non-Tan tower is refused the napalm at the command door',
     G.strikes.length===n0&&gt.abilityCool===0);
 }}
submitCmd('radio',{bid:rt2.id,mode:'paradrop',x:rt2.x,y:rt2.y+6});execCmds();
ok('T11 cooldown blocks a second call',G.strikes.length===s0+1);
G.strikes.length=0; // clear the live strike so the burn does not muddy later checks
rt2.abilityCool=0;
const uc0=hu.units.length;
submitCmd('radio',{bid:rt2.id,mode:'paradrop',x:rt2.x,y:rt2.y+6});execCmds();
run(60);
{const paras=hu.units.filter(u2=>u2.key==='para');
 ok('T11 paradrop lands 5 Paratroopers',paras.length===5&&hu.units.length===uc0+5);
 ok('T11 v42: paratrooper drops below the sarge (nerfed 25%)',paras.length>0&&paras[0].mhp===U.para.hp&&U.sarge.hp>U.para.hp);}
// napalm + burn chew an enemy structure over ~3s
{const foe=G.players.find(p2=>p2!==hu);
 const fb=makeBuilding('generator',foe,Math.floor(rt2.x)+7,Math.floor(rt2.y)+3,true);
 rt2.abilityCool=0;
 submitCmd('radio',{bid:rt2.id,mode:'napalm',x:fb.x,y:fb.y});execCmds();
 const hp0=fb.hp;run(90);
 ok('T11 buffed napalm + burn chew a structure',fb.hp<hp0-40);
 G.strikes.length=0;}

/* ================= runtime: APC transport ================= */
const apc=makeUnit('apc',hu,rt2.x+2,rt2.y+4);
ok('T11 fresh APC has an empty bay + big radius',Array.isArray(apc.garrison)&&apc.garrison.length===0&&unitRad(apc)===.46);
const sq=[];for(let i=0;i<3;i++)sq.push(makeUnit('grunt',hu,apc.x+2+i*.5,apc.y));
submitCmd('garrison',{ids:sq.map(u2=>u2.id),bid:apc.id,x:apc.x,y:apc.y});execCmds();
run(150);
ok('T11 squad boards the APC via the garrison command',apc.garrison.length===3&&sq.every(u2=>u2.garrisoned));
run(10);
ok('T11 occupants ride position-synced',sq.every(u2=>Math.abs(u2.x-apc.x)<.01&&Math.abs(u2.y-apc.y)<.01));
// shield: -25% on the carrier itself
{const ah0=apc.hp;applyDmg(apc,40,'b',null);
 ok('T11 APC takes 25% less damage',Math.abs((ah0-apc.hp)-30)<.01);}
// shield: nearby own infantry -25%, distant infantry full damage
{const near=makeUnit('grunt',hu,apc.x+1,apc.y),farg=makeUnit('grunt',hu,apc.x+20,apc.y+20);
 const nh0=near.hp,fh0=farg.hp;applyDmg(near,20,'b',null);applyDmg(farg,20,'b',null);
 ok('T11 aura shields nearby infantry only (non-stacking single x.75)',
    Math.abs((nh0-near.hp)-15)<.01&&Math.abs((fh0-farg.hp)-20)<.01);
 kill(near);kill(farg);}
// unload command empties the bay
submitCmd('unloadu',{ids:[apc.id]});execCmds();
ok('T11 unload empties the bay',apc.garrison.length===0&&sq.every(u2=>!u2.garrisoned));
// destroyed APC bails the squad out at 85% of current HP
submitCmd('garrison',{ids:sq.map(u2=>u2.id),bid:apc.id,x:apc.x,y:apc.y});execCmds();run(150);
ok('T11 squad re-boards for the crash test',apc.garrison.length===3);
sq.forEach(u2=>{u2.hp=u2.mhp});
apc.hp=5;applyDmg(apc,999,'b',null);
ok('T11 destroyed APC bails the squad at 85% HP',
   !G.units.includes(apc)&&sq.every(u2=>!u2.garrisoned&&G.units.includes(u2)&&Math.abs(u2.hp-u2.mhp*0.85)<.01));

/* ================= build limit + sell ================= */
hu.tech.add('b_radiotower');hu.res.p=800;hu.res.e=800;
{const n0=hu.blds.filter(b2=>b2.key==='radiotower').length;
 submitCmd('build',{key:'radiotower',tx:Math.floor(hu.blds[0].tx)+9,ty:Math.floor(hu.blds[0].ty)});execCmds();
 ok('T11 second tower rejected by the limit',hu.blds.filter(b2=>b2.key==='radiotower').length===n0&&n0===1);}
{const pv=hu.res.p,half=Math.round(bcost(hu,'radiotower').p*0.5);
 submitCmd('sell',{bid:rt2.id});execCmds();
 ok('T11 tower sells for 50% plastic',!G.blds.includes(rt2)&&hu.res.p===pv+half);
 ok('T11 tower panel source gone after the sell',!myRadioTower());}

/* ================= paratrooper munitions in live fire ================= */
G=null;newGame(cfg('backyard','dm','normal','green',3,909003));
{const hu4=G.human,foe4=G.players.find(p2=>p2!==hu4);
 const pa=makeUnit('para',hu4,30,30);
 const eb=makeBuilding('generator',foe4,31,30,true);
 pa.target=eb;pa.state='attack';run(8);
 ok('T11 para lobs the slow HE charge at structures',
    pa.cool>3.5||G.projs.some(pr=>pr.owner===pa&&pr.grenade&&pr.sp<6));
 const et=makeUnit('tank',foe4,33,36);et.state='idle';et.target=null;
 const pa2=makeUnit('para',hu4,32,36);
 pa2.target=et;pa2.state='attack';run(8);
 ok('T11 para AT grenade cycle vs armor',pa2.cool>1.5&&pa2.cool<=2.2);
 const ei=makeUnit('grunt',foe4,35,40);ei.state='idle';ei.target=null;
 const pa3=makeUnit('para',hu4,34.6,40);
 pa3.target=ei;pa3.state='attack';run(4);
 ok('T11 para SMG fast cycle vs infantry',pa3.cool>0&&pa3.cool<=0.351);}

/* ================= scripted determinism with every v30 feature ================= */
{const trail30=seed=>{
  G=null;newGame(cfg('backyard','dm','normal','green',3,seed));
  const h2=G.human;
  const b2=makeBuilding('radiotower',h2,Math.floor(h2.blds[0].tx)+5,Math.floor(h2.blds[0].ty),true);
  const a2=makeUnit('apc',h2,b2.x+2,b2.y+3);
  const g2=[];for(let i=0;i<2;i++)g2.push(makeUnit('grunt',h2,a2.x+1+i,a2.y));
  submitCmd('garrison',{ids:g2.map(u2=>u2.id),bid:a2.id,x:a2.x,y:a2.y});
  submitCmd('radio',{bid:b2.id,mode:'napalm',x:b2.x+3,y:b2.y+3});
  const t=[];for(let i=1;i<=600;i++){update(DT);if(i%30===0)t.push(hashState())}
  return t;};
 const dA=trail30(313131),dB=trail30(313131);
 ok('T11 v30 features deterministic (20 checkpoints)',dA.length===20&&dA.every((h,i)=>h===dB[i]));}

/* ================= snapshot round-trip of the new state ================= */
G=null;newGame(cfg('kitchen','dm','normal','tan',3,909002));
{const hu3=G.human;
 const b3=makeBuilding('radiotower',hu3,Math.floor(hu3.blds[0].tx)+5,Math.floor(hu3.blds[0].ty),true);
 b3.abilityCool=133.5;
 const a3=makeUnit('apc',hu3,b3.x+2,b3.y+3);
 const g3=[makeUnit('grunt',hu3,a3.x+1,a3.y),makeUnit('grunt',hu3,a3.x+1.5,a3.y)];
 submitCmd('garrison',{ids:g3.map(u2=>u2.id),bid:a3.id,x:a3.x,y:a3.y});run(150);
 ok('T11 pre-save: squad aboard',a3.garrison.length===2);
 const snap=saveState(),h0=hashState();
 ok('T11 snapshot tag is monotonic v>=30',JSON.parse(snap).v>=30);
 run(30);
 loadState(snap);
 ok('T11 load restores the exact hash (abilityCool included)',hashState()===h0);
 const a3b=G.units.find(u2=>u2.key==='apc');
 ok('T11 APC bay survives the round-trip',!!a3b&&a3b.garrison.length===2&&a3b.garrison.every(u2=>u2.garrisoned));
 const b3b=G.blds.find(x2=>x2.key==='radiotower');
 // v30.1: the shared cooldown now (correctly) ticks on the tower, so the pre-save
 // run(150) burns 5s off the 133.5 that this test plants. Keyed monotonically on
 // the snapshot tag so the check holds on both sides of the fix.
 const cdExp=JSON.parse(snap).v>=30.1?128.5:133.5;
 ok('T11 tower cooldown survives the round-trip',!!b3b&&Math.abs(b3b.abilityCool-cdExp)<1.01);
 run(60);
 ok('T11 resumed sim stays clean',!boundsOK());}
