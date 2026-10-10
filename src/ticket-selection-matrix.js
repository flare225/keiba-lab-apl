/** Render one vertical list of official horses, with one selectable column per formation group.
 * Avoid repeating the whole runner card for each group on narrow phone screens.
 * The renderer never invents official frame/horse numbers and never modifies a selection.
 */
export function renderTicketSelectionMatrix({runners=[],groups=[],labels=[],marks=new Map(),ready=false}={}){
 const escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const count=labels.length;
 const widths='minmax(0,1fr) repeat('+count+', minmax(40px,52px))';
 if(!count)return'<p class="notice">買い方を選択してください。</p>';
 const heading='<div class="tb-matrix-row tb-matrix-header" style="grid-template-columns:'+widths+'"><span>枠・馬番 / 馬名</span>'+labels.map((x,i)=>'<span data-group-heading="'+i+'"><b>'+escapeHtml(x)+'</b><small data-group-count="'+i+'">'+(groups[i]?.length||0)+'頭</small></span>').join('')+'</div>';
 if(!runners.length)return heading+'<p class="notice">正式出馬表が保存・照合されるまで馬番を選べません。</p>';
 const rows=runners.map(r=>{
  const frame=Number.isInteger(r.frameNo)?r.frameNo:null,no=Number.isInteger(r.horseNo)?r.horseNo:null;
  const mark=marks.get(no);
  const label=escapeHtml(r.horseName||'馬名未確認');
  const badge=(frame===null||no===null)?'馬番未確認':escapeHtml(frame)+'枠 '+escapeHtml(no)+'番';
  const buttons=labels.map((group,i)=>{
   const selected=(groups[i]||[]).includes(no);
   return '<button type="button" class="tb-matrix-pick'+(selected?' selected':'')+'" data-group="'+i+'" data-no="'+escapeHtml(no)+'" aria-label="'+label+'：'+escapeHtml(group)+'を'+(selected?'解除':'選択')+'" aria-pressed="'+selected+'"'+(!ready?' disabled':'')+'>'+(selected?'✓':'＋')+'</button>';
  }).join('');
  return '<div class="tb-matrix-row" style="grid-template-columns:'+widths+'"><div class="tb-matrix-horse"><b>'+badge+'</b><span>'+label+'</span>'+(mark?'<small>'+escapeHtml(mark)+'</small>':'')+'</div>'+buttons+'</div>';
 }).join('');
 return '<div class="tb-matrix" role="group" aria-label="着順・組別の馬番選択">'+heading+rows+'</div>';
}
