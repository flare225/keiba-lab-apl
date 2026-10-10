import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import app,{VERSION} from '../src/index-v1.21.js';
import {generateFormationTickets,validateTicketStake,calculateTicketSlip,ticketMethodOptions} from '../src/ticket-formation-v1.22.js';
const roster=Array.from({length:6},(_,i)=>({horseNo:i+1,frameNo:i<2?1:i,horseName:'horse'+(i+1)}));
const go=(type,method,groups,multi=false,axisPosition=1)=>generateFormationTickets({type,method,groups,multi,axisPosition,roster});

test('correct BOX ticket counts across all supported wager types',()=>{
 for(const [type,n,expected] of [
 ['単勝',4,4],['複勝',4,4],['枠連',4,4],['馬連',4,6],
 ['馬単',4,12],['ワイド',4,6],['三連複',4,4],['三連単',4,24]
 ]){const r=go(type,'box',[[1,2,3,4]]);
  assert.equal(r.ok,true,type);assert.equal(r.count,expected,type);
  assert.equal(new Set(r.combos.map(x=>x.join('-'))).size,r.count);
 }
});

test('triple ordered formation with overlapping places dedupes identical horses',()=>{
 const r=go('三連単','formation',[[1],[2,3],[2,3,4,5]]);
 assert.equal(r.count,6);
 assert.ok(r.combos.every(x=>new Set(x).size===3));
 assert.deepEqual(go('三連複','formation',[[1,2],[2,3],[3,4]]).combos,[[1,2,3],[1,2,4],[1,3,4],[2,3,4]]);
});

test('axis-one ordered nagashi, axis multies and axis-two multi have official counts',()=>{
 const others=[2,3,4,5];
 assert.equal(go('三連単','nagashi',[[1],others]).count,12);
 assert.equal(go('三連単','nagashi',[[1],others],true).count,36);
 assert.equal(go('三連単','nagashi2',[[1,2],[3,4,5,6]],true).count,24);
 assert.equal(go('三連複','nagashi',[[1],others]).count,6);
 assert.equal(go('三連複','nagashi2',[[1,2],others]).count,4);
 assert.equal(go('馬単','nagashi',[[1],others],true).count,8);
 assert.equal(go('馬単','nagashi',[[1],others],false,2).count,4);
 const third=go('三連単','nagashi',[[1],[2,3]],false,3);
 assert.deepEqual(third.combos,[[2,3,1],[3,2,1]]);
});

test('same-frame 枠連 exists for two distinct horses and is deduplicated',()=>{
 assert.deepEqual(go('枠連','box',[[1,2,3]]).combos,[[1,1],[1,2]]);
 const invalid=generateFormationTickets({type:'枠連',method:'box',groups:[[1,2]],roster:[{horseNo:1,frameNo:null},{horseNo:2,frameNo:2}]});
 assert.equal(invalid.ok,false);
});

test('invalid groups cannot create duplicate horse in the same ticket',()=>{
 assert.equal(go('三連単','formation',[[1],[1],[1]]).ok,false);
 assert.equal(go('三連単','nagashi',[[1,2],[3,4]]).ok,false);
 assert.equal(go('馬連','nagashi2',[[1,2],[3]]).ok,false);
 assert.equal(go('三連単','nagashi2',[[1],[2,3]]).ok,false);
 assert.ok(!ticketMethodOptions('単勝').some(x=>x.value==='formation'));
});

test('100-yen units, accurate totals, duplicate detection and budget excess',()=>{
 assert.equal(validateTicketStake(99),null);assert.equal(validateTicketStake(150),null);
 assert.equal(validateTicketStake(100),100);assert.equal(validateTicketStake(500),500);
 const items=[{type:'三連単',unitStake:200,combos:[[1,2,3],[1,3,2]]},{type:'馬連',unitStake:100,combos:[[1,2]]}];
 const good=calculateTicketSlip(items,1000);
 assert.deepEqual({ok:good.ok,total:good.total,count:good.count,remaining:good.remaining},{ok:true,total:500,count:3,remaining:500});
 const over=calculateTicketSlip(items,400);assert.equal(over.ok,false);assert.equal(over.total,500);
 const duplicate=calculateTicketSlip([...items,{type:'馬連',unitStake:100,combos:[[1,2]]}],1000);
 assert.equal(duplicate.ok,false);assert.equal(duplicate.duplicates.length,1);
});

test('browser delivers mobile interactive ticket builder and all embedded scripts parse',async()=>{
 const html=await(await app.fetch(new Request('https://example.com/'))).text();
 for(const id of ['ticketType','ticketMethod','ticketGroups','ticketFromMarks','ticketBudget','ticketAdd','ticketSlipItems','ticketCopy','ticketCategory','ticketAxisPosition','ticketMulti']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.ok(html.includes('mountTicketBuilder('));
 assert.ok(html.includes('三連単'));
 assert.ok(html.includes('サウジアラビアRC'));
 assert.ok(html.includes('アイルランドT'));
 for(const [,script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(script);
 assert.equal((await(await app.fetch(new Request('https://example.com/health'))).json()).version,VERSION);
});
