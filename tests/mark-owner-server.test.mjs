import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerSession,verifyOwnerSession,handleOwnerSession,handleOwnerMarkSave} from '../src/mark-owner-server-v1.25.js';
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
 assert.equal(verifyOwnerSession(req('POST',{},cookie),env.LABO_MARK_SESSION_SECRET,1000+8*3600000),false);
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
  return new Response(JSON.stringify({ok:true,raceKey:'2026-10-11:東京:11',latest:[{phase:'final',revisionNo:1,revisionId:'2026-10-11:東京:11|final|1',entries:[
   {horse_no:1,horse_name:'馬A',mark:'◎'},{horse_no:2,horse_name:'馬B',mark:'○'}]}]}),{headers:{'content-type':'application/json'}});
 };
 const r=response();await handleOwnerMarkSave(pass(cookie),r.res,fake,env,stamp+5);
 assert.equal(r.values.code,200);
 assert.equal(r.values.body.stage,'db-written-readback-verified');
 assert.equal(r.values.body.entryCount,2);
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
