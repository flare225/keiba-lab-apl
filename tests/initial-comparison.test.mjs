import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import app,{findComparedRunner} from '../src/index-v1.20.js';
test('unnumbered expected runners match the exact marked name, never undefined horse numbers',()=>{
 const rows=[{horseName:'ウイントワイライト'},{horseName:'ヴォンフレ'}];
 assert.equal(findComparedRunner(rows,{horseName:'ヴォンフレ'}),rows[1]);
 assert.equal(findComparedRunner(rows,{horseName:'別馬'}),undefined);
 assert.equal(findComparedRunner(rows,{}),undefined);
 assert.equal(findComparedRunner([{horseNo:2},{horseNo:3}],{horseNo:3}).horseNo,3);
});
test('deployed HTML compiles every browser script and reports current app version',async()=>{
 const h=await (await app.fetch(new Request('https://keiba-lab-apl.vercel.app/'))).text();
 for(const [,code] of h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Script(code);
 assert.ok(h.includes(findComparedRunner.toString()));
 assert.equal((await (await app.fetch(new Request('https://keiba-lab-apl.vercel.app/health'))).json()).version,'1.20.1');
});
