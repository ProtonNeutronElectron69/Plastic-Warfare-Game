/* ============================================================================
   T98 - v113: THE BALANCE PASS - Blue, Gray, and the two defensive doctrines
   The owner asked for a pass on the two armies that do not win and the two bot
   doctrines that never do. Rule 8 first: two default 16-match batches on v112
   reproduced the v103 ordering (Tan 47%, Green 31%, Gray 12%, Blue 9%;
   'defensive' 0 of 29, 'turtle' 4 of 25) AND showed that sim.sh's seeded
   doctrine deal is uneven across armies (Blue drew the dead doctrine 12 times
   in 32, Tan 5), so the release built the controlled batches first
   (probe_v113.sh: A holds every seat on 'balanced', C deals doctrines evenly)
   and measured every change on its own against that baseline. What the
   controlled runs said, and what this file pins:
   - the two defensive doctrines mined ~2,000 a minute from MINUTE TWO against
     3,000-3,800, because their first outpost came 2.5-4.3 minutes in against
     everyone else's 0.5-1.2. expandAt on the profile: later, not three minutes
     later. 'defensive' 0/16 -> 3/16, 'turtle' 1/16 -> 3/16 on that change alone.
   - Blue's most-built unit was the Signal Runner (44 a match; 82 with every
     seat on 'balanced'), the unit the table calls weaker than a Grunt, because
     the faction floor narrowed the Barracks pool to him. He is support now.
   The Blue and Gray numbers that ship are pinned in the sections that name
   them; every row of the measurement is in harness/README.md.
   ==========================================================================*/
section('T98 v113: the balance pass');

/* ---------- A: the expansion clock is a doctrine trait ---------- */
section('T98.A expandAt: the two defensive doctrines claim an outpost later than the others, not three minutes later');
{
 const P=AI_PROFILES,ks=Object.keys(P);
 ok('T98.A every doctrine declares expandAt as a [base,jitter] pair of AI-ticks', ks.every(k=>Array.isArray(P[k].expandAt)&&P[k].expandAt.length===2&&P[k].expandAt.every(v=>v>0)));
 ok('T98.A the three expanders keep the v22 clock (55+70r)', ['aggressive','balanced','harasser'].every(k=>P[k].expandAt[0]===55&&P[k].expandAt[1]===70&&P[k].expand===true));
 ok('T98.A defensive and turtle expand LATER than the expanders and in that order, and both well inside the old 250+180r',
    P.defensive.expandAt[0]>55&&P.turtle.expandAt[0]>P.defensive.expandAt[0]&&
    P.defensive.expandAt[0]+P.defensive.expandAt[1]<250&&P.turtle.expandAt[0]+P.turtle.expandAt[1]<250&&P.defensive.expand===false&&P.turtle.expand===false);
 ok('T98.A the transcribed pairs, so the next retune declares itself here', P.defensive.expandAt.join()==='100,80'&&P.turtle.expandAt.join()==='120,90');
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:3,seed:660113});
 /* makeAIBrain jitters every array field +-20% per element (the same treatment
    repeat and aa get), so the pair a brain reads is the profile's pair within
    that band - two more srand draws per brain, which is part of why every trail
    moved and was recut */
 const inRange=(k,n)=>{for(let i=0;i<n;i++){const b=makeAIBrain(k);const e=P[k].expandAt;if(!(b.nextExpand>=e[0]*0.8-1&&b.nextExpand<(e[0]+e[1])*1.2+1))return false}return true};
 ok('T98.A makeAIBrain reads the pair: fifty brains per doctrine all land inside its jittered band', ks.every(k=>inRange(k,50)));
 ok('T98.A ...and a defensive brain never expands as late as a v112 one could (250+)', (()=>{for(let i=0;i<50;i++)if(makeAIBrain('turtle').nextExpand>=250)return false;return true})());
 const src=makeAIBrain.toString(),line=(src.match(/nextExpand:[^\n]*/)||[''])[0];
 ok('T98.A the clock is still ONE srand draw on its line', (line.match(/srand\(\)/g)||[]).length===1);
 ok('T98.A a profile without the pair falls back to the v22 pair for its expand flag', /pr\.expandAt\|\|\(pr\.expand\?\[55,70\]:\[250,180\]\)/.test(src));
}

/* ---------- B: the Signal Runner is support ---------- */
section('T98.B the Signal Runner is a support unit to the bot: never a line fighter, never a share of the floor, fielded like a medic');
{
 ok('T98.B AI_SUPPORT names the runner beside the medic, the APC and the Chinook', !!AI_SUPPORT.runner&&!!AI_SUPPORT.medic&&!!AI_SUPPORT.chinook&&!!AI_SUPPORT.truck);
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'blue',opp:1,seed:660113});
 const p=G.human;
 for(const u of p.units.slice())kill(u);
 for(let i=0;i<10;i++)makeUnit('grunt',p,p.start.x+2+i*.3,p.start.y+2);
 for(let i=0;i<10;i++)makeUnit('runner',p,p.start.x+2+i*.3,p.start.y+3);
 ok('T98.B aiFacShare counts ten grunts and ten runners as an army with NO exclusive share (a runner is not in the floor\'s numerator or its denominator)', aiFacShare(p)===0);
 let bl=p.blds.find(b=>b.key==='barracks');
 if(!bl){bl=makeBuilding('barracks',p,Math.floor(p.start.x)+4,Math.floor(p.start.y)+4,true);bl.prog=1;}
 ok('T98.B (fixture) the Blue seat has a finished Barracks to train from', !!bl&&bl.prog>=1&&p.blds.includes(bl));
 /* the support block: hand the seat to a bot, give it the tech and the plastic,
    and count what it queues for a small army and for a large one */
 execCmd({op:'aiTakeover',pi:p.i,a:{diff:'normal'}});
 p.tech.add('u_runner');p.res.p=9000;p.res.e=2000;
 for(let i=0;i<4;i++){const d=makeBuilding('supply',p,Math.floor(p.start.x)-6+i*3,Math.floor(p.start.y)-6,true);d.prog=1;} // supply for a thirty-man army: trainUnit refuses past the cap
 ok('T98.B (fixture) the seat has a brain and room to train', !!p.ai&&supFree(p)>=20);
 const runnersQueued=()=>p.blds.reduce((n,b)=>n+b.queue.filter(k=>k==='runner').length,0)+p.units.filter(u=>u.key==='runner'&&u.hp>0).length;
 for(const u of p.units.slice())if(u.key==='runner')kill(u);
 for(let i=0;i<40;i++)aiTick(p);
 const small=runnersQueued();
 for(let i=0;i<20;i++)makeUnit('grunt',p,p.start.x+2+i*.3,p.start.y+4);   // 30 fighters now
 for(let i=0;i<40;i++)aiTick(p);
 const large=runnersQueued();
 ok(`T98.B ten fighters earn one runner, thirty earn two, never more (${small}, ${large})`, small<=1&&large>=1&&large<=2);
 ok('T98.B the rule is the medic\'s shape and is gated on the support flag, so V113_OFF=runner in the simulator reverts it whole', /AI_SUPPORT\.runner&&hasTech\(p,'u_runner'\)[^\n]*Math\.min\(2,Math\.floor\(army\.length\/10\)\)\)supTrain\('runner','barracks'\)/.test(aiTick.toString()));
 ok('T98.B the runner keeps his row: Blue\'s Barracks exclusive, an infantryman, the Radio Net and Sprint', FAC.blue.uu.includes('runner')&&U.runner.a==='inf'&&U.runner.rnet===1&&U.runner.sprint===1);
}

/* ---------- C: the floor is per army when the row says so ---------- */
section('T98.C facFloor: the faction quota reads the FAC row first');
{
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'tan',opp:1,seed:660113});
 const p=G.human;
 ok('T98.C an army without aiFloor gets the default', facFloor(p)===AI_FAC_FLOOR&&AI_FAC_FLOOR===0.18);
 const had=FAC.tan.aiFloor;FAC.tan.aiFloor=0.5;
 ok('T98.C ...and one with it gets its own', facFloor(p)===0.5);
 if(had==null)delete FAC.tan.aiFloor;else FAC.tan.aiFloor=had;
 ok('T98.C both readers of the floor go through it: no site compares the share to the constant directly', !/aiFacShare\(p\)<AI_FAC_FLOOR/.test(aiPickUnit.toString()+aiTick.toString())&&(aiTick.toString().match(/facFloor\(p\)/g)||[]).length>=1&&(aiPickUnit.toString().match(/facFloor\(p\)/g)||[]).length>=1);
}

/* ---------- D: a row may sit out the army's speed modifier ---------- */
section('T98.D noFacSpeed: makeUnit honours the flag');
{
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'gray',opp:1,seed:660113});
 const p=G.human,base=U.truck.sp;
 const a=makeUnit('truck',p,p.start.x+3,p.start.y+3);
 ok('T98.D without the flag a Gray truck rolls at the army\'s speed', Math.abs(a.sp-base*FAC.gray.mods.speed)<1e-9&&FAC.gray.mods.speed<1);
 const had=U.truck.noFacSpeed;U.truck.noFacSpeed=1;
 const b=makeUnit('truck',p,p.start.x+4,p.start.y+3);
 if(had==null)delete U.truck.noFacSpeed;else U.truck.noFacSpeed=had;
 ok('T98.D with it, at the table\'s', Math.abs(b.sp-base)<1e-9);
 kill(a);kill(b);
}

/* ---------- F: the instruments ---------- */
section('T98.F the measurement tools exist, are documented, and are not tests');
{
 const fs=require('fs');const dm=fs.readFileSync('sim_dm.js','utf8'),seg=fs.readFileSync('seg.sh','utf8');
 ok('T98.F sim_dm.js takes PROFS (a forced deal), V113_OFF and V113_SET, and records the per-minute series', /PROFS/.test(dm)&&/V113_OFF/.test(dm)&&/V113_SET/.test(dm)&&/minedT/.test(dm)&&/armyT/.test(dm)&&/outpostsT/.test(dm));
 ok('T98.F probe_v113.sh and balance_report.py exist, and neither is in seg.sh', fs.existsSync('probe_v113.sh')&&fs.existsSync('balance_report.py')&&seg.indexOf('probe_v113')<0&&seg.indexOf('balance_report')<0&&seg.indexOf('sim_dm')<0);
 ok('T98.F the driver names both designs', /allbal/.test(fs.readFileSync('probe_v113.sh','utf8'))&&/latin/.test(fs.readFileSync('probe_v113.sh','utf8')));
}
