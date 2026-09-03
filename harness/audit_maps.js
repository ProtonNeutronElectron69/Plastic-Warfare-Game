/* audit_maps.js - a MEASUREMENT tool, not a test. Generates every map over many
 * seeds and counts geometric defects. Nothing here is pinned and it is not part
 * of seg.sh: a layout defect cannot fail the suite (rule 7), so this counts what
 * a screenshot shows one seed at a time.
 *   cat shim_head.js game.js audit_maps.js > .audit.js && node .audit.js [nSeeds]
 */
const NS = parseInt(process.argv[2] || '40', 10);
const KEYS = ['backyard','kitchen','sandbox','livingroom','desk','bathroom','attic']; // v107: the two new boards
const rep = {}, ex = {};
function hit(map, kind, detail, n){
  rep[map] = rep[map] || {}; rep[map][kind] = (rep[map][kind]||0)+(n==null?1:n);
  const k = map+'|'+kind; if(!ex[k]) ex[k] = detail;
}
/* PROP_BLK's own header says its entries are 0.85x the measured art radius, and
   0 means "art smaller than a unit's own radius". Read the art back out of it
   rather than re-measuring: one table, one truth. */
function artR(p){const b=propBlkR(p.t,p.r,p.sc);return b>0?b/0.85:0.45*(p.sc||1)}
function tilesOf(M,p){                    // the tiles prop() actually blocked
  const N=M.N,br=propBlkR(p.t,p.r,p.sc),out=[];
  if(br<=0)return out;
  if(p.len){                              // blockLine's capsule, not block()'s disc
   const cx=dcos(p.ang),cy=dsin(p.ang),sc=p.sc||1,R=Math.ceil(br),rr=(br+.5)*(br+.5);
   const t0=-Math.max(.25,br),t1=p.len*sc+Math.max(.25,br);
   for(let t=t0;t<=t1;t+=.34){const bx=Math.floor(p.x+cx*t),by=Math.floor(p.y+cy*t);
    for(let oy=-R;oy<=R;oy++)for(let ox=-R;ox<=R;ox++){if(ox*ox+oy*oy>rr)continue;
     const tx=bx+ox,ty=by+oy;if(tx>=0&&ty>=0&&tx<N&&ty<N)out.push(ty*N+tx);}}
   return out;
  }
  const tx=Math.floor(p.x),ty=Math.floor(p.y);
  if(tx>=0&&ty>=0&&tx<N&&ty<N)out.push(ty*N+tx);
  for(let y=Math.floor(p.y-br);y<=p.y+br;y++)for(let x=Math.floor(p.x-br);x<=p.x+br;x++){
    if(x<0||y<0||x>=N||y>=N)continue;
    if(dhyp(x+.5-p.x,y+.5-p.y)<=br)out.push(y*N+x);
  }
  return out;
}
for(const key of KEYS){
 for(let s=0;s<NS;s++){
  const seed = 500000 + s*7919;
  const M = makeMap(key, seed), N = M.N, tag = key+' seed '+seed;

  for(const p of M.props){
    const pts=[[p.x,p.y]];
    if(p.len)pts.push([p.x+dcos(p.ang)*p.len*(p.sc||1),p.y+dsin(p.ang)*p.len*(p.sc||1)]);
    for(const [qx,qy] of pts) if(qx<0||qy<0||qx>=N||qy>=N)
      hit(key,'prop off-board',tag+': '+p.t+' at '+qx.toFixed(1)+','+qy.toFixed(1)+' (N='+N+')');
  }
  {const R=[].concat(M.patches||[],M.board?[M.board]:[],M.sandPatch?[M.sandPatch]:[],
                     M.rug?[M.rug]:[],M.blanket?[M.blanket]:[],M.mat?[M.mat]:[]); // v107: the bath mat
   for(const r of R) if(r.x<0||r.y<0||r.x+r.w>N||r.y+r.h>N)
     hit(key,'region off-board',tag+': '+r.x.toFixed(1)+','+r.y.toFixed(1)+' '+r.w.toFixed(1)+'x'+r.h.toFixed(1));}
  for(const d of M.deco) if(d.x<0||d.y<0||d.x>=N||d.y>=N)
    hit(key,'deco off-board',tag+': '+d.t+' at '+d.x.toFixed(1)+','+d.y.toFixed(1));

  // a blocking prop whose WHOLE footprint ended up under an impassable liquid
  for(const p of M.props){
   if(p.t==='keep'||p.t==='bowl'||p.t==='table')continue;   // anchors, exempt by design
   const ts=tilesOf(M,p); if(!ts.length) continue;
   if(ts.every(i=>M.fld[i]===3))
     hit(key,'prop drowned',tag+': '+p.t+' at '+p.x.toFixed(1)+','+p.y.toFixed(1));
  }
  // two props whose ART overlaps
  const bp=M.props.filter(p=>!p.len&&artR(p)>0);
  for(let i=0;i<bp.length;i++)for(let j=i+1;j<bp.length;j++){
   const a=bp[i],b=bp[j],d=dhyp(a.x-b.x,a.y-b.y),s2=artR(a)+artR(b);
   if(a.t==='tubrim'&&b.t==='tubrim')continue;   // v107: the bathtub's rim segments are ONE lip, laid to touch on purpose
   if(d<s2*0.8) hit(key,'prop art overlap',tag+': '+a.t+' & '+b.t+' '+d.toFixed(2)+' apart, art '+s2.toFixed(2));
  }
  // a barricade standing inside a prop's ART (the bookshelf-over-hedgehogs case)
  for(const p of bp){const r=artR(p);
   for(const b of M.barricades) if(dhyp(b.x+.5-p.x,b.y+.5-p.y)<r)
     hit(key,'barricade inside prop art',tag+': '+p.t+' over a hedgehog');}
  // two hazards of DIFFERENT kinds sharing tiles
  {const own=new Int16Array(N*N).fill(-1); let clip=0;
   M.fields.forEach((f,fi)=>{const ext=Math.max(f.rx,f.ry)*1.4;
    for(let y=Math.max(0,Math.floor(f.cy-ext));y<=Math.min(N-1,f.cy+ext);y++)
    for(let x=Math.max(0,Math.floor(f.cx-ext));x<=Math.min(N-1,f.cx+ext);x++){
     const ddx=x+.5-f.cx,ddy=y+.5-f.cy,rm=blobRadius(f.blob,datan2(ddy,ddx));
     const nx=ddx/(f.rx*rm),ny=ddy/(f.ry*rm); if(nx*nx+ny*ny>1)continue;
     const i=y*N+x; if(own[i]>=0&&M.fields[own[i]].kind!==f.kind)clip++; else own[i]=fi;
    }});
   if(clip>3){const pairs={},own2=new Int16Array(N*N).fill(-1);
    M.fields.forEach((f,fi)=>{const ext=Math.max(f.rx,f.ry)*1.4;
     for(let y=Math.max(0,Math.floor(f.cy-ext));y<=Math.min(N-1,f.cy+ext);y++)
     for(let x=Math.max(0,Math.floor(f.cx-ext));x<=Math.min(N-1,f.cx+ext);x++){
      const ddx=x+.5-f.cx,ddy=y+.5-f.cy,rm=blobRadius(f.blob,datan2(ddy,ddx));
      const nx=ddx/(f.rx*rm),ny=ddy/(f.ry*rm); if(nx*nx+ny*ny>1)continue;
      const i=y*N+x,o=own2[i];
      if(o>=0&&M.fields[o].kind!==f.kind){const k2=[M.fields[o].kind,f.kind].sort().join('/');pairs[k2]=(pairs[k2]||0)+1;}
      else own2[i]=fi;}});
    for(const k2 in pairs)hit(key,'clip '+k2,tag+': '+pairs[k2]+' tiles',pairs[k2]);
    hit(key,'hazard kinds sharing tiles',tag+': '+clip+' tiles',1);}
  }
  // ground cover on liquid, under a blocker, or inside a start pocket
  let onLiq=0,onBlk=0;
  for(const d of M.deco){const tx=Math.floor(d.x),ty=Math.floor(d.y);
   if(tx<0||ty<0||tx>=N||ty>=N)continue;
   if(M.fld[ty*N+tx]===3)onLiq++; else if(!M.pass[ty*N+tx])onBlk++;}
  if(onLiq)hit(key,'deco on liquid',tag+': '+onLiq+' of '+M.deco.length,onLiq);
  if(onBlk)hit(key,'deco under a blocker',tag+': '+onBlk+' of '+M.deco.length,onBlk);
  // a prop standing inside a cleared start pocket (drawn, but blocks nothing)
  for(const p of M.props){const ts=tilesOf(M,p);
   if(ts.length&&ts.every(i=>M.pass[i]===1))
    hit(key,'blocking prop that blocks nothing',tag+': '+p.t+' at '+p.x.toFixed(1)+','+p.y.toFixed(1));}
  {const R=[].concat(M.patches||[],M.board?[M.board]:[],M.sandPatch?[M.sandPatch]:[],
                     M.rug?[M.rug]:[],M.blanket?[M.blanket]:[],M.mat?[M.mat]:[]); // v107: the bath mat
   for(let i=0;i<R.length;i++)for(let j=i+1;j<R.length;j++){const a=R[i],b=R[j];
    if(a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h)
     hit(key,'ground regions overlapping',tag+': '+R.length+' regions');}}
  hit(key,'CENSUS props',   tag,M.props.length);
  hit(key,'CENSUS fields',  tag,M.fields.length);
  hit(key,'CENSUS nests',   tag,M.nests.length);
  hit(key,'CENSUS deco',    tag,M.deco.length);
  hit(key,'CENSUS barricades',tag,M.barricades.length);
  hit(key,'CENSUS blocked tiles',tag,M.pass.reduce((a,v)=>a+(v?0:1),0));
  if(key==='sandbox'){
   const walls=M.props.filter(p=>p.t==='wall').length, tw=M.props.filter(p=>p.t==='tower').length;
   hit(key,'castle ring: wall props kept (of ~34)','last seed '+seed+': '+walls+' walls, '+tw+' towers',walls);
  }
 }
}
console.log('=== map layout audit, '+NS+' seeds per map ===');
for(const key of KEYS){
 console.log('\n--- '+key+' ---');
 const r=rep[key]||{},ks=Object.keys(r).sort((a,b)=>r[b]-r[a]);
 if(!ks.length){console.log('  (nothing flagged)');continue}
 for(const k of ks)console.log('  '+String(r[k]).padStart(6)+'  '+k+'\n            e.g. '+ex[key+'|'+k]);
}
