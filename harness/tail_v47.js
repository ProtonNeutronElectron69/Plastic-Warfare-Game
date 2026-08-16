/* ================================================================================
   T28 - v47 THE SHARED LIVE LOBBY (roster + ready-up + chat)

   A: snapshot shape - four slots, sid order, host/CPU defaults, distinct armies
   B: the settings line mirrors SETUP the instant it changes
   C: role states - closed slots leave the match AND the army resolution
   D: a peer connects: backlog first, then a snapshot addressed to that peer
   E: two peers - a pick reaches BOTH in real time, and the host stamps identity
      so a peer can only ever describe itself (name capped, army validated)
   F: a peer drops - the slot reverts to waiting and the survivor is told
   G: lobResolveFacs reproduces v46's inline loop exactly, and the roster shows
      the army the match will actually assign
   H: the joiner side - applies a snapshot, resolves (you), renders, readies up,
      and never echoes its own chat line locally
   I: chat caps, and the log deliberately does NOT ride in the state snapshot
   J: Start refuses while a connected human is unready
   K: (v57) the slot rows hold no codes, and a half-pasted reply survives the
      re-render a settings click triggers because it lives outside them
   L: handover - Start ships {go}, nulls LOBBY and hands the channel to netStartHost
   M: every entry point is a no-op with no lobby open; lobClose kills the timer
   ================================================================================ */
section('T28 v47: shared live lobby - roster, ready-up, chat');

const SETUP47={mode:SETUP.mode,map:SETUP.map,fac:SETUP.fac};
function eq47(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function chan47(){
 const c={sent:[],onmessage:null,onclose:null,onerror:null,closed:false,
  send(s){c.sent.push(JSON.parse(s))},
  close(){if(c.closed)return;c.closed=true;if(c.onclose)c.onclose()}};
 return c;
}
function feed47(ch,obj){if(ch.onmessage)ch.onmessage({data:JSON.stringify(obj)})}
function last47(ch,key){for(let i=ch.sent.length-1;i>=0;i--)if(ch.sent[i][key]!==undefined)return ch.sent[i];return null}
function walk47(el,out){out=out||[];if(!el)return out;out.push(el);for(const c of (el.children||[]))walk47(c,out);return out}
function host47(){ // a fresh host lobby on known settings
 SETUP.mode='dm';SETUP.map='backyard';SETUP.fac='green';
 lobOpenHost();
 return LOBBY;
}

/* ---------- A: snapshot shape ---------- */
{
 host47();
 const s=lobSnapshot();
 ok('T28.A the snapshot is one versioned object carrying settings + four slots',
    !!s&&s.v===1&&s.mode==='dm'&&s.map==='backyard'&&typeof s.seed==='number'&&s.slots.length===4);
 ok('T28.A sids run 0..3 with the host first',
    eq47(s.slots.map(x=>x.sid),[0,1,2,3])&&s.slots[0].role==='host');
 ok('T28.A the host is present, ready by definition, and flying the setup screen army',
    s.slots[0].state==='in'&&s.slots[0].ready===true&&s.slots[0].fac==='green'&&s.slots[0].name==='Host General');
 ok('T28.A the three default CPU slots are named and ready',
    eq47(s.slots.slice(1).map(x=>x.role),['cpu','cpu','cpu'])&&
    eq47(s.slots.slice(1).map(x=>x.name),['CPU 1','CPU 2','CPU 3'])&&
    s.slots.slice(1).every(x=>x.state==='in'&&x.ready===true&&x.diff==='normal'));
 ok('T28.A every participating slot resolves to a distinct army',
    new Set(s.slots.map(x=>x.rfac)).size===4&&s.slots.every(x=>!!FAC[x.rfac]));
 ok('T28.A the start label counts humans, and there are none yet',
    (lobStartLabel(s),document.getElementById('lobStart').textContent.indexOf('ready')<0));
}

/* ---------- B: the settings line is live ---------- */
{
 host47();
 SETUP.mode='koth';SETUP.map='kitchen';SETUP.fac='gray';
 const s=lobSnapshot();
 ok('T28.B a mode/map/army change is visible in the very next snapshot',
    s.mode==='koth'&&s.map==='kitchen'&&s.slots[0].fac==='gray');
 const line=lobSettingsLine(s).textContent;
 ok('T28.B the settings line names the mode, the battlefield and the seed',
    line.indexOf('King of the Hill')>=0&&line.indexOf(MAPS.kitchen.n)>=0&&line.indexOf(String(s.seed))>=0);
 ok('T28.B a peer with no snapshot yet is told to wait rather than shown stale settings',
    lobSettingsLine(null).textContent.indexOf('Waiting')>=0);
 SETUP.mode='dm';SETUP.map='backyard';SETUP.fac='green';
}

/* ---------- C: role states and what they do to army resolution ---------- */
{
 host47();
 LOBBY.rows[0].role='closed';
 LOBBY.rows[1].role='open';
 LOBBY.rows[2].role='cpu';LOBBY.rows[2].fac='green';   // duplicate of the host's on purpose
 const s=lobSnapshot();
 ok('T28.C a closed slot is off, nameless and army-less',
    s.slots[1].state==='off'&&s.slots[1].name===''&&s.slots[1].rfac==='');
 ok('T28.C an open slot with nobody in it waits, unready',
    s.slots[2].state==='wait'&&s.slots[2].ready===false&&s.slots[2].name===''&&s.slots[2].fac==='');
 ok('T28.C the closed slot consumes no army: the duplicate moves off green, the host keeps it',
    s.slots[0].rfac==='green'&&s.slots[3].fac==='green'&&s.slots[3].rfac!=='green');
 ok('T28.C a moved slot still reports what it asked for, so the roster can say so',
    s.slots[3].fac==='green'&&s.slots[3].rfac===lobResolveFacs(['green','','green'])[2]);
 const line=lobRenderRoster(s,0).children[3];
 ok('T28.C the roster spells out the reassignment',
    walk47(line).some(e=>e.className==='nrwas'&&e.textContent.indexOf('was Green')>=0));
 ok('T28.C the host row is the one marked as you',
    lobRenderRoster(s,0).children[0].className.indexOf('nrpme')>=0&&
    lobRenderRoster(s,0).children[1].className.indexOf('nrpme')<0);
}

/* ---------- D: a peer connects ---------- */
{
 host47();
 LOBBY.rows[0].role='open';
 const c1=chan47();
 lobHostChanOpen(LOBBY.rows[0],c1);
 ok('T28.D the slot goes connected and starts out unready',
    LOBBY.rows[0].state==='connected'&&LOBBY.rows[0].ready===false&&LOBBY.rows[0].peerName==='Ally');
 ok('T28.D the chat backlog is the first thing the peer receives',
    !!c1.sent.length&&Array.isArray(c1.sent[0].lchat0));
 const m=last47(c1,'lob');
 ok('T28.D the peer is then sent the full lobby state, addressed to its own slot',
    !!m&&m.you===1&&m.lob.slots.length===4&&m.lob.slots[1].state==='in'&&m.lob.slots[1].role==='open');
 ok('T28.D the start label now tracks readiness',
    document.getElementById('lobStart').textContent.indexOf('(0/1 ready)')>=0);
}

/* ---------- E: two peers, live propagation, identity stamping ---------- */
{
 host47();
 LOBBY.rows[0].role='open';LOBBY.rows[1].role='open';LOBBY.rows[2].role='closed';
 const c1=chan47(),c2=chan47();
 lobHostChanOpen(LOBBY.rows[0],c1);
 lobHostChanOpen(LOBBY.rows[1],c2);
 feed47(c1,{pick:{fac:'tan',name:'Ada',ready:true}});
 const a=last47(c1,'lob'),b=last47(c2,'lob');
 ok('T28.E the sender sees its own pick reflected',
    a.lob.slots[1].name==='Ada'&&a.lob.slots[1].fac==='tan'&&a.lob.slots[1].ready===true);
 ok('T28.E the OTHER human sees it too, in the same update, without asking',
    b.lob.slots[1].name==='Ada'&&b.lob.slots[1].fac==='tan'&&b.lob.slots[1].ready===true);
 ok('T28.E each peer is told which slot is its own',a.you===1&&b.you===2);
 ok('T28.E a peer cannot touch another slot',
    a.lob.slots[2].name==='Ally'&&a.lob.slots[2].ready===false&&a.lob.slots[2].fac==='');
 ok('T28.E the start label counts both humans',
    document.getElementById('lobStart').textContent.indexOf('(1/2 ready)')>=0);
 feed47(c1,{pick:{fac:'<img src=x onerror=alert(1)>',name:'Ada'}});
 ok('T28.E an army that is not a real FAC key is dropped, never stored',
    LOBBY.rows[0].peerFac===''&&lobSnapshot().slots[1].fac==='');
 ok('T28.E dropping the army does not orphan the roster: it still resolves to something real',
    !!FAC[lobSnapshot().slots[1].rfac]);
 feed47(c1,{pick:{name:'ABCDEFGHIJKLMNOPQRSTUVWXYZ',ready:true}});
 ok('T28.E a peer name is capped at 18 characters',LOBBY.rows[0].peerName.length===18);
 feed47(c1,{pick:{name:'',ready:true}});
 ok('T28.E an empty name falls back rather than rendering blank',LOBBY.rows[0].peerName==='Ally');
 const nJunk=c1.sent.length;
 feed47(c1,{nonsense:1});
 feed47(c1,'{not json');
 ok('T28.E junk on the wire is ignored without a rebroadcast',c1.sent.length===nJunk);
}

/* ---------- F: a peer drops ---------- */
{
 host47();
 LOBBY.rows[0].role='open';LOBBY.rows[1].role='open';
 const c1=chan47(),c2=chan47();
 lobHostChanOpen(LOBBY.rows[0],c1);
 lobHostChanOpen(LOBBY.rows[1],c2);
 feed47(c1,{pick:{fac:'tan',name:'Ada',ready:true}});
 c1.close();
 ok('T28.F the slot reverts to an empty open slot',
    LOBBY.rows[0].state==='idle'&&LOBBY.rows[0].peerName===''&&LOBBY.rows[0].peerFac===''&&LOBBY.rows[0].ready===false);
 const b=last47(c2,'lob');
 ok('T28.F the remaining human is told, live',
    b.lob.slots[1].state==='wait'&&b.lob.slots[1].name==='');
 ok('T28.F the host status says so',
    document.getElementById('lobHostStat').textContent.indexOf('left the lobby')>=0);
 ok('T28.F a dropped peer is no longer broadcast to',
    (function(){const n=c1.sent.length;lobRefresh();return c1.sent.length===n&&last47(c2,'lob')!==null})());
}

/* ---------- G: one resolver, matching v46 ---------- */
{
 // transcribed from the v46 inline loop inside lobHostStart
 function ref47(picks){
  const fk=Object.keys(FAC).filter(k=>k!=='bug'),used=new Set(),out=[];
  for(const p of picks){let f=p;if(!f||used.has(f))f=fk.find(k=>!used.has(k))||fk[0];used.add(f);out.push(f)}
  return out;
 }
 ok('T28.G first claim wins, later claims move',
    eq47(lobResolveFacs(['green','green','green','green']),ref47(['green','green','green','green'])));
 ok('T28.G a blank pick is filled from the unused armies',
    eq47(lobResolveFacs(['','tan','tan']),ref47(['','tan','tan'])));
 ok('T28.G a conflict-free lobby is left completely alone',
    eq47(lobResolveFacs(['blue','green','gray','tan']),['blue','green','gray','tan']));
 let same=true;
 const fk=Object.keys(FAC).filter(k=>k!=='bug').concat(['','']);
 for(let t=0;t<300;t++){
  const n=1+(t%4),picks=[];
  for(let i=0;i<n;i++)picks.push(fk[(t*7+i*3)%fk.length]);
  if(!eq47(lobResolveFacs(picks),ref47(picks))){same=false;break}
 }
 ok('T28.G identical to v46 across 300 generated pick lists',same);
 // and the roster reads from the same resolver the match will use
 host47();
 SETUP.fac='tan';
 LOBBY.rows[0].role='cpu';LOBBY.rows[0].fac='tan';
 LOBBY.rows[1].role='cpu';LOBBY.rows[1].fac='tan';
 LOBBY.rows[2].role='closed';
 const s=lobSnapshot(),shown=s.slots.filter(x=>x.state!=='off').map(x=>x.rfac);
 ok('T28.G the roster shows exactly what lobHostStart would assign',
    eq47(shown,ref47(['tan','tan','tan'])));
 SETUP.fac='green';
}

/* ---------- H: the joiner side ---------- */
{
 host47();
 LOBBY.rows[0].role='open';LOBBY.rows[1].role='cpu';LOBBY.rows[2].role='closed';
 const hc=chan47();
 lobHostChanOpen(LOBBY.rows[0],hc);
 feed47(hc,{pick:{fac:'blue',name:'Ada',ready:false}});
 const wire=last47(hc,'lob');           // a real snapshot straight off the wire
 lobClose();

 lobOpenJoin();
 const jc=chan47();
 lobJoinChanOpen(jc);
 ok('T28.H the joiner announces itself the moment the channel opens',
    !!jc.sent.length&&!!jc.sent[0].pick&&jc.sent[0].pick.ready===false);
 ok('T28.H before any snapshot the joiner shows a waiting roster, not an empty one',
    lobRenderRoster(null,-1).children.length===1);
 feed47(jc,{lob:wire.lob,you:wire.you});
 ok('T28.H the snapshot is stored with the joiner own slot id',
    LOBBY.you===1&&LOBBY.snap.slots.length===4);
 const box=lobRenderRoster(LOBBY.snap,LOBBY.you);
 ok('T28.H the joiner renders all four slots, including the CPU and the closed one',
    box.children.length===4);
 ok('T28.H the joiner own row is highlighted and nobody else is',
    box.children[1].className.indexOf('nrpme')>=0&&
    box.children.filter(c=>c.className.indexOf('nrpme')>=0).length===1);
 ok('T28.H the joiner can read the host name and the host settings',
    walk47(box.children[0]).some(e=>e.textContent==='Host General')&&
    lobSettingsLine(LOBBY.snap).textContent.indexOf(MAPS.backyard.n)>=0);
 ok('T28.H badges distinguish host, player, CPU and closed',
    eq47(LOBBY.snap.slots.map(s=>lobRoleBadge(s).replace(/[^A-Za-z ]/g,'').trim()),
         ['Host','Player','CPU normal','Closed']));
 LOBBY.ready=true;lobJoinSendPick();
 ok('T28.H readying up is just another pick, sent to the host',
    last47(jc,'pick').pick.ready===true);
 lobJoinReadyLabel();
 ok('T28.H the ready button reflects the toggle',
    document.getElementById('lobReady').textContent.indexOf('Ready')>=0);
 feed47(jc,{lchat0:[{n:'Host General',m:'hi'}]});
 ok('T28.H the backlog lands once',LOBBY.chat.length===1&&LOBBY.chat[0].m==='hi');
 feed47(jc,{lchat:{n:'Ada',m:'yo'}});
 ok('T28.H new lines arrive incrementally',LOBBY.chat.length===2&&LOBBY.chat[1].m==='yo');
 const n0=jc.sent.length;
 lobChatSend('typed');
 ok('T28.H a typed line goes to the host and is NOT echoed locally',
    jc.sent.length===n0+1&&last47(jc,'chat').chat==='typed'&&LOBBY.chat.length===2);
 jc.close();
 ok('T28.H losing the host clears ready and says so',
    LOBBY.ready===false&&document.getElementById('lobJoinStat').textContent.indexOf('closed the connection')>=0);
 lobClose();
}

/* ---------- I: chat caps, and chat stays out of the snapshot ---------- */
{
 host47();
 LOBBY.rows[0].role='open';
 const c1=chan47();
 lobHostChanOpen(LOBBY.rows[0],c1);
 for(let i=0;i<LOB_CHAT_MAX+20;i++)lobChatPush('Host','line '+i);
 ok('T28.I the log is capped and drops the oldest first',
    LOBBY.chat.length===LOB_CHAT_MAX&&LOBBY.chat[0].m==='line 20'&&
    LOBBY.chat[LOB_CHAT_MAX-1].m==='line '+(LOB_CHAT_MAX+19));
 lobChatPush('Host','x'.repeat(500));
 ok('T28.I a long line is truncated, not dropped',LOBBY.chat[LOB_CHAT_MAX-1].m.length===LOB_MSG_MAX);
 const n=LOBBY.chat.length;
 lobChatPush('Host','   ');lobChatPush('Host','');lobChatPush('Host',null);
 ok('T28.I blank lines are ignored',LOBBY.chat.length===n);
 lobChatPush('Someone With A Very Long Name Indeed','hi');
 ok('T28.I an attributed name is capped like any other',LOBBY.chat[LOBBY.chat.length-1].n.length===18);
 ok('T28.I every line was fanned out to the connected peer',
    c1.sent.filter(m=>m.lchat!==undefined).length===LOB_CHAT_MAX+22);
 const s=lobSnapshot();
 ok('T28.I the state snapshot carries NO chat log (that is the whole point of lchat)',
    s.chat===undefined&&JSON.stringify(s).indexOf('line 30')<0);
 feed47(c1,{chat:'from the peer'});
 ok('T28.I an inbound line is attributed by the host, not by the sender',
    LOBBY.chat[LOBBY.chat.length-1].n===LOBBY.rows[0].peerName&&
    LOBBY.chat[LOBBY.chat.length-1].m==='from the peer');
 const before=LOBBY.chat.length;
 feed47(c1,{chat:'y'.repeat(400)});
 ok('T28.I an oversized inbound line is truncated on arrival',
    LOBBY.chat.length===before&&LOBBY.chat[before-1].m.length===LOB_MSG_MAX);
}

/* ---------- J: ready gates Start ---------- */
{
 host47();
 LOBBY.rows[0].role='open';LOBBY.rows[1].role='closed';LOBBY.rows[2].role='closed';
 const c1=chan47();
 lobHostChanOpen(LOBBY.rows[0],c1);
 lobHostStart();
 ok('T28.J Start refuses while a connected human is unready',
    LOBBY!==null&&document.getElementById('lobHostStat').textContent.indexOf('ready up')>=0);
 host47();
 LOBBY.rows[0].role='open';LOBBY.rows[1].role='closed';LOBBY.rows[2].role='closed';
 lobHostStart();
 ok('T28.J Start still refuses an open slot nobody has joined',
    LOBBY!==null&&document.getElementById('lobHostStat').textContent.indexOf('no player yet')>=0);
 host47();
 LOBBY.rows[0].role='closed';LOBBY.rows[1].role='closed';LOBBY.rows[2].role='closed';
 lobHostStart();
 ok('T28.J a lobby with nothing but the host is still refused',
    LOBBY!==null&&document.getElementById('lobHostStat').textContent.indexOf('at least one')>=0);
}

/* ---------- K: v57 - the codes moved out of the slot rows ---------- */
{
 host47();
 const r=LOBBY.rows[0];
 r.role='open';r.state='invited';r.blob=[0,1,65,1,66];
 lobRenderSlots();
 ok('T28.K an invited slot row carries no text boxes any more',
    !walk47(document.getElementById('lobSlots')).some(e=>e.tagName==='TEXTAREA'));
 ok('T28.K it reports that the seat is covered by the lobby code instead',
    walk47(document.getElementById('lobSlots')).some(e=>(e.textContent||'').indexOf('In the lobby code')>=0));
 const rep=document.getElementById('lobReply');
 rep.value='PW2.HALFPASTED';
 lobSetupChanged();   // the host clicks a different map mid-paste
 ok('T28.K the half-pasted reply is untouched, because lobRenderSlots cannot reach it',
    document.getElementById('lobReply').value==='PW2.HALFPASTED');
 ok('T28.K and the one lobby code box is repainted from the seats that are actually free',
    document.getElementById('lobCode').value===lobInviteCode());
 r.role='cpu';r.state='idle';r.blob=null;
}

/* ---------- L: handover to the match ---------- */
{
 host47();
 LOBBY.rows[0].role='open';LOBBY.rows[1].role='cpu';LOBBY.rows[1].fac='gray';LOBBY.rows[2].role='closed';
 const c1=chan47();
 lobHostChanOpen(LOBBY.rows[0],c1);
 feed47(c1,{pick:{fac:'blue',name:'Ada',ready:true}});
 const preHandler=c1.onmessage;
 lobHostStart();
 const go=last47(c1,'go');
 ok('T28.L the peer is handed the full match config and its own player index',
    !!go&&go.go.you===1&&go.go.cfg.seed!=null&&go.go.cfg.slots.length===3);
 ok('T28.L the closed slot does not exist in the match, the CPU does',
    eq47(go.go.cfg.slots.map(s=>s.ctrl),['human','human','cpu']));
 ok('T28.L names and armies survive the handover exactly as the roster showed them',
    go.go.cfg.slots[1].name==='Ada'&&go.go.cfg.slots[1].fac==='blue'&&go.go.cfg.slots[2].fac==='gray');
 ok('T28.L every slot in the match has a distinct army',
    new Set(go.go.cfg.slots.map(s=>s.fac)).size===3);
 ok('T28.L the lobby is torn down and the debounce timer with it',LOBBY===null&&LOB_NT===null);
 ok('T28.L a live networked match is running',!!G&&!!G.net&&G.net.host===true&&G.players.length===3);
 ok('T28.L the netcode took the channel over from the lobby',c1.onmessage!==preHandler);
 ok('T28.L a stale lobby message on that channel can no longer move anything',
    (function(){try{feed47(c1,{pick:{name:'Mallory',ready:true}});return G.players[1].name==='Ada'}catch(e){return false}})());
 run(30);
 ok('T28.L the match simulates normally after the handover',!G.over&&G.tick>=30);
 ok('T28.L the snapshot tag is v47 or newer',JSON.parse(saveState()).v>=47);
 if(G.net)G.net.dead=true;   // no lockstep pump for the rest of the suite
}

/* ---------- M: no lobby open, no crashes ---------- */
{
 lobClose();
 ok('T28.M closing the lobby cancels the pending name write',LOBBY===null&&LOB_NT===null);
 let threw=null;
 try{
  ok('T28.M there is no snapshot without a host lobby',lobSnapshot()===null&&lobPeers().length===0);
  lobBroadcast();lobRefresh();lobRenderChat();lobRenderSlots();
  lobChatPush('a','b');lobChatSend('c');lobSetupChanged();lobNameChanged();
  lobJoinSendPick();lobJoinReadyLabel();lobStartLabel(null);lobHostStart();
  lobSend(null,{x:1});lobSend({ch:null},{x:1});
 }catch(e){threw=e}
 ok('T28.M every lobby entry point is a safe no-op with nothing open',!threw);
 if(LOB_NT){clearTimeout(LOB_NT);LOB_NT=null}
 ok('T28.M a name edit with no lobby leaves no timer behind',LOB_NT===null);
 SETUP.mode=SETUP47.mode;SETUP.map=SETUP47.map;SETUP.fac=SETUP47.fac;
 ok('T28.M the setup screen is handed back untouched',
    SETUP.mode===SETUP47.mode&&SETUP.map===SETUP47.map&&SETUP.fac===SETUP47.fac);
}

/* ---------- N: the shipped escape bug in the wave toast ---------- */
{
 const src=String(updateSurv);
 ok('T28.N the Wave Survival announcement carries a real character, not its own escape',
    src.indexOf('U0001F30A')<0&&src.indexOf('🌊')>=0);
 ok('T28.N no lobby string smuggles an escape sequence out to the screen',
    [lobRoleBadge({role:'host'}),lobRoleBadge({role:'cpu',diff:'easy'}),
     lobRoleBadge({role:'closed'}),lobRoleBadge({role:'open',state:'in'}),
     lobRoleBadge({role:'open',state:'wait'})].every(t=>t.indexOf('U0001')<0&&t.indexOf('\\u')<0));
}
