/* tail_v27.js — T7: v27 UI features.
   Minimap attack blips (spawn, cluster throttle, cap, cosmetic-only proof),
   minimap size cycling, selection portraits (count + health banding + click
   to pick), the army composition readout, and the face-fitted painter
   helpers. Pure UI/cosmetics: T2/T3 above already prove the sim is
   untouched. Runs after tail_tests/tail_expo/tail_v26. */
'use strict';
section('T7 v27: attack blips, minimap sizing, portraits, army readout');

/* ---------- T7.1 attack blips ---------- */
G=null;newGame(cfg('backyard','dm','normal','green',3,727001));run(30);
{
 ok('T7 fresh game has a blip list',Array.isArray(G.atkPings));
 const foe=G.players.find(p=>p!==G.human&&p.ai);
 const hu=makeUnit('grunt',G.human,20,20);
 const en=makeUnit('grunt',foe,21,20);
 G.atkPings.length=0;
 applyDmg(hu,3,'b',en);
 ok('T7 enemy hit on your unit spawns a blip',G.atkPings.length===1);
 applyDmg(hu,3,'b',en);
 ok('T7 same-spot follow-up hit is clustered',G.atkPings.length===1);
 const hu2=makeUnit('grunt',G.human,40,40);
 applyDmg(hu2,3,'b',en);
 ok('T7 distant hit gets its own blip',G.atkPings.length===2);
 const hb=G.human.blds.find(b=>b.key==='hq');
 G.atkPings.length=0;applyDmg(hb,3,'b',en);
 ok('T7 hits on your buildings blip too',G.atkPings.length===1);
 // friendly fire and hits on the enemy never blip
 G.atkPings.length=0;
 const hu3=makeUnit('grunt',G.human,20,22);
 applyDmg(hu3,2,'b',hu);
 applyDmg(en,3,'b',hu);
 ok('T7 friendly fire / outgoing fire never blips',G.atkPings.length===0);
 // wildlife counts as an attacker
 const critter={kind:'creature',x:20,y:21,hp:40,id:999901,t:{dm:2}};
 applyDmg(hu,2,'b',critter);
 ok('T7 wildlife attacks blip',G.atkPings.length===1);
 hu.target=null;hu.state='idle';hu3.target=null;hu3.state='idle';
 // cap: many distinct clusters never grow the list past 24
 G.atkPings.length=0;
 for(let i=0;i<30;i++)atkPing(i*7,1);
 ok('T7 blip list capped at 24',G.atkPings.length===24);
 // cosmetic only: hash + snapshot stay blind to blips
 const h0=hashState();atkPing(50,50);atkPing(60,60);
 ok('T7 hashState ignores blips',hashState()===h0);
 ok('T7 snapshots ignore blips',!('atkPings' in JSON.parse(saveState())));
 // expiry: a planted blip is gone after ~2.5s of sim (organic new blips may
 // appear during the run, so check by coordinates, not by count)
 G.atkPings.length=0;atkPing(2,2);
 run(90);
 ok('T7 blips expire after ~2.5s',!G.atkPings.some(p=>p.x===2&&p.y===2));
 // renderMinimap with live blips must not throw
 atkPing(12,12);let rerr=null;try{renderMinimap()}catch(e){rerr=e}
 ok('T7 minimap renders with blips',!rerr);
}

/* ---------- T7.2 minimap size cycling ---------- */
{
 for(const k2 of ['small','medium','large']){
  mmSizeKey=k2;applyMMSize();
  ok('T7 mm size '+k2+' applied',mmCv.width===MM_SIZES[k2]&&mmCv.height===MM_SIZES[k2]);
  let err=null;try{renderMinimap()}catch(e){err=e}
  ok('T7 mm renders at '+k2,!err);
 }
 const w=mmWorld({clientX:MM_S,clientY:MM_S});
 ok('T7 mmWorld scales with size',Math.abs(w.x-G.map.N)<1e-9&&Math.abs(w.y-G.map.N)<1e-9);
 mmSizeKey='medium';applyMMSize();
 ok('T7 mm restored to medium',MM_S===176&&mmCv.width===176);
}

/* ---------- T7.3 selection portraits ---------- */
{
 G=null;newGame(cfg('backyard','dm','normal','green',3,727003));run(10);
 const squad=[];for(let i=0;i<20;i++)squad.push(makeUnit('grunt',G.human,10+(i%5),10+(i/5|0)));
 squad[3].hp=squad[3].mhp*.5;   // yellow band
 squad[7].hp=squad[7].mhp*.15;  // red band
 setSel(squad);
 const info=document.getElementById('selInfo');
 const grids=info.children.filter(ch=>ch&&ch.id==='portGrid');
 const grid=grids[grids.length-1];
 ok('T7 portrait grid renders',!!grid);
 ok('T7 20 selected -> 20 portraits',!!grid&&grid.children.length===20);
 function bandOf(cell){const t2=cell.children[0];return (t2&&t2.style&&t2.style.border)||''}
 ok('T7 healthy unit banded green',!!grid&&bandOf(grid.children[0]).includes('#58d858'));
 ok('T7 half-health unit banded yellow',!!grid&&bandOf(grid.children[3]).includes('#ffd24d'));
 ok('T7 low-health unit banded red',!!grid&&bandOf(grid.children[7]).includes('#ff5a5a'));
 const bar=grid&&grid.children[7].children[1];
 ok('T7 health bar width tracks hp',!!bar&&bar.children[0].style.width==='15%');
 // click a portrait -> that single unit selected
 grid.children[5].onclick();
 ok('T7 clicking a portrait selects that unit',G.sel.length===1&&G.sel[0]===squad[5]);
}

/* ---------- T7.4 army readout ---------- */
{
 G=null;newGame(cfg('backyard','dm','normal','green',3,727004));run(10);
 lastArmySig='__force__';
 refreshArmyPanel();
 const rows=document.getElementById('armyRows'),panel=document.getElementById('armyPanel');
 const counts={};for(const u of G.human.units)counts[u.key]=(counts[u.key]||0)+1;
 const kinds=Object.keys(U).filter(k2=>counts[k2]);
 ok('T7 army panel visible with units',panel.style.display==='block');
 ok('T7 one row per fielded unit type',rows.children.length===kinds.length);
 const row0=rows.children[0];
 const label=row0&&row0.children.map(ch2=>ch2.textContent).join('');
 ok('T7 row shows name and count',!!label&&label.includes(U[kinds[0]].n)&&label.includes('\u00d7'+counts[kinds[0]]));
 makeUnit('grunt',G.human,12,12);
 lastArmySig='__force__';refreshArmyPanel();
 const c2={};for(const u of G.human.units)c2[u.key]=(c2[u.key]||0)+1;
 ok('T7 counts update after training',rows.children.length===Object.keys(U).filter(k2=>c2[k2]).length);
 const gRow=rows.children.find(r2=>r2.children.some(ch2=>ch2.textContent===U.grunt.n));
 ok('T7 grunt count reflects the new unit',!!gRow&&gRow.children.some(ch2=>ch2.textContent==='\u00d7'+c2.grunt));
 // spectators get no readout
 G.spectate=true;refreshArmyPanel();
 ok('T7 hidden while spectating',panel.style.display==='none');
 G.spectate=false;lastArmySig='__force__';refreshArmyPanel();
 ok('T7 restored after spectate',panel.style.display==='block');
}

/* ---------- T7.5 painters + quad helpers ---------- */
{
 // every building painter (with the v27 face-fitted details) runs clean in
 // the shim, and the new quad helpers are geometrically sound
 let err=null;
 try{const cv=document.createElement('canvas');cv.width=600;cv.height=400;const c2=cv.getContext('2d');
  for(const k2 in B){if(k2==='barricade')continue;bldBody(c2,k2,FAC.green.color,B[k2].sz);}
 }catch(e){err=e}
 ok('T7 all building painters run clean',!err);
 if(err)console.log('   ',err.stack.split('\n')[0]);
 const Q=[{x:0,y:10},{x:10,y:5},{x:10,y:-5},{x:0,y:0}];
 const p00=qp(Q,0,0),p10=qp(Q,1,0),p11=qp(Q,1,1),p01=qp(Q,0,1),mid=qp(Q,.5,.5);
 ok('T7 qp hits quad corners',p00.x===0&&p00.y===10&&p10.x===10&&p10.y===5&&p11.x===10&&p11.y===-5&&p01.x===0&&p01.y===0);
 ok('T7 qp midpoint is the quad centroid',mid.x===5&&mid.y===2.5);
 const P={cx:0,baseY:10,hw:20,hd:10,H:12};
 const w1=wallCorners(P,1),w2=wallCorners(P,-1);
 ok('T7 wallCorners spans base to eave',w1[0].y===20&&w1[2].y===-2&&w2[1].x===-20);
}
