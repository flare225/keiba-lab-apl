export const WORKOUT_IMPRESSIONS=['良化','順調','要確認'];
export function getOfficialWorkoutRoster(card,gate){
 const rows=card?.data,declared=Number(card?.count);
 if(!card?.ok||!gate?.ok||gate?.ops?.cardComplete!==true||!Array.isArray(rows)||
 !rows.length||rows.length!==declared||declared>18)return null;
 const runners=rows.map(x=>({horseNo:Number(x.horse_no??x.horseNo),frameNo:Number(x.frame_no??x.frameNo),horseName:x.horse_name??x.horseName}));
 if(runners.some(x=>!Number.isInteger(x.horseNo)||x.horseNo<1||x.horseNo>18||!Number.isInteger(x.frameNo)||x.frameNo<1||x.frameNo>8||typeof x.horseName!=='string'||!x.horseName.trim())||
 new Set(runners.map(x=>x.horseNo)).size!==runners.length||new Set(runners.map(x=>x.horseName)).size!==runners.length||
 runners.some(x=>x.frameNo>8))return null;
 runners.sort((a,b)=>a.horseNo-b.horseNo);
 if(runners.some((x,i)=>x.horseNo!==i+1))return null;
 return runners;
}
export function workoutImpressionSummary(runners=[],notes={}){
 const counts=Object.fromEntries(WORKOUT_IMPRESSIONS.map(x=>[x,0]));
 for(const horse of runners){const choice=notes[String(horse.horseNo)];if(counts[choice]!==undefined)counts[choice]++;}
 return {total:runners.length,marked:Object.values(counts).reduce((s,x)=>s+x,0),counts};
}
export function mountWorkoutImpressions({document,window,api,getRoster=getOfficialWorkoutRoster}){
 const card=document.getElementById('workoutImpressionCard'),status=document.getElementById('workoutImpressionStatus'),list=document.getElementById('workoutImpressionList'),summary=document.getElementById('workoutImpressionSummary'),copy=document.getElementById('workoutImpressionCopy'),exportBox=document.getElementById('workoutImpressionExport');
 if(!card||!status||!list||!summary)return;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let sequence=0,runners=[],notes={},key='',identity='',race=null;
 const storeKey=()=> 'keiba-labo:workout-impressions:v1:'+key;
 const read=()=>{try{const d=JSON.parse(window.localStorage.getItem(storeKey())||'null');return d&&d.identity===identity&&d.notes&&typeof d.notes==='object'?d.notes:{};}catch{return{};}};
 const save=()=>{try{window.localStorage.setItem(storeKey(),JSON.stringify({identity,notes,updatedAt:new Date().toISOString()}));status.textContent='このブラウザに保存しました（LABO予想指数には未反映）。';}catch{status.textContent='保存に失敗しました。画面を閉じる前に控えてください。';}};
 const textExport=()=>{
  const h=race?race.date+' '+race.venue+race.raceNo+'R '+(race.raceName||''):'追い切り所感';
  return 'KEIBA LABO 追い切り所感（利用者の判断）\n'+h+'\n'+runners.map(r=>r.horseNo+'番 '+r.horseName+'：'+(notes[String(r.horseNo)]||'未評価')).join('\n')+'\n※netkeibaの原文・調教タイムを転載したものではありません。';
 };
 function render(){
  const d=workoutImpressionSummary(runners,notes);
  summary.textContent=runners.length?d.marked+'/'+d.total+'頭記録 · 良化 '+d.counts['良化']+' / 順調 '+d.counts['順調']+' / 要確認 '+d.counts['要確認']:'出馬表照合待ち';
  list.innerHTML=runners.map(r=>'<div class="workout-impression-row"><div class="workout-impression-horse"><b>'+esc(r.frameNo)+'枠 '+esc(r.horseNo)+'番</b> '+esc(r.horseName)+'</div><div class="workout-impression-choices">'+WORKOUT_IMPRESSIONS.map(v=>'<button type="button" data-impression-no="'+r.horseNo+'" data-impression="'+v+'" aria-label="'+esc(r.horseName)+'：'+v+'" aria-pressed="'+(notes[String(r.horseNo)]===v)+'" class="workout-impression-choice'+(notes[String(r.horseNo)]===v?' selected':'')+'">'+v+'</button>').join('')+'</div></div>').join('');
  if(copy)copy.disabled=!d.marked;
 }
 async function load(){
  const t=window.getLaboTarget?.(),next=++sequence;
  key=t?t.date+'|'+t.venue+'|'+t.raceNo:'';race=t;
  runners=[];identity='';notes={};status.textContent=t?'JRA出馬表を照合中…':'レースを選んでください。';if(exportBox){exportBox.hidden=true;exportBox.value='';}render();
  if(!t)return;
  try{
   const [cardRes,gateRes]=await Promise.all([
    fetch(api+'/api/jra/runners?race_key='+encodeURIComponent(t.date+':'+t.venue+':'+t.raceNo)),
    fetch(api+'/v1/lab/race-ops?date='+encodeURIComponent(t.date)+'&venue='+encodeURIComponent(t.venue)+'&race_no='+encodeURIComponent(t.raceNo))
   ]);
   const [raw,ops]=await Promise.all([cardRes.json(),gateRes.json()]);
   if(next!==sequence)return;
   runners=cardRes.ok&&gateRes.ok?getRoster(raw,ops)||[]:[];
   if(!runners.length){status.textContent='正式出馬表の照合待ちです。馬名を誤登録しないため所感入力は保留します。';render();return;}
   identity=runners.map(r=>r.horseNo+':'+r.frameNo+':'+r.horseName).join('|');
   notes=read();status.textContent='追い切りを確認して「良化／順調／要確認」をタップ（時計は転載しません）。';render();
  }catch{if(next===sequence){status.textContent='公式出馬表を読み取れません。時間をおいて確認してください。';render();}}
 }
 list.addEventListener('click',e=>{
  const button=e.target.closest?.('button[data-impression-no]');if(!button)return;
  const no=Number(button.dataset.impressionNo),value=button.dataset.impression;
  if(!runners.some(x=>x.horseNo===no)||!WORKOUT_IMPRESSIONS.includes(value))return;
  const old=notes[String(no)];if(old===value)delete notes[String(no)];else notes[String(no)]=value;
  save();render();
 });
 copy?.addEventListener('click',async()=>{
  const txt=textExport();
  try{await window.navigator.clipboard.writeText(txt);status.textContent='追い切りの所感をコピーしました。';if(exportBox)exportBox.hidden=true;}
  catch{if(exportBox){exportBox.value=txt;exportBox.hidden=false;exportBox.focus();exportBox.select();status.textContent='長押しでコピーできる控えを表示しました。';}else status.textContent='コピーできませんでした。';}
 });
 window.addEventListener('labo-target-change',()=>{void load();});
 void load();
}
