import app from './index-v1.18.js';

const VERSION='1.19.0';
const enhancement=String.raw`
<style>
.precard-panel{margin:12px 0 4px;padding:14px;border:1px solid var(--line);border-radius:14px;background:linear-gradient(145deg,#112131,#0b151f);line-height:1.6}
.precard-title{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 12px;align-items:center}
.precard-title h3{margin:0;font-size:17px}
.precard-label{border:1px solid #8f7132;border-radius:999px;padding:3px 8px;color:#f0bd59;font-size:11px;font-weight:800}
.precard-explain{margin:8px 0;color:var(--muted);font-size:12px}
.precard-horses{display:grid;gap:10px;margin-top:10px}
.precard-horse{padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.precard-horse-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding-bottom:8px;border-bottom:1px solid var(--line)}
.precard-mark{font-size:18px;font-weight:900;color:var(--accent)}
.precard-horse-name{font-weight:850;overflow-wrap:anywhere}
.precard-starts{color:var(--muted);font-size:11px;text-align:right}
.precard-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:9px 0}
.precard-stat{padding:7px 4px;border-radius:9px;background:var(--soft);text-align:center}
.precard-stat small{display:block;color:var(--muted);font-size:10px}
.precard-stat b{font-size:14px}
.precard-race{padding:8px 0;border-top:1px solid #223141;font-size:12px}
.precard-race:first-child{border-top:0}
.precard-race-title{display:flex;justify-content:space-between;gap:8px;font-weight:750}
.precard-race-meta{color:var(--muted);font-size:11px}
.precard-missing{padding:9px;border-radius:9px;background:#2a2112;color:#f0bd59;font-size:12px}
.precard-empty{padding:10px;border-radius:9px;background:var(--soft);color:var(--muted);font-size:12px}
.precard-refresh-row{margin:10px 0}.precard-refresh-row .btn{width:100%;white-space:normal;line-height:1.4}.precard-guard{margin-top:10px;padding:9px 10px;border-radius:10px;background:#101d28;color:#c7d4e1;font-size:11px}
.precard-raw{margin-top:12px}
.precard-raw summary{color:var(--muted);font-size:12px;cursor:pointer}
.precard-raw .result{margin-top:8px}
@media(max-width:520px){.precard-panel{padding:11px}.precard-horse{padding:10px}.precard-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.precard-race-title{display:block}.precard-starts{max-width:45%}}
</style>
<script>
(()=>{
 const raw=document.getElementById('auditResult');
 if(!raw)return;
 const panel=document.createElement('div');
 panel.className='precard-panel';
 panel.innerHTML='<div class="precard-title"><h3>DBで仮比較</h3><span class="precard-label">想定馬・馬番未確定</span></div><p class="precard-explain">付けた印ごとに、対象日の前までのDB直近最大8走を表示します。上がり3F・走破時計・通過順を確認できます。履歴が少ない馬は不足のまま表示します。</p><div id="precardIdentity" class="precard-empty" aria-live="polite"></div><div class="precard-refresh-row"><button type="button" id="precardRefresh" class="btn secondary">JRA想定馬情報を更新して仮比較</button></div><div id="precardPreview" class="precard-empty" aria-live="polite">印を入力して「DBで再精査」を押すと、過去データを表示します。</div><div class="precard-guard">この欄は過去データの参考比較です。今回の予想スコアや印を作成・変更せず、馬の順位付け・正式予想・事前LOCKには使いません。対象レース当日以降の結果は参照しません。</div>';
 const details=document.createElement('details');
 details.className='precard-raw';
 details.innerHTML='<summary>監査データの詳細を表示</summary>';
 raw.parentNode.insertBefore(panel,raw.nextSibling);
 raw.parentNode.insertBefore(details,raw.nextSibling);
 details.appendChild(raw);
 const out=panel.querySelector('#precardPreview');
 const esc=value=>String(value??'—').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const val=(x,unit='')=>x==null?'未取得':esc(x)+unit;
 function render(data){
  if(!data?.ok){out.className='precard-missing';out.textContent=String(data?.error||'仮比較を取得できませんでした.').includes('pre-card runner context is not published/stored yet')?'想定馬情報がまだDBにありません。JRA公開後に「JRA想定馬情報を更新して仮比較」を押してください。':(data?.error||'仮比較を取得できませんでした。');return}
  const marked=data.audit?.marked||[];
  const evidence=data.audit?.historySidecar||[];
  if(!marked.length){out.className='precard-empty';out.textContent='監査対象の印がありません。';return}
  const byName=new Map(evidence.map(item=>[item.horseName,item]));
  out.className='precard-horses';
  out.innerHTML=marked.map(h=>{
   const e=byName.get(h.horseName);
   if(!e){
    return '<article class="precard-horse"><div class="precard-horse-head"><span><b class="precard-mark">'+esc(h.mark)+'</b>　<span class="precard-horse-name">'+esc(h.horseName)+'</span></span><span class="precard-starts">過去走データ未取得</span></div><div class="precard-missing">この馬のDB履歴を取得できませんでした。数値を補完せず、監査データで確認してください。</div></article>';
   }
   const s=e.summary||{},recent=e.recent||[];
   const stats='<div class="precard-stats">'+
    '<div class="precard-stat"><small>DB直近走</small><b>'+val(s.finishedStarts??s.storedStarts,'走')+'</b></div>'+
    '<div class="precard-stat"><small>勝利</small><b>'+val(s.wins,'回')+'</b></div>'+
    '<div class="precard-stat"><small>3着以内</small><b>'+val(s.top3,'回')+'</b></div>'+
    '<div class="precard-stat"><small>平均上がり3F</small><b>'+val(s.avgLast3f,'秒')+'</b></div></div>';
   const races=recent.slice(0,5).map(r=>'<div class="precard-race"><div class="precard-race-title"><span>'+esc(r.date||'日付不明')+' · '+esc(r.raceName||r.venue||'レース名未取得')+'</span><span>'+val(r.finish,'着')+'</span></div><div class="precard-race-meta">時計 '+val(r.timeSeconds,'秒')+'　/　通過 '+val(r.cornerPositions)+'　/　上がり3F '+val(r.last3f,'秒')+'</div></div>').join('');
   const empty=!recent.length?'<div class="precard-missing">対象日より前のDB履歴なし。未出走・未収録の区別はこのデータだけではできません。</div>':'';
   const sparse=Number(s.finishedStarts||s.storedStarts||0)<3?'<div class="precard-missing">履歴が3走未満のため参考量は少なめです。未取得項目をゼロ扱いしません。</div>':'';
   return '<article class="precard-horse"><div class="precard-horse-head"><span><b class="precard-mark">'+esc(h.mark)+'</b>　<span class="precard-horse-name">'+esc(h.horseName)+'</span></span><span class="precard-starts">'+val(s.finishedStarts??s.storedStarts,'走を集計')+'</span></div>'+stats+sparse+empty+(races?'<div>'+races+'</div>':'')+'</article>';
  }).join('');
  const identity=document.getElementById('precardIdentity');
  if(identity)identity.textContent=data.audit?.mode==='precard-context-only'?'JRAの出走想定馬情報との照合：一致。馬番・LABO順位・スコアは未確定です。':'公式カードとの照合済みデータです。';
 }
 const originalFetch=window.fetch.bind(window);
 const refreshButton=panel.querySelector('#precardRefresh');
 refreshButton?.addEventListener('click',async()=>{
  const identity=document.getElementById('precardIdentity');
  refreshButton.disabled=true;
  refreshButton.textContent='JRAの公開状況を確認中…';
  out.className='precard-empty';
  out.textContent='公式ページを確認して、公開済みなら想定馬情報をDBに取り込みます。';
  try{
   const response=await originalFetch('https://keiba-lab-api.sekai-no-bancyou.workers.dev/v1/lab/precard-context-ingest?race_key='+encodeURIComponent('2026-10-10:東京:11'));
   const result=await response.json();
   if(!result?.published){
    out.className='precard-missing';
    out.textContent=result?.status==='not-published'?'JRA公式ページは確認済みですが、出走馬情報はまだ公開予定表示です。公開後にもう一度押してください。':String(result?.error||result?.status||'想定馬情報をまだ取り込めませんでした。');
    return;
   }
   if(identity)identity.textContent='JRA出走想定馬情報をDBへ保存しました（'+String(result.parsedCount??result.saved??0)+'頭）。';
   const hasMarks=[...document.querySelectorAll('.markrow .horse')].some(input=>input.value.trim());
   if(hasMarks&&typeof window.auditMarks==='function')await window.auditMarks();
   else{out.className='precard-empty';out.textContent='想定馬情報を保存しました。印を入力して「DBで再精査」を押してください。'}
  }catch(error){
   out.className='precard-missing';
   out.textContent='想定馬情報の更新に失敗しました：'+String(error?.message||error);
  }finally{
   refreshButton.disabled=false;
   refreshButton.textContent='JRA想定馬情報を更新して仮比較';
  }
 });
 window.fetch=async(...args)=>{
  const url=String(args[0]?.url||args[0]||'');
  const isAudit=url.includes('/v1/lab/user-mark-audit')&&String(args[1]?.method||'GET').toUpperCase()==='POST';
  try{
   const response=await originalFetch(...args);
   if(isAudit){try{render(await response.clone().json())}catch{out.className='precard-missing';out.textContent='監査結果の読み込みに失敗しました。'}}
   return response;
  }catch(error){
   if(isAudit){out.className='precard-missing';out.textContent='API通信に失敗しました：'+String(error?.message||error)}
   throw error;
  }
 };
})();
</script>`;
export default{
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname==='/health')return new Response(JSON.stringify({
   ok:true,service:'keiba-lab-app',version:VERSION,
   features:['result-blind-replay-ui','precard-mark-db-preview','historical-last3f-corner-cards','missing-history-visible','replay-result-comparison-after-freeze','mobile-readable-result-cards','touch-friendly-global-styles','mainichi-okan-replay-preset','kyoto-daishoten-replay-preset']
  }),{headers:{'content-type':'application/json; charset=UTF-8','cache-control':'no-store'}});
  const response=await app.fetch(request,env,ctx);
  if(!response.ok||!(response.headers.get('content-type')||'').includes('text/html'))return response;
  const html=await response.text();
  return new Response(html.replace('</body>',enhancement+'</body>'),{status:response.status,headers:response.headers});
 }
};
