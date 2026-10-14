import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import app,{VERSION} from '../src/index-v1.21.js';
import {assignIndependentLaboMarks,buildIndependentLaboReview,renderIndependentLaboReview,formatIndependentLaboCopy,mountIndependentLaboReview} from '../src/labo-independent-review-v1.25.js';
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
 assert.ok(html.includes('const DISPLAY_MARKS=["◎","○","▲","△","△","☆"];'));
 for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(m[1]);
 const health=await(await app.fetch(new Request('https://example.org/health'))).json();
 assert.equal(health.version,VERSION);
 assert.ok(health.features.includes('independent-labo-reference-marks'));
});

test('independent rows must match the official roster and expose overlooked top-ranked runners',()=>{
 const good=buildIndependentLaboReview(fixture,[{horseName:'馬D',mark:'◎'}],{},['馬A','馬B','馬C','馬D']);
 assert.equal(good.rows.find(x=>x.name==='馬A').comparison,'LABO上位・自分は無印');
 assert.throws(()=>buildIndependentLaboReview(fixture,[],{},['馬A','馬B','別馬','馬D']),/JRA正式出馬表/);
 const thin=structuredClone(fixture);
 thin.assessment.allRunners[1].assessment.validFinishRows=1;
 const parsed=buildIndependentLaboReview(thin);
 assert.match(renderIndependentLaboReview(parsed),/有効着順3走未満/);
});

test('late responses for a previous track condition must never overwrite new LABO evidence',async()=>{
 const nodes=new Map(['independentLaboReview','independentLaboReviewStatus','independentLaboReviewContent','independentLaboReviewRefresh','markTrack']
  .map(id=>[id,{id,textContent:'',innerHTML:'',disabled:false,events:{},
   addEventListener(type,fn){this.events[type]=fn;},
   click(){this.events.click?.();}}]));
 const events=new Map();
 const window={addEventListener(name,fn){events.set(name,fn);}};
 const current={target:{date:'2026-10-11',venue:'東京',raceNo:11},state:{
  track:'良',rosterVerified:true,roster:['馬A','馬B','馬C','馬D'],
  rosterNumbers:{},marks:[{horseName:'馬A',mark:'◎'}]}};
 const pending=[],fetcher=async(url,opts)=>new Promise(resolve=>pending.push({
  url,body:JSON.parse(opts.body),reply:data=>resolve({ok:true,json:async()=>data})
 }));
 mountIndependentLaboReview({document:{getElementById:id=>nodes.get(id)},window,api:'https://example.test',
  getCurrent:()=>current,fetcher});
 assert.equal(pending.length,1);
 assert.equal(pending[0].body.track,'良');
 current.state.track='重';
 nodes.get('markTrack').events.change();
 assert.match(nodes.get('independentLaboReviewStatus').textContent,/古いLABO評価を破棄/);
 assert.equal(nodes.get('independentLaboReviewRefresh').disabled,false);
 pending[0].reply(structuredClone(fixture));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(nodes.get('independentLaboReviewContent').innerHTML,'');
 assert.match(nodes.get('independentLaboReviewStatus').textContent,/古いLABO評価を破棄/);

 nodes.get('independentLaboReviewRefresh').click();
 assert.equal(pending.length,2);
 assert.equal(pending[1].body.track,'重');
 const changed=structuredClone(fixture);changed.assessment.trackAssumption='重';
 pending[1].reply(changed);
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(nodes.get('independentLaboReviewContent').innerHTML,/想定馬場：重/);
 assert.equal(nodes.get('independentLaboReviewRefresh').disabled,false);
});
test('switching races while a LABO review is in flight releases the refresh control',async()=>{
 const ids=['independentLaboReview','independentLaboReviewStatus','independentLaboReviewContent','independentLaboReviewRefresh','markTrack'];
 const nodes=new Map(ids.map(id=>[id,{textContent:'',innerHTML:'',disabled:false,
  addEventListener(){}}]));
 const handlers={};
 const window={addEventListener(n,fn){handlers[n]=fn;}};
 const current={target:{date:'2026-10-11',venue:'東京',raceNo:11},state:{
  rosterVerified:true,roster:['馬A','馬B','馬C','馬D'],rosterNumbers:{},marks:[],track:'良'}};
 let resolveResponse;
 mountIndependentLaboReview({document:{getElementById:id=>nodes.get(id)},window,
  api:'https://example.test',getCurrent:()=>current,
  fetcher:()=>new Promise(resolve=>{resolveResponse=resolve;})});
 assert.equal(nodes.get('independentLaboReviewRefresh').disabled,true);
 current.target={date:'2026-10-11',venue:'京都',raceNo:11};
 handlers['labo-target-change']();
 assert.equal(nodes.get('independentLaboReviewRefresh').disabled,false);
 resolveResponse({ok:true,json:async()=>structuredClone(fixture)});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(nodes.get('independentLaboReviewContent').innerHTML,'');
});

test('display symbols match saved reference policy, including same-symbol ties and ranks beyond six',()=>{
 const rows=[valid('馬A',4,4,2),valid('馬B',4,4,2),valid('馬C',7),valid('馬D',8)];
 const result=assignIndependentLaboMarks(rows,4,4);
 assert.equal(result.marks.get('馬A'),'△');assert.equal(result.marks.get('馬B'),'△');
 assert.equal(result.marks.get('馬C'),'—');assert.equal(result.marks.get('馬D'),'—');
});
test('independent comparison appears beside each user input and clears on race change',async()=>{
 const ids=['independentLaboReview','independentLaboReviewStatus','independentLaboReviewContent','independentLaboReviewRefresh','markTrack'];
 const nodes=new Map(ids.map(id=>[id,{textContent:'',innerHTML:'',disabled:false,addEventListener(){}}]));
 const badges=['馬A','馬B','馬C','馬D'].map(name=>({dataset:{laboHorse:name},textContent:''}));
 const handlers={},window={addEventListener(n,fn){handlers[n]=fn;}};
 const current={target:{date:'2026-10-11',venue:'東京',raceNo:11},state:{rosterVerified:true,roster:['馬A','馬B','馬C','馬D'],rosterNumbers:{},marks:[{horseName:'馬D',mark:'◎'}],track:'良'}};
 mountIndependentLaboReview({document:{getElementById:id=>nodes.get(id),querySelectorAll:()=>badges},window,api:'https://test',getCurrent:()=>current,fetcher:async()=>({ok:true,json:async()=>structuredClone(fixture)})});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(badges[0].textContent,'LABO ◎ · 1位');assert.equal(badges[3].textContent,'LABO △ · 4位');
 assert.equal(current.state.marks[0].mark,'◎');
 handlers['labo-target-change']();assert.ok(badges.every(x=>x.textContent==='LABO印：評価待ち'));
});

test('LABO export preserves date, track, reference-only status and independently assigned symbols',()=>{
 const target={date:'2026-10-11',venue:'東京',raceNo:11,raceName:'アイルランドT'};
 const first=buildIndependentLaboReview(fixture,[{horseName:'馬D',mark:'◎'}]);
 const second=buildIndependentLaboReview(fixture,[{horseName:'馬D',mark:'消'}]);
 assert.equal(formatIndependentLaboCopy(first,target),formatIndependentLaboCopy(second,target));
 const text=formatIndependentLaboCopy(first,target);assert.match(text,/2026-10-11 東京11R/);assert.match(text,/馬場想定：良/);assert.match(text,/◎ 馬A \/ 1位/);assert.match(text,/精度未検証/);
});
test('LABO copy writes only the reference text and clears its buffer when track changes',async()=>{
 const ids=['independentLaboReview','independentLaboReviewStatus','independentLaboReviewContent','independentLaboReviewRefresh','markTrack','independentLaboCopy','independentLaboCopyText'];
 const nodes=new Map(ids.map(id=>[id,{textContent:'',innerHTML:'',disabled:false,hidden:true,value:'',handlers:{},addEventListener(n,fn){this.handlers[n]=fn;}}]));
 let copied='',requests=0;
 const window={addEventListener(){},navigator:{clipboard:{async writeText(text){copied=text;}}}};
 const current={target:{date:'2026-10-11',venue:'東京',raceNo:11},state:{track:'良',rosterVerified:true,roster:['馬A','馬B','馬C','馬D'],rosterNumbers:{},marks:[{horseName:'馬A',mark:'消'}]}};
 mountIndependentLaboReview({document:{getElementById:id=>nodes.get(id)},window,api:'https://test',getCurrent:()=>current,fetcher:async()=>{requests++;return {ok:true,json:async()=>structuredClone(fixture)}}});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(nodes.get('independentLaboCopy').disabled,false);
 await nodes.get('independentLaboCopy').handlers.click();assert.match(copied,/◎ 馬A/);assert.equal(current.state.marks[0].mark,'消');assert.equal(requests,1);
 current.state.track='重';nodes.get('markTrack').handlers.change();assert.equal(nodes.get('independentLaboCopy').disabled,true);assert.equal(nodes.get('independentLaboCopyText').value,'');
});

test('running position and missing pace evidence appear without changing LABO ranking',()=>{
 const data=structuredClone(fixture);data.assessment.allRunners[0].assessment.runningStyle={available:true,label:'前方傾向',validPositionRows:3};
 data.assessment.raceShape={runnerPool:4,coveredRunners:1,frontCandidates:[{horseName:'馬A'}],paceForecast:null,paceReason:'区間ラップ未取得'};
 const review=buildIndependentLaboReview(data);assert.equal(review.rows[0].laboMark,'◎');
 const html=renderIndependentLaboReview(review);assert.match(html,/位置取り：前方傾向/);assert.match(html,/位置取り判定 1\/4頭/);assert.match(html,/区間ラップ未取得/);assert.match(html,/参考指数へ加算していません/);
 assert.match(formatIndependentLaboCopy(review,{date:'2026-10-11',venue:'東京',raceNo:11}),/位置取り 前方傾向・根拠3走/);
});

test('complete reference scoring still reports the independently stored prior-detail shortage',async()=>{
 const nodes=new Map(['independentLaboReview','independentLaboReviewStatus','independentLaboReviewContent','independentLaboReviewRefresh'].map(id=>[id,{textContent:'',innerHTML:'',disabled:false,addEventListener(){}}]));
 const data=structuredClone(fixture);data.assessment.raceShape={runnerPool:4,coveredRunners:0,frontCandidates:[],paceForecast:null,paceReason:'区間ラップ未取得'};
 const current={target:{date:'2026-10-12',venue:'京都',raceNo:11},state:{track:'良',rosterVerified:true,roster:['馬A','馬B','馬C','馬D'],rosterNumbers:{},marks:[]}};const calls=[];
 mountIndependentLaboReview({document:{getElementById:id=>nodes.get(id)},window:{addEventListener(){}},api:'https://test',getCurrent:()=>current,fetcher:async(url)=>{calls.push(url);return{ok:true,json:async()=>url.includes('history-collection-status')?{ok:true,runnerCount:4,totalStoredRows:40,last3fRows:1,runners:[{cornerRows:1},{cornerRows:0},{cornerRows:0},{cornerRows:0}]}:data}}});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,2);assert.match(nodes.get('independentLaboReviewStatus').textContent,/過去走 40件／通過順 1件／上がり 1件（未取得あり）/);assert.match(nodes.get('independentLaboReviewContent').innerHTML,/位置取り判定 0\/4頭/);
});
