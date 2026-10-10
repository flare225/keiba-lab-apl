import app from './index-v1.19.js';
import {describeAuditAlignment,summarizeMarkAudit,renderMarkAuditCards} from './mark-audit-cards-v1.22.js';
import {WAGER_TYPES,ticketMethodOptions,groupLabels,generateFormationTickets,validateTicketStake,calculateTicketSlip} from './ticket-formation-v1.22.js';
import {mountTicketBuilder} from './ticket-builder-client-v1.22.js';
import {renderTicketSelectionMatrix} from './ticket-selection-matrix.js';
import {renderWorkoutEvidence,mountWorkoutEvidence,netkeibaWorkoutReference} from './workout-evidence-ui.js';
import {WORKOUT_IMPRESSIONS,getOfficialWorkoutRoster,workoutImpressionSummary,mountWorkoutImpressions} from './workout-impression-v1.23.js';
export const VERSION='1.23.5';
export function buildBudgetBets({budget=0,marks=[],mode='balanced',types=null}={}){
 const input=Number(budget),yen=Number.isFinite(input)&&input>=100?Math.floor(input/100)*100:0,clean=(Array.isArray(marks)?marks:[]).filter(x=>x&&(x.horseName||Number.isInteger(x.horseNo))&&['◎','○','▲','△','☆','注'].includes(x.mark)).slice(0,18).map(x=>({...x,horseName:(Number.isInteger(x.frameNo)?x.frameNo+'枠 ':'')+(Number.isInteger(x.horseNo)?x.horseNo+'番 ':'')+(x.horseName||'')})),by=m=>clean.filter(x=>x.mark===m).map(x=>x.horseName);
 const main=[...by('◎'),...by('○'),...by('▲')].slice(0,6),insurance=[...by('△'),...by('☆'),...by('注')].slice(0,6),items=[],enabled=new Set(Array.isArray(types)?types:['馬連','ワイド','三連複','三連単']);
 const pairs=(xs,ordered=false)=>xs.flatMap((a,i)=>(ordered?xs.filter(b=>a!==b):xs.slice(i+1)).map(b=>[a,b]));
 const frames=new Map(clean.filter(x=>Number.isInteger(x.frameNo)&&x.frameNo>=1&&x.frameNo<=8).map(x=>[x.horseName,x.frameNo]));
 if(main.length&&enabled.has('単勝'))items.push({category:'勝負',type:'単勝',tickets:1,combos:[[main[0]]]});
 if(main.length&&enabled.has('複勝'))items.push({category:'保険',type:'複勝',tickets:1,combos:[[main[0]]]});
 if(main.length>=2&&enabled.has('枠連')){const framePairs=pairs(main.slice(0,4)).filter(p=>p.every(x=>frames.has(x))).map(p=>p.map(x=>frames.get(x)+'枠').sort());const unique=[...new Map(framePairs.map(p=>[p.join('-'),p])).values()];if(unique.length)items.push({category:'勝負',type:'枠連（公式枠番）',tickets:unique.length,combos:unique});}
 if(main.length>=2&&enabled.has('馬連'))items.push({category:'勝負',type:'馬連フォーメーション',tickets:main.length===2?1:pairs(main.slice(0,3)).length,combos:main.length===2?[main]:pairs(main.slice(0,3))});
 if(main.length>=2&&enabled.has('馬単')){const combos=pairs(main,true);items.push({category:'勝負',type:'馬単ボックス',tickets:combos.length,combos});}
 if(main.length>=2&&enabled.has('ワイド'))items.push({category:'保険',type:'ワイド',tickets:main.length===2?1:pairs(main.slice(0,3)).length,combos:main.length===2?[main]:pairs(main.slice(0,3))});
 if(main.length>=3&&enabled.has('三連複'))items.push({category:'勝負',type:'三連複フォーメーション',tickets:1,combos:[[main[0],main[1],main[2]]]});
 if(main.length>=3&&enabled.has('三連単')){const combos=[];for(const a of main)for(const b of main)for(const c of main)if(a!==b&&a!==c&&b!==c)combos.push([a,b,c]);items.push({category:'勝負',type:'三連単ボックス',tickets:combos.length,combos});}
 if(insurance.length&&main.length&&enabled.has('ワイド'))items.push({category:'保険',type:'ワイド補完',tickets:Math.min(3,insurance.length),combos:insurance.slice(0,3).map(x=>[main[0],x])});
 if(enabled.has('三連単')&&main.length>=2&&insurance.length){const trio=[main[0],main[1],insurance[0]],multi=[];for(const x of trio)for(const y of trio)for(const z of trio)if(x!==y&&x!==z&&y!==z)multi.push([x,y,z]);items.push({category:'保険',type:'三連単（◎○軸・保険マルチ）',tickets:multi.length,combos:multi});}
 const selected=mode==='safe'?items.filter(x=>x.category==='保険'):mode==='win'?items.filter(x=>x.category==='勝負'):items;
 if(!yen||!selected.length)return{ok:false,budget:yen,items:[],total:0,remaining:yen,message:!yen?'100円単位の予算を入力してください。':'印が足りません。◎○▲を2頭以上指定してください。'};
 const wins=selected.filter(x=>x.category==='勝負'),safes=selected.filter(x=>x.category==='保険'),ordered=mode==='balanced'?[wins[0],safes[0],...selected]:selected;
 const output=[],excluded=[],already=new Set();let total=0;
 for(const x of ordered){if(!x||already.has(x))continue;already.add(x);const tickets=x.combos.length,cost=tickets*100;if(total+cost>yen){excluded.push({type:x.type,tickets});continue;}output.push({category:x.category,type:x.type,tickets,unitStake:100,amount:cost,combos:x.combos});total+=cost;}
 if(!output.length)return{ok:false,budget:yen,items:[],total:0,remaining:yen,excluded,message:'予算不足：1点100円以上が必要です。'};
 const weight=output.reduce((n,x)=>n+x.tickets*(x.category==='勝負'&&mode!=='safe'?2:1),0),unit=Math.floor((yen-total)/100/weight);
 if(unit>0)for(const x of output){const extra=unit*100*(x.category==='勝負'&&mode!=='safe'?2:1);x.unitStake+=extra;x.amount=x.tickets*x.unitStake;total+=x.tickets*extra;}
 return{ok:true,budget:yen,items:output,total,remaining:yen-total,mode,excluded};
}
export function phaseInlineAvailable(phase,verified,count){return count>0&&(phase==='initial'||(verified===true&&(phase==='post_draw'||phase==='final')));}
export function verifiedOfficialRoster(rows=[],status={}){
 if(status?.ok!==true||status?.ops?.cardComplete!==true||!Array.isArray(rows)||rows.length<1||rows.length>18)return null;
 const runners=rows.map(x=>({horseName:String(x.horse_name??x.horseName??'').trim(),horseNo:Number(x.horse_no??x.horseNo),frameNo:Number(x.frame_no??x.frameNo)}));
 if(runners.some((x,i)=>!x.horseName||x.horseNo!==i+1||!Number.isInteger(x.frameNo)||x.frameNo<1||x.frameNo>8)||new Set(runners.map(x=>x.horseName)).size!==runners.length)return null;
 return{source:{snapshotId:'verified-jra-card'},runners,officialVerified:true};
}
export function findComparedRunner(rows,mark){return rows.find(x=>mark.horseName?x.horseName===mark.horseName:mark.horseNo!=null&&x.horseNo===mark.horseNo);}
export function selectedExpectedMarks(roster,values={}){const allowed=new Set(['◎','○','▲','△','☆','注','消']);return roster.filter(name=>allowed.has(values[name])).map(horseName=>({horseName,mark:values[horseName]}));}
export function parseExternalMarks(text,roster=[]){const allowed=new Set(['◎','○','▲','△','☆','注','消']),names=[...roster].filter(Boolean).sort((a,b)=>b.length-a.length),out=[];for(const raw of String(text||'').split(/\r?\n/)){const line=raw.trim();if(!line)continue;const mark=line.match(/[◎○▲△☆注消]/)?.[0];if(!mark)continue;const horse=names.find(name=>line.includes(name));if(horse&&!out.some(x=>x.horseName===horse))out.push({horseName:horse,mark});}return out;}
export function normalizeDraftMarks(marks){const allowed=new Set(['◎','○','▲','△','☆','注','消']);return (Array.isArray(marks)?marks:[]).filter(m=>m&&typeof m.horse==='string'&&m.horse.trim()&&allowed.has(m.mark)).slice(0,18).map(m=>({horse:m.horse.trim(),mark:m.mark}));}
export function phaseGateMessage(phase,ops={}){if(phase==='initial')return{tone:'info',text:'枠順前の準備です。保存済みの馬名から過去走を仮比較し、初期印を下書きできます。出走確定の照合は別途必要です。馬番・枠番は推測せず、正式保存・事前LOCKは枠順と監査がそろってから進めます。'};if(!ops?.ok)return{tone:'warn',text:'公式出馬表の保存状態を確認中です。下書きは編集できますが、正式保存・事前LOCKは保留です。'};const o=ops.ops||{};if(!o.cardComplete)return{tone:'warn',text:'公式出馬表は未保存または監査前です。下書きは使えますが、正式保存・事前LOCKはできません。'};if(!o.prelockAllowed)return{tone:'warn',text:'公式出馬表は保存済みですが、監査の確認が残っています。LOCK前の下書きとして扱います。'};if(!o.predictionReady)return{tone:'info',text:'公式出馬表の保存・監査は通過。次はLABO事前LOCKです。哲平印は下書きのままです。'};return{tone:o.alertStatus==='BLOCK'?'warn':'ok',text:o.alertStatus==='BLOCK'?'公式カードとLOCKは確認済みですが、当日チェックに要確認項目があります。':'公式カードとLABO事前LOCKを確認済みです。「DBで再精査」で哲平印との照合へ進めます。'};}
export function historyCoverageSummary(race={}){const total=Number(race.runnerCount||0),stored=Number(race.withStoredHistory||0),pending=Number(race.pendingHorses??Math.max(0,total-stored));return{total:Number.isFinite(total)?total:0,stored:Math.max(0,stored),pending:Math.max(0,pending),pendingNames:(Array.isArray(race.runners)?race.runners:[]).filter(x=>x?.due===true||(x?.due==null&&Number(x?.storedRows||0)<=0)).map(x=>String(x.horseName||'')).filter(Boolean)};}
export function learningProgressSummary(learning={}){const training=learning.training||{},minimum=Number(learning.minimumRaces),eligible=Number(training.eligibleRaces),remaining=Number(training.remainingRaces);return{eligible:Number.isFinite(eligible)?Math.max(0,eligible):null,minimum:Number.isFinite(minimum)&&minimum>0?minimum:null,remaining:Number.isFinite(remaining)?Math.max(0,remaining):null,candidateCreated:learning.candidateCreated===true,automaticPromotion:false};}
export function modelValidationSummary(learning={}){const v=learning.validation||{},count=x=>Number.isInteger(x)&&x>=0?String(x):'未確認';return{stage:learning.candidateCreated===true?(v.canReviewCandidate===true?'検証件数に到達・精度の審査待ち':'学習候補を将来レースで検証中'):'学習候補の作成前',progress:'検証用レース '+count(v.races)+' / '+count(learning.minimumValidationRaces)+'・開催日 '+count(v.raceDays)+' / '+count(learning.minimumValidationDays),meaning:'件数到達だけでは精度向上と判定しません。現在の参考指数の的中率・回収率は未検証です。'};}
export function automaticHistoryProgress(pipeline={}){const job=(pipeline.jobs||[]).find(x=>x.job==='history'),run=job?.scheduled;if(!run)return '自動補完：定期実行の記録は未確認です。';if(!run.finishedAt)return '自動補完：'+(job.heartbeat==='running'?'実行中です。':'完了記録を確認できません。詳しい進捗で確認してください。');const stamp=new Date(run.finishedAt),time=Number.isFinite(stamp.getTime())?stamp.toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'時刻未確認';const rows=run.result?.addedRows;const detail=run.status==='collected'&&Number.isFinite(rows)?rows+'走追加':({cooldown:'取得間隔の待機',idle:'対象データの待機',partial:'一部補完・再確認あり',failed:'取得の再確認が必要'})[run.status]||'処理結果は詳しい進捗で確認';return '直近の自動履歴補完：'+time+' · '+detail+'。';}
export function orderComparedRunners(rows,marks=[],order='name',onlyMarked=false){const selected=new Set(marks.map(m=>findComparedRunner(rows,m)?.horseName).filter(Boolean));return rows.filter(r=>!onlyMarked||selected.has(r.horseName)).slice().sort((a,b)=>{const name=String(a.horseName).localeCompare(String(b.horseName),'ja');if(order!=='rank')return name;const rank=r=>Number.isFinite(r.referenceRank)?r.referenceRank:Infinity;return rank(a)-rank(b)||name;});}
export function cornerPositionSummary(history=[]){const valid=[];let front=0,middle=0,back=0;for(const r of history){if(typeof r.cornerPositions!=='string'||!/^\d+(?:-\d+)*$/.test(r.cornerPositions.trim()))continue;const parts=r.cornerPositions.trim().split('-').map(Number),n=r.fieldSize;if(!Number.isInteger(n)||n<2||parts.some(p=>p<1||p>n))continue;const position=parts.at(-1),ratio=(position-1)/(n-1);valid.push(position);if(ratio<=1/3)front++;else if(ratio<=2/3)middle++;else back++;}return{total:history.length,recorded:valid.length,average:valid.length?Math.round(valid.reduce((a,b)=>a+b,0)/valid.length*10)/10:null,front,middle,back};}
export function historySourceLinks(row={}){const link=(raw,label)=>{try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&['www.jra.go.jp','jra.go.jp','race.netkeiba.com'].includes(u.hostname)?{url:u.href,label}:null;}catch{return null;}};return{supplemented:!!row.supplementalSourceUrl,links:[link(row.sourceUrl,'成績の出典'),link(row.supplementalSourceUrl,'補完データの出典')].filter(Boolean)};}
export function overlookedCandidateSummary(c={}){const complete=Number.isFinite(c.runnerPool)&&c.runnerPool>0&&c.scoredRunners===c.runnerPool;return{complete,candidates:complete?(c.unmarkedCandidates||[]).filter(x=>Number.isFinite(x.referenceRank)&&x.referenceRank<=3&&x.validFinishRows>=3):[]};}
export function runnerEvidenceLines(a={}){const d=a.detail||{},c=d.course||{},g=d.ground||{};const count=x=>Number.isFinite(x)?x+'走':'未取得';const index=x=>Number.isFinite(x)?String(x):'評価保留';return ['同じ距離：'+count(c.exactDistance?.rows)+' / 同じ競馬場：'+count(c.sameVenue?.rows),'距離±200m：'+count(c.within200m?.rows)+' / コース・距離指数：'+index(a.components?.courseDistanceFit),'想定馬場：'+(g.targetCondition||'未指定')+' / 根拠 '+count(g.rows)+' / 馬場指数：'+index(a.components?.ground),'脚質・展開適合：'+index(a.components?.paceStyleFit),'評価項目の充足率：'+(Number.isFinite(a.modelCoveragePct)?a.modelCoveragePct+'%':'未取得')+'（勝率ではありません）',...(a.notes||[])];}
export function homeRaceState(status,data){if(status>=200&&status<300)return data;if(status===404&&data?.nextAction==='WAIT_OFFICIAL_CARD')return{ok:true,ops:{cardComplete:false,nextAction:'WAIT_OFFICIAL_CARD'}};return null;}
export function homeRaceSummary(data){
 if(!data?.ok||!data.ops)return{missing:['保存状態を確認できません'],next:'状態を再確認してください',view:'race'};
 const o=data.ops,missing=[];
 if(!o.cardComplete)return{missing:['枠順付き正式出馬表の保存・監査は未完了（出走確定とは別工程）'],next:'今できること：保存済みの馬名で過去走・適性を比較し、初期印を下書き。枠番・馬番の照合と事前LOCKは枠順公開後。',view:'marks',phase:'initial'};
 else if(!o.prelockAllowed)missing.push('正式出馬表の保存監査');
 if(o.cardComplete&&o.prelockAllowed&&!o.predictionReady)missing.push('LABO事前予想の固定');
 if(o.predictionReady&&!o.userMarkReady)missing.push('正式な哲平印');
 if(o.userMarkReady&&!o.decisionReady)missing.push('印とLABOの再精査');
 if(o.alertStatus==='BLOCK')missing.push('当日チェックの要確認項目');
 const actions={WAIT_OFFICIAL_CARD:['初期印を付けて仮比較。正式出馬表の公開・保存を待つ','marks'],FIX_CARD_AUDIT:['出馬表の保存監査を確認する','race'],CREATE_PRELOCK:['馬場想定を確認して事前予想の固定へ進む','race'],ENTER_USER_MARKS:['哲平印を入力する','marks'],RUN_DECISION_LAB:['印とLABOをDBで再精査する','marks'],READY_PRE_RACE:['当日の馬場・変更情報を確認する','race'],RESOLVE_BLOCKER:['当日チェックの要確認項目を確認する','race']};
 const [next,view]=actions[o.nextAction]||['対象レースの状態を確認する','race'];return{missing,next,view};
}
export const enhancement=String.raw`
<style>
header{flex-wrap:wrap}header>.controls{margin-top:0}
.nav{box-sizing:border-box;min-height:64px;padding-bottom:env(safe-area-inset-bottom)}.navin{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;grid-template-rows:64px;width:100%;min-width:0;max-width:980px;margin:0 auto}.navin>.tab{min-width:0;max-width:100%;min-height:0;height:64px;align-self:stretch;justify-self:stretch;overflow:hidden;box-sizing:border-box}.wrap{padding-bottom:calc(var(--labo-nav-height, 80px) + 40px + env(safe-area-inset-bottom))}.navin .tab{min-width:0;min-height:58px;padding:7px 2px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;touch-action:manipulation}.navin .tab:focus-visible{outline:2px solid var(--accent);outline-offset:-3px}
.controls[hidden],.marks[hidden],#expectedInlineRoster[hidden]{display:none!important}
.expected-inline-row{display:grid;grid-template-columns:minmax(0,1fr) 100px;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}.expected-inline-row label{font-size:16px;font-weight:750}.expected-inline-row select{width:100%;min-height:46px}.expected-inline-list{margin:12px 0}.expected-inline-note{font-size:13px;line-height:1.6;color:var(--muted)}
.external-mark-import{display:grid;gap:7px;margin:12px 0;padding:10px;border:1px solid var(--line);border-radius:11px;background:var(--soft)}.external-mark-import textarea{width:100%;font:inherit;line-height:1.5}.external-mark-import .btn{justify-self:start}
.expected-inline-row label small{display:block;color:var(--muted);font-size:11px;font-weight:600}
.labo-main-link{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.labo-main-link a{display:block;padding:12px;border:1px solid var(--line);border-radius:12px;color:var(--accent);text-decoration:none}
.pool-controls{margin-bottom:12px}.pool-controls button[aria-pressed="true"]{background:var(--accent);color:#071018}.pool-controls span{font-size:12px;color:var(--muted)}.labo-pool{margin-top:12px;min-width:0}.labo-pool h4{margin:0 0 10px;font-size:15px}.labo-pool-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.labo-pool-card{min-width:0;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}.labo-pool-card h5{margin:0 0 10px;font-size:16px;overflow-wrap:anywhere}.labo-pool-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0}.labo-pool-stats div{min-width:0;text-align:center;padding:8px 2px;border-radius:8px;background:#0a131c}.labo-evidence{margin-top:12px;font-size:13px;line-height:1.7}.labo-evidence summary{cursor:pointer}.labo-evidence ul{padding-left:20px;overflow-wrap:anywhere}.labo-pool-stats dt{font-size:12px;color:var(--muted)}.labo-pool-stats dd{margin:3px 0 0;font-size:16px;font-weight:750;overflow-wrap:anywhere}
.phase-gate{margin:10px 0;padding:10px 11px;border:1px solid var(--line);border-radius:11px;font-size:13px;line-height:1.6;background:var(--soft)}.phase-gate.warn{border-color:#8f7132;color:#f0bd59}.phase-gate.ok{border-color:#286346;color:#9ee7bf}
.history-coverage{margin:10px 0;padding:10px 11px;border:1px solid var(--line);border-radius:11px;background:var(--soft);font-size:13px;line-height:1.6}.history-coverage strong{display:block}.history-coverage details{margin-top:5px}.history-coverage summary{cursor:pointer}.history-coverage-pending{color:#f0bd59}
.wrap{min-width:0}section,.card,.precard-panel,.precard-horses,.precard-horse,.expected-inline-list{min-width:0;max-width:100%}.card,.precard-panel,.expected-inline-row label,.prodmeta{overflow-wrap:anywhere}.expected-inline-row label{min-width:0}.result{overflow-wrap:anywhere;white-space:pre-wrap}.controls>*{min-width:0;max-width:100%}
@media(max-width:600px){.labo-pool-list{grid-template-columns:minmax(0,1fr)}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.markrow{grid-template-columns:64px minmax(0,1fr) 64px;gap:6px}.expected-inline-row{grid-template-columns:minmax(0,1fr) 86px;gap:8px}.row{flex-wrap:wrap}.row>*{min-width:0;max-width:100%}.row .r{max-width:100%;text-align:left}select{max-width:100%}.decision-grid{grid-template-columns:minmax(0,1fr)}.navin .tab{font-size:11px;padding-top:9px;padding-bottom:9px}.navin .tab b{display:block;font-size:15px;line-height:1.1}}
.labo-comparison-title{font-weight:800;font-size:16px;margin:8px 0}.precard-race-meta{font-size:13px}.precard-explain,.precard-guard{font-size:13px}
.bet-type-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;border:1px solid var(--line);border-radius:12px;margin:10px 0;padding:10px;min-width:0}.bet-type-grid legend{font-weight:800;padding:0 6px}.bet-type-grid label{display:flex;gap:8px;align-items:center;padding:7px 5px}.bet-type-grid input{min-height:auto;width:19px;height:19px}.bet-rows{display:grid;gap:10px;margin-top:10px}.bet-row{border:1px solid var(--line);border-radius:12px;padding:11px;background:var(--soft)}.bet-row h4{margin:0 0 6px}.bet-label{display:inline-block;margin-bottom:4px;padding:2px 7px;border-radius:999px;background:var(--accent);color:#071018;font-size:11px;font-weight:800}.bet-combos{font-size:13px;color:var(--text);line-height:1.7}.bet-amount{margin-top:7px;font-weight:800;color:var(--accent)}
.tb-export{width:100%;min-height:140px;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--panel2);color:var(--text);line-height:1.55;font-size:14px;resize:vertical}.tb-export[hidden]{display:none!important}
.tb-matrix{width:100%;display:grid;gap:0;border:1px solid var(--line);border-radius:12px;overflow:hidden}
.tb-matrix-row{display:grid;align-items:center;gap:5px;padding:7px 8px;border-bottom:1px solid var(--line);min-width:0}
.tb-matrix-row:last-child{border-bottom:0}
.tb-matrix-row:nth-child(even){background:var(--soft)}
.tb-matrix-header{position:sticky;top:0;z-index:1;background:var(--panel2)!important;font-size:11px;text-align:center;font-weight:750}
.tb-matrix-header>span:first-child{text-align:left}
.tb-matrix-header>span{min-width:0;overflow-wrap:anywhere}
.tb-matrix-header b,.tb-matrix-header small{display:block;font-size:11px}
.tb-matrix-header small{color:var(--muted);font-weight:500}
.tb-matrix-horse{display:grid;gap:1px;min-width:0;overflow-wrap:anywhere}
.tb-matrix-horse b{font-size:11px;color:var(--muted);font-weight:600}
.tb-matrix-horse span{font-size:13px;font-weight:750;line-height:1.3}
.tb-matrix-horse small{font-size:11px;color:var(--accent)}
.tb-matrix-pick{min-height:44px;min-width:40px;max-width:52px;width:100%;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text);font-size:20px;font-weight:800;cursor:pointer;touch-action:manipulation}
.tb-matrix-pick.selected{background:var(--accent);color:#071018;border-color:var(--accent)}
.tb-matrix-pick:disabled{opacity:.45;cursor:not-allowed}
.tb-matrix-pick:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.tb-head{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center}.tb-head h2{margin:0;font-size:19px}.tb-status{font-size:12px;padding:8px 10px;margin:10px 0;color:var(--muted);border:1px solid var(--line);border-radius:10px}.tb-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}.tb-fields label{display:grid;gap:4px;min-width:0;font-size:13px}.tb-fields input,.tb-fields select{width:100%;min-width:0}.tb-options{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0}.tb-options label{display:flex;align-items:center;gap:7px;font-size:13px}.tb-options input{min-height:auto;width:19px;height:19px}.tb-options [hidden]{display:none!important}.tb-groups{display:grid;gap:12px}.tb-group{padding:12px;background:var(--panel2);border:1px solid var(--line);border-radius:12px;min-width:0}.tb-group h4{margin:0 0 10px}.tb-group h4 small{color:var(--muted)}.tb-horses{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:7px}.tb-horse{min-width:0;display:flex;gap:10px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:9px;text-align:left;background:var(--panel);color:var(--text);cursor:pointer}.tb-horse.selected{border-color:var(--accent);background:#183653}.tb-horse:disabled{opacity:.55;cursor:not-allowed}.tb-no{background:#26384a;color:white;min-width:30px;min-height:30px;display:grid;place-items:center;border-radius:7px;font-size:16px;font-weight:850}.tb-horse.selected .tb-no{background:var(--accent);color:#071018}.tb-horse-text{min-width:0;overflow-wrap:anywhere;font-size:13px;font-weight:750}.tb-horse-text small{display:block;color:var(--muted);font-size:11px;font-weight:500}.tb-preview{margin:12px 0;padding:12px;border:1px solid var(--line);border-radius:12px;line-height:1.7}.tb-preview b{font-size:21px}.tb-preview strong{font-size:20px;color:var(--accent)}.tb-combos{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0}.tb-combos span{display:inline-block;padding:4px 7px;font-size:12px;background:#132738;border:1px solid #294156;border-radius:7px}.tb-summary{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;border:1px solid var(--line);border-radius:10px;padding:12px;margin:12px 0}.tb-summary strong{font-size:20px}.tb-summary.over{border-color:#bb5c4f;color:var(--bad)}.tb-slip-card{border:1px solid var(--line);border-radius:12px;padding:12px;margin:10px 0}.tb-slip-top{display:flex;justify-content:space-between;align-items:center;gap:10px}.tb-slip-money{font-size:13px;margin:8px 0}.tb-slip-money label{white-space:nowrap}.tb-slip-money input{width:84px;min-height:36px;padding:6px}.tb-slip-card summary{cursor:pointer}.tb-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.tb-note{font-size:13px;line-height:1.7;color:var(--muted)}@media(max-width:600px){.tb-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.tb-horses{grid-template-columns:repeat(2,minmax(0,1fr))}.tb-horse{padding:7px;gap:5px}.tb-no{min-width:27px}.tb-horse-text{font-size:12px}.tb-fields input,.tb-fields select{font-size:16px}}
.workout-impression-card{border:1px solid var(--line);border-radius:12px;padding:12px;margin:12px 0}.workout-impression-card h3{margin:0 0 8px;font-size:16px}
.workout-impression-row{border-top:1px solid var(--line);display:grid;gap:8px;padding:10px 0}
.workout-impression-horse{font-size:13px;overflow-wrap:anywhere}
.workout-impression-horse b{font-size:12px;color:var(--muted)}
.workout-impression-choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.workout-impression-choice{min-width:0;min-height:43px;border-radius:9px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-weight:650;touch-action:manipulation}
.workout-impression-choice.selected{background:#315980;border-color:var(--accent);color:#fff}
.workout-impression-card textarea{width:100%;min-height:140px;resize:vertical}
.workout-impression-card textarea[hidden]{display:none!important}
.workout-preview{padding:13px;border:1px solid var(--line);border-radius:12px;background:var(--panel);margin:10px 0;overflow-wrap:anywhere}
.workout-source-link{display:inline-flex;align-items:center;min-height:44px;padding:8px 12px;border-radius:10px;border:1px solid var(--line);text-decoration:none;line-height:1.4;font-size:13px;max-width:100%;overflow-wrap:anywhere}.workout-source-link[hidden]{display:none!important}.workout-source-row{margin:10px 0 0}
.workout-banner{font-weight:750;font-size:15px;margin:10px 0}.workout-list summary{cursor:pointer;font-size:14px;font-weight:750;padding:10px 0}
.workout-horse{border:1px solid var(--line);border-radius:10px;margin:7px 0;padding:10px;font-size:13px;line-height:1.5}
.workout-horse>div:first-child{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px}
.workout-state{font-size:11px;color:var(--muted)}.workout-observation{display:grid;gap:4px;padding:8px;margin:7px 0;background:var(--soft);border-radius:8px}
.workout-observation small{color:var(--muted)}.workout-observation span{font-variant-numeric:tabular-nums}
.formation-title{padding:12px 14px;background:#4654b5;color:#fff;font-size:19px;font-weight:800}.formation-line{display:grid;grid-template-columns:70px 1fr;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);font-size:16px}.formation-line b{background:#555;color:#fff;padding:3px 8px;text-align:center}.formation-meta{display:flex;justify-content:space-between;align-items:center;padding:14px;font-size:13px}.formation-meta strong{color:#e85b5b;font-size:25px}
.audit-readable{max-width:100%;min-width:0;overflow-wrap:anywhere;color:var(--text);font-size:14px;line-height:1.6}
.audit-readable-heading{display:flex;flex-wrap:wrap;gap:10px;align-items:start;justify-content:space-between;padding:8px 0 12px;border-bottom:1px solid var(--line)}
.audit-readable-heading h3{font-size:17px;margin:0;line-height:1.45}.audit-readable-heading p{color:var(--muted);margin:4px 0 0;font-size:12px}
.audit-readable-pill{padding:4px 8px;background:var(--soft);border:1px solid var(--line);border-radius:999px;font-size:12px;white-space:nowrap}
.audit-readable-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:14px 0}
.audit-readable-stats>div{display:grid;gap:2px;padding:12px 10px;border:1px solid var(--line);border-radius:11px;background:var(--soft);min-width:0}
.audit-readable-stats small{font-size:12px;color:var(--muted)}.audit-readable-stats b{font-size:19px;font-weight:800}
.audit-readable-meta{font-size:12px;color:var(--muted);line-height:1.7}
.audit-readable-warning{border:1px solid #856634;border-radius:10px;padding:10px 12px;color:#f0c777;line-height:1.6;font-size:13px}
.audit-readable-list{display:grid;gap:10px;margin:14px 0}
.audit-readable-horse{border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--soft)}
.audit-readable-horse.audit-level-watch{border-left:3px solid #bb9a53}
.audit-readable-horse.audit-level-conflict{border-left:3px solid #d56f69}
.audit-readable-horse.audit-level-unscored{border-left:3px solid #748497}
.audit-readable-horse-head{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.audit-readable-mark{display:grid;place-items:center;flex:0 0 34px;height:34px;border:1px solid var(--line);border-radius:10px;font-size:19px;font-weight:800;background:var(--panel)}
.audit-readable-horse-name{display:grid;gap:0;min-width:0;flex:1}.audit-readable-horse-name b{font-size:15px;overflow-wrap:anywhere}
.audit-readable-horse-name small{font-size:12px;color:var(--muted)}
.audit-readable-status{font-size:11px;padding:3px 8px;border:1px solid var(--line);border-radius:999px}
.audit-readable-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:10px 0 0}
.audit-readable-metrics span{display:grid;gap:2px;padding:8px 6px;text-align:center;font-size:11px;color:var(--muted);background:var(--panel);border-radius:8px}
.audit-readable-metrics strong{font-size:16px;color:var(--text);overflow-wrap:anywhere}
.audit-readable-reason{margin:10px 0 0;font-size:13px}.audit-readable-flags{font-size:12px;color:#f0c777;margin:7px 0 0}
.audit-readable-candidates{padding:12px;margin:14px 0;border:1px solid var(--line);border-radius:12px}
.audit-readable-candidates h4{margin:0}.audit-readable-candidate{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid var(--line);font-size:13px}
.audit-readable-candidate:last-child{border-bottom:0}
.audit-readable-disclaimer{font-size:12px;color:var(--muted);line-height:1.7}
.audit-readable-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 0}
#laboAuditReport{white-space:normal}
#precardPreview .audit-readable,.precard-horses .audit-readable{width:100%;white-space:normal}
@media(max-width:420px){.audit-readable-horse{padding:10px}.audit-readable-stats{gap:6px}.audit-readable-stats>div{padding:9px 7px}.audit-readable-metrics span{padding:7px 3px;font-size:10px}}
</style>
<script>
(()=>{
 const orderComparedRunners=${orderComparedRunners.toString()};let poolOrder='name',poolOnlyMarked=false,lastRendered=null;
 const cornerPositionSummary=${cornerPositionSummary.toString()};
 const historySourceLinks=${historySourceLinks.toString()};
 const overlookedCandidateSummary=${overlookedCandidateSummary.toString()};
 const runnerEvidenceLines=${runnerEvidenceLines.toString()};
 const findComparedRunner=${findComparedRunner.toString()};
 const selectedExpectedMarks=${selectedExpectedMarks.toString()};
 const parseExternalMarks=${parseExternalMarks.toString()};
 const normalizeDraftMarks=${normalizeDraftMarks.toString()};
 const phaseGateMessage=${phaseGateMessage.toString()};
 const has=x=>x!==null&&x!==undefined&&x!=='';
 const number=x=>has(x)&&typeof x==='number'&&Number.isFinite(x)?String(x):'未取得';
 const alignmentLabels={aligned:'概ね一致',watch:'再確認',conflict:'評価に食い違い',unscored:'LABO評価未取得'};
 const alignmentDescriptions={'◎ inside LABO top 3':'◎はLABO上位3位以内','◎ outside LABO top 3':'◎はLABO上位3位の圏外','◎ is LABO rank 7+':'◎はLABO7位以下','○ inside LABO top 4':'○はLABO上位4位以内','○ outside LABO top 4':'○はLABO上位4位の圏外','○ is LABO rank 8+':'○はLABO8位以下','LABO rank unavailable':'LABO順位の保存データなし','消 conflicts with LABO top 4':'消した馬がLABO上位4位に入っています','消 removes LABO top 7':'消した馬がLABO上位7位に入っています','消 outside LABO top 7':'消した馬はLABO8位以下'};
 const warningDescriptions={'zero-pre-race-history':'過去走データなし','one-pre-race-history':'過去走が1走のみ','low-base-confidence':'基礎評価の信頼度が低い','integrated-model-snapshot-missing':'LABO統合評価が未保存'};
 const describeAuditAlignment=${describeAuditAlignment.toString()};
 const summarizeMarkAudit=${summarizeMarkAudit.toString()};
 const renderMarkAuditCards=${renderMarkAuditCards.toString()};
 const historyCoverageSummary=${historyCoverageSummary.toString()};
 const modelValidationSummary=${modelValidationSummary.toString()};
 const automaticHistoryProgress=${automaticHistoryProgress.toString()};
 const learningProgressSummary=${learningProgressSummary.toString()};
 const api='https://keiba-lab-api.sekai-no-bancyou.workers.dev';
  const auditApi=/\.vercel\.app$/.test(window.location.hostname)?'':api;
 const buildBudgetBets=${buildBudgetBets.toString()};
 const verifiedOfficialRoster=${verifiedOfficialRoster.toString()};
 const phaseInlineAvailable=${phaseInlineAvailable.toString()};
 const renderWorkoutEvidence=${renderWorkoutEvidence.toString()};
 const netkeibaWorkoutReference=${netkeibaWorkoutReference.toString()};
 const mountWorkoutEvidence=${mountWorkoutEvidence.toString()};
 const WORKOUT_IMPRESSIONS=${JSON.stringify(WORKOUT_IMPRESSIONS)};
 const getOfficialWorkoutRoster=${getOfficialWorkoutRoster.toString()};
 const workoutImpressionSummary=${workoutImpressionSummary.toString()};
 const mountWorkoutImpressions=${mountWorkoutImpressions.toString()};
 const homeRaceSummary=${homeRaceSummary.toString()},homeRaceState=${homeRaceState.toString()};let homeRaceSequence=0;
 async function refreshHomeRace(){const seq=++homeRaceSequence,t=window.getLaboTarget?.(),title=document.getElementById('homeRaceTitle'),missing=document.getElementById('homeRaceMissing'),next=document.getElementById('homeRaceNext'),button=document.getElementById('homeRaceAction');if(!title)return;button.disabled=true;missing.textContent='保存状態を確認中…';next.textContent='';if(!t){title.textContent='対象レースを確認中';return;}title.textContent=t.date+' '+t.venue+t.raceNo+'R '+(t.raceName||'');try{const track=document.getElementById('track')?.value||'',r=await fetch(api+'/v1/lab/race-ops?date='+encodeURIComponent(t.date)+'&venue='+encodeURIComponent(t.venue)+'&race_no='+t.raceNo+(track?'&track='+encodeURIComponent(track):'')),d=await r.json();if(seq!==homeRaceSequence)return;const summary=homeRaceSummary(homeRaceState(r.status,d));missing.textContent=summary.missing.length?summary.missing.join(' / '):'現在の保存状態では不足・未完了なし';next.textContent=summary.next;button.textContent=summary.phase==='initial'?'枠順前の比較へ':d.ok?'次の操作へ':'対象レースで再確認';button.dataset.homePhase=summary.phase||'';button.dataset.homeView=summary.view;button.disabled=false;}catch{if(seq===homeRaceSequence){missing.textContent='保存状態を確認できません';next.textContent='対象レースで再確認してください';button.dataset.homeView='race';button.disabled=false;}}}
 window.addEventListener('labo-target-change',refreshHomeRace);refreshHomeRace();
 const learningBox=document.getElementById('homeLearning'),learningRefresh=document.getElementById('refreshHomeLearning'),learningUpdated=document.getElementById('homeLearningUpdated'),collectionBox=document.getElementById('homeCollection'),validationBox=document.getElementById('homeValidation');let learningCheckedAt=0;
 async function refreshHomeLearning(){if(!learningBox||learningRefresh.disabled)return;learningRefresh.disabled=true;learningBox.textContent='保存済みの学習データを確認中…';if(learningUpdated)learningUpdated.textContent='';if(collectionBox)collectionBox.textContent='自動補完の動作を確認中…';if(validationBox)validationBox.textContent='検証状況を確認中…';try{const r=await fetch(api+'/v1/lab/work-progress'),d=await r.json(),t=d.learning?.training,l=d.learning;if(!r.ok||!d.ok||!t||!Number.isInteger(t.eligibleRaces)||!Number.isInteger(l.minimumRaces)||l.minimumRaces<=0)throw Error('unavailable');const remaining=Math.max(0,l.minimumRaces-t.eligibleRaces);learningBox.textContent='学習に使えるデータ：'+t.eligibleRaces+' / '+l.minimumRaces+'レース'+(Number.isInteger(t.eligibleDays)?'・'+t.eligibleDays+'開催日':'')+'。'+(l.candidateCreated?'学習候補は作成済み。今後のレースで検証中です。':remaining?'学習候補を作る最低件数まであと'+remaining+'レース。必要な出走馬・結果・過去走がそろったレースのみ数えています。':'件数条件に到達。開催日数などの条件確認と候補作成は、詳しい進捗で確認できます。')+' 現在の予想への自動反映は行いません。';if(validationBox){const v=modelValidationSummary(l);validationBox.textContent=v.stage+'。'+v.progress+'。'+v.meaning;}if(collectionBox)collectionBox.textContent=automaticHistoryProgress(d.pipeline);learningCheckedAt=Date.now();if(learningUpdated)learningUpdated.textContent='確認時刻：'+new Date(learningCheckedAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});}catch{if(validationBox)validationBox.textContent='検証状況を取得できません。精度確認済みとは扱いません。';if(collectionBox)collectionBox.textContent='自動補完の状態を取得できません。';learningBox.textContent='現在の件数を確認できません。「学習状況を更新」で再確認できます。';}finally{learningRefresh.disabled=false;}}
 learningRefresh?.addEventListener('click',refreshHomeLearning);refreshHomeLearning();
 function refreshReturningHome(){if(document.visibilityState!=='hidden'&&Date.now()-learningCheckedAt>=60000)refreshHomeLearning();}
 document.addEventListener('visibilitychange',refreshReturningHome);window.addEventListener('pageshow',refreshReturningHome);
 const navRoot=document.querySelector('.nav');
 const updateNavClearance=()=>{if(!navRoot)return;const px=Math.max(64,Math.ceil(navRoot.getBoundingClientRect().height));document.documentElement.style.setProperty('--labo-nav-height',px+'px');};
 updateNavClearance();
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(updateNavClearance).observe(navRoot);
 window.addEventListener('resize',updateNavClearance);
 const openSystem=document.getElementById('openSystem');
 function openView(id){if(id==='home')refreshReturningHome();document.querySelectorAll('section').forEach(x=>x.classList.toggle('active',x.id===id));document.querySelectorAll('.tab').forEach(x=>{const selected=x.dataset.id===id;x.classList.toggle('active',selected);x.setAttribute?.('aria-current',selected?'page':'false');});openSystem?.setAttribute('aria-expanded',String(id==='system'));window.scrollTo({top:0,behavior:'instant'});document.getElementById(id)?.querySelector('h2')?.focus({preventScroll:true});}
 document.querySelectorAll('.navin .tab').forEach(tab=>{
  tab.tabIndex=0;tab.setAttribute('role','button');tab.setAttribute('aria-current',tab.classList.contains('active')?'page':'false');
  tab.addEventListener('click',()=>{document.querySelectorAll('.navin .tab').forEach(x=>x.setAttribute('aria-current',x===tab?'page':'false'));window.scrollTo({top:0,behavior:'instant'});});
  tab.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();tab.click();}});
 });
 const betRows=document.getElementById('betRows'),betSummary=document.getElementById('betSummary');
 const betMode=document.getElementById('betMode');if(betMode&&!document.getElementById('betTypes')){const field=document.createElement('fieldset');field.id='betTypes';field.className='bet-type-grid';const legend=document.createElement('legend');legend.textContent='券種（複数選択）';field.append(legend);['単勝','複勝','枠連','馬連','馬単','ワイド','三連複','三連単'].forEach((type,i)=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=type;input.checked=i>=3;label.append(input,document.createTextNode(type));field.append(label);});betMode.parentElement?.append(field);field.addEventListener('change',renderBets);}
 function renderBets(){if(!betRows||!betSummary)return;const t=window.getLaboTarget?.(),rosterMarks=typeof marks==='function'?marks():[],numbered=rosterMarks.map(x=>{const n=rosterNumbers[x.horseName]||{};return rosterVerified&&n.verified?{...x,horseNo:n.horseNo,frameNo:n.frameNo}:x;}),d=buildBudgetBets({budget:document.getElementById('betBudget')?.value,mode:document.getElementById('betMode')?.value,types:[...document.querySelectorAll('#betTypes input:checked')].map(x=>x.value),marks:numbered}),marked=rosterMarks.filter(x=>x.mark&&x.mark!=='消').map(x=>x.mark+' '+(x.horseName||x.horse||x.horseNo)).join(' / ');if(!d.ok){betSummary.innerHTML='<strong>まだ組めません：</strong> '+esc(d.message)+'<br><small>現在の印：'+esc(marked||'未入力')+'</small>';betRows.innerHTML='';return;}betSummary.innerHTML='<strong>買い目を確認：</strong> '+d.total.toLocaleString()+'円 / 予算 '+d.budget.toLocaleString()+'円 / 残り '+d.remaining.toLocaleString()+'円 · 合計 '+d.items.reduce((s,x)=>s+x.tickets,0)+'点'+(d.excluded?.length?' ／ 予算不足で除外：'+d.excluded.map(x=>esc(x.type)+' '+x.tickets+'点').join('、'):'')+'<br><small>対象印：'+esc(marked||'未入力')+'</small>';betRows.innerHTML=d.items.map(x=>'<article class="bet-row"><div class="bet-label">'+x.category+'</div><h4>'+x.type+'</h4><div class="bet-combos">'+x.combos.map(c=>c.map(esc).join(' → ')).join('<br>')+'</div><div class="bet-amount">'+x.tickets+'点 × 1点 '+x.unitStake.toLocaleString()+'円 = '+x.amount.toLocaleString()+'円</div></article>').join('');}
function renderFormationPreview(){let box=document.getElementById('formationPreview');if(!box){box=document.createElement('div');box.id='formationPreview';document.getElementById('betSummary')?.before(box);}const rosterMarks=typeof marks==='function'?marks():[];const by=(m)=>rosterMarks.filter(x=>x.mark===m).map(x=>{const n=rosterNumbers[x.horseName]||{};return (rosterVerified&&n.verified&&n.horseNo!=null?n.frameNo+'枠 '+n.horseNo+'番 ':'')+(x.horseName||'');});const first=by('◎')[0]||by('○')[0]||'未選択',others=[...by('○'),...by('▲'),...by('△')].filter(x=>x!==first).slice(0,6);const points=Math.max(0,others.length*(others.length-1));box.innerHTML='<div class="formation-title">3連単ながし</div><div class="formation-line"><b>1着</b><span>'+first+'</span></div><div class="formation-line"><b>相手</b><span>'+(others.length?others.join('　'): '印を2頭以上指定')+'</span></div><div class="formation-meta"><strong>'+points+'点</strong><small>印から自動セット · 画面下の買い目を組むで金額計算</small></div>';}
 document.getElementById('buildBets')?.addEventListener('click',renderBets);document.getElementById('betBudget')?.addEventListener('input',renderBets);document.getElementById('betMode')?.addEventListener('change',renderBets);
 document.getElementById('raceQuickPick')?.addEventListener('click',e=>{const b=e.target.closest?.('button[data-race-date]');if(!b)return;const ok=window.selectLaboRace?.(b.dataset.raceDate,'東京',11);if(ok)document.querySelector('.tab[data-id="marks"]')?.click();else{const n=document.getElementById('homeRaceNext');if(n)n.textContent='対象一覧を再読み込みしてください。';}});
 document.getElementById('goHome')?.addEventListener('click',()=>openView('home'));
 openSystem?.addEventListener('click',()=>openView('system'));
 document.getElementById('closeSystem')?.addEventListener('click',()=>{openView('home');openSystem?.focus();});
 document.querySelectorAll('.tab').forEach(x=>x.addEventListener('click',()=>{openSystem?.setAttribute('aria-expanded','false');window.scrollTo({top:0,behavior:'instant'});}));
 document.addEventListener('click',e=>{const tab=e.target.closest?.('.tab[data-id]');if(!tab)return;e.preventDefault();openView(tab.dataset.id);if(tab.dataset.id==='bets')requestAnimationFrame(()=>document.getElementById('betBudget')?.focus({preventScroll:true}));});
 document.querySelectorAll('[data-home-view]').forEach(x=>x.addEventListener('click',()=>{if(x.dataset.homePhase==='initial'){const phase=document.getElementById('phase');if(phase&&phase.value!=='initial'){phase.value='initial';phase.dispatchEvent(new Event('change',{bubbles:true}));}}document.querySelector('.tab[data-id="'+x.dataset.homeView+'"]')?.click();}));
 const out=document.getElementById('precardPreview'),identity=document.getElementById('precardIdentity'),panel=document.querySelector('.precard-panel');
 if(!out||!panel)return;
 const esc=v=>String(v??'未取得').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const value=(v,u='')=>v==null?'未取得':esc(v)+u;
 const key=t=>t?t.date+'|'+t.venue+'|'+t.raceNo:'';
 let generation=0,timer=null,running=false,queued=false,cache=null,cacheKey='',cachedAt=0;
 const label=()=>{const t=window.getLaboTarget?.();return t?t.date+' '+t.venue+t.raceNo+'R '+(t.raceName||t.race_name||(t.date==='2026-10-11'&&t.venue==='東京'&&Number(t.raceNo)===11?'アイルランドトロフィー':'')): '対象レースを確認中';};
 panel.querySelector('.precard-explain').textContent='初期印を付けると、対象レースの全馬を保存済みDBから比較します。根拠の過去走・上がり3F・通過順を確認できます。';
 panel.querySelector('.precard-guard').textContent='参考指数は的中確率ではありません。正式出馬表・枠順・当日馬場は未確定なら保留。初期印の仮比較は印の保存・事前LOCKを行いません。';
 const old=panel.querySelector('#precardRefresh'),refresh=old.cloneNode(true);old.replaceWith(refresh);refresh.textContent='保存済みDBを読み直して仮比較';
 const hero=document.querySelector('.hero');if(hero)hero.insertAdjacentHTML('beforeend','<div class="labo-main-link"><a href="#marks" id="openInitialComparison">対象レースの印・DB比較</a><a href="'+api+'/lab/work-progress" target="_blank" rel="noopener">補完・学習の進捗</a></div>');
 document.getElementById('openInitialComparison')?.addEventListener('click',e=>{e.preventDefault();document.querySelector('.tab[data-id="marks"]')?.click();});
 const names=document.createElement('datalist');names.id='laboExpectedNames';document.body.append(names);
 function inputNames(){document.querySelectorAll('.markrow').forEach((r,i)=>{r.querySelector('.horse').setAttribute('list',names.id);r.querySelector('.horse').setAttribute('aria-label','印'+(i+1)+'の馬名');r.querySelector('.mk').setAttribute('aria-label','印'+(i+1)+'の種類');});}
 inputNames();
 const initial=()=>document.getElementById('phase').value==='initial';
 const manualRows=document.getElementById('markRows'),markCard=manualRows.parentElement,rosterBox=document.createElement('div');rosterBox.id='expectedInlineRoster';manualRows.before(rosterBox);
 let roster=[],rosterNumbers={},rosterVerified=false,rosterKey='',rosterSnapshot='',rosterSequence=0,historyStatusSequence=0;
 const phaseInput=document.getElementById('phase'),trackInput=document.getElementById('markTrack');
 const auditReport=document.getElementById('laboAuditReport');
 function publishAuditCards(data,{inline=false}={}){
   const raceName=window.getLaboTarget?.()?.raceName||'対象レース';
   const html=renderMarkAuditCards(data,{raceName});
   if(auditReport)auditReport.innerHTML=html;
   if(inline){out.className='precard-horses';out.innerHTML=html;}
   const raw=document.getElementById('auditResult');
   if(raw)raw.textContent=JSON.stringify(data,null,2);
 }
 window.showLaboAudit=publishAuditCards;
 document.addEventListener('click',e=>{if(e.target.closest?.('[data-audit-open-bets]')){e.preventDefault();openView('bets');}});
 const phaseGate=document.createElement('div');phaseGate.id='phaseGate';phaseGate.className='phase-gate';manualRows.before(phaseGate);
 const carryBox=document.createElement('div');carryBox.className='controls';carryBox.innerHTML='<button type="button" class="btn secondary" id="carryMarkDraft">初期印を下書きへ引き継ぐ</button><p class="notice" id="markDraftNotice"></p>';manualRows.before(carryBox);
 const carryButton=carryBox.querySelector('button'),draftNotice=carryBox.querySelector('p');let draftKey='',draftPhase=phaseInput.value,draftStorageFailed=false;
 const draftStorageKey=(k,p)=>'keiba-labo:mark-draft:v1:'+k+'|'+p;
 function manualDraft(){return normalizeDraftMarks([...manualRows.querySelectorAll('.markrow')].map(r=>({horse:r.querySelector('.horse').value,mark:r.querySelector('.mk').value})));}
 function readDraft(k,p){try{const d=JSON.parse(localStorage.getItem(draftStorageKey(k,p))||'null');return d&&typeof d==='object'?{marks:normalizeDraftMarks(d.marks),track:['良','稍重','重','不良'].includes(d.track)?d.track:''}:null;}catch{return null;}}
 function saveDraft(){if(!draftKey||draftPhase==='initial')return;try{localStorage.setItem(draftStorageKey(draftKey,draftPhase),JSON.stringify({marks:manualDraft(),track:trackInput.value}));draftStorageFailed=false;}catch{draftStorageFailed=true;}}
 function fillDraft(items){manualRows.replaceChildren();const entries=items.length?items:[{horse:'',mark:'◎'},{horse:'',mark:'◎'}];for(const m of entries){window.addMarkRow();const row=manualRows.lastElementChild;row.querySelector('.horse').value=m.horse;row.querySelector('.mk').value=m.mark;}inputNames();}
 function syncDraftContext(){const k=key(window.getLaboTarget?.()),p=phaseInput.value;if(k===draftKey&&p===draftPhase)return;saveDraft();draftKey=k;draftPhase=p;if(auditReport)auditReport.textContent='印の段階を変更しました。この段階のDB照合は未実行です。';if(p!=='initial'){const d=readDraft(k,p);fillDraft(d?.marks||[]);trackInput.value=d?.track||'';out.textContent='下書きを表示中。正式出馬表との照合は「DBで再精査」で確認してください。';document.getElementById('auditResult').textContent='この段階の下書きは未監査です。';if(auditReport)auditReport.textContent='この段階の印は未監査です。DBで再精査してください。';}else{out.textContent='想定表で初期印を選ぶと、自動で仮比較します。';}}
 function carrySource(){if(draftPhase==='final'){const d=readDraft(draftKey,'post_draw');if(d?.marks.length)return{phase:'枠順後',marks:d.marks};}return{phase:'初期',marks:rosterKey===draftKey?selectedExpectedMarks(roster,savedValues()).map(m=>({horse:m.horseName,mark:m.mark})):[]};}
 function showDraft(){carryBox.hidden=phaseInlineAvailable(phaseInput.value,rosterVerified,roster.length);if(carryBox.hidden)return;const source=carrySource(),filled=manualDraft().length>0;carryButton.textContent=source.phase+'印を下書きへ引き継ぐ';carryButton.disabled=filled||!source.marks.length;draftNotice.textContent=draftStorageFailed?'このブラウザへの下書き保存ができません。印を控えてください。':filled?'下書きをこのブラウザに保存。正式出馬表との照合は「DBで再精査」で確認します。':'入力済みの印は上書きしません。引継ぎは下書きのみで、正式保存・事前LOCKは行いません。';}
 let phaseGateRequest=0;
 async function refreshPhaseGate(){const phase=phaseInput.value,t=window.getLaboTarget?.(),request=++phaseGateRequest;if(phase==='initial'){const m=phaseGateMessage(phase);phaseGate.className='phase-gate '+m.tone;phaseGate.textContent=m.text;return;}const m=phaseGateMessage(phase);phaseGate.className='phase-gate '+m.tone;phaseGate.textContent=m.text;if(!t)return;try{const r=await fetch(api+'/v1/lab/race-ops?date='+encodeURIComponent(t.date)+'&venue='+encodeURIComponent(t.venue)+'&race_no='+encodeURIComponent(t.raceNo)),d=await r.json();if(request!==phaseGateRequest||phase!==phaseInput.value)return;const next=phaseGateMessage(phase,r.ok?d:r.status===404?{ok:true,ops:{cardComplete:false}}:null);phaseGate.className='phase-gate '+next.tone;phaseGate.textContent=next.text;}catch{if(request===phaseGateRequest){const next=phaseGateMessage(phase);phaseGate.className='phase-gate '+next.tone;phaseGate.textContent=next.text;}}}
 carryButton.addEventListener('click',()=>{syncDraftContext();if(manualDraft().length)return;const source=carrySource();if(!source.marks.length)return;fillDraft(source.marks);saveDraft();showDraft();showMode();out.textContent=source.phase+'印を下書きへ引き継ぎました。正式出馬表との照合は未確認です。';});

 const storageKey=(phase=phaseInput.value)=> 'keiba-labo:expected-marks:v1:'+rosterKey+(phase==='initial'?'':'|'+phase);
 const values=()=>Object.fromEntries([...rosterBox.querySelectorAll('select[data-horse-name]')].map(s=>[s.dataset.horseName,s.value]));
 function showMode(){const inline=phaseInlineAvailable(phaseInput.value,rosterVerified,roster.length);rosterBox.hidden=!inline;manualRows.hidden=inline;rosterBox.querySelectorAll('select[data-horse-name]').forEach(x=>x.disabled=!inline);const add=[...markCard.querySelectorAll('button')].find(b=>b.textContent.includes('印を追加'));if(add)add.hidden=inline;const notice=markCard.querySelector('.notice');if(notice)notice.textContent=inline?(initial()?'馬名の横で初期印を付けるとDBで仮比較します。':'馬名の横で枠順後・最終印を編集できます。DB再精査では正式出馬表を照合します。'):'馬番または馬名を入力して印を付けてください。正式な印保存は出馬表と照合します。';}
 function savedValues(){try{let raw=localStorage.getItem(storageKey());if(!raw&&rosterVerified&&!initial())raw=localStorage.getItem(storageKey(phaseInput.value==='final'?'post_draw':'initial'))||localStorage.getItem(storageKey('initial'));const d=JSON.parse(raw||'{}');return d&&typeof d.marks==='object'&&d.marks!==null?d.marks:{};}catch{return {};}}
 function saveInline(){if(!phaseInlineAvailable(phaseInput.value,rosterVerified,roster.length))return;try{localStorage.setItem(storageKey(),JSON.stringify({snapshotId:rosterSnapshot,marks:Object.fromEntries(selectedExpectedMarks(roster,values()).map(m=>[m.horseName,m.mark]))}));}catch{const note=rosterBox.querySelector('.expected-inline-note');if(note)note.textContent='このブラウザへの保存ができませんでした。画面を閉じる前に印を控えてください。';}}
 function applyInlinePhaseValues(){const stored=savedValues();rosterBox.querySelectorAll('select[data-horse-name]').forEach(x=>{x.value=stored[x.dataset.horseName]||'';});}
 function drawRoster(d){const intro=document.querySelector('.precard-panel .precard-title .precard-label');if(intro)intro.textContent=d.officialVerified?'JRA枠番・馬番照合済み':'想定馬・馬番未確定';roster=d.runners.slice().filter(x=>typeof x.horseName==='string').sort((a,b)=>d.officialVerified?a.horseNo-b.horseNo:a.horseName.localeCompare(b.horseName,'ja')).map(x=>x.horseName);rosterVerified=d.officialVerified===true;rosterNumbers=Object.fromEntries(d.runners.filter(x=>x&&x.horseName).map(x=>[x.horseName,{horseNo:Number.isInteger(x.horseNo)?x.horseNo:null,frameNo:Number.isInteger(x.frameNo)?x.frameNo:null,verified:rosterVerified,provisional:!rosterVerified}]));rosterSnapshot=d.source?.snapshotId||'';const stored=savedValues();rosterBox.innerHTML='<h3>'+(rosterVerified?'JRA正式出馬表':'保存済み出走想定表')+' · '+esc(label())+'</h3><p class="expected-inline-note">'+(rosterVerified?'JRA照合済み '+roster.length+'頭。':'登録'+roster.length+'頭・公式枠番は照合待ち。')+' 初期印はブラウザ下書き。事前LOCKは別途監査が必要です。</p><div class="external-mark-import"><label for="externalMarks">ネットケイバ印（1行1頭・馬名と印を貼り付け）</label><textarea id="externalMarks" rows="3" placeholder="例：◎ ニシノティアモ\n○ グランディア"></textarea><button type="button" class="btn secondary" id="applyExternalMarks">ネットケイバ印を初期値へ反映</button><span id="externalMarksNotice" class="expected-inline-note">反映後もLABO画面で自由に変更できます。</span></div><div id="historyCoverage" class="history-coverage">履歴補完状況を確認中…</div><div class="expected-inline-list">'+roster.map((name,i)=>{const n=rosterNumbers[name]||{},tag=n.horseNo!=null?'<small> '+(n.verified?'公式照合済':'補完・未照合')+' '+(n.frameNo??'?')+'枠 '+n.horseNo+'番</small>':'';return '<div class="expected-inline-row"><label for="expectedMark'+i+'">'+esc(name)+tag+'</label><select id="expectedMark'+i+'" data-horse-name="'+esc(name)+'" aria-label="'+esc(name)+'の初期印">'+['','◎','○','▲','△','☆','注','消'].map(m=>'<option value="'+m+'"'+(stored[name]===m?' selected':'')+'>'+ (m||'未指定')+'</option>').join('')+'</select></div>';}).join('')+'</div>';document.getElementById('applyExternalMarks')?.addEventListener('click',()=>{const parsed=parseExternalMarks(document.getElementById('externalMarks')?.value,roster);parsed.forEach(x=>{const select=rosterBox.querySelector('select[data-horse-name="'+CSS.escape(x.horseName)+'"]');if(select)select.value=x.mark;});const note=document.getElementById('externalMarksNotice');if(note)note.textContent=parsed.length+'頭の外部印を反映。以後の変更はLABO印として保存します。';schedule();});showMode();showDraft();if(phaseInlineAvailable(phaseInput.value,rosterVerified,roster.length)&&marks().length)schedule();}
 async function loadHistoryCoverage(t,k){const n=++historyStatusSequence,box=rosterBox.querySelector('#historyCoverage');if(!box||!t)return;try{const [historyResponse,progressResponse]=await Promise.all([fetch(api+'/v1/lab/expected-history-status'),fetch(api+'/v1/lab/work-progress')]),[history,progress]=await Promise.all([historyResponse.json(),progressResponse.json()]);if(n!==historyStatusSequence||k!==key(window.getLaboTarget?.()))return;const race=(history.races||[]).find(x=>x.date===t.date&&x.venue===t.venue&&Number(x.raceNo)===Number(t.raceNo));if(!historyResponse.ok||!race||race.available===false)throw Error('status unavailable');const s=historyCoverageSummary(race),learning=progressResponse.ok&&progress.ok?learningProgressSummary(progress.learning):null,waiting=s.pendingNames.length?'<details><summary>補完確認待ち '+s.pending+'頭を見る</summary><span class="history-coverage-pending">'+s.pendingNames.map(esc).join(' / ')+'</span></details>':'';const learningLine=learning&&learning.eligible!=null&&learning.minimum!=null?'<br><span class="expected-inline-note">学習データ：'+learning.eligible+'/'+learning.minimum+'レース'+(learning.remaining!=null?'（あと'+learning.remaining+'）':'')+'。'+(learning.candidateCreated?'候補は検証中です。':'候補作成前の蓄積段階で、現在の予想へ自動反映しません。')+'</span>':'';box.innerHTML='<strong>保存済み履歴あり：'+s.stored+'/'+s.total+'頭</strong>'+(s.pending?' <span class="history-coverage-pending">補完確認待ち '+s.pending+'頭</span>':' 補完確認の待ちなし')+waiting+learningLine+'<br><span class="expected-inline-note">履歴ありは1走以上の保存を示します。上がり・通過順の不足は各馬の比較で確認できます。</span>';}catch{if(n===historyStatusSequence&&k===key(window.getLaboTarget?.()))box.textContent='履歴補完状況を確認できません。未取得を完了扱いにはしません。';}}

 function marks(){if(phaseInlineAvailable(phaseInput.value,rosterVerified,roster.length)&&rosterKey===key(window.getLaboTarget?.()))return selectedExpectedMarks(roster,values());return [...document.querySelectorAll('.markrow')].map(r=>{const name=r.querySelector('.horse').value.trim(),mark=r.querySelector('.mk').value;return !name?null:/^\d+$/.test(name)?{horseNo:Number(name),mark}:{horseName:name,mark};}).filter(Boolean);}
 function render(d,human){
  lastRendered={d,human};
  const comparison=d.comparison||{},reviewRows=new Map((comparison.rows||[]).map(x=>[x.horseName,x])),overlooked=overlookedCandidateSummary(comparison);
  const a=d.assessment||{},rows=a.allRunners||[],evidence=new Map((d.audit?.historySidecar||[]).map(x=>[x.horseName,x]));
  const visible=orderComparedRunners(rows,human,poolOrder,poolOnlyMarked),selected=new Map(human.map(m=>[findComparedRunner(rows,m)?.horseName,m.mark]));
  out.className='precard-horses';
  const candidates='<article class="precard-horse"><b>印を付けていない参考上位候補</b><p>'+(!overlooked.complete?'全馬の有効な履歴がそろうまで、候補の提示を保留します。':overlooked.candidates.length?overlooked.candidates.map(x=>esc(x.horseName)+'（参考'+value(x.referenceRank,'位')+'・有効な着順'+value(x.validFinishRows,'走')+'）').join('<br>'):'有効な着順3走以上の参考上位3位内に、印の未指定馬はいません。')+'</p><small>印は自動変更しません。参考指数は的中確率ではありません。</small></article>';
  out.innerHTML='<div class="labo-comparison-title">'+esc(label())+'</div><p>全'+value(a.runnerPool)+'頭中 '+value(a.scoredRunners)+'頭を仮評価。馬場未指定なら馬場評価を保留。</p><p class="notice">予想精度は未検証です。順位・指数は過去走の参考比較で、的中確率ではありません。脚質・展開・追い切りは指数に未反映です。</p>'+candidates+human.map(m=>{
   const r=findComparedRunner(rows,m),a=r?.assessment||{},h=evidence.get(r?.horseName||m.horseName),review=reviewRows.get(r?.horseName||m.horseName);
   const position=cornerPositionSummary(h?.recent||[]),positionHtml='<p>過去走の最終コーナー位置：'+(position.recorded?'平均'+value(position.average,'番手')+'（記録'+position.recorded+'/'+position.total+'走）<br>前方 '+position.front+'走 · 中団 '+position.middle+'走 · 後方 '+position.back+'走':'通過順・頭数の有効な記録なし')+'</p><small>各レースの頭数を3分割した位置の目安です。今回の脚質・展開予測や参考指数には反映していません。</small>';
   const reviewHtml=review?'<p><strong>'+esc(review.label)+'</strong><br>'+esc(review.explanation)+'</p><details><summary>見直す前に不足情報を確認</summary><ul>'+review.gaps.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></details>':'';
   return '<article class="precard-horse"><b>'+esc(m.mark)+' '+esc(r?.horseName||m.horseName||m.horseNo)+'</b><p>参考指数 '+value(a.evidenceScore)+' / 100 · 参考順位 '+value(r?.referenceRank,'位')+'</p>'+reviewHtml+positionHtml+(h?.recent?.length?'<details><summary>根拠の過去走 '+h.recent.length+'走を見る</summary>'+h.recent.map(x=>{const source=historySourceLinks(x);return '<div class="precard-race"><b>'+esc(x.date)+' '+esc(x.venue)+' '+esc(x.raceName)+' · '+value(x.finish,'着')+'</b><div class="precard-race-meta">'+esc(x.surface)+' '+value(x.distance,'m')+' / 時計 '+value(x.time)+'<br>通過 '+value(x.cornerPositions)+' / 上がり3F '+value(x.last3f,'秒')+'</div><small>'+esc(source.supplemented?'通過順・上がり等に補完データを含む（JRA未照合）':'保存済み成績')+'</small><div class="precard-race-meta">'+source.links.map(l=>'<a href="'+esc(l.url)+'" target="_blank" rel="noopener noreferrer">'+esc(l.label)+'</a>').join(' · ')+'</div></div>';}).join('')+'</details>':'<p>履歴未取得・比較保留</p>')+'</article>';
  }).join('')+'<div class="labo-pool"><h4>全馬の参考評価（印は点数に使いません）</h4><div class="row pool-controls"><button type="button" data-pool-action="name" aria-pressed="'+(poolOrder==='name')+'">馬名順</button><button type="button" data-pool-action="rank" aria-pressed="'+(poolOrder==='rank')+'">参考順位順</button><button type="button" data-pool-action="marked" aria-pressed="'+poolOnlyMarked+'">印のある馬だけ</button><span>'+visible.length+'/'+rows.length+'頭を表示</span></div><div class="labo-pool-list" role="list">'+visible.map(r=>'<article class="labo-pool-card" role="listitem"><h5>'+esc(selected.get(r.horseName)||'')+' '+esc(r.horseName)+'</h5><dl class="labo-pool-stats"><div><dt>参考順位</dt><dd>'+value(r.referenceRank,'位')+(r.tiedCount>1?'（同点'+r.tiedCount+'頭）':'')+'</dd></div><div><dt>参考指数</dt><dd>'+value(r.assessment?.evidenceScore)+'</dd></div><div><dt>過去走</dt><dd>'+value(r.assessment?.historyRows,'走')+'</dd></div></dl><details class="labo-evidence"><summary>適性の根拠・不足を見る</summary><ul>'+runnerEvidenceLines(r.assessment).map(line=>'<li>'+esc(line)+'</li>').join('')+'</ul></details></article>').join('')+'</div></div>';
  identity.textContent=label()+' / 保存済みDBから比較。枠・馬番は正式出馬表で確認します。';
 }
 out.addEventListener('click',e=>{const button=e.target.closest?.('button[data-pool-action]');if(!button||!lastRendered)return;const action=button.dataset.poolAction;if(action==='marked')poolOnlyMarked=!poolOnlyMarked;else poolOrder=action;render(lastRendered.d,lastRendered.human);out.querySelector('[data-pool-action="'+action+'"]')?.focus({preventScroll:true});});
 async function compare(force=false){
  if(!initial()){if(!force)return;if(phaseInlineAvailable(phaseInput.value,rosterVerified,roster.length))await auditOfficialInline();else await window.auditOfficialMarks?.();return;}
  const t=window.getLaboTarget?.(),human=marks();if(!t){out.textContent='対象レースを取得中です。';return;}
  if(!human.length){out.textContent='想定表で初期印を選ぶと、自動で仮比較します。';return;}
  if(running){queued=true;return;}
  const n=++generation,k=key(t),track=document.getElementById('markTrack').value;
  const ck=JSON.stringify([k,track,human]);if(!force&&cache&&cacheKey===ck&&Date.now()-cachedAt<60000){render(cache,human);return;}
  running=true;out.textContent='保存済みDBを比較中…';
  try{
   const body={date:t.date,venue:t.venue,raceNo:Number(t.raceNo),phase:'initial',marks:human};if(track)body.track=track;
   const response=await fetch(auditApi+'/v1/lab/mark-comparison',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await response.json();
   if(n!==generation||k!==key(window.getLaboTarget?.())||!initial()||JSON.stringify(marks())!==JSON.stringify(human))return;
   if(!response.ok||!d.ok)throw Error(d.error||'比較を取得できませんでした。');
   cache=d;cacheKey=ck;cachedAt=Date.now();publishAuditCards(d);render(d,human);
  }catch(e){if(n===generation)out.textContent='仮比較を保留：'+e.message;}
  finally{running=false;if(queued){queued=false;schedule();}}
 }
 let officialAuditBusy=false;
 async function auditOfficialInline(){
 if(officialAuditBusy)return;
 const t=window.getLaboTarget?.(),phase=phaseInput.value,track=trackInput.value,human=marks(),k=key(t);
 if(!t||!rosterVerified){out.textContent='JRA番号付き出馬表の照合待ちです。初期印だけ準備できます。';return;}
 if(!human.length){out.textContent='出馬表の馬名の横で印を付けてください。';return;}
 if(phase==='final'&&!track){out.textContent='最終印のDB再精査には馬場想定を指定してください。';return;}
 officialAuditBusy=true;
 const action=document.querySelector('#marks button[onclick="auditMarks()"]');
 const oldLabel=action?.textContent;
 if(action){action.disabled=true;action.textContent='DB照合中…';}
 out.textContent='JRA出馬表とDBの印監査を確認中…（保存済み評価の読み込みには時間がかかることがあります）';
 try{
  const body={date:t.date,venue:t.venue,raceNo:Number(t.raceNo),phase,marks:human};if(track)body.track=track;
  const response=await fetch(auditApi+'/v1/lab/user-mark-audit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await response.json();
  if(k!==key(window.getLaboTarget?.())||phase!==phaseInput.value||JSON.stringify(human)!==JSON.stringify(marks()))return;
  publishAuditCards(d,{inline:true});
 }catch(e){if(k===key(window.getLaboTarget?.())&&phase===phaseInput.value&&JSON.stringify(human)===JSON.stringify(marks())){const message='印のDB監査に接続できませんでした。出馬表の保存状態とは別の通信エラーです。接続を確認し、少し待って再精査してください。';publishAuditCards({ok:false,error:message,race:{raceName:t.raceName},phase},{inline:true});}}
 finally{officialAuditBusy=false;if(action){action.disabled=false;action.textContent=oldLabel;}}
}
 function schedule(){
  syncDraftContext();showMode();saveInline();saveDraft();showDraft();inputNames();generation++;clearTimeout(timer);
  window.dispatchEvent(new Event('labo-marks-changed'));
  if(!initial()){
   out.textContent='印の変更をブラウザに下書き保存しました。正式なDB照合は「DBで再精査」を押したときに実行します。';
   if(auditReport)auditReport.textContent='印が変更されました。以前の監査結果は最新ではありません。DBで再精査してください。';
   return;
  }
  timer=setTimeout(()=>compare(),650);
 }
 window.auditMarks=()=>compare(true);refresh.addEventListener('click',()=>compare(true));
 document.getElementById('marks').addEventListener('input',schedule);document.getElementById('marks').addEventListener('change',schedule);
 phaseInput.addEventListener('change',()=>{syncDraftContext();applyInlinePhaseValues();showMode();showDraft();refreshPhaseGate();});
 document.getElementById('marks').addEventListener('click',e=>{if(e.target.closest('.markrow')||e.target.textContent.includes('印を追加'))queueMicrotask(schedule);});
 async function targetChanged(){const t=window.getLaboTarget?.(),k=key(t);if(rosterKey&&rosterKey!==k&&phaseInput.value!=='initial'){saveDraft();phaseInput.value='initial';}syncDraftContext();showDraft();refreshPhaseGate();if(k&&k===rosterKey&&roster.length){identity.textContent=label();loadHistoryCoverage(t,k);return;}generation++;cache=null;const seq=++rosterSequence;roster=[];rosterNumbers={};rosterVerified=false;rosterKey=k;names.innerHTML='';rosterBox.innerHTML='<p class="expected-inline-note">保存済みの想定表を読み込み中…</p>';showMode();out.textContent='対象レースを切り替えました。初期印を付けて比較してください。';document.getElementById('auditResult').textContent='対象を切替済み。このレースの監査はまだ実行していません。';if(auditReport)auditReport.textContent='対象レースを切り替えました。印タブでDB再精査を実行してください。';if(betRows)betRows.replaceChildren();if(betSummary)betSummary.textContent='対象レースを切替済み。印を確認して買い目を組み直してください。';identity.textContent=label();if(!t)return;try{const [nr,gr]=await Promise.all([fetch(api+'/api/jra/runners?race_key='+encodeURIComponent(t.date+':'+t.venue+':'+t.raceNo)),fetch(api+'/v1/lab/race-ops?date='+encodeURIComponent(t.date)+'&venue='+encodeURIComponent(t.venue)+'&race_no='+encodeURIComponent(t.raceNo))]);const db=nr.ok?await nr.json():{},gate=gr.ok?await gr.json():{},verified=verifiedOfficialRoster(db.data,gate);if(seq!==rosterSequence||k!==key(window.getLaboTarget?.()))return;if(verified){names.innerHTML=verified.runners.map(x=>'<option value="'+esc(x.horseName)+'"></option>').join('');drawRoster(verified);loadHistoryCoverage(t,k);return;}}catch{}try{const r=await fetch(api+'/v1/lab/expected-runners?date='+encodeURIComponent(t.date)+'&venue='+encodeURIComponent(t.venue)+'&race_no='+t.raceNo),d=await r.json();if(seq!==rosterSequence||k!==key(window.getLaboTarget?.()))return;if(!r.ok||!d.ok||!Array.isArray(d.runners)||!d.runners.length)throw Error(d.error||'想定表は未保存です。');names.innerHTML=d.runners.map(x=>'<option value="'+esc(x.horseName)+'"></option>').join('');drawRoster(d);loadHistoryCoverage(t,k);}catch(e){if(seq===rosterSequence){try{const fallback=await fetch(api+'/v1/lab/supplemental-card?date='+encodeURIComponent(t.date)+'&venue='+encodeURIComponent(t.venue)+'&race_no='+t.raceNo),fd=await fallback.json();if(fallback.ok&&fd.ok&&Array.isArray(fd.card?.runners)&&fd.card.runners.length){drawRoster({source:{snapshotId:'supplemental:'+String(fd.card.checkedAt||'')},runners:fd.card.runners});loadHistoryCoverage(t,k);return;}}catch{} rosterBox.innerHTML='<p class="expected-inline-note">馬名一覧を取得できません：'+esc(e.message)+'。対象レースを再読み込みしてください。</p>';showMode();}} }
 const WAGER_TYPES=${JSON.stringify(WAGER_TYPES)};
 const ticketMethodOptions=${ticketMethodOptions.toString()};
 const groupLabels=${groupLabels.toString()};
 const generateFormationTickets=${generateFormationTickets.toString()};
 const validateTicketStake=${validateTicketStake.toString()};
 const calculateTicketSlip=${calculateTicketSlip.toString()};
 const mountTicketBuilder=${mountTicketBuilder.toString()};
 const renderTicketSelectionMatrix=${renderTicketSelectionMatrix.toString()};
 mountTicketBuilder({document,window,api,getRace:()=>window.getLaboTarget?.(),getMarks:()=>marks(),verifyRoster:verifiedOfficialRoster,WAGER_TYPES,ticketMethodOptions,groupLabels,generateFormationTickets,validateTicketStake,calculateTicketSlip,renderTicketSelectionMatrix});
 window.addEventListener('labo-target-change',targetChanged);targetChanged();
 mountWorkoutEvidence({document,window,api,render:renderWorkoutEvidence,reference:netkeibaWorkoutReference});
 mountWorkoutImpressions({document,window,api,getRoster:getOfficialWorkoutRoster});
})();
</script>`;
export default{async fetch(request,env,ctx){
 if(new URL(request.url).pathname==='/health')return Response.json({ok:true,service:'keiba-lab-app',version:VERSION,features:['touch-friendly-global-styles','precard-mark-db-preview','ireland-default-target','full-runner-initial-comparison','no-source-fetch-on-mark-change','expected-roster-inline-marks','browser-local-initial-marks','vertical-runner-comparison-cards','phase-draft-carryover','formal-card-gate-visible','expected-history-coverage-visible','learning-readiness-visible','separate-system-information-view','verified-jra-roster-number-overlay','budget-safe-allocation','formation-ticket-builder-8-types','readable-mark-audit-cards','same-origin-mark-audit-proxy','six-tab-mobile-nav','single-roster-bet-matrix','manual-official-audit','workout-provenance-status','netkeiba-workout-reference-links','one-tap-workout-impressions','fixed-six-sibling-mobile-nav','saudi-rc-selectable','official-marks-inline-all-phases']},{headers:{'cache-control':'no-store'}});
 const r=await app.fetch(request,env,ctx);if(!r.ok||!r.headers.get('content-type')?.includes('text/html'))return r;
 let html=await r.text();
 html=html.replace(/<section id="home" class="active">([\s\S]*?)<\/section>/,(_,content)=>'<section id="home" class="active"><div class="section-title">対象レース</div><div class="card"><h2 id="homeRaceTitle" class="section-title">対象レースを確認中</h2><p class="notice"><b>不足・未完了：</b><span id="homeRaceMissing">確認中…</span></p><p><b>次にすること：</b><span id="homeRaceNext"></span></p><button type="button" class="btn" id="homeRaceAction" data-home-view="race" disabled>次の操作へ</button></div><div class="card"><h2 class="section-title">現在は予想の判断補助</h2><p>過去走を使った参考比較ができます。予想精度はまだ検証できていません。</p><details><summary>評価できていない材料</summary><p>脚質・展開への適合と追い切りは参考指数に未反映です。未取得の馬場・通過順などは各馬の不足情報で確認できます。</p></details></div><div class="section-title">今週の重賞を選ぶ</div><div class="card"><div class="controls" id="raceQuickPick"><button type="button" class="btn secondary" data-race-date="2026-10-10">サウジアラビアRC（10/10）</button><button type="button" class="btn secondary" data-race-date="2026-10-11">アイルランドT（10/11）</button></div><p class="notice">レースを切り替えると馬名一覧と印の下書きも切り替わります。公式枠番は保存監査を通った場合のみ正式表示します。</p></div><div class="section-title">比較して予想を組み立てる</div><div class="card"><div class="controls"><button type="button" class="btn" data-home-view="marks">初期印・DB比較</button><button type="button" class="btn secondary" data-home-view="race">対象レース・馬場</button><button type="button" class="btn secondary" data-home-view="history">履歴・回顧</button></div></div><div class="section-title">学習データの蓄積</div><div class="card"><p id="homeLearning" role="status" class="notice">保存済みの学習データを確認中…</p><p id="homeValidation" class="notice">検証状況を確認中…</p><p id="homeCollection" class="notice"></p><p id="homeLearningUpdated" class="expected-inline-note"></p><div class="controls"><button type="button" class="btn secondary" id="refreshHomeLearning">学習状況を更新</button><a href="https://keiba-lab-api.sekai-no-bancyou.workers.dev/lab/work-progress" target="_blank" rel="noopener">補完待ち・詳しい進捗</a></div></div></section><section id="system" aria-labelledby="systemTitle"><div class="controls"><button type="button" class="btn secondary" id="closeSystem">ホームへ戻る</button></div><h2 id="systemTitle" tabindex="-1" class="section-title">システム情報</h2>'+content+'</section>');
 html=html.replace('</header>','<div class="controls"><button type="button" class="btn secondary" id="goHome">ホーム</button><button type="button" class="btn secondary" id="openSystem" aria-controls="system" aria-expanded="false">システム情報</button></div></header>');
 const bets=String.raw`<section id="bets">
 <div class="card">
  <div class="tb-head"><h2>買い目構築</h2><span class="pill">BOX・流し・フォーメーション・マルチ</span></div>
  <p class="notice" id="ticketRaceTitle">対象レースの確認中</p>
  <div id="ticketGate" class="tb-status">JRA出馬表を確認中</div>
  <p class="tb-note">券種と買い方を選び、馬番をタップ。勝負フォメ・保険マルチなどを個別に組み、予算内で追加できます。netkeibaの操作方式を参考にしたLABO独自画面です。</p>
  <div class="tb-fields">
   <label>券種<select id="ticketType"><option>単勝</option><option>複勝</option><option>枠連</option><option>馬連</option><option>馬単</option><option>ワイド</option><option>三連複</option><option selected>三連単</option></select></label>
   <label>買い方<select id="ticketMethod"><option value="formation">フォーメーション</option></select></label>
   <label>買い目の分類<select id="ticketCategory"><option>勝負</option><option>保険</option></select></label>
   <label>1点の金額（円）<input id="ticketUnit" type="number" min="100" step="100" inputmode="numeric" value="100"></label>
  </div>
  <div class="tb-options">
   <label id="ticketMultiHolder" hidden><input type="checkbox" id="ticketMulti"> マルチ（着順を入替）</label>
   <label id="ticketAxisHolder" hidden>軸の着順<select id="ticketAxisPosition"><option value="1">1着固定</option></select></label>
  </div>
  <div class="tb-actions"><button class="btn secondary" type="button" id="ticketFromMarks">印から候補をセット</button><button class="btn secondary" type="button" id="ticketResetGroups">馬の選択を解除</button></div>
  <div class="tb-groups" id="ticketGroups"></div>
  <div id="ticketPreview" class="tb-preview">馬番を選択してください。</div>
  <div class="tb-actions"><button class="btn" type="button" id="ticketAdd" disabled>この買い目を追加</button></div>
  <p id="ticketNotice" class="tb-note" role="status"></p>
 </div>
 <div class="card">
  <h3>買い目リスト（勝負・保険）</h3>
  <div class="tb-fields"><label>合計予算（円）<input id="ticketBudget" type="number" min="100" step="100" inputmode="numeric" value="3000"></label></div>
  <div class="tb-summary" id="ticketSlipSummary">0点 · 0円</div>
  <div id="ticketSlipItems"></div>
  <div class="tb-actions"><button class="btn" id="ticketCopy" type="button" disabled>買い目をコピー</button><button class="btn secondary" id="ticketClearSlip" type="button" disabled>リストを空にする</button></div><textarea id="ticketExportText" hidden readonly rows="8" class="tb-export" aria-label="手動でコピーする買い目"></textarea>
  <p class="tb-note">購入前の検討・記録用です。馬券購入や即PAT／IPAT連携は行いません。単勝オッズ・払戻金は計算に含めません。</p>
 </div>
</section>`;
 const workoutPanel='<div class="section-title">追い切り・調教タイム</div><div class="card workout-preview"><p class="notice">追い切りデータを出走馬と照合して表示します。ソース未連携なら未取得と表示し、タイムを推測しません。</p><p><a id="workoutReferenceLink" class="workout-source-link" href="#" target="_blank" rel="noopener noreferrer" hidden>netkeibaの追い切りを見る</a></p><p class="notice">外部サイトでの閲覧用です。LABOへの自動取得・予想点への反映ではありません。</p><div id="workoutStatus" aria-live="polite">確認中…</div><div class="controls"><button id="workoutRefresh" type="button" class="btn secondary">追い切り状態を再確認</button></div><div id="workoutDetails" class="notice">保存済みDBの照合待ち</div><div class="workout-impression-card" id="workoutImpressionCard"><h3>追い切り所感を記録（ワンタップ）</h3><p class="notice">netkeibaで追い切りを見ながら、自分の印象を残せます。時計・短評の転載はせず、LABOスコアは変更しません。</p><p id="workoutImpressionStatus" class="notice" role="status">出馬表照合中…</p><p id="workoutImpressionSummary" class="notice">未記録</p><div id="workoutImpressionList"></div><button type="button" class="btn secondary" id="workoutImpressionCopy" disabled>所感をコピー</button><textarea id="workoutImpressionExport" hidden readonly rows="8" aria-label="追い切りの所感をコピーする"></textarea></div></div>';
 html=html.replace(/(<section id="race">[\s\S]*?)(<\/section>)/,(_,open,close)=>open+workoutPanel+close);
 html=html.replace(/(<section id="marks">[\s\S]*?)(<\/section>)/,(_,open,close)=>open+'<div class="card workout-preview" id="workoutMarksStatus">追い切りの保存状態を確認中…</div><p class="workout-source-row"><a id="workoutMarksReferenceLink" class="workout-source-link" href="#" target="_blank" rel="noopener noreferrer" hidden>netkeibaの追い切りを見る</a></p>'+close);
 html=html.replace('<section id="ops">',bets+'<section id="ops"><div class="section-title">印とLABOの再精査</div><div class="card" id="laboAuditReport" aria-live="polite">印タブでDB再精査を実行すると、印・LABO順位・不足データ・見逃し候補を表示します。</div>');
 // Replace the complete original five-tab navigation, including its history tab.
 // Never append a new tab before </div></div>: that accidentally nests it inside the 監査 tab.
 const navStart=html.indexOf('<div class="nav"><div class="navin">');
 const navEnd=html.indexOf('</div></div></div>',navStart);
 if(navStart<0||navEnd<navStart)throw new Error('Navigation structure not found; refused an unsafe partial replacement');
 const navMarkup='<div class="nav"><div class="navin" role="navigation" aria-label="主要メニュー">'+
  '<div class="tab active" data-id="home"><b>⌂</b>ホーム</div>'+
  '<div class="tab" data-id="race"><b>♞</b>レース</div>'+
  '<div class="tab" data-id="history"><b>↶</b>履歴</div>'+
  '<div class="tab" data-id="marks"><b>◎</b>印</div>'+
  '<div class="tab" data-id="ops"><b>✓</b>監査</div>'+
  '<div class="tab" data-id="bets"><b>￥</b>買い目</div>'+
  '</div></div>';
 html=html.slice(0,navStart)+navMarkup+html.slice(navEnd+'</div></div></div>'.length);
 return new Response(html.replace('<div class="k">サウジRC</div>','<div class="k">アイルランドT</div>').replace('</body>',enhancement+'</body>'),{status:r.status,headers:r.headers});
}};
