import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import app,{VERSION,automaticHistoryProgress,orderComparedRunners,cornerPositionSummary,historySourceLinks,overlookedCandidateSummary,runnerEvidenceLines,homeRaceSummary,selectedExpectedMarks,normalizeDraftMarks,phaseGateMessage,historyCoverageSummary} from '../src/index-v1.21.js';
test('inline marks use only current roster names, exclude stale horses and do not invent numbers',()=>{
 const roster=['ヴォンフレ','カムニャック','ラヴァンダ'];
 assert.deepEqual(selectedExpectedMarks(roster,{'ヴォンフレ':'注','カムニャック':'','ラヴァンダ':'○','別馬':'◎'}),[{horseName:'ヴォンフレ',mark:'注'},{horseName:'ラヴァンダ',mark:'○'}]);
 assert.deepEqual(selectedExpectedMarks(roster,{'ヴォンフレ':'不正'}),[]);
 assert.deepEqual(selectedExpectedMarks(roster,{}),[]);
});
test('all delivered scripts compile and inline roster reads the dated DB source',async()=>{
 const h=await (await app.fetch(new Request('https://keiba-lab-apl.vercel.app/'))).text();
 for(const [,code] of h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(code);
 assert.ok(h.includes(selectedExpectedMarks.toString()));
 assert.ok(h.includes('expectedInlineRoster'));
 assert.equal((await (await app.fetch(new Request('https://keiba-lab-apl.vercel.app/health'))).json()).version,VERSION);
});

test('phase drafts preserve exact identities without guessing numbers and reject malformed storage',()=>{
 assert.deepEqual(normalizeDraftMarks([{horse:' ヴォンフレ ',mark:'注'},{horse:'ラヴァンダ',mark:'○'},{horse:'12',mark:'▲'},{horse:'別馬',mark:'不正'},null]),[{horse:'ヴォンフレ',mark:'注'},{horse:'ラヴァンダ',mark:'○'},{horse:'12',mark:'▲'}]);
 assert.deepEqual(normalizeDraftMarks({horse:'別馬',mark:'◎'}),[]);
});
test('formal-card gate distinguishes editable drafts from audit and LOCK readiness',()=>{
 assert.match(phaseGateMessage('initial').text,/仮比較/);
 assert.match(phaseGateMessage('post_draw',{ok:true,ops:{cardComplete:false}}).text,/正式保存・事前LOCKはできません/);
 assert.match(phaseGateMessage('final',{ok:true,ops:{cardComplete:true,prelockAllowed:true,predictionReady:true,alertStatus:'OK'}}).text,/DBで再精査/);
});
test('history coverage leaves missing runners explicit',()=>{
 const s=historyCoverageSummary({runnerCount:3,withStoredHistory:1,pendingHorses:2,runners:[{horseName:'A',storedRows:8},{horseName:'B',storedRows:0},{horseName:'C',storedRows:0}]});
 assert.deepEqual(s,{total:3,stored:1,pending:2,pendingNames:['B','C']});
 assert.deepEqual(historyCoverageSummary({runnerCount:2,withStoredHistory:2,runners:[{horseName:'A',storedRows:8},{horseName:'B',storedRows:7}]}).pendingNames,[]);
});

test('returning home restores the home panel and resets a long-page scroll',async()=>{
 const html=await(await app.fetch(new Request('https://example.com'))).text();
 const nodes=['home','race','marks','history','ops','system'].map(id=>({id,active:id==='marks',classList:{toggle(name,on){nodes.find(x=>x.classList===this).active=on;}}}));
 const tabs=nodes.filter(x=>x.id!=='system').map(x=>({dataset:{id:x.id},classList:{toggle(){}}}));
 let scroll=null,expanded=null;
 const code=html.match(/function openView\(id\)\{[^\n]+\}/)[0];
 const context={refreshReturningHome:()=>{},document:{querySelectorAll:s=>s==='section'?nodes:tabs,getElementById:()=>({querySelector:()=>null})},window:{scrollTo:v=>{scroll=v;}},openSystem:{setAttribute:(k,v)=>{expanded=v;}}};
 new Script(code+';openView("home");').runInNewContext(context);
 assert.deepEqual(nodes.filter(x=>x.active).map(x=>x.id),['home']);
 assert.equal(scroll.top,0);assert.equal(expanded,'false');assert.match(html,/id="goHome"/);
});

test('home next action preserves card gates and distinguishes unavailable state from ready',()=>{
 assert.match(homeRaceSummary(null).missing.join(),/確認できません/);
 const waiting=homeRaceSummary({ok:true,ops:{cardComplete:false,nextAction:'WAIT_OFFICIAL_CARD'}});
 assert.match(waiting.missing.join(),/正式出馬表/);assert.equal(waiting.view,'marks');
 const ready=homeRaceSummary({ok:true,ops:{cardComplete:true,prelockAllowed:true,predictionReady:true,userMarkReady:true,decisionReady:true,alertStatus:'OK',nextAction:'READY_PRE_RACE'}});
 assert.deepEqual(ready.missing,[]);assert.match(ready.next,/当日/);
 const blocked=homeRaceSummary({ok:true,ops:{cardComplete:true,prelockAllowed:true,predictionReady:true,userMarkReady:true,decisionReady:true,alertStatus:'BLOCK',nextAction:'RESOLVE_BLOCKER'}});
 assert.match(blocked.missing.join(),/要確認/);
});

 test('runner evidence keeps absent scores pending and preserves zero counts',()=>{
 const lines=runnerEvidenceLines({detail:{course:{exactDistance:{rows:0},sameVenue:{rows:2}},ground:{rows:0}},components:{ground:null,paceStyleFit:null},modelCoveragePct:60});
 assert.match(lines[0],/同じ距離：0走/);assert.match(lines[2],/未指定.*評価保留/);assert.match(lines[3],/評価保留/);assert.match(lines[4],/60%.*勝率ではありません/);assert.match(runnerEvidenceLines({})[0],/未取得/);
 });

test('overlooked candidates are held for incomplete pools and thin history',()=>{
 const candidates=[{horseName:'A',referenceRank:1,validFinishRows:5},{horseName:'B',referenceRank:2,validFinishRows:2},{horseName:'C',referenceRank:4,validFinishRows:8}];
 assert.deepEqual(overlookedCandidateSummary({runnerPool:3,scoredRunners:2,unmarkedCandidates:candidates}).candidates,[]);
 assert.deepEqual(overlookedCandidateSummary({runnerPool:3,scoredRunners:3,unmarkedCandidates:candidates}).candidates,[candidates[0]]);
 assert.equal(overlookedCandidateSummary({}).complete,false);
});

test('history provenance links reject unsafe destinations without hiding supplementary status',()=>{
 const valid=historySourceLinks({sourceUrl:'https://www.jra.go.jp/JRADB/accessU.html?CNAME=abc',supplementalSourceUrl:'https://race.netkeiba.com/race/shutuba_past.html?race_id=123'});
 assert.equal(valid.links.length,2);assert.equal(valid.supplemented,true);
 for(const url of ['javascript:alert(1)','http://www.jra.go.jp/','https://www.jra.go.jp.evil.test/','https://user:pass@www.jra.go.jp/'])assert.equal(historySourceLinks({sourceUrl:url}).links.length,0);
 assert.equal(historySourceLinks({supplementalSourceUrl:'bad'}).supplemented,true);assert.deepEqual(historySourceLinks({}).links,[]);
});

test('history receipt still due is visible even with stored starts',()=>{
 assert.deepEqual(historyCoverageSummary({runnerCount:2,withStoredHistory:2,pendingHorses:1,runners:[{horseName:'A',storedRows:5,due:true},{horseName:'B',storedRows:8,due:false}]}).pendingNames,['A']);
});

test('checked empty history remains missing without appearing in the pending check list',()=>{
 const s=historyCoverageSummary({runnerCount:1,withStoredHistory:0,pendingHorses:0,runners:[{horseName:'A',storedRows:0,due:false,collectionState:'checked-empty'}]});assert.equal(s.stored,0);assert.equal(s.pending,0);assert.deepEqual(s.pendingNames,[]);
});

test('corner summaries normalize field size and reject missing or impossible positions',()=>{
 const rows=[{cornerPositions:'1-1',fieldSize:10},{cornerPositions:'5-5-5-5',fieldSize:10},{cornerPositions:'10',fieldSize:10},{cornerPositions:'4-3',fieldSize:null},{cornerPositions:'11-2',fieldSize:10},{cornerPositions:'2=3',fieldSize:10}];
 assert.deepEqual(cornerPositionSummary(rows),{total:6,recorded:3,average:5.3,front:1,middle:1,back:1});assert.equal(cornerPositionSummary([]).average,null);
});

test('comparison display sorts without altering ranks and filters exact selected horses',()=>{
 const rows=[{horseName:'カ',referenceRank:null},{horseName:'イ',referenceRank:1},{horseName:'ア',referenceRank:1}];
 assert.deepEqual(orderComparedRunners(rows,[],'rank').map(x=>x.horseName),['ア','イ','カ']);
 assert.deepEqual(orderComparedRunners(rows,[{horseName:'イ',mark:'消'}],'name',true),[rows[1]]);
 assert.deepEqual(rows.map(x=>x.horseName),['カ','イ','ア']);assert.equal(rows[2].referenceRank,1);
});

test('returning to foreground refreshes old progress but avoids repeated and hidden fetches',async()=>{
 const html=await(await app.fetch(new Request('https://example.com'))).text();const code=html.match(/function refreshReturningHome\(\)\{[^\n]+\}/)[0];let calls=0;const document={visibilityState:'visible'},context={document,Date:{now:()=>120000},learningCheckedAt:100000,refreshHomeLearning:()=>calls++};const script=new Script(code+';refreshReturningHome();');script.runInNewContext(context);assert.equal(calls,0);context.learningCheckedAt=0;document.visibilityState='hidden';script.runInNewContext(context);assert.equal(calls,0);document.visibilityState='visible';script.runInNewContext(context);assert.equal(calls,1);
});

test('home collection summary never credits unfinished or unobserved scheduled work',()=>{
 assert.match(automaticHistoryProgress({}),/未確認/);assert.match(automaticHistoryProgress({jobs:[{job:'history',heartbeat:'completion-unconfirmed',scheduled:{status:'running',result:{addedRows:10}}}]}),/完了記録を確認できません/);
 const jobs=[{job:'history',heartbeat:'observed',scheduled:{status:'collected',finishedAt:'2026-10-07T14:31:01Z',result:{addedRows:10}}}];assert.match(automaticHistoryProgress({jobs}),/10走追加/);jobs[0].scheduled.status='cooldown';assert.match(automaticHistoryProgress({jobs}),/取得間隔の待機/);
});
