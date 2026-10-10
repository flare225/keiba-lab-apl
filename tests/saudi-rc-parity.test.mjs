import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {mergeMainRaceTargets} from '../src/index-v1.12.js';
import app,{VERSION,phaseInlineAvailable,verifiedOfficialRoster} from '../src/index-v1.21.js';

const SAUDI='2026-10-10',IRELAND='2026-10-11';
test('Saudi Arabia RC and Ireland Trophy stay selectable if target discovery is empty',()=>{
 const results=mergeMainRaceTargets([]);
 assert.equal(results.length,2);
 assert.ok(results.some(x=>x.date===SAUDI&&x.venue==='東京'&&x.raceNo===11&&/サウジ/.test(x.raceName)));
 assert.ok(results.some(x=>x.date===IRELAND&&x.venue==='東京'&&x.raceNo===11&&/アイルランド/.test(x.raceName)));
 assert.ok(results.every(x=>x.presetOnly&&x.cardComplete===false));
});
test('target discovery never replaces official statuses or duplicates a provided Saudi race',()=>{
 const supplied=[{date:SAUDI,venue:'東京',raceNo:11,raceName:'サウジRC',cardComplete:true,extra:'verified'}];
 const results=mergeMainRaceTargets(supplied);
 assert.equal(results.length,2);
 assert.equal(results[0],supplied[0]);
 assert.equal(results[0].cardComplete,true);
 assert.equal(results[0].extra,'verified');
 assert.equal(results[1].cardComplete,false);
 assert.equal(mergeMainRaceTargets(null).length,2);
});
test('pre-draw remains editable, official post_draw/final require verified numbered card',()=>{
 for(const phase of ['initial','post_draw','final']){
  assert.equal(phaseInlineAvailable(phase,true,12),true);
  assert.equal(phaseInlineAvailable(phase,false,0),false);
 }
 assert.equal(phaseInlineAvailable('initial',false,12),true);
 assert.equal(phaseInlineAvailable('post_draw',false,12),false);
 assert.equal(phaseInlineAvailable('final',false,12),false);
 assert.equal(phaseInlineAvailable('unexpected',true,12),false);
});
test('official card identity must pass numbered-card and gate checks for Saudi',()=>{
 const runners=[{horse_name:'ギブリ',horse_no:1,frame_no:1},{horse_name:'サトノハクマイ',horse_no:2,frame_no:2}];
 const verified=verifiedOfficialRoster(runners,{ok:true,ops:{cardComplete:true}});
 assert.equal(verified.officialVerified,true);
 assert.deepEqual(verified.runners.map(x=>[x.horseNo,x.frameNo]),[[1,1],[2,2]]);
 assert.equal(verifiedOfficialRoster(runners,{ok:true,ops:{cardComplete:false}}),null);
 assert.equal(verifiedOfficialRoster(runners.map(x=>({...x,frame_no:null})),{ok:true,ops:{cardComplete:true}}),null);
});
test('delivered HTML exposes Saudi quick pick, race-specific marks, budget and browser scripts compile',async()=>{
 const html=await(await app.fetch(new Request('https://example.com/'))).text();
 assert.match(html,/data-race-date="2026-10-10"/);
 assert.match(html,/data-race-date="2026-10-11"/);
 assert.match(html,/selectLaboRace/);
 assert.match(html,/saudi-rc-selectable|raceQuickPick/);
 assert.match(html,/phaseInlineAvailable/);
 assert.match(html,/auditOfficialInline/);
 assert.match(html,/betTypes/);
 assert.match(html,/保存確認待ち/);
 for(const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(match[1]);
 assert.equal((await(await app.fetch(new Request('https://example.com/health'))).json()).version,VERSION);
});
