import app from './index-v1.19.js';
export const VERSION='1.21.2';
export function findComparedRunner(rows,mark){return rows.find(x=>mark.horseName?x.horseName===mark.horseName:mark.horseNo!=null&&x.horseNo===mark.horseNo);}
export function selectedExpectedMarks(roster,values={}){const allowed=new Set(['◎','○','▲','△','☆','注','消']);return roster.filter(name=>allowed.has(values[name])).map(horseName=>({horseName,mark:values[horseName]}));}
export function normalizeDraftMarks(marks){const allowed=new Set(['◎','○','▲','△','☆','注','消']);return (Array.isArray(marks)?marks:[]).filter(m=>m&&typeof m.horse==='string'&&m.horse.trim()&&allowed.has(m.mark)).slice(0,18).map(m=>({horse:m.horse.trim(),mark:m.mark}));}
export const enhancement=String.raw`
<style>
.controls[hidden],.marks[hidden],#expectedInlineRoster[hidden]{display:none!important}
.expected-inline-row{display:grid;grid-template-columns:minmax(0,1fr) 100px;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}.expected-inline-row label{font-size:16px;font-weight:750}.expected-inline-row select{width:100%;min-height:46px}.expected-inline-list{margin:12px 0}.expected-inline-note{font-size:13px;line-height:1.6;color:var(--muted)}
.labo-main-link{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.labo-main-link a{display:block;padding:12px;border:1px solid var(--line);border-radius:12px;color:var(--accent);text-decoration:none}
.labo-pool{margin-top:12px;min-width:0}.labo-pool h4{margin:0 0 10px;font-size:15px}.labo-pool-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.labo-pool-card{min-width:0;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}.labo-pool-card h5{margin:0 0 10px;font-size:16px;overflow-wrap:anywhere}.labo-pool-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0}.labo-pool-stats div{min-width:0;text-align:center;padding:8px 2px;border-radius:8px;background:#0a131c}.labo-pool-stats dt{font-size:12px;color:var(--muted)}.labo-pool-stats dd{margin:3px 0 0;font-size:16px;font-weight:750;overflow-wrap:anywhere}
.wrap{min-width:0}section,.card,.precard-panel,.precard-horses,.precard-horse,.expected-inline-list{min-width:0;max-width:100%}.card,.precard-panel,.expected-inline-row label,.prodmeta{overflow-wrap:anywhere}.expected-inline-row label{min-width:0}.result{overflow-wrap:anywhere;white-space:pre-wrap}.controls>*{min-width:0;max-width:100%}
@media(max-width:600px){.labo-pool-list{grid-template-columns:minmax(0,1fr)}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.markrow{grid-template-columns:64px minmax(0,1fr) 64px;gap:6px}.expected-inline-row{grid-template-columns:minmax(0,1fr) 86px;gap:8px}.row{flex-wrap:wrap}.row>*{min-width:0;max-width:100%}.row .r{max-width:100%;text-align:left}select{max-width:100%}.decision-grid{grid-template-columns:minmax(0,1fr)}}
.labo-comparison-title{font-weight:800;font-size:16px;margin:8px 0}.precard-race-meta{font-size:13px}.precard-explain,.precard-guard{font-size:13px}
</style>
<script>
(()=>{
 const findComparedRunner=${findComparedRunner.toString()};
 const selectedExpectedMarks=${selectedExpectedMarks.toString()};
 const normalizeDraftMarks=${normalizeDraftMarks.toString()};
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
 const manualRows=document.getElementById('markRows'),markCard=manualRows.parentElement,rosterBox=document.createElement('div');rosterBox.id='expectedInlineRoster';manualRows.before(rosterBox);
 let roster=[],rosterKey='',rosterSnapshot='',rosterSequence=0;
 const phaseInput=document.getElementById('phase'),trackInput=document.getElementById('markTrack');
 const carryBox=document.createElement('div');carryBox.className='controls';carryBox.innerHTML='<button type="button" class="btn secondary" id="carryMarkDraft">初期印を下書きへ引き継ぐ</button><p class="notice" id="markDraftNotice"></p>';manualRows.before(carryBox);
 const carryButton=carryBox.querySelector('button'),draftNotice=carryBox.querySelector('p');let draftKey='',draftPhase=phaseInput.value,draftStorageFailed=false;
 const draftStorageKey=(k,p)=>'keiba-labo:mark-draft:v1:'+k+'|'+p;
 function manualDraft(){return normalizeDraftMarks([...manualRows.querySelectorAll('.markrow')].map(r=>({horse:r.querySelector('.horse').value,mark:r.querySelector('.mk').value})));}
 function readDraft(k,p){try{const d=JSON.parse(localStorage.getItem(draftStorageKey(k,p))||'null');return d&&typeof d==='object'?{marks:normalizeDraftMarks(d.marks),track:['良','稍重','重','不良'].includes(d.track)?d.track:''}:null;}catch{return null;}}
 function saveDraft(){if(!draftKey||draftPhase==='initial')return;try{localStorage.setItem(draftStorageKey(draftKey,draftPhase),JSON.stringify({marks:manualDraft(),track:trackInput.value}));draftStorageFailed=false;}catch{draftStorageFailed=true;}}
 function fillDraft(items){manualRows.replaceChildren();const entries=items.length?items:[{horse:'',mark:'◎'},{horse:'',mark:'◎'}];for(const m of entries){window.addMarkRow();const row=manualRows.lastElementChild;row.querySelector('.horse').value=m.horse;row.querySelector('.mk').value=m.mark;}inputNames();}
 function syncDraftContext(){const k=key(window.getLaboTarget?.()),p=phaseInput.value;if(k===draftKey&&p===draftPhase)return;saveDraft();draftKey=k;draftPhase=p;if(p!=='initial'){const d=readDraft(k,p);fillDraft(d?.marks||[]);trackInput.value=d?.track||'';out.textContent='下書きを表示中。正式出馬表との照合は「DBで再精査」で確認してください。';document.getElementById('auditResult').textContent='この段階の下書きは未監査です。';}else{out.textContent='想定表で初期印を選ぶと、自動で仮比較します。';}}
 function carrySource(){if(draftPhase==='final'){const d=readDraft(draftKey,'post_draw');if(d?.marks.length)return{phase:'枠順後',marks:d.marks};}return{phase:'初期',marks:rosterKey===draftKey?selectedExpectedMarks(roster,savedValues()).map(m=>({horse:m.horseName,mark:m.mark})):[]};}
 function showDraft(){carryBox.hidden=initial();if(initial())return;const source=carrySource(),filled=manualDraft().length>0;carryButton.textContent=source.phase+'印を下書きへ引き継ぐ';carryButton.disabled=filled||!source.marks.length;draftNotice.textContent=draftStorageFailed?'このブラウザへの下書き保存ができません。印を控えてください。':filled?'下書きをこのブラウザに保存。正式出馬表との照合は「DBで再精査」で確認します。':'入力済みの印は上書きしません。引継ぎは下書きのみで、正式保存・事前LOCKは行いません。';}
 carryButton.addEventListener('click',()=>{syncDraftContext();if(manualDraft().length)return;const source=carrySource();if(!source.marks.length)return;fillDraft(source.marks);saveDraft();showDraft();showMode();out.textContent=source.phase+'印を下書きへ引き継ぎました。正式出馬表との照合は未確認です。';});

 const storageKey=()=> 'keiba-labo:expected-marks:v1:'+rosterKey;
 const values=()=>Object.fromEntries([...rosterBox.querySelectorAll('select[data-horse-name]')].map(s=>[s.dataset.horseName,s.value]));
 function showMode(){const inline=initial()&&roster.length>0;rosterBox.hidden=!initial();manualRows.hidden=inline;const add=[...markCard.querySelectorAll('button')].find(b=>b.textContent.includes('印を追加'));if(add)add.hidden=inline;const notice=markCard.querySelector('.notice');if(notice)notice.textContent=inline?'想定表の馬名の脇で印を選ぶと、自動でDBの仮比較が出ます。枠・馬番は未確定です。':'馬番または馬名を入力して印を付けてください。正式な印保存は出馬表と照合します。';}
 function savedValues(){try{const d=JSON.parse(localStorage.getItem(storageKey())||'{}');return d&&typeof d.marks==='object'&&d.marks!==null?d.marks:{};}catch{return {};}}
 function saveInline(){if(!initial()||!roster.length)return;try{localStorage.setItem(storageKey(),JSON.stringify({snapshotId:rosterSnapshot,marks:Object.fromEntries(selectedExpectedMarks(roster,values()).map(m=>[m.horseName,m.mark]))}));}catch{const note=rosterBox.querySelector('.expected-inline-note');if(note)note.textContent='このブラウザへの保存ができませんでした。画面を閉じる前に印を控えてください。';}}
 function drawRoster(d){roster=d.runners.map(x=>x.horseName).filter(x=>typeof x==='string').sort((a,b)=>a.localeCompare(b,'ja'));rosterSnapshot=d.source.snapshotId;const stored=savedValues();rosterBox.innerHTML='<h3>出走想定表 · '+esc(label())+'</h3><p class="expected-inline-note">登録'+roster.length+'頭・出走確定前。馬名入力は不要です。印はこのブラウザに保存し、正式な印保存・事前LOCKは行いません。</p><div class="expected-inline-list">'+roster.map((name,i)=>'<div class="expected-inline-row"><label for="expectedMark'+i+'">'+esc(name)+'</label><select id="expectedMark'+i+'" data-horse-name="'+esc(name)+'" aria-label="'+esc(name)+'の初期印">'+['','◎','○','▲','△','☆','注','消'].map(m=>'<option value="'+m+'"'+(stored[name]===m?' selected':'')+'>'+ (m||'未指定')+'</option>').join('')+'</select></div>').join('')+'</div>';showMode();showDraft();if(initial()&&marks().length)schedule();}

 function marks(){if(initial()&&roster.length&&rosterKey===key(window.getLaboTarget?.()))return selectedExpectedMarks(roster,values());return [...document.querySelectorAll('.markrow')].map(r=>{const name=r.querySelector('.horse').value.trim(),mark=r.querySelector('.mk').value;return !name?null:/^\d+$/.test(name)?{horseNo:Number(name),mark}:{horseName:name,mark};}).filter(Boolean);}
 function render(d,human){
  const a=d.assessment||{},rows=a.allRunners||[],evidence=new Map((d.audit?.historySidecar||[]).map(x=>[x.horseName,x]));
  out.className='precard-horses';
  out.innerHTML='<div class="labo-comparison-title">'+esc(label())+'</div><p>全'+value(a.runnerPool)+'頭中 '+value(a.scoredRunners)+'頭を仮評価。参考指数・馬場未指定なら馬場評価を保留。</p>'+human.map(m=>{
   const r=findComparedRunner(rows,m),a=r?.assessment||{},h=evidence.get(r?.horseName||m.horseName);
   return '<article class="precard-horse"><b>'+esc(m.mark)+' '+esc(r?.horseName||m.horseName||m.horseNo)+'</b><p>参考指数 '+value(a.evidenceScore)+' / 100 · 参考順位 '+value(r?.referenceRank,'位')+'</p>'+(h?.recent?.length?'<details><summary>根拠の過去走 '+h.recent.length+'走を見る</summary>'+h.recent.map(x=>'<div class="precard-race"><b>'+esc(x.date)+' '+esc(x.venue)+' '+esc(x.raceName)+' · '+value(x.finish,'着')+'</b><div class="precard-race-meta">'+esc(x.surface)+' '+value(x.distance,'m')+' / 時計 '+value(x.time)+'<br>通過 '+value(x.cornerPositions)+' / 上がり3F '+value(x.last3f,'秒')+'</div></div>').join('')+'</details>':'<p>履歴未取得・比較保留</p>')+'</article>';
  }).join('')+'<div class="labo-pool"><h4>全馬の参考評価（印は点数に使いません）</h4><div class="labo-pool-list" role="list">'+rows.map(r=>'<article class="labo-pool-card" role="listitem"><h5>'+esc(r.horseName)+'</h5><dl class="labo-pool-stats"><div><dt>参考順位</dt><dd>'+value(r.referenceRank,'位')+'</dd></div><div><dt>参考指数</dt><dd>'+value(r.assessment?.evidenceScore)+'</dd></div><div><dt>過去走</dt><dd>'+value(r.assessment?.historyRows,'走')+'</dd></div></dl></article>').join('')+'</div></div>';
  identity.textContent=label()+' / 保存済みDBから比較。枠・馬番は正式出馬表で確認します。';
 }
 async function compare(force=false){
  if(!initial()){if(force)await window.auditOfficialMarks?.();return;}
  const t=window.getLaboTarget?.(),human=marks();if(!t){out.textContent='対象レースを取得中です。';return;}
  if(!human.length){out.textContent='想定表で初期印を選ぶと、自動で仮比較します。';return;}
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
 function schedule(){syncDraftContext();showMode();saveInline();saveDraft();showDraft();inputNames();generation++;clearTimeout(timer);timer=setTimeout(()=>compare(),450);}
 window.auditMarks=()=>compare(true);refresh.addEventListener('click',()=>compare(true));
 document.getElementById('marks').addEventListener('input',schedule);document.getElementById('marks').addEventListener('change',schedule);
 document.getElementById('marks').addEventListener('click',e=>{if(e.target.closest('.markrow')||e.target.textContent.includes('印を追加'))queueMicrotask(schedule);});
 async function targetChanged(){syncDraftContext();showDraft();const t=window.getLaboTarget?.(),k=key(t);if(k&&k===rosterKey&&roster.length){identity.textContent=label();return;}generation++;cache=null;const seq=++rosterSequence;roster=[];rosterKey=k;names.innerHTML='';rosterBox.innerHTML='<p class="expected-inline-note">保存済みの想定表を読み込み中…</p>';showMode();out.textContent='対象レースを切り替えました。初期印を付けて比較してください。';identity.textContent=label();if(!t)return;try{const r=await fetch(api+'/v1/lab/expected-runners?date='+encodeURIComponent(t.date)+'&venue='+encodeURIComponent(t.venue)+'&race_no='+t.raceNo),d=await r.json();if(seq!==rosterSequence||k!==key(window.getLaboTarget?.()))return;if(!r.ok||!d.ok||!Array.isArray(d.runners)||!d.runners.length)throw Error(d.error||'想定表は未保存です。');names.innerHTML=d.runners.map(x=>'<option value="'+esc(x.horseName)+'"></option>').join('');drawRoster(d);}catch(e){if(seq===rosterSequence){rosterBox.textContent='想定表を確認できません：'+e.message;showMode();}} }
 window.addEventListener('labo-target-change',targetChanged);targetChanged();
})();
</script>`;
export default{async fetch(request,env,ctx){
 if(new URL(request.url).pathname==='/health')return Response.json({ok:true,service:'keiba-lab-app',version:VERSION,features:['touch-friendly-global-styles','precard-mark-db-preview','ireland-default-target','full-runner-initial-comparison','no-source-fetch-on-mark-change','expected-roster-inline-marks','browser-local-initial-marks','vertical-runner-comparison-cards','phase-draft-carryover']},{headers:{'cache-control':'no-store'}});
 const r=await app.fetch(request,env,ctx);if(!r.ok||!r.headers.get('content-type')?.includes('text/html'))return r;
 return new Response((await r.text()).replace('<div class="k">サウジRC</div>','<div class="k">アイルランドT</div>').replace('</body>',enhancement+'</body>'),{status:r.status,headers:r.headers});
}};
