export function lockedEvidenceLines(records,revision,raceKey,roster){
 const lock=revision?.userLock;
 if(!lock?.immutable)return ['事前LOCKの照合履歴：この保存版は事前LOCKされていません。'];
 if(lock.revisionId!==revision.revisionId)return ['事前LOCKの照合履歴：現在のDB改訂とLOCK版が異なるため表示を保留。'];
 if(!Array.isArray(records))throw Error('LOCK照合履歴の応答が不正です。');
 if(!records.length)return ['事前LOCKは確認済み。公式結果との照合履歴はまだDBに蓄積されていません。'];
 const e=records[0],n=roster.length;
 if(e.raceKey!==raceKey||e.phase!==revision.phase||e.revisionId!==revision.revisionId||e.lockSha256!==lock.snapshotSha256||e.guardrails?.savedScoresOnly!==true||e.guardrails.retrospectivePredictionCreated!==false||e.guardrails.automaticPromotion!==false||e.guardrails.validatedAccuracyClaimed!==false||!Array.isArray(e.rows)||e.rows.length!==n||new Set(e.rows.map(r=>r.horseNo)).size!==n||new Set(e.rows.map(r=>r.horseName)).size!==n||e.rows.some(r=>!roster.some(x=>x.horseNo===r.horseNo&&x.horseName===r.horseName)))throw Error('LOCK照合履歴と固定版・出走馬の対応を確認できません。');
 const terminal={scratched:'取消',excluded:'除外','did-not-finish':'中止',disqualified:'失格'};
 const lines=['【事前LOCK版と公式結果のDB照合履歴】','照合保存日時：'+(e.createdAt||'未確認'),'固定した評価を照合した履歴です。最新の評価への置換や、自動学習・精度確認済みの扱いはしません。'];
 let currentDiffers=false;
 for(const r of e.rows){
  const rank=Number.isInteger(r.referenceRank)&&r.referenceRank>0&&r.referenceRank<=n?r.referenceRank:null;
  const finish=r.finishStatus==='finished'&&Number.isInteger(r.finishPosition)&&r.finishPosition>0&&r.finishPosition<=n?r.finishPosition:null;
  if(!finish&&!terminal[r.finishStatus]||!finish&&r.finishPosition!==null||r.rankGap!==(finish&&rank?finish-rank:null))throw Error('LOCK照合履歴の着順・順位差を確認できません。');
  const current=roster.find(x=>x.horseNo===r.horseNo);
  if(current.finishPosition!==r.finishPosition||current.finishStatus!==r.finishStatus)currentDiffers=true;
  lines.push((r.referenceMark||'印保留')+' '+r.horseNo+'番 '+r.horseName+' / 固定順位 '+(rank?rank+'位':'未保存')+' / 自分 '+(r.userMark||'無印')+' → '+(terminal[r.finishStatus]||finish+'着')+(r.rankGap===null?'':' / 順位差 '+(r.rankGap>0?'+':'')+r.rankGap));
 }
 if(currentDiffers)lines.push('照合保存時の結果が、現在の公式結果と異なります。結果訂正後の照合履歴を確認してください。');
 return lines;
}
