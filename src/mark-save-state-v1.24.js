export const USER_MARKS=['◎','○','▲','△','☆','注','消'];
export const TRACK_CONDITIONS=['良','稍重','重','不良'];
export function verifiedMarkPayload(target,state={}){
 if(!target||!/^20\d{2}-\d{2}-\d{2}$/.test(target.date||'')||
 typeof target.venue!=='string'||!target.venue||!Number.isInteger(Number(target.raceNo))||
 Number(target.raceNo)<1||Number(target.raceNo)>12)throw Error('対象レースを確認してください。');
 const phase=state.phase;
 if(!['post_draw','final'].includes(phase))throw Error('枠順後または最終印を選んでください。');
 if(state.rosterVerified!==true||!Array.isArray(state.roster)||!state.roster.length||
 state.roster.length>18)throw Error('JRA正式出馬表の照合が完了していません。');
 const rosterNumbers=state.rosterNumbers||{},seenHorses=new Set(),seenNos=new Set();
 for(const name of state.roster){
  const rec=rosterNumbers[name];
  if(!name||!rec||rec.verified!==true||!Number.isInteger(rec.horseNo)||rec.horseNo<1||
  rec.horseNo>18||!Number.isInteger(rec.frameNo)||rec.frameNo<1||rec.frameNo>8||
  seenHorses.has(name)||seenNos.has(rec.horseNo))throw Error('馬番・枠番・馬名の照合が不完全です。');
  seenHorses.add(name);seenNos.add(rec.horseNo);
 }
 const track=state.track;
 if(phase==='final'&&!TRACK_CONDITIONS.includes(track))throw Error('最終印は馬場想定（良・稍重・重・不良）の指定が必要です。');
 if(track&&!TRACK_CONDITIONS.includes(track))throw Error('馬場想定の指定が不正です。');
 const selections=state.marks||[];
 if(!Array.isArray(selections)||!selections.length||selections.length>18)throw Error('印を1頭以上選んでください。');
 const marked=new Set(),marks=[];
 for(const choice of selections){
  const name=choice.horseName||state.roster.find(n=>rosterNumbers[n]?.horseNo===choice.horseNo);
  if(!name||!seenHorses.has(name)||marked.has(name)||!USER_MARKS.includes(choice.mark))throw Error('印・馬名が正式出馬表と一致しません。');
  const no=rosterNumbers[name].horseNo;
  if(choice.horseNo!=null&&choice.horseNo!==no)throw Error('印の馬番が一致しません。');
  marked.add(name);marks.push({horseNo:no,horseName:name,mark:choice.mark});
 }
 if(marks.filter(x=>x.mark==='◎').length>1||marks.filter(x=>x.mark==='○').length>1)throw Error('◎または○が重複しています。');
 marks.sort((a,b)=>a.horseNo-b.horseNo);
 return {date:target.date,venue:target.venue,raceNo:Number(target.raceNo),phase,
  marks,...(track?{track}:{}),confirm:'SAVE'};
}
export function sameDbMarks(payload,receipt){
 const entries=receipt?.entries;
 if(!payload||receipt?.phase!==payload.phase||!Number.isInteger(receipt?.revisionNo)||receipt.revisionNo<1||
 !Array.isArray(entries)||entries.length!==payload.marks.length)return false;
 if((receipt.trackCondition||'')!==(payload.track||''))return false;
 const expected=payload.marks.map(x=>[x.horseNo,x.horseName,x.mark].join('|')).sort();
 const actual=entries.map(x=>[Number(x.horse_no??x.horseNo),x.horse_name??x.horseName,x.mark].join('|')).sort();
 return expected.every((x,i)=>x===actual[i]);
}
export function summarizeDbRevision(data,phase){
 if(!data?.ok||!Array.isArray(data.latest))return{status:'unavailable',revision:null};
 const result=data.latest.find(x=>x.phase===phase&&Number.isInteger(x.revisionNo));
 return result?{status:'saved',revision:result}:{status:'none',revision:null};
}
export function localMarkReceipt({payload,recordedAt,localRevision,rosterIdentity}){
 if(!payload||!recordedAt||!Number.isInteger(localRevision)||localRevision<1||!rosterIdentity)throw Error('端末内の控えを作成できません。');
 return {recordedAt,localRevision,rosterIdentity,payload};
}
