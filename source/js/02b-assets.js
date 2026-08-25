/* ---------------- ASSET MANIFEST & LOADER ----------------
   Added at v91, roadmap 3 phase 1. EMPTY ON PURPOSE: this release ships the
   plumbing and no assets at all, so that the plumbing can be landed, reviewed
   and proved inert on its own. Phases 2 and 4 fill the manifest.

   THE RULE THIS FILE EXISTS TO ENFORCE: assets OVERRIDE, they never REPLACE.
   Every procedural painter and every synthesised voice stays exactly where it
   is. A caller asks imgAsset()/sndAsset() for a texture, and paints or
   synthesises the old way when the answer is null. Three things fall out of
   that, and all three are the point:
     - a missing or failed file degrades to the v90.2 game rather than to a hole;
     - art can be replaced ONE unit at a time, so phase 4 is 25 small steps;
     - the headless suite keeps testing the procedural path, which it must,
       because the shim has no image decoder and no WebGL context.

   WHY NOTHING HERE IS ON THE newGame() PATH. Loading is asynchronous and
   newGame() is not: it is called synchronously by hundreds of fixtures across
   the tails, and by the lobby the moment a match is agreed. So the load is
   kicked off ONCE when the page opens and simply raced against the player
   reaching the Start button - by which time it has long finished. newGame()
   never waits, never yields and never learns that assets exist. T66.C pins
   that, because the day it stops being true is the day the whole test suite
   turns asynchronous.

   NOTHING HERE IS SIM STATE. No manifest entry, load flag or decoded buffer is
   hashed or serialized, and none may ever be: two clients in a lockstep match
   can legitimately hold different assets - one of them may have failed a
   download - and the match must still agree tick for tick. An asset may decide
   what a player SEES or HEARS and must never decide what happens. */
const ASSET_MANIFEST={
 /* name -> url, relative to the page. Filled from phase 2 onward, e.g.
      img:{ 'unit_grunt_green':'assets/img/grunt_green.png' },
      snd:{ 'gun_rifle':'assets/snd/rifle.ogg' }                          */
 img:{},
 snd:{}
};
const ASSETS={img:{},snd:{}};
let ASSETS_STATE='idle';        // idle -> loading -> ready. Client-local; never hashed.
let ASSETS_FAILED=[];           // urls that did not arrive, for the console and for a test
let _assetsP=null;
/* Resolves when every manifest entry has either arrived or failed - it does NOT
   reject, because a missing texture is a fallback, not an error the game should
   die of. Idempotent: called twice, the second caller gets the first promise. */
function assetsLoad(){
 if(_assetsP)return _assetsP;
 ASSETS_STATE='loading';ASSETS_FAILED=[];
 const jobs=[];
 for(const k in ASSET_MANIFEST.img)jobs.push(_assetImg(k,ASSET_MANIFEST.img[k]));
 for(const k in ASSET_MANIFEST.snd)jobs.push(_assetSnd(k,ASSET_MANIFEST.snd[k]));
 _assetsP=Promise.all(jobs).then(()=>{
  ASSETS_STATE='ready';
  if(ASSETS_FAILED.length)console.warn('assets: '+ASSETS_FAILED.length+' missing, painting procedurally: '+ASSETS_FAILED.join(', '));
  return ASSETS;
 });
 return _assetsP;
}
function _assetImg(key,url){
 return new Promise(res=>{
  if(typeof Image!=='function'){ASSETS_FAILED.push(url);return res()} // headless: no decoder, and none is wanted
  const im=new Image();
  im.onload=()=>{ASSETS.img[key]=im;res()};
  im.onerror=()=>{ASSETS_FAILED.push(url);res()};
  im.src=url;
 });
}
/* Stored as raw bytes rather than a decoded AudioBuffer on purpose: decoding
   needs an AudioContext, and this project creates one only after the first user
   gesture (browsers refuse it before). Phase 2 decodes on demand and caches. */
function _assetSnd(key,url){
 if(typeof fetch!=='function'){ASSETS_FAILED.push(url);return Promise.resolve()}
 return fetch(url).then(r=>r.ok?r.arrayBuffer():Promise.reject(r.status))
  .then(buf=>{ASSETS.snd[key]={bytes:buf,buf:null}})
  .catch(()=>{ASSETS_FAILED.push(url)});
}
/* The two lookups every future caller uses. Null means "paint/synthesise it the
   way v90.2 did", which is always a legal answer. */
function imgAsset(key){return ASSETS.img[key]||null}
function sndAsset(key){return ASSETS.snd[key]||null}
function assetsReady(){return ASSETS_STATE==='ready'}
