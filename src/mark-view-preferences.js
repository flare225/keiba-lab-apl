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
