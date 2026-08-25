/* ---------------- PATHFINDING ---------------- */
let PF=null;
function initPF(N){PF={N,g:new Float64Array(N*N),vis:new Int32Array(N*N),came:new Int32Array(N*N),gen:0,
 clr:new Uint8Array(N*N),dirty:1,clrT:-1e9}}
/* v68 CLEARANCE GRID. clr[i] is the 8-connected distance from tile i to the nearest
   blocked tile: 0 blocked, 1 touching a blocked tile, saturating at CLR_CAP. Out of
   bounds counts as blocked, matching passableR's border rejection.
   It is DERIVED from G.map.pass and is therefore never hashed, never written into a
   snapshot and never read out of one; loadState rebuilds it through initPF exactly
   the way it already rebuilds PF's own scratch arrays. A* uses it only as a soft cost
   (CLR_PEN), so a one-tile corridor stays usable - it just stops being the cheapest
   way through when there is a wider one. Whole 64x64 board rebuilds in ~0.24ms. */
function pfDirty(){if(PF)PF.dirty=1}
function buildClr(){
 const N=PF.N,c=PF.clr,pass=G.map.pass;
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const i=y*N+x;
  if(pass[i]!==1){c[i]=0;continue}
  let m=(x===0||y===0)?0:CLR_CAP;
  if(y>0)m=Math.min(m,c[i-N]);
  if(x>0)m=Math.min(m,c[i-1]);
  if(y>0&&x>0)m=Math.min(m,c[i-N-1]);
  if(y>0&&x<N-1)m=Math.min(m,c[i-N+1]);
  c[i]=Math.min(CLR_CAP,m+1);
 }
 for(let y=N-1;y>=0;y--)for(let x=N-1;x>=0;x--){
  const i=y*N+x;
  if(c[i]===0)continue;
  let m=(x===N-1||y===N-1)?0:CLR_CAP;
  if(y<N-1)m=Math.min(m,c[i+N]);
  if(x<N-1)m=Math.min(m,c[i+1]);
  if(y<N-1&&x<N-1)m=Math.min(m,c[i+N+1]);
  if(y<N-1&&x>0)m=Math.min(m,c[i+N-1]);
  c[i]=Math.min(c[i],m+1);
 }
 PF.dirty=0;PF.clrT=G.tick;
}
function passable(x,y){const N=G.map.N;return x>=0&&y>=0&&x<N&&y<N&&G.map.pass[y*N+x]===1}
/* field hazard code at a world position: 0 none, 2 burn hazard, 3 liquid.
   v66: code 1 (tall grass) was deleted from the game; nothing produces it. */
function fieldAt(fx,fy){const N=G.map.N,x=Math.floor(fx),y=Math.floor(fy);if(x<0||y<0||x>=N||y>=N)return 0;return G.map.fld[y*N+x];}
/* movement speed multiplier from terrain underfoot (fliers are unaffected) */
function terrainSpeed(u){if(u.t.fly)return 1;return fieldAt(u.x,u.y)===2?.5:1;} // v66: code 1 is gone
/* radius-aware test: a unit centered at (fx,fy) keeps a small clearance from blocked
   cells so it can't clip building / resource corners. r is the unit's half-width in tiles. */
function passableR(fx,fy,r){
 const N=G.map.N;
 if(fx<r||fy<r||fx>N-r||fy>N-r)return false;
 // sample the four corners of the unit's footprint box
 if(!passable(Math.floor(fx-r),Math.floor(fy-r)))return false;
 if(!passable(Math.floor(fx+r),Math.floor(fy-r)))return false;
 if(!passable(Math.floor(fx-r),Math.floor(fy+r)))return false;
 if(!passable(Math.floor(fx+r),Math.floor(fy+r)))return false;
 return true;
}
function unitRad(u){return u.t.rad?u.t.rad:(u.t.big?.42:(u.t.a==='inf'?.26:.34))} // v30: t.rad override (APC)
/* v68 DEPENETRATION. A mover standing where passableR ALREADY fails has every branch
   of its stepper fail as well - straight, both wall slides, both perpendicular nudges
   - so it freezes where it stands for the rest of the match. Measured causes: a
   creature drawn inside its own den footprint (52% of spawns), and a unit that had a
   building or barricade dropped on top of it. The v30 wedge hop was supposed to cover
   this and never fired once in 8 measured matches.
   nearestFit walks square rings outward from the mover's own tile, nearest ring first
   and nearest point within a ring, and returns the closest tile CENTRE it fits in.
   Ring 0 is the mover's own tile, which handles the common case of a mover sitting at
   a bad offset inside an otherwise fine tile: it just slides to the middle.
   Fully deterministic - fixed scan order, no srand() draw, no clock read. */
function nearestFit(fx,fy,r,maxR){
 const bx=Math.floor(fx),by=Math.floor(fy);
 for(let rr=0;rr<=maxR;rr++){
  let best=null,bd=1e9;
  for(let oy=-rr;oy<=rr;oy++)for(let ox=-rr;ox<=rr;ox++){
   if(Math.max(ox<0?-ox:ox,oy<0?-oy:oy)!==rr)continue;
   const px=bx+ox+.5,py=by+oy+.5;
   if(!passableR(px,py,r))continue;
   const d=dhyp(px-fx,py-fy);
   if(d<bd){bd=d;best={x:px,y:py}}
  }
  if(best)return best;
 }
 return null;
}
/* Slides `e` toward the nearest point it fits in, at its own walking pace, and reports
   that it handled this tick's movement. Deliberately a SLIDE and not the v30 teleport:
   a hop reads as a glitch, and at walking pace a unit shoved under a fresh building
   just drives back out. Never called on a mover that is already standing clear. */
function unstick(e,r,step){
 const t=nearestFit(e.x,e.y,r,PF_UNSTICK_R);
 if(!t)return false;
 const dx=t.x-e.x,dy=t.y-e.y,d=dhyp(dx,dy);
 if(d<1e-6)return false;
 const sp=d<step?d:step;
 e.x+=dx/d*sp;e.y+=dy/d*sp;
 return true;
}
/* v68: `rad` is the MOVER'S half-width. It was previously assumed to be 0.34
   everywhere, which is right for a jeep and wrong for everything else: at r=0.42
   (Bull, big hulls) 27.8% of the waypoint legs this function handed back were
   impassable at the unit's own radius, and those units were blocked on 11.9% of
   their steps against 2.7% for infantry. Undefined keeps the old 0.34 assumption,
   so any call site not yet threaded behaves exactly as it did at v67. */
function findPath(sx,sy,tx,ty,avoidField,rad){
 const N=PF.N;sx=clamp(Math.floor(sx),0,N-1);sy=clamp(Math.floor(sy),0,N-1);tx=clamp(Math.floor(tx),0,N-1);ty=clamp(Math.floor(ty),0,N-1);
 const rd=rad===undefined?0.34:rad;
 if(PF.dirty||G.tick-PF.clrT>=CLR_TTL)buildClr();
 const clr=PF.clr;
 if(!passable(tx,ty)){
  /* find nearest open. v68 prefers a tile the mover can actually STAND on, and only
     falls back to the bare point test when no such tile exists inside the scan, so a
     wide hull is not handed a goal it will grind against forever.
     Comment on its own line: a trailing // here would eat the loop tail. */
  let best=null,bd=1e9,any=null,ad=1e9;
  for(let r=1;r<7&&!best;r++)for(let oy=-r;oy<=r;oy++)for(let ox=-r;ox<=r;ox++){const nx=tx+ox,ny=ty+oy;if(!passable(nx,ny))continue;const d=ox*ox+oy*oy;if(d<ad){ad=d;any=[nx,ny]}if(passableR(nx+.5,ny+.5,rd)&&d<bd){bd=d;best=[nx,ny]}}
  if(!best)best=any;
  if(best){tx=best[0];ty=best[1]}else return [{x:tx+.5,y:ty+.5}];
 }
 if(sx===tx&&sy===ty)return [{x:tx+.5,y:ty+.5}];
 PF.gen++;const gen=PF.gen,g=PF.g,vis=PF.vis,came=PF.came;
 const open=[],oi=[];
 const h=(x,y)=>{const dx=Math.abs(x-tx),dy=Math.abs(y-ty);return (dx+dy)+(-0.586)*Math.min(dx,dy)};
 const push=(idx,f)=>{open.push(f);oi.push(idx);let i=open.length-1;while(i>0){const p=(i-1)>>1;if(open[p]<=open[i])break;[open[p],open[i]]=[open[i],open[p]];[oi[p],oi[i]]=[oi[i],oi[p]];i=p}};
 const pop=()=>{const top=oi[0];const lf=open.pop(),li=oi.pop();if(open.length){open[0]=lf;oi[0]=li;let i=0;for(;;){let l=2*i+1,r=l+1,s=i;if(l<open.length&&open[l]<open[s])s=l;if(r<open.length&&open[r]<open[s])s=r;if(s===i)break;[open[s],open[i]]=[open[i],open[s]];[oi[s],oi[i]]=[oi[i],oi[s]];i=s}}return top};
 const si=sy*N+sx;vis[si]=gen;g[si]=0;came[si]=-1;push(si,h(sx,sy));
 const DIRS=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
 let found=-1,pops=0;
 while(open.length&&pops++<4000){
  const cur=pop();const cx=cur%N,cy=(cur/N)|0;
  if(cx===tx&&cy===ty){found=cur;break}
  for(const[dx,dy,cst]of DIRS){
   const nx=cx+dx,ny=cy+dy;if(!passable(nx,ny))continue;
   if(dx&&dy&&(!passable(cx+dx,cy)||!passable(cx,cy+dy)))continue;
   const ni=ny*N+nx,base=g[cur]+cst;
   // dump trucks (avoidField) treat burn hazards as costly so they route around
   // them; they'll still cross if there's no clear path. v66: the code-1 lean died
   // with tall grass, so this is the one field term left.
   // v68: plus a clearance lean, so a route prefers the middle of a corridor to the
   // wall it is about to snag on. SOFT ON PURPOSE - a one-tile gap stays passable at
   // +1.5, it just loses to any two-tile alternative under about a 1.5-tile detour.
   let ng=base;
   if(avoidField&&G.map.fld[ni]===2)ng+=25;
   ng+=CLR_PEN[clr[ni]];
   if(vis[ni]!==gen||ng<g[ni]){vis[ni]=gen;g[ni]=ng;came[ni]=cur;push(ni,ng+h(nx,ny))}
  }
 }
 if(found<0)return [{x:tx+.5,y:ty+.5}];
 const raw=[];let cur=found;while(cur>=0){raw.push({x:(cur%N)+.5,y:((cur/N)|0)+.5});cur=came[cur]}
 raw.reverse();
 // smooth (string-pull). when avoiding fields, the smoother won't shortcut across sand.
 // v68: and it string-pulls at the MOVER'S radius, not at a hardcoded 0.34.
 const out=[raw[0]];let a=0;
 for(let i=2;i<raw.length;i++){if(!losClear(raw[a],raw[i],avoidField,rd)){out.push(raw[i-1]);a=i-1}}
 out.push(raw[raw.length-1]);out.shift();
 return out.length?out:[{x:tx+.5,y:ty+.5}];
}
function losClear(a,b,avoidField,rad){
 const d=dhyp(b.x-a.x,b.y-a.y),steps=Math.ceil(d*4);
 /* v68: the mover's own half-width. Undefined still means 0.34, the v67 assumption,
    which keeps every unthreaded caller (medicTrack's line-of-sight test) unchanged. */
 const r=rad===undefined?0.34:rad;
 const N=G.map.N;
 for(let i=1;i<steps;i++){const t=i/steps,px=a.x+(b.x-a.x)*t,py=a.y+(b.y-a.y)*t;
  if(!passableR(px,py,r))return false;
  if(avoidField&&G.map.fld[(py|0)*N+(px|0)]===2)return false; // don't straighten back across quicksand
 }
 return true;
}

