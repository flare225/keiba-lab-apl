import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBudgetBets, verifiedOfficialRoster } from '../src/index-v1.21.js';

const marks=[
 {horseName:'A',horseNo:1,frameNo:1,mark:'◎'},
 {horseName:'B',horseNo:2,frameNo:2,mark:'○'},
 {horseName:'C',horseNo:3,frameNo:3,mark:'▲'},
 {horseName:'D',horseNo:4,frameNo:4,mark:'△'},
];
const allTypes=['単勝','複勝','枠連','馬連','馬単','ワイド','三連複','三連単'];

test('each wager total equals the real combination count × stake, never overruns budget',()=>{
 for(const budget of [0,99,100,500,1000,3000,10000]){
  const result=buildBudgetBets({budget,marks,types:allTypes});
  assert.ok(result.total<=result.budget,'overspend at '+budget);
  assert.equal(result.total+result.remaining,result.budget);
  for(const x of result.items){
   assert.equal(x.tickets,x.combos.length);
   assert.equal(x.amount,x.tickets*x.unitStake);
   assert.ok(x.unitStake>=100&&x.unitStake%100===0);
  }
 }
});

test('all eight JRA wager types are selectable and official frames are required for frame bets',()=>{
 const result=buildBudgetBets({budget:100000,marks,types:allTypes});
 for(const kind of ['単勝','複勝','枠連','馬連','馬単','ワイド','三連複','三連単'])assert.ok(result.items.some(x=>x.type.includes(kind)),'missing '+kind);
 const unverified=buildBudgetBets({budget:100000,marks:marks.map(({frameNo,...rest})=>rest),types:['枠連']});
 assert.equal(unverified.ok,false);
 assert.ok(!unverified.items.length);
});

test('ordered 2-horse tickets never pair the same horse, and insured multi has six unique orders',()=>{
 const result=buildBudgetBets({budget:100000,marks,types:['馬単','三連単']});
 const exacta=result.items.find(x=>x.type.includes('馬単'));
 assert.ok(exacta.combos.length>0);
 assert.ok(exacta.combos.every(combo=>combo.length===2&&combo[0]!==combo[1]));
 const multi=result.items.find(x=>x.type.includes('保険マルチ'));
 assert.equal(multi?.tickets,6);
 assert.equal(new Set(multi.combos.map(x=>x.join(':'))).size,6);
});

test('only complete officially verified JRA numbered cards can be shown as verified',()=>{
 const rows=[
  {horse_name:'A',horse_no:1,frame_no:1},
  {horse_name:'B',horse_no:2,frame_no:1},
  {horse_name:'C',horse_no:3,frame_no:2},
 ];
 const good={ok:true,ops:{cardComplete:true}};
 assert.deepEqual(verifiedOfficialRoster(rows,good)?.runners.map(x=>x.horseNo),[1,2,3]);
 assert.equal(verifiedOfficialRoster(rows,{ok:true,ops:{cardComplete:false}}),null);
 assert.equal(verifiedOfficialRoster(rows.slice(1),good),null);
 assert.equal(verifiedOfficialRoster(rows.map(x=>({...x,frame_no:null})),good),null);
 assert.equal(verifiedOfficialRoster(rows.map(x=>({...x,horse_name:'A'})),good),null);
});
