// Display-only topic navigation for arbitrarily large published catalogs.
// Counts are calculated upstream from distinct published problem IDs.
export function topicCoverageSummary(rows=[]){
 const topics=rows.length;
 const practiced=rows.filter(row=>row.solved>0).length;
 const completed=rows.filter(row=>row.total>0&&row.solved>=row.total).length;
 return {
  topics,practiced,completed,
  solved:rows.reduce((sum,row)=>sum+Math.min(Math.max(0,row.solved),row.total),0),
  total:rows.reduce((sum,row)=>sum+Math.max(0,row.total),0)
 };
}
export function topicExplorerPage(rows=[],{
 query='',status='all',page=0,pageSize=10
}={}){
 const search=String(query||'').trim().toLocaleLowerCase();
 const selected=['all','active','completed','unstarted'].includes(status)?status:'all';
 const matching=rows.filter(row=>{
  if(search&&!String(row.name||'').toLocaleLowerCase().includes(search))return false;
  if(selected==='active')return row.solved>0&&row.solved<row.total;
  if(selected==='completed')return row.total>0&&row.solved>=row.total;
  if(selected==='unstarted')return row.solved===0;
  return true;
 });
 const size=Math.min(20,Math.max(1,Number.isInteger(pageSize)?pageSize:10));
 const pages=Math.max(1,Math.ceil(matching.length/size));
 const current=Math.max(0,Math.min(pages-1,Math.floor(Number(page)||0)));
 return {items:matching.slice(current*size,(current+1)*size),
  count:matching.length,page:current,pages,pageSize:size};
}
