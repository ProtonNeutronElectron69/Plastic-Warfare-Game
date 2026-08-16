/* tail_v39.js — T19: player-count wave scaling + late-wave floor
   G1 every enemy count x (1 + 0.2*(players-2)): 1p .8x, 2p 1x, 3p 1.2x, 4p 1.4x (any human/CPU mix)
   G2 from wave 7 on, every wave spawns >=10 ants and >=5 fire ants, guaranteed after scaling/jitter */
'use strict';
section('T19 v39: player-count scaling + late-wave floor');

function survCfgN(map,opp,seed){return{map,mode:'surv',diff:'normal',fac:'green',opp,seed};}
// deterministically spawn wave `waveNo` at a given ally count and count creatures
function waveCount(opp,waveNo,seed,species){
 G=null;newGame(survCfgN('backyard',opp,seed));
 G.surv.no=waveNo-1;G.surv.t=0.0001;update(DT);
 const f=(G.neutrals||[]).filter(cr=>cr.wave);
 return species?f.filter(cr=>cr.species===species).length:f.length;
}

/* T19.1: +/-20% per player vs the 2-player baseline (jitter-averaged over seeds) */
{
 const avg=opp=>{let s=0;const N=12;for(let i=0;i<N;i++)s+=waveCount(opp,1,52000+i,'ant');return s/N;};
 const a1=avg(0),a2=avg(1),a3=avg(2),a4=avg(3); // 1..4 players
 ok('T19.1 wave-1 ant count rises with player count (1p<2p<3p<4p)',a1<a2&&a2<a3&&a3<a4);
 ok('T19.1 1-player ~= 0.8x the 2-player baseline',Math.abs(a1/a2-0.8)<0.13);
 ok('T19.1 3-player ~= 1.2x the 2-player baseline',Math.abs(a3/a2-1.2)<0.13);
 ok('T19.1 4-player ~= 1.4x the 2-player baseline',Math.abs(a4/a2-1.4)<0.15);
}

/* T19.2: waves 7+ floor at >=10 ants and >=5 fire ants, at every player count and roll */
{
 let antsOK=true,faOK=true;
 for(const opp of [0,1,2,3])for(const w of [7,10,12,14,15])for(let s=0;s<3;s++){
  if(waveCount(opp,w,53000+s*7,'ant')<10)antsOK=false;
  if(waveCount(opp,w,53000+s*7,'fireant')<5)faOK=false;
 }
 ok('T19.2 every wave 7+ spawns >=10 ants (all player counts)',antsOK);
 ok('T19.2 every wave 7+ spawns >=5 fire ants (all player counts)',faOK);
 // the floor does NOT reach earlier waves: wave 5 carries no ants in the table and stays ant-less
 ok('T19.2 floor starts at wave 7 (wave 5 injects no ants)',waveCount(1,5,53600,'ant')===0);
 // a wave that already exceeds the floor keeps its (larger) scaled count, not clamped to 10
 ok('T19.2 floor is a minimum, not a cap (wave 6 ants > 10 at 4p)',waveCount(3,6,53700,'ant')>10);
}
