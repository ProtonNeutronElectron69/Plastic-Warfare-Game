const puppeteer=require('puppeteer-core');
const chromium=require('@sparticuz/chromium').default;
(async()=>{
 const browser=await puppeteer.launch({args:[...chromium.args,'--no-sandbox','--disable-setuid-sandbox','--font-render-hinting=none'],
  executablePath:await chromium.executablePath(),headless:true,defaultViewport:{width:1440,height:900,deviceScaleFactor:1}});
 const page=await browser.newPage();
 await page.goto('file://'+process.argv[2],{waitUntil:'networkidle0',timeout:60000});
 await new Promise(r=>setTimeout(r,1500));
 const d=await page.evaluate(()=>{
  const out={};
  const probe=(sel)=>{const e=document.querySelector(sel);if(!e)return null;const r=e.getBoundingClientRect();const cs=getComputedStyle(e);
   return {w:+r.width.toFixed(1),h:+r.height.toFixed(1),fs:cs.fontSize,pad:cs.padding,lh:cs.lineHeight,
    flexShrink:cs.flexShrink,minH:cs.minHeight,overflow:cs.overflow,
    scrollH:e.scrollHeight,clientH:e.clientHeight,txt:(e.textContent||'').trim().slice(0,30)}};
  out.startBtn=probe('#startBtn');
  out.infoBtn=probe('#infoBtn');
  out.someOpt=probe('#modeRow .opt');
  const s=document.getElementById('setup');
  out.setup={h:s.getBoundingClientRect().height,scrollH:s.scrollHeight,clientH:s.clientHeight,
             display:getComputedStyle(s).display,dir:getComputedStyle(s).flexDirection,
             children:s.children.length};
  return out;
 });
 console.log(JSON.stringify(d,null,1));
 await browser.close();
})().catch(e=>{console.log('FAIL '+e.message);process.exit(1)});
