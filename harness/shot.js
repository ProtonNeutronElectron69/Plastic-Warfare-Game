const puppeteer=require('puppeteer-core');
const chromium=require('@sparticuz/chromium').default;
(async()=>{
 const file=process.argv[2], out=process.argv[3];
 const browser=await puppeteer.launch({
  args:[...chromium.args,'--no-sandbox','--disable-setuid-sandbox','--font-render-hinting=none'],
  executablePath:await chromium.executablePath(),
  headless:true, defaultViewport:{width:1440,height:900,deviceScaleFactor:1}
 });
 const page=await browser.newPage();
 const errs=[];
 page.on('pageerror',e=>errs.push('pageerror: '+e.message));
 page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
 await page.goto('file://'+file,{waitUntil:'networkidle0',timeout:60000});
 await new Promise(r=>setTimeout(r,2500));   // let bakeSprites + a few frames land
 await page.screenshot({path:out});
 console.log('shot -> '+out+(errs.length?('\n  ERRORS:\n  '+errs.join('\n  ')):'  (no page errors)'));
 await browser.close();
})().catch(e=>{console.log('LAUNCH FAIL: '+e.message);process.exit(1)});
