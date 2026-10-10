const TARGET='https://keiba-lab-api.sekai-no-bancyou.workers.dev/v1/lab/user-marks';
const send=(res,status,body)=>res.status(status).setHeader('cache-control','no-store').json(body);
const allowedPhase=new Set(['post_draw','final']);
export function markWriteBody(data){
 if(typeof data==='string')data=JSON.parse(data);
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('保存内容が不正です。');
 const {date,venue,raceNo,phase,marks,track,confirm}=data;
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(date||'')||typeof venue!=='string'||!venue.trim()||venue.length>30||
 !Number.isInteger(Number(raceNo))||Number(raceNo)<1||Number(raceNo)>12||
 !allowedPhase.has(phase)||confirm!=='SAVE'||!Array.isArray(marks)||marks.length<1||marks.length>18||
 (phase==='final'&&!['良','稍重','重','不良'].includes(track))||
 (track!=null&&!['良','稍重','重','不良'].includes(track)))throw Error('レース・印の段階・馬場想定を確認してください。');
 const selected=new Set(),valid=['◎','○','▲','△','☆','注','消'];
 for(const m of marks){
  if(!m||!Number.isInteger(m.horseNo)||m.horseNo<1||m.horseNo>18||
   typeof m.horseName!=='string'||!m.horseName.trim()||m.horseName.length>100||
   !valid.includes(m.mark)||selected.has(m.horseNo))throw Error('印の馬名・馬番・重複を確認してください。');
  selected.add(m.horseNo);
 }
 if(marks.filter(x=>x.mark==='◎').length>1||marks.filter(x=>x.mark==='○').length>1)throw Error('◎または○が重複しています。');
 return {date,venue:venue.trim(),raceNo:Number(raceNo),phase,
 marks:marks.map(m=>({horseNo:m.horseNo,horseName:m.horseName.trim(),mark:m.mark})),
 ...(track?{track}:{}),confirm:'SAVE'};
}
const parseReadQuery=q=>{
 const date=String(q?.date||''),venue=String(q?.venue||''),raceNo=Number(q?.race_no),phase=String(q?.phase||'');
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(date)||!venue||venue.length>30||
 !Number.isInteger(raceNo)||raceNo<1||raceNo>12||!allowedPhase.has(phase))throw Error('レース指定が不正です。');
 return new URLSearchParams({date,venue,race_no:String(raceNo),phase});
};
export async function handleMarkStorage(req,res,mode,fetcher=fetch){
 res.setHeader('cache-control','no-store');
 if(mode==='read'&&req.method!=='GET'||mode==='write'&&req.method!=='POST'||!['read','write'].includes(mode))
  return send(res,405,{ok:false,error:'指定した操作には対応していません。'});
 let request;
 try{
  if(mode==='read'){
   const query=parseReadQuery(req.query);
   request={url:TARGET+'?'+query.toString(),init:{method:'GET',redirect:'error',signal:AbortSignal.timeout(25000)}};
  }else{
   const authorization=String(req.headers?.authorization||'');
   if(!/^Bearer [^\s]{8,512}$/.test(authorization))
    return send(res,401,{ok:false,error:'正式DB保存には管理用保存キーが必要です。'});
   const body=markWriteBody(req.body);
   request={url:TARGET,init:{method:'POST',redirect:'error',headers:{authorization,'content-type':'application/json','accept':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)}};
  }
 }catch(err){return send(res,400,{ok:false,error:err.message||'保存内容が不正です。'});}
 try{
  const response=await fetcher(request.url,request.init);
  if(!(response.headers.get('content-type')||'').includes('application/json'))
   return send(res,502,{ok:false,error:'LABO DBの応答を読み取れませんでした。'});
  const body=await response.json();
  if(!body||typeof body!=='object')return send(res,502,{ok:false,error:'LABO DBの応答が不正です。'});
  // Upstream authorization errors are not disguised as successful saves.
  return send(res,response.status,body);
 }catch(err){
  return send(res,err?.name==='TimeoutError'?504:502,{ok:false,error:err?.name==='TimeoutError'?'DB保存の応答が時間内に届きませんでした。保存状況を再確認してください。':'DBに接続できませんでした。時間をおいて保存状況を再確認してください。'});
 }
}
