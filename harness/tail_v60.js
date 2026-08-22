/* tail_v60.js - v60 AI unit-diversity pass.

   A: the three selection constants are named and carry the approved values.
   B: the weighted draw spreads a roster (and still leans on the best unit).
   C: aiKeyShare + the saturation term actually discount a key the bot is full of.
   D: the helipad sits between the first and second guard tower.
   E: a banked-up bot adds a second barracks / garage; a poor one does not.
   F: the balanced profile has a lean of its own.
   G: the new draw is still deterministic - dual run + save/load resume.

   Mutation checks: B pins BOTH directions (a lopsided pool must still collapse
   onto its favourite, a level pool must not), and C compares a real pick
   distribution against itself with the army stuffed, so neither can pass
   vacuously. */
'use strict';
section('T31 v60: AI unit diversity (weighted draw, saturation, pad order)');

const DT60=1/30;
function cfg60(map,mode,seed,opp){return{map,mode,diff:'normal',fac:'green',opp:(opp==null?3:opp),seed}}
function bot60(){return G.players.find(p=>p.ai&&p.alive&&p.blds.some(b=>b.key==='barracks'&&b.prog>=1))}
function draws60(p,pool,n){
 const c={};
 for(let i=0;i<n;i++){const k=aiPickUnit(p,p.ai.pr,pool);if(k)c[k]=(c[k]||0)+1}
 return c;
}
function top60(c){let k=null,v=-1;for(const x in c)if(c[x]>v){v=c[x];k=x}return{key:k,n:v}}
function sum60(c){let t=0;for(const k in c)t+=c[k];return t}

/* ---------- A: the constants are named, not buried ---------- */
ok('T31.A AI_EXPLORE is 0.08',typeof AI_EXPLORE==='number'&&AI_EXPLORE===0.08);
ok('T31.A AI_SAT_A is 0.6',typeof AI_SAT_A==='number'&&AI_SAT_A===0.6);
ok('T31.A AI_RICH_P is 1200',typeof AI_RICH_P==='number'&&AI_RICH_P===1200);
{
 // Comments inside aiPickUnit NAME the things these checks look for (the v60 note
 // says "rather than Math.pow" in prose), so every negative assertion below runs
 // against a comment-stripped copy. Testing raw source text here fails vacuously.
 const src=aiPickUnit.toString();
 const bare=src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
 ok('T31.A aiPickUnit reads the named constants',bare.includes('AI_EXPLORE')&&bare.includes('AI_SAT_A'));
 ok('T31.A aiPickUnit holds no bare 0.15 exploration literal',!bare.includes('srand()<0.15'));
 ok('T31.A the argmax + jitter pair is gone',!bare.includes('0.9+srand()*0.2')&&!bare.includes('bs=s;best=k'));
 ok('T31.A the draw squares by multiply, never Math.pow',bare.includes('s*s')&&!bare.includes('Math.pow('));
 ok('T31.A the comment strip is not eating the whole body',bare.length>400&&bare.includes('srand()*wsum'));
}

/* ---------- B: the draw spreads a roster, both directions pinned ---------- */
{
 G=null;newGame(cfg60('backyard','dm',600101,3));
 for(let i=0;i<1500;i++)update(DT60);
 const p=bot60();
 ok('T31.B a bot with a live barracks was found',!!p);
 if(p){
  // every key in the pool is force-unlocked so the test reads the DRAW, not research
  const pool=['grunt','grenadier','gunner','bazooka','mortar'];
  for(const k of pool)if(U[k].tech)p.tech.add(U[k].tech);
  const c=draws60(p,pool,600),n=sum60(c),t=top60(c);
  const distinct=Object.keys(c).length;
  ok('T31.B a five-key roster fields at least four of them',distinct>=4);
  ok('T31.B no single key takes the roster',t.n/n<=0.75);
  // ...and the bias is real: the draw is not uniform noise
  ok('T31.B the favourite is still clearly the favourite',t.n/n>=1.6/pool.length);
  /* MUTATION: a lopsided pool MUST collapse. This arm tests the DRAW, so the pool
     has to stay genuinely lopsided; it is not a claim about any one unit's price.
     v65 raised the Grunt 20% and the old grunt-vs-mortar pool fell to 0.79, close
     enough to the bar to be reading the Grunt's cost rather than the squaring.
     Re-cut on the Machine Gunner, who beats the mortar squad by ~4.3x on damage
     per plastic and is not a unit this release touched. */
  const c2=draws60(p,['gunner','mortar'],400),n2=sum60(c2);
  ok('T31.B a lopsided pool still collapses onto its favourite',(c2.gunner||0)/n2>=0.80);
  ok('T31.B ...but the weak option is not banned outright',(c2.mortar||0)>0);
 }
}

/* ---------- C: saturation ---------- */
{
 const fake=(key,extra)=>Object.assign({key,t:U[key],hp:U[key].hp,garrisoned:false},extra||{});
 const sh=aiKeyShare({units:[fake('grunt'),fake('grunt'),fake('gunner'),fake('truck'),
                             fake('grunt',{garrisoned:true}),fake('gunner',{hp:0})]});
 ok('T31.C aiKeyShare counts only live, ungarrisoned, non-support units',
    Math.abs((sh.grunt||0)-2/3)<1e-9&&Math.abs((sh.gunner||0)-1/3)<1e-9&&sh.truck==null);
 ok('T31.C aiKeyShare of an empty army is empty, not NaN',Object.keys(aiKeyShare({units:[]})).length===0);

 G=null;newGame(cfg60('kitchen','dm',600202,3));
 for(let i=0;i<1500;i++)update(DT60);
 const p=bot60();
 if(p){
  const pool=['grunt','grenadier','gunner','bazooka'];
  for(const k of pool)if(U[k].tech)p.tech.add(U[k].tech);
  const before=draws60(p,pool,500),nb=sum60(before),fav=top60(before).key;
  const keep=p.units.slice();
  // stuff the army with the favourite. Every option in the pool is infantry, so
  // the v59 class bias moves all four scores together and cancels inside the pool;
  // any change in the SHARES is the saturation term and nothing else.
  for(let i=0;i<24;i++)p.units.push(fake(fav));
  const after=draws60(p,pool,500),na=sum60(after);
  p.units.length=0;for(const u of keep)p.units.push(u);
  ok('T31.C the army was restored',p.units.length===keep.length);
  ok(`T31.C stuffing the army with ${fav} discounts the next one`,
     (after[fav]||0)/na < (before[fav]||0)/nb);
  ok('T31.C ...without banning it',(after[fav]||0)>0);
  ok('T31.C ...and the displaced picks go to the rest of the roster',Object.keys(after).length>=3);
 }
}

/* ---------- D: the pad sits between the two towers ---------- */
{
 const src=aiTick.toString();
 const iT1=src.indexOf("['guardtower',1]"), iPad=src.indexOf("['helipad',1]"),
       iT2=src.indexOf("['guardtower',Math.min(2,towerWant)]");
 ok('T31.D all three wish entries are present',iT1>=0&&iPad>=0&&iT2>=0);
 ok('T31.D order is tower, pad, tower',iT1<iPad&&iPad<iT2);
 ok('T31.D the v59 tower-pair-before-pad order is gone',
    !src.includes("['guardtower',Math.min(2,towerWant)],['helipad',1]"));
 ok('T31.D the full ring still tops up later',src.indexOf("['guardtower',towerWant]")>iT2);
}

/* ---------- E: a rich bot adds a second barracks / garage ---------- */
{
 /* v85: the bots are CHOSEN rather than taken in list order, and the seed moved
    600303 -> 600305. At v85's trail, every bot on 600303 already held two barracks
    by tick 1800, so "the banked bot puts up a second producer" was green on a pair
    it had before the money arrived and "a real gain" was the only thing still
    telling the truth - which is exactly what it caught. Picking bots that do NOT
    already have a pair makes the section say what it means, and a future trail move
    that leaves fewer than two such bots fails the count below loudly instead of
    quietly proving nothing again. */
 G=null;newGame(cfg60('backyard','dm',600305,3));
 for(let i=0;i<1800;i++)update(DT60);
 const nb0=k=>p=>p.blds.filter(b=>b.key===k).length;
 const eligible=G.players.filter(p=>p.ai&&p.alive&&nb0('barracks')(p)<2&&nb0('garage')(p)<2);
 const rich=eligible[0], poor=eligible[1];
 ok(`T31.E two live bots without a pair already, so a gain can be seen (${eligible.length} eligible)`,
    !!rich&&!!poor);
 if(rich&&poor){
  const nb=k=>p=>p.blds.filter(b=>b.key===k).length;
  const richBefore=nb('barracks')(rich)+nb('garage')(rich);
  for(let i=0;i<900;i++){
   rich.res.p=Math.max(rich.res.p,4000);      // banked well past AI_RICH_P
   poor.res.p=Math.min(poor.res.p,AI_RICH_P-400); // held below it
   update(DT60);
  }
  ok('T31.E the banked bot puts up a second producer',
     nb('barracks')(rich)>=2||nb('garage')(rich)>=2);
  ok('T31.E ...and it is a real gain, not a pre-existing pair',
     nb('barracks')(rich)+nb('garage')(rich)>richBefore);
  ok('T31.E the bot held under the threshold does not',
     nb('barracks')(poor)<2&&nb('garage')(poor)<2);
 }
}

/* ---------- F: every profile has a lean ---------- */
{
 ok("T31.F balanced now leans heavy",AI_PROFILES.balanced.armyTilt==='heavy');
 const tilts=Object.keys(AI_PROFILES).map(k=>AI_PROFILES[k].armyTilt);
 ok('T31.F no profile is left with a null tilt',tilts.every(t=>typeof t==='string'&&t.length>0));
 /* v89: retuned by the air pass - balanced air 0.17->0.26, harasser 0.30->0.38,
    aggressive inf 0.68->0.60. The check is renamed to say what it now guards: not
    that v60 left the table alone, but that the retune kept the personalities in
    ORDER, which is the property v60 actually cared about. The three transcribed
    values stay, so the next retune has to come here and declare itself too. */
 ok('T31.F the air retune kept the profile leans in order',
    AI_PROFILES.balanced.mixWant.air===0.26&&AI_PROFILES.harasser.mixWant.air===0.38&&
    AI_PROFILES.aggressive.mixWant.inf===0.60&&
    AI_PROFILES.harasser.mixWant.air>AI_PROFILES.balanced.mixWant.air&&
    AI_PROFILES.aggressive.mixWant.inf>AI_PROFILES.balanced.mixWant.inf);
}

/* ---------- G: the new draw is still deterministic ---------- */
{
 const trail=(c,ticks)=>{G=null;newGame(c);const o=[];for(let i=1;i<=ticks;i++){update(DT60);if(i%150===0)o.push(hashState())}return o};
 const a=trail(cfg60('sandbox','dm',600404,3),900), b=trail(cfg60('sandbox','dm',600404,3),900);
 ok('T31.G same seed, same trail',a.length===6&&a.every((h,i)=>h===b[i]));
 ok('T31.G the trail is not a constant',new Set(a).size>1);
 G=null;newGame(cfg60('backyard','dm',600505,3));
 for(let i=0;i<900;i++)update(DT60);
 const snap=saveState(), h1=hashState();
 for(let i=0;i<300;i++)update(DT60);
 const hAfter=hashState();
 loadState(snap);
 ok('T31.G a save taken mid-match reloads to the same state',hashState()===h1);
 for(let i=0;i<300;i++)update(DT60);
 ok('T31.G ...and resumes down the identical path',hashState()===hAfter);
 ok('T31.G the snapshot tag is at or past v57',(JSON.parse(snap).v||0)>=57);
}
