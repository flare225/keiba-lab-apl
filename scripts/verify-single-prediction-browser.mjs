// Default: synthetic browser verification, zero live API calls.
// LIVE_READBACK=true: exactly one independent GET for one saved prediction; no writes/retries.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const target={date:'2026-10-25',venue:'京都',raceNo:11},raceKey=`${target.date}:${target.venue}:${target.raceNo}`,live=process.env.LIVE_READBACK==='true';
const out='single-prediction-evidence';await mkdir(out,{recursive:true});let data,liveApiReads=0;
if(live){
 if(Date.now()<Date.parse('2026-10-21T00:00:00Z'))throw Error('Known D1 quota day: live readback is blocked until next UTC day.');
 const q=new URLSearchParams({date:target.date,venue:target.venue,race_no:String(target.raceNo)});liveApiReads++;
 const response=await fetch('https://keiba-lab-api.sekai-no-bancyou.workers.dev/v1/lab/automatic-prediction?'+q,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Single live readback failed HTTP '+response.status+'; no retry');data=await response.json();if(data.ok!==true||data.available!==true||data.integrityVerified!==true)throw Error('No verified saved prediction; no retries or reconstructed predictions');
}else{
 const snapshot={race:{...target,raceKey,runnerCount:2},savedAt:'2026-10-23T00:00:00Z',modelVersion:'synthetic-browser-test-only',card:[{horse_no:1,horse_name:'検証専用馬A',frame_no:1},{horse_no:2,horse_name:'検証専用馬B',frame_no:2}],runners:[{horseNo:1,horseName:'検証専用馬A',rank:1,score:80,mark:'◎'},{horseNo:2,horseName:'検証専用馬B',rank:2,score:70,mark:'○'}],guardrails:{humanMarksUsed:false,targetResultUsed:false,immutable:true}};
 data={ok:true,available:true,integrityVerified:true,snapshot,snapshotSha256:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')};
}
await writeFile(out+'/readback.json',JSON.stringify({source:live?'single-live-DB-readback':'synthetic-not-DB-data',data},null,2));
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:412,height:915},timezoneId:'Asia/Tokyo'}),page=await context.newPage(),errors=[];let rootReads=0,apiIntercepts=0,mode='good',result;
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*',async route=>{
 const request=route.request(),u=new URL(request.url());
 if(request.isNavigationRequest()&&request.method()==='GET'&&u.origin==='https://keiba-lab-apl.vercel.app'&&u.pathname==='/'&&!rootReads++){return route.continue();}
 if(request.method()!=='GET')return route.abort();
 if(u.pathname==='/v1/lab/automatic-prediction'){
  apiIntercepts++;let body=structuredClone(data);if(mode==='corrupt')body.snapshot.runners[0].score+=1;
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'access-control-allow-origin':'*'}});
 }
 if(u.pathname.startsWith('/v1/')||u.pathname.startsWith('/api/'))return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'Other API reads blocked by single-race verification scope'}),headers:{'access-control-allow-origin':'*'}});
 return route.abort();
});
try{
 await page.goto('https://keiba-lab-apl.vercel.app/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>typeof window.getLaboTarget==='function');
 await page.locator('.tab[data-id="race"]').click();
 // Use the application's target-change event; all other page APIs stay intercepted.
 await page.evaluate(t=>{window.getLaboTarget=()=>t;window.dispatchEvent(new Event('labo-target-change'));},target);
 const box=page.locator('#automaticLaboPrediction');await page.waitForFunction(hash=>document.querySelector('#automaticLaboPrediction')?.dataset.snapshotSha256===hash,data.snapshotSha256,{timeout:20000});
 const displayed=await box.locator('[data-auto-horse]').evaluateAll(xs=>xs.map(x=>({horseNo:Number(x.dataset.autoHorse),rank:Number(x.dataset.autoRank),score:Number(x.dataset.autoScore),mark:x.dataset.autoMark})));
 const expected=data.snapshot.runners.map(r=>({horseNo:r.horseNo,rank:r.rank,score:r.score,mark:r.mark||''}));if(JSON.stringify(displayed)!==JSON.stringify(expected))throw Error('Rendered rank/score/mark differs from independent readback');
 const text=await box.innerText();for(const r of data.snapshot.runners)if(!text.includes(r.horseName))throw Error('Horse name missing from rendered prediction');
 await box.screenshot({path:out+'/saved-prediction.png'});
 if(!live){mode='corrupt';await page.evaluate(()=>window.dispatchEvent(new Event('labo-target-change')));await page.waitForFunction(()=>document.querySelector('#automaticLaboPrediction')?.textContent.includes('確認できません'));if(await box.getAttribute('data-snapshot-sha256'))throw Error('Corrupt prediction retained verified badge');mode='good';await page.evaluate(t=>{window.getLaboTarget=()=>({...t,venue:'東京'});window.dispatchEvent(new Event('labo-target-change'));},target);await page.waitForFunction(()=>document.querySelector('#automaticLaboPrediction')?.textContent.includes('確認できません'));if(await box.getAttribute('data-snapshot-sha256'))throw Error('Wrong target retained verified badge');}
 if(errors.length)throw Error('Browser page errors: '+errors.join(';'));
 result={ok:true,source:live?'single-live-DB-readback':'synthetic-not-DB-data',raceKey,snapshotSha256:data.snapshotSha256,displayed,liveApiReads,liveWrites:0,forwardedBrowserApiReads:0,apiIntercepts,rootReads,pageErrors:errors,productionPersistenceProven:live,firstRaceAcquisitionAndCaptureProven:false};console.log('SINGLE_PREDICTION_BROWSER',JSON.stringify(result));
}finally{await writeFile(out+'/result.json',JSON.stringify(result||{ok:false,source:live?'single-live-DB-readback':'synthetic-not-DB-data',liveApiReads,rootReads,pageErrors:errors},null,2));await browser.close();}
