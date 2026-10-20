// Install before app scripts. Limits read bursts only; never retries or writes.
export function installReadRequestGuard(window,{apiOrigin,concurrency=2,clock=Date.now}={}){
 if(window.__laboReadRequestGuard)return window.__laboReadRequestGuard;
 const nativeFetch=window.fetch.bind(window),queue=[],inflight=new Map();let active=0,blockedUntil=0;
 const storageKey='keiba-labo:observed-read-quota:v1';
 try{const saved=JSON.parse(window.localStorage.getItem(storageKey)||'null'),now=clock(),reset=Date.parse(new Date(now).toISOString().slice(0,10)+'T00:00:00Z')+86400000;if(saved?.until===reset&&saved.until>now)blockedUntil=saved.until;}catch{}
 const pauseResponse=()=>Response.json({ok:false,error:'DBの日次読み取り上限を確認したため、追加照会を停止しています。日本時間9時以降に再確認します。',code:'D1_READ_QUOTA_PAUSED',nextResetAt:new Date(blockedUntil).toISOString()},{status:503,headers:{'cache-control':'no-store'}});
 const paused=()=>{if(blockedUntil&&blockedUntil<=clock()){blockedUntil=0;try{window.localStorage.removeItem(storageKey);}catch{}}return blockedUntil>clock();};
 function rememberPause(){const day=new Date(clock()).toISOString().slice(0,10);blockedUntil=Date.parse(day+'T00:00:00Z')+86400000;try{window.localStorage.setItem(storageKey,JSON.stringify({until:blockedUntil}));}catch{}}
 function pump(){while(active<concurrency&&queue.length){const task=queue.shift();if(task.cancelled)continue;active++;task.started=true;Promise.resolve().then(task.run).then(task.resolve,task.reject).finally(()=>{active--;task.cleanup();pump();});}}
 function enqueue(run,signal){return new Promise((resolve,reject)=>{const task={run,resolve,reject,started:false,cancelled:false,cleanup(){signal?.removeEventListener('abort',abort);}};function abort(){if(!task.started){task.cancelled=true;task.cleanup();reject(new DOMException('Aborted','AbortError'));}}if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});queue.push(task);pump();});}
 window.fetch=function(input,init={}){
  let url;try{url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,window.location.href);}catch{return nativeFetch(input,init);}
  const method=String(init.method||input?.method||'GET').toUpperCase(),own=url.origin===apiOrigin||url.origin===window.location.origin;
  const exempt=['/v1/lab/deploy-check','/v1/lab/user-mark-session'].includes(url.pathname);
  const guarded=own&&method==='GET'&&!exempt&&(url.pathname.startsWith('/v1/')||url.pathname.startsWith('/api/jra/'));
  if(!guarded)return nativeFetch(input,init);
  if(paused())return Promise.resolve(pauseResponse());
  const headers=new Headers(init.headers||input?.headers),signal=init.signal||input?.signal;
  // Identity-dependent reads may queue, but cannot share a response.
  const share=!signal&&!headers.has('authorization')&&!headers.has('cookie');
  const canonical=new URL(url);canonical.searchParams.sort();
  const key=share?JSON.stringify([canonical.href,[...headers.entries()].sort(),init.credentials||input?.credentials||'same-origin',init.cache||input?.cache||'default']):null;
  if(key&&inflight.has(key))return inflight.get(key).then(r=>r.clone());
  const pending=enqueue(async()=>{
   if(paused())return pauseResponse();
   const response=await nativeFetch(input,init);
   if((response.headers.get('content-type')||'').includes('application/json')){
    try{const data=await response.clone().json();if(data?.ok===false&&/exceeded D1.*daily row read limit/i.test(String(data.error||'')))rememberPause();}catch{}
   }
   return response;
  },signal);
  if(key){inflight.set(key,pending);const clear=()=>{if(inflight.get(key)===pending)inflight.delete(key);};pending.then(clear,clear);}
  return pending.then(r=>r.clone());
 };
 const state={scope:'browser-db-reads',status:()=>({active,queued:queue.filter(t=>!t.cancelled).length,blockedUntil:paused()?blockedUntil:null}),noAutomaticRetry:true};
 window.__laboReadRequestGuard=state;return state;
}
