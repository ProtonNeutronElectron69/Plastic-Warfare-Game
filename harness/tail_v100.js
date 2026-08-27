/* tail_v100.js - T77: three owner bug fixes, each one a thing the player could
   SEE was wrong (or could not see at all):

     A  Bail: the balloon's crew comes down under canopies instead of appearing
        on the ground on the tick the button was pressed
     B  Wildlife is selectable, and reading it does not break the panel
     C  Green's Supply Drop: crates fall under canopies, and the crate on the
        ground is CRATE_SC times life size with a pulsing halo

   THE ONE WORTH READING TWICE IS B. Wildlife was never "unselectable" in the
   sense of the click missing it - pickAt returned the creature and setSel stored
   it. What happened next is that refreshSelPanel THREW, every tick, because a
   creature is keyed by `species` into CREATURE and counterLine dereferenced
   B[undefined].aaOnly. The selection existed and the panel was simply never
   drawn. The fix is in counterLine (the one place that turns an entity into its
   counter lines) plus a creature branch in the panel, and it exposed a second
   latent bug: nothing removed a dead creature from G.sel, which was unreachable
   while nothing could select one.

   AND THE TRAP THIS RELEASE PAID FOR, RECORDED IN C: the crate's halo was first
   drawn inside drawCrate, i.e. inside the depth-sorted sprite band, where an
   additive glow adds against band content instead of the terrain - the exact
   cost the v94 record names for the heal glow. Moving it to the ground layer in
   renderCore then put the call ABOVE `inView`'s own const declaration, which
   threw a temporal-dead-zone error on every single frame; renderGuard swallowed
   it into a black board and one toast. Both were caught by looking at a real
   Chromium frame, and neither would have been caught by the headless suite -
   which is why C checks the ORDER of the two, in source, as well as the effect. */
'use strict';
section('T77 v100: bail canopies, selectable wildlife, and a crate you can find');

const DT100=1/30;
const cfg100=(fac,seed,opp)=>({map:'backyard',mode:'dm',diff:'normal',fac:fac||'green',opp:(opp==null?1:opp),seed});
function fresh100(seed,fac){G=null;newGame(cfg100(fac,seed));return G.human}
function put100(k,p,x,y){const u=makeUnit(k,p,x,y);u.state='idle';u.anchor={x,y};u.path=null;u.target=null;return u}
function bld100(k,p,dx,dy){const hq=p.blds.find(b=>b.key==='hq');const b=makeBuilding(k,p,Math.floor(hq.tx)+dx,Math.floor(hq.ty)+dy,true);b.prog=1;b.hp=b.mhp;b.abilityCool=0;return b}
function strike100(kind){return (G.strikes||[]).find(s=>s.kind===kind)}
function nocmt100(fn){return String(fn).replace(/\/\*[\s\S]*?\*\//g,' ').replace(/(^|[^:])\/\/[^\n]*/g,'$1')}
const crewN100=(p)=>p.units.filter(u=>u.hp>0&&BAIL_CREW.includes(u.key)).length;
let HTML100=null;
try{HTML100=require('fs').readFileSync('pw.html','utf8')}catch(e){HTML100=null}
const SCRIPT100=HTML100?HTML100.slice(HTML100.indexOf('<script>'),HTML100.indexOf('</script>')):'';

/* ---------- A: the crew comes down under silk ---------- */
{
 section('T77.A Bail puts the crew under canopies, not straight onto the ground');
 ok('T77.A pw.html is readable next to the harness', !!HTML100);
 const p=fresh100(1000101,'green');
 const hq=p.blds.find(b=>b.key==='hq');
 const bal=put100('balloon',p,hq.tx+4,hq.ty+4);
 /* the starting squad already contains men of these keys, so every count below
    is a DELTA against what stood before the button - never an absolute */
 const crew0=crewN100(p);
 execCmd({op:'bail',pi:p.i,a:{ids:[bal.id]}});
 const s=strike100('bailout');
 ok('T77.A the button starts a FALL rather than a spawn',
    !!s&&s.drops.length===BAIL_CREW.length&&s.drops.every(d=>!d.done));
 ok('T77.A ...and the balloon is gone at once, as it always was', bal.hp<=0);
 ok('T77.A nobody has landed yet: the crew is in the air', crewN100(p)===crew0);
 /* the fall time is the CONSTANT, read off the drop the strike carries */
 ok('T77.A the first canopy opens at BAIL_FALL_T', Math.abs(s.drops[0].delay-BAIL_FALL_T)<1e-9);
 ok('T77.A ...and the four are staggered, so they do not land as one block',
    s.drops.every((d,i)=>i===0||d.delay>s.drops[i-1].delay));
 for(let i=0;i<Math.floor(BAIL_FALL_T*30*0.5);i++)update(DT100);
 ok('T77.A half way down, still nobody on the ground',
    !!strike100('bailout')&&crewN100(p)===crew0);
 for(let i=0;i<90;i++)update(DT100);
 ok('T77.A and when the canopies touch down the whole crew is on the field',
    !strike100('bailout')&&crewN100(p)===crew0+BAIL_CREW.length);
 ok('T77.A ...one of each man BAIL_CREW names',
    BAIL_CREW.every(k=>p.units.some(u=>u.key===k&&u.hp>0)));

 /* the renderer draws it with the paradrop's own canopy routine, which is the
    owner's brief. Checked in source: a canvas is not reachable from here. */
 const ds=nocmt100(drawStrikes);
 ok('T77.A the canopy routine serves the bail-out alongside the paradrop',
    /s\.kind==='paradrop'\|\|s\.kind==='lift'\|\|s\.kind==='bailout'/.test(ds));
 ok('T77.A a strike with no owner reads its army from pi, and the fog gate with it',
    /s\.pi!=null\?G\.players\[s\.pi\]/.test(ds)&&/s\.drops&&s\.drops\.length/.test(ds));

 /* IT SURVIVES A SAVE. Men in the air are the Rapid Redeploy's guarantee and
    this inherits it: the strike is serialized, so a snapshot cut mid-fall lands
    them on schedule rather than losing four men. */
 const p2=fresh100(1000102,'green');
 const hq2=p2.blds.find(b=>b.key==='hq');
 const bal2=put100('balloon',p2,hq2.tx+4,hq2.ty+4);
 execCmd({op:'bail',pi:p2.i,a:{ids:[bal2.id]}});
 update(DT100);
 const blob=saveState();loadState(blob);
 const p3=G.players[p2.i];
 const crewMid=crewN100(p3);
 ok('T77.A a snapshot cut mid-fall still carries the men in the air',
    !!strike100('bailout')&&strike100('bailout').drops.length===BAIL_CREW.length);
 for(let i=0;i<90;i++)update(DT100);
 ok('T77.A ...and they land after the reload rather than being lost',
    crewN100(p3)===crewMid+BAIL_CREW.length);
}

/* ---------- B: wildlife reads ---------- */
{
 section('T77.B a creature can be selected and its stats read');
 const p=fresh100(1000201,'green');
 const ns=(G.map.nests||[])[0];
 ok('T77.B fixture: the map seeds nests', !!ns);
 const cr=spawnCreature(ns);
 const hq=p.blds.find(b=>b.key==='hq');
 cr.x=hq.tx+3;cr.y=hq.ty+3;
 for(let i=0;i<12;i++)update(DT100);

 /* THE REGRESSION ITSELF, at the one function that threw. counterLine is
    reached by the panel, the tooltips and the manual, so it is fixed there. */
 let threw=null;
 try{counterLine('creature',cr.species)}catch(e){threw=e.message}
 ok('T77.B counterLine answers a creature instead of throwing', threw===null);
 const cl=counterLine('creature',cr.species);
 ok('T77.B ...with two lines, the second naming its armor class',
    Array.isArray(cl)&&cl.length===2&&cl[1].indexOf(ARMOR_SHORT.bug)>=0);
 ok('T77.B ...and the armor it names is the one armorOf really gives it',
    armorOf(cr)==='bug');
 ok('T77.B a species it has never heard of degrades rather than throwing',
    (()=>{try{const r=counterLine('creature','notaspecies');return Array.isArray(r)&&r.length===2}catch(e){return false}})());
 /* MUTATION: the shape the old code reached for is genuinely absent, so this
    check is about a real failure and not a tautology */
 ok('T77.B MUTATION: the old path really had nothing to read',
    cr.key===undefined&&B[cr.key]===undefined);

 /* THE CLICK PATH, end to end: what the mouse does when it lands on a bug */
 const z=G.zoom;
 const mx=(isoX(cr.x,cr.y)-G.cam.x)*z, my=(isoY(cr.x,cr.y)-G.cam.y)*z-(cr.t.fly?12:6)*z;
 ok('T77.B pickAt finds the creature under the cursor', pickAt(mx,my)===cr);
 let selThrew=null;
 try{setSel([cr])}catch(e){selThrew=e.message}
 ok('T77.B selecting it does not throw', selThrew===null);
 ok('T77.B ...it really is the selection, and it knows it', G.sel.length===1&&G.sel[0]===cr&&cr.sel===true);
 const html=String(document.getElementById('selInfo').innerHTML||'');
 ok('T77.B the panel names the creature and the army it belongs to',
    html.indexOf(cr.t.n)>=0&&html.indexOf(FAC.bug.name)>=0);
 ok('T77.B ...and prints its health, which is what the owner asked to read',
    html.indexOf(Math.ceil(cr.hp)+'/'+cr.mhp+' HP')>=0);
 ok('T77.B ...and the counter lines ride under it like any other card',
    html.indexOf(ARMOR_SHORT.bug)>=0);
 /* it is a READOUT, not a command surface: no ability buttons follow. The
    column is SCRUBBED and the panel rebuilt first - the shim's innerHTML is a
    plain property, so setting it to '' detaches nothing and an earlier tail's
    buttons are still hanging there (the tail_v73 trap; this check passed alone
    and failed in the full segment until it did this). */
 ok('T77.B a creature offers no buttons - it is not yours to order',
    (function(){
      const pb=document.getElementById('prodBtns');
      while(pb&&pb.firstChild)pb.removeChild(pb.firstChild);
      lastSelSig='';refreshSelPanel();
      const out=[];(function w(n){if(n&&typeof n.className==='string'&&n.className.split(' ')[0]==='bb')out.push(n);(n&&n.children||[]).forEach(w)})(pb);
      return out.length===0;
    })());

 /* the field shows it too: ring and health bar, on drawBug */
 const db=nocmt100(drawBug);
 ok('T77.B a selected creature wears the same ring every selection wears',
    /cr\.sel/.test(db)&&db.indexOf("'#ffec6e'")>0);
 ok('T77.B ...and its health bar is shown while selected, not only when hurt',
    /cr\.hp<cr\.mhp\|\|cr\.t\.boss\|\|cr\.sel/.test(db));

 /* THE LATENT BUG THIS EXPOSED: a dead creature has to leave the selection, the
    way kill() drops a dead unit. Unreachable until wildlife became selectable. */
 cr.hp=0;
 for(let i=0;i<3;i++)update(DT100);
 ok('T77.B a creature that dies leaves G.neutrals', !G.neutrals.includes(cr));
 ok('T77.B ...and leaves the selection with it, instead of standing there dead',
    !G.sel.includes(cr));
 let panelThrew=null;
 try{lastSelSig='';refreshSelPanel()}catch(e){panelThrew=e.message}
 ok('T77.B ...and the panel survives the frame it died on', panelThrew===null);
}

/* ---------- C: the supply drop ---------- */
{
 section('T77.C crates fall under canopies and can be found on the ground');
 const p=fresh100(1000301,'green');
 const rt=bld100('radiotower',p,5,5);
 const before=G.crates.length;
 radioSupply(rt,rt.x+3,rt.y+3);
 const s=strike100('supply');
 ok('T77.C the call-down starts a fall', !!s&&s.drops.length===2&&s.drops.every(d=>!d.done));
 ok('T77.C nothing is on the ground while they are still under canopy',
    G.crates.length===before);
 ok('T77.C the pair are under silk for DROP_T, which is what its comment claims',
    Math.abs(s.drops[0].delay-DROP_T)<1e-9);
 for(let i=0;i<Math.ceil(DROP_T*30)+8;i++)update(DT100);
 ok('T77.C ...and both crates are on the ground when the canopies touch down',
    !strike100('supply')&&G.crates.length===before+2);
 ok('T77.C ...one of each resource, carrying the figures the ability promises',
    G.crates.some(c=>c.kind==='p'&&c.amt===DROP_P)&&G.crates.some(c=>c.kind==='e'&&c.amt===DROP_E));

 /* THE RENDERER. A crate hangs under the same canopy routine the men do, and
    the ground crate is drawn at CRATE_SC with a halo. */
 const ds=nocmt100(drawStrikes);
 ok('T77.C the supply drop rides the canopy routine too',
    /s\.kind==='supply'/.test(ds)&&/const crate=s\.kind==='supply'/.test(ds));
 ok('T77.C ...and what hangs under it is a crate wearing the resource colour',
    /d\.kind==='e'\?'#7fe3ff':'#ffb95e'/.test(ds));
 const dc=nocmt100(drawCrate);
 ok('T77.C the ground crate is drawn at CRATE_SC, not at life size',
    /c\.scale\(CRATE_SC,CRATE_SC\)/.test(dc)&&/plShadow\(c,sx,sy\+2,9\*CRATE_SC/.test(dc));
 ok('T77.C CRATE_SC is the doubling the owner asked for', CRATE_SC===2);
 ok('T77.C the halo is a PULSE off the clock and never off the seeded stream',
    typeof drawCrateGlow==='function'&&
    /Math\.sin\(G\.tick/.test(nocmt100(drawCrateGlow))&&
    nocmt100(drawCrateGlow).indexOf('srand')<0);
 ok('T77.C ...and it is additive, which is what makes it read as light',
    /globalCompositeOperation='lighter'/.test(nocmt100(drawCrateGlow)));

 /* THE TWO TRAPS THIS RELEASE PAID FOR, both invisible to a headless run.
    1. the halo must NOT be inside drawCrate: the sprite band composites
       additively against band content, not against the terrain (v94).
    2. it must be called BELOW inView's own const declaration in renderCore,
       or it throws a temporal-dead-zone error on every frame that renderGuard
       swallows into a black board. */
 ok('T77.C the halo is not drawn inside the sprite band painter',
    dc.indexOf('drawCrateGlow')<0&&dc.indexOf("globalCompositeOperation='lighter'")<0);
 if(SCRIPT100){
  const rc=SCRIPT100.indexOf('function renderCore()');
  const decl=SCRIPT100.indexOf('const inView=(x,y)=>',rc);
  const call=SCRIPT100.indexOf('drawCrateGlow(c,cr)',rc);
  ok('T77.C renderCore both declares inView and calls the halo', rc>0&&decl>rc&&call>rc);
  ok('T77.C ...and the call sits BELOW the declaration, or every frame throws',
     call>decl);
  /* `call` is the CALL inside renderCore, found from rc - searching the whole
     script would land on `function drawCrateGlow(c,cr){`, which is the
     definition and carries no gate at all. That is how the first cut of this
     check failed itself. */
  const line=SCRIPT100.slice(SCRIPT100.lastIndexOf('\n',call),call+30);
  ok('T77.C only your own crates glow, and only in live vision',
     /cr\.pi===G\.human\.i/.test(line)&&/fogAt\(cr\.x,cr\.y\)===2/.test(line));
 }
 /* PRESENTATION ONLY: a bigger crate is not an easier one to collect */
 const p4=fresh100(1000302,'green');
 const rt4=bld100('radiotower',p4,5,5);
 G.crates.length=0;
 G.crates.push({x:rt4.x+6,y:rt4.y+6,pi:p4.i,kind:'p',amt:DROP_P});
 const man=put100('grunt',p4,rt4.x+6+CRATE_R+0.35,rt4.y+6);
 const bank=p4.res.p;
 updateCrates();
 ok('T77.C a man just outside CRATE_R still does not collect it',
    G.crates.length===1&&p4.res.p===bank);
 man.x=rt4.x+6+CRATE_R*0.5;
 updateCrates();
 ok('T77.C ...and inside it he does: the radius is untouched by the new size',
    G.crates.length===0&&p4.res.p===bank+DROP_P);
}
