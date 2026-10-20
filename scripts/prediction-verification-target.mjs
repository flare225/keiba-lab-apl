// Target selection is configuration, never a race-specific branch in verification.
export function predictionVerificationTarget(raw){
 let t;try{t=JSON.parse(raw||'');}catch{throw Error('LABO_VERIFICATION_TARGET must contain a JSON date/venue/raceNo target.');}
 const venues=['札幌','函館','福島','新潟','東京','中山','中京','京都','阪神','小倉'];
 if(!t||!/^20\d{2}-\d{2}-\d{2}$/.test(t.date||'')||!Number.isFinite(Date.parse(t.date+'T00:00:00Z'))||new Date(t.date+'T00:00:00Z').toISOString().slice(0,10)!==t.date||!venues.includes(t.venue)||!Number.isInteger(t.raceNo)||t.raceNo<1||t.raceNo>12)throw Error('Invalid JRA verification target.');
 return{date:t.date,venue:t.venue,raceNo:t.raceNo};
}
export const predictionTargetLabel=t=>`${t.date} ${t.venue}${t.raceNo}R`;
