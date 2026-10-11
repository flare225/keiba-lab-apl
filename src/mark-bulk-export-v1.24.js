export const MARK_EXPORT_PHASES=['initial','post_draw','final'];
export const MARK_EXPORT_LABELS={initial:'初期印',post_draw:'枠順後',final:'最終印'};
export const MARK_EXPORT_CHOICES=['◎','○','▲','△','☆','注','消'];
const cleanMark=x=>MARK_EXPORT_CHOICES.includes(x)?x:null;
export const parseRace=x=>{
 const parts=String(x||'').split('|');
 if(parts.length!==3||!/^20\d{2}-\d{2}-\d{2}$/.test(parts[0])||
 !['東京','京都','中山','阪神','新潟','福島','中京','小倉','札幌','函館'].includes(parts[1])||
 !/^\d{1,2}$/.test(parts[2])||Number(parts[2])<1||Number(parts[2])>12)return null;
 return {date:parts[0],venue:parts[1],raceNo:Number(parts[2])};
};
export function snapshot(data,race,phase,source){
 const names=data?.marks;
 if(!names||typeof names!=='object'||Array.isArray(names))return null;
 let valid=[];
 if(Array.isArray(data.entries)){
  valid=data.entries.filter(x=>x&&typeof x.horseName==='string'&&cleanMark(x.mark)).map(x=>({
   name:x.horseName,mark:x.mark,horseNo:Number.isInteger(x.horseNo)?x.horseNo:null,frameNo:Number.isInteger(x.frameNo)?x.frameNo:null
  }));
 }else{
  valid=Object.entries(names).filter(([name,mark])=>name.trim()&&cleanMark(mark)).map(([name,mark])=>{
   const verified=data.officialVerified===true&&data.roster?.[name]?.verified===true;
   const card=data.roster?.[name]||{};
   return{name,mark,horseNo:verified&&Number.isInteger(card.horseNo)?card.horseNo:null,frameNo:verified&&Number.isInteger(card.frameNo)?card.frameNo:null};
  });
 }
 if(!valid.length||valid.length>18)return null;
 const verified=valid.every(x=>Number.isInteger(x.horseNo)&&x.horseNo>=1&&x.horseNo<=18&&Number.isInteger(x.frameNo)&&x.frameNo>=1&&x.frameNo<=8);
 return{...race,phase,source,marks:valid,officialVerified:verified,deviceSavedAt:typeof data.savedAt==='string'?data.savedAt:null,track:data.track||''};
}
export function readStored(storage,key){try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}}
export function collectSavedRaceMarks(storage,{date=null,allPhases=false}={}){
 const entries=new Map();
 const prefix='keiba-labo:expected-marks:v1:';
 const draftPrefix='keiba-labo:mark-draft:v1:';
 const frozenPrefix='keiba-labo:mark-freeze:v1:';
 const size=Math.min(Number(storage?.length)||0,2000);
 for(let i=0;i<size;i++){
  let rawKey;try{rawKey=storage.key(i);}catch{continue;}
  if(typeof rawKey!=='string')continue;
  let base,kind;
  if(rawKey.startsWith(prefix)){base=rawKey.slice(prefix.length);kind='inline';}
  else if(rawKey.startsWith(draftPrefix)){base=rawKey.slice(draftPrefix.length);kind='draft';}
  else if(rawKey.startsWith(frozenPrefix)){base=rawKey.slice(frozenPrefix.length);kind='frozen';}
  else continue;
  let phase='initial';
  for(const p of ['post_draw','final'])if(base.endsWith('|'+p)){base=base.slice(0,-p.length-1);phase=p;break;}
  if(kind==='draft'&&phase==='initial'||kind==='frozen'&&phase==='initial')continue;
  const race=parseRace(base);
  if(!race||(date&&race.date!==date))continue;
  const d=readStored(storage,rawKey);
  let record=null;
  if(kind==='inline'){record=snapshot(d,race,phase,'ブラウザ印の下書き');}
  else if(kind==='frozen'&&d?.payload?.phase===phase&&Array.isArray(d.payload.marks)){
   const valid=d.payload.marks.filter(x=>x&&typeof x.horseName==='string'&&cleanMark(x.mark)).map(x=>({name:x.horseName,mark:x.mark,horseNo:Number.isInteger(x.horseNo)?x.horseNo:null,frameNo:null}));
   if(valid.length&&valid.length<=18)record={...race,phase,source:'端末控え（DB確定ではない）',officialVerified:false,marks:valid,deviceSavedAt:d.recordedAt||null,track:d.payload.track||''};
  }else if(kind==='draft'&&Array.isArray(d?.marks)){
   const valid=d.marks.filter(x=>x&&typeof x.horse==='string'&&x.horse.trim()&&cleanMark(x.mark)).map(x=>({name:x.horse,mark:x.mark,horseNo:null,frameNo:null}));
   if(valid.length&&valid.length<=18)record={...race,phase,source:'手入力の下書き',officialVerified:false,marks:valid,deviceSavedAt:d.savedAt||null,track:d.track||''};
  }
  if(!record)continue;
  const id=base+'|'+phase,prior=entries.get(id);
  const priority={inline:3,draft:2,frozen:1};
  if(!prior||priority[kind]>priority[prior.kind])entries.set(id,{kind,record});
 }
 // The readable clipboard view intentionally picks the latest phase per race.
 // JSON backups must preserve initial, post-draw, and final independently:
 // collapsing phases would silently erase the pre-race decision history.
 const perRace=new Map();
 for(const {record} of entries.values()){
  const id=[record.date,record.venue,record.raceNo].join('|'),old=perRace.get(id);
  if(!old||MARK_EXPORT_PHASES.indexOf(record.phase)>MARK_EXPORT_PHASES.indexOf(old.phase))perRace.set(id,record);
 }
 const records=allPhases?[...entries.values()].map(x=>x.record):[...perRace.values()];
 return records.sort((a,b)=>a.date.localeCompare(b.date)||a.venue.localeCompare(b.venue,'ja')||
  a.raceNo-b.raceNo||MARK_EXPORT_PHASES.indexOf(a.phase)-MARK_EXPORT_PHASES.indexOf(b.phase));
}
export function formatBulkRaceMarks(records,{scope='全保存レース'}={}){
 if(!Array.isArray(records)||!records.length)return'';
 const total=records.reduce((sum,r)=>sum+r.marks.length,0);
 const lines=['KEIBA LABO レース別予想印の控え',scope+'：'+records.length+'レース／'+total+'頭','※ブラウザ内の下書き・端末控えの転記です。正式DB保存・事前LOCK・モデル学習完了の証明ではありません。'];
 for(const r of records){
  const label=r.date+' '+r.venue+r.raceNo+'R';
  lines.push('',label+' 【'+(MARK_EXPORT_LABELS[r.phase]||r.phase)+'】 '+r.source,
   '馬番照合：'+(r.officialVerified?'保存時のJRA正式出馬表で照合済み':'未確認（一部の馬番は参考値・未取得）'),
   '馬場想定：'+(r.track||'未指定'),
   '端末保存時刻：'+(r.deviceSavedAt||'未記録'));
  for(const m of r.marks)lines.push((r.officialVerified&&Number.isInteger(m.frameNo)?m.frameNo+'枠 ':'')+(Number.isInteger(m.horseNo)?m.horseNo+'番 ':'')+m.mark+' '+m.name);
 }
 return lines.join('\n');
}
export function mountBulkRaceMarkCopy({document,window,persistCurrent}){
 const copy=document.getElementById('copyRaceDayMarks'),all=document.getElementById('copyAllRaceMarks'),
 output=document.getElementById('bulkMarkExportText'),status=document.getElementById('bulkMarkExportStatus');
 if(!copy||!all||!output||!status)return;
 async function exportMarks(useAll){
  try{persistCurrent?.();}catch{}
  const date=window.getLaboTarget?.()?.date||null;
  if(!useAll&&!date){status.textContent='対象レースの日付を先に選んでください。';return;}
  const records=collectSavedRaceMarks(window.localStorage,{date:useAll?null:date});
  const scope=useAll?'全保存レース':date+'の保存済みレース';
  const text=formatBulkRaceMarks(records,{scope});
  if(!text){status.textContent=scope+'には、コピーできる印がまだありません。馬名の横で印を選んでください。';return;}
  output.value=text;output.hidden=false;
  const total=records.reduce((n,x)=>n+x.marks.length,0);
  try{await window.navigator.clipboard.writeText(text);
   status.textContent=records.length+'レース・'+total+'頭の印をコピーしました。下のテキストも確認できます。DB学習は未実行です。';
  }catch{
   output.focus();output.select();
   status.textContent=records.length+'レース・'+total+'頭を一覧表示しました。下を長押ししてコピーしてください。DB学習は未実行です。';
  }
 }
 copy.addEventListener('click',()=>{void exportMarks(false);});
 all.addEventListener('click',()=>{void exportMarks(true);});
}
