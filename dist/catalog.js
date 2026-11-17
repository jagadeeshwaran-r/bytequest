import {buildTests} from "./judge.js";
const types = new Set(["int","int[]","int[][]","boolean","String","ListNode","TreeNode"]);
const reserved = new Set("abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null record var yield".split(" "));
function safeIllustration(value) {
  if (value == null || value === "") return "";
  if (typeof value !== "string") throw new Error("Illustration URL must be text.");
  const src=value.trim();
  if(src.length>1000||!(/^(?:\.\/assets\/problem-illustrations\/[a-z0-9-]+\.svg)$/.test(src)||/^https:\/\/[^\s<>"']+$/.test(src))) throw new Error("Illustration must be an HTTPS URL or local problem-illustrations SVG.");
  return src;
}
function exampleExplanations(value){
  if(value==null)return [];
  if(!Array.isArray(value)||value.length>2||value.some(v=>typeof v!=="string"||v.length>2400))throw new Error("Provide up to two example explanations, each below 2400 characters.");
  return value.map(v=>v.trim());
}
export const problemId = /^[a-z][a-z0-9-]{1,63}$/;
const identifier = value => typeof value === "string" && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(value) && !reserved.has(value);
function text(value,name,max=10000){if(typeof value!=="string"||!value.trim()||value.length>max)throw new Error(name+" is required (up to "+max+" characters).");return value.trim();}
export function validateProblem(input) {
  if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Provide a problem object.");
  if(!problemId.test(input.id))throw new Error("Use a lowercase problem ID, for example array-sum.");
  if(!identifier(input.method))throw new Error("Use a valid Java method name.");
  if(!types.has(input.returns)||input.returns==="TreeNode")throw new Error("Return type must be int, int[], int[][], boolean, String, or ListNode. TreeNode is currently supported as an input only.");
  if(!Array.isArray(input.params)||input.params.length<1||input.params.length>6)throw new Error("Provide 1–6 Java parameters.");
  const names=new Set();
  const params=input.params.map(p=>{if(!identifier(p?.name)||!types.has(p?.type)||names.has(p.name))throw new Error("Each parameter needs a unique Java name and a supported type (including int[][], ListNode and TreeNode).");names.add(p.name);return{name:p.name,type:p.type};});
  if(!["Easy","Medium","Hard"].includes(input.difficulty))throw new Error("Choose Easy, Medium, or Hard.");
  if(!Array.isArray(input.tests)||input.tests.length<2||input.tests.length>100)throw new Error("Provide 2–100 test cases. The first two are examples.");
  const p={
    id:input.id,title:text(input.title,"Title",100),topic:text(input.topic,"Topic",60),
    pattern:typeof input.pattern==="string"&&input.pattern.trim()?text(input.pattern,"Pattern",60):text(input.topic,"Topic",60),
    techniques:(Array.isArray(input.techniques)?input.techniques:[]).slice(0,8).map(t=>text(t,"Technique",50)),
    companies:(Array.isArray(input.companies)?input.companies:[]).slice(0,8).map(c=>text(c,"Company",40)),
    companySource:typeof input.companySource==='string'&&/^https:\/\//.test(input.companySource)?input.companySource.slice(0,1000):'',
    inputGuide:typeof input.inputGuide==='string'?input.inputGuide.slice(0,3000):'',
    outputGuide:typeof input.outputGuide==='string'?input.outputGuide.slice(0,3000):'',
    illustration:safeIllustration(input.illustration),
    illustrationAlt:typeof input.illustrationAlt==='string'?input.illustrationAlt.slice(0,240):'',
    illustrationCaption:typeof input.illustrationCaption==='string'?input.illustrationCaption.slice(0,360):'',
    exampleExplanations:exampleExplanations(input.exampleExplanations),
    hiddenCount:Number.isInteger(input.hiddenCount)&&input.hiddenCount>=0&&input.hiddenCount<=100?input.hiddenCount:0,
    method:input.method,returns:input.returns,params,difficulty:input.difficulty,
    description:text(input.description,"Description",10000),constraints:text(input.constraints,"Constraints",5000),
    starter:text(input.starter,"Java starter",60000),reference:text(input.reference,"Reference solution",60000),
    idea:text(input.idea,"Pattern explanation",10000),invariant:text(input.invariant,"Invariant",5000),
    complexity:{time:text(input.complexity?.time,"Time complexity",100),space:text(input.complexity?.space,"Space complexity",100),tradeoff:text(input.complexity?.tradeoff,"Trade-off",3000)},
    hints:(Array.isArray(input.hints)?input.hints:[]).slice(0,8).map(h=>text(h,"Hint",2000)),
    minutes:Number.isInteger(input.minutes)&&input.minutes>=5&&input.minutes<=120?input.minutes:({Easy:20,Medium:30,Hard:45})[input.difficulty],
    tests:input.tests.map(c=>({args:c.args,expected:c.expected,label:typeof c.label==="string"?c.label.slice(0,160):"Practice case"})),
    trace:typeof input.trace==="string"?input.trace:"custom"
  };
  if(!p.hints.length)throw new Error("Add at least one hint.");
  if(input.normalize==="sort-int"&&p.returns==="int[]")p.normalize=input.normalize;
  if(input.normalize==="listnode-index"&&p.returns==="ListNode"&&p.params.length===1&&p.params[0].type==="ListNode")p.normalize=input.normalize;
  if(Array.isArray(input.frames)&&input.frames.length){
    if(input.frames.length>60)throw new Error("Keep animations to 60 steps.");
    p.frames=input.frames.map(f=>{
      if(!Array.isArray(f.values)||f.values.length>30||f.values.some(v=>!["string","number"].includes(typeof v)))throw new Error("Animation values must be short strings or numbers.");
      const indices=arr=>(Array.isArray(arr)?arr:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<f.values.length);
      return{values:f.values.map(v=>String(v).slice(0,18)),active:indices(f.active),found:indices(f.found),dim:indices(f.dim),message:text(f.message,"Animation explanation",2000),note:typeof f.note==="string"?f.note.slice(0,1000):""};
    });
  }
  buildTests(p,p.tests);
  if(JSON.stringify(p).length>250000)throw new Error("The problem definition is too large.");
  return p;
}

export function mergeCatalog(base,remote) {
  const map=new Map(base.map(p=>[p.id,p]));
  for(const p of remote)map.set(p.id,validateProblem(p));
  return [...map.values()];
}
