import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import app,{VERSION,selectedExpectedMarks,normalizeDraftMarks,phaseGateMessage,historyCoverageSummary} from '../src/index-v1.21.js';
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
