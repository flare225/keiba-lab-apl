import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import app,{selectedExpectedMarks} from '../src/index-v1.21.js';
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
 assert.equal((await (await app.fetch(new Request('https://keiba-lab-apl.vercel.app/health'))).json()).version,'1.21.1');
});
