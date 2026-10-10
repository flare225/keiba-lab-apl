import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import app,{VERSION} from '../src/index-v1.21.js';
import {renderTicketSelectionMatrix} from '../src/ticket-selection-matrix.js';

const roster=Array.from({length:16},(_,i)=>({horseNo:i+1,frameNo:Math.floor(i/2)+1,horseName:'テスト馬'+(i+1)}));
test('each of 16 horses appears in only one compact grid row with three independent position picks',()=>{
 const marks=new Map([[1,'◎'],[4,'▲']]);
 const html=renderTicketSelectionMatrix({runners:roster,groups:[[1],[1,4],[2,4]],labels:['1着','2着','3着'],marks,ready:true});
 assert.equal((html.match(/class="tb-matrix-horse"/g)||[]).length,16);
 assert.equal((html.match(/class="tb-matrix-pick/g)||[]).length,48);
 assert.equal((html.match(/class="tb-matrix-row/g)||[]).length,17);
 assert.match(html,/テスト馬1/);
 assert.match(html,/1枠 1番/);
 assert.match(html,/data-group-count="0">1頭/);
 assert.match(html,/data-group-count="1">2頭/);
 assert.match(html,/aria-pressed="true"/);
 assert.match(html,/aria-label="テスト馬1：1着を解除"/);
 assert.match(html,/◎/);
 assert.doesNotMatch(html,/class="tb-group"/);
});
test('when official cards are unavailable all position choices remain disabled',()=>{
 const html=renderTicketSelectionMatrix({runners:roster.slice(0,2),groups:[[],[]],labels:['軸馬','相手馬'],ready:false});
 assert.equal((html.match(/ disabled/g)||[]).length,4);
 const none=renderTicketSelectionMatrix({runners:[],groups:[[],[]],labels:['軸馬','相手馬']});
 assert.match(none,/正式出馬表が保存・照合されるまで/);
 assert.doesNotMatch(none,/data-no=/);
});
test('horse names are escaped even inside dynamic aria labels',()=>{
 const html=renderTicketSelectionMatrix({runners:[{horseNo:1,frameNo:1,horseName:'<img src=x onerror=alert(1)>'}],groups:[[1]],labels:['1着'],ready:true});
 assert.match(html,/&lt;img/);
 assert.doesNotMatch(html,/<img src=x/);
});
test('mobile HTML has six tabs in one row and no extra row for betting',async()=>{
 const html=await(await app.fetch(new Request('https://example.com/'))).text();
 const tabs=html.match(/<div class="tab(?: active)?" data-id="[^"]+"/g)||[];
 assert.equal(tabs.length,6,JSON.stringify(tabs));
 for(const id of ['home','race','history','marks','bets','ops'])assert.match(html,new RegExp('class="tab(?: active)?" data-id="'+id+'"'));
 assert.match(html,/\.navin\{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(html,/env\(safe-area-inset-bottom\)/);
 assert.match(html,/tab\.addEventListener\('keydown'/);
 assert.match(html,/scrollTo\(\{top:0,behavior:'instant'\}\)/);
 assert.equal((await(await app.fetch(new Request('https://example.com/health'))).json()).version,VERSION);
});
test('official mark editing is a local draft until a deliberate DB recheck; button blocks repeat request',async()=>{
 const html=await(await app.fetch(new Request('https://example.com/'))).text();
 assert.match(html,/if\(!initial\(\)\)\{if\(!force\)return/);
 assert.match(html,/let officialAuditBusy=false/);
 assert.match(html,/if\(officialAuditBusy\)return/);
 assert.match(html,/正式なDB照合は「DBで再精査」を押したときに実行します/);
 assert.match(html,/DB照合中…/);
 assert.match(html,/officialAuditBusy=false;if\(action\)/);
 assert.match(html,/labo-marks-changed/);
 for(const [,script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(script);
});
test('copy fallback and explicit clear confirmation are present',async()=>{
 const html=await(await app.fetch(new Request('https://example.com/'))).text();
 assert.match(html,/id="ticketExportText"/);
 assert.match(html,/長押ししてコピー/);
 assert.match(html,/このレースの買い目をすべて削除しますか/);
 assert.match(html,/renderTicketSelectionMatrix/);
});

test('navigation is actually six sibling controls, never nested under 監査',async()=>{
 const html=await(await app.fetch(new Request('https://example.com/'))).text();
 const start=html.indexOf('<div class="nav"><div class="navin"');
 const end=html.indexOf('</div></div>',start);
 assert.ok(start>=0);
 // The first pair of adjacent closing divs must be the sixth tab + navin.
 // A nested child would make the first pair belong to that child instead.
 const subtree=html.slice(start,end+12);
 const ids=[...subtree.matchAll(/<div class="tab(?: active)?" data-id="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(ids,['home','race','history','marks','ops','bets']);
 assert.equal((subtree.match(/class="tab(?: active)?"/g)||[]).length,6);
 const opsStart=subtree.indexOf('data-id="ops"'),betsStart=subtree.indexOf('data-id="bets"');
 assert.ok(subtree.indexOf('</div>',opsStart)>opsStart&&subtree.indexOf('</div>',opsStart)<betsStart,'監査 tab must close before the 買い目 tab starts');
 assert.match(html,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)!important/);
 assert.match(html,/updateNavClearance/);
 assert.match(html,/--labo-nav-height/);
 assert.doesNotMatch(subtree,/data-id="bets"[\s\S]*data-id="history"/);
});
