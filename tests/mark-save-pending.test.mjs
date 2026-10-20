import test from 'node:test';
import assert from 'node:assert/strict';
import {mountMarkSaving} from '../src/mark-save-client-v1.24.js';
import {setImmediate} from 'node:timers/promises';
for(const upstreamStatus of [200,404])test('upstream '+upstreamStatus+': mark history stays authenticated while pending state uses the explicit public API origin',async()=>{
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',addEventListener(){}});return elements.get(id);};
 const calls=[],original=globalThis.fetch;
 globalThis.fetch=async url=>{calls.push(url);return calls.length===1?Response.json({ok:false,error:'race not found'},{status:upstreamStatus}):Response.json({ok:true,status:'awaiting-official-card'});};
 try{
 mountMarkSaving({document:{getElementById:el},window:{localStorage:{getItem:()=>null},addEventListener(){}},apiOrigin:'https://public-api.example',getCurrent:()=>({target:{date:'2026-10-24',venue:'京都',raceNo:11},state:{phase:'initial',marks:[],roster:[]}}),initialLocalMarkPayload:()=>{throw Error('印未入力');},summarizeDbRevision:()=>null});
 for(let i=0;i<5;i++)await setImmediate();
 assert.match(calls[0],/^\/v1\/lab\/user-marks\?/);assert.match(calls[1],/^https:\/\/public-api.example\/v1\/lab\/race-ops\?/);
 assert.match(el('userMarkDbState').textContent,/正式出馬表は未保存/);assert.doesNotMatch(el('userMarkDbState').textContent,/race not found|保存履歴0件[（。]/i);assert.equal(el('userMarkRefreshDb').disabled,false);
 }finally{globalThis.fetch=original;}
});
