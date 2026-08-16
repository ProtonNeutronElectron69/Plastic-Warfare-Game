/* shim_head.js — universal DOM/canvas shim so the extracted game script runs
   headless under Node. Every DOM surface the game touches is a permissive fake:
   canvas 2d contexts swallow draw calls (getImageData returns correctly sized
   zeroed buffers), elements accept any property, remove() really detaches (the
   msg() trim loop depends on it), firstChild is a LIVE getter (clear loops
   depend on it), and RAF is a no-op so tests drive update(1/30) directly. */
'use strict';
global.__SHIM = true;

/* ---- canvas 2d context: permissive Proxy ---- */
function makeCtx(cv){
 const store={fillStyle:'#000',strokeStyle:'#000',lineWidth:1,globalAlpha:1,font:'10px x',
  textAlign:'left',textBaseline:'alphabetic',lineCap:'butt',lineJoin:'round',
  globalCompositeOperation:'source-over',imageSmoothingEnabled:true,filter:'none',
  shadowBlur:0,shadowColor:'#000',shadowOffsetX:0,shadowOffsetY:0,miterLimit:10,lineDashOffset:0};
 return new Proxy(store,{
  get(t,k){
   if(k==='canvas')return cv;
   if(k==='measureText')return s=>({width:(s?String(s).length:1)*6,actualBoundingBoxAscent:8,actualBoundingBoxDescent:2});
   if(k==='getImageData'||k==='createImageData')return (a,b,w,h)=>{const W=(h===undefined)?a:w,H=(h===undefined)?(b||1):h;return{data:new Uint8ClampedArray(Math.max(4,(W|0)*(H|0)*4)),width:W|0,height:H|0}};
   if(k==='putImageData')return ()=>{};
   if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createConicGradient')return ()=>({addColorStop(){}});
   if(k==='createPattern')return ()=>({});
   if(k==='getLineDash')return ()=>[];
   if(k in t)return t[k];
   return function(){};
  },
  set(t,k,v){t[k]=v;return true},
 });
}

/* ---- DOM elements ---- */
let elSeq=0;
function makeEl(tag){
 tag=(tag||'div').toLowerCase();
 const listeners={};
 const el={
  _id:++elSeq, tagName:tag.toUpperCase(), nodeType:1,
  style:new Proxy({},{get:(t,k)=>t[k]!==undefined?t[k]:'',set:(t,k,v)=>{t[k]=v;return true}}),
  children:[], childNodes:null, dataset:{}, parentNode:null,
  width:1280, height:800, value:'', innerHTML:'', textContent:'', className:'', id:'',
  disabled:false, checked:false, maxLength:0, title:'', placeholder:'',
  classList:{_s:new Set(),
   add(...a){a.forEach(x=>this._s.add(x))},
   remove(...a){a.forEach(x=>this._s.delete(x))},
   toggle(x,f){if(f===undefined){this._s.has(x)?this._s.delete(x):this._s.add(x)}else{f?this._s.add(x):this._s.delete(x)}return this._s.has(x)},
   contains(x){return this._s.has(x)}},
  appendChild(c){if(c&&c.parentNode)c.parentNode.removeChild(c);el.children.push(c);if(c)c.parentNode=el;return c},
  removeChild(c){const i=el.children.indexOf(c);if(i>=0)el.children.splice(i,1);if(c)c.parentNode=null;return c},
  insertBefore(c,ref){const i=ref?el.children.indexOf(ref):-1;if(i>=0)el.children.splice(i,0,c);else el.children.unshift(c);if(c)c.parentNode=el;return c},
  remove(){if(el.parentNode)el.parentNode.removeChild(el)},          // must REALLY detach
  addEventListener(t2,fn){(listeners[t2]=listeners[t2]||[]).push(fn)},
  removeEventListener(t2,fn){const a=listeners[t2];if(a){const i=a.indexOf(fn);if(i>=0)a.splice(i,1)}},
  dispatchEvent(ev){const a=listeners[ev.type]||[];for(const f of a)f(ev);if(typeof el['on'+ev.type]==='function')el['on'+ev.type](ev);return true},
  getContext(){return el._ctx||(el._ctx=makeCtx(el))},
  getBoundingClientRect(){return{left:0,top:0,right:el.width,bottom:el.height,width:el.width,height:el.height,x:0,y:0}},
  querySelector(){return makeEl('div')},
  querySelectorAll(){return[]},
  focus(){},blur(){},click(){if(typeof el.onclick==='function')el.onclick({})},
  setAttribute(k,v){el[k]=v},getAttribute(k){return el[k]!==undefined?el[k]:null},removeAttribute(){},
  scrollIntoView(){},
 };
 Object.defineProperty(el,'firstChild',{get(){return el.children[0]||null}}); // LIVE
 Object.defineProperty(el,'lastChild',{get(){return el.children[el.children.length-1]||null}});
 el.childNodes=el.children;
 return el;
}

/* ---- document ---- */
const _byId={};
const document={
 getElementById(id){return _byId[id]||(_byId[id]=makeEl('div'),_byId[id].id=id,_byId[id])},
 createElement(tag){return makeEl(tag)},
 createTextNode(s){return{nodeType:3,textContent:s,parentNode:null,remove(){}}},
 addEventListener(){},removeEventListener(){},
 body:makeEl('body'),documentElement:makeEl('html'),
 querySelector(){return makeEl('div')},querySelectorAll(){return[]},
 hidden:false,visibilityState:'visible',
};
// canvases the game grabs at load need real-ish dims
document.getElementById('view').width=1280;document.getElementById('view').height=800;
document.getElementById('minimap').width=176;document.getElementById('minimap').height=176;

/* ---- window / globals ---- */
global.document=document;
global.window=global;                 // window.AudioContext etc. resolve (to undefined; guarded)
global.innerWidth=1280;global.innerHeight=800;global.devicePixelRatio=1;
global.addEventListener=function(){};global.removeEventListener=function(){};
global.requestAnimationFrame=function(){return 0};   // no loop; tests call update() directly
global.cancelAnimationFrame=function(){};
global.performance=global.performance||{now:()=>Date.now()};
global.location={href:'http://localhost/',reload(){}};
try{Object.defineProperty(global,'navigator',{value:{userAgent:'node-harness',language:'en-US',clipboard:{writeText:async()=>{}}},configurable:true});}
catch(e){/* older Node: plain assign */ try{global.navigator={userAgent:'node-harness'}}catch(e2){}}
global.alert=function(){};global.prompt=function(){return null};global.confirm=function(){return true};
global.localStorage={_s:{},getItem(k){return this._s[k]!==undefined?this._s[k]:null},setItem(k,v){this._s[k]=String(v)},removeItem(k){delete this._s[k]},clear(){this._s={}}};
/* AudioContext intentionally undefined: initAudio's try/catch handles it.
   speechSynthesis intentionally undefined: bark code guards with typeof. */
