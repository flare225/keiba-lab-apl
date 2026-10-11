import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import app from '../src/index-v1.21.js';
import {buildPortableMarkBackup,parsePortableMarkBackup,importPortableMarkBackup,PORTABLE_MARK_BACKUP_KIND} from '../src/mark-portable-backup.js';
function storage(initial={},throwOnWrite=Infinity){
 const data=new Map(Object.entries(initial));let writes=0;
 return {data,get length(){return data.size},key:i=>[...data.keys()][i]??null,
  getItem:k=>data.has(k)?data.get(k):null,
  setItem(k,v){writes++;if(writes===throwOnWrite)throw Error('quota');data.set(k,v);},
  removeItem:k=>data.delete(k)};
}
const base='keiba-labo:expected-marks:v1:',date='2026-10-11';
const initial={[base+date+'|東京|11']:JSON.stringify({marks:{'試験馬A':'◎','試験馬B':'○'},officialVerified:true,
 roster:{'試験馬A':{verified:true,horseNo:3,frameNo:2},'試験馬B':{verified:true,horseNo:10,frameNo:5}},savedAt:'2026-10-10T23:20:00.000Z'})};
function portable(){return buildPortableMarkBackup(storage(initial),{now:'2026-10-11T00:00:00.000Z'});}
test('portable backup exports structured date/race/horse names without asserting DB provenance',()=>{
 const text=portable(),backup=parsePortableMarkBackup(text);
 assert.equal(JSON.parse(text).kind,PORTABLE_MARK_BACKUP_KIND);
 assert.equal(backup.records.length,1);
 assert.deepEqual(backup.records[0].marks,[{name:'試験馬A',mark:'◎'},{name:'試験馬B',mark:'○'}]);
 assert.equal(backup.records[0].originalDeviceSavedAt,'2026-10-10T23:20:00.000Z');
 assert.doesNotMatch(text,/db-written-readback-verified|preRaceLock":true/);
});
test('JSON backup keeps initial, post-draw and final marks for the SAME race independently',()=>{
 const stem=date+'|東京|11';
 const seed=storage({
  [base+stem]:JSON.stringify({marks:{'試験馬A':'◎','試験馬B':'○'},savedAt:'2026-10-10T01:00:00.000Z'}),
  ['keiba-labo:mark-draft:v1:'+stem+'|post_draw']:JSON.stringify({
   marks:[{horse:'試験馬A',mark:'○'},{horse:'試験馬B',mark:'◎'}],savedAt:'2026-10-10T03:00:00.000Z',track:'良'
  }),
  [base+stem+'|final']:JSON.stringify({
   marks:{'試験馬A':'▲','試験馬B':'◎'},savedAt:'2026-10-11T01:00:00.000Z',track:'良'
  })
 });
 const data=parsePortableMarkBackup(buildPortableMarkBackup(seed));
 assert.deepEqual(data.records.map(r=>r.phase),['initial','post_draw','final']);
 assert.deepEqual(data.records.map(r=>r.marks.find(m=>m.name==='試験馬A').mark),['◎','○','▲']);
 const restored=storage();
 assert.equal(importPortableMarkBackup(restored,buildPortableMarkBackup(seed)).imported,3);
 assert.equal(JSON.parse(restored.getItem(base+stem)).marks['試験馬A'],'◎');
 assert.equal(JSON.parse(restored.getItem(base+stem+'|post_draw')).marks['試験馬A'],'○');
 assert.equal(JSON.parse(restored.getItem(base+stem+'|final')).marks['試験馬A'],'▲');
 assert.equal(JSON.parse(restored.getItem('keiba-labo:mark-draft:v1:'+stem+'|final')).marks[0].mark,'▲');
 for(const key of [base+stem,base+stem+'|post_draw',base+stem+'|final'])
  assert.equal(JSON.parse(restored.getItem(key)).officialVerified,false);
});
test('import is local only and deletes official verification and number privileges',()=>{
 const dest=storage();
 const result=importPortableMarkBackup(dest,portable(),{importedAt:'2026-10-11T00:20:00.000Z'});
 assert.equal(result.imported,1);
 const saved=JSON.parse(dest.getItem(base+date+'|東京|11'));
 assert.deepEqual(saved.roster,{});
 assert.equal(saved.officialVerified,false);
 assert.deepEqual(saved.marks,{'試験馬A':'◎','試験馬B':'○'});
 assert.equal(saved.savedAt,'2026-10-11T00:20:00.000Z');
 assert.equal(saved.originalDeviceSavedAt,'2026-10-10T23:20:00.000Z');
});
test('existing local marks are preserved without explicit overwrite; overwrite requires opt in',()=>{
 const dest=storage({[base+date+'|東京|11']:JSON.stringify({marks:{'既存馬':'◎'}})});
 const previous=dest.getItem(base+date+'|東京|11');
 const declined=importPortableMarkBackup(dest,portable());
 assert.equal(declined.imported,0);assert.equal(declined.skipped.length,1);
 assert.equal(dest.getItem(base+date+'|東京|11'),previous);
 const accepted=importPortableMarkBackup(dest,portable(),{overwrite:true});
 assert.equal(accepted.imported,1);assert.equal(JSON.parse(dest.getItem(base+date+'|東京|11')).marks['試験馬A'],'◎');
});
test('post-draw and final phase are additionally restored as manual drafts, not official cards',()=>{
 const body={kind:PORTABLE_MARK_BACKUP_KIND,schema:1,records:[{date,venue:'京都',raceNo:7,phase:'final',track:'良',
  marks:[{name:'馬C',mark:'▲'},{name:'馬D',mark:'△'}],originalDeviceSavedAt:'2026-10-10T22:00:00.000Z'}]};
 const dest=storage();
 const result=importPortableMarkBackup(dest,JSON.stringify(body),{importedAt:'2026-10-11T00:10:00Z'});
 assert.equal(result.imported,1);
 const manual=JSON.parse(dest.getItem('keiba-labo:mark-draft:v1:'+date+'|京都|7|final'));
 assert.deepEqual(manual.marks,[{horse:'馬C',mark:'▲'},{horse:'馬D',mark:'△'}]);
 assert.equal(JSON.parse(dest.getItem(base+date+'|京都|7|final')).officialVerified,false);
});
test('bad, duplicated, dangerous or incomplete backups cannot silently import',()=>{
 const src=JSON.parse(portable());
 for(const corrupt of [
  {...src,kind:'some-other-app'},
  {...src,schema:999},
  {...src,records:[src.records[0],src.records[0]]},
  {...src,records:[{...src.records[0],marks:[{name:'A',mark:'◎'},{name:'A',mark:'○'}]}]},
  {...src,records:[{...src.records[0],marks:[{name:'A',mark:'◎'},{name:'B',mark:'◎'}]}]},
  {...src,records:[{...src.records[0],date:'2026-02-30'}]},
  {...src,records:[{...src.records[0],phase:'trained'}]},
 ]){
  const dest=storage();
  assert.throws(()=>importPortableMarkBackup(dest,JSON.stringify(corrupt)));
  assert.equal(dest.length,0);
 }
 assert.throws(()=>parsePortableMarkBackup('not JSON'),/JSON/);
});
test('storage write failure rolls back earlier writes',()=>{
 const r={kind:PORTABLE_MARK_BACKUP_KIND,schema:1,records:[{date,venue:'京都',raceNo:1,phase:'final',
  marks:[{name:'馬X',mark:'◎'}]}]};
 const dest=storage({},2);
 assert.throws(()=>importPortableMarkBackup(dest,JSON.stringify(r)),/復元に失敗/);
 assert.equal(dest.length,0);
});
test('HTML exposes visible portable backup controls and all inline scripts compile',async()=>{
 const page=await app.fetch(new Request('https://example.test/'));
 const html=await page.text();
 for(const id of ['copyPortableMarkBackup','restorePortableMarkBackup','portableMarkBackupText','portableMarkBackupStatus','portableMarkBackupOverwrite'])
  assert.match(html,new RegExp('id="'+id+'"'));
 for(const [,script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(script);
 const health=await(await app.fetch(new Request('https://example.test/health'))).json();
 assert.ok(health.features.includes('portable-multi-race-marks-backup-and-restore'));
});
