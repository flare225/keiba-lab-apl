import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import app,{VERSION} from '../src/index-v1.21.js';
import {WORKOUT_IMPRESSIONS,getOfficialWorkoutRoster,workoutImpressionSummary} from '../src/workout-impression-v1.23.js';

const runners=[{horse_no:2,frame_no:2,horse_name:'東京馬B'},{horse_no:1,frame_no:1,horse_name:'東京馬A'}];
const gate={ok:true,ops:{cardComplete:true}};
test('workout impressions only accept sequential official verified horses, never provisional names',()=>{
 assert.deepEqual(getOfficialWorkoutRoster({ok:true,count:2,data:runners},gate),[
 {horseNo:1,frameNo:1,horseName:'東京馬A'},{horseNo:2,frameNo:2,horseName:'東京馬B'}
 ]);
 assert.equal(getOfficialWorkoutRoster({ok:true,count:2,data:runners},{ok:true,ops:{cardComplete:false}}),null);
 assert.equal(getOfficialWorkoutRoster({ok:true,count:2,data:[runners[0],runners[0]]},gate),null);
 assert.equal(getOfficialWorkoutRoster({ok:true,count:2,data:[{...runners[0],frame_no:null},runners[1]]},gate),null);
 assert.equal(getOfficialWorkoutRoster({ok:true,count:3,data:runners},gate),null);
 assert.equal(getOfficialWorkoutRoster({ok:true,count:2,data:[]},gate),null);
});
test('a personal workout impression is a separate per-horse count, not score or source timing',()=>{
 assert.deepEqual(WORKOUT_IMPRESSIONS,['良化','順調','要確認']);
 assert.deepEqual(workoutImpressionSummary([{horseNo:1},{horseNo:2}],{'1':'良化','2':'要確認','3':'順調'}),{
 total:2,marked:2,counts:{'良化':1,'順調':0,'要確認':1}
 });
});
test('browser has working impression controls tied to race change, local draft and manual copy without automatic model scoring',async()=>{
 const html=await(await app.fetch(new Request('https://example.test/'))).text();
 for(const id of ['workoutImpressionCard','workoutImpressionList','workoutImpressionSummary','workoutImpressionStatus','workoutImpressionCopy','workoutImpressionExport'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/keiba-labo:workout-impressions:v1:/);
 assert.match(html,/data-impression-no/);
 assert.match(html,/labo-target-change/);
 assert.match(html,/getOfficialWorkoutRoster/);
 assert.match(html,/netkeibaで追い切りを見ながら/);
 assert.match(html,/LABOスコアは変更しません/);
 for(const [,script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(script);
 const health=await(await app.fetch(new Request('https://example.test/health'))).json();
 assert.equal(health.version,VERSION);
 assert.ok(health.features.includes('one-tap-workout-impressions'));
});
