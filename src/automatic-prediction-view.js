export function renderAutomaticPrediction(data){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 if(!data?.available)return '<p>自動事前予想は未保存です。正式出馬表・過去走の補完後、発走前に順次保存します。ユーザー印は任意です。</p>';
 if(data.integrityVerified!==true)return '<p>保存証跡を確認できません。</p>';
 const s=data.snapshot;
 return '<p>🔒 DB保存・読返し確認済み ／ '+esc(s.savedAt)+'<br>モデル '+esc(s.modelVersion)+' ／ ユーザー印は任意</p>'+s.runners.map(r=>'<div class="row"><span>'+esc(r.mark||'—')+' '+esc(r.horseNo)+'番 '+esc(r.horseName)+'</span><span class="r">'+esc(r.rank)+'位 ／ '+esc(r.score)+'</span></div>').join('')+'<p style="overflow-wrap:anywhere">SHA '+esc(data.snapshotSha256)+'</p><p>保存済みの事前予想です。学習済み・精度向上を示すものではありません。</p>';
}
export function mountAutomaticPrediction({window,document,api,render}){
 const parent=document.getElementById('genericOpsPanel');if(!parent)return;
 const box=document.createElement('section');box.className='card';box.id='automaticLaboPrediction';box.innerHTML='<h3>LABO自動事前予想</h3><div data-auto-body>対象レース確認中…</div>';parent.insertAdjacentElement('afterend',box);const body=box.querySelector('[data-auto-body]');let seq=0;
 async function load(){const t=window.getLaboTarget?.(),n=++seq;if(!t)return;body.textContent='保存済み事前予想を確認中…';try{const q=new URLSearchParams({date:t.date,venue:t.venue,race_no:String(t.raceNo)});const res=await window.fetch(api+'/v1/lab/automatic-prediction?'+q);if(!res.ok)throw Error('保存状態を取得できません');const data=await res.json();if(n===seq)body.innerHTML=render(data)}catch{if(n===seq)body.textContent='自動予想の保存状態を確認できません。';}}
 window.addEventListener('labo-target-change',load);void load();
}
