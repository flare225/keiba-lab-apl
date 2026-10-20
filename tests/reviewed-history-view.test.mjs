import test from 'node:test';import assert from 'node:assert/strict';
import {renderReviewedHistory,mountReviewedHistory} from '../src/reviewed-history-view.js';
const fact={horse_name:'馬<script>',race_date:'2026-09-01',venue:'新潟',race_name:'試験',surface:'芝',distance:1000,finish_position:2,field_size:16,time_text:'0:55.4',last3f:32.1,corner_positions:'3',track_condition:'良'};
const data={available:true,integrityVerified:true,storedRows:1,rows:[fact],sourceUrl:'https://race.netkeiba.com/',observedAt:'2026-10-20'};
test('source-separated stored histories expose times, sectionals and corners without user marks',()=>{const h=renderReviewedHistory(data);assert.match(h,/1頭・1走/);assert.match(h,/上がり3F 32.1/);assert.match(h,/通過 3/);assert.match(h,/0:55.4/);assert.match(h,/印を付けず/);assert.ok(!h.includes('<script>'));assert.match(renderReviewedHistory({...data,integrityVerified:false}),/確認できません/);assert.match(renderReviewedHistory({available:false}),/未保存/);});
test('old history responses cannot replace another race after a target change',async()=>{
 const handlers={},boxes=[];let target={date:'2026-10-25',venue:'新潟',raceNo:11},resolve;
 const roster={querySelector(s){return s.startsWith('select')?{}:null},append(b){boxes.push(b)}};
 const document={getElementById(id){return id==='expectedInlineRoster'?roster:boxes.at(-1)},createElement(){return{isConnected:true,remove(){this.isConnected=false}}}};
 const window={getLaboTarget:()=>target,addEventListener(n,f){handlers[n]=f},fetch:()=>new Promise(r=>{resolve=r})};
 mountReviewedHistory({window,document,api:'https://api.test',render:renderReviewedHistory});assert.equal(boxes.length,1);target={...target,raceNo:9};handlers['labo-target-change']();resolve({ok:true,json:async()=>({ok:true,...data})});await new Promise(r=>setImmediate(r));assert.equal(boxes[0].innerHTML,undefined);
});
