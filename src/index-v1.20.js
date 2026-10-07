import app from './index-v1.19.js';
export const VERSION='1.20.1';
export function findComparedRunner(rows,mark){return rows.find(x=>mark.horseName?x.horseName===mark.horseName:mark.horseNo!=null&&x.horseNo===mark.horseNo);}
export const enhancement=String.raw`
<style>
.labo-main-link{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.labo-main-link a{display:block;padding:12px;border:1px solid var(--line);border-radius:12px;color:var(--accent);text-decoration:none}
.labo-pool{overflow-x:auto;margin-top:12px}.labo-pool table{border-collapse:collapse;min-width:480px;width:100%;font-size:14px}.labo-pool th,.labo-pool td{padding:10px;text-align:left;border-bottom:1px solid var(--line)}
.labo-comparison-title{font-weight:800;font-size:16px;margin:8px 0}.precard-race-meta{font-size:13px}.precard-explain,.precard-guard{font-size:13px}
</style>
<script>
(()=>{
 const findComparedRunner=${findComparedRunner.toString()};
 const api='https://keiba-lab-api.sekai-no-bancyou.workers.dev';
 const out=document.getElementById('precardPreview'),identity=document.getElementById('precardIdentity'),panel=document.querySelector('.precard-panel');
 if(!out||!panel)return;
 const esc=v=>String(v??'未取得').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const value=(v,u='')=>v==null?'未取得':esc(v)+u;
 const key=t=>t?t.date+'|'+t.venue+'|'+t.raceNo:'';
 let generation=0,timer=null,running=false,queued=false,cache=null,cacheKey='',cachedAt=0;
 const label=()=>{const t=window.getLaboTarget?.();return t?t.date+' '+t.venue+t.raceNo+'R '+(t.raceName||t.race_name||(t.date==='2026-10-11'&&t.venue==='東京'&&Number(t.raceNo)===11?'アイルランドトロフィー':'')): '対象レースを確認中';};
 panel.querySelector('.precard-explain').textContent='初期印を付けると、対象レースの全馬を保存済みDBから比較します。根拠の過去走・上がり3F・通過順を確認できます。';
 panel.querySelector('.precard-guard').textContent='参考指数は的中確率ではありません。正式出馬表・枠順・当日馬場は未確定なら保留。初期印の仮比較は印の保存・事前LOCKを行いません。';
 const old=panel.querySelector('#precardRefresh'),refresh=old.cloneNode(true);old.replaceWith(refresh);refresh.textContent='保存済みDBを読み直して仮比較';
 const hero=document.querySelector('.hero');if(hero)hero.insertAdjacentHTML('beforeend','<div class="labo-main-link"><a href="#marks" id="openInitialComparison">アイルランドTの初期印・仮比較</a><a href="'+api+'/lab/work-progress" target="_blank" rel="noopener">補完・学習の進捗</a></div>');
 document.getElementById('openInitialComparison')?.addEventListener('click',e=>{e.preventDefault();document.querySelector('.tab[data-id="marks"]')?.click();});
 const names=document.createElement('datalist');names.id='laboExpectedNames';document.body.append(names);
 function inputNames(){document.querySelectorAll('.markrow').forEach((r,i)=>{r.querySelector('.horse').setAttribute('list',names.id);r.querySelector('.horse').setAttribute('aria-label','印'+(i+1)+'の馬名');r.querySelector('.mk').setAttribute('aria-label','印'+(i+1)+'の種類');});}
 inputNames();
 const initial=()=>document.getElementById('phase').value==='initial';
 function marks(){return [...document.querySelectorAll('.markrow')].map(r=>{const name=r.querySelector('.horse').value.trim(),mark=r.querySelector('.mk').value;return !name?null:/^\d+$/.test(name)?{horseNo:Number(name),mark}:{horseName:name,mark};}).filter(Boolean);}
 function render(d,human){
  const a=d.assessment||{},rows=a.allRunners||[],evidence=new Map((d.audit?.historySidecar||[]).map(x=>[x.horseName,x]));
  out.className='precard-horses';
  out.innerHTML='<div class="labo-comparison-title">'+esc(label())+'</div><p>全'+value(a.runnerPool)+'頭中 '+value(a.scoredRunners)+'頭を仮評価。参考指数・馬場未指定なら馬場評価を保留。</p>'+human.map(m=>{
   const r=findComparedRunner(rows,m),a=r?.assessment||{},h=evidence.get(r?.horseName||m.horseName);
   return '<article class="precard-horse"><b>'+esc(m.mark)+' '+esc(r?.horseName||m.horseName||m.horseNo)+'</b><p>参考指数 '+value(a.evidenceScore)+' / 100 · 参考順位 '+value(r?.referenceRank,'位')+'</p>'+(h?.recent?.length?'<details><summary>根拠の過去走 '+h.recent.length+'走を見る</summary>'+h.recent.map(x=>'<div class="precard-race"><b>'+esc(x.date)+' '+esc(x.venue)+' '+esc(x.raceName)+' · '+value(x.finish,'着')+'</b><div class="precard-race-meta">'+esc(x.surface)+' '+value(x.distance,'m')+' / 時計 '+value(x.time)+'<br>通過 '+value(x.cornerPositions)+' / 上がり3F '+value(x.last3f,'秒')+'</div></div>').join('')+'</details>':'<p>履歴未取得・比較保留</p>')+'</article>';
  }).join('')+'<div class="labo-pool"><table><caption>全馬の参考評価（印は点数に使いません）</caption><thead><tr><th>馬名</th><th>順位</th><th>参考指数</th><th>過去走</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.horseName)+'</td><td>'+value(r.referenceRank)+'</td><td>'+value(r.assessment?.evidenceScore)+'</td><td>'+value(r.assessment?.historyRows,'走')+'</td></tr>').join('')+'</tbody></table></div>';
  identity.textContent=label()+' / 保存済みDBから比較。枠・馬番は正式出馬表で確認します。';
 }
 async function compare(force=false){
  if(!initial()){if(force)await window.auditOfficialMarks?.();return;}
  const t=window.getLaboTarget?.(),human=marks();if(!t){out.textContent='対象レースを取得中です。';return;}
  if(!human.length){out.textContent='馬名を入力して初期印を付けると、自動で仮比較します。';return;}
  if(running){queued=true;return;}
  const n=++generation,k=key(t),track=document.getElementById('markTrack').value;
  const ck=JSON.stringify([k,track,human]);if(!force&&cache&&cacheKey===ck&&Date.now()-cachedAt<60000){render(cache,human);return;}
  running=true;out.textContent='保存済みDBを比較中…';
  try{
   const body={date:t.date,venue:t.venue,raceNo:Number(t.raceNo),phase:'initial',marks:human};if(track)body.track=track;
   const response=await fetch(api+'/v1/lab/mark-comparison',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await response.json();
   if(n!==generation||k!==key(window.getLaboTarget?.())||!initial()||JSON.stringify(marks())!==JSON.stringify(human))return;
   if(!response.ok||!d.ok)throw Error(d.error||'比較を取得できませんでした。');
   cache=d;cacheKey=ck;cachedAt=Date.now();document.getElementById('auditResult').textContent=JSON.stringify(d,null,2);render(d,human);
  }catch(e){if(n===generation)out.textContent='仮比較を保留：'+e.message;}
  finally{running=false;if(queued){queued=false;schedule();}}
 }
 function schedule(){inputNames();generation++;clearTimeout(timer);timer=setTimeout(()=>compare(),450);}
 window.auditMarks=()=>compare(true);refresh.addEventListener('click',()=>compare(true));
 document.getElementById('marks').addEventListener('input',schedule);document.getElementById('marks').addEventListener('change',schedule);
 document.getElementById('marks').addEventListener('click',e=>{if(e.target.closest('.markrow')||e.target.textContent.includes('印を追加'))schedule();});
 async function targetChanged(){generation++;cache=null;out.textContent='対象レースを切り替えました。初期印を付けて比較してください。';identity.textContent=label();const t=window.getLaboTarget?.(),k=key(t);names.innerHTML='';if(!t)return;try{const r=await fetch(api+'/v1/lab/expected-runners?date='+encodeURIComponent(t.date)+'&venue='+encodeURIComponent(t.venue)+'&race_no='+t.raceNo),d=await r.json();if(k===key(window.getLaboTarget?.())&&d.ok)names.innerHTML=d.runners.map(x=>'<option value="'+esc(x.horseName)+'"></option>').join('');}catch{} }
 window.addEventListener('labo-target-change',targetChanged);targetChanged();
})();
</script>`;
export default{async fetch(request,env,ctx){
 if(new URL(request.url).pathname==='/health')return Response.json({ok:true,service:'keiba-lab-app',version:VERSION,features:['touch-friendly-global-styles','precard-mark-db-preview','ireland-default-target','full-runner-initial-comparison','no-source-fetch-on-mark-change']},{headers:{'cache-control':'no-store'}});
 const r=await app.fetch(request,env,ctx);if(!r.ok||!r.headers.get('content-type')?.includes('text/html'))return r;
 return new Response((await r.text()).replace('<div class="k">サウジRC</div>','<div class="k">アイルランドT</div>').replace('</body>',enhancement+'</body>'),{status:r.status,headers:r.headers});
}};
