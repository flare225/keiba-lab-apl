import test from 'node:test';import assert from 'node:assert/strict';
import {renderAutomaticPrediction} from '../src/automatic-prediction-view.js';
test('only verified persisted forecasts are rendered, with escaped names and evidence',()=>{
 assert.match(renderAutomaticPrediction({available:false}),/未保存/);
 assert.match(renderAutomaticPrediction({available:true,integrityVerified:false}),/確認できません/);
 const html=renderAutomaticPrediction({available:true,integrityVerified:true,snapshotSha256:'abc',snapshot:{savedAt:'2026-10-23T00:00:00Z',modelVersion:'recent-three',runners:[{horseNo:1,horseName:'<script>bad</script>',rank:1,score:80,mark:'◎'}]}});
 assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/ユーザー印は任意/);assert.match(html,/abc/);
});
