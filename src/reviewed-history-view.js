export function renderReviewedHistory(data){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 if(!data?.available)return '<p>補完ソースの過去走は未保存です。</p>';
 if(data.integrityVerified!==true||!Array.isArray(data.rows)||data.rows.length!==data.storedRows)return '<p>補完履歴の読み返しを確認できません。</p>';
 const groups=new Map();for(const r of data.rows){if(!groups.has(r.horse_name))groups.set(r.horse_name,[]);groups.get(r.horse_name).push(r);}
 return '<h4>netkeiba補完履歴：'+groups.size+'頭・'+data.storedRows+'走</h4><p>DB保存・読み返し一致。印を付けずに確認できます。JRA履歴と出典を分けて保存しています。</p>'+[...groups].map(([name,rows])=>'<details data-history-horse="'+esc(name)+'"><summary>'+esc(name)+' · '+rows.length+'走</summary>'+rows.sort((a,b)=>b.race_date.localeCompare(a.race_date)).map(r=>'<div data-history-row class="notice">'+esc(r.race_date)+' '+esc(r.venue)+' '+esc(r.race_name)+'<br>'+esc(r.surface)+esc(r.distance)+'m ／ '+esc(r.finish_position)+'着 / '+esc(r.field_size)+'頭 ／ '+esc(r.track_condition)+'<br>時計 '+esc(r.time_text)+' ／ 上がり3F '+esc(r.last3f)+' ／ 通過 '+esc(r.corner_positions)+'</div>').join('')+'</details>').join('')+'<p><a href="'+esc(data.sourceUrl)+'" target="_blank" rel="noopener noreferrer">過去走の出典</a> ／ 確認日 '+esc(data.observedAt)+'</p><p>枠番・馬番、正式事前予想、学習完了を示すものではありません。</p>';
}
export function mountReviewedHistory({window,document,api,render}){
 let seq=0;const key=t=>t?`${t.date}:${t.venue}:${t.raceNo}`:'';
 async function load(){const n=++seq,t=window.getLaboTarget?.(),roster=document.getElementById('expectedInlineRoster');if(!t||!roster?.querySelector('select[data-horse-name]'))return;let box=roster.querySelector('#reviewedHistory');if(!box){box=document.createElement('div');box.id='reviewedHistory';box.className='card';roster.append(box);}box.textContent='補完履歴を確認中…';try{const q=new URLSearchParams({date:t.date,venue:t.venue,race_no:String(t.raceNo)}),res=await window.fetch(api+'/v1/lab/reviewed-upcoming-history?'+q),data=await res.json();if(n!==seq||key(t)!==key(window.getLaboTarget?.())||!box.isConnected)return;if(!res.ok||!data.ok){box.textContent='対象レースの補完履歴は未保存、または確認できません。';return;}box.innerHTML=render(data);}catch{if(n===seq&&key(t)===key(window.getLaboTarget?.())&&box.isConnected)box.textContent='補完履歴の保存状態を確認できません。';}}
 window.addEventListener('labo-target-change',()=>{seq++;document.getElementById('reviewedHistory')?.remove();void load();});
 window.addEventListener('labo-roster-ready',load);void load();
}
