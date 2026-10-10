export function mountTicketBuilder({
 document,window,api,getRace,getMarks,verifyRoster,
 WAGER_TYPES,ticketMethodOptions,groupLabels,generateFormationTickets,
 validateTicketStake,calculateTicketSlip
}){
 const $=id=>document.getElementById(id),el=$('ticketGroups');
 if(!el)return;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const type=$('ticketType'),method=$('ticketMethod'),category=$('ticketCategory'),axisPosition=$('ticketAxisPosition'),multi=$('ticketMulti'),unit=$('ticketUnit'),budget=$('ticketBudget'),preview=$('ticketPreview'),notice=$('ticketNotice'),gate=$('ticketGate'),title=$('ticketRaceTitle'),itemsBox=$('ticketSlipItems'),summary=$('ticketSlipSummary');
 let currentKey='',signature='',runners=[],entries=[],groups=[[],[],[]],serial=0,requestId=0,ready=false;
 const storageKey=()=> 'keiba-labo:ticket-slip:v2:'+currentKey;
 const typeLegs=()=>['単勝','複勝'].includes(type.value)?1:['枠連','馬連','馬単','ワイド'].includes(type.value)?2:3;
 const isOrdered=()=>['馬単','三連単'].includes(type.value);
 const groupsForMethod=()=>groupLabels(type.value,method.value);
 const formatCombo=x=>x.join(type.value==='馬単'||type.value==='三連単'?' → ':' - ');
 const currentRace=()=>{const t=getRace?.();return t&&t.date&&t.venue&&Number.isInteger(Number(t.raceNo))?t:null;};
 function state(){return calculateTicketSlip(entries,Number(budget.value));}
 function save(){
  if(!currentKey||!signature)return;
  try{window.localStorage.setItem(storageKey(),JSON.stringify({signature,budget:Number(budget.value),entries:entries.slice(0,40)}));}
  catch{notice.textContent='ブラウザへの買い目保存ができません。コピーして控えてください。';}
 }
 function loadSaved(){
  entries=[];let stale=false;
  try{
   const saved=JSON.parse(window.localStorage.getItem(storageKey())||'null');
   if(saved&&saved.signature===signature){
    if(Number.isSafeInteger(saved.budget)&&saved.budget>=100)budget.value=String(saved.budget);
    const potential=(Array.isArray(saved.entries)?saved.entries:[]).slice(0,40).filter(x=>x&&WAGER_TYPES.includes(x.type)&&['勝負','保険'].includes(x.category)&&validateTicketStake(x.unitStake)&&Array.isArray(x.combos)&&x.combos.length>0&&x.combos.length<5000);
    const checked=calculateTicketSlip(potential,Number.MAX_SAFE_INTEGER);
    if(checked.duplicates.length===0&&!checked.error)entries=potential;
   }else if(saved)stale=true;
  }catch{}
  if(stale)notice.textContent='公式出馬表が前回と異なるため、以前の買い目は復元しませんでした。';
 }
 function methodOptions(){
  const opts=ticketMethodOptions(type.value),old=method.value;
  method.innerHTML=opts.map(x=>'<option value="'+esc(x.value)+'">'+esc(x.label)+'</option>').join('');
  method.value=opts.some(x=>x.value===old)?old:(['単勝','複勝'].includes(type.value)?'box':'formation');
  if(method.selectedIndex<0)method.selectedIndex=0;
  groups=[[],[],[]];updateMethodSettings();
 }
 function updateMethodSettings(){
  const canMulti=isOrdered()&&['nagashi','nagashi2'].includes(method.value);
  $('ticketMultiHolder').hidden=!canMulti;
  if(!canMulti)multi.checked=false;
  const showPosition=method.value==='nagashi'&&isOrdered();
  $('ticketAxisHolder').hidden=!showPosition;
  if(type.value==='馬単')axisPosition.innerHTML='<option value="1">1着固定</option><option value="2">2着固定</option>';
  else axisPosition.innerHTML='<option value="1">1着固定</option><option value="2">2着固定</option><option value="3">3着固定</option>';
  axisPosition.value='1';
 }
 function chosenMarks(){
  const current=getMarks?.()||[],map=new Map(runners.map(r=>[r.horseName,r.horseNo]));
  const byMark=new Map();for(const x of current){const n=map.get(x.horseName);if(n&&!byMark.has(n)&&x.mark)byMark.set(n,x.mark);}
  return byMark;
 }
 function populateFromMarks(){
  if(!ready)return;
  const order={'◎':0,'○':1,'▲':2,'△':3,'☆':4,'注':5};
  const marked=[...chosenMarks()].filter(([,m])=>m in order).sort((a,b)=>order[a[1]]-order[b[1]]||a[0]-b[0]).map(([n])=>n);
  if(!marked.length){notice.textContent='このレースで先に◎○▲などの印を付けてください。';return;}
  groups=[[],[],[]];const n=typeLegs();
  if(method.value==='box'||n===1)groups[0]=marked;
  else if(method.value==='nagashi'||method.value==='nagashi2'){const axes=method.value==='nagashi2'?2:1;groups[0]=marked.slice(0,axes);groups[1]=marked.slice(axes);}
  else if(n===3){groups[0]=marked.slice(0,1);groups[1]=marked.slice(0,Math.min(3,marked.length));groups[2]=marked;}
  else {groups[0]=marked.slice(0,1);groups[1]=marked.slice(1);}
  notice.textContent='現在の印を候補にセットしました。馬番を押して自由に変更できます。';renderGroups();
 }
 function renderGroups(){
  const labels=groupsForMethod(),marks=chosenMarks(),enabled=ready;
  el.innerHTML=labels.map((label,index)=>'<div class="tb-group"><h4>'+esc(label)+' <small>'+groups[index].length+'頭</small></h4><div class="tb-horses">'+(runners.length?runners.map(r=>{
   const selected=groups[index].includes(r.horseNo),mark=marks.get(r.horseNo)||'';
   return '<button type="button" class="tb-horse'+(selected?' selected':'')+'" data-group="'+index+'" data-no="'+r.horseNo+'" aria-pressed="'+selected+'"'+(!enabled?' disabled':'')+'><span class="tb-no">'+r.horseNo+'</span><span class="tb-horse-text"><small>'+r.frameNo+'枠'+(mark?' · '+esc(mark):'')+'</small>'+esc(r.horseName)+'</span></button>';
  }).join(''):'<p class="notice">公式出馬表の取得・照合を確認してください。</p>')+'</div></div>').join('');
  renderPreview();
 }
 function config(){return{type:type.value,method:method.value,groups,multi:multi.checked,axisPosition:Number(axisPosition.value||1),roster:runners};}
 function renderPreview(){
  if(!ready){preview.textContent='公式の馬番・枠番を照合できるまでは買い目を確定できません。';$('ticketAdd').disabled=true;return;}
  const built=generateFormationTickets(config()),stake=validateTicketStake(unit.value);
  $('ticketAdd').disabled=!built.ok||stake===null;
  if(!built.ok){preview.textContent=built.error;return;}
  preview.innerHTML='<b>'+built.count+'点</b> × '+esc(stake??'—')+'円 ＝ <strong>'+esc(stake===null?'—':(built.count*stake).toLocaleString())+'円</strong><div class="tb-combos">'+built.combos.slice(0,24).map(c=>'<span>'+esc(formatCombo(c))+'</span>').join('')+'</div>'+(built.count>24?'<small>ほか '+(built.count-24)+'点（追加後に全点数を保持）</small>':'');
 }
 function renderSlip(){
  const totals=state();
  summary.innerHTML='<strong>'+totals.count+'点　'+totals.total.toLocaleString()+'円</strong><span>予算 '+totals.budget.toLocaleString()+'円 ／ '+(totals.remaining>=0?'残り '+totals.remaining.toLocaleString()+'円':'超過 '+(-totals.remaining).toLocaleString()+'円')+'</span>';
  summary.className='tb-summary'+(totals.ok?'':' over');
  itemsBox.innerHTML=entries.length?entries.map((item,i)=>'<article class="tb-slip-card"><div class="tb-slip-top"><b>'+esc(item.category)+' · '+esc(item.type)+' · '+esc(item.methodLabel||item.method)+'</b><button type="button" class="btn secondary" data-remove="'+i+'">削除</button></div><div class="tb-slip-money">'+item.combos.length+'点 × <label>各 <input data-stake="'+i+'" type="number" inputmode="numeric" min="100" step="100" value="'+esc(item.unitStake)+'" aria-label="1点あたりの金額"> 円</label> = '+(item.combos.length*item.unitStake).toLocaleString()+'円</div><details><summary>買い目の組番を見る（'+item.combos.length+'点）</summary><div class="tb-combos">'+item.combos.map(c=>'<span>'+esc(c.join(item.type==='馬単'||item.type==='三連単'?' → ':' - '))+'</span>').join('')+'</div></details></article>').join(''):'<p class="notice">買い目はまだありません。上の組み合わせを作成して「追加」してください。</p>';
  $('ticketCopy').disabled=entries.length===0;
  $('ticketClearSlip').disabled=entries.length===0;
 }
 function add(){
  if(!ready){notice.textContent='番号付き出馬表の保存監査が完了していないため追加できません。';return;}
  const result=generateFormationTickets(config()),stake=validateTicketStake(unit.value);
  if(!result.ok||stake===null){notice.textContent=result.error||'1点100円以上、100円単位で入力してください。';return;}
  const previous=new Set(entries.flatMap(x=>x.combos.map(c=>x.type+':'+c.join('-'))));
  const fresh=result.combos.filter(c=>!previous.has(type.value+':'+c.join('-')));
  if(!fresh.length){notice.textContent='すべて登録済みの買い目です。重複を追加しません。';return;}
  if(entries.length>=40){notice.textContent='組み合わせは40件まで保存できます。既存の買い目を整理してください。';return;}
  const cost=stake*fresh.length,totals=state();
  if(!totals.ok||totals.total+cost>totals.budget){notice.textContent='予算超過：この買い目は'+cost.toLocaleString()+'円必要です。予算か点数・金額を調整してください。';return;}
  entries.push({id:++serial,category:category.value,type:type.value,method:method.value,methodLabel:method.selectedOptions[0]?.textContent||method.value,unitStake:stake,combos:fresh});
  notice.textContent=fresh.length+'点を追加しました。'+(fresh.length!==result.count?' 重複'+(result.count-fresh.length)+'点を除外。':'')+' 投票・決済はしていません。';save();renderSlip();
 }
 function exportText(){
  const t=currentRace(),head=t?t.date+' '+t.venue+t.raceNo+'R '+(t.raceName||''):'KEIBA LABO';
  const lines=['KEIBA LABO 買い目控え',head,'購入前の検討用（実際の投票ではありません）',''];
  for(const item of entries){lines.push('【'+item.category+'】'+item.type+' / '+(item.methodLabel||item.method),item.combos.length+'点 × '+item.unitStake+'円 = '+(item.combos.length*item.unitStake)+'円',...item.combos.map(c=>c.join(['馬単','三連単'].includes(item.type)?' → ':' - ')),'');}
  const d=state();lines.push('合計 '+d.count+'点 / '+d.total+'円','予算 '+d.budget+'円 / 残り '+d.remaining+'円');return lines.join('\n');
 }
 async function refreshRace(){
  const seq=++requestId,t=currentRace();
  ready=false;runners=[];entries=[];groups=[[],[],[]];signature='';currentKey=t?t.date+'|'+t.venue+'|'+t.raceNo:'';
  title.textContent=t?t.date+' '+t.venue+t.raceNo+'R '+(t.raceName||''):'レース未選択';
  gate.textContent='公式番号付き出馬表を確認中…';notice.textContent='';renderGroups();renderSlip();
  if(!t)return;
  try{
   const q='date='+encodeURIComponent(t.date)+'&venue='+encodeURIComponent(t.venue)+'&race_no='+encodeURIComponent(t.raceNo);
   const [cardResponse,gateResponse]=await Promise.all([
    fetch(api+'/api/jra/runners?race_key='+encodeURIComponent(t.date+':'+t.venue+':'+t.raceNo)),
    fetch(api+'/v1/lab/race-ops?'+q)
   ]);
   const [card,ops]=await Promise.all([cardResponse.json(),gateResponse.json()]);
   if(seq!==requestId)return;
   const verified=cardResponse.ok&&gateResponse.ok&&card.ok&&Number(card.count)===card.data?.length?verifyRoster(card.data,ops):null;
   if(!verified){gate.textContent='正式出馬表の保存・照合が未完了。番号付きの買い目構築は保留です。';renderGroups();return;}
   runners=verified.runners;ready=true;signature=runners.map(x=>x.horseNo+':'+x.frameNo+':'+x.horseName).join('|');
   gate.textContent='JRA保存監査OK · '+runners.length+'頭 · 枠番・馬番照合済み';
   loadSaved();renderGroups();renderSlip();
  }catch(e){if(seq===requestId){gate.textContent='出馬表を確認できません。再度レースを選択してください。';notice.textContent='取得エラー：'+e.message;renderGroups();}}
 }
 el.addEventListener('click',e=>{const button=e.target.closest?.('button[data-group][data-no]');if(!button||!ready)return;const index=Number(button.dataset.group),number=Number(button.dataset.no),arr=groups[index];if(!arr||!runners.some(x=>x.horseNo===number))return;groups[index]=arr.includes(number)?arr.filter(n=>n!==number):[...arr,number].sort((a,b)=>a-b);renderGroups();});
 type.addEventListener('change',()=>{methodOptions();renderGroups();});
 method.addEventListener('change',()=>{groups=[[],[],[]];updateMethodSettings();renderGroups();});
 axisPosition.addEventListener('change',renderPreview);multi.addEventListener('change',renderPreview);
 unit.addEventListener('input',renderPreview);
 $('ticketFromMarks').addEventListener('click',populateFromMarks);
 $('ticketResetGroups').addEventListener('click',()=>{groups=[[],[],[]];renderGroups();notice.textContent='馬の選択を解除しました。';});
 $('ticketAdd').addEventListener('click',add);
 budget.addEventListener('change',()=>{if(!Number.isSafeInteger(Number(budget.value))||Number(budget.value)<100||Number(budget.value)%100){notice.textContent='予算は100円以上の100円単位にしてください。';return;}save();renderSlip();});
 itemsBox.addEventListener('click',e=>{const btn=e.target.closest?.('[data-remove]');if(!btn)return;entries.splice(Number(btn.dataset.remove),1);notice.textContent='買い目を削除しました。';save();renderSlip();});
 itemsBox.addEventListener('change',e=>{const field=e.target.closest?.('input[data-stake]');if(!field)return;const i=Number(field.dataset.stake),stake=validateTicketStake(field.value),before=entries[i];if(!before)return;if(stake===null){notice.textContent='1点100円以上、100円単位にしてください。';renderSlip();return;}const total=state().total-before.unitStake*before.combos.length+stake*before.combos.length;if(total>Number(budget.value)){notice.textContent='予算を超えるため変更を取り消しました。';renderSlip();return;}before.unitStake=stake;save();renderSlip();});
 $('ticketClearSlip').addEventListener('click',()=>{entries=[];notice.textContent='このレースの買い目を空にしました。';save();renderSlip();});
 $('ticketCopy').addEventListener('click',async()=>{if(!entries.length)return;try{await window.navigator.clipboard.writeText(exportText());notice.textContent='買い目と予算をコピーしました。';}catch{notice.textContent='コピーできませんでした。ブラウザのコピー権限を確認してください。';}});
 window.addEventListener('labo-target-change',refreshRace);
 document.addEventListener('click',e=>{if(e.target.closest?.('.tab[data-id="bets"]')&&(!ready||!currentKey))void refreshRace();});
 methodOptions();void refreshRace();
}
