import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {readFileSync} from 'node:fs';
import app,{VERSION} from '../src/index-v1.21.js';
import {verifiedMarkPayload,initialLocalMarkPayload,draftMarkMatch,sameDbMarks,summarizeDbRevision,localMarkReceipt} from '../src/mark-save-state-v1.24.js';
import {parseMarkHistoryQuery,handleMarkHistory} from '../src/mark-storage-proxy-v1.24.js';
import readRoute from '../api/lab-mark-read.js';
const target={date:'2026-10-10',venue:'東京',raceNo:11};
const state={phase:'final',track:'良',rosterVerified:true,roster:['馬A','馬B'],
 rosterNumbers:{馬A:{horseNo:1,frameNo:1,verified:true},馬B:{horseNo:2,frameNo:2,verified:true}},
 marks:[{horseName:'馬A',mark:'◎'},{horseName:'馬B',mark:'○'}]};
const p=verifiedMarkPayload(target,state);
function response(){const data={code:200,headers:{},value:null};const res={setHeader(k,v){data.headers[k]=v;return res;},status(i){data.code=i;return res;},json(x){data.value=x;return res;}};return{data,res};}
test('final mark local receipt requires verified JRA roster and no fabricated frame/horse numbers',()=>{
 assert.equal(p.phase,'final');assert.equal(p.marks.length,2);
 assert.deepEqual(p.marks[0],{horseNo:1,horseName:'馬A',mark:'◎'});
 assert.throws(()=>verifiedMarkPayload(target,{...state,track:''}),/馬場想定/);
 assert.throws(()=>verifiedMarkPayload(target,{...state,rosterVerified:false}),/正式出馬表/);
 assert.throws(()=>verifiedMarkPayload(target,{...state,marks:[{horseName:'別馬',mark:'◎'}]}),/一致/);
 assert.throws(()=>verifiedMarkPayload(target,{...state,marks:[{horseName:'馬A',mark:'◎'},{horseName:'馬B',mark:'◎'}]}),/重複/);
 assert.throws(()=>verifiedMarkPayload(target,{...state,phase:'initial'}),/枠順後/);
});
test('saved DB revisions match only when horse, mark, track and phase all agree',()=>{
 const saved={phase:'final',revisionNo:2,revisionId:'r2',trackCondition:'良',entries:[
  {horse_no:2,horse_name:'馬B',mark:'○'},{horse_no:1,horse_name:'馬A',mark:'◎'}]};
 assert.equal(sameDbMarks(p,saved),true);
 assert.equal(sameDbMarks(p,{...saved,entries:[{horse_no:2,horse_name:'馬B',mark:'消'},{horse_no:1,horse_name:'馬A',mark:'◎'}]}),false);
 assert.equal(sameDbMarks(p,{...saved,trackCondition:'重'}),false);
 assert.equal(summarizeDbRevision({ok:true,latest:[saved]},'final').status,'saved');
 assert.equal(summarizeDbRevision({ok:true,latest:[]},'final').status,'none');
});
test('local receipt is explicitly not a DB write or proof of pre-race lock',()=>{
 const receipt=localMarkReceipt({payload:p,rosterIdentity:'1:1:馬A|2:2:馬B',localRevision:1,recordedAt:'2026-10-10T07:00:00Z'});
 assert.equal(receipt.localRevision,1);
 assert.equal(receipt.recordedAt,'2026-10-10T07:00:00Z');
 assert.equal(receipt.revisionId,undefined);
});
test('published Vercel marks route is read-only; even POST to save is denied',async()=>{
 assert.equal(typeof readRoute,'function');
 assert.match(parseMarkHistoryQuery({date:'2026-10-10',venue:'東京',race_no:'11',phase:'final'}).toString(),/phase=final/);
 assert.match(parseMarkHistoryQuery({date:'2026-10-10',venue:'東京',race_no:'11',phase:'initial'}).toString(),/phase=initial/);
 const denied=response();
 await handleMarkHistory({method:'POST',body:p,headers:{authorization:'Bearer unused'}},denied.res);
 assert.equal(denied.data.code,405);assert.equal(denied.data.value.ok,false);
 const allowed=response();
 await handleMarkHistory({method:'GET',query:{date:'2026-10-10',venue:'東京',race_no:'11',phase:'final'}},allowed.res,async(url,opts)=>{
  assert.match(url,/phase=final/);assert.equal(opts.method,'GET');
  assert.equal('headers' in opts,false);
  return new Response(JSON.stringify({ok:true,stage:'user-mark-history',latest:[]}),{headers:{'content-type':'application/json'}});
 });
 assert.equal(allowed.data.code,200);
 const cfg=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.ok(cfg.rewrites.find(x=>x.source==='/v1/lab/user-marks'&&x.destination==='/api/lab-mark-read'));
 assert.ok(cfg.rewrites.find(x=>x.source==='/v1/lab/user-marks/save'&&x.destination==='/api/lab-mark-save'));
});
test('browser displays local receipt, remote history, and authentication pending without secret entry',async()=>{
 const html=await(await app.fetch(new Request('https://example.com/'))).text();
 assert.ok(html.includes("markSaveCard.id='userMarkSaveCard'"));
 for(const id of ['userMarkDbState','userMarkDraftState','userMarkLocalState','userMarkSaveLocal','userMarkSaveCopy','userMarkRefreshDb'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.doesNotMatch(html,/id="userMarkWriteKey"|id="userMarkSaveDb"/);
 assert.match(html,/管理者用秘密キーの入力は不要です/);
 assert.match(html,/自動下書き（この端末）、日時付きの端末控え、正式DBの保存は3つとも別/);
 assert.match(html,/保存日時がレース後なら事後記録/);
 assert.match(html,/DB保存・レース前LOCKを証明するものではありません/);
 for(const [,script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(script);
 const health=await(await app.fetch(new Request('https://example.com/health'))).json();
 assert.equal(health.version,VERSION);
 assert.ok(health.features.includes('verified-mark-revision-status'));
 assert.ok(health.features.includes('mark-save-authentication-pending'));
});

test('initial marks can be recorded as explicitly local-only receipts without phantom horse numbers',()=>{
 const initial=initialLocalMarkPayload(target,{...state,phase:'initial',rosterVerified:false,track:'',marks:[{horseName:'馬A',mark:'◎'},{horseName:'馬B',mark:'○'}]});
 assert.equal(initial.phase,'initial');
 assert.equal(initial.localOnly,true);
 assert.deepEqual(initial.marks,[{horseName:'馬A',mark:'◎'},{horseName:'馬B',mark:'○'}]);
 assert.equal('confirm' in initial,false);
 assert.equal('horseNo' in initial.marks[0],false);
 assert.throws(()=>initialLocalMarkPayload(target,{...state,phase:'initial',roster:[],marks:[{horseName:'馬A',mark:'◎'}]}),/出走馬一覧/);
 assert.throws(()=>initialLocalMarkPayload(target,{...state,phase:'initial',marks:[{horseName:'偽名',mark:'◎'}]}),/一致/);
});
test('saved local draft verifies same picks rather than claiming an old draft is current',()=>{
 const current=[{horseName:'馬A',mark:'◎'},{horseName:'馬B',mark:'○'}];
 assert.equal(draftMarkMatch({marks:{馬A:'◎',馬B:'○'}},current),true);
 assert.equal(draftMarkMatch({marks:{馬A:'▲',馬B:'○'}},current),false);
 assert.equal(draftMarkMatch({marks:[{horse:'馬A',mark:'◎'},{horse:'馬B',mark:'○'}]},current),true);
 assert.equal(draftMarkMatch({marks:[{horse:'馬A',mark:'◎'},{horse:'馬B',mark:'▲'}]},current),false);
});
