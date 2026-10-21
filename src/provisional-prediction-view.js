export async function verifyProvisionalPrediction(data,target,crypto=globalThis.crypto){
 if(data?.ok!==true)throw Error('暫定評価を取得できません。');if(data.available===false)return data;
 const s=data.snapshot;
 if(data.available!==true||data.integrityVerified!==true||!s||s.race?.date!==target.date||s.race.venue!==target.venue||Number(s.race.raceNo)!==Number(target.raceNo)||s.guardrails?.persisted!==true||s.guardrails.officialCard!==false||s.guardrails.locked!==false||s.guardrails.eligibleForLearning!==false||s.guardrails.humanMarksUsed!==false||!Array.isArray(s.runners)||!s.runners.length||s.runners.length!==s.runnerCount||new Set(s.runners.map(r=>r.horseName)).size!==s.runners.length)throw Error('暫定評価の対象・保存状態が一致しません。');
 if(!/^[a-f0-9]{64}$/.test(data.snapshotSha256||'')||!crypto?.subtle)throw Error('暫定評価のハッシュを確認できません。');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(s)))),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==data.snapshotSha256)throw Error('暫定評価の保存ハッシュが一致しません。');
 const marks=['◎','○','▲','△','☆'];for(const r of s.runners){if(r.horseNo!==null||r.frameNo!==null)throw Error('想定名簿に正式馬番が混入しています。');if(r.rank===null){if(r.score!==null||r.mark!==null)throw Error('未評価の状態が一致しません。');}else if(!Number.isFinite(r.score)||r.score<0||r.score>100||r.rank!==1+s.runners.filter(x=>Number.isFinite(x.score)&&x.score>r.score).length||r.mark!==(marks[r.rank-1]||'注'))throw Error('暫定順位・印が一致しません。');}
 return{...data,browserIntegrityVerified:true};
}
export function renderProvisionalPrediction(data){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 if(!data?.available)return '<p>想定名簿による暫定評価は未保存です。正式予想とは別に準備します。ユーザー印は任意です。</p>';
 if(!data.browserIntegrityVerified)return '<p>暫定評価の保存内容を確認できません。</p>';
 const s=data.snapshot;return '<p>想定名簿・保存済み過去走による暫定参考評価<br>DB読返し・画面ハッシュ照合済み ／ '+esc(s.savedAt)+'</p><p>正式出走馬・枠順は未確定。正式事前LOCK・学習対象ではありません。同点は同順位・同じ印です。</p>'+[...s.runners].sort((a,b)=>(a.rank??999)-(b.rank??999)).map(r=>'<div class="row" data-provisional-name="'+esc(r.horseName)+'" data-provisional-rank="'+esc(r.rank)+'" data-provisional-score="'+esc(r.score)+'" data-provisional-mark="'+esc(r.mark)+'"><span>'+esc(r.mark||'—')+' '+esc(r.horseName)+'</span><span class="r">'+esc(r.rank===null?'未評価':r.rank+'位 ／ '+r.score)+'</span></div>').join('')+'<p>モデル '+esc(s.modelVersion)+'<br>netkeiba由来の履歴はJRA公式照合済みではありません。スコアは勝率や精度向上の証明ではありません。</p><p style="overflow-wrap:anywhere">SHA '+esc(data.snapshotSha256)+'</p>';
}
export function mountProvisionalPrediction({window,document,api,render,verify}){
 const parent=document.getElementById('automaticLaboPrediction')||document.getElementById('genericOpsPanel');if(!parent)return;
 const box=document.createElement('div');box.id='provisionalLaboPrediction';box.className='card';box.innerHTML='<h3>LABO暫定評価（想定出馬表）</h3><div data-provisional-body></div>';parent.insertAdjacentElement('afterend',box);const body=box.querySelector('[data-provisional-body]'),cache=new Map();let seq=0;
 async function load(){const t=window.getLaboTarget?.(),n=++seq;box.dataset.snapshotSha256='';box.dataset.raceKey='';if(!t){body.textContent='対象レースを選択してください。';return;}body.textContent='保存済み暫定評価を確認中…';const key=t.date+':'+t.venue+':'+t.raceNo;try{if(!cache.has(key)){if(cache.size>=8)cache.delete(cache.keys().next().value);cache.set(key,(async()=>{const q=new URLSearchParams({date:t.date,venue:t.venue,race_no:String(t.raceNo)}),r=await window.fetch(api+'/v1/lab/provisional-prediction-snapshot?'+q);if(!r.ok)throw Error('read failed');return verify(await r.json(),t,window.crypto)})());}const data=await cache.get(key);if(n!==seq)return;body.innerHTML=render(data);if(data.browserIntegrityVerified){box.dataset.snapshotSha256=data.snapshotSha256;box.dataset.raceKey=key;}}catch{if(n===seq)body.textContent='暫定評価の保存状態を確認できません。';}}
 window.addEventListener('labo-target-change',load);void load();
}
