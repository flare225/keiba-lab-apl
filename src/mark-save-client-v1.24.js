export function mountMarkSaving({document,window,getCurrent,verifiedMarkPayload,sameDbMarks,summarizeDbRevision,localMarkReceipt}){
 const el=id=>document.getElementById(id);
 const panel=el('userMarkSaveCard'),info=el('userMarkSaveInfo'),localState=el('userMarkLocalState'),
 dbState=el('userMarkDbState'),saveLocal=el('userMarkSaveLocal'),saveDb=el('userMarkSaveDb'),
 secret=el('userMarkWriteKey'),refresh=el('userMarkRefreshDb'),exportBox=el('userMarkSaveExport'),
 copy=el('userMarkSaveCopy');
 if(!panel)return;
 let request=0,pending=false,lastRemote=null;
 const storageKey=(t,phase)=>'keiba-labo:mark-freeze:v1:'+t.date+'|'+t.venue+'|'+t.raceNo+'|'+phase;
 const identity=s=>(s.roster||[]).map(n=>{const v=s.rosterNumbers[n]||{};return v.horseNo+':'+v.frameNo+':'+n;}).join('|');
 const current=()=>{const c=getCurrent();if(!c?.target)return null;return c;};
 const stateKey=c=>c.target.date+'|'+c.target.venue+'|'+c.target.raceNo+'|'+c.state.phase;
 function maybePayload(c){try{return{payload:verifiedMarkPayload(c.target,c.state),error:null}}catch(e){return{payload:null,error:e.message}}}
 function localReceipt(c){try{const raw=window.localStorage.getItem(storageKey(c.target,c.state.phase));const saved=JSON.parse(raw||'null');return saved?.rosterIdentity===identity(c.state)?saved:null;}catch{return null;}}
 function samePayload(a,b){return a&&b&&JSON.stringify(a)===JSON.stringify(b);}
 const timestring=value=>{try{return new Date(value).toLocaleString('ja-JP',{hour12:false})}catch{return value;}};
 const stamp=()=>new Date().toISOString();
 function status(){
  const c=current(),display=c&&c.state.phase!=='initial';
  panel.hidden=!display;
  if(!display)return;
  const {payload,error}=maybePayload(c);
  const saved=localReceipt(c);
  if(!payload){info.textContent=error;saveLocal.disabled=true;saveDb.disabled=true;}
  else{info.textContent='現在の印 '+payload.marks.length+'頭。DBへ保存する場合は管理用保存キーが必要です。DB再精査と印の正式保存は別の操作です。';
   saveLocal.disabled=pending;saveDb.disabled=pending;}
  localState.textContent=saved?(samePayload(saved.payload,payload)?'端末控え：第'+saved.localRevision+'版・'+timestring(saved.recordedAt)+'（端末時計）。※DB確定ではありません。':'端末控え：前の印 '+saved.localRevision+'版があります。現在の印は未記録。'):'端末控え：なし';
  const result=lastRemote?.key===stateKey(c)?summarizeDbRevision(lastRemote.data,c.state.phase):null;
  if(result?.status==='saved'){
   dbState.textContent='DB保存：改訂 '+result.revision.revisionNo+'版（'+result.revision.entries.length+'頭）'+(payload&&sameDbMarks(payload,result.revision)?' ／ 現在の印と一致':' ／ 現在の印とは不一致・未確定');
  }else if(result?.status==='none')dbState.textContent='正式DB：この段階の保存履歴なし';
  else dbState.textContent='正式DB：未照合（「DB保存状態を確認」を押してください）';
 }
 const message=t=>{info.textContent=t;};
 async function readRemote(){
  const c=current(),seq=++request;if(!c||c.state.phase==='initial'){lastRemote=null;status();return;}
  const before=stateKey(c);
  dbState.textContent='DB保存履歴を確認中…';refresh.disabled=true;
  try{
   const p=new URLSearchParams({date:c.target.date,venue:c.target.venue,race_no:String(c.target.raceNo),phase:c.state.phase});
   const r=await fetch('/v1/lab/user-marks?'+p.toString(),{cache:'no-store'});
   const body=await r.json();
   if(seq!==request||!current()||stateKey(current())!==before)return;
   if(!r.ok||!body.ok)throw Error(body.error||'DB履歴を読み取れません');
   lastRemote={key:before,data:body};
  }catch(e){
   if(seq!==request||!current()||stateKey(current())!==before)return;
   lastRemote=null;dbState.textContent='DB保存状態の確認失敗：'+e.message;
   return;
  }finally{if(seq===request){refresh.disabled=false;}}
  status();
 }
 function freezeLocal(){
  const c=current();if(!c)return;
  const {payload,error}=maybePayload(c);
  if(!payload){message(error);return;}
  try{
   const previous=localReceipt(c),next=localMarkReceipt({payload,recordedAt:stamp(),localRevision:(Number(previous?.localRevision)||0)+1,rosterIdentity:identity(c.state)});
   window.localStorage.setItem(storageKey(c.target,c.state.phase),JSON.stringify(next));
   status();message('この端末に時刻付きの控えを記録しました。※DB保存・事前LOCKではありません。');
  }catch(e){message('端末内の記録ができませんでした。ブラウザの保存設定を確認してください。');}
 }
 async function writeDb(){
  if(pending)return;
  const c=current();if(!c)return;
  const {payload,error}=maybePayload(c);
  if(!payload){message(error);return;}
  const token=secret.value.trim();secret.value='';
  if(token.length<8){message('正式DB保存には管理用保存キーを入力してください。キーはブラウザには保存しません。');return;}
  const before=stateKey(c),fingerprint=JSON.stringify(payload);
  pending=true;saveLocal.disabled=true;saveDb.disabled=true;refresh.disabled=true;
  dbState.textContent='DBへ保存し、書き込み結果を照合しています…';
  try{
   const response=await fetch('/v1/lab/user-marks/save',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(payload),cache:'no-store'});
   const saved=await response.json();
   if(!response.ok||!saved.ok||saved.stage!=='user-mark-saved-and-crosschecked'||!saved.revisionId||!Number.isInteger(saved.revisionNo))throw Error(saved.error||'DB保存の証明を受け取れませんでした。');
   const params=new URLSearchParams({date:payload.date,venue:payload.venue,race_no:String(payload.raceNo),phase:payload.phase});
   const verifiedResponse=await fetch('/v1/lab/user-marks?'+params.toString(),{cache:'no-store'});
   const verified=await verifiedResponse.json();
   const rec=summarizeDbRevision(verified,payload.phase);
   if(!verifiedResponse.ok||!verified.ok||rec.status!=='saved'||rec.revision.revisionId!==saved.revisionId||!sameDbMarks(payload,rec.revision))throw Error('書き込み応答後のDB読み戻し照合に失敗しました。DB保存状態を再確認してください。');
   if(!current()||stateKey(current())!==before||JSON.stringify(maybePayload(current()).payload)!==fingerprint){lastRemote=null;message('DBへ保存できましたが、表示中の印は変更されています。DB履歴を再確認してください。');return;}
   lastRemote={key:before,data:verified};
   message('正式DB保存と読み戻し照合が成功：改訂 '+saved.revisionNo+'版。保存時刻と事前LOCKは別途確認が必要です。');
  }catch(e){lastRemote=null;message('正式DB保存を確認できませんでした：'+e.message+'。重複保存を避け、まずDB保存状態を確認してください。');}
  finally{pending=false;refresh.disabled=false;status();}
 }
 function exportText(){
  const c=current();if(!c)return'';
  const r=localReceipt(c),payload=maybePayload(c).payload||r?.payload;
  if(!payload)return'';
  return ['KEIBA LABO 印の控え',payload.date+' '+payload.venue+payload.raceNo+'R','段階：'+(payload.phase==='final'?'最終印':'枠順後'),'馬場想定：'+(payload.track||'未指定'),'端末控え時刻：'+(r?.recordedAt||'未記録'),'※DB保存・レース前LOCKを証明するものではありません。',...payload.marks.map(m=>m.horseNo+'番 '+m.mark+' '+m.horseName)].join('\n');
 }
 async function copyText(){
  const value=exportText();if(!value){message('印を選択してください。');return;}
  try{await window.navigator.clipboard.writeText(value);exportBox.hidden=true;message('印の控えをコピーしました。');}
  catch{exportBox.value=value;exportBox.hidden=false;exportBox.focus();exportBox.select();message('下のテキストを長押ししてコピーしてください。');}
 }
 saveLocal.addEventListener('click',freezeLocal);saveDb.addEventListener('click',()=>{void writeDb();});
 refresh.addEventListener('click',()=>{void readRemote();});copy.addEventListener('click',()=>{void copyText();});
 for(const event of ['input','change'])secret.addEventListener(event,e=>e.stopPropagation());
 const phase=document.getElementById('phase');
 phase?.addEventListener('change',()=>{++request;lastRemote=null;status();void readRemote();});
 window.addEventListener('labo-target-change',()=>{++request;lastRemote=null;status();void readRemote();});
 window.addEventListener('labo-marks-changed',status);
 status();void readRemote();
}
