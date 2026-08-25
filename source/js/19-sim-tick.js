/* ---------------- MAIN UPDATE ---------------- */
function update(dt){
 G.tick++;
 // v23: first-tick auto-harvest for EVERY human player's trucks. This used to live
 // in frame() (render side) for the single human; it must be inside the sim so all
 // lockstep clients run it on the same tick.
 if(G.tick===1){for(const p of G.players)if(p.human)for(const u of p.units)if(u.key==='truck'){const n=findNode(u);if(n)orderHarvest(u,n)}}
 execCmds();
 for(const u of G.units.slice())updateUnit(u,dt);
 separation();
 updateHazards(dt);
 updateNeutrals(dt);
 updateStrikes(dt);
 updateCrates(); // v86: after the strikes, so a crate that lands this tick can be collected on the next one rather than the same one
 if(G.timers&&G.timers.length){for(let i=G.timers.length-1;i>=0;i--){const tm=G.timers[i];tm.t-=dt;if(tm.t<=0){G.timers.splice(i,1);try{tm.fn()}catch(e){}}}}
 for(const b of G.blds.slice())updateBld(b,dt);
 updateProjs(dt);
 if(G.mode==='ctf')updateFlags();
 if(G.mode==='koth')updateHill(dt);
 if(G.mode==='dm')dmClock(); // v69: the deathmatch limit, read off G.tick
 if(G.mode==='surv')updateSurv(dt); // v33
 tickBurns(dt); // v33: fire-ant DoT
 if(G.statHist&&(G.tick===1||G.tick%G.statHist.iv===0))statSample(); // v29: end-chart sampling
 if(G.pings.length){for(let i=G.pings.length-1;i>=0;i--){G.pings[i].t+=dt;if(G.pings[i].t>4)G.pings.splice(i,1);}}
 if(G.atkPings&&G.atkPings.length){for(let i=G.atkPings.length-1;i>=0;i--){G.atkPings[i].t+=dt;if(G.atkPings[i].t>2.5)G.atkPings.splice(i,1);}}
 for(let i=G.parts.length-1;i>=0;i--){
  const p=G.parts[i];p.life-=dt;
  if(p.life<=0){G.parts.splice(i,1);continue}
  if(p.t==='sh'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=160*dt;p.ang+=p.va*dt;if(p.z<0){p.z=0;p.vz*=-.35;p.vx*=.5;p.vy*=.5;if(Math.abs(p.vz)<8)p.vz=0}}
  else if(p.t==='db'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=180*dt;p.ang+=p.va*dt;if(p.z<0){p.z=0;p.vz*=-.4;p.vx*=.55;p.vy*=.55;p.va*=.6;if(Math.abs(p.vz)<10)p.vz=0}}
  else if(p.t==='sk'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=120*dt;if(p.z<0)p.z=0}
  else if(p.t==='em'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=70*dt;p.vx*=.96;p.vy*=.96;if(p.z<0){p.z=0;p.vz=0}}
  else if(p.t==='sm'){p.z+=p.vz*dt;p.x+=(p.vx||0)*dt;p.y+=(p.vy||0)*dt;p.r+=(p.grow!=null?p.grow:6)*dt;p.vz*=.985;if(p.rot)p.seed=(p.seed||0)+p.rot*dt;}
  else if(p.t==='fb'){p.z+=p.vz*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vz*=.9;p.r+=10*dt;}
  else if(p.t==='du'){p.r+=46*p.sc*dt;}
  else if(p.t==='sw'){/* ring expansion handled in render via life */}
  else if(p.t==='fl'){p.z+=p.vz*dt;p.x+=(p.vx||0)*dt;p.y+=(p.vy||0)*dt;p.r+=4*dt;}
 }
 for(const p of G.players)if(p.ai&&G.tick%18===p.i*5%18)aiTick(p);
 if(G.tick%5===0)updateFog();
 if(G.watch&&G.tick%30===0)meterSample(); // v55: one income sample per second of SIM time (G.tick, never the clock)
 if(G.tick%10===0){updateTopbar();refreshSelPanel();refreshArmyPanel();refreshRadioPanel();refreshWatchPanel()}
 if(G.shake>0)G.shake=Math.max(0,G.shake-dt*22);
 const spd=520*dt;
 if(KEY.ArrowLeft||KEY.a)G.cam.x-=spd; if(KEY.ArrowRight||KEY.d)G.cam.x+=spd;
 if(KEY.ArrowUp||KEY.w)G.cam.y-=spd; if(KEY.ArrowDown||KEY.s2)G.cam.y+=spd;
 if(MOUSE.inside){
  if(MOUSE.x<14)G.cam.x-=spd; if(MOUSE.x>view.width-14)G.cam.x+=spd;
  /* v90.2: this read `MOUSE.y<14&&MOUSE.y>44`, which no number satisfies - pushing
     the TOP edge has never scrolled the camera, in any release, while the help
     text has promised "push the screen edge" since v43. The intent is legible
     from the dead constant: a 14px band starting where the bar ends, because the
     first 44px of the window was chrome. Both halves are fixed here, and the
     bound is TOPBAR_H rather than a literal because this release is what made 44
     wrong twice over. Camera only - G.cam is neither hashed nor serialized. */
  if(MOUSE.y>TOPBAR_H&&MOUSE.y<TOPBAR_H+14)G.cam.y-=spd; if(MOUSE.y>view.height-14)G.cam.y+=spd;
 }
 G.cam.x=clamp(G.cam.x,-200,G.terr.width-view.width/G.zoom+200);
 G.cam.y=clamp(G.cam.y,-150,G.terr.height-view.height/G.zoom+150);
}

