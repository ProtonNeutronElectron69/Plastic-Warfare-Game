/* tail_v40.js - T20: v40 miscellaneous pass
   C1 clickable resource piles (visible-only) + amount-remaining readout
   C2 APC speed lowered to grunt speed (2.3)
   C3 guard tower / radio tower / generator retinted mostly team color
   C4 tank turret aims where it fires (single swivel, was a double rotation)
   C5 death salvage 34% for units, buildings, and now barricades (nests still excluded) */
'use strict';
section('T20 v40: clickable piles + APC speed + team-color towers + turret aim + 34% salvage');

/* ---------- C1: clickable resource piles ---------- */
{
 let boot=null;try{G=null;newGame(cfg('backyard','dm','normal','green',3,940100));}catch(e){boot=e;}
 ok('T20.1 boot for pile-selection tests',!boot);
 run(10); // updateFog() runs on a %5 tick cadence; advance so start vision is established
 const info=document.getElementById('selInfo');

 // a plastic pile that is currently in vision (fog level 2)
 const vis=(G.map.nodes||[]).filter(n=>!n.wreck&&n.t==='plastic'&&fogAt(n.x,n.y)===2);
 ok('T20.1 at least one plastic pile is in current vision',vis.length>0);
 if(vis.length){
  const n=vis[0];
  n.kind='node'; // pickAt() tags the node before returning it; selection only ever reaches a pile this way
  const h0=hashState();
  let selErr=null;try{setSel([n]);}catch(e){selErr=e;}
  ok('T20.1 selecting a pile does not throw',!selErr);
  ok('T20.1 selected pile is flagged sel',n.sel===true);
  ok('T20.1 selection is client-local (hashState unchanged)',hashState()===h0);
  const html=info.innerHTML||'';
  ok('T20.1 panel names the pile',/Plastic Pile/.test(html));
  ok('T20.1 panel shows amount remaining',/remaining/.test(html)&&html.indexOf(''+Math.ceil(n.amt))>=0);
  ok('T20.1 panel shows the max',html.indexOf(''+Math.round(n.max))>=0);
  // panel re-renders as the pile drains (signature keys on amount)
  n.amt=Math.max(0,n.amt-137);refreshSelPanel();
  ok('T20.1 readout tracks the falling amount',(info.innerHTML||'').indexOf(''+Math.ceil(n.amt))>=0);
  // rendering with a pile selected exercises the ring + floating label path
  let rErr=null;try{render();}catch(e){rErr=e;}
  ok('T20.1 render() clean with a pile selected',!rErr);
  // mining a pile out drops it from the selection so the panel can't show a dead node
  removeNode(n);
  ok('T20.1 mined-out pile leaves the selection',!G.sel.includes(n));
 }

 // battery readout branch (craft a battery node so the test is deterministic across maps)
 {
  const bn={t:'battery',x:6.5,y:6.5,amt:900,max:1400,wreck:false,kind:'node'};
  let e2=null;try{setSel([bn]);}catch(e){e2=e;}
  ok('T20.1 selecting a battery cell does not throw',!e2);
  const bhtml=info.innerHTML||'';
  ok('T20.1 battery panel reads type + amount',/Battery Cell/.test(bhtml)&&/remaining/.test(bhtml)&&bhtml.indexOf('900')>=0);
  clearSel();
 }

 // fog gate: piles outside current vision report fog != 2 (the mouseup predicate blocks their selection)
 const hidden=(G.map.nodes||[]).filter(n=>!n.wreck&&fogAt(n.x,n.y)!==2);
 ok('T20.1 gate: some piles sit outside current vision',hidden.length>0);
 ok('T20.1 gate: hidden piles all report fog != 2',hidden.every(n=>fogAt(n.x,n.y)!==2));
}

/* ---------- C2: APC speed == grunt speed ---------- */
{
 ok('T20.2 APC table speed lowered to grunt (2.3)',U.apc.sp===U.grunt.sp&&U.apc.sp===2.3);
 G=null;newGame(cfg('backyard','dm','normal','green',1,940200));
 const apc=makeUnit('apc',G.human,18,18),gr=makeUnit('grunt',G.human,19,18);
 ok('T20.2 spawned APC moves at grunt speed',Math.abs(apc.sp-gr.sp)<1e-9);
}

/* ---------- C3: guard tower / radio tower / generator -> mostly team color ---------- */
{
 // retint landed: the three targeted parts no longer carry their old black literals
 const bb=bldBody.toString(),bl=bldLive.toString();
 ok('T20.3 generator vent grille retinted to team',!bb.includes("prism(c,'#2e2e34'")&&bb.includes("prism(c,shade(col,.5)"));
 ok('T20.3 generator junction/cable retinted',!bb.includes("c.fillStyle='#33363c'")&&!bb.includes("c.strokeStyle='#26262c'"));
 ok('T20.3 radio mast/rungs retinted',!bb.includes("c.strokeStyle='#3a3a44'")&&!bb.includes("c.strokeStyle='#2c2c33'"));
 ok('T20.3 guard legs lighter/more team (AMB .42)',bb.includes('mixc(B0,AMB,.42)')&&!bb.includes('mixc(B0,AMB,.58)'));
 ok('T20.3 guard barrel less black (BLACK .28)',bl.includes('mixc(B0,BLACK,.28)')&&!bl.includes('mixc(B0,BLACK,.5)'));
 // render smoke: all three still paint (baked body + live overlay) without throwing
 const c2=document.createElement('canvas').getContext('2d');
 let drawErr=null;
 try{
  for(const k of ['generator','guardtower','radiotower'])bldBody(c2,k,FAC.green.color,B[k].sz);
  bldLive(c2,{key:'generator',sz:2,id:1,tface:0},FAC.green.color);
  bldLive(c2,{key:'guardtower',sz:1,id:2,tface:0.7},FAC.green.color);
  bldLive(c2,{key:'radiotower',sz:2,id:3,tface:0},FAC.green.color);
 }catch(e){drawErr=e;}
 ok('T20.3 retinted towers/generator paint without error',!drawErr);
}

/* ---------- C4: tank turret aims where it fires (single swivel) ---------- */
{
 const du=drawUnit.toString();
 ok('T20.4 barrel no longer self-rotates',!du.includes("c.save();c.rotate(screenAng(u.target?u.tface:u.face)-ang)"));
 ok('T20.4 turret drawn at the eased visual angle, goal = aim/hull',du.includes('screenAng(u.tvis)-ang')&&du.includes('goal=u.target?u.tface:u.face'));

 // behavioral: track the ctx transform and read the barrel's actual screen angle.
 // The barrel is drawn by plLimb(...,'#2a2a30',...); the frame at that call IS the turret frame,
 // so the local +x axis direction (M[0],M[1]) must equal screenAng(the aim).
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
  G=null;newGame(cfg('backyard','dm','normal','green',1,940300));
  const tk=makeUnit('tank',G.human,20,20);
  tk.target={x:30,y:24,hp:100,kind:'unit'};tk.face=0.3;tk.tface=1.0;tk.sel=false;tk.healedAt=null;
  // aiming at a target -> barrel points along screenAng(tface) (tvis=null lazy-inits to the goal)
  tk.tvis=null; barrelDir=null; drawUnit(tracker(),tk);
  ok('T20.4 barrel points along the fire direction (screenAng(tface))',barrelDir!==null&&angClose(barrelDir,screenAng(tk.tface)));
  // no target -> barrel rests along the body (screenAng(face))
  tk.target=null; tk.tvis=null; barrelDir=null; drawUnit(tracker(),tk);
  ok('T20.4 untargeted barrel rests along the hull (screenAng(face))',barrelDir!==null&&angClose(barrelDir,screenAng(tk.face)));
 } finally { plLimb=origPlLimb; }
}

/* ---------- C5: death salvage 34% for units, buildings, barricades ---------- */
{
 G=null;newGame(cfg('backyard','dm','normal','green',1,940500));
 // unit: a lone tank kill leaves a fresh plastic wreck worth round(cp * costMod * 0.34)
 const tk=makeUnit('tank',G.human,40,40);tk.hp=1;
 kill(tk,null);
 const wrecks=(G.map.nodes||[]).filter(n=>n.wreck&&dhyp(n.x-40,n.y-40)<3);
 const expTank=Math.round(U.tank.cp*FAC[G.human.fac].mods.cost*0.34);
 ok('T20.5 unit death drops one fresh plastic wreck',wrecks.length===1);
 ok('T20.5 unit salvage == 34% of plastic cost ('+expTank+')',wrecks.length===1&&wrecks[0].amt===expTank);
 ok('T20.5 salvage wreck is mineable plastic',wrecks.length===1&&wrecks[0].t==='plastic'&&!!wrecks[0].wreck);

 // barricade: now salvages too (was salvage-free before v40)
 const b0=(G.map.nodes||[]).filter(n=>n.wreck).length;
 const barr={key:'barricade',p:G.human,t:B.barricade,x:44.5,y:44.5,tx:44,ty:44,sz:1,hp:0,mhp:1,lastHit:'b',garrison:[]};
 G.blds.push(barr);G.human.blds.push(barr);
 kill(barr,null);
 const bw=(G.map.nodes||[]).filter(n=>n.wreck&&dhyp(n.x-44.5,n.y-44.5)<3);
 const expBarr=Math.round(B.barricade.cp*FAC[G.human.fac].mods.cost*0.34);
 ok('T20.5 barricade now leaves a salvage pile',(G.map.nodes||[]).filter(n=>n.wreck).length===b0+1&&bw.length===1);
 ok('T20.5 barricade salvage == 34% ('+expBarr+')',bw.length===1&&bw[0].amt===expBarr);

 // source: both death sites use 0.34, the old 0.5 salvage is gone, barricade branch now salvages,
 // and wildlife nests still drop nothing (their branch returns before any spawnWreck).
 const ks=kill.toString();
 ok('T20.5 unit + building salvage use 0.34',SALVAGE_FRAC===0.34&&ks.includes('mods.cost)*SALVAGE_FRAC')&&!ks.includes('mods.cost)*0.5')); // v43: reads the named constant
 ok('T20.5 barricade branch spawns a wreck',/e\.t\.barr[\s\S]*spawnWreck/.test(ks)); // v88: keyed on the flag the branch now tests
 /* v88: the slice used to end at `e.key==='barricade'`. That branch is keyed on
    t.barr now, because the Heavy Barricade joined the game and fourteen tests that
    said "the barricade" meant "a wall". An indexOf that returns -1 would have
    sliced to the END of kill() and swept the whole building teardown into the
    "nest" segment, so this is re-aimed rather than relaxed - it still measures
    exactly the span between the nest branch and the wall branch.
    The search for the wall marker starts FROM the nest marker: `!e.t.barr` also
    appears near the top of kill(), on the veterancy line, so a bare indexOf would
    find that one and slice backwards. */
 const nestAt=ks.indexOf("e.key==='nest'"), barrAt=ks.indexOf("e.t.barr",nestAt);
 const nestSeg=ks.slice(nestAt,barrAt);
 ok('T20.5 ...and the slice really found both markers, in that order',nestAt>=0&&barrAt>nestAt);
 ok('T20.5 wildlife nest branch drops no salvage',nestSeg.length>0&&!nestSeg.includes('spawnWreck'));
}

/* ---------- C-det: v40 stays internally deterministic (self-consistent) ---------- */
{
 const trail=(seed)=>{G=null;newGame(cfg('backyard','dm','normal','green',3,seed));const t=[];for(let i=1;i<=600;i++){update(DT);if(i%30===0)t.push(hashState())}return t;};
 const a=trail(940700),b=trail(940700);
 ok('T20.det dual 600-tick runs match (APC-speed + 34%-salvage active)',JSON.stringify(a)===JSON.stringify(b));

 G=null;newGame(cfg('backyard','dm','normal','green',3,940800));
 for(let i=0;i<200;i++)update(DT);
 const json=saveState();
 const trailA=[];for(let i=1;i<=200;i++){update(DT);if(i%25===0)trailA.push(hashState())}
 loadState(json);
 const trailB=[];for(let i=1;i<=200;i++){update(DT);if(i%25===0)trailB.push(hashState())}
 ok('T20.det save/load resumes on the exact same trail',JSON.stringify(trailA)===JSON.stringify(trailB));
}
