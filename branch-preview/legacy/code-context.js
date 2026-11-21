// Preserve offsets while hiding strings/comments from editor and C++ contract checks.
export function codeContext(source,language='java'){
 const out=source.split(''),python=language==='python',native=language==='cpp'||language==='c';let i=0,codeAtEnd=true;
 const blank=(start,end)=>{for(let at=start;at<end;at++)if(source[at]!=='\n'&&source[at]!=='\r')out[at]=' ';};
 while(i<source.length){
  const start=i,c=source[i];
  if(python&&c==='#'||!python&&source.startsWith('//',i)){
   let end=source.indexOf('\n',i);while(native&&end>=0&&source[end-(source[end-1]==='\r'?2:1)]==='\\')end=source.indexOf('\n',end+1);
   codeAtEnd=end>=0;i=end<0?source.length:end+1;blank(start,i);continue;
  }
  if(!python&&source.startsWith('/*',i)){const end=source.indexOf('*/',i+2);codeAtEnd=end>=0;i=end<0?source.length:end+2;blank(start,i);continue;}
  if(language==='cpp'&&source.startsWith('R"',i)){
   const raw=source.slice(i,i+20).match(/^R"([^ ()\\\t\r\n]{0,16})\(/);if(raw){const close=')'+raw[1]+'"',end=source.indexOf(close,i+raw[0].length);codeAtEnd=end>=0;i=end<0?source.length:end+close.length;blank(start,i);continue;}
  }
  if(c==='"'||c==="'"){
   const token=native&&c==="'"?(source.slice(Math.max(0,i-128),i).match(/[A-Za-z0-9_.']+$/)?.[0]||''):'';
   if(/^[0-9]/.test(token)&&/[0-9a-fA-F]/.test(source[i-1]||'')&&/[0-9a-fA-F]/.test(source[i+1]||'')){i++;continue;}
   const quote=(python||language==='java')&&source.startsWith(c.repeat(3),i)?c.repeat(3):c;i+=quote.length;codeAtEnd=false;
   while(i<source.length){if(source[i]==='\\'){i=Math.min(source.length,i+2);continue;}if(source.startsWith(quote,i)){i+=quote.length;codeAtEnd=true;break;}i++;}blank(start,i);continue;
  }
  codeAtEnd=true;i++;
 }
 return{mask:out.join(''),codeAtEnd};
}
