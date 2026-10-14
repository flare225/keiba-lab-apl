import {lockedEvidenceLines} from './locked-mark-evidence-view.js';
export function mountOwnerMarkSave({document,window,getCurrent,verifiedMarkPayload,initialLocalMarkPayload,applyDbMarks,fetcher=fetch,scheduleDelay=1600}){
 const el=id=>document.getElementById(id),root=el('ownerMarkDbControls');
 if(!root)return;
 const state=el('ownerMarkDbStatus'),password=el('ownerMarkPassword'),login=el('ownerMarkLogin'),
  logout=el('ownerMarkLogout'),save=el('ownerMarkSave'),restore=el('ownerMarkRestore'),loginRow=el('ownerMarkLoginRow'),lockButton=el('ownerMarkLock'),review=el('ownerMarkReview'),report=el('ownerMarkReviewReport');
 const recordText=rev=>{if(rev?.userLock?.immutable===true&&rev.userLock.revisionId===rev.revisionId&&rev.provenance?.integrityVerified===true)return 'このDB改訂は事前LOCK済みです（'+new Date(rev.userLock.lockedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})+'）。学習への採用は別工程です。';const p=rev?.provenance;if(p?.status==='retrospective')return '事後にDB保存した記録です。事前予想の精度実績には使いません。';if(p?.status==='verified-prior-day-record'&&p.integrityVerified===true)return '開催日前のDB記録を確認。事前LOCKとは別です。';if(p?.status==='race-day-time-unverified')return '開催当日のDB記録です。発走前の記録かは未確認です。';return '記録時刻・整合性の判定は未確認です。事前LOCKとして扱いません。';};
 let configured=false,authenticated=false,workerWriteTokenMatch=false,working=false,timer=null,lastSaved='',tokenError='',seq=0,pendingSaves=new Map();
 const current=()=>{const c=getCurrent();return c?.target?c:null;};
 const key=c=>[c.target.date,c.target.venue,c.target.raceNo,c.state.phase,c.state.track||'',JSON.stringify(c.state.marks)].join('|');
 const payload=c=>{
  if(c.state.phase!=='initial')return verifiedMarkPayload(c.target,c.state);
  const p=initialLocalMarkPayload(c.target,c.state);
  // Initial marks may predate official numbers. Add numbers only after JRA verification.
  if(c.state.rosterVerified!==true)return p;
  return {...p,marks:p.marks.map(m=>{
   const n=c.state.rosterNumbers?.[m.horseName];
   return n?.verified===true&&Number.isInteger(n.horseNo)?{...m,horseNo:n.horseNo}:m;
  })};
 };
 const update=()=>{
  const c=current();
  loginRow.hidden=!configured||authenticated;login.disabled=!configured||authenticated||working;
  logout.hidden=!authenticated;logout.disabled=working;save.disabled=!authenticated||working||!c||!c.state.marks.length;
  save.title=!authenticated?'初回の端末登録が必要です。':working?'保存・接続確認中です。':!c||!c.state.marks.length?'保存する印を選択してください。':!workerWriteTokenMatch?'クリックして保存接続を再確認します。':'現在の印をDBへ保存します。';
  restore.disabled=!authenticated||working||!c;if(review)review.disabled=!authenticated||working||!c;if(lockButton)lockButton.disabled=!authenticated||working||!c||c.state.phase==='initial';
 };
 const msg=x=>{state.textContent=x;update();};
 async function prepareCurrentDraft(){
  const c=current();if(!authenticated||!workerWriteTokenMatch||!c||!c.state.marks.length)return;
  const snapshot=key(c),q=new URLSearchParams({date:c.target.date,venue:c.target.venue,race_no:String(c.target.raceNo),phase:c.state.phase});
  try{
   const r=await fetcher('/v1/lab/user-marks?'+q,{credentials:'same-origin',cache:'no-store'});
   const d=await r.json();
   if(!r.ok||!d.ok||!Array.isArray(d.latest))throw Error(d.error||'DB履歴を確認できません。');
   if(!current()||key(current())!==snapshot)return;
   if(d.raceKey&&d.raceKey!==c.target.date+':'+c.target.venue+':'+c.target.raceNo)throw Error('別レースの履歴が返されました。');
   const existing=d.latest.find(x=>x.phase===c.state.phase);
   if(!existing?.entries?.length){msg('DBにこの段階の印はありません。画面の下書きを自動保存します。');queue(c);return;}
   const body={...payload(c),confirm:'SAVE'};
   if(matchesRemote(existing,body)){
    lastSaved=snapshot;
    msg('DB保存済み・現在の印と一致：改訂 '+existing.revisionNo+'版（'+existing.entries.length+'頭）。 '+recordText(existing));
    return;
   }
   msg('DBに別の印が保存されています。既存DB記録を上書きせず停止しました。「DBから保存済み印を復元」または「DBへ今すぐ保存」を選んでください。');
  }catch(e){
   if(current()&&key(current())===snapshot)msg('DB履歴を確認できないため自動保存を保留しました：'+e.message+'。印は端末内に残っています。');
  }
 }
 async function checkWorkerToken({prepare=true}={}){
  workerWriteTokenMatch=false;working=true;update();msg('VercelとCloudflareの保存トークンをDB書込なしで照合中…');
  try{
   const r=await fetcher('/v1/lab/user-mark-session',{method:'POST',credentials:'same-origin',
    headers:{'content-type':'application/json'},body:JSON.stringify({action:'check-worker-write-token'})});
   const d=await r.json();
   if(!r.ok||!d.ok)throw Error(d.error||'照合できません。');
   workerWriteTokenMatch=d.workerWriteTokenMatch===true;
   if(workerWriteTokenMatch){tokenError='';msg('保存トークン一致を確認しました（DB書込なし）。保存履歴を照合しています…');if(prepare)void prepareCurrentDraft();}
   else{tokenError='VercelとCloudflareの保存トークンが一致しません。サーバー設定の修正が必要です。';msg(tokenError+' DB書込は停止中です。「DBへ今すぐ保存」で再確認できます。');}
  }catch(e){workerWriteTokenMatch=false;tokenError='保存接続を確認できません：'+e.message;msg(tokenError+' DB書込は停止中です。「DBへ今すぐ保存」で再確認できます。');}
  finally{working=false;update();}
  return workerWriteTokenMatch;
 }
 async function session(){
  try{
   const resp=await fetcher('/v1/lab/user-mark-session',{credentials:'same-origin',cache:'no-store'});
   const d=await resp.json();if(!resp.ok||!d.ok)throw Error(d.error||'認証状態を確認できません。');
   configured=d.configured===true;authenticated=d.authenticated===true;update();
   if(authenticated){await checkWorkerToken();return;}
   msg(!configured?'DB正式保存：認証・サーバー接続設定が未完了。現在は端末内保存のみです。':
    'DB正式保存：初回の端末登録が必要です。本人用パスフレーズを一度入力すると、同じブラウザでは次回から入力不要です。');
  }catch(e){configured=false;authenticated=false;workerWriteTokenMatch=false;msg('DB正式保存：接続確認失敗。端末内の下書き・コピーを利用してください。');}
 }
 loginRow.addEventListener('submit',async(event)=>{
  event.preventDefault();
  if(!configured||working)return;
  const passphrase=password.value;working=true;update();msg('本人認証中…');
  try{
   const r=await fetcher('/v1/lab/user-mark-session',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({passphrase})});
   const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'認証できません。');
   authenticated=true;working=false;await checkWorkerToken();
  }catch(e){authenticated=false;workerWriteTokenMatch=false;msg('本人認証できません：'+e.message);}
  finally{password.value='';working=false;update();}
 });
 logout.addEventListener('click',async()=>{
  if(working)return;
  try{await fetcher('/v1/lab/user-mark-session',{method:'DELETE',credentials:'same-origin'});}catch{}
  authenticated=false;workerWriteTokenMatch=false;lastSaved='';if(timer!==null)clearTimeout(timer);timer=null;pendingSaves.clear();msg('この端末の登録を解除しました。再登録するまでDB正式保存は停止中です。');
 });
 const matchesRemote=(rev,body)=>{
  if(!rev||rev.phase!==body.phase||!Number.isInteger(rev.revisionNo)||rev.revisionNo<1)return false;
  if(body.track&&rev.trackCondition!==body.track)return false;
  if(body.phase!=='initial'&&(rev.trackCondition||'')!==(body.track||''))return false;
  const entries=rev.entries;
  if(!Array.isArray(entries)||entries.length!==body.marks.length)return false;
  const choices=new Map(body.marks.map(m=>[m.horseName,m])),seen=new Set();
  return entries.every(e=>{
   const name=e.horse_name??e.horseName,m=choices.get(name),no=e.horse_no??e.horseNo;
   if(!m||seen.has(name)||e.mark!==m.mark)return false;
   seen.add(name);
   return body.phase==='initial'||Number(no)===m.horseNo;
  });
 };
 async function persist(force=false,queued=null){
  const c=current();if(!authenticated||!workerWriteTokenMatch||working||(!c&&!queued))return;
  let body;try{body={...(queued?.body||payload(c)),confirm:'SAVE'};}catch(e){if(force&&c)msg('DBへ保存できません：'+e.message);return;}
  const snapshot=queued?.snapshot||key(c);if(!force&&snapshot===lastSaved)return;
  working=true;update();msg('DBへ保存中…（正式DBの再照合が終わるまで確定ではありません）');
  try{
   // Immutable revisions must not grow when the same draft is reopened, re-logged in or restored.
   const qs=new URLSearchParams({date:body.date,venue:body.venue,race_no:String(body.raceNo),phase:body.phase});
   const priorResp=await fetcher('/v1/lab/user-marks?'+qs,{credentials:'same-origin',cache:'no-store'});
   const prior=await priorResp.json();
   if(!priorResp.ok||!prior.ok||!Array.isArray(prior.latest))throw Error(prior.error||'既存DB保存履歴を確認できません。');
   if(prior.raceKey&&prior.raceKey!==body.date+':'+body.venue+':'+body.raceNo)throw Error('別レースの履歴が返されました。');
   const existing=prior.latest.find(x=>x.phase===body.phase);
   if(matchesRemote(existing,body)){
    if(key(current()||c)===snapshot){
     lastSaved=snapshot;
     msg('DB保存済み・既存履歴と一致：改訂 '+existing.revisionNo+'版（'+existing.entries.length+'頭）／DB保存日時 '+(existing.createdAt||'未取得')+'。新しい改訂は追加していません。 '+recordText(existing));
    }
    window.dispatchEvent(new Event('labo-mark-db-written'));
    return;
   }
   const r=await fetcher('/v1/lab/user-marks/save',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
   const d=await r.json();if(!r.ok||!d.ok||d.stage!=='db-written-readback-verified')throw Error(d.error||'保存を確認できません。');
   if(key(current()||c)===snapshot){
    lastSaved=snapshot;
    msg('DB保存済み・再照合成功：改訂 '+d.revisionNo+'版（'+d.entryCount+'頭）／DB保存日時 '+(d.savedAt||'未取得')+'／照合日時 '+d.verifiedAt+'。※レース前LOCK・学習完了の証明ではありません。');
   }
   window.dispatchEvent(new Event('labo-mark-db-written'));
  }catch(e){
   if(current()&&key(current())===snapshot)msg('DB保存を確認できません：'+e.message+'。端末下書きは残っています。');
  }finally{
   working=false;update();
   if(pendingSaves.size)scheduleFlush();
   else if(authenticated&&current()&&key(current())!==snapshot)queue();
  }
 }
 function scheduleFlush(){
  if(timer!==null)clearTimeout(timer);
  timer=setTimeout(()=>{timer=null;void flushNext();},Math.max(0,Number(scheduleDelay)||0));
 }
 async function flushNext(){
  if(working){scheduleFlush();return;}
  const next=pendingSaves.entries().next().value;
  if(!next)return;
  pendingSaves.delete(next[0]);
  await persist(false,next[1]);
  if(pendingSaves.size)scheduleFlush();
 }
 const queue=(c=current())=>{
  if(!authenticated||!workerWriteTokenMatch||!c||!Array.isArray(c.state?.marks)||!c.state.marks.length)return;
  let body;try{body=payload(c);}catch(e){if(current())msg('DBへ自動保存できません：'+e.message);return;}
  const id=[c.target.date,c.target.venue,c.target.raceNo,c.state.phase].join('|');
  pendingSaves.set(id,{snapshot:key(c),body});
  scheduleFlush();
 };
 save.addEventListener('click',async()=>{
  const c=current();if(!authenticated||working||!c||!c.state.marks.length)return;
  const snapshot=key(c);
  if(!workerWriteTokenMatch&&!(await checkWorkerToken({prepare:false})))return;
  if(!current()||key(current())!==snapshot){msg('接続確認中にレース・印が変更されました。現在の印で保存ボタンを押してください。');return;}
  pendingSaves.delete([c.target.date,c.target.venue,c.target.raceNo,c.state.phase].join('|'));
  if(timer!==null)clearTimeout(timer);timer=null;await persist(true);
 });
 window.addEventListener('labo-marks-changed',()=>{if(report)report.textContent='画面の印が変更されました。以下の照合はDB保存版を対象にします。保存後に再照合してください。';const c=current();if(authenticated&&c&&key(c)!==lastSaved){msg(workerWriteTokenMatch?'DB未保存：変更を検出しました。自動保存を開始します。':'DB未保存：保存トークンの確認が完了していません。');if(workerWriteTokenMatch)queue(c);}});
 window.addEventListener('labo-target-change',()=>{if(report)report.textContent='';lastSaved='';msg('対象レースを切り替えました。保存済み履歴と画面の印を確認しています…');void prepareCurrentDraft();});
 window.addEventListener('labo-roster-ready',()=>{update();});
 restore.addEventListener('click',async()=>{
  const c=current();if(!authenticated||working||!c)return;
  if(!window.confirm('現在の画面の印を、正式DBに保存された印で置き換えます。よろしいですか？'))return;
  const stamp=key(c),q=new URLSearchParams({date:c.target.date,venue:c.target.venue,race_no:String(c.target.raceNo),phase:c.state.phase});
  working=true;update();msg('正式DBから保存済み印を確認中…');
  try{
   const r=await fetcher('/v1/lab/user-marks?'+q,{credentials:'same-origin',cache:'no-store'});
   const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'保存データを読み込めません。');
   const expectedRaceKey=c.target.date+':'+c.target.venue+':'+c.target.raceNo;
   if(d.raceKey!==expectedRaceKey)throw Error('DBから別レースの保存履歴が返されました。復元を中止しました。');
   const rev=d.latest?.find(x=>x.phase===c.state.phase);
   if(!rev?.entries?.length)throw Error('この段階の正式DB保存はまだありません。');
   // A mark edit or track change after confirmation must not be silently overwritten
   // by a slower DB response; require the exact original form snapshot.
   if(!current()||key(current())!==stamp)throw Error('取得中にレース・馬場・印が変更されました。復元操作をやり直してください。');
   applyDbMarks(rev,c);
   const restored=current();
   if(!restored||key(restored).split('|').slice(0,4).join('|')!==stamp.split('|').slice(0,4).join('|')||
      !matchesRemote(rev,payload(restored)))throw Error('復元後の印がDB保存履歴と一致しません。自動保存完了とは判定しません。');
   lastSaved=key(restored); // Restoring an identical revision must not create a duplicate DB write.
   msg('DBの改訂 '+rev.revisionNo+'版（'+rev.entries.length+'頭）を画面に復元しました。 '+recordText(rev));
  }catch(e){msg('復元できません：'+e.message+(tokenError?' 保存できない理由：'+tokenError+' 「DBへ今すぐ保存」で接続を再確認できます。':''));}
  finally{working=false;update();}
 });

 if(review&&report)review.addEventListener('click',async()=>{
  const c=current();if(!authenticated||working||!c)return;
  const snapshot=key(c),raceKey=c.target.date+':'+c.target.venue+':'+c.target.raceNo;
  const q=new URLSearchParams({date:c.target.date,venue:c.target.venue,race_no:String(c.target.raceNo),phase:c.state.phase});
  working=true;update();report.textContent='DB保存版の印と公式結果を読み取り中…';
  try{
   const mr=await fetcher('/v1/lab/user-marks?'+q,{credentials:'same-origin',cache:'no-store'}),md=await mr.json();
   if(!mr.ok||!md.ok||md.raceKey!==raceKey)throw Error(md.error||'対象レースのDB印を確認できません。');
   const rev=md.latest?.find(r=>r.phase===c.state.phase);
   if(!rev?.entries?.length)throw Error('この段階のDB印は未保存です。先にDBへ保存してください。');
   if(rev.provenance?.integrityVerified!==true)throw Error('DB保存版の整合性を確認できません。比較を保留します。');
   const rr=await fetcher('https://keiba-lab-api.sekai-no-bancyou.workers.dev/v1/lab/history/race?'+q,{cache:'no-store'}),rd=await rr.json();
   if(!rr.ok||!rd.ok||rd.race?.raceKey!==raceKey)throw Error(rd.error||'対象レースの結果を確認できません。');
   if(!current()||key(current())!==snapshot)throw Error('取得中にレース・印・馬場が変わりました。再照合してください。');
   const n=Number(rd.race.runnerCount),rows=rd.runners;
   if(!Number.isInteger(n)||n<1||n>18||!Array.isArray(rows)||rows.length>n||new Set(rows.map(r=>r.horseNo)).size!==rows.length||new Set(rows.map(r=>r.horseName)).size!==rows.length||rows.some(r=>!Number.isInteger(r.horseNo)||r.horseNo<1||r.horseNo>n||!r.horseName))throw Error('結果の馬名・馬番の対応を確認できません。');
   const marks=rev.entries,seen=new Set(),lines=[];
   for(const m of marks){
    if(seen.has(m.horse_name))throw Error('保存した印に重複があります。');seen.add(m.horse_name);
    const row=rows.find(r=>r.horseName===m.horse_name);
    if(!row||(m.horse_no!=null&&m.horse_no!==row.horseNo))throw Error('保存した印と出走馬の対応を確認できません。');
    const terminal={scratched:'取消',excluded:'除外','did-not-finish':'中止',disqualified:'失格'}[row.finishStatus];
    const finish=Number.isInteger(row.finishPosition)&&row.finishPosition>=1&&row.finishPosition<=n?row.finishPosition:null;
    const model=rev.audit?.audit?.marked?.find(x=>x.horseName===m.horse_name),label=model?.laboRankSource==='history-reference-assessment'?'保存時LABO参考':'保存時LABO',rank=Number.isInteger(model?.laboRank)?' / '+label+' '+model.laboRank+'位':' / 保存時LABO順位未保存';
    lines.push(m.mark+' '+m.horse_name+rank+' → '+(terminal|| (finish?finish+'着':'結果未取得')));
   }
   const reference=rev.audit?.audit?.referenceAssessment;
   if(reference){
    const pool=reference.allRunners;
    const verified=rev.audit?.race?.raceKey===raceKey&&reference.runnerPool===n&&Array.isArray(pool)&&pool.length===n&&new Set(pool.map(x=>x.horseNo)).size===n&&new Set(pool.map(x=>x.horseName)).size===n&&pool.every(x=>rows.some(r=>r.horseNo===x.horseNo&&r.horseName===x.horseName));
    if(!verified)lines.push('\n全馬LABO参考評価：保存版と公式出走馬の対応を確認できず、表示を保留。');
    else{
     lines.push('\n【DB保存時の全馬LABO参考評価】','参考指数・参考印です。精度実績への採用は事前LOCKの検証が必要です。');
     if(reference.raceShape?.runnerPool===n)lines.push('保存時の位置取り判定 '+reference.raceShape.coveredRunners+'/'+n+'頭 / 想定ペース '+(reference.raceShape.paceForecast||'未判定'));
     for(const x of [...pool].sort((a,b)=>(a.referenceRank??999)-(b.referenceRank??999)||a.horseNo-b.horseNo)){
      const r=rows.find(r=>r.horseNo===x.horseNo),user=marks.find(m=>m.horse_name===x.horseName)?.mark||'無印';
      const finish=Number.isInteger(r.finishPosition)&&r.finishPosition>=1&&r.finishPosition<=n?r.finishPosition:null;
      const terminal={scratched:'取消',excluded:'除外','did-not-finish':'中止',disqualified:'失格'}[r.finishStatus];
      const rank=Number.isInteger(x.referenceRank)&&x.referenceRank>=1&&x.referenceRank<=n?x.referenceRank:null;
      const score=typeof x.evidenceScore==='number'&&Number.isFinite(x.evidenceScore)?x.evidenceScore:null;
      const symbol=['◎','○','▲','△','☆'].includes(x.mark)?x.mark:'印保留';
      lines.push(symbol+' '+x.horseNo+'番 '+x.horseName+' / '+(rank?rank+'位'+(x.tiedCount>1?'（同点）':''):'順位保留')+' / '+(score===null?'指数未保存':score+'点')+' / ユーザー '+user+' → '+(terminal||(finish?finish+'着':'結果未取得'))+(finish&&rank&&!terminal?' / 順位差 '+(finish-rank>0?'+':'')+(finish-rank):''));
      if(x.runningStyle)lines.push('　保存時の位置取り：'+x.runningStyle.label+'（根拠 '+x.runningStyle.validPositionRows+'走） / 実通過 '+(r.cornerPositions||'未取得')+' / 実上がり3F '+(typeof r.last3f==='number'&&Number.isFinite(r.last3f)?r.last3f+'秒':'未取得'));
     }
    }
   }
   lines.push('\n保存時のLABO評価は、過去走補完後も変更しません。最新評価は「LABO印・順位を計算する」で確認できます。');
   if(rev.userLock?.immutable){
    try{
     const er=await fetcher('/v1/lab/locked-mark-results?'+q,{cache:'no-store'}),ed=await er.json();
     if(!er.ok||!ed.ok)throw Error(ed.error||'照合履歴を取得できません。');
     lines.push('\n'+lockedEvidenceLines(ed.evidence,rev,raceKey,rows).join('\n'));
    }catch(e){lines.push('\n事前LOCKの照合履歴は確認できません：'+e.message);}
   }else lines.push('\n'+lockedEvidenceLines([],rev,raceKey,rows).join('\n'));
   if(!current()||key(current())!==snapshot)throw Error('取得中にレース・印・馬場が変わりました。再照合してください。');
   const unchanged=matchesRemote(rev,{...payload(c),phase:c.state.phase});
   report.textContent='DB改訂 '+rev.revisionNo+'版 / '+c.state.phase+' / '+marks.length+'頭\n'+recordText(rev)+'\n'+(unchanged?'画面の印とDB保存版は一致。':'画面の印とDB保存版は異なります。以下はDB保存版の照合です。')+'\n'+(rd.result?.complete===true&&rows.length===n&&rows.every(r=>(Number.isInteger(r.finishPosition)&&r.finishPosition>=1&&r.finishPosition<=n)||['scratched','excluded','did-not-finish','disqualified'].includes(r.finishStatus))?'全頭の結果保存を確認。':'結果は一部未取得です。')+'\n'+lines.join('\n')+'\n事前LOCK・学習への採用は別工程です。';
  }catch(e){report.textContent='照合を保留：'+e.message;}
  finally{working=false;update();if(pendingSaves.size)scheduleFlush();}
 });

 if(lockButton)lockButton.addEventListener('click',async()=>{
  const c=current();if(!authenticated||working||!c||c.state.phase==='initial')return;
  const snapshot=key(c),q=new URLSearchParams({date:c.target.date,venue:c.target.venue,race_no:String(c.target.raceNo),phase:c.state.phase});
  working=true;update();
  try{
   const r=await fetcher('/v1/lab/user-marks?'+q,{credentials:'same-origin',cache:'no-store'}),d=await r.json();
   const rev=d.latest?.find(x=>x.phase===c.state.phase);
   if(!r.ok||!d.ok||d.raceKey!==c.target.date+':'+c.target.venue+':'+c.target.raceNo||!rev||rev.provenance?.integrityVerified!==true)throw Error('固定するDB保存版を確認できません。');
   if(!current()||key(current())!==snapshot||!matchesRemote(rev,payload(c)))throw Error('画面の印とDB保存版が一致しません。先に保存してください。');
   if(!window.confirm('DB改訂 '+rev.revisionNo+'版の印を事前LOCKします。固定版は後から上書きできません。よろしいですか？'))return;
   const saved=await fetcher('/v1/lab/user-mark-session',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'lock-user-marks',date:c.target.date,venue:c.target.venue,raceNo:c.target.raceNo,phase:c.state.phase,revisionId:rev.revisionId,confirm:'LOCK'})}),answer=await saved.json();
   if(!saved.ok||!answer.ok||answer.stage!=='user-mark-lock-readback-verified'||answer.revisionId!==rev.revisionId)throw Error(answer.error||'LOCKの読み返しを確認できません。');
   if(current()&&key(current())===snapshot)msg('事前LOCK済み・読み返し一致：DB改訂 '+rev.revisionNo+'版。固定日時 '+new Date(answer.lockedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})+'。以後の印編集は固定版を変更しません。');
  }catch(e){if(current()&&key(current())===snapshot)msg('事前LOCKを確認できません：'+e.message);}
  finally{working=false;update();if(pendingSaves.size)scheduleFlush();}
 });
 update();void session();
}
