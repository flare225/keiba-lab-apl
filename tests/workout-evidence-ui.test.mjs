import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import app,{VERSION} from '../src/index-v1.21.js';
import {renderWorkoutEvidence,netkeibaWorkoutReference} from '../src/workout-evidence-ui.js';

test('unconnected workout feed is labeled not acquired, without invented timings or ranking',()=>{
 const d={ok:true,stage:'not-collected',collectionConfigured:false,modelIncorporated:false,coverage:{official:2,declared:2,withWorkout:0,workoutRows:0},runners:[
  {horseNo:1,frameNo:1,horseName:'サンプルA',workouts:[],state:'unavailable'},
  {horseNo:2,frameNo:2,horseName:'サンプルB',workouts:[],state:'unavailable'}]};
 const result=renderWorkoutEvidence(d);
 assert.match(result.status,/追い切りデータ未取得/);
 assert.match(result.detail,/自動取得元は未接続/);
 assert.match(result.detail,/予想印・学習にはまだ自動反映していません/);
 assert.match(result.detail,/サンプルA/);
 assert.doesNotMatch(result.detail,/50\.0秒|JRA-VAN接続済み/);
});
test('when a legally supplied 4F/1F is saved it displays source and exact times without calling it predictive score',()=>{
 const r=renderWorkoutEvidence({ok:true,stage:'stored',collectionConfigured:true,coverage:{official:2,declared:2,withWorkout:1,workoutRows:1},runners:[
  {horseNo:3,frameNo:2,horseName:'テスト3',workouts:[{date:'2026-10-08',course:'坂路',fourF:52.3,lastF:12.7,sourceName:'Licensed Source'}]},
  {horseNo:4,frameNo:2,horseName:'テスト4',workouts:[]}
 ]});
 assert.match(r.status,/1\/2頭・計1件/);
 assert.match(r.detail,/52.3秒/);assert.match(r.detail,/12.7秒/);assert.match(r.detail,/Licensed Source/);
 assert.match(r.detail,/テスト4/);assert.match(r.detail,/追い切り未取得/);
 assert.doesNotMatch(r.detail,/予想点へ反映済み/);
});
test('source/horse display escapes HTML and API failures do not become fake empty rows',()=>{
 const r=renderWorkoutEvidence({ok:true,stage:'stored',collectionConfigured:true,coverage:{official:1,withWorkout:1,workoutRows:1},runners:[
 {horseNo:1,frameNo:1,horseName:'<img src=x onerror=alert(1)>',workouts:[{date:'2026-10-08',course:'坂路',fourF:52,lastF:12,sourceName:'<svg>'}]}]});
 assert.match(r.detail,/&lt;img/);assert.match(r.detail,/&lt;svg&gt;/);
 assert.doesNotMatch(r.detail,/<svg>|<img src/);
 const fail=renderWorkoutEvidence({ok:false,error:'backend not deployed'});
 assert.match(fail.status,/確認できません/);
 assert.doesNotMatch(fail.detail,/0頭/);
});
test('browser includes linked race/marks workout readout and updater with all scripts parse',async()=>{
 const html=await(await app.fetch(new Request('https://test.example/'))).text();
 assert.match(html,/id="workoutStatus"/);
 assert.match(html,/id="workoutDetails"/);
 assert.match(html,/id="workoutRefresh"/);
 assert.match(html,/id="workoutMarksStatus"/);
 assert.match(html,/mountWorkoutEvidence/);
 assert.match(html,/\/v1\/lab\/workouts/);
 assert.match(html,/追い切り・調教タイム/);
 assert.match(html,/追い切りAPI公開待ち/);
 for(const [,script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(script);
 assert.equal((await(await app.fetch(new Request('https://test.example/health'))).json()).version,VERSION);
});

test('netkeiba workout references match only verified dated Tokyo 11R targets',()=>{
 const saudi=netkeibaWorkoutReference({date:'2026-10-10',venue:'東京',raceNo:11});
 const ireland=netkeibaWorkoutReference({date:'2026-10-11',venue:'東京',raceNo:11});
 assert.deepEqual(saudi,{url:'https://race.netkeiba.com/race/oikiri.html?race_id=202605040311',label:'サウジアラビアRCの追い切りを見る（netkeiba）'});
 assert.deepEqual(ireland,{url:'https://race.netkeiba.com/race/oikiri.html?race_id=202605040411',label:'アイルランドTの追い切りを見る（netkeiba）'});
 assert.equal(netkeibaWorkoutReference({date:'2026-10-10',venue:'京都',raceNo:11}),null);
 assert.equal(netkeibaWorkoutReference({date:'2026-10-10',venue:'東京',raceNo:10}),null);
 assert.equal(netkeibaWorkoutReference({date:'2026-10-12',venue:'東京',raceNo:11}),null);
 assert.equal(netkeibaWorkoutReference(null),null);
});
test('browser offers external, safe workout links without claiming netkeiba data was imported',async()=>{
 const html=await(await app.fetch(new Request('https://test.example/'))).text();
 for(const id of ['workoutReferenceLink','workoutMarksReferenceLink']) {
  assert.match(html,new RegExp('<a id="'+id+'"[^>]+target="_blank" rel="noopener noreferrer" hidden'));
 }
 assert.match(html,/外部サイトでの閲覧用です。LABOへの自動取得・予想点への反映ではありません/);
 assert.match(html,/netkeibaWorkoutReference/);
 assert.match(html,/netkeiba-workout-reference-links/);
 for(const [,script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(script);
});
