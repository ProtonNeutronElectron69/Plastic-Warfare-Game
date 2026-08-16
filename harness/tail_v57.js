/* ================================================================================
   T38 - v57 PW2 CODES, ONE LOBBY CODE, ONE REPLY BOX

   A: blob round trip - ufrag, pwd, fingerprint and every candidate come back
   B: the size claim, measured against a faithful copy of the v56 JSON packer
   C: candidate policy - one per family, reflexive first, capped, junk dropped
   D: the envelope - seat tags, lobby id, whitespace, and every refusal by name
      (a PW1 code is refused for being PW1, not for being unreadable)
   E: the host's one code covers exactly the open, un-taken, minted seats
   F: one paste box routes a reply to its own seat, and refuses everything else
   G: the joiner parses a bundle, offers its seats, and answers the chosen one
   H: none of it is hashed or serialized
   I: every new entry point is a no-op with no lobby open
   ================================================================================ */
section('T38 v57: PW2 codes, one lobby code, one reply box');

/* ---------- fixtures: SDPs shaped like the ones browsers actually emit ---------- */
const C57={
 mdns:'a=candidate:2999745851 1 udp 2122262783 5f24a5e4-6bd3-4c0f-9b5b-1e4b1c0a77ab.local 51772 typ host generation 0 network-id 1\r\n',
 mdns2:'a=candidate:1510613869 1 udp 2122197247 8a1c2f77-91aa-4b1d-b1b4-33ce7ff9d0c1.local 51773 typ host generation 0 network-id 2\r\n',
 srflx:'a=candidate:842163049 1 udp 1685921535 73.162.11.204 51772 typ srflx raddr 0.0.0.0 rport 0 generation 0\r\n',
 lan:'a=candidate:1111 1 udp 2122262783 192.168.1.42 51774 typ host generation 0\r\n',
 lan2:'a=candidate:1112 1 udp 2122262782 10.0.0.7 51775 typ host generation 0\r\n',
 v6:'a=candidate:2222 1 udp 2122131711 2601:648:8100:31a0:1c9b:5e1d:9f2a:33b4 51776 typ host generation 0\r\n',
 v6z:'a=candidate:2223 1 udp 2122131710 fe80::1c9b:5e1d%eth0 51777 typ host generation 0\r\n',
 v6c:'a=candidate:2224 1 udp 2122131709 2601::1 51778 typ host generation 0\r\n',
 relay:'a=candidate:3333 1 udp 41885439 12.13.14.15 51779 typ relay raddr 73.162.11.204 rport 51772\r\n',
 badport:'a=candidate:4444 1 udp 2122262781 192.168.1.99 99999 typ host generation 0\r\n',
 dupe:'a=candidate:5555 1 udp 2122262780 73.162.11.204 51772 typ srflx raddr 0.0.0.0 rport 0\r\n'
};
const UF57='8Fj2',PW57='Kd8mQ2xVvN4pR7sT1uW3yZ6a';
const FP57='4A:AD:B9:B1:3F:82:18:3B:54:02:12:DF:3E:5D:49:6B:19:E5:7C:AB:3F:3E:36:F4:1B:59:1D:B2:CB:6F:8B:AD';
function sdp57(cands,type,uf,pw){
 return 'v=0\r\no=- 46 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\n'
  +'m=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\n'
  +cands.map(k=>C57[k]).join('')
  +'a=ice-ufrag:'+(uf||UF57)+'\r\na=ice-pwd:'+(pw||PW57)+'\r\n'
  +'a=fingerprint:sha-256 '+FP57+'\r\n'
  +'a=setup:'+((type==='answer')?'active':'actpass')+'\r\na=mid:0\r\na=sctp-port:5000\r\n';
}
function desc57(cands,type,uf,pw){return {type:type||'offer',sdp:sdp57(cands,type,uf,pw)}}
function get57(sdp,re){const m=sdp.match(re);return m?m[1]:''}
function cands57(sdp){
 const re=/a=candidate:\S+ \d+ udp \d+ ([\w.:-]+) (\d+) typ (host|srflx)/g,out=[];let m;
 while((m=re.exec(sdp)))out.push(m[1]+':'+m[2]+':'+m[3]);
 return out;
}
/* the v56 packer, copied faithfully, so B measures a real before/after */
function pack56(desc){
 const sdp=desc.sdp,get=re=>{const m=sdp.match(re);return m?m[1]:''};
 const u=get(/a=ice-ufrag:([^\r\n]+)/),p=get(/a=ice-pwd:([^\r\n]+)/);
 const f=get(/a=fingerprint:sha-256 ([^\r\n]+)/).replace(/:/g,'');
 const cs=[],seen={};
 const re=/a=candidate:\S+ \d+ (?:udp|UDP) (\d+) ([\w.:-]+) (\d+) typ (host|srflx)/g;
 let m;
 while((m=re.exec(sdp))){
  const key=m[2]+':'+m[3];if(seen[key])continue;seen[key]=1;
  cs.push([m[2],+m[3],m[4]==='host'?0:1,+m[1]]);
 }
 return 'PW1.'+btoa(JSON.stringify({t:desc.type==='offer'?0:1,u:u,p:p,f:f,c:cs}))
  .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function threw57(fn){try{fn();return null}catch(e){return (e&&e.message)||String(e)}}
/* a round trip that reports a broken layout as null instead of taking the tail
   down with it - a mutation must fail its own check, not everything after it */
function rt57(d){try{return blobSdp(sdpBlob(d),0)}catch(e){return null}}
function read57(c){try{return pw2Read(c)}catch(e){return {kind:0,lid:-1,items:[]}}}
function sdpOf57(d){const r=rt57(d);return r?r.desc.sdp:''}

/* ---------- A: the blob round trip ---------- */
{
 const d=desc57(['mdns','srflx']),back=rt57(d),bs=sdpOf57(d);
 ok('T38.A an offer comes back an offer, and the blob ends where it says it does',
    !!back&&back.desc.type==='offer'&&back.i===sdpBlob(d).length);
 ok('T38.A the ICE credentials survive byte for byte',
    get57(bs,/a=ice-ufrag:([^\r\n]+)/)===UF57&&get57(bs,/a=ice-pwd:([^\r\n]+)/)===PW57);
 ok('T38.A the fingerprint survives whole, colons and case included',
    get57(bs,/a=fingerprint:sha-256 ([^\r\n]+)/)===FP57);
 ok('T38.A both candidates come back with their address, port and type',
    cands57(bs).join('|')===
    '73.162.11.204:51772:srflx|5f24a5e4-6bd3-4c0f-9b5b-1e4b1c0a77ab.local:51772:host');
 ok('T38.A a rebuilt offer carries setup:actpass and end-of-candidates',
    bs.indexOf('a=setup:actpass')>=0&&bs.indexOf('a=end-of-candidates')>=0);
 const a=rt57(desc57(['srflx'],'answer'));
 ok('T38.A an answer comes back an answer, with setup:active',
    !!a&&a.desc.type==='answer'&&a.desc.sdp.indexOf('a=setup:active')>=0);
 ok('T38.A candidate priorities are distinct so no two pairs tie',
    (function(){const pr=[],re=/a=candidate:\d+ 1 udp (\d+)/g;let m;
     const s2=sdpOf57(desc57(['mdns','srflx','lan']));
     while((m=re.exec(s2)))pr.push(m[1]);return pr.length===3&&new Set(pr).size===3})());
 ok('T38.A an SDP with no fingerprint is refused rather than packed short',
    !!threw57(()=>sdpBlob({type:'offer',sdp:'v=0\r\na=ice-ufrag:x\r\na=ice-pwd:y\r\n'})));
}

/* ---------- B: the size claim ---------- */
{
 const chrome=desc57(['mdns','mdns2','srflx']);        // what Chrome emits by default
 const oldLen=pack56(chrome).length,newLen=('PW2.'+b64uEnc(sdpBlob(chrome))).length;
 ok('T38.B and the short code is still a complete one, not a lossy one',!!rt57(chrome));
 ok('T38.B the v56 packing of a typical Chrome offer really was ~400 chars',oldLen>380&&oldLen<420);
 ok('T38.B PW2 puts the same offer under 160 chars',newLen<160);
 ok('T38.B that is at least a 2.5x cut',oldLen/newLen>=2.5);
 const lean=desc57(['srflx']);
 ok('T38.B a reflexive-only side is around 100',('PW2.'+b64uEnc(sdpBlob(lean))).length<110);
}

/* ---------- C: candidate policy ---------- */
{
 const seen=s=>cands57(sdpOf57(desc57(s)));
 ok('T38.C the reflexive candidate is written first, whatever order it arrived in',
    (seen(['mdns','lan','srflx'])[0]||'').indexOf('73.162.11.204')===0);
 ok('T38.C one address per family, so two LAN cards do not both travel',
    seen(['lan','lan2','srflx']).length===2);
 ok('T38.C two mDNS names collapse to one',seen(['mdns','mdns2']).length===1);
 ok('T38.C the list is capped at PW2_MAXC',PW2_MAXC===3&&seen(['mdns','lan','v6','srflx']).length===3);
 ok('T38.C an mDNS name round-trips as its own 16 bytes',
    (seen(['mdns'])[0]||'')==='5f24a5e4-6bd3-4c0f-9b5b-1e4b1c0a77ab.local:51772:host');
 ok('T38.C a full IPv6 address survives',
    (seen(['v6'])[0]||'')==='2601:648:8100:31a0:1c9b:5e1d:9f2a:33b4:51776:host');
 ok('T38.C a :: compressed IPv6 address expands and comes back usable',
    (seen(['v6c'])[0]||'')==='2601:0:0:0:0:0:0:1:51778:host');
 ok('T38.C a zone-id address is dropped, not mangled',seen(['v6z','srflx']).length===1);
 ok('T38.C a relay candidate is not carried',seen(['relay','srflx']).length===1);
 ok('T38.C an impossible port is dropped',seen(['badport','srflx']).length===1);
 ok('T38.C the same address:port twice is carried once',seen(['srflx','dupe']).length===1);
 ok('T38.C a side with no candidates at all still packs and unpacks',
    !!rt57(desc57([]))&&seen([]).length===0);
}

/* ---------- D: the envelope ---------- */
{
 const b1=sdpBlob(desc57(['mdns','srflx'])),b2=sdpBlob(desc57(['lan','srflx'],'offer','9Qz1','Lp3nR8wD5tG2hJ9kM4vB6xC1'));
 const code=pw2Wrap(PW2_INVITE,0x3F7A,[{seat:1,blob:b1},{seat:3,blob:b2}]);
 const got=read57(code);
 ok('T38.D a bundle round-trips its kind, its lobby id and its seat tags',
    got.kind===PW2_INVITE&&got.lid===0x3F7A&&got.items.map(x=>x.seat).join()==='1,3');
 ok('T38.D each seat keeps its own credentials',
    got.items.length===2&&
    get57(got.items[0].desc.sdp,/a=ice-ufrag:([^\r\n]+)/)==='8Fj2'&&
    get57(got.items[1].desc.sdp,/a=ice-ufrag:([^\r\n]+)/)==='9Qz1');
 ok('T38.D three seats in one code still beat a single v56 invite',
    pw2Wrap(PW2_INVITE,1,[{seat:1,blob:b1},{seat:2,blob:b1},{seat:3,blob:b1}]).length<398);
 ok('T38.D a code pasted out of a chat app, with wrapping and spaces, still reads',
    (function(){try{return pw2Read(' '+code.slice(0,40)+'\n'+code.slice(40,90)+'  \r\n'+code.slice(90)+' \n').lid===0x3F7A}
     catch(e){return false}})());
 ok('T38.D a reply is one seat and reads back as a reply',
    (function(){const r=read57(pw2Wrap(PW2_REPLY,9,[{seat:2,blob:sdpBlob(desc57(['srflx'],'answer'))}]));
     return r.kind===PW2_REPLY&&r.items.length===1&&r.items[0].seat===2&&r.items[0].desc.type==='answer'})());
 ok('T38.D a v56 code is refused for being from an older build, by name',
    (threw57(()=>pw2Read(pack56(desc57(['srflx']))))||'').indexOf('older build')>=0);
 ok('T38.D a code from another game is refused as not ours',
    (threw57(()=>pw2Read('https://example.com/whatever'))||'').indexOf('not a Plastic Warfare code')>=0);
 ok('T38.D an empty box says so instead of throwing something cryptic',
    (threw57(()=>pw2Read('   '))||'').indexOf('nothing in the box')>=0);
 ok('T38.D a truncated code is called truncated',
    (threw57(()=>pw2Read(code.slice(0,40)))||'').indexOf('truncated')>=0);
 ok('T38.D a code with stray characters is refused',!!threw57(()=>pw2Read('PW2.abc$def')));
 ok('T38.D a bogus address kind is refused rather than guessed at',
    !!threw57(()=>pw2Read('PW2.'+b64uEnc([PW2_INVITE,0,1,1,1,0,1,65,1,66].concat(
     new Array(32).fill(7),[1,9,0,0,0,0,0])))));
}

/* ---------- E: the host's one code ---------- */
{
 host47();
 const R=LOBBY.rows,b=sdpBlob(desc57(['mdns','srflx']));
 ok('T38.E a lobby id is stamped once and shown as four hex digits',
    LOBBY.lid>0&&LOBBY.lid<65536&&lobLidStr().length===4);
 ok('T38.E with no open slots there is no code and the note says why',
    lobInviteCode()===''&&lobInviteNote('').indexOf('Set a slot to Open')>=0);
 R[0].role='open';R[2].role='open';
 ok('T38.E an open slot with no offer yet produces no code',lobInviteCode()==='');
 ok('T38.E and the note asks for one',lobInviteNote('').indexOf('Create lobby code')>=0);
 R[0].blob=b;R[0].state='invited';R[2].blob=b;R[2].state='invited';
 const code=lobInviteCode(),parsed=read57(code);
 ok('T38.E one code carries both open seats, tagged with their slot ids',
    parsed.items.map(x=>x.seat).join()==='1,3'&&parsed.lid===LOBBY.lid);
 ok('T38.E the note counts the free seats',lobInviteNote(code).indexOf('2 free seats')>=0);
 R[0].state='connected';
 ok('T38.E a seat that filled up drops out of the code',
    read57(lobInviteCode()).items.map(x=>x.seat).join()==='3');
 R[1].role='open';
 ok('T38.E a newly opened slot is reported as needing a refresh',
    lobInviteNote(lobInviteCode()).indexOf('still need a refresh')>=0);
 R[0].state='invited';R[1].role='cpu';
 lobRenderSlots();
 ok('T38.E slot rows carry no text boxes any more',
    !walk47(document.getElementById('lobSlots')).some(e=>e.tagName==='TEXTAREA'));
 ok('T38.E a covered seat says so in its row',
    walk47(document.getElementById('lobSlots')).some(e=>(e.textContent||'').indexOf('In the lobby code')>=0));
 lobPaintInvite(false);
 ok('T38.E painting fills the one code box and its note',
    document.getElementById('lobCode').value===lobInviteCode()&&
    document.getElementById('lobCodeNote').textContent.indexOf('Lobby ')===0);
 document.getElementById('lobCode').value='STALE';
 lobRefresh();
 ok('T38.E lobRefresh repaints it from the seats that are actually free',
    document.getElementById('lobCode').value===lobInviteCode());
 lobClose();

 // a spent offer must not outlive the connection it was spent on
 host47();
 const R2=LOBBY.rows;
 R2[0].role='open';R2[0].blob=b;R2[0].state='invited';R2[0].pc={close(){}};
 const c1=chan47();
 lobHostChanOpen(R2[0],c1);
 ok('T38.E a seat with somebody in it is not advertised',lobInviteCode()==='');
 c1.close();
 ok('T38.E a peer that drops takes its spent offer with it, so the code cannot point at a dead seat',
    R2[0].blob===null&&lobInviteCode()==='');
 ok('T38.E and the host is told how to reopen the seat',
    document.getElementById('lobHostStat').textContent.indexOf('Refresh lobby code')>=0);
 lobClose();
}

/* ---------- F: one paste box, routed by seat ---------- */
{
 host47();
 const R=LOBBY.rows,box={value:''};
 R[0].role='open';R[0].blob=sdpBlob(desc57(['mdns','srflx']));R[0].state='invited';
 R[1].role='open';R[1].blob=sdpBlob(desc57(['lan','srflx']));R[1].state='invited';
 R[0].pc={setRemoteDescription(d){this.got=d;return Promise.resolve()}};
 R[1].pc={setRemoteDescription(d){this.got=d;return Promise.resolve()}};
 const ans=seat=>pw2Wrap(PW2_REPLY,LOBBY.lid,[{seat:seat,blob:sdpBlob(desc57(['srflx'],'answer'))}]);
 const stat=()=>document.getElementById('lobHostStat').textContent;

 box.value='PW2.';lobTakeReply(box);
 ok('T38.F a box with a few characters in it is left alone while the paste lands',stat().indexOf('will not read')<0);
 box.value=lobInviteCode();lobTakeReply(box);
 ok('T38.F pasting the lobby code into the reply box is called out',stat().indexOf('not a reply')>=0);
 box.value=pw2Wrap(PW2_REPLY,(LOBBY.lid%65535)+1,[{seat:1,blob:sdpBlob(desc57(['srflx'],'answer'))}]);
 lobTakeReply(box);
 ok('T38.F a reply from another lobby is refused, with both ids named',stat().indexOf('different lobby')>=0);
 box.value=ans(3);lobTakeReply(box);
 ok('T38.F a reply for a slot that is not open is refused',stat().indexOf('not open')>=0);
 box.value=ans(2);lobTakeReply(box);
 ok('T38.F a good reply reaches the seat it names, and only that seat',
    !!R[1].pc.got&&R[1].pc.got.type==='answer'&&!R[0].pc.got);
 ok('T38.F and the reply carried the answering side credentials through',
    !!R[1].pc.got&&get57(R[1].pc.got.sdp,/a=ice-pwd:([^\r\n]+)/)===PW57);
 box.value=ans(1);lobTakeReply(box);
 ok('T38.F a second friend lands in the other seat',!!R[0].pc.got);
 R[0].state='connected';
 const before=stat();
 lobTakeReply(box);
 ok('T38.F the same paste is not retried',stat()===before);
 const other=pw2Wrap(PW2_REPLY,LOBBY.lid,[{seat:1,blob:sdpBlob(desc57(['srflx'],'answer','Zq7B'))}]);
 box.value='  '+other+'\n';lobTakeReply(box);
 ok('T38.F a seat that is already taken says so, whitespace and all',stat().indexOf('already taken')>=0);
 R[1].pc=null;box.value=ans(2)+' ';lobTakeReply(box);
 ok('T38.F a seat with no live invite asks for a refresh',stat().indexOf('Refresh lobby code')>=0);
 lobClose();
}

/* ---------- G: the joiner side ---------- */
{
 globalThis.RTCPeerConnection=function(){
  this.iceGatheringState='complete';
  this.createDataChannel=()=>({});
  this.createOffer=()=>Promise.resolve(desc57(['srflx']));
  this.createAnswer=()=>Promise.resolve(desc57(['srflx'],'answer'));
  this.setLocalDescription=d=>{this.localDescription=d;return Promise.resolve()};
  this.setRemoteDescription=d=>{this.remote=d;return Promise.resolve()};
  this.addEventListener=()=>{};this.close=()=>{this.closed=true};
 };
 lobOpenJoin();
 const box={value:''},stat=()=>document.getElementById('lobJoinStat').textContent;
 const b1=sdpBlob(desc57(['mdns','srflx'])),b2=sdpBlob(desc57(['lan','srflx']));
 box.value='PW2.xxxx';lobJoinPaste(box);
 ok('T38.G a short box is left alone',stat().indexOf('will not read')<0&&LOBBY.inv===null);
 box.value='PW2.'+'x'.repeat(60);lobJoinPaste(box);
 ok('T38.G a damaged code explains itself instead of throwing',stat().indexOf('will not read')>=0);
 box.value=pw2Wrap(PW2_REPLY,7,[{seat:1,blob:sdpBlob(desc57(['srflx'],'answer'))}]);
 lobJoinPaste(box);
 ok('T38.G a reply code pasted here is called out',stat().indexOf('reply code')>=0&&!LOBBY.inv);
 box.value=pw2Wrap(PW2_INVITE,0x1234,[{seat:1,blob:b1},{seat:2,blob:b2}]);
 lobJoinPaste(box);
 ok('T38.G a lobby code is parsed and the first free seat is taken',
    !!LOBBY.inv&&LOBBY.inv.lid===0x1234&&LOBBY.seat===1);
 ok('T38.G the other seats are offered as chips',
    walk47(document.getElementById('lobSeats')).filter(e=>e.tagName==='BUTTON').length===2);
 ok('T38.G the reply is already being built for that seat',stat().indexOf('Building your reply')>=0);
 const chips=walk47(document.getElementById('lobSeats')).filter(e=>e.tagName==='BUTTON');
 if(chips[1])chips[1].onclick();
 ok('T38.G clicking another chip moves the player to that seat',LOBBY.seat===2);
 ok('T38.G the code the joiner will send names the lobby and the seat it answers',
    (function(){if(!LOBBY||!LOBBY.inv)return false;
     const c=pw2Wrap(PW2_REPLY,LOBBY.inv.lid,[{seat:LOBBY.seat,blob:sdpBlob(desc57(['srflx'],'answer'))}]);
     const r=read57(c);return r.kind===PW2_REPLY&&r.lid===0x1234&&r.items.length===1&&r.items[0].seat===2})());
 const inv=LOBBY.inv;
 LOBBY.join.ch=chan47();
 box.value=pw2Wrap(PW2_INVITE,0x9999,[{seat:1,blob:b1}]);
 lobJoinPaste(box);
 ok('T38.G once connected the box is scenery and cannot tear the connection down',LOBBY.inv===inv);
 lobJoinSeats();
 ok('T38.G and the seat chips retire',walk47(document.getElementById('lobSeats')).filter(e=>e.tagName==='BUTTON').length===0);
 lobClose();
 delete globalThis.RTCPeerConnection;
}

/* ---------- H: none of it is hashed or serialized ---------- */
{
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:3,seed:5757});
 const h1=hashState();
 for(let i=0;i<60;i++)update(1/30);
 const h2=hashState(),snap=saveState();
 ok('T38.H a match snapshot mentions no lobby code, seat or id',
    snap.indexOf('PW2')<0&&snap.indexOf('"lid"')<0&&snap.indexOf('blob')<0);
 /* v72: this was the ONE non-monotonic tag check in the suite, and it is why the
    tag read v:57 for fifteen versions - bumping it broke this and nothing else, so
    nobody bumped it. Same repair v28 made to T8. */
 ok('T38.H the snapshot tag is monotonic and at least 57',JSON.parse(snap).v>=57);
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:3,seed:5757});
 ok('T38.H the same seed still opens on the same hash',hashState()===h1);
 for(let i=0;i<60;i++)update(1/30);
 ok('T38.H and runs the same trail, so nothing in v57 reached the sim',hashState()===h2);
}

/* ---------- I: nothing acts with no lobby open ---------- */
{
 lobClose();
 const before=document.getElementById('lobHostStat').textContent;
 let err=null;
 try{
  lobInviteCode();lobInviteNote('');lobPaintInvite(false);lobMintInvites();
  lobTakeReply({value:'PW2.'+'A'.repeat(60)});
  lobJoinPaste({value:'PW2.'+'A'.repeat(60)});lobJoinSeats();lobJoinAnswer();
  lobLidStr();lobSeatName(1);lobCopy('x');
 }catch(e){err=e}
 ok('T38.I every v57 entry point is a no-op with no lobby open',!err&&LOBBY===null);
 ok('T38.I and none of them wrote a status line',document.getElementById('lobHostStat').textContent===before);
 ok('T38.I lobInviteCode returns an empty string rather than a broken code',lobInviteCode()==='');
}
