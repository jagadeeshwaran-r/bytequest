// Only data structures and mathematics are collection categories.
const aliases = new Map();
const groups = {
  'Mathematics':['math','number theory','arithmetic','combinatorics','geometry','modular arithmetic','gcd','prime numbers','probability'],
  'Arrays':['array','array manipulation','array traversal'],
  'Strings':['string','string manipulation'],
  'Hash Maps & Sets':['hash map','hash maps','hashmap','hash table','hash tables','hash set','hash sets','hashset','map','maps','set','sets','dictionary','dictionaries','hash maps and sets'],
  'Linked Lists':['linked list','singly linked list','doubly linked list','circular linked list'],
  'Stacks':['stack','monotonic stack'],
  'Queues':['queue','deque','deques','monotonic queue'],
  'Trees':['tree','binary tree','binary trees','binary search tree','binary search trees','bst','segment tree','segment trees','fenwick tree','fenwick trees','balanced tree','n ary tree'],
  'Graphs':['graph','directed graph','undirected graph','weighted graph'],
  'Heaps':['heap','priority queue','priority queues','min heap','max heap'],
  'Matrices':['matrix','2d array','2d arrays'],
  'Tries':['trie','prefix tree'],
  'Disjoint Sets':['disjoint set','union find','disjoint set union','dsu']
};
const normalize = value => typeof value==='string' ? value.trim().toLowerCase().replace(/[-_]+/g,' ').replace(/\s+/g,' ') : '';
for(const [name,values] of Object.entries(groups)) for(const value of [name,...values]) aliases.set(normalize(value),name);
const values=value=>Array.isArray(value)?value:typeof value==='string'?value.split(','):[];
export function problemSkills(problem){
  const names=new Set();
  const add=value=>{const name=aliases.get(normalize(value));if(name)names.add(name);};
  // Technique metadata can identify a known structure, but never create a technique playlist.
  for(const value of [...values(problem.requiredSkills),...values(problem.skills),problem.topic,problem.pattern,...values(problem.techniques)])add(value);
  // Use declared structural types, not title keywords or scalar numbers.
  for(const type of [...(Array.isArray(problem.params)?problem.params.map(p=>p?.type):[]),problem.returns]){
    if(typeof type!=='string')continue;
    if(/\bListNode\b/.test(type))names.add('Linked Lists');
    if(/\bTreeNode\b/.test(type))names.add('Trees');
    if(/\[\s*\]/.test(type))names.add('Arrays');
    if(/\[\s*\]\s*\[\s*\]/.test(type))names.add('Matrices');
    if(/\bString\b/.test(type))names.add('Strings');
    if(/\b(?:HashMap|HashSet|Map|Set)\s*</.test(type))names.add('Hash Maps & Sets');
  }
  // No "Uncategorized" or arbitrary topic list. Unclassified problems remain in Problems.
  return [...names];
}
const rank={easy:0,medium:1,hard:2};
export function buildSolveLists(catalog,solved={}){
  const lists=new Map(),seen=new Set();
  for(const problem of catalog){
    if(!problem||typeof problem.id!=='string'||seen.has(problem.id))continue;
    seen.add(problem.id);
    for(const name of problemSkills(problem)){
      if(!lists.has(name))lists.set(name,{name,problems:[],solved:0,total:0});
      const list=lists.get(name);
      list.problems.push(problem);list.total++;
      if(Object.hasOwn(solved,problem.id)&&solved[problem.id])list.solved++;
    }
  }
  for(const list of lists.values())list.problems.sort((a,b)=>(rank[String(a.difficulty).toLowerCase()]??3)-(rank[String(b.difficulty).toLowerCase()]??3));
  return [...lists.values()].sort((a,b)=>a.name.localeCompare(b.name));
}

// Suggested learning order only; no prerequisites or locks.
const roadmapOrder=['Mathematics','Arrays','Strings','Hash Maps & Sets','Linked Lists','Stacks','Queues','Matrices','Trees','Heaps','Tries','Graphs','Disjoint Sets'];
export function orderSolveRoadmap(lists){
 const rank=new Map(roadmapOrder.map((name,i)=>[name,i]));
 return [...lists].sort((a,b)=>(rank.get(a.name)??99)-(rank.get(b.name)??99)||a.name.localeCompare(b.name));
}
export function collectionState(list,ready){
 return !ready?'pending':list.total>0&&list.solved===list.total?'completed':list.solved>0?'progress':'new';
}
export function nextCollectionProblem(list,solved,ready){
 return ready?list.problems.find(p=>!Object.hasOwn(solved,p.id)||!solved[p.id])||null:null;
}
