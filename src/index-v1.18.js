import app from './index-v1.17.js';

const VERSION='1.18.0';
const enhancement=String.raw`
<style>
.replay-compare{
  margin:12px 0;
  padding:14px;
  border:1px solid var(--line);
  border-radius:14px;
  background:var(--panel);
  font-size:13px;
  line-height:1.6;
}
.compare-heading{
  display:flex;
  flex-wrap:wrap;
  justify-content:space-between;
  align-items:center;
  gap:6px 12px;
  margin-bottom:10px;
}
.compare-heading h3{margin:0;font-size:16px}
.compare-heading span{color:var(--muted);font-size:11px;font-weight:700}
.compare-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0 12px}
.compare-kpi{min-width:0;padding:9px 8px;border:1px solid var(--line);border-radius:11px;background:var(--soft);text-align:center}
.compare-kpi span{display:block;color:var(--muted);font-size:11px;font-weight:700}
.compare-kpi b{display:block;margin-top:2px;font-size:16px}
.compare-section-title{margin:12px 0 6px;font-size:12px;font-weight:800}
.compare-top3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.compare-top3-card{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 8px;align-items:center;padding:9px;border:1px solid var(--line);border-radius:11px;background:var(--soft)}
.compare-place{grid-row:1 / span 2;color:var(--ok);font-weight:900;font-size:14px}
.compare-top3-horse{overflow-wrap:anywhere;font-weight:800}
.compare-top3-last3f{color:var(--muted);font-size:12px;font-weight:700}
.compare-marks{display:grid;gap:5px}
.compare-mark{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 9px;border:1px solid var(--line);border-radius:10px;background:var(--soft)}
.compare-mark-symbol{font-weight:900;font-size:16px;text-align:center}
.compare-mark-horse{min-width:0;overflow-wrap:anywhere;font-weight:800}
.compare-mark-horse small{display:block;color:var(--muted);font-size:11px;font-weight:600}
.compare-mark-result{text-align:right}
.compare-mark-result b{display:block}
.compare-mark-result span{display:block;color:var(--muted);font-size:11px;font-weight:700}
.compare-coverage{margin-top:10px;padding:8px 10px;border-radius:10px;background:var(--soft);font-size:12px;font-weight:800}
.compare-note{margin-top:8px;color:var(--muted);font-size:11px}
.compare-wait{padding:10px;border-radius:10px;background:var(--soft);color:var(--muted)}
@media(max-width:560px){
  .replay-compare{padding:11px}
  .compare-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .compare-kpi:last-child{grid-column:1 / -1}
  .compare-top3{grid-template-columns:1fr}
  .compare-mark{grid-template-columns:26px minmax(0,1fr)}
  .compare-mark-result{grid-column:2;display:flex;justify-content:space-between;align-items:center;gap:8px;text-align:left}
  .compare-mark-result b,.compare-mark-result span{display:inline}
}
@media(prefers-reduced-motion:reduce){.replay-compare *{scroll-behavior:auto}}
</style>
<script>
(()=>{
 const body=document.getElementById('replayBody');
 const out=document.getElementById('replayComparisonBody');
 if(!body||!out)return;
 const escapeHtml=value=>String(value??'—').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const last3f=row=>row?.last3f==null?'未取得':Number(row.last3f).toFixed(1)+'秒';
 function render(data){
  const comparison=data?.comparison;
  if(!comparison?.available){
   out.innerHTML='<div class="compare-wait">'+escapeHtml(comparison?.reason||'結果比較データを待っています。')+'</div>';
   return;
  }
  const metrics=comparison.metrics||{};
  const marks=comparison.marks||[];
  const top3=comparison.actualTop3||[];
  const coverage=comparison.last3fCoverage||{};
  out.innerHTML=
   '<div class="compare-heading"><h3>🏁 レース結果との照合</h3><span>RESULT-BLIND REPLAY</span></div>'+
   '<div class="compare-grid">'+
    '<div class="compare-kpi"><span>本命の着順</span><b>'+escapeHtml(metrics.honmeiFinish==null?'—':metrics.honmeiFinish+'着')+'</b></div>'+
    '<div class="compare-kpi"><span>勝ち馬に印</span><b>'+(metrics.winnerMarked?'あり':'なし')+'</b></div>'+
    '<div class="compare-kpi"><span>印で実TOP3を捕捉</span><b>'+escapeHtml(metrics.top3MarkedCount??0)+' / 3頭</b></div>'+
   '</div>'+
   '<div class="compare-section-title">実際の上位3頭</div>'+
   '<div class="compare-top3" role="list">'+top3.map(row=>
    '<article class="compare-top3-card" role="listitem">'+
     '<span class="compare-place">'+escapeHtml(row.finishPosition+'着')+'</span>'+
     '<span class="compare-top3-horse">'+escapeHtml(row.horseNo+'番 '+row.horseName)+'</span>'+
     '<span class="compare-top3-last3f">上がり3F '+escapeHtml(last3f(row))+'</span>'+
    '</article>'
   ).join('')+'</div>'+
   '<div class="compare-section-title">REPLAYの印と着順</div>'+
   '<div class="compare-marks" role="list">'+marks.map(row=>
    '<div class="compare-mark" role="listitem">'+
     '<span class="compare-mark-symbol">'+escapeHtml(row.mark||'—')+'</span>'+
     '<span class="compare-mark-horse">'+escapeHtml(row.horseNo+'番 '+row.horseName)+'<small>REPLAY '+escapeHtml(row.predictedRank??'—')+'位</small></span>'+
     '<span class="compare-mark-result"><b>'+escapeHtml(row.finishPosition==null?'着順未取得':row.finishPosition+'着')+'</b><span>上がり3F '+escapeHtml(last3f(row))+'</span></span>'+
    '</div>'
   ).join('')+'</div>'+
   '<div class="compare-coverage">完走馬の上がり3F：'+escapeHtml(coverage.recorded??0)+' / '+escapeHtml(coverage.finishers??0)+'頭</div>'+
   '<div class="compare-note">印を固定した後の照合です。実着順・上がり3FはREPLAYのスコアに反映しません。</div>';
 }
 const previous=window.get;
 if(typeof previous==='function'){
  window.get=async function(path){
   const data=await previous(path);
   if(String(path).startsWith('/v1/lab/replay?'))render(data);
   return data;
  };
 }
})();
</script>`;
export default{
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname==='/health')return new Response(JSON.stringify({
   ok:true,service:'keiba-lab-app',version:VERSION,
   features:['result-blind-replay-ui','replay-prior-history-hydration-visible','replay-result-comparison-after-freeze','official-last3f-comparison','mobile-readable-result-cards','mainichi-okan-replay-preset','kyoto-daishoten-replay-preset']
  }),{headers:{'content-type':'application/json; charset=UTF-8','cache-control':'no-store'}});
  const response=await app.fetch(request,env,ctx);
  if(!response.ok||!(response.headers.get('content-type')||'').includes('text/html'))return response;
  const html=await response.text();
  return new Response(html.replace('</body>',enhancement+'</body>'),{status:response.status,headers:response.headers});
 }
};