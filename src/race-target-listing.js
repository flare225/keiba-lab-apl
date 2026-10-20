export const RACE_TARGET_LIST_CACHE_KEY='keiba-labo:race-target-list:v1';
// Program slots previously verified on 2026-10-20. No entrant/card/LOCK claims.
export const LAST_VERIFIED_WEEK_TARGETS=['2026-10-24','2026-10-25'].flatMap(date=>['東京','京都','新潟'].flatMap(venue=>Array.from({length:12},(_,i)=>({date,venue,raceNo:i+1}))));
export function resolveRaceTargetListing({liveRaces,readFailed=false,previousJson=null,from,to,now=Date.now(),fallback=[]}){
 const clean=input=>{const seen=new Set();return(Array.isArray(input)?input:[]).filter(r=>{
  if(!r||!/^20\d{2}-\d{2}-\d{2}$/.test(r.date||'')||!['札幌','函館','福島','新潟','東京','中山','中京','京都','阪神','小倉'].includes(r.venue)||!Number.isInteger(Number(r.raceNo))||Number(r.raceNo)<1||Number(r.raceNo)>12||r.date<from||r.date>to)return false;
  const stamp=Date.parse(r.date+'T00:00:00Z');if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==r.date)return false;
  const k=r.date+':'+r.venue+':'+Number(r.raceNo);if(seen.has(k))return false;seen.add(k);return true;
 }).map(r=>({date:r.date,venue:r.venue,raceNo:Number(r.raceNo),raceName:typeof r.raceName==='string'?r.raceName.slice(0,200):'',grade:typeof r.grade==='string'?r.grade.slice(0,30):'',cardComplete:r.cardComplete===true}));};
 if(!readFailed){const races=clean(liveRaces);return{races,basis:'live',message:'',cacheValue:JSON.stringify({schema:'race-target-list-v1',savedAt:new Date(now).toISOString(),races})};}
 let previous=null;try{previous=JSON.parse(previousJson)}catch{}
 const stamp=Date.parse(previous?.savedAt),age=now-stamp;
 const cached=previous?.schema==='race-target-list-v1'&&Number.isFinite(age)&&age>=0&&age<=7*86400000?clean(previous.races):[];
 const races=(cached.length?cached:clean(fallback)).map(r=>({...r,cardComplete:false,presetOnly:true,listingUnverified:true}));
 return{races,basis:cached.length?'last-successful-list':races.length?'previously-verified-program':'unavailable',message:races.length?'開催一覧を現在のDBから読み取れません。前回確認済みの一覧を表示しています。出馬表・保存状態は未照合です。':'開催一覧を読み取れません。レースが削除されたと判定したものではありません。',cacheValue:null};
}
