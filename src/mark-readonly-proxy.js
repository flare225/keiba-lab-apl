const TARGET='https://keiba-lab-api.sekai-no-bancyou.workers.dev';
const ALLOWED={
 'user-mark-audit':'/v1/lab/user-mark-audit',
 'mark-comparison':'/v1/lab/mark-comparison'
};
const fail=(res,status,message)=>res.status(status).setHeader('cache-control','no-store').json({ok:false,error:message});
export function parseMarkRequest(body){
 let data=body;
 if(Buffer.isBuffer(data))data=data.toString('utf8');
 if(typeof data==='string'){if(Buffer.byteLength(data,'utf8')>16384)throw Error('リクエストが大きすぎます');data=JSON.parse(data);}
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('監査リクエストが不正です');
 const {date,venue,raceNo,phase,marks,track}=data;
 if(!/^20\d\d-\d\d-\d\d$/.test(date||'')||typeof venue!=='string'||!venue||venue.length>20||
  !Number.isInteger(Number(raceNo))||Number(raceNo)<1||Number(raceNo)>12||
  !['initial','post_draw','final'].includes(phase)||!Array.isArray(marks)||marks.length<1||marks.length>18||
  (track!=null&&!['良','稍重','重','不良'].includes(track)))throw Error('開催日・レース・段階・印の指定が不正です');
 if(marks.some(m=>!m||!['◎','○','▲','△','☆','注','消'].includes(m.mark)||
  !(typeof m.horseName==='string'&&m.horseName.trim().length<=100&&m.horseName.trim()||Number.isInteger(m.horseNo)&&m.horseNo>=1&&m.horseNo<=18)))throw Error('馬名または馬番・印の指定が不正です');
 return {date,venue,raceNo:Number(raceNo),phase,marks:marks.map(m=>({...(m.horseName?{horseName:String(m.horseName).trim()}:{}),...(Number.isInteger(m.horseNo)?{horseNo:m.horseNo}:{}),mark:m.mark})),...(track?{track}:{})};
}
export async function forwardMarkAudit(req,res,mode,fetchImpl=fetch){
 res.setHeader('cache-control','no-store');
 if(req.method!=='POST')return fail(res,405,'POSTによる読み取り専用の監査のみ対応しています');
 if(!ALLOWED[mode])return fail(res,404,'対象の監査APIがありません');
 try{
  const data=parseMarkRequest(req.body);
  const upstream=await fetchImpl(TARGET+ALLOWED[mode],{
   method:'POST',headers:{'content-type':'application/json','accept':'application/json'},
   body:JSON.stringify(data),signal:AbortSignal.timeout(25000),redirect:'error'
  });
  const contentType=upstream.headers.get('content-type')||'';
  const text=await upstream.text();
  if(!contentType.includes('application/json'))return fail(res,502,'監査APIの応答形式が正しくありません');
  let parsed;try{parsed=JSON.parse(text)}catch{return fail(res,502,'監査APIのJSON応答を読み取れません');}
  if(!parsed||typeof parsed!=='object')return fail(res,502,'監査APIの応答を確認できません');
  return res.status(upstream.status).json(parsed);
 }catch(e){
  if(e?.name==='TimeoutError'||e?.name==='AbortError')return fail(res,504,'監査APIの応答が時間内に届きませんでした。再試行してください。');
  if(e instanceof SyntaxError||/リクエスト|馬名|開催日/.test(String(e?.message||'')))return fail(res,400,e.message);
  return fail(res,502,'監査APIへ接続できませんでした。通信状況を確認し、時間をおいて再試行してください。');
 }
}
