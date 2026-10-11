import test from 'node:test';
import assert from 'node:assert/strict';
import {findRememberedRaceIndex,serializeRacePreference,markPhaseStorageKey,readRememberedMarkPhase} from '../src/mark-view-preferences.js';

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
