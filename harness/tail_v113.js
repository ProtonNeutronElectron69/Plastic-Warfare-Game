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
   The owner reviewed the measured draft and chose the levers: Green's discount
   trimmed 8% -> 5% (the draft left Green alone), Blue's hull kept at -10% (the
   draft shipped -5%), the Runner allowance raised to two per ten fighters (the
   draft: one per ten, cap two), and the faction quota kept for every army (the
   draft gave Blue none). The numbers that ship are pinned in the sections that
   name them; every row of the measurement is in harness/README.md.
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
 /* supTrain fills a producer only to three orders (v75), so a count of the QUEUE
    is bounded by that and not by the allowance; between ticks each queued runner
    is delivered as a live one, the way a running match would. */
 const deliver=()=>{for(const b of p.blds)if(b.queue)for(let i=b.queue.length-1;i>=0;i--)if(b.queue[i]==='runner'){b.queue.splice(i,1);makeUnit('runner',p,b.x+1,b.y+1);}};
 for(const u of p.units.slice())if(u.key==='runner')kill(u);
 for(let i=0;i<40;i++){aiTick(p);deliver();}
 const small=runnersQueued();
 for(let i=0;i<20;i++)makeUnit('grunt',p,p.start.x+2+i*.3,p.start.y+4);   // 30 fighters now
 for(let i=0;i<40;i++){aiTick(p);deliver();}
 const large=runnersQueued();
 ok(`T98.B ten fighters earn two runners, thirty earn six, never more (${small}, ${large})`, small===2&&large===6);
 ok('T98.B the rule is the medic\'s shape and is gated on the support flag, so V113_OFF=runner in the simulator reverts it whole', /AI_SUPPORT\.runner&&hasTech\(p,'u_runner'\)[^\n]*2\*Math\.floor\(army\.length\/10\)\)supTrain\('runner','barracks'\)/.test(aiTick.toString()));
 ok('T98.B the runner keeps his row: Blue\'s Barracks exclusive, an infantryman, the Radio Net and Sprint', FAC.blue.uu.includes('runner')&&U.runner.a==='inf'&&U.runner.rnet===1&&U.runner.sprint===1);
}

/* ---------- C: the quota is one number for every army ----------
   The draft carried a per-army door (facFloor, read off an aiFloor field on the
   FAC row) and set Blue's to 0. The owner kept the quota, so the door is gone
   rather than left as a field no row declares: both floor sites read the
   constant, and no FAC row may opt out. */
section('T98.C the faction quota is AI_FAC_FLOOR for every army; no row opts out');
{
 ok('T98.C the constant is the agreed 18%', AI_FAC_FLOOR===0.18);
 ok('T98.C no FAC row carries an aiFloor, and no facFloor door exists', Object.keys(FAC).every(k=>FAC[k].aiFloor==null)&&typeof facFloor==='undefined');
 ok('T98.C both readers of the floor compare the share to the constant', (aiPickUnit.toString().match(/aiFacShare\(p\)<AI_FAC_FLOOR/g)||[]).length===1&&(aiTick.toString().match(/aiFacShare\(p\)<AI_FAC_FLOOR/g)||[]).length===1);
}

/* ---------- D: a row may sit out the army's speed PENALTY and keep its bonus ---------- */
section('T98.D noSpeedTax: the Dump Truck sits out a speed penalty and keeps a speed bonus; the fighters take both');
{
 ok('T98.D the truck row carries the flag, and no other row does', U.truck.noSpeedTax===1&&Object.keys(U).every(k=>k==='truck'||!U[k].noSpeedTax));
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'gray',opp:1,seed:660113});
 const p=G.human,base=U.truck.sp;
 const b=makeUnit('truck',p,p.start.x+4,p.start.y+3);
 ok('T98.D a Gray truck rolls at the table\'s speed, not 92% of it', Math.abs(b.sp-base)<1e-9&&FAC.gray.mods.speed===.92);
 const g=makeUnit('grunt',p,p.start.x+5,p.start.y+3);
 ok('T98.D ...while a Gray grunt is still 92% of his', Math.abs(g.sp-U.grunt.sp*.92)<1e-9);
 delete U.truck.noSpeedTax;
 const a=makeUnit('truck',p,p.start.x+3,p.start.y+3);
 U.truck.noSpeedTax=1;
 ok('T98.D (the flag is the whole mechanism: without it the truck rolls at the army\'s speed)', Math.abs(a.sp-base*.92)<1e-9);
 kill(a);kill(b);kill(g);
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'blue',opp:1,seed:660113});
 const t2=makeUnit('truck',G.human,G.human.start.x+3,G.human.start.y+3);
 ok('T98.D it does NOT cut both ways: a Blue truck keeps its 15% (the owner\'s decision; the draft had taken it)', Math.abs(t2.sp-base*1.15)<1e-9&&FAC.blue.mods.speed===1.15);
 const t3=makeUnit('grunt',G.human,G.human.start.x+4,G.human.start.y+3);
 ok('T98.D ...and a Blue grunt is 15% faster too, as always', Math.abs(t3.sp-U.grunt.sp*1.15)<1e-9);kill(t3);
 kill(t2);
}

/* ---------- E: the rows that ship ---------- */
section('T98.E the rows that ship: Green 5% cheaper, Blue -10% hull under the quota, Gray exactly as it was');
{
 ok('T98.E Blue: hp .9, speed 1.15, cost 1, dmg 1, no aiFloor - the owner kept the -10% hull; transcribed, so the next re-price declares itself here', FAC.blue.mods.hp===.9&&FAC.blue.mods.speed===1.15&&FAC.blue.mods.cost===1&&FAC.blue.mods.dmg===1&&FAC.blue.aiFloor==null);
 ok('T98.E Blue\'s card says -10%', /-10% HP/.test(FAC.blue.desc)&&!/-5% HP/.test(FAC.blue.desc));
 ok('T98.E Gray: hp 1.2, dmg .95, speed .92 - the damage change was measured and REVERTED', FAC.gray.mods.hp===1.2&&FAC.gray.mods.dmg===.95&&FAC.gray.mods.speed===.92&&FAC.gray.aiFloor==null);
 ok('T98.E Green: cost .95 (was .92, the owner\'s re-price), and its card says 5%', FAC.green.mods.cost===.95&&FAC.green.mods.hp===1&&FAC.green.mods.dmg===1&&FAC.green.mods.speed===1&&/5% cheaper/.test(FAC.green.desc)&&!/8%/.test(FAC.green.desc));
 ok('T98.E Tan is untouched', FAC.tan.mods.cost===1&&FAC.tan.mods.dmg===1.15&&FAC.tan.mods.speed===.95&&FAC.tan.mods.hp===1);
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'blue',opp:1,seed:660113});
 const p=G.human;
 ok('T98.E a Blue grunt is 90% of the table\'s hull', makeUnit('grunt',p,p.start.x+3,p.start.y+3).mhp===Math.round(U.grunt.hp*.9));
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:660113});
 ok('T98.E a Green grunt costs 95% of the table\'s price', ucost(G.human,'grunt').p===Math.round(U.grunt.cp*.95));
}

/* ---------- F: the instruments ---------- */
section('T98.F the measurement tools exist, are documented, and are not tests');
{
 const fs=require('fs');const dm=fs.readFileSync('sim_dm.js','utf8'),seg=fs.readFileSync('seg.sh','utf8');
 ok('T98.F sim_dm.js takes PROFS (a forced deal), V113_OFF and V113_SET, and records the per-minute series', /PROFS/.test(dm)&&/V113_OFF/.test(dm)&&/V113_SET/.test(dm)&&/minedT/.test(dm)&&/armyT/.test(dm)&&/outpostsT/.test(dm));
 ok('T98.F probe_v113.sh and balance_report.py exist, and neither is in seg.sh', fs.existsSync('probe_v113.sh')&&fs.existsSync('balance_report.py')&&seg.indexOf('probe_v113')<0&&seg.indexOf('balance_report')<0&&seg.indexOf('sim_dm')<0);
 ok('T98.F the driver names both designs', /allbal/.test(fs.readFileSync('probe_v113.sh','utf8'))&&/latin/.test(fs.readFileSync('probe_v113.sh','utf8')));
}
