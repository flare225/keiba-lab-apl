export function mountOwnerMarkSave({document,window,getCurrent,verifiedMarkPayload,initialLocalMarkPayload,applyDbMarks,fetcher=fetch,scheduleDelay=1600}){
 const el=id=>document.getElementById(id),root=el('ownerMarkDbControls');
 if(!root)return;
 const state=el('ownerMarkDbStatus'),password=el('ownerMarkPassword'),login=el('ownerMarkLogin'),
  logout=el('ownerMarkLogout'),save=el('ownerMarkSave'),restore=el('ownerMarkRestore'),loginRow=el('ownerMarkLoginRow');
 let configured=false,authenticated=false,workerWriteTokenMatch=false,working=false,timer=null,lastSaved='',seq=0;
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
  logout.hidden=!authenticated;logout.disabled=working;save.disabled=!authenticated||!workerWriteTokenMatch||working||!c||!c.state.marks.length;
  restore.disabled=!authenticated||working||!c;
 };
 const msg=x=>{state.textContent=x;update();};
 async function checkWorkerToken(){
  workerWriteTokenMatch=false;working=true;update();msg('VercelとCloudflareの保存トークンをDB書込なしで照合中…');
  try{
   const r=await fetcher('/v1/lab/user-mark-session',{method:'POST',credentials:'same-origin',
    headers:{'content-type':'application/json'},body:JSON.stringify({action:'check-worker-write-token'})});
   const d=await r.json();
   if(!r.ok||!d.ok)throw Error(d.error||'照合できません。');
   workerWriteTokenMatch=d.workerWriteTokenMatch===true;
   if(workerWriteTokenMatch)msg('保存トークン一致を確認しました（DB書込なし）。DB保存はまだ実行していません。保存ボタンを押すまで印は送信しません。');
   else msg('VercelとCloudflareの保存トークンが一致しません。DB書込を停止しました。秘密値は表示していません。');
  }catch(e){workerWriteTokenMatch=false;msg('保存トークンを確認できません。DB書込は停止中です：'+e.message);}
  finally{working=false;update();}
 }
 async function session(){
  try{
   const resp=await fetcher('/v1/lab/user-mark-session',{credentials:'same-origin',cache:'no-store'});
   const d=await resp.json();if(!resp.ok||!d.ok)throw Error(d.error||'認証状態を確認できません。');
   configured=d.configured===true;authenticated=d.authenticated===true;update();
   if(authenticated){await checkWorkerToken();return;}
   msg(!configured?'DB正式保存：認証・サーバー接続設定が未完了。現在は端末内保存のみです。':
    'DB正式保存：本人認証待ち。管理者キーではなく、登録した本人用パスフレーズを入力してください。');
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
  authenticated=false;workerWriteTokenMatch=false;lastSaved='';msg('ログアウトしました。DB正式保存は停止中です。');
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
 async function persist(force=false){
  const c=current();if(!authenticated||!workerWriteTokenMatch||!c||working)return;
  let body;try{body={...payload(c),confirm:'SAVE'};}catch(e){if(force)msg('DBへ保存できません：'+e.message);return;}
  const snapshot=key(c);if(!force&&snapshot===lastSaved)return;
  working=true;update();msg('DBへ保存中…（正式DBの再照合が終わるまで確定ではありません）');
  try{
   // Immutable revisions must not grow when the same draft is reopened, re-logged in or restored.
   const qs=new URLSearchParams({date:body.date,venue:body.venue,race_no:String(body.raceNo),phase:body.phase});
   const priorResp=await fetcher('/v1/lab/user-marks?'+qs,{credentials:'same-origin',cache:'no-store'});
   const prior=await priorResp.json();
   if(!priorResp.ok||!prior.ok||!Array.isArray(prior.latest))throw Error(prior.error||'既存DB保存履歴を確認できません。');
   if(prior.raceKey&&prior.raceKey!==body.date+':'+body.venue+':'+body.raceNo)throw Error('別レースの履歴が返されました。');
   if(key(current()||c)!==snapshot)return;
   const existing=prior.latest.find(x=>x.phase===body.phase);
   if(matchesRemote(existing,body)){
    lastSaved=snapshot;
    msg('DB保存済み・既存履歴と一致：改訂 '+existing.revisionNo+'版（'+existing.entries.length+'頭）／DB保存日時 '+(existing.createdAt||'未取得')+'。新しい改訂は追加していません。');
    window.dispatchEvent(new Event('labo-mark-db-written'));
    return;
   }
   const r=await fetcher('/v1/lab/user-marks/save',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
   const d=await r.json();if(!r.ok||!d.ok||d.stage!=='db-written-readback-verified')throw Error(d.error||'保存を確認できません。');
   lastSaved=snapshot;
   if(key(current()||c)===snapshot)msg('DB保存済み・再照合成功：改訂 '+d.revisionNo+'版（'+d.entryCount+'頭）／DB保存日時 '+(d.savedAt||'未取得')+'／照合日時 '+d.verifiedAt+'。※レース前LOCK・学習完了の証明ではありません。');
   window.dispatchEvent(new Event('labo-mark-db-written'));
  }catch(e){
   if(key(current()||c)===snapshot)msg('DB保存を確認できません：'+e.message+'。端末下書きは残っています。');
  }finally{
   working=false;update();
   // If new marks appeared during an in-flight save, retry after a quiet interval.
   if(authenticated&&current()&&key(current())!==snapshot)queue();
  }
 }
 const queue=()=>{if(timer!==null)clearTimeout(timer);timer=null;};
 save.addEventListener('click',()=>{if(timer!==null)clearTimeout(timer);timer=null;void persist(true);});
 window.addEventListener('labo-marks-changed',()=>{const c=current();if(authenticated&&c&&key(c)!==lastSaved)msg(workerWriteTokenMatch?'DB未保存：現在の印が変更されています。「DBへ今すぐ保存」を押すまで送信しません。':'DB未保存：保存トークンの確認が完了していません。');});
 window.addEventListener('labo-target-change',()=>{if(timer!==null)clearTimeout(timer);timer=null;lastSaved='';msg('対象レースを切り替えました。現在の印は正式DB保存未確認です。保存ボタンを押すまでDBへ送信しません。');});
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
   msg('DBの改訂 '+rev.revisionNo+'版（'+rev.entries.length+'頭）を画面に復元しました。下書きと別に照合してください。');
  }catch(e){msg('復元できません：'+e.message);}
  finally{working=false;update();}
 });
 update();void session();
}
