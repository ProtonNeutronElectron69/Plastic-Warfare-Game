/* ---------------- NEW GAME ---------------- */
/* v43: the AI brain literal used to be duplicated verbatim in newGame and in
   execCmd's 'aiTakeover' case, which meant two places had to stay bit-identical
   or a mid-match takeover would desync a lockstep match. One builder now.
   Every bot gets a PRIVATE copy of its profile with each numeric field jittered
   +-20% (v22), so two bots sharing a profile never play identically, plus a random
   phase offset so they don't act in lockstep. Timing fields are in AI-TICKS.
   The srand() draw order below is exactly the v42 order; do not reorder it. */
function makeAIBrain(profKey){
 const base=AI_PROFILES[profKey];
 const jit=v=>v*(0.8+srand()*0.4);
 const pr={};for(const k in base){const v=base[k];
  if(typeof v==='number')pr[k]=k==='defendFrac'?Math.min(0.6,jit(v)):jit(v);
  else if(Array.isArray(v))pr[k]=v.map(x=>Math.max(1,Math.round(jit(x))));
  else pr[k]=v;}
 if(pr.harassSize)pr.harassSize[1]=Math.max(pr.harassSize[0],pr.harassSize[1]);
 /* v59: ONE composition roll per bot per match. Each class share is nudged +-10%
    and the result renormalized back to 1, so two bots on the same profile do not
    converge on an identical shopping list. Three srand() draws, APPENDED here so
    every draw before this point keeps its v42 position; everything after it moves
    by three, which is what repin_v59.py exists to absorb. */
 const mwB=base.mixWant||{inf:1,veh:0,air:0};
 const mw={};
 let mwS=0;
 for(const k in mwB){mw[k]=mwB[k]*(0.9+srand()*0.2);mwS+=mw[k];}
 if(mwS>0)for(const k in mw)mw[k]/=mwS;
 pr.mixWant=mw;
 const phase=srand()*40;
 return {
  profile:profKey, pr,
  /* v84: the encounter ledger. Plain data on the brain, which is all it needs to
     be persisted - _encAi copies every key it does not special-case and loadState
     spreads the decoded object straight back, so this survives a save with no
     encoder edit. It HAS to survive one: T3 asserts a snapshot resumes
     bit-identical, and a bot reloading with amnesia would pick differently from
     the run it was cut from. saveState stringifies, so there is no aliasing
     between the live ledger and a held snapshot to worry about. */
  enc:{inf:0,light:0,medium:0,heavy:0,air:0},
  phase:'build',
  // timing/size seeded from the profile, then individually jittered
  nextPush:pr.firstPush*(0.8+srand()*0.5)+phase,
  pushSize:pr.pushBase+Math.floor(srand()*3),
  nextScout:pr.scoutEvery*srand()*0.6,
  nextHarass:pr.harassEvery*(0.4+srand()*0.5),
  staging:null,defend:0,lastHurt:-999,
  // v22: expansion timer replaces the old one-shot outpost flag; defensive/turtle
  // profiles expand too, just much later (delayed-expand instead of never)
  nextExpand:pr.expand?55+srand()*70:250+srand()*180,
  nextSkirm:50+srand()*70,
  stagePt:null,stageT:0,
  waveId:0,waveT:0,
  moodAt:700+srand()*1500,moodDone:false,feintDone:false,
  rivalIdx:Math.floor(srand()*1000),
  // standing preference for WHICH foe to favor; re-rolled occasionally so
  // rivalries shift over a long game instead of being fixed forever
  grudge:null, grudgeT:0,
  t:Math.floor(phase*0.5) // stagger their internal clocks too
 };
}
function newGame(s){
 document.getElementById('setup').style.display='none';
 document.getElementById('hud').style.display='block';
 document.getElementById('overlayCenter').style.display='none';
 EID=1;
 G={tick:0,over:false,paused:false,mode:s.mode,diff:DIFFS[s.diff]||DIFFS.normal,units:[],blds:[],parts:[],projs:[],players:[],flags:[],pings:[],atkPings:[],lastEvent:null,strikes:[],crates:[],radioTargeting:null,timers:[],cmdQ:[],spectate:false,net:null,hazAcc:0,dayOff:0,
    cam:{x:0,y:0},zoom:1,shake:0,sel:[],placing:null,barrDrag:null,amove:false,groups:{},msgT:0,humanSeen:new Set(),
    test:!!s.test,watch:!!s.watch}; // v50: the sandbox flag, set before makeMap so every downstream branch sees it. v55: watch = spectate mode
 // v55: a spectate match is ALWAYS WATCH_ARMIES armies. survivalSetup(s) below
 // reads s.opp to size the arena and the starter economy, and it runs before the
 // slot list exists, so the count is forced here - onto a COPY, so the caller's
 // config object is never mutated and G.matchCfg stores the corrected one. An
 // explicit slot list (harness / lobby) is authoritative and left alone.
 if(G.watch){
  if(!(s.slots&&s.slots.length)&&s.opp!==WATCH_ARMIES-1)s=Object.assign({},s,{opp:WATCH_ARMIES-1});
  G.spectate=true; // v23's full-vision flag: fog, the radio panel and the elimination toast all read it already
 }
 G.seed=(s.seed!=null?s.seed:(Math.random()*1e9)|0);   // shared match seed (v23)
 G.rngS=(G.seed^0x9E3779B9)|0;                          // sim RNG state (mulberry32)
 G.matchCfg=s;
 G.map=makeMap(s.map,G.seed);
 if(s.mode==='surv')survivalSetup(s); // v33: central cluster + arena + starter economy
 G.orgX=G.map.N*HW+TW;
 initPF(G.map.N);
 // players (v23: built from an explicit slot list so the local setup screen, the
 // online lobby, and the test harness all construct matches through one code path.
 // slot: {ctrl:'human'|'cpu'|'closed', fac, diff, name, local}. Every client in an
 // online match receives an identical slot list; only the 'local' flag (which slot
 // is ME) differs per client, and it is never read by simulation code.)
 let slots=(s.slots&&s.slots.length)?s.slots.filter(sl=>sl&&sl.ctrl!=='closed'):null;
 if(!slots){
  const facs=Object.keys(FAC).filter(f=>f!=='bug');
  const others=facs.filter(f=>f!==s.fac);
  for(let i=others.length-1;i>0;i--){const j=Math.floor(srand()*(i+1));[others[i],others[j]]=[others[j],others[i]]}
  // v55: in a spectate match slot 0 is a bot too and NOTHING is local, so the
  // whole roster is CPU and every faction fields exactly one army. The faction
  // shuffle above is untouched, so the srand draw order - and therefore every
  // seeded layout - is identical to a normal match of the same size.
  slots=[{ctrl:G.watch?'cpu':'human',fac:s.fac,diff:s.diff,local:!G.watch,team:(s.teams&&s.teams[0])||1}];
  const nOpp=G.watch?WATCH_ARMIES-1:s.opp;
  for(let k=0;k<nOpp;k++)slots.push({ctrl:'cpu',fac:others[k],diff:s.diff,team:(s.teams&&s.teams[k+1])||k+2}); // v29: per-slot teams
 }
 // v50 TESTING MODE: every slot boots human-controlled. No slot is handed an AI
 // brain, so update()'s `if(p.ai&&...)aiTick(p)` gate simply never fires - the AI
 // is off because there is nothing to tick, not because a new branch suppresses it.
 if(G.test)slots=slots.map(sl=>({...sl,ctrl:'human'}));
 const order=slots.map(sl=>sl.fac);
 // shuffle start spots
 const spots=G.map.starts.slice();for(let i=spots.length-1;i>0;i--){const j=Math.floor(srand()*(i+1));[spots[i],spots[j]]=[spots[j],spots[i]]}
 // --- assign each AI a distinct behavior PROFILE, drawn without replacement so a
 //     3-AI match always feels varied. Each profile tunes wave timing/size, how
 //     defensive they are, whether they scout/harass, and who they like to hit. ---
 const aiProfiles=shuffle(Object.keys(AI_PROFILES));
 let aiSeq=0;
 order.forEach((fac,i)=>{
  const sl=slots[i];
  let ai=null;
  if(sl.ctrl==='cpu'){
   const profKey=aiProfiles[aiSeq%aiProfiles.length];aiSeq++;
   ai=makeAIBrain(profKey);
  }
  const p={i,fac,team:(sl.team!=null?sl.team:i+1),human:sl.ctrl==='human',name:sl.name||null,diff:DIFFS[sl.diff]||G.diff||DIFFS.normal,res:{p:550,e:200},units:[],blds:[],alive:true,score:0,kothScore:0,
   stats:{built:0,lost:0,kills:0,mined:0},ai,start:spots[i],
   tech:new Set(),techDone:new Set(),techQ:[]};
  G.players.push(p);
 });
 // v29: teams — matching numbers ally. An all-one-team lobby could never end, so it falls back to FFA.
 if(G.mode==='surv')G.players.forEach(p=>{p.team=1;}); // v33: survival is co-op, everyone allied
 else if(!G.test&&G.players.length>1&&new Set(G.players.map(p=>p.team)).size===1)G.players.forEach((p,idx)=>{p.team=idx+1;}); // v50: in testing mode an all-one-team pick is a deliberate choice, not a lobby accident
 // v50: testing mode grants every research project up front. techAvailable() filters
 // it, so an army never learns another faction's exclusives; and because this runs
 // BEFORE the starting-base loop below, makeBuilding's hasTech('up_'+key) check sees
 // the upgrades and the starting HQ + guard tower come out already upgraded.
 // applyUpgrade is not called: it only walks p.blds, which is still empty here.
 if(G.test)for(const p of G.players)for(const k in RESEARCH){if(!techAvailable(p,k))continue;p.tech.add(k);p.techDone.add(k);}
 // v29: per-player stat history for the end-of-match chart (sampled in update())
 G.statHist={iv:150,t:[],rows:G.players.map(()=>({av:[],kl:[],mn:[]}))};
 G.human=G.players[Math.max(0,slots.findIndex(sl=>sl.local))];  // the LOCAL player (UI/fog only; sim never branches on it)
 renderTerrain();
 if(!SPR.done)bakeSprites();
 bakeMapSprites();
 G.fog=new Uint8Array(G.map.N*G.map.N); // 0 unexplored 1 explored 2 visible
 if(G.test||G.watch)G.fog.fill(2); // v50: lit from tick 0, so footprintVisible passes before updateFog has ever run. v55: same for a spectator
 G.fogCv=document.createElement('canvas');G.fogCv.width=G.map.N;G.fogCv.height=G.map.N;
 G.ghost={blds:new Map(),nodes:[],nests:[],stampQ:[],goneNodes:[]}; // v26: client-local last-seen snapshots + deferred terrain decals
 initNeutrals();
 // starting base
 for(const p of G.players){
  const st=p.start;
  const hq=makeBuilding('hq',p,Math.round(st.x-1.5),Math.round(st.y-1.5),true);
  makeUnit('truck',p,st.x+2.5,st.y+2.5);makeUnit('truck',p,st.x-2.5,st.y+2.5);
  makeUnit('grunt',p,st.x+2.5,st.y-2.5);makeUnit('grunt',p,st.x-2.5,st.y-2.5);
  // every team starts with one guard tower near HQ to discourage early rushes.
  // try a ring of candidate spots toward map center; fall back to any open tile.
  (function placeStartTower(){
   const cx=G.map.N/2,cy=G.map.N/2,baseAng=datan2(cy-st.y,cx-st.x);
   // prefer spots between HQ and map center (where attacks come from)
   for(let spread=0;spread<6.29;spread+=0.5){
    for(const sgn of [1,-1]){
     const a=baseAng+sgn*spread, r=3.2;
     const tx=Math.round(st.x+dcos(a)*r-0.5), ty=Math.round(st.y+dsin(a)*r-0.5);
     if(canPlaceTower(tx,ty)){makeBuilding('guardtower',p,tx,ty,true);return;}
    }
   }
   // last resort: scan outward rings
   for(let r=3;r<7;r++)for(let i=0;i<24;i++){const a=i/24*6.28;const tx=Math.round(st.x+dcos(a)*r-0.5),ty=Math.round(st.y+dsin(a)*r-0.5);if(canPlaceTower(tx,ty)){makeBuilding('guardtower',p,tx,ty,true);return;}}
  })();
  p.stats.built=0;
  if(G.mode==='ctf'){const fx=st.x+(st.x<G.map.N/2?4.5:-4.5),fy=st.y;G.flags.push({owner:p,hx:fx,hy:fy,x:fx,y:fy,carrier:null,home:true})}
 }
 // King of the Hill: one contested zone at map centre
 if(G.mode==='koth'){G.hill={x:G.map.N/2+0.5,y:G.map.N/2+0.5,r:KOTH_R,holder:null};}
 if(G.mode==='surv'){G.surv={no:0,t:SURV_BUILD,done:false,fx:G.map.N/2+0.5,fy:G.map.N/2+0.5};} // v33
 /* v101: every match starts at a random point in the day/night cycle. One
    srand() draw, APPENDED as the last consumer in newGame on the v59 rule -
    every draw before this point keeps its position, everything after moves by
    one, which is what repin_v101 absorbed. In ticks, not seconds, so dayPhase
    stays pure integer arithmetic off G.tick. Hashed and serialized (the v-rule
    for new sim state); testing mode never reads it - dayPhase pins the sandbox
    to noon - but the draw is taken there too, so the stream never forks on the
    mode. */
 G.dayOff=Math.floor(srand()*DAY_CYCLE_T*30);
 // camera on human base
 const hs=G.human.start;
 G.cam.x=isoX(hs.x,hs.y)-vpW()/2/G.zoom;G.cam.y=isoY(hs.x,hs.y)-vpH()/2/G.zoom;
 updateTopbar();
 msg(G.mode==='dm'?('Destroy every enemy structure! '+(DM_TIME>0&&!G.test?'Time limit '+dmMMSS(DM_TIME)+' \u2014 if it runs out, the biggest base still standing wins.':'')):G.mode==='ctf'?'Capture the enemy flag '+CTF_TARGET+' times! Your flag must be home to score.':G.mode==='koth'?`Hold the central hill! Control it alone for ${KOTH_TARGET}s to win.`:'🛡️ Wave Survival: defend the central flag through all '+SURV_WAVE_N+' waves! First wave in 1:00.');
 if(matchTeamed()&&G.mode!=='surv')msg('🤝 Team battle: allied armies share vision and win together.'); // v29
 if(!G.watch){ // v55: the tutorial lines address a commander; a spectator has no barracks to build
 msg('Build a Barracks to train your army.');
 msg('Unlock units at the building that makes them; the Lab unlocks structures & other upgrades.');
 msg('Plastic ⬢ = the glowing toy piles. Electricity ⚡ = giant AA batteries.');
 msg('Watch the terrain: spills block ground units and burn hazards slow & sting. Wildlife nests bite intruders and rebuild their swarm until you smash them.');
 msg('Hidden landmines are buried across the map; a tank takes the full blast, lighter units die from nearby. Lay your own Barricades (click-and-drag) to wall off lanes.');
 }
 document.getElementById('facDot').style.background=FAC[G.human.fac].color;
 document.getElementById('facName').textContent=FAC[G.human.fac].name;
 armySwitchUI(); // v50: the army chips (hidden unless G.test)
 if(G.test)msg('🧪 Testing mode: all '+G.players.length+' armies are yours. Tab or the top-bar chips switch sides.');
 if(G.watch)watchInit(); // v55: meter and the spectator box (v72 retired the panel this used to hide)
}

