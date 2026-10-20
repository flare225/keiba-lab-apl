import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import app from '../src/index-v1.12.js';
import {resolveRaceTargetListing,LAST_VERIFIED_WEEK_TARGETS} from '../src/race-target-listing.js';
const scope={from:'2026-10-20',to:'2026-10-26',now:Date.parse('2026-10-20T06:00:00Z')};
test('quota/list failure retains all 72 previously verified program slots without claiming cards or locks',()=>{
 const r=resolveRaceTargetListing({...scope,readFailed:true,fallback:LAST_VERIFIED_WEEK_TARGETS});assert.equal(r.races.length,72);assert.equal(r.races.filter(x=>x.venue==='新潟').length,24);assert.equal(r.basis,'previously-verified-program');assert.ok(r.races.every(x=>!x.cardComplete&&x.listingUnverified));assert.match(r.message,/未照合/);assert.equal(r.cacheValue,null);
});
test('last successful list survives a later failure, while successful empty lists and newer data remain authoritative',()=>{
 const live=[{date:'2026-10-24',venue:'新潟',raceNo:11,raceName:'魚沼S',cardComplete:true}];const a=resolveRaceTargetListing({...scope,liveRaces:live});const b=resolveRaceTargetListing({...scope,readFailed:true,previousJson:a.cacheValue,fallback:LAST_VERIFIED_WEEK_TARGETS});assert.equal(b.races[0].raceName,'魚沼S');assert.equal(b.races[0].cardComplete,false);assert.equal(b.basis,'last-successful-list');
 const empty=resolveRaceTargetListing({...scope,liveRaces:[],previousJson:a.cacheValue});assert.equal(empty.races.length,0);assert.equal(JSON.parse(empty.cacheValue).races.length,0);
 const next=resolveRaceTargetListing({...scope,liveRaces:[{...live[0],raceName:'最新名'}],previousJson:a.cacheValue});assert.equal(next.races[0].raceName,'最新名');assert.equal(next.races[0].cardComplete,true);
});
test('malformed, expired, future and out-of-range local records cannot invent race targets',()=>{
 for(const value of ['broken',JSON.stringify({schema:'race-target-list-v1',savedAt:'2026-10-01',races:LAST_VERIFIED_WEEK_TARGETS}),JSON.stringify({schema:'race-target-list-v1',savedAt:'2099-01-01',races:LAST_VERIFIED_WEEK_TARGETS})])assert.equal(resolveRaceTargetListing({...scope,readFailed:true,previousJson:value}).races.length,0);
 const input=[{date:'2026-02-30',venue:'東京',raceNo:1},{date:'2026-10-24',venue:'fake',raceNo:1},{date:'2026-10-24',venue:'東京',raceNo:13},{date:'2026-10-24',venue:'東京',raceNo:1},{date:'2026-10-24',venue:'東京',raceNo:1}];assert.equal(resolveRaceTargetListing({...scope,liveRaces:input}).races.length,1);assert.equal(resolveRaceTargetListing({...scope,from:'2026-10-26',to:'2026-11-01',readFailed:true,fallback:LAST_VERIFIED_WEEK_TARGETS}).races.length,0);
});
for(const httpStatus of [200,503])test('served selector handles HTTP '+httpStatus+' / ok:false without losing current week',async()=>{
 const html=await(await app.fetch(new Request('https://app.test/'))).text(),script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(s=>s.includes('async function initTargets()'));
 const getter=html.match(/async function get\(path\)\{[^\n]+\}/)?.[0];assert.ok(getter);
 let selector={value:'',innerHTML:'',parentElement:{parentElement:{append(){}}}},notice={textContent:''},ops={textContent:''};const store=new Map();
 const document={getElementById:id=>({raceTarget:selector,raceListingNotice:notice,opsState:ops}[id]||null),querySelector:()=>null};
 const window={location:{hostname:'app.test'},addEventListener(){},dispatchEvent(){}};
 const NativeDate=Date;class FixedDate extends NativeDate{static now(){return scope.now;}}
 const pending=[];vm.runInNewContext(getter+'\n'+script,{window,document,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},Date:FixedDate,URLSearchParams,Event:class{},API:'https://api.test',esc:x=>String(x),fetch:async path=>{pending.push(path);return Response.json({ok:false,error:"D1_ERROR: Your account has exceeded D1's free tier daily row read limit."},{status:httpStatus});}});
 for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));assert.equal((selector.innerHTML.match(/<option /g)||[]).length,75);assert.match(selector.innerHTML,/2026-10-24 新潟1R/);assert.match(selector.innerHTML,/2026-10-25 京都12R/);assert.match(notice.textContent,/前回確認済み/);assert.ok(!selector.innerHTML.includes(' ✓'));
});
