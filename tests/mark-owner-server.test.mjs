import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerSession,verifyOwnerSession,handleOwnerSession,handleOwnerMarkSave,OWNER_DEVICE_DAYS} from '../src/mark-owner-server-v1.25.js';
const env={LABO_MARK_OWNER_PASSPHRASE:'long-owner-private-password-0123456789',LABO_MARK_SESSION_SECRET:'another-super-long-session-key-with-entropy-987654321',LABO_MARK_DB_WRITE_TOKEN:'a-worker-write-token-from-server-env-only'};
function req(method,body={},cookie='',origin='https://keiba-lab-apl.vercel.app'){
 return{method,body,headers:{host:'keiba-lab-apl.vercel.app',origin,cookie}};
}
function response(){const values={code:null,headers:{},body:null};const res={
 status(n){values.code=n;return res;},setHeader(n,v){values.headers[n.toLowerCase()]=v;return res;},
 json(x){values.body=x;return res;}};return{values,res};}
const pass=(cookie,stamp)=>req('POST',{date:'2026-10-11',venue:'東京',raceNo:11,phase:'final',track:'良',confirm:'SAVE',
 marks:[{horseNo:1,horseName:'馬A',mark:'◎'},{horseNo:2,horseName:'馬B',mark:'○'}]},cookie);
test('write disabled when owner secrets not configured; no unsafe anonymous fallback',async()=>{
 const {values,res}=response();
 await handleOwnerMarkSave(req('POST',{}),res,async()=>{throw Error('must not call upstream')},{},1000);
 assert.equal(values.code,503);
 assert.match(values.body.error,/未完了/);
 const session=response();
 await handleOwnerSession(req('GET'),session.res,{},1000);
 assert.equal(session.values.body.authenticated,false);
 assert.equal(session.values.body.configured,false);
});
test('owner session is signed, httpOnly, secure and CSRF origin-checked',async()=>{
 const bad=response();
 await handleOwnerSession(req('POST',{passphrase:env.LABO_MARK_OWNER_PASSPHRASE},'','https://evil.example'),bad.res,env,1000);
 assert.equal(bad.values.code,403);
 const denied=response();
 await handleOwnerSession(req('POST',{passphrase:'wrong-owner-passphrase'}),denied.res,env,1000);
 assert.equal(denied.values.code,401);
 const grant=response();
 await handleOwnerSession(req('POST',{passphrase:env.LABO_MARK_OWNER_PASSPHRASE}),grant.res,env,1000);
 assert.equal(grant.values.code,200);
 const cookie=grant.values.headers['set-cookie'].split(';')[0];
 assert.match(grant.values.headers['set-cookie'],/HttpOnly; Secure; SameSite=Strict/);
 assert.equal(verifyOwnerSession(req('POST',{},cookie),env.LABO_MARK_SESSION_SECRET,1001),true);
 assert.equal(verifyOwnerSession(req('POST',{},cookie),env.LABO_MARK_SESSION_SECRET,1000+24*3600000),true);
 assert.equal(verifyOwnerSession(req('POST',{},cookie),env.LABO_MARK_SESSION_SECRET,1000+OWNER_DEVICE_DAYS*24*3600000),false);
 const tampered=cookie.slice(0,-2)+'zz';
 assert.equal(verifyOwnerSession(req('POST',{},tampered),env.LABO_MARK_SESSION_SECRET,1001),false);
});
test('only owner save can call Worker with server secret, then checks DB revision from GET',async()=>{
 const stamp=5000,cookie='labo_owner_marks_v1='+createOwnerSession(env.LABO_MARK_SESSION_SECRET,stamp);
 const calls=[];
 const fake=async(url,options)=>{
  calls.push({url,options});
  if(options.method==='POST')return new Response(JSON.stringify({ok:true,stage:'user-mark-saved-and-crosschecked',revisionId:'2026-10-11:東京:11|final|1'}),
   {headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({ok:true,raceKey:'2026-10-11:東京:11',latest:[{phase:'final',revisionNo:1,revisionId:'2026-10-11:東京:11|final|1',trackCondition:'良',createdAt:'2026-10-10T01:02:03.000Z',entries:[
   {horse_no:1,horse_name:'馬A',mark:'◎'},{horse_no:2,horse_name:'馬B',mark:'○'}]}]}),{headers:{'content-type':'application/json'}});
 };
 const r=response();await handleOwnerMarkSave(pass(cookie),r.res,fake,env,stamp+5);
 assert.equal(r.values.code,200);
 assert.equal(r.values.body.stage,'db-written-readback-verified');
 assert.equal(r.values.body.entryCount,2);
 assert.equal(r.values.body.savedAt,'2026-10-10T01:02:03.000Z');
 assert.equal(r.values.body.preRaceLock,false);
 assert.equal(calls.length,2);
 assert.equal(calls[0].options.headers.authorization,'Bearer '+env.LABO_MARK_DB_WRITE_TOKEN);
 assert.equal(calls[1].options.headers?.authorization,undefined);
 assert.equal(JSON.stringify(r.values.body).includes(env.LABO_MARK_DB_WRITE_TOKEN),false);
});
test('save API requires login and refuses cross-site requests, invalid marks and fake readbacks',async()=>{
 const unauthed=response();
 await handleOwnerMarkSave(pass(''),unauthed.res,async()=>{throw Error('not called')},env,1000);
 assert.equal(unauthed.values.code,401);
 const cookie='labo_owner_marks_v1='+createOwnerSession(env.LABO_MARK_SESSION_SECRET,1000);
 const cross=response();
 await handleOwnerMarkSave(req('POST',{confirm:'SAVE'},cookie,'https://fake.example'),cross.res,async()=>{throw Error('not called')},env,1200);
 assert.equal(cross.values.code,403);
 const bad=response();
 const input=pass(cookie);input.body.marks[1].horseNo=1;
 await handleOwnerMarkSave(input,bad.res,async()=>{throw Error('not called')},env,1200);
 assert.equal(bad.values.code,400);
 const fake=response();
 await handleOwnerMarkSave(pass(cookie),fake.res,async(_url,opts)=>{
  if(opts.method==='POST')return new Response(JSON.stringify({ok:true,stage:'user-mark-saved-and-crosschecked',revisionId:'some-revision'}),{headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({ok:true,latest:[]}),{headers:{'content-type':'application/json'}});
 },env,1200);
 assert.equal(fake.values.code,502);
 assert.equal(fake.values.body.saveMayHaveSucceeded,true);
});

test('initial horse names round-trip even when later official card assigns numbers',async()=>{
 const stamp=8000,cookie='labo_owner_marks_v1='+createOwnerSession(env.LABO_MARK_SESSION_SECRET,stamp);
 const request=req('POST',{date:'2026-10-11',venue:'東京',raceNo:11,phase:'initial',confirm:'SAVE',marks:[
  {horseName:'馬A',mark:'◎'},{horseName:'馬B',mark:'○'}]},cookie);
 const fake=async(url,opts)=>new Response(JSON.stringify(opts.method==='POST'?
  {ok:true,stage:'user-mark-saved-and-crosschecked',revisionId:'rev-1'}:
  {ok:true,raceKey:'2026-10-11:東京:11',latest:[{phase:'initial',revisionId:'rev-1',revisionNo:1,
   entries:[{horse_no:1,horse_name:'馬A',mark:'◎'},{horse_no:2,horse_name:'馬B',mark:'○'}]}]}),
   {headers:{'content-type':'application/json'}});
 const result=response();await handleOwnerMarkSave(request,result.res,fake,env,stamp+1);
 assert.equal(result.values.code,200);
 assert.equal(result.values.body.entryCount,2);
});
test('readback does not certify another race or changed explicit track assumption',async()=>{
 const stamp=9000,cookie='labo_owner_marks_v1='+createOwnerSession(env.LABO_MARK_SESSION_SECRET,stamp);
 const fake=async(url,opts)=>new Response(JSON.stringify(opts.method==='POST'?
  {ok:true,stage:'user-mark-saved-and-crosschecked',revisionId:'rev-2'}:
  {ok:true,raceKey:'2026-10-10:東京:11',latest:[{phase:'final',revisionId:'rev-2',revisionNo:1,trackCondition:'重',
   entries:[{horse_no:1,horse_name:'馬A',mark:'◎'},{horse_no:2,horse_name:'馬B',mark:'○'}]}]}),
   {headers:{'content-type':'application/json'}});
 const result=response();await handleOwnerMarkSave(pass(cookie),result.res,fake,env,stamp+1);
 assert.equal(result.values.code,502);
 assert.equal(result.values.body.saveMayHaveSucceeded,true);
});


test('public readiness GET reports per-setting booleans without exposing secret values',async()=>{
 const boundaryEnv={
  LABO_MARK_OWNER_PASSPHRASE:'o'.repeat(24),
  LABO_MARK_SESSION_SECRET:'s'.repeat(32),
  LABO_MARK_DB_WRITE_TOKEN:'w'.repeat(24)
 };
 const ready=response();
 await handleOwnerSession(req('GET'),ready.res,boundaryEnv,1000);
 assert.deepEqual(ready.values.body.configuration,{
  ownerPassphraseReady:true,sessionSecretReady:true,writeTokenReady:true
 });
 assert.equal(ready.values.body.configured,true);
 for(const [key,flag,length] of [
  ['LABO_MARK_OWNER_PASSPHRASE','ownerPassphraseReady',23],
  ['LABO_MARK_SESSION_SECRET','sessionSecretReady',31],
  ['LABO_MARK_DB_WRITE_TOKEN','writeTokenReady',23]
 ]){
  const envUnderTest={...boundaryEnv,[key]:'x'.repeat(length)};
  const result=response();
  await handleOwnerSession(req('GET'),result.res,envUnderTest,1000);
  assert.equal(result.values.body.configured,false);
  assert.equal(result.values.body.configuration[flag],false);
  assert.equal(Object.values(result.values.body.configuration).filter(Boolean).length,2);
  assert.equal(JSON.stringify(result.values.body).includes(envUnderTest[key]),false);
 }
});

test('owner can check Worker token parity without writing or revealing secrets',async()=>{
 const stamp=12000,cookie='labo_owner_marks_v1='+createOwnerSession(env.LABO_MARK_SESSION_SECRET,stamp);
 const request=req('POST',{action:'check-worker-write-token'},cookie);
 const calls=[];
 const fake=async(url,options)=>{
  calls.push({url,options});
  return new Response(JSON.stringify({ok:true,tokenMatch:true,writeReady:true,mode:'no-write'}),{
   status:200,headers:{'content-type':'application/json'}
  });
 };
 const result=response();
 await handleOwnerSession(request,result.res,env,stamp+1,fake);
 assert.equal(result.values.code,200);
 assert.equal(result.values.body.workerWriteTokenMatch,true);
 assert.equal(result.values.body.mode,'no-write');
 assert.equal(calls.length,1);
 assert.equal(calls[0].options.method,'GET');
 assert.equal(calls[0].options.headers.authorization,'Bearer '+env.LABO_MARK_DB_WRITE_TOKEN);
 assert.equal(JSON.stringify(result.values.body).includes(env.LABO_MARK_DB_WRITE_TOKEN),false);
});
test('token parity check requires owner session and treats mismatch as a safe result',async()=>{
 const unauthorized=response();
 await handleOwnerSession(req('POST',{action:'check-worker-write-token'}),unauthorized.res,env,13000,async()=>{throw Error('must not call Worker')});
 assert.equal(unauthorized.values.code,401);
 const stamp=14000,cookie='labo_owner_marks_v1='+createOwnerSession(env.LABO_MARK_SESSION_SECRET,stamp);
 const result=response();
 await handleOwnerSession(req('POST',{action:'check-worker-write-token'},cookie),result.res,env,stamp+1,async()=>new Response(
  JSON.stringify({ok:false,tokenMatch:false,writeReady:true,mode:'no-write'}),
  {status:401,headers:{'content-type':'application/json'}}
 ));
 assert.equal(result.values.code,200);
 assert.equal(result.values.body.ok,true);
 assert.equal(result.values.body.workerWriteTokenMatch,false);
 assert.equal(JSON.stringify(result.values.body).includes(env.LABO_MARK_DB_WRITE_TOKEN),false);
});

test('registered browser renews its cookie without a password or a DB request',async()=>{
 const day=24*3600000,stamp=1000;
 const original='labo_owner_marks_v1='+createOwnerSession(env.LABO_MARK_SESSION_SECRET,stamp);
 const result=response();
 await handleOwnerSession(req('GET',{},original),result.res,env,stamp+10*day,async()=>{throw Error('must not access DB');});
 assert.equal(result.values.body.authenticated,true);
 assert.equal(result.values.body.deviceRememberDays,180);
 assert.match(result.values.headers['set-cookie'],/Max-Age=15552000; HttpOnly; Secure; SameSite=Strict/);
 const renewed=result.values.headers['set-cookie'].split(';')[0];
 assert.equal(verifyOwnerSession(req('POST',{},original),env.LABO_MARK_SESSION_SECRET,stamp+181*day),false);
 assert.equal(verifyOwnerSession(req('POST',{},renewed),env.LABO_MARK_SESSION_SECRET,stamp+181*day),true);
 assert.equal(verifyOwnerSession(req('POST',{},renewed),env.LABO_MARK_SESSION_SECRET,stamp+190*day),false);
 assert.equal(verifyOwnerSession(req('POST',{},renewed),'rotated-session-key-'.repeat(3),stamp+11*day),false);
});
test('anonymous and expired browsers are never registered by the status endpoint',async()=>{
 const stamp=1000,expired='labo_owner_marks_v1='+createOwnerSession(env.LABO_MARK_SESSION_SECRET,stamp);
 for(const cookie of ['',expired]){
  const result=response();
  await handleOwnerSession(req('GET',{},cookie),result.res,env,stamp+180*24*3600000);
  assert.equal(result.values.body.authenticated,false);
  assert.equal(result.values.headers['set-cookie'],undefined);
 }
 const result=response();
 await handleOwnerSession(req('DELETE',{},expired),result.res,env,stamp);
 assert.match(result.values.headers['set-cookie'],/Max-Age=0/);
});

test('owner LOCK keeps token server-side and confirms immutable hash on readback',async()=>{
 const stamp=1000,cookie='labo_owner_marks_v1='+createOwnerSession(env.LABO_MARK_SESSION_SECRET,stamp),calls=[],hash='a'.repeat(64),out=response();
 await handleOwnerSession(req('POST',{action:'lock-user-marks',date:'2026-10-18',venue:'東京',raceNo:11,phase:'final',revisionId:'r1',confirm:'LOCK'},cookie),out.res,env,stamp,async(url,options={})=>{
  calls.push({url,options});return new Response(JSON.stringify(options.method==='POST'?{ok:true,stage:'user-mark-lock-verified',raceKey:'2026-10-18:東京:11',phase:'final',snapshotSha256:hash}:{ok:true,lock:{revisionId:'r1',snapshotSha256:hash,immutable:true,lockedAt:'2026-10-13T00:00:00Z'}}),{headers:{'content-type':'application/json'}});
 });
 assert.equal(out.values.code,200);assert.equal(out.values.body.stage,'user-mark-lock-readback-verified');assert.equal(calls.length,2);
 assert.equal(calls[0].options.headers.authorization,'Bearer '+env.LABO_MARK_DB_WRITE_TOKEN);
 assert.ok(!JSON.stringify(out.values.body).includes(env.LABO_MARK_DB_WRITE_TOKEN));
});
test('owner LOCK without a registered cookie never calls Worker',async()=>{
 const out=response();await handleOwnerSession(req('POST',{action:'lock-user-marks'}),out.res,env,1000,async()=>{throw Error('must not fetch')});
 assert.equal(out.values.code,401);
});
test('upstream readback pending keeps the revision ID and stops without another request',async()=>{
 const stamp=5000,cookie='labo_owner_marks_v1='+createOwnerSession(env.LABO_MARK_SESSION_SECRET,stamp),r=response();let calls=0;
 await handleOwnerMarkSave(pass(cookie),r.res,async()=>{calls++;return Response.json({ok:false,stage:'user-mark-save-readback-pending',revisionId:'2026-10-11:東京:11|final|2',retryWrite:false},{status:503});},env,stamp+5);
 assert.equal(calls,1);assert.equal(r.values.code,503);assert.equal(r.values.body.stage,'db-written-readback-pending');
 assert.equal(r.values.body.revisionId,'2026-10-11:東京:11|final|2');assert.equal(r.values.body.retryWrite,false);assert.equal(r.values.body.saveMayHaveSucceeded,true);
});
test('non-JSON upstream blocks preserve 403/429/503 without retry or credential disclosure',async()=>{
 const stamp=5000,cookie='labo_owner_marks_v1='+createOwnerSession(env.LABO_MARK_SESSION_SECRET,stamp);
 for(const status of [403,429,503]){
  const r=response();let calls=0;
  await handleOwnerMarkSave(pass(cookie),r.res,async()=>{calls++;return new Response('private',{status});},env,stamp+5);
  assert.equal(calls,1);assert.equal(r.values.code,status);assert.equal(r.values.body.retryWrite,false);assert(!JSON.stringify(r.values.body).includes('private'));
 }
});
