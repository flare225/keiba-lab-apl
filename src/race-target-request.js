export function raceTargetRequest(window,document){
 const t=window.getLaboTarget?.();if(!t)return null;
 const no=Number(t.raceNo);if(!/^\d{4}-\d{2}-\d{2}$/.test(t.date||'')||!Number.isInteger(no)||no<1||no>12||!t.venue)return null;
 const params=new URLSearchParams({date:t.date,venue:t.venue,race_no:String(no)}),track=document.getElementById('track')?.value||'';if(track)params.set('track',track);
 return{key:t.date+':'+t.venue+':'+no,query:'?'+params,title:t.date+' '+t.venue+no+'R'};
}
export function sameRaceTarget(window,request){const t=window.getLaboTarget?.();return!!t&&request.key===t.date+':'+t.venue+':'+Number(t.raceNo);}
