import { chromium } from 'playwright-core';
import fs from 'node:fs';
fs.mkdirSync('mobile-test-shots',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const sizes=[{w:360,h:740},{w:393,h:852},{w:850,h:384}];
let failures=0;
for (const size of sizes) {
 const context=await browser.newContext({viewport:{width:size.w,height:size.h},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const page=await context.newPage();
 await page.goto('https://turkuaz3d.com/yonetim/?mode=android&layout=4&test='+Date.now(),{waitUntil:'domcontentloaded',timeout:40000});
 await page.waitForTimeout(2000);
 for (const view of ['dashboard','editor','stats','account']) {
  await page.locator('nav button[data-view="'+view+'"]').click();
  await page.waitForTimeout(300);
  const info=await page.evaluate(()=>{
   const visible=e=>{const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&e.getClientRects().length};
   const nodes=[...document.querySelectorAll('body *')].filter(visible);
   const overflowing=nodes.flatMap(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+3||r.left< -3?[{tag:e.tagName,cls:(e.className||'').toString().slice(0,60),left:Math.round(r.left),right:Math.round(r.right)}]:[]});
   return {viewport:innerWidth,bodyWidth:document.body.scrollWidth,docWidth:document.documentElement.scrollWidth,overflowing:overflowing.slice(0,10),mode:document.body.className};
  });
  const file='mobile-test-shots/'+size.w+'x'+size.h+'-'+view+'.png';
  await page.screenshot({path:file,fullPage: false});
  console.log(JSON.stringify({size,view,...info}));
  if(info.bodyWidth>info.viewport+3||info.docWidth>info.viewport+3||info.overflowing.length){failures++}
 }
 await context.close();
}
await browser.close();
if(failures){console.error('VIEWPORT OVERFLOWS '+failures);process.exitCode=1}else console.log('PASS: all Android portrait and landscape screens fit viewport');
