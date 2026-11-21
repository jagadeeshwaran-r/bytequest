// Bundle only compiled, public static preview assets so Vercel can be
// deployed without giving GitHub or Vercel production secrets to this workflow.
// The staging-manifest is NOT hosted as part of the site.
import {readdir,readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,join,relative,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const input=resolve(root,'branch-preview');
const output=resolve(root,'branch-manifest');
const maxBytes=465000;
const binary=/\.(?:jar|png|gif|jpe?g|webp|ico|woff2?|pdf)$/i;

async function filesAt(dir){
  const result=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const full=join(dir,entry.name);
    if(entry.isDirectory()) result.push(...await filesAt(full));
    else if(entry.isFile()) result.push(full);
    else throw new Error('Unexpected symlink or special file '+full);
  }
  return result.sort();
}
export async function packStaging(){
  if(input===output)throw Error('Invalid output path');
  await rm(output,{recursive:true,force:true});
  await mkdir(output,{recursive:true});
  const all=[];
  for(const full of await filesAt(input)){
    const name=relative(input,full).split('\\').join('/');
    if(!name||name.startsWith('../')||name.includes('/../'))throw Error('Unsafe path '+name);
    const bytes=await readFile(full);
    const encoding=binary.test(name)?'base64':'utf-8';
    all.push({file:name,encoding,data:bytes.toString(encoding)});
  }
  let chunk=[],len=0,parts=0;
  const flush=async()=>{
    if(!chunk.length)return;
    await writeFile(join(output,'part-'+String(parts++).padStart(3,'0')+'.json'),JSON.stringify({files:chunk})+'\n','utf8');
    chunk=[];len=0;
  };
  for(const file of all){
    const size=JSON.stringify(file).length+2;
    if(len&&len+size>maxBytes)await flush();
    chunk.push(file);len+=size;
  }
  await flush();
  await writeFile(join(output,'index.json'),JSON.stringify({parts,files:all.length,branch:'test/angular-migration'})+'\n');
  return {parts,files:all.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  console.log('Created public staging asset manifest',await packStaging());
}
