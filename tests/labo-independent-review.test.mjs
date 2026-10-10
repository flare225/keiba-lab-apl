import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import app,{VERSION} from '../src/index-v1.21.js';
import {assignIndependentLaboMarks,buildIndependentLaboReview,renderIndependentLaboReview} from '../src/labo-independent-review-v1.25.js';
const valid=(name,rank,history=4,tied=1)=>({horseName:name,referenceRank:rank,tiedCount:tied,assessment:{available:true,validFinishRows:history,evidenceScore:80-rank}});
const fixture={
 ok:true,race:{date:'2026-10-11'},assessment:{runnerPool:4,scoredRunners:4,trackAssumption:'良',modelVersion:'existing-safe-core',
 guardrails:{humanMarksUsedInScore:false,targetResultUsed:false},allRunners:[valid('馬A',1),valid('馬B',2),valid('馬C',3),valid('馬D',4)]}
};
test('LABO reference marks do not depend on user mark assignments',()=>{
 const human=[{horseName:'馬D',mark:'◎'},{horseName:'馬A',mark:'消'}];
 const first=buildIndependentLaboReview(fixture,human,{馬A:{verified:true,horseNo:1,frameNo:1}});
 const second=buildIndependentLaboReview(fixture,[{horseName:'馬D',mark:'消'},{horseName:'馬A',mark:'◎'}],{馬A:{verified:true,horseNo:1,frameNo:1}});
 assert.deepEqual(first.rows.map(x=>[x.name,x.laboMark,x.rank,x.score]),second.rows.map(x=>[x.name,x.laboMark,x.rank,x.score]));
 assert.deepEqual(first.rows.map(x=>x.laboMark),['◎','○','▲','△']);
 assert.equal(first.rows[0].humanMark,'消');
 assert.equal(first.rows[3].comparison,'評価が異なる');
 const html=renderIndependentLaboReview(first);
 assert.match(html,/LABO仮印/);
 assert.match(html,/自分の印/);
 assert.match(html,/1枠 1番 馬A/);
 assert.match(html,/参考順位/);
 assert.doesNotMatch(html,/的中率を保証します/);
});
test('incomplete coverage and ties do not fabricate decisive marks',()=>{
 const broken=structuredClone(fixture);
 broken.assessment.scoredRunners=3;
 assert.equal(buildIndependentLaboReview(broken).rows.every(x=>x.laboMark==='保留'),true);
 const tied=structuredClone(fixture);
 tied.assessment.allRunners[0].tiedCount=2;
 assert.equal(buildIndependentLaboReview(tied).rows.find(x=>x.rank===1).laboMark,'保留');
 const thin=structuredClone(fixture);
 thin.assessment.allRunners[1].assessment.validFinishRows=1;
 assert.equal(buildIndependentLaboReview(thin).rows.find(x=>x.rank===2).laboMark,'保留');
});
test('scoring contract must be independent and all-horse; errors are not represented as LABO picks',()=>{
 const untrusted=structuredClone(fixture);
 untrusted.assessment.guardrails.humanMarksUsedInScore=true;
 assert.throws(()=>buildIndependentLaboReview(untrusted),/安全条件/);
 const leaky=structuredClone(fixture);leaky.assessment.guardrails.targetResultUsed=true;
 assert.throws(()=>buildIndependentLaboReview(leaky),/安全条件/);
 const partial=structuredClone(fixture);partial.assessment.allRunners.pop();
 assert.throws(()=>buildIndependentLaboReview(partial),/出走馬全員/);
});
test('HTML exposes LABO-only recheck separately and compiles inline browser JavaScript',async()=>{
 const html=await(await app.fetch(new Request('https://example.org/'))).text();
 assert.match(html,/laboIndependentCard\.id='independentLaboReview'/);
 for(const id of ['independentLaboReviewRefresh','independentLaboReviewStatus','independentLaboReviewContent'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(html,/LABO自身の再精査・予想印/);
 assert.match(html,/labo-roster-ready/);
 assert.match(html,/humanMarksUsedInScore/);
 for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(m[1]);
 const health=await(await app.fetch(new Request('https://example.org/health'))).json();
 assert.equal(health.version,VERSION);
 assert.ok(health.features.includes('independent-labo-reference-marks'));
});
