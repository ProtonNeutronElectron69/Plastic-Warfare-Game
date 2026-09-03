/* ---------------- MAP / TERRAIN ---------------- */
/* v107: where a sided map's two seats sit along an edge - a third and two thirds
   of the way across, so each pair has its own home economy with room between. */
function c2v2(N,k){return Math.round(N*k/3)}
/* v107: is a world point inside the Bathroom's rotated tub oval (rim included)? */
function tubInside(t,x,y){const wx=x-t.cx,wy=y-t.cy,ct=dcos(t.th||0),st=dsin(t.th||0),u=wx*ct+wy*st,v=-wx*st+wy*ct;return (u/t.rx)**2+(v/t.ry)**2<1.15}
function makeMap(key,seed){
 const def=MAPS[key],N=def.N;
 // Per-game seed so resource jitter, decoration scatter, hazard shapes & neutral
 // placement vary between matches while overall per-location balance is preserved.
 if(seed==null)seed=(Math.random()*1e9)|0;   // v23: online matches pass the shared seed in
 const rnd=mulberry(seed);
 const M={N,theme:def.theme,seed,pass:new Uint8Array(N*N).fill(1),fld:new Uint8Array(N*N),props:[],nodes:[],starts:[],expos:[],deco:[],puddles:[],patches:[],fields:[],nests:[],mines:[],barricades:[],lvl:[]}; // v107: lvl = the Attic's 2x2 level-art footprints
 const inB=(x,y)=>x>=2&&y>=2&&x<N-2&&y<N-2;
 const block=(cx,cy,r)=>{for(let y=Math.floor(cy-r);y<=cy+r;y++)for(let x=Math.floor(cx-r);x<=cx+r;x++){if(x<0||y<0||x>=N||y>=N)continue;if(dhyp(x+.5-cx,y+.5-cy)<=r)M.pass[y*N+x]=0}};
 // v25: expansion pockets stay buildable — blocking props refuse to spawn inside one
 const nearExpo=(x,y,d)=>M.expos.some(e=>dhyp(e.x-x,e.y-y)<d);
 /* v103 THE TWO CLEARANCE QUESTIONS THE PLACEMENT PASSES NEVER ASKED.
    Everything below picks its spot against bases, nodes and expansion pockets and
    against nothing else, which is why the map audit found a bookshelf drawn
    through a console, a hedgehog standing inside a bookshelf, and a milk spill
    and a grease slick sharing thirty tiles of the same kitchen.
    farPropArt: is this ground already COVERED by a prop's art (propArtR, not the
    collision radius - the art is the wider of the two and it is the one you see).
    farField: is it already covered by a hazard of a DIFFERENT kind. Kind is part
    of the question because the per-map clusters are deliberately built out of
    overlapping lobes of ONE kind; two kinds crossing is the defect. */
 const farPropOnly=(x,y,pad)=>!M.props.some(p=>{const r=propArtR(p.t,p.r,p.sc);
  return r>0&&dhyp(p.x-x,p.y-y)<r+(pad||0)});
 /* v107, the Attic only: its crates (2x2, art radius ~1.5) and its compound
    hedgehogs are art too, laid BEFORE the clutter so a box is never dropped on a
    wall. Gated on t2v2 because refusing more spots changes which pick a pass
    accepts, and the other five layouts are pinned. The crate placer itself asks
    farPropOnly - crates stand shoulder to shoulder and keep their own overlap rule. */
 const farPropArt=(x,y,pad)=>farPropOnly(x,y,pad)
  &&!(def.t2v2&&((M.lvl||[]).some(b=>dhyp(b.x+1-x,b.y+1-y)<1.5+(pad||0))||M.barricades.some(b=>dhyp(b.x+.5-x,b.y+.5-y)<.7+(pad||0))));
 /* fldGap: how much room to spare this spot has, in tiles, against the nearest
    hazard of a different kind. Positive is clear; the more negative, the deeper
    the two blobs cross. farField is the yes/no reading of it. Returning the
    MARGIN rather than a boolean is what lets a pass that cannot find a clear spot
    take the least bad one it saw instead of taking its last roll blind - which is
    the difference between a rim that grazes and two colours crossing. */
 /* v103: KEEP is ground no hazard may be laid over at all - the fixed centrepiece
    a map is built around. The Sandbox's bucket fortress rings the middle at radius
    8.6 and the quicksand annulus starts at 8, so the pits routinely swallowed it:
    104 of the castle's own wall and tower props stood inside a quicksand pit over
    40 seeds. It rides inside fldGap rather than being a guard of its own, so every
    hazard pick that already scores its ladder gets it for free.
    Five entries exist: that fortress, the sandcastle keep beside it, the paddling
    pool, the Kitchen's cereal bowl, and the Living Room's coffee table with the
    train ring around it. THE KEEP IS THE ONE THAT PROVES THE POINT - it is a
    SINGLE prop, and the drowning pass at the foot of this function would
    correctly delete it on 9 seeds in 40 for standing in a puddle. A rule that is
    right for scattered clutter is wrong for the one prop a map is named for, and
    the answer is to stop the puddle landing there, not to exempt the prop. */
 const KEEP=[];
 // v103: where a cluster's second lobe may sit, best-first. The first entry is
 // the offset every one of these clusters used before this table existed.
 const LOBE=[[3,2],[-3,2],[3,-2],[-3,-2],[4.5,0],[0,4.5],[-4.5,0],[0,-4.5]];
 const fldGap=(x,y,kind,rx,ry)=>{let g=1e9;const R=Math.max(rx,ry)*HAZ_SC;
  for(const f of M.fields){if(f.kind===kind)continue;
   g=Math.min(g,dhyp(f.cx-x,f.cy-y)-(Math.max(f.rx,f.ry)+R)*FLD_GAP);}
  for(const kp of KEEP)g=Math.min(g,dhyp(kp.x-x,kp.y-y)-(kp.r+R));
  return g};
 const farField=(x,y,kind,rx,ry)=>fldGap(x,y,kind,rx,ry)>=0;
 /* v74: r still decides placement (the expo rejection above) and art scale for
    the types that read p.r; what it no longer decides is how much ground the
    prop takes away. That comes from PROP_BLK, and 0 there means decor. */
 const prop=(t,x,y,r,o)=>{if(r>0&&nearExpo(x,y,3.6+r))return;M.props.push(Object.assign({t,x,y,r},o||{}));
  if(r>0){const br=propBlkR(t,r,o&&o.sc);
   if(br>0){
    /* v74: block() tests tile CENTRES, and a prop sits at a fractional spot, so
       a radius under .71 can miss every centre and take nothing at all. A prop
       big enough to block always owns at least the tile it stands on. */
    const btx=Math.floor(x),bty=Math.floor(y);
    if(btx>=0&&bty>=0&&btx<N&&bty<N)M.pass[bty*N+btx]=0;
    block(x,y,br);
   }}};
 // standard resource piles now hold DOUBLE their original plastic/electricity.
 const node=(t,x,y,amt)=>{x=clamp(x,3,N-4);y=clamp(y,3,N-4);amt*=2;M.nodes.push({t,x:x+.5,y:y+.5,amt,max:amt});block(x+.5,y+.5,1)};
 // jitter helper: nudge an anchor a few tiles in a random direction. Used so the
 // exact tile a pile/battery spawns on varies per game without moving its cluster.
 const jit=(v,amt)=>v+(rnd()*2-1)*amt;
 // jittered node: keeps the intended location/amount but mixes up the precise tile
 const jnode=(t,x,y,amt,j)=>{j=j==null?2.2:j;node(t,jit(x,j),jit(y,j),amt);};
 const puddle=(x,y,r,col)=>{M.puddles.push({x,y,r,col});block(x,y,r)};
 // ---- ORGANIC HAZARD SHAPE ----
 // Instead of a perfect ellipse, each field gets a wobbly rim: a set of angular
 // radius multipliers (low-frequency noise) that make ponds/sand/grass look like
 // natural, irregular puddles & thickets. blobR(blob,angle) returns the multiplier.
 const SEG=24;
 const makeBlob=()=>{
  // build SEG control multipliers from a few sine harmonics + jitter, then the
  // renderer/stamper interpolate between them. range ~0.62..1.32 of the base radius.
  const h1=.18+rnd()*.16,h2=.10+rnd()*.12,h3=.06+rnd()*.08;
  const p1=rnd()*6.28,p2=rnd()*6.28,p3=rnd()*6.28,lobe=2+Math.floor(rnd()*3);
  const arr=new Float32Array(SEG);
  for(let i=0;i<SEG;i++){const a=i/SEG*6.283;
   let m=1+h1*dsin(a*lobe+p1)+h2*dsin(a*(lobe+2)+p2)+h3*dsin(a*(lobe+4)+p3)+(rnd()-.5)*.07;
   arr[i]=clamp(m,.6,1.4);}
  return arr;
 };
 const blobR=(blob,ang)=>blobRadius(blob,ang);
 // FIELDS: terrain effect zones. code 2=burn (slow + damage over time),
 // 3=liquid (impassable to land units). Code 1 (tall grass) was deleted at v66.
 // stamped as an irregular blob of base half-extents rx,ry centered at (cx,cy).
 // v66: every KIND is a re-skin of one of the two codes (the v35 soda principle),
 // so a themed hazard adds art and a name, never a new rule.
 const FLD={sand:2,soda:2,thorns:2,grease:2,glue:2,water:3,puddle:3,milk:3,juice:3,coffee:3,soap:2,insulation:2,bathwater:3,leak:3}; // v107: the bathroom's and the attic's kinds
 // v66: the two hazards each map is dressed with. H2 is its burn hazard, H3 its
 // impassable liquid; the shared lane passes below read these so a lane hazard is
 // always in theme. Per-map blocks name their kinds directly for legibility.
 const THEME_HAZ={backyard:{h2:'thorns',h3:'puddle'},kitchen:{h2:'grease',h3:'milk'},livingroom:{h2:'glue',h3:'juice'},sandbox:{h2:'sand',h3:'water'},desk:{h2:'soda',h3:'coffee'},
  bathroom:{h2:'soap',h3:'bathwater'},attic:{h2:'insulation',h3:'leak'}}; // v107
 const HZP=THEME_HAZ[key]||THEME_HAZ.backyard, H2=HZP.h2, H3=HZP.h3;
 const field=(kind,cx,cy,rx,ry)=>{
  /* v67: the ONE hazard-size lever. Every field() call site funnels through
     here, so scaling the half-extents at this point shrinks lane hazards,
     edge hazards, fieldPairs and the per-map clusters together. It happens
     AFTER the caller's rnd() rolls, so a seed keeps its hazard positions and
     rim shapes exactly; only the footprint moves. */
  rx*=HAZ_SC;ry*=HAZ_SC;
  const code=FLD[kind],blob=makeBlob();
  const rec={kind,code,cx,cy,rx,ry,blob};
  if(code===3)rec.blk=[];   // v67: tiles this blob is responsible for blocking
  M.fields.push(rec);
  const ext=Math.max(rx,ry)*1.4;
  for(let y=Math.max(0,Math.floor(cy-ext));y<=Math.min(N-1,cy+ext);y++)for(let x=Math.max(0,Math.floor(cx-ext));x<=Math.min(N-1,cx+ext);x++){
   const ddx=(x+.5-cx),ddy=(y+.5-cy);const ang=datan2(ddy,ddx);const rm=blobR(blob,ang);
   const nx=ddx/(rx*rm),ny=ddy/(ry*rm);if(nx*nx+ny*ny>1)continue;
   // never put a hazard on (or right next to) a resource node — trucks must reach it
   let nearNode=false;
   for(const nd of M.nodes){if(Math.abs(x+.5-nd.x)<2.5&&Math.abs(y+.5-nd.y)<2.5){nearNode=true;break}}
   if(nearNode)continue;
   // v25: expansion pockets stay hazard-free & buildable
   let nearExp=false;
   for(const e2 of M.expos){if(Math.abs(x+.5-e2.x)<3.4&&Math.abs(y+.5-e2.y)<3.4){nearExp=true;break}}
   if(nearExp)continue;
   M.fld[y*N+x]=code;
   /* v67: record the tile only when THIS blob is the one taking it. If a prop,
      a nest or an earlier pond already had it, we are not the owner and must
      never hand it back. */
   if(code===3){if(M.pass[y*N+x]===1)rec.blk.push(y*N+x);M.pass[y*N+x]=0;}
  }
 };
 // NEST: a neutral hazard. spawns wildlife that attack anything entering its radius.
 // v25: snapped to a tile centre & blocks exactly one tile — every nest is now a
 // destructible neutral structure (see initNeutrals) that frees its tile when smashed.
 const nest=(species,cx,cy,r,count)=>{const tx=Math.round(clamp(cx,4,N-5)),ty=Math.round(clamp(cy,4,N-5));if(M.nests.some(n2=>n2.x===tx+.5&&n2.y===ty+.5))return;M.nests.push({species,x:tx+.5,y:ty+.5,r,count,spawned:false});M.pass[ty*N+tx]=0;};
 /* v103 FLAT GROUND REGIONS. A chopping board, a sheet of paper, a mouse pad, a
    raked sand patch, a mulch patch and a picnic blanket are all axis-aligned
    rectangles painted onto the deck, and each was dropped at a raw random spot
    with no idea what was already lying there - so a sheet of paper routinely
    landed half on the chopping board and the mulch went down over the raked sand.
    Every region registers itself here; a rolled one retries against what is
    already down and keeps its last roll if nothing clears.
    The FIXED regions are declared BEFORE the rolled ones now. That costs no rnd()
    draw - a hard-coded rectangle rolls nothing - and it is what gives the roll
    something to avoid. */
 const REGS=[];
 const regOK=(r)=>!REGS.some(q=>r.x<q.x+q.w&&q.x<r.x+r.w&&r.y<q.y+q.h&&q.y<r.y+r.h);
 /* reg also CLAMPS onto the board. Every rolled rectangle was sized off N and
    positioned off N independently, so the widest roll of the widest patch hung a
    tile or two past the east and south rims on all three of the maps that carry
    one. A region is painted, not stamped, so nothing but the picture noticed. */
 const reg=(r)=>{r.x=clamp(r.x,1,N-1-r.w);r.y=clamp(r.y,1,N-1-r.h);REGS.push(r);return r};
 const patchAt=(mk)=>{let r=mk();for(let k2=0;k2<9&&!regOK(r);k2++)r=mk();M.patches.push(reg(r));};
 // scatter helper: place `n` small decorations of type t in a region, randomized
 const scatter=(t,n,o)=>{o=o||{};for(let i=0;i<n;i++){const x=(o.x0||0)+rnd()*((o.x1||N)-(o.x0||0)),y=(o.y0||0)+rnd()*((o.y1||N)-(o.y0||0));M.deco.push(Object.assign({t,x,y,s:(o.s0||.6)+rnd()*(o.sr||1)},o.extra?o.extra(rnd):{}));}};
 // ---- v25 EXPANSION SITES ----
 // an expansion site = 1 plastic pile + 1 battery side by side, plus a recorded
 // centre. Hazards, props, mines & barricades all keep clear of these pockets so
 // every site stays buildable and reachable (see nearExpo guards + the pocket
 // clearing pass near the end of makeMap).
 const expoSite=(x,y,pAmt,bAmt,nat)=>{
  x=clamp(x,6,N-7);y=clamp(y,6,N-7);
  const a=rnd()*6.283,ox=dcos(a)*1.6,oy=dsin(a)*1.6;
  node('plastic',x+ox,y+oy,pAmt);node('battery',x-ox,y-oy,bAmt);
  M.expos.push({x,y,nat:!!nat});
 };
 const margin=8;
 M.starts=[[margin,margin],[N-margin,N-margin],[N-margin,margin],[margin,N-margin]].map(s=>({x:s[0],y:s[1]}));
 /* v107 A SIDED MAP. The Attic seats its four starts as two pairs a third of the
    way in along the north and south edges, and names the pairs (M.sides, index
    lists into M.starts) so newGame can keep allies together. The ORDER keeps the
    point-mirror pairing every lane pass relies on: [0]<->[1] and [2]<->[3] are
    mirrors, exactly as the corner layout's are. */
 if(def.t2v2){M.starts=[{x:c2v2(N,1),y:margin},{x:c2v2(N,2),y:N-margin},{x:c2v2(N,2),y:margin},{x:c2v2(N,1),y:N-margin}];M.sides=[[0,2],[1,3]];}
 // resources near each start (2 close piles + 1 expansion pile + battery).
 // Per location the count/amount is fixed (balance) but exact tiles are jittered,
 // and the cluster is given a small random rotation so no two starts look identical.
 if(key!=='desk')for(const s of M.starts){ // v35: Desk (survival-only) skips the PvP base/expansion economy; survivalSetup lays its own
  const dx=s.x<N/2?1:-1, dy=s.y<N/2?1:-1;
  const rot=(rnd()-.5)*0.5; const ro=(ox,oy)=>({x:s.x+(ox*dcos(rot)-oy*dsin(rot)),y:s.y+(ox*dsin(rot)+oy*dcos(rot))});
  let p1=ro(6*dx,-2*dy),p2=ro(-2*dx,6*dy),bt=ro(7*dx,7*dy);
  // starting-base nodes carry 50% more than the baseline so home economies last longer
  jnode('plastic',p1.x,p1.y,2550); jnode('plastic',p2.x,p2.y,2550);
  jnode('battery',bt.x,bt.y,1950);
  // v25 NATURAL EXPANSION: a second base site just outside the main, on the way
  // toward the map centre — 1 plastic + 1 battery with a buildable pocket kept clear.
  // deterministic retry: the main battery shares this diagonal, so re-roll until
  // the site clears every already-placed node, else push it further out.
  {const dxc=N/2-s.x,dyc=N/2-s.y,L=dhyp(dxc,dyc)||1,px=-dyc/L,py=dxc/L;
   let ex=null;
   for(let k=0;k<12&&!ex;k++){
    const d0=11.5+rnd()*2,side=(rnd()*2-1)*3;
    const cx2=s.x+dxc/L*d0+px*side,cy2=s.y+dyc/L*d0+py*side;
    if(M.nodes.every(nd=>dhyp(nd.x-cx2,nd.y-cy2)>4.2))ex={x:cx2,y:cy2};
   }
   // v25.2: the old fallback pushed blindly to 15 tiles and could land the natural
   // right on the main-base battery (~2% of naturals). Keep the legacy point when
   // it clears the pair radius (so those seeds keep byte-identical layouts), and
   // only when it is genuinely crowded walk a FIXED candidate ladder under the
   // loop's own 4.2 clearance. No rnd() calls; non-fallback seeds untouched.
   if(!ex){
    const lx=s.x+dxc/L*15,ly=s.y+dyc/L*15;
    if(M.nodes.every(nd=>dhyp(nd.x-lx,nd.y-ly)>2.8))ex={x:lx,y:ly};
    else for(const [d0,side] of [[13,3],[13,-3],[14,0],[14,3],[14,-3],[15,3],[15,-3],[16,0],[16,3],[16,-3],[17,0],[17,3],[17,-3]]){
     const cx2=s.x+dxc/L*d0+px*side,cy2=s.y+dyc/L*d0+py*side;
     if(M.nodes.every(nd=>dhyp(nd.x-cx2,nd.y-cy2)>4.2)){ex={x:cx2,y:cy2};break}
    }
   }
   if(!ex)ex={x:s.x+dxc/L*15,y:s.y+dyc/L*15}; // truly cornered: accept the crowding
   expoSite(ex.x,ex.y,2250,1800,true);}
 }
 // center cache (jittered around the middle, balance preserved)
 const c=N/2;
 if(key!=='desk'){ // v35: Desk skips the PvP centre cache + contested-mid expansions
 jnode('plastic',c-4,c,2000,1.6);jnode('plastic',c+3,c-3,2000,1.6);jnode('plastic',c+3,c+4,2000,1.6);
 jnode('battery',c,c-5,1600,1.6);jnode('battery',c,c+5,1600,1.6);
 // v25 CONTESTED MID EXPANSIONS: four full expansion sites on the side lanes
 // (N/S/E/W of centre, off the main base->base diagonals), each guarded by a
 // destructible wildlife nest. Amounts match the old quadrant piles.
 const mq=Math.round((margin+c)/2);
 {const guard=(ex)=>{const gs=(def.theme==='grass'||def.theme==='sand')?(rnd()<.5?'ant':'bee'):def.theme==='attic'?(rnd()<.5?'ant':'roach'):'ant'; // v107: roaches under the rafters
   const ga=rnd()*6.283;nest(gs,ex.x+dcos(ga)*4.2,ex.y+dsin(ga)*4.2,5.6,gs==='ant'?4:3);};
  /* v107: a map may ask for its mid expansions to be jittered LESS (MAPS.midJit).
     The Bathroom does: its tub must seal, and the pocket-clearing pass at the foot
     of makeMap hands back any rim tile within sqrt(11) of an expansion centre, so
     an expansion jittered 2.2 inward reached the rim and the tub leaked at the
     spot on one seed in six. Same two rnd() draws whatever the amount, so every
     other map's layout is byte-identical. */
  const mj=def.midJit!=null?def.midJit:2.2;
  for(const [ax,ay] of [[c,mq],[c,N-mq],[mq,c],[N-mq,c]]){
   expoSite(jit(ax,mj),jit(ay,mj),1400,1300,false);
   guard(M.expos[M.expos.length-1]);
  }}
 }
 // ---- BALANCED RANDOM PLACEMENT HELPERS ----
 // To keep matches fair while randomizing the layout, gameplay-affecting features
 // (hazards, nests, blocking geometry) are placed as point-symmetric PAIRS about the
 // map centre: pick one spot at random in a band around the middle, then mirror it.
 // The mirror means whatever advantage/obstacle one side gets, the other gets too.
 const mir=(x,y)=>({x:N-x,y:N-y});
 const tooCloseStart=(x,y,d)=>M.starts.some(s=>dhyp(s.x-x,s.y-y)<(d||16));
 const farNode=(x,y,d)=>!M.nodes.some(nd=>dhyp(nd.x-x,nd.y-y)<(d||4));
 // pick a random point within an annulus around centre (rMin..rMax tiles), avoiding
 // bases and existing nodes. returns {x,y} or null after a few tries.
 /* v103: `opt` is how a caller asks the two clearance questions above, and it is
    asked of the MIRROR too - every one of these picks is half of a symmetric pair,
    so a spot that is clean here and dirty at N-x,N-y is not a clean spot.
    A constrained pick that finds nothing is not a dropped feature: every caller
    falls back to the unconstrained pick, because a hazard that clips slightly is
    a smaller defect than a hazard the map lost. */
 const pickSpot=(rMin,rMax,clearNode,startD,opt)=>{
  for(let k=0;k<40;k++){
   const a=rnd()*6.283,r=rMin+rnd()*(rMax-rMin);
   const x=c+dcos(a)*r,y=c+dsin(a)*r;
   if(!inB(x,y))continue;
   if(tooCloseStart(x,y,startD||16))continue;
   if(nearExpo(x,y,7))continue;              // v25: keep expansion pockets clear
   if(clearNode&&!farNode(x,y,clearNode))continue;
   if(opt&&opt.art!=null&&(!farPropArt(x,y,opt.art)||!farPropArt(N-x,N-y,opt.art)))continue;
   if(opt&&opt.fld&&(!farField(x,y,opt.fld.k,opt.fld.rx,opt.fld.ry)||!farField(N-x,N-y,opt.fld.k,opt.fld.rx,opt.fld.ry)))continue;
   return{x,y};
  }
  return null;
 };
 // place a symmetric pair of fields (one + its mirror). count: how many pairs.
 /* v103: the half-extents are rolled BEFORE the pick now, because the pick has to
    know how much ground this blob will cover before it can ask whether another
    kind already owns it. The rolls themselves are unchanged. */
 const fieldPairs=(kind,count,rMin,rMax,sx,sy,clearNode)=>{
  for(let i=0;i<count;i++){
   const rx=sx*(.8+rnd()*.5),ry=sy*(.8+rnd()*.5);
   /* v103: a WIDENING ladder before the unconstrained fallback, the shape
      nestPairs has used since v66. A hazard that has to sit two tiles further out
      to stop crossing another kind is still the hazard the map asked for; a
      pick that gives up on the first refusal is how the clip survived. */
   let sp=null;
   for(let a3=0;a3<4&&!sp;a3++)sp=pickSpot(Math.max(6,rMin-a3*1.5),rMax+a3*2,clearNode||4.5,15,{fld:{k:kind,rx,ry}});
   /* v103: and if the ladder finds nothing, take the LEAST BAD of a few free
      picks rather than the first one going - the same rule the lane pass uses,
      and the difference between a rim that grazes and a pit over the castle. */
   if(!sp){let best=null,bg=-1e9;
    for(let a3=0;a3<6;a3++){const q=pickSpot(rMin,rMax,clearNode||4.5,15);if(!q)continue;
     const g=Math.min(fldGap(q.x,q.y,kind,rx,ry),fldGap(N-q.x,N-q.y,kind,rx,ry));
     if(g>bg){bg=g;best=q}}
    sp=best;}
   if(!sp)continue;
   if(nearExpo(N-sp.x,N-sp.y,7))continue;    // v25: mirror must be clear too
   field(kind,sp.x,sp.y,rx,ry);const m=mir(sp.x,sp.y);field(kind,m.x,m.y,rx,ry);}
 };
 // place a symmetric pair of wildlife nests guarding the mid-map lanes.
 const nestPairs=(species,count,r,cnt,rMin,rMax)=>{
  for(let i=0;i<count;i++){
   // v66: retry when the MIRROR spot clips an expansion pocket instead of silently
   // dropping the whole pair - the same fix propPairs got at v25.1. The contested
   // mid expansions sit right inside these radius bands, so the single-shot pick
   // was losing the new roach dens on better than half of all Sandbox seeds.
   /* nest() dedupes by exact tile and returns silently, so a pick that rounds onto
      a den already standing there produces NOTHING - and the roach pass runs last,
      after every ant and bee den is down. That was the whole failure: not an
      unsatisfiable annulus, a tile collision. Both the spot and its mirror have to
      land on free tiles. */
   const tileFree=(x2,y2)=>{const tx=Math.round(clamp(x2,4,N-5)),ty=Math.round(clamp(y2,4,N-5));
    return !M.nests.some(n2=>n2.x===tx+.5&&n2.y===ty+.5)};
   const usable=(s2)=>!!s2&&!nearExpo(N-s2.x,N-s2.y,7)&&tileFree(s2.x,s2.y)&&tileFree(N-s2.x,N-s2.y);
   let sp=null;
   for(let a3=0;a3<24&&!sp;a3++){
    // the last third of the ladder widens the annulus and eases the node/start
    // clearances: better a den slightly off the ideal band than no den at all.
    const w=a3>=16;
    const s2=pickSpot(w?rMin-2:rMin,w?rMax+3:rMax,w?4:5,w?14:16);
    if(usable(s2))sp=s2;}
   if(!sp){
    /* Deterministic sweep, and it consumes no rnd() so it cannot shift the stream
       for anything downstream. Random sampling misses a thin feasible band however
       many times it is retried - roughly 1 seed in 150 was still losing its roach
       pair after 24 attempts x 40 samples. A den on every map was the requirement,
       not a den on most maps, so the last resort walks the annulus instead of
       gambling on it. */
    for(let ri=0;ri<10&&!sp;ri++)for(let ai=0;ai<48&&!sp;ai++){
     const rr=(rMin-2)+ri*((rMax+3-(rMin-2))/9),aa=ai*(6.283/48);
     const x2=c+dcos(aa)*rr,y2=c+dsin(aa)*rr;
     if(!inB(x2,y2)||tooCloseStart(x2,y2,14)||nearExpo(x2,y2,7)||!farNode(x2,y2,4))continue;
     if(!usable({x:x2,y:y2}))continue;
     sp={x:x2,y:y2};
    }
   }
   if(!sp)continue;
   nest(species,sp.x,sp.y,r,cnt);const m=mir(sp.x,sp.y);nest(species,m.x,m.y,r,cnt);}
 };
 /* v103: the loose cosmetic scatters - marbles, snails, sugar cubes - were each
    dropped at a raw random point, and after the paired passes were taught to keep
    their art clear they were the last source of art drawn through art. Same
    question, same fallback rule: try a few points, take the first clear of a
    prop's art, keep the last roll if none is. `o` may be a function so a
    per-instance roll (a marble's hue) still happens once per marble. */
 const looseProps=(t,n,lo,span,r,o)=>{
  const art=propArtR(t,r,o&&o.sc);
  for(let i=0;i<n;i++){
   let px=0,py=0;   // all four call sites scatter over the same square band on both axes
   for(let k2=0;k2<8;k2++){px=lo+rnd()*span;py=lo+rnd()*span;if(farPropArt(px,py,art))break;}
   prop(t,px,py,r,typeof o==='function'?o():o);
  }
 };
 /* v103: a fixed-corner mirrored pair, walked along a deterministic ladder until
    BOTH ends clear the expansion pockets. prop() refuses anything inside a pocket
    and these two were laid at hard-coded corners, so the natural expansion ate
    one of them and left the map a SINGLE pot where its own comment promises a
    mirrored pair - on 45 backyard seeds in 60, measured. The ladder consumes no
    rnd(), so it cannot shift the stream for anything downstream. */
 const cornerPair=(t,x0,y0,r)=>{
  const art=propArtR(t,r),LAD=[0,3,-3,6,-6,9,-9,12,-12];
  /* two passes down the same ladder: clear of the pockets AND of art already
     standing, then clear of the pockets alone. A pot drawn tight against the
     garden hose is a smaller defect than a map with one pot instead of two. */
  for(const wantArt of [true,false])for(const d of LAD){
   const x=x0+d,y=y0;
   if(!inB(x,y)||nearExpo(x,y,3.6+r)||nearExpo(N-x,N-y,3.6+r))continue;
   if(wantArt&&(!farPropArt(x,y,art)||!farPropArt(N-x,N-y,art)))continue;
   prop(t,x,y,r);prop(t,N-x,N-y,r);return;
  }
  prop(t,x0,y0,r);prop(t,N-x0,N-y0,r);   // never expected: keep the classic spot
 };
 // place a symmetric pair of small blocking props (rocks/cans/etc.).
 const propPairs=(t,count,r,rMin,rMax,o)=>{
  const art=propArtR(t,r,o&&o.sc);   // v103: how much ground this one will COVER
  for(let i=0;i<count;i++){
   // v25.1: retry the pick when the MIRROR spot clips an expansion pocket instead
   // of silently dropping the whole pair (this cost some maps their themed props)
   let sp=null;
   for(let a3=0;a3<12&&!sp;a3++){const s2=pickSpot(rMin,rMax,2.4,12,{art});
    if(s2&&!nearExpo(N-s2.x,N-s2.y,3.6+r))sp=s2;}
   /* v103: same fallback rule as everywhere else - a prop drawn tight against a
      neighbour beats a prop the map never got. This is the ladder that keeps the
      Living Room's sofa set and the Desk's clutter at full count. */
   for(let a3=0;a3<8&&!sp;a3++){const s2=pickSpot(rMin,rMax,2.4,12);
    if(s2&&!nearExpo(N-s2.x,N-s2.y,3.6+r))sp=s2;}
   if(!sp)continue;
   prop(t,sp.x,sp.y,r,o);const m=mir(sp.x,sp.y);prop(t,m.x,m.y,r,o);}
 };
 // a symmetric pair of thin blocking line-props (sticks/pencils) at a random angle.
 const lineProps=(t,count,len,r,rMin,rMax,sc)=>{
  sc=sc||1; // v36: uniform scale for scaled line-props (Desk pencils)
  for(let i=0;i<count;i++){
   // v25.1: retry the pick when the MIRROR spot clips an expansion pocket instead
   // of silently dropping the pair (the kitchen dish rack vanished on some seeds)
   let sp=null;
   for(let a3=0;a3<12&&!sp;a3++){const s2=pickSpot(rMin,rMax,2,12,{art:propArtR(t,r,sc)});
    if(s2&&!nearExpo(N-s2.x,N-s2.y,7))sp=s2;}
   for(let a3=0;a3<8&&!sp;a3++){const s2=pickSpot(rMin,rMax,2,12);   // v103 fallback, as propPairs
    if(s2&&!nearExpo(N-s2.x,N-s2.y,7))sp=s2;}
   if(!sp)continue;
   /* v74: the capsule radius is the drawn limb's half-thickness, via PROP_BLK */
   const br=propBlkR(t,r,sc);
   /* v103: the pick only ever tested the prop's ORIGIN, and a line prop is drawn
      len*sc tiles long from there - so a pencil picked near the rim was painted
      out past the board's own edge, the garden hose's defect one layer down.
      Rotate until the far end lands on the board too. The mirror sits at N-x,N-y
      pointing back along ang+PI, so ITS far end is the point mirror of this one
      and inB is symmetric about the centre: testing one end tests both. The walk
      consumes no rnd(), so it shifts nothing downstream. */
   let ang=rnd()*Math.PI;const L=len*sc;
   for(let k2=0;k2<12&&!inB(sp.x+dcos(ang)*L,sp.y+dsin(ang)*L);k2++)ang+=Math.PI/6;
   const po=sc!==1?{len,ang,sc}:{len,ang};prop(t,sp.x,sp.y,0,po);if(br>0)blockLine(M,sp.x,sp.y,len*sc,ang,br);
   const m=mir(sp.x,sp.y),po2=sc!==1?{len,ang:ang+Math.PI,sc}:{len,ang:ang+Math.PI};prop(t,m.x,m.y,0,po2);if(br>0)blockLine(M,m.x,m.y,len*sc,ang+Math.PI,br);}
 };
 // ---- LANE DISRUPTORS ----
 // a point a fraction `t` of the way from a base toward map centre, nudged `perp`
 // tiles sideways off the straight base->base line.
 const lanePoint=(base,t,perp)=>{
  const dx=c-base.x,dy=c-base.y,L=dhyp(dx,dy)||1,px=-dy/L,py=dx/L;
  return {x:clamp(base.x+dx*t+px*perp,5,N-6),y:clamp(base.y+dy*t+py*perp,5,N-6)};
 };
 // drop hazards & obstacles straight ONTO the two base<->base diagonals so neither
 // side can just beeline across. placed for two opposite starts + mirrored, which
 // covers both lanes evenly and keeps the match balanced.
 const laneClutter=(blocker)=>{
  for(const base of [M.starts[0],M.starts[2]]){
   /* v67: ONE hazard on the through-centre lane, the burn one at t=0.46.
      The old shallow-liquid pass at t=0.30 is deleted, and it was a bug as
      much as clutter: lanePoint walks a corner toward centre, so 0.30 put
      the blob ~10 tiles from a start - inside the start-overlap filter at the
      end of makeMap. That filter drops the field OBJECT, never the tiles it
      already stamped, and renderTerrain draws only from M.fields. The pass
      therefore rendered nothing on ~98% of seeds while leaving 65-97
      invisible impassable tiles per map for units to path around. */
   /* v103: two changes here, both from the map audit. The pick now retries off a
      hazard of a different kind (the lane blob and the per-map cluster were
      landing on top of each other), and the mirrored half is stamped at the SAME
      half-extents as its partner instead of rolling its own - a mirror that is a
      different size is not a mirror, and point symmetry is the whole reason this
      pass places in pairs. */
   {const rx=4.4+rnd()*1.2,ry=3.0+rnd();let a=null,best=null,bg=-1e9;
    /* v103: the ladder WIDENS. A lane blob has almost no freedom at the original
       +/-3.5 sideways nudge, and the per-map liquid cluster is picked in the very
       annulus these midpoints sit in - which is where every remaining hazard clip
       was coming from. Later attempts step further off the lane rather than
       giving up: still a lane hazard, just not laid through the milk. */
    for(let k2=0;k2<8&&!a;k2++){const q=lanePoint(base,0.36+rnd()*(0.12+k2*.04),(rnd()*2-1)*(3.5+k2*1.1));
     const g=Math.min(fldGap(q.x,q.y,H2,rx,ry),fldGap(N-q.x,N-q.y,H2,rx,ry));
     if(g>bg){bg=g;best=q}
     if(g>=0)a=q;}
    if(!a)a=best;
    field(H2,a.x,a.y,rx,ry);const m=mir(a.x,a.y);field(H2,m.x,m.y,rx,ry);}
   // a wildlife nest (ant hill or beehive) guarding the mid-lane
   {const sp=rnd()<.5?'ant':'bee';const a=lanePoint(base,0.38+rnd()*0.06,(rnd()*2-1)*2.5);
    if(!nearExpo(a.x,a.y,6.5)&&!nearExpo(N-a.x,N-a.y,6.5)){nest(sp,a.x,a.y,5.2,sp==='ant'?4:3);const m=mir(a.x,a.y);nest(sp,m.x,m.y,5.2,sp==='ant'?4:3);}}
   // sometimes a hard blocker prop right in the path to force a detour
   if(blocker&&rnd()<.7){const a=lanePoint(base,0.40+rnd()*0.08,(rnd()*2-1)*4);
    if(!nearExpo(a.x,a.y,5)&&!nearExpo(N-a.x,N-a.y,5)){prop(blocker,a.x,a.y,1.3);const m=mir(a.x,a.y);prop(blocker,m.x,m.y,1.3);}}
  }
 };
 // ---- v66: THE DIRECT BASE<->BASE LANES ----
 // lanePoint above only ever walks a corner toward the CENTRE, so laneClutter
 // covers the two through-centre diagonals and left the four adjacent-corner
 // lanes bare. Start spots are shuffled at newGame, so four of the six possible
 // matchups were fighting down open ground. edgePoint walks base A straight at
 // base B; `t` is the fraction along that line, `perp` the sideways nudge.
 const edgePoint=(a,b,t,perp)=>{
  const dx=b.x-a.x,dy=b.y-a.y,L=dhyp(dx,dy)||1,px=-dy/L,py=dx/L;
  return {x:clamp(a.x+dx*t+px*perp,5,N-6),y:clamp(a.y+dy*t+py*perp,5,N-6)};
 };
 // v67: ONE impassable blob per lane, mirrored. The burn blob that used to sit
 // at t=0.62 is gone; with the lane pass above also thinned, an adjacent-corner
 // lane now carries one hazard instead of two.
 // The mirror of lane 0-2 IS lane 1-3 and the mirror of 0-3 IS 1-2, so placing on
 // two lanes dresses all four and the map stays point-symmetric.
 const edgeClutter=()=>{
  for(const pair of [[M.starts[0],M.starts[2]],[M.starts[0],M.starts[3]]]){
   const a=pair[0],b=pair[1];
   {const rx=4.2+rnd()*1.2,ry=3.0+rnd();let p=null,best=null,bg=-1e9;   // v103: as laneClutter above
    for(let k2=0;k2<8&&!p;k2++){const q=edgePoint(a,b,0.26+rnd()*(0.12+k2*.04),(rnd()*2-1)*(3.5+k2*1.1));
     if(nearExpo(q.x,q.y,6)||nearExpo(N-q.x,N-q.y,6))continue;
     const g=Math.min(fldGap(q.x,q.y,H3,rx,ry),fldGap(N-q.x,N-q.y,H3,rx,ry));
     if(g>bg){bg=g;best=q}
     if(g>=0)p=q;}
    if(!p)p=best;
    if(p){field(H3,p.x,p.y,rx,ry);const m=mir(p.x,p.y);field(H3,m.x,m.y,rx,ry);}}
  }
 };
 // ---- HIDDEN LANDMINES ----
 // scatter ~MINES_PER_MAP invisible mines as point-symmetric pairs, clear of bases
 // and resource nodes. each sits on one tile and detonates when a ground unit steps on it.
 // v67: the field is re-rolled every match (makeMap runs off the fresh per-match
 // G.seed), MINE_KEEPOUT tiles of every start stay clear, and no two mines - a pair
 // and its own mirror included - may sit within 3 tiles of each other.
 const mineField=()=>{
  const half=Math.floor(MINES_PER_MAP/2),occ=[];
  const farMine=(x,y)=>!occ.some(o=>Math.abs(o.x-x)<3&&Math.abs(o.y-y)<3);
  let placed=0,guard=0;
  while(placed<half&&guard++<600){
   const tx=3+Math.floor(rnd()*(N-6)),ty=3+Math.floor(rnd()*(N-6));
   if(M.pass[ty*N+tx]!==1)continue;            // never bury one under a blocker (unreachable)
   if(tooCloseStart(tx+.5,ty+.5,MINE_KEEPOUT))continue;
   if(nearExpo(tx+.5,ty+.5,4.5))continue;    // v25: no mines inside expansion pockets
   if(!farNode(tx+.5,ty+.5,2.6))continue;
   if(!farMine(tx+.5,ty+.5))continue;
   const mx=tx+.5,my=ty+.5,m=mir(mx,my);
   /* v67: the mirror was only ever tested for passability, so it could bury
      itself right beside an unrelated mine. Worse, a pick inside the centre
      band sat as close as 1.41 tiles from its OWN mirror - occ does not hold
      the primary yet at this point, so farMine cannot see that case and the
      pair needs its own explicit test. Both checks use the same 3-tile rule. */
   if(Math.abs(mx-m.x)<3&&Math.abs(my-m.y)<3)continue;
   if(!farMine(m.x,m.y))continue;
   if(M.pass[Math.floor(m.y)*N+Math.floor(m.x)]!==1)continue;
   occ.push({x:mx,y:my},{x:m.x,y:m.y});
   M.mines.push({x:mx,y:my,live:true},{x:m.x,y:m.y,live:true});
   placed++;
  }
 };
 // ---- NEUTRAL BARRICADE CLUSTERS ----
 // dark-gray Czech-hedgehog clusters: short straight lines of obstacle tiles placed
 // as mirrored pairs. stored here as tile coords; turned into 100-HP neutral barricade
 // structures in newGame once the neutral owner exists.
 // v66: hoisted out of barrCluster so laneBarr below shares the SAME guards.
 // Every rejection reason lives here and nowhere else: map border, tiles already
 // blocked, 10 tiles clear of any start, expansion pockets, 2.4 clear of a node,
 // and no duplicate tile.
 const barrTile=(tx,ty)=>{
  if(tx<2||ty<2||tx>=N-2||ty>=N-2)return;
  if(M.pass[ty*N+tx]!==1)return;             // skip tiles already blocked by props/etc.
  if(tooCloseStart(tx+.5,ty+.5,10))return;
  if(nearExpo(tx+.5,ty+.5,5))return;        // v25: keep expansion pockets clear
  if(!farNode(tx+.5,ty+.5,2.4))return;
  /* v103: pass===1 above only clears the prop's COLLISION radius, and a bookshelf
     is drawn wider than it blocks - which is how hedgehogs ended up standing
     inside one on 65 of 40 Living Room seeds. Ask the art. */
  if(!farPropArt(tx+.5,ty+.5,0))return;
  /* v107: nothing is laid INSIDE the bathtub. Its floor is open ground (that is the
     point of the gates) and the scatter annulus crosses it, so a hedgehog cluster
     landed in the tub on most seeds - read in a real frame. M.tub exists on the
     Bathroom alone, so no other layout moves. */
  if(M.tub&&tubInside(M.tub,tx+.5,ty+.5))return;
  if(M.barricades.some(b=>b.x===tx&&b.y===ty))return;
  M.barricades.push({x:tx,y:ty});
 };
 /* v103 owner pass: barrCluster scattered with no memory of ITSELF, so a cluster
    routinely landed two tiles from one already down and the pair read as a single
    long arc of hedgehogs - "reduce and spread out the random arcs". BARR_SEP is
    how far a new cluster must start from every barricade already placed, and there
    is deliberately NO fallback: a cluster that cannot find clear ground is simply
    not laid, because fewer is half the ask. The lane roadblocks (laneBarr, below)
    are exempt - they are laid ACROSS a lane on purpose and their position is their
    whole job. */
 const BARR_SEP=8;
 const barrCluster=(pairs)=>{
  for(let i=0;i<pairs;i++){
   let sp=null;
   for(let a3=0;a3<10&&!sp;a3++){const s2=pickSpot(7,N*0.42,3,12);
    if(s2&&M.barricades.every(b=>dhyp(b.x+.5-s2.x,b.y+.5-s2.y)>=BARR_SEP)&&
           M.barricades.every(b=>dhyp(b.x+.5-(N-s2.x),b.y+.5-(N-s2.y))>=BARR_SEP))sp=s2;}
   if(!sp)continue;
   const ang=rnd()*Math.PI,len=3+Math.floor(rnd()*3),dx=dcos(ang),dy=dsin(ang);
   for(let s=0;s<len;s++){
    const tx=Math.round(sp.x+dx*s),ty=Math.round(sp.y+dy*s);
    barrTile(tx,ty);
    barrTile(N-1-tx,N-1-ty); // mirror
   }
  }
 };
 // ---- v66: LANE BARRICADES ----
 // barrCluster scatters over the whole board. These are laid ON the lanes two
 // bases actually fight along, and ACROSS them (perpendicular, +/-0.5 rad) so a
 // cluster reads as a roadblock instead of a rail running down the lane. Lines are
 // centred on the pick rather than growing off one end, and every tile is mirrored.
 const barrLine=(x,y,ang,len)=>{
  const dx=dcos(ang),dy=dsin(ang);
  for(let i=0;i<len;i++){
   const off=i-(len-1)/2;
   const tx=Math.round(x+dx*off),ty=Math.round(y+dy*off);
   barrTile(tx,ty);
   barrTile(N-1-tx,N-1-ty); // mirror
  }
 };
 /* v103 owner pass: `at` is where along a lane the roadblocks go. Backyard Brawl
    gets two instead of three - one near each end of the lane rather than one in
    the middle as well. The roadblock's JOB survives (neither side beelines down an
    open lane), and it is the one map where the dark hedgehogs sit on bright grass,
    which is what made the same density read as clutter there. */
 const laneBarr=(at)=>{
  // angle of the vector perpendicular to a->b
  const across=(a,b)=>datan2(b.x-a.x,-(b.y-a.y));
  for(const pair of [[M.starts[0],M.starts[2]],[M.starts[0],M.starts[3]]]){
   const a=pair[0],b=pair[1];
   for(const t of at){
    const p=edgePoint(a,b,t,(rnd()*2-1)*3);
    barrLine(p.x,p.y,across(a,b)+(rnd()-.5),4+Math.floor(rnd()*3));
   }
  }
  // one across each through-centre diagonal, just short of the middle
  for(const base of [M.starts[0],M.starts[2]]){
   const p=lanePoint(base,0.52+rnd()*0.1,(rnd()*2-1)*3);
   barrLine(p.x,p.y,across(base,{x:c,y:c})+(rnd()-.5),4+Math.floor(rnd()*3));
  }
 };
 if(key==='backyard'){
  // garden hose snakes across the map with a randomized wave each game
  /* v103: the wave was centred on a FIXED y of 6 while its amplitude rolls up to
     16, so a third of every seed's hose was laid ten tiles off the north edge -
     segments drawn out in the void past the board's own rim, and the single
     loudest count in the map audit (162 off-board props over 40 seeds). Centring
     the wave on its own amplitude is the whole fix: the trough now clears the
     edge whatever the roll, and the hose keeps its shape and its length. */
  {const hp=rnd()*6.28,ha=.9+rnd()*.9,amp=8+rnd()*8,yc=amp+5;
   for(let t=0;t<=1.001;t+=.05){const x=14+(N-28)*t,y=yc+amp*dsin(t*Math.PI*ha+hp)+t*6;prop('hose',x,y,1.1)}}
  // two terracotta pots, mirrored corners (orientation randomized)
  {const f=rnd()<.5?1:-1;cornerPair('pot',16,(f>0?N-22:22),2.4);}
  // scattered cosmetic marbles
  looseProps('marble',7,10,N-20,.9,()=>({hue:rnd()*360}));
  // blocking geometry as balanced symmetric pairs: rocks, mushrooms, twigs
  propPairs('rock',2,1.2+rnd()*.4,14,24);
  propPairs('mushroom',2,.6+rnd()*.2,10,22);
  lineProps('stick',2,4.5+rnd()*1.5,.7,10,22);
  // a couple of small garden puddles (mirrored)
  {const sp=pickSpot(12,22,4,14);if(sp){puddle(sp.x,sp.y,1.8+rnd()*.8,'water');const m=mir(sp.x,sp.y);puddle(m.x,m.y,1.8+rnd()*.8,'water');}}
  M.sandPatch=reg({x:c-6,y:N-18,w:13,h:9});   // v103: fixed, so it is declared before the rolled patches
  // mulch/dirt patches (cosmetic, random corners)
  patchAt(()=>({x:8+rnd()*(N-26),y:8+rnd()*(N-22),w:8+rnd()*4,h:7+rnd()*4,fill:'rgba(120,84,50,.42)',stroke:'rgba(76,52,28,.4)'}));
  patchAt(()=>({x:8+rnd()*(N-26),y:8+rnd()*(N-22),w:8+rnd()*4,h:6+rnd()*4,fill:'rgba(120,84,50,.4)',stroke:'rgba(76,52,28,.35)'}));
  // dense randomized ground cover
  scatter('tuft',110,{s0:.6,sr:1});
  scatter('clover',40,{s0:.7,sr:.6});
  scatter('flower',22,{s0:.7,sr:.6,extra:r=>({hue:[0,40,300,55,200][Math.floor(r()*5)]})});
  scatter('leaf',14,{x0:10,x1:N-10,y0:10,y1:N-10,s0:.7,sr:.7,extra:r=>({a:r()*6.28})});
  // v25: a checkered picnic blanket somewhere off the beaten path (cosmetic)
  {let bl=null;                                // v103: and the blanket is not laid over the mulch
   for(let k2=0;k2<6&&!bl;k2++){const bp=pickSpot(11,19,5,15);
    if(!bp||dhyp(bp.x-c,bp.y-c)<=11)continue;
    const r={x:bp.x-4.5,y:bp.y-3.5,w:9,h:7,hue:rnd()<.5?4:210};
    if(regOK(r)||k2===5)bl=reg(r);}
   if(bl)M.blanket=bl;}
  // v25: toy & garden clutter — a soccer ball, garden gnomes & watering cans (mirrored)
  propPairs('soccer',1,1.6,10,22);
  propPairs('gnome',1,1.1,12,24);
  propPairs('wcan',1,1.7,12,24);
  // v25: garden snails inch across the lawn (cosmetic)
  looseProps('snail',3,9,N-18,0);
  scatter('dandy',26,{s0:.7,sr:.5});
  scatter('bone',3,{x0:10,x1:N-10,y0:10,y1:N-10,s0:.8,sr:.4,extra:r=>({a:r()*6.28})});
  // --- terrain hazards (organic, randomized, balanced) ---
  // v25: an inflatable kiddie pool is the garden's centrepiece water hazard (the
  // ring & water are painted by renderTerrain; the tiles under it are real water)
  {const pcx=c+(rnd()-.5)*4,pcy=c+(rnd()-.5)*4,pr2=3.8+rnd()*.5;
   M.kpool={cx:pcx,cy:pcy,r:pr2,duckA:rnd()*6.28};KEEP.push({x:pcx,y:pcy,r:pr2+1.5});   // v103: no bramble over the paddling pool
   for(let y=Math.max(0,Math.floor(pcy-pr2-1));y<=Math.min(N-1,Math.ceil(pcy+pr2+1));y++)
   for(let x=Math.max(0,Math.floor(pcx-pr2-1));x<=Math.min(N-1,Math.ceil(pcx+pr2+1));x++){
    if(dhyp(x+.5-pcx,y+.5-pcy)>pr2)continue;
    let skip=false;
    for(const nd of M.nodes){if(Math.abs(x+.5-nd.x)<2.5&&Math.abs(y+.5-nd.y)<2.5){skip=true;break}}
    if(!skip)for(const e2 of M.expos){if(Math.abs(x+.5-e2.x)<3.4&&Math.abs(y+.5-e2.y)<3.4){skip=true;break}}
    if(skip)continue;
    M.fld[y*N+x]=3;M.pass[y*N+x]=0;
   }}
  // v66: bramble patches replace the old sandpits - thorns bog & prick anything
  // that wades in (code 2). The tall-grass thickets that used to sit here are gone
  // with code 1; the lane passes below carry the contested-ground hazards now.
  fieldPairs('thorns',1,9,16,5.5,3.8);
  field('thorns',c-1+(rnd()-.5)*4,N-14+(rnd()-.5)*3,5.5+rnd(),3.6+rnd());
  // wildlife guarding the mid-map lanes: an ant pair and a bee pair
  nestPairs('ant',1,5.5,4,7,13);
  nestPairs('bee',1,5.5,3,8,14);
  // break up the direct base->base diagonals with extra hazards & a rock blocker
  laneClutter('rock');
 }else if(key==='kitchen'){
  // soup cans as blocking cover — two mirrored pairs at randomized lane positions
  propPairs('can',2,1.7,12,22);
  // scattered pencils/fork/spoon as long blockers (mirrored)
  lineProps('pencil',2,8+rnd()*2,.8,12,24);
  lineProps('fork',1,8,.8,14,24);
  // sugar cubes (cosmetic-ish small blockers), randomized
  looseProps('sugar',4,8,N-16,1);
  // a cereal bowl somewhere off-centre
  {const bp=pickSpot(8,16,4,14)||{x:c+2,y:c-12};prop('bowl',bp.x,bp.y,3.2);M.bowlAt={x:bp.x,y:bp.y};KEEP.push({x:bp.x,y:bp.y,r:3.6});}   // v103: no spill over the cereal bowl
  // spill puddles (cosmetic) at random spots
  {const a=pickSpot(10,22,4,14);if(a)puddle(a.x,a.y,2.2+rnd()*.6,'milk');const b=pickSpot(10,22,4,14);if(b)puddle(b.x,b.y,1.6+rnd()*.6,'juice');}
  M.board=reg({x:c-12,y:c+2,w:24,h:12});      // v103: fixed, so it is declared before the sheet of paper
  /* v103 owner pass: the sheet of paper was near-white at .9 over a light grey
     tile, so it read as a hole in the floor rather than as paper. Warmer, a shade
     down, and a firmer edge so the rectangle still reads as a sheet. */
  patchAt(()=>({x:8+rnd()*(N-22),y:8+rnd()*(N-20),w:11+rnd()*4,h:9+rnd()*3,fill:'rgba(238,236,230,.92)',stroke:'rgba(158,160,166,.9)',inset:1}));
  if(M.bowlAt)for(let i=0;i<26;i++)M.deco.push({t:'cereal',x:M.bowlAt.x+(rnd()-.5)*16,y:M.bowlAt.y+(rnd()-.3)*14,s:.5+rnd()*.4,hue:35+rnd()*20});
  scatter('crumb',22,{x0:8,x1:N-8,y0:8,y1:N-8,s0:.5,sr:.7});
  // v25: counter clutter — a dish rack, plate stacks, mugs, toasters & salt shakers
  lineProps('rack',1,4.5,1.1,12,22);
  propPairs('plate',1,1.5,10,22);
  propPairs('mug',1,1.3,12,22,{hue:rnd()*360});
  propPairs('toaster',1,2,14,24);
  propPairs('salt',1,.9,10,20);
  scatter('pea',14,{x0:8,x1:N-8,y0:8,y1:N-8,s0:.7,sr:.5});
  scatter('cap',8,{x0:8,x1:N-8,y0:8,y1:N-8,s0:.7,sr:.5,extra:r=>({hue:r()*360})});
  // --- hazards (organic, randomized, balanced) ---
  // v66: the milk spill is its own kind now instead of blue pond water (impassable)
  {const sp=pickSpot(8,16,5,14,{fld:{k:'milk',rx:7,ry:5}})||pickSpot(8,16,5,14)||{x:26,y:34};   // v103: off the grease
   /* v103: the second lobe picks its DIRECTION off the same clearance question
      the first one asked, so a cluster cannot reach over a centrepiece with its
      second half - which is how the Sandbox lost its sandcastle on 9 seeds in 40
      before this line existed. The ladder consumes no rnd(). And the mirror lobe
      uses the SAME offset: it used to sit at a fixed -3,-3 against a jittered
      +3,+3, so the "mirrored" pair was never quite a mirror. */
   const o2=LOBE.find(d=>farField(sp.x+d[0],sp.y+d[1],'milk',3.8,2.6))||LOBE[0];
   field('milk',sp.x,sp.y,6+rnd()*1.5,4+rnd());field('milk',sp.x+o2[0],sp.y+o2[1],3.8+rnd(),2.6+rnd());
   const m=mir(sp.x,sp.y);field('milk',m.x,m.y,6+rnd()*1.5,4+rnd());field('milk',m.x-o2[0],m.y-o2[1],3.8+rnd(),2.6+rnd());}
  // hot skillet grease: slows & burns (mirrored pair)
  fieldPairs('grease',1,9,16,5,3.5);
  // pantry ants swarm the crumb trails (mirrored pair)
  nestPairs('ant',1,5,4,8,14);
  // break up the direct base->base diagonals with extra hazards & a soup-can blocker
  laneClutter('can');
 }else if(key==='livingroom'){
  // ===== LIVING ROOM =====
  // a plush carpet battlefield: a sofa set & coffee table anchor the centre, two
  // toy-block forts give cover, houseplants and board-game marbles dot the floor.
  // an area rug under the coffee table (cosmetic region drawn by the renderer)
  M.rug=reg({x:c-15,y:c-11,w:30,h:22});
  // sofa set: a long couch + two armchairs. block radii are kept compact (close to the
  // drawn footprint) and well spaced so they don't merge into maze-like walls.
  propPairs('couch',1,1.7,9,16);     // long sofas, one per side
  propPairs('chair',2,1.2,12,22);    // armchairs flanking
  // a low media console + a tall bookshelf along opposite walls (mirrored)
  propPairs('console',1,1.5,16,24);
  propPairs('shelf',1,1.3,18,26);
  // floor lamps in two corners (mirrored) — thin, barely block
  propPairs('lamp',1,.5,20,28);
  // central coffee table on the rug (single, dead centre-ish)
  {const tx=c+(rnd()-.5)*3,ty=c+(rnd()-.5)*3;prop('table',tx,ty,1.5);M.tableAt={x:tx,y:ty};KEEP.push({x:tx,y:ty,r:8.6});}   // v103: no spill over the coffee table or the train ring around it
  // v25: a wooden toy train loops the coffee table on the rug (track is painted by
  // renderTerrain; the engine & cars are real blocking cover on the ring)
  {const tc2=M.tableAt,trx=7.5,try2=4.8;M.track={cx:tc2.x,cy:tc2.y,rx:trx,ry:try2};
   const a0=rnd()*6.28,hues=[8,120,210,45];
   // v25.1: a blocked spot no longer drops the car (trains used to lose cars, even
   // the engine); the car slides along the track until its spot is clear. carOk
   // mirrors prop()'s own expo clearance so a rejected prop() can't silently eat one.
   const carOk=(px2,py2)=>!M.nodes.some(nd=>dhyp(nd.x-px2,nd.y-py2)<2.6)&&!nearExpo(px2,py2,4.5);
   let a2=a0;
   for(let k2=0;k2<4;k2++){
    let tr2=0,px2=0,py2=0,got=false;
    while(tr2++<40){px2=tc2.x+dcos(a2)*trx;py2=tc2.y+dsin(a2)*try2;if(carOk(px2,py2)){got=true;break}a2+=.14;}
    if(got){
     const tang=datan2(dcos(a2)*try2,-dsin(a2)*trx);
     prop('traincar',px2,py2,.9,{rot:tang,hue:hues[k2],eng:k2===0?1:0});
    }
    a2+=.55;
   }}
  // two potted houseplants, mirrored corners
  {const f=rnd()<.5?1:-1;cornerPair('pot',15,(f>0?N-19:19),1.5);}
  // two toy-block forts: a short straight wall of 3 alphabet blocks (clean cover, open ends)
  /* v103: a fort walks its sideways offset until all three blocks and their three
     mirrors clear the art already standing. It used to be laid at one fixed point
     on the lane and came down on top of a floor lamp on 30 seeds in 40. */
  {const fortAt=(st)=>{const p0=lanePoint(st,0.34,6);
    for(const off of [6,8,4,10,2,12,0,14,-2]){const q=lanePoint(st,0.34,off);
     if(farPropArt(q.x,q.y,1.9)&&farPropArt(N-q.x,N-q.y,1.9))return q;}
    return p0};
   const forts=[fortAt(M.starts[0]),fortAt(M.starts[2])];
   for(const fo of forts){
    const ang=rnd()*Math.PI,dx=dcos(ang),dy=dsin(ang);
    for(let i=-1;i<=1;i++)prop('blocks',fo.x+dx*i*1.4,fo.y+dy*i*1.4,0.7,{hue:[0,40,210][i+1],rot:rnd()*0.6});
    const m=mir(fo.x,fo.y);
    for(let i=-1;i<=1;i++)prop('blocks',m.x+dx*i*1.4,m.y+dy*i*1.4,0.7,{hue:[0,40,210][i+1],rot:rnd()*0.6});
   }}
  // scattered board-game marbles (cosmetic only — they don't block movement)
  looseProps('marble',9,10,N-20,0,()=>({hue:rnd()*360}));
  // v25: household clutter — a slipper, the TV remote & stacks of picture books (mirrored)
  propPairs('slipper',1,1.6,12,24);
  propPairs('remote',1,1.1,10,22);
  propPairs('books',1,1.6,12,24);
  // v25: an open picture book left on the carpet (cosmetic)
  {const bp=pickSpot(10,17,4.5,15);if(bp)M.bookOpen={x:bp.x-4.5,y:bp.y-3,w:9,h:6,hue:rnd()*360};}
  scatter('dice',6,{x0:10,x1:N-10,y0:10,y1:N-10,s0:.8,sr:.4,extra:r=>({a:r()*6.28})});
  scatter('crayon',10,{x0:10,x1:N-10,y0:10,y1:N-10,s0:.8,sr:.4,extra:r=>({a:r()*6.28,hue:r()*360})});
  scatter('puzzle',8,{x0:10,x1:N-10,y0:10,y1:N-10,s0:.8,sr:.4,extra:r=>({a:r()*6.28,hue:r()*360})});
  /* v103: this line has said "dust-bunny" since v25 and has been scattering
     'tuft' - a clump of bright green GRASS BLADES, the backyard's ground cover -
     across a living-room carpet the whole time. The owner named it. 'dust' is the
     decoration the comment always described; the grass tuft is untouched and
     still the backyard's. */
  scatter('dust',60,{s0:.4,sr:.6});
  scatter('crumb',16,{x0:10,x1:N-10,y0:10,y1:N-10,s0:.4,sr:.5});
  // --- hazards (themed as living-room messes) ---
  // v66: spilled grape juice soaks the carpet (impassable), overlapping lobes, mirrored
  {const sp=pickSpot(9,16,5,14,{fld:{k:'juice',rx:6.5,ry:4.6}})||pickSpot(9,16,5,14)||{x:c+7,y:c+8};   // v103: off the glue
   const o2=LOBE.find(d=>farField(sp.x+d[0],sp.y+d[1],'juice',3.2,2.3))||LOBE[0];   // v103, as the kitchen's milk
   field('juice',sp.x,sp.y,5.5+rnd(),3.6+rnd());field('juice',sp.x+o2[0],sp.y+o2[1],3.2+rnd(),2.3+rnd());
   const m=mir(sp.x,sp.y);field('juice',m.x,m.y,5.5+rnd(),3.6+rnd());field('juice',m.x-o2[0],m.y-o2[1],3.2+rnd(),2.3+rnd());}
  // v66: a tipped-over bottle of craft glue bogs & stings (mirrored pair)
  fieldPairs('glue',1,9,16,4.6,3.2);
  // ants raid a dropped snack (mirrored pair)
  nestPairs('ant',1,5,4,9,15);
  // break up the direct base->base diagonals with extra hazards & a block-fort detour
  laneClutter('blocks');
 }else if(key==='sandbox'){ // sandbox
  // v25: a grand multi-tower castle rings the centre cache. Its four gates face the
  // contested side-lane expansions; a cosmetic moat ring is painted by renderTerrain.
  {const R=8.6,off=rnd()*.35;
   const gate=a2=>{for(let k2=0;k2<4;k2++){let d2=Math.abs(a2-k2*Math.PI/2);d2=Math.min(d2,Math.PI*2-d2);if(d2<.34)return true}return false};
   const nearTwr=a2=>{for(let k2=0;k2<4;k2++){let d2=Math.abs(a2-(Math.PI/4+k2*Math.PI/2));d2=Math.min(d2,Math.PI*2-d2);if(d2<.15)return true}return false};
   for(let a=off;a<Math.PI*2+off;a+=.15){const aa=a%(Math.PI*2);if(gate(aa)||nearTwr(aa))continue;prop('wall',c+dcos(aa)*R,c+dsin(aa)*R,1)}
   for(let k2=0;k2<4;k2++){const a2=Math.PI/4+k2*Math.PI/2;prop('tower',c+dcos(a2)*R,c+dsin(a2)*R,1.7)}
   M.moat={cx:c,cy:c,r:R+2.1};KEEP.push({x:c,y:c,r:M.moat.r});}   // v103: no pit over the fortress
  // v25.1: the keep centrepiece walks a deterministic candidate ring; its old fixed
  // north spot always sat inside the north mid-expansion clearance, so it NEVER
  // placed. Diagonal spots are tried first (mid expos live on the cardinal lanes).
  {let kOk=false;
   for(const kRad of [13,14.5,16]){
    for(const kA of [5,7,3,1,6,4,2,0]){ // NW,NE,SW,SE first, then cardinals
     const a2=kA*Math.PI/4,kx=c+dcos(a2)*kRad,ky=c+dsin(a2)*kRad;
     if(!inB(kx,ky)||tooCloseStart(kx,ky,10)||nearExpo(kx,ky,6.6))continue;
     prop('keep',kx,ky,3);KEEP.push({x:kx,y:ky,r:3.4});kOk=true;break;   // v103: and no pit over the keep
    }
    if(kOk)break;
   }
   // safety net (never expected): draw it non-blocking at the classic spot so the
   // centrepiece can't vanish; r=0 skips the expo clearance and blocks nothing.
   if(!kOk)prop('keep',c,c-13,0);
  }
  // garden tools as long blockers, randomized & mirrored
  lineProps('shovel',1,9,1,12,22);
  lineProps('rake',1,7,.8,14,24);
  // decorative stars & sand-castle towers as mirrored pairs
  propPairs('star',1,2.2,10,22);
  propPairs('tower',1,1.7,12,24);
  propPairs('shellp',1,.8,8,22);
  // a buried dino somewhere off to one side
  {const dp=pickSpot(10,20,3,14)||{x:18,y:28};prop('dino',dp.x,dp.y,2.2);}
  patchAt(()=>({x:8+rnd()*(N-22),y:8+rnd()*(N-20),w:11+rnd()*4,h:8+rnd()*3,fill:'rgba(186,142,82,.5)',stroke:'rgba(130,96,52,.4)'}));
  scatter('pebble',60,{s0:.3,sr:.5});
  // v25: beach toys & tide-pool treasures
  propPairs('beachball',1,1.7,12,24);
  propPairs('dumptruck',1,1.9,12,24);
  scatter('shell',22,{s0:.7,sr:.5,extra:r=>({a:r()*6.28})});
  scatter('starfish',6,{x0:9,x1:N-9,y0:9,y1:N-9,s0:.8,sr:.5,extra:r=>({a:r()*6.28})});
  // a wandering trail of footprints starting at a random edge
  {const fx=8+rnd()*10,fy=8+rnd()*10,dirx=.7+rnd()*1.4,diry=.7+rnd()*1.4;for(let i=0;i<8;i++)M.deco.push({t:'footp',x:fx+i*dirx,y:fy+i*diry,s:1,o:i%2});}
  // --- hazards (organic, randomized, balanced) ---
  // a tipped water-bucket puddle (impassable) of overlapping lobes, mirrored
  {const sp=pickSpot(9,16,5,14,{fld:{k:'water',rx:6.5,ry:4.6}})||pickSpot(9,16,5,14)||{x:c+8,y:c+9};   // v103: off the quicksand
   const o2=LOBE.find(d=>farField(sp.x+d[0],sp.y+d[1],'water',3.4,2.4))||LOBE[0];   // v103, as the kitchen's milk
   field('water',sp.x,sp.y,5.5+rnd(),3.6+rnd());field('water',sp.x+o2[0],sp.y+o2[1],3.4+rnd(),2.4+rnd());
   const m=mir(sp.x,sp.y);field('water',m.x,m.y,5.5+rnd(),3.6+rnd());field('water',m.x-o2[0],m.y-o2[1],3.4+rnd(),2.4+rnd());}
  // quicksand pits: slow & damaging (two mirrored pairs)
  fieldPairs('sand',2,8,17,5.5,3.8);
  // ants nest in the warm sand (mirrored pair)
  nestPairs('ant',1,5.2,4,8,15);
  // break up the direct base->base diagonals with extra hazards & a sand-wall blocker
  laneClutter('wall');
}else if(key==='bathroom'){
  // ===== BATHROOM FLOOR (v107) =====
  // porcelain tile, and a DRAINED bathtub ringing the centre cache: an oval rim of
  // blocking porcelain segments with the taps end and the far end left open as
  // its two gates - the Sandbox's bucket fortress, rounded. The tub floor and its
  // drain are painted by renderTerrain (M.tub); the rim is real cover.
  /* THREE THINGS ABOUT THE RIM, all measured with a flood fill (gates blocked, is
     the inside reachable?) and the map audit:
     - the step is .10 rad, closer than the bucket fortress's .15, because a rim
       has to SEAL: block() takes tile centres within the segment's .5 radius, and
       at .14 the ellipse's flat ends left one passable tile between segments;
     - the tub lies on the (1,1) DIAGONAL, long axis toward two of the corners,
       because the four contested mid expansions sit 14 tiles out on the cardinal
       lines and jitter 2.2 inward: an axis-aligned oval reached to within a prop
       refusal of them (3.6 + r), lost its segments beside the gates on four seeds
       in seven, and leaked. Diagonal, its cardinal reach is 7.9 and the rim
       clears every pocket; and the diagonal is the one that keeps every jittered
       cache node INSIDE the oval, which the other diagonal does not;
     - the audit exempts tubrim-to-tubrim art overlap for the reason a pencil is
       exempt from the drowning rule: the segments are one lip.
     The two gates are the long-axis ends. */
  /* 9.5 x 6.6, with the Bathroom's mid expansions jittered 1.0 rather than 2.2
     (MAPS.bathroom.midJit): the rim's reach toward a cardinal expansion is up to
     8.3 (it is a rotated oval, so the reach off-axis is more than the 7.66 on
     it), a blocked tile overhangs the segment by up to .75, and the expansion's
     pocket-clearing radius is 3.32 - which needs the expansion at 12.4 or more,
     and 14 - 2.2 was not. Three leaks were found by one flood fill in turn: the
     .14 step, the axis-aligned oval beside the gates, and this pocket. */
  {const RX=9.5,RY=6.6,TH=Math.PI/4,off=rnd()*.25,ct=dcos(TH),st=dsin(TH);
   const tubPt=a2=>{const u=RX*dcos(a2),v=RY*dsin(a2);return {x:c+u*ct-v*st,y:c+u*st+v*ct}};
   const gate=a2=>{for(const g of [0,Math.PI]){let d2=Math.abs(a2-g);d2=Math.min(d2,Math.PI*2-d2);if(d2<.30)return true}return false};
   /* laid by hand rather than through prop(): prop() refuses anything within 3.6
      tiles of an expansion centre, a margin for clutter, and the E/W mid pockets
      jittered inward reach 3.5 from the rim - which cost a segment beside a gate
      on one seed in seven and the tub leaked there. The rule that MATTERS is the
      pocket-clearing pass at the foot of makeMap (radius sqrt(11), 3.32): a rim
      tile inside it would be handed back and the seal broken, so 3.45 is the
      refusal here and the flood-fill in tail_v107 proves the seal. */
   const rimSeg=(x,y,o)=>{if(M.expos.some(e=>dhyp(e.x-x,e.y-y)<3.45))return;M.props.push({t:'tubrim',x,y,r:.01,a:o});
    const tx=Math.floor(x),ty=Math.floor(y);if(tx>=0&&ty>=0&&tx<N&&ty<N)M.pass[ty*N+tx]=0;block(x,y,propBlkR('tubrim',.01));};
   for(let a=off;a<Math.PI*2+off;a+=.10){const aa=a%(Math.PI*2);if(gate(aa))continue;const q=tubPt(aa);
    rimSeg(q.x,q.y,datan2(RY*dcos(aa),-RX*dsin(aa))+TH)}   // the tangent is the segment's long side
   M.tub={cx:c,cy:c,rx:RX,ry:RY,th:TH,drainA:rnd()*6.28};KEEP.push({x:c,y:c,r:RX+2});   // no spill laid over the tub
   // the rubber duck sits in the tub, on the first spot around the drain that is clear of the cache
   {let put=false;for(let k2=0;k2<12&&!put;k2++){const a2=rnd()*6.28,u=RX*.5*dcos(a2),v=RY*.5*dsin(a2),dx2=c+u*ct-v*st,dy2=c+u*st+v*ct;
     if(farNode(dx2,dy2,2.4)&&farPropArt(dx2,dy2,.6)){prop('duck',dx2,dy2,.6,{rot:rnd()*6.28});put=true}}
    if(!put)prop('duck',c,c,0);}}   // never expected: draw it non-blocking rather than lose it
  // the tub's own square goes into the region list first, so the mat and the towel are never laid across it
  reg({x:c-10,y:c-10,w:20,h:20});
  // the bath mat: a fixed fluffy rectangle beside the tub's long side, declared before the rolled patches
  M.mat=reg({x:c+3,y:c-16,w:12,h:7,hue:rnd()<.5?200:340});
  // toiletries as blocking cover, in mirrored pairs at randomized positions
  propPairs('tproll',1,1.4,12,24);
  propPairs('shampoo',2,.9,12,26,{hue:rnd()*360});
  propPairs('soapbar',1,.8,10,22);
  propPairs('sponge',1,.9,12,24);
  propPairs('plunger',1,.9,14,26);
  lineProps('toothbrush',1,6,.3,12,24);
  // a dropped towel (cosmetic) somewhere off the beaten path
  patchAt(()=>({x:8+rnd()*(N-24),y:8+rnd()*(N-22),w:10+rnd()*4,h:7+rnd()*3,fill:'rgba(246,240,228,.9)',stroke:'rgba(190,178,160,.8)',inset:1}));
  // water droplets and a few stray hairs across the tile
  scatter('droplet',46,{x0:6,x1:N-6,y0:6,y1:N-6,s0:.6,sr:.6});
  scatter('hair',10,{x0:8,x1:N-8,y0:8,y1:N-8,s0:.8,sr:.6,extra:r=>({a:r()*6.28})});
  // --- hazards (bathroom messes) ---
  // the overflow: soapy bathwater pooled on the tile (impassable), overlapping lobes, mirrored
  {const sp=pickSpot(13,20,5,14,{fld:{k:'bathwater',rx:6.5,ry:4.6}})||pickSpot(13,20,5,14)||{x:c+9,y:c+10};
   const o2=LOBE.find(d=>farField(sp.x+d[0],sp.y+d[1],'bathwater',3.2,2.3))||LOBE[0];
   field('bathwater',sp.x,sp.y,5.5+rnd(),3.6+rnd());field('bathwater',sp.x+o2[0],sp.y+o2[1],3.2+rnd(),2.3+rnd());
   const m=mir(sp.x,sp.y);field('bathwater',m.x,m.y,5.5+rnd(),3.6+rnd());field('bathwater',m.x-o2[0],m.y-o2[1],3.2+rnd(),2.3+rnd());}
  // a soap slick: slippery suds that bog and sting the eyes (code 2), mirrored pair
  fieldPairs('soap',1,20,27,4.8,3.3);   // its own band, outside the bathwater's, so the two kinds seldom meet
  // ants have found the damp (mirrored pair)
  nestPairs('ant',1,5,4,9,15);
  // break up the direct base->base diagonals with extra hazards & a toilet-roll blocker
  laneClutter('tproll');
 }else if(key==='attic'){
  // ===== THE ATTIC (v107) - the game's first 2v2 battlefield =====
  // Bare floorboards under the rafters. The four starts are two PAIRS along the
  // north and south edges (M.sides, set above), and each pair sits inside a
  // COMPOUND: a front line of destructible level art (2x2 neutral crates -
  // boxes, trunks, magazine bales - drawn by drawLevelArt) mixed with several
  // staggered layers of neutral hedgehogs, with three gates left open. The rest
  // of the attic is clutter, a pink insulation bale and a roof leak.
  M.lvl=[];
  /* a 2x2 crate at top-left tile (tx,ty). Blocked HERE, in makeMap, so the mines,
     the hedgehog passes, the hazard stamps and sealPockets all see it; initNeutrals
     turns the record into a real neutral structure on the same four tiles. tx may
     be 0: a crate on the very rim is what closes the two-tile strip a hedgehog
     (barrTile refuses tx<2) cannot. */
  const lvlOK=(tx,ty)=>{
   if(tx<0||ty<0||tx+2>N||ty+2>N)return false;
   const cx2=tx+1,cy2=ty+1;
   if(tooCloseStart(cx2,cy2,9)||nearExpo(cx2,cy2,4.6)||!farNode(cx2,cy2,2.8)||!farPropOnly(cx2,cy2,1.3))return false;
   for(let y=0;y<2;y++)for(let x=0;x<2;x++)if(M.pass[(ty+y)*N+(tx+x)]!==1)return false;
   if(M.lvl.some(b=>Math.abs(b.x-tx)<2&&Math.abs(b.y-ty)<2))return false;
   return true;
  };
  const lvlBlock=(tx,ty)=>{M.lvl.push({x:tx,y:ty});for(let y=0;y<2;y++)for(let x=0;x<2;x++)M.pass[(ty+y)*N+(tx+x)]=0;};
  /* a 2x2 block and its point mirror - BOTH or NEITHER. Laying each half on its own
     merits left one compound a crate the other did not have on one seed in six
     (a natural expansion's pocket refused one half), and an obstacle one team has
     and the other does not is a balance change, the v103 drowning rule again. */
  const lvlPair=(tx,ty)=>{const mx=N-2-tx,my=N-2-ty;if(lvlOK(tx,ty)&&lvlOK(mx,my)){lvlBlock(tx,ty);lvlBlock(mx,my);return true}return false};
  // a row of hedgehogs x0..x1 at ty with `skip` random holes, and its point mirror
  const hedgeRow=(x0,x1,ty,skip)=>{
   const holes=new Set();for(let k2=0;k2<skip;k2++)holes.add(x0+Math.floor(rnd()*(x1-x0+1)));
   for(let tx=x0;tx<=x1;tx++){if(holes.has(tx))continue;barrTile(tx,ty);barrTile(N-1-tx,N-1-ty);}
  };
  /* THE FRONT LINE, north side (the south side is its point mirror). FRONT is the
     row the line stands on; behind it (smaller y) is the compound. Gates: the
     west one at x 14-17, the centre one at x 31-40 (the north mid expansion sits
     there, and the crate and hedgehog guards refuse its pocket by themselves), the
     east one at x 54-57. Reading west to east: crates, gate, three hedgehog
     layers, gate, crates then hedgehogs, gate, hedgehogs with crates behind. */
  const FRONT=24;
  for(const tx of [0,2,4,6,8,10,12])lvlPair(tx,FRONT);          // west stretch: solid crates to the rim
  hedgeRow(2,13,FRONT+3,2);                                      // ...with a hedgehog layer behind
  hedgeRow(18,30,FRONT,3);hedgeRow(18,30,FRONT+2,2);hedgeRow(18,30,FRONT+4,3); // three layers, holes staggered
  for(const tx of [41,43,45])lvlPair(tx,FRONT);                  // east-centre: crates...
  hedgeRow(47,53,FRONT,1);hedgeRow(41,53,FRONT+3,3);              // ...then hedgehogs
  hedgeRow(58,69,FRONT,2);hedgeRow(58,69,FRONT+2,2);              // east stretch: two hedgehog layers
  lvlPair(70,FRONT);for(const tx of [59,63,67])lvlPair(tx,FRONT+4); // the rim crate, and crates behind the layers
  // loose cover out in the field between the two lines: two mirrored crate pairs
  for(let k2=0;k2<2;k2++){const sp=pickSpot(6,13,3,16,{art:1.6});if(sp)lvlPair(Math.round(sp.x)-1,Math.round(sp.y)-1);}
  /* the clutter goes down AFTER the compound. farPropArt counts the Attic's crates
     and hedgehogs as art (above), so a box is never dropped on a wall - the map
     audit's "barricade inside prop art" - and the wall is never short a crate
     because a box got there first, which is what laying the clutter first cost:
     two crate pairs on one seed in six. */
  // attic clutter: cardboard boxes, a steamer trunk, a lampshade, a leaning picture frame, a rolled rug
  propPairs('box',3,1.2,12,28,{hue:rnd()*20});
  propPairs('trunk',1,1.5,14,28);
  propPairs('lampshade',1,.9,12,26);
  propPairs('frame',1,1.0,12,28,{hue:rnd()*360});
  lineProps('rug',1,6,.5,12,26);
  // a dust sheet dropped over something (cosmetic), off in a corner
  patchAt(()=>({x:8+rnd()*(N-28),y:8+rnd()*(N-24),w:12+rnd()*4,h:9+rnd()*3,fill:'rgba(228,224,214,.86)',stroke:'rgba(160,154,140,.7)',inset:1}));
  // dust bunnies, mothballs and cobwebs
  scatter('dust',90,{s0:.5,sr:.7});
  scatter('mothball',18,{x0:8,x1:N-8,y0:8,y1:N-8,s0:.7,sr:.4});
  scatter('cobweb',10,{x0:6,x1:N-6,y0:6,y1:N-6,s0:.8,sr:.7,extra:r=>({a:r()*6.28})});
  // --- hazards (attic messes), picked in the FIELD between the two lines ---
  /* the corner-lane pickers assume four corner bases, so this map picks its own
     spots: a band across the middle, clear of the expansions and the cache */
  const fieldSpot=(kind,rx,ry)=>{let best=null,bg=-1e9;
   for(let k2=0;k2<40;k2++){const x=8+rnd()*(N-16),y=c-7+rnd()*14;
    if(nearExpo(x,y,7)||nearExpo(N-x,N-y,7)||!farNode(x,y,4.5))continue;
    const g=Math.min(fldGap(x,y,kind,rx,ry),fldGap(N-x,N-y,kind,rx,ry));
    if(g>bg){bg=g;best={x,y}}
    if(g>=0)return best;}
   return best};
  // the roof leak: rainwater pooled on the boards (impassable), two lobes, mirrored
  {const rx=5+rnd(),ry=3.4+rnd();const sp=fieldSpot('leak',rx,ry);
   if(sp){const o2=LOBE.find(d=>farField(sp.x+d[0],sp.y+d[1],'leak',3,2.2))||LOBE[0];
    field('leak',sp.x,sp.y,rx,ry);field('leak',sp.x+o2[0],sp.y+o2[1],3+rnd(),2.2+rnd());
    const m=mir(sp.x,sp.y);field('leak',m.x,m.y,rx,ry);field('leak',m.x-o2[0],m.y-o2[1],3+rnd(),2.2+rnd());}}
  // a burst bale of pink insulation: itches and bogs (code 2), mirrored
  {const rx=4.6+rnd(),ry=3.2+rnd();const sp=fieldSpot('insulation',rx,ry);
   if(sp){field('insulation',sp.x,sp.y,rx,ry);const m=mir(sp.x,sp.y);field('insulation',m.x,m.y,rx,ry);}}
  // ants in the field, guarding the gates (mirrored pair)
  nestPairs('ant',1,5,4,9,14);
 }else if(key==='desk'){
  // ===== THE DESK (wave-survival only) =====
  // Wooden desktop battlefield. survivalSetup carves the central arena and lays the
  // curated (players+1) economy + exposed corner pairs; here we only dress the OUTER
  // ring with desk clutter, two hazards (spilled coffee + spilled soda) and nests.
  // The PvP economy prologue and mines/barricades are skipped for this key.
  patchAt(()=>({x:9+rnd()*(N-32),y:9+rnd()*(N-28),w:15+rnd()*6,h:12+rnd()*4,fill:'rgba(28,32,42,.5)',stroke:'rgba(10,12,18,.55)'})); // mouse pad
  patchAt(()=>({x:9+rnd()*(N-28),y:9+rnd()*(N-26),w:9+rnd()*3,h:12+rnd()*3,fill:'rgba(248,246,238,.92)',stroke:'rgba(150,150,138,.7)',inset:1})); // sheet of paper
  scatter('crumb',42,{x0:8,x1:N-8,y0:8,y1:N-8,s0:.68,sr:.7});
  scatter('paperclip',15,{x0:9,x1:N-9,y0:9,y1:N-9,s0:1.08,sr:.5,extra:r=>({a:r()*6.28})});
  scatter('sticky',11,{x0:9,x1:N-9,y0:9,y1:N-9,s0:1.22,sr:.5,extra:r=>({hue:[52,320,142,196][Math.floor(r()*4)]})});
  // v36: blocking desk clutter — 50% more pairs, 1.5x bigger (draw + collision via sc), pushed to the outer ring (rMax 30)
  propPairs('books',3,2.25,12,30,{sc:1.5});
  propPairs('keyboard',2,3.45,14,30,{sc:1.5});
  propPairs('chips',2,2.85,12,30,{sc:1.5});
  propPairs('eraser',2,1.35,10,30,{sc:1.5});
  lineProps('pencil',3,8+rnd()*2,.8,12,30,1.5);
  // --- hazards: spilled coffee (code 3) + spilled soda (code 2) ---
  // Placed on the four cardinal mid-lanes at radius ~16: clear of the carved arena
  // (~11) and of the diagonal corner economy pairs (~19), so both the field objects
  // AND their tiles survive survivalSetup's pruning and render out in the wave zone.
  const hz=(kind,baseAng,rx,ry)=>{   // v103: retry off a hazard of a different kind
   let px=0,py=0,got=false;
   for(let k2=0;k2<6&&!got;k2++){const a=baseAng+(rnd()-.5)*.36,rd=16+rnd()*1.6;
    px=c+dcos(a)*rd;py=c+dsin(a)*rd;got=farField(px,py,kind,rx,ry);}
   field(kind,px,py,rx,ry);};
  hz('coffee',-Math.PI/2,6,4);hz('coffee',Math.PI/2,6,4);     // v66: N & S are spilled coffee now (block)
  hz('soda',0,5.5,4);hz('soda',Math.PI,5.5,4);                // E & W: spilled soda (slow + sting)
  // ants raid the crumbs (two mirrored pairs)
  nestPairs('ant',2,5,4,8,16);
 }
 // ---- v66: roach dens (every map, Desk included) ----
 // Roaches were wave-survival-only until now. A mirrored pair of dens gives every
 // map one heavy neutral that has to be answered rather than walked past.
 nestPairs('roach',1,5,2,10,24);
 // ---- lane passes + hidden landmines + neutral barricade clusters ----
 // v35: Desk keeps only its curated hazards & nests (survivalSetup carves its own
 // arena). v66: the lane passes are PvP-only for the same reason - the Desk's
 // starts are rebuilt in the middle of the map, so its corner lanes mean nothing.
 /* v103 owner pass: Backyard Brawl lays fewer random clusters. It is the one map
    where the dark hedgehogs sit on bright grass, so the same density that reads as
    scattered cover on tile, carpet and sand read as clutter there - the owner's
    note names that map. The other three keep the count they have always had. */
 if(key!=='desk'){const lawn=key==='backyard';
  /* v107: a sided map lays its own lines (the compounds, in its block above). The
     corner-lane passes walk base-to-base pairs that on the Attic are TEAMMATES, so
     they would lay a pond and a roadblock between two allies inside one compound. */
  if(def.t2v2){mineField();barrCluster(3);}
  else{edgeClutter();mineField();barrCluster(lawn?3:7);laneBarr(lawn?[0.32,0.68]:[0.30,0.50,0.70]);}}
 // never block starts (clear passability AND any field hazards in a wide ring)
 for(const s of M.starts)for(let y=-5;y<=5;y++)for(let x=-5;x<=5;x++){const tx=s.x+x,ty=s.y+y;if(tx>=0&&ty>=0&&tx<N&&ty<N){M.pass[ty*N+tx]=1;M.fld[ty*N+tx]=0;}}
 // drop any field/nest objects that overlap a start so the visuals match the cleared tiles
 M.fields=M.fields.filter(f=>!M.starts.some(s=>dhyp(f.cx-s.x,f.cy-s.y)<Math.max(f.rx,f.ry)*1.4+5));
 M.nests=M.nests.filter(ns=>!M.starts.some(s=>dhyp(ns.x-s.x,ns.y-s.y)<ns.r+5));
 // v25: keep every expansion pocket open & hazard-free (buildable), mirroring the
 // start-clearing pass above; resource piles are re-blocked right below.
 for(const e of M.expos)for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++){
  if(x*x+y*y>11)continue;
  const tx=Math.floor(e.x)+x,ty=Math.floor(e.y)+y;
  if(tx>=0&&ty>=0&&tx<N&&ty<N){M.pass[ty*N+tx]=1;M.fld[ty*N+tx]=0;}
 }
 // clear nodes from start-clear pass (re-block)
 for(const nd of M.nodes)block(nd.x,nd.y,1);
 // SAFETY: ensure every resource node has a clear, hazard-free approach ring so
 // trucks can always path to it (a node must never sit inside water or be ringed by it).
 for(const nd of M.nodes){
  const nx=Math.floor(nd.x),ny=Math.floor(nd.y);
  for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){
   const tx=nx+ox,ty=ny+oy;if(tx<0||ty<0||tx>=N||ty>=N)continue;
   if(M.fld[ty*N+tx]===3){M.fld[ty*N+tx]=0;M.pass[ty*N+tx]=1;} // drain any water around a node
   else if(M.fld[ty*N+tx]&&Math.abs(ox)<=1&&Math.abs(oy)<=1)M.fld[ty*N+tx]=0; // clear slow/sand hazards immediately adjacent
  }
 }
 // shrink the stored water field shapes that we just drained near nodes, so the
 // rendered pond matches the (now passable) tiles — drop any field whose footprint
 // has been mostly carved away by node clearance.
 /* v67: dropping the OBJECT used to leave its tiles behind. renderTerrain draws
    only from M.fields, so a drained pond became invisible impassable ground:
    the same class of bug as the deleted lane pass, on a different path, worth
    up to 45 tiles on a bad Kitchen seed. Collect the drops rather than
    discarding them, then give back exactly the tiles they own. */
 const drained=[];
 M.fields=M.fields.filter(fl=>{
  if(fl.code!==3)return true;                 // v66: by CODE - milk/juice/coffee/puddle drain too
  let solid=0,tot=0;const ext=Math.max(fl.rx,fl.ry)*1.4;
  for(let y=Math.max(0,Math.floor(fl.cy-ext));y<=Math.min(N-1,fl.cy+ext);y++)for(let x=Math.max(0,Math.floor(fl.cx-ext));x<=Math.min(N-1,fl.cx+ext);x++){const ddx=x+.5-fl.cx,ddy=y+.5-fl.cy;const rm=blobRadius(fl.blob,datan2(ddy,ddx));const dx=ddx/(fl.rx*rm),dy=ddy/(fl.ry*rm);if(dx*dx+dy*dy<=1){tot++;if(M.fld[y*N+x]===3)solid++;}}
  const keep=(tot===0||solid/tot>0.4);        // keep ponds that are still mostly water
  if(!keep)drained.push(fl);
  return keep;
 });
 /* Hand back only what no SURVIVING liquid still covers: the per-map clusters are
    deliberately overlapping lobes and one lobe routinely outlives another. A tile
    whose fld is no longer 3 was already taken by the node or start passes, so it
    is skipped rather than fought over. sealPockets runs directly below and will
    re-close anything this opens into a dead end. */
 {const covers=(fl,x,y)=>{const ddx=x+.5-fl.cx,ddy=y+.5-fl.cy,rm=blobRadius(fl.blob,datan2(ddy,ddx));
   const dx=ddx/(fl.rx*rm),dy=ddy/(fl.ry*rm);return dx*dx+dy*dy<=1};
  for(const fl of drained)for(const i of (fl.blk||[])){
   if(M.fld[i]!==3)continue;
   const x=i%N,y=(i-x)/N;
   if(M.fields.some(s=>s.code===3&&covers(s,x,y)))continue;
   M.fld[i]=0;M.pass[i]=1;
  }
  for(const fl of M.fields)if(fl.blk)delete fl.blk;   // transient bookkeeping, never leaves makeMap
 }
 /* ---- v103: DROWNED PROPS ----
    A blocking prop is placed long before the hazards are stamped, so a pond laid
    on top of one leaves a rock standing in open water - "impassable level art
    spawns completely inside the impassable map hazard", named in the owner's map
    audit and measured at 53-158 props per 40 seeds on every map. Completely
    inside is the test, literally: every tile the prop took is a tile the liquid
    also took. Which is also why nothing has to be handed back - the v67 lesson
    (dropping the OBJECT must never leave its tiles behind) is satisfied here for
    free, because the liquid owns every one of them.
    IT STOPS AT CODE 3 ON PURPOSE, and a future session should not "finish the
    job" by extending it to the burn hazards. An impassable liquid is a hole in
    the ground and art standing in one is absurd; quicksand, thorns, glue, grease
    and spilled soda are GROUND, walkable and merely painful, so art standing on
    them is art standing on ground. Measured before extending it: the same rule
    over code 2 would delete 141 of the Sandbox's 1150 props over 40 seeds, 104 of
    them the bucket fortress's own walls and towers. The right answer there was to
    stop the pit landing on the castle (KEEP, above), not to delete the castle.
    Line props are exempt: they lay a capsule through blockLine rather than a
    disc, and a pencil with one end in a spill is not a pencil in a spill.
    The point mirror goes with it. A mirrored hazard drowns both halves of a
    mirrored pair by itself, but the un-mirrored liquids (the kiddie pool) do not,
    and an obstacle one army has and the other does not is a balance change
    smuggled in as a cosmetic fix. */
 {const propTiles=(p)=>{
   if(p.len)return null;                       // capsule, not a disc - see above
   const br=propBlkR(p.t,p.r,p.sc);if(br<=0)return null;
   const out=[],tx=Math.floor(p.x),ty=Math.floor(p.y);
   if(tx>=0&&ty>=0&&tx<N&&ty<N)out.push(ty*N+tx);
   for(let y=Math.floor(p.y-br);y<=p.y+br;y++)for(let x=Math.floor(p.x-br);x<=p.x+br;x++){
    if(x<0||y<0||x>=N||y>=N)continue;
    if(dhyp(x+.5-p.x,y+.5-p.y)<=br)out.push(y*N+x);}
   return out.length?out:null;};
  /* v103: the map's ANCHOR props are exempt. Each is a single prop the map is
     built around - the sandcastle keep, the cereal bowl, the coffee table the
     train ring runs around - and deleting one costs the map its centrepiece where
     deleting a rock costs it a rock. KEEP (above) is the belt: no hazard is laid
     over these in the first place. This is the braces, and it is not redundant -
     a cluster's SECOND lobe is placed relative to its first and can still reach
     ground the first one was steered away from. */
  const ANCHOR={keep:1,bowl:1,table:1};
  const drowned=p=>{if(ANCHOR[p.t])return false;const ts=propTiles(p);return !!ts&&ts.every(i=>M.fld[i]===3)};
  const gone=M.props.filter(drowned);
  if(gone.length){
   const isMirrorOfGone=p=>gone.some(g=>g.t===p.t&&Math.abs(g.x-(N-p.x))<1e-6&&Math.abs(g.y-(N-p.y))<1e-6);
   M.props=M.props.filter(p=>!drowned(p)&&!isMirrorOfGone(p));
  }}
 // ---- seal unreachable pockets ----
 // flood the passable area from the start tiles using the SAME 8-way + no-corner-cut
 // rule the pathfinder uses, then block any passable tile the flood never reaches.
 // this removes dead-end pockets and disconnected nooks (common around the Living
 // Room furniture & spills) so units can't path into, or get shoved into, a trap.
 (function sealPockets(){
  const reach=new Uint8Array(N*N),stack=[];
  const psbl=(x,y)=>x>=0&&y>=0&&x<N&&y<N&&M.pass[y*N+x]===1;
  for(const s of M.starts){const sx=Math.round(s.x),sy=Math.round(s.y);if(psbl(sx,sy)&&!reach[sy*N+sx]){reach[sy*N+sx]=1;stack.push(sx,sy);}}
  const DIR=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  while(stack.length){
   const y=stack.pop(),x=stack.pop();
   for(const [dx,dy] of DIR){
    const nx=x+dx,ny=y+dy;if(!psbl(nx,ny)||reach[ny*N+nx])continue;
    if(dx&&dy&&(!psbl(x+dx,y)||!psbl(x,y+dy)))continue; // no diagonal corner-cut (matches A*)
    reach[ny*N+nx]=1;stack.push(nx,ny);
   }
  }
  for(let i=0;i<N*N;i++)if(M.pass[i]===1&&!reach[i]){M.pass[i]=0;M.fld[i]=0;}
 })();
 /* ---- v103: GROUND COVER THAT THE FINISHED BOARD CONTRADICTS ----
    scatter() drops its decorations at a random point with no idea what will land
    on top of them, and nothing has ever pruned them: tufts float on ponds, crumbs
    hide under the sofa, cereal sits inside the bowl it spilled from. 100-334 per
    40 seeds on every map.
    This runs LAST, after sealPockets, because only then are pass and fld final.
    M.deco is ART ONLY - no decoration is in pass, in fld, in hashState or in any
    save - so this removes pixels and can change nothing else. */
 /* ---- v103: HAZARDS WITH NOTHING UNDER THEM ----
    A field OBJECT that owns no tile of its own code is art with no terrain
    behind it - the exact mirror of the v67 bug (tiles with no art), and it
    happens when a blob lands close enough to an expansion pocket that field()'s
    own nearExp guard skips every tile it would have stamped, after which the
    pocket-clearing pass wipes anything left. renderTerrain draws only from
    M.fields, so this is the one place that can stop a quicksand pit being
    painted over ground there is nothing wrong with. Runs after sealPockets,
    because sealPockets can zero fld too. */
 M.fields=M.fields.filter(fl=>{
  const ext=Math.max(fl.rx,fl.ry)*1.4;
  for(let y=Math.max(0,Math.floor(fl.cy-ext));y<=Math.min(N-1,fl.cy+ext);y++)
   for(let x=Math.max(0,Math.floor(fl.cx-ext));x<=Math.min(N-1,fl.cx+ext);x++)
    if(M.fld[y*N+x]===fl.code)return true;
  return false;
 });
 M.deco=M.deco.filter(d=>{const tx=Math.floor(d.x),ty=Math.floor(d.y);
  if(tx<0||ty<0||tx>=N||ty>=N)return false;
  return M.fld[ty*N+tx]!==3&&M.pass[ty*N+tx]===1;});
 return M;
}
function blockLine(M,x,y,len,ang,r){const cx=dcos(ang),cy=dsin(ang),R=Math.ceil(r),rr=(r+.5)*(r+.5),t0=-Math.max(.25,r),t1=len+Math.max(.25,r);for(let t=t0;t<=t1;t+=.34){const bx=Math.floor(x+cx*t),by=Math.floor(y+cy*t);for(let oy=-R;oy<=R;oy++)for(let ox=-R;ox<=R;ox++){if(ox*ox+oy*oy>rr)continue;const tx=bx+ox,ty=by+oy;if(tx>=0&&ty>=0&&tx<M.N&&ty<M.N)M.pass[ty*M.N+tx]=0}}} /* v36: dense 4-conn footprint over the full drawn extent (both stub ends), no diagonal gaps. v74: the stub overhang is a quarter tile, not .6, so a thin limb's ends do not outgrow its middle */

/* One ground tile of the isometric board, in five fills: the diamond body, the
   two upper facets that catch the key light, and the two lower ones that fall to
   shade. The bevel is what stops a flat diamond reading as a painted square and
   makes the surface look molded. renderTerrain bakes N*N of these into the
   terrain canvas and infoGround bakes 25 into the Field Manual's grass patch;
   the recipe was duplicated line-for-line between them until v62. Caller owns
   the tone: `col` is already shaded, and the facet alphas are fixed so every
   tile in the game catches the light the same way. */
function paintIsoTile(c,sx,sy,col){
 c.fillStyle=col;c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+HW,sy+HH);c.lineTo(sx,sy+TH);c.lineTo(sx-HW,sy+HH);c.closePath();c.fill();
 c.fillStyle='rgba(255,255,255,.10)';c.beginPath();c.moveTo(sx,sy);c.lineTo(sx-HW,sy+HH);c.lineTo(sx,sy+HH*.5);c.closePath();c.fill();
 c.fillStyle='rgba(255,255,255,.06)';c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+HW,sy+HH);c.lineTo(sx,sy+HH*.5);c.closePath();c.fill();
 c.fillStyle='rgba(14,22,10,.12)';c.beginPath();c.moveTo(sx,sy+TH);c.lineTo(sx+HW,sy+HH);c.lineTo(sx,sy+HH*1.5);c.closePath();c.fill();
 c.fillStyle='rgba(14,22,10,.06)';c.beginPath();c.moveTo(sx,sy+TH);c.lineTo(sx-HW,sy+HH);c.lineTo(sx,sy+HH*1.5);c.closePath();c.fill();
}
function renderTerrain(){
 const N=G.map.N;
 const w=N*TW+TW, h=N*TH+TH+72; // deeper south skirt so the board reads as a thick molded slab
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;const c=cv.getContext('2d');
 G.terr=cv;G.tctx=c;
 const th=G.map.theme, rnd=mulberry((G.map.seed||99)^0x9e37);
 // ---- palettes per theme (richer, multi-tone) ----
 const PAL=th==='grass'
   ?{base:'#5d9440',alt:'#558a38',edge:'#3a5e26',side:'#2f4d20',sideD:'#223a17'}
   :th==='tile'
   ?{base:'#d6dde1',alt:'#c2cace',edge:'#9aa3a8',side:'#aeb6bb',sideD:'#878f94'}
   :th==='carpet'
   ?{base:'#b6a890',alt:'#aca085',edge:'#857a62',side:'#968a70',sideD:'#776c54'}
   :th==='desk'
   ?{base:'#b98a4e',alt:'#ad7e42',edge:'#7c5528',side:'#8a6236',sideD:'#6b4a26'}
   :th==='bath'   // v107: porcelain tile, a shade cooler and brighter than the kitchen's
   ?{base:'#e6ecef',alt:'#d9e2e7',edge:'#9db1bd',side:'#b6c6cf',sideD:'#8ea3ae'}
   :th==='attic'  // v107: dusty floorboards
   ?{base:'#8c6a45',alt:'#805f3d',edge:'#4e3a22',side:'#5f4629',sideD:'#46331d'}
   :{base:'#ddbd7a',alt:'#d2af68',edge:'#a8884a',side:'#bfa066',sideD:'#9a7d48'};

 // ---- 1. south & east mat thickness: draw an extruded skirt so the whole
 //         board reads as a thick slab of molded plastic sitting on a table ----
 const matCorners=[[0,0],[N,0],[N,N],[0,N]].map(([x,y])=>[isoX(x,y),isoY(x,y)]);
 const E=matCorners[1],So=matCorners[2],Wp=matCorners[3];
 const DEPTH=46; // slab thickness in screen px
 // soft contact shadow cast onto the "table" below the slab
 (function(){const sg=c.createLinearGradient(0,So[1]+DEPTH,0,So[1]+DEPTH+26);sg.addColorStop(0,'rgba(0,0,0,.28)');sg.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=sg;
  c.beginPath();c.moveTo(Wp[0],Wp[1]+DEPTH);c.lineTo(So[0],So[1]+DEPTH+8);c.lineTo(E[0],E[1]+DEPTH);c.lineTo(E[0]+18,E[1]+DEPTH+18);c.lineTo(So[0],So[1]+DEPTH+30);c.lineTo(Wp[0]-18,Wp[1]+DEPTH+18);c.closePath();c.fill();})();
 // SW vertical face (west->south edge): catches a little fill light
 (function(){const g=c.createLinearGradient(0,Wp[1],0,Wp[1]+DEPTH);g.addColorStop(0,PAL.side);g.addColorStop(1,PAL.sideD);c.fillStyle=g;
  c.beginPath();c.moveTo(Wp[0],Wp[1]);c.lineTo(So[0],So[1]);c.lineTo(So[0],So[1]+DEPTH);c.lineTo(Wp[0],Wp[1]+DEPTH);c.closePath();c.fill();})();
 // SE vertical face (south->east edge): deeper shade
 (function(){const g=c.createLinearGradient(0,E[1],0,E[1]+DEPTH);g.addColorStop(0,PAL.sideD);g.addColorStop(1,shade(PAL.sideD,.72));c.fillStyle=g;
  c.beginPath();c.moveTo(So[0],So[1]);c.lineTo(E[0],E[1]);c.lineTo(E[0],E[1]+DEPTH);c.lineTo(So[0],So[1]+DEPTH);c.closePath();c.fill();})();
 // crisp molded corner seam at the south point + subtle vertical mold lines
 c.save();c.globalAlpha=.5;c.strokeStyle=shade(PAL.sideD,.6);c.lineWidth=1.2;c.beginPath();c.moveTo(So[0],So[1]);c.lineTo(So[0],So[1]+DEPTH);c.stroke();c.restore();
 c.save();c.globalAlpha=.16;c.strokeStyle='#000';c.lineWidth=1;
 for(let i=1;i<6;i++){const t=i/6;c.beginPath();c.moveTo(Wp[0]+(So[0]-Wp[0])*t,Wp[1]+(So[1]-Wp[1])*t);c.lineTo(Wp[0]+(So[0]-Wp[0])*t,Wp[1]+(So[1]-Wp[1])*t+DEPTH);c.stroke();
  c.beginPath();c.moveTo(So[0]+(E[0]-So[0])*t,So[1]+(E[1]-So[1])*t);c.lineTo(So[0]+(E[0]-So[0])*t,So[1]+(E[1]-So[1])*t+DEPTH);c.stroke();}c.restore();
 // beveled molded lip running along the top of the skirt (lit edge)
 c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,255,255,.22)';c.lineWidth=2;
 c.beginPath();c.moveTo(Wp[0],Wp[1]);c.lineTo(So[0],So[1]);c.lineTo(E[0],E[1]);c.stroke();c.restore();
 // worn chips along the molded lip: toy plastic scuffs where hands grab it
 c.save();c.globalCompositeOperation='lighter';
 for(let i=0;i<26;i++){const t=rnd(),onW=rnd()<.5;
  const x0=onW?Wp[0]+(So[0]-Wp[0])*t:So[0]+(E[0]-So[0])*t;
  const y0=onW?Wp[1]+(So[1]-Wp[1])*t:So[1]+(E[1]-So[1])*t;
  c.fillStyle='rgba(255,255,255,'+(0.10+rnd()*0.16).toFixed(3)+')';
  c.fillRect(x0,y0,1.5+rnd()*3,1+rnd()*1.4);}
 c.restore();

 // ---- 2. ground tiles. Each diamond gets a subtle raised-bevel so the surface
 //         reads as molded, plus per-tile tonal variation and theme features ----
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const sx=isoX(x,y),sy=isoY(x,y);
  let col;
  if(th==='grass'){const v=.92+rnd()*.16;col=shade(((x*7+y*5)%9<2)?PAL.alt:PAL.base,v);}
  else if(th==='tile'){const big=((x>>2)+(y>>2))%2;col=shade(big?PAL.alt:PAL.base,.97+rnd()*.06);}
  else{col=shade(PAL.base,.9+rnd()*.18);}
  paintIsoTile(c,sx,sy,col);
 }

 // ---- 2b. micro-detail: baked once into the terrain canvas, so density is
 //          free at runtime. Grass flock, tile speckle, carpet pile, sand grain.
 if(th==='grass'){
  for(let i=0;i<N*N*2;i++){const gx=rnd()*N,gy=rnd()*N,px=isoX(gx,gy),py=isoY(gx,gy)+HH;
   c.fillStyle=rnd()<.5?'rgba(214,240,150,.16)':'rgba(22,42,14,.18)';c.fillRect(px,py,1.4,1.4);}
  c.lineWidth=1.1;c.lineCap='round';
  for(let i=0;i<Math.floor(N*N*.14);i++){const gx=rnd()*N,gy=rnd()*N,px=isoX(gx,gy),py=isoY(gx,gy)+HH,s=.7+rnd()*.8;
   c.strokeStyle=rnd()<.5?'rgba(56,104,32,.5)':'rgba(126,188,74,.45)';
   c.beginPath();for(let k2=0;k2<3;k2++){const a=-1.57+(k2-1)*.55+(rnd()-.5)*.3;c.moveTo(px,py);c.lineTo(px+dcos(a)*5.5*s,py+dsin(a)*5.5*s);}c.stroke();}
 } else if(th==='tile'){
  for(let i=0;i<N*N;i++){const gx=rnd()*N,gy=rnd()*N,px=isoX(gx,gy),py=isoY(gx,gy)+HH;
   c.fillStyle=rnd()<.5?'rgba(255,255,255,.05)':'rgba(60,70,78,.05)';c.fillRect(px,py,1.6,1.6);}
 } else if(th==='carpet'){
  c.save();c.globalAlpha=.45;c.lineCap='round';c.lineWidth=1;
  for(let i=0;i<1800;i++){const gx=rnd()*N,gy=rnd()*N,px=isoX(gx,gy),py=isoY(gx,gy)+HH;
   const a=rnd()*6.28,l=1.5+rnd()*2.5;
   c.strokeStyle=rnd()<.5?'rgba(210,196,168,.6)':'rgba(96,86,64,.6)';
   c.beginPath();c.moveTo(px,py);c.lineTo(px+dcos(a)*l,py+dsin(a)*l*.5);c.stroke();}
  c.restore();
  c.save();c.globalAlpha=.35;for(let i=0;i<160;i++){const gx=rnd()*N,gy=rnd()*N;c.fillStyle='rgba(60,52,38,.5)';c.beginPath();c.ellipse(isoX(gx,gy),isoY(gx,gy)+HH,1.6,1,0,0,7);c.fill();}c.restore();
 } else if(th==='desk'){
  // v35: wood-grain streaks + speckle so the desktop reads as timber
  for(let i=0;i<N*N;i++){const gx=rnd()*N,gy=rnd()*N,px=isoX(gx,gy),py=isoY(gx,gy)+HH;
   c.fillStyle=rnd()<.5?'rgba(255,226,176,.12)':'rgba(96,64,32,.16)';c.fillRect(px,py,1.4,1.4);}
  c.save();c.globalAlpha=.16;c.strokeStyle='rgba(80,52,26,.9)';c.lineWidth=1;
  for(let i=0;i<Math.floor(N*1.6);i++){const gy=rnd()*N,gx0=rnd()*N*.4,len=6+rnd()*10;
   c.beginPath();c.moveTo(isoX(gx0,gy),isoY(gx0,gy)+HH);c.lineTo(isoX(gx0+len,gy+(rnd()-.5)*.5),isoY(gx0+len,gy+(rnd()-.5)*.5)+HH);c.stroke();}
  c.restore();
 } else {
  for(let i=0;i<N*N*2;i++){const gx=rnd()*N,gy=rnd()*N,px=isoX(gx,gy),py=isoY(gx,gy)+HH;
   c.fillStyle=rnd()<.5?'rgba(255,240,200,.14)':'rgba(120,90,44,.16)';c.fillRect(px,py,1.3,1.3);}
 }

 // ---- 3. theme regions ----
 if(G.map.sandPatch){const p=G.map.sandPatch;
  c.fillStyle='rgba(228,196,130,.92)';pathRegion(c,p);c.fill();
  c.strokeStyle='rgba(150,120,64,.5)';c.lineWidth=3;pathRegion(c,p);c.stroke();
  // raked rings
  c.strokeStyle='rgba(200,168,108,.5)';c.lineWidth=1.4;
  for(let i=1;i<4;i++){const cx=p.x+p.w/2,cy=p.y+p.h/2;c.beginPath();c.ellipse(isoX(cx,cy),isoY(cx,cy),(p.w*HW/2)*i/4,(p.w*HH/2)*i/4,0,0,7);c.stroke();}
 }
 if(G.map.board){const p=G.map.board;
  c.fillStyle='rgba(198,158,100,.96)';pathRegion(c,p);c.fill();
  c.strokeStyle='rgba(120,86,48,.85)';c.lineWidth=5;pathRegion(c,p);c.stroke();
  // wood grain planks
  c.strokeStyle='rgba(150,112,66,.5)';c.lineWidth=2;
  for(let i=1;i<6;i++){const yy=p.y+p.h*i/6;c.beginPath();c.moveTo(isoX(p.x,yy),isoY(p.x,yy));c.lineTo(isoX(p.x+p.w,yy),isoY(p.x+p.w,yy));c.stroke();}
  c.save();c.globalAlpha=.18;c.strokeStyle='rgba(90,60,30,.8)';c.lineWidth=1;
  for(let i=0;i<14;i++){const yy=p.y+rnd()*p.h;c.beginPath();c.moveTo(isoX(p.x,yy),isoY(p.x,yy));c.lineTo(isoX(p.x+p.w,yy+rnd()*.4),isoY(p.x+p.w,yy+rnd()*.4));c.stroke();}c.restore();
 }
 if(G.map.rug){const p=G.map.rug;
  // a patterned area rug under the coffee table (slate-blue field, cream/gold border)
  c.save();
  c.fillStyle='rgba(70,86,120,.84)';pathRegion(c,p);c.fill();
  c.strokeStyle='rgba(206,184,140,.9)';c.lineWidth=6;pathRegion(c,p);c.stroke();
  c.strokeStyle='rgba(40,50,76,.8)';c.lineWidth=2;pathRegion(c,p);c.stroke();
  const ins={x:p.x+1.6,y:p.y+1.6,w:p.w-3.2,h:p.h-3.2};
  c.strokeStyle='rgba(206,184,140,.7)';c.lineWidth=2;pathRegion(c,ins);c.stroke();
  // central medallion diamond
  const cx=p.x+p.w/2,cy=p.y+p.h/2;
  c.fillStyle='rgba(206,184,140,.45)';
  c.beginPath();c.moveTo(isoX(cx,cy-p.h*.22),isoY(cx,cy-p.h*.22));c.lineTo(isoX(cx+p.w*.18,cy),isoY(cx+p.w*.18,cy));c.lineTo(isoX(cx,cy+p.h*.22),isoY(cx,cy+p.h*.22));c.lineTo(isoX(cx-p.w*.18,cy),isoY(cx-p.w*.18,cy));c.closePath();c.fill();
  c.strokeStyle='rgba(40,50,76,.55)';c.lineWidth=1.5;c.stroke();
  c.restore();
 }
 if(th==='tile'){ // grout lines + sheen
  c.strokeStyle='rgba(110,120,128,.55)';c.lineWidth=2.4;
  for(let i=0;i<=N;i+=4){c.beginPath();c.moveTo(isoX(i,0),isoY(i,0));c.lineTo(isoX(i,N),isoY(i,N));c.stroke();c.beginPath();c.moveTo(isoX(0,i),isoY(0,i));c.lineTo(isoX(N,i),isoY(N,i));c.stroke();}
  // soft tile gloss in big diagonal sweeps
  c.save();c.globalCompositeOperation='lighter';c.globalAlpha=.05;c.fillStyle='#ffffff';
  /* v103: the same edge bug as the grass banding, and worse - this quad was
     eight tiles LONG and thirty screen-pixels wide, so the "big diagonal sweep"
     was a handful of slivers in the board's north corner. Full width, four tiles
     of gloss every eight. */
  for(let i=0;i<N;i+=8){const sx=isoX(0,i),sy=isoY(0,i);c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+HW*N,sy+HH*N);c.lineTo(sx+HW*N-HW*4,sy+HH*N+HH*4);c.lineTo(sx-HW*4,sy+HH*4);c.closePath();c.fill();}
  c.restore();
 }
 if(th==='grass'){ // mowed-stripe banding, like a lawn
  /* v103 THE "OFF COLOUR TILES ON ONE SIDE" DEFECT, and it is the same typo in
     three passes (here, the carpet below, and the kitchen's tile gloss above).
     A band started at tile (i,0) and ran N tiles in +x, which is a strip three
     tiles DEEP along one edge of the board - so every one of the 22 bands stacked
     into the same three rows and the other 61 rows of lawn got none. Starting at
     (0,i) is the whole fix: the band now runs the board's full width at depth i,
     which is what a mowed stripe is.
     The light/dark alternation was ((i>>1)%2), which alternates for a step of 2
     and this loop steps 3 - it gave doubled bands in an irregular rhythm. */
  c.save();c.globalAlpha=.05;
  for(let i=0;i<N;i+=3){c.fillStyle=((i/3)|0)%2?'#ffffff':'#000000';const sx=isoX(0,i),sy=isoY(0,i);c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+HW*N,sy+HH*N);c.lineTo(sx+HW*N-HW*3,sy+HH*N+HH*3);c.lineTo(sx-HW*3,sy+HH*3);c.closePath();c.fill();}
  c.restore();
 }
 if(th==='carpet'){ // plush pile: soft vacuum banding + dense short fibers
  // broad vacuum-stripe banding for depth
  c.save();c.globalAlpha=.04;
  for(let i=0;i<N;i+=4){c.fillStyle=(i>>2)%2?'#ffffff':'#000000';const sx=isoX(0,i),sy=isoY(0,i);c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+HW*N,sy+HH*N);c.lineTo(sx+HW*N-HW*4,sy+HH*N+HH*4);c.lineTo(sx-HW*4,sy+HH*4);c.closePath();c.fill();}   // v103: (0,i), not (i,0) - see the grass banding above
  c.restore();
  // tiny fiber flecks scattered across the whole mat (one-time bake, so density is fine)
  c.save();c.globalAlpha=.5;c.lineCap='round';c.lineWidth=1;
  for(let i=0;i<2600;i++){
   const gx=rnd()*N,gy=rnd()*N,sx=isoX(gx,gy),sy=isoY(gx,gy);
   const dx=(rnd()-.5)*3,dy=-1-rnd()*2;
   c.strokeStyle=rnd()<.5?'rgba(255,248,234,.5)':'rgba(92,82,62,.42)';
   c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+dx,sy+dy);c.stroke();
  }
  c.restore();
 }

 if(th==='bath'){ // v107: small porcelain tiles - a grout grid every two tiles, every other tile a shade bluer
  c.save();c.globalAlpha=.16;c.fillStyle='#bcd3e0';
  for(let ty=0;ty<N;ty+=2)for(let tx=((ty>>1)%2)*2;tx<N;tx+=4){
   c.beginPath();c.moveTo(isoX(tx,ty),isoY(tx,ty));c.lineTo(isoX(tx+2,ty),isoY(tx+2,ty));c.lineTo(isoX(tx+2,ty+2),isoY(tx+2,ty+2));c.lineTo(isoX(tx,ty+2),isoY(tx,ty+2));c.closePath();c.fill();}
  c.restore();
  c.strokeStyle='rgba(120,138,150,.5)';c.lineWidth=1.6;
  for(let i=0;i<=N;i+=2){c.beginPath();c.moveTo(isoX(i,0),isoY(i,0));c.lineTo(isoX(i,N),isoY(i,N));c.stroke();c.beginPath();c.moveTo(isoX(0,i),isoY(0,i));c.lineTo(isoX(N,i),isoY(N,i));c.stroke();}
  // a soft gloss sweep, full width, as the kitchen's (v103: (0,i), never (i,0))
  c.save();c.globalCompositeOperation='lighter';c.globalAlpha=.06;c.fillStyle='#ffffff';
  for(let i=0;i<N;i+=10){const sx=isoX(0,i),sy=isoY(0,i);c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+HW*N,sy+HH*N);c.lineTo(sx+HW*N-HW*4,sy+HH*N+HH*4);c.lineTo(sx-HW*4,sy+HH*4);c.closePath();c.fill();}
  c.restore();
 }
 if(th==='attic'){ // v107: floorboards running the board's x axis, two tiles wide, with staggered end joints and knots
  c.save();
  for(let i=0;i<N;i+=2){
   c.globalAlpha=.10;c.fillStyle=((i>>1)%3)===0?'#000000':((i>>1)%3)===1?'#ffffff':'#3a2810';
   c.beginPath();c.moveTo(isoX(0,i),isoY(0,i));c.lineTo(isoX(N,i),isoY(N,i));c.lineTo(isoX(N,i+2),isoY(N,i+2));c.lineTo(isoX(0,i+2),isoY(0,i+2));c.closePath();c.fill();
  }
  c.globalAlpha=1;c.strokeStyle='rgba(40,26,12,.55)';c.lineWidth=1.5;
  for(let i=0;i<=N;i+=2){c.beginPath();c.moveTo(isoX(0,i),isoY(0,i));c.lineTo(isoX(N,i),isoY(N,i));c.stroke();}
  // end joints, staggered board to board
  c.strokeStyle='rgba(40,26,12,.45)';c.lineWidth=1.2;
  for(let i=0;i<N;i+=2){const ph=((i*7)%11)/11*9;for(let x=ph;x<N;x+=9+((i>>1)%3)){c.beginPath();c.moveTo(isoX(x,i),isoY(x,i));c.lineTo(isoX(x,i+2),isoY(x,i+2));c.stroke();}}
  // knots and grain
  c.fillStyle='rgba(50,32,14,.35)';
  for(let i=0;i<70;i++){const gx=rnd()*N,gy=rnd()*N,sx=isoX(gx,gy),sy=isoY(gx,gy);c.beginPath();c.ellipse(sx,sy,3+rnd()*3,1.4+rnd()*1.2,.3,0,7);c.fill();}
  c.strokeStyle='rgba(60,40,18,.16)';c.lineWidth=1;
  for(let i=0;i<260;i++){const gx=rnd()*N,gy=rnd()*N,ln=2+rnd()*5;c.beginPath();c.moveTo(isoX(gx,gy),isoY(gx,gy));c.lineTo(isoX(gx+ln,gy+rnd()*.2),isoY(gx+ln,gy+rnd()*.2));c.stroke();}
  c.restore();
 }

 // ---- 3b. v25 themed set-pieces (picnic blanket / moat / train track / open book / board veggies) ----
 if(G.map.blanket){const p=G.map.blanket;const hue=p.hue!=null?p.hue:4;
  c.save();
  c.fillStyle=`hsla(${hue},62%,52%,.85)`;pathRegion(c,p);c.fill();
  c.fillStyle='rgba(250,246,238,.8)';
  for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){if((x+y)%2)continue;const wx=p.x+x,wy=p.y+y;
   c.beginPath();c.moveTo(isoX(wx,wy),isoY(wx,wy));c.lineTo(isoX(wx+1,wy),isoY(wx+1,wy));c.lineTo(isoX(wx+1,wy+1),isoY(wx+1,wy+1));c.lineTo(isoX(wx,wy+1),isoY(wx,wy+1));c.closePath();c.fill();}
  c.strokeStyle=`hsla(${hue},55%,34%,.9)`;c.lineWidth=3;pathRegion(c,p);c.stroke();
  c.setLineDash([4,4]);c.strokeStyle='rgba(255,255,255,.6)';c.lineWidth=1.2;pathRegion(c,{x:p.x+.4,y:p.y+.4,w:p.w-.8,h:p.h-.8});c.stroke();c.setLineDash([]);
  // a paper plate with a sandwich, plus scattered crumbs
  {const px2=isoX(p.x+p.w*.5,p.y+p.h*.45),py2=isoY(p.x+p.w*.5,p.y+p.h*.45);
   c.fillStyle='#f6f6f0';c.beginPath();c.ellipse(px2,py2,16,7,0,0,7);c.fill();
   c.fillStyle='#e8c988';c.beginPath();c.moveTo(px2-9,py2-2);c.lineTo(px2+9,py2-2);c.lineTo(px2,py2-11);c.closePath();c.fill();
   c.fillStyle='#3f8a2c';c.fillRect(px2-8,py2-3,16,1.6);
   c.fillStyle='#c4965a';for(let i=0;i<7;i++){c.beginPath();c.arc(px2+(rnd()-.5)*40,py2+8+(rnd()-.5)*12,1.4,0,7);c.fill();}}
  c.restore();
 }
 if(G.map.tub){const tb=G.map.tub; // v107: the drained tub's floor - the rim is props. The oval is rotated in WORLD space, so it is walked as a polygon rather than drawn as a screen ellipse
  const cx2=isoX(tb.cx,tb.cy),cy2=isoY(tb.cx,tb.cy),ct=dcos(tb.th||0),st=dsin(tb.th||0);
  const tubPath=(k)=>{c.beginPath();for(let i=0;i<=48;i++){const a=i/48*6.283,u=tb.rx*k*dcos(a),v=tb.ry*k*dsin(a);const wx=tb.cx+u*ct-v*st,wy=tb.cy+u*st+v*ct;i?c.lineTo(isoX(wx,wy),isoY(wx,wy)):c.moveTo(isoX(wx,wy),isoY(wx,wy));}c.closePath();};
  c.save();
  const g=c.createRadialGradient(cx2-30,cy2-24,4,cx2,cy2,tb.rx*1.414*HW);g.addColorStop(0,'#f8fafb');g.addColorStop(.6,'#e4ebef');g.addColorStop(1,'#c3d0d8');
  c.fillStyle=g;tubPath(.97);c.fill();
  c.strokeStyle='rgba(130,150,162,.55)';c.lineWidth=3;tubPath(.91);c.stroke(); // the tide line
  c.strokeStyle='rgba(150,170,182,.3)';c.lineWidth=1.4;tubPath(.8);c.stroke();
  // the drain, off-centre, with its chrome plug on a chain
  {const da=tb.drainA||1,dwx=tb.cx+dcos(da)*tb.rx*.28,dwy=tb.cy+dsin(da)*tb.ry*.28,dx2=isoX(dwx,dwy),dy2=isoY(dwx,dwy);
   c.fillStyle='#8c9ba6';c.beginPath();c.ellipse(dx2,dy2,8,4.6,0,0,7);c.fill();
   c.fillStyle='#2c3238';c.beginPath();c.ellipse(dx2,dy2,5.6,3.1,0,0,7);c.fill();
   c.strokeStyle='#dfe6ea';c.lineWidth=1.2;for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(dx2-4+i*.6,dy2+i*1.6);c.lineTo(dx2+4+i*.6,dy2+i*1.6);c.stroke();}
   c.strokeStyle='#b9c4cc';c.lineWidth=1.6;c.setLineDash([2,2]);c.beginPath();c.moveTo(dx2+6,dy2-2);c.quadraticCurveTo(dx2+18,dy2-10,dx2+26,dy2-4);c.stroke();c.setLineDash([]);
   c.fillStyle='#d8dfe4';c.beginPath();c.ellipse(dx2+27,dy2-3,4.5,2.6,0,0,7);c.fill();glint(c,dx2+25.5,dy2-4,1.4);}
  c.restore();
 }
 if(G.map.mat){const p=G.map.mat;const hue=p.hue!=null?p.hue:200; // v107: the bath mat - a fluffy rectangle with a fringe
  c.save();
  c.fillStyle=`hsla(${hue},40%,62%,.92)`;pathRegion(c,p);c.fill();
  c.strokeStyle=`hsla(${hue},38%,42%,.9)`;c.lineWidth=2.4;pathRegion(c,p);c.stroke();
  c.save();pathRegion(c,p);c.clip();c.lineCap='round';c.lineWidth=1.4;
  for(let i=0;i<p.w*p.h*4;i++){const wx=p.x+rnd()*p.w,wy=p.y+rnd()*p.h,sx=isoX(wx,wy),sy=isoY(wx,wy);
   c.strokeStyle=rnd()<.5?`hsla(${hue},45%,80%,.55)`:`hsla(${hue},40%,44%,.4)`;
   c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+(rnd()-.5)*3,sy-2-rnd()*2.5);c.stroke();}
  c.restore();
  c.strokeStyle=`hsla(${hue},30%,88%,.85)`;c.lineWidth=1.2;
  for(let x=0;x<=p.w;x+=.5){for(const yy of [p.y,p.y+p.h]){const sx=isoX(p.x+x,yy),sy=isoY(p.x+x,yy),dy=yy===p.y?-1:1;c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+dy*2,sy+dy*4);c.stroke();}}
  c.restore();
 }
 if(G.map.moat){const mo=G.map.moat;
  c.save();c.lineCap='round';
  const seg=a=>{const wx=mo.cx+dcos(a)*mo.r,wy=mo.cy+dsin(a)*mo.r;return [isoX(wx,wy),isoY(wx,wy)]};
  const gate=a2=>{for(let k2=0;k2<4;k2++){let d2=Math.abs(a2-k2*Math.PI/2);d2=Math.min(d2,Math.PI*2-d2);if(d2<.34)return true}return false};
  for(let a=0;a<Math.PI*2;a+=.05){
   if(gate(a)||gate(a+.05))continue;
   const s1=seg(a),s2=seg(a+.05);
   c.strokeStyle='rgba(120,92,48,.4)';c.lineWidth=13;c.beginPath();c.moveTo(s1[0],s1[1]);c.lineTo(s2[0],s2[1]);c.stroke();
   c.strokeStyle='rgba(88,66,34,.35)';c.lineWidth=6;c.beginPath();c.moveTo(s1[0],s1[1]+1);c.lineTo(s2[0],s2[1]+1);c.stroke();
  }
  c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,244,220,.25)';
  for(let i=0;i<40;i++){const a=rnd()*6.28;if(gate(a))continue;const wx=mo.cx+dcos(a)*(mo.r+(rnd()-.5)*.8),wy=mo.cy+dsin(a)*(mo.r+(rnd()-.5)*.8);
   c.fillRect(isoX(wx,wy),isoY(wx,wy),1.6,1.2);}
  c.restore();
 }
 if(G.map.track){const tr=G.map.track;
  c.save();c.lineCap='round';
  const pt=(a,off)=>{const wx=tr.cx+dcos(a)*(tr.rx+off),wy=tr.cy+dsin(a)*(tr.ry+off*(tr.ry/tr.rx));return [isoX(wx,wy),isoY(wx,wy)]};
  c.strokeStyle='rgba(110,77,44,.85)';c.lineWidth=4;
  for(let a=0;a<Math.PI*2;a+=.16){const s1=pt(a,-.45),s2=pt(a,.45);c.beginPath();c.moveTo(s1[0],s1[1]);c.lineTo(s2[0],s2[1]);c.stroke();}
  for(const off of [-0.26,0.26]){
   c.strokeStyle='#4a3018';c.lineWidth=2.6;c.beginPath();
   for(let i=0;i<=72;i++){const a=i/72*Math.PI*2;const s1=pt(a,off);i?c.lineTo(s1[0],s1[1]):c.moveTo(s1[0],s1[1])}c.closePath();c.stroke();
   c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,220,170,.25)';c.lineWidth=1;c.beginPath();
   for(let i=0;i<=72;i++){const a=i/72*Math.PI*2;const s1=pt(a,off);i?c.lineTo(s1[0],s1[1]-1):c.moveTo(s1[0],s1[1]-1)}c.closePath();c.stroke();c.restore();
  }
  c.restore();
 }
 if(G.map.bookOpen){const p=G.map.bookOpen;const hue=p.hue!=null?p.hue:200;
  c.save();
  c.fillStyle=`hsla(${hue},58%,38%,.95)`;pathRegion(c,{x:p.x-.4,y:p.y-.4,w:p.w+.8,h:p.h+.8});c.fill();
  const midx=p.x+p.w/2;
  c.fillStyle='rgba(250,247,238,.96)';pathRegion(c,{x:p.x,y:p.y,w:p.w/2-.15,h:p.h});c.fill();pathRegion(c,{x:midx+.15,y:p.y,w:p.w/2-.15,h:p.h});c.fill();
  const g=c.createLinearGradient(isoX(midx-1,p.y+p.h/2),isoY(midx-1,p.y+p.h/2),isoX(midx+1,p.y+p.h/2),isoY(midx+1,p.y+p.h/2));
  g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.5,'rgba(60,50,30,.35)');g.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=g;pathRegion(c,{x:midx-1,y:p.y,w:2,h:p.h});c.fill();
  // left page: crayon sun over hills; right page: a little house
  {const sx2=isoX(p.x+p.w*.25,p.y+p.h*.32),sy2=isoY(p.x+p.w*.25,p.y+p.h*.32);
   c.fillStyle='#ffd23f';c.beginPath();c.arc(sx2,sy2,7,0,7);c.fill();
   c.strokeStyle='#ffd23f';c.lineWidth=1.6;for(let i=0;i<8;i++){const a=i/8*6.28;c.beginPath();c.moveTo(sx2+Math.cos(a)*9,sy2+Math.sin(a)*9);c.lineTo(sx2+Math.cos(a)*13,sy2+Math.sin(a)*13);c.stroke();}
   const hx=isoX(p.x+p.w*.25,p.y+p.h*.72),hy=isoY(p.x+p.w*.25,p.y+p.h*.72);
   c.strokeStyle='#3f8a2c';c.lineWidth=3;c.beginPath();c.moveTo(hx-22,hy+2);c.quadraticCurveTo(hx-6,hy-9,hx+8,hy+2);c.quadraticCurveTo(hx+16,hy-5,hx+26,hy+2);c.stroke();}
  {const hx=isoX(p.x+p.w*.74,p.y+p.h*.5),hy=isoY(p.x+p.w*.74,p.y+p.h*.5);
   c.fillStyle='#e2483e';c.beginPath();c.moveTo(hx-12,hy-4);c.lineTo(hx,hy-14);c.lineTo(hx+12,hy-4);c.closePath();c.fill();
   c.fillStyle='#e8c988';c.fillRect(hx-9,hy-4,18,12);
   c.fillStyle='#5a9ad8';c.fillRect(hx-5.5,hy-1,4,4);c.fillStyle='#6e4d2c';c.fillRect(hx+2,hy,4,8);}
  c.strokeStyle='rgba(120,120,140,.18)';c.lineWidth=1;
  for(let i=1;i<4;i++){const yy=p.y+p.h*i/4;
   c.beginPath();c.moveTo(isoX(p.x+.6,yy),isoY(p.x+.6,yy));c.lineTo(isoX(midx-.6,yy),isoY(midx-.6,yy));c.stroke();
   c.beginPath();c.moveTo(isoX(midx+.6,yy),isoY(midx+.6,yy));c.lineTo(isoX(p.x+p.w-.6,yy),isoY(p.x+p.w-.6,yy));c.stroke();}
  c.restore();
 }
 if(G.map.board&&th==='tile'){const p=G.map.board;
  c.save();
  const vx=(u,v)=>[isoX(p.x+p.w*u,p.y+p.h*v),isoY(p.x+p.w*u,p.y+p.h*v)];
  for(const uv of [[.2,.3],[.28,.5],[.18,.66]]){const x=vx(uv[0],uv[1])[0],y=vx(uv[0],uv[1])[1];
   c.fillStyle='#e2483e';c.beginPath();c.ellipse(x,y,9,4.5,0,0,7);c.fill();
   c.fillStyle='#ff8a76';c.beginPath();c.ellipse(x,y,6.4,3.1,0,0,7);c.fill();
   c.fillStyle='#ffd2c2';for(let i=0;i<5;i++){const a=i/5*6.28;c.beginPath();c.ellipse(x+Math.cos(a)*3.4,y+Math.sin(a)*1.6,1.4,.8,a,0,7);c.fill();}}
  for(const uv of [[.62,.28],[.7,.44]]){const x=vx(uv[0],uv[1])[0],y=vx(uv[0],uv[1])[1];
   c.fillStyle='#3f8a2c';c.beginPath();c.ellipse(x,y,7,3.4,0,0,7);c.fill();
   c.fillStyle='#c8e8a8';c.beginPath();c.ellipse(x,y,5.4,2.5,0,0,7);c.fill();
   c.fillStyle='#e8f4d0';c.beginPath();c.ellipse(x,y,2.2,1,0,0,7);c.fill();}
  {const x=vx(.55,.78)[0],y=vx(.55,.78)[1];
   c.save();c.translate(x,y);c.rotate(.18);
   const g=c.createLinearGradient(0,-3,0,3);g.addColorStop(0,'#f0f4f8');g.addColorStop(.5,'#c4c8ce');g.addColorStop(1,'#9aa0a8');
   c.fillStyle=g;c.beginPath();c.moveTo(0,-3);c.lineTo(34,-2);c.quadraticCurveTo(42,0,34,3);c.lineTo(0,3);c.closePath();c.fill();
   c.fillStyle='#23262b';rr(c,-16,-3.4,16,7,3);c.fill();
   c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.5)';c.fillRect(2,-1.6,30,1.2);c.restore();
   c.restore();}
  c.restore();
 }

 // ---- 4. flat patches (dirt, wet sand, napkin) ----
 for(const p of (G.map.patches||[])){
  c.fillStyle=p.fill;pathRegion(c,p);c.fill();
  if(p.stroke){c.strokeStyle=p.stroke;c.lineWidth=3;pathRegion(c,p);c.stroke();}
  if(p.inset){c.strokeStyle=p.stroke;c.lineWidth=1.5;pathRegion(c,{x:p.x+1.2,y:p.y+1.2,w:p.w-2.4,h:p.h-2.4});c.stroke();}
 }

 // ---- 5. puddles / spills (glossy, impassable) ----
 for(const p of (G.map.puddles||[])){
  const sx=isoX(p.x,p.y),sy=isoY(p.x,p.y),a=p.r*1.42*HW,b2=p.r*1.42*HH;
  let edge,body1,body2,spec;
  if(p.col==='milk'){edge='rgba(168,173,182,.85)';body1='#edeff3';body2='#c9cfd9';spec='rgba(255,255,255,.34)';}   // v103 owner pass: as the milk FIELD above - it was pure white with a 70% white specular
  else if(p.col==='juice'){edge='rgba(150,80,10,.5)';body1='#ffb14e';body2='#e07c1a';spec='rgba(255,240,200,.6)';}
  else{edge='rgba(36,66,40,.55)';body1='#7fd0ee';body2='#3a7a9c';spec='rgba(220,250,255,.7)';}
  // damp halo
  c.fillStyle=edge;c.beginPath();c.ellipse(sx,sy,a+6,b2+4,0,0,7);c.fill();
  c.beginPath();c.ellipse(sx+a*.55,sy+b2*.3,a*.5,b2*.45,.3,0,7);c.fill();
  const g=c.createRadialGradient(sx-a*.3,sy-b2*.4,2,sx,sy,a);g.addColorStop(0,body1);g.addColorStop(1,body2);
  c.fillStyle=g;c.beginPath();c.ellipse(sx,sy,a,b2,0,0,7);c.fill();
  c.fillStyle=body2;c.beginPath();c.ellipse(sx+a*.55,sy+b2*.3,a*.42,b2*.36,.3,0,7);c.fill();
  // bright sky-reflection streak
  c.save();c.globalCompositeOperation='lighter';c.fillStyle=spec;c.beginPath();c.ellipse(sx-a*.32,sy-b2*.35,a*.34,b2*.2,-.4,0,7);c.fill();c.restore();
 }

 // ---- 5b. terrain HAZARD FIELDS (burn zones / impassable liquids) ----
 // each is an iso ellipse; we approximate the iso projection of a world-space
 // ellipse by sampling its rim and stroking/filling the resulting screen polygon.
 // each field is an irregular blob; we project a world-space wobbly rim into iso
 // screen space and stroke/fill it. fl.blob holds per-angle radius multipliers.
 // organic blob path: scale shrinks the whole shape (for inner ripple rings), pad
 // grows the base radius by a flat tile amount (for the dark rim).
 const isoFieldPath=(fl,scale,pad)=>{
  scale=scale==null?1:scale;pad=pad||0;c.beginPath();
  const SEG=36;
  for(let i=0;i<=SEG;i++){const a=i/SEG*6.283;const rm=blobRadius(fl.blob,a);
   const wx=fl.cx+dcos(a)*((fl.rx*rm+pad)*scale),wy=fl.cy+dsin(a)*((fl.ry*rm+pad)*scale);
   const px=isoX(wx,wy),py=isoY(wx,wy);i?c.lineTo(px,py):c.moveTo(px,py);}
  c.closePath();
 };
 // v66: hazard palettes. GOO drives the code-2 painter, LIQ the code-3 pool
 // painter; `water` and `puddle` keep the bespoke pond branch below. A new themed
 // hazard is a row here plus a row in makeMap's FLD, and nothing else.
 const GOO={soda:{rim:'rgba(58,30,16,.5)',g0:'#37190d',g1:'#5c2f16',g2:'#8a4e22',fleck:'rgba(220,180,130,.5)',sheen:'rgba(255,208,150,.3)'},
            grease:{rim:'rgba(64,48,14,.5)',g0:'#5a4a12',g1:'#8a7220',g2:'#c2a63c',fleck:'rgba(255,238,178,.45)',sheen:'rgba(255,244,190,.34)'},
            glue:{rim:'rgba(46,54,66,.45)',g0:'#d8dee6',g1:'#eef2f6',g2:'#fbfdff',fleck:'rgba(150,170,195,.4)',sheen:'rgba(255,255,255,.42)'},
            // v107: lavender suds on the bathroom tile, and the attic's burst bale of pink fibreglass
            soap:{rim:'rgba(140,128,156,.5)',g0:'#f6f0f8',g1:'#e4d6ec',g2:'#c9b5d6',fleck:'rgba(255,255,255,.75)',sheen:'rgba(255,255,255,.45)'},
            insulation:{rim:'rgba(120,56,80,.5)',g0:'#f3a9c3',g1:'#e07fa4',g2:'#c25a86',fleck:'rgba(255,228,240,.6)',sheen:'rgba(255,220,236,.3)'}};
 /* v103 owner pass: the milk spill was PURE WHITE at the top of its ramp with a
    50% white sheen on top of that, on a #d6dde1 tile floor - so it clipped to a
    flat shape with no surface on it at all, brighter than anything else on the
    board. Read in a real frame beside the grease slick, which shows its gradient,
    its rim and its flecks. The ramp comes down to a cream, the rim darkens enough
    to draw the edge, and the sheen is a streak rather than a wash. Milk is the
    Kitchen's alone - juice and coffee are untouched. */
 const LIQ={milk:{rim:'rgba(104,110,120,.62)',g0:'#eef0f4',g1:'#dde1e8',g2:'#bcc3cf',ring:'rgba(132,140,154,.34)',sheen:'rgba(255,255,255,.26)'},
            juice:{rim:'rgba(38,10,42,.6)',g0:'#a84fc0',g1:'#7a2a92',g2:'#4c1560',ring:'rgba(226,170,240,.22)',sheen:'rgba(240,190,250,.42)'},
            coffee:{rim:'rgba(26,14,6,.6)',g0:'#7a4a26',g1:'#4e2c14',g2:'#2a170a',ring:'rgba(196,150,104,.22)',sheen:'rgba(224,186,140,.34)'},
            // v107: soapy bathwater on the tile, and rainwater from the attic's roof leak
            bathwater:{rim:'rgba(88,118,138,.58)',g0:'#dcedf5',g1:'#a8d0e6',g2:'#74accb',ring:'rgba(255,255,255,.34)',sheen:'rgba(255,255,255,.42)'},
            leak:{rim:'rgba(28,24,18,.62)',g0:'#736a5a',g1:'#4c4437',g2:'#2b261e',ring:'rgba(200,190,170,.18)',sheen:'rgba(222,212,192,.3)'}};
 for(const fl of (G.map.fields||[])){
  if(fl.kind==='water'||fl.kind==='puddle'){ // v66: a garden rain puddle is water, drawn as water
   // recessed pool: dark rim, gradient body, sky glints, ripple rings
   isoFieldPath(fl,1,.4);c.fillStyle='rgba(30,52,40,.6)';c.fill();
   const cxs=isoX(fl.cx,fl.cy),cys=isoY(fl.cx,fl.cy);
   const wg=c.createRadialGradient(cxs-fl.rx*HW*.3,cys-fl.ry*HH*.4,2,cxs,cys,fl.rx*TW*.5);
   wg.addColorStop(0,'#9fdcef');wg.addColorStop(.5,'#5aa8c8');wg.addColorStop(1,'#2f6f8c');
   isoFieldPath(fl);c.fillStyle=wg;c.fill();
   // ripple rings
   c.save();isoFieldPath(fl);c.clip();c.strokeStyle='rgba(255,255,255,.18)';c.lineWidth=1.2;
   for(let i=1;i<4;i++){isoFieldPath(fl,i/4);c.stroke();}c.restore();
   // sky-reflection streak
   c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(220,250,255,.5)';c.beginPath();c.ellipse(cxs-fl.rx*HW*.25,cys-fl.ry*HH*.3,fl.rx*HW*.4,fl.ry*HH*.22,-.4,0,7);c.fill();c.restore();
  } else if(fl.kind==='sand'){
   // sunken sand/quicksand: tan body with concentric pull rings and dark center
   isoFieldPath(fl,1,.3);c.fillStyle='rgba(120,92,48,.5)';c.fill();
   const cxs=isoX(fl.cx,fl.cy),cys=isoY(fl.cx,fl.cy);
   const sg=c.createRadialGradient(cxs,cys,2,cxs,cys,fl.rx*TW*.5);
   sg.addColorStop(0,'#9c7842');sg.addColorStop(.6,'#c19a5c');sg.addColorStop(1,'#d8b878');
   isoFieldPath(fl);c.fillStyle=sg;c.fill();
   c.save();isoFieldPath(fl);c.clip();
   c.strokeStyle='rgba(110,80,40,.45)';c.lineWidth=1.3;for(let i=1;i<5;i++){isoFieldPath(fl,i/5);c.stroke();}
   // a few sinking pebbles
   for(let i=0;i<6;i++){const a=rnd()*6.28,rr2=rnd()*.7;const px=isoX(fl.cx+dcos(a)*fl.rx*rr2,fl.cy+dsin(a)*fl.ry*rr2),py=isoY(fl.cx+dcos(a)*fl.rx*rr2,fl.cy+dsin(a)*fl.ry*rr2);c.fillStyle='rgba(80,58,30,.5)';c.beginPath();c.ellipse(px,py,2,1.1,0,0,7);c.fill();}
   c.restore();
  } else if(GOO[fl.kind]){
   // v66: every code-2 goo hazard through ONE painter over a palette. soda's six
   // numbers are the v35 originals, so the Desk's art is unchanged by the merge.
   const P=GOO[fl.kind];
   isoFieldPath(fl,1,.3);c.fillStyle=P.rim;c.fill();
   const cxs=isoX(fl.cx,fl.cy),cys=isoY(fl.cx,fl.cy);
   const sg=c.createRadialGradient(cxs,cys,2,cxs,cys,fl.rx*TW*.5);
   sg.addColorStop(0,P.g0);sg.addColorStop(.6,P.g1);sg.addColorStop(1,P.g2);
   isoFieldPath(fl);c.fillStyle=sg;c.fill();
   c.save();isoFieldPath(fl);c.clip();
   for(let i=0;i<12;i++){const a=rnd()*6.28,rr2=Math.sqrt(rnd())*.86;const bx2=isoX(fl.cx+dcos(a)*fl.rx*rr2,fl.cy+dsin(a)*fl.ry*rr2),by2=isoY(fl.cx+dcos(a)*fl.rx*rr2,fl.cy+dsin(a)*fl.ry*rr2);c.fillStyle=P.fleck;c.beginPath();c.arc(bx2,by2,1+rnd()*1.5,0,7);c.fill();}
   c.globalCompositeOperation='lighter';c.fillStyle=P.sheen;c.beginPath();c.ellipse(cxs-fl.rx*HW*.22,cys-fl.ry*HH*.26,fl.rx*HW*.32,fl.ry*HH*.17,-.4,0,7);c.fill();
   c.restore();
  } else if(LIQ[fl.kind]){
   // v66: milk / grape juice / coffee. Same recessed-pool construction as water
   // (dark rim, radial body, ripple rings, a sheen streak), different liquid.
   const P=LIQ[fl.kind];
   isoFieldPath(fl,1,.4);c.fillStyle=P.rim;c.fill();
   const cxs=isoX(fl.cx,fl.cy),cys=isoY(fl.cx,fl.cy);
   const wg=c.createRadialGradient(cxs-fl.rx*HW*.3,cys-fl.ry*HH*.4,2,cxs,cys,fl.rx*TW*.5);
   wg.addColorStop(0,P.g0);wg.addColorStop(.5,P.g1);wg.addColorStop(1,P.g2);
   isoFieldPath(fl);c.fillStyle=wg;c.fill();
   c.save();isoFieldPath(fl);c.clip();c.strokeStyle=P.ring;c.lineWidth=1.2;
   for(let i=1;i<4;i++){isoFieldPath(fl,i/4);c.stroke();}c.restore();
   c.save();c.globalCompositeOperation='lighter';c.fillStyle=P.sheen;c.beginPath();c.ellipse(cxs-fl.rx*HW*.25,cys-fl.ry*HH*.3,fl.rx*HW*.4,fl.ry*HH*.22,-.4,0,7);c.fill();c.restore();
  } else if(fl.kind==='thorns'){
   // v66: a bramble patch. Dry earth floor, then a tangle of crossed spines with
   // pale tips and a few dark berries. Code 2, so it slows and pricks like sand.
   isoFieldPath(fl,1,.3);c.fillStyle='rgba(38,30,16,.45)';c.fill();
   isoFieldPath(fl);c.fillStyle='rgba(74,66,34,.55)';c.fill();
   c.save();isoFieldPath(fl);c.clip();
   for(let i=0;i<Math.floor(fl.rx*fl.ry*2.2);i++){
    const a=rnd()*6.28,rr2=Math.sqrt(rnd());const wx=fl.cx+dcos(a)*fl.rx*rr2,wy=fl.cy+dsin(a)*fl.ry*rr2;
    const px=isoX(wx,wy),py=isoY(wx,wy);const ln=5+rnd()*7,sa=rnd()*6.28;
    c.strokeStyle=rnd()<.5?'#39511f':'#4d6b2a';c.lineWidth=1.5;c.lineCap='round';
    c.beginPath();c.moveTo(px,py);c.lineTo(px+Math.cos(sa)*ln,py+Math.sin(sa)*ln*.6);c.stroke();
    // a spine off the cane, tipped pale so the tangle reads as thorny
    c.strokeStyle='rgba(226,214,178,.8)';c.lineWidth=1;
    c.beginPath();c.moveTo(px+Math.cos(sa)*ln*.6,py+Math.sin(sa)*ln*.6*.6);c.lineTo(px+Math.cos(sa+1.1)*ln*.85,py+Math.sin(sa+1.1)*ln*.5);c.stroke();
   }
   for(let i=0;i<7;i++){const a=rnd()*6.28,rr2=Math.sqrt(rnd())*.8;
    const px=isoX(fl.cx+dcos(a)*fl.rx*rr2,fl.cy+dsin(a)*fl.ry*rr2),py=isoY(fl.cx+dcos(a)*fl.rx*rr2,fl.cy+dsin(a)*fl.ry*rr2);
    c.fillStyle='rgba(74,20,42,.85)';c.beginPath();c.arc(px,py-2,1.7,0,7);c.fill();}
   c.restore();
  }
 }

 // ---- 5c. v25: the backyard kiddie pool (tiles under it are real water) ----
 if(G.map.kpool){const kp=G.map.kpool;
  const cx2=isoX(kp.cx,kp.cy),cy2=isoY(kp.cx,kp.cy);
  const RX=r=>r*1.414*HW, RY=r=>r*1.414*HH;
  c.fillStyle='rgba(36,66,40,.35)';c.beginPath();c.ellipse(cx2,cy2,RX(kp.r+.8),RY(kp.r+.8),0,0,7);c.fill();
  const wg=c.createRadialGradient(cx2-RX(kp.r)*.3,cy2-RY(kp.r)*.4,2,cx2,cy2,RX(kp.r));
  wg.addColorStop(0,'#a5e0f2');wg.addColorStop(.55,'#5aa8c8');wg.addColorStop(1,'#2f6f8c');
  c.fillStyle=wg;c.beginPath();c.ellipse(cx2,cy2,RX(kp.r-.15),RY(kp.r-.15),0,0,7);c.fill();
  c.save();c.beginPath();c.ellipse(cx2,cy2,RX(kp.r-.2),RY(kp.r-.2),0,0,7);c.clip();
  c.strokeStyle='rgba(255,255,255,.2)';c.lineWidth=1.2;
  for(let i=1;i<4;i++){c.beginPath();c.ellipse(cx2,cy2,RX(kp.r)*i/4,RY(kp.r)*i/4,0,0,7);c.stroke();}
  c.globalCompositeOperation='lighter';c.fillStyle='rgba(220,250,255,.5)';c.beginPath();c.ellipse(cx2-RX(kp.r)*.28,cy2-RY(kp.r)*.3,RX(kp.r)*.36,RY(kp.r)*.2,-.4,0,7);c.fill();
  c.restore();
  const tube=RY(.55);
  c.lineWidth=tube;c.strokeStyle='#e8f4fa';c.beginPath();c.ellipse(cx2,cy2,RX(kp.r),RY(kp.r),0,0,7);c.stroke();
  c.strokeStyle='rgba(58,140,216,.9)';c.setLineDash([26,22]);c.beginPath();c.ellipse(cx2,cy2,RX(kp.r),RY(kp.r),0,0,7);c.stroke();c.setLineDash([]);
  c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,255,255,.5)';c.lineWidth=2.4;c.beginPath();c.ellipse(cx2,cy2-tube*.28,RX(kp.r),RY(kp.r),0,Math.PI*1.05,Math.PI*1.95);c.stroke();c.restore();
  // a rubber duck bobbing near the rim
  {const da=kp.duckA||1,dx2=cx2+dcos(da)*RX(kp.r)*.45,dy2=cy2+dsin(da)*RY(kp.r)*.45;
   c.fillStyle='#ffd23f';c.beginPath();c.ellipse(dx2,dy2,7,5,0,0,7);c.fill();
   c.beginPath();c.arc(dx2+5,dy2-6,3.6,0,7);c.fill();
   c.fillStyle='#ff8a3c';c.beginPath();c.moveTo(dx2+8,dy2-6);c.lineTo(dx2+13,dy2-5);c.lineTo(dx2+8,dy2-4);c.closePath();c.fill();
   c.fillStyle='#23262b';c.beginPath();c.arc(dx2+6,dy2-7,.8,0,7);c.fill();
   c.fillStyle='rgba(255,255,255,.6)';c.beginPath();c.ellipse(dx2-2,dy2-2,2,1.2,0,0,7);c.fill();
   c.strokeStyle='rgba(255,255,255,.35)';c.lineWidth=1;c.beginPath();c.ellipse(dx2,dy2+3,9,3,0,0,7);c.stroke();}
 }

 // ---- 6. small decorations (now richer set) ----
 for(const d of G.map.deco){
  const sx=isoX(d.x,d.y),sy=isoY(d.x,d.y);
  if(d.t==='tuft'){
   for(let i=-2;i<=2;i++){const g=c.createLinearGradient(sx,sy,sx+i*4,sy-14*d.s);g.addColorStop(0,'#3a6e22');g.addColorStop(1,'#6fb83e');c.strokeStyle=g;c.lineWidth=2;c.lineCap='round';c.beginPath();c.moveTo(sx+i*3,sy);c.quadraticCurveTo(sx+i*4,sy-9*d.s,sx+i*5,sy-14*d.s);c.stroke();}
  }
  else if(d.t==='dust'){
   /* v103: a ball of carpet lint - a soft grey body, a lit top, and a few stray
      fibres sticking out of it. Deliberately the same silhouette WEIGHT as the
      tuft it replaces so the carpet keeps its scatter density and only its
      colour changes. */
   c.save();c.translate(sx,sy);
   c.fillStyle='rgba(168,160,144,.5)';c.beginPath();c.ellipse(0,-1*d.s,5.2*d.s,3.1*d.s,0,0,7);c.fill();
   c.fillStyle='rgba(208,201,186,.45)';c.beginPath();c.ellipse(-1.2*d.s,-2.2*d.s,3*d.s,1.8*d.s,0,0,7);c.fill();
   c.strokeStyle='rgba(146,138,122,.5)';c.lineWidth=.9;c.lineCap='round';
   for(let i=0;i<5;i++){const a=i/5*6.28+.4;
    c.beginPath();c.moveTo(dcos(a)*3.2*d.s,-1*d.s+dsin(a)*1.9*d.s);
    c.lineTo(dcos(a)*6.6*d.s,-1.6*d.s+dsin(a)*3.9*d.s);c.stroke();}
   c.restore();}
  else if(d.t==='droplet'){ // v107: a bead of water on the tile
   const g=c.createRadialGradient(sx-1.2*d.s,sy-1.6*d.s,.4,sx,sy,4*d.s);g.addColorStop(0,'rgba(240,250,255,.95)');g.addColorStop(.6,'rgba(150,200,225,.8)');g.addColorStop(1,'rgba(90,140,170,.55)');
   c.fillStyle=g;c.beginPath();c.ellipse(sx,sy,4.2*d.s,2.6*d.s,0,0,7);c.fill();
   c.fillStyle='rgba(255,255,255,.86)';c.beginPath();c.ellipse(sx-1.4*d.s,sy-1*d.s,1.1*d.s,.6*d.s,-.5,0,7);c.fill();}
  else if(d.t==='hair'){ // v107: a stray curl
   c.save();c.translate(sx,sy);c.rotate(d.a||0);c.strokeStyle='rgba(40,28,16,.75)';c.lineWidth=1;c.lineCap='round';
   c.beginPath();c.moveTo(-8*d.s,0);c.bezierCurveTo(-4*d.s,-6*d.s,0,5*d.s,4*d.s,-2*d.s);c.bezierCurveTo(6*d.s,-5*d.s,8*d.s,2*d.s,10*d.s,0);c.stroke();c.restore();}
  else if(d.t==='mothball'){ // v107: a small white sphere
   const g=c.createRadialGradient(sx-1.4*d.s,sy-2.6*d.s,.5,sx,sy-2*d.s,3.6*d.s);g.addColorStop(0,'#ffffff');g.addColorStop(.7,'#e4e4dc');g.addColorStop(1,'#a8a89c');
   c.fillStyle='rgba(0,0,0,.18)';c.beginPath();c.ellipse(sx,sy+.6,3.6*d.s,1.8*d.s,0,0,7);c.fill();
   c.fillStyle=g;c.beginPath();c.arc(sx,sy-2*d.s,3.4*d.s,0,7);c.fill();}
  else if(d.t==='cobweb'){ // v107: a faint radial web lying on the boards
   c.save();c.translate(sx,sy);c.rotate(d.a||0);c.strokeStyle='rgba(235,232,222,.42)';c.lineWidth=.8;
   const R=12*d.s;for(let i=0;i<6;i++){const a=i/6*6.28;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a)*R,Math.sin(a)*R*.55);c.stroke();}
   for(let k2=1;k2<=3;k2++){const r=R*k2/3;c.beginPath();for(let i=0;i<=6;i++){const a=i/6*6.28;const px=Math.cos(a)*r,py=Math.sin(a)*r*.55;i?c.lineTo(px,py):c.moveTo(px,py)}c.stroke();}
   c.restore();}
  else if(d.t==='clover'){c.fillStyle='#4a8e2e';for(let i=0;i<3;i++){const a=i/3*6.28-1.57;c.beginPath();c.ellipse(sx+dcos(a)*3*d.s,sy+dsin(a)*1.6*d.s,2.4*d.s,1.8*d.s,a,0,7);c.fill();}c.strokeStyle='#3a6e22';c.lineWidth=1;c.beginPath();c.moveTo(sx,sy+1);c.lineTo(sx,sy+5*d.s);c.stroke();}
  else if(d.t==='flower'){c.fillStyle=`hsl(${d.hue},80%,62%)`;for(let i=0;i<5;i++){const a=i/5*6.28;c.beginPath();c.ellipse(sx+dcos(a)*3.2*d.s,sy+dsin(a)*1.8*d.s,2.2*d.s,1.5*d.s,a,0,7);c.fill();}c.fillStyle='#ffd24d';c.beginPath();c.arc(sx,sy,1.8*d.s,0,7);c.fill();}
  else if(d.t==='cereal'){c.strokeStyle=`hsl(${d.hue},60%,55%)`;c.lineWidth=5*d.s;c.beginPath();c.ellipse(sx,sy,8*d.s,5*d.s,0,0,7);c.stroke();c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,255,255,.3)';c.lineWidth=1.5*d.s;c.beginPath();c.ellipse(sx-1,sy-1,8*d.s,5*d.s,0,Math.PI,Math.PI*1.6);c.stroke();c.restore();}
  else if(d.t==='pebble'){const g=c.createRadialGradient(sx-1,sy-1,.5,sx,sy,4*d.s);g.addColorStop(0,'#b8b0a0');g.addColorStop(1,'#7a7264');c.fillStyle=g;c.beginPath();c.ellipse(sx,sy,4*d.s,2.5*d.s,0,0,7);c.fill();}
  else if(d.t==='leaf'){c.save();c.translate(sx,sy);c.rotate(d.a);const g=c.createLinearGradient(-9*d.s,0,9*d.s,0);g.addColorStop(0,'#5aa83a');g.addColorStop(.5,'#74c44e');g.addColorStop(1,'#3a6e22');c.fillStyle=g;c.beginPath();c.ellipse(0,0,9*d.s,4*d.s,0,0,7);c.fill();c.strokeStyle='rgba(46,86,26,.8)';c.lineWidth=1;c.beginPath();c.moveTo(-9*d.s,0);c.lineTo(9*d.s,0);c.stroke();c.restore();}
  else if(d.t==='crumb'){c.fillStyle='#c4965a';c.beginPath();c.arc(sx,sy,2.4*d.s,0,7);c.fill();c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,230,180,.5)';c.beginPath();c.arc(sx-.6,sy-.6,1*d.s,0,7);c.fill();c.restore();}
  else if(d.t==='footp'){c.fillStyle='rgba(120,90,50,.3)';c.beginPath();c.ellipse(sx+(d.o?5:-5),sy,5,2.8,.5,0,7);c.fill();for(let i=0;i<3;i++){c.beginPath();c.ellipse(sx+(d.o?5:-5)+(i-1)*2.2,sy-3,1.1,.8,0,0,7);c.fill();}}
  else if(d.t==='dandy'){c.strokeStyle='#4a8e2e';c.lineWidth=1.2;c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+1,sy-8*d.s);c.stroke();
   c.fillStyle='rgba(245,245,238,.9)';for(let i=0;i<9;i++){const a=i/9*6.28;c.beginPath();c.arc(sx+1+dcos(a)*3.2*d.s,sy-8*d.s+dsin(a)*2.6*d.s,1*d.s,0,7);c.fill();}
   c.fillStyle='#e8e4d2';c.beginPath();c.arc(sx+1,sy-8*d.s,1.6*d.s,0,7);c.fill();}
  else if(d.t==='bone'){c.save();c.translate(sx,sy);c.rotate(d.a||0);c.fillStyle='#efe8d4';
   rr(c,-7*d.s,-1.8*d.s,14*d.s,3.6*d.s,1.6*d.s);c.fill();
   for(const ex of [-7,7])for(const ey of [-2,2]){c.beginPath();c.arc(ex*d.s,ey*d.s,2.4*d.s,0,7);c.fill();}
   c.fillStyle='rgba(160,148,120,.5)';c.beginPath();c.ellipse(0,1.4*d.s,5*d.s,1*d.s,0,0,7);c.fill();c.restore();}
  else if(d.t==='pea'){const g=c.createRadialGradient(sx-1,sy-2,.4,sx,sy-1,3.4*d.s);g.addColorStop(0,'#9ada6e');g.addColorStop(1,'#3f8a2c');c.fillStyle=g;
   c.beginPath();c.arc(sx,sy-1,3.2*d.s,0,7);c.fill();c.fillStyle='rgba(255,255,255,.7)';c.beginPath();c.arc(sx-1,sy-2.2,.9*d.s,0,7);c.fill();}
  else if(d.t==='cap'){c.save();c.translate(sx,sy);const hue=d.hue!=null?d.hue:210;
   c.fillStyle=`hsl(${hue},60%,50%)`;c.beginPath();c.ellipse(0,0,4.6*d.s,3*d.s,0,0,7);c.fill();
   c.strokeStyle=`hsl(${hue},55%,34%)`;c.lineWidth=1.4*d.s;c.stroke();
   c.fillStyle='rgba(255,255,255,.75)';c.beginPath();c.ellipse(-1.2,-.8,1.4*d.s,.8*d.s,-.5,0,7);c.fill();c.restore();}
  else if(d.t==='shell'){c.save();c.translate(sx,sy);c.rotate(d.a||0);
   const g=c.createLinearGradient(0,-5*d.s,0,3*d.s);g.addColorStop(0,'#fbf2e4');g.addColorStop(1,'#dcc4a4');c.fillStyle=g;
   c.beginPath();c.moveTo(0,2*d.s);for(let i=0;i<=6;i++){const a=Math.PI+i/6*Math.PI;c.lineTo(Math.cos(a)*5.4*d.s,2*d.s+Math.sin(a)*6*d.s)}c.closePath();c.fill();
   c.strokeStyle='rgba(170,140,104,.6)';c.lineWidth=.8;for(let i=1;i<6;i++){const a=Math.PI+i/6*Math.PI;c.beginPath();c.moveTo(0,2*d.s);c.lineTo(Math.cos(a)*5*d.s,2*d.s+Math.sin(a)*5.6*d.s);c.stroke();}c.restore();}
  else if(d.t==='starfish'){c.save();c.translate(sx,sy);c.rotate(d.a||0);c.fillStyle='#e8935a';
   c.beginPath();for(let i=0;i<10;i++){const a=i/10*6.28-1.57,r0=(i%2?2.2:5.6)*d.s;c.lineTo(Math.cos(a)*r0,Math.sin(a)*r0*.72)}c.closePath();c.fill();
   c.fillStyle='rgba(255,220,180,.65)';c.beginPath();c.arc(0,0,1.4*d.s,0,7);c.fill();c.restore();}
  else if(d.t==='dice'){c.save();c.translate(sx,sy);c.rotate((d.a||0)*.3);
   c.fillStyle='#f6f6f2';rr(c,-4.4*d.s,-7*d.s,8.8*d.s,8.8*d.s,1.8*d.s);c.fill();
   c.fillStyle='rgba(120,120,130,.35)';rr(c,-4.4*d.s,-1*d.s,8.8*d.s,2.8*d.s,1.4*d.s);c.fill();
   c.fillStyle='#23262b';c.beginPath();c.arc(-1.8*d.s,-4.4*d.s,.85*d.s,0,7);c.arc(1.8*d.s,-1.4*d.s,.85*d.s,0,7);c.arc(0,-2.9*d.s,.85*d.s,0,7);c.fill();c.restore();}
  else if(d.t==='crayon'){c.save();c.translate(sx,sy);c.rotate(d.a||0);const hue=d.hue!=null?d.hue:0;
   c.fillStyle=`hsl(${hue},72%,52%)`;rr(c,-7*d.s,-2*d.s,12*d.s,4*d.s,1.4*d.s);c.fill();
   c.beginPath();c.moveTo(5*d.s,-2*d.s);c.lineTo(9*d.s,0);c.lineTo(5*d.s,2*d.s);c.closePath();c.fill();
   c.fillStyle='rgba(40,40,44,.55)';rr(c,-4*d.s,-2*d.s,2*d.s,4*d.s,.6);c.fill();rr(c,2*d.s,-2*d.s,2*d.s,4*d.s,.6);c.fill();
   c.fillStyle='rgba(255,255,255,.5)';rr(c,-6*d.s,-1.6*d.s,10*d.s,1*d.s,.5);c.fill();c.restore();}
  else if(d.t==='puzzle'){c.save();c.translate(sx,sy);c.rotate(d.a||0);const hue=d.hue!=null?d.hue:120;
   c.fillStyle=`hsl(${hue},58%,52%)`;rr(c,-4.6*d.s,-4.6*d.s,9.2*d.s,9.2*d.s,1*d.s);c.fill();
   c.beginPath();c.arc(0,-4.6*d.s,2*d.s,0,7);c.fill();                                    // top knob
   c.fillStyle='rgba(0,0,0,.22)';c.beginPath();c.arc(4.6*d.s,0,2*d.s,0,7);c.fill();       // side notch
   c.fillStyle='rgba(255,255,255,.4)';rr(c,-3.4*d.s,-3.6*d.s,7*d.s,1.6*d.s,.8);c.fill();c.restore();}
  else if(d.t==='paperclip'){c.save();c.translate(sx,sy);c.rotate(d.a||0);c.strokeStyle='#b8bcc4';c.lineWidth=1.4*d.s;c.lineCap='round';
   c.beginPath();c.moveTo(-5*d.s,-3*d.s);c.lineTo(-5*d.s,3*d.s);c.arc(-2*d.s,3*d.s,3*d.s,Math.PI,0,true);c.lineTo(1*d.s,-2*d.s);c.arc(-1.5*d.s,-2*d.s,2.5*d.s,0,Math.PI,true);c.lineTo(-3*d.s,2*d.s);c.stroke();
   c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,255,255,.5)';c.lineWidth=.7*d.s;c.beginPath();c.moveTo(-5*d.s,-2*d.s);c.lineTo(-5*d.s,2*d.s);c.stroke();c.restore();c.restore();}
  else if(d.t==='sticky'){c.save();c.translate(sx,sy);const hue=d.hue!=null?d.hue:52;
   c.fillStyle='rgba(0,0,0,.12)';rr(c,-6*d.s+1,-6*d.s+1.5,12*d.s,12*d.s,1);c.fill();
   c.fillStyle=`hsl(${hue},85%,72%)`;rr(c,-6*d.s,-6*d.s,12*d.s,12*d.s,1);c.fill();
   c.fillStyle=`hsl(${hue},70%,60%)`;c.beginPath();c.moveTo(6*d.s,-6*d.s);c.lineTo(6*d.s,-2*d.s);c.lineTo(2*d.s,-6*d.s);c.closePath();c.fill();
   c.strokeStyle=`hsla(${hue},40%,40%,.5)`;c.lineWidth=.8;for(let i=1;i<3;i++){c.beginPath();c.moveTo(-4*d.s,-6*d.s+i*3.4*d.s);c.lineTo(4*d.s,-6*d.s+i*3.4*d.s);c.stroke();}c.restore();}
 }

 // ---- 7. matte molded grain (tiny low-contrast flecks) ----
 const spN=Math.floor(w*h/2400);
 for(let i=0;i<spN;i++){const px=rnd()*w,py=rnd()*(h-40),d2=rnd();c.fillStyle=d2<.5?'rgba(255,255,255,.045)':'rgba(0,0,0,.05)';c.beginPath();c.arc(px,py,.6+rnd()*1.1,0,7);c.fill();}

 // ---- 8. baked depth vignette ----
 const vg=c.createRadialGradient(w/2,h/2,Math.min(w,h)*.3,w/2,h/2,Math.max(w,h)*.6);
 vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(8,14,6,.36)');
 c.fillStyle=vg;c.fillRect(0,0,w,h);

 // minimap terrain
 const mc=document.createElement('canvas');mc.width=N;mc.height=N;const m2=mc.getContext('2d');
 m2.fillStyle=PAL.base;m2.fillRect(0,0,N,N);
 // hazard tints (drawn before block shadows so blockers still read)
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const f=G.map.fld[y*N+x];if(!f)continue;m2.fillStyle=f===3?'rgba(70,150,190,.85)':'rgba(196,150,80,.7)';/* v66: only codes 2 & 3 exist */m2.fillRect(x,y,1,1);}
 m2.fillStyle='rgba(0,0,0,.4)';
 for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(!G.map.pass[y*N+x])m2.fillRect(x,y,1,1);
 G.mmTerr=mc;
}
function pathRegion(c,p){c.beginPath();c.moveTo(isoX(p.x,p.y),isoY(p.x,p.y));c.lineTo(isoX(p.x+p.w,p.y),isoY(p.x+p.w,p.y));c.lineTo(isoX(p.x+p.w,p.y+p.h),isoY(p.x+p.w,p.y+p.h));c.lineTo(isoX(p.x,p.y+p.h),isoY(p.x,p.y+p.h));c.closePath()}

