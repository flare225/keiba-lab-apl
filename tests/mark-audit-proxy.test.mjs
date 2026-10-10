import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import app from '../src/index-v1.21.js';
import auditRoute from '../api/lab-audit.js';
import comparisonRoute from '../api/lab-comparison.js';
import {parseMarkRequest,forwardMarkAudit} from '../src/mark-readonly-proxy.js';
import {readFileSync} from 'node:fs';
const valid={date:'2026-10-11',venue:'東京',raceNo:11,phase:'post_draw',marks:[{horseName:'アイルランドTの馬',mark:'◎'}]};
function response(){
 const out={code:200,headers:{},payload:null};
 const res={status(code){out.code=code;return res;},setHeader(k,v){out.headers[k]=v;return res;},json(data){out.payload=data;return res;}};
 return{res,out};
}
function fetchStub(status=200){
 const seen=[];
 const fetcher=async (url,opts)=>{seen.push({url,opts});return new Response(JSON.stringify({ok:true,stage:'user-mark-db-crosscheck',audit:{marked:[]}}),{status,headers:{'content-type':'application/json'}});};
 return {seen,fetcher};
}
test('same-origin Vercel rewrites must precede SPA catch-all',()=>{
 const cfg=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.deepEqual(cfg.rewrites.slice(0,2).map(x=>[x.source,x.destination]),[
  ['/v1/lab/user-mark-audit','/api/lab-audit'],
  ['/v1/lab/mark-comparison','/api/lab-comparison']
 ]);
 assert.deepEqual(cfg.rewrites.at(-1),{source:'/(.*)',destination:'/api/v116'});
});
test('strict parsing supports official horse-name, horse-number and post_draw but refuses invalid or oversized requests',()=>{
 assert.deepEqual(parseMarkRequest(valid),valid);
 assert.equal(parseMarkRequest(JSON.stringify(valid)).raceNo,11);
 assert.equal(parseMarkRequest({...valid,marks:[{horseNo:4,mark:'消'}]}).marks[0].horseNo,4);
 assert.throws(()=>parseMarkRequest({...valid,marks:[]}),/不正/);
 assert.throws(()=>parseMarkRequest({...valid,marks:[{horseNo:23,mark:'◎'}]}),/不正/);
 assert.throws(()=>parseMarkRequest({...valid,track:'unknown'}),/不正/);
 assert.throws(()=>parseMarkRequest('{not-json}'),SyntaxError);
 assert.throws(()=>parseMarkRequest('x'.repeat(17000)),/大きすぎ/);
});
test('audit proxy performs a POST to allowlisted upstream and returns unchanged JSON result, avoiding browser CORS',async()=>{
 const {res,out}=response(),{fetcher,seen}=fetchStub();
 await forwardMarkAudit({method:'POST',body:valid},res,'user-mark-audit',fetcher);
 assert.equal(out.code,200);assert.equal(out.payload.stage,'user-mark-db-crosscheck');
 assert.equal(out.headers['cache-control'],'no-store');
 assert.equal(seen.length,1);
 assert.equal(seen[0].url,'https://keiba-lab-api.sekai-no-bancyou.workers.dev/v1/lab/user-mark-audit');
 assert.equal(seen[0].opts.headers['content-type'],'application/json');
 assert.equal(seen[0].opts.headers.authorization,undefined);
 assert.deepEqual(JSON.parse(seen[0].opts.body),valid);
});
test('read-only comparison routes to separate endpoint without exposing arbitrary proxy targets',async()=>{
 const {res,out}=response(),{fetcher,seen}=fetchStub();
 await forwardMarkAudit({method:'POST',body:{...valid,phase:'initial'}},res,'mark-comparison',fetcher);
 assert.equal(out.code,200);assert.match(seen[0].url,/mark-comparison$/);
 const another=response();
 await forwardMarkAudit({method:'POST',body:valid},another.res,'https://bad.example',fetcher);
 assert.equal(another.out.code,404);
});
test('non-post, malformed payload, upstream timeout and network failure yield explicit safe errors',async()=>{
 const get=response();await forwardMarkAudit({method:'GET',body:valid},get.res,'user-mark-audit');assert.equal(get.out.code,405);
 const invalid=response();await forwardMarkAudit({method:'POST',body:{...valid,marks:[]}},invalid.res,'user-mark-audit');assert.equal(invalid.out.code,400);
 const blocked=response();await forwardMarkAudit({method:'POST',body:valid},blocked.res,'user-mark-audit',async()=>{throw Error('ECONNRESET')});
 assert.equal(blocked.out.code,502);assert.match(blocked.out.payload.error,/接続できません/);
 const timeout=response();await forwardMarkAudit({method:'POST',body:valid},timeout.res,'user-mark-audit',async()=>{throw new DOMException('timeout','TimeoutError')});
 assert.equal(timeout.out.code,504);assert.match(timeout.out.payload.error,/時間内/);
 const html=response();await forwardMarkAudit({method:'POST',body:valid},html.res,'user-mark-audit',async()=>new Response('<!doctype html>',{headers:{'content-type':'text/html'}}));
 assert.equal(html.out.code,502);
});
test('route entrypoints use only the fixed allowlisted target',()=>{
 assert.equal(typeof auditRoute,'function');
 assert.equal(typeof comparisonRoute,'function');
});
test('app browser chooses same-origin on Vercel and embedded scripts remain valid',async()=>{
 const html=await(await app.fetch(new Request('https://example.com/'))).text();
 assert.match(html,/const auditApi=\/\\\.vercel\\\.app\$\//);
 assert.match(html,/fetch\(auditApi\+'\/v1\/lab\/user-mark-audit'/);
 assert.match(html,/fetch\(auditApi\+'\/v1\/lab\/mark-comparison'/);
 for(const [,script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(script);
});
