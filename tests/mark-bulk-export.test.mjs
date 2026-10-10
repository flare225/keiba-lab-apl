import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import app,{VERSION} from '../src/index-v1.21.js';
import {collectSavedRaceMarks,formatBulkRaceMarks} from '../src/mark-bulk-export-v1.24.js';
function storage(data){
 const entries=Object.entries(data);
 return {length:entries.length,key:i=>entries[i]?.[0]??null,getItem:k=>data[k]??null};
}
const prefix='keiba-labo:expected-marks:v1:';
const data={
 [prefix+'2026-10-11|東京|11']:JSON.stringify({marks:{'アイルランド馬A':'◎'},roster:{'アイルランド馬A':{horseNo:3,frameNo:2,verified:true}},officialVerified:true,savedAt:'2026-10-10T09:30:00.000Z'}),
 [prefix+'2026-10-11|東京|11|final']:JSON.stringify({marks:{'アイルランド馬A':'○','アイルランド馬B':'▲'},roster:{'アイルランド馬A':{horseNo:3,frameNo:2,verified:true},'アイルランド馬B':{horseNo:12,frameNo:6,verified:true}},officialVerified:true,savedAt:'2026-10-10T09:40:00.000Z',track:'良'}),
 [prefix+'2026-10-11|京都|11']:JSON.stringify({marks:{'京都馬':'◎'},roster:{'京都馬':{horseNo:9,frameNo:5,verified:true}},officialVerified:true,savedAt:'2026-10-10T10:00:00.000Z'}),
 [prefix+'2026-10-10|東京|11']:JSON.stringify({marks:{'昨日の馬':'◎'},roster:{'昨日の馬':{horseNo:1,frameNo:1,verified:true}},officialVerified:true}),
 ['keiba-labo:mark-draft:v1:2026-10-11|京都|7|post_draw']:JSON.stringify({marks:[{horse:'手入力の馬',mark:'△'}],track:'良',savedAt:'2026-10-10T08:00:00.000Z'}),
 [prefix+'2026-10-11|京都|5']:JSON.stringify({marks:{'馬番不明':'☆'}}),
 ['keiba-labo:unrelated:v1:2026-10-11|東京|1']:JSON.stringify({marks:{'汚染馬':'◎'}}),
 [prefix+'2026-10-11|東京|99']:JSON.stringify({marks:{'架空':'◎'}}),
 [prefix+'2026-10-11|東京|2']:JSON.stringify({marks:{'未選択':''}})
};
test('export of selected day collects every real marked race, not just current race, and picks latest phase',()=>{
 const rows=collectSavedRaceMarks(storage(data),{date:'2026-10-11'});
 assert.equal(rows.length,4);
 assert.deepEqual(new Set(rows.map(r=>r.venue+r.raceNo)),new Set(['東京11','京都11','京都7','京都5']));
 const ireland=rows.find(r=>r.venue==='東京'&&r.raceNo===11);
 assert.equal(ireland.phase,'final');
 assert.equal(ireland.marks.length,2);
 assert.equal(ireland.marks[0].horseNo,3);
 assert.equal(ireland.marks[1].frameNo,6);
 assert.equal(ireland.officialVerified,true);
 const output=formatBulkRaceMarks(rows,{scope:'2026-10-11 の印'});
 assert.match(output,/2026-10-11 東京11R 【最終印】/);
 assert.match(output,/2026-10-11 京都11R 【初期印】/);
 assert.match(output,/2枠 3番 ○ アイルランド馬A/);
 assert.match(output,/5枠 9番 ◎ 京都馬/);
 assert.match(output,/※ブラウザ内の下書き・端末控えの転記/);
 assert.doesNotMatch(output,/昨日の馬|汚染馬|架空/);
});
test('all saved races include other dates, and unverified marks never invent official numbers',()=>{
 const rows=collectSavedRaceMarks(storage(data));
 assert.equal(rows.length,5);
 const old=rows.find(r=>r.date==='2026-10-10');
 assert.equal(old.officialVerified,true);
 const noNumber=rows.find(r=>r.raceNo===5);
 assert.equal(noNumber.officialVerified,false);
 const output=formatBulkRaceMarks(rows);
 assert.match(output,/馬番照合：未確認/);
 assert.match(output,/☆ 馬番不明/);
 assert.doesNotMatch(output,/\d番 ☆ 馬番不明/);
});
test('stored legacy marks without roster still export as unverified names, never pretend DB training',()=>{
 const rows=collectSavedRaceMarks(storage({[prefix+'2026-10-11|東京|4']:JSON.stringify({marks:{'レガシー馬':'▲'}})}));
 assert.equal(rows.length,1);
 assert.equal(rows[0].officialVerified,false);
 assert.match(formatBulkRaceMarks(rows),/未確認/);
 assert.match(formatBulkRaceMarks(rows),/モデル学習完了の証明ではありません/);
});
test('visible bulk copy controls and clipboard fallback compile with local-only records',async()=>{
 const html=await(await app.fetch(new Request('https://example.test/'))).text();
 for(const id of ['bulkMarkExportPanel','copyRaceDayMarks','copyAllRaceMarks','bulkMarkExportText','bulkMarkExportStatus'])assert.match(html,new RegExp("id='"+id+"'|id=\\\""+id+"\\\""));
 assert.match(html,/レース別の予想印をまとめてコピー/);
 assert.match(html,/copyAllRaceMarks/);
 assert.match(html,/collectSavedRaceMarks/);
 assert.match(html,/window.navigator.clipboard.writeText/);
 assert.match(html,/savedAt:new Date\(\).toISOString\(\)/);
 assert.doesNotMatch(html,/id="userMarkWriteKey"|id="userMarkSaveDb"/);
 for(const [,script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(script);
 const health=await(await app.fetch(new Request('https://example.test/health'))).json();
 assert.equal(health.version,VERSION);
 assert.ok(health.features.includes('multi-race-marks-bulk-copy'));
});
