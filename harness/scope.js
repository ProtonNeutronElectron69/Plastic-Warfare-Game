const puppeteer=require('puppeteer-core');
const chromium=require('@sparticuz/chromium').default;
(async()=>{
 const browser=await puppeteer.launch({args:[...chromium.args,'--no-sandbox','--disable-setuid-sandbox'],
  executablePath:await chromium.executablePath(),headless:true,defaultViewport:{width:1440,height:900}});
 const page=await browser.newPage();
 await page.goto('file://'+process.argv[2],{waitUntil:'networkidle0',timeout:60000});
 await new Promise(r=>setTimeout(r,1200));
 const r=await page.evaluate(()=>{
  const g=s=>{const e=document.querySelector(s);if(!e)return null;const c=getComputedStyle(e);
   return {radius:c.borderRadius,bw:c.borderTopWidth,bgImg:c.backgroundImage==='none'?'none':'gradient',
           shadow:c.boxShadow==='none'?'none':'set',seam:getComputedStyle(e,'::after').backgroundImage==='none'?'none':'seam'}};
  return {
   v57_itab:      g('#infoHead .itab'),
   v57_infoClose: g('#infoClose'),
   v57_again:     g('#againBtn'),
   v57_ctog:      g('#chartToggles .ctog'),
   v58_setupOpt:  g('#modeRow .opt'),
   v58_card:      g('#facRow .card')
  };
 });
 console.log(JSON.stringify(r,null,1));
 await browser.close();
})().catch(e=>{console.log('FAIL '+e.message);process.exit(1)});
