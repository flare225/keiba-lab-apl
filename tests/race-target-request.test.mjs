import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import app from '../src/index-v1.4.js';
import {raceTargetRequest,sameRaceTarget} from '../src/race-target-request.js';
test('request follows selected Niigata race and rejects a previous target',()=>{
 let target={date:'2026-10-24',venue:'新潟',raceNo:11};const win={getLaboTarget:()=>target},doc={getElementById:()=>({value:'稍重'})};const request=raceTargetRequest(win,doc),params=new URLSearchParams(request.query.slice(1));assert.equal(params.get('venue'),'新潟');assert.equal(params.get('date'),'2026-10-24');assert.equal(params.get('track'),'稍重');assert.equal(sameRaceTarget(win,request),true);target={...target,raceNo:12};assert.equal(sameRaceTarget(win,request),false);
});
test('old successful readiness response cannot replace new target missing-card warning',async()=>{
 const html=await(await app.fetch(new Request('https://keiba-lab-apl.vercel.app/'))).text();const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function renderReady('));assert.ok(script);
 let target={date:'2026-10-17',venue:'東京',raceNo:11},initial,shown='',requests=[];const listeners={};const box={set textContent(v){shown=v},get textContent(){return shown},set innerHTML(v){shown=v},get innerHTML(){return shown}};
 const window={getLaboTarget:()=>target,addEventListener:(event,fn)=>listeners[event]=fn,refreshAll:async()=>{},loadRace:async()=>{}};const document={getElementById:id=>id==='raceReadiness'?box:id==='race'?{}:id==='track'?{value:''}:null};
 vm.runInNewContext(script,{window,document,URLSearchParams,esc:v=>String(v??''),setTimeout:fn=>{initial=fn},get:path=>new Promise((resolve,reject)=>requests.push({path,resolve,reject}))});
 const first=initial();assert.match(requests[0].path,/2026-10-17/);target={date:'2026-10-24',venue:'新潟',raceNo:11};const second=listeners['labo-target-change']();assert.match(shown,/新潟11R/);assert.match(shown,/確認待ち/);requests[1].reject(Error('race not found'));await second;const warning=shown;assert.match(warning,/未確認/);
 requests[0].resolve({race:{runnerCount:99},storage:{storedRunnerRows:99},readiness:{preRaceReady:true,stages:[{ready:true,label:'古い完全保存'}]}});await first;assert.equal(shown,warning);assert.ok(!shown.includes('古い完全保存'));
});
