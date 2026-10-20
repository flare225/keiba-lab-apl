import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('listing-evidence',{recursive:true});
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:412,height:915},timezoneId:'Asia/Tokyo'}),page=await context.newPage();
const forwarded=[],intercepted=[],writes=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*',async route=>{
 const r=route.request(),u=new URL(r.url());
 if(r.isNavigationRequest()&&r.method()==='GET'&&u.origin==='https://keiba-lab-apl.vercel.app'&&u.pathname==='/'&&!forwarded.length){forwarded.push(r.url());return route.continue();}
 if(!['GET','HEAD','OPTIONS'].includes(r.method())){writes.push({method:r.method(),url:r.url()});return route.abort();}
 if(u.pathname.startsWith('/v1/')||u.pathname.startsWith('/api/')){intercepted.push(r.url());return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:"D1_ERROR: Your account has exceeded D1's free tier daily row read limit."}),headers:{'access-control-allow-origin':'*'}});}
 return route.abort();
});
let result;
try{
 await page.goto('https://keiba-lab-apl.vercel.app/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>document.querySelectorAll('#raceTarget option').length>=72,null,{timeout:20000});
 await page.locator('.tab[data-id="race"]').click();
 const options=await page.locator('#raceTarget option').evaluateAll(xs=>xs.map(x=>({value:x.value,text:x.textContent}))),week=options.filter(x=>/2026-10-2[45]/.test(x.text));
 if(week.length!==72||new Set(week.map(x=>x.text)).size!==72)throw Error('Current-week listing incomplete');
 const notice=await page.locator('#raceListingNotice').innerText();if(!notice.includes('前回確認済み')||!notice.includes('未照合'))throw Error('Prior listing must not claim live DB verification');
 const niigata=week.find(x=>x.text.includes('2026-10-25 新潟12R'));if(!niigata)throw Error('Missing Niigata target');await page.locator('#raceTarget').selectOption(niigata.value);
 await page.waitForFunction(()=>window.getLaboTarget?.().venue==='新潟'&&window.getLaboTarget?.().raceNo===12);
 if(week.some(x=>x.text.includes('✓')))throw Error('Fallback listing claims verified cards');
 await page.screenshot({path:'listing-evidence/current-week-without-db.png',fullPage:true});
 result={currentWeekOptions:72,niigataOptions:week.filter(x=>x.text.includes('新潟')).length,selected:await page.evaluate(()=>window.getLaboTarget()),notice,forwarded,interceptedApiReads:intercepted.length,forwardedApiReads:0,blockedWrites:writes,pageErrors:errors,verification:'production HTML with locally intercepted API errors; not live DB readback'};
 console.log('LISTING_NO_DB_VERIFIED',JSON.stringify(result));
}finally{await writeFile('listing-evidence/result.json',JSON.stringify(result||{forwarded,intercepted,writes,errors},null,2));await browser.close();}
