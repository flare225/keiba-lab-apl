const TARGET='https://keiba-lab-api.sekai-no-bancyou.workers.dev/v1/lab/user-marks';
const send=(res,status,body)=>res.status(status).setHeader('cache-control','no-store').json(body);
export function parseMarkHistoryQuery(q){
 const date=String(q?.date||''),venue=String(q?.venue||''),raceNo=Number(q?.race_no),phase=String(q?.phase||'');
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(date)||!venue||venue.length>30||
 !Number.isInteger(raceNo)||raceNo<1||raceNo>12||!['post_draw','final'].includes(phase))
 throw Error('レース指定が不正です。');
 return new URLSearchParams({date,venue,race_no:String(raceNo),phase});
}
export async function handleMarkHistory(req,res,fetcher=fetch){
 res.setHeader('cache-control','no-store');
 if(req.method!=='GET')return send(res,405,{ok:false,error:'DB履歴の読み取り専用です。'});
 let query;
 try{query=parseMarkHistoryQuery(req.query);}catch(err){return send(res,400,{ok:false,error:err.message});}
 try{
  const response=await fetcher(TARGET+'?'+query.toString(),{method:'GET',redirect:'error',signal:AbortSignal.timeout(25000)});
  if(!(response.headers.get('content-type')||'').includes('application/json'))return send(res,502,{ok:false,error:'LABO DBの応答を読み取れませんでした。'});
  const body=await response.json();
  if(!body||typeof body!=='object')return send(res,502,{ok:false,error:'LABO DBの応答が不正です。'});
  return send(res,response.status,body);
 }catch(err){
  return send(res,err?.name==='TimeoutError'?504:502,{ok:false,error:'DB保存履歴の取得に失敗しました。時間をおいて再確認してください。'});
 }
}
