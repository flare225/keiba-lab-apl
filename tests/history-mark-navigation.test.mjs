import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureRaceTarget} from '../src/index-v1.12.js';
import app from '../src/index-v1.21.js';
test('archived race can join the selector without claiming a verified roster',()=>{
 const rows=[{date:'2026-10-17',venue:'東京',raceNo:11,cardComplete:true}];
 const past={date:'2026-10-04',venue:'京都',raceNo:11,raceName:'京都大賞典'};
 assert.equal(ensureRaceTarget(rows,past),1);assert.equal(rows[1].cardComplete,false);assert.equal(rows[1].presetOnly,true);
 assert.equal(ensureRaceTarget(rows,past),1);assert.equal(rows.length,2);
 const official=rows[0];assert.equal(ensureRaceTarget(rows,{...official,raceName:'変更候補'}),0);assert.equal(rows[0],official);
});
test('remembered history identities survive discovery omissions but invalid dates and venues are rejected',()=>{
 const rows=[];assert.equal(ensureRaceTarget(rows,{date:'2026-10-04',venue:'東京',raceNo:11}),0);
 for(const r of [{date:'2026-02-30',venue:'東京',raceNo:11},{date:'2026-10-04',venue:'別会場',raceNo:11},{date:'2026-10-04',venue:'東京',raceNo:13}])assert.equal(ensureRaceTarget(rows,r),-1);
 assert.equal(rows.length,1);
});
test('published page offers a history-to-mark shortcut and restores a discovery-missing selection',async()=>{
 const html=await(await app.fetch(new Request('https://test/'))).text();
 assert.match(html,/このレースの印・LABO比較を開く/);assert.match(html,/if\(saved\?\.date===today\)ensureRaceTarget\(rs,saved\)/);
});
