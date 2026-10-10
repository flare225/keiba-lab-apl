import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {readFileSync} from 'node:fs';
import app,{VERSION} from '../src/index-v1.21.js';
import {describeAuditAlignment,summarizeMarkAudit,renderMarkAuditCards} from '../src/mark-audit-cards-v1.22.js';
const audited={
 ok:true,phase:'post_draw',race:{raceKey:'2026-10-10:東京:11',raceName:'第12回 サウジアラビアロイヤルカップ',runnerCount:11},
 audit:{mode:'official-card-model-crosscheck',trackAssumption:'良',modelCoveragePct:72.7,decisionReady:false,
  marked:[
   {horseNo:1,horseName:'テストA',mark:'◎',laboRank:2,laboScore:84.2,profile:{frameNo:1},alignment:{level:'aligned',reason:'◎ inside LABO top 3'},evidence:{historyRows:3},warnings:[]},
   {horseNo:7,horseName:'テストB',mark:'◎',laboRank:8,laboScore:60.5,profile:{frameNo:4},alignment:{level:'conflict',reason:'◎ is LABO rank 7+'},evidence:{historyRows:1},warnings:['one-pre-race-history']},
   {horseNo:10,horseName:'未評価馬',mark:'○',laboRank:null,laboScore:null,profile:{frameNo:6},alignment:{level:'unscored',reason:'LABO rank unavailable'},evidence:{historyRows:0},warnings:['integrated-model-snapshot-missing']}
  ],unmarkedTopCandidates:[{horseNo:5,horseName:'無印候補',laboRank:1,laboScore:89}],summary:{aligned:1,conflict:1,unscored:1,watch:0}}
};

test('human-readable official audit shows full scoring evidence, flagged discrepancies and missed horses',()=>{
 const h=renderMarkAuditCards(audited);
 assert.match(h,/第12回 サウジアラビアロイヤルカップ/);
 assert.match(h,/1枠 1番/);
 assert.match(h,/4枠 7番/);
 assert.match(h,/LABO順位/);
 assert.match(h,/2位/);
 assert.match(h,/84.2/);
 assert.match(h,/評価に食い違い/);
 assert.match(h,/再確認・食い違い/);
 assert.match(h,/保存カバー率：72.7%/);
 assert.match(h,/無印候補/);
 assert.match(h,/LABO 1位/);
 assert.match(h,/買い目構築へ/);
 assert.doesNotMatch(h,/"stage":|<pre.*class="result"|user-mark-db-crosscheck/);
 assert.equal(summarizeMarkAudit(audited).counted.conflict,1);
});
test('missing model rank and score remain explicitly missing rather than zero',()=>{
 const h=renderMarkAuditCards(audited);
 assert.match(h,/未評価馬/);
 assert.match(h,/LABO評価未取得/);
 assert.match(h,/参考点 <strong>未取得<\/strong>/);
 assert.match(h,/過去走 <strong>0走<\/strong>/);
 assert.match(h,/未取得は0点として扱わず/);
 assert.doesNotMatch(h,/参考点 <strong>0<\/strong>/);
 assert.equal(describeAuditAlignment(audited.audit.marked[2]).level,'unscored');
});
test('precard mode does not pretend that provisional horses have official scores or confirmed number',()=>{
 const result={ok:true,phase:'initial',race:{raceName:'アイルランドT'},audit:{mode:'precard-context-only',marked:[{horseName:'デモ',mark:'○',horseNo:null,laboScore:null,laboRank:null}]}};
 const h=renderMarkAuditCards(result);
 assert.match(h,/正式出馬表との照合前/);
 assert.match(h,/馬番未確認/);
 assert.match(h,/参考点 <strong>未取得<\/strong>/);
 assert.doesNotMatch(h,/JRA照合済/);
});
test('failed API audit is a warning, never a fake success, and malicious names are escaped',()=>{
 const fail=renderMarkAuditCards({ok:false,error:'card not ready'});
 assert.match(fail,/監査を完了できません/);
 assert.doesNotMatch(fail,/照合応答あり/);
 const hacked=structuredClone(audited);
 hacked.audit.marked[0].horseName='<img src=x onerror=alert(1)>';
 hacked.audit.unmarkedTopCandidates[0].horseName='<svg>';
 const h=renderMarkAuditCards(hacked);
 assert.match(h,/&lt;img/);
 assert.match(h,/&lt;svg&gt;/);
 assert.doesNotMatch(h,/<img src=x|<svg>/);
});
test('initial comparison does not claim official DB rank coverage',()=>{
 const h=renderMarkAuditCards({ok:true,assessment:{runnerPool:12},race:{raceName:'サウジRC'}});
 assert.match(h,/初期印の過去走比較/);
 assert.match(h,/比較対象 12頭/);
 assert.doesNotMatch(h,/概ね一致.*頭/);
});
test('live HTML contains readable cards in audit tab, prevents visible raw JSON and every embedded script compiles',async()=>{
 const html=await(await app.fetch(new Request('https://test.example/'))).text();
 assert.match(html,/id="laboAuditReport"/);
 assert.match(html,/data-audit-open-bets/);
 assert.match(html,/renderMarkAuditCards/);
 assert.match(html,/window.showLaboAudit/);
 assert.match(html,/audit-readable-horse/);
 assert.match(html,/監査データの詳細を表示/);
 const client=readFileSync(new URL('../src/index-v1.21.js',import.meta.url),'utf8');
 assert.doesNotMatch(client,/<pre class=\\"result\\">.*JSON\.stringify\(d/);
 for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(m[1]);
 assert.equal((await(await app.fetch(new Request('https://test.example/health'))).json()).version,VERSION);
});

test('final marks with zero integrated rank coverage explain why all ranks are missing without inventing scores',()=>{
 const zero=structuredClone(audited);
 zero.phase='final';
 zero.race.raceName='アイルランドT';
 zero.audit.modelCoveragePct=0;
 zero.audit.marked=zero.audit.marked.map(x=>({...x,laboRank:null,laboScore:null,
  alignment:{level:'unscored',reason:'LABO rank unavailable'},
  warnings:['integrated-model-snapshot-missing']}));
 zero.audit.unmarkedTopCandidates=[];
 const h=renderMarkAuditCards(zero);
 assert.match(h,/LABO統合順位：未作成/);
 assert.match(h,/保存済み0%/);
 assert.match(h,/印を付け直しても順位は出ません/);
 assert.match(h,/事前固定予想は別データ/);
 assert.match(h,/LABO順位 <strong>未取得<\/strong>/);
 assert.doesNotMatch(h,/LABO順位 <strong>0位<\/strong>/);
 assert.doesNotMatch(h,/統合順位：1位/);
});
test('partial coverage warns rank among scored horses is provisional; full coverage does not warn',()=>{
 const partial=structuredClone(audited);
 partial.audit.modelCoveragePct=30;
 assert.match(renderMarkAuditCards(partial),/全馬の確定順位ではありません/);
 const full=structuredClone(audited);
 full.audit.modelCoveragePct=100;
 assert.doesNotMatch(renderMarkAuditCards(full),/LABO統合順位：未作成|全馬の確定順位ではありません/);
});
