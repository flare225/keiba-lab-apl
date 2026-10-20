export async function verifyAutomaticPrediction(data,target,crypto=globalThis.crypto){
 if(data?.ok!==true)throw Error('自動予想APIが失敗しました。');
 if(data.available===false)return data;
 if(data.available!==true)throw Error('保存状態が不明です。');
 const s=data.snapshot,key=`${target.date}:${target.venue}:${target.raceNo}`;
 if(data.integrityVerified!==true||!s||s.race?.raceKey!==key||s.race.date!==target.date||s.race.venue!==target.venue||Number(s.race.raceNo)!==Number(target.raceNo))throw Error('選択レースと保存予想が一致しません。');
 if(!/^[a-f0-9]{64}$/.test(data.snapshotSha256||'')||!crypto?.subtle)throw Error('保存内容のハッシュを照合できません。');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(s))),hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 if(hash!==data.snapshotSha256)throw Error('保存内容のハッシュが一致しません。');
 if(!Array.isArray(s.runners)||!s.runners.length||!Array.isArray(s.card)||s.runners.length!==s.race.runnerCount||s.card.length!==s.runners.length||new Set(s.runners.map(r=>r.horseNo)).size!==s.runners.length||new Set(s.card.map(r=>Number(r.horse_no))).size!==s.card.length||!Number.isFinite(Date.parse(s.savedAt))||!s.modelVersion||s.guardrails?.humanMarksUsed!==false||s.guardrails?.targetResultUsed!==false||s.guardrails?.immutable!==true)throw Error('全馬の保存証跡を確認できません。');
 const marks={1:'◎',2:'○',3:'▲',4:'△',5:'☆'};
 for(const r of s.runners){const c=s.card.find(c=>Number(c.horse_no)===r.horseNo&&c.horse_name===r.horseName);if(!c||!Number.isInteger(r.horseNo)||r.horseNo<1||r.horseNo>18||!Number.isInteger(Number(c.frame_no))||c.frame_no<1||c.frame_no>8||!Number.isInteger(r.rank)||r.rank<1||r.rank>s.runners.length||!Number.isFinite(r.score)||r.score<0||r.score>100||(r.mark??null)!==(marks[r.rank]||null))throw Error('出走馬・順位・スコア・印が一致しません。');}
 return{...data,browserIntegrityVerified:true};
}
export function renderAutomaticPrediction(data){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 if(!data?.available)return '<p>自動事前予想は未保存です。正式出馬表・過去走の補完後、発走前に順次保存します。ユーザー印は任意です。</p>';
 if(data.integrityVerified!==true||data.browserIntegrityVerified!==true)return '<p>保存証跡を確認できません。</p>';
 const s=data.snapshot;
 return '<p>🔒 DB読返し・画面ハッシュ照合済み ／ '+esc(s.savedAt)+'<br>モデル '+esc(s.modelVersion)+' ／ ユーザー印は任意</p>'+s.runners.map(r=>'<div class="row" data-auto-horse="'+esc(r.horseNo)+'" data-auto-rank="'+esc(r.rank)+'" data-auto-score="'+esc(r.score)+'" data-auto-mark="'+esc(r.mark||'')+'"><span>'+esc(r.mark||'—')+' '+esc(r.horseNo)+'番 '+esc(r.horseName)+'</span><span class="r">'+esc(r.rank)+'位 ／ '+esc(r.score)+'</span></div>').join('')+'<p style="overflow-wrap:anywhere">SHA '+esc(data.snapshotSha256)+'</p><p>保存済みの事前予想です。学習済み・精度向上を示すものではありません。</p>';
}
export function mountAutomaticPrediction({window,document,api,render,verify}){
 const parent=document.getElementById('genericOpsPanel');if(!parent)return;
 const box=document.createElement('div');box.className='card';box.id='automaticLaboPrediction';box.innerHTML='<h3>LABO自動事前予想</h3><div data-auto-body>対象レース確認中…</div>';parent.insertAdjacentElement('afterend',box);const body=box.querySelector('[data-auto-body]');let seq=0;
 async function load(){const t=window.getLaboTarget?.(),n=++seq;if(!t){box.dataset.snapshotSha256='';box.dataset.raceKey='';body.textContent='対象レースを選択してください。';return;}box.dataset.snapshotSha256='';box.dataset.raceKey='';body.textContent='保存済み事前予想を確認中…';try{const q=new URLSearchParams({date:t.date,venue:t.venue,race_no:String(t.raceNo)});const res=await window.fetch(api+'/v1/lab/automatic-prediction?'+q);if(!res.ok)throw Error('保存状態を取得できません');const data=await res.json();if(n!==seq)return;const verified=await verify(data,t,window.crypto);if(n===seq){body.innerHTML=render(verified);box.dataset.snapshotSha256=verified.browserIntegrityVerified?verified.snapshotSha256:'';box.dataset.raceKey=verified.browserIntegrityVerified?verified.snapshot.race.raceKey:'';}}catch{if(n===seq)body.textContent='自動予想の保存状態を確認できません。';}}
 window.addEventListener('labo-target-change',load);void load();
}
