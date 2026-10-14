import test from 'node:test';
import assert from 'node:assert/strict';
import {lockedEvidenceLines} from '../src/locked-mark-evidence-view.js';
const key='2026-10-11:東京:11',rev={revisionId:'rev1',phase:'final',userLock:{immutable:true,revisionId:'rev1',snapshotSha256:'hash'}};
const roster=[{horseNo:1,horseName:'馬A',finishPosition:2,finishStatus:'finished'},{horseNo:2,horseName:'馬B',finishPosition:null,finishStatus:'scratched'}];
const record={raceKey:key,phase:'final',revisionId:'rev1',lockSha256:'hash',createdAt:'2026-10-12T00:00:00Z',guardrails:{savedScoresOnly:true,retrospectivePredictionCreated:false,automaticPromotion:false,validatedAccuracyClaimed:false},rows:[{...roster[0],referenceMark:'◎',referenceRank:1,userMark:'○',rankGap:1},{...roster[1],referenceMark:'○',referenceRank:2,userMark:null,rankGap:null}]};
test('locked reference gaps and terminal statuses are displayed from immutable evidence',()=>{
 const text=lockedEvidenceLines([record],rev,key,roster).join('\n');
 assert.match(text,/事前LOCK版と公式結果のDB照合履歴/);assert.match(text,/馬A.*自分 ○ → 2着 \/ 順位差 \+1/);assert.match(text,/馬B.*→ 取消/);
 assert.doesNotMatch(text,/馬B.*順位差/);
 const corrected=structuredClone(roster);corrected[0].finishPosition=1;
 assert.match(lockedEvidenceLines([record],rev,key,corrected).join('\n'),/現在の公式結果と異なります/);
});
test('different lock, missing runner, and fabricated rank gaps fail closed',()=>{
 for(const change of [x=>x.lockSha256='wrong',x=>x.rows.pop(),x=>x.rows[0].rankGap=0,x=>x.rows[1].rankGap=2]){
  const bad=structuredClone(record);change(bad);assert.throws(()=>lockedEvidenceLines([bad],rev,key,roster));
 }
 assert.match(lockedEvidenceLines([],rev,key,roster).join('\n'),/まだDBに蓄積/);
 assert.match(lockedEvidenceLines([record],{phase:'final'},key,roster).join('\n'),/事前LOCKされていません/);
});
