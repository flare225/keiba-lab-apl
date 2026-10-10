const escapeReview=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finiteReview=n=>typeof n==='number'&&Number.isFinite(n);
const DISPLAY_MARKS=['◎','○','▲','△','△','☆','☆','☆'];
export function assignIndependentLaboMarks(rows=[],pool=0,scored=0){
 const complete=pool>=2&&scored===pool&&rows.length===pool;
 const marks=new Map();
 for(const r of rows){
  const a=r?.assessment||{},rank=r?.referenceRank,ties=r?.tiedCount;
  // Never mark an incomplete field, invalid evidence, or tied horses as decided picks.
  const reliable=complete&&a.available===true&&Number(a.validFinishRows)>=3&&finiteReview(a.evidenceScore)&&Number.isInteger(rank)&&rank>=1&&Number.isInteger(ties)&&ties===1;
  marks.set(r.horseName,reliable?(DISPLAY_MARKS[rank-1]||'—'):'保留');
 }
 return {complete,marks,scored,pool};
}
export function buildIndependentLaboReview(data,humanMarks=[],numbers={}){
 if(!data?.ok||!Array.isArray(data?.assessment?.allRunners))throw Error('全馬の参考評価を取得できませんでした。');
 const a=data.assessment,all=a.allRunners;
 if(!Number.isInteger(a.runnerPool)||all.length!==a.runnerPool||all.length<1||all.length>18||new Set(all.map(r=>r.horseName)).size!==all.length)
  throw Error('出走馬全員の評価を照合できません。');
 if(a.guardrails?.humanMarksUsedInScore!==false||a.guardrails?.targetResultUsed!==false)
  throw Error('独立評価の安全条件を確認できません。');
 const assigned=assignIndependentLaboMarks(all,a.runnerPool,a.scoredRunners),human=new Map(humanMarks.map(m=>[m.horseName,m.mark]));
 const rows=all.map(r=>{
  const source=numbers[r.horseName]||{},lab=assigned.marks.get(r.horseName),own=human.get(r.horseName)||'—';
  const score=finiteReview(r.assessment?.evidenceScore)?r.assessment.evidenceScore:null;
  const rank=Number.isInteger(r.referenceRank)&&score!==null?r.referenceRank:null;
  return {name:r.horseName,horseNo:source.verified?source.horseNo:null,frameNo:source.verified?source.frameNo:null,
   laboMark:lab,rank,score,tiedCount:r.tiedCount||1,humanMark:own,
   comparison:own==='—'?'印なし':lab==='保留'?'評価保留':lab==='—'?'LABO選外':lab===own?'印が一致':'評価が異なる',
   historyRows:r.assessment?.validFinishRows??null};
 });
 return{...assigned,rows:rows.sort((x,y)=>(x.rank??999)-(y.rank??999)||x.name.localeCompare(y.name,'ja')),
  track:a.trackAssumption||null,modelVersion:a.modelVersion||'過去走ベースの参考評価',sourceDate:data.race?.date||null};
}
export function renderIndependentLaboReview(review){
 const esc=escapeReview;
 const summary='<p class="notice">これはLABOが<strong>人間の印を計算に使わず</strong>過去走から出した「参考仮印」です。正式な統合モデル順位・学習候補の実戦成績・馬券推奨とは区別します。</p>'+
  '<p>評価対象 '+review.scored+'/'+review.pool+'頭 ／ 想定馬場：'+esc(review.track||'未指定')+'</p>'+
  (!review.complete?'<p class="notice">全馬の履歴評価がそろっていません。参考順位は表示しますが、LABO仮印はすべて保留します。</p>':'<p class="notice">同点・有効着順3走未満の馬は仮印を保留します。予想印の並びは仮の評価ルールで、的中率を保証しません。</p>');
 return summary+'<div class="labo-review-scroll"><table class="labo-review-table"><thead><tr><th>馬番・馬名</th><th>LABO仮印</th><th>参考順位・点</th><th>自分の印</th><th>比較</th></tr></thead><tbody>'+
  review.rows.map(r=>'<tr><th>'+(r.horseNo?esc(r.frameNo)+'枠 '+esc(r.horseNo)+'番 ':'')+esc(r.name)+'</th>'+
    '<td><strong>'+esc(r.laboMark)+'</strong></td>'+
    '<td>'+(r.rank===null?'未取得':esc(r.rank)+'位'+(r.tiedCount>1?'（同点）':''))+' / '+(r.score===null?'未取得':esc(r.score)+'点')+'</td>'+
    '<td>'+esc(r.humanMark)+'</td><td>'+esc(r.comparison)+'</td></tr>').join('')+'</tbody></table></div>';
}
export function mountIndependentLaboReview({document,window,getCurrent,api,fetcher=fetch,now=Date.now}){
 const root=document.getElementById('independentLaboReview'),status=document.getElementById('independentLaboReviewStatus'),
  content=document.getElementById('independentLaboReviewContent'),refresh=document.getElementById('independentLaboReviewRefresh');
 if(!root||!status||!content||!refresh)return;
 let request=0,currentKey='',last=null;
 const key=t=>t?.date+'|'+t?.venue+'|'+t?.raceNo;
 function render(){
  const c=getCurrent();if(!c?.target||!last||key(c.target)!==currentKey)return;
  try{content.innerHTML=renderIndependentLaboReview(buildIndependentLaboReview(last,c.state.marks,c.state.rosterNumbers));}
  catch(e){content.textContent='評価を表示できません：'+e.message;}
 }
 async function load(){
  const c=getCurrent(),n=++request;
  if(!c?.target||c.state.rosterVerified!==true||!c.state.roster?.length){
   status.textContent='JRA正式出馬表を読み込み中。馬名と馬番がそろってからLABO自身の評価を取得します。';
   content.textContent='';last=null;return;
  }
  const t=c.target,track=c.state.track||null;currentKey=key(t);
  refresh.disabled=true;status.textContent='LABO自身が全馬の過去走を参考評価中…（自分の印は計算に使いません）';
  try{
   // Legacy comparison requires a mark-shaped input. This dummy hint is NOT the user's selection;
   // backend guardrails reject mutation and scoring explicitly ignores it.
   const response=await fetcher(api+'/v1/lab/mark-comparison',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({date:t.date,venue:t.venue,raceNo:Number(t.raceNo),phase:'initial',...(track?{track}:{}),
     marks:[{horseName:c.state.roster[0],mark:'注'}]})});
   const data=await response.json();
   if(n!==request||key(getCurrent()?.target)!==currentKey)return;
   if(!response.ok||!data.ok)throw Error(data.error||'全馬の参考評価を取得できません。');
   last=data;const review=buildIndependentLaboReview(data,getCurrent().state.marks,getCurrent().state.rosterNumbers);
   content.innerHTML=renderIndependentLaboReview(review);
   status.textContent=review.complete?'LABO独自の参考仮印を表示（正式DB統合順位ではありません）':'履歴不足：参考順位のみ。LABO仮印は保留';
  }catch(e){if(n===request){last=null;content.textContent='';status.textContent='LABO独自評価は取得できません：'+e.message;}}
  finally{if(n===request)refresh.disabled=false;}
 }
 refresh.addEventListener('click',()=>{void load();});
 window.addEventListener('labo-target-change',()=>{++request;last=null;currentKey='';content.textContent='';status.textContent='新しいレースの出馬表を確認中…';});
 window.addEventListener('labo-roster-ready',()=>{void load();});
 window.addEventListener('labo-marks-changed',render);
 const track=document.getElementById('markTrack');
 track?.addEventListener('change',()=>{status.textContent='馬場想定を変更しました。LABO再精査で新しい条件の評価を取得してください。';last=null;content.textContent='';});
 const current=getCurrent();if(current?.state?.rosterVerified)void load();
}
