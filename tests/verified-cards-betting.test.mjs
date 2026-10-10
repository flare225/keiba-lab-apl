import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBudgetBets, verifiedOfficialRoster, provisionalStoredRoster } from '../src/index-v1.21.js';

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

test('unchecking every wager type must never create default wagers',()=>{
 const unselected=buildBudgetBets({budget:5000,marks,types:[]});
 assert.equal(unselected.ok,false);
 assert.equal(unselected.total,0);
 assert.deepEqual(unselected.items,[]);
});

test('stored JRA names remain usable for INITIAL draft while unverified cards never unlock official wagering',()=>{
 const records=[{horse_name:'馬A',horse_no:1,frame_no:1},{horse_name:'馬B',horse_no:2,frame_no:1}];
 const provisional=provisionalStoredRoster(records);
 assert.deepEqual(provisional.runners.map(x=>[x.horseName,x.horseNo,x.frameNo]),[['馬A',1,1],['馬B',2,1]]);
 assert.equal(provisional.officialVerified,false);
 assert.equal(provisional.source.kind,'stored-jra-pending-audit');
 assert.equal(verifiedOfficialRoster(records,{ok:true,ops:{cardComplete:false}}),null);
});
test('incomplete stored DB card is visibly provisional; corrupt or duplicate identities are refused',()=>{
 const rows=[{horse_name:'馬A',horse_no:3,frame_no:null},{horse_name:'馬B',horse_no:7,frame_no:3}];
 const d=provisionalStoredRoster(rows);
 assert.ok(d);assert.equal(d.officialVerified,false);
 assert.equal(d.runners[0].frameNo,null);
 assert.equal(provisionalStoredRoster([]),null);
 assert.equal(provisionalStoredRoster([{horse_name:'',horse_no:1}]),null);
 assert.equal(provisionalStoredRoster([{horse_name:'馬A',horse_no:1},{horse_name:'馬A',horse_no:2}]),null);
 assert.equal(provisionalStoredRoster([{horse_name:'馬A',horse_no:1},{horse_name:'馬B',horse_no:1}]),null);
});
