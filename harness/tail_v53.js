/* ================================================================================
   T34 - v53 LINEAR SPLASH FALLOFF, AND EVERY SPLASH RADIUS +25%

   A: the curve itself - full at the impact point, half at r, held half to the edge
   B: the radii, pinned against a transcription of the v52 values x1.25
   C: it lands in the sim - measured damage at three distances from one blast
   D: what did NOT change: direct hits, the call-down radii, the non-splash floor

   WHY THIS TAIL EXISTS. v53 moved exactly one pinned hash trail, and that is not a
   localization result. Instrumenting every pinned window shows splash() is called
   ZERO times in all seven T23.A/T30.A combos and in three of the four T24.I combos:
   30-80 simulated seconds is too early for a bot to field a splash weapon, so those
   trails are blind to this release, not confirming it. Everything below is the gate.
   ================================================================================ */
section('T34 v53: linear splash falloff, splash radii +25%');

const DT54=1/30;
function cfg54(map,mode,seed,opp){return{map,mode,diff:'normal',fac:'green',opp:(opp==null?3:opp),seed}}

/* ---------- A: the curve ---------- */
{
 ok('T34.A full damage at the impact point, for every radius in the game',
    [0.625,0.75,1,1.125,1.25,1.5,1.875].every(r=>splashMul(0,r)===1));
 ok('T34.A exactly half damage at the splash radius',
    [0.625,1,1.875].every(r=>splashMul(r,r)===0.5));
 ok('T34.A linear in between: the quarter, half and three-quarter marks',
    splashMul(0.25,1)===0.875&&splashMul(0.5,1)===0.75&&splashMul(0.75,1)===0.625);
 // beyond r the multiplier HOLDS at half across the body-size allowance, which exists
 // because the sim samples entity centres. The callers own the cutoff, not the curve.
 ok('T34.A past the radius it holds at half rather than continuing down to zero',
    splashMul(1.2,1)===0.5&&splashMul(5,1)===0.5&&splashMul(1e6,1)===0.5);
 ok('T34.A monotonically non-increasing, with no cliff anywhere',
    (()=>{let prev=1.0001;
      for(let d=0;d<=3;d+=0.005){const m=splashMul(d,1);
        if(m>prev+1e-12)return false;
        if(prev-m>0.02)return false;      // v52's step dropped 0.45 in one place
        prev=m}
      return true})());
 ok('T34.A a zero radius degenerates safely to a point hit',splashMul(0,0)===1&&splashMul(5,0)===1);
 ok('T34.A the two-step shape is gone from splash() entirely',
    !splash.toString().includes('.55')&&!splash.toString().includes('r*.5?')&&
    (splash.toString().match(/splashMul\(d,r\)/g)||[]).length===3);
}

/* ---------- B: the radii ---------- */
{
 // v52 values, transcribed; every one must have come out at exactly 1.25x, with
 // ONE named exception: Gray's Rocket Artillery took a further deliberate 1.5x at
 // v63 as a faction-identity buff (1.875 -> 2.8125). Written as a per-key
 // multiplier rather than a loosened tolerance, so the other eight radii are still
 // pinned exactly and a second unplanned change to any of them still fails.
 const V52={grenadier:0.9,bazooka:0.6,aatruck:0.9,tank:0.8,mortar:1.2,flamer:0.5,
            bulltank:1.0,arty:1.5,apache:0.6};
 const MUL={arty:1.25*1.5}; // v63
 const bad=[];
 for(const k in V52){const want=V52[k]*(MUL[k]||1.25);if(Math.abs(U[k].spl-want)>1e-12)bad.push(k+' '+U[k].spl+' want '+want)}
 ok('T34.B every splash radius is 1.25x its v52 value, x1.5 again for the v63 artillery'+(bad.length?' ('+bad.join(', ')+')':''),
    bad.length===0);
 ok('T34.B the artillery buff is exactly +50%, not a re-tuned literal',
    Math.abs(U.arty.spl-1.875*1.5)<1e-12&&U.arty.spl===2.8125);
 ok('T34.B the secondary and both paratrooper munitions scaled too',
    U.bulltank.sec.spl===0.625&&PARA_MUN.at.spl===0.625&&PARA_MUN.he.spl===1.5&&PARA_MUN.smg.spl===0);
 /* v87: the Firebomb Heli joins the list, and its 1.0 is NOT a v52 value scaled by
    anything - it is a new row written after the pass, which is why it is exempted
    from the ratio check above and named here instead. The list is pinned precisely
    so an addition has to be declared rather than slipping in. */
 /* v88: the Choktaw joins the list. Its 0.75 is the Apache's literal, because its
    main weapon IS the Apache's rocket pod - so unlike the Firebomb's it is not a
    new number at all, and the identity is asserted below rather than transcribed.
    Its DOOR GUN carries no spl, which is why fireSec had to stop assuming one. */
 ok('T34.B nothing else in the roster grew a splash radius',
    Object.keys(U).filter(k=>U[k].spl).sort().join()===
    'aatruck,apache,arty,bazooka,bulltank,choktaw,firebomb,flamer,grenadier,mortar,tank');
 ok('T34.B the Choktaw\'s burst is the Apache\'s, and its door gun has none',
    U.choktaw.spl===U.apache.spl&&!U.choktaw.sec.spl);
 ok('T34.B ...and the one arrival since the pass carries a literal, not a scaled one',
    U.firebomb.spl===1);
 // every scaled value is a dyadic fraction, so the rescale adds no float noise to a
 // path that feeds the state hash
 // v63: sixteenths rather than eighths. The artillery's 2.8125 is 45/16 - still a
 // dyadic fraction, still exact in float64, so the property being defended (no
 // float noise on a path that feeds the state hash) is unchanged; only the
 // granularity the check is written at moved.
 ok('T34.B every radius is exactly representable in binary',
    Object.keys(U).filter(k=>U[k].spl).every(k=>U[k].spl*16===Math.round(U[k].spl*16)));
}

/* ---------- C: it actually lands in the sim ---------- */
{
 G=null;newGame(cfg54('backyard','dm',54001,1));
 for(const mn of (G.map.mines||[]))mn.live=false;
 const A=arena44(4,4,0,16),foe=G.players.find(p=>p!==G.human);
 const src=makeUnit('grunt',G.human,A.x,A.y+9);          // an owner for the blast
 const R=1.0;                                            // the tank's new radius
 // three targets at 0, r/2 and r from the impact point
 const at0=makeUnit('grunt',foe,A.x,A.y);
 const half=makeUnit('grunt',foe,A.x+R/2,A.y);
 const edge=makeUnit('grunt',foe,A.x+R,A.y);
 const out=makeUnit('grunt',foe,A.x+R+0.6,A.y);          // past r+0.4, must take nothing
 for(const v of [at0,half,edge,out]){v.hp=v.mhp=1e6}
 const h0=[at0.hp,half.hp,edge.hp,out.hp];
 splash(A.x,A.y,R,1000,'ex',src,'x');                    // row x is flat 1.00
 const d0=h0[0]-at0.hp,dh=h0[1]-half.hp,de=h0[2]-edge.hp,dout=h0[3]-out.hp;
 ok('T34.C a blast does full damage at the impact point',Math.abs(d0-1000)<1e-6);
 ok('T34.C three-quarters at half the radius',Math.abs(dh-750)<1e-6);
 ok('T34.C half at the radius',Math.abs(de-500)<1e-6);
 ok('T34.C and nothing past the body-size allowance',dout===0);
 ok('T34.C the falloff is strictly decreasing with distance',d0>dh&&dh>de&&de>dout);
}

/* ---------- D: what did NOT change ---------- */
{
 // A projectile detonates at its target's own position, so a direct hit is d = 0 and
 // is unaffected by any falloff shape. That is the property that keeps this release
 // from silently rebalancing every single-target engagement in the game.
 ok('T34.D a direct hit is still full damage, which is why single-target dps is untouched',
    splashMul(0,U.tank.spl)===1&&splashMul(0,U.arty.spl)===1&&splashMul(0,U.bulltank.sec.spl)===1);
 const src=splash.toString()+updateStrikes.toString();
 ok('T34.D the napalm bomblet radius was deliberately NOT scaled',
    updateStrikes.toString().includes("splash(cell.x,cell.y,1.3,32,'fire',s.owner)"));
 /* v77: the laser sweep went with the Magnifying Glass. The claim this line was
    making - that a call-down's splash radius is a fixed argument the v34 falloff
    rework never touched - is now carried by the barrage, whose radius is the named
    BARRAGE_R and not a scaled literal. */
 ok('T34.D nor the barrage shell radius, which is a named constant',
    updateStrikes.toString().includes("splash(q.x,q.y,BARRAGE_R,BARRAGE_DMG,'ex',s.owner,'q')"));
 ok('T34.D nor the floor for shells that carry no splash at all',
    updateProjs.toString().includes('Math.max(p.spl,.3)'));
 ok('T34.D splashMul is pure arithmetic on its two arguments',
    !/Math\.random|Date\.now|performance\.now|G\./.test(splashMul.toString()));
}

/* ---------- E: determinism, since this feeds the state hash ---------- */
{
 function run54(ticks){
  G=null;newGame(cfg54('backyard','dm',54002,1));
  for(const mn of (G.map.mines||[]))mn.live=false;
  const A=arena44(4,4,0,16),foe=G.players.find(p=>p!==G.human);
  const t1=makeUnit('tank',G.human,A.x,A.y);
  for(let i=0;i<5;i++)makeUnit('grunt',foe,A.x+4+i*0.35,A.y+i*0.3);
  orderMove(t1,A.x+4,A.y,true);
  const tr=[];for(let i=1;i<=420;i++){update(DT54);if(i%60===0)tr.push(hashState())}
  return tr;
 }
 const r1=run54(),r2=run54();
 ok('T34.E a tank shelling a cluster replays bit-identically',
    r1.length===7&&r1.every((v,i)=>v===r2[i]));
}
