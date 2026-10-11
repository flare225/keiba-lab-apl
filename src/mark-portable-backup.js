import {MARK_EXPORT_CHOICES,MARK_EXPORT_PHASES,parseRace,collectSavedRaceMarks} from './mark-bulk-export-v1.24.js';
export const PORTABLE_MARK_BACKUP_KIND='keiba-labo-local-mark-backup';
export const PORTABLE_MARK_BACKUP_SCHEMA=1;
export const TRACK=['','良','稍重','重','不良'];
export const validDate=date=>typeof date==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
export const safeIso=x=>typeof x==='string'&&!Number.isNaN(Date.parse(x))?x:null;
export const raceId=x=>[x.date,x.venue,x.raceNo].join('|');
export function normalizeRecord(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||!validDate(x.date)||
 !parseRace(raceId(x))||!MARK_EXPORT_PHASES.includes(x.phase)||
 !TRACK.includes(x.track||'')||!Array.isArray(x.marks)||x.marks.length<1||x.marks.length>18)
  throw Error('日付・競馬場・レース番号・段階・馬場・頭数に不正があります。');
 const names=new Set(),marks=[];
 for(const m of x.marks){
  const name=String(m?.name||'').trim(),mark=m?.mark;
  if(!name||name.length>120||names.has(name)||!MARK_EXPORT_CHOICES.includes(mark))
   throw Error('馬名の重複や不正な印があります。');
  names.add(name);marks.push({name,mark});
 }
 for(const mark of ['◎','○'])if(marks.filter(x=>x.mark===mark).length>1)
  throw Error(mark+'が同じレースで重複しています。');
 return {date:x.date,venue:x.venue,raceNo:Number(x.raceNo),phase:x.phase,
  track:x.track||'',originalDeviceSavedAt:safeIso(x.originalDeviceSavedAt),marks};
}
export function buildPortableMarkBackup(storage,{date=null,now=new Date().toISOString()}={}){
 const records=collectSavedRaceMarks(storage,{date}).map(r=>normalizeRecord({...r,originalDeviceSavedAt:r.deviceSavedAt}));
 if(!records.length)throw Error('バックアップできる予想印がありません。');
 return JSON.stringify({kind:PORTABLE_MARK_BACKUP_KIND,schema:PORTABLE_MARK_BACKUP_SCHEMA,
  exportedAt:now,description:'端末下書きの持ち運び用。DB保存・JRA公式枠順・予想時刻の証明ではありません。',
  records},null,2);
}
export function parsePortableMarkBackup(raw){
 if(typeof raw!=='string'||!raw.trim()||raw.length>250000)throw Error('バックアップ文字列が空、または大きすぎます。');
 let data;try{data=JSON.parse(raw);}catch{throw Error('JSON形式ではありません。バックアップ用JSONを貼り付けてください。');}
 if(!data||data.kind!==PORTABLE_MARK_BACKUP_KIND||data.schema!==PORTABLE_MARK_BACKUP_SCHEMA||
 !Array.isArray(data.records)||data.records.length<1||data.records.length>100)
  throw Error('KEIBA LABOの対応するバックアップではありません。');
 const ids=new Set(),records=[];
 for(const rawRecord of data.records){
  const r=normalizeRecord(rawRecord),id=raceId(r)+'|'+r.phase;
  if(ids.has(id))throw Error('同じレース・段階がバックアップ内で重複しています。');
  ids.add(id);records.push(r);
 }
 return {exportedAt:safeIso(data.exportedAt),records};
}
export function importPortableMarkBackup(storage,raw,{overwrite=false,importedAt=new Date().toISOString()}={}){
 const {records}=parsePortableMarkBackup(raw),updates=[],skipped=[];
 for(const r of records){
  const stem=raceId(r),postfix=r.phase==='initial'?'':'|'+r.phase;
  const inlineKey='keiba-labo:expected-marks:v1:'+stem+postfix;
  const draftKey=r.phase==='initial'?null:'keiba-labo:mark-draft:v1:'+stem+'|'+r.phase;
  const keys=draftKey?[inlineKey,draftKey]:[inlineKey];
  if(!overwrite&&keys.some(k=>storage.getItem(k)!==null)){skipped.push(stem+'|'+r.phase);continue;}
  // Even a once-verified horse number must be rechecked against today's official
  // JRA roster. The imported record never grants officialVerified or pre-race LOCK.
  const marks=Object.fromEntries(r.marks.map(m=>[m.name,m.mark]));
  const inline={snapshotId:'portable-import-unverified',officialVerified:false,roster:{},track:r.track,
   marks,savedAt:importedAt,importedAt,originalDeviceSavedAt:r.originalDeviceSavedAt};
  updates.push([inlineKey,JSON.stringify(inline)]);
  if(draftKey)updates.push([draftKey,JSON.stringify({marks:r.marks.map(m=>({horse:m.name,mark:m.mark})),
   track:r.track,savedAt:importedAt,importedAt,originalDeviceSavedAt:r.originalDeviceSavedAt})]);
 }
 // A partial import must not silently erase old drafts when storage quota fails.
 const old=new Map(),written=[];
 try{
  for(const [key,value] of updates){
   old.set(key,storage.getItem(key));
   storage.setItem(key,value);written.push(key);
  }
 }catch(e){
  for(const key of written.reverse()){
   try{const previous=old.get(key);if(previous===null)storage.removeItem(key);else storage.setItem(key,previous);}catch{}
  }
  throw Error('端末への復元に失敗しました。容量や保存権限を確認してください。');
 }
 return{imported:records.length-skipped.length,skipped,restoredLocalOnly:true,importedAt};
}
export function mountPortableMarkBackup({document,window,persistCurrent}){
 const el=id=>document.getElementById(id),copy=el('copyPortableMarkBackup'),
 restore=el('restorePortableMarkBackup'),source=el('portableMarkBackupText'),
 status=el('portableMarkBackupStatus'),overwrite=el('portableMarkBackupOverwrite');
 if(!copy||!restore||!source||!status)return;
 copy.addEventListener('click',async()=>{
  try{
   persistCurrent?.();
   const raw=buildPortableMarkBackup(window.localStorage);
   source.hidden=false;source.value=raw;
   try{await window.navigator.clipboard.writeText(raw);status.textContent='端末下書きのJSONバックアップをコピーしました。別の場所へ控えてください。DB保存ではありません。';}
   catch{source.focus();source.select();status.textContent='下のJSONを長押ししてコピーしてください。DB保存ではありません。';}
  }catch(e){status.textContent='バックアップ作成失敗：'+e.message;}
 });
 restore.addEventListener('click',()=>{
  try{
   persistCurrent?.();
   const parsed=parsePortableMarkBackup(source.value);
   if(!window.confirm(parsed.records.length+'レース分の印を端末に復元します。DB保存やレース前LOCKは行いません。よろしいですか？'))return;
   const answer=importPortableMarkBackup(window.localStorage,source.value,{overwrite:overwrite?.checked===true});
   status.textContent='端末へ '+answer.imported+'レース分を復元。既存の印を保持してスキップ '+answer.skipped.length+'件。対象レースを切り替えるかページを再読み込みすると反映されます。公式番号の再照合とDB保存は別です。';
  }catch(e){status.textContent='復元失敗：'+e.message;}
 });
}
