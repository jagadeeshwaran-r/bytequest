// The existing Java bridge is byte-for-byte reused by the Angular guest preview.
// No private cases, auth credentials, production cloud state or database writes.
import {copyFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function prepareAngularRuntime(){
 const out=join(root,'angular/public/java-runtime');
 await mkdir(out,{recursive:true});
 for(const file of ['judge.js','runner-core.js','java-runner.jar']){
  await copyFile(join(root,'dist',file),join(out,file));
 }
 await writeFile(join(out,'runner.html'),
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>ByteQuest Angular guest Java sandbox</title></head>'
  +'<body><script type="module" src="./runner-core.js"></script></body></html>','utf8');
 return out;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const dir=await prepareAngularRuntime();
 console.log('Prepared ByteQuest guest Java 17 runtime in '+dir);
}
