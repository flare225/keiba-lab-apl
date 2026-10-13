import test from 'node:test';
import assert from 'node:assert/strict';
import {mountOwnerMarkSave} from '../src/mark-owner-client-v1.25.js';

function harness({configured=true,phase='final',verified=true,existing=false,readRaceKey=null,onRead=null,applyWrongMark=false,tokenMatches=true,provenance={status:'retrospective',integrityVerified:true},resultRaceKey='2026-10-11:東京:11',resultRows=null,onResult=null}={}){
 const ids=['ownerMarkDbControls','ownerMarkDbStatus','ownerMarkPassword','ownerMarkLogin',
  'ownerMarkLogout','ownerMarkSave','ownerMarkRestore','ownerMarkLoginRow','ownerMarkReview','ownerMarkReviewReport'];
 const elements=new Map(ids.map(id=>[id,{
  hidden:false,disabled:false,value:'',textContent:'',handlers:{},
  addEventListener(event,fn){this.handlers[event]=fn;},
  click(){if(id==='ownerMarkLogin')return elements.get('ownerMarkLoginRow').handlers.submit?.({preventDefault(){}});return this.handlers.click?.();}
 }]));
 const handlers={};
 const window={
  addEventListener(event,fn){(handlers[event]??=[]).push(fn);},
  dispatchEvent(event){for(const fn of handlers[event.type]||[])fn(event);},
  confirm(){return true;}
 };
 const current={target:{date:'2026-10-11',venue:'東京',raceNo:11},state:{
  phase,track:phase==='final'?'良':'',rosterVerified:verified,
  roster:['馬A','馬B'],rosterNumbers:{馬A:{verified,horseNo:1,frameNo:1},馬B:{verified,horseNo:2,frameNo:1}},
  marks:[{horseName:'馬A',mark:'◎'},{horseName:'馬B',mark:'○'}]
 }};
 let authenticated=false;
 let remote=existing?{
  phase:current.state.phase,revisionNo:1,revisionId:'old-revision',createdAt:'2026-10-09T23:00:00.000Z',
  provenance,trackCondition:current.state.track,entries:[{horse_no:1,horse_name:'馬A',mark:'◎'},{horse_no:2,horse_name:'馬B',mark:'○'}]}:null;
 const calls=[];
 const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
 async function fetcher(url,options={}){
  const method=options.method||'GET';
  calls.push({url,method,body:options.body?JSON.parse(options.body):null});
  if(url==='/v1/lab/user-mark-session'&&method==='GET')return json({ok:true,configured,authenticated});
  if(url==='/v1/lab/user-mark-session'&&method==='POST'){
   const body=options.body?JSON.parse(options.body):{};
   if(body.action==='check-worker-write-token')return json({ok:true,workerWriteTokenMatch:typeof tokenMatches==='function'?tokenMatches():tokenMatches,mode:'no-write'});
   authenticated=true;return json({ok:true,authenticated:true});
  }
  if(url==='/v1/lab/user-mark-session'&&method==='DELETE'){authenticated=false;return json({ok:true});}
  if(url==='/v1/lab/user-marks/save'&&method==='POST'){
   const body=JSON.parse(options.body);
   const rev=(remote?.revisionNo||0)+1;
   remote={phase:body.phase,revisionNo:rev,revisionId:'revision-'+rev,
    createdAt:'2026-10-10T00:00:00.000Z',trackCondition:body.track||null,
    entries:body.marks.map(m=>({horse_no:m.horseNo??null,horse_name:m.horseName,mark:m.mark}))};
   return json({ok:true,stage:'db-written-readback-verified',revisionNo:rev,entryCount:body.marks.length,
    savedAt:'2026-10-10T00:00:00.000Z',verifiedAt:'2026-10-10T00:00:01.000Z'});
  }
  if(url.startsWith('https://keiba-lab-api.sekai-no-bancyou.workers.dev/v1/lab/history/race?')){
   if(onResult)onResult({current});
   return json({ok:true,race:{raceKey:resultRaceKey,runnerCount:2},result:{complete:true},runners:resultRows||[{horseNo:1,horseName:'馬A',finishPosition:2,finishStatus:'finished'},{horseNo:2,horseName:'馬B',finishPosition:1,finishStatus:'finished'}]});
  }
  if(url.startsWith('/v1/lab/user-marks?')){
   if(onRead)await onRead({current,window,calls});
   return json({ok:true,raceKey:readRaceKey||'2026-10-11:東京:11',latest:remote?[remote]:[]});
  }
  throw Error('unexpected route '+url+' '+method);
 }
 const payload=(t,s)=>({date:t.date,venue:t.venue,raceNo:t.raceNo,phase:s.phase,
  ...(s.track?{track:s.track}:{}),marks:s.marks.map(m=>({...m,horseNo:s.rosterNumbers[m.horseName]?.horseNo}))});
 const initial=(t,s)=>({date:t.date,venue:t.venue,raceNo:t.raceNo,phase:'initial',
  marks:s.marks,localOnly:true});
 mountOwnerMarkSave({document:{getElementById:id=>elements.get(id)||null},
  window,getCurrent:()=>current,verifiedMarkPayload:payload,
  initialLocalMarkPayload:initial,applyDbMarks(rev){
   current.state.marks=rev.entries.map(x=>({horseName:x.horse_name,mark:applyWrongMark?'▲':x.mark}));
   if(!applyWrongMark)window.dispatchEvent(new Event('labo-marks-changed'));
  },fetcher,scheduleDelay:0});
 return {elements,window,current,calls,fetcher};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,30));
test('token mismatch allows connection retry but never sends marks',async()=>{
 const h=harness({tokenMatches:false});await tick();
 await h.elements.get('ownerMarkLogin').click();await tick();
 assert.equal(h.elements.get('ownerMarkSave').disabled,false);
 await h.elements.get('ownerMarkSave').click();
 assert.match(h.elements.get('ownerMarkDbStatus').textContent,/一致しません/);
 assert.equal(h.calls.filter(c=>c.url==='/v1/lab/user-marks/save').length,0);
});
test('unconfigured auth never sends formal DB writes',async()=>{
 const h=harness({configured:false});
 await tick();
 assert.equal(h.elements.get('ownerMarkSave').disabled,true);
 assert.equal(h.calls.filter(c=>c.url.includes('/save')).length,0);
 assert.match(h.elements.get('ownerMarkDbStatus').textContent,/未完了/);
});
test('login checks token parity without writing, then autosaves a local draft after DB confirms no revision',async()=>{
 const h=harness();await tick();
 h.elements.get('ownerMarkPassword').value='test-passphrase';
 await h.elements.get('ownerMarkLogin').click();
 const writes=()=>h.calls.filter(c=>c.url==='/v1/lab/user-marks/save');
 assert.equal(writes().length,0);
 assert.ok(h.calls.some(c=>c.url==='/v1/lab/user-mark-session'&&c.body?.action==='check-worker-write-token'));
 await tick();
 assert.equal(writes().length,1);
 assert.match(h.elements.get('ownerMarkDbStatus').textContent,/DB保存済み・再照合成功/);
 h.current.state.marks[0].mark='▲';
 h.window.dispatchEvent(new Event('labo-marks-changed'));
 assert.match(h.elements.get('ownerMarkDbStatus').textContent,/自動保存/);
 await tick();
 assert.equal(writes().length,2);
 assert.match(h.elements.get('ownerMarkDbStatus').textContent,/DB保存済み・再照合成功/);
 await h.elements.get('ownerMarkSave').click();await tick();
 assert.equal(writes().length,2);
});

test('login never autosaves over a different existing DB revision',async()=>{
 const h=harness({existing:true});
 h.current.state.marks[0].mark='▲';
 await tick();
 await h.elements.get('ownerMarkLogin').click();await tick();
 const writes=()=>h.calls.filter(c=>c.url==='/v1/lab/user-marks/save');
 assert.equal(writes().length,0);
 assert.match(h.elements.get('ownerMarkDbStatus').textContent,/既存DB記録を上書きせず停止/);
 await h.elements.get('ownerMarkSave').click();await tick();
 assert.equal(writes().length,1);
});
test('DB restore does not generate an additional revision',async()=>{
 const h=harness({existing:true});await tick();
 await h.elements.get('ownerMarkLogin').click();await tick();
 const count=()=>h.calls.filter(c=>c.url==='/v1/lab/user-marks/save').length;
 assert.equal(count(),0);
 await h.elements.get('ownerMarkRestore').click();await tick();
 assert.equal(count(),0);
 assert.match(h.elements.get('ownerMarkDbStatus').textContent,/復元しました/);
});
test('initial picks transmit verified horse numbers only after official roster verification',async()=>{
 const h=harness({phase:'initial',verified:true});await tick();
 await h.elements.get('ownerMarkLogin').click();await tick();
 await h.elements.get('ownerMarkSave').click();await tick();
 const save=h.calls.find(c=>c.url==='/v1/lab/user-marks/save');
 assert.equal(save.body.phase,'initial');
 assert.deepEqual(save.body.marks.map(m=>m.horseNo),[1,2]);
});

test('re-login with identical persisted revision skips immutable DB write',async()=>{
 const h=harness({existing:true});await tick();
 await h.elements.get('ownerMarkLogin').click();await tick();
 await h.elements.get('ownerMarkSave').click();await tick();
 assert.equal(h.calls.filter(c=>c.url==='/v1/lab/user-marks/save').length,0);
 assert.match(h.elements.get('ownerMarkDbStatus').textContent,/既存履歴と一致/);
});
test('restored unchanged saved marks are not written as a fresh revision',async()=>{
 const h=harness({existing:true});await tick();
 await h.elements.get('ownerMarkLogin').click();await tick();
 await h.elements.get('ownerMarkSave').click();await tick();
 await h.elements.get('ownerMarkRestore').click();await tick();
 assert.equal(h.calls.filter(c=>c.url==='/v1/lab/user-marks/save').length,0);
 assert.match(h.elements.get('ownerMarkDbStatus').textContent,/復元しました/);
});


test('restore refuses saved marks from a different race even when the phase matches',async()=>{
 const h=harness({existing:true,readRaceKey:'2026-10-11:京都:11'});await tick();
 await h.elements.get('ownerMarkLogin').click();await tick();
 const before=JSON.stringify(h.current.state.marks);
 await h.elements.get('ownerMarkRestore').click();await tick();
 assert.equal(JSON.stringify(h.current.state.marks),before);
 assert.match(h.elements.get('ownerMarkDbStatus').textContent,/別レース/);
 assert.equal(h.calls.filter(c=>c.url==='/v1/lab/user-marks/save').length,0);
});

test('restore aborts rather than overwriting an edit made during a slow DB response',async()=>{
 const h=harness({existing:true,onRead:async({current,calls})=>{
  // The first history request is the login reconciliation; edit only during the later restore request.
  if(calls.filter(c=>c.url.startsWith('/v1/lab/user-marks?')).length>=2){
   current.state.marks[0].mark='▲';
  }
 }});await tick();
 await h.elements.get('ownerMarkLogin').click();await tick();
 await h.elements.get('ownerMarkRestore').click();await tick();
 assert.equal(h.current.state.marks[0].mark,'▲');
 assert.match(h.elements.get('ownerMarkDbStatus').textContent,/取得中に.*変更/);
 assert.equal(h.calls.filter(c=>c.url==='/v1/lab/user-marks/save').length,0);
});

test('restore never labels a mismatched UI application as DB saved',async()=>{
 const h=harness({existing:true,applyWrongMark:true});await tick();
 await h.elements.get('ownerMarkLogin').click();await tick();
 await h.elements.get('ownerMarkRestore').click();await tick();
 assert.equal(h.current.state.marks[0].mark,'▲');
 assert.match(h.elements.get('ownerMarkDbStatus').textContent,/復元後の印がDB保存履歴と一致しません/);
 assert.doesNotMatch(h.elements.get('ownerMarkDbStatus').textContent,/DB保存済み・再照合成功/);
 assert.equal(h.calls.filter(c=>c.url==='/v1/lab/user-marks/save').length,0);
});

test('save retries a failed token check and persists only after successful parity',async()=>{
 let matches=false;
 const h=harness({tokenMatches:()=>matches});await tick();
 await h.elements.get('ownerMarkLogin').click();await tick();
 await h.elements.get('ownerMarkRestore').click();await tick();
 assert.match(h.elements.get('ownerMarkDbStatus').textContent,/保存できない理由.*保存トークンが一致しません/);
 assert.equal(h.calls.filter(c=>c.url==='/v1/lab/user-marks/save').length,0);
 matches=true;
 await h.elements.get('ownerMarkSave').click();await tick();
 assert.equal(h.calls.filter(c=>c.url==='/v1/lab/user-marks/save').length,1);
 assert.match(h.elements.get('ownerMarkDbStatus').textContent,/DB保存済み・再照合成功/);
});

test('saved marks compare to official results read-only and retrospective marks never receive pre-race credit',async()=>{
 const h=harness({existing:true});await tick();await h.elements.get('ownerMarkLogin').click();await tick();
 const writes=h.calls.filter(x=>x.method==='POST'&&x.url.includes('/save')).length;
 await h.elements.get('ownerMarkReview').click();
 const text=h.elements.get('ownerMarkReviewReport').textContent;
 assert.match(text,/事後にDB保存/);assert.match(text,/事前予想の精度実績には使いません/);
 assert.match(text,/◎ 馬A → 2着/);assert.match(text,/○ 馬B → 1着/);
 assert.equal(h.calls.filter(x=>x.method==='POST'&&x.url.includes('/save')).length,writes);
});
test('result comparison rejects a different race, duplicated identities or unverified mark integrity',async()=>{
 for(const options of [{resultRaceKey:'2026-10-11:京都:11'},{resultRows:[{horseNo:1,horseName:'馬A',finishPosition:1},{horseNo:1,horseName:'馬B',finishPosition:2}]},{provenance:{status:'unverified',integrityVerified:false}}]){
  const h=harness({existing:true,...options});await tick();await h.elements.get('ownerMarkLogin').click();await tick();await h.elements.get('ownerMarkReview').click();
  assert.match(h.elements.get('ownerMarkReviewReport').textContent,/照合を保留/);
  assert.equal(h.calls.filter(x=>x.url.includes('/save')).length,0);
 }
});
test('a changed form during result loading cannot be reported as current comparison',async()=>{
 const h=harness({existing:true,onResult:({current})=>{current.state.marks[0].mark='▲';}});
 await tick();await h.elements.get('ownerMarkLogin').click();await tick();await h.elements.get('ownerMarkReview').click();
 assert.match(h.elements.get('ownerMarkReviewReport').textContent,/取得中に.*変わりました/);
});
