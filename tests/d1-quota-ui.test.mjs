import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import app,{isD1ReadQuotaError,nextD1QuotaReset} from '../src/index-v1.21.js';

test('only actual Cloudflare D1 free daily read-limit errors activate the quota gate',()=>{
 assert.equal(isD1ReadQuotaError("D1_ERROR: Your account has exceeded D1's free tier daily row read limit. Upgrade or wait until tomorrow"),true);
 assert.equal(isD1ReadQuotaError("Your account has exceeded D1’s free tier daily row read limit"),true);
 for(const error of ['race not found','HTTP 503','Network error','Your account has exceeded D1 daily row write limit'])assert.equal(isD1ReadQuotaError(error),false);
});
test('quota reset uses UTC midnight which is Japan 9am, never local browser midnight',()=>{
 assert.equal(new Date(nextD1QuotaReset(Date.parse('2026-10-10T22:54:00Z'))).toISOString(),'2026-10-11T00:00:00.000Z');
 assert.equal(new Date(nextD1QuotaReset(Date.parse('2026-10-11T00:01:00Z'))).toISOString(),'2026-10-12T00:00:00.000Z');
});
test('home gives explicit quota explanation without claiming DB marks are saved',async()=>{
 const html=await(await app.fetch(new Request('https://example.com/'))).text();
 assert.match(html,/DBの1日読み取り上限に達しています/);
 assert.match(html,/保存済みデータは削除されていません/);
 assert.match(html,/Date\.now\(\)<dbQuotaBlockedUntil/);
 for(const [,js] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(js);
});
