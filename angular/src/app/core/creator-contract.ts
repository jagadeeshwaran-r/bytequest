export interface Case{args:readonly unknown[];expected:unknown;label?:string}
export interface JavaCreatorDraft{
 id:string;title:string;topic:string;difficulty:'Easy'|'Medium'|'Hard';
 method:string;returns:string;params:{name:string;type:string}[];
 description:string;constraints:string;starter:string;reference:string;
 tests:Case[];hiddenTests:Case[];
 idea:string;invariant:string;hints:string[];
 complexity:{time:string;space:string;tradeoff:string};
 position:number;revision:number;published:boolean;correction:string;
}
export const sampleCreatorDraft:JavaCreatorDraft={
 id:'array-sum',title:'Array sum',topic:'Arrays',difficulty:'Easy',
 method:'sum',returns:'int',params:[{name:'nums',type:'int[]'}],
 description:'Return the sum of all integers in nums.',
 constraints:'0 <= nums.length <= 10000.',
 starter:'class Solution {\n public int sum(int[] nums) {\n  throw new UnsupportedOperationException("Your turn");\n }\n}',
 reference:'class Solution {\n public int sum(int[] nums) {\n  int total=0;for(int n:nums)total+=n;return total;\n }\n}',
 tests:[{args:[[1,2,3]],expected:6,label:'Small sum'},{args:[[]],expected:0,label:'Empty array'}],
 hiddenTests:[{args:[[-2,2]],expected:0,label:'Mixed signs'}],
 idea:'Keep a running total.',invariant:'The total equals the sum of the visited prefix.',
 hints:['Start at zero.'],complexity:{time:'O(n)',space:'O(1)',tradeoff:'No extra storage.'},
 position:0,revision:0,published:false,correction:''
};
export function draftFromRaw(value:unknown):JavaCreatorDraft{
 if(value===null||typeof value!=='object'||Array.isArray(value))throw new Error('Choose a problem draft.');
 const raw=value as Record<string,unknown>;
 const tests=Array.isArray(raw.tests)?raw.tests:undefined;
 const hidden=Array.isArray(raw.hiddenTests)?raw.hiddenTests:[];
 if(!tests||tests.length<2||tests.length>100||hidden.length>100)
   throw new Error('Include 2–100 public tests and up to 100 hidden tests.');
 for(const item of [...tests,...hidden]){
   if(!item||typeof item!=='object'||!Array.isArray(item.args)||!Object.hasOwn(item,'expected'))
     throw new Error('Each test must contain args and expected.');
 }
 if(JSON.stringify(hidden).length>250000)throw new Error('Hidden cases exceed the server limit.');
 const result={...raw,hiddenCount:hidden.length} as unknown as JavaCreatorDraft;
 if(!/^[a-z][a-z0-9-]{1,63}$/.test(result.id))throw new Error('Choose a lowercase problem ID.');
 if(!Number.isSafeInteger(result.revision)||result.revision<0
   ||!Number.isSafeInteger(result.position)||result.position<0||result.position>1000000)
    throw new Error('Invalid position or revision.');
 return result;
}
export function creatorWritePayload(draft:JavaCreatorDraft):Record<string,unknown>{
 const clean=draftFromRaw(draft);
 const {hiddenTests,position,revision,published,correction,...problem}=clean;
 if(published&&!problem.reference.trim())throw new Error('Publish requires a verified Java reference solution.');
 if(correction.length>1000)throw new Error('Correction note is too long.');
 return {published,position,revision,correction,problem,hiddenTests};
}
