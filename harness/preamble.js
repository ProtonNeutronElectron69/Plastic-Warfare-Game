'use strict';
let PASS=0,FAIL=0;const FAILS=[];
function ok(name,cond){if(cond){PASS++}else{FAIL++;FAILS.push(name);console.log('  FAIL: '+name)}}
function section(s){if(!process.env.QUIET)console.log('== '+s+' ==')} // v83: QUIET=1 drops the per-section headers; ok() already prints only failures, so a quiet run is failures plus the summary and nothing else

const T_MAPS=Object.keys(MAPS).filter(k=>!MAPS[k].survOnly); // v35: survival-only maps (Desk) get their own coverage in tail_v35
const T_MODES=['dm','ctf','koth'];
const T_DIFFS=Object.keys(DIFFS);          // easy,normal,hard
const T_FACS=Object.keys(FAC).filter(f=>f!=='bug');
const DT=1/30;
function cfg(map,mode,diff,fac,opp,seed){return{map,mode,diff,fac:fac||'green',opp:opp||3,seed}}
function run(n){for(let i=0;i<n;i++)update(DT)}
function boundsOK(){
 const N=G.map.N;
 for(const u of G.units){
  if(!isFinite(u.x)||!isFinite(u.y)||u.x<-2||u.y<-2||u.x>N+2||u.y>N+2)return 'unit '+u.key+' oob '+u.x+','+u.y;
  if(!isFinite(u.hp))return 'unit hp NaN';
 }
 for(const b of G.blds){if(!isFinite(b.hp))return 'bld hp NaN'}
 return null;
}
