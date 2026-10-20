import test from 'node:test';import assert from 'node:assert/strict';
import {renderAutomaticPrediction,verifyAutomaticPrediction} from '../src/automatic-prediction-view.js';
const target={date:'2026-10-25',venue:'京都',raceNo:11};
async function payload(change){const snapshot={race:{...target,raceKey:'2026-10-25:京都:11',runnerCount:2},savedAt:'2026-10-23T00:00:00Z',modelVersion:'recent-three',card:[{horse_no:1,horse_name:'<script>bad</script>',frame_no:1},{horse_no:2,horse_name:'Horse2',frame_no:2}],runners:[{horseNo:1,horseName:'<script>bad</script>',rank:1,score:80,mark:'◎'},{horseNo:2,horseName:'Horse2',rank:2,score:70,mark:'○'}],guardrails:{humanMarksUsed:false,targetResultUsed:false,immutable:true}};change?.(snapshot);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(snapshot)))),x=>x.toString(16).padStart(2,'0')).join('');return{ok:true,available:true,integrityVerified:true,snapshotSha256:hash,snapshot};}
test('only browser-verified saved contents are rendered and names are escaped',async()=>{
 assert.match(renderAutomaticPrediction({available:false}),/未保存/);const data=await payload();assert.match(renderAutomaticPrediction(data),/確認できません/);
 const verified=await verifyAutomaticPrediction(data,target),html=renderAutomaticPrediction(verified);assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/画面ハッシュ照合済み/);assert.match(html,new RegExp(data.snapshotSha256));assert.match(html,/data-auto-rank="1" data-auto-score="80" data-auto-mark="◎"/);
});
test('failed/unknown API, corrupt contents, wrong target and unavailable crypto cannot display verified predictions',async()=>{
 const data=await payload();await assert.rejects(verifyAutomaticPrediction({...data,ok:false},target));await assert.rejects(verifyAutomaticPrediction({ok:true},target));await assert.rejects(verifyAutomaticPrediction({...data,snapshotSha256:'0'.repeat(64)},target));await assert.rejects(verifyAutomaticPrediction(data,{...target,venue:'東京'}));await assert.rejects(verifyAutomaticPrediction(data,target,{}));assert.deepEqual(await verifyAutomaticPrediction({ok:true,available:false},target),{ok:true,available:false});
});
test('even checksum-valid snapshots with incomplete or inconsistent runners are rejected',async()=>{
 for(const change of [s=>s.runners.pop(),s=>s.card[0].frame_no=null,s=>s.runners[1].horseNo=1,s=>s.runners[0].rank=0,s=>s.runners[0].score=NaN,s=>s.runners[0].mark='○',s=>s.guardrails.humanMarksUsed=true,s=>s.savedAt='bad',s=>s.card[1].horse_name='Different'])await assert.rejects(verifyAutomaticPrediction(await payload(change),target));
});
