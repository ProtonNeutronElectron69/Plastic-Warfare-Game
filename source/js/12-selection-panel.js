/* ---------------- SELECTION PANEL ---------------- */
let lastSelSig='';
/* v71 SPRITE TILES.
   Tile art is the same crop recipe the Field Manual portraits use, re-cut for a
   96x80 LANDSCAPE well and left transparent so the CSS gradient shows through.
   Cached per key+faction; the bake it reads is the one the match already did. */
const TILEART={};
function tileURL(kind,key,fac){
 const ck=kind+'_'+key+'_'+fac;
 if(ck in TILEART)return TILEART[ck];
 let url=null;
 try{
  const W=172,H=94,cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const c=cv.getContext('2d');c.imageSmoothingEnabled=true;
  if(kind==='unit'){
   const t=U[key];
   if(t.a==='inf'){
    /* the 56px portrait takes a 62%x62% box because its tile is SQUARE. In a
       landscape well a portrait figure letterboxes to a sliver, so take the full
       width and the top 56%: head and torso, at an aspect the box can fill. */
    const cell=SPR.inf[key]&&SPR.inf[key][fac]&&SPR.inf[key][fac][2];
    if(cell&&cell.cv&&cell.cv.width){
     const sw=cell.cv.width,sh=cell.cv.height*.56;
     const sc=Math.min(W/sw,H/sh),dw=sw*sc,dh=sh*sc;
     c.drawImage(cell.cv,0,0,sw,sh,(W-dw)/2,(H-dh)/2,dw,dh);
    }
   }else{
    const P=Math.min(W,H)*2,tc=document.createElement('canvas');tc.width=P;tc.height=P;
    if(vehPortraitPaint(tc.getContext('2d'),key,fac,P,10)){
     const sc=Math.min(W/P,H/P)*1.9,dw=P*sc,dh=P*sc;
     c.drawImage(tc,(W-dw)/2,(H-dh)/2,dw,dh);
    }
   }
  }else if(B[key].barr){
   /* never baked: the barricades are live-painted, so borrow the manual's stub.
      v90.1: the SAME two faults the Field Manual's stub carried until v88.1, in
      the call site that release's note said it did not reach. Both walls were
      blank in every Construct menu in the game for three releases:
        - the row was hard-coded to 'barricade', so the Heavy Barricade drew the
          ORDINARY hedgehog even when it drew anything at all;
        - the stub had no `t`, and drawBarricade reads b.t.hbarr to choose its
          silhouette, so it threw on the very first line and the outer catch
          swallowed it into a blank data URL.
      The lesson is the v88 one twice over: when a painter starts reading a new
      field, grep for its CALLERS, not for the key its first caller happened to
      pass. Centred on the landscape well rather than pushed 22px below its
      middle, which is what put the beams through the floor of the tile. */
   infoStub(()=>{c.save();c.translate(W/2,H/2-8);c.scale(2.6,2.6);
    drawBarricade(c,{key,t:B[key],p:{fac},prog:1},0,6);c.restore()});
  }else{
   const cell=SPR.bld[key]&&SPR.bld[key][fac];
   if(cell&&cell.cv&&cell.cv.width){
    const sc=Math.min(W/cell.w,H/cell.h),dw=cell.w*sc,dh=cell.h*sc;
    c.drawImage(cell.cv,(W-dw)/2,(H-dh)/2,dw,dh);
   }
  }
  if(typeof cv.toDataURL==='function'){const u=cv.toDataURL();if(typeof u==='string')url=u}
 }catch(err){url=null}
 TILEART[ck]=url;return url;
}
/* every wash on screen, repainted from the render loop. NOT from refreshSelPanel:
   that early-outs on lastSelSig and rebuilds wholesale when it runs, so driving a
   60fps fill through it would recreate every <img> every frame. */
let V71FILL=[];
/* v74: the production wash is the owning army's colour, written inline.
   The CSS vars behind it (--teamc / --teamlt) are literal Green Army values and
   stay as the fallback for any chip that somehow renders before this runs.
   setProperty does not exist on the headless shim's style object, so these have
   to be plain style properties rather than custom properties. */
function teamTint(hex){const m=mixc(hx2rgb(hex),WHITE,.62);return rgb(m.r,m.g,m.b)}
function paintTeamFill(w,e,fac){
 const col=(FAC[fac]&&FAC[fac].color)||'#4caf50';
 if(w)w.style.background=col;
 if(e)e.style.background=teamTint(col);
}
function v71Fills(){
 for(let i=V71FILL.length-1;i>=0;i--){
  const f=V71FILL[i];
  if(!f.w||!f.w.isConnected){V71FILL.splice(i,1);continue}
  const p=clamp(f.get(),0,1),pc=(p*100).toFixed(2)+'%';
  f.w.style.height=pc;f.e.style.bottom=pc;
  f.e.style.opacity=(p>0&&p<1)?.9:0;
 }
}
/* --- build-menu hotkeys ---
   Positional over a fixed alphabet, which is the whole design: these thirteen
   letters are EXACTLY the ones no in-match binding already claims, so nothing
   needs shadowing and no key means two things at once. They are allowed to
   collide across buildings because the registry is rebuilt with the panel, so a
   key exists only while its tile is on screen - the context gate IS the
   registry. hotNext returns null past the end and the tile carries no key
   rather than reusing one; the largest menu in the game is the HQ's thirteen,
   so that path is unreached today and the splice asserts it stays that way.
   Client-local: nothing here is hashed, serialized or visible to the sim.

   v86: FOURTEEN, and the fourteenth is 'v'. The alphabet ran out, and it ran out
   at v85 rather than here: the HQ menu is the build roster plus the Dump Truck
   tile, the build roster is eleven fixed keys plus that army's exclusives, and the
   moment Blue got a second structure its HQ menu was fourteen tiles against
   thirteen keys - the fourteenth tile silently carried no key, which is exactly
   what the pin below was put here to prevent. It went unseen because the fixture
   read the LOCAL player's roster for every faction it claimed to check; that is
   corrected in the same release. Green is the second army to reach fourteen and
   Tan and Gray reach it at v87 and v88, so fourteen is the whole roadmap's width.

   'v' is the one letter left, and it is not a free letter in the strict sense the
   paragraph above claims for the other thirteen - the spectator box toggles on it.
   The two can never be live together, and not by luck: the Construct menu is built
   only under `e.p.human`, and a watch match has no human player at all, so the
   registry is empty for the whole of every match in which 'v' means anything. That
   is the registry-IS-the-gate argument applied to a key rather than to a tile, and
   tail_v86 pins the premise rather than leaving it as prose here. */
const MENU_KEYS=['c','e','g','i','k','l','m','n','o','r','t','v','y','z'];
let MENU_HOT=Object.create(null),MENU_HOT_N=0;
/* v98: the ABILITY registry is declared here, beside the menu's, rather than
   down beside the functions that use it. hotReset clears both, and a `let`
   assigned before its own declaration has been evaluated is a temporal-dead-zone
   fault waiting for the first caller that runs during the parse - the trap the
   v86 note records from the other direction. The block that explains it is
   further down, above abilAdd. */
const ABIL_KEYS=['1','2','3','4','5','6','7','8','9'];
let ABIL_HOT=Object.create(null),ABIL_HOT_N=0;
function hotReset(){MENU_HOT=Object.create(null);MENU_HOT_N=0;ABIL_HOT=Object.create(null);ABIL_HOT_N=0}
function hotNext(){return MENU_HOT_N<MENU_KEYS.length?MENU_KEYS[MENU_HOT_N++]:null}
/* Fires the tile's OWN onclick, dimmed or not, so a key and a click are one code
   path. Every one of those handlers already validates downstream. */
function menuHotkey(k){
 const b=MENU_HOT[String(k).toLowerCase()];
 if(!b||typeof b.onclick!=='function')return false;
 b.onclick();return true;
}
/* --- ability hotkeys, added at v98 ---
   The number row fires the selection panel's ABILITY buttons: 1 is the first
   button the panel put in the row, 2 the second, and so on down the row you are
   looking at. This is MENU_HOT's design applied to the other half of the panel -
   the registry is rebuilt by hotReset() with the panel and only with the panel,
   so a digit means something only while its button is on screen and nothing
   needs a mode gate around it.
   The numbers were free to take because the control groups moved OFF them in
   this same release, to F1-F9 (23-net-input.js records why, and the Field Manual
   says so). A digit therefore still means exactly one thing, which is the rule
   MENU_KEYS was picked under and the reason this could not simply shadow them.
   Order is APPEND order, in both the single-unit panel and the mixed-group one.
   That is what makes the owner's rule - "for a group of mixed units, 1, 2, and
   so on" - hold with no second list to keep in step: whatever goes into the row
   first is 1. It also means BUILDING abilities are deliberately not in here.
   A structure's panel already hands its Construct, Train and Research tiles the
   MENU_KEYS letters; numbering the two or three ability buttons above them is a
   separate decision and has not been asked for.
   ABIL_KEYS and ABIL_HOT are declared up beside MENU_HOT, for the reason the
   note there gives.
   Client-local: nothing here is hashed, serialized or visible to the sim. */
function abilNext(){return ABIL_HOT_N<ABIL_KEYS.length?ABIL_KEYS[ABIL_HOT_N++]:null}
/* Takes the next number, stamps the badge, registers the button and hosts it.
   Every unit-ability site calls THIS instead of pb.appendChild, which is what
   stops a button from shipping without a key by being added somewhere new, and
   what stops the numbering from disagreeing with the order the player sees.
   The badge is prefixed onto innerHTML rather than inserted as a node: `.bb`
   buttons carry no live child references (the V71FILL wash/edge pairs live on
   `.tl` tiles and `.qc` queue chips), so a re-parse costs nothing, and a plain
   property write is the one form the headless shim also implements.
   Past the ninth a button carries no key rather than reusing one, exactly as
   hotNext does; no selection in the game reaches nine ability buttons today. */
function abilAdd(host,bt){
 const k=abilNext();
 if(k){
  ABIL_HOT[k]=bt;
  bt.innerHTML='<span class="ak">'+k+'</span>'+bt.innerHTML;
  bt.title=(bt.title?bt.title+'\n':'')+'Hotkey: '+k;
 }
 host.appendChild(bt);
 return bt;
}
/* Fires the button's OWN onclick, so a key and a click are one code path - and
   REFUSES a disabled one, so they stay one code path when it is greyed out: a
   browser swallows the click on a disabled button and calling onclick() by hand
   would not. Every handler behind these validates downstream anyway; this is
   about the two surfaces agreeing, not about safety. */
function abilHotkey(k){
 const b=ABIL_HOT[String(k)];
 if(!b||b.disabled||typeof b.onclick!=='function')return false;
 b.onclick();return true;
}
/* --- THE UNIT STAT CARD, ADDED AT v102 ---
   ONE builder, two surfaces: the hover popup inside a production building and
   the selection panel when a single unit is selected. That is the whole point of
   it being a function rather than two blocks of markup - the owner asked for the
   same block in both places, and two copies would drift the first time either
   moved.

   NOTHING HERE IS A SECOND COPY OF A NUMBER. Health, range and sight read the
   unit's own row or the live entity; the yellow figures come from dmgMulFor and
   the red ones from armorScan - the same two functions the SIMULATION uses to
   resolve a shot and the Field Manual uses for its prose. Re-price or re-arm a
   unit and every card follows, with no edit here.

   THE TWO SURFACES ANSWER TWO DIFFERENT QUESTIONS, which is why the figures are
   not identical:
     the shop shows the TYPE  - what you would get if you bought one, so the
                                faction's own hull and damage modifiers are
                                applied (Gray really does buy a tougher Grunt)
                                and sight is the daytime figure, because you are
                                buying the unit rather than fielding it.
     the field shows the MAN  - the live entity: health remaining, its veterancy
                                and buffs baked in, rgOf/viOf for reach and sight,
                                so after dark it reads the halved v101 sight.

   WHY THE RED ROW IS WEAPON TYPES AND NOT UNIT TYPES: "what does extra damage to
   this" has an exact answer in WVA - the weapon classes that beat this unit's
   armor - and no exact answer at all in unit types, because a class like Infantry
   carries six different weapons and any single number for it is an average that
   buries the one that kills you. The pills name the weapon and carry the units
   that field it in their tooltip, so the player gets the exact multiplier AND the
   list of what to watch for. */
const CARD_CAT=[['inf','🪖'],['light','🚙'],['medium','🚚'],
                ['heavy','🛡️'],['air','🚁'],['bldg','🏭']];
const CARD_WC={b:'🔫',g:'💣',r:'🚀',s:'💥',
               m:'☄️',f:'🔥',d:'🧨',a:'🛰️',q:'🎆'};
function cardMul(v){return '×'+v.toFixed(2)}
/* DPS through the game's OWN definition rather than a fresh dm/rt, for two
   reasons the first cut got wrong. unitDPS knows about SALVO weapons (t.sal /
   t.srt), so an AA truck's four-missile burst is not read as one missile per
   reload; and a live entity carries `dm` but no `rt` at all - the reload lives
   on the type row and is bent by rtOf (Ripple Fire lengthens it, Broadcast
   shortens it), so `u.rt` was undefined and every selected unit read 0.0 dps
   until a real frame showed it. Entrenchment is mirrored from the fire site in
   updateUnit, which is the one other place that divides a reload. */
function cardDPS(t,u,dmM){
 if(!t.dm||!t.rt)return 0;
 const rt=u?(u.entrenched?rtOf(u)/ENTRENCH_RATE:rtOf(u)):t.rt;
 return unitDPS({dm:(u?u.dm:t.dm*(dmM||1)),rt,sal:t.sal,srt:t.srt});
}
function cardPill(cls,ic,label,val,unit,tip){
 return '<span class="ucp'+(cls?' '+cls:'')+'"'+(tip?' title="'+tip.replace(/"/g,'&quot;')+'"':'')+'>'
  +'<span class="uci">'+ic+'</span>'
  +(label?'<span class="ucl">'+label+'</span>':'')
  +'<span class="ucv">'+val+'</span>'
  +(unit?'<span class="ucu">'+unit+'</span>':'')+'</span>';
}
/* opt.u  a live unit  -> the field reading (current hp, rgOf/viOf, its own dm)
   opt.p  a player     -> the shop reading (type row through that faction's mods) */
function unitCard(key,opt){
 const t=U[key];if(!t)return '';
 const o=opt||{},u=o.u||null;
 const mods=(u?FAC[u.p.fac]:(o.p?FAC[o.p.fac]:null));
 const hpM=mods?mods.mods.hp:1, dmM=mods?mods.mods.dmg:1;
 const hp=u?(Math.ceil(u.hp)+'/'+Math.round(u.mhp)):String(Math.round(t.hp*hpM));
 const dps=cardDPS(t,u,dmM);
 const rg=u?rgOf(u):t.rg, vi=u?viOf(u):t.vi;
 const armed=!!(t.dm&&t.w);
 let h='<div class="uc"><div class="ucrow">';
 h+='<div class="ucg"><div class="uch">Stats</div><div class="ucstats">'
  +cardPill('','❤️','',hp,'',u?'Health remaining':'Maximum health')
  +cardPill('','🔫','',armed?dps.toFixed(1):'—',armed?'dps':'','Damage per second')
  +cardPill('','🎯','',armed?rg:'—',armed?'tiles':'','Weapon range')
  +cardPill('','👁️','',vi,'tiles',u?'Sight range right now':'Sight range in daylight')
  +'</div></div>';
 h+='<div class="ucg"><div class="uch">Damage dealt</div><div class="ucdeal">';
 for(const [c,ic] of CARD_CAT){
  const m=armed?dmgMulFor(key,t.w,c):null;
  h+=cardPill('ucd'+(m?'':' ucnil'),ic,'',m==null?'—':cardMul(m),'',
    ARMOR_SHORT[c]+(m==null?' — unarmed':(m===0?' — cannot fire on them at all':' — '+cardMul(m))));
 }
 h+='</div></div></div>';
 const weak=armorScan(armorOf({kind:'unit',t}),true);
 h+='<div class="ucweak"><div class="uch">Weak to</div><div class="ucwl">';
 if(!weak.length)h+='<span class="ucp ucnil"><span class="ucv">Nothing hits it especially hard</span></span>';
 else for(const [wc,m] of weak){
  h+=cardPill('uct',CARD_WC[wc]||'❗',WC_LABEL[wc]||wc,cardMul(m),'',
    WC_LABEL[wc]+' hit it for '+cardMul(m)+' — carried by: '+wcRoster(wc));
 }
 h+='</div></div></div>';
 return h;
}
/* The production popup's own body: the card, then the description UNDER it, then
   the price - the order the owner specified. The plastic figure carries the
   plastic colour here exactly as it does on the tile itself and in the top bar;
   it is the same resource and it reads yellow everywhere. */
function unitCardPop(key,p,desc,extra){
 const c=ucost(p,key);
 let h='<div class="uctitle">'+U[key].n+'<span class="ucsub">'+ARMOR_SHORT[armorOf({kind:'unit',t:U[key]})]
   +(U[key].w?' · '+WC_LABEL[U[key].w]:' · Unarmed')+'</span></div>';
 h+=unitCard(key,{p});
 if(desc)h+='<div class="ucdesc">'+desc+'</div>';
 if(extra)h+='<div class="ucextra">'+extra+'</div>';
 h+='<div class="ucfoot"><span class="cp">⬢ '+c.p+'</span>'
   +(c.e?'<span class="ce">⚡ '+c.e+'</span>':'')
   +'<span class="cs">🪖 '+supOf(key)+' supply</span></div>';
 return h;
}
/* THE POPUP. The build tile's tooltip was the browser's own `title` text through
   v101, which cannot carry an icon, a colour or a grid - so a tile that has a
   card gets this instead and sets NO title, because a native tooltip firing
   under a custom one is two tooltips for one hover.
   Client-local to its bones: one element, reused, never hashed, never
   serialized, and it draws from the tables rather than from any entity. The
   headless shim's addEventListener is a no-op, so the fixtures drive
   cardPopShow / cardPopHide directly - the same reason v73's HQ button put its
   body in a named function rather than inside a listener. */
let CARDPOP=null;
function cardPopEl(){
 if(CARDPOP&&CARDPOP.parentNode)return CARDPOP;
 const d=document.createElement('div');d.id='cardPop';d.className='cardPop';
 d.style.display='none';
 document.body.appendChild(d);CARDPOP=d;return d;
}
function cardPopShow(html,anchorEl){
 const d=cardPopEl();
 d.innerHTML=html;d.style.display='block';
 /* place it ABOVE the tile - the production panel lives along the bottom edge -
    and clamp inside the window. getBoundingClientRect is absent on the headless
    shim, so a missing rect simply leaves the box where it is: the CONTENT is
    what the fixtures read, and the geometry is what a real frame checks. */
 try{
  const r=anchorEl&&anchorEl.getBoundingClientRect?anchorEl.getBoundingClientRect():null;
  if(r){
   const w=d.offsetWidth||404,h=d.offsetHeight||160;
   let x=r.left+r.width/2-w/2, y=r.top-h-10;
   x=Math.max(8,Math.min(x,innerWidth-w-8));
   if(y<TOPBAR_H+8)y=Math.min(r.bottom+10,innerHeight-h-8);
   d.style.left=Math.round(x)+'px';d.style.top=Math.round(y)+'px';
  }
 }catch(e){}
 return d;
}
function cardPopHide(){if(CARDPOP)CARDPOP.style.display='none'}
/* o = {kind,art,fac,name,c:[[glyph,val,cls,short]],dis,locked,mark,up,fill,tip,hk,onclick} */
function tile(o){
 const b=document.createElement('button');
 /* base class by assignment, state classes through classList: the two surfaces are
    linked in a browser but NOT in the headless shim, and callers read both */
 b.className='tl';
 if(o.dis)b.classList.add('dis');
 if(o.locked)b.classList.add('locked');
 if(o.up)b.classList.add('up');
 let h='<div class="w"><img src="'+(tileURL(o.kind,o.art,o.fac)||'')+'" alt="">';
 if(o.fill)h+='<div class="wash"></div><div class="edge"></div>';
 /* the mark says WHERE it unlocks: a unit researches on click, a structure does
    not, because structures still gate through the Lab */
 if(o.locked)h+='<span class="mk">'+(o.mark==='lock'?'\uD83D\uDD12':'\uD83D\uDD2C')+'</span>';
 if(o.up)h+='<span class="chev">\u25B2</span>';
 if(o.hk)h+='<span class="hk">'+o.hk.toUpperCase()+'</span>'; // v73
 h+='<div class="t">'+o.c.map(x=>'<span class="'+x[2]+(x[3]?' short':'')+'">'+x[0]+x[1]+'</span>').join('')+'</div>';
 h+='<div class="b"><span>'+o.name+'</span></div></div>';
 b.innerHTML=h;
 /* v102: a tile carrying a CARD shows the rich popup and sets no title at all -
    a native tooltip under a custom one is two tooltips for one hover. Every other
    tile (structures, research) keeps the title it has had since v43. */
 if(o.card){
  b.dataset&&(b.dataset.card='1');
  const show=()=>cardPopShow(o.card+(o.hk?'<div class="uchk">Hotkey: '+o.hk.toUpperCase()+'</div>':''),b);
  b.addEventListener('mouseenter',show);
  b.addEventListener('focus',show);
  b.addEventListener('mouseleave',cardPopHide);
  b.addEventListener('blur',cardPopHide);
  b.addEventListener('mousedown',cardPopHide);
 }
 else if(o.tip)b.title=o.tip+(o.hk?'\nHotkey: '+o.hk.toUpperCase():'');
 else if(o.hk)b.title='Hotkey: '+o.hk.toUpperCase();
 if(o.onclick)b.onclick=o.onclick;
 if(o.hk)MENU_HOT[o.hk]=b; // v73: the registry IS the context gate
 if(o.fill)V71FILL.push({w:b.querySelector('.wash'),e:b.querySelector('.edge'),get:o.fill});
 return b;
}
const tz=(v,cls)=>cls+(v?'':' cz');
/* a titled column that only joins the DOM once something is put in it */
function grp(host,title,full){
 const el=document.createElement('div');el.className='grp'+(full?' full':'');
 const hd=document.createElement('div');hd.className='gsub';hd.textContent=title;el.appendChild(hd);
 const items=document.createElement('div');items.className='gitems';el.appendChild(items);
 let used=false;
 return {add(n){items.appendChild(n);if(!used){used=true;host.appendChild(el)}}};
}
/* one structure tile, wherever the Construct menu is hosted */
function structTile(key,hk){
 const p=G.human,c=bcost(p,key);
 const has=!B[key].req||p.blds.some(b=>b.key===B[key].req&&b.prog>=1);
 const tech=!B[key].tech||hasTech(p,B[key].tech);
 const lim=B[key].lim&&p.blds.filter(b=>b.key===key).length>=B[key].lim;
 const poorP=p.res.p<c.p,poorE=p.res.e<c.e;
 return tile({kind:'bld',art:key,fac:p.fac,name:B[key].n,hk,
  locked:!tech,mark:'lock',dis:!(has&&tech&&!poorP&&!poorE&&!lim),
  c:[['\u2B22',c.p,tz(c.p,'cp'),poorP&&has&&tech],['\u26A1',c.e,tz(c.e,'ce'),poorE&&has&&tech]],
  tip:B[key].d+(B[key].req&&!has?' (requires '+B[B[key].req].n+')':'')
     +(B[key].tech&&!tech?' \u2014 unlock at the Research Lab first':'')
     +'\n'+counterLine('bld',key).join('\n'),
  onclick:()=>{startPlacing(key);sClick()}});
}
/* One research button for the selection panel. Both places that offer research -
   the Research Lab's flat catalog and a production building's own unlock list -
   built this identically except for the tail of the tooltip, so the tail is the
   argument. `tipTail` is appended after the cost/time clause and before the
   counter tip; a locked prerequisite replaces it outright, exactly as it did in
   both copies. Returns the button; the caller decides where it goes. */
function researchBtn(e,key,tipTail,hk){
 const r=RESEARCH[key],c=rcost(e.p,key);
 // upgrades need their building unlock first; show but disable if locked
 const lockedReq=r.kind==='upgrade'&&r.reqTech&&!hasTech(e.p,r.reqTech);
 /* v71: still the ONE research-button factory, now emitting a sprite tile of the
    building it unlocks or upgrades, with research TIME in the third slot. */
 const busy=(e.techCur===key);
 const poorP=e.p.res.p<c.p,poorE=e.p.res.e<c.e;
 const bt=tile({kind:'bld',art:r.bkey||'lab',fac:e.p.fac,name:r.name,hk,
  up:r.kind==='upgrade',
  dis:!(!lockedReq&&!poorP&&!poorE)||(!!e.techCur&&!busy),
  c:[['⬢',c.p,'cp',poorP],['⚡',c.e,'ce',poorE],
     ['⏱',(researchTime(e,key)|0)+'s','ctm',false]],
  fill:busy?(()=>e.techT/researchTime(e,key)):null});
 /* v73: this assignment REPLACES the one tile() made, so the hotkey line has to
    be re-added here or a research tile would show a key it never advertises. */
 bt.title=r.d+(lockedReq?` (research ${RESEARCH[r.reqTech].name} first)`:tipTail)+techTip(key)+(hk?'\nHotkey: '+hk.toUpperCase():'');
 bt.onclick=()=>{submitCmd('research',{bid:e.id,key});sClick()};
 return bt;
}
/* --- EVERY UNIT TOGGLE IS A ROW, ADDED AT v87.1 ---
   Eleven units carry a toggleable ability. Seven of them had a hand-written
   group block in the multi-select panel and four did not - On Me!, Called Shot,
   Ripple Fire and Flat Out - purely because of the order they shipped in, so a
   mixed selection silently dropped abilities the same units offered one at a
   time. Every one of those blocks was the same eight lines, so they are one
   table now and the loop below builds all eleven.
   `f` is the U-table flag that says the unit HAS the ability; `s` is the
   per-unit field that says it is RUNNING; `c` is the command. `sub` is a
   function rather than a string so the constants are read at click time, the
   way every other label in this panel reads them.
   Entrench is the one row that is a PAIR of commands rather than an on/off, and
   the only one whose "on" needs an aimed direction, so it carries `offc` and
   `aim`; the loop keeps that branch byte-identical to the block it replaces.
   NOT in the table: Napalm Blast and Bail, which are one-shots, not toggles. */
const UNIT_TOGGLES=[
 {f:'entrench',s:'entrenched',c:'entrench',offc:'unentrench',aim:'Click to aim the entrench cone for the group.',
  on:'Pack Up',off:'Entrench',sub:()=>`${ENTRENCH_RATE}× fire rate, 100° cone`,
  tip:'Dig the selected gunners in, or pack them up. Click to aim a shared cone direction.'},
 {f:'rally',s:'onMe',c:'onme',on:'Stand Down',off:'On Me!',
  sub:()=>`+${Math.round(SARGE_AURA*100)}% damage to infantry within ${SARGE_AURA_R}, −${Math.round((1-SARGE_SELF)*100)}% their own`,
  tip:'Open or close the broadcast on every selected Sarge.'},
 {f:'smokeCap',s:'smoke',c:'smoke',on:'High Explosive',off:'Smoke Rounds',
  sub:()=>`−${Math.round(SMOKE_RED*100)}% damage taken under the cloud`,
  tip:'Switch the selected mortars between high explosive and smoke.'},
 {f:'valve',s:'valve',c:'valve',on:'Close Valve',off:'Pressure Valve',
  sub:()=>`+${Math.round(VALVE_DMG*100)}% damage, ${Math.round(VALVE_BACK*100)}% of it back on them`,
  tip:'Open or close the valve on every selected flamethrower.'},
 {f:'throttle',s:'thr',c:'throttle',on:'Throttle Down',off:'Full Throttle',
  sub:()=>`+${Math.round(THROTTLE_SPD*100)}% speed, no guns`,
  tip:'Order every selected Bull to charge, or to throttle down and fight.'},
 {f:'cshot',s:'cs',c:'cshot',on:'Free Fire',off:'Called Shot',
  sub:()=>`+${Math.round(CS_DMG*100)}% damage, infantry only`,
  tip:'Put every selected sniper on infantry targets only, or release them.'},
 {f:'ripple',s:'rip',c:'ripple',on:'Single Fire',off:'Ripple Fire',
  sub:()=>`${RIPPLE_N} rockets at ${Math.round(RIPPLE_DM*100)}% each, +${Math.round((RIPPLE_RT-1)*100)}% reload`,
  tip:'Switch every selected rocket battery between salvo and single shells.'},
 {f:'flat',s:'flat',c:'flat',on:'Slow Down',off:'Flat Out',
  sub:()=>`+${Math.round(FLAT_SPD*100)}% speed, +${FLAT_VI} sight, no guns`,
  tip:'Send every selected scout flat out, or bring them all back down.'},
 {f:'assault',s:'aslt',c:'assault',on:'Cease Fire',off:'Air Assault',
  sub:()=>'the squads fire out; the aircraft cannot move',
  tip:'Open or close the hold on every selected transport.'},
 {f:'sprint',s:'spr',c:'sprint',on:'Slow Down',off:'Sprint',
  sub:()=>`+${Math.round(SPRINT_SPD*100)}% infantry speed within ${SPRINT_R}, no guns`,
  tip:'Sound the whistle on every selected Signal Runner, or call them all down.'},
 {f:'bcast',s:'bcast',c:'bcast',on:'Close Net',off:'Broadcast',
  sub:()=>`${Math.round(BCAST_RT*100)}% faster reload within ${BCAST_R}, pinned`,
  tip:'Open or close the net on every selected Command Truck.'}
];
function refreshSelPanel(){
 const info=document.getElementById('selInfo'),pb=document.getElementById('prodBtns'),qr=document.getElementById('queueRow');
 let sig=G.sel.length+'|'+G.sel.map(e=>e.kind==='node'?('nd'+e.x.toFixed(2)+'_'+e.y.toFixed(2)+':'+Math.round(e.amt)):(e.id+':'+Math.round(e.hp)+':'+(e.vr||0)+(e.hold?'h':'')+(e.garrison?'g'+e.garrison.length:''))).join(',')+(G.sel[0]&&G.sel[0].queue?G.sel[0].queue.join(''):''); // v29 sig + v30 garrison counts
 // include ability state so the panel re-renders as cooldowns count down / modes toggle
 if(G.sel.length===1){const e=G.sel[0];if(e.kind==='unit'&&e.t.entrench)sig+='|e'+(e.entrenched?1:0);}
 // v79: the two Green unit toggles, and the Radar Tent's two timers
 if(G.sel.length===1){const e=G.sel[0];
  if(e.kind==='unit'&&e.t.rally)sig+='|om'+(e.onMe?1:0);
  if(e.kind==='unit'&&e.t.smokeCap)sig+='|sm'+(e.smoke?1:0);
  if(e.kind==='bld'&&e.t.uplink)sig+='|up'+Math.ceil(e.upT||0)+'_'+Math.ceil(e.abilityCool||0);
  if(e.kind==='bld'&&e.t.over)sig+='|ov'+Math.ceil(e.upT||0)+'_'+Math.ceil(e.abilityCool||0); // v82: the Overdrive button reads both clocks, so both have to move the signature or it redraws stale
  // v85: the Sprint toggle, and the Forward Pad's pair of clocks on the same rule as Overdrive's
  if(e.kind==='unit'&&e.t.sprint)sig+='|sp'+(e.spr?1:0);
  if(e.kind==='bld'&&e.t.scram)sig+='|sc'+Math.ceil(e.upT||0)+'_'+Math.ceil(e.abilityCool||0);
  /* v86: the Broadcast toggle, the Command Post's single clock (Regroup writes no
     upT, so there is only the cooldown to watch) and the balloon's fuel, which is
     a COUNTDOWN printed on its own button and therefore has to move the signature
     once a second or the readout freezes at whatever it said when the panel last
     rebuilt - the same trap the Overdrive pair records. */
  if(e.kind==='unit'&&e.t.bcast)sig+='|bc'+(e.bcast?1:0);
  if(e.kind==='bld'&&e.t.regroup)sig+='|rg'+Math.ceil(e.abilityCool||0);
  if(e.kind==='unit'&&e.t.balloon)sig+='|fu'+Math.ceil(e.fuel||0);
  /* v87: the unit cooldown and the Foundry's. Both are COUNTDOWNS printed on their
     own buttons, so both have to move the signature once a second or the readout
     freezes at whatever it said when the panel last rebuilt - the trap the
     Overdrive pair records. Pour's readout also counts what is queued elsewhere in
     the base, so that count rides along too. */
  if(e.kind==='unit'&&e.t.abCd)sig+='|ab'+Math.ceil(e.abCool||0);
  if(e.kind==='bld'&&e.t.pour){let n=0;for(const g of e.p.blds)if(g.key==='garage'&&g.prog>=1&&g.queue&&g.queue.length)n++;sig+='|po'+Math.ceil(e.abilityCool||0)+'_'+n;}
 }
 /* Every group toggle rides the signature, read off the SAME table the buttons
    are built from. Five of these were hand-written and four abilities had no
    line at all, which is exactly the failure the group buttons had: a row added
    to UNIT_TOGGLES now cannot ship a button whose label freezes at whatever it
    said when the panel last rebuilt. (v87.1) */
 if(G.sel.length>1)for(const e of G.sel){
  if(e.kind!=='unit')continue;
  for(let i=0;i<UNIT_TOGGLES.length;i++){const a=UNIT_TOGGLES[i];if(e.t[a.f])sig+='|g'+i+'_'+e.id+(e[a.s]?1:0);}
 }
 // v87: and Firebombs, whose group button counts only the ones off cooldown
 if(G.sel.length>1)for(const e of G.sel)if(e.kind==='unit'&&e.t.fbomb)sig+='|gf'+e.id+((e.abCool||0)>0?1:0);
 // any selected building: re-render as its research project (lab or production) progresses / tech set grows
 if(G.sel.length===1){const e=G.sel[0];if(e.kind==='bld'&&(e.t.lab||e.t.prod)){sig+='|res'+(e.techCur||'-')+':'+Math.round(e.techT*4)+':'+e.p.tech.size+':'+Math.floor(e.p.res.p)+'_'+Math.floor(e.p.res.e);}}
 if(sig===lastSelSig)return;lastSelSig=sig;
 /* v102: the rebuild below REPLACES every tile, so a tile the mouse is currently
    over is destroyed without ever firing its own mouseleave - and its popup would
    hang on screen for the rest of the match. Hide it here, at the one place the
    panel is torn down, rather than trying to chase the node. */
 cardPopHide();
 hotReset(); // v73: rebuilt with the panel, and only when the panel really rebuilds
 pb.innerHTML='';qr.innerHTML='';
 if(!G.sel.length){info.textContent='Nothing selected.';return}
 if(G.sel.length===1){
  const e=G.sel[0];
  if(e.kind==='node'){ // v40: resource-pile readout (type + amount remaining)
   const nm=e.wreck?'Plastic Salvage':(e.t==='plastic'?'Plastic Pile':'Battery Cell');
   const ic=(e.t==='plastic'||e.wreck)?'⬢':'⚡', cc=(e.t==='plastic'||e.wreck)?'#ffb95e':'#7fe3ff';
   info.innerHTML=`<b style="color:${cc}">${nm}</b> — ${Math.ceil(e.amt)} / ${Math.round(e.max)} ${ic} remaining`;
   return;
  }
  /* v100: WILDLIFE READS LIKE ANYTHING ELSE. A creature carries `species` where
     every other entity carries `key`, and its CREATURE row has no `.d`, so the
     shared readout below cannot serve it: it is answered here and returns. What
     it shows is what the owner asked for - the name, the army it belongs to
     (Wildlife), and its health - plus the same two counter lines every unit
     gets, so "what hurts this thing" is answerable for a Mouse exactly as it is
     for a Tank. No ability buttons follow, and that is the whole point: it is
     not yours to command, only to read. */
  if(e.kind==='creature'){
   const ct=e.t,cf=FAC.bug;
   const traits=[];
   if(ct.fly)traits.push('flies');
   if(ct.burn)traits.push('its bite sets you alight');
   if(ct.aoe)traits.push('hits everything around what it bites');
   if(ct.boss)traits.push('a nest-boss');
   const cl2=counterLine('creature',e.species);
   info.innerHTML=`<b style="color:${cf.color}">${ct.n}</b> (${cf.name}) — ${Math.ceil(e.hp)}/${e.mhp} HP`
    +`<br><span style="color:#9fb88c">Neutral wildlife: ${traits.length?traits.join(', '):'no special tricks'}. `
    +`Sight ${ct.vi}, speed ${ct.sp}. It answers to no army and attacks whatever comes near${e.nest?' its nest':''}.</span>`
    +`<br><span style="color:#8fa8c8;font-size:11px">${cl2[0]}<br>${cl2[1]}</span>`;
   return;
  }
  const fc=FAC[e.p.fac];
  let extra='';
  if(e.kind==='bld'&&e.prog<1)extra=` — constructing ${Math.round(e.prog*100)}%`;
  if(e.kind==='unit'&&e.t.a==='truck')extra=e.cargo>0?` — carrying ${Math.floor(e.cargo)} ${e.cargoT==='plastic'?'⬢':'⚡'}`:'';
  if(e.garrison&&e.garrison.length)extra=` — garrison ${e.garrison.length}/${garCap(e)}`;
  if(e.kind==='unit'&&e.t.entrench&&e.entrenched)extra=' — ENTRENCHED';
  if(e.kind==='unit'&&e.t.rally&&e.onMe)extra+=' — RALLYING'; // v79
  if(e.kind==='unit'&&e.t.smokeCap&&e.smoke)extra+=' — SMOKE ROUNDS'; // v79
  if(e.kind==='bld'&&e.t.uplink&&e.upT>0)extra+=` — UPLINK ${Math.ceil(e.upT)}s`; // v79
  if(e.kind==='unit'&&e.hold)extra+=' — HOLDING POSITION'; // v29
  if(e.kind==='unit'&&e.vr)extra+=` — ⭐ Rank ${e.vr} (${e.kl} kills)`; // v29
  const upTag=(e.kind==='bld'&&e.upg)?' <span style="color:#ffd24d">★ UPGRADED</span>':'';
  /* v46: the counter lines ride under the description, generated from WVA/UVA.
     v102: for a UNIT they are superseded by the stat card, which states the same
     two facts as an icon grid and states them per target class rather than as a
     capped list. A BUILDING keeps the two lines - the card is a unit card, and a
     structure has neither a DPS-per-second reading nor a sight worth a pill. */
  const cl=counterLine(e.kind,e.key);
  const head=`<b style="color:${fc.color}">${e.t.n}</b> (${fc.name}) — ${Math.ceil(e.hp)}/${e.mhp} HP${extra}${upTag}<br><span style="color:#9fb88c">${e.t.d||''}</span>`;
  info.innerHTML=head+(e.kind==='unit'
   ? unitCard(e.key,{u:e})
   : `<br><span style="color:#8fa8c8;font-size:11px">${cl[0]}<br>${cl[1]}</span>`);
  /* --- v79 RADAR TENT: Target Uplink ---
     Sits in the selection panel rather than the Radio Tower's fixed side panel:
     that panel is the call-down rig and is keyed to t.radio, and a second
     always-on rail for a second building would crowd the right edge. */
  if(e.kind==='bld'&&e.p===G.human&&e.t.uplink&&e.prog>=1){
   const ready=(e.abilityCool||0)<=0, live=(e.upT||0)>0;
   const bt=document.createElement('button');bt.className='bb'+(live?' sel':'');
   bt.innerHTML=`<b>Target Uplink</b><br><span style="font-size:10px;opacity:.75">${live?Math.ceil(e.upT)+'s remaining':(ready?`+${UPLINK_RG} range, +${UPLINK_VI} sight, ${UPLINK_T}s`:Math.ceil(e.abilityCool)+'s cooldown')}</span>`;
   bt.title=`Every unit in your army gains +${UPLINK_RG} tile of range and +${UPLINK_VI} tiles of sight for ${UPLINK_T} seconds. ${UPLINK_CD}-second cooldown.`;
   if(!ready)bt.classList.add('dis');
   bt.onclick=()=>{if((e.abilityCool||0)>0){msg(`Uplink recharging — ${Math.ceil(e.abilityCool)}s.`);return}submitCmd('uplink',{bid:e.id});sClick();};
   pb.appendChild(bt);
  }
  /* --- v82 WIND TURBINE: overdrive --- */
  if(e.kind==='bld'&&e.p===G.human&&e.t.over&&e.prog>=1){
   const live=e.upT>0, ready=e.abilityCool<=0;
   const bt=document.createElement('button');bt.className='bb'+(live?' sel':'');
   bt.disabled=!ready;
   bt.innerHTML=`<b>Overdrive</b><br><span style="font-size:10px;opacity:.75">${live?Math.ceil(e.upT)+'s remaining':(ready?`\u00d7${OVER_MUL} output for ${OVER_T}s, then ${OVER_OFF}s dark`:'offline, '+Math.ceil(e.abilityCool)+'s')}</span>`;
   bt.title=`Run the turbine at \u00d7${OVER_MUL} for ${OVER_T} seconds. It then produces nothing at all for ${OVER_OFF} seconds. Over the whole ${OVER_CD}-second cycle this is less electricity than leaving it alone, not more: it buys the power EARLIER.`;
   bt.onclick=()=>{if(!ready)return;submitCmd('over',{bid:e.id});sClick();};
   pb.appendChild(bt);
  }
  /* --- v81 BUNKER: lockdown --- */
  if(e.kind==='bld'&&e.p===G.human&&e.t.lock&&e.prog>=1){
   const live=e.upT>0, ready=e.abilityCool<=0;
   const bt=document.createElement('button');bt.className='bb'+(live?' sel':'');
   bt.disabled=!ready&&!live;
   bt.innerHTML=`<b>Lockdown</b><br><span style="font-size:10px;opacity:.75">${live?Math.ceil(e.upT)+'s remaining':(ready?`${Math.round(LOCK_RED*100)}% less damage, ${LOCK_T}s, garrison holds fire`:Math.ceil(e.abilityCool)+'s cooldown')}</span>`;
   bt.title=`Button up: the bunker takes ${Math.round(LOCK_RED*100)}% less damage for ${LOCK_T} seconds and the garrison stops firing for all of it. ${LOCK_CD}-second cooldown.`;
   bt.onclick=()=>{submitCmd('lock',{bid:e.id});sClick();};
   pb.appendChild(bt);
  }
  /* --- Forward Pad: scramble, added at v85 --- */
  if(e.kind==='bld'&&e.p===G.human&&e.t.scram&&e.prog>=1){
   const live=e.upT>0, ready=e.abilityCool<=0;
   const bt=document.createElement('button');bt.className='bb'+(live?' sel':'');
   bt.disabled=!ready&&!live;
   bt.innerHTML=`<b>Scramble</b><br><span style="font-size:10px;opacity:.75">${live?Math.ceil(e.upT)+'s remaining':(ready?`+${Math.round(SCRAM_SPD*100)}% speed to every aircraft, ${SCRAM_T}s`:Math.ceil(e.abilityCool)+'s cooldown')}</span>`;
   bt.title=`Scramble the flight: every aircraft you own, anywhere on the map, moves ${Math.round(SCRAM_SPD*100)}% faster for ${SCRAM_T} seconds. ${SCRAM_CD}-second cooldown.`;
   bt.onclick=()=>{submitCmd('scramble',{bid:e.id});sClick();};
   pb.appendChild(bt);
  }
  /* --- Foundry: pour, added at v87 ---
     The readout counts the Garages that would actually be finished, because "Pour"
     over an empty queue is a wasted minute of cooldown and the button should say
     so before it is pressed rather than after. Client-side arithmetic only: the
     command re-derives the same list and is what decides. */
  if(e.kind==='bld'&&e.p===G.human&&e.t.pour&&e.prog>=1){
   const ready=(e.abilityCool||0)<=0;
   let n87=0,fee87=0;
   for(const g of e.p.blds){
    if(g.key!=='garage'||g.prog<1||g.hp<=0||!g.queue||!g.queue.length)continue;
    n87++;fee87+=Math.round(ucost(e.p,g.queue[0]).p*POUR_COST);
   }
   const bt=document.createElement('button');bt.className='bb';
   bt.disabled=!ready||!n87;
   bt.innerHTML=`<b>Pour (${n87})</b><br><span style="font-size:10px;opacity:.75">${ready?(n87?`finish ${n87} vehicle${n87===1?'':'s'} now for ⬢${fee87}`:'no Garage has anything queued'):Math.ceil(e.abilityCool)+'s cooldown'}</span>`;
   bt.title=`Finish the vehicle at the front of every Garage queue at once, for ${Math.round(POUR_COST*100)}% of each one's plastic on top. ${POUR_CD}-second cooldown.`;
   bt.onclick=()=>{if(!ready||!n87)return;submitCmd('pour',{bid:e.id});sClick();};
   pb.appendChild(bt);
  }
  /* --- Command Post: regroup, added at v86 ---
     No `sel` state and no duration readout, because there is none: the ability
     lands its health on the tick it is pressed and the only thing left running is
     the cooldown. */
  if(e.kind==='bld'&&e.p===G.human&&e.t.regroup&&e.prog>=1){
   const ready=(e.abilityCool||0)<=0;
   const bt=document.createElement('button');bt.className='bb';
   bt.disabled=!ready;
   bt.innerHTML=`<b>Regroup</b><br><span style="font-size:10px;opacity:.75">${ready?`+${Math.round(REGROUP_HP*100)}% HP to everyone within ${CPOST_R}`:Math.ceil(e.abilityCool)+'s cooldown'}</span>`;
   bt.title=`Rally the line: every one of your units within ${CPOST_R} tiles is handed ${Math.round(REGROUP_HP*100)}% of its own maximum HP back, at once. ${REGROUP_CD}-second cooldown.`;
   bt.onclick=()=>{if(!ready)return;submitCmd('regroup',{bid:e.id});sClick();};
   pb.appendChild(bt);
  }
  /* --- v80 MUNITIONS DUMP: Scuttle ---
     No cooldown readout, because there is nothing left to recharge: the
     ability destroys the building that offers it. Confirm-on-click would be
     the kind thing to do and is deliberately not done here - every other
     destructive button in the panel (Sell above) fires on one click too, and
     one inconsistent button is worse than one dangerous one. */
  if(e.kind==='bld'&&e.p===G.human&&e.t.scuttle&&e.prog>=1){
   const bt=document.createElement('button');bt.className='bb';
   bt.innerHTML=`<b>💥 Scuttle</b><br><span style="font-size:10px;opacity:.75">${SCUTTLE_DM} over ${SCUTTLE_R} tiles; your own take ${Math.round(SCUTTLE_FF*100)}%</span>`;
   bt.title=`Blow the dump: ${SCUTTLE_DM} damage at the centre, falling off to ${SCUTTLE_R} tiles. Friendly units and structures take ${Math.round(SCUTTLE_FF*100)}% of it, and the dump itself is destroyed.`;
   bt.onclick=()=>{submitCmd('scuttle',{bid:e.id});sClick();};
   pb.appendChild(bt);
  }
  if(e.kind==='bld'&&e.p.human&&e.prog>=1){
   // ---- v71 CONSTRUCT: the retired standing panel, rehomed under the HQ and,
   //      in reduced form, under the Outpost ----
   if(e.key==='hq'||e.key==='outpost'){
    const g=grp(pb,'Construct',true);
    for(const key of constructRoster(e.key))g.add(structTile(key,hotNext()));
   }
   // ---- RESEARCH LAB: flat catalog of unlocks + upgrades ----
   if(e.t.lab){
    const unl=[],upg=[];
    for(const key of researchCatalog(e.p)){
     // techQ holds this building's own project too, so let that one through: it
     // belongs in its group wearing the orange fill, not in a separate chip
     if(hasTech(e.p,key)||(e.p.techQ.includes(key)&&e.techCur!==key))continue;
     (RESEARCH[key].kind==='upgrade'?upg:unl).push(key);
    }
    const emit=(list,head)=>{
     if(!list.length)return;
     const g=grp(pb,head);
     for(const key of list)g.add(researchBtn(e,key,` — ~${researchTime(e,key)|0}s`,hotNext()));
    };
    emit(unl,'Unlock structure');emit(upg,'Upgrade');
    if(!unl.length&&!upg.length){const d=document.createElement('div');d.className='qItem';d.style.opacity=.7;d.textContent='All research complete.';qr.appendChild(d);}
   }
   if(e.t.prod){
    // ---- TRAIN: train and unlock are ONE tile. A gated unit stays on the panel
    //      wearing a grey sprite, a microscope and the RESEARCH price; clicking
    //      it researches. The roster is the full faction list at all times. ----
    const gTrain=grp(pb,'Train');
    for(const k of fullRoster(e.p,e.key)){
     const tk=U[k].tech;
     if(!tk||hasTech(e.p,tk)){
      const c=ucost(e.p,k);
      const limFull=U[k].lim&&unitCapCount(e.p,k)>=U[k].lim;
      const poorP=e.p.res.p<c.p,poorE=e.p.res.e<c.e,poorS=supFree(e.p)<supOf(k);
      const ok=!poorP&&!poorE&&!poorS&&e.queue.length<5&&!limFull;
      gTrain.add(tile({kind:'unit',art:k,fac:e.p.fac,name:U[k].n,dis:!ok,hk:hotNext(),
       c:[['⬢',c.p,tz(c.p,'cp'),poorP],['⚡',c.e,tz(c.e,'ce'),poorE],
          ['🪖',supOf(k),'cs',poorS]],
       card:unitCardPop(k,e.p,U[k].d),
       onclick:()=>{submitCmd('train',{bid:e.id,k});sClick()}}));
     }else{
      const rc=rcost(e.p,tk),busy=(e.techCur===tk);
      const elsewhere=e.p.techQ.includes(tk)&&!busy;
      const poorP=e.p.res.p<rc.p,poorE=e.p.res.e<rc.e;
      gTrain.add(tile({kind:'unit',art:k,fac:e.p.fac,name:U[k].n,locked:true,hk:hotNext(),
       dis:!busy&&(elsewhere||!!e.techCur||poorP||poorE),
       c:[['⬢',rc.p,'cp',poorP&&!busy],['⚡',rc.e,'ce',poorE&&!busy],
          ['⏱',(researchTime(e,tk)|0)+'s','ctm',false]],
       fill:busy?(()=>e.techT/researchTime(e,tk)):null,
       card:unitCardPop(k,e.p,U[k].d,`Unlock: ${RESEARCH[tk].name} — ~${researchTime(e,tk)|0}s, runs while you keep producing`),
       onclick:()=>{if(!busy&&!e.techCur&&!elsewhere){submitCmd('research',{bid:e.id,key:tk});sClick()}}}));
     }
    }
    // ---- this building's OWN upgrade keeps its own group ----
    {
     const ups=bldResearchList(e.p,e.key).filter(key=>RESEARCH[key].kind==='upgrade'
       &&!hasTech(e.p,key)&&(!e.p.techQ.includes(key)||e.techCur===key));
     if(ups.length){
      const g=grp(pb,'Research');
      for(const key of ups)g.add(researchBtn(e,key,` — ~${researchTime(e,key)|0}s, runs while you keep producing`,hotNext()));
     }
    }
    // ---- production queue: a rising ARMY-COLOUR wash over the sprite, no percentage.
    //      Click a chip to cancel it and get the resources back. ----
    if(e.queue.length){
     const gQ=grp(pb,'Queue');
     e.queue.forEach((q,qi)=>{
      const d=document.createElement('button');d.className='qc'+(qi?' pend':'');
      d.title='Click to cancel and refund';
      d.innerHTML='<div class="qa"><img src="'+(tileURL('unit',q,e.p.fac)||'')+'" alt="">'
        +(qi?'':'<div class="wash"></div><div class="edge"></div>')+'</div>'
        +'<div class="ql">'+U[q].n+'</div>';
      if(!qi){
       const wsh=d.querySelector('.wash'),edg=d.querySelector('.edge');
       /* v74: army colour, not the green the stylesheet defaults to */
       paintTeamFill(wsh,edg,e.p.fac);
       V71FILL.push({w:wsh,e:edg,get:()=>e.prodT/U[q].bt});
      }
      d.onclick=()=>{submitCmd('cancel',{bid:e.id,idx:qi});sClick();};
      gQ.add(d);
     });
    }
    const hint=document.createElement('div');hint.className='qItem';hint.style.opacity=.6;hint.textContent='Right-click map to set rally';qr.appendChild(hint);
   }
   // ---- these stay TEXT buttons: they have no sprite to show ----
   {
    const gs=grp(pb,'Structure');
    if(e.t.gar&&e.garrison.length){
     const bt=document.createElement('button');bt.className='bb';bt.innerHTML='<b>Unload All</b>';bt.onclick=()=>{submitCmd('unload',{bid:e.id});sClick()};gs.add(bt);
    }
    // ---- v29 SELL: 50% of the plastic cost back; queued units refund in full. The HQ is never sellable. ----
    if(e.key!=='hq'&&e.key!=='nest'&&e.p===G.human){
     const sc=Math.round(bcost(e.p,e.key).p*SELL_FRAC);
     const bt=document.createElement('button');bt.className='bb';
     bt.innerHTML=`<b>💰 Sell</b><span class="cp">+⬢${sc}</span>`;
     bt.title='Sell this structure for 50% of its plastic cost. Queued units and garrisons are returned.';
     bt.onclick=()=>{submitCmd('sell',{bid:e.id});sClick()};
     gs.add(bt);
    }
   }
  }
  // ---- MACHINE GUNNER: entrench toggle ----
  if(e.kind==='unit'&&e.p.human&&e.t.entrench){
   const bt=document.createElement('button');bt.className='bb'+(e.entrenched?' sel':'');
   bt.innerHTML=`<b>${e.entrenched?'Pack Up':'Entrench'}</b><br><span style="font-size:10px;opacity:.75">${ENTRENCH_RATE}× fire rate, 100° cone</span>`;
   bt.title='Dig in: hold position and double rate of fire in a 100° cone you aim.';
   bt.onclick=()=>{
    if(e.entrenched){submitCmd('unentrench',{ids:[e.id]});sClick();}
    else{G.radioTargeting={unit:e,mode:'entrench'};msg('Click to aim the entrench cone.');sClick();}
   };
   abilAdd(pb,bt);
  }
  /* --- v79 SARGE: the "On Me!" broadcast ---
     Every number in the label reads the constants, so a tuning pass moves one
     literal and the button follows. No aim step: this is a radius. */
  if(e.kind==='unit'&&e.p===G.human&&e.t.rally){
   const bt=document.createElement('button');bt.className='bb'+(e.onMe?' sel':'');
   bt.innerHTML=`<b>${e.onMe?'Stand Down':'On Me!'}</b><br><span style="font-size:10px;opacity:.75">+${Math.round(SARGE_AURA*100)}% damage to infantry within ${SARGE_AURA_R}, −${Math.round((1-SARGE_SELF)*100)}% his own</span>`;
   bt.title=`Allied infantry within ${SARGE_AURA_R} tiles hit ${Math.round(SARGE_AURA*100)}% harder while Sarge broadcasts. His own damage is cut ${Math.round((1-SARGE_SELF)*100)}% for as long as it runs.`;
   bt.onclick=()=>{submitCmd('onme',{ids:[e.id],on:!e.onMe});sClick();};
   abilAdd(pb,bt);
  }
  // --- v79 MORTAR: ammunition select ---
  if(e.kind==='unit'&&e.p===G.human&&e.t.smokeCap){
   const bt=document.createElement('button');bt.className='bb'+(e.smoke?' sel':'');
   bt.innerHTML=`<b>${e.smoke?'High Explosive':'Smoke Rounds'}</b><br><span style="font-size:10px;opacity:.75">−${Math.round(SMOKE_RED*100)}% damage taken under a ${SMOKE_R}-tile cloud, ${SMOKE_T}s</span>`;
   bt.title=`Smoke rounds do no damage. The tube shells whichever friendly unit near it is under fire, and anything of yours inside the cloud takes ${Math.round(SMOKE_RED*100)}% less for ${SMOKE_T} seconds.`;
   bt.onclick=()=>{submitCmd('smoke',{ids:[e.id],on:!e.smoke});sClick();};
   abilAdd(pb,bt);
  }
  /* --- v80 FLAMETHROWER: the pressure valve --- */
  if(e.kind==='unit'&&e.p===G.human&&e.t.valve){
   const bt=document.createElement('button');bt.className='bb'+(e.valve?' sel':'');
   bt.innerHTML=`<b>${e.valve?'Close Valve':'Pressure Valve'}</b><br><span style="font-size:10px;opacity:.75">+${Math.round(VALVE_DMG*100)}% damage, +${VALVE_RG} range, ${Math.round(VALVE_BACK*100)}% of it back on him</span>`;
   bt.title=`Open the valve: ${Math.round(VALVE_DMG*100)}% more damage and ${VALVE_RG} tile more reach, but ${Math.round(VALVE_BACK*100)}% of every point he deals is taken by the flamethrower himself.`;
   bt.onclick=()=>{submitCmd('valve',{ids:[e.id],on:!e.valve});sClick();};
   abilAdd(pb,bt);
  }
  /* --- v80 BULL: full throttle --- */
  if(e.kind==='unit'&&e.p===G.human&&e.t.throttle){
   const bt=document.createElement('button');bt.className='bb'+(e.thr?' sel':'');
   bt.innerHTML=`<b>${e.thr?'Throttle Down':'Full Throttle'}</b><br><span style="font-size:10px;opacity:.75">+${Math.round(THROTTLE_SPD*100)}% speed, crushes infantry & barricades, cannot fire</span>`;
   bt.title=`Charge: ${Math.round(THROTTLE_SPD*100)}% faster, and enemy infantry and barricades under the tracks are crushed outright. Both weapons are silent for as long as it runs.`;
   bt.onclick=()=>{submitCmd('throttle',{ids:[e.id],on:!e.thr});sClick();};
   abilAdd(pb,bt);
  }
  /* --- v81 SNIPER: called shot --- */
  if(e.kind==='unit'&&e.p===G.human&&e.t.cshot){
   const bt=document.createElement('button');bt.className='bb'+(e.cs?' sel':'');
   bt.innerHTML=`<b>${e.cs?'Free Fire':'Called Shot'}</b><br><span style="font-size:10px;opacity:.75">+${Math.round(CS_DMG*100)}% damage, infantry only</span>`;
   bt.title=`Take only infantry targets, and hit them ${Math.round(CS_DMG*100)}% harder. He will not fire on vehicles, aircraft or structures while it runs.`;
   bt.onclick=()=>{submitCmd('cshot',{ids:[e.id],on:!e.cs});sClick();};
   abilAdd(pb,bt);
  }
  /* --- v81 ROCKET ARTILLERY: ripple fire --- */
  if(e.kind==='unit'&&e.p===G.human&&e.t.ripple){
   const bt=document.createElement('button');bt.className='bb'+(e.rip?' sel':'');
   bt.innerHTML=`<b>${e.rip?'Single Fire':'Ripple Fire'}</b><br><span style="font-size:10px;opacity:.75">${RIPPLE_N} rockets at ${Math.round(RIPPLE_DM*100)}% each, +${Math.round((RIPPLE_RT-1)*100)}% reload</span>`;
   bt.title=`Fire a ${RIPPLE_N}-rocket salvo scattered across a wider box, each rocket carrying ${Math.round(RIPPLE_DM*100)}% of a full shell, then reload ${Math.round((RIPPLE_RT-1)*100)}% longer.`;
   bt.onclick=()=>{submitCmd('ripple',{ids:[e.id],on:!e.rip});sClick();};
   abilAdd(pb,bt);
  }
  /* --- v82 SCOUT BIKE: flat out --- */
  if(e.kind==='unit'&&e.p===G.human&&e.t.flat){
   const bt=document.createElement('button');bt.className='bb'+(e.flat?' sel':'');
   bt.innerHTML=`<b>${e.flat?'Slow Down':'Flat Out'}</b><br><span style="font-size:10px;opacity:.75">+${Math.round(FLAT_SPD*100)}% speed, +${FLAT_VI} sight, no guns</span>`;
   bt.title=`Run flat out: ${Math.round(FLAT_SPD*100)}% faster and ${FLAT_VI} tiles more sight, but he will not fire and cannot be sent at a target while it runs.`;
   bt.onclick=()=>{submitCmd('flat',{ids:[e.id],on:!e.flat});sClick();};
   abilAdd(pb,bt);
  }
  /* --- v82 CHINOOK: air assault --- */
  if(e.kind==='unit'&&e.p===G.human&&e.t.assault){
   const bt=document.createElement('button');bt.className='bb'+(e.aslt?' sel':'');
   bt.innerHTML=`<b>${e.aslt?'Cease Fire':'Air Assault'}</b><br><span style="font-size:10px;opacity:.75">the squad fires out; the aircraft cannot move</span>`;
   bt.title='Open the hold: every man aboard fires on what he can reach, and can be answered by it. The Chinook is pinned in place for as long as it runs.';
   bt.onclick=()=>{submitCmd('assault',{ids:[e.id],on:!e.aslt});sClick();};
   abilAdd(pb,bt);
  }
  /* --- Signal Runner: sprint, added at v85 --- */
  if(e.kind==='unit'&&e.p===G.human&&e.t.sprint){
   const bt=document.createElement('button');bt.className='bb'+(e.spr?' sel':'');
   bt.innerHTML=`<b>${e.spr?'Slow Down':'Sprint'}</b><br><span style="font-size:10px;opacity:.75">+${Math.round(SPRINT_SPD*100)}% speed to infantry within ${SPRINT_R}, none of them may fire</span>`;
   bt.title=`Sound the whistle: every friendly infantryman within ${SPRINT_R} tiles moves ${Math.round(SPRINT_SPD*100)}% faster, the Runner included. Nobody inside the radius will fire, take an attack order, or acquire a target while it runs.`;
   bt.onclick=()=>{submitCmd('sprint',{ids:[e.id],on:!e.spr});sClick();};
   abilAdd(pb,bt);
  }
  /* --- Firebomb Heli: napalm blast, added at v87 ---
     The first unit button in the file with a cooldown on it, so it is also the
     first that reads a clock off the UNIT rather than off a building. Shaped like
     the Radar Tent's, which is the closest existing thing: a live readout when it
     is recharging and the effect when it is not. */
  if(e.kind==='unit'&&e.p===G.human&&e.t.fbomb){
   const ready=(e.abCool||0)<=0;
   const bt=document.createElement('button');bt.className='bb';
   bt.disabled=!ready;
   bt.innerHTML=`<b>🔥 Napalm Blast</b><br><span style="font-size:10px;opacity:.75">${ready?`${FB_N} firebombs within ${FB_R}; the fire burns your men too`:Math.ceil(e.abCool)+'s cooldown'}</span>`;
   bt.title=`Empty the racks: ${FB_N} firebombs on random tiles within ${FB_R} of the helicopter, each leaving ${FB_BURN} seconds of fire that burns FRIENDLY units and structures as readily as enemy ones. ${FB_CD}-second cooldown.`;
   bt.onclick=()=>{if(!ready)return;submitCmd('napalmblast',{ids:[e.id]});sClick();};
   abilAdd(pb,bt);
  }
  /* --- Choktaw: paint, added at v88 ---
     Shaped like the Napalm Blast above it - the same cooldown readout on the same
     u.abCool clock - with one difference: this one AIMS. It hands off to
     G.radioTargeting the way the Gunner's entrench does, because the box is a
     player's choice and not a radius around the aircraft.
     It has no group button, and that is a decision rather than an omission: the
     mark is SET rather than accumulated, so a second Choktaw over the same box
     restarts a clock that is already running and spends a second cooldown for
     nothing. tail_v88 pins that it stays out of UNIT_TOGGLES too - it is a
     one-shot, like the Napalm Blast and the Bail. */
  if(e.kind==='unit'&&e.p===G.human&&e.t.paint){
   const ready=(e.abCool||0)<=0;
   const bt=document.createElement('button');bt.className='bb'+(G.radioTargeting&&G.radioTargeting.unit===e&&G.radioTargeting.mode==='paint'?' sel':'');
   bt.disabled=!ready;
   bt.innerHTML=`<b>🎯 Paint</b><br><span style="font-size:10px;opacity:.75">${ready?`${PAINT_BOX}×${PAINT_BOX} area, +${Math.round(PAINT_DMG*100)}% damage taken for ${PAINT_T}s`:Math.ceil(e.abCool)+'s cooldown'}</span>`;
   bt.title=`Mark a ${PAINT_BOX}×${PAINT_BOX} area: every enemy unit inside it takes +${Math.round(PAINT_DMG*100)}% damage from EVERY source for ${PAINT_T} seconds. Click to place the box. ${PAINT_CD}-second cooldown.`;
   bt.onclick=()=>{if(!ready)return;G.radioTargeting={unit:e,mode:'paint'};msg('Click to place the paint box.');sClick();};
   abilAdd(pb,bt);
  }
  /* --- Command Truck: broadcast, added at v86 --- */
  if(e.kind==='unit'&&e.p===G.human&&e.t.bcast){
   const bt=document.createElement('button');bt.className='bb'+(e.bcast?' sel':'');
   bt.innerHTML=`<b>${e.bcast?'Close Net':'Broadcast'}</b><br><span style="font-size:10px;opacity:.75">allies within ${BCAST_R} reload ${Math.round(BCAST_RT*100)}% faster; the truck cannot move</span>`;
   bt.title=`Open the net: every allied unit within ${BCAST_R} tiles reloads ${Math.round(BCAST_RT*100)}% faster. The Command Truck is pinned where it stands for as long as it runs.`;
   bt.onclick=()=>{submitCmd('bcast',{ids:[e.id],on:!e.bcast});sClick();};
   abilAdd(pb,bt);
  }
  /* --- Observation Balloon: bail out, added at v86 ---
     Destructive on one click, on the same argument the Munitions Dump's Scuttle
     was shipped with at v80: every other destructive button in this panel fires
     on one click, and one inconsistent button is worse than one dangerous one.
     The fuel readout is the point of the row - a balloon is a clock, and the
     player has to be able to see how much of it is left. */
  if(e.kind==='unit'&&e.p===G.human&&e.t.bail){
   const left=Math.max(0,Math.ceil(e.fuel==null?BALLOON_FUEL:e.fuel));
   const bt=document.createElement('button');bt.className='bb';
   bt.innerHTML=`<b>🪂 Bail</b><br><span style="font-size:10px;opacity:.75">${BAIL_CREW.length} men out, balloon destroyed — ${left}s of gas left</span>`;
   bt.title=`Put ${BAIL_CREW.map(k=>U[k].n).join(', ')} on the ground beneath the balloon and destroy it. Let the gas run out instead and the crew goes down with it.`;
   bt.onclick=()=>{submitCmd('bail',{ids:[e.id]});sClick();};
   abilAdd(pb,bt);
  }
  // ---- v30 APC: troop bay readout + unload ----
  if(e.kind==='unit'&&e.p.human&&e.t.cap){
   const n2=(e.garrison||[]).length;
   const bt=document.createElement('button');bt.className='bb';
   bt.innerHTML=`<b>Unload (${n2}/${e.t.cap})</b><br><span style="font-size:10px;opacity:.75">U — right-click the ${e.t.n} with infantry to load</span>`;
   bt.title=`Drop the squad here. Right-click the ${e.t.n} with infantry selected to load them aboard.`;
   if(!n2)bt.classList.add('dis');
   bt.onclick=()=>{if(!(e.garrison||[]).length)return;if(!dropOk(e)){msg('No clear ground below.');return}submitCmd('unloadu',{ids:[e.id]});sClick();};
   abilAdd(pb,bt);
  }
 } else {
  const counts={};for(const e of G.sel)counts[e.t.n]=(counts[e.t.n]||0)+1;
  info.innerHTML=`<b>${G.sel.length} units</b>: `+Object.entries(counts).map(([n,c])=>`${c}× ${n}`).join(', ');
  // v27: one square portrait per selected unit, health-banded border + bar.
  // Click a face to pick that single unit out of the group.
  const pg2=document.createElement('div');pg2.id='portGrid';
  for(const e of G.sel){
   if(e.kind!=='unit')continue;
   const hf=clamp(e.hp/e.mhp,0,1),bandc=hpBand(hf);
   const d=document.createElement('div');d.className='port';d.title=e.t.n+' \u2014 '+Math.ceil(e.hp)+'/'+e.mhp+' HP';
   const url=portraitURL(e.key,e.p.fac);
   if(url){const im=document.createElement('img');im.src=url;im.style.width='26px';im.style.height='26px';im.style.display='block';im.style.borderRadius='4px';im.style.boxSizing='border-box';im.style.border='2px solid '+bandc;d.appendChild(im);}
   else{const fb=document.createElement('div');fb.className='pfall';fb.textContent=e.t.n.slice(0,2);fb.style.border='2px solid '+bandc;d.appendChild(fb);}
   const bar=document.createElement('div');bar.className='pbar';const fi=document.createElement('i');fi.style.width=Math.round(hf*100)+'%';fi.style.background=bandc;bar.appendChild(fi);d.appendChild(bar);
   d.onclick=()=>{setSel([e]);sClick();};
   pg2.appendChild(d);
  }
  info.appendChild(pg2);
  /* Every toggleable ability any selected unit owns, one button each, built off
     UNIT_TOGGLES. Each button counts and commands only the units that actually
     carry that ability, so a mixed selection of gunners, mortars and flamers
     shows three buttons and each one moves its own men. Any unit already running
     the ability flips the whole of its group back off, so a button is never
     ambiguous about what it will do. The p===G.human gate is per row and matches
     the single-unit panel; v55 records why it is p===G.human and not p.human -
     a spectator would otherwise still see the button. (v87.1) */
  for(const a of UNIT_TOGGLES){
   const list=G.watch?[]:G.sel.filter(s=>s.kind==='unit'&&s.p===G.human&&s.t[a.f]);
   if(!list.length)continue;
   const any=list.some(g=>g[a.s]);
   const bt=document.createElement('button');bt.className='bb'+(any?' sel':'');
   bt.innerHTML=`<b>${any?a.on:a.off} (${list.length})</b><br><span style="font-size:10px;opacity:.75">${a.sub()}</span>`;
   bt.title=a.tip;
   bt.onclick=()=>{
    if(a.offc){ // the entrench pair: two commands, and turning it ON needs an aimed direction
     if(any){submitCmd(a.offc,{ids:list.map(g=>g.id)});sClick();}
     else{G.radioTargeting={unit:list[0],mode:a.c,group:list};msg(a.aim);sClick();}
     return;
    }
    submitCmd(a.c,{ids:list.map(g=>g.id),on:!any});sClick();
   };
   abilAdd(pb,bt);
  }
  /* v87: Firebombs are the one group button that is NOT a toggle, so they stay
     hand-written below the loop. Only the ones actually off cooldown are counted
     or sent, so the button says how many will fire rather than how many are
     selected - which is why this cannot be a UNIT_TOGGLES row. */
  const fbs=G.watch?[]:G.sel.filter(s=>s.kind==='unit'&&s.p===G.human&&s.t.fbomb&&(s.abCool||0)<=0);
  if(fbs.length){
   const bt=document.createElement('button');bt.className='bb';
   bt.innerHTML=`<b>🔥 Napalm Blast (${fbs.length})</b><br><span style="font-size:10px;opacity:.75">${FB_N} firebombs each, and the fire burns your men too</span>`;
   bt.title='Empty the racks on every selected Firebomb Heli that is off cooldown.';
   bt.onclick=()=>{submitCmd('napalmblast',{ids:fbs.map(g=>g.id)});sClick();};
   abilAdd(pb,bt);
  }
 }
}
/* v43: the two roster-cap idioms, factored. unitCapCount counts what a player
   already owns of a unit INCLUDING everything still sitting in production queues
   (the build UI and trainUnit must agree, or the UI offers buttons that fail).
   bldCount is the plain structure count behind per-player building limits.
   Pure reads: no RNG, no mutation, nothing hashed. */
function unitCapCount(p,key){
 let n=0;
 for(const u of p.units)if(u.key===key)n++;
 for(const b of p.blds)for(const q of (b.queue||[]))if(q===key)n++;
 return n;
}
function bldCount(p,key){let n=0;for(const b of p.blds)if(b.key===key)n++;return n;}
function trainUnit(b,k){
 const c=ucost(b.p,k);
 if(b.p.res.p<c.p||b.p.res.e<c.e||supFree(b.p)<supOf(k)||b.queue.length>=5)return false;
 if(U[k].lim&&unitCapCount(b.p,k)>=U[k].lim)return false;
 b.p.res.p-=c.p;b.p.res.e-=c.e;b.queue.push(k);lastSelSig='';return true;
}
// cancel a queued unit and refund its cost (resets the timer if it was building)
function cancelQueued(b,idx){
 if(!b.queue||idx<0||idx>=b.queue.length)return;
 const c=ucost(b.p,b.queue[idx]);
 b.queue.splice(idx,1);
 b.p.res.p+=c.p;b.p.res.e+=c.e;
 if(idx===0)b.prodT=0;
 lastSelSig='';if(b.p.human)updateTopbar();
}
// resource cost of a research entry, scaled by the faction cost modifier
function rcost(p,key){if(G&&G.test)return{p:0,e:0};const m=FAC[p.fac].mods.cost,r=RESEARCH[key];return{p:Math.round(r.cp*m),e:Math.round(r.ce*m)};}
// can player p research `key` right now? (available to faction, not already
// taken/queued, prerequisites met for upgrades). If a building is supplied, it must
// be the correct building type for this research.
function canResearch(p,key,b){
 const r=RESEARCH[key];if(!r)return false;
 if(!techAvailable(p,key))return false;
 if(hasTech(p,key)||p.techQ.includes(key))return false;
 if(r.kind==='upgrade'&&r.reqTech&&!hasTech(p,r.reqTech))return false;
 if(b&&b.key!==researchBuilding(key))return false;
 return true;
}
// start a research project on a building: pay now, it works one project at a time.
// Production buildings research IN PARALLEL with their unit queue (research never
// stalls production); labs only research.
function startResearch(b,key){
 const p=b.p;if(!canResearch(p,key,b))return false;
 if(b.techCur)return false;                 // one project per building at a time
 const c=rcost(p,key);
 if(p.res.p<c.p||p.res.e<c.e)return false;
 p.res.p-=c.p;p.res.e-=c.e;
 p.techQ.push(key);
 b.techCur=key;b.techT=0;
 lastSelSig='';if(p.human){updateTopbar();msg(`Researching ${RESEARCH[key].name}…`);}
 return true;
}
// research time; the lab upgrade only speeds up actual Labs
function researchTime(b,key){const base=RESEARCH[key].time;return (b.t.lab&&hasTech(b.p,'up_lab'))?base*UPGRADES.lab.labSpeed:base;}
// finish a research project: mark it learned and apply any immediate effects
function finishResearch(p,key){
 p.tech.add(key);p.techDone.add(key);
 const idx=p.techQ.indexOf(key);if(idx>=0)p.techQ.splice(idx,1);
 const r=RESEARCH[key];
 if(r.kind==='upgrade')applyUpgrade(p,r.bkey);
 if(p.human){
  msg(`✔ ${r.name} researched.`);
  lastSelSig='';
 }
}
// apply a building upgrade army-wide: bump existing buildings' max HP (and heal
// proportionally) and effect strength. Newly-built buildings pick it up via
// makeBuilding, and newly-trained units via makeUnit, both checking p.tech.
function applyUpgrade(p,bk){
 const ug=UPGRADES[bk];if(!ug)return;
 for(const b of p.blds){
  if(b.key!==bk)continue;
  const frac=b.hp/b.mhp;
  b.mhp=Math.round(B[bk].hp*FAC[p.fac].mods.hp*ug.hp);
  b.hp=Math.max(1,Math.round(b.mhp*frac));
  b.upg=true;
 }
}
function unloadBunker(b){
 for(const u of b.garrison){u.garrisoned=false;const sp=spawnSpot(b);u.x=sp.x;u.y=sp.y;orderMove(u,b.x,b.y+b.sz+1,false)}
 b.garrison=[];
}
function spawnSpot(b){
 for(let r=0;r<5;r++)for(let oy=-r;oy<=b.sz+r;oy++)for(let ox=-r;ox<=b.sz+r;ox++){
  if(ox>=0&&ox<b.sz&&oy>=0&&oy<b.sz)continue;
  const tx=b.tx+ox,ty=b.ty+oy;
  if(passable(tx,ty))return{x:tx+.5,y:ty+.5};
 }
 return{x:b.x,y:b.y+b.sz};
}

