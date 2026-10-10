export function renderWorkoutEvidence(data){
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 if(!data||data.ok!==true)return{status:'追い切りデータを確認できません。',detail:'取得エラーのため未取得と判定しません。後でもう一度確認してください。'};
 const count=Number(data.coverage?.official)||0,found=Number(data.coverage?.withWorkout)||0,rows=Number(data.coverage?.workoutRows)||0;
 const completed=data.stage==='stored'&&found>0,connected=data.collectionConfigured===true;
 const status=data.stage==='no-official-card'?'正式出馬表の保存確認待ち':data.stage==='official-card-incomplete'?'出馬表の頭数が未照合':completed?found+'/'+count+'頭・計'+rows+'件を保存確認':'追い切りデータ未取得（'+found+'/'+count+'頭）';
 const source=connected?'許諾済みデータ供給元の接続設定あり':'自動取得元は未接続。現在、公式調教タイムをLABOが自動取得しているわけではありません。';
 const runners=Array.isArray(data.runners)?data.runners:[];
 const cards=runners.map(r=>{
  const workouts=Array.isArray(r.workouts)?r.workouts:[];
  const name=esc(r.horseName||'馬名未確認'),no=Number.isInteger(r.horseNo)?esc(r.horseNo)+'番':'馬番未確認';
  const observations=workouts.map(w=>'<div class="workout-observation"><b>'+esc(w.date)+'　'+esc(w.course)+'</b><span>4F：'+(w.fourF==null?'未取得':esc(w.fourF)+'秒')+' ／ 1F：'+(w.lastF==null?'未取得':esc(w.lastF)+'秒')+'</span><small>出典：'+esc(w.sourceName||'確認待ち')+'</small></div>').join('');
  return '<article class="workout-horse"><div><b>'+esc(r.frameNo||'?')+'枠 '+no+'　'+name+'</b><span class="workout-state">'+(workouts.length?workouts.length+'件保存':'追い切り未取得')+'</span></div>'+(workouts.length?observations:'')+'</article>';
 }).join('');
 return{status,detail:'<p class="workout-banner">'+esc(status)+'</p><p class="notice">'+esc(source)+'</p><p class="notice">追い切りの計時は「参考資料」。LABOの評価点・予想印・学習にはまだ自動反映していません。未取得の馬に仮の時計や評価を付けません。</p>'+(runners.length?'<details class="workout-list" '+(completed?'':'')+'><summary>出走馬ごとの追い切り状況（'+runners.length+'頭）</summary>'+cards+'</details>':'<p class="notice">正式出馬表の馬名・馬番が確認できると、馬ごとの取得状況を表示します。</p>')};
}
export function mountWorkoutEvidence({document,window,api,render=renderWorkoutEvidence}){
 const status=document.getElementById('workoutStatus'),body=document.getElementById('workoutDetails'),marks=document.getElementById('workoutMarksStatus'),refresh=document.getElementById('workoutRefresh');
 if(!status||!body)return;
 let seq=0,lastKey='';
 async function load(){
  const current=++seq,t=window.getLaboTarget?.();
  const key=t?t.date+'|'+t.venue+'|'+t.raceNo:'';
  lastKey=key;refresh.disabled=true;status.textContent='追い切りの保存状態を確認中…';
  if(marks)marks.textContent='追い切りの保存状態を確認中…';
  if(!t){body.textContent='レースを選んでください。';refresh.disabled=false;return;}
  try{
   const params=new URLSearchParams({date:t.date,venue:t.venue,race_no:String(t.raceNo)});
   const response=await fetch(api+'/v1/lab/workouts?'+params.toString());
   if(response.status===404){if(current!==seq)return;const pending='追い切り取得APIの本番公開待ちです。現時点では追い切り時計を確認できません。';status.textContent='追い切りAPI公開待ち';body.textContent=pending;if(marks)marks.textContent=pending;return;}
   const data=await response.json();
   if(current!==seq)return;
   if(!response.ok)throw Error(data.error||'追い切りデータを読み取れません');
   const rendered=render(data);
   status.textContent=rendered.status;
   body.innerHTML=rendered.detail;
   if(marks)marks.textContent='追い切り：'+rendered.status+'。※参考資料・予想点には未反映。';
  }catch(e){if(current!==seq)return;const warning='追い切りDBの接続・取得状態を確認できません（'+String(e.message||e)+'）。';
   status.textContent='取得状態が不明';body.textContent=warning;if(marks)marks.textContent=warning;
  }finally{if(current===seq)refresh.disabled=false;}
 }
 window.addEventListener('labo-target-change',load);
 refresh.addEventListener('click',load);
 document.querySelectorAll('.tab[data-id="race"],.tab[data-id="marks"]').forEach(x=>x.addEventListener('click',()=>{const t=window.getLaboTarget?.();if(t&&!lastKey)void load();}));
 void load();
 return{refresh:load};
}
