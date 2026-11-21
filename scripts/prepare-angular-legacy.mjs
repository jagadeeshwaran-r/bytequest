// Build-time bridge for pixel-exact legacy UI compatibility during Angular port.
// The canonical dist/ remains untouched. This bridge is NOT a native Angular rewrite.
import {cp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,resolve,join} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const from=join(root,'dist');
const defaultTarget=join(root,'angular/public/legacy');
const replaceOne=(s,oldValue,newValue,label)=>{
 const hits=s.split(oldValue).length-1;
 if(hits!==1)throw new Error('Cannot safely adapt '+label+': expected one match; got '+hits);
 return s.replace(oldValue,newValue);
};
export async function prepareAngularLegacy(target=defaultTarget){
 if(resolve(target)===resolve(from))throw new Error('Cannot write to production dist');
 await rm(target,{recursive:true,force:true});
 await mkdir(target,{recursive:true});
 await cp(from,target,{recursive:true});
 for(const page of ['index.html','studio.html']){
  const file=join(target,page);
  let html=await readFile(file,'utf8');
  html=replaceOne(html,
   '<select id="languageSelect" aria-label="Programming language"><option value="java">Java 17</option><option value="python">Python 3.11</option><option value="cpp">C++</option><option value="c">C</option></select>',
   '<select id="languageSelect" aria-label="Programming language"><option value="java">Java 17</option></select>',
   page+' Java-only selector');
  await writeFile(file,html,'utf8');
 }
 {
  const file=join(target,'app.js');
  let js=await readFile(file,'utf8');
  js=replaceOne(js,
   'let language="java";try{const v=localStorage.getItem("bytequest.language");if(languages[v])language=v;}catch{}',
   'let language="java";',
   'force Java on initial load');
  js=replaceOne(js,'function setLanguage(v){if(!languages[v])return;',
   'function setLanguage(v){if(v!=="java")return;',
   'Java-only language switching');
  js=replaceOne(js,
   'const nativeJudge=new NativeJudge(message=>{$("runStatus").textContent=message;},cloud);\nconst judge={run:(source,p,cases)=>language==="java"?javaJudge.run(source,p,cases):nativeJudge.run(source,p,cases,language),stop:()=>{javaJudge.stop();nativeJudge.stop();}};',
   'const judge={run:(source,p,cases)=>javaJudge.run(source,p,cases),stop:()=>javaJudge.stop()};',
   'Java-only judge entrypoint');
  await writeFile(file,js,'utf8');
 }
 await writeFile(join(target,'maintenance-gate.js'),"const allowed=Object.freeze({\n 'index.html':'./app.js','studio.html':'./studio-page.js',\n 'community.html':'./community.js','leaderboard.html':'./leaderboard.js',\n 'privacy.html':'./reference-motion.js','runner.html':'./runner-core.js',\n 'native-runner.html':'./native-runner-core.js'\n});\nconst page=location.pathname.split('/').pop()||'index.html';\nconst script=document.querySelector('script[data-bq-app]');\nconst entry=script?.getAttribute('data-bq-app')||'';\nconst expected=allowed[page];\nif(!expected||!entry.startsWith(expected+'?')){\n document.documentElement.removeAttribute('data-bq-maintenance-check');\n console.error('ByteQuest staging: invalid page entrypoint');\n}else{\n // Staging can't independently confirm production maintenance without backend\n // Origin authorization. Protected API requests remain server-enforced.\n document.documentElement.removeAttribute('data-bq-maintenance-check');\n void import(entry).catch(error=>{\n   console.error('ByteQuest staging application could not load',error);\n   const node=document.createElement('p');\n   node.role='alert';node.style.cssText='padding:24px;color:#ed9292;font:14px system-ui';\n   node.textContent='The staging application could not start. Reload this page.';\n   document.body.prepend(node);\n });\n}\n",'utf8');
 // Exclude non-Java browser compiler runner assets from the staging output.
 for(const file of ['native-runner.html','native-runner-core.js']){
  await rm(join(target,file),{force:true});
 }
 return target;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 console.log('Prepared ByteQuest UI compatibility assets: '+await prepareAngularLegacy());
}
