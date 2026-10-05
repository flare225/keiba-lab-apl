import app from './index-v1.1.js';
const VERSION='1.2.0';
const enhancement=String.raw`<script>
(()=>{
 const raceSection=document.getElementById('race');
 if(raceSection&&!document.getElementById('laboPredictionCurrent'))raceSection.insertAdjacentHTML('beforeend','<div class="section-title">LABO予想（事前LOCK）</div><div class="card" id="laboPredictionCurrent"><div class="notice">正式出馬表＋馬場＋preLOCK通過後に、結果を見ない事前予想だけを固定表示します。</div></div>');
 const history=document.getElementById('history');
 const marks=document.getElementById('historyMarks');
 if(history&&marks&&!document.getElementById('historyLaboPrediction'))marks.insertAdjacentHTML('beforebegin','<div class="section-title">LABO単独予想</div><div class="card" id="historyLaboPrediction"><div class="notice">発走前にProspective LOCKされたLABO予想だけを表示します。結果後の再計算は表示しません。</div></div>');
 function predHtml(p){
  if(!p?.available)return '<div class="notice">LABO事前予想LOCKなし。'+esc(p?.reason||'まだLOCKされていません。')+'</div>';
  const top=(p.top5||[]).map(x=>'<div class="row"><span><b style="font-size:20px">'+esc(x.mark||'')+'</b> '+x.horseNo+' '+esc(x.horseName)+'</span><span class="r">LABO '+x.rank+'位<br><small>'+esc(x.score==null?'score —':x.score+'pt')+'</small></span></div>').join('');
  return '<div class="history-meta"><span class="pill ok">事前LOCK済み</span><span class="pill">馬場 '+esc(p.trackCondition||'—')+'</span><span class="pill">SHA-256 '+(p.hashVerified?'✓':'—')+'</span></div>'+top+'<div class="notice">印ルール: '+esc(p.markPolicy?.rule||'')+'。順位・スコアは発走前のimmutable snapshot由来で、結果から作り直しません。</div>';
 }
 async function loadCurrentPrediction(){
  const box=document.getElementById('laboPredictionCurrent');if(!box)return;
  const track=document.getElementById('track')?.value||'';
  try{const q='/v1/lab/labo-prediction?date=2026-10-10&venue='+encodeURIComponent('東京')+'&race_no=11'+(track?'&track='+encodeURIComponent(track):'');const d=await get(q);box.innerHTML=predHtml(d.prediction)}catch(e){box.innerHTML='<div class="notice">LABO事前予想: LOCK前 / '+esc(e.message)+'</div>'}
 }
 const oldRefresh=window.refreshAll;window.refreshAll=async function(){await oldRefresh();await loadCurrentPrediction()};
 const oldLoadRace=window.loadRace;window.loadRace=async function(){await oldLoadRace();await loadCurrentPrediction()};
 window.loadHistoryDetail=async function(){
  const date=$('historyDate').value,v=$('historyRace').value;if(!date||!v){$('historyDetail').innerHTML='<div class="warn">レースを選択してください。</div>';return}
  const [venue,raceNo]=v.split('|');$('historyDetail').innerHTML='<div class="notice">DBから取得中…</div>';
  try{
   const d=await get('/v1/lab/history/race?date='+encodeURIComponent(date)+'&venue='+encodeURIComponent(venue)+'&race_no='+raceNo);
   $('historyTitle').textContent=d.race.date+' '+d.race.venue+d.race.raceNo+'R '+(d.race.raceName||'');
   const head='<div class="runner head"><span>馬番</span><span>馬名</span><span>着順</span><span>上り</span><span>人気</span></div>';
   const rs=d.runners.map(r=>'<div class="runner"><span>'+r.horseNo+'</span><span class="horse">'+esc(r.horseName)+'<br><small>'+esc(r.jockey||'')+'</small></span><span class="finish">'+esc(posText(r))+'</span><span>'+(r.last3f??'—')+'<br><small>'+esc(r.cornerPositions||'')+'</small></span><span>'+(r.popularity??'—')+'人気<br><small>'+(r.odds??'—')+'倍</small></span></div>').join('');
   $('historyDetail').innerHTML='<div class="history-meta"><span class="pill '+(d.result.complete?'ok':'warn')+'">結果 '+d.result.rows+'/'+d.race.runnerCount+'頭</span><span class="pill">read only</span></div><div class="scroll">'+head+rs+'</div>';
   $('historyLaboPrediction').innerHTML=predHtml(d.laboPrediction);
   $('historyMarks').innerHTML=d.markRevisions.length?d.markRevisions.map(rev=>'<div class="row"><span>'+esc(rev.phase)+' #'+rev.revisionNo+'<br><small>'+esc(rev.trackCondition||'馬場未指定')+'</small></span><span class="r">'+rev.marked.map(m=>esc(m.mark+m.horseName)+(m.laboRank?' / LABO '+m.laboRank+'位':'')).join('<br>')+'</span></div>').join(''):'<div class="notice">このレースには保存済みの哲平印revisionがありません。</div>';
  }catch(e){$('historyDetail').innerHTML='<div class="bad">'+esc(e.message)+'</div>';if($('historyLaboPrediction'))$('historyLaboPrediction').innerHTML='<div class="notice">LABO予想を取得できません。</div>'}
 };
 setTimeout(loadCurrentPrediction,0);
})();
</script>`;
export default{async fetch(request,env,ctx){
 const u=new URL(request.url);
 if(u.pathname==='/health')return new Response(JSON.stringify({ok:true,service:'keiba-lab-app',version:VERSION,features:['history-browser','immutable-labo-prediction-marks','human-mark-audit','saudi-rc-gates']}),{headers:{'content-type':'application/json; charset=UTF-8'}});
 const r=await app.fetch(request,env,ctx);if(!r.ok||!(r.headers.get('content-type')||'').includes('text/html'))return r;
 const body=await r.text();return new Response(body.replace('</body>',enhancement+'</body>'),{status:r.status,headers:r.headers});
}};
