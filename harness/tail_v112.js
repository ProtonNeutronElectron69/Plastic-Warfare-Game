/* ============================================================================
   T97 - v112: THE HANDSHAKE SAYS WHAT WENT WRONG
   The owner: the invite code "often fails to connect players into the lobby,
   but once connected seems stable". Measured first with two real Chromium
   windows (harness/net_rig.js): a reply held back 0/20/45/90/150 s connected
   every time in about a second - the joiner's half of the handshake completes
   against the host's live offer before the host has the reply, so the slow
   paste was never the failure. What the rig DID show is that a code minted
   while the address lookup is unreachable shipped after the 4 s cut-off with
   only a local address in it, and the lobby said nothing; and that a link that
   cannot be made hung on "Connecting..." forever on both sides.
   v112, by instruction, stays peer to peer with no relay: the gather waits
   longer for a PUBLIC address (rtcGather), each side remembers whether it
   found one (pub), one watcher turns the browser's states into a few plain
   words (rtcWatch), and LOB_MSG is every word a player can read about it.

   The suite fakes RTCPeerConnection and exits synchronously (tail_end.js), so
   the timers here run on a FAKE CLOCK - setTimeout is replaced for the length
   of a check and fired by hand - and the async lobby paths are pinned by their
   source shape plus the real-browser rig, which is a measurement, not a pin.
   ==========================================================================*/
section('T97 v112: the handshake says what went wrong');
const SDP112=(cands,type)=>({type:type||'offer',sdp:'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\n'
 +cands.map((k,i)=>({host:'a=candidate:1 1 udp 2122260223 192.168.1.9 5000'+i+' typ host\r\n',mdns:'a=candidate:2 1 udp 2122260222 0a1b2c3d-1111-2222-3333-444455556666.local 50010 typ host\r\n',
   srflx:'a=candidate:3 1 udp 1686052607 203.0.113.7 6000'+i+' typ srflx raddr 0.0.0.0 rport 0\r\n',relay:'a=candidate:4 1 udp 41885439 198.51.100.2 7000'+i+' typ relay raddr 0.0.0.0 rport 0\r\n'})[k]).join('')
 +'a=ice-ufrag:abcd\r\na=ice-pwd:'+'p'.repeat(24)+'\r\na=fingerprint:sha-256 '+'AB:'.repeat(31)+'AB\r\na=setup:'+((type==='answer')?'active':'actpass')+'\r\na=mid:0\r\na=sctp-port:5000\r\n'});
/* a fake clock: setTimeout records, fire(i) runs the i-th, clears are counted */
function clock112(fn){
 const S=globalThis.setTimeout,C=globalThis.clearTimeout;const timers=[],cleared=[];
 globalThis.setTimeout=(f,ms)=>{timers.push({f,ms});return {id:timers.length,unref(){}}};
 globalThis.clearTimeout=t=>{cleared.push(t&&t.id)};
 try{return fn({timers,cleared,fire:i=>timers[i].f()})}finally{globalThis.setTimeout=S;globalThis.clearTimeout=C}
}
/* a fake connection whose states and events a check can drive */
function pc112(cands){
 const L={};return {iceGatheringState:'gathering',iceConnectionState:'new',connectionState:'new',localDescription:SDP112(cands||[]),
  addEventListener(n,f){(L[n]=L[n]||[]).push(f)},fire(n){for(const f of (L[n]||[]))f()},close(){this.closed=true;this.iceConnectionState='closed';this.connectionState='closed'},
  createDataChannel(){return {}},createOffer(){return Promise.resolve(SDP112(cands||[]))},createAnswer(){return Promise.resolve(SDP112(cands||[],'answer'))},
  setLocalDescription(d){this.localDescription=d;return Promise.resolve()},setRemoteDescription(d){this.remote=d;return Promise.resolve()}};
}

/* ---------- A: what counts as a public address ---------- */
section('T97.A sdpPublic: a server-reflexive or relay address, nothing else');
{
 ok('T97.A a host-only description is local', !sdpPublic(SDP112(['host','mdns']).sdp) && !sdpPublic('') && !sdpPublic(null));
 ok('T97.A a reflexive address makes it public; so would a relay, should one ever be configured', sdpPublic(SDP112(['host','srflx']).sdp) && sdpPublic(SDP112(['relay']).sdp));
 ok('T97.A the joiner reads the HOST\'s public-ness off the code it pasted, through the same function on the reconstructed description',
    (()=>{const b=sdpBlob(SDP112(['mdns','srflx']));const c=pw2Wrap(PW2_INVITE,7,[{seat:1,blob:b}]);const g=pw2Read(c);return sdpPublic(g.items[0].desc.sdp)})()
    && (()=>{const b=sdpBlob(SDP112(['mdns']));const c=pw2Wrap(PW2_INVITE,7,[{seat:1,blob:b}]);const g=pw2Read(c);return !sdpPublic(g.items[0].desc.sdp)})());
}

/* ---------- B: the gather waits longer for a public address, not longer than before with one ---------- */
section('T97.B rtcGather: settle at the first mark with a public address in hand, else hold on to the second');
{
 ok('T97.B the two marks are 4 s and 9 s: no slower than v57 when the lookup answered, over twice as patient when it has not', RTC_GATHER_MS===4000 && RTC_GATHER_MAX_MS===9000 && RTC_GATHER_MAX_MS>RTC_GATHER_MS);
 const run=(cands,go)=>clock112(K=>{const pc=pc112(cands);rtcGather(pc);return go(pc,K)});
 ok('T97.B already complete: nothing is scheduled', clock112(K=>{const pc=pc112(['srflx']);pc.iceGatheringState='complete';rtcGather(pc);return K.timers.length===0}));
 ok('T97.B two timers are armed at the two marks', run(['host'],(pc,K)=>K.timers.length===2&&K.timers[0].ms===RTC_GATHER_MS&&K.timers[1].ms===RTC_GATHER_MAX_MS));
 ok('T97.B at the first mark WITH a public address: done (both timers cleared)', run(['host','srflx'],(pc,K)=>{K.fire(0);return K.cleared.length===2}));
 ok('T97.B at the first mark WITHOUT one: still waiting', run(['host','mdns'],(pc,K)=>{K.fire(0);return K.cleared.length===0}));
 ok('T97.B ...and a public address that arrives between the marks is not waited past the second', run(['host'],(pc,K)=>{K.fire(0);if(K.cleared.length)return false;K.fire(1);return K.cleared.length===2}));
 ok('T97.B gathering completing early ends the wait at once', run(['host'],(pc,K)=>{pc.iceGatheringState='complete';pc.fire('icegatheringstatechange');return K.cleared.length===2}));
 ok('T97.B a second finish is a no-op', run(['host','srflx'],(pc,K)=>{K.fire(0);pc.iceGatheringState='complete';pc.fire('icegatheringstatechange');K.fire(1);return K.cleared.length===2}));
 ok('T97.B the offer and the answer both carry whether they found one', /pub:sdpPublic\(pc\.localDescription\.sdp\)/.test(rtcMakeOffer.toString()) && /pub:sdpPublic\(pc\.localDescription\.sdp\)/.test(rtcMakeAnswer.toString()));
}

/* ---------- C: the watcher ---------- */
section('T97.C rtcWatch: linked / slow / failed / lost, once each, and it can be stopped');
{
 const watch=(go)=>clock112(K=>{const pc=pc112(['host']);const said=[];const stop=rtcWatch(pc,s=>said.push(s));return go(pc,K,said,stop)});
 ok('T97.C the two marks are 20 s and 50 s', RTC_CONNECT_MS===20000 && RTC_GIVEUP_MS===50000);
 ok('T97.C nothing is said on a fresh link', watch((pc,K,said)=>said.length===0));
 ok('T97.C the browser reaching the other side is "linked", once', watch((pc,K,said)=>{pc.iceConnectionState='connected';pc.fire('iceconnectionstatechange');pc.iceConnectionState='completed';pc.fire('iceconnectionstatechange');return said.join()==='linked'}));
 ok('T97.C the browser giving up is "failed"', watch((pc,K,said)=>{pc.iceConnectionState='failed';pc.fire('iceconnectionstatechange');return said.join()==='failed'}));
 ok('T97.C a closed connection counts as failed too', watch((pc,K,said)=>{pc.close();pc.fire('connectionstatechange');return said.join()==='failed'}));
 ok('T97.C the first mark with nothing linked is "slow"; the second is "failed"', watch((pc,K,said)=>{K.fire(0);K.fire(1);return said.join()==='slow,failed'}));
 ok('T97.C neither mark speaks once the link is made', watch((pc,K,said)=>{pc.iceConnectionState='connected';pc.fire('iceconnectionstatechange');K.fire(0);K.fire(1);return said.join()==='linked'}));
 ok('T97.C a made link that drops is "lost", and that is the last word', watch((pc,K,said)=>{pc.iceConnectionState='connected';pc.fire('iceconnectionstatechange');pc.iceConnectionState='disconnected';pc.fire('iceconnectionstatechange');pc.iceConnectionState='failed';pc.fire('iceconnectionstatechange');return said.join()==='linked,lost'}));
 ok('T97.C a drop before any link is not "lost" (there was nothing to lose)', watch((pc,K,said)=>{pc.iceConnectionState='disconnected';pc.fire('iceconnectionstatechange');return said.length===0}));
 ok('T97.C stopping it clears both timers and silences it', watch((pc,K,said,stop)=>{stop();K.fire(0);K.fire(1);pc.iceConnectionState='failed';pc.fire('iceconnectionstatechange');return said.length===0&&K.cleared.length===2}));
}

/* ---------- D: the host's side ---------- */
section('T97.D the host: a code with no internet address says so; a link that fails frees the seat');
{
 lobOpenHost();
 const R=LOBBY.rows;R[0].role='open';
 const stat=()=>document.getElementById('lobHostStat').textContent;
 R[0].pc=pc112(['mdns']);R[0].blob=sdpBlob(SDP112(['mdns']));R[0].state='invited';R[0].pub=false;
 ok('T97.D the note under the code carries "Wi-Fi only" while a seat\'s offer has no public address', lobInviteNote(lobInviteCode()).indexOf('Wi‑Fi only')>0);
 R[0].pub=true;
 ok('T97.D ...and drops it the moment it has one', lobInviteNote(lobInviteCode()).indexOf('Wi‑Fi only')<0);
 ok('T97.D the mint says it in the status line too, off the same flag', /r\.pub===false\)\)\s*lobHostStat\(LOB_MSG\.hostLocal\)/.test(lobMintInvites.toString()));
 lobHostLink(R[0],1,'slow'); // seat 1 is the first FRIEND row, which the host's roster labels Slot 2
 ok('T97.D "slow" says it is still trying, naming the seat', stat()===LOB_MSG.hostSlow('Slot 2'));
 R[0].unwatch=()=>{R[0].unwatched=true};
 lobHostLink(R[0],1,'failed');
 ok('T97.D "failed" says so and asks for a new code', stat()===LOB_MSG.hostFail('Slot 2'));
 ok('T97.D ...and frees the seat: offer closed, blob gone, watcher stopped, back to idle so the next mint makes a fresh offer', R[0].pc===null&&R[0].blob===null&&R[0].state==='idle'&&R[0].unwatched===true&&R[0].role==='open');
 R[0].pc=pc112(['srflx']);R[0].blob=sdpBlob(SDP112(['srflx']));R[0].state='invited';R[0].unwatched=false;R[0].unwatch=()=>{R[0].unwatched=true};
 lobHostLink(R[0],1,'lost');
 ok('T97.D a link made and then dropped before the channel opened ("lost") is a failure too - the rig\'s hostdrop case, which the first cut ignored', stat()===LOB_MSG.hostFail('Slot 2')&&R[0].pc===null&&R[0].state==='idle'&&R[0].unwatched===true);
 R[0].pc=pc112(['srflx']);R[0].state='connected';document.getElementById('lobHostStat').textContent='quiet';
 lobHostLink(R[0],1,'failed');
 ok('T97.D a seat that is already connected is not touched by a late word', stat()==='quiet'&&R[0].state==='connected'&&R[0].pc);
 ok('T97.D the watcher is attached when the reply lands, and stopped when the channel opens or the lobby closes',
    /rtcWatch\(row\.pc,s=>lobHostLink\(row,it\.seat,s\)\)/.test(lobTakeReply.toString()) && /r\.unwatch\(\)/.test(lobHostChanOpen.toString()) && /r\.unwatch\(\)/.test(lobClose.toString()));
 lobClose();
}

/* ---------- E: the joiner's side ---------- */
section('T97.E the joiner: a local-only code is called out; a link that fails clears the reply and allows a retry');
{
 lobOpenJoin();
 const stat=()=>document.getElementById('lobJoinStat').textContent;
 const src=lobJoinAnswer.toString();
 ok('T97.E the reply\'s status carries the host\'s note when the code had no public address, else the joiner\'s own when the reply has none',
    /!sdpPublic\(it\.desc\.sdp\)\?' '\+LOB_MSG\.joinLocal:\(got\.pub===false\?' '\+LOB_MSG\.replyLocal:''\)/.test(src) && /rtcWatch\(got\.pc,s=>lobJoinLink\(s\)\)/.test(src));
 LOBBY.join.pc=pc112(['host']);LOBBY.lastInvite='PW2.something';
 const out=document.getElementById('lobOut');if(out)out.value='a reply';
 lobJoinLink('slow');
 ok('T97.E "slow" says it is still trying', stat()===LOB_MSG.joinSlow);
 LOBBY.join.unwatch=()=>{LOBBY.join.unwatched=true};
 lobJoinLink('failed');
 ok('T97.E "failed" says so and asks for a new code', stat()===LOB_MSG.joinFail);
 ok('T97.E ...the dead reply is closed and cleared, and the same code may be pasted again to retry', LOBBY.join.pc===null&&LOBBY.join.unwatched===true&&LOBBY.lastInvite===''&&(!out||out.value===''));
 LOBBY.join.pc=pc112(['host']);LOBBY.lastInvite='PW2.again';LOBBY.join.unwatched=false;LOBBY.join.unwatch=()=>{LOBBY.join.unwatched=true};
 lobJoinLink('lost');
 ok('T97.E "lost" before the channel opened is the same failure to the joiner', stat()===LOB_MSG.joinFail&&LOBBY.join.pc===null&&LOBBY.join.unwatched===true&&LOBBY.lastInvite==='');
 LOBBY.join.ch={};document.getElementById('lobJoinStat').textContent='quiet';
 lobJoinLink('failed');
 ok('T97.E once the channel is open a late word is ignored', stat()==='quiet');
 ok('T97.E the watcher is stopped when the channel opens', /LOBBY\.join\.unwatch\(\)/.test(lobJoinChanOpen.toString()));
 lobClose();
}

/* ---------- F: the words ---------- */
section('T97.F every word a player can read about it is short and plain');
{
 const words=Object.keys(LOB_MSG).map(k=>typeof LOB_MSG[k]==='function'?LOB_MSG[k]('Slot 2'):LOB_MSG[k]);
 const jargon=/\b(ICE|STUN|TURN|SDP|NAT|DTLS|WebRTC|candidate|reflexive|relay|peer|signal|handshake|socket|UDP|TCP|IP)\b/i;
 ok(`T97.F seven messages, none over 60 characters (longest ${Math.max(...words.map(w=>w.length))})`, words.length===7 && words.every(w=>w.length<=60));
 ok('T97.F none of them uses the browser\'s vocabulary', words.every(w=>!jargon.test(w)));
 ok('T97.F each ends as a sentence and says what to do or what is happening', words.every(w=>/[.…]$/.test(w)));
 // and the rest of the lobby's own status lines never did either - a derived sweep, so a future message has to keep the rule
 const lob=[lobTakeReply,lobJoinPaste,lobJoinAnswer,lobMintInvites,lobHostStart,lobHostLink,lobJoinLink].map(f=>f.toString()).join('\n');
 const lits=(lob.match(/lob(?:Host|Join)Stat\((['"`])(?:(?!\1).)*\1/g)||[]).map(s=>s.slice(s.indexOf('(')+2,-1));
 ok(`T97.F none of the lobby\'s ${lits.length} other status lines uses it either`, lits.length>=10 && lits.every(w=>!jargon.test(w)));
}

/* ---------- G: what did NOT change ---------- */
section('T97.G still peer to peer, still no relay, and the rig is a tool, not a test');
{
 ok('T97.G the only servers named are the two address-lookup ones; no relay, no rendezvous', JSON.stringify(RTC_CFG.iceServers).indexOf('turn')<0 && RTC_CFG.iceServers.length===1 && RTC_CFG.iceServers[0].urls.every(u=>/^stun:/.test(u)));
 ok('T97.G the code format is untouched: three addresses at most, the same kinds', PW2_MAXC===3 && PW2_INVITE===1 && PW2_REPLY===2 && !/relay/.test(pw2Cands.toString()));
 const fs=require('fs');
 ok('T97.G harness/net_rig.js exists, names its browser and its two failure modes, and is not in seg.sh', fs.existsSync('net_rig.js') && /playwright-core/.test(fs.readFileSync('net_rig.js','utf8')) && /hostgone/.test(fs.readFileSync('net_rig.js','utf8')) && /joinergone/.test(fs.readFileSync('net_rig.js','utf8')) && fs.readFileSync('seg.sh','utf8').indexOf('net_rig')<0);
 ok('T97.G nothing here is simulation: the network glue names neither srand nor hashState', !/srand\(|hashState\(/.test([rtcGather,rtcWatch,sdpPublic,lobHostLink,lobJoinLink].map(f=>f.toString()).join()));
}
