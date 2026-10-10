export function mountMarkSaving({document,window,getCurrent,verifiedMarkPayload,sameDbMarks,summarizeDbRevision,localMarkReceipt}){
 const el=id=>document.getElementById(id);
 const panel=el('userMarkSaveCard'),info=el('userMarkSaveInfo'),localState=el('userMarkLocalState'),
 dbState=el('userMarkDbState'),saveLocal=el('userMarkSaveLocal'),
 refresh=el('userMarkRefreshDb'),exportBox=el('userMarkSaveExport'),
 copy=el('userMarkSaveCopy');
 if(!panel)return;
 let request=0,lastRemote=null;
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
  if(!payload){info.textContent=error;saveLocal.disabled=true;}
  else{info.textContent='現在の印 '+payload.marks.length+'頭。端末控えの記録は可能です。正式DBへの新規保存には利用者認証の実装が必要です。';
   saveLocal.disabled=false;}
  localState.textContent=saved?(samePayload(saved.payload,payload)?'端末控え：第'+saved.localRevision+'版・'+timestring(saved.recordedAt)+'（端末時計）。※DB確定ではありません。':'端末控え：前の印 '+saved.localRevision+'版があります。現在の印は未記録。'):'端末控え：なし';
  const result=lastRemote?.key===stateKey(c)?summarizeDbRevision(lastRemote.data,c.state.phase):null;
  if(result?.status==='saved'){
   dbState.textContent='DB保存：改訂 '+result.revision.revisionNo+'版（'+result.revision.entries.length+'頭）'+(payload&&sameDbMarks(payload,result.revision)?' ／ 現在の印と一致':' ／ 現在の印とは不一致・未確定')+(result.revision.createdAt?' ／ DB保存日時 '+timestring(result.revision.createdAt):' ／ DB保存日時は未公開')+(lastRemote.checkedAt?' ／ DB再照合 '+timestring(lastRemote.checkedAt)+'（端末時計）':'');
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
   lastRemote={key:before,data:body,checkedAt:stamp()};
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
 saveLocal.addEventListener('click',freezeLocal);
 refresh.addEventListener('click',()=>{void readRemote();});copy.addEventListener('click',()=>{void copyText();});
 const phase=document.getElementById('phase');
 phase?.addEventListener('change',()=>{++request;lastRemote=null;status();void readRemote();});
 window.addEventListener('labo-target-change',()=>{++request;lastRemote=null;status();void readRemote();});
 window.addEventListener('labo-marks-changed',status);
 status();void readRemote();
}
