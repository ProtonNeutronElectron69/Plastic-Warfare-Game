/* ---------------- MAIN LOOP ---------------- */
let lastT=0,acc=0,RDT=1/60; // v41: wall-clock render delta (s), drives the cosmetic turret slew
function frame(t){
 requestAnimationFrame(frame);
 if(!G){lastT=t;return}
 // v56: the SPECTATOR SPEED lives here and nowhere else. The clamp above is
 // applied first, so even 2x can only ever bank 200ms = 6 steps in one frame;
 // the step below stays 1000/30 and update() below stays 1/30, so the sim runs
 // the same ticks in the same order and only the wall-clock pacing moves.
 const _fdt=Math.min(t-lastT,100);RDT=_fdt/1000;acc+=_fdt*((G.watch&&G.wspeed)||1);lastT=t;const step=1000/30;
 while(acc>=step){if(G.net&&!G.net.dead)netStep();else if(!G.paused&&!G.over)update(1/30);acc-=step}
 if(!G.bootDone&&G.tick>1){
  G.bootDone=true;
  msg('Your Dump Trucks are harvesting. Right-click resources to redirect them.');
  document.getElementById('pausedTag').style.display='none';document.getElementById('pauseBtn').textContent='⏸ Pause';
 }
 updateMineAmbience();
 if(!INFO.open)render(); // v46: the manual is a full-screen opaque overlay; the sim keeps ticking, the board just is not redrawn behind it
}
