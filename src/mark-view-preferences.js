export const ACTIVE_RACE_STORAGE_KEY='keiba-labo:active-race:v1';
export const MARK_PHASES=['initial','post_draw','final'];
export const MARK_PHASE_STORAGE_PREFIX='keiba-labo:mark-phase:v1:';

export function findRememberedRaceIndex(races,serialized){
 if(!Array.isArray(races)||typeof serialized!=='string'||!serialized)return -1;
 try{
  const saved=JSON.parse(serialized);
  return races.findIndex(r=>r&&r.date===saved?.date&&r.venue===saved?.venue&&Number(r.raceNo)===Number(saved?.raceNo));
 }catch{return -1;}
}
export function serializeRacePreference(race){
 if(!race||typeof race.date!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(race.date)||
  typeof race.venue!=='string'||!race.venue||!Number.isInteger(Number(race.raceNo))||
  Number(race.raceNo)<1||Number(race.raceNo)>12)return null;
 return JSON.stringify({date:race.date,venue:race.venue,raceNo:Number(race.raceNo)});
}
export function markPhaseStorageKey(target){
 const saved=serializeRacePreference(target);if(!saved)return '';
 const race=JSON.parse(saved);
 return MARK_PHASE_STORAGE_PREFIX+race.date+'|'+race.venue+'|'+race.raceNo;
}
export function readRememberedMarkPhase(value){
 return MARK_PHASES.includes(value)?value:'initial';
}

export function orderRaceTargetsForToday(races,stamp=Date.now()){
 const today=new Date(stamp+9*3600000).toISOString().slice(0,10),group=r=>r.date===today?0:r.date>today?1:2;
 return [...races].sort((a,b)=>group(a)-group(b)||(group(a)===2?b.date.localeCompare(a.date):a.date.localeCompare(b.date))||a.venue.localeCompare(b.venue,'ja')||Number(a.raceNo)-Number(b.raceNo));
}
export function initialRaceTargetIndex(races,serialized,stamp=Date.now()){
 const today=new Date(stamp+9*3600000).toISOString().slice(0,10),remembered=findRememberedRaceIndex(races,serialized);
 if(remembered>=0&&races[remembered].date===today)return remembered;
 const main=races.findIndex(r=>r.date===today&&Number(r.raceNo)===11&&r.cardComplete);
 if(main>=0)return main;
 const first=races.findIndex(r=>r.date===today);if(first>=0)return first;
 if(remembered>=0&&races[remembered].date>today)return remembered;
 const upcoming=races.filter(r=>r.date>today).map(r=>r.date).sort()[0];
 if(upcoming){const main=races.findIndex(r=>r.date===upcoming&&Number(r.raceNo)===11);return main>=0?main:races.findIndex(r=>r.date===upcoming);}
 return remembered>=0?remembered:races.length?0:-1;
}
