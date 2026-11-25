// Solve Lists are derived from the published catalog; no duplicated problems or progress.
const aliases = new Map();
const groups = {
  'Mathematics':['math','mathematics','number theory','arithmetic','combinatorics','geometry','modular arithmetic','gcd','prime numbers'],
  'Arrays':['array','arrays','array manipulation','array traversal'],
  'Strings':['string','strings','string manipulation'],
  'Hashing':['hashing','hash map','hash maps','hashmap','hash table','hash tables','hash set','hash sets','hashset','frequency counting'],
  'Linked Lists':['linked list','linked lists','singly linked list','doubly linked list'],
  'Dynamic Programming':['dp','dynamic programming','memoization','tabulation'],
  'Two Pointers':['two pointer','two pointers','fast and slow pointers','fast slow pointers','floyd cycle detection'],
  'Binary Search':['binary search','binary search on answer'],
  'Sliding Window':['sliding window','sliding windows'],
  'Stacks':['stack','stacks','monotonic stack'],
  'Queues':['queue','queues','deque','deques','monotonic queue'],
  'Trees':['tree','trees','binary tree','binary trees','binary search tree','binary search trees','bst'],
  'Graphs':['graph','graphs','graph traversal','topological sort','union find','disjoint set','shortest path'],
  'Sorting':['sorting','sort'],
  'Greedy':['greedy','greedy algorithms'],
  'Backtracking':['backtracking'],
  'Recursion':['recursion','recursive'],
  'Heaps':['heap','heaps','priority queue','priority queues'],
  'Bit Manipulation':['bit manipulation','bitwise','bitwise operations'],
  'Prefix Sum':['prefix sum','prefix sums'],
  'Matrices':['matrix','matrices','2d array','2d arrays'],
  'Tries':['trie','tries','prefix tree'],
  'Breadth-First Search':['bfs','breadth first search'],
  'Depth-First Search':['dfs','depth first search']
};
const normalize = value => typeof value==='string' ? value.trim().toLowerCase().replace(/[-_]+/g,' ').replace(/\s+/g,' ') : '';
for(const [name,values] of Object.entries(groups)) for(const value of [name,...values]) aliases.set(normalize(value),name);
const canonical=(value,allowNew=false)=>{
  const key=normalize(value);
  if(!key||key.length>80||['other','general','uncategorized','unknown','none'].includes(key))return null;
  return aliases.get(key)||(allowNew?key.replace(/\b\w/g,c=>c.toUpperCase()):null);
};
const values=value=>Array.isArray(value)?value:typeof value==='string'?value.split(','):[];
export function problemSkills(problem){
  const names=new Set();
  const add=(value,allowNew=false)=>{const name=canonical(value,allowNew);if(name)names.add(name);};
  for(const value of [...values(problem.requiredSkills),...values(problem.skills)])add(value,true);
  add(problem.topic,true);
  add(problem.pattern);
  for(const value of values(problem.techniques))add(value,true);
  // Structural inputs provide additional useful categories, never infer algorithms from titles.
  for(const type of [...(Array.isArray(problem.params)?problem.params.map(p=>p?.type):[]),problem.returns]){
    if(typeof type!=='string')continue;
    if(/\bListNode\b/.test(type))names.add('Linked Lists');
    if(/\bTreeNode\b/.test(type))names.add('Trees');
    if(/\[\s*\]/.test(type))names.add('Arrays');
    if(/\[\s*\]\s*\[\s*\]/.test(type))names.add('Matrices');
    if(/\bString\b/.test(type))names.add('Strings');
  }
  if(!names.size)names.add('Uncategorized');
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
  return [...lists.values()].sort((a,b)=>a.name==='Uncategorized'?1:b.name==='Uncategorized'?-1:a.name.localeCompare(b.name));
}
