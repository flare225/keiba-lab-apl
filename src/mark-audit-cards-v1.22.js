const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const has=x=>x!==null&&x!==undefined&&x!=='';
const number=x=>has(x)&&typeof x==='number'&&Number.isFinite(x)?String(x):'未取得';
const alignmentLabels={aligned:'概ね一致',watch:'再確認',conflict:'評価に食い違い',unscored:'LABO評価未取得'};
const alignmentDescriptions={
 '◎ inside LABO top 3':'◎はLABO上位3位以内','◎ outside LABO top 3':'◎はLABO上位3位の圏外','◎ is LABO rank 7+':'◎はLABO7位以下',
 '○ inside LABO top 4':'○はLABO上位4位以内','○ outside LABO top 4':'○はLABO上位4位の圏外','○ is LABO rank 8+':'○はLABO8位以下',
 'LABO rank unavailable':'LABO順位の保存データなし',
 '消 conflicts with LABO top 4':'消した馬がLABO上位4位に入っています','消 removes LABO top 7':'消した馬がLABO上位7位に入っています','消 outside LABO top 7':'消した馬はLABO8位以下'
};
const warningDescriptions={
 'zero-pre-race-history':'過去走データなし','one-pre-race-history':'過去走が1走のみ',
 'low-base-confidence':'基礎評価の信頼度が低い','integrated-model-snapshot-missing':'LABO統合評価が未保存'
};
export function describeAuditAlignment(row={}){
 const level=row.alignment?.level||'unscored';
 return {level:alignmentLabels[level]?level:'unscored',label:alignmentLabels[level]||'LABO評価未取得',
  reason:alignmentDescriptions[row.alignment?.reason]||(/^([△☆注]) inside LABO top 8$/.test(row.alignment?.reason||'')?row.mark+'はLABO上位8位以内':/^([△☆注]) outside LABO top 8$/.test(row.alignment?.reason||'')?row.mark+'はLABO上位8位の圏外':level==='unscored'?'保存済みLABO順位を取得できません':'印と順位の照合結果')};
}
export function summarizeMarkAudit(data={}){
 const audit=data&&typeof data.audit==='object'?data.audit:{};
 const marked=Array.isArray(audit.marked)?audit.marked:[];
 const counted={aligned:0,watch:0,conflict:0,unscored:0};
 for(const row of marked)counted[describeAuditAlignment(row).level]++;
 const candidates=Array.isArray(audit.unmarkedTopCandidates)?audit.unmarkedTopCandidates:[];
 const coverage=typeof audit.modelCoveragePct==='number'&&Number.isFinite(audit.modelCoveragePct)?audit.modelCoveragePct:null;
 const mode=audit.mode==='official-card-model-crosscheck'?'official':audit.mode==='precard-context-only'?'precard':data.assessment?'initial-preview':'unknown';
 return {ok:data.ok===true,mode,counted,marked,candidates,coverage,track:has(audit.trackAssumption)?audit.trackAssumption:null,
  phase:data.phase||null,ready:audit.decisionReady===true,race:data.race||{},error:data.error||null};
}
export function renderMarkAuditCards(data={},opts={}){
 const d=summarizeMarkAudit(data),title=d.race?.raceName||opts.raceName||'対象レース',phase=d.phase==='final'?'最終印':d.phase==='post_draw'?'枠順後':d.phase==='initial'?'初期印':'印の照合';
 const topline='<div class="audit-readable-heading"><div><h3>'+esc(title)+'</h3><p>'+esc(phase)+'とDBの照合</p></div><span class="audit-readable-pill">'+(d.ok?'照合応答あり':'要確認')+'</span></div>';
 const note='<p class="audit-readable-disclaimer">LABO参考点・順位は保存済みの評価です。印でスコアは変わりません。照合成功は的中率の保証や事前LOCK完了を意味しません。</p>';
 if(!d.ok)return '<div class="audit-readable">'+topline+'<p class="audit-readable-warning" role="alert">監査を完了できませんでした：'+esc(d.error||'サーバーの応答を確認してください。')+'</p><p>以前の結果は表示していません。出馬表や馬場想定を確認して再試行してください。</p></div>';
 if(d.mode==='initial-preview'){
  const count=Number(data.assessment?.runnerPool)||null;
  return '<div class="audit-readable">'+topline+'<p class="audit-readable-warning">初期印の過去走比較です。公式枠順・馬番を使ったLABO総合順位の確定照合ではありません。</p>'+(count?'<p>比較対象 '+esc(count)+'頭（保存済み想定馬）</p>':'')+note+'<button type="button" class="btn secondary" data-audit-open-bets>買い目タブを見る</button></div>';
 }
 if(!d.marked.length)return '<div class="audit-readable">'+topline+'<p class="audit-readable-warning">印がまだありません。印タブで馬を選び、DBで再精査してください。</p>'+note+'</div>';
 const rankSummary=d.mode==='official'
  ?'<div class="audit-readable-stats"><div><small>印を付けた馬</small><b>'+d.marked.length+'頭</b></div><div><small>概ね一致</small><b>'+d.counted.aligned+'頭</b></div><div><small>再確認・食い違い</small><b>'+(d.counted.watch+d.counted.conflict)+'頭</b></div><div><small>LABO評価未取得</small><b>'+d.counted.unscored+'頭</b></div></div>'
  :'<p class="audit-readable-warning">正式出馬表との照合前です。初期印の下書きとしてのみ表示しています。</p>';
 const coverage=d.coverage===null?'':'<p class="audit-readable-meta">統合評価の保存カバー率：'+esc(d.coverage)+'%　'+(d.track?'馬場想定：'+esc(d.track):'馬場想定：未指定')+'</p>';
 const inputWarnings=Array.isArray(data.inputWarnings)?data.inputWarnings:[];
 const repeated=inputWarnings.filter(x=>/^multiple-[◎○]-marks$/.test(x));
 const repeatedNote=repeated.length?'<p class="audit-readable-warning">入力確認：'+repeated.map(x=>esc(x.replace('multiple-',''))+'の印が複数あります').join(' ／ ')+'。印の重複を確認してください。</p>':'';
 const unsaved=d.mode==='official'&&(d.counted.unscored||d.coverage!==null&&d.coverage<100)
  ?'<p class="audit-readable-warning">評価データに未取得があります。未取得は0点として扱わず、印の食い違いも確定判定しません。</p>':'';
 const markRows=d.marked.map(row=>{
  const align=describeAuditAlignment(row),profile=row.profile||{},history=row.evidence?.historyRows;
  const position=Number.isInteger(Number(row.horseNo))&&row.horseNo!=null?((Number.isInteger(Number(profile.frameNo))&&profile.frameNo!=null?esc(profile.frameNo)+'枠 ':'')+esc(row.horseNo)+'番'):'馬番未確認';
  const rank=has(row.laboRank)&&Number.isFinite(Number(row.laboRank))?esc(row.laboRank)+'位':'未取得';
  const score=number(row.laboScore);
  const warnings=Array.isArray(row.warnings)?row.warnings:[];
  const reason=align.reason;
  return '<article class="audit-readable-horse audit-level-'+esc(align.level)+'"><div class="audit-readable-horse-head"><span class="audit-readable-mark">'+esc(row.mark||'—')+'</span><div class="audit-readable-horse-name"><b>'+esc(row.horseName||'馬名未取得')+'</b><small>'+position+'</small></div><span class="audit-readable-status">'+esc(align.label)+'</span></div><div class="audit-readable-metrics"><span>LABO順位 <strong>'+rank+'</strong></span><span>参考点 <strong>'+score+'</strong></span><span>過去走 <strong>'+((typeof history==='number'&&Number.isFinite(history))?esc(history)+'走':'未取得')+'</strong></span></div><p class="audit-readable-reason">'+esc(reason)+'</p>'+(warnings.length?'<p class="audit-readable-flags">不足・注意：'+warnings.map(x=>esc(warningDescriptions[x]||x)).join(' ／ ')+'</p>':'')+'</article>';
 }).join('');
 const candidates=d.mode==='official'&&d.candidates.length?'<div class="audit-readable-candidates"><h4>印を付けていないLABO上位候補</h4><p class="audit-readable-meta">未選択馬の参考情報です。買い推奨や的中保証ではありません。</p>'+d.candidates.map(r=>'<div class="audit-readable-candidate"><b>'+esc(r.horseNo??'?')+'番 '+esc(r.horseName||'馬名未取得')+'</b><span>'+((typeof r.laboRank==='number')?'LABO '+esc(r.laboRank)+'位':'順位未取得')+' ／ '+number(r.laboScore)+'点</span></div>').join('')+'</div>':'';
 const readiness=d.mode==='official'&&!d.ready?'<p class="audit-readable-meta">正式な再精査・事前LOCKの準備完了は、この画面では確認できていません。</p>':'';
 return '<div class="audit-readable">'+topline+rankSummary+coverage+repeatedNote+unsaved+'<div class="audit-readable-list">'+markRows+'</div>'+candidates+readiness+note+'<div class="audit-readable-actions"><button type="button" class="btn secondary" data-audit-open-bets>買い目構築へ</button></div></div>';
}
