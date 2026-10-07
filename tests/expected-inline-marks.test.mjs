import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import app,{VERSION,homeRaceSummary,selectedExpectedMarks,normalizeDraftMarks,phaseGateMessage,historyCoverageSummary} from '../src/index-v1.21.js';
test('inline marks use only current roster names, exclude stale horses and do not invent numbers',()=>{
 const roster=['ヴォンフレ','カムニャック','ラヴァンダ'];
 assert.deepEqual(selectedExpectedMarks(roster,{'ヴォンフレ':'注','カムニャック':'','ラヴァンダ':'○','別馬':'◎'}),[{horseName:'ヴォンフレ',mark:'注'},{horseName:'ラヴァンダ',mark:'○'}]);
 assert.deepEqual(selectedExpectedMarks(roster,{'ヴォンフレ':'不正'}),[]);
 assert.deepEqual(selectedExpectedMarks(roster,{}),[]);
});
test('all delivered scripts compile and inline roster reads the dated DB source',async()=>{
 const h=await (await app.fetch(new Request('https://keiba-lab-apl.vercel.app/'))).text();
 for(const [,code] of h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(code);
 assert.ok(h.includes(selectedExpectedMarks.toString()));
 assert.ok(h.includes('expectedInlineRoster'));
 assert.equal((await (await app.fetch(new Request('https://keiba-lab-apl.vercel.app/health'))).json()).version,VERSION);
});

test('phase drafts preserve exact identities without guessing numbers and reject malformed storage',()=>{
 assert.deepEqual(normalizeDraftMarks([{horse:' ヴォンフレ ',mark:'注'},{horse:'ラヴァンダ',mark:'○'},{horse:'12',mark:'▲'},{horse:'別馬',mark:'不正'},null]),[{horse:'ヴォンフレ',mark:'注'},{horse:'ラヴァンダ',mark:'○'},{horse:'12',mark:'▲'}]);
 assert.deepEqual(normalizeDraftMarks({horse:'別馬',mark:'◎'}),[]);
});
test('formal-card gate distinguishes editable drafts from audit and LOCK readiness',()=>{
 assert.match(phaseGateMessage('initial').text,/仮比較/);
 assert.match(phaseGateMessage('post_draw',{ok:true,ops:{cardComplete:false}}).text,/正式保存・事前LOCKはできません/);
 assert.match(phaseGateMessage('final',{ok:true,ops:{cardComplete:true,prelockAllowed:true,predictionReady:true,alertStatus:'OK'}}).text,/DBで再精査/);
});
test('history coverage leaves missing runners explicit',()=>{
 const s=historyCoverageSummary({runnerCount:3,withStoredHistory:1,pendingHorses:2,runners:[{horseName:'A',storedRows:8},{horseName:'B',storedRows:0},{horseName:'C',storedRows:0}]});
 assert.deepEqual(s,{total:3,stored:1,pending:2,pendingNames:['B','C']});
 assert.deepEqual(historyCoverageSummary({runnerCount:2,withStoredHistory:2,runners:[{horseName:'A',storedRows:8},{horseName:'B',storedRows:7}]}).pendingNames,[]);
});

test('returning home restores the home panel and resets a long-page scroll',async()=>{
 const html=await(await app.fetch(new Request('https://example.com'))).text();
 const nodes=['home','race','marks','history','ops','system'].map(id=>({id,active:id==='marks',classList:{toggle(name,on){nodes.find(x=>x.classList===this).active=on;}}}));
 const tabs=nodes.filter(x=>x.id!=='system').map(x=>({dataset:{id:x.id},classList:{toggle(){}}}));
 let scroll=null,expanded=null;
 const code=html.match(/function openView\(id\)\{[^\n]+\}/)[0];
 const context={document:{querySelectorAll:s=>s==='section'?nodes:tabs,getElementById:()=>({querySelector:()=>null})},window:{scrollTo:v=>{scroll=v;}},openSystem:{setAttribute:(k,v)=>{expanded=v;}}};
 new Script(code+';openView("home");').runInNewContext(context);
 assert.deepEqual(nodes.filter(x=>x.active).map(x=>x.id),['home']);
 assert.equal(scroll.top,0);assert.equal(expanded,'false');assert.match(html,/id="goHome"/);
});

test('home next action preserves card gates and distinguishes unavailable state from ready',()=>{
 assert.match(homeRaceSummary(null).missing.join(),/確認できません/);
 const waiting=homeRaceSummary({ok:true,ops:{cardComplete:false,nextAction:'WAIT_OFFICIAL_CARD'}});
 assert.match(waiting.missing.join(),/正式出馬表/);assert.equal(waiting.view,'marks');
 const ready=homeRaceSummary({ok:true,ops:{cardComplete:true,prelockAllowed:true,predictionReady:true,userMarkReady:true,decisionReady:true,alertStatus:'OK',nextAction:'READY_PRE_RACE'}});
 assert.deepEqual(ready.missing,[]);assert.match(ready.next,/当日/);
 const blocked=homeRaceSummary({ok:true,ops:{cardComplete:true,prelockAllowed:true,predictionReady:true,userMarkReady:true,decisionReady:true,alertStatus:'BLOCK',nextAction:'RESOLVE_BLOCKER'}});
 assert.match(blocked.missing.join(),/要確認/);
});
