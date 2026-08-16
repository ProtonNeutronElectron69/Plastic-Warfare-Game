/* tail_expo.js — T5: v25 expansion-economy layout invariants, checked on the
   raw makeMap output across several seeds per map.
   Per map+seed: 4 natural expos (one per start, 10.5..15.7 tiles interior-ward),
   4 contested mid expos near the cardinal side lanes, each expo has 1 plastic +
   1 battery beside its centre, and every expo pocket is genuinely buildable:
   >=18 open tiles within r=4.5 AND a fully-open 3x3 (HQ-sized) square whose
   centre sits within 4.5 tiles of the expo centre. */
'use strict';
section('T5 expansion layout invariants (makeMap, 3 seeds per map)');
const EXPO_SEEDS=[11,5150,987654];
function open3x3(M,tx,ty){
 const N=M.N;
 if(tx<1||ty<1||tx>N-2||ty>N-2)return false;
 for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)if(!M.pass[(ty+y)*N+(tx+x)])return false;
 return true;
}
for(const mk of T_MAPS)for(const seed of EXPO_SEEDS){
 const M=makeMap(mk,seed),N=M.N,tag=`T5 ${mk}#${seed}`;
 const nats=M.expos.filter(e=>e.nat),mids=M.expos.filter(e=>!e.nat);
 ok(`${tag} 4 natural + 4 mid sites`,nats.length===4&&mids.length===4);
 // each start owns exactly one natural, 10.5..15.7 tiles away, toward the interior
 for(const s of M.starts){
  const near=nats.filter(e=>dhyp(e.x-s.x,e.y-s.y)<18);
  ok(`${tag} start(${s.x},${s.y}) has 1 natural in range`,near.length===1);
  if(near.length===1){
   const e=near[0],d=dhyp(e.x-s.x,e.y-s.y);
   ok(`${tag} natural dist ${d.toFixed(1)} in [10.5,17.3]`,d>=10.5&&d<=17.3);
   const dC0=dhyp(s.x-N/2,s.y-N/2),dC1=dhyp(e.x-N/2,e.y-N/2);
   ok(`${tag} natural is interior-ward of start`,dC1<dC0);
  }
 }
 // mid expos hug the four cardinal side-lane anchors
 const c=N/2,mq=Math.round((8+c)/2);
 const anchors=[[c,mq],[c,N-mq],[mq,c],[N-mq,c]];
 for(const [ax,ay] of anchors)
  ok(`${tag} mid site near lane (${ax},${ay})`,mids.some(e=>dhyp(e.x-ax,e.y-ay)<4.5));
 // every expo: 1 plastic + 1 battery within 2.6 tiles of centre
 for(const e of M.expos){
  const nn=M.nodes.filter(n=>dhyp(n.x-e.x,n.y-e.y)<2.6);
  ok(`${tag} expo(${e.x.toFixed(0)},${e.y.toFixed(0)}) has plastic+battery pair`,
     nn.some(n=>n.t==='plastic')&&nn.some(n=>n.t==='battery')&&nn.length===2);
 }
 // pocket buildability: >=18 open tiles in r=4.5, and an open 3x3 within 4.5 tiles
 for(const e of M.expos){
  let openN=0,sq=false;
  const x0=Math.max(0,Math.floor(e.x-4.5)),x1=Math.min(N-1,Math.ceil(e.x+4.5));
  const y0=Math.max(0,Math.floor(e.y-4.5)),y1=Math.min(N-1,Math.ceil(e.y+4.5));
  for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
   if(dhyp(tx+.5-e.x,ty+.5-e.y)>4.5)continue;
   if(M.pass[ty*N+tx])openN++;
   if(!sq&&open3x3(M,tx,ty))sq=true;
  }
  const kind=e.nat?'natural':'mid';
  ok(`${tag} ${kind} pocket >=18 open tiles (${openN})`,openN>=18);
  ok(`${tag} ${kind} pocket fits a 3x3 square`,sq);
 }
 // each contested mid site is guarded by a wildlife nest
 for(const e of mids)
  ok(`${tag} mid expo guarded by nest`,M.nests.some(ns=>dhyp(ns.x-e.x,ns.y-e.y)<6.5));
}
