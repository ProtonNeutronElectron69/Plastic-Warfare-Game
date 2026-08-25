/* ---------------- SETUP SCREEN ---------------- */
let SETUP={fac:'green',mode:'dm',map:'backyard',opp:1,diff:'normal',test:0,watch:0}; // v50: test = the sandbox toggle. v55: watch = spectate mode
const facRow=document.getElementById('facRow');
for(const k in FAC){if(k==='bug')continue;const f=FAC[k];const c=document.createElement('div');c.className='card'+(k==='green'?' sel':'');c.innerHTML=`<div class="cname"><div class="dot" style="background:${f.color}"></div>${f.name}</div><div class="cdesc">${f.desc}</div><div class="uq">★ ${f.uu.map(k=>U[k].n).join(' • ')}<br>★ ${f.ub.map(k=>B[k].n).join(' • ')}</div>`;
 c.onclick=()=>{document.querySelectorAll('#facRow .card').forEach(x=>x.classList.remove('sel'));c.classList.add('sel');SETUP.fac=k;sClick()};facRow.appendChild(c)}
const mapRow=document.getElementById('mapRow');
for(const k in MAPS){const m=MAPS[k];const c=document.createElement('div');c.className='card mcard'+(k==='backyard'?' sel':'');c.dataset.map=k;if(m.survOnly){c.dataset.survonly='1';c.style.display='none';} /* v35: survival-only maps hidden outside Wave Survival */ c.innerHTML=`<div class="cname">${m.n}</div><div class="cdesc">${m.d}</div>`;
 c.onclick=()=>{document.querySelectorAll('#mapRow .card').forEach(x=>x.classList.remove('sel'));c.classList.add('sel');SETUP.map=k;sClick()};mapRow.appendChild(c)}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-mode]').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');SETUP.mode=b.dataset.mode;refreshTeamRow();sClick()}); // v33
document.querySelectorAll('[data-opp]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-opp]').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');SETUP.opp=+b.dataset.opp;sClick()});
document.querySelectorAll('[data-diff]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-diff]').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');SETUP.diff=b.dataset.diff;sClick()});
// v50: testing mode. refreshTeamRow relabels the army-count row and the team chips off SETUP.test.
document.querySelectorAll('[data-test]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-test]').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');SETUP.test=+b.dataset.test;if(SETUP.test)setWatchMode(0);refreshTeamRow();sClick()});
// v55: SPECTATE MODE. The opposite sandbox: testing mode hands you every army,
// spectate mode hands you none. Selecting either clears the other through these
// two setters, which repaint their own row so the screen never shows both lit.
function setWatchMode(v){SETUP.watch=v?1:0;document.querySelectorAll('[data-watch]').forEach(x=>x.classList.toggle('sel',+x.dataset.watch===SETUP.watch));}
function setTestMode(v){SETUP.test=v?1:0;document.querySelectorAll('[data-test]').forEach(x=>x.classList.toggle('sel',+x.dataset.test===SETUP.test));}
document.querySelectorAll('[data-watch]').forEach(b=>b.onclick=()=>{setWatchMode(+b.dataset.watch);if(SETUP.watch)setTestMode(0);refreshTeamRow();sClick()});
// v29: per-slot team pickers. Clicking a chip cycles its team 1-4; matching numbers
// ally (shared vision, no friendly fire, joint victory). Chips beyond the current
// opponent count hide themselves; an all-one-team pick falls back to FFA in newGame.
SETUP.teams=[1,2,3,4];
const TSLOT_NAMES=['You','CPU 1','CPU 2','CPU 3'];
function refreshTeamRow(){
 const surv=SETUP.mode==='surv',test=!!SETUP.test,watch=!!SETUP.watch; // v33: survival is co-op; hide teams, relabel opponents. v50: testing mode relabels them ARMIES (they are all yours). v55: spectate mode fixes the count at WATCH_ARMIES and relabels the slots CPU 1..4
 // v55: the army-count row goes away in spectate mode, so keep the model in step
 // with what is on screen. newGame forces the same figure onto its own config
 // copy, so a harness call that never touches SETUP still gets four armies.
 if(watch)SETUP.opp=WATCH_ARMIES-1;
 const orow=document.getElementById('oppRow');if(orow)orow.style.display=watch?'none':'';
 const tr=document.getElementById('teamRow');if(tr)tr.style.display=surv?'none':'';
 const ol=document.querySelector('#oppRow .slabel');if(ol)ol.textContent=test?'Armies (all yours)':surv?'Allied Armies':'Enemy Armies';
 // v34: Solo (0 allies) is a survival-only choice; leaving survival with it selected snaps back to 1.
 // v50: data-opp is a count of OTHER armies, so testing mode reads it as (n+1) armies total
 // and needs the 0 button (a one-army sandbox) that survival introduced.
 document.querySelectorAll('[data-opp]').forEach(b=>{const n=+b.dataset.opp;
  if(n===0)b.style.display=(surv||test)?'':'none';
  b.textContent=test?((n+1)+(n?' Armies':' Army')):(n===0?'Solo':(n+(n>1?' Opponents':' Opponent')));
 });
 if(!surv&&!test&&SETUP.opp===0){SETUP.opp=1;document.querySelectorAll('[data-opp]').forEach(x=>x.classList.toggle('sel',x.dataset.opp==='1'));}
 // v35: survival-only maps (Desk) show only in Wave Survival; leaving survival with one selected snaps the map back to Backyard.
 document.querySelectorAll('#mapRow .card[data-survonly]').forEach(cd=>{cd.style.display=surv?'':'none';});
 if(!surv){const sc=document.querySelector('#mapRow .card[data-survonly].sel');if(sc){sc.classList.remove('sel');const bc=document.querySelector('#mapRow .card[data-map="backyard"]');if(bc)bc.classList.add('sel');SETUP.map='backyard';}}
 document.querySelectorAll('[data-tslot]').forEach(b=>{
  const i=+b.dataset.tslot;
  b.style.display=i<=SETUP.opp?'':'none';
  b.textContent=`${watch?'CPU '+(i+1):test?'Army '+(i+1):TSLOT_NAMES[i]} — Team ${SETUP.teams[i]}`;
 });
}
document.querySelectorAll('[data-tslot]').forEach(b=>b.onclick=()=>{const i=+b.dataset.tslot;SETUP.teams[i]=SETUP.teams[i]%4+1;refreshTeamRow();sClick()});
document.querySelectorAll('[data-opp]').forEach(b=>b.addEventListener('click',refreshTeamRow));
refreshTeamRow();
/* v91: the load is kicked off when the page opens (below) and merely AWAITED
   here, so it has normally finished long before anybody picks an army. Only the
   Start button waits, and only this one call site changed: newGame() itself is
   untouched and stays synchronous for the lobby and for every fixture. With the
   v91 manifest empty this resolves on the same turn of the event loop, so the
   button behaves exactly as it did. `ac()` stays FIRST and stays synchronous -
   it is the audio unlock, and browsers only grant it inside the gesture that
   triggered it, which an await would have thrown away. */
document.getElementById('startBtn').onclick=()=>{ac();assetsLoad().then(()=>newGame(SETUP))};
/* ---------------- ONLINE LOBBY ----------------
   Manual-signaling lobby with a live shared roster. Hosting: pick army/mode/map
   as usual, set each of the three other slots to CPU (with its own difficulty),
   Open (a friend joins), or Closed.

   v57: ONE LOBBY CODE, ONE PASTE BOX. Every open seat's offer is bundled into a
   single seat-tagged PW2 code (130 chars for one seat, 372 for three - a v56
   single-slot invite was 398 on its own), so the host copies one code once and
   drops it in the group chat. A reply carries the lobby id and the seat it
   answers, so the host has ONE paste box: lobTakeReply routes it to that seat
   and connects without a button. The joiner's side is symmetric - the reply
   builds itself as soon as a lobby code lands in the box, and both sides copy
   to the clipboard unasked.
   The reply is still a round trip and cannot stop being one: each side has to
   learn the other's DTLS fingerprint and ICE credentials, and a freshly loaded
   page has credentials nobody can predict. With no rendezvous server, leg two
   is hand-carried; all v57 does is make it one paste instead of four clicks.

   v47: THE HOST IS THE SINGLE SOURCE OF TRUTH. Every change - a mode/map/army
   click, a slot role cycle, a name edit, a connect, a disconnect, a ready toggle
   - rebuilds one snapshot (lobSnapshot) and pushes it to every connected peer
   with that peer's own slot id attached, so all humans see the same roster and
   the same settings at the same moment.
     host -> peer   {lob:<snapshot>, you:<sid>}    full lobby state
                    {lchat0:[{n,m},..]}            chat backlog, once, on connect
                    {lchat:{n,m}}                  one new chat line
                    {go:{cfg,you}}                 start the match (unchanged)
     peer -> host   {pick:{fac,name,ready}}        describes ONLY the sender
                    {chat:s}                       one chat line
   The host stamps the sender's identity onto everything inbound, exactly as
   netHostMsg stamps command ownership in-match, so a peer can never rename,
   re-army or ready up another slot; m.pick.fac is validated against lobFacKeys()
   so no peer-authored string reaches a FAC lookup. Peer-authored text is written
   with lobTxt/textContent, never innerHTML.
   Chat deliberately does NOT ride in the snapshot: the backlog ships once per
   connect and new lines go out incrementally, so holding a key in the name field
   cannot re-ship the whole log. A peer never appends its own line locally - it
   appears when the host echoes it, so every log is in the host's order.
   Duplicate armies are untangled in exactly one place, lobResolveFacs, which the
   roster and lobHostStart both call, so the lobby cannot advertise an army the
   match will not hand out.
   The host's Start broadcasts the full match config + seed; every peer then
   boots the identical deterministic sim. */
let LOBBY=null;
const LOB_ROLES=[['cpu','normal','🤖 CPU Normal'],['cpu','easy','🤖 CPU Easy'],['cpu','hard','🤖 CPU Hard'],['open',null,'📨 Open (friend)'],['closed',null,'🚫 Closed']];
const LOB_CHAT_MAX=40;   // chat lines kept (host authoritative)
const LOB_MSG_MAX=120;   // chars per chat line
const LOB_NAME_MS=150;   // trailing debounce on name typing
const LOB_MODE_N={dm:'💥 Deathmatch',ctf:'🚩 Capture the Flag',koth:'👑 King of the Hill',surv:'🛡️ Wave Survival'};
let LOB_NT=null;         // pending name-debounce timer
function lobFacKeys(){return Object.keys(FAC).filter(k=>k!=='bug')}
function lobEl(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}
function lobTxt(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=(text==null?'':String(text));return e} // peer-authored strings never touch innerHTML
function lobSetupRows(show){
 for(const id of ['modeRow','mapRowWrap','oppRow','teamRow','diffRow'])
  {const e=document.getElementById(id);if(e)e.style.display=show?'':'none'}
 document.getElementById('startBtn').style.display=show?'':'none';
}
function lobClose(){
 if(LOB_NT){clearTimeout(LOB_NT);LOB_NT=null}
 if(LOBBY){
  for(const r of (LOBBY.rows||[]))if(r.pc)try{r.pc.close()}catch(e){}
  if(LOBBY.join&&LOBBY.join.pc)try{LOBBY.join.pc.close()}catch(e){}
 }
 LOBBY=null;
 document.getElementById('netPanel').style.display='none';
 lobSetupRows(true);
 document.getElementById('oppRow').style.display='';
 document.getElementById('teamRow').style.display='';
}

/* ---- shared state model ----
   lobResolveFacs is the ONLY place a duplicate army is untangled. lobHostStart
   feeds it the match slot list and the roster feeds it the same list minus the
   closed slots; both walk host-first, then rows in order, so the army the lobby
   shows is the army the match assigns. */
function lobResolveFacs(picks){
 const fk=lobFacKeys(),used=new Set();
 return picks.map(p=>{let f=p;if(!f||used.has(f))f=fk.find(k=>!used.has(k))||fk[0];used.add(f);return f});
}
function lobEnsureFacs(){ // CPU slots default to a spread of armies; hoisted out of the renderer so the snapshot never sees a null
 if(!LOBBY||LOBBY.mode!=='host')return;
 const fk=lobFacKeys();
 LOBBY.rows.forEach((r,i)=>{if(r.role==='cpu'&&!r.fac)r.fac=fk[(i+1)%fk.length]});
}
function lobSnapshot(){
 if(!LOBBY||LOBBY.mode!=='host')return null;
 lobEnsureFacs();
 const slots=[{sid:0,role:'host',name:(LOBBY.name||'Host General'),fac:SETUP.fac,diff:'normal',state:'in',ready:true}];
 LOBBY.rows.forEach((r,i)=>{
  const sid=i+1;
  if(r.role==='closed')slots.push({sid,role:'closed',name:'',fac:'',diff:'normal',state:'off',ready:false});
  else if(r.role==='cpu')slots.push({sid,role:'cpu',name:'CPU '+sid,fac:r.fac||'',diff:r.diff||'normal',state:'in',ready:true});
  else{const on=(r.state==='connected');
   slots.push({sid,role:'open',name:on?(r.peerName||'Ally'):'',fac:on?(r.peerFac||''):'',diff:'normal',state:on?'in':'wait',ready:on?!!r.ready:false})}
 });
 const parts=slots.filter(s=>s.state!=='off'),res=lobResolveFacs(parts.map(s=>s.fac));
 parts.forEach((s,i)=>{s.rfac=res[i]});
 slots.forEach(s=>{if(!s.rfac)s.rfac=''});
 return {v:1,mode:SETUP.mode,map:SETUP.map,seed:LOBBY.seed,slots};
}
function lobPeers(){ // connected open slots, host side only
 if(!LOBBY||LOBBY.mode!=='host')return [];
 return LOBBY.rows.filter(r=>r.role==='open'&&r.state==='connected'&&r.ch);
}
function lobSend(r,obj){if(!r||!r.ch)return;try{r.ch.send(JSON.stringify(obj))}catch(e){}}
/* The settings box + Lobby subheader + roster box, in that order. Host and
   joiner panels both need all three and built them line-for-line the same; the
   two locals were write-only in both (everything downstream finds these by id,
   because a lobRefresh can arrive long after the panel was drawn). */
function lobSetRosBlock(P){
 const setBox=lobEl('div','');setBox.id='lobSet';P.appendChild(setBox);
 P.appendChild(lobEl('div','nsub','👥 <b>Lobby</b> — everyone connected sees this list update live'));
 const rosBox=lobEl('div','');rosBox.id='lobRos';P.appendChild(rosBox);
}
function lobBroadcast(){ // one snapshot, one 'you' per recipient
 if(!LOBBY||LOBBY.mode!=='host')return;
 const snap=lobSnapshot();
 for(const r of lobPeers())lobSend(r,{lob:snap,you:LOBBY.rows.indexOf(r)+1});
}

/* ---- chat ---- */
function lobChatPush(n,m){ // host: append + fan out. peer: append only (the host already echoed it)
 if(!LOBBY)return;
 n=String(n==null?'':n).slice(0,18);m=String(m==null?'':m).slice(0,LOB_MSG_MAX);
 if(!m.trim())return;
 const log=LOBBY.chat||(LOBBY.chat=[]);
 log.push({n,m});while(log.length>LOB_CHAT_MAX)log.shift();
 if(LOBBY.mode==='host')for(const r of lobPeers())lobSend(r,{lchat:{n,m}});
 lobRenderChat();
}
function lobChatSend(t){
 if(!LOBBY)return;
 if(LOBBY.mode==='host')lobChatPush(LOBBY.name||'Host General',t);
 else lobSend(LOBBY.join,{chat:String(t).slice(0,LOB_MSG_MAX)});
}
function lobChatBlock(){
 const wrap=lobEl('div','');
 wrap.appendChild(lobEl('div','nsub','💬 <b>Lobby chat</b>'));
 const log=lobEl('div','nchlog');log.id='lobChatLog';wrap.appendChild(log);
 const row=lobEl('div','nrow');
 const inp=lobEl('input','nchatin');inp.id='lobChatIn';inp.maxLength=LOB_MSG_MAX;inp.placeholder='Say something…';
 const send=()=>{const t=(inp.value||'').trim();if(!t)return;inp.value='';lobChatSend(t)};
 inp.onkeydown=e=>{if(e.key==='Enter'){if(e.preventDefault)e.preventDefault();send()}};
 const b=lobEl('button','opt','Send');b.onclick=send;
 row.appendChild(inp);row.appendChild(b);wrap.appendChild(row);
 return wrap;
}
function lobRenderChat(){
 const box=document.getElementById('lobChatLog');if(!box||!LOBBY)return;
 box.innerHTML='';
 for(const c of (LOBBY.chat||[])){
  const l=lobEl('div','nchl');
  l.appendChild(lobTxt('span','nchn',c.n+':'));
  l.appendChild(lobTxt('span','nchm',c.m));
  box.appendChild(l);
 }
 box.scrollTop=box.scrollHeight;
}

/* ---- the roster every human sees ---- */
function lobFacName(k){return (FAC[k]&&FAC[k].name)||''}
function lobRoleBadge(s){
 if(s.role==='host')return '👑 Host';
 if(s.role==='cpu')return '🤖 CPU '+(s.diff||'normal');
 if(s.role==='closed')return '🚫 Closed';
 return s.state==='in'?'🎮 Player':'📨 Waiting for a friend…';
}
function lobSettingsLine(snap){
 const e=lobEl('div','nset');
 if(!snap){e.textContent='Waiting for the host…';return e}
 const mp=MAPS[snap.map]?MAPS[snap.map].n:snap.map;
 e.textContent='Mode: '+(LOB_MODE_N[snap.mode]||snap.mode)+'   •   Battlefield: '+mp+'   •   Seed: '+snap.seed;
 return e;
}
function lobRenderRoster(snap,you){
 const box=lobEl('div','nros');
 if(!snap){box.appendChild(lobEl('div','nstat','Waiting for the host…'));return box}
 for(const s of snap.slots){
  const line=lobEl('div','nrp'+(s.sid===you?' nrpme':''));
  line.appendChild(lobEl('span','nlab','Slot '+(s.sid+1)));
  const dot=lobEl('span','nrdot');dot.style.background=(FAC[s.rfac]&&FAC[s.rfac].color)||'#3a4a5a';
  line.appendChild(dot);
  line.appendChild(lobTxt('span','nrname',s.state==='in'?(s.name||'Ally'):'—'));
  if(s.sid===you)line.appendChild(lobEl('span','nryou','(you)'));
  line.appendChild(lobEl('span','nrbadge',lobRoleBadge(s)));
  if(s.state!=='off'){
   line.appendChild(lobTxt('span','nrfac',lobFacName(s.rfac)||'—'));
   if(s.fac&&s.rfac&&s.fac!==s.rfac)line.appendChild(lobTxt('span','nrwas','(was '+(lobFacName(s.fac)||s.fac)+')'));
   if(s.role==='open'&&s.state==='in')line.appendChild(lobEl('span','nrrdy',s.ready?'✅ Ready':'⏳ Not ready'));
  }
  box.appendChild(line);
 }
 return box;
}
function lobPaintShared(snap,you){
 const setEl=document.getElementById('lobSet'),rosEl=document.getElementById('lobRos');
 if(setEl){setEl.innerHTML='';setEl.appendChild(lobSettingsLine(snap))}
 if(rosEl){rosEl.innerHTML='';rosEl.appendChild(lobRenderRoster(snap,you))}
}
function lobStartLabel(snap){
 const b=document.getElementById('lobStart');if(!b)return;
 const hum=snap?snap.slots.filter(s=>s.role==='open'&&s.state==='in'):[];
 b.textContent=hum.length?('⚔ START ONLINE BATTLE ('+hum.filter(s=>s.ready).length+'/'+hum.length+' ready)'):'⚔ START ONLINE BATTLE';
}
function lobJoinReadyLabel(){
 const b=document.getElementById('lobReady');if(!b||!LOBBY||LOBBY.mode!=='join')return;
 b.textContent=LOBBY.ready?'✅ Ready':'⏳ Click when ready';
 b.disabled=!LOBBY.join.ch;
}
/* the one entry point: repaint whatever this side owns, then tell everyone else */
function lobRefresh(){
 if(!LOBBY)return;
 if(LOBBY.mode==='host'){
  const snap=lobSnapshot();
  lobPaintShared(snap,0);
  lobRenderSlots();
  lobPaintInvite(false);   // v57: the code box always matches who is actually seated
  lobStartLabel(snap);
  lobRenderChat();
  lobBroadcast();
 }else{
  lobPaintShared(LOBBY.snap,LOBBY.you==null?-1:LOBBY.you);
  lobJoinReadyLabel();
  lobRenderChat();
 }
}
/* setup-row clicks bubble here AFTER the card's own onclick has written SETUP */
function lobSetupChanged(){
 if(!LOBBY)return;
 if(LOBBY.mode==='host')lobRefresh();else lobJoinSendPick();
}
function lobNameChanged(){ // local echo is instant; the wire write is debounced
 if(LOBBY&&LOBBY.mode==='host'){const s=lobSnapshot();lobPaintShared(s,0);lobStartLabel(s)}
 if(LOB_NT)clearTimeout(LOB_NT);
 LOB_NT=setTimeout(()=>{LOB_NT=null;if(!LOBBY)return;if(LOBBY.mode==='host')lobBroadcast();else lobJoinSendPick()},LOB_NAME_MS);
}

/* ---- the one lobby code, and the one box that takes replies ---- */
function lobClearEl(el){if(!el)return;el.innerHTML='';while(el.firstChild)el.removeChild(el.firstChild)}
function lobLidStr(){return (LOBBY&&LOBBY.lid)?('000'+LOBBY.lid.toString(16).toUpperCase()).slice(-4):'----'}
function lobSeatName(seat){return 'Slot '+(seat+1)}
function lobCopy(text){
 try{if(typeof navigator!=='undefined'&&navigator.clipboard&&navigator.clipboard.writeText)
  {navigator.clipboard.writeText(String(text));return true}}catch(e){}
 return false;
}
function lobInviteCode(){ // every open seat that has a live offer and nobody in it
 if(!LOBBY||LOBBY.mode!=='host')return '';
 const items=[];
 LOBBY.rows.forEach((r,i)=>{if(r.role==='open'&&r.state!=='connected'&&r.blob)items.push({seat:i+1,blob:r.blob})});
 return items.length?pw2Wrap(PW2_INVITE,LOBBY.lid,items):'';
}
function lobInviteNote(code){
 if(!LOBBY||LOBBY.mode!=='host')return '';
 const open=LOBBY.rows.filter(r=>r.role==='open').length;
 if(!open)return 'Set a slot to Open (friend) below to invite someone.';
 const stale=LOBBY.rows.filter(r=>r.role==='open'&&r.state!=='connected'&&!r.blob).length;
 if(!code)return 'Press Create lobby code, then send the one code to everyone.';
 const seats=LOBBY.rows.filter(r=>r.role==='open'&&r.state!=='connected'&&r.blob).length;
 return 'Lobby '+lobLidStr()+' \u00b7 '+code.length+' characters \u00b7 '+seats+' free seat'+(seats===1?'':'s')
  +(stale?' \u00b7 '+stale+' newly opened slot'+(stale===1?'':'s')+' still need a refresh':'');
}
function lobPaintInvite(copy){
 const ta=document.getElementById('lobCode');if(!ta)return;
 const code=lobInviteCode();
 if(ta.value!==code)ta.value=code;                       // never disturb a selection that has not changed
 const n=document.getElementById('lobCodeNote');if(n)n.textContent=lobInviteNote(code);
 const b=document.getElementById('lobMint');
 if(b&&!b.disabled)b.textContent=code?'\ud83d\udd04 Refresh lobby code':'\ud83d\udce8 Create lobby code';
 if(copy&&code&&lobCopy(code))lobHostStat('Lobby code copied \u2014 paste it to your friends. Their replies all go in the one box below.');
}
async function lobMintInvites(){ // one gather per seat that has no live offer
 if(!LOBBY||LOBBY.mode!=='host')return;
 const todo=LOBBY.rows.filter(r=>r.role==='open'&&r.state!=='connected'&&!r.blob);
 if(!todo.length){
  if(lobInviteCode())lobPaintInvite(true);
  else lobHostStat('Set a slot to Open (friend) first \u2014 CPU and closed slots need no code.');
  return;
 }
 const b=document.getElementById('lobMint');
 if(b){b.disabled=true;b.textContent='\u23f3 Gathering\u2026'}
 for(const r of todo){
  try{
   const got=await rtcMakeOffer(chn=>lobHostChanOpen(r,chn));
   if(!LOBBY||LOBBY.mode!=='host'||LOBBY.rows.indexOf(r)<0||r.role!=='open'||r.state==='connected'){
    try{got.pc.close()}catch(e){}                        // the host re-rolled that slot mid-gather
    continue;
   }
   if(r.pc)try{r.pc.close()}catch(e){}
   r.pc=got.pc;r.blob=got.blob;r.state='invited';
  }catch(e){lobHostStat('Could not build an invite: '+(e&&e.message?e.message:e))}
 }
 if(b)b.disabled=false;
 lobPaintInvite(true);
 lobRefresh();
}
/* ONE box for every friend's reply: the code says which lobby and which seat it
   answers, so nothing has to be matched up by hand. */
function lobTakeReply(ta){
 if(!LOBBY||LOBBY.mode!=='host'||!ta)return;
 const raw=String(ta.value||'').replace(/\s+/g,'');
 if(raw.length<24){LOBBY.lastReply='';return}             // still arriving
 if(raw===LOBBY.lastReply)return;                         // one attempt per distinct paste
 LOBBY.lastReply=raw;
 let got;
 try{got=pw2Read(raw)}catch(e){lobHostStat('That reply will not read: '+(e&&e.message?e.message:e));return}
 if(got.kind!==PW2_REPLY){lobHostStat('That is a lobby code, not a reply \u2014 you want the code your friend sent back.');return}
 if(got.lid!==LOBBY.lid){lobHostStat('That reply belongs to a different lobby (it says '+('000'+got.lid.toString(16).toUpperCase()).slice(-4)+', this one is '+lobLidStr()+').');return}
 const it=got.items[0];
 if(!it||it.desc.type!=='answer'){lobHostStat('That reply is malformed.');return}
 const row=LOBBY.rows[it.seat-1];
 if(!row||row.role!=='open'){lobHostStat(lobSeatName(it.seat)+' is not open any more.');return}
 if(row.state==='connected'){lobHostStat(lobSeatName(it.seat)+' is already taken \u2014 ask them to pick a different seat.');return}
 if(!row.pc){lobHostStat(lobSeatName(it.seat)+' has no live invite \u2014 press Refresh lobby code and send it again.');return}
 lobHostStat('Connecting '+lobSeatName(it.seat)+'\u2026');
 rtcTakeAnswer(row.pc,it.desc).then(()=>{
  if(!LOBBY||LOBBY.mode!=='host')return;
  LOBBY.lastReply='';ta.value='';
 }).catch(e=>lobHostStat('That reply did not take: '+(e&&e.message?e.message:e)));
}

/* ---- host ---- */
function lobOpenHost(){
 lobClose();
 LOBBY={mode:'host',seed:(Math.random()*1e9)|0,name:'Host General',chat:[],
  lid:1+((Math.random()*65534)|0),   // v57: stamped into every code so a reply from another lobby is refused, never mis-seated
  lastReply:'',                      // v57: one connect attempt per distinct paste
  rows:[0,1,2].map(i=>({role:'cpu',diff:'normal',fac:null,state:'idle',pc:null,ch:null,blob:null,peerName:'',peerFac:'',ready:false}))};
 lobSetupRows(true);
 document.getElementById('oppRow').style.display='none';   // slots replace the opponent count
 document.getElementById('teamRow').style.display='none';  // v29: the online lobby stays FFA this version
 document.getElementById('diffRow').style.display='none';  // difficulty is per slot now
 document.getElementById('startBtn').style.display='none';
 const P=document.getElementById('netPanel');
 P.style.display='block';P.innerHTML='';
 P.appendChild(lobEl('div','nhead','🌐 <b>Hosting an online match</b> — your army, mode and battlefield above apply to everyone, and every change you make shows up instantly for anyone who has joined.'));
 const nameRow=lobEl('div','nrow','<span>Your name:</span>');
 const nameIn=lobEl('input','nname');nameIn.value=LOBBY.name;nameIn.maxLength=18;
 nameIn.oninput=()=>{LOBBY.name=nameIn.value||'Host General';lobNameChanged()};
 nameRow.appendChild(nameIn);P.appendChild(nameRow);
 lobSetRosBlock(P);
 P.appendChild(lobChatBlock());
 P.appendChild(lobEl('div','nsub','⚙ <b>Slot setup</b>'));
 const slotWrap=lobEl('div','');slotWrap.id='lobSlots';P.appendChild(slotWrap);
 P.appendChild(lobEl('div','nsub','📨 <b>Invite</b> — one code covers every open seat, and every reply comes back to one box'));
 const invRow=lobEl('div','nrow');
 const mintB=lobEl('button','opt','📨 Create lobby code');mintB.id='lobMint';
 mintB.onclick=()=>{sClick();lobMintInvites()};
 invRow.appendChild(mintB);
 const copyB=lobEl('button','opt','📋 Copy');
 copyB.onclick=()=>{const t=document.getElementById('lobCode');if(!t||!t.value)return;
  if(t.select)t.select();lobCopy(t.value);lobHostStat('Lobby code copied — paste it to your friends.');sClick()};
 invRow.appendChild(copyB);P.appendChild(invRow);
 const codeTa=lobEl('textarea','ncode nwide');codeTa.id='lobCode';codeTa.readOnly=true;
 codeTa.placeholder='Set a slot to Open (friend), then press Create lobby code…';
 codeTa.onclick=()=>{if(codeTa.select)codeTa.select()};
 P.appendChild(codeTa);
 P.appendChild((function(){const n=lobEl('div','nnote','');n.id='lobCodeNote';return n})());
 const repRow=lobEl('div','nrow','<span class="nlab">Their reply:</span>');
 const repTa=lobEl('textarea','ncode');repTa.id='lobReply';
 repTa.placeholder='Paste any friend\'s reply code here — it finds its own seat and connects…';
 repTa.oninput=()=>lobTakeReply(repTa);
 repRow.appendChild(repTa);P.appendChild(repRow);
 const foot=lobEl('div','nrow');
 const startB=lobEl('button','opt','⚔ START ONLINE BATTLE');startB.id='lobStart';
 startB.onclick=lobHostStart;
 const backB=lobEl('button','opt','↩ Back');backB.onclick=lobClose;
 foot.appendChild(startB);foot.appendChild(backB);P.appendChild(foot);
 const st=lobEl('div','nstat','');st.id='lobHostStat';P.appendChild(st);
 lobRefresh();
}
/* The control rows only carry CONTROLS now - who is in a slot is the roster's job,
   so a peer-authored name is never rebuilt here. v57 took the last text box out
   of these rows: a settings click re-renders them freely, and the half-pasted
   reply it used to be able to wipe now lives in the one box above, which this
   function never touches. */
function lobRenderSlots(){
 const wrap=document.getElementById('lobSlots');if(!wrap||!LOBBY||LOBBY.mode!=='host')return;
 lobClearEl(wrap);
 lobEnsureFacs();
 const fk=lobFacKeys();
 LOBBY.rows.forEach((r,i)=>{
  const row=lobEl('div','nrow nslot');
  row.appendChild(lobEl('span','nlab','Slot '+(i+2)+':'));
  const roleIdx=LOB_ROLES.findIndex(x=>x[0]===r.role&&(x[0]!=='cpu'||x[1]===r.diff));
  const roleB=lobEl('button','opt',LOB_ROLES[roleIdx<0?0:roleIdx][2]);
  roleB.onclick=()=>{
   if(r.state==='connected'){lobHostStat('Disconnect that player first (closing an occupied slot is not supported — restart the lobby).');return}
   const ni=(roleIdx+1)%LOB_ROLES.length;
   r.role=LOB_ROLES[ni][0];r.diff=LOB_ROLES[ni][1]||'normal';
   if(r.role!=='open'&&r.pc){try{r.pc.close()}catch(e){};r.pc=null;r.ch=null;r.state='idle';r.blob=null;r.ready=false}
   lobRefresh();sClick();
  };
  row.appendChild(roleB);
  if(r.role==='cpu'){
   const facB=lobEl('button','opt','⚑ '+FAC[r.fac].name);
   facB.onclick=()=>{r.fac=fk[(fk.indexOf(r.fac)+1)%fk.length];lobRefresh();sClick()};
   row.appendChild(facB);
  }
  if(r.role==='open'){
   // v57: no code boxes down here any more - one lobby code above covers every
   // open seat, so a slot row only reports where this seat stands.
   row.appendChild(lobTxt('span','nlab',r.state==='connected'?'✅ Player connected'
    :(r.blob?'📨 In the lobby code':'⏳ Needs a lobby code')));
  }
  wrap.appendChild(row);
 });
}
function lobHostChanOpen(r,ch){
 r.ch=ch;r.state='connected';r.peerName='Ally';r.peerFac='';r.ready=false;
 ch.onmessage=ev=>{
  let m;try{m=JSON.parse(ev.data)}catch(e){return}
  if(m.pick){ // the host stamps identity: a peer describes ITSELF and nothing else
   r.peerName=String(m.pick.name==null?'Ally':m.pick.name).slice(0,18)||'Ally';
   r.peerFac=lobFacKeys().indexOf(m.pick.fac)>=0?m.pick.fac:'';
   r.ready=!!m.pick.ready;
   lobRefresh();
  }else if(m.chat!=null)lobChatPush(r.peerName||'Ally',m.chat);
 };
 ch.onclose=()=>{if(LOBBY&&LOBBY.mode==='host'){r.state='idle';r.ch=null;r.pc=null;r.blob=null;r.ready=false;r.peerName='';r.peerFac='';lobRefresh();lobHostStat('A player left the lobby — press Refresh lobby code to reopen that seat.')}};
 lobSend(r,{lchat0:(LOBBY&&LOBBY.chat)||[]});   // backlog once; new lines arrive incrementally
 lobRefresh();                                  // pushes this peer its first snapshot, and everyone else the new arrival
}
function lobHostStat(s){const e=document.getElementById('lobHostStat');if(e)e.textContent=s}
function lobHostStart(){
 if(!LOBBY||LOBBY.mode!=='host')return;
 for(const r of LOBBY.rows)if(r.role==='open'&&r.state!=='connected'){lobHostStat('An open slot has no player yet — connect them or set the slot to CPU/Closed.');return}
 for(const r of LOBBY.rows)if(r.role==='open'&&r.state==='connected'&&!r.ready){lobHostStat('Waiting for '+(r.peerName||'a player')+' to ready up.');return}
 // build the final slot list (closed slots simply don't exist in the match)
 const slots=[{ctrl:'human',fac:SETUP.fac,diff:'normal',name:LOBBY.name,local:true}];
 const remotes=[]; // [{row, pi}]
 for(const r of LOBBY.rows){
  if(r.role==='closed')continue;
  if(r.role==='cpu')slots.push({ctrl:'cpu',fac:r.fac,diff:r.diff});
  else{remotes.push({row:r,pi:slots.length});slots.push({ctrl:'human',fac:r.peerFac||'',diff:'normal',name:r.peerName||'Ally'})}
 }
 if(slots.length<2){lobHostStat('Open at least one CPU or friend slot.');return}
 // resolve faction duplicates deterministically: first claim wins, later ones move.
 // Same helper the roster renders from, so the lobby never advertised a wrong army.
 const res=lobResolveFacs(slots.map(s=>s.fac));
 slots.forEach((s,i)=>{s.fac=res[i]});
 const cfg={mode:SETUP.mode,map:SETUP.map,diff:'normal',seed:LOBBY.seed,slots};
 const chanRecs=[];
 for(const rm of remotes){
  try{rm.row.ch.send(JSON.stringify({go:{cfg,you:rm.pi}}))}catch(e){lobHostStat('Failed to reach '+rm.row.peerName+' — is their connection alive?');return}
  chanRecs.push({pi:rm.pi,ch:rm.row.ch,name:slots[rm.pi].name});
 }
 if(LOB_NT){clearTimeout(LOB_NT);LOB_NT=null}   // no debounced write may land after the handover
 LOBBY=null; // hand the channels over to the game
 document.getElementById('netPanel').style.display='none';
 lobSetupRows(true);
 ac();
 netStartHost(cfg,chanRecs);
}

/* ---- join ---- */
function lobOpenJoin(){
 lobClose();
 LOBBY={mode:'join',name:'Ally General',ready:false,chat:[],snap:null,you:-1,
  inv:null,seat:-1,lastInvite:'',   // v57: the parsed lobby code, and which seat of it this player is answering
  join:{pc:null,ch:null}};
 lobSetupRows(false); // host decides mode/map; your army choice above still counts
 document.getElementById('netPanel').style.display='block';
 const P=document.getElementById('netPanel');
 P.innerHTML='';
 P.appendChild(lobEl('div','nhead','🔌 <b>Joining an online match</b> — pick your army above, then paste the host\'s lobby code below. Your reply builds itself; send it back and you are in.'));
 const nameRow=lobEl('div','nrow','<span>Your name:</span>');
 const nameIn=lobEl('input','nname');nameIn.value=LOBBY.name;nameIn.maxLength=18;
 nameIn.oninput=()=>{LOBBY.name=nameIn.value||'Ally General';lobNameChanged()};
 nameRow.appendChild(nameIn);P.appendChild(nameRow);
 const inRow=lobEl('div','nrow','<span class="nlab">Lobby code:</span>');
 const inTa=lobEl('textarea','ncode nwide');inTa.id='lobInvite';
 inTa.placeholder='Paste the host\'s lobby code here — your reply builds itself…';
 inTa.oninput=()=>lobJoinPaste(inTa);
 inRow.appendChild(inTa);P.appendChild(inRow);
 const seatRow=lobEl('div','nrow');seatRow.id='lobSeats';P.appendChild(seatRow);
 const outRow=lobEl('div','nrow','<span class="nlab">Your reply:</span>');outRow.id='lobOutRow';
 const outTa=lobEl('textarea','ncode');outTa.id='lobOut';outTa.readOnly=true;
 outTa.onclick=()=>{if(outTa.select)outTa.select()};
 outRow.appendChild(outTa);
 const cpB=lobEl('button','opt','📋 Copy');
 cpB.onclick=()=>{if(!outTa.value)return;if(outTa.select)outTa.select();
  lobCopy(outTa.value);lobJoinStat('Reply copied — send it to the host.');sClick()};
 outRow.appendChild(cpB);
 outRow.style.display='none';P.appendChild(outRow);
 const goRow=lobEl('div','nrow');
 const backB=lobEl('button','opt','↩ Back');backB.onclick=lobClose;
 goRow.appendChild(backB);P.appendChild(goRow);
 lobSetRosBlock(P);
 const rdyRow=lobEl('div','nrow');
 const rdyB=lobEl('button','opt','⏳ Click when ready');rdyB.id='lobReady';rdyB.disabled=true;
 rdyB.onclick=()=>{if(!LOBBY||LOBBY.mode!=='join'||!LOBBY.join.ch)return;LOBBY.ready=!LOBBY.ready;lobJoinReadyLabel();lobJoinSendPick();sClick()};
 rdyRow.appendChild(rdyB);P.appendChild(rdyRow);
 P.appendChild(lobChatBlock());
 const st=lobEl('div','nstat','');st.id='lobJoinStat';P.appendChild(st);
 lobRefresh();
}
/* v57: the joiner side of the one-code flow. Pasting a lobby code parses it,
   offers the seats it carries, and starts building a reply for the chosen one;
   there is no button to press and nothing to select by hand. */
function lobJoinPaste(ta){
 if(!LOBBY||LOBBY.mode!=='join'||!ta)return;
 if(LOBBY.join.ch)return;                                  // already in; the box is scenery now
 const raw=String(ta.value||'').replace(/\s+/g,'');
 if(raw.length<24){LOBBY.lastInvite='';return}             // still arriving
 if(raw===LOBBY.lastInvite)return;
 LOBBY.lastInvite=raw;
 let got;
 try{got=pw2Read(raw)}
 catch(e){LOBBY.inv=null;LOBBY.seat=-1;lobJoinSeats();lobJoinStat('That code will not read: '+(e&&e.message?e.message:e));return}
 if(got.kind!==PW2_REPLY&&got.kind!==PW2_INVITE)return;
 if(got.kind===PW2_REPLY){lobJoinStat('That is a reply code \u2014 you want the lobby code the host sent you.');return}
 for(const it of got.items)if(it.desc.type!=='offer'){lobJoinStat('That lobby code is malformed.');return}
 LOBBY.inv=got;LOBBY.seat=got.items[0].seat;
 lobJoinSeats();
 lobJoinAnswer();
}
function lobJoinSeats(){
 const el=document.getElementById('lobSeats');if(!el)return;
 lobClearEl(el);
 const inv=LOBBY&&LOBBY.inv;
 if(!inv||(LOBBY.join&&LOBBY.join.ch)||inv.items.length<2)return;   // nothing to choose between
 el.appendChild(lobEl('span','nlab','Take a seat:'));
 for(const it of inv.items){
  const b=lobEl('button','opt'+(it.seat===LOBBY.seat?' nseaton':''),lobSeatName(it.seat));
  b.onclick=()=>{if(!LOBBY||LOBBY.seat===it.seat)return;LOBBY.seat=it.seat;lobJoinSeats();lobJoinAnswer();sClick()};
  el.appendChild(b);
 }
}
async function lobJoinAnswer(){
 if(!LOBBY||LOBBY.mode!=='join'||!LOBBY.inv)return;
 const want=LOBBY.seat,it=LOBBY.inv.items.find(x=>x.seat===want);
 if(!it)return;
 const out=document.getElementById('lobOut'),outRow=document.getElementById('lobOutRow');
 if(LOBBY.join.pc){try{LOBBY.join.pc.close()}catch(e){}LOBBY.join.pc=null}
 if(out)out.value='';
 lobJoinStat('\u23f3 Building your reply for '+lobSeatName(want)+'\u2026');
 const lid=LOBBY.inv.lid;
 let got;
 try{got=await rtcMakeAnswer(it.desc,ch=>lobJoinChanOpen(ch))}
 catch(e){lobJoinStat('Could not build a reply: '+(e&&e.message?e.message:e));return}
 if(!LOBBY||LOBBY.mode!=='join'||LOBBY.seat!==want){try{got.pc.close()}catch(e){}return} // they moved seats mid-gather
 LOBBY.join.pc=got.pc;
 const code=pw2Wrap(PW2_REPLY,lid,[{seat:want,blob:got.blob}]);
 if(out)out.value=code;
 if(outRow)outRow.style.display='';
 lobJoinStat(lobCopy(code)
  ?'\u2705 Reply copied to your clipboard \u2014 send it to the host and wait here.'
  :'\u2705 Reply ready \u2014 copy the box above, send it to the host and wait here.');
}

function lobJoinStat(s){const e=document.getElementById('lobJoinStat');if(e)e.textContent=s}
function lobJoinSendPick(){
 if(!LOBBY||LOBBY.mode!=='join'||!LOBBY.join.ch)return;
 lobSend(LOBBY.join,{pick:{fac:SETUP.fac,name:LOBBY.name,ready:!!LOBBY.ready}});
}
function lobJoinChanOpen(ch){
 if(!LOBBY||LOBBY.mode!=='join')return;
 LOBBY.join.ch=ch;
 lobJoinSeats();   // v57: seat picking is over, the chips go away
 lobJoinStat('✅ Connected to the host — pick your army, then ready up.');
 lobJoinSendPick();
 lobRefresh();
 ch.onmessage=ev=>{
  let m;try{m=JSON.parse(ev.data)}catch(e){return}
  if(m.lob){LOBBY.snap=m.lob;if(m.you!=null)LOBBY.you=m.you;lobRefresh()}
  else if(m.lchat0){LOBBY.chat=Array.isArray(m.lchat0)?m.lchat0.slice(-LOB_CHAT_MAX):[];lobRenderChat()}
  else if(m.lchat)lobChatPush(m.lchat.n,m.lchat.m);
  else if(m.go){
   if(LOB_NT){clearTimeout(LOB_NT);LOB_NT=null}
   LOBBY=null;
   document.getElementById('netPanel').style.display='none';
   lobSetupRows(true);
   ac();
   netStartClient(m.go.cfg,m.go.you,ch);
  }
 };
 ch.onclose=()=>{if(LOBBY&&LOBBY.mode==='join'){LOBBY.join.ch=null;LOBBY.ready=false;lobJoinStat('⚠ The host closed the connection.');lobRefresh()}};
}
document.getElementById('hostOnlineBtn').onclick=()=>{sClick();lobOpenHost()};
document.getElementById('joinOnlineBtn').onclick=()=>{sClick();lobOpenJoin()};
/* v47: ONE delegated listener per setup row, registered once for the session.
   lobOpenJoin used to add its own facRow listener on every open, so backing out
   and rejoining N times sent N duplicate picks per army click. Clicks bubble here
   after the card's own onclick has already written SETUP. */
for(const id of ['facRow','modeRow','mapRow']){const e=document.getElementById(id);if(e)e.addEventListener('click',lobSetupChanged)}


