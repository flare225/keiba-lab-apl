import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {readFileSync} from 'node:fs';
import app,{VERSION} from '../src/index-v1.21.js';
import {verifiedMarkPayload,sameDbMarks,summarizeDbRevision,localMarkReceipt} from '../src/mark-save-state-v1.24.js';
import {markWriteBody,handleMarkStorage} from '../src/mark-storage-proxy-v1.24.js';
import readRoute from '../api/lab-mark-read.js';
import writeRoute from '../api/lab-mark-write.js';
const target={date:'2026-10-10',venue:'東京',raceNo:11};
const state={phase:'final',track:'良',rosterVerified:true,roster:['馬A','馬B'],
 rosterNumbers:{馬A:{horseNo:1,frameNo:1,verified:true},馬B:{horseNo:2,frameNo:2,verified:true}},
 marks:[{horseName:'馬A',mark:'◎'},{horseName:'馬B',mark:'○'}]};
const p=verifiedMarkPayload(target,state);
function response(){const data={code:200,headers:{},value:null};const res={setHeader(k,v){data.headers[k]=v;return res;},status(i){data.code=i;return res;},json(x){data.value=x;return res;}};return{data,res};}
test('final marks require verified official roster, explicit going and unique valid marks',()=>{
 assert.deepEqual(p,{...target,phase:'final',marks:[{horseNo:1,horseName:'馬A',mark:'◎'},{horseNo:2,horseName:'馬B',mark:'○'}],track:'良',confirm:'SAVE'});
 assert.throws(()=>verifiedMarkPayload(target,{...state,track:''}),/馬場想定/);
 assert.throws(()=>verifiedMarkPayload(target,{...state,rosterVerified:false}),/正式出馬表/);
 assert.throws(()=>verifiedMarkPayload(target,{...state,marks:[{horseName:'別の馬',mark:'◎'}]}),/一致/);
 assert.throws(()=>verifiedMarkPayload(target,{...state,marks:[{horseName:'馬A',mark:'◎'},{horseName:'馬A',mark:'○'}]}),/一致/);
 assert.throws(()=>verifiedMarkPayload(target,{...state,marks:[{horseName:'馬A',mark:'◎'},{horseName:'馬B',mark:'◎'}]}),/重複/);
 assert.throws(()=>verifiedMarkPayload(target,{...state,rosterNumbers:{...state.rosterNumbers,馬A:{horseNo:2,frameNo:1,verified:true}}}),/照合/);
 assert.deepEqual(verifiedMarkPayload(target,{...state,phase:'post_draw',track:''}).phase,'post_draw');
 assert.throws(()=>verifiedMarkPayload(target,{...state,phase:'initial'}),/枠順後/);
});
test('a DB save is only verified when revision ID, phase, mark identities and track match',()=>{
 const stored={phase:'final',revisionNo:2,revisionId:'r-2',trackCondition:'良',entries:[{horse_no:2,horse_name:'馬B',mark:'○'},{horse_no:1,horse_name:'馬A',mark:'◎'}]};
 assert.equal(sameDbMarks(p,stored),true);
 assert.equal(sameDbMarks(p,{...stored,entries:[{horse_no:2,horse_name:'馬B',mark:'▲'},{horse_no:1,horse_name:'馬A',mark:'◎'}]}),false);
 assert.equal(sameDbMarks(p,{...stored,trackCondition:'稍重'}),false);
 assert.equal(sameDbMarks(p,{...stored,revisionNo:0}),false);
 assert.equal(summarizeDbRevision({ok:true,latest:[stored]},'final').status,'saved');
 assert.equal(summarizeDbRevision({ok:true,latest:[]},'final').status,'none');
 assert.equal(summarizeDbRevision({ok:false},'final').status,'unavailable');
});
test('an on-device receipt has timestamp/revision but is distinct from DB confirmation',()=>{
 const receipt=localMarkReceipt({payload:p,rosterIdentity:'1:1:馬A|2:2:馬B',localRevision:1,recordedAt:'2026-10-10T07:00:00Z'});
 assert.equal(receipt.localRevision,1);assert.equal(receipt.recordedAt,'2026-10-10T07:00:00Z');
 assert.equal('revisionId' in receipt,false);
 assert.throws(()=>localMarkReceipt({payload:p,rosterIdentity:'',localRevision:0,recordedAt:'x'}),/作成できません/);
});
test('read and write routes have strict allowlists; write demands bearer and SAVE',async()=>{
 assert.equal(typeof readRoute,'function');assert.equal(typeof writeRoute,'function');
 assert.deepEqual(markWriteBody(p),p);
 assert.throws(()=>markWriteBody({...p,confirm:'CHECK'}),/確認/);
 assert.throws(()=>markWriteBody({...p,marks:[{horseNo:1,horseName:'馬A',mark:'◎'},{horseNo:1,horseName:'馬B',mark:'○'}]}),/重複/);
 const missing=response();
 await handleMarkStorage({method:'POST',headers:{},body:p},missing.res,'write');
 assert.equal(missing.data.code,401);
 assert.deepEqual(missing.data.value.ok,false);
 const wrongMethod=response();
 await handleMarkStorage({method:'GET',query:{}},wrongMethod.res,'write');
 assert.equal(wrongMethod.data.code,405);
});
test('proxy forwards ephemeral authorization to fixed endpoint and returns backend error verbatim',async()=>{
 let observed;
 const mock=async (url,options)=>{observed={url,options};return new Response(JSON.stringify({ok:true,revisionNo:3,revisionId:'r3',stage:'user-mark-saved-and-crosschecked'}),{headers:{'content-type':'application/json'}});};
 const result=response();
 await handleMarkStorage({method:'POST',headers:{authorization:'Bearer user-owner-key-123'},body:p},result.res,'write',mock);
 assert.equal(result.data.code,200);
 assert.equal(result.data.value.revisionNo,3);
 assert.equal(observed.url,'https://keiba-lab-api.sekai-no-bancyou.workers.dev/v1/lab/user-marks');
 assert.equal(observed.options.headers.authorization,'Bearer user-owner-key-123');
 assert.deepEqual(JSON.parse(observed.options.body),p);
 const unauth=response();
 await handleMarkStorage({method:'POST',headers:{authorization:'Bearer user-owner-key-123'},body:p},unauth.res,'write',
 async()=>new Response(JSON.stringify({ok:false,error:'writes disabled'}),{status:503,headers:{'content-type':'application/json'}}));
 assert.equal(unauth.data.code,503);assert.equal(unauth.data.value.ok,false);
 const get=response();let readUrl='';
 await handleMarkStorage({method:'GET',query:{date:'2026-10-10',venue:'東京',race_no:'11',phase:'final'}},get.res,'read',
 async(url,opt)=>{readUrl=url;assert.equal(opt.method,'GET');return new Response(JSON.stringify({ok:true,latest:[]}),{headers:{'content-type':'application/json'}});});
 assert.match(readUrl,/phase=final/);assert.equal(get.data.code,200);
});
test('live browser has explicit DB state, password-only save and local receipt with nonprelock notice',async()=>{
 const html=await(await app.fetch(new Request('https://example.com/'))).text();
 assert.match(html,/markSaveCard\\.id='userMarkSaveCard'/);
 for(const id of ['userMarkDbState','userMarkLocalState','userMarkSaveLocal','userMarkSaveDb','userMarkWriteKey','userMarkSaveCopy','userMarkRefreshDb']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/端末内の控えと、認証付きの正式DB保存は別/);
 assert.match(html,/保存日時がレース後なら事後記録/);
 assert.match(html,/DBへ保存し、書き込み結果を照合/);
 assert.match(html,/user-marks\/save/);
 assert.match(html,/new URLSearchParams/);
 for(const [,src] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(src);
 const health=await(await app.fetch(new Request('https://example.com/health'))).json();
 assert.equal(health.version,VERSION);
 assert.ok(health.features.includes('verified-mark-revision-status'));
 assert.ok(health.features.includes('authenticated-mark-save'));
 const vercel=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.ok(vercel.rewrites.find(x=>x.source==='/v1/lab/user-marks/save'));
 assert.ok(vercel.rewrites.find(x=>x.source==='/v1/lab/user-marks'));
});
