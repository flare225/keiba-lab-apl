import {createHmac,createHash,timingSafeEqual} from 'node:crypto';
const UPSTREAM='https://keiba-lab-api.sekai-no-bancyou.workers.dev/v1/lab/user-marks';
const COOKIE='labo_owner_marks_v1';
const MARKS=new Set(['◎','○','▲','△','☆','注','消']);
const PHASES=new Set(['initial','post_draw','final']);
const DAY=/^20\d{2}-\d{2}-\d{2}$/;
const now=()=>Date.now();
const output=(res,status,value)=>res.status(status).setHeader('cache-control','no-store').json(value);
const cfg=e=>Boolean(e.LABO_MARK_OWNER_PASSPHRASE?.length>=24&&e.LABO_MARK_SESSION_SECRET?.length>=32&&e.LABO_MARK_DB_WRITE_TOKEN?.length>=24);
export function sameOrigin(req){
 try{
  const origin=req.headers?.origin;
  if(!origin||!req.headers?.host)return false;
  const u=new URL(origin);
  return u.protocol==='https:'&&u.host===req.headers.host;
 }catch{return false;}
}
function mac(secret,data){return createHmac('sha256',secret).update(data).digest('base64url');}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;
 const ah=createHash('sha256').update(a).digest(),bh=createHash('sha256').update(b).digest();
 return timingSafeEqual(ah,bh);}
function cookieValue(req){
 const h=String(req.headers?.cookie||'');return h.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
}
export function createOwnerSession(secret,issued=now()){
 const data=Buffer.from(JSON.stringify({scope:'mark-save',exp:issued+8*3600000})).toString('base64url');
 return data+'.'+mac(secret,data);
}
export function verifyOwnerSession(req,secret,stamp=now()){
 if(!secret||secret.length<32)return false;
 const token=cookieValue(req),parts=token.split('.');
 if(parts.length!==2||parts[0].length>1000||!equal(parts[1],mac(secret,parts[0])))return false;
 try{const d=JSON.parse(Buffer.from(parts[0],'base64url').toString());
  return d.scope==='mark-save'&&Number.isSafeInteger(d.exp)&&d.exp>stamp&&d.exp<stamp+9*3600000;
 }catch{return false;}
}
function sanitize(body){
 const date=body?.date,venue=body?.venue,raceNo=Number(body?.raceNo);
 if(!DAY.test(date||'')||!['東京','京都','中山','阪神','中京','小倉','福島','新潟','函館','札幌'].includes(venue)
 ||!Number.isInteger(raceNo)||raceNo<1||raceNo>12||!PHASES.has(body?.phase)||body?.confirm!=='SAVE')throw Error('保存対象・確認指定が不正です。');
 if(body.phase==='final'&&!['良','稍重','重','不良'].includes(body?.track))throw Error('最終印の馬場想定が必要です。');
 if(body.track&&!['良','稍重','重','不良'].includes(body.track))throw Error('馬場想定が不正です。');
 if(!Array.isArray(body.marks)||body.marks.length<1||body.marks.length>18)throw Error('印は1〜18頭を指定してください。');
 const names=new Set(),nos=new Set(),marks=[];
 for(const m of body.marks){
  const horseName=String(m?.horseName||'').trim(),horseNo=m?.horseNo==null?null:Number(m.horseNo),mark=m?.mark;
  if(!horseName||horseName.length>120||!MARKS.has(mark)||names.has(horseName)||
   horseNo!==null&&(!Number.isInteger(horseNo)||horseNo<1||horseNo>18||nos.has(horseNo)))throw Error('馬番・馬名・印の入力を確認してください。');
  names.add(horseName);if(horseNo!==null)nos.add(horseNo);
  marks.push({horseName,...(horseNo!==null?{horseNo}:{}),mark});
 }
 if(marks.filter(x=>x.mark==='◎').length>1||marks.filter(x=>x.mark==='○').length>1)throw Error('◎または○が重複しています。');
 return {date,venue,raceNo,phase:body.phase,...(body.track?{track:body.track}:{}),marks,confirm:'SAVE'};
}
async function readJSON(resp){if(!(resp.headers.get('content-type')||'').includes('json'))throw Error('保存APIがJSONを返しませんでした');return resp.json();}
export async function handleOwnerSession(req,res,env=process.env,stamp=now()){
 if(req.method==='GET')return output(res,200,{ok:true,configured:cfg(env),authenticated:cfg(env)&&verifyOwnerSession(req,env.LABO_MARK_SESSION_SECRET,stamp),storage:'Cloudflare D1 via server authenticated proxy'});
 if(req.method==='DELETE'){
  if(!sameOrigin(req))return output(res,403,{ok:false,error:'同一画面から操作してください。'});
  res.setHeader('set-cookie',COOKIE+'=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict');
  return output(res,200,{ok:true,authenticated:false});
 }
 if(req.method!=='POST')return output(res,405,{ok:false,error:'操作に対応していません。'});
 if(!sameOrigin(req))return output(res,403,{ok:false,error:'同一画面から操作してください。'});
 if(!cfg(env))return output(res,503,{ok:false,error:'DB保存用の管理設定が未完了です。運営者によるサーバー認証・DB接続設定が必要です。'});
 const password=req.body?.passphrase;
 if(typeof password!=='string'||password.length>300||!equal(password,env.LABO_MARK_OWNER_PASSPHRASE))
  return output(res,401,{ok:false,error:'認証情報を確認してください。'});
 res.setHeader('set-cookie',COOKIE+'='+createOwnerSession(env.LABO_MARK_SESSION_SECRET,stamp)+'; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Strict');
 return output(res,200,{ok:true,authenticated:true});
}
export async function handleOwnerMarkSave(req,res,fetcher=fetch,env=process.env,stamp=now()){
 if(req.method!=='POST')return output(res,405,{ok:false,error:'保存にはPOSTが必要です。'});
 if(!sameOrigin(req))return output(res,403,{ok:false,error:'同一画面から操作してください。'});
 if(!cfg(env))return output(res,503,{ok:false,error:'DB保存用の管理設定が未完了です。端末内の印は残っています。'});
 if(!verifyOwnerSession(req,env.LABO_MARK_SESSION_SECRET,stamp))return output(res,401,{ok:false,error:'DB保存には本人認証が必要です。'});
 let data;
 try{data=sanitize(req.body);}catch(e){return output(res,400,{ok:false,error:String(e.message||e)})}
 try{
  const response=await fetcher(UPSTREAM,{method:'POST',redirect:'error',signal:AbortSignal.timeout(25000),
   headers:{authorization:'Bearer '+env.LABO_MARK_DB_WRITE_TOKEN,'content-type':'application/json'},body:JSON.stringify(data)});
  const answer=await readJSON(response);
  if(!response.ok||!answer.ok||answer.stage!=='user-mark-saved-and-crosschecked'||!answer.revisionId)
   return output(res,response.status===503?503:502,{ok:false,error:answer.error||'正式DB保存が完了しませんでした。'});
  const params=new URLSearchParams({date:data.date,venue:data.venue,race_no:String(data.raceNo),phase:data.phase});
  const proof=await fetcher(UPSTREAM+'?'+params,{method:'GET',redirect:'error',signal:AbortSignal.timeout(25000)});
  const checked=await readJSON(proof);
  const revision=checked.latest?.find(x=>x.phase===data.phase&&x.revisionId===answer.revisionId);
  const actual=revision?.entries?.map(x=>[Number(x.horse_no??x.horseNo)||null,x.horse_name??x.horseName,x.mark].join('|')).sort();
  const expected=data.marks.map(x=>[x.horseNo??null,x.horseName,x.mark].join('|')).sort();
  if(!proof.ok||!checked.ok||!revision||actual?.length!==expected.length||!expected.every((x,i)=>x===actual[i]))
   return output(res,502,{ok:false,saveMayHaveSucceeded:true,error:'DB書き込み後の再照合が一致しませんでした。保存履歴を更新して確認してください。'});
  return output(res,200,{ok:true,stage:'db-written-readback-verified',raceKey:checked.raceKey,phase:data.phase,
   revisionNo:revision.revisionNo,revisionId:revision.revisionId,entryCount:actual.length,verifiedAt:new Date(stamp).toISOString()});
 }catch{
  return output(res,502,{ok:false,saveMayHaveSucceeded:true,error:'DB保存または保存後の照合が確認できませんでした。保存履歴を再確認してください。'});
 }
}
