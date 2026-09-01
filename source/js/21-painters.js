/* ===================== TROOPERS ===================== */
function trooperBody(c,key,col,bob){
 const sarge=key==='sarge',kneel=key==='mortar';
 const b=hx2rgb(col),deep=mixc(b,AMB,.55),helmetc=mixc(b,BLACK,.12);
 if(sarge)c.scale(1.18,1.18);
 if(key==='gunner')c.scale(1.16,1.16); // bulkier heavy-weapons trooper
 moldBase(c,col,8.6,4);
 c.translate(0,bob*.9);
 const dy=kneel?3.5:0;

 if(kneel){
  plLimb(c,col,-1.5,-4,-4.2,1.6,3.6);  // folded front leg
  plLimb(c,col,-4.2,1.6,-1,2,3.4);
  plLimb(c,col,1.6,-4,3.4,1.6,3.6);    // back leg
 } else {
  const lw=bob*2.4;
  plLimb(c,col,-1.5,-7,-2.7-lw,1.6,3.6);
  plLimb(c,col,1.5,-7,2.7+lw,1.6,3.6);
  // molded boots grounding the stance
  c.fillStyle=rgb(mixc(b,BLACK,.32).r,mixc(b,BLACK,.32).g,mixc(b,BLACK,.32).b);
  c.beginPath();c.ellipse(-2.7-lw,2.6,2.1,1.1,0,0,7);c.fill();
  c.beginPath();c.ellipse(2.7+lw,2.6,2.1,1.1,0,0,7);c.fill();
 }
 // ---- torso: a rounded molded slab ----
 (function(){const g=c.createLinearGradient(-4.2,-15+dy,3.6,-5+dy);
  g.addColorStop(0,rgb(mixc(b,WHITE,.42).r,mixc(b,WHITE,.42).g,mixc(b,WHITE,.42).b));
  g.addColorStop(.5,rgb(b.r,b.g,b.b));
  g.addColorStop(1,rgb(deep.r,deep.g,deep.b));
  c.fillStyle=g;rr(c,-4.2,-15.5+dy,8.4,10+ (kneel?-1:0),3.4);c.fill();})();
 // chest/back light & belt AO
 c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.18)';rr(c,-3.6,-14.8+dy,3.2,7.5,2.2);c.fill();c.restore();
 c.fillStyle=rgba(AMB.r,AMB.g,AMB.b,.45);c.fillRect(-4.2,-7.6+dy,8.4,1.5);
 // molded webbing: chest straps + buckle
 c.save();c.globalAlpha=.5;c.strokeStyle=rgb(mixc(b,BLACK,.35).r,mixc(b,BLACK,.35).g,mixc(b,BLACK,.35).b);c.lineWidth=1.1;
 c.beginPath();c.moveTo(-2.6,-15+dy);c.lineTo(-1.6,-7.9+dy);c.stroke();
 c.beginPath();c.moveTo(2.2,-15+dy);c.lineTo(1.4,-7.9+dy);c.stroke();c.restore();
 c.fillStyle=rgb(mixc(b,WHITE,.28).r,mixc(b,WHITE,.28).g,mixc(b,WHITE,.28).b);rr(c,-1,-8.1+dy,2,1.9,.6);c.fill();
 // little pack on the back
 c.fillStyle=rgb(deep.r,deep.g,deep.b);rr(c,-5.3,-13+dy,2.4,6,1.2);c.fill();
 c.save();c.globalAlpha=.5;c.strokeStyle=rgb(mixc(b,BLACK,.4).r,mixc(b,BLACK,.4).g,mixc(b,BLACK,.4).b);c.lineWidth=.7;
 c.beginPath();c.moveTo(-5.1,-10.2+dy);c.lineTo(-3.1,-10.2+dy);c.stroke();c.restore(); // pack flap seam
 /* v97: belt kit - two ammo pouches on the front of the belt and a canteen
    on the right hip, the little lumps a toy soldier is molded with */
 c.fillStyle=rgb(mixc(b,BLACK,.22).r,mixc(b,BLACK,.22).g,mixc(b,BLACK,.22).b);
 rr(c,-.6,-7.4+dy,1.9,2.3,.7);c.fill();rr(c,1.7,-7.4+dy,1.9,2.3,.7);c.fill();
 c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.14)';
 rr(c,-.4,-7.2+dy,.7,1.7,.35);c.fill();rr(c,1.9,-7.2+dy,.7,1.7,.35);c.fill();c.restore();
 plSphere(c,shade(col,.72),4.2,-6.3+dy,1.3,1.1,false); // plSphere parses HEX - shade() answers one
 plRim(c,col,0,-10+dy,4,5);
 gloss(c,-1.8,-13+dy,1.8,2.6);
 // ---- head ----
 plSphere(c,col,0,-17.4+dy,3.2,1,false);
 // helmet dome (classic army-man brim)
 (function(){const hg=c.createRadialGradient(LIGHT.x*2,-18.6+dy+LIGHT.y*2,.5,0,-17+dy,4.4);
  hg.addColorStop(0,rgb(mixc(helmetc,WHITE,.4).r,mixc(helmetc,WHITE,.4).g,mixc(helmetc,WHITE,.4).b));
  hg.addColorStop(.7,rgb(helmetc.r,helmetc.g,helmetc.b));
  hg.addColorStop(1,rgb(mixc(helmetc,BLACK,.3).r,mixc(helmetc,BLACK,.3).g,mixc(helmetc,BLACK,.3).b));
  c.fillStyle=hg;c.beginPath();c.arc(0,-18.2+dy,3.9,Math.PI*.98,Math.PI*2.02);c.fill();
  // brim
  c.fillStyle=rgb(mixc(helmetc,BLACK,.25).r,mixc(helmetc,BLACK,.25).g,mixc(helmetc,BLACK,.25).b);
  c.beginPath();c.ellipse(0,-16.9+dy,4.4,1.5,0,0,Math.PI);c.fill();
  /* v97: the face lives under the brim - a soft cast shadow across the
     upper face, and a chinstrap line down the cheek */
  c.save();c.globalAlpha=.3;c.fillStyle=rgb(mixc(b,BLACK,.5).r,mixc(b,BLACK,.5).g,mixc(b,BLACK,.5).b);
  c.beginPath();c.ellipse(0,-16.4+dy,3,1.1,0,0,Math.PI);c.fill();c.restore();
  c.save();c.globalAlpha=.5;c.strokeStyle=rgb(mixc(helmetc,BLACK,.35).r,mixc(helmetc,BLACK,.35).g,mixc(helmetc,BLACK,.35).b);c.lineWidth=.7;
  c.beginPath();c.moveTo(2.5,-16.6+dy);c.quadraticCurveTo(2.2,-15+dy,-.2,-14.6+dy);c.stroke();c.restore();
  plRim(c,col,0,-18.2+dy,3.6,3.4);
  gloss(c,-1.4,-20+dy,1.4,1.6);})();
 if(sarge){c.fillStyle='#ffd24d';for(let i=0;i<3;i++){c.beginPath();c.moveTo(-4,-11.5+i*1.7+dy);c.lineTo(-2,-12.3+i*1.7+dy);c.lineTo(-4,-13.1+i*1.7+dy);c.closePath();c.fill();}}
 // ---- static gear (baked with the body) ----
 if(key==='mortar'){

  c.fillStyle='#2c2c33';c.beginPath();c.ellipse(6.5,1.2,4.4,2,0,0,7);c.fill();
  plLimb(c,'#3a3a44',6.5,.5,10.5,-13,4.4);
  c.fillStyle='#1f1f25';c.beginPath();c.ellipse(10.7,-13.4,2.2,1.3,-.3,0,7);c.fill();
  glint(c,9.6,-9,.9);
  }
 else if(key==='grenadier'){

  // a short carbine plus a hip satchel of grenades; small frag held ready in the off hand
  c.fillStyle=rgb(deep.r,deep.g,deep.b);rr(c,4.4,-9,3.2,4.6,1.2);c.fill();   // grenade satchel on the hip
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.12)';rr(c,4.7,-8.6,1,3.6,.5);c.fill();c.restore();
  // a couple of molded grenades clipped to the webbing
  c.fillStyle='#3c4a2e';c.beginPath();c.arc(5.2,-4.4,1.1,0,7);c.fill();c.beginPath();c.arc(6.6,-4.6,1.1,0,7);c.fill();
 }
 else if(key==='flamer'){

  c.fillStyle='#3a3a44';rr(c,-7.8,-16,3,8.5,1.5);c.fill();rr(c,-4.6,-16.8,3,9.3,1.5);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.25)';rr(c,-7.4,-15.6,1,7.5,.5);c.fill();c.restore();
 }
 else if(key==='runner'){

  /* v85: the field radio, which IS the unit - a man who read as a plain rifleman
     would be the one thing on the board you could not tell apart from a Grunt at a
     glance, and both of his abilities are things you want to see coming. Baked with
     the body rather than drawn in the gear pass because none of it aims. */
  c.fillStyle='#3a3a44';rr(c,-7.6,-16.2,3.4,9,1.4);c.fill();               // set on the back, over the pack
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.2)';rr(c,-7.2,-15.8,1.1,7.6,.5);c.fill();c.restore();
  c.fillStyle='#22222a';rr(c,-6.9,-15.6,2,1.5,.4);c.fill();                // dial face
  c.strokeStyle='#8d8d99';c.lineWidth=1.1;                                  // whip aerial, bent back over the shoulder
  c.beginPath();c.moveTo(-6,-16.2);c.quadraticCurveTo(-7.6,-24,-4.2,-28.6);c.stroke();
  c.fillStyle='#c8c8d2';c.beginPath();c.arc(-4.2,-28.8,.8,0,7);c.fill();
  // handset clipped to the chest webbing, cord looping down to the set
  c.fillStyle='#1f1f25';rr(c,1.4,-13.4,1.8,3.2,.7);c.fill();
  c.strokeStyle='rgba(40,40,48,.8)';c.lineWidth=.9;
  c.beginPath();c.moveTo(1.6,-10.4);c.quadraticCurveTo(-1.6,-8.4,-4.4,-11);c.stroke();
 }
}
/* aim-following gear: weapons & arms drawn live on top of the baked body so
   continuous aim is preserved. Context must already carry the body's
   scale (sarge/gunner) and bob translate. */
function trooperGear(c,u,col,ang){
 const key=u.key,dy=key==='mortar'?3.5:0,sarge=key==='sarge';
 const b=hx2rgb(col),deep=mixc(b,AMB,.55);
 const gunMetal='#26262c';
 if(key==='gunner'){

  // a chunky belt-fed machine gun held across the body, with a stubby bipod
  c.save();c.translate(0,-10.5);c.rotate(ang);
  plLimb(c,gunMetal,-4,0,11,0,3.4);                       // long heavy barrel
  c.fillStyle='#1a1a1f';rr(c,-6.4,-2.4,4,4.8,1.4);c.fill(); // receiver block
  c.fillStyle='#3a3a44';rr(c,-1,-3.6,4.5,2.2,1);c.fill();   // ammo box
  c.strokeStyle='#5a5a64';c.lineWidth=1;c.beginPath();c.moveTo(3.2,-1.4);c.lineTo(7,1.6);c.stroke(); // ammo belt
  // bipod legs near the muzzle
  c.strokeStyle='#2a2a30';c.lineWidth=1.4;c.beginPath();c.moveTo(8,1);c.lineTo(10,5);c.moveTo(8,1);c.lineTo(6,5);c.stroke();
  c.fillStyle='#15151a';c.beginPath();c.ellipse(11,0,1.3,1.7,0,0,7);c.fill();
  glint(c,2,-1.2,.8);c.restore();armsToGun(c,col,ang);
  }
 else if(key==='mortar'){ /* mortar tube is baked with the body */ }
 else if(key==='bazooka'){

  c.save();c.translate(0,-15);c.rotate(ang);
  plLimb(c,'#3a3a44',-8,0,9,0,4);
  c.fillStyle='#b23a2a';c.beginPath();c.moveTo(9,-2);c.lineTo(12.6,0);c.lineTo(9,2);c.closePath();c.fill();
  c.fillStyle='#1f1f25';c.beginPath();c.ellipse(-8,0,1.6,2.1,0,0,7);c.fill();c.restore();
  armsToGun(c,col,ang);
  }
 else if(key==='grenadier'){
  // short carbine across the body
  c.save();c.translate(0,-10.5);c.rotate(ang);
  plLimb(c,gunMetal,-3.5,0,6.5,0,2.6);
  c.fillStyle='#1f1f25';rr(c,-5.4,-1.5,2.4,3,1);c.fill();
  c.restore();
  // throwing hand raised with a live grenade
  c.save();c.translate(0,-12.5);c.rotate(ang*.4);plLimb(c,col,2,-2,5,-5,2.6);
  c.fillStyle='#3c4a2e';c.beginPath();c.arc(5,-5,1.5,0,7);c.fill();
  c.fillStyle='#1f1f25';rr(c,4.4,-6.6,1.2,1.4,.5);c.fill(); // grenade spoon/lever
  c.restore();
  armsToGun(c,col,ang);
  }
 else if(key==='flamer'){
  c.save();c.translate(0,-10.5);c.rotate(ang);plLimb(c,'#34343c',0,0,8,0,2.8);
  const fr=1.6+Math.random()*.9;const fg=c.createRadialGradient(9.3,0,.3,9.3,0,fr*1.5);fg.addColorStop(0,'#fff3c4');fg.addColorStop(.5,'#ff9b2e');fg.addColorStop(1,'rgba(255,80,20,0)');c.fillStyle=fg;c.beginPath();c.arc(9.3,0,fr*1.5,0,7);c.fill();c.restore();
  armsToGun(c,col,ang);
  }
 else {

  const long=u.key==='sniper';
  c.save();c.translate(0,-10.5+dy);c.rotate(ang);
  if(long){plLimb(c,gunMetal,-3,0,13.5,0,2);c.fillStyle='#1f1f25';rr(c,1.5,-3.3,4.4,2.3,1);c.fill();glint(c,4,-2.4,.7);}
  /* v85: the Runner's sidearm - the shortest weapon in the file, at roughly a third
     the Grunt's barrel, so the difference reads at sprite scale without a legend. */
  else if(u.key==='runner'){plLimb(c,gunMetal,-1.4,0,2.8,0,2.2);c.fillStyle='#1f1f25';rr(c,-2.2,-.4,1.8,2.6,.7);c.fill();}
  else if(sarge){plLimb(c,gunMetal,-2,-.2,7,-.2,3);}
  else{plLimb(c,gunMetal,-3.5,0,8,0,2.8);c.fillStyle=rgb(hx2rgb(col).r*.6,hx2rgb(col).g*.6,hx2rgb(col).b*.6);rr(c,-5.6,-1.7,2.6,3.4,1.2);c.fill();}
  c.restore();armsToGun(c,col,ang);
  }
}
/* live fallback: body + gear in one pass (used only if a bake is missing) */
function drawTrooper(c,u,col,dk,lt,md,ang,bob){
 trooperBody(c,u.key,col,bob);
 trooperGear(c,u,col,ang);
}

/* ===================== UNITS ===================== */
/* a team-coloured ring on the ground marking a medic truck's healing radius.
   Drawn in the ground-FX pass so it sits beneath all sprites. World circle of
   radius R tiles projects to a screen ellipse of (R*HW × R*HH). */
function drawHealRadius(c,u){
 const R=u.t.healR||MEDIC_HEAL_RADIUS;
 const sx=isoX(u.x,u.y),sy=isoY(u.x,u.y);
 const rx=R*HW, ry=R*HH;
 const b=hx2rgb(FAC[u.p.fac].color);
 const pulse=.5+.5*Math.sin(G.tick*.18+u.id);
 c.save();
 // soft team-tinted fill fading toward the rim
 const g=c.createRadialGradient(sx,sy,rx*.25,sx,sy,rx);
 g.addColorStop(0,`rgba(${b.r},${b.g},${b.b},.10)`);
 g.addColorStop(.7,`rgba(${b.r},${b.g},${b.b},.06)`);
 g.addColorStop(1,`rgba(${b.r},${b.g},${b.b},0)`);
 c.fillStyle=g;c.beginPath();c.ellipse(sx,sy,rx,ry,0,0,7);c.fill();
 // gently pulsing dashed perimeter in the team colour
 c.globalAlpha=.45+.35*pulse;
 c.strokeStyle=`rgb(${b.r},${b.g},${b.b})`;c.lineWidth=1.6;
 c.setLineDash([5,5]);c.lineDashOffset=-G.tick*1.2;
 c.beginPath();c.ellipse(sx,sy,rx,ry,0,0,7);c.stroke();
 c.restore();
}
/* draw a flat wedge on the ground (world space) — used for the entrench firing cone.
   cx,cy world centre; dir world angle; rng tiles; half half-angle; col fill colour. */
function drawGroundCone(c,cx,cy,dir,rng,half,col,alpha){
 const b=hx2rgb(col);
 c.save();
 c.beginPath();c.moveTo(isoX(cx,cy),isoY(cx,cy));
 const STEPS=18;
 for(let i=0;i<=STEPS;i++){const a=dir-half+(2*half)*i/STEPS;const wx=cx+Math.cos(a)*rng,wy=cy+Math.sin(a)*rng;c.lineTo(isoX(wx,wy),isoY(wx,wy));}
 c.closePath();
 const cs=isoX(cx,cy),cy2=isoY(cx,cy);
 const g=c.createRadialGradient(cs,cy2,2,cs,cy2,rng*TW*.5);
 g.addColorStop(0,`rgba(${b.r},${b.g},${b.b},${alpha+0.12})`);
 g.addColorStop(1,`rgba(${b.r},${b.g},${b.b},0)`);
 c.fillStyle=g;c.fill();
 c.strokeStyle=`rgba(${b.r},${b.g},${b.b},.5)`;c.lineWidth=1.4;c.stroke();
 c.restore();
}
/* v26: per-unit render scale so class silhouettes read at a glance — infantry
   shrink, armor/aircraft grow. Purely visual: hitboxes, collision, ranges and
   click picking are untouched. Applied to body, shadow, selection ring, muzzle
   flash and HP bar offset together. */
const USCALE={grunt:.82,grenadier:.82,gunner:.85,para:.85,bazooka:.82,mortar:.82,flamer:.82,sniper:.82,sarge:.92,
 medic:1.08,truck:1.08,aatruck:1.08,jeep:1.05,bike:.95,tank:1.15,bulltank:1.22,arty:1.12,heli:1.15,chinook:1.28,apache:1.18,apc:1.15,choktaw:1.20,firebomb:1.16,balloon:1.10,cmdtruck:1.08};  // v88: the three roadmap-2 aircraft and the Command Truck were falling through to 1.0 - the Choktaw is the heaviest gunship in the game and read smaller than the Apache
function uScale(u){return USCALE[u.key]||1}
/* v79: is this unit inside a broadcasting Sarge's radius? The renderer's read of
   exactly the test dmgBonus makes, kept as one function so the glow can never
   show up on a unit that is not actually getting the damage. */
function rallied(u){
 if(!u.p||u.hp<=0)return false;
 for(const v of G.units){
  if(!v.t.rally||!v.onMe||v.hp<=0||v.garrisoned||v===u||!allied(v.p,u.p))continue;
  if((v.x-u.x)**2+(v.y-u.y)**2<=SARGE_AURA_R*SARGE_AURA_R)return true;
 }
 return false;
}
/* rotor (motion-blurred disc + blades). v46: the Chinook is a tandem, so it draws
   two smaller counter-rotating discs fore and aft instead of one head rotor. The
   single-rotor arm is byte-for-byte the v45 geometry (disc 18, blades 17).
   v105: lifted out of drawUnit unchanged so the menu parade can fly the same
   blades. It paints at the CALLER's transform - drawUnit scales the tandem hull
   by 1.25 before calling, and the parade does the same - so the geometry stays
   in one place and cannot drift between the two. */
function heliRotor(c,key,rot){
 const twin=key==='chinook';
 for(const [hx,hr,dir] of (twin?[[13,11.5,1],[-15,11.5,-1]]:[[0,18,1]])){
  c.save();c.globalAlpha=.13;c.fillStyle='#bfc4cc';c.beginPath();c.ellipse(hx,0,hr,hr,0,0,7);c.fill();c.restore();
  c.strokeStyle='rgba(30,30,36,.85)';c.lineWidth=2.2;c.save();c.translate(hx,0);c.rotate(rot*dir);
  c.beginPath();c.moveTo(-hr+1,0);c.lineTo(hr-1,0);c.stroke();c.rotate(Math.PI/2);c.beginPath();c.moveTo(-hr+1,0);c.lineTo(hr-1,0);c.stroke();c.restore();
  // hub
  plSphere(c,'#3a3a42',hx,0,2.2,1,false);
 }
}
function drawUnit(c,u){
 const sx=isoX(u.x,u.y),sy=isoY(u.x,u.y);
 const col=FAC[u.p.fac].color,b=hx2rgb(col),dk=shade(col,.62),lt=shade(col,1.32),md=shade(col,.85);
 const deep=mixc(b,AMB,.55),litc=mixc(b,WHITE,.4);
 const ang=screenAng(u.face),fly=u.t.fly,gz=fly?34:0,K=uScale(u);
 const moving=u.path&&u.wp<u.path.length,bob=moving?Math.sin(G.tick*.6+u.id*2):0;
 // heal glow: a soft pulsing aura on anything topped up by a medic this frame
 if(u.healedAt!=null&&G.tick-u.healedAt<=2){
  const hp=.6+.4*Math.sin(G.tick*.5+u.id);
  c.save();c.globalCompositeOperation='lighter';c.globalAlpha=.45*hp;
  const gy=sy-gz-(fly?0:6);
  const g=c.createRadialGradient(sx,gy,1,sx,gy,fly?20:16);
  g.addColorStop(0,'rgba(150,255,170,.55)');g.addColorStop(.5,'rgba(90,230,130,.28)');g.addColorStop(1,'rgba(90,230,130,0)');
  c.fillStyle=g;c.beginPath();c.ellipse(sx,gy,fly?20:16,fly?12:11,0,0,7);c.fill();
  c.restore();c.globalAlpha=1;
 }
 /* v88 PAINT MARK: a spinning bracket over anything currently carrying the
    Choktaw's mark. Read straight off the unit's own paintT rather than off the
    box, because the box and the mark can outlive each other - a painted unit
    that walks out of the square is still lit, and that is the whole point of a
    mark as against an aura. Purely cosmetic: no srand, and the mark is drawn for
    whoever can see the unit at all, since the enemy knowing it is lit is the
    warning that makes the ability readable. */
 if(u.paintT>0){
  const py=sy-gz-(fly?4:14),pr=(fly?15:11)*K,rot=G.tick*.07,pf=.55+.35*Math.sin(G.tick*.35+u.id);
  c.save();c.globalAlpha=pf;c.strokeStyle='#ff5b45';c.lineWidth=2;c.lineCap='round';
  for(let q=0;q<4;q++){
   const a0=rot+q*1.5708;
   c.beginPath();
   c.moveTo(sx+Math.cos(a0)*pr,py+Math.sin(a0)*pr*.6);
   c.lineTo(sx+Math.cos(a0+.42)*pr,py+Math.sin(a0+.42)*pr*.6);
   c.stroke();
  }
  c.restore();c.globalAlpha=1;
 }
 /* v79 "ON ME!" GLOW: a soft green pulse under any infantryman currently inside
    a broadcasting Sarge's radius. Read live rather than stamped on the unit
    (which is what healedAt does) because the buff is a position test that can
    stop being true between frames with nothing written anywhere. Sarge himself
    is excluded: he is paying for this, not receiving it. */
 if(u.t.a==='inf'&&!u.t.rally&&!u.garrisoned&&rallied(u)){
  const rp=.55+.45*Math.sin(G.tick*.32+u.id);
  c.save();c.globalCompositeOperation='lighter';c.globalAlpha=.32*rp;
  const gy2=sy-gz-4;
  const g2=c.createRadialGradient(sx,gy2,1,sx,gy2,15);
  g2.addColorStop(0,'rgba(140,255,140,.5)');g2.addColorStop(.55,'rgba(76,220,90,.24)');g2.addColorStop(1,'rgba(76,220,90,0)');
  c.fillStyle=g2;c.beginPath();c.ellipse(sx,gy2,15,9,0,0,7);c.fill();
  c.restore();c.globalAlpha=1;
 }
 // entrench cone: a translucent ground wedge showing the gunner's locked firing arc
 if(u.t&&u.t.entrench&&u.entrenched){drawGroundCone(c,u.x,u.y,u.coneDir,rgOf(u),CONE_HALF,FAC[u.p.fac].color,.16);}
 if(u.sel){c.save();c.strokeStyle='#ffec6e';c.lineWidth=2.2;c.setLineDash([4,3]);c.lineDashOffset=-G.tick*1.5;c.beginPath();c.ellipse(sx,sy,13*K,6.5*K,0,0,7);c.stroke();c.restore();}
 const a=u.t.a;
 c.save();c.translate(sx,sy-gz);if(K!==1)c.scale(K,K);
 if(a==='inf'){
  const set=SPR.done&&SPR.inf[u.key]&&SPR.inf[u.key][u.p.fac];
  if(set){
   const fr=set[Math.max(0,Math.min(4,Math.round((bob+1)*2)))];
   c.drawImage(fr.cv,-fr.ax,-fr.ay,fr.w,fr.h);
   if(NCTX&&fr.nrm){NCTX.setTransform(c.getTransform());NCTX.drawImage(fr.nrm,-fr.ax,-fr.ay,fr.w,fr.h);} // v96: infantry never rotate, so the map blits as-is
   const gs=u.key==='sarge'?1.18:(u.key==='gunner'?1.16:1);
   c.save();if(gs!==1)c.scale(gs,gs);c.translate(0,bob*.9);trooperGear(c,u,col,ang);c.restore();
  } else drawTrooper(c,u,col,dk,lt,md,ang,bob);
 }
 else if(a==='truck'&&u.t.heal){
  c.rotate(ang);
  if(!blitVeh(c,'medic',u.p.fac))vehBody(c,'medic',col);
  // roof beacon (gentle pulse)
  const pulse=.55+.45*Math.sin(G.tick*.25+u.id);
  c.save();c.globalCompositeOperation='lighter';c.fillStyle=`rgba(255,90,80,${.4*pulse})`;c.beginPath();c.arc(-5,-9.6,3.2*pulse+1,0,7);c.fill();c.restore();
  c.fillStyle='#d8352a';c.beginPath();c.arc(-5,-9.6,1.3,0,7);c.fill();
 }
 else if(a==='truck'){
  c.rotate(ang);
  if(!blitVeh(c,'truck',u.p.fac))vehBody(c,'truck',col);
    if(u.cargo>0){const cc=u.cargoT==='plastic'?'#ff9b3a':'#5cc8ff';plSphere(c,cc,-5,-.6,5.4,.8,false);
   if(u.cargo>=cargoCap(u.cargoT)){plSphere(c,cc,1,-1.4,3.6,.8,false);}} // v61: the second sphere means FULL, so it tracks the per-resource cap
 }
 else if(a==='jeep'||a==='bike'){
  c.rotate(ang);
  const vk=a==='bike'?'bike':'jeep';
  if(!blitVeh(c,vk,u.p.fac))vehBody(c,vk,col);
 }
 else if(a==='tank'||a==='arty'){
  const big=u.key==='bulltank',s=big?1.34:1;c.rotate(ang);
  if(!blitVeh(c,u.key,u.p.fac))vehBody(c,u.key,col);
  if(a!=='arty'){
   c.scale(s,s);
   // turret faces its target (or its body) in screen space
   const goal=u.target?u.tface:u.face; // v41: turret eases toward the aim, re-centering on the hull when idle
   if(u.tvis==null)u.tvis=goal;
   else{let dd=Math.atan2(Math.sin(goal-u.tvis),Math.cos(goal-u.tvis));const st=(TURR_SLEW[u.key]||TURR_SLEW.tank)*RDT;u.tvis+=Math.abs(dd)<=st?dd:Math.sign(dd)*st;u.tvis=Math.atan2(Math.sin(u.tvis),Math.cos(u.tvis));}
   c.rotate(screenAng(u.tvis)-ang);
   tankTurret(c,u.key,col); // v49: same geometry, now shared with the portrait painter
  }
 }
 else if(a==='aa'){ // v51: hull blits with its travel facing, rack swivels on its own
  c.rotate(ang);
  if(!blitVeh(c,u.key,u.p.fac))vehBody(c,u.key,col);
  const goal=u.target?u.tface:u.face; // re-centres on the hull when idle, exactly like the tank
  if(u.tvis==null)u.tvis=goal;
  else{let dd=Math.atan2(Math.sin(goal-u.tvis),Math.cos(goal-u.tvis));const st=(TURR_SLEW[u.key]||TURR_SLEW.tank)*RDT;u.tvis+=Math.abs(dd)<=st?dd:Math.sign(dd)*st;u.tvis=Math.atan2(Math.sin(u.tvis),Math.cos(u.tvis));}
  c.translate(AA_PIVOT,0);c.rotate(screenAng(u.tvis)-ang);
  aaTurret(c,col);
 }
 else if(a==='balloon'){
  /* v86: deliberately NOT rotated. Everything else in this function turns with its
     heading; a gas envelope does not, and turning one is the difference between a
     balloon and a badly drawn aircraft. */
  if(!blitVeh(c,'balloon',u.p.fac))vehBody(c,'balloon',col);
 }
 else if(a==='heli'){
  const twin=u.key==='chinook',s=twin?1.25:1;c.rotate(ang);
  if(!blitVeh(c,u.key,u.p.fac))vehBody(c,u.key,col);
  c.scale(s,s);
  heliRotor(c,u.key,u.rot);
 }
 else{ // v30.1: generic hull fallback - the APC's a:'apc' matched no branch above, so only
  // its shadow drew (the shadow pass keys SPR.veh by unit key); any future archetype now
  // renders through the same blit/live-paint path instead of silently vanishing
  c.rotate(ang);
  if(!blitVeh(c,u.key,u.p.fac))vehBody(c,u.key,col);
 }
 c.restore();
 // muzzle flash on the unit
 if(u.flash>0&&u.t.w&&u.t.w!=='f'){
  const f=clamp(u.flash/.1,0,1);
  const gz2=fly?34:(a==='inf'?11:9)*K;
  const reach=(a==='inf'||a==='aa'?9:(u.t.big?22:17))*K; // v51: the rack's tubes end far short of a tank barrel
  const sang=screenAng(turreted(u.t)&&u.tvis!=null?u.tvis:(u.flashAng!=null?u.flashAng:u.face)); // v41/v51: a turreted hull's flash tracks the visible turret
  const fx=sx+Math.cos(sang)*reach, fy=sy-gz2+Math.sin(sang)*reach;
  const r=(a==='inf'?4.5:(u.t.big?9:6.5))*K*(.55+f*.7);
  c.save();c.translate(fx,fy);c.rotate(sang);c.globalAlpha=f;c.globalCompositeOperation='lighter';
  const g=c.createRadialGradient(0,0,.5,0,0,r);g.addColorStop(0,'#ffffff');g.addColorStop(.45,'#ffe27a');g.addColorStop(1,'rgba(255,150,40,0)');
  c.fillStyle=g;c.beginPath();c.arc(0,0,r,0,7);c.fill();
  c.fillStyle='#ffe27a';c.beginPath();c.moveTo(0,0);c.lineTo(r*1.8,-r*.3);c.lineTo(r*2.2,0);c.lineTo(r*1.8,r*.3);c.closePath();c.fill();
  c.restore();c.globalAlpha=1;
 }
 if(u.mining){
  c.save();c.translate(sx,sy-gz-22);
  const wob=Math.sin(G.tick*.5+u.id)*2;
  c.fillStyle='#ffd23f';c.font='bold 13px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('⛏',0,wob);
  c.globalAlpha=.65;c.fillStyle='#ff8c42';c.beginPath();c.arc(6,wob-4,1.7,0,7);c.fill();c.beginPath();c.arc(-5,wob-6,1.3,0,7);c.fill();
  c.textAlign='left';c.textBaseline='alphabetic';c.restore();
 }
 if(u.flag){const fc=FAC[u.flag.owner.fac].color;c.strokeStyle='#5a4632';c.lineWidth=2;c.beginPath();c.moveTo(sx+6,sy-gz-12);c.lineTo(sx+6,sy-gz-32);c.stroke();c.fillStyle=fc;c.beginPath();c.moveTo(sx+6,sy-gz-32);c.lineTo(sx+20,sy-gz-27);c.lineTo(sx+6,sy-gz-22);c.closePath();c.fill();}
 const obY=sy-gz-(u.t.a==='inf'?28:24)*K;
 if(u.sel||u.hp<u.mhp)drawHP(c,sx,obY,u.hp/u.mhp);
 if(u.vr)drawChevrons(c,sx,obY-3,u.vr);          // v29: veterancy chevrons
 if(u.hold&&allied(u.p,G.human))drawHoldBadge(c,sx+17,obY+2); // v29: hold-position badge
}

/* ===================== BUILDINGS ===================== */
/* A cohesive molded-toy construction kit. Buildings are built from a small set
   of solid iso primitives that share one footprint and one light direction, so
   every part physically sits on the part beneath it instead of floating.
   --------------------------------------------------------------------------
   ISO PRISM: a true 3D block. Given a footprint half-width hw / half-depth hd
   (in screen px along the iso axes) centered at (cx, baseY), it draws the south-
   west and south-east vertical faces plus the lit top face, raised by height H. */
function prism(c,col,cx,baseY,hw,hd,H,opt){
 opt=opt||{};
 const b=hx2rgb(col);
 const top=mixc(b,WHITE,.40), topD=mixc(b,WHITE,.16);
 const fSW=mixc(b,AMB,.30), fSWd=mixc(b,AMB,.52);   // left/SW face: catches some light
 const fSE=mixc(b,AMB,.50), fSEd=mixc(b,AMB,.70);   // right/SE face: deeper shade
 // iso corner offsets (screen space). The four top corners:
 const N={x:cx,        y:baseY-hd-H};   // north (back)
 const E={x:cx+hw,     y:baseY-H};      // east  (right)
 const S={x:cx,        y:baseY+hd-H};   // south (front)
 const Wp={x:cx-hw,    y:baseY-H};      // west  (left)
 // bottom corners (ground) for the two front faces
 const Sg={x:cx,    y:baseY+hd};
 const Eg={x:cx+hw, y:baseY};
 const Wg={x:cx-hw, y:baseY};
 // SE face (front-right): S -> E -> Eg -> Sg
 (function(){const g=c.createLinearGradient(S.x,S.y,Eg.x,Eg.y);g.addColorStop(0,rgb(fSE.r,fSE.g,fSE.b));g.addColorStop(1,rgb(fSEd.r,fSEd.g,fSEd.b));c.fillStyle=g;
  c.beginPath();c.moveTo(S.x,S.y);c.lineTo(E.x,E.y);c.lineTo(Eg.x,Eg.y);c.lineTo(Sg.x,Sg.y);c.closePath();c.fill();})();
 // SW face (front-left): S -> Wp -> Wg -> Sg
 (function(){const g=c.createLinearGradient(Wp.x,Wp.y,Sg.x,Sg.y);g.addColorStop(0,rgb(fSW.r,fSW.g,fSW.b));g.addColorStop(1,rgb(fSWd.r,fSWd.g,fSWd.b));c.fillStyle=g;
  c.beginPath();c.moveTo(S.x,S.y);c.lineTo(Wp.x,Wp.y);c.lineTo(Wg.x,Wg.y);c.lineTo(Sg.x,Sg.y);c.closePath();c.fill();})();
 // crisp molded seam down the front vertical corner
 c.save();c.globalAlpha=.4;c.strokeStyle=rgb(fSEd.r,fSEd.g,fSEd.b);c.lineWidth=1;c.beginPath();c.moveTo(S.x,S.y);c.lineTo(Sg.x,Sg.y);c.stroke();c.restore();
 // top face (diamond) with a soft key-light gradient
 (function(){const g=c.createLinearGradient(Wp.x,N.y,E.x,S.y);g.addColorStop(0,rgb(top.r,top.g,top.b));g.addColorStop(1,rgb(topD.r,topD.g,topD.b));c.fillStyle=g;
  c.beginPath();c.moveTo(N.x,N.y);c.lineTo(E.x,E.y);c.lineTo(S.x,S.y);c.lineTo(Wp.x,Wp.y);c.closePath();c.fill();})();
 // lit NW top edge highlight
 c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,255,255,.4)';c.lineWidth=1.4;c.beginPath();c.moveTo(Wp.x,Wp.y);c.lineTo(N.x,N.y);c.stroke();c.restore();
 // glossy band across the top
 if(!opt.matte){c.save();c.beginPath();c.moveTo(N.x,N.y);c.lineTo(E.x,E.y);c.lineTo(S.x,S.y);c.lineTo(Wp.x,Wp.y);c.closePath();c.clip();gloss(c,cx-hw*.2,N.y+hd*.5,hw*.34,hd*.3);c.restore();}
 /* v97 opt.det: molded panel structure for a MAIN hull - seam grids sized to
    the wall, a plinth at the foot, and a trim inset on the top face. Small
    prisms (crates, kiosks, vents) stay plain; every big flat face this option
    touches was one bare gradient before. */
 if(opt.det){
  const seQ=[Sg,Eg,E,S],swQ=[Sg,Wg,Wp,S];
  const nse=Math.max(2,Math.round(hw/11)),us=[];for(let i=1;i<nse;i++)us.push(i/nse);
  const vs=H>15?[.52]:[];
  wallPanels(c,seQ,fSE,us,vs,hw+H);
  wallPanels(c,swQ,fSW,us,vs,hw+H+7);
  wallPlinth(c,seQ,fSE);wallPlinth(c,swQ,fSW);
  if(H>15)wallBolts(c,seQ,.56,Math.max(3,nse),fSE);
  // top trim: an inset diamond outline
  c.save();c.globalAlpha=.18;c.strokeStyle=rgb(topD.r,topD.g,topD.b);c.lineWidth=1;
  const cyT=baseY-H, ins=.84;
  c.beginPath();
  c.moveTo(cx+(N.x-cx)*ins,cyT+(N.y-cyT)*ins);
  c.lineTo(cx+(E.x-cx)*ins,cyT+(E.y-cyT)*ins);
  c.lineTo(cx+(S.x-cx)*ins,cyT+(S.y-cyT)*ins);
  c.lineTo(cx+(Wp.x-cx)*ins,cyT+(Wp.y-cyT)*ins);
  c.closePath();c.stroke();c.restore();c.globalAlpha=1;
 }
 return {N,E,S,W:Wp,cx,topY:baseY-H,baseY,hw,hd,H};
}
/* a four-slope hip/pyramid roof sitting on a prism's top diamond (hw,hd at topY),
   rising to a ridge apex of height rh. col is the roof body. */
function hipRoof(c,col,cx,topY,hw,hd,rh){
 const b=hx2rgb(col);
 const apex={x:cx,y:topY-rh};
 const N={x:cx,y:topY-hd}, E={x:cx+hw,y:topY}, S={x:cx,y:topY+hd}, Wp={x:cx-hw,y:topY};
 const faces=[
  {p:[Wp,N,apex], col:mixc(b,WHITE,.38)},  // NW slope: lit
  {p:[N,E,apex],  col:mixc(b,WHITE,.12)},  // NE slope
  {p:[E,S,apex],  col:mixc(b,AMB,.42)},    // SE slope: shaded
  {p:[S,Wp,apex], col:mixc(b,AMB,.22)}     // SW slope
 ];
 for(const f of faces){c.fillStyle=rgb(f.col.r,f.col.g,f.col.b);c.beginPath();c.moveTo(f.p[0].x,f.p[0].y);c.lineTo(f.p[1].x,f.p[1].y);c.lineTo(f.p[2].x,f.p[2].y);c.closePath();c.fill();}
 /* v97: contour lines up the two front slopes so they read as shingled */
 c.save();c.lineWidth=1;
 for(const f of [faces[2],faces[3]]){
  const dk3=mixc(f.col,BLACK,.3);
  for(const t of [.3,.6]){
   c.globalAlpha=.2;c.strokeStyle=rgb(dk3.r,dk3.g,dk3.b);
   const a={x:f.p[0].x+(apex.x-f.p[0].x)*t,y:f.p[0].y+(apex.y-f.p[0].y)*t};
   const b2={x:f.p[1].x+(apex.x-f.p[1].x)*t,y:f.p[1].y+(apex.y-f.p[1].y)*t};
   c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b2.x,b2.y);c.stroke();
  }
 }
 c.restore();c.globalAlpha=1;
 // hip ridges
 c.save();c.globalAlpha=.5;c.strokeStyle=rgb(mixc(b,BLACK,.25).r,mixc(b,BLACK,.25).g,mixc(b,BLACK,.25).b);c.lineWidth=1;
 for(const cor of [N,E,S,Wp]){c.beginPath();c.moveTo(cor.x,cor.y);c.lineTo(apex.x,apex.y);c.stroke();}c.restore();
 // lit ridge on the NW
 c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,255,255,.45)';c.lineWidth=1.2;c.beginPath();c.moveTo(Wp.x,Wp.y);c.lineTo(apex.x,apex.y);c.stroke();c.restore();
 return apex;
}
/* a gable (two-slope) roof over a prism top face. The ridge runs along the
   world-X iso axis (screen slope +1/2) with proper triangular end walls, so
   the roof reads as one molded piece from every side. hw/hd are the roof half
   extents at topY (slightly larger than the walls gives eaves); rh is the
   ridge rise above the eave line. */
function gableRoof(c,col,cx,topY,hw,hd,rh){
 const b=hx2rgb(col);
 const N={x:cx,y:topY-hd}, E={x:cx+hw,y:topY}, S={x:cx,y:topY+hd}, Wp={x:cx-hw,y:topY};
 const ridgeA={x:cx-hw*.5,y:topY-hd*.5-rh};   // ridge end over the NW half
 const ridgeB={x:cx+hw*.5,y:topY+hd*.5-rh};   // ridge end over the SE half
 function face(pts,colr){c.fillStyle=rgb(colr.r,colr.g,colr.b);c.beginPath();c.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)c.lineTo(pts[i].x,pts[i].y);c.closePath();c.fill();}
 face([N,Wp,ridgeA],mixc(b,AMB,.36));           // NW gable end (mostly hidden)
 face([N,E,ridgeB,ridgeA],mixc(b,WHITE,.34));   // NE slope: lit
 face([Wp,S,ridgeB,ridgeA],mixc(b,AMB,.24));    // SW slope: soft shade
 face([E,S,ridgeB],mixc(b,AMB,.5));             // SE gable end wall
 /* v97: panel lines on both visible slopes - the roof was two bare ramps */
 roofPanels(c,[N,E,ridgeB,ridgeA],mixc(b,WHITE,.34),hw);
 roofPanels(c,[Wp,S,ridgeB,ridgeA],mixc(b,AMB,.24),hw+3);
 // molded eave edge on the visible end + lit ridge line
 c.save();c.globalAlpha=.45;c.strokeStyle=rgb(mixc(b,BLACK,.3).r,mixc(b,BLACK,.3).g,mixc(b,BLACK,.3).b);c.lineWidth=1;
 c.beginPath();c.moveTo(E.x,E.y);c.lineTo(ridgeB.x,ridgeB.y);c.lineTo(S.x,S.y);c.stroke();c.restore();
 c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,255,255,.5)';c.lineWidth=1.6;c.beginPath();c.moveTo(ridgeA.x,ridgeA.y);c.lineTo(ridgeB.x,ridgeB.y);c.stroke();c.restore();
 return {ridgeA,ridgeB,N,E,S,W:Wp};
}
/* ---- face-fitted detailing ----
   Doors, windows, slats and stripes used to be painted in flat screen space,
   which let them hang past the hull (the garage door bug). These helpers map
   details onto the actual wall planes so nothing can overhang again.
   wallCorners: [bottomFront, bottomSide, topSide, topFront] quad of a prism
   wall; side +1 is the SE (right) face, -1 the SW (left) face.
   qp: bilinear point inside an arbitrary quad (u across, v up).
   quadPatch: path the sub-rectangle (u0,v0)-(u1,v1) of a quad. */
function wallCorners(P,side){
 const A={x:P.cx,y:P.baseY+P.hd},B={x:P.cx+side*P.hw,y:P.baseY};
 return [A,B,{x:B.x,y:B.y-P.H},{x:A.x,y:A.y-P.H}];
}
function qp(Q,u,v){
 const x0=Q[0].x+(Q[1].x-Q[0].x)*u, y0=Q[0].y+(Q[1].y-Q[0].y)*u;
 const x1=Q[3].x+(Q[2].x-Q[3].x)*u, y1=Q[3].y+(Q[2].y-Q[3].y)*u;
 return {x:x0+(x1-x0)*v, y:y0+(y1-y0)*v};
}
function quadPatch(c,Q,u0,v0,u1,v1){
 const p0=qp(Q,u0,v0),p1=qp(Q,u1,v0),p2=qp(Q,u1,v1),p3=qp(Q,u0,v1);
 c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.lineTo(p2.x,p2.y);c.lineTo(p3.x,p3.y);c.closePath();
}
/* ---- molded-detail kit ----
   v97: the owner zoomed in and found "large flat surfaces, mostly square shapes":
   the prism walls and roofs were single gradients. These helpers put molded
   STRUCTURE on them - panel seam grids, bolt heads, plinth bands, roof panel
   lines - all mapped through the same quad math the doors and windows use, so
   nothing can hang past a wall plane. Deterministic on purpose (a tiny sine
   hash, no RNG): the offline texture pass re-renders these painters, and a
   detail that moved between bakes would shear against its own normal map. */
function dth(n){const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s)}
/* recessed panel-seam grid on a wall quad: verticals at us[], horizontals at
   vs[], each seam a dark groove with a lit lip below-right (molded, not drawn).
   Panels between the seams get a whisper of alternating tone so the wall
   stops being one flat ramp. */
function wallPanels(c,Q,base,us,vs,seed){
 const dk2=mixc(base,BLACK,.4),lt2=mixc(base,WHITE,.5);
 c.save();
 // per-panel tonal variation
 const uu=[0].concat(us,[1]),vv=[0].concat(vs,[1]);
 for(let i=0;i<uu.length-1;i++)for(let j=0;j<vv.length-1;j++){
  const t=dth((seed||0)+i*7.3+j*13.7)-.5;
  c.globalAlpha=Math.abs(t)*.12;
  c.fillStyle=t>0?rgb(lt2.r,lt2.g,lt2.b):rgb(dk2.r,dk2.g,dk2.b);
  quadPatch(c,Q,uu[i],vv[j],uu[i+1],vv[j+1]);c.fill();
 }
 // seams: groove + lip
 c.lineWidth=1;
 for(const u of us){
  c.globalAlpha=.26;c.strokeStyle=rgb(dk2.r,dk2.g,dk2.b);
  const p0=qp(Q,u,.03),p1=qp(Q,u,.97);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();
  c.globalAlpha=.12;c.strokeStyle=rgb(lt2.r,lt2.g,lt2.b);
  const q0=qp(Q,u+.012,.03),q1=qp(Q,u+.012,.97);c.beginPath();c.moveTo(q0.x,q0.y);c.lineTo(q1.x,q1.y);c.stroke();
 }
 for(const v of vs){
  c.globalAlpha=.2;c.strokeStyle=rgb(dk2.r,dk2.g,dk2.b);
  const p0=qp(Q,.03,v),p1=qp(Q,.97,v);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();
  c.globalAlpha=.1;c.strokeStyle=rgb(lt2.r,lt2.g,lt2.b);
  const q0=qp(Q,.03,v-.018),q1=qp(Q,.97,v-.018);c.beginPath();c.moveTo(q0.x,q0.y);c.lineTo(q1.x,q1.y);c.stroke();
 }
 c.restore();c.globalAlpha=1;
}
/* a line of molded bolt heads across a wall quad at height v */
function wallBolts(c,Q,v,n,base){
 const dk2=mixc(base,BLACK,.45);
 c.save();
 for(let i=0;i<n;i++){
  const p=qp(Q,.08+.84*i/(n-1),v);
  c.globalAlpha=.5;c.fillStyle=rgb(dk2.r,dk2.g,dk2.b);c.beginPath();c.arc(p.x,p.y,.8,0,7);c.fill();
  c.globalAlpha=.35;c.fillStyle='rgba(255,255,255,1)';c.beginPath();c.arc(p.x-.3,p.y-.3,.3,0,7);c.fill();
 }
 c.restore();c.globalAlpha=1;
}
/* darker plinth band along the foot of a wall quad, with a lit top lip */
function wallPlinth(c,Q,base,v){
 v=v||.14;
 const dk2=mixc(base,AMB,.35);
 c.save();c.globalAlpha=.4;c.fillStyle=rgb(dk2.r,dk2.g,dk2.b);
 quadPatch(c,Q,0,0,1,v);c.fill();
 c.globalAlpha=.16;c.strokeStyle='rgba(255,255,255,1)';c.lineWidth=1;
 const p0=qp(Q,.02,v),p1=qp(Q,.98,v);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();
 c.restore();c.globalAlpha=1;
}
/* panel lines on a roof slope quad [eaveA,eaveB,ridgeB,ridgeA]: contours
   parallel to the ridge plus faint corrugation runs up the slope */
function roofPanels(c,Q,base,seed){
 const dk2=mixc(base,BLACK,.35),lt2=mixc(base,WHITE,.5);
 c.save();c.lineWidth=1;
 for(const v of [.34,.66]){
  c.globalAlpha=.22;c.strokeStyle=rgb(dk2.r,dk2.g,dk2.b);
  const p0=qp(Q,.03,v),p1=qp(Q,.97,v);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();
  c.globalAlpha=.1;c.strokeStyle=rgb(lt2.r,lt2.g,lt2.b);
  const q0=qp(Q,.03,v+.05),q1=qp(Q,.97,v+.05);c.beginPath();c.moveTo(q0.x,q0.y);c.lineTo(q1.x,q1.y);c.stroke();
 }
 for(let i=1;i<7;i++){
  const u=i/7+((dth((seed||0)+i)-.5)*.02);
  c.globalAlpha=.1;c.strokeStyle=rgb(dk2.r,dk2.g,dk2.b);
  const p0=qp(Q,u,.04),p1=qp(Q,u,.96);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();
 }
 // eave shadow along the bottom edge
 c.globalAlpha=.3;c.strokeStyle=rgb(dk2.r,dk2.g,dk2.b);c.lineWidth=1.3;
 const e0=qp(Q,.01,.02),e1=qp(Q,.99,.02);c.beginPath();c.moveTo(e0.x,e0.y);c.lineTo(e1.x,e1.y);c.stroke();
 c.restore();c.globalAlpha=1;
}
/* small rooftop equipment: a vent/AC box with a louvered face and a fan ring */
function roofVent(c,x,y,w,d,h,col){
 const q=prism(c,col,x,y,w,d,h,{matte:true});
 const f=wallCorners(q,1);
 c.save();c.globalAlpha=.55;c.strokeStyle='#20242a';c.lineWidth=1;
 for(const v of [.3,.5,.7]){const p0=qp(f,.15,v),p1=qp(f,.85,v);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();}
 c.globalAlpha=.5;c.beginPath();c.ellipse(q.cx,q.topY+d*.1,w*.42,d*.42,0,0,7);c.stroke();
 c.restore();c.globalAlpha=1;
 return q;
}
/* a run of rooftop pipe with mounting brackets and an elbow drop */
function roofPipe(c,x0,y0,x1,y1,w){
 w=w||1.8;
 c.save();c.strokeStyle='#5a5f66';c.lineWidth=w;c.lineCap='round';
 c.beginPath();c.moveTo(x0,y0);c.lineTo(x1,y1);c.stroke();
 c.strokeStyle='rgba(255,255,255,.25)';c.lineWidth=w*.4;
 c.beginPath();c.moveTo(x0,y0-w*.22);c.lineTo(x1,y1-w*.22);c.stroke();
 c.strokeStyle='#33373d';c.lineWidth=1;
 const n=Math.max(2,Math.round(Math.hypot(x1-x0,y1-y0)/9));
 for(let i=1;i<n;i++){const t=i/n,px=x0+(x1-x0)*t,py=y0+(y1-y0)*t;c.beginPath();c.moveTo(px,py-w*.7);c.lineTo(px,py+w*.7);c.stroke();}
 c.restore();c.lineCap='butt';
}
/* a squat steel drum (fuel/water) with ribs; grounded at (x,y) */
function drumAt(c,x,y,r,col){
 const b2=hx2rgb(col||'#4e545c'),lt2=mixc(b2,WHITE,.3),dk2=mixc(b2,BLACK,.3);
 const h=r*1.9;
 c.fillStyle=rgb(dk2.r,dk2.g,dk2.b);c.beginPath();c.ellipse(x,y,r,r*.5,0,0,7);c.fill();
 (function(){const g=c.createLinearGradient(x-r,0,x+r,0);g.addColorStop(0,rgb(lt2.r,lt2.g,lt2.b));g.addColorStop(.55,rgb(b2.r,b2.g,b2.b));g.addColorStop(1,rgb(dk2.r,dk2.g,dk2.b));c.fillStyle=g;c.fillRect(x-r,y-h,r*2,h);})();
 c.fillStyle=rgb(lt2.r,lt2.g,lt2.b);c.beginPath();c.ellipse(x,y-h,r,r*.5,0,0,7);c.fill();
 c.save();c.globalAlpha=.45;c.strokeStyle=rgb(dk2.r,dk2.g,dk2.b);c.lineWidth=1;
 for(const t of [.3,.62]){c.beginPath();c.ellipse(x,y-h*t,r,r*.5,0,Math.PI*.98,Math.PI*2.02,true);c.stroke();}
 c.restore();
 c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.22)';c.fillRect(x-r*.62,y-h+r*.3,r*.34,h-r*.5);c.restore();
}
/* a banded wooden crate; grounded prism with plank seams both ways */
function crateAt(c,x,y,hw,hd,h,tone){
 const q=prism(c,tone||'#8a6f46',x,y,hw,hd,h,{matte:true});
 c.save();c.globalAlpha=.45;c.strokeStyle='#5e4a2c';c.lineWidth=1;
 c.beginPath();c.moveTo(q.W.x,q.W.y);c.lineTo(q.E.x,q.E.y);c.stroke();
 for(const s of [1,-1]){const f=wallCorners(q,s);
  const p0=qp(f,.5,.05),p1=qp(f,.5,.95);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();
  const m0=qp(f,.06,.5),m1=qp(f,.94,.5);c.beginPath();c.moveTo(m0.x,m0.y);c.lineTo(m1.x,m1.y);c.stroke();}
 c.restore();c.globalAlpha=1;
 return q;
}
/* grounded molded base pad the whole building sits on: a thin iso slab that
   reads as the sprue/footprint tab. hw/hd are screen half-extents. */
function basePad(c,col,cx,baseY,hw,hd,thick){
 const b=hx2rgb(col),side=mixc(b,AMB,.5),sideD=mixc(b,BLACK,.28),top=mixc(b,WHITE,.18);
 // side skirt (south-facing)
 c.fillStyle=rgb(sideD.r,sideD.g,sideD.b);
 c.beginPath();
 c.moveTo(cx-hw,baseY);c.lineTo(cx,baseY+hd);c.lineTo(cx+hw,baseY);
 c.lineTo(cx+hw,baseY+thick);c.lineTo(cx,baseY+hd+thick);c.lineTo(cx-hw,baseY+thick);c.closePath();
 const sg=c.createLinearGradient(0,baseY,0,baseY+hd+thick);sg.addColorStop(0,rgb(side.r,side.g,side.b));sg.addColorStop(1,rgb(sideD.r,sideD.g,sideD.b));c.fillStyle=sg;c.fill();
 // top diamond
 c.fillStyle=rgb(top.r,top.g,top.b);
 c.beginPath();c.moveTo(cx,baseY-hd);c.lineTo(cx+hw,baseY);c.lineTo(cx,baseY+hd);c.lineTo(cx-hw,baseY);c.closePath();c.fill();
 c.save();c.globalAlpha=.5;c.strokeStyle=rgb(mixc(b,AMB,.4).r,mixc(b,AMB,.4).g,mixc(b,AMB,.4).b);c.lineWidth=1;c.stroke();c.restore();
 /* v97: the pad reads as poured slab now - expansion joints along both iso
    axes and a molded bolt at each corner, instead of one flat diamond */
 c.save();c.globalAlpha=.14;c.strokeStyle=rgb(sideD.r,sideD.g,sideD.b);c.lineWidth=1;
 const Nn=[cx,baseY-hd],Ee=[cx+hw,baseY],Ss=[cx,baseY+hd],Ww=[cx-hw,baseY];
 const lp=(A,B,t)=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t];
 for(const t of [.33,.66]){
  let A=lp(Ww,Ss,t),B=lp(Nn,Ee,t);c.beginPath();c.moveTo(A[0],A[1]);c.lineTo(B[0],B[1]);c.stroke();
  A=lp(Ww,Nn,t);B=lp(Ss,Ee,t);c.beginPath();c.moveTo(A[0],A[1]);c.lineTo(B[0],B[1]);c.stroke();
 }
 c.restore();
 c.save();c.globalAlpha=.5;c.fillStyle=rgb(sideD.r,sideD.g,sideD.b);
 for(const q of [[cx,baseY-hd*.82],[cx+hw*.82,baseY],[cx-hw*.82,baseY],[cx,baseY+hd*.82]]){
  c.beginPath();c.arc(q[0],q[1],1,0,7);c.fill();
  c.globalAlpha=.3;c.fillStyle='rgba(255,255,255,1)';c.beginPath();c.arc(q[0]-.35,q[1]-.35,.4,0,7);c.fill();
  c.globalAlpha=.5;c.fillStyle=rgb(sideD.r,sideD.g,sideD.b);
 }
 c.restore();c.globalAlpha=1;
}

// a Czech-hedgehog anti-tank obstacle: three crossed I-beams. dark-gray when neutral,
// team-colored when built by a player. shadow is already laid down by drawBld.
function drawBarricade(c,b,sx,sy){
 const neutral=b.p===G.neutral;
 /* v96.1: the wall takes its texture cell when one loaded - same override
    rule as every sprite, except the fallback is this very painter rather
    than a baked cell, because that is what walls have been since v88 */
 const wcell=SPR.done&&SPR.barr[b.t.hbarr?'hbarricade':'barricade'];
 const cell=wcell&&wcell[neutral?'neutral':b.p.fac];
 if(cell){
  c.save();c.translate(sx,sy);
  const wpr=b.prog;if(wpr<1){c.globalAlpha=.5+.5*wpr;c.translate(0,(1-wpr)*8);}
  c.drawImage(cell.cv,-cell.ax,-cell.ay,cell.w,cell.h);
  if(NCTX&&cell.nrm){NCTX.setTransform(c.getTransform());NCTX.drawImage(cell.nrm,-cell.ax,-cell.ay,cell.w,cell.h);}
  c.restore();
  return;
 }
 const base=neutral?'#5a5a60':FAC[b.p.fac].color;
 const dk=shade(base,.55),lt=shade(base,1.35);
 c.save();c.translate(sx,sy);
 const pr=b.prog;if(pr<1){c.globalAlpha=.5+.5*pr;c.translate(0,(1-pr)*8);}
 /* v88: the heavy wall is the same hedgehog built HEAVIER rather than a different
    object - thicker beams, a taller centre post and a sandbag skirt at its foot.
    A player has to be able to tell the two apart at a glance while reading the
    same silhouette, because they lay in the same line and block the same tile. */
 const hv=!!b.t.hbarr;
 const beams=hv?[[-13,6,13,-9],[13,6,-13,-9],[0,11,0,-17]]:[[-10,5,10,-7],[10,5,-10,-7],[0,9,0,-13]];
 const bw=hv?8.2:5.6;
 c.lineCap='round';
 if(hv){ // the skirt goes down first, so the beams stand in front of it
  c.fillStyle=shade(base,.42);
  for(const q of [[-9,7],[0,10],[9,7]]){c.beginPath();c.ellipse(q[0],q[1],6.4,3.2,0,0,7);c.fill();}
  c.fillStyle=shade(base,.52);
  for(const q of [[-5,9],[5,9]]){c.beginPath();c.ellipse(q[0],q[1],6.0,3.0,0,0,7);c.fill();}
 }
 for(const bm of beams){c.strokeStyle=dk;c.lineWidth=bw;c.beginPath();c.moveTo(bm[0],bm[1]);c.lineTo(bm[2],bm[3]);c.stroke();}
 /* v97: I-beam structure on the members - a web groove down each beam's
    centre and flange bolts along it, so a wall stops being three lines */
 c.save();c.globalAlpha=.45;c.strokeStyle=shade(base,.34);c.lineWidth=hv?1.6:1.1;
 for(const bm of beams){c.beginPath();c.moveTo(bm[0],bm[1]);c.lineTo(bm[2],bm[3]);c.stroke();}
 c.globalAlpha=.6;c.fillStyle=shade(base,.3);
 for(const bm of beams)for(const t of [.22,.5,.78]){
  const px2=bm[0]+(bm[2]-bm[0])*t,py2=bm[1]+(bm[3]-bm[1])*t;
  c.beginPath();c.arc(px2,py2,hv?.9:.7,0,7);c.fill();
 }
 c.restore();
 // lit top edge on each beam
 c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,255,255,.26)';c.lineWidth=hv?2.6:1.8;
 for(const bm of beams){c.beginPath();c.moveTo(bm[0],bm[1]-1.4);c.lineTo(bm[2],bm[3]-1.4);c.stroke();}
 c.restore();
 // beam end caps: the sawn face of each member reads at close zoom
 c.save();c.globalAlpha=.85;c.fillStyle=shade(base,1.2);
 for(const bm of beams){c.beginPath();c.ellipse(bm[2],bm[3],bw*.28,bw*.34,0,0,7);c.fill();}
 c.restore();
 // central rivet hub
 plSphere(c,lt,0,hv?-4:-2,hv?4.6:3.2,1,false);
 if(hv){plSphere(c,shade(base,1.15),0,-15,2.6,1,false);} // the cap on the tall post
 c.restore();
}
function drawBld(c,b){
 const sx=isoX(b.x,b.y),sy=isoY(b.x,b.y);
 const col=FAC[b.p.fac].color,B0=hx2rgb(col),dk=shade(col,.68),lt=shade(col,1.3);
 const S=b.sz*HW; // footprint half-width in screen px
 const HD=b.sz*HH; // footprint half-depth
 const deep=mixc(B0,AMB,.55),litc=mixc(B0,WHITE,.4);
 // footprint tint + selection ring on the actual tile diamond
 c.fillStyle=rgba(AMB.r,AMB.g,AMB.b,.16);
 c.beginPath();c.moveTo(isoX(b.tx,b.ty),isoY(b.tx,b.ty));c.lineTo(isoX(b.tx+b.sz,b.ty),isoY(b.tx+b.sz,b.ty));c.lineTo(isoX(b.tx+b.sz,b.ty+b.sz),isoY(b.tx+b.sz,b.ty+b.sz));c.lineTo(isoX(b.tx,b.ty+b.sz),isoY(b.tx,b.ty+b.sz));c.closePath();c.fill();
 // heal glow: a soft green wash + outline over the footprint when a medic is topping it up
 if(b.healedAt!=null&&G.tick-b.healedAt<=2){
  const hp=.6+.4*Math.sin(G.tick*.5+b.id);
  c.save();c.globalCompositeOperation='lighter';c.globalAlpha=.4*hp;
  c.beginPath();c.moveTo(isoX(b.tx,b.ty),isoY(b.tx,b.ty));c.lineTo(isoX(b.tx+b.sz,b.ty),isoY(b.tx+b.sz,b.ty));c.lineTo(isoX(b.tx+b.sz,b.ty+b.sz),isoY(b.tx+b.sz,b.ty+b.sz));c.lineTo(isoX(b.tx,b.ty+b.sz),isoY(b.tx,b.ty+b.sz));c.closePath();
  c.fillStyle='rgba(110,240,150,.5)';c.fill();
  c.strokeStyle='rgba(160,255,185,.85)';c.lineWidth=2;c.stroke();
  c.restore();c.globalAlpha=1;
 }
 if(b.sel){c.save();c.strokeStyle='#ffec6e';c.lineWidth=2.4;c.setLineDash([5,4]);c.lineDashOffset=-G.tick*1.5;c.stroke();c.restore();}
 // --- wildlife nest structure (v25): the den body is drawn from the map layer;
 //     here we only add selection + a health bar so damage on the den reads clearly ---
 if(b.key==='nest'){
  if(b.sel||b.hp<b.mhp)drawHP(c,sx,sy-26,b.hp/b.mhp);
  return;
 }
 // --- barricade: dark-gray (neutral) or team-colored Czech hedgehog, no molded base ---
 if(b.t.barr){ // v88: both walls are live-painted; drawBarricade reads t.hbarr for the heavier one
  plShadow(c,sx,sy+HD*.5,S*1.15,HD*1.1,.3);
  drawBarricade(c,b,sx,sy);
  if(b.sel||b.hp<b.mhp)drawHP(c,sx,sy-20,b.hp/b.mhp);
  return;
 }
 c.save();c.translate(sx,sy);const pr=b.prog;if(pr<1){c.globalAlpha=.5+.5*pr;c.translate(0,(1-pr)*10);}
 const k=b.key;
 {
  const cell=SPR.done&&SPR.bld[k]&&SPR.bld[k][b.p.fac];
  if(cell){
   c.drawImage(cell.cv,-cell.ax,-cell.ay,cell.w,cell.h);
   if(NCTX&&cell.nrm){NCTX.setTransform(c.getTransform());NCTX.drawImage(cell.nrm,-cell.ax,-cell.ay,cell.w,cell.h);} // v96: buildings never rotate either
  }
  else bldBody(c,k,col,b.sz);
  bldLive(c,b,col);
 }
 c.restore();
 // upgraded building tell: a small gold chevron badge floating above it
 if(b.upg&&b.prog>=1){
  const by=sy-(k==='hq'?78:k==='guardtower'?72:54)-2;
  c.save();c.translate(sx,by);
  const ps=.9+.12*Math.sin(G.tick*.18+b.id);
  c.fillStyle='rgba(255,210,77,.95)';c.strokeStyle='rgba(90,60,0,.6)';c.lineWidth=1.4;
  c.beginPath();c.moveTo(0,-5*ps);c.lineTo(5*ps,2*ps);c.lineTo(2.4*ps,2*ps);c.lineTo(2.4*ps,5*ps);c.lineTo(-2.4*ps,5*ps);c.lineTo(-2.4*ps,2*ps);c.lineTo(-5*ps,2*ps);c.closePath();
  c.fill();c.stroke();
  c.restore();
 }
 if(pr<1){c.fillStyle='rgba(0,0,0,.55)';rr(c,sx-20,sy+6,40,5,2.5);c.fill();c.fillStyle='#ffd24d';rr(c,sx-19,sy+7,38*pr,3,1.5);c.fill();}
 if(b.sel||b.hp<b.mhp)drawHP(c,sx,sy-(k==='hq'?70:k==='guardtower'?64:46),b.hp/b.mhp);
 if(b.sel&&b.t.prod&&b.p.human){const rx=isoX(b.rally.x,b.rally.y),ry=isoY(b.rally.x,b.rally.y);c.strokeStyle='rgba(255,236,110,.8)';c.lineWidth=2;c.beginPath();c.moveTo(rx,ry);c.lineTo(rx,ry-16);c.stroke();c.fillStyle='rgba(255,236,110,.8)';c.beginPath();c.moveTo(rx,ry-16);c.lineTo(rx+10,ry-12);c.lineTo(rx,ry-8);c.closePath();c.fill();}
}

/* ===================== CAST SHADOWS =====================
   Ground pass drawn beneath all sprites: baked silhouettes are sheared
   down-right (opposite the key light) for standing forms, or offset for
   flat/low forms, plus a tight contact core that grounds each piece. */
function contactShadow(c,x,y,rx,ry,a){c.save();c.globalAlpha=a;c.fillStyle='#0b120a';c.beginPath();c.ellipse(x,y,rx,ry,0,0,7);c.fill();c.restore();}
function skewSil(c,cell,gx,gy,g,kx,ky,al){
 c.save();c.globalAlpha=al;c.translate(gx,gy);c.transform(1,0,-kx,-ky,0,0);c.translate(0,-g);
 c.drawImage(cell.sil,-cell.ax,-cell.ay);c.restore();
}
function offsetSil(c,cell,gx,gy,al,rot){
 c.save();c.globalAlpha=al;c.translate(gx+3,gy+2.2);if(rot)c.rotate(rot);
 c.drawImage(cell.sil,-cell.ax,-cell.ay);c.restore();
}
const FLAT_SHADOW=new Set(['hose','stick','pencil','fork','spoon','shovel','rake','leaf','marble','star']);
function drawItemShadow(c,it){
 if(!SPR.done)return;
 const kind=it[3],o=it[2];
 const sx=isoX(o.x,o.y),sy=isoY(o.x,o.y);
 if(kind==='unit'){
  const u=o,K=uScale(u); // v26: shadow scales with the body
  c.save();if(K!==1){c.translate(sx,sy);c.scale(K,K);c.translate(-sx,-sy);}
  if(u.t.fly){plShadow(c,sx,sy,16,7,.22);}
  else if(u.t.a==='inf'){
   const fr=SPR.inf[u.key]&&SPR.inf[u.key][u.p.fac];
   if(fr){skewSil(c,fr[2],sx,sy+1,2,.62,.42,.30);contactShadow(c,sx,sy+1.5,8.5,4,.24);}
  } else {
   const cell=SPR.veh[u.key]&&SPR.veh[u.key][u.p.fac];
   if(cell){offsetSil(c,cell,sx,sy,.26,screenAng(u.face));contactShadow(c,sx,sy+1,14,6,.16);}
  }
  c.restore();
 } else if(kind==='bld'){
  const b=o;if(b.t.barr)return; // v88: neither wall has a baked silhouette to cast
  const cell=SPR.bld[b.key]&&SPR.bld[b.key][b.p.fac];if(!cell)return;
  const HD=b.sz*HH;
  skewSil(c,cell,sx,sy+HD*.62,HD*.62,.55,.5,.26*Math.min(1,b.prog));
 } else if(kind==='prop'){
  const p=o;if(!p._spr)return;
  if(FLAT_SHADOW.has(p.t))offsetSil(c,p._spr,sx,sy,.20);
  else{skewSil(c,p._spr,sx,sy+2,2,.6,.42,.24);contactShadow(c,sx,sy+2,10,4.5,.16);}
 } else if(kind==='node'){
  const n=o;if(!n._spr)return;
  if(n.t==='battery'&&!n.wreck){skewSil(c,n._spr,sx,sy+3,3,.6,.42,.26);contactShadow(c,sx,sy+3,13,5.5,.2);}
  else offsetSil(c,n._spr,sx,sy,.22);
 } else if(kind==='nest'){
  const ns=o;if(!ns._spr)return;
  skewSil(c,ns._spr,sx,sy+4,4,.5,.38,.22);
 }
}

/* ===================== PROPS ===================== */
function drawProp(c,p){
 const sx=isoX(p.x,p.y),sy=isoY(p.x,p.y);c.save();c.translate(sx,sy);
 if(p._spr)c.drawImage(p._spr.cv,-p._spr.ax,-p._spr.ay,p._spr.w,p._spr.h);
 else propBody(c,p);
 c.restore();
}
/* prop painter at local origin: the bake target, and the live fallback for
   any type without a bake box */
function propBody(c,p){
 const t=p.t;
 if(p.sc&&p.sc!==1)c.scale(p.sc,p.sc); // v36: Desk clutter drawn at prop scale (matches propBox + collision)
 if(t==='hose'){
  // glossy coiled rubber garden hose segment
  plShadow(c,0,2,HW*1.1,HH*.9,.28);
  c.lineCap='round';
  for(const seg of[[-HW*1,4,HW*1,-2],[-HW*.6,-6,HW*.9,-9]]){plLimb(c,'#1f7a34',seg[0],seg[1],seg[2],seg[3],11);}
  c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,255,255,.3)';c.lineWidth=2.5;c.lineCap='round';c.beginPath();c.moveTo(-HW*.9,2);c.quadraticCurveTo(0,-6,HW*.9,-4);c.stroke();c.restore();
 }
 else if(t==='pot'){
  plShadow(c,0,6,HW*1.5,HH*1.1,.3);
  // terracotta pot
  (function(){const g=c.createLinearGradient(-HW*1.4,0,HW*1.4,0);g.addColorStop(0,'#9a4f2e');g.addColorStop(.4,'#c97a4d');g.addColorStop(.6,'#d98a5d');g.addColorStop(1,'#8a4528');c.fillStyle=g;c.beginPath();c.moveTo(-HW*1.4,-30);c.lineTo(HW*1.4,-30);c.lineTo(HW*1.05,8);c.lineTo(-HW*1.05,8);c.closePath();c.fill();})();
  c.fillStyle='#d98a5d';c.beginPath();c.ellipse(0,-30,HW*1.4,HH*1.1,0,0,7);c.fill();
  c.fillStyle='#4a2c18';c.beginPath();c.ellipse(0,-30,HW*1.18,HH*.88,0,0,7);c.fill();
  c.fillStyle='#3a2212';c.beginPath();c.ellipse(0,-28,HW*1.0,HH*.7,0,0,7);c.fill();
  // rim highlight
  c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,255,255,.3)';c.lineWidth=2;c.beginPath();c.ellipse(0,-30,HW*1.32,HH*1.02,0,Math.PI,Math.PI*1.7);c.stroke();c.restore();
  // plant
  for(let i=-2;i<=2;i++){const g=c.createLinearGradient(0,-32,i*8,-72);g.addColorStop(0,'#2e5e1e');g.addColorStop(1,'#5aa83a');c.strokeStyle=g;c.lineWidth=4;c.lineCap='round';c.beginPath();c.moveTo(i*8,-32);c.quadraticCurveTo(i*20,-56,i*26,-72);c.stroke();}
 }
 else if(t==='marble'){
  plShadow(c,0,2,15,6,.3);const hue=p.hue||200;
  const base=`hsl(${hue},62%,52%)`;
  const g=c.createRadialGradient(LIGHT.x*9,-12+LIGHT.y*9,1.5,0,-11,18);
  g.addColorStop(0,`hsl(${hue},75%,90%)`);g.addColorStop(.3,`hsl(${hue},66%,62%)`);g.addColorStop(.78,base);g.addColorStop(1,`hsl(${hue},58%,26%)`);
  c.fillStyle=g;c.beginPath();c.arc(0,-12,16,0,7);c.fill();
  c.save();c.globalAlpha=.45;c.fillStyle=`hsl(${hue+50},70%,52%)`;c.beginPath();c.ellipse(3,-10,6,12,.7,0,7);c.fill();c.restore();
  // glassy double highlight
  glint(c,LIGHT.x*9,-12+LIGHT.y*9,3.4);
  c.fillStyle='rgba(255,255,255,.4)';c.beginPath();c.arc(4,-4,2,0,7);c.fill();
 }
 else if(t==='rock'){
  plShadow(c,0,4,HW*1.4,HH*1.0,.3);
  // faceted pebble
  (function(){const g=c.createLinearGradient(0,-26*p.r,0,6);g.addColorStop(0,'#b4b8be');g.addColorStop(.5,'#8e9298');g.addColorStop(1,'#62666c');c.fillStyle=g;c.beginPath();c.moveTo(-HW*1.2,2);c.lineTo(-HW*.55,-20*p.r);c.lineTo(HW*.5,-26*p.r);c.lineTo(HW*1.2,-2);c.lineTo(HW*.6,6);c.lineTo(-HW*.7,6);c.closePath();c.fill();})();
  c.fillStyle='#c2c6cc';c.beginPath();c.moveTo(-HW*.55,-20*p.r);c.lineTo(HW*.5,-26*p.r);c.lineTo(HW*.25,-11);c.lineTo(-HW*.3,-9);c.closePath();c.fill();
  c.fillStyle='#54585e';c.beginPath();c.moveTo(HW*.5,-26*p.r);c.lineTo(HW*1.2,-2);c.lineTo(HW*.45,-7);c.closePath();c.fill();
  glint(c,-HW*.2,-17*p.r,2.2);
 }
 else if(t==='mushroom'){
  plShadow(c,0,2,9*p.r,4*p.r,.26);
  (function(){const sg=c.createLinearGradient(-3,0,3,0);sg.addColorStop(0,'#d8cdb6');sg.addColorStop(.5,'#f6eedb');sg.addColorStop(1,'#c8bda4');c.strokeStyle=sg;c.lineWidth=5*p.r;c.lineCap='round';c.beginPath();c.moveTo(0,2);c.lineTo(0,-12*p.r);c.stroke();})();
  (function(){const cg=c.createRadialGradient(LIGHT.x*6*p.r,-15*p.r,1,0,-13*p.r,13*p.r);cg.addColorStop(0,'#ff8e7e');cg.addColorStop(.5,'#e2504a');cg.addColorStop(1,'#9e2c26');c.fillStyle=cg;c.beginPath();c.ellipse(0,-13*p.r,12*p.r,8*p.r,0,Math.PI,0);c.fill();})();
  c.fillStyle='#6e1f1a';c.beginPath();c.ellipse(0,-13*p.r,12*p.r,2.4*p.r,0,0,Math.PI);c.fill();
  c.fillStyle='#fff';for(const o of[[-5,-15],[3,-17],[-1,-12]]){c.beginPath();c.arc(o[0]*p.r,o[1]*p.r,1.7*p.r,0,7);c.fill();}
  glint(c,-4*p.r,-17*p.r,1.6*p.r);
 }
 else if(t==='stick'){const a=screenAng(p.ang);c.rotate(a);const L=p.len*HW*.9;plLimb(c,'#6e4d2c',0,0,L,-3,5);c.strokeStyle='#5a3d22';c.lineWidth=3;c.lineCap='round';c.beginPath();c.moveTo(L*.5,-1.5);c.lineTo(L*.7,-7);c.stroke();}
 else if(t==='leaf'){/* leaf is a scattered deco type drawn in drawDeco; ignored as a prop */}
 else if(t==='can'){
  plShadow(c,0,2,16,6,.3);
  (function(){const bg=c.createLinearGradient(-15,0,15,0);bg.addColorStop(0,'#7e1f1f');bg.addColorStop(.3,'#e04545');bg.addColorStop(.48,'#ff7a7a');bg.addColorStop(.7,'#cc3333');bg.addColorStop(1,'#7e1f1f');c.fillStyle=bg;rr(c,-15,-52,30,52,4);c.fill();})();
  c.fillStyle='#c8ccd2';rr(c,-15,-52,30,6,3);c.fill();rr(c,-15,-6,30,6,3);c.fill();
  (function(){const tg=c.createLinearGradient(-15,0,15,0);tg.addColorStop(0,'#9aa0a8');tg.addColorStop(.5,'#f2f6fa');tg.addColorStop(1,'#9aa0a8');c.fillStyle=tg;c.beginPath();c.ellipse(0,-52,15,6,0,0,7);c.fill();})();
  c.fillStyle='#b6bcc4';c.beginPath();c.ellipse(0,-52,11,4,0,0,7);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.4)';rr(c,-12,-50,3,46,1.5);c.fill();c.restore();
  c.fillStyle='#fff';c.font='bold 11px sans-serif';c.save();c.translate(-9,-22);c.rotate(-1.1);c.fillText('SODA',0,0);c.restore();
 }
 else if(t==='pencil'){const a=screenAng(p.ang);c.rotate(a);const L=p.len*HW*.95;
  (function(){const g=c.createLinearGradient(0,-9,0,2);g.addColorStop(0,'#ffd54a');g.addColorStop(.5,'#f2b830');g.addColorStop(1,'#caa018');c.fillStyle=g;rr(c,0,-9,L,11,2);c.fill();})();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.4)';rr(c,2,-8,L-4,2.5,1);c.fill();c.restore();
  c.fillStyle='#e8c9a0';c.beginPath();c.moveTo(L,-9);c.lineTo(L+16,-3.5);c.lineTo(L,2);c.closePath();c.fill();
  c.fillStyle='#333';c.beginPath();c.moveTo(L+16,-3.5);c.lineTo(L+10,-6);c.lineTo(L+10,-1);c.closePath();c.fill();
  c.fillStyle='#ec8888';rr(c,-8,-9,8,11,2);c.fill();c.fillStyle='#c8c8cc';rr(c,-1,-9,3,11,1);c.fill();
 }
 else if(t==='fork'||t==='spoon'){const a=screenAng(p.ang);c.rotate(a);const L=p.len*HW*.9;
  (function(){const g=c.createLinearGradient(0,-3,0,3);g.addColorStop(0,'#f0f4f8');g.addColorStop(.5,'#c4c8ce');g.addColorStop(1,'#9aa0a8');c.fillStyle=g;rr(c,0,-3,L,6,3);c.fill();})();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.6)';rr(c,L*.1,-2,L*.7,1.4,.7);c.fill();c.restore();
  if(t==='fork'){c.fillStyle='#c8ccd2';for(let i=0;i<4;i++){rr(c,L,-5+i*2.6,9,1.7,.8);c.fill();}}
  else{(function(){const bg=c.createRadialGradient(L+4,-1,1,L+6,0,9);bg.addColorStop(0,'#f0f4f8');bg.addColorStop(1,'#aeb4bc');c.fillStyle=bg;c.beginPath();c.ellipse(L+6,0,8,5.5,0,0,7);c.fill();})();c.fillStyle='#8a9098';c.beginPath();c.ellipse(L+7,1,5.5,3.6,0,0,7);c.fill();}
 }
 else if(t==='sugar'){
  plShadow(c,0,3,14,5,.26);
  c.fillStyle='#eef1f6';rr(c,-12,-22,24,24,3);c.fill();
  c.fillStyle='#ffffff';rr(c,-12,-22,24,9,3);c.fill();
  c.fillStyle='#c8cdd6';c.beginPath();c.moveTo(12,-22);c.lineTo(12,2);c.lineTo(6,5);c.lineTo(6,-19);c.closePath();c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.5)';rr(c,-10,-20,8,6,2);c.fill();c.restore();
  // crystalline speckle
  c.fillStyle='rgba(255,255,255,.7)';for(let i=0;i<8;i++)c.fillRect(-10+Math.random()*20,-20+Math.random()*22,1,1);
 }
 else if(t==='bowl'){
  plShadow(c,0,4,HW*2.2,HH*1.4,.3);
  (function(){const g=c.createLinearGradient(0,-30,0,0);g.addColorStop(0,'#f2ece2');g.addColorStop(1,'#cfc8bb');c.fillStyle=g;c.beginPath();c.ellipse(0,-8,HW*2.2,HH*2,0,Math.PI*.95,Math.PI*2.08);c.fill();})();
  c.fillStyle='#bcb4a6';c.beginPath();c.ellipse(0,-10,HW*2.2,HH*1.6,.2,0,7);c.fill();
  c.fillStyle='#9a9286';c.beginPath();c.ellipse(0,-9,HW*1.9,HH*1.3,.2,0,7);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.4)';c.beginPath();c.ellipse(-HW,-22,14,5,0,0,7);c.fill();c.restore();
 }
 else if(t==='wall'){
  // sand-castle wall block
  (function(){const g=c.createLinearGradient(0,-22,0,4);g.addColorStop(0,'#eccb8e');g.addColorStop(1,'#c4a266');c.fillStyle=g;c.beginPath();c.moveTo(-HW*.8,-22);c.lineTo(HW*.8,-22);c.lineTo(HW*.6,4);c.lineTo(-HW*.6,4);c.closePath();c.fill();})();
  c.fillStyle='#e8c890';c.beginPath();c.ellipse(0,-22,HW*.8,HH*.6,0,0,7);c.fill();
  c.fillStyle='#a8854e';c.beginPath();c.ellipse(0,-22,HW*.5,HH*.36,0,0,7);c.fill();
 }
 else if(t==='bucket'){
  plShadow(c,0,8,HW*1.6,HH*1.2,.3);
  (function(){const g=c.createLinearGradient(-HW*1.6,0,HW*1.6,0);g.addColorStop(0,'#a82a22');g.addColorStop(.4,'#e2483e');g.addColorStop(.55,'#f06a5e');g.addColorStop(1,'#9e2820');c.fillStyle=g;c.beginPath();c.moveTo(-HW*1.6,-56);c.lineTo(HW*1.6,-56);c.lineTo(HW*1.2,6);c.lineTo(-HW*1.2,6);c.closePath();c.fill();})();
  c.fillStyle='#f29080';c.beginPath();c.ellipse(0,-56,HW*1.6,HH*1.2,0,0,7);c.fill();
  c.fillStyle='#d9b873';c.beginPath();c.ellipse(0,-56,HW*1.28,HH*.92,0,0,7);c.fill();// sand inside
  c.strokeStyle='#7e221c';c.lineWidth=3;c.beginPath();c.ellipse(0,-60,HW*1.1,HH*2.2,0,Math.PI*1.08,Math.PI*1.92);c.stroke();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.3)';c.beginPath();c.ellipse(-HW*.9,-30,5,18,.1,0,7);c.fill();c.restore();
 }
 else if(t==='shovel'){const a=screenAng(p.ang);c.rotate(a);const L=p.len*HW*.9;plLimb(c,'#3a7de0',0,-2.5,L*.7,-2.5,7);
  (function(){const g=c.createLinearGradient(L*.7,-12,L*.7,7);g.addColorStop(0,'#ffd24d');g.addColorStop(1,'#d8a018');c.fillStyle=g;c.beginPath();c.moveTo(L*.7,-12);c.lineTo(L,-9);c.lineTo(L+12,-1);c.lineTo(L,7);c.lineTo(L*.7,4);c.closePath();c.fill();})();
  c.fillStyle='#c9920e';c.beginPath();c.moveTo(L,-9);c.lineTo(L+12,-1);c.lineTo(L,7);c.lineTo(L*.92,-1);c.closePath();c.fill();
  glint(c,L*.85,-5,2);c.fillStyle='#3a7de0';c.beginPath();c.ellipse(-2,-2.5,5,6.5,0,0,7);c.fill();
 }
 else if(t==='rake'){const a=screenAng(p.ang);c.rotate(a);const L=p.len*HW*.9;plLimb(c,'#5aa64a',0,-1,L*.75,-1,6);c.fillStyle='#e84d3c';rr(c,L*.75,-9,5,18,2);c.fill();for(let i=0;i<5;i++){c.strokeStyle='#e84d3c';c.lineWidth=2.4;c.lineCap='round';c.beginPath();c.moveTo(L*.75+5,-9+i*4.5);c.lineTo(L*.75+13,-9+i*4.5);c.stroke();}glint(c,L*.4,-2,2);}
 else if(t==='star'){
  plShadow(c,0,2,22,9,.26);
  const sp=(oy,sc)=>{c.beginPath();for(let i=0;i<10;i++){const a2=i*Math.PI/5-Math.PI/2,r2=i%2?9*sc:24*sc,px=Math.cos(a2)*r2*1.15,py=Math.sin(a2)*r2*.6;i?c.lineTo(px,py+oy):c.moveTo(px,py+oy);}c.closePath();};
  c.fillStyle='#8a3530';sp(-3,1);c.fill();
  (function(){const g=c.createRadialGradient(LIGHT.x*8,-9,1,0,-7,26);g.addColorStop(0,'#ff8a72');g.addColorStop(.6,'#e2655a');g.addColorStop(1,'#b3493e');c.fillStyle=g;sp(-7,1);c.fill();})();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.25)';sp(-9,.6);c.fill();c.restore();
 }
 else if(t==='dino'){
  plShadow(c,2,3,HW*1.6,HH*1.0,.3);
  // glossy green toy dino
  (function(){const g=c.createRadialGradient(LIGHT.x*8,-16,2,-2,-12,20);g.addColorStop(0,'#7ad08a');g.addColorStop(.6,'#4aa65a');g.addColorStop(1,'#2e7040');c.fillStyle=g;c.beginPath();c.ellipse(-4,-14,16,11,0,0,7);c.fill();})();
  c.fillStyle='#4aa65a';c.beginPath();c.moveTo(8,-16);c.quadraticCurveTo(22,-22,26,-34);c.quadraticCurveTo(20,-30,12,-24);c.closePath();c.fill();// neck/head
  c.fillStyle='#3c8a4a';for(let i=0;i<4;i++){c.beginPath();c.moveTo(-12+i*7,-24);c.lineTo(-9+i*7,-33);c.lineTo(-6+i*7,-24);c.closePath();c.fill();}// back plates
  plLimb(c,'#3c8a4a',-16,-4,-26,4,4);// tail
  c.fillStyle='#143a22';c.beginPath();c.arc(22,-31,1.6,0,7);c.fill();
  glint(c,-8,-18,2.4);
 }
 else if(t==='tower'){
  plShadow(c,0,3,HW*1.5,HH*1.0,.3);
  const cols=['#eccb8e','#dcb478','#eccb8e'];
  for(let lv=0;lv<3;lv++){const yy=-lv*16,r=(3-lv)*9;
   (function(){const g=c.createLinearGradient(-r,yy,r,yy);g.addColorStop(0,shade(cols[lv],.78));g.addColorStop(.5,cols[lv]);g.addColorStop(1,shade(cols[lv],.78));c.fillStyle=g;c.beginPath();c.moveTo(-r,yy);c.lineTo(r,yy);c.lineTo(r*.8,yy-13);c.lineTo(-r*.8,yy-13);c.closePath();c.fill();})();
   c.fillStyle=shade(cols[lv],1.14);c.beginPath();c.ellipse(0,yy-13,r*.8,r*.3,0,0,7);c.fill();
   c.fillStyle=shade(cols[lv],.94);c.beginPath();c.ellipse(0,yy-13,r*.55,r*.2,0,0,7);c.fill();}
  // flag pin
  c.strokeStyle='#8a6f46';c.lineWidth=1.5;c.beginPath();c.moveTo(0,-46);c.lineTo(0,-54);c.stroke();c.fillStyle='#e2483e';c.beginPath();c.moveTo(0,-54);c.lineTo(8,-52);c.lineTo(0,-49);c.closePath();c.fill();
 }
 else if(t==='shellp'){
  plShadow(c,0,3,14,6,.24);
  (function(){const g=c.createLinearGradient(0,-12,0,18);g.addColorStop(0,'#fbf2e4');g.addColorStop(1,'#e0cdb2');c.fillStyle=g;c.beginPath();c.moveTo(0,4);for(let i=0;i<7;i++){const a2=Math.PI+i/6*Math.PI;c.lineTo(Math.cos(a2)*14,4+Math.sin(a2)*16);}c.closePath();c.fill();})();
  c.strokeStyle='#d0bca0';c.lineWidth=1.4;for(let i=0;i<6;i++){const a2=Math.PI+i/5*Math.PI;c.beginPath();c.moveTo(0,4);c.lineTo(Math.cos(a2)*13,4+Math.sin(a2)*15);c.stroke();}
  glint(c,-3,-5,2.4);
 }
 else if(t==='lily'){
  // a floating lily pad with a notch and a tiny bud; sits flat on the water
  const r=(p.r2||1.2)*10;
  c.save();c.scale(1,.5);
  const g=c.createRadialGradient(-r*.3,-r*.3,1,0,0,r);g.addColorStop(0,'#5fb84a');g.addColorStop(1,'#2f7a2a');c.fillStyle=g;
  c.beginPath();c.arc(0,0,r,.5,Math.PI*2-.0);c.lineTo(0,0);c.closePath();c.fill();
  c.strokeStyle='rgba(20,60,20,.35)';c.lineWidth=1;for(let i=0;i<5;i++){const a2=.7+i/5*(6.28-1.4);c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a2)*r,Math.sin(a2)*r);c.stroke();}
  c.restore();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.18)';c.beginPath();c.ellipse(-r*.3,-r*.18,r*.4,r*.16,0,0,7);c.fill();c.restore();
  if(Math.abs((p.x+p.y))%3<1){c.fillStyle='#f4d6ec';c.beginPath();c.arc(r*.2,-3,2.2,0,7);c.fill();c.fillStyle='#ffe98c';c.beginPath();c.arc(r*.2,-3,1,0,7);c.fill();}
 }
 else if(t==='couch'){
  plShadow(c,0,9,HW*2.6,HH*1.6,.3);
  const col='#6b7fa8';
  box(c,shade(col,.9),0,0,-HW*2.2,-42,HW*4.4,24,8);    // backrest
  box(c,shade(col,1.06),0,0,-HW*2.5,-34,15,30,7);      // left arm
  box(c,shade(col,1.06),0,0,HW*2.5-15,-34,15,30,7);    // right arm
  box(c,col,0,0,-HW*2.2,-24,HW*4.4,24,8);              // seat base
  box(c,shade(col,1.14),0,0,-HW*1.85,-28,HW*1.75,15,5);// cushion L
  box(c,shade(col,1.14),0,0,HW*0.1,-28,HW*1.75,15,5);  // cushion R
  c.fillStyle='#4a3320';c.fillRect(-HW*1.9,-2,5,5);c.fillRect(HW*1.9-5,-2,5,5); // feet
 }
 else if(t==='chair'){
  plShadow(c,0,7,HW*1.5,HH*1.2,.3);
  const col='#7e8aa6';
  box(c,shade(col,.9),0,0,-HW*1.1,-40,HW*2.2,22,7);    // backrest
  box(c,shade(col,1.06),0,0,-HW*1.35,-32,12,26,6);     // left arm
  box(c,shade(col,1.06),0,0,HW*1.35-12,-32,12,26,6);   // right arm
  box(c,col,0,0,-HW*1.1,-22,HW*2.2,22,7);              // seat
  box(c,shade(col,1.14),0,0,-HW*.85,-26,HW*1.7,14,5);  // cushion
  c.fillStyle='#4a3320';c.fillRect(-HW*.9,-2,4,5);c.fillRect(HW*.9-4,-2,4,5);
 }
 else if(t==='table'){
  plShadow(c,0,6,HW*1.8,HH*1.3,.3);
  c.fillStyle='#6e4a28';c.fillRect(-HW*1.3,-14,5,16);c.fillRect(HW*1.3-5,-14,5,16);   // back legs
  c.fillStyle='#5a3c20';c.fillRect(-HW*.7,-12,5,14);c.fillRect(HW*.7-5,-12,5,14);      // front legs
  slab(c,'#9a6a3c',-HW*1.6,-26,HW*3.2,12,5,5);                                          // wooden top
  c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,235,200,.25)';c.lineWidth=1.2;c.beginPath();c.moveTo(-HW*1.4,-22);c.lineTo(HW*1.4,-22);c.stroke();c.restore();
 }
 else if(t==='console'){
  plShadow(c,0,7,HW*2.2,HH*1.4,.3);
  const col='#5a4636';
  slab(c,col,-HW*2.0,-30,HW*4.0,22,6,5);                                  // low cabinet body
  c.fillStyle=shade(col,.8);for(let i=0;i<3;i++){rr(c,-HW*1.8+i*HW*1.25,-27,HW*1.05,16,3);c.fill();} // door panels
  c.fillStyle='#c8b48a';for(let i=0;i<3;i++){c.beginPath();c.arc(-HW*1.8+i*HW*1.25+HW*1.05-4,-19,1.4,0,7);c.fill();}  // knobs
  c.fillStyle='#3a2c20';c.fillRect(-HW*1.9,-2,5,4);c.fillRect(HW*1.9-5,-2,5,4); // feet
 }
 else if(t==='shelf'){
  plShadow(c,0,5,HW*1.5,HH*1.1,.3);
  const col='#6b4a2c';
  box(c,col,0,0,-HW*1.1,-68,HW*2.2,68,5);                                  // tall body
  // deterministic colorful book spines on each shelf (seeded by position so they don't flicker)
  let seed=(((p.x*73856093)^(p.y*19349663))>>>0)||1;const rb=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const bookCols=['#d6543e','#3a7de0','#e0a82a','#5aa64a','#9a5ad0','#e06aa0'];
  for(let s=0;s<4;s++){const sy2=-60+s*15;
   c.fillStyle=shade(col,.7);c.fillRect(-HW*.95,sy2+12,HW*1.9,2);          // shelf board
   let bx=-HW*.9;while(bx<HW*.85){const bw=3+rb()*3,bh=9+rb()*3;c.fillStyle=bookCols[Math.floor(rb()*bookCols.length)];rr(c,bx,sy2+12-bh,bw,bh,1);c.fill();bx+=bw+1;}
  }
 }
 else if(t==='lamp'){
  plShadow(c,0,3,12,5,.28);
  c.fillStyle='#3a3a40';c.beginPath();c.ellipse(0,0,8,3,0,0,7);c.fill();    // base
  c.strokeStyle='#9aa0a8';c.lineWidth=3;c.lineCap='round';c.beginPath();c.moveTo(0,-2);c.lineTo(0,-52);c.stroke(); // pole
  c.save();c.globalCompositeOperation='lighter';const lg=c.createRadialGradient(0,-56,2,0,-56,26);lg.addColorStop(0,'rgba(255,236,160,.5)');lg.addColorStop(1,'rgba(255,236,160,0)');c.fillStyle=lg;c.beginPath();c.arc(0,-56,26,0,7);c.fill();c.restore(); // glow
  (function(){const sg=c.createLinearGradient(0,-66,0,-50);sg.addColorStop(0,'#fbe9b8');sg.addColorStop(1,'#e8c878');c.fillStyle=sg;c.beginPath();c.moveTo(-9,-50);c.lineTo(9,-50);c.lineTo(13,-66);c.lineTo(-13,-66);c.closePath();c.fill();})(); // shade
  c.fillStyle='#f6dca0';c.beginPath();c.ellipse(0,-66,13,3,0,0,7);c.fill();
 }
 else if(t==='blocks'){
  // a toy alphabet block: a colored cube with a beveled face and a letter
  const hue=p.hue!=null?p.hue:40;c.rotate((p.rot||0)-0.3);
  const col=`hsl(${hue},65%,55%)`;
  slab(c,col,-12,-24,24,22,7,4);
  c.fillStyle=`hsl(${hue},60%,46%)`;rr(c,-8,-21,16,15,2);c.fill();          // inset face
  const letters='ABCXYZ';c.fillStyle='rgba(255,255,255,.92)';c.font='bold 13px sans-serif';c.textAlign='center';c.fillText(letters[Math.floor(hue/60)%6]||'A',0,-9);c.textAlign='left';
  glint(c,-5,-19,2);
 }
 else if(t==='soccer'){
  // a classic black&white soccer ball
  plShadow(c,0,4,26,11,.32);
  plSphere(c,'#f2f2ee',0,-18,23,1,0);
  c.save();c.beginPath();c.arc(0,-18,22.4,0,7);c.clip();
  c.fillStyle='#23262b';
  c.beginPath();for(let i=0;i<5;i++){const a=-1.57+i/5*6.283;c.lineTo(Math.cos(a)*8,-18+Math.sin(a)*8)}c.closePath();c.fill();
  for(let k=0;k<5;k++){const a=-1.57+(k+.5)/5*6.283;const px=Math.cos(a)*20,py=-18+Math.sin(a)*20;
   c.beginPath();for(let i=0;i<5;i++){const b2=a+i/5*6.283;c.lineTo(px+Math.cos(b2)*6.5,py+Math.sin(b2)*6.5)}c.closePath();c.fill();}
  c.restore();
  gloss(c,-8,-27,5,3);glint(c,-6,-26,2.2);
 }
 else if(t==='gnome'){
  // a cheery garden gnome: blue coat, white beard, red cone hat
  plShadow(c,0,3,17,8,.3);
  (function(){const g=c.createLinearGradient(-12,-24,12,0);g.addColorStop(0,'#4a6fd0');g.addColorStop(.5,'#3a5cb8');g.addColorStop(1,'#28407e');c.fillStyle=g;
   c.beginPath();c.moveTo(-11,2);c.quadraticCurveTo(-13,-22,0,-24);c.quadraticCurveTo(13,-22,11,2);c.quadraticCurveTo(0,7,-11,2);c.closePath();c.fill();})();
  c.fillStyle='#f6efe2';c.beginPath();c.moveTo(-8,-22);c.quadraticCurveTo(0,-12,8,-22);c.quadraticCurveTo(6,-8,0,-6);c.quadraticCurveTo(-6,-8,-8,-22);c.closePath();c.fill(); // beard
  c.fillStyle='#e8b590';c.beginPath();c.ellipse(0,-25,6.5,5.5,0,0,7);c.fill();               // face
  c.fillStyle='#d98a70';c.beginPath();c.arc(0,-23.5,1.8,0,7);c.fill();                       // nose
  (function(){const g=c.createLinearGradient(-8,-52,8,-26);g.addColorStop(0,'#ff6a52');g.addColorStop(.5,'#e2483e');g.addColorStop(1,'#a82c26');c.fillStyle=g;
   c.beginPath();c.moveTo(-9,-27);c.quadraticCurveTo(-2,-56,2,-56);c.quadraticCurveTo(9,-46,9,-27);c.quadraticCurveTo(0,-31,-9,-27);c.closePath();c.fill();})(); // hat
  c.fillStyle='#2c2c30';c.beginPath();c.arc(-2.6,-26.5,.9,0,7);c.arc(2.6,-26.5,.9,0,7);c.fill();
  gloss(c,-4,-46,3,5);glint(c,-4,-30,1.6);
 }
 else if(t==='wcan'){
  // a molded green watering can with a long spout & rose
  plShadow(c,2,4,34,11,.3);
  (function(){const g=c.createLinearGradient(-18,0,18,0);g.addColorStop(0,'#2e7a3c');g.addColorStop(.45,'#54ac5e');g.addColorStop(.6,'#66c26e');g.addColorStop(1,'#25612f');c.fillStyle=g;
   c.beginPath();c.moveTo(-17,2);c.lineTo(-15,-34);c.lineTo(15,-34);c.lineTo(17,2);c.quadraticCurveTo(0,8,-17,2);c.closePath();c.fill();})();
  c.fillStyle='#3f9450';c.beginPath();c.ellipse(0,-34,15,5.5,0,0,7);c.fill();
  c.fillStyle='#1f4a26';c.beginPath();c.ellipse(0,-34,10,3.6,0,0,7);c.fill();
  plLimb(c,'#2e7a3c',-15,-22,-36,-40,6);                       // spout
  c.fillStyle='#54ac5e';c.beginPath();c.ellipse(-37,-41,5,4,-.5,0,7);c.fill(); // rose
  c.fillStyle='#1f4a26';for(let i=0;i<5;i++){const a=i/5*6.28;c.beginPath();c.arc(-37+Math.cos(a)*2.2,-41+Math.sin(a)*1.8,.7,0,7);c.fill();}
  c.strokeStyle='#2e7a3c';c.lineWidth=4.5;c.lineCap='round';c.beginPath();c.moveTo(8,-36);c.quadraticCurveTo(26,-46,16,-22);c.stroke(); // handle
  gloss(c,-8,-26,4,7);
 }
 else if(t==='snail'){
  // a little garden snail — cosmetic
  plShadow(c,0,3,13,5,.24);
  c.fillStyle='#b9a06a';c.beginPath();c.moveTo(-14,2);c.quadraticCurveTo(-2,-2,10,0);c.quadraticCurveTo(14,2,10,4);c.quadraticCurveTo(-6,6,-14,2);c.closePath();c.fill(); // body
  c.strokeStyle='#b9a06a';c.lineWidth=2;c.lineCap='round';c.beginPath();c.moveTo(9,-1);c.lineTo(13,-8);c.moveTo(11,-1);c.lineTo(16,-6);c.stroke(); // eye stalks
  c.fillStyle='#6e4d2c';c.beginPath();c.arc(13,-8,1.1,0,7);c.arc(16,-6,1.1,0,7);c.fill();
  (function(){const g=c.createRadialGradient(-6,-9,1,-4,-6,10);g.addColorStop(0,'#d8a468');g.addColorStop(1,'#8a5a30');c.fillStyle=g;c.beginPath();c.arc(-4,-6,9,0,7);c.fill();})();
  c.strokeStyle='rgba(90,58,28,.75)';c.lineWidth=1.6;c.beginPath();
  for(let a=0;a<12;a+=.3){const rr2=1+a*.62;c.lineTo(-4+Math.cos(a)*rr2,-6+Math.sin(a)*rr2*.9)}c.stroke();
  glint(c,-7,-10,1.8);
 }
 else if(t==='rack'){
  // a wire dish rack holding a row of leaning plates (line blocker)
  const a=screenAng(p.ang);c.rotate(a);const L=p.len*HW*.9;
  plShadow(c,L*.5,4,L*.62,10,.28);
  c.strokeStyle='#c4c8ce';c.lineWidth=3;c.lineCap='round';
  c.beginPath();c.moveTo(0,2);c.lineTo(L,2);c.moveTo(0,-8);c.lineTo(L,-8);c.stroke();          // rails
  for(let i=0;i<=6;i++){const x=i/6*L;c.beginPath();c.moveTo(x,4);c.lineTo(x,-26);c.stroke();} // wires
  c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,255,255,.5)';c.lineWidth=1.2;c.beginPath();c.moveTo(0,-9);c.lineTo(L,-9);c.stroke();c.restore();
  const np=Math.max(3,Math.round(p.len)+1);
  for(let i=0;i<np;i++){const x=(i+.5)/np*L;
   (function(){const g=c.createLinearGradient(x-9,0,x+9,0);g.addColorStop(0,'#c9cdd4');g.addColorStop(.5,'#ffffff');g.addColorStop(1,'#b8bcc4');c.fillStyle=g;
    c.beginPath();c.ellipse(x,-16,9,15,-.12,0,7);c.fill();})();
   c.strokeStyle='#aab0b8';c.lineWidth=1.4;c.beginPath();c.ellipse(x,-16,5.4,9.6,-.12,0,7);c.stroke();
  }
  glint(c,L*.3,-27,2);
 }
 else if(t==='plate'){
  // a short stack of dinner plates
  plShadow(c,0,3,25,9,.28);
  for(let s2=0;s2<2;s2++){const yy=-4-s2*7;
   (function(){const g=c.createLinearGradient(-24,yy,24,yy);g.addColorStop(0,'#c9cdd4');g.addColorStop(.5,'#ffffff');g.addColorStop(1,'#b8bcc4');c.fillStyle=g;
    c.beginPath();c.ellipse(0,yy,24,9.5,0,0,7);c.fill();})();
   c.strokeStyle='#b0b6be';c.lineWidth=1.4;c.beginPath();c.ellipse(0,yy-1,15,5.6,0,0,7);c.stroke();
  }
  c.fillStyle='#eef1f5';c.beginPath();c.ellipse(0,-12,15,5.4,0,0,7);c.fill();
  gloss(c,-8,-14,4,2.2);
 }
 else if(t==='mug'){
  // a big glossy mug (per-map hue)
  const hue=p.hue!=null?p.hue:16;
  plShadow(c,1,3,19,8,.3);
  (function(){const g=c.createLinearGradient(-15,0,15,0);g.addColorStop(0,`hsl(${hue},62%,38%)`);g.addColorStop(.42,`hsl(${hue},68%,58%)`);g.addColorStop(.58,`hsl(${hue},72%,66%)`);g.addColorStop(1,`hsl(${hue},60%,33%)`);c.fillStyle=g;rr(c,-15,-38,30,40,5);c.fill();})();
  c.strokeStyle=`hsl(${hue},55%,42%)`;c.lineWidth=6;c.beginPath();c.arc(19,-20,8,-1.3,1.3);c.stroke(); // handle
  c.fillStyle=`hsl(${hue},60%,70%)`;c.beginPath();c.ellipse(0,-38,15,5.6,0,0,7);c.fill();
  c.fillStyle='#3a2c20';c.beginPath();c.ellipse(0,-38,12,4.2,0,0,7);c.fill();               // coffee
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.4)';rr(c,-12,-35,3.5,33,1.6);c.fill();c.restore();
 }
 else if(t==='salt'){
  // a glass salt shaker with a chrome cap
  plShadow(c,0,3,12,5,.26);
  (function(){const g=c.createLinearGradient(-9,0,9,0);g.addColorStop(0,'rgba(210,222,232,.85)');g.addColorStop(.5,'rgba(250,253,255,.9)');g.addColorStop(1,'rgba(190,202,214,.85)');c.fillStyle=g;
   c.beginPath();c.moveTo(-9,2);c.quadraticCurveTo(-10,-18,-6,-26);c.lineTo(6,-26);c.quadraticCurveTo(10,-18,9,2);c.quadraticCurveTo(0,6,-9,2);c.closePath();c.fill();})();
  c.fillStyle='rgba(255,255,255,.9)';c.beginPath();c.moveTo(-8,0);c.quadraticCurveTo(0,3,8,0);c.lineTo(7,-8);c.quadraticCurveTo(0,-5,-7,-8);c.closePath();c.fill(); // salt inside
  (function(){const g=c.createLinearGradient(-7,-38,7,-26);g.addColorStop(0,'#9aa0a8');g.addColorStop(.5,'#f2f6fa');g.addColorStop(1,'#8a9098');c.fillStyle=g;rr(c,-7,-38,14,12,4);c.fill();})();
  c.fillStyle='#5a6068';for(let i=0;i<5;i++){const a=i/5*6.28;c.beginPath();c.arc(Math.cos(a)*3,-33+Math.sin(a)*2,.8,0,7);c.fill();}
  glint(c,-4,-20,1.8);
 }
 else if(t==='toaster'){
  // a rounded chrome two-slice toaster
  plShadow(c,2,4,30,10,.3);
  (function(){const g=c.createLinearGradient(-26,0,26,0);g.addColorStop(0,'#8a9098');g.addColorStop(.35,'#e8ecf2');g.addColorStop(.5,'#ffffff');g.addColorStop(.65,'#d2d8e0');g.addColorStop(1,'#787e86');c.fillStyle=g;
   c.beginPath();c.moveTo(-26,2);c.lineTo(-26,-30);c.quadraticCurveTo(-26,-44,-12,-44);c.lineTo(12,-44);c.quadraticCurveTo(26,-44,26,-30);c.lineTo(26,2);c.quadraticCurveTo(0,7,-26,2);c.closePath();c.fill();})();
  c.fillStyle='#3a3e44';rr(c,-17,-44,14,5,2.4);c.fill();rr(c,3,-44,14,5,2.4);c.fill(); // slots
  c.fillStyle='#d8b878';c.beginPath();c.moveTo(-14,-44);c.quadraticCurveTo(-10,-52,-6,-44);c.closePath();c.fill(); // toast peeking
  c.fillStyle='#c4c8ce';rr(c,-30,-22,5,10,2);c.fill();                                   // lever
  c.fillStyle='#e2483e';c.beginPath();c.arc(18,-8,2.2,0,7);c.fill();                     // knob
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.55)';rr(c,-20,-40,4,36,2);c.fill();c.restore();
 }
 else if(t==='beachball'){
  // a big striped inflatable beach ball
  plShadow(c,0,5,27,11,.32);
  plSphere(c,'#f4f1ea',0,-22,25,1,0);
  c.save();c.beginPath();c.arc(0,-22,24.4,0,7);c.clip();
  const cols=['#e2483e','#ffd23f','#2f9e4f','#3a6fd8'];
  for(let i=0;i<4;i++){c.fillStyle=cols[i];c.beginPath();c.moveTo(0,-46);
   c.quadraticCurveTo((i-1.5)*26,-22,0,2);c.quadraticCurveTo((i-2.5)*26,-22,0,-46);c.closePath();c.globalAlpha=.85;c.fill();}
  c.globalAlpha=1;c.restore();
  c.fillStyle='#f4f1ea';c.beginPath();c.arc(0,-46,3.2,0,7);c.fill();
  gloss(c,-9,-32,6,4);glint(c,-7,-31,2.4);
 }
 else if(t==='dumptruck'){
  // a chunky yellow toy dump truck
  plShadow(c,2,4,40,12,.32);
  (function(){const g=c.createLinearGradient(-6,-40,-6,-6);g.addColorStop(0,'#ffd54a');g.addColorStop(.6,'#f2b830');g.addColorStop(1,'#c08a18');c.fillStyle=g;   // tipper bed
   c.beginPath();c.moveTo(-40,-34);c.lineTo(4,-30);c.lineTo(2,-8);c.lineTo(-34,-10);c.closePath();c.fill();})();
  c.fillStyle='#c08a18';c.beginPath();c.moveTo(-40,-34);c.lineTo(-36,-38);c.lineTo(6,-34);c.lineTo(4,-30);c.closePath();c.fill();
  c.fillStyle='#8a6a3c';c.beginPath();c.ellipse(-18,-30,14,4,-.06,0,7);c.fill();          // sand load
  (function(){const g=c.createLinearGradient(6,-36,6,-8);g.addColorStop(0,'#ff8a3c');g.addColorStop(.55,'#e86a1e');g.addColorStop(1,'#a8480e');c.fillStyle=g;    // cab
   rr(c,6,-36,26,26,5);c.fill();})();
  c.fillStyle='#bfe3ef';rr(c,11,-32,15,10,3);c.fill();                                     // windshield
  c.fillStyle='#23262b';for(const wx of [-26,-6,18]){c.beginPath();c.ellipse(wx,-4,8,7,0,0,7);c.fill();c.fillStyle='#4a4e54';c.beginPath();c.ellipse(wx,-4.6,4,3.4,0,0,7);c.fill();c.fillStyle='#23262b';}
  glint(c,14,-30,2.2);gloss(c,-24,-34,5,2.4);
 }
 else if(t==='keep'){
  // the grand castle keep: a molded sand fortress tower with crenellations & gate
  plShadow(c,0,4,HW*1.9,HH*1.3,.32);
  const cols=['#eccb8e','#e2bd80','#d8b070'];
  for(let lv=0;lv<3;lv++){const yy=-lv*26,r0=(3.4-lv*.8)*13;
   (function(){const g=c.createLinearGradient(-r0,yy,r0,yy);g.addColorStop(0,shade(cols[lv],.74));g.addColorStop(.5,cols[lv]);g.addColorStop(1,shade(cols[lv],.74));c.fillStyle=g;
    c.beginPath();c.moveTo(-r0,yy);c.lineTo(r0,yy);c.lineTo(r0*.84,yy-24);c.lineTo(-r0*.84,yy-24);c.closePath();c.fill();})();
   c.fillStyle=shade(cols[lv],1.12);c.beginPath();c.ellipse(0,yy-24,r0*.84,r0*.3,0,0,7);c.fill();
   // crenellations along the tier rim
   c.fillStyle=shade(cols[lv],.9);
   for(let i=-2;i<=2;i++){const bx=i*r0*.34;c.fillRect(bx-3.4,yy-24-7,6.8,7);}
  }
  // gate arch + door
  c.fillStyle='#6e4d2c';c.beginPath();c.moveTo(-9,0);c.lineTo(-9,-16);c.quadraticCurveTo(0,-26,9,-16);c.lineTo(9,0);c.closePath();c.fill();
  c.strokeStyle='#4a3018';c.lineWidth=1.4;for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(i*3.4,-1);c.lineTo(i*3.4,-17);c.stroke();}
  // pennant
  c.strokeStyle='#8a6f46';c.lineWidth=2;c.beginPath();c.moveTo(0,-76);c.lineTo(0,-92);c.stroke();
  c.fillStyle='#e2483e';c.beginPath();c.moveTo(0,-92);c.lineTo(14,-88);c.lineTo(0,-84);c.closePath();c.fill();
  // sandy speckle
  c.save();c.globalAlpha=.4;for(let i=0;i<40;i++){const px=(Math.random()-.5)*70,py=-Math.random()*70;c.fillStyle=Math.random()<.5?'rgba(255,240,210,.5)':'rgba(120,90,44,.5)';c.fillRect(px,py,1.2,1.2);}c.restore();
  gloss(c,-14,-58,4,6);
 }
 else if(t==='slipper'){
  // a plush house slipper
  plShadow(c,0,3,28,9,.28);
  (function(){const g=c.createLinearGradient(-28,0,28,0);g.addColorStop(0,'#b86a8a');g.addColorStop(.5,'#d98aa8');g.addColorStop(1,'#a05a78');c.fillStyle=g;
   c.beginPath();c.moveTo(-28,-4);c.quadraticCurveTo(-30,-14,-18,-15);c.lineTo(16,-13);c.quadraticCurveTo(30,-11,28,-2);c.quadraticCurveTo(26,4,12,5);c.lineTo(-16,4);c.quadraticCurveTo(-28,3,-28,-4);c.closePath();c.fill();})();
  c.fillStyle='#8a4a64';c.beginPath();c.ellipse(12,-8,15,9,-.12,0,7);c.fill();            // opening
  c.fillStyle='#f2d8e2';c.beginPath();c.ellipse(12,-9.4,13,7,-.12,0,7);c.fill();          // fleece lining
  c.save();c.globalAlpha=.55;c.strokeStyle='#f2d8e2';c.lineWidth=1;                        // fuzz
  for(let i=0;i<26;i++){const a=Math.random()*6.28,px=-6+Math.cos(a)*22,py=-6+Math.sin(a)*8;c.beginPath();c.moveTo(px,py);c.lineTo(px+(Math.random()-.5)*3,py-2-Math.random()*2);c.stroke();}c.restore();
  gloss(c,-18,-12,4,2);
 }
 else if(t==='remote'){
  // a TV remote dropped on the floor
  plShadow(c,0,3,22,7,.26);
  c.save();c.rotate(-.32);
  (function(){const g=c.createLinearGradient(0,-9,0,7);g.addColorStop(0,'#3c4046');g.addColorStop(.5,'#23262b');g.addColorStop(1,'#101216');c.fillStyle=g;rr(c,-22,-9,44,16,6);c.fill();})();
  c.fillStyle='#e2483e';c.beginPath();c.arc(-15,-1,2.6,0,7);c.fill();
  const bcols=['#7a8088','#7a8088','#ffd23f','#7a8088','#5a9ad8','#7a8088'];
  for(let i=0;i<6;i++){c.fillStyle=bcols[i];c.beginPath();c.arc(-7+i*5,-1+(i%2?2.6:-2.6),1.9,0,7);c.fill();}
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.28)';rr(c,-20,-8,40,3,1.5);c.fill();c.restore();
  c.restore();
 }
 else if(t==='books'){
  // a stack of three hardback picture books
  plShadow(c,0,4,30,10,.3);
  const bk=[['#3a6fd8',26,0],['#2f9e4f',23,-.1],['#e2483e',27,.14]];
  for(let i=0;i<3;i++){const [col,w,rot]=bk[i];const yy=-6-i*9;
   c.save();c.translate(0,yy);c.rotate(rot);
   (function(){const g=c.createLinearGradient(-w,0,w,0);g.addColorStop(0,shade(col,.7));g.addColorStop(.5,col);g.addColorStop(1,shade(col,.62));c.fillStyle=g;rr(c,-w,-8,w*2,10,2.4);c.fill();})();
   c.fillStyle='#f2ead8';rr(c,-w+2,-3.4,w*2-4,4.2,1.5);c.fill();  // pages
   c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.3)';rr(c,-w+2,-7.4,w*2-4,2,1);c.fill();c.restore();
   c.restore();
  }
  glint(c,-12,-30,1.8);
 }
 else if(t==='keyboard'){
  // a compact keyboard slab with a grid of little keys
  plShadow(c,0,4,34,12,.3);
  (function(){const g=c.createLinearGradient(0,-20,0,7);g.addColorStop(0,'#3a3f47');g.addColorStop(.5,'#2b2f36');g.addColorStop(1,'#1c1f24');c.fillStyle=g;rr(c,-32,-18,64,26,4);c.fill();})();
  c.fillStyle='#20242a';rr(c,-30,-16,60,22,3);c.fill();
  for(let ky=0;ky<3;ky++)for(let kx=0;kx<9;kx++){const bx2=-28+kx*6.6,by2=-14+ky*6.4;
   const g=c.createLinearGradient(bx2,by2,bx2,by2+5);g.addColorStop(0,'#e8ebef');g.addColorStop(1,'#b4b9c0');c.fillStyle=g;rr(c,bx2,by2,5.2,5,1.2);c.fill();}
  c.fillStyle='#d6dae0';rr(c,-14,5.6,28,3.4,1.5);c.fill(); // spacebar
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.18)';rr(c,-30,-17,60,3,2);c.fill();c.restore();
 }
 else if(t==='chips'){
  // a shiny snack bag standing on end
  plShadow(c,0,3,20,8,.3);
  (function(){const g=c.createLinearGradient(-16,0,16,0);g.addColorStop(0,'#b8341f');g.addColorStop(.4,'#f26a35');g.addColorStop(.6,'#ffd24a');g.addColorStop(1,'#c23a1a');c.fillStyle=g;c.beginPath();c.moveTo(-16,6);c.lineTo(-13,-34);c.lineTo(13,-34);c.lineTo(16,6);c.closePath();c.fill();})();
  for(const yy of [-34,6]){c.save();c.translate(0,yy);c.fillStyle='#8a2413';for(let i=-14;i<14;i+=3)c.fillRect(i,-2,1.6,4);c.restore();} // crimped seals
  c.fillStyle='rgba(255,255,255,.85)';c.beginPath();c.ellipse(0,-14,8,6,0,0,7);c.fill();
  c.fillStyle='#d23a1a';c.beginPath();c.ellipse(0,-14,5,3.4,0,0,7);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.4)';c.beginPath();c.ellipse(-7,-20,3,12,.2,0,7);c.fill();c.restore();
 }
 else if(t==='eraser'){
  plShadow(c,0,2,14,6,.28);
  (function(){const g=c.createLinearGradient(0,-14,0,2);g.addColorStop(0,'#ff9fb6');g.addColorStop(.5,'#f56e90');g.addColorStop(1,'#d24b70');c.fillStyle=g;rr(c,-12,-12,24,16,2.5);c.fill();})();
  c.fillStyle='#ffffff';rr(c,-12,-4,24,4,1.5);c.fill(); // paper sleeve
  c.fillStyle='#4a7fd0';rr(c,-12,-2.6,24,1.4,1);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.4)';rr(c,-10,-11,20,2.4,1);c.fill();c.restore();
 }
 else if(t==='traincar'){
  // a wooden-toy train car (engine when p.eng) rotated along its track tangent
  const hue=p.hue!=null?p.hue:8;const a=screenAng(p.rot||0);c.rotate(a);
  plShadow(c,0,4,22,9,.3);
  c.fillStyle='#23262b';for(const wx of [-11,11]){c.beginPath();c.ellipse(wx,-3,5.5,5,0,0,7);c.fill();c.fillStyle='#4a4e54';c.beginPath();c.ellipse(wx,-3.4,2.6,2.2,0,0,7);c.fill();c.fillStyle='#23262b';}
  (function(){const g=c.createLinearGradient(0,-26,0,-4);g.addColorStop(0,`hsl(${hue},64%,60%)`);g.addColorStop(.6,`hsl(${hue},60%,48%)`);g.addColorStop(1,`hsl(${hue},58%,34%)`);c.fillStyle=g;rr(c,-18,-24,36,18,4);c.fill();})();
  if(p.eng){
   c.fillStyle=`hsl(${hue},55%,36%)`;rr(c,4,-38,13,15,3);c.fill();            // cab
   c.fillStyle='#3a3e44';rr(c,-13,-34,7,11,2.4);c.fill();                     // funnel
   c.fillStyle='#5a5e64';c.beginPath();c.ellipse(-9.5,-34,4.6,2,0,0,7);c.fill();
   c.fillStyle='#ffd23f';c.beginPath();c.arc(-17,-15,2.6,0,7);c.fill();       // lamp
  } else {
   c.fillStyle='rgba(255,255,255,.85)';rr(c,-12,-21,10,7,2);c.fill();rr(c,2,-21,10,7,2);c.fill(); // windows
  }
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.3)';rr(c,-16,-23,32,2.6,1.3);c.fill();c.restore();
  glint(c,-13,-21,1.6);
 }
}

/* ===================== WILDLIFE NESTS & CREATURES ===================== */
function drawNest(c,ns){
 if(ns.dead)return; // v25: smashed dens leave only ground debris
 const sx=isoX(ns.x,ns.y),sy=isoY(ns.x,ns.y);c.save();c.translate(sx,sy);
 if(ns._spr)c.drawImage(ns._spr.cv,-ns._spr.ax,-ns._spr.ay,ns._spr.w,ns._spr.h);
 else nestBody(c,ns);
 // a faint danger ring when the nest is roused
 if(ns.aggro){c.save();c.globalCompositeOperation='lighter';const pl=.3+Math.sin(G.tick*.2)*.15;c.strokeStyle=`rgba(255,80,40,${pl})`;c.lineWidth=2;c.beginPath();c.ellipse(0,4,ns.r*HW,ns.r*HH,0,0,7);c.stroke();c.restore();}
 c.restore();
}
/* nest painter at local origin (bake target / live fallback) */
function nestBody(c,ns){
 if(ns.species==='ant'){
  // a molded sand ant-hill: a fat cone with a dark crater on top
  plShadow(c,0,4,20,11,.32);
  (function(){const g=c.createLinearGradient(-12,-18,12,8);g.addColorStop(0,'#c8a36a');g.addColorStop(.5,'#b08a52');g.addColorStop(1,'#8a6a3c');c.fillStyle=g;c.beginPath();c.moveTo(-18,6);c.quadraticCurveTo(-10,-20,0,-22);c.quadraticCurveTo(10,-20,18,6);c.quadraticCurveTo(0,12,-18,6);c.closePath();c.fill();})();
  // grainy speckle
  c.save();c.globalAlpha=.5;for(let i=0;i<28;i++){const a=Math.random()*6.28,rr2=Math.random();const px=Math.cos(a)*16*rr2,py=-6+Math.sin(a)*10*rr2;c.fillStyle=Math.random()<.5?'rgba(255,240,210,.4)':'rgba(80,55,25,.4)';c.beginPath();c.arc(px,py,.8,0,7);c.fill();}c.restore();
  // crater
  c.fillStyle='#3a2a16';c.beginPath();c.ellipse(0,-16,6,3,0,0,7);c.fill();
  c.fillStyle='#211509';c.beginPath();c.ellipse(0,-15.5,3.4,1.6,0,0,7);c.fill();
  /* v97: a worked mound - a lit crater rim, two side galleries part-way
     down the slope, and a ring of carried pebbles banked at the foot */
  c.save();c.globalAlpha=.5;c.strokeStyle='#e8cf9a';c.lineWidth=1;
  c.beginPath();c.ellipse(0,-16.3,5.6,2.6,0,Math.PI*1.05,Math.PI*1.95);c.stroke();c.restore();
  c.fillStyle='#2a1c0e';c.beginPath();c.ellipse(-8,-6,2.2,1.2,-.4,0,7);c.fill();
  c.fillStyle='#241708';c.beginPath();c.ellipse(9,-3,1.8,1,-.3,0,7);c.fill();
  for(let i=0;i<10;i++){const a=(i/10)*Math.PI+.12;const px=Math.cos(a)*17.5,py=7.5+Math.sin(a)*3;
   c.fillStyle=i%2?'#c9b184':'#9a8256';c.beginPath();c.arc(px,py,1+((i*7)%3)*.3,0,7);c.fill();}
  gloss(c,-6,-12,4,2.4);
 } else if(ns.species==='roach'){
  // v66: a roach den - a gnawed corrugated flap propped off the ground with a
  // dark hollow underneath and chewed crumbs banked around the mouth.
  plShadow(c,0,4,19,10,.34);
  // the chewed board, a leaning quad with a ragged top edge
  (function(){const g=c.createLinearGradient(-14,-20,10,6);g.addColorStop(0,'#c69a62');g.addColorStop(.55,'#a87c46');g.addColorStop(1,'#7a5730');c.fillStyle=g;
   c.beginPath();c.moveTo(-16,6);c.lineTo(-13,-14);c.lineTo(-4,-18);c.lineTo(6,-13);c.lineTo(15,-16);c.lineTo(17,6);c.closePath();c.fill();})();
  // corrugation ribs
  c.strokeStyle='rgba(96,66,34,.45)';c.lineWidth=1.1;
  for(let i=0;i<5;i++){const xx=-12+i*6;c.beginPath();c.moveTo(xx,4);c.lineTo(xx+1.6,-13);c.stroke();}
  // the hollow the swarm boils out of
  c.fillStyle='#241608';c.beginPath();c.ellipse(0,4,9,4.2,0,0,7);c.fill();
  c.fillStyle='#100a04';c.beginPath();c.ellipse(0,4.6,5.6,2.4,0,0,7);c.fill();
  // crumbs banked at the mouth
  for(let i=0;i<9;i++){const a=Math.random()*Math.PI;const px=Math.cos(a)*(7+Math.random()*7),py=7+Math.sin(a)*2.4;
   c.fillStyle=Math.random()<.5?'rgba(214,180,126,.8)':'rgba(150,118,72,.8)';c.beginPath();c.arc(px,py,.9+Math.random(),0,7);c.fill();}
  /* v97: human litter a roach den collects - a bottle cap by the mouth,
     rusted nail heads in the board, and gnaw marks up the ragged edge */
  c.fillStyle='#b8443a';c.beginPath();c.arc(12,4.6,2,0,7);c.fill();
  c.fillStyle='#d8d2c4';c.beginPath();c.arc(12,4.6,1.2,0,7);c.fill();
  c.save();c.globalAlpha=.7;c.fillStyle='#5a4028';
  for(const q of [[-10,-8],[-2,-13],[8,-9]]){c.beginPath();c.arc(q[0],q[1],.8,0,7);c.fill();}
  c.globalAlpha=.5;c.strokeStyle='#6a4c2c';c.lineWidth=.8;
  for(const q of [[-12,-13],[-8,-16],[2,-16.6]]){c.beginPath();c.moveTo(q[0],q[1]);c.lineTo(q[0]+2,q[1]+1.2);c.stroke();}
  c.restore();
  gloss(c,-7,-11,4,2.4);
 } else {
  // a papery wasp nest hanging from a stalk: a teardrop with ridged bands
  c.strokeStyle='#7a6a4a';c.lineWidth=2;c.beginPath();c.moveTo(0,-34);c.lineTo(0,-24);c.stroke();
  plShadow(c,0,6,14,7,.3);
  (function(){const g=c.createLinearGradient(-8,-26,8,8);g.addColorStop(0,'#d8c9a6');g.addColorStop(1,'#9c8a64');c.fillStyle=g;c.beginPath();c.moveTo(0,-24);c.quadraticCurveTo(-14,-16,-12,0);c.quadraticCurveTo(-8,12,0,12);c.quadraticCurveTo(8,12,12,0);c.quadraticCurveTo(14,-16,0,-24);c.closePath();c.fill();})();
  c.strokeStyle='rgba(120,104,72,.5)';c.lineWidth=1.2;for(let i=0;i<4;i++){const yy=-14+i*6;c.beginPath();c.moveTo(-11+i,yy);c.quadraticCurveTo(0,yy+4,11-i,yy);c.stroke();}
  // dark entrance hole
  c.fillStyle='#2a2014';c.beginPath();c.ellipse(0,6,3,2.4,0,0,7);c.fill();
  /* v97: paper is BUILT - two more wrap bands low on the teardrop, exposed
     comb cells peeking at the entrance lip, and a papery scallop edge */
  c.save();c.globalAlpha=.4;c.strokeStyle='rgba(120,104,72,.9)';c.lineWidth=1;
  for(const yy of [6,10]){c.beginPath();c.moveTo(-9+yy*.4,yy);c.quadraticCurveTo(0,yy+3,9-yy*.4,yy);c.stroke();}
  c.restore();
  c.save();c.globalAlpha=.8;c.fillStyle='#c9b88e';
  for(const q of [[-2.2,4.2],[2.2,4.4],[0,3.4]]){c.beginPath();c.arc(q[0],q[1],.9,0,7);c.fill();}
  c.fillStyle='#6a5a3c';
  for(const q of [[-2.2,4.2],[2.2,4.4],[0,3.4]]){c.beginPath();c.arc(q[0],q[1],.45,0,7);c.fill();}
  c.restore();
  c.save();c.globalAlpha=.5;c.strokeStyle='#b6a67e';c.lineWidth=.9;
  c.beginPath();c.moveTo(-7,11);c.quadraticCurveTo(-4,12.6,-1,11.6);c.quadraticCurveTo(2,12.8,5,11.2);c.stroke();c.restore();
  gloss(c,-5,-16,4,3);
 }
}
/* a single molded toy creature (ant or wasp) */
function drawBug(c,cr){
 const sx=isoX(cr.x,cr.y),sy=isoY(cr.x,cr.y);
 const fly=cr.t.fly,gz=fly?12:0;
 const ang=screenAng(cr.face);
 const ms=cr.species==='mouse'?4:cr.species==='roach'?2:1; // v37: bigger mouse (4x) & roach (2x) models — visual only; collision/targeting unchanged
 plShadow(c,sx,sy+(fly?2:1),(fly?7:8)*ms,(fly?3:4)*ms,fly?.2:.34);
 c.save();c.translate(sx,sy-gz);c.rotate(ang);if(ms!==1)c.scale(ms,ms);
 const hit=cr.flash>0;
 if(cr.species==='ant'||cr.species==='fireant'){
  const fire=cr.species==='fireant';
  const body=fire?'#d6381a':'#7a1f12',leg=fire?'#7a1408':'#3a1208';
  // six legs, animated - v97: two segments each, a bent knee instead of a stick
  c.strokeStyle=leg;c.lineWidth=1.2;c.lineCap='round';
  for(let s=-1;s<=1;s+=2)for(let i=-1;i<=1;i++){const ph=cr.legph+i*1.1+(s>0?1.5:0);
   const ly=s*2.4,lx=i*3;
   const kx=lx+Math.cos(ph)*1.2,ky=ly*.8+s*1.6+Math.sin(ph)*.5;
   const fx=lx+Math.cos(ph)*2.2,fy=ly+Math.sin(ph)*1.2+s*2.5;
   c.beginPath();c.moveTo(lx,ly*.5);c.lineTo(kx,ky);c.lineTo(fx,fy);c.stroke();}
  // three body segments (gaster, thorax, head)
  plSphere(c,body,-4.2,0,3.2,.9,false); // gaster
  plSphere(c,body,0,0,2.4,.9,false);    // thorax
  plSphere(c,body,3.6,0,2.6,.9,false);  // head
  /* v97: an ant is segmented - petiole waist, gaster band lines, and two
     glossy eye dots on the head */
  c.save();c.globalAlpha=.55;c.strokeStyle=leg;c.lineWidth=.7;
  c.beginPath();c.moveTo(-2.2,-1.4);c.quadraticCurveTo(-1.8,0,-2.2,1.4);c.stroke();
  c.beginPath();c.moveTo(-4.4,-1.8);c.quadraticCurveTo(-4,0,-4.4,1.8);c.stroke();
  c.beginPath();c.moveTo(-5.8,-1.3);c.quadraticCurveTo(-5.5,0,-5.8,1.3);c.stroke();c.restore();
  c.fillStyle='#0e0804';c.beginPath();c.arc(4.4,-1.2,.55,0,7);c.fill();c.beginPath();c.arc(4.4,1.2,.55,0,7);c.fill();
  c.fillStyle='rgba(255,255,255,.55)';c.beginPath();c.arc(4.25,-1.35,.2,0,7);c.fill();
  // mandibles + antennae
  c.strokeStyle=leg;c.lineWidth=1;c.beginPath();c.moveTo(5.4,-1);c.lineTo(7.4,-2.2);c.moveTo(5.4,1);c.lineTo(7.4,2.2);c.stroke();
  c.beginPath();c.moveTo(5,-1.4);c.lineTo(7.6,-3.4);c.moveTo(5,1.4);c.lineTo(7.6,3.4);c.stroke();
  glint(c,3,-1,.7);
  if(fire){c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,120,40,.45)';c.beginPath();c.arc(-3,0,3.6,0,7);c.fill();c.fillStyle='rgba(255,220,120,.5)';c.beginPath();c.arc(-3,0,1.7,0,7);c.fill();c.restore();}
 } else if(cr.species==='bee'||cr.species==='wasp'){
  // hovering flyer: striped abdomen, thin wings, fast wingbeat (wasp = bigger/darker)
  const wasp=cr.species==='wasp',sc=wasp?1.35:1,wob=Math.sin(cr.wob*3)*1.2;
  c.save();c.scale(sc,sc);
  // blurred wings
  c.save();c.globalAlpha=.4;c.fillStyle=wasp?'#dfe6ff':'#e8f0ff';for(const s of[-1,1]){c.beginPath();c.ellipse(-1,s*3.4+wob*.2,4.6,2.3,s*.4,0,7);c.fill();}c.restore();
  // body
  plSphere(c,wasp?'#20263f':'#3a2c10',3.4,0,2.5,.9,false); // head/thorax
  // striped gaster
  for(let i=0;i<3;i++){const bx=-1-i*2.2;plSphere(c,wasp?(i%2?'#3a4472':'#12162a'):(i%2?'#ffd23f':'#221a08'),bx,0,2.7-i*.4,.85,false);}
  // stinger
  c.strokeStyle=wasp?'#0c1020':'#1a1206';c.lineWidth=1.3;c.beginPath();c.moveTo(-6,0);c.lineTo(-8.8,0);c.stroke();
  // antennae
  c.strokeStyle=wasp?'#0c1020':'#1a1206';c.lineWidth=.9;c.beginPath();c.moveTo(5,-1);c.lineTo(7,-2.4);c.moveTo(5,1);c.lineTo(7,2.4);c.stroke();
  /* v97: big compound eyes and a vein through each wing blur */
  c.fillStyle=wasp?'#1a2036':'#241a08';c.beginPath();c.ellipse(4.4,-1.1,.9,.7,0,0,7);c.fill();c.beginPath();c.ellipse(4.4,1.1,.9,.7,0,0,7);c.fill();
  c.fillStyle='rgba(255,255,255,.5)';c.beginPath();c.arc(4.2,-1.3,.3,0,7);c.fill();
  c.save();c.globalAlpha=.35;c.strokeStyle='#ffffff';c.lineWidth=.6;
  for(const s2 of [-1,1]){c.beginPath();c.moveTo(0,s2*2.2);c.quadraticCurveTo(-2.4,s2*3.6+wob*.2,-4.6,s2*3.8);c.stroke();}
  c.restore();
  glint(c,3.4,-1,.7);
  c.restore();
 } else if(cr.species==='roach'){
  // long glossy beetle: dark carapace, pronotum shield, long antennae
  c.save();c.scale(1.3,1.3);
  const rb='#3a2410',rb2='#1c1006',sh='#5a3a1c';
  c.strokeStyle=rb2;c.lineWidth=1.8;c.lineCap='round';
  for(let s=-1;s<=1;s+=2)for(let i=-1;i<=1;i++){const ph=cr.legph+i*1.0+(s>0?1.5:0);const ly=s*3.2,lx=i*4.2;c.beginPath();c.moveTo(lx,ly*.5);c.lineTo(lx+Math.cos(ph)*3,ly+Math.sin(ph)*1.6+s*3.4);c.stroke();}
  plSphere(c,rb,-3,0,5.2,.8,false);   // abdomen
  plSphere(c,rb,2,0,4.6,.85,false);   // wing case
  plSphere(c,sh,6.4,0,3.6,.9,false);  // pronotum shield
  plSphere(c,rb2,9.4,0,2.2,.9,false); // head
  c.strokeStyle=rb2;c.lineWidth=1;c.beginPath();c.moveTo(0,0);c.lineTo(-7,0);c.stroke(); // wing seam
  /* v97: chitin detail - a lit edge along each wing case, spiracle dots
     down the flank, and pronotum shine */
  c.save();c.globalAlpha=.3;c.strokeStyle='#c89a5e';c.lineWidth=.7;
  c.beginPath();c.moveTo(-6.5,-1.2);c.quadraticCurveTo(-1,-2.6,3,-2.2);c.stroke();
  c.beginPath();c.moveTo(-6.5,1.2);c.quadraticCurveTo(-1,2.6,3,2.2);c.stroke();c.restore();
  c.save();c.globalAlpha=.5;c.fillStyle=rb2;
  for(let i=0;i<3;i++){c.beginPath();c.arc(-5+i*3,-3.6,.4,0,7);c.fill();c.beginPath();c.arc(-5+i*3,3.6,.4,0,7);c.fill();}
  c.restore();
  c.fillStyle='rgba(255,240,210,.28)';c.beginPath();c.ellipse(6.2,-1.2,1.4,.7,-.3,0,7);c.fill();
  c.strokeStyle=rb2;c.lineWidth=1.1;c.beginPath();c.moveTo(11,-1);c.quadraticCurveTo(15,-4,17.5,-2);c.moveTo(11,1);c.quadraticCurveTo(15,4,17.5,2);c.stroke();
  glint(c,4,-2,1.2);
  c.restore();
 } else if(cr.species==='mouse'){
  // chunky gray rodent mini-boss: big ears, pink nose, long tail
  c.save();c.scale(1.5,1.5);
  const mb='#8a8f98',mb2='#6a6f78',pink='#e79aa6';
  c.strokeStyle=mb2;c.lineWidth=2.2;c.lineCap='round';c.beginPath();c.moveTo(-8,0);c.quadraticCurveTo(-15,Math.sin(cr.wob)*3,-19,Math.sin(cr.wob*1.3)*5);c.stroke(); // tail
  plSphere(c,mb,-2,0,8.5,.85,false);  // body
  plSphere(c,mb,7,0,5.5,.9,false);    // head
  plSphere(c,mb2,5,-5,2.8,.8,false);plSphere(c,mb2,5,5,2.8,.8,false); // ears
  plSphere(c,pink,5,-5,1.5,.7,false);plSphere(c,pink,5,5,1.5,.7,false);
  plSphere(c,mb,12,0,2.8,.9,false);   // snout
  c.fillStyle=pink;c.beginPath();c.arc(14.5,0,1.6,0,7);c.fill(); // nose
  c.fillStyle='#101014';c.beginPath();c.arc(9,-2.6,1.2,0,7);c.arc(9,2.6,1.2,0,7);c.fill(); // eyes
  c.strokeStyle='rgba(240,240,245,.7)';c.lineWidth=.7;c.beginPath();c.moveTo(13,-1);c.lineTo(19,-3);c.moveTo(13,1);c.lineTo(19,3);c.moveTo(13,0);c.lineTo(19,0);c.stroke(); // whiskers
  /* v97: it reads as an animal now - a haunch line over the hip, short fur
     strokes along the back, and little pink forepaws under the chin */
  c.save();c.globalAlpha=.4;c.strokeStyle=mb2;c.lineWidth=1;
  c.beginPath();c.ellipse(-4.5,1.5,4,4.6,.3,-.8,1.4);c.stroke();c.restore();
  c.save();c.globalAlpha=.35;c.strokeStyle='#5a5f68';c.lineWidth=.6;
  for(let i=0;i<6;i++){const fx=-8+i*2.6;c.beginPath();c.moveTo(fx,-5.6+Math.abs(i-2.5)*.5);c.lineTo(fx-1.4,-4+Math.abs(i-2.5)*.5);c.stroke();}
  c.restore();
  c.fillStyle=pink;c.beginPath();c.arc(9.5,4.6,.9,0,7);c.fill();c.beginPath();c.arc(11.5,4.2,.9,0,7);c.fill();
  glint(c,8,-3,1.6);
  c.restore();
 }
 if(hit){c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.5)';c.beginPath();c.arc(0,0,6,0,7);c.fill();c.restore();}
 c.restore();
 /* v100: a SELECTED creature wears the ring every other selected thing wears -
    same yellow, same dash, same march - sized off the species' own model scale
    so a Mouse gets a mouse-sized ring. Selecting a bug and seeing nothing on
    the field was the other half of "wildlife is not selectable": the panel
    throwing was why it never read, and this is why it never LOOKED selected. */
 if(cr.sel){c.save();c.strokeStyle='#ffec6e';c.lineWidth=2.2;c.setLineDash([4,3]);c.lineDashOffset=-G.tick*1.5;
  c.beginPath();c.ellipse(sx,sy-gz,10*ms,5*ms,0,0,7);c.stroke();c.restore();}
 // tiny HP pip when hurt - or whenever it is selected, so the bar you came to read is there
 if(cr.hp<cr.mhp||cr.t.boss||cr.sel){const bw=cr.t.boss?26:14,bh=cr.t.boss?4:3,by=sy-gz-(cr.t.boss?18:9);c.fillStyle='rgba(0,0,0,.5)';rr(c,sx-bw/2,by,bw,bh,1.5);c.fill();c.fillStyle=cr.t.boss?'#ff3b3b':'#ff6e4d';rr(c,sx-bw/2+.6,by+.6,(bw-1.2)*clamp(cr.hp/cr.mhp,0,1),bh-1.4,1);c.fill();}
}

/* pulsing "actively mining" highlight */
function drawMineFX(c,sx,sy,s,n){
 const pulse=1+Math.sin(G.tick*.32)*.18;
 c.save();
 c.strokeStyle='rgba(255,210,90,.95)';c.lineWidth=3;c.beginPath();c.ellipse(sx,sy+2,(s*1.5+6)*pulse,(s*.6+3)*pulse,0,0,7);c.stroke();
 c.strokeStyle='rgba(255,170,50,.5)';c.lineWidth=2;c.beginPath();c.ellipse(sx,sy+2,(s*1.5+12)*pulse,(s*.6+6)*pulse,0,0,7);c.stroke();
 for(let i=0;i<4;i++){const ph=(G.tick*.12+i*1.9+n.x)%1;const a=i*1.6+n.x;const px=sx+Math.cos(a)*s*.7,py=sy-ph*22,alpha=(1-ph)*.9;c.globalAlpha=alpha;c.fillStyle=i%2?'#ffd23f':'#ff8c42';c.beginPath();c.arc(px,py,1.8+(1-ph)*1.2,0,7);c.fill();}
 c.globalAlpha=1;c.restore();
}

/* ===================== RESOURCE NODES ===================== */
/* v86 SUPPLY CRATE. A small green ammunition box with a painted band, drawn on the
   ground with the same contact shadow every loose item gets. The band takes the
   resource's colour rather than the owner's, because what matters when you glance
   at it is which crate is which; the owner is already the only army that can pick
   it up. Bobbing is a pure clock read (G.tick), never srand. */
function drawCrate(c,cr){
 const sx=isoX(cr.x,cr.y),sy=isoY(cr.x,cr.y);
 const bob=Math.sin(G.tick*.09+cr.x*3+cr.y*5)*.8;
 /* v100: the crate is drawn at CRATE_SC - at life size it read as scenery on
    textured ground and the owner could not find his own supplies. Its pulsing
    halo is NOT here: an additive glow inside the depth-sorted sprite band adds
    against band content rather than against the terrain (the v94 note), so it
    is drawn by drawCrateGlow from renderCore, on the ground layer where the
    heal rings and the buried-mine markers live. */
 plShadow(c,sx,sy+2,9*CRATE_SC,4.6*CRATE_SC,.3);
 c.save();c.translate(sx,sy-6*CRATE_SC+bob);c.scale(CRATE_SC,CRATE_SC);
 const body='#4f7a37';
 (function(){const g=c.createLinearGradient(-9,-8,7,8);
  g.addColorStop(0,shade(body,1.35));g.addColorStop(.55,body);g.addColorStop(1,shade(body,.62));
  c.fillStyle=g;rr(c,-9,-7,18,14,2.4);c.fill();})();
 c.fillStyle=cr.kind==='e'?'#7fe3ff':'#ffb95e';rr(c,-9,-2.2,18,3.4,1);c.fill();   // painted band
 c.fillStyle='rgba(20,30,16,.42)';rr(c,-9,4.4,18,2.6,1);c.fill();                  // shadowed lower lip
 c.strokeStyle='rgba(24,34,20,.5)';c.lineWidth=1;c.strokeRect(-6.5,-5.5,13,11);    // lid seam
 plSphere(c,'#3a3a42',-6.4,-7.4,1.5,.8,false);plSphere(c,'#3a3a42',6.4,-7.4,1.5,.8,false); // corner latches
 gloss(c,-4.5,-5.5,2.4,2.2);
 c.fillStyle='#0e1a0c';c.font='bold 8px sans-serif';c.textAlign='center';c.textBaseline='middle';
 c.fillText(cr.kind==='e'?'⚡':'⬢',0,-.4);
 c.textAlign='left';c.textBaseline='alphabetic';
 c.restore();
}
/* v100: the supply crate's halo, drawn on the GROUND layer rather than inside
   the sprite band - additive compositing inside the band adds against band
   content instead of the terrain, which is exactly the cost the v94 record
   names for the heal glow and the rally pulse. Green because a crate is a
   crate whoever dropped it: the resource's colour is already on its band and
   the owner is already the only army that can collect it. It breathes on a
   plain G.tick read and never touches srand - rule 2. */
function drawCrateGlow(c,cr){
 const sx=isoX(cr.x,cr.y),sy=isoY(cr.x,cr.y);
 const pul=CRATE_GLOW*(0.72+0.28*Math.sin(G.tick*.11+cr.x*2+cr.y*3));
 c.save();c.globalCompositeOperation='lighter';
 const g=c.createRadialGradient(sx,sy-4,2,sx,sy-4,24*CRATE_SC);
 g.addColorStop(0,`rgba(150,255,110,${pul})`);
 g.addColorStop(.45,`rgba(90,220,80,${pul*.42})`);
 g.addColorStop(1,'rgba(60,180,60,0)');
 c.fillStyle=g;c.beginPath();c.ellipse(sx,sy-4,24*CRATE_SC,12*CRATE_SC,0,0,7);c.fill();
 c.restore();
}
function drawNode(c,n){
 const sx=isoX(n.x,n.y),sy=isoY(n.x,n.y),f=clamp(n.amt/n.max,0,1);
 let mined=false;for(const u of G.units){if(u.mining&&u.node===n){mined=true;break}}
 // lazy per-instance bake, refreshed when the amount crosses a fifth so piles
 // visibly shrink in molded steps; the shadow pass reads n._spr.sil
 if(SPR.done)bakeNode(n,f);
 c.save();c.translate(sx,sy);
 if(n._spr)c.drawImage(n._spr.cv,-n._spr.ax,-n._spr.ay,n._spr.w,n._spr.h);
 else nodeBody(c,n,f);
 if(!n.wreck&&n.t!=='plastic'){ // live charge gauge stays continuous
  c.fillStyle='#101418';rr(c,9.5,-44,2.8,42,1.4);c.fill();
  c.fillStyle='#5dff7a';rr(c,9.5,-44+42*(1-f),2.8,42*f,1.4);c.fill();
 }
 c.restore();
 if(n.wreck){
  const s=8+9*f;
  if(mined)drawMineFX(c,sx,sy,s,n);
  const bob=Math.sin(G.tick*.09+n.x)*2.5,by=sy-s*1.5-16+bob;
  c.globalAlpha=.85;c.fillStyle='rgba(255,150,40,.22)';c.beginPath();c.arc(sx,by,9,0,7);c.fill();
  c.fillStyle='#ff9b3a';c.font='bold 13px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('⬢',sx,by);c.textAlign='left';c.textBaseline='alphabetic';c.globalAlpha=1;
 } else if(n.t==='plastic'){
  const s=11+15*f;
  if(mined)drawMineFX(c,sx,sy,s,n);
  const bob=Math.sin(G.tick*.09+n.x)*3,by=sy-s*1.6-22+bob;
  c.globalAlpha=.9;c.fillStyle='rgba(255,150,40,.25)';c.beginPath();c.arc(sx,by,12,0,7);c.fill();
  c.fillStyle='#ff9b3a';c.font='bold 17px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('⬢',sx,by);c.textAlign='left';c.textBaseline='alphabetic';c.globalAlpha=1;
 } else {
  if(mined)drawMineFX(c,sx,sy,15,n);
 }
 if(n.sel){ // v40: selected resource pile - ring + floating amount readout
  c.save();c.strokeStyle='#ffec6e';c.lineWidth=2.2;c.setLineDash([4,3]);c.lineDashOffset=-G.tick*1.5;c.beginPath();c.ellipse(sx,sy,15,7.5,0,0,7);c.stroke();c.setLineDash([]);
  const lbl=''+Math.ceil(n.amt), ly=sy-54;
  c.font='bold 12px sans-serif';c.textAlign='center';c.textBaseline='middle';
  const tw=c.measureText(lbl).width+12;
  c.fillStyle='rgba(10,12,16,.75)';rr(c,sx-tw/2,ly-10,tw,20,5);c.fill();
  c.fillStyle='#ffe9b0';c.fillText(lbl,sx,ly);
  c.textAlign='left';c.textBaseline='alphabetic';c.restore();
 }
}
/* node painter at local origin. f is frozen at bake time (amount bucket).
   Shadows, mining FX, the floating icon and the battery gauge stay live. */
function nodeBody(c,n,f){
 if(n.wreck){
  const s=8+9*f, col=n.col||'#9aa0a8';
  for(let i=0;i<6;i++){const a=i*1.5+n.x,ox=Math.cos(a)*s*.7,oy=Math.sin(a)*s*.28,r=s*(.34+.16*Math.sin(a*2));const cc=i%2?col:'#c9622f';plSphere(c,cc,ox,oy-r*.3,r,.62,false);}
  c.strokeStyle=shade(col,.55);c.lineWidth=2.4;c.lineCap='round';c.beginPath();c.moveTo(-s*.5,-2);c.lineTo(-s*.1,-s*.7);c.stroke();
  return;
 }
 if(n.t==='plastic'){
  const s=11+15*f;
  const style=(Math.floor(n.x*3+n.y*7))%3;
  const cols=['#ff5e4d','#ffd23f','#4aa6ff','#6fdd5a','#ff8c42','#c44dff'];
  if(style===0){ // stacked toy building bricks
   const rows=Math.max(2,Math.round(2+f*2));
   for(let r=rows-1;r>=0;r--){const w=(s*1.4)-(rows-1-r)*3,yy=-r*8,col=cols[(r+Math.floor(n.x))%cols.length],bb=hx2rgb(col),top=mixc(bb,WHITE,.3),sd=mixc(bb,AMB,.4);
    // left face
    c.fillStyle=rgb(sd.r,sd.g,sd.b);c.beginPath();c.moveTo(-w,yy);c.lineTo(-w,yy+8);c.lineTo(0,yy+8+w*.34);c.lineTo(0,yy+w*.34);c.closePath();c.fill();
    // right face
    c.fillStyle=rgb(mixc(bb,AMB,.6).r,mixc(bb,AMB,.6).g,mixc(bb,AMB,.6).b);c.beginPath();c.moveTo(w,yy);c.lineTo(w,yy+8);c.lineTo(0,yy+8+w*.34);c.lineTo(0,yy+w*.34);c.closePath();c.fill();
    // top face
    c.fillStyle=rgb(top.r,top.g,top.b);c.beginPath();c.moveTo(-w,yy);c.lineTo(0,yy-w*.34);c.lineTo(w,yy);c.lineTo(0,yy+w*.34);c.closePath();c.fill();
    // studs
    for(let i=-1;i<=1;i++){c.fillStyle=rgb(bb.r,bb.g,bb.b);c.beginPath();c.ellipse(i*w*.5,yy-w*.04,3.4,1.8,0,0,7);c.fill();c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.35)';c.beginPath();c.ellipse(i*w*.5-1,yy-w*.04-.6,1.6,.9,0,0,7);c.fill();c.restore();}
   }
  } else if(style===1){ // soldier sprue / molded toy frame
   const col=cols[Math.floor(n.x)%cols.length];
   plLimb(c,col,-s*1.2,-2,s*1.2,-6,4);
   plLimb(c,col,-s*.9,-s*.7,s*.9,-s*.7-4,4);
   for(let i=0;i<5;i++){const px=-s+i*s*.5,off=(i%2)?-s*.7:0;plLimb(c,col,px,-2+off,px,-12+off,3);plSphere(c,col,px,-14+off,3,1,false);}
   glint(c,-s,-2,1.4);glint(c,s,-6,1.4);
  } else { // spilled toy-bin scrap
   for(let i=0;i<7;i++){const a=i*1.7+n.x,ox=Math.cos(a)*s*.7,oy=Math.sin(a)*s*.3,r=s*(.42+.18*Math.sin(a*2)),col=cols[i%cols.length];plSphere(c,col,ox,oy-r*.35,r,.62,false);}
  }
 } else {
  // AA battery
  plShadow(c,0,3,18,7,.32);
  (function(){const bg=c.createLinearGradient(-13,0,13,0);bg.addColorStop(0,'#16222a');bg.addColorStop(.32,'#34454f');bg.addColorStop(.52,'#566974');bg.addColorStop(.72,'#2a3840');bg.addColorStop(1,'#16222a');c.fillStyle=bg;rr(c,-13,-46,26,46,4);c.fill();})();
  (function(){const tg=c.createLinearGradient(-13,0,13,0);tg.addColorStop(0,'#7e6418');tg.addColorStop(.4,'#e6c24a');tg.addColorStop(.54,'#fff4b0');tg.addColorStop(.74,'#caa83c');tg.addColorStop(1,'#74601a');c.fillStyle=tg;rr(c,-13,-50,26,9,3);c.fill();})();
  (function(){const ng=c.createLinearGradient(-4,0,4,0);ng.addColorStop(0,'#888890');ng.addColorStop(.5,'#f2f4f8');ng.addColorStop(1,'#80808a');c.fillStyle=ng;rr(c,-4,-54,8,5,2);c.fill();})();
  c.fillStyle='#f4f7fa';c.font='bold 12px sans-serif';c.fillText('AA',-8,-20);
  c.fillStyle='#5cc8ff';c.font='bold 11px sans-serif';c.fillText('⚡',-5,-32);
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.22)';rr(c,-8,-45,3,43,1.5);c.fill();c.restore();
 }
}

