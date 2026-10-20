import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import app from '../src/index-v1.21.js';
import {installReadRequestGuard} from '../src/read-request-guard.js';
const apiOrigin='https://api.test',quota={ok:false,error:"D1_ERROR: Your account has exceeded D1's free tier daily row read limit."};
function fixture(fetch,storage=new Map()){return{fetch,location:{href:'https://app.test/',origin:'https://app.test'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};}
test('43 queued reads make at most two upstream calls after quota detection, including HTTP200/ok:false',async()=>{
 let calls=0;const win=fixture(async()=>{calls++;return Response.json(quota);});installReadRequestGuard(win,{apiOrigin});
 const responses=await Promise.all(Array.from({length:43},(_,i)=>win.fetch(apiOrigin+'/v1/lab/race-ops?race_no='+i)));assert.equal(calls,2);assert.equal(responses.length,43);const bodies=await Promise.all(responses.map(r=>r.json()));assert.equal(bodies.filter(x=>x.code==='D1_READ_QUOTA_PAUSED').length,41);
 assert.equal((await win.fetch(apiOrigin+'/v1/lab/work-progress')).status,503);assert.equal(calls,2);
});
test('concurrent identical public reads share one response but later reads are fresh',async()=>{
 let calls=0;const win=fixture(async()=>{calls++;await setImmediate();return Response.json({ok:true,revision:calls});});installReadRequestGuard(win,{apiOrigin});
 const rs=await Promise.all(Array.from({length:10},()=>win.fetch(apiOrigin+'/v1/lab/race-ops?venue=東京&race_no=1')));assert.equal(calls,1);for(const r of rs)assert.equal((await r.json()).revision,1);
 assert.equal((await(await win.fetch(apiOrigin+'/v1/lab/race-ops?venue=東京&race_no=1')).json()).revision,2);
});
test('pause survives reload, expires at UTC midnight, and never blocks writes, identity health or unrelated sites',async()=>{
 const storage=new Map();let calls=0,stamp=Date.parse('2026-10-20T07:00:00Z');const fetcher=async()=>{calls++;return Response.json(quota);};let win=fixture(fetcher,storage);installReadRequestGuard(win,{apiOrigin,clock:()=>stamp});await win.fetch(apiOrigin+'/v1/lab/race-ops');assert.equal(calls,1);
 win=fixture(fetcher,storage);installReadRequestGuard(win,{apiOrigin,clock:()=>stamp});await win.fetch(apiOrigin+'/v1/lab/work-progress');assert.equal(calls,1);
 await win.fetch(apiOrigin+'/v1/lab/user-marks',{method:'POST',body:'{}'});await win.fetch(apiOrigin+'/v1/lab/deploy-check');await win.fetch('/v1/lab/user-mark-session');await win.fetch('https://other.test/v1/data');assert.equal(calls,5);
 stamp=Date.parse('2026-10-21T00:00:00Z');await win.fetch(apiOrigin+'/v1/lab/race-ops');assert.equal(calls,6);
});
test('403/429/503 and normal network failures do not become an invented daily quota pause or trigger retries',async()=>{
 for(const code of [403,429,503]){let calls=0;const win=fixture(async()=>{calls++;return Response.json({ok:false,error:'source unavailable'},{status:code});});const guard=installReadRequestGuard(win,{apiOrigin});await win.fetch(apiOrigin+'/v1/lab/race-ops');assert.equal(calls,1);assert.equal(guard.status().blockedUntil,null);}
 let calls=0;const win=fixture(async()=>{calls++;throw Error('network unavailable');});installReadRequestGuard(win,{apiOrigin});await assert.rejects(win.fetch(apiOrigin+'/v1/lab/race-ops'),/network/);assert.equal(calls,1);
});
test('authenticated reads and different target/header identities cannot share a response',async()=>{
 let calls=0;const win=fixture(async()=>{calls++;await setImmediate();return Response.json({ok:true});});installReadRequestGuard(win,{apiOrigin});
 await Promise.all([win.fetch(apiOrigin+'/v1/lab/user-marks',{headers:{authorization:'a'}}),win.fetch(apiOrigin+'/v1/lab/user-marks',{headers:{authorization:'a'}}),win.fetch(apiOrigin+'/v1/lab/race-ops?race_no=1'),win.fetch(apiOrigin+'/v1/lab/race-ops?race_no=2')]);assert.equal(calls,4);
});
test('aborting a queued read prevents it from being forwarded',async()=>{
 let release,calls=0;const wait=new Promise(r=>release=r),win=fixture(async()=>{calls++;await wait;return Response.json({ok:true});});installReadRequestGuard(win,{apiOrigin,concurrency:1});const first=win.fetch(apiOrigin+'/v1/lab/first');const ctrl=new AbortController();const second=win.fetch(apiOrigin+'/v1/lab/second',{signal:ctrl.signal});ctrl.abort();await assert.rejects(second,{name:'AbortError'});release();await first;await setImmediate();assert.equal(calls,1);
});
test('actual served HTML installs guard before scripts that start API reads',async()=>{
 const html=await(await app.fetch(new Request('https://app.test/'))).text();assert.ok(html.indexOf('function installReadRequestGuard(')>0);assert.ok(html.indexOf('function installReadRequestGuard(')<html.indexOf('async function get(path)'));assert.ok(html.includes(')(window,{apiOrigin:"https://keiba-lab-api.sekai-no-bancyou.workers.dev"})'));
});
