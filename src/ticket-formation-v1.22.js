export const WAGER_TYPES=['単勝','複勝','枠連','馬連','馬単','ワイド','三連複','三連単'];
export const WAGER_METHODS=['box','nagashi','nagashi2','formation'];

export function ticketMethodOptions(type){
 if(['単勝','複勝'].includes(type))return [{value:'box',label:'選択馬'}];
 if(['三連複','三連単'].includes(type))return [
  {value:'box',label:'BOX'},{value:'nagashi',label:'軸1頭流し'},
  {value:'nagashi2',label:'軸2頭流し'},{value:'formation',label:'フォーメーション'}
 ];
 return [{value:'box',label:'BOX'},{value:'nagashi',label:'軸1頭流し'},{value:'formation',label:'フォーメーション'}];
}
export function groupLabels(type,method){
 const three=['三連複','三連単'].includes(type);
 if(['単勝','複勝'].includes(type)||method==='box')return ['選ぶ馬'];
 if(method==='nagashi')return ['軸馬（1頭）','相手馬'];
 if(method==='nagashi2')return ['軸馬（2頭）','相手馬'];
 if(type==='三連単')return ['1着候補','2着候補','3着候補'];
 if(type==='三連複')return ['1組目','2組目','3組目'];
 return ['1組目','2組目'];
}
export function generateFormationTickets({type='三連単',method='formation',groups=[],multi=false,axisPosition=1,roster=[]}={}){
 if(!WAGER_TYPES.includes(type))return{ok:false,error:'対応していない券種です。',combos:[],count:0};
 if(!ticketMethodOptions(type).some(x=>x.value===method))return{ok:false,error:'券種に対応していない買い方です。',combos:[],count:0};
 if(!Array.isArray(roster)||!roster.length)return{ok:false,error:'出馬表がありません。',combos:[],count:0};
 const horseMap=new Map(roster.filter(x=>Number.isInteger(x.horseNo)&&x.horseNo>=1&&x.horseNo<=18).map(x=>[x.horseNo,x]));
 if(horseMap.size!==roster.length)return{ok:false,error:'出馬表の馬番が重複または不正です。',combos:[],count:0};
 const sets=(Array.isArray(groups)?groups:[]).map(g=>[...new Set((Array.isArray(g)?g:[]).map(Number).filter(n=>Number.isInteger(n)&&horseMap.has(n)))]);
 const get=i=>sets[i]||[];
 const n=['単勝','複勝'].includes(type)?1:['枠連','馬連','馬単','ワイド'].includes(type)?2:3;
 const ordered=['馬単','三連単'].includes(type);
 const frameOnly=type==='枠連';
 if(frameOnly&&roster.some(x=>!Number.isInteger(x.frameNo)||x.frameNo<1||x.frameNo>8))return{ok:false,error:'枠連には正式な枠番が必要です。',combos:[],count:0};
 const valid=arr=>arr.length===n&&new Set(arr).size===n;
 const pairs=xs=>xs.flatMap((x,i)=>xs.slice(i+1).map(y=>[x,y]));
 const triples=xs=>xs.flatMap((x,i)=>xs.slice(i+1).flatMap((y,j)=>xs.slice(i+j+2).map(z=>[x,y,z])));
 const permutations=xs=>xs.flatMap(a=>xs.filter(b=>a!==b).flatMap(b=>xs.length===2?[[a,b]]:xs.filter(c=>c!==a&&c!==b).map(c=>[a,b,c])));
 let results=[];
 if(n===1){results=get(0).map(x=>[x]);}
 else if(method==='box'){
  results=(n===2?pairs(get(0)):triples(get(0)));
  if(ordered)results=results.flatMap(p=>permutations(p));
 }else if(method==='formation'){
  if(sets.slice(0,n).some(x=>!x.length))return{ok:false,error:'各組の候補馬を選択してください。',combos:[],count:0};
  if(n===2)results=get(0).flatMap(a=>get(1).map(b=>[a,b]));
  else results=get(0).flatMap(a=>get(1).flatMap(b=>get(2).map(c=>[a,b,c])));
 }else{
  const axis=get(0),opponents=get(1);
  if(method==='nagashi'&&axis.length!==1)return{ok:false,error:'軸馬を1頭選択してください。',combos:[],count:0};
  if(method==='nagashi2'&&axis.length!==2)return{ok:false,error:'軸馬を2頭選択してください。',combos:[],count:0};
  if(method==='nagashi'&&n===2)results=opponents.map(x=>ordered&&(Number(axisPosition)===2)?[x,axis[0]]:[axis[0],x]);
  if(method==='nagashi'&&n===3)results=pairs(opponents).flatMap(p=>{
   const trio=[axis[0],...p];
   if(!ordered)return[trio];
   if(multi)return permutations(trio);
   const pos=Number(axisPosition);if(![1,2,3].includes(pos))return[];
   return permutations(p).map(q=>{const result=q.slice();result.splice(pos-1,0,axis[0]);return result;});
  });
  if(method==='nagashi2'&&n===3)results=opponents.flatMap(x=>ordered?(multi?permutations([...axis,x]):[[...axis,x]]):[[...axis,x]]);
  if(method==='nagashi'&&n===2&&ordered&&multi)results=results.flatMap(p=>[p,[p[1],p[0]]]);
 }
 const unique=new Set(),combos=[];
 for(const r of results){
  if(!valid(r))continue;
  const converted=frameOnly?r.map(x=>horseMap.get(x).frameNo):r.slice();
  if(frameOnly&&method==='box'&&converted[0]===converted[1])continue; // JRA 枠連BOX excludes ゾロ目; 流し・フォーメーション may include it.
  if(!ordered)converted.sort((a,b)=>a-b);
  const key=converted.join('-');
  if(unique.has(key))continue;unique.add(key);combos.push(converted);
 }
 combos.sort((a,b)=>{for(let i=0;i<a.length;i++){if(a[i]!==b[i])return a[i]-b[i];}return 0;});
 return combos.length?{ok:true,combos,count:combos.length,kind:type,method,multi:Boolean(multi)}:{ok:false,error:'有効な組合せがありません。軸と相手の重複や選択数を確認してください。',combos:[],count:0};
}
export function validateTicketStake(raw){
 const n=Number(raw);return Number.isSafeInteger(n)&&n>=100&&n%100===0?n:null;
}
export function calculateTicketSlip(items=[],budget=0){
 const max=Number(budget),yen=Number.isSafeInteger(max)&&max>=0?max:0;
 let total=0,count=0;const seen=new Set(),duplicates=[];
 for(const item of items){
  const stake=validateTicketStake(item.unitStake);
  if(stake===null||!WAGER_TYPES.includes(item.type)||!Array.isArray(item.combos))return{ok:false,error:'券種または1点あたりの金額が不正です。',total,count,budget:yen};
  for(const combo of item.combos){
   if(!Array.isArray(combo)||combo.length<1||combo.some(x=>!Number.isInteger(x)||x<1||x>18))return{ok:false,error:'買い目の組番が不正です。',total,count,budget:yen};
   const key=item.type+':'+combo.join('-');if(seen.has(key))duplicates.push(key);seen.add(key);
  }
  total+=stake*item.combos.length;count+=item.combos.length;
 }
 return{ok:total<=yen&&duplicates.length===0,total,count,budget:yen,remaining:yen-total,duplicates,error:duplicates.length?'重複する買い目が含まれます。':total>yen?'設定した予算を超えています。':null};
}
