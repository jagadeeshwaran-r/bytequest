// Read the canonical bundled public catalog and emit a minimal preview snapshot.
// Deliberately exclude reference solutions, private tests, auth or progress data.
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {dirname, resolve, join} from 'node:path';
import {problems} from '../dist/problems.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function publicCatalog(source=problems) {
  if(!Array.isArray(source))throw new TypeError('Expected published problems');
  const used=new Set();
  return source.map(p=>{
    if(!p||typeof p.id!=='string'||!/^[a-z][a-z0-9-]{1,63}$/.test(p.id)||used.has(p.id))throw new Error('Invalid/duplicate problem ID');
    used.add(p.id);
    return {
      id:p.id, title:String(p.title), difficulty:String(p.difficulty),
      companies:Array.isArray(p.companies)?p.companies.filter(name=>typeof name==='string').slice(0,8):[],
      revision:Number.isSafeInteger(p.revision)&&p.revision>0?p.revision:null,
      hiddenCount:Number.isSafeInteger(p.hiddenCount)&&p.hiddenCount>=0?p.hiddenCount:0,
      topic:String(p.topic), description:String(p.description), constraints:String(p.constraints||''),
      starter:String(p.starter||''), method:String(p.method||''),
      params:Array.isArray(p.params)?p.params.map(param=>({name:String(param.name),type:String(param.type)})):[],
      returns:String(p.returns||'void'),normalize:String(p.normalize||''),
      tests:(Array.isArray(p.tests)?p.tests:[]).map(t=>({args:t.args,expected:t.expected,label:String(t.label||'')})),
      examples:(Array.isArray(p.tests)?p.tests:[]).slice(0,2).map(t=>({
        args:t.args,expected:t.expected,label:String(t.label||'')
      }))
    };
  });
}

export async function writeCatalog(outFile=join(root,'angular','public','catalog.json')){
  const data=publicCatalog();
  await mkdir(dirname(outFile),{recursive:true});
  await writeFile(outFile,JSON.stringify(data,null,2)+'\n','utf8');
  return data.length;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const count=await writeCatalog();
  console.log('ByteQuest Angular preview catalog: '+count+' published starter problems exported.');
}
