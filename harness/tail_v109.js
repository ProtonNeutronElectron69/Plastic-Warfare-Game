/* tail_v109.js - v109: the ground catches light, and the props get their detail (T94).
   The two halves the owner asked for in one pass, after v108's floors:
   THE GROUND CATCHES THE FRAME'S LIGHTS. Since v96 the band shader has relit
   every sprite per pixel under up to ten point lights - explosions, burning
   ground, muzzle flashes, flame - and the terrain, a separate canvas
   composited BENEATH the band, caught none of it: a tank lit up and the lawn
   under it did not. groundGlow() lays each collected light on the world canvas
   as an additive disc foreshortened to the board, with the SHADER'S OWN falloff
   for a flat surface (ptLightK), on every renderer - the 2d fallback included,
   which is why the collector gained an `into` list that never touches GLB.
   THE PROPS. Every decorative prop painter (about sixty kinds) and the Attic's
   three pieces of level art carry more modelled detail: a kit of deterministic
   helpers (pSpeck / pGrain / pCyl / pEdge / pLabel / pStitch / pStuds, all off
   dth, none off a stream) and bespoke greebles per prop - a pull tab, gills,
   lichen, a belt buckle, a d-pad, page edges. The silhouettes, propBox and
   PROP_BLK are untouched, so a more detailed rock is still the rock the layout
   pins know.
   What this file asserts: the falloff is the shader's (the same two terms,
   numerically); the collector runs without a GL stage and still gates on
   vision; the pass sits between the terrain blit and the ground FX in
   renderCore; the discs are additive, foreshortened, hue-preserving at high
   intensity, and draw nothing for no lights; nothing here reads srand(). For
   the props: every painter runs under the shim, paints the same bytes twice
   (deterministic), reaches a floor of distinct styles, and neither the painter
   nor the kit names Math.random or srand. The frames were read in Chromium
   (rule 7): a lawn under a napalm field, at noon and at night, and a labelled
   gallery of all sixty props. No trail moved. */
'use strict';
section('T94 v109: the ground catches light; the props get their detail');

/* ---------- A: the falloff is the shader's ---------- */
section('T94.A ptLightK is the band shader\'s point-light term for a flat pixel');
{
 ok('T94.A the GLSL carries the two terms: squared attenuation on the 3D distance, and the cosine',
    GLSL_BAND.indexOf('at=max(0.,1.-dist/uLr[i]);at*=at')>=0 && GLSL_BAND.indexOf('max(dot(n,d/max(dist,1.)),0.)')>=0);
 const near=(a,b)=>Math.abs(a-b)<1e-9;
 const r=100,z=36;
 ok('T94.A at the light\'s foot: (1-z/r)^2 times a cosine of one', near(ptLightK(0,r,z),Math.pow(1-z/r,2)));
 const h=40,d=Math.sqrt(h*h+z*z);
 ok('T94.A off to the side: (1-d/r)^2 times z/d, on the 3D distance', near(ptLightK(h,r,z),Math.pow(1-d/r,2)*z/d));
 ok('T94.A zero at and beyond the radius', ptLightK(Math.sqrt(r*r-z*z),r,z)===0 && ptLightK(r,r,z)===0 && ptLightK(r*2,r,z)===0);
 let mono=true,prev=Infinity;for(let i=0;i<=20;i++){const k=ptLightK(i*r/20,r,z);if(k>prev+1e-12)mono=false;prev=k}
 ok('T94.A ...and it only ever falls off', mono);
}

/* ---------- B: the collector runs with no GL stage, and still gates on vision ---------- */
section('T94.B bandLightsCollect(...,into) collects without touching GLB');
{
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:660109});
 /* a fixture that does not tick has fog===0 everywhere (the v104.4 trap):
    twelve ticks stamp the HQ's vision, and the collector is vision-gated */
 for(let i=0;i<12;i++)update(1/30);
 const hq=G.human.blds.find(b=>b.key==='hq');
 const cx=isoX(hq.x,hq.y)-view.width/2,cy=isoY(hq.x,hq.y)-view.height/2;
 const glb0=GLB;
 G.parts.length=0;
 G.parts.push({t:'ex',x:hq.x+2,y:hq.y+2,life:.36,sc:1});
 const L=bandLightsCollect(cx,cy,1,[]);
 ok('T94.B it returns the list it was handed, filled', Array.isArray(L)&&L.length===1);
 ok('T94.B ...and GLB is exactly what it was (null under the shim): the 2d fallback has no stage to write to', GLB===glb0);
 ok('T94.B the light is in canvas pixels with the shader\'s height and radius', Math.abs(L[0].x-view.width/2-(isoX(hq.x+2,hq.y+2)-isoX(hq.x,hq.y)))<1e-6 && L[0].z===LIGHTV.ptZ && L[0].r===LIGHTV.ex.r);
 /* vision: the same explosion far out in the fog collects nothing - light
    through fog would be a wallhack (v96's rule), and the ground pass inherits
    it because it is the same collector */
 G.parts.length=0;
 const N=G.map.N,fx=hq.x<N/2?N-3:3,fy=hq.y<N/2?N-3:3;
 G.parts.push({t:'ex',x:fx,y:fy,life:.36,sc:1});
 const cx2=isoX(fx,fy)-view.width/2,cy2=isoY(fx,fy)-view.height/2;
 ok('T94.B an explosion in the fog lights nothing on the ground either', fogAt(fx,fy)!==2 && bandLightsCollect(cx2,cy2,1,[]).length===0);
 G.parts.length=0;
 ok('T94.B the lit path still collects into GLB.lights by the call T72 pins', renderCore.toString().indexOf('bandLightsCollect(cx,cy,z)')>=0);
}

/* ---------- C: the pass sits under everything, on every renderer ---------- */
section('T94.C groundGlow runs between the terrain and the ground FX');
{
 const rc=renderCore.toString();
 const iT=rc.indexOf('c.drawImage(G.terr,0,0)'),iG=rc.indexOf("groundGlow(c,bandLightsCollect(cx,cy,z,[]))"),iF=rc.indexOf('ground-plane FX'),iB=rc.indexOf('if(nctx&&bandLit())');
 ok('T94.C the glow is laid right after the terrain blit and before the ground-plane FX', iT>=0&&iG>iT&&iF>iG);
 ok('T94.C ...and OUTSIDE the GL-only block, so the 2d fallback gets it', iB>iG);
 /* the recorder: an op log of what groundGlow draws */
 function glowLog(L){
  const ops=[];let fill='';
  const base=document.createElement('canvas').getContext('2d');
  const c=new Proxy(base,{get(t,k){
   if(k==='createRadialGradient')return(...a)=>{const g={a,stops:[],addColorStop(o,col){this.stops.push([o,col])}};ops.push({op:'rgrad',g});return g};
   if(k==='setTransform')return(...a)=>{ops.push({op:'xf',a})};
   if(k==='scale')return(...a)=>{ops.push({op:'scale',a})};
   if(k==='translate')return(...a)=>{ops.push({op:'tr',a})};
   if(k==='arc')return(...a)=>{ops.push({op:'arc',a})};
   if(k==='fill')return()=>{ops.push({op:'fill',fill,comp:t.globalCompositeOperation})};
   const v=t[k];return typeof v==='function'?v.bind(t):v;},
   set(t,k,v){if(k==='fillStyle')fill=v;t[k]=v;return true}});
  groundGlow(c,L);return ops;
 }
 const two=[{x:100,y:80,z:36,r:120,c:[1,.62,.28]},{x:300,y:200,z:36,r:80,c:[.5,.39,.21]}];
 const ops=glowLog(two);
 const grads=ops.filter(o=>o.op==='rgrad'),fills=ops.filter(o=>o.op==='fill'),arcs=ops.filter(o=>o.op==='arc'),scales=ops.filter(o=>o.op==='scale');
 ok('T94.C two lights, two radial discs, each filled additively', grads.length===2&&fills.length===2&&fills.every(f=>f.comp==='lighter'));
 ok('T94.C each disc is the light\'s own radius, foreshortened to the board by LIGHTV.ground.sq', arcs.length===2&&arcs[0].a[2]===120&&arcs[1].a[2]===80&&scales.every(s=>s.a[0]===1&&s.a[1]===LIGHTV.ground.sq));
 ok('T94.C drawn under the identity transform, because the list is already in canvas pixels', ops.some(o=>o.op==='xf'&&o.a.join()==='1,0,0,1,0,0'));
 ok('T94.C nine stops per disc, walking the shader\'s curve', grads.every(g=>g.g.stops.length===9&&g.g.stops[0][0]===0&&g.g.stops[8][0]===1));
 ok('T94.C the last stop is black: the disc ends where the light does', grads.every(g=>g.g.stops[8][1]==='rgba(0,0,0,1)'));
 ok('T94.C no lights, nothing drawn', glowLog([]).length===0 && glowLog(null).length===0);
 /* hue: a napalm field's light is intensity 4+; clipped channel by channel it
    goes white, which reads as a spotlight. The clamp scales the three together. */
 const hot=glowLog([{x:0,y:0,z:36,r:200,c:[4,2.2,.8]}]).find(o=>o.op==='rgrad').g.stops[0][1].match(/\d+/g).map(Number);
 ok(`T94.C a hot light keeps its hue at the centre (${hot.slice(0,3).join(',')}): the brightest channel caps, the others follow`, hot[0]===255&&hot[1]<hot[0]&&hot[2]<hot[1]&&Math.abs(hot[1]/hot[0]-2.2/4)<.02);
 ok('T94.C the ground\'s gain and squash are the tuning table\'s', LIGHTV.ground.k>0&&LIGHTV.ground.k<=2&&LIGHTV.ground.sq===.5);
 ok('T94.C rule 2: nothing in the ground pass names srand or Math.random',
    [groundGlow,ptLightK].every(f=>f.toString().indexOf('srand')<0&&f.toString().indexOf('Math.random')<0));
}

/* ---------- D: the props ---------- */
section('T94.D every prop painter runs, paints deterministically, and carries its detail');
const PROPS109=['hose','pot','marble','rock','mushroom','stick','can','pencil','fork','spoon','sugar','bowl','wall','bucket','shovel','rake','star','dino','tower','shellp','lily','couch','chair','table','console','shelf','lamp','blocks','soccer','gnome','wcan','snail','rack','plate','mug','salt','toaster','beachball','dumptruck','keep','slipper','remote','tubrim','duck','tproll','shampoo','soapbar','sponge','plunger','toothbrush','box','trunk','lampshade','frame','rug','books','keyboard','chips','eraser','traincar'];
function propLog109(t,extra){
 const out=[];const base=document.createElement('canvas').getContext('2d');
 const c=new Proxy(base,{get(tt,k){
  if(k==='fill'||k==='stroke'||k==='fillRect'||k==='fillText'||k==='strokeRect')return(...a)=>{out.push(k+':'+String(tt.fillStyle)+'|'+String(tt.strokeStyle)+'|'+a.map(v=>typeof v==='number'?v.toFixed(2):v).join(','))};
  if(k==='moveTo'||k==='lineTo'||k==='arc'||k==='ellipse'||k==='quadraticCurveTo')return(...a)=>{out.push(k+':'+a.map(v=>typeof v==='number'?v.toFixed(2):v).join(','))};
  const v=tt[k];return typeof v==='function'?v.bind(tt):v;}});
 propBody(c,Object.assign({t,x:12.3,y:7.7,r:1.1,r2:1.4,len:5,ang:.5,a:.3,hue:120,rot:.3},extra||{}));
 return out;
}
{
 let ran=0,det=true,minStyles=Infinity,total=0,worst='';
 for(const t of PROPS109){
  let a=null,b=null;
  try{a=propLog109(t);b=propLog109(t)}catch(e){worst=t+': '+e.message;continue}
  ran++;
  if(a.join('\n')!==b.join('\n')){det=false;worst=t}
  const styles=new Set(a.filter(s=>/^(fill|stroke|fillRect|fillText|strokeRect):/.test(s)).map(s=>s.split('|').slice(0,2).join('|'))).size;
  total+=styles;if(styles<minStyles){minStyles=styles;if(styles<5)worst=t+' ('+styles+')'}
 }
 ok(`T94.D all ${PROPS109.length} prop painters run under the shim (${ran})`+(worst?' ['+worst+']':''), ran===PROPS109.length);
 ok('T94.D each paints the same ops twice: the detail is deterministic, off dth and the prop\'s own position, never a stream', det);
 /* the floor is 5, measured: the four smallest props (stick, fork, star, tubrim)
    sit exactly there, because every gradient fill collapses into one style in
    this count and a stick has one colour of bark. Two and a half times T89.F's
    floor, and the TOTAL is the stronger claim */
 ok(`T94.D each carries a floor of distinct styles (fewest ${minStyles}; ${total} across the set)`, minStyles>=5 && total>=600);
 ok('T94.D two props of one kind at different positions paint different detail: the seed is the position',
    propLog109('rock').join()!==propLog109('rock',{x:40.1,y:33.7}).join() && propLog109('sugar').join()!==propLog109('sugar',{x:40.1,y:33.7}).join());
 ok('T94.D the engine variant of the train car is its own painting', propLog109('traincar').join()!==propLog109('traincar',{eng:true}).join());
 const src=propBody.toString()+drawLevelArt.toString()+[pSpeck,pGrain,pCyl,pEdge,pLabel,pStitch,pStuds].map(f=>f.toString()).join('');
 ok('T94.D neither the prop painter, the level art nor the kit names Math.random or srand (v97\'s rule, now for the props: the sugar\'s sparkle, the keep\'s grain and the slipper\'s fuzz were Math.random through v108)',
    src.indexOf('Math.random')<0 && src.indexOf('srand')<0);
 ok('T94.D the kit is deterministic: pSpeck with one seed lays the same specks twice, and a different seed lays different ones',
    (()=>{const run=(seed)=>{const o=[];const base=document.createElement('canvas').getContext('2d');const c=new Proxy(base,{get(tt,k){if(k==='fillRect')return(...a)=>{o.push(a.join())};const v=tt[k];return typeof v==='function'?v.bind(tt):v}});pSpeck(c,0,0,10,10,12,seed,'#000',.5,1);return o.join('\n')};
      return run(3)===run(3)&&run(3)!==run(4)})());
}
{
 /* the Attic's level art: all three looks, whole and hurt, still paint - and the
    bale's page edges and the boxes' stencil are reached */
 G=null;newGame({map:'attic',mode:'dm',diff:'normal',fac:'green',opp:3,seed:660109});
 const arts=G.neutral.blds.filter(b=>b.t&&b.t.lvl);
 let err=null,texts=0;
 const base=document.createElement('canvas').getContext('2d');
 const c=new Proxy(base,{get(tt,k){if(k==='fillText')return(...a)=>{texts++};const v=tt[k];return typeof v==='function'?v.bind(tt):v}});
 try{for(const b of arts.slice(0,9)){drawLevelArt(c,b,0,0);b.hp=b.mhp*.2;drawLevelArt(c,b,0,0);b.hp=b.mhp}}catch(e){err=e}
 ok('T94.D the Attic\'s level art paints whole and hurt under the pass'+(err?' ['+err.message+']':''), !err&&arts.length>0);
 ok('T94.D ...and the boxes carry their stencil', texts>0);
}

/* ---------- E: what did NOT change ---------- */
section('T94.E the bake boxes and the collision table are untouched');
{
 ok('T94.E propBox carries no v109 edit: a more detailed prop is the same prop to the bake and the layout', propBox.toString().indexOf('v109')<0);
 ok('T94.E PROP_BLK is the v103 table', typeof PROP_BLK==='object' && Object.keys(PROP_BLK).length>20 && JSON.stringify(PROP_BLK).indexOf('v109')<0);
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:660109});
 const r0=G.rngS,h0=hashState();
 renderTerrain();bakeMapSprites();
 ok('T94.E baking every prop leaves srand() and the state hash where they were', G.rngS===r0&&hashState()===h0);
}
