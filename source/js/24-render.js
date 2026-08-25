/* ---------------- RENDER ---------------- */
function drawGhost(c,cx,cy){
 const z=G.zoom;
 const key=G.placing.key,sz=B[key].sz;
 c.save();c.setTransform(z,0,0,z,-cx*z,-cy*z);
 // v32: aura rings while placing. Green = your legal zones (10 around HQs,
 // 4 around outposts), skipped for 'anywhere' keys (HQ/outpost placements
 // ignore them). Red = live-visible enemy HQ 10-tile exclusion rings
 // (fogAt===2 only, so fogged HQs never leak). Render-only, client-local.
 {
  const ring=(wx,wy,r,col)=>{c.beginPath();for(let i=0;i<=48;i++){const a=i/48*6.283185,px=wx+Math.cos(a)*r,py=wy+Math.sin(a)*r;i?c.lineTo(isoX(px,py),isoY(px,py)):c.moveTo(isoX(px,py),isoY(px,py))}c.strokeStyle=col;c.lineWidth=1.5;c.setLineDash([6,5]);c.stroke();c.setLineDash([])};
  if(!B[key].anywhere)for(const b of G.human.blds){
   if(b.key==='hq')ring(b.x,b.y,BUILD_R_HQ,'rgba(140,255,140,.55)');
   else if(b.key==='outpost')ring(b.x,b.y,BUILD_R_OUTPOST,'rgba(140,255,140,.55)');
  }
  /* v86: the Command Truck's zone, drawn only for the three keys it will actually
     carry - a ring around a truck that cannot take the structure being placed
     would be a promise the placement door then refuses. Client-side preview only,
     exactly like the two rings above it: placeDeny is what decides. */
  if(CMD_BLD.indexOf(key)>=0)for(const u of G.human.units){
   if(u.t.fwdcmd&&u.hp>0&&!u.garrisoned)ring(u.x,u.y,CMD_R,'rgba(140,255,140,.55)');
  }
  for(const q of G.players){
   if(allied(G.human,q))continue;
   for(const b of q.blds)if(b.key==='hq'&&b.hp>0&&fogAt(b.x,b.y)===2)ring(b.x,b.y,BUILD_R_FOEHQ,'rgba(255,110,110,.55)');
  }
 }
 const tile=(tx,ty,fill,stroke)=>{c.fillStyle=fill;c.beginPath();c.moveTo(isoX(tx,ty),isoY(tx,ty));c.lineTo(isoX(tx+1,ty),isoY(tx+1,ty));c.lineTo(isoX(tx+1,ty+1),isoY(tx+1,ty+1));c.lineTo(isoX(tx,ty+1),isoY(tx,ty+1));c.closePath();c.fill();c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();};
 if(B[key].barr){
  // barricade ghost: a single tile while hovering, the full run while dragging
  const end=unIso(MOUSE.x/z+cx,MOUSE.y/z+cy);
  const ex=Math.round(end.x-0.5),ey=Math.round(end.y-0.5);
  const tiles=G.barrDrag?barrLineTiles(G.barrDrag.x0,G.barrDrag.y0,ex,ey):[{x:ex,y:ey}];
  const cost=bcost(G.human,'barricade');let budget=G.human.res.p,payable=0;
  for(const t of tiles){
   const ok=canPlaceUI('barricade',t.x,t.y)&&budget>=cost.p;
   if(ok){budget-=cost.p;payable++;}
   tile(t.x,t.y,ok?'rgba(110,255,110,.32)':'rgba(255,80,80,.32)',ok?'#8f8':'#f88');
  }
  const sx2=isoX(ex+0.5,ey+0.5),sy2=isoY(ex+0.5,ey+0.5);
  c.fillStyle='#fff';c.font='bold 12px sans-serif';c.textAlign='center';
  c.fillText(`Barricade ×${payable} (${payable*cost.p} ⬢)`,sx2,sy2-26);c.textAlign='left';
  c.restore();return;
 }
 const w=unIso(MOUSE.x/z+cx,MOUSE.y/z+cy);
 const tx=Math.round(w.x-sz/2),ty=Math.round(w.y-sz/2),ok=canPlaceUI(key,tx,ty);
 c.fillStyle=ok?'rgba(110,255,110,.3)':'rgba(255,80,80,.35)';
 c.beginPath();c.moveTo(isoX(tx,ty),isoY(tx,ty));c.lineTo(isoX(tx+sz,ty),isoY(tx+sz,ty));c.lineTo(isoX(tx+sz,ty+sz),isoY(tx+sz,ty+sz));c.lineTo(isoX(tx,ty+sz),isoY(tx,ty+sz));c.closePath();c.fill();
 c.strokeStyle=ok?'#8f8':'#f88';c.lineWidth=2;c.stroke();
 const sx2=isoX(tx+sz/2,ty+sz/2),sy2=isoY(tx+sz/2,ty+sz/2);
 c.fillStyle='#fff';c.font='bold 12px sans-serif';c.textAlign='center';c.fillText(B[key].n,sx2,sy2-30);c.textAlign='left';
 c.restore();
}
/* render in-flight radio call-down strikes (world space, inside the scaled transform) */
function drawStrikes(c){
 if(!G.strikes)return;
 for(const s of G.strikes){
  // v26: enemy strike FX only render where the player has live vision (own strikes exempt)
  if(s.owner&&s.owner.p&&s.owner.p!==G.human){
   let rx=s.x||0,ry=s.y||0;
   if(s.kind==='napalm'&&s.cells.length){const cme=s.cells[Math.max(0,Math.min(s.i,s.cells.length-1))];rx=cme.x;ry=cme.y}
   else if(s.kind==='barrage'){rx=s.cx;ry=s.cy}
   else if((s.kind==='paradrop'||s.kind==='lift')&&s.drops.length){rx=s.drops[0].x;ry=s.drops[0].y} // v85: a hostile redeploy is hidden by fog on the same rule as a hostile paradrop
   if(fogAt(rx,ry)!==2)continue;
  }
  if(s.kind==='smokescr'){
   /* v88: the square the cloud actually covers, drawn faintly under the drifting
      particles so the player can read its EDGE. The particles alone would leave
      the boundary guesswork, and the boundary is the whole tactical content of a
      screen you have to stand your army inside. */
   const f=clamp(1-s.t/SMOKESCR_T,0,1),hh=s.n/2;
   c.save();c.globalAlpha=.16+f*.20;
   c.fillStyle='#e2e2de';
   c.beginPath();
   c.moveTo(isoX(s.x-hh,s.y-hh),isoY(s.x-hh,s.y-hh));c.lineTo(isoX(s.x+hh,s.y-hh),isoY(s.x+hh,s.y-hh));
   c.lineTo(isoX(s.x+hh,s.y+hh),isoY(s.x+hh,s.y+hh));c.lineTo(isoX(s.x-hh,s.y+hh),isoY(s.x-hh,s.y+hh));
   c.closePath();c.fill();
   c.strokeStyle='rgba(230,230,226,.75)';c.lineWidth=1.6;c.setLineDash([7,5]);c.lineDashOffset=-G.tick*.8;c.stroke();
   c.restore();c.globalAlpha=1;
   continue;
  }
  if(s.kind==='paint'){
   /* v88: a marker, and nothing but a marker - the RULE is each victim's own
      paintT and this box carries none of it. Drawn in the painting army's colour
      so a Gray player reads his own mark and an enemy reads whose it is. */
   const col=FAC[(G.players[s.pi]||G.human||{fac:'gray'}).fac].color,rb=hx2rgb(col);
   const f=clamp(1-s.t/PAINT_T,0,1);
   c.save();c.globalAlpha=.35+f*.45;
   c.strokeStyle=col;c.lineWidth=2;c.setLineDash([6,4]);c.lineDashOffset=-G.tick*1.6;
   c.beginPath();
   c.moveTo(isoX(s.x,s.y),isoY(s.x,s.y));c.lineTo(isoX(s.x+s.n,s.y),isoY(s.x+s.n,s.y));
   c.lineTo(isoX(s.x+s.n,s.y+s.n),isoY(s.x+s.n,s.y+s.n));c.lineTo(isoX(s.x,s.y+s.n),isoY(s.x,s.y+s.n));
   c.closePath();c.stroke();
   c.setLineDash([]);c.fillStyle=rgba(rb.r,rb.g,rb.b,.10*f);c.fill();
   c.restore();c.globalAlpha=1;
   continue;
  }
  if(s.kind==='barrage'){
   /* each shell arcs in from off-map over BARRAGE_FLY seconds. Pure render: the
      impact point and bearing were fixed by srand() when the strike was created. */
   for(const q of s.sh){
    if(q.done)continue;
    const pr=(s.t-(q.at-BARRAGE_FLY))/BARRAGE_FLY;
    if(pr<0||pr>1)continue;
    const ox=q.x+Math.cos(q.ang)*30, oy=q.y+Math.sin(q.ang)*30;
    const px=ox+(q.x-ox)*pr, py=oy+(q.y-oy)*pr;
    const z=Math.sin(pr*Math.PI)*190;
    const sxp=isoX(px,py), syp=isoY(px,py)-z;
    c.save();
    c.strokeStyle='rgba(200,200,190,.30)';c.lineWidth=2;c.lineCap='round';
    const tp=Math.max(0,pr-.09);
    const tx=ox+(q.x-ox)*tp, ty=oy+(q.y-oy)*tp, tz=Math.sin(tp*Math.PI)*190;
    c.beginPath();c.moveTo(isoX(tx,ty),isoY(tx,ty)-tz);c.lineTo(sxp,syp);c.stroke();
    c.fillStyle='#3b3b38';c.beginPath();c.ellipse(sxp,syp,4.5,3,0,0,7);c.fill();
    c.fillStyle='rgba(255,190,90,.85)';c.beginPath();c.ellipse(sxp,syp,2,1.4,0,0,7);c.fill();
    c.globalAlpha=.35;c.fillStyle='#000';
    c.beginPath();c.ellipse(isoX(px,py),isoY(px,py),5,2.5,0,0,7);c.fill();
    c.restore();
   }
  } else if(s.kind==='napalm'){
   // a fading targeting reticle over the strike box while bomblets are still landing
   if(s.i<s.cells.length){
    const cx=s.cells.length?s.cells.reduce((a,b)=>a+b.x,0)/s.cells.length:0;
    const cy=s.cells.length?s.cells.reduce((a,b)=>a+b.y,0)/s.cells.length:0;
    c.save();c.strokeStyle='rgba(255,140,40,.5)';c.lineWidth=1.4;c.setLineDash([5,4]);
    c.beginPath();c.moveTo(isoX(cx-5,cy-5),isoY(cx-5,cy-5));c.lineTo(isoX(cx+5,cy-5),isoY(cx+5,cy-5));c.lineTo(isoX(cx+5,cy+5),isoY(cx+5,cy+5));c.lineTo(isoX(cx-5,cy+5),isoY(cx-5,cy+5));c.closePath();c.stroke();c.restore();
   }
   // v30: a pulsing firestorm glow over the whole strike zone while it burns
   if(s.cells.length){
    const gx2=s.cells.reduce((a2,b2)=>a2+b2.x,0)/s.cells.length,gy2=s.cells.reduce((a2,b2)=>a2+b2.y,0)/s.cells.length;
    const px=isoX(gx2,gy2),py=isoY(gx2,gy2);
    const pul=.22+.1*Math.sin(G.tick*.5);
    c.save();c.globalCompositeOperation='lighter';
    const g2=c.createRadialGradient(px,py,4,px,py,7*TW);
    g2.addColorStop(0,`rgba(255,190,80,${pul})`);g2.addColorStop(.6,`rgba(255,110,30,${pul*.6})`);g2.addColorStop(1,'rgba(255,80,20,0)');
    c.fillStyle=g2;c.beginPath();c.ellipse(px,py,7*TW,3.5*TW,0,0,7);c.fill();
    c.restore();
   }
  } else if(s.kind==='paradrop'||s.kind==='lift'){
   /* v85: one canopy routine for both call-downs, which is the owner's brief -
      a redeployed squad is meant to READ as a paradrop. The only difference is
      whose men they are, and that is already in s.owner. */
   for(const d of s.drops){if(d.done)continue;const fall=clamp((d.delay-s.t)/0.8,0,1);const z=60*fall;
    const px=isoX(d.x,d.y),py=isoY(d.x,d.y)-z;
    c.save();
    // canopy
    c.fillStyle='rgba(225,225,210,.95)';c.beginPath();c.ellipse(px,py-14,9,6,0,Math.PI,0);c.fill();
    c.strokeStyle='rgba(120,120,110,.8)';c.lineWidth=1;c.beginPath();c.moveTo(px-8,py-13);c.lineTo(px,py-2);c.moveTo(px+8,py-13);c.lineTo(px,py-2);c.stroke();
    // a little crate/figure
    c.fillStyle=FAC[s.owner.p.fac].color;c.fillRect(px-2,py-3,4,4);
    c.restore();
   }
  }
 }
}
/* render the current targeting reticle/preview while a radio or entrench is being aimed */
function drawTargeting(c){
 const rt=G.radioTargeting;if(!rt||(!rt.unit&&!rt.bld))return;
 const o=rt.unit||rt.bld;const w=screenToWorld(MOUSE.x,MOUSE.y);
 const col=FAC[o.p.fac].color;
 if(rt.mode==='entrench'){
  const u=rt.unit;
  const dir=Math.atan2(w.y-u.y,w.x-u.x);
  drawGroundCone(c,u.x,u.y,dir,u.t.rg,CONE_HALF,col,.18);
 } else if(rt.mode==='paint'){
  /* v88: the box the click will actually mark, snapped to the tile grid exactly
     as paintArea snaps it - so what is under the reticle is what gets painted. */
  const x0=Math.floor(w.x),y0=Math.floor(w.y),n=PAINT_BOX;
  c.save();c.strokeStyle=col;c.lineWidth=2;c.setLineDash([5,4]);c.lineDashOffset=-G.tick*1.2;
  c.beginPath();
  c.moveTo(isoX(x0,y0),isoY(x0,y0));c.lineTo(isoX(x0+n,y0),isoY(x0+n,y0));
  c.lineTo(isoX(x0+n,y0+n),isoY(x0+n,y0+n));c.lineTo(isoX(x0,y0+n),isoY(x0,y0+n));
  c.closePath();c.stroke();
  c.setLineDash([]);c.fillStyle=rgba(hx2rgb(col).r,hx2rgb(col).g,hx2rgb(col).b,.14);c.fill();
  c.restore();
 } else {
  // v30: no reach ring - the targeted call-downs land anywhere the player has vision
  const inR=rt.mode==='paradrop'||fogAt(w.x,w.y)===2;const mark=inR?'rgba(120,255,120,.85)':'rgba(255,90,70,.85)';
  if(rt.mode==='smokescr'){
   /* v88: the actual square, anchored the way radioSmokescreen anchors it, so
      what the player sees under the reticle is what the cloud will cover. Drawn
      in the army's own colour rather than the red/green vision mark, because
      this call-down needs no vision and the mark would always read green. */
   const hh=SMOKESCR_BOX/2,cx2=Math.floor(w.x)+.5,cy2=Math.floor(w.y)+.5,rb2=hx2rgb(col);
   c.save();c.strokeStyle=col;c.lineWidth=2;c.setLineDash([6,4]);c.lineDashOffset=-G.tick*1.2;
   c.beginPath();
   c.moveTo(isoX(cx2-hh,cy2-hh),isoY(cx2-hh,cy2-hh));c.lineTo(isoX(cx2+hh,cy2-hh),isoY(cx2+hh,cy2-hh));
   c.lineTo(isoX(cx2+hh,cy2+hh),isoY(cx2+hh,cy2+hh));c.lineTo(isoX(cx2-hh,cy2+hh),isoY(cx2-hh,cy2+hh));
   c.closePath();c.stroke();
   c.setLineDash([]);c.fillStyle=rgba(rb2.r,rb2.g,rb2.b,.12);c.fill();
   c.restore();
  } else if(rt.mode==='napalm'){
   c.save();c.strokeStyle=mark;c.lineWidth=1.6;c.setLineDash([5,4]);
   c.beginPath();c.moveTo(isoX(w.x-5,w.y-5),isoY(w.x-5,w.y-5));c.lineTo(isoX(w.x+5,w.y-5),isoY(w.x+5,w.y-5));c.lineTo(isoX(w.x+5,w.y+5),isoY(w.x+5,w.y+5));c.lineTo(isoX(w.x-5,w.y+5),isoY(w.x-5,w.y+5));c.closePath();c.stroke();c.restore();
  } else if(rt.mode==='barrage'){
   /* red crosshair ring at the aim point plus the 10x10 footprint it walks */
   c.save();c.strokeStyle=mark;c.lineWidth=1.6;c.setLineDash([5,4]);
   c.beginPath();c.moveTo(isoX(w.x-5,w.y-5),isoY(w.x-5,w.y-5));c.lineTo(isoX(w.x+5,w.y-5),isoY(w.x+5,w.y-5));c.lineTo(isoX(w.x+5,w.y+5),isoY(w.x+5,w.y+5));c.lineTo(isoX(w.x-5,w.y+5),isoY(w.x-5,w.y+5));c.closePath();c.stroke();
   c.setLineDash([]);c.strokeStyle='rgba(255,70,55,.95)';c.lineWidth=2;
   const bx=isoX(w.x,w.y),by=isoY(w.x,w.y);
   c.beginPath();c.ellipse(bx,by,26,13,0,0,7);c.stroke();
   c.beginPath();c.ellipse(bx,by,11,5.5,0,0,7);c.stroke();
   c.beginPath();c.moveTo(bx-34,by);c.lineTo(bx-14,by);c.moveTo(bx+14,by);c.lineTo(bx+34,by);
   c.moveTo(bx,by-19);c.lineTo(bx,by-7);c.moveTo(bx,by+7);c.lineTo(bx,by+19);c.stroke();
   c.restore();
  } else if(rt.mode==='paradrop'){
   c.save();c.strokeStyle='rgba(120,255,120,.85)';c.lineWidth=1.6;
   c.beginPath();c.ellipse(isoX(w.x,w.y),isoY(w.x,w.y),16,8,0,0,7);c.stroke();
   c.fillStyle='rgba(120,255,120,.9)';c.font='10px sans-serif';c.textAlign='center';c.fillText('🪂 DROP',isoX(w.x,w.y),isoY(w.x,w.y)-12);c.textAlign='left';c.restore();
  }
 }
}
