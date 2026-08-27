/* ===================== POST-PROCESSING =====================
   The world renders into an offscreen canvas, then composites to screen with
   a moderate tilt-shift (blurred top/bottom bands; the miniature-photo look),
   bloom, a warm-key / cool-shadow grade, and a vignette. If ctx.filter is
   unsupported the blur-based passes degrade gracefully to grade + vignette. */
let worldCv=null,wctx=null,tsCv=null,tsctx=null,blCv=null,blctx=null,bandCv=null,bandctx=null,maskT=null,maskB=null,FILT=-1;
let sprCv=null,spctx=null; // v94: the depth-sorted sprite band's own transparent canvas (phase 3, second cut)
/* v96: the band's NORMAL companion, and the switch the blit sites read.
   NCTX is non-null only for the stretch of a frame where the band is being
   drawn AND the GL lighting stage is alive - so on every fallback path
   (headless, #nogl, no usable GL) not one extra canvas op happens and the
   band pass is byte-identical to v95. Client-local, never hashed. */
let nrmCv=null,nctx=null,NCTX=null;
/* v93: THE POST-PASS TUNING TABLE, extracted so the 2d compositor below and the
   WebGL shader stage (next file) read the SAME numbers. These are the v64-v90
   values verbatim, just named: change one here and both renderers move
   together, which is what keeps "the GL path looks like the 2d path" a
   structural property instead of a hope. T69.B asserts both consumers. */
const POSTV={
 sat:1.10,con:1.04,                                    // base grade (FILT=1 path)
 bloomBr:.58,bloomCon:2.3,bloomSat:1.3,bloomBlur:2.2,bloomAdd:.30, // bright-pass + add
 tsBlur:2,tsTopH:.24,tsTopA:.9,tsBotH:.30,tsBotA:.95,  // tilt-shift bands
 g1c:'#ffb45e',g1a:.10,g2c:'#2f4d80',g2a:.15,          // warm overlay / cool soft-light
 vinCX:.5,vinCY0:.46,vinR0:.44,vinCY1:.55,vinR1:.60,vinC:'8,12,6',vinA:.28 // vignette
};
function mkMask(w,h,top){
 const m=document.createElement('canvas');m.width=w;m.height=h;const mc=m.getContext('2d');
 const g=mc.createLinearGradient(0,0,0,h);
 if(top){g.addColorStop(0,'rgba(255,255,255,'+POSTV.tsTopA+')');g.addColorStop(1,'rgba(255,255,255,0)');}
 else{g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(255,255,255,'+POSTV.tsBotA+')');}
 mc.fillStyle=g;mc.fillRect(0,0,w,h);return m;
}
function ensurePost(){
 const W=view.width,H=view.height;
 if(!W||!H)return;
 if(worldCv&&worldCv.width===W&&worldCv.height===H)return;
 try{
  worldCv=document.createElement('canvas');worldCv.width=W;worldCv.height=H;wctx=worldCv.getContext('2d');
  /* v94: the sprite band renders here, alone, and is merged onto the scene in
     one blit - straight, or through the GL band stage. That seam is what
     phase 5's per-pixel lighting slots into. */
  sprCv=document.createElement('canvas');sprCv.width=W;sprCv.height=H;spctx=sprCv.getContext('2d');
  nrmCv=document.createElement('canvas');nrmCv.width=W;nrmCv.height=H;nctx=nrmCv.getContext('2d'); // v96: the band's normal companion
  if(FILT<0){try{wctx.filter='blur(1px)';FILT=(wctx.filter&&wctx.filter!=='none')?1:0;wctx.filter='none';}catch(e){FILT=0;}}
  tsCv=document.createElement('canvas');tsCv.width=Math.max(2,Math.round(W/3));tsCv.height=Math.max(2,Math.round(H/3));tsctx=tsCv.getContext('2d');
  blCv=document.createElement('canvas');blCv.width=Math.max(2,Math.round(W/4));blCv.height=Math.max(2,Math.round(H/4));blctx=blCv.getContext('2d');
  const th=Math.max(2,Math.round(H*POSTV.tsTopH)),bh=Math.max(2,Math.round(H*POSTV.tsBotH));
  maskT=mkMask(W,th,true);maskB=mkMask(W,bh,false);
  bandCv=document.createElement('canvas');bandCv.width=W;bandCv.height=Math.max(th,bh);bandctx=bandCv.getContext('2d');
 }catch(e){worldCv=null;wctx=null;sprCv=null;spctx=null;nrmCv=null;nctx=null;NCTX=null;}
}
function tsBand(mask,y){
 const W=view.width,H=view.height;
 bandctx.setTransform(1,0,0,1,0,0);bandctx.globalCompositeOperation='source-over';
 bandctx.clearRect(0,0,bandCv.width,bandCv.height);
 bandctx.drawImage(tsCv,0,0,tsCv.width,tsCv.height,0,-y,W,H);
 bandctx.globalCompositeOperation='destination-in';
 bandctx.drawImage(mask,0,0);
 vc.drawImage(bandCv,0,0,W,mask.height,0,y,W,mask.height);
}
function compositePost(){
 const W=view.width,H=view.height;
 vc.setTransform(1,0,0,1,0,0);vc.imageSmoothingEnabled=true;
 if(FILT===1){vc.filter='saturate('+POSTV.sat+') contrast('+POSTV.con+')';vc.drawImage(worldCv,0,0);vc.filter='none';}
 else vc.drawImage(worldCv,0,0);
 if(FILT===1){
  // bloom: bright-pass approximation on a quarter-res copy, added back softly
  blctx.setTransform(1,0,0,1,0,0);blctx.clearRect(0,0,blCv.width,blCv.height);
  blctx.filter='brightness('+POSTV.bloomBr+') contrast('+POSTV.bloomCon+') saturate('+POSTV.bloomSat+') blur('+POSTV.bloomBlur*RDPR+'px)'; // v97: blur radii are pixel values, so they scale with the device backing
  blctx.drawImage(worldCv,0,0,blCv.width,blCv.height);blctx.filter='none';
  vc.save();vc.globalCompositeOperation='lighter';vc.globalAlpha=POSTV.bloomAdd;vc.drawImage(blCv,0,0,W,H);vc.restore();
  // tilt-shift: blurred third-res copy masked into the top & bottom bands
  tsctx.setTransform(1,0,0,1,0,0);tsctx.clearRect(0,0,tsCv.width,tsCv.height);
  tsctx.filter='blur('+POSTV.tsBlur*RDPR+'px)';tsctx.drawImage(worldCv,0,0,tsCv.width,tsCv.height);tsctx.filter='none';
  tsBand(maskT,0);tsBand(maskB,H-maskB.height);
 }
 // warm-key / cool-shadow grade
 vc.save();vc.globalCompositeOperation='overlay';vc.globalAlpha=POSTV.g1a;vc.fillStyle=POSTV.g1c;vc.fillRect(0,0,W,H);
 vc.globalCompositeOperation='soft-light';vc.globalAlpha=POSTV.g2a;vc.fillStyle=POSTV.g2c;vc.fillRect(0,0,W,H);vc.restore();
 // vignette
 const vg=vc.createRadialGradient(W*POSTV.vinCX,H*POSTV.vinCY0,Math.min(W,H)*POSTV.vinR0,W*POSTV.vinCX,H*POSTV.vinCY1,Math.hypot(W,H)*POSTV.vinR1);
 vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba('+POSTV.vinC+','+POSTV.vinA+')');
 vc.fillStyle=vg;vc.fillRect(0,0,W,H);
}
/* v27.1: a draw error must never kill the frame or blank the screen.
   render() delegates to renderCore inside a guard: each distinct error is
   logged once with its stack, a throttled HUD note appears, and the next
   frame simply retries. The sim is untouched either way. */
const REN_ERRS=new Set();
function renderGuard(e){
 const k2=String(e&&e.message||e);
 if(!REN_ERRS.has(k2)){
  REN_ERRS.add(k2);
  try{console.warn('[pw] render error (suppressed):',e);}catch(_){}
 }
 if(G&&(G.renWarnT==null||G.tick-G.renWarnT>900)){G.renWarnT=G.tick;msg('\u26a0 A drawing error was suppressed (details in the console).');}
}
function render(){try{renderCore();}catch(e){renderGuard(e);}}
/* v28: fog-gate position for a particle. Tracers (tr/tr2) carry only segment
   endpoints, so they gate by the midpoint; everything else gates by its own
   x/y (returned as-is, no allocation on the common path). */
function fxGatePos(p){return p.x!=null?p:{x:(p.x1+p.x2)*.5,y:(p.y1+p.y2)*.5}}
/* v29: dashed waypoint chains, patrol loops, and the patrol-aim preview for the
   player's selected units. Drawn inside the world-transformed space, so isoX/isoY
   apply directly. Client-side cosmetics: never hashed, never serialized. */
function drawOrderPlans(c){
 if((!G.sel.length)&&!G.patrolAim)return;
 c.save();c.setLineDash([5,4]);c.lineWidth=1.5;
 for(const u of G.sel){
  if(u.kind!=='unit'||!allied(u.p,G.human)||u.hp<=0||u.garrisoned)continue;
  let px=isoX(u.x,u.y),py=isoY(u.x,u.y);
  if(u.patrol){
   const pax=isoX(u.patrol.ax,u.patrol.ay),pay=isoY(u.patrol.ax,u.patrol.ay);
   const pbx=isoX(u.patrol.bx,u.patrol.by),pby=isoY(u.patrol.bx,u.patrol.by);
   c.strokeStyle='rgba(124,252,110,.7)';c.globalAlpha=.8;
   c.beginPath();c.moveTo(px,py);c.lineTo(pax,pay);c.lineTo(pbx,pby);c.stroke();
   c.fillStyle='rgba(124,252,110,.9)';
   c.beginPath();c.arc(pax,pay,3.5,0,7);c.fill();c.beginPath();c.arc(pbx,pby,3.5,0,7);c.fill();
   c.globalAlpha=1;continue;
  }
  const pts=[];
  if(u.dest&&(u.state==='move'||u.state==='amove'))pts.push({x:u.dest.x,y:u.dest.y,col:u.state==='amove'?'#ff6a5a':'#7CFC6E'});
  for(const o of (u.oq||[])){
   if(o.op==='move')pts.push({x:o.x,y:o.y,col:o.am?'#ff6a5a':'#7CFC6E'});
   else if(o.op==='attack'){const t2=entById(o.tid);if(t2&&t2.hp>0)pts.push({x:t2.x,y:t2.y,col:'#ff6a5a'});}
   else if(o.op==='harvest'){const n2=G.map.nodes[o.ni];if(n2)pts.push({x:n2.x,y:n2.y,col:'#ffb95e'});}
  }
  for(const q2 of pts){
   const qx=isoX(q2.x,q2.y),qy=isoY(q2.x,q2.y);
   c.strokeStyle=q2.col;c.globalAlpha=.6;c.beginPath();c.moveTo(px,py);c.lineTo(qx,qy);c.stroke();
   c.globalAlpha=.95;c.fillStyle=q2.col;c.beginPath();c.arc(qx,qy,3,0,7);c.fill();
   px=qx;py=qy;
  }
  c.globalAlpha=1;
 }
 // patrol aim: first point placed, second leg tracks the cursor
 if(G.patrolAim&&G.patrolAim.pts.length===1){
  const a=G.patrolAim.pts[0],w=screenToWorld(MOUSE.x,MOUSE.y);
  c.strokeStyle='rgba(124,252,110,.85)';
  c.beginPath();c.moveTo(isoX(a.x,a.y),isoY(a.x,a.y));c.lineTo(isoX(w.x,w.y),isoY(w.x,w.y));c.stroke();
  c.fillStyle='#7CFC6E';c.beginPath();c.arc(isoX(a.x,a.y),isoY(a.x,a.y),4,0,7);c.fill();
 }
 c.restore();
}
function renderCore(){
 ensurePost();
 const c=(worldCv?wctx:vc);
 c.setTransform(1,0,0,1,0,0);c.fillStyle='#141d0e';c.fillRect(0,0,view.width,view.height);
 /* v93: glComposite (next file) presents the world through the WebGL post
    pipeline and answers true; false means "no usable GL here" - headless, an
    old browser, a lost context, or #nogl - and the 2d compositor below is the
    unchanged fallback. The world CONTENT is drawn by the same 2d code either
    way; only the present+post stage differs. */
 if(!G){if(worldCv&&!glComposite())compositePost();return;}
 /* v97: the one place DPR enters the world pass. The canvases hold device
    pixels now, so the world transform is the CSS zoom times RDPR - G.zoom,
    G.cam, the mouse and every clamp stay in CSS pixels untouched. Everything
    downstream that divides by z (vw/vh, the light collector's bounds) lands
    back in the same units it always used. */
 const z=G.zoom*RDPR;
 const shx=(Math.random()-.5)*G.shake,shy=(Math.random()-.5)*G.shake,cx=G.cam.x+shx,cy=G.cam.y+shy;
 // everything in the world is drawn in a single scaled+translated space
 c.setTransform(z,0,0,z,-cx*z,-cy*z);c.imageSmoothingEnabled=true;
 c.drawImage(G.terr,0,0);c.save();
 // ---- ground-plane FX (drawn on the deck, beneath all sprites) ----
 for(const p of G.parts){
  const gp=fxGatePos(p); // v27.1: tracers gate by segment midpoint
  if(fogAt(gp.x,gp.y)!==2)continue; // v26: no live FX visible through fog
  if(p.t==='du'){
   // expanding flattened dust ring kicked up by a blast
   const sx=isoX(p.x,p.y),sy=isoY(p.x,p.y);const f=clamp(p.life/(.5+p.sc*.12),0,1);
   c.save();c.globalAlpha=f*.5;
   const g=c.createRadialGradient(sx,sy,p.r*.4,sx,sy,p.r);
   g.addColorStop(0,'rgba(120,108,86,0)');g.addColorStop(.7,'rgba(150,136,108,'+(f*.5)+')');g.addColorStop(1,'rgba(120,108,86,0)');
   c.fillStyle=g;c.beginPath();c.ellipse(sx,sy,p.r,p.r*.5,0,0,7);c.fill();
   c.restore();c.globalAlpha=1;
  } else if(p.t==='sw'){
   // bright thin shockwave ring racing outward on the ground
   const sx=isoX(p.x,p.y),sy=isoY(p.x,p.y);const f=clamp(p.life/.32,0,1),rr2=(1-f)*38*p.sc+4;
   c.save();c.globalCompositeOperation='lighter';c.globalAlpha=f*.6;
   c.strokeStyle='rgba(255,236,180,'+(f*.7)+')';c.lineWidth=2.4*p.sc;
   c.beginPath();c.ellipse(sx,sy,rr2,rr2*.5,0,0,7);c.stroke();
   c.restore();c.globalAlpha=1;
  }
 }
 /* ---- v88: THE BURIED MINES ONLY THEIR OWNER CAN SEE ----
    The map's own scattered mines are drawn by nobody and stay that way. A wall's
    mine is drawn for the army that buried it and for NOBODY else - a
    client-local read of G.human, exactly like the fog it sits under, so the sim
    never learns who is looking. A spectator sees none of them, on the same rule
    that gives a spectator no army. Deliberately small and dull: it is a reminder
    of where your own field is, not a beacon.
    v98: an ALLY no longer sees it either, by the owner's decision - "visible to
    the owner only" is now the identity `ow===G.human` rather than allied(). The
    ARMING rule is untouched and deliberately still allied(): mineArms keeps the
    mine asleep under an ally's men, so a teammate walking the line is safe
    without being shown where the line is. Sight and safety are two claims here,
    and only the first one moved. */
 if(G.human&&G.map.mines)for(const mn of G.map.mines){
  if(!mn.live||!mn.gray)continue;
  const ow=G.players[mn.pi];
  if(ow!==G.human)continue;
  if(fogAt(mn.x,mn.y)===0)continue;
  const mx2=isoX(mn.x,mn.y),my2=isoY(mn.x,mn.y),pf=.45+.25*Math.sin(G.tick*.05+mn.x);
  c.save();c.globalAlpha=pf;
  c.strokeStyle=FAC[ow.fac].color;c.lineWidth=1.4;c.setLineDash([3,3]);
  c.beginPath();c.ellipse(mx2,my2,9,4.5,0,0,7);c.stroke();
  c.setLineDash([]);c.fillStyle='rgba(255,120,90,.75)';
  c.beginPath();c.ellipse(mx2,my2,2.4,1.2,0,0,7);c.fill();
  c.restore();c.globalAlpha=1;
 }
 // ---- MEDIC HEALING RADIUS rings (team-coloured, on the ground under sprites) ----
 for(const u of G.units){
  if(!u.t.heal||u.garrisoned||!visibleToHuman(u))continue;
  drawHealRadius(c,u);
 }
 if(G.mode==='ctf')for(const f of G.flags)drawStand(c,f);
 if(G.mode==='surv'&&G.surv)drawDefendFlag(c); // v33
 if(G.mode==='koth')drawHill(c);
 // event ping rings (expanding, fading) on the field
 drawOrderPlans(c); // v29: waypoint / patrol overlay for the selected units
 for(const pg of G.pings){const f=clamp(pg.t/4,0,1),r=8+f*46;c.save();c.globalAlpha=(1-f)*0.8;c.strokeStyle=pg.col;c.lineWidth=2.6;c.beginPath();c.ellipse(isoX(pg.x,pg.y),isoY(pg.x,pg.y),r,r*.5,0,0,7);c.stroke();c.restore();}
 const vw=view.width/z,vh=view.height/z;
 const inView=(x,y)=>{const sx=isoX(x,y)-cx,sy=isoY(x,y)-cy;return sx>-150&&sx<vw+150&&sy>-170&&sy<vh+130};
 const items=[];
 for(const p of G.map.props)if(inView(p.x,p.y))items.push([p.x+p.y,0,p,'prop']);
 (G.map.nests||[]).forEach((ns,i)=>{if(!inView(ns.x,ns.y))return;const f=fogAt(ns.x,ns.y);if(f===2)items.push([ns.x+ns.y,0,ns,'nest']);else if(f===1&&G.ghost&&G.ghost.nests[i])items.push([ns.x+ns.y,0,G.ghost.nests[i],'nest'])}); // v26: last-seen ghosts
 G.map.nodes.forEach((n,i)=>{if(!inView(n.x,n.y))return;const f=fogAt(n.x,n.y);if(f===2)items.push([n.x+n.y,0,n,'node']);else if(f===1&&G.ghost&&G.ghost.nodes[i])items.push([n.x+n.y,0,G.ghost.nodes[i],'node'])});
 if(G.ghost)for(const g of (G.ghost.goneNodes||[]))if(fogAt(g.x,g.y)===1&&inView(g.x,g.y))items.push([g.x+g.y,0,g,'node']); // v30.1: piles mined out under fog linger until re-scouted
 for(const b of G.blds)if(visibleToHuman(b)&&inView(b.x,b.y))items.push([b.x+b.y,1,b,'bld']);
 if(G.ghost)for(const g of G.ghost.blds.values())if(fogAt(g.x,g.y)===1&&inView(g.x,g.y))items.push([g.x+g.y,1,g,'bld']); // v26: last-seen building ghosts
 for(const u of G.units)if(!u.garrisoned&&visibleToHuman(u)&&inView(u.x,u.y))items.push([u.x+u.y+(u.t.fly?500:0),2,u,'unit']);
 for(const cr of (G.neutrals||[]))if(inView(cr.x,cr.y)&&G.fog[Math.floor(cr.y)*G.map.N+Math.floor(cr.x)]===2)items.push([cr.x+cr.y+(cr.t.fly?500:0),2,cr,'bug']);
 /* v86: the supply crates, on the ground layer with the nodes and only where the
    player currently SEES them - a crate under fog is not drawn, and unlike a
    resource pile it leaves no last-seen ghost, because it is a thing that can be
    taken rather than a feature of the map. */
 /* v100: the supply crates' halos. Drawn HERE - on the ground layer, straight
    onto `c` - and not inside drawCrate, because an additive glow inside the
    depth-sorted sprite band adds against band content rather than against the
    terrain (the cost the v94 record names for the heal glow and the rally
    pulse). It sits below `inView`'s declaration on purpose: the first cut put
    it up with the heal rings and threw a temporal-dead-zone error on every
    frame, which renderGuard swallowed into a black board and one toast.
    Gated on live vision exactly as the crate sprite below is - a crate under
    fog glows no more than it draws - and on ownership, because a supply drop is
    "yours alone" by the ability's own rule and lighting an enemy's crate would
    hand away the one thing the drop exists to tell its owner. */
 if(G.human&&G.crates)for(const cr of G.crates){
  if(cr.pi===G.human.i&&inView(cr.x,cr.y)&&fogAt(cr.x,cr.y)===2)drawCrateGlow(c,cr);
 }
 for(const cr of (G.crates||[]))if(inView(cr.x,cr.y)&&fogAt(cr.x,cr.y)===2)items.push([cr.x+cr.y,0,cr,'crate']);
 if(G.mode==='ctf')for(const f of G.flags)if(!f.carrier&&!f.home)items.push([f.x+f.y,3,f,'flag']);
 items.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 /* v94, roadmap 3 phase 3 second cut: THE SPRITE BAND - every depth-sorted
    shadow and entity - draws on its OWN transparent canvas, under the same
    camera transform (shake included: cx/cy are the frame's, not G.cam's).
    One code path in both renderers: the band is always isolated, and
    bandPresent() below answers either the canvas itself or its GL-processed
    copy. What phase 5 changes is only what that GL pass DOES (per-pixel
    lighting against a normal band); the seam is this merge. The known,
    measured cost: the few additive ground auras inside the band (heal glow,
    rally pulse) now add against band content rather than the terrain - see
    the v94 record. Everything drawn AFTER the merge (projectiles, particles,
    strikes, fog) keeps exact additive semantics against the whole scene. */
 const bc=spctx||c;
 if(spctx){
  spctx.setTransform(1,0,0,1,0,0);spctx.clearRect(0,0,view.width,view.height);
  spctx.setTransform(z,0,0,z,-cx*z,-cy*z);spctx.imageSmoothingEnabled=true;
  /* v96: with a live GL lighting stage, the blit sites also write each
     sprite's normal map onto nrmCv (via NCTX; they read the exact transform
     off the color context, so the two canvases stay in register), and the
     frame's light sources are collected for the shader. On every fallback
     path NCTX stays null and the band pass is exactly v95's. */
  NCTX=null;
  if(nctx&&bandLit()){
   nctx.setTransform(1,0,0,1,0,0);nctx.clearRect(0,0,view.width,view.height);
   nctx.imageSmoothingEnabled=true;
   NCTX=nctx;nrmCv._dirty=true;
   bandLightsCollect(cx,cy,z);
  }else if(GLB&&GLB.gl&&!GLB.dead){
   /* lighting is off this frame but the GL hop still runs: last frame's
      normals and lights must not haunt it - flat band, no point lights */
   GLB.lights=[];
   if(nctx&&nrmCv._dirty){nctx.setTransform(1,0,0,1,0,0);nctx.clearRect(0,0,view.width,view.height);nrmCv._dirty=false;}
  }
 }
 for(const it of items)drawItemShadow(bc,it);
 for(const it of items){if(it[3]==='prop')drawProp(bc,it[2]);else if(it[3]==='nest')drawNest(bc,it[2]);else if(it[3]==='node')drawNode(bc,it[2]);else if(it[3]==='crate')drawCrate(bc,it[2]);else if(it[3]==='bld')drawBld(bc,it[2]);else if(it[3]==='unit')drawUnit(bc,it[2]);else if(it[3]==='bug')drawBug(bc,it[2]);else drawLooseFlag(bc,it[2]);}
 if(spctx){NCTX=null;c.save();c.setTransform(1,0,0,1,0,0);c.drawImage(bandPresent(),0,0);c.restore();}
 for(const p of G.projs){
  if(fogAt(p.x,p.y)!==2)continue; // v26: no live munitions visible through fog
  const sx=isoX(p.x,p.y),sy=isoY(p.x,p.y),hy=sy-p.z;
  // ground shadow shrinks with altitude
  const sh=clamp(1-p.z/90,.25,1);
  c.fillStyle='rgba(0,0,0,'+(.28*sh)+')';c.beginPath();c.ellipse(sx,sy,3.4*sh,1.7*sh,0,0,7);c.fill();
  // v26: munitions are oriented along their true flight direction in screen space,
  // including the vertical slope of an arcing shot (dz per world unit travelled)
  const cls=p.cls||(p.grenade?'gren':p.arc?'mortar':(p.tgt?'rocket':'shell')),cal=p.cal||1;
  const dw=dhyp(p.tx-p.x,p.ty-p.y)||1,ux=(p.tx-p.x)/dw,uy=(p.ty-p.y)/dw;
  let dz=0;if(p.arc&&p.total>0){const t=clamp(p.travel/p.total,0,1);dz=240*(1-2*t)/p.total}
  const fe=.6,fang=Math.atan2(isoY(p.x+ux*fe,p.y+uy*fe)-(p.z+dz*fe)-hy,isoX(p.x+ux*fe,p.y+uy*fe)-sx);
  if(cls==='gren'){
   // thrown frag: tumbling segmented pineapple body with a glinting spoon lever
   const spin=p.travel*4;
   c.save();c.translate(sx,hy);c.rotate(spin);
   const gg2=c.createRadialGradient(-.8,-1,0,.6,.4,3.4);gg2.addColorStop(0,'#66754c');gg2.addColorStop(.6,'#42502f');gg2.addColorStop(1,'#232c17');
   c.fillStyle=gg2;c.beginPath();c.arc(0,0,2.8,0,7);c.fill();
   c.strokeStyle='rgba(18,26,12,.75)';c.lineWidth=.7;
   c.beginPath();c.moveTo(-2.6,0);c.lineTo(2.6,0);c.stroke();
   c.beginPath();c.moveTo(0,-2.6);c.lineTo(0,2.6);c.stroke();
   c.beginPath();c.ellipse(0,0,2.6,1.1,0,0,7);c.stroke();
   c.fillStyle='#31363c';c.fillRect(1.8,-1.9,1.7,.9);
   c.fillStyle='#8f979f';c.fillRect(1.8,-1.9,.6,.9);
   c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.45)';c.beginPath();c.arc(-1,-1,.8,0,7);c.fill();c.restore();
   c.restore();
   continue;
  }
  c.save();c.translate(sx,hy);c.rotate(fang);c.scale(cal,cal);
  if(cls==='mortar'){
   // fin-stabilised bomb: dark olive teardrop, nose follows the arc (tips down on descent)
   c.strokeStyle='rgba(200,205,190,.18)';c.lineWidth=1.2;c.beginPath();c.moveTo(-6,0);c.lineTo(-13,0);c.stroke();
   c.fillStyle='#2e3428';
   c.beginPath();c.moveTo(-4.6,0);c.lineTo(-7.6,-2.6);c.lineTo(-6,0);c.lineTo(-7.6,2.6);c.closePath();c.fill();
   const bg=c.createLinearGradient(0,-2.4,0,2.4);bg.addColorStop(0,'#5a6647');bg.addColorStop(.5,'#454f35');bg.addColorStop(1,'#262c1c');
   c.fillStyle=bg;c.beginPath();c.moveTo(4.6,0);c.quadraticCurveTo(3.4,-2.4,-1.6,-2);c.lineTo(-4.8,-.9);c.lineTo(-4.8,.9);c.lineTo(-1.6,2);c.quadraticCurveTo(3.4,2.4,4.6,0);c.closePath();c.fill();
   c.fillStyle='#8a8f7a';c.fillRect(-2.2,-1.9,1.1,3.8);
   c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.3)';c.beginPath();c.ellipse(1,-1,1.8,.6,-.3,0,7);c.fill();c.restore();
  } else if(cls==='rocket'){
   // finned rocket with a red toy nose cone and a flickering exhaust flame
   c.save();c.globalCompositeOperation='lighter';
   const fl=6+Math.sin(G.tick*1.7+p.travel*9)*1.6;
   const eg=c.createRadialGradient(-4.5,0,0,-4.5,0,fl+4);eg.addColorStop(0,'rgba(255,225,140,.85)');eg.addColorStop(.5,'rgba(255,140,50,.35)');eg.addColorStop(1,'rgba(255,90,30,0)');
   c.fillStyle=eg;c.beginPath();c.arc(-4.5,0,fl+4,0,7);c.fill();
   c.fillStyle='rgba(255,240,190,.9)';c.beginPath();c.moveTo(-4.2,-1.1);c.lineTo(-4.2-fl,0);c.lineTo(-4.2,1.1);c.closePath();c.fill();
   c.restore();
   c.fillStyle='#31363c';c.beginPath();c.moveTo(-4.6,-2.4);c.lineTo(-6.6,-3.2);c.lineTo(-5,0);c.lineTo(-6.6,3.2);c.lineTo(-4.6,2.4);c.closePath();c.fill();
   const rg2=c.createLinearGradient(0,-1.6,0,1.6);rg2.addColorStop(0,'#5a6068');rg2.addColorStop(.5,'#43484f');rg2.addColorStop(1,'#24272c');
   c.fillStyle=rg2;rr(c,-4.8,-1.6,8.4,3.2,1.5);c.fill();
   c.fillStyle='#c9552e';c.beginPath();c.moveTo(3.4,-1.6);c.quadraticCurveTo(6.4,-.6,6.9,0);c.quadraticCurveTo(6.4,.6,3.4,1.6);c.closePath();c.fill();
   c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.4)';rr(c,-4,-1.5,6,1,.5);c.fill();c.restore();
  } else {
   // tank shell: metallic tracer slug with a burning base and a hot streak
   c.save();c.globalCompositeOperation='lighter';
   c.strokeStyle='rgba(255,190,90,.5)';c.lineWidth=2.2;c.beginPath();c.moveTo(-3.5,0);c.lineTo(-12.5,0);c.stroke();
   const bg2=c.createRadialGradient(-3.2,0,0,-3.2,0,4.2);bg2.addColorStop(0,'#fff3c8');bg2.addColorStop(.5,'#ff9b42');bg2.addColorStop(1,'rgba(255,120,40,0)');
   c.fillStyle=bg2;c.beginPath();c.arc(-3.2,0,4.2,0,7);c.fill();
   c.restore();
   const sg=c.createLinearGradient(0,-1.3,0,1.3);sg.addColorStop(0,'#b8b09c');sg.addColorStop(.5,'#8a8378');sg.addColorStop(1,'#4c473d');
   c.fillStyle=sg;rr(c,-3.6,-1.3,6.4,2.6,1.3);c.fill();
   c.fillStyle='#3a352c';c.beginPath();c.moveTo(2.6,-1.3);c.quadraticCurveTo(4.6,-.4,5,0);c.quadraticCurveTo(4.6,.4,2.6,1.3);c.closePath();c.fill();
  }
  c.restore();
 }
 // ---- airborne particles (smoke, fire, embers, debris, flashes, tracers) ----
 for(const p of G.parts){
  const gp=fxGatePos(p); // v27.1: tracers gate by segment midpoint
  if(p.t!=='mk'&&fogAt(gp.x,gp.y)!==2)continue; // v26: fog-gated (the player's own click markers stay visible)
  if(p.t==='sh'){const sx=isoX(p.x,p.y),sy=isoY(p.x,p.y);c.save();c.translate(sx,sy-p.z);c.rotate(p.ang);c.globalAlpha=clamp(p.life*1.6,0,1);c.fillStyle=p.col;c.fillRect(-p.w/2,-p.w/3,p.w,p.w*.66);c.restore();c.globalAlpha=1;}
  else if(p.t==='db'){
   // chunky tumbling plastic shard with a lit face and a shaded face — reads 3D
   const sx=isoX(p.x,p.y),sy=isoY(p.x,p.y)-p.z;const al=clamp(p.life*1.8,0,1);
   const b=hx2rgb(p.col),lt=mixc(b,WHITE,.4),dk=mixc(b,AMB,.55);
   // tiny ground shadow under it
   const gsy=isoY(p.x,p.y),gsh=clamp(1-p.z/60,.15,.7);
   c.globalAlpha=al*.4*gsh;c.fillStyle='#0e160c';c.beginPath();c.ellipse(sx,gsy,p.w*.9,p.w*.45,0,0,7);c.fill();
   c.save();c.translate(sx,sy);c.rotate(p.ang);c.globalAlpha=al;
   const sq=.5+Math.abs(Math.cos(p.ang*1.3))*.6; // fake tumble by squashing
   c.fillStyle=rgb(dk.r,dk.g,dk.b);c.fillRect(-p.w/2,-p.w*sq/2,p.w,p.w*sq);
   c.fillStyle=rgb(lt.r,lt.g,lt.b);c.fillRect(-p.w/2,-p.w*sq/2,p.w*.5,p.w*sq);
   c.restore();c.globalAlpha=1;
  }
  else if(p.t==='em'){
   // glowing ember: additive hot dot that cools as it falls
   const sx=isoX(p.x,p.y),sy=isoY(p.x,p.y)-p.z;const f=clamp(p.life/.7,0,1);
   c.save();c.globalCompositeOperation='lighter';
   const col=f>.5?'rgba(255,236,150,':f>.25?'rgba(255,150,60,':'rgba(200,70,30,';
   const g=c.createRadialGradient(sx,sy,0,sx,sy,p.r*2.4);g.addColorStop(0,col+(f)+')');g.addColorStop(1,col+'0)');
   c.fillStyle=g;c.beginPath();c.arc(sx,sy,p.r*2.4,0,7);c.fill();
   c.restore();
  }
  else if(p.t==='sm'){
   // billowing smoke: layered turbulent puffs, lit from above, drifting & growing
   const sx=isoX(p.x,p.y),sy=isoY(p.x,p.y)-p.z;const lf=p.life/(p.life+ (1-p.life)); // not used
   const age=clamp(1-p.life/2.4,0,1);
   const base=p.col?hx2rgb(p.col):{r:96,g:96,b:96};
   // smoke lightens as it thins/ages
   const tint=mixc(base,{r:150,g:150,b:150},age*.5);
   const al=clamp(p.life*.34,0,.42)*(1-age*.3);
   const s=p.seed||0,r=p.r;
   c.save();c.globalAlpha=al;
   // three offset lobes give a cauliflower silhouette
   const lobes=[[0,0,1],[Math.cos(s)*r*.5,Math.sin(s)*r*.35-r*.2,.7],[Math.cos(s+2)*r*.4,Math.sin(s+2)*r*.3-r*.1,.6]];
   for(const lo of lobes){const lr=r*lo[2];const g=c.createRadialGradient(sx+lo[0]-lr*.3,sy+lo[1]-lr*.3,1,sx+lo[0],sy+lo[1],lr);
    g.addColorStop(0,rgb(Math.min(255,tint.r+30),Math.min(255,tint.g+30),Math.min(255,tint.b+30)));
    g.addColorStop(.6,rgb(tint.r,tint.g,tint.b));
    g.addColorStop(1,'rgba('+(tint.r|0)+','+(tint.g|0)+','+(tint.b|0)+',0)');
    c.fillStyle=g;c.beginPath();c.arc(sx+lo[0],sy+lo[1],lr,0,7);c.fill();}
   c.restore();c.globalAlpha=1;
  }
  else if(p.t==='fb'){
   // boiling fireball lobe — bright additive, turbulent edge, rises & cools
   const sx=isoX(p.x,p.y),sy=isoY(p.x,p.y)-p.z;const f=clamp(p.life/.5,0,1);
   c.save();c.globalCompositeOperation='lighter';c.globalAlpha=f*.9;
   const wob=1+Math.sin((p.seed||0)+G.tick*.4)*.12;const r=p.r*wob;
   const g=c.createRadialGradient(sx,sy-r*.2,1,sx,sy,r);
   g.addColorStop(0,'rgba(255,248,210,'+f+')');
   g.addColorStop(.35,'rgba(255,180,70,'+(f*.95)+')');
   g.addColorStop(.7,'rgba(240,90,30,'+(f*.7)+')');
   g.addColorStop(1,'rgba(140,30,10,0)');
   c.fillStyle=g;c.beginPath();c.arc(sx,sy,r,0,7);c.fill();
   c.restore();c.globalAlpha=1;
  }
  else if(p.t==='ex'){
   // brilliant initial detonation flash: white-hot core + corona, very short
   const sx=isoX(p.x,p.y),sy=isoY(p.x,p.y)-7,f=1-p.life/.36,r=(6+34*f)*p.sc;
   c.save();c.globalCompositeOperation='lighter';
   const g=c.createRadialGradient(sx,sy,1,sx,sy,Math.max(2,r));
   g.addColorStop(0,'rgba(255,255,245,'+(1-f)+')');
   g.addColorStop(.3,'rgba(255,230,160,'+(.9*(1-f))+')');
   g.addColorStop(.6,'rgba(255,140,50,'+(.6*(1-f))+')');
   g.addColorStop(1,'rgba(255,80,30,0)');
   c.fillStyle=g;c.beginPath();c.arc(sx,sy,Math.max(2,r),0,7);c.fill();
   // spiky light flare in the first instant
   if(f<.4){c.globalAlpha=(1-f/.4);c.strokeStyle='rgba(255,245,210,.8)';c.lineWidth=2*p.sc;
    for(let i=0;i<6;i++){const a=i*1.047+p.sc;const fr=r*(1.3+(i%2)*.5);c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+Math.cos(a)*fr,sy+Math.sin(a)*fr*.6);c.stroke();}}
   c.restore();c.globalAlpha=1;
  }
  else if(p.t==='fl'){
   // licking flame tongue: additive, flickering, hot core to smoky tip
   const sx=isoX(p.x,p.y),sy=isoY(p.x,p.y)-p.z;const f=clamp(p.life*2.6,0,1);
   const wob=1+Math.sin((p.seed||0)+G.tick*.6)*.18;const r=p.r*wob;
   c.save();c.globalCompositeOperation='lighter';c.globalAlpha=f*.9;
   const g=c.createRadialGradient(sx,sy,0,sx,sy,r);
   g.addColorStop(0,'rgba(255,250,210,'+f+')');
   g.addColorStop(.4,'rgba(255,170,50,'+(f*.85)+')');
   g.addColorStop(1,'rgba(220,60,20,0)');
   c.fillStyle=g;c.beginPath();c.ellipse(sx,sy,r*.8,r,0,0,7);c.fill();
   c.restore();c.globalAlpha=1;
  }
  else if(p.t==='tr2'){
   const ax=isoX(p.x1,p.y1),ay=isoY(p.x1,p.y1)-p.z1,bx=isoX(p.x2,p.y2),by=isoY(p.x2,p.y2)-p.z2;
   const al=clamp(p.life*11,0,1);
   c.save();c.lineCap='round';
   // soft outer glow
   c.globalAlpha=al*.35;c.strokeStyle=p.col;c.lineWidth=p.w*2.6;c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.stroke();
   // bright core
   c.globalAlpha=al;c.strokeStyle=p.col;c.lineWidth=p.w;c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.stroke();
   c.globalAlpha=al;c.strokeStyle='#ffffff';c.lineWidth=Math.max(.8,p.w*.4);c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.stroke();
   c.restore();c.globalAlpha=1;
  }
  else if(p.t==='mz'){
   const sx=isoX(p.x,p.y),sy=isoY(p.x,p.y)-p.z,f=clamp(p.life/.11,0,1),r=(5+4*p.sc)*(.6+f*.6);
   c.save();c.translate(sx,sy);c.rotate(p.ang);c.globalAlpha=f;
   // radial burst
   const g=c.createRadialGradient(0,0,0.5,0,0,r);g.addColorStop(0,'#ffffff');g.addColorStop(.4,p.col);g.addColorStop(1,'rgba(255,150,40,0)');
   c.fillStyle=g;c.beginPath();c.arc(0,0,r,0,7);c.fill();
   // star spikes pointing along the barrel
   c.fillStyle=p.col;c.beginPath();c.moveTo(0,0);c.lineTo(r*1.9,-r*.28);c.lineTo(r*2.4,0);c.lineTo(r*1.9,r*.28);c.closePath();c.fill();
   c.beginPath();c.moveTo(0,0);c.lineTo(r*.4,-r*1.0);c.lineTo(0,-r*1.3);c.lineTo(-r*.4,-r*1.0);c.closePath();c.fill();
   c.restore();c.globalAlpha=1;
  }
  else if(p.t==='sk'){const sx=isoX(p.x,p.y),sy=isoY(p.x,p.y)-p.z,al=clamp(p.life*5,0,1);c.globalAlpha=al;c.fillStyle=p.col;c.beginPath();c.arc(sx,sy,1.5,0,7);c.fill();c.globalAlpha=1;}
  else if(p.t==='mk'){const sx=isoX(p.x,p.y),sy=isoY(p.x,p.y),r=16*p.life/.5+3;c.strokeStyle=p.col;c.globalAlpha=clamp(p.life*2,0,1);c.lineWidth=2.2;c.beginPath();c.ellipse(sx,sy,r,r*.5,0,0,7);c.stroke();c.globalAlpha=1;}
 }
 drawStrikes(c);
 drawTargeting(c);
 c.restore();
 c.setTransform(HW*z,HH*z,-HW*z,HH*z,(G.orgX-cx)*z,-cy*z);c.imageSmoothingEnabled=true;c.drawImage(G.fogCv,0,0);
 c.setTransform(1,0,0,1,0,0);
 if(worldCv&&!glComposite())compositePost();
 v71Fills();
 if(G.placing)drawGhost(vc,G.cam.x,G.cam.y);
 /* v97: the drag box is drawn from MOUSE coords, which are CSS px - so the
    screen-space overlays ride an RDPR base transform on the device-px canvas */
 if(MOUSE.down&&MOUSE.drag){vc.setTransform(RDPR,0,0,RDPR,0,0);const dbc=dragBoxCol();vc.strokeStyle=rgba(dbc.r,dbc.g,dbc.b,.9);vc.lineWidth=1.5;vc.strokeRect(MOUSE.sx,MOUSE.sy,MOUSE.x-MOUSE.sx,MOUSE.y-MOUSE.sy);vc.fillStyle=rgba(dbc.r,dbc.g,dbc.b,.1);vc.fillRect(MOUSE.sx,MOUSE.sy,MOUSE.x-MOUSE.sx,MOUSE.y-MOUSE.sy);vc.setTransform(1,0,0,1,0,0);}
 view.style.cursor=(G.amove||G.radioTargeting)?'crosshair':(G.placing?'copy':'default');
 renderMinimap();
}
function renderMinimap(){
 /* v97: MM_S-space drawing over a device-px backing - one base transform */
 const N=G.map.N,s=MM_S/N;mm.setTransform(RDPR,0,0,RDPR,0,0);mm.clearRect(0,0,MM_S,MM_S);mm.imageSmoothingEnabled=false;
 mm.drawImage(G.mmTerr,0,0,MM_S,MM_S);mm.drawImage(G.fogCv,0,0,MM_S,MM_S);
 const radar=G.test||G.players.some(pl=>allied(pl,G.human)&&pl.blds.some(b=>b.key==='radar'&&b.prog>=1)); // v29: allied radar is shared. v50: testing mode blips everything
 G.map.nodes.forEach((n,i)=>{const f=G.fog[Math.floor(n.y)*N+Math.floor(n.x)];if(f===0)return;const src2=f===2?n:(G.ghost&&G.ghost.nodes[i]);if(!src2)return;if(src2.wreck){mm.fillStyle='#c98a5e';mm.fillRect(n.x*s-1,n.y*s-1,2,2)}else{mm.fillStyle=src2.t==='plastic'?'#ffb95e':'#7fe3ff';mm.fillRect(n.x*s-1.5,n.y*s-1.5,3,3)}}); // v26: fogged dots use last-seen state
 if(G.ghost)for(const g of (G.ghost.goneNodes||[])){const f=G.fog[Math.floor(g.y)*N+Math.floor(g.x)];if(f!==1)continue;if(g.wreck){mm.fillStyle='#c98a5e';mm.fillRect(g.x*s-1,g.y*s-1,2,2)}else{mm.fillStyle=g.t==='plastic'?'#ffb95e':'#7fe3ff';mm.fillRect(g.x*s-1.5,g.y*s-1.5,3,3)}} // v30.1: gone-under-fog piles
 for(const b of G.blds){if(!allied(b.p,G.human)&&!radar&&G.fog[Math.floor(b.y)*N+Math.floor(b.x)]!==2)continue;mm.fillStyle=FAC[b.p.fac].color;mm.fillRect(b.tx*s,b.ty*s,Math.max(3,b.sz*s),Math.max(3,b.sz*s));}
 if(!radar&&G.ghost)for(const g of G.ghost.blds.values()){if(G.fog[Math.floor(g.y)*N+Math.floor(g.x)]!==1)continue;mm.fillStyle=FAC[g.p.fac].color;mm.fillRect(g.tx*s,g.ty*s,Math.max(3,g.sz*s),Math.max(3,g.sz*s));} // v26: last-seen ghosts
 for(const u of G.units){if(u.garrisoned)continue;if(!allied(u.p,G.human)&&!radar&&!visibleToHuman(u))continue;mm.fillStyle=FAC[u.p.fac].color;mm.fillRect(u.x*s-1.2,u.y*s-1.2,2.4,2.4);}
 for(const cr of (G.neutrals||[])){if(G.fog[Math.floor(cr.y)*N+Math.floor(cr.x)]!==2)continue;mm.fillStyle=cr.t.col;mm.fillRect(cr.x*s-1,cr.y*s-1,2,2);}
 if(G.mode==='ctf')for(const f of G.flags){mm.fillStyle='#fff';mm.fillRect(f.x*s-2.4,f.y*s-2.4,4.8,4.8);mm.fillStyle=FAC[f.owner.fac].color;mm.fillRect(f.x*s-1.4,f.y*s-1.4,2.8,2.8);}
 if(G.mode==='koth'&&G.hill){const col=G.hill.holder?FAC[G.hill.holder.fac].color:'#c9cdd4';mm.strokeStyle=col;mm.lineWidth=1.5;mm.beginPath();mm.arc(G.hill.x*s,G.hill.y*s,G.hill.r*s,0,7);mm.stroke();}
 for(const pg of (G.pings||[])){const f=clamp(pg.t/4,0,1);mm.strokeStyle=pg.col;mm.globalAlpha=1-f;mm.lineWidth=1.6;mm.beginPath();mm.arc(pg.x*s,pg.y*s,2+f*11,0,7);mm.stroke();mm.globalAlpha=1;}
 for(const ap of (G.atkPings||[])){ // v27.1: bigger combat blips + spawn ring
  const mmScale=MM_S/MM_SIZES.medium, fade=clamp((2.5-ap.t)/.6,0,1), pu=.6+.4*Math.sin(ap.t*10);
  if(ap.t<.8){const rf=ap.t/.8;mm.globalAlpha=(1-rf)*.95;mm.strokeStyle='#ff5040';mm.lineWidth=2.4;mm.beginPath();mm.arc(ap.x*s,ap.y*s,(5+rf*13)*mmScale,0,7);mm.stroke();}
  mm.globalAlpha=fade*pu;mm.fillStyle='#ff3b30';mm.beginPath();mm.arc(ap.x*s,ap.y*s,5.5*mmScale,0,7);mm.fill();
  mm.strokeStyle='#ffd0c8';mm.lineWidth=1.4;mm.beginPath();mm.arc(ap.x*s,ap.y*s,5.5*mmScale,0,7);mm.stroke();
  mm.globalAlpha=1;
 }
 mm.strokeStyle='rgba(255,255,255,.9)';mm.lineWidth=1;
 const z=G.zoom;
 const cs=[[0,0],[vpW()/z,0],[vpW()/z,vpH()/z],[0,vpH()/z]].map(([x,y])=>unIso(x+G.cam.x,y+G.cam.y)); // v97: the viewport rect in CSS px, like the camera itself
 mm.beginPath();mm.moveTo(cs[0].x*s,cs[0].y*s);for(let i=1;i<4;i++)mm.lineTo(cs[i].x*s,cs[i].y*s);mm.closePath();mm.stroke();
}

