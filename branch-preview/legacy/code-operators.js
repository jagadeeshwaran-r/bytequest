const operators=new Map([['≠','!='],['≤','<='],['≥','>='],['≡','=='],['⩵','=='],['＝','='],['＜','<'],['＞','>'],['！','!']]);

// Only executable text is repaired. Quoted values and comments remain literal.
export function comparisonEdit(value,start=value.length,end=start,language='java'){
 const edits=[],python=language==='python',native=language==='c'||language==='cpp';
 let i=0;
 while(i<value.length){
  const c=value[i];
  if(python&&c==='#'||!python&&value.startsWith('//',i)){
   let next=value.indexOf('\n',i);
   while(native&&next>=0&&value[next-(value[next-1]==='\r'?2:1)]==='\\')next=value.indexOf('\n',next+1);
   i=next<0?value.length:next+1;continue;
  }
  if(!python&&value.startsWith('/*',i)){const next=value.indexOf('*/',i+2);i=next<0?value.length:next+2;continue;}
  if(language==='cpp'&&value.startsWith('R"',i)){
   const raw=value.slice(i,i+20).match(/^R"([^ ()\\\t\r\n]{0,16})\(/);
   if(raw){const close=')'+raw[1]+'"',next=value.indexOf(close,i+raw[0].length);i=next<0?value.length:next+close.length;continue;}
  }
  if(c==='"'||c==="'"){
   // Apostrophes separating C++ numeric digits are not character literals.
   const token=native&&c==="'"?(value.slice(Math.max(0,i-128),i).match(/[A-Za-z0-9_.']+$/)?.[0]||''):'';
   if(/^[0-9]/.test(token)&&/[0-9a-fA-F]/.test(value[i-1]||'')&&/[0-9a-fA-F]/.test(value[i+1]||'')){i++;continue;}
   const triple=(python||language==='java')&&value.startsWith(c.repeat(3),i),quote=triple?c.repeat(3):c;
   i+=quote.length;
   while(i<value.length){if(value[i]==='\\'){i+=2;continue;}if(value.startsWith(quote,i)){i+=quote.length;break;}i++;}
   continue;
  }
  const text=operators.get(c);if(text)edits.push({at:i,text});i++;
 }
 if(!edits.length)return{value,start,end,count:0};
 let out='',previous=0;for(const edit of edits){out+=value.slice(previous,edit.at)+edit.text;previous=edit.at+1;}out+=value.slice(previous);
 const position=offset=>offset+edits.filter(e=>e.at<offset).reduce((sum,e)=>sum+e.text.length-1,0);
 return{value:out,start:position(start),end:position(end),count:edits.length};
}
