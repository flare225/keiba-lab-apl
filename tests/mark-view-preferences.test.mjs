import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {findRememberedRaceIndex,serializeRacePreference,markPhaseStorageKey,readRememberedMarkPhase,orderRaceTargetsForToday,initialRaceTargetIndex} from '../src/mark-view-preferences.js';

const races=[
 {date:'2026-10-11',venue:'東京',raceNo:11},
 {date:'2026-10-11',venue:'京都',raceNo:11}
];

test('restores the previously selected race by stable race identity',()=>{
 const raw=serializeRacePreference(races[1]);
 assert.equal(findRememberedRaceIndex(races,raw),1);
 assert.equal(findRememberedRaceIndex(races,'{bad json'),-1);
 assert.equal(findRememberedRaceIndex(races,null),-1);
});

test('stores only valid race identities',()=>{
 assert.equal(serializeRacePreference(races[0]),'{"date":"2026-10-11","venue":"東京","raceNo":11}');
 assert.equal(serializeRacePreference({date:'bad',venue:'東京',raceNo:11}),null);
 assert.equal(serializeRacePreference({date:'2026-10-11',venue:'東京',raceNo:13}),null);
});

test('keeps mark phases isolated per race and restores a known phase only',()=>{
 assert.equal(markPhaseStorageKey(races[0]),'keiba-labo:mark-phase:v1:2026-10-11|東京|11');
 assert.notEqual(markPhaseStorageKey(races[0]),markPhaseStorageKey(races[1]));
 assert.equal(readRememberedMarkPhase('final'),'final');
 assert.equal(readRememberedMarkPhase('bad-phase'),'initial');
});

test('inlines mark phase storage dependencies into browser code',async()=>{
 const source=await readFile(new URL('../src/index-v1.21.js',import.meta.url),'utf8');
 assert.ok(source.includes('const MARK_PHASE_STORAGE_PREFIX=${JSON.stringify(MARK_PHASE_STORAGE_PREFIX)};'));
 assert.ok(source.includes('const markPhaseStorageKey=${markPhaseStorageKey.toString()};'));
});

test('today precedes future assumptions and stale future selection does not hide today',()=>{
 const stamp=Date.parse('2026-10-18T05:00:00Z'),today={date:'2026-10-18',venue:'京都',raceNo:11,cardComplete:true},future={...today,date:'2026-10-25'},other={...today,venue:'東京',raceNo:12};
 const rows=orderRaceTargetsForToday([future,other,today],stamp);assert.equal(rows[0].date,today.date);assert.equal(rows.at(-1).date,future.date);
 assert.deepEqual(rows[initialRaceTargetIndex(rows,serializeRacePreference(future),stamp)],today);
 assert.deepEqual(rows[initialRaceTargetIndex(rows,serializeRacePreference(other),stamp)],other);
 assert.equal(initialRaceTargetIndex([future],serializeRacePreference(future),stamp),0);
});

test('weekday defaults to next meeting instead of stale past presets',()=>{
 const stamp=Date.parse('2026-10-20T00:00:00Z'),old={date:'2026-10-12',venue:'京都',raceNo:11},next={date:'2026-10-24',venue:'東京',raceNo:11};
 const rows=orderRaceTargetsForToday([old,{...next,raceNo:1},next],stamp);assert.equal(rows[0].date,'2026-10-24');assert.deepEqual(rows[initialRaceTargetIndex(rows,serializeRacePreference(old),stamp)],next);assert.equal(initialRaceTargetIndex([old],serializeRacePreference(old),stamp),0);
});
