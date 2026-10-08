import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBudgetBets} from '../src/index-v1.21.js';

const marks=[{horseName:'A',mark:'◎'},{horseName:'B',mark:'○'},{horseName:'C',mark:'▲'},{horseName:'D',mark:'△'}];
test('budget bets stay within the requested 100-yen budget and expose points',()=>{const d=buildBudgetBets({budget:3000,marks});assert.equal(d.ok,true);assert.equal(d.total<=3000,true);assert.equal(d.total%100,0);assert.ok(d.items.every(x=>x.tickets===x.combos.length));assert.equal(d.total+d.remaining,d.budget);});
test('safe and win modes select their intended categories',()=>{assert.ok(buildBudgetBets({budget:2000,marks,mode:'safe'}).items.every(x=>x.category==='保険'));assert.ok(buildBudgetBets({budget:2000,marks,mode:'win'}).items.every(x=>x.category==='勝負'));});
test('insufficient marks and non-100 budget fail clearly without spending',()=>{const d=buildBudgetBets({budget:99,marks:[{horseName:'A',mark:'◎'}]});assert.equal(d.ok,false);assert.equal(d.total,0);assert.match(d.message,/100円単位|印が足りません/);});
