/* net_rig.js - TWO REAL BROWSERS host and join through the real codes. v112's tool.
   Rule 8 for the netcode: the headless suite fakes RTCPeerConnection, so nothing
   in seg.sh can say whether a real handshake survives a slow paste, or what a
   player actually reads when it fails. This opens two Chromium contexts on the
   shipped file, mints a lobby code in one, pastes it in the other, HOLDS the
   reply for DELAY seconds, then pastes it into the host - and prints both sides'
   connection-state timelines and status lines. Like sim.sh it MEASURES; nothing
   it prints is pinned.

   What it found at v112 (recorded in README.md): a reply held 150 s still
   connects in ~1 s, because the joiner's half of the handshake completes against
   the host's live offer before the host has the reply. And every code minted with
   the address lookup unreachable (as it is in the sandbox this was written in)
   shipped with only a local address - which is what the Wi-Fi-only note is for.

   Needs playwright-core resolvable (NODE_PATH=... works) and a Chromium that
   accepts --headless=old, i.e. the chrome-headless-shell binary:
     CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell \
     NODE_PATH=/path/with/node_modules node net_rig.js [DELAY=0] [WAIT=40]
   MODE=ok (default) | hostgone (the host's offer is closed BEFORE the joiner
   pastes the code, i.e. a host that cannot be reached: the joiner must say so)
   | hostdrop (closed AFTER the joiner built its reply, i.e. a link that was
   made and then dropped: the joiner must say so - the first cut said nothing,
   because the watcher's "lost" had no word in the lobby) | joinergone (the
   joiner's reply is dead when the host pastes it: the host must say so and free
   the seat). GAME=path overrides the file.
   One trap: the lobby copies codes to the clipboard, which headless refuses -
   the pageerror lines that prints are noise. */
const { chromium } = require('playwright-core');
const path=require('path');
const FILE='file://'+path.resolve(process.env.GAME||path.join(__dirname,'..','plastic-warfare.html'));
const DELAY=+(process.argv[2]||0), WAIT=+(process.argv[3]||40), MODE=process.env.MODE||'ok';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const br=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',args:['--no-sandbox']});
 const mk=async()=>{const ctx=await br.newContext();const pg=await ctx.newPage();await pg.goto(FILE);
  await pg.waitForFunction(()=>typeof ASSETS_STATE!=='undefined'&&ASSETS_STATE==='ready',null,{timeout:60000});return pg};
 const H=await mk(),J=await mk();
 const t0=Date.now();const T=()=>((Date.now()-t0)/1000).toFixed(1)+'s';
 for(const pg of [H,J])await pg.evaluate(()=>{window.__tl=[];const O=window.RTCPeerConnection;window.RTCPeerConnection=function(c){const pc=new O(c);const st=()=>window.__tl.push([performance.now()|0,pc.iceGatheringState,pc.iceConnectionState,pc.connectionState]);for(const ev of ['iceconnectionstatechange','connectionstatechange','icegatheringstatechange'])pc.addEventListener(ev,st);return pc};window.RTCPeerConnection.prototype=O.prototype;});
 const hstat=()=>H.evaluate(()=>document.getElementById('lobHostStat').textContent),jstat=()=>J.evaluate(()=>document.getElementById('lobJoinStat').textContent);
 const kinds=(pg,c)=>pg.evaluate(c=>{const g=pw2Read(c);return g.items[0].desc.sdp.match(/a=candidate:[^\r\n]+/g).map(x=>x.split(' typ ')[1].split(' ')[0]).join(',')},c);
 const code=await H.evaluate(async()=>{lobOpenHost();LOBBY.rows[0].role='open';lobRefresh();await lobMintInvites();return lobInviteCode()});
 console.log(T(),'host code',code.length,'chars, addresses:',await kinds(H,code),'| host says:',await hstat(),'| note:',await H.evaluate(()=>document.getElementById('lobCodeNote').textContent));
 if(MODE==='hostgone'){await H.evaluate(()=>{LOBBY.rows[0].pc.close()});console.log(T(),'host offer closed before the joiner pastes (hostgone)')}
 await J.evaluate(c=>{lobOpenJoin();const ta=document.getElementById('lobInvite');ta.value=c;lobJoinPaste(ta)},code);
 await J.waitForFunction(()=>document.getElementById('lobOut')&&document.getElementById('lobOut').value.length>20,null,{timeout:30000});
 const reply=await J.evaluate(()=>document.getElementById('lobOut').value);
 console.log(T(),'reply built',reply.length,'chars, addresses:',await kinds(J,reply),'| joiner says:',await jstat());
 if(MODE==='hostdrop'){await H.evaluate(()=>{LOBBY.rows[0].pc.close()});console.log(T(),'host offer closed after the reply was built (hostdrop)')}
 if(MODE==='joinergone'){await J.evaluate(()=>{LOBBY.join.pc.close()});console.log(T(),'joiner reply closed (joinergone)')}
 let lastJ='',lastH='';
 const tick=setInterval(async()=>{try{const j=await jstat(),h=await hstat();if(j!==lastJ){lastJ=j;console.log(T(),'  joiner says:',j)}if(h!==lastH){lastH=h;console.log(T(),'  host says:',h)}}catch(e){}},1000);
 await sleep(DELAY*1000);
 if(MODE!=='hostgone'&&MODE!=='hostdrop'){console.log(T(),'pasting reply into host');await H.evaluate(r=>{const ta=document.getElementById('lobReply');ta.value=r;lobTakeReply(ta)},reply)}
 let ok=false;const tEnd=Date.now()+WAIT*1000;
 while(Date.now()<tEnd){
  const h=await H.evaluate(()=>[LOBBY.rows[0].state,!!LOBBY.rows[0].pc]),j=await J.evaluate(()=>[!!LOBBY.join.ch,!!LOBBY.join.pc]);
  if(MODE==='ok'&&h[0]==='connected'&&j[0]){ok=true;break}
  if((MODE==='hostgone'||MODE==='hostdrop')&&!j[1]){ok=true;break}   // the joiner called it off and cleared its reply
  if(MODE==='joinergone'&&h[0]==='idle'&&!h[1]){ok=true;break} // the host freed the seat
  await sleep(500)}
 clearInterval(tick);
 console.log(T(),'final host:',await hstat(),'| final joiner:',await jstat());
 console.log('host timeline',JSON.stringify(await H.evaluate(()=>window.__tl)));
 console.log('joiner timeline',JSON.stringify(await J.evaluate(()=>window.__tl)));
 console.log('RESULT mode',MODE,'delay',DELAY,ok?'as expected':'NOT as expected');
 await br.close();
})().catch(e=>{console.log('rig error',e.message);process.exit(1)});
