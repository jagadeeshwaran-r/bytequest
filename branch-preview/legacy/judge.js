export function javaLiteral(value, type, asciiOnly = true) {
  if (type === "int[]") {
    if (!Array.isArray(value) || value.length > 10000 || value.some(v => !Number.isInteger(v) || Math.abs(v) > 1000000000)) throw new Error("Expected an array of integers (at most 10,000 values).");
    return "new int[]{" + value.join(",") + "}";
  }
  if (type === "int") {
    if (!Number.isInteger(value) || Math.abs(value) > 1000000000) throw new Error("Expected an integer between −1 billion and 1 billion.");
    return String(value);
  }
  if (type === "boolean") {
    if (typeof value !== "boolean") throw new Error("Expected true or false.");
    return String(value);
  }
  if (type === "String") {
    if (typeof value !== "string" || value.length > 10000 || (asciiOnly && /[^\x00-\x7f]/.test(value))) throw new Error("Expected an ASCII string, at most 10,000 characters.");
    // Encode controls as octal; JSON's \u escapes are processed early by javac.
    return '"' + [...value].map(c => c === '"' ? '\\"' : c === "\\" ? "\\\\" : c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? "\\" + c.charCodeAt(0).toString(8).padStart(3, "0") : c).join("") + '"';
  }
  // LeetCode-style Java-only structural types. Values are validated before
  // being turned into Java expressions; no user-supplied Java snippets are evaluated.
  const intValue = v => Number.isInteger(v) && v >= -1000000000 && v <= 1000000000;
  const javaArray = (v, itemType, max = 10000) => {
    if (!Array.isArray(v) || v.length > max) throw new Error("Expected an array of at most " + max + " elements.");
    return "new " + itemType + "[]{" + v.map(item => javaLiteral(item, itemType, asciiOnly)).join(",") + "}";
  };
  if (type === "long") {
    if (!Number.isSafeInteger(value)) throw new Error("Expected a safe integer for long.");
    return String(value) + "L";
  }
  if (type === "double") {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Expected a finite number.");
    return String(value) + "d";
  }
  if (type === "int[][]") {
    if (!Array.isArray(value) || value.length > 1000) throw new Error("Expected a matrix with at most 1,000 rows.");
    return "new int[][]{" + value.map(row => javaLiteral(row, "int[]", asciiOnly)).join(",") + "}";
  }
  if (type === "boolean[]") return javaArray(value, "boolean");
  if (type === "String[]") return javaArray(value, "String");
  if (type === "long[]") return javaArray(value, "long");
  if (type === "double[]") return javaArray(value, "double");
  if (type === "List<Integer>") {
    if (!Array.isArray(value) || value.length > 10000 || value.some(v => !intValue(v))) throw new Error("Expected an integer list.");
    return "new java.util.ArrayList<>(java.util.Arrays.asList(" + value.map(v => javaLiteral(v, "int")).join(",") + "))";
  }
  if (type === "List<List<Integer>>") {
    if (!Array.isArray(value) || value.length > 1000) throw new Error("Expected a nested list.");
    return "new java.util.ArrayList<>(java.util.Arrays.asList(" + value.map(row => javaLiteral(row, "List<Integer>")).join(",") + "))";
  }
  if (type === "ListNode") {
    if (value === null) return "null";
    let pos = -1, values = value;
    if (value && !Array.isArray(value) && typeof value === "object") {
      values = value.values;
      pos = value.pos ?? -1;
    }
    if (!Array.isArray(values) || values.length > 10000 || values.some(v => !intValue(v))) throw new Error("Expected list values as an integer array.");
    if (!Number.isInteger(pos) || pos < -1 || pos >= values.length) throw new Error("Invalid linked-list cycle position.");
    return "ListHelper.createList(" + javaLiteral(values,"int[]") + "," + pos + ")";
  }
  if (type === "TreeNode") {
    if (value === null) return "null";
    if (!Array.isArray(value) || value.length > 10000 || value.some(v => v !== null && !intValue(v))) throw new Error("Expected level-order tree values as integers or null.");
    return "TreeHelper.createTree(" + value.map(v => v === null ? "null" : String(v)).join(",") + ")";
  }
  if (type === "GraphNode") {
    if (value === null) return "null";
    if (!Array.isArray(value) || value.length > 1000 || value.some(row => !Array.isArray(row) || row.some(n => !Number.isInteger(n) || n < 1 || n > value.length))) throw new Error("Expected a 1-indexed graph adjacency list.");
    return "GraphHelper.createGraph(" + javaLiteral(value,"int[][]") + ")";
  }
  throw new Error("Unsupported parameter type.");
}

export function buildTests(problem, cases) {
  return cases.map((c, i) => {
    if (!Array.isArray(c.args) || c.args.length !== problem.params.length) throw new Error("Provide " + problem.params.length + " argument(s) in args.");
    let call = "new Solution()." + problem.method + "(" + c.args.map((v, j) => javaLiteral(v, problem.params[j].type)).join(", ") + ")";
    let expected = javaLiteral(c.expected, problem.normalize === "listnode-index" ? "int" : problem.returns);
    if (problem.normalize === "listnode-index") {
      if (!Number.isInteger(c.expected) || c.expected < -1) throw new Error("Expected a zero-based node index or -1 for no node.");
      const list = c.args[0] && !Array.isArray(c.args[0]) ? c.args[0].values : c.args[0];
      if (c.expected >= (list?.length ?? 0)) throw new Error("Expected node index must refer to the input list.");
      call = "ListHelper.indexOfReturned(" + javaLiteral(c.args[0], "ListNode") + ", (head) -> new Solution()." + problem.method + "(head))";
      expected = javaLiteral(c.expected, "int");
    }
    if (problem.normalize === "sort-int") {
      call = "sorted(" + call + ")";
      expected = "sorted(" + expected + ")";
    }
    return "check(" + javaLiteral("Case " + (i + 1) + ": " + (c.label || "Custom input"), "String", false) + ", () -> " + call + ", " + expected + ");";
  }).join("\n");
}

export class JavaJudge {
  constructor(onStatus = () => {}) { this.onStatus = onStatus; this.frame = null; this.waiters = new Map(); this.sequence = 0; this.phase="cold"; }
  async boot() {
    if (this.ready) return this.ready;
    this.phase="loading";this.onStatus("Preparing Java 17 in the background…");
    this.frame = document.createElement("iframe");
    this.frame.src = new URL("runner.html?v=structural-2", import.meta.url).href;
    this.frame.hidden = true;
    this.frame.title = "Java execution sandbox";
    document.body.appendChild(this.frame);
    this.listener = event => {
      if (event.source !== this.frame?.contentWindow || event.origin !== location.origin || event.data?.channel !== "bytequest-java") return;
      if (event.data.type === "status") this.onStatus(event.data.message);
      const w = this.waiters.get(event.data.id);
      if (w) { this.waiters.delete(event.data.id); if(event.data.id==="boot"){clearTimeout(this.bootTimer);this.phase=event.data.type==="error"?"error":"ready";this.onStatus(this.phase==="ready"?"Java 17 is ready":"Java preparation paused. Run to retry.");}event.data.type === "error" ? w.reject(new Error(event.data.message)) : w.resolve(event.data.result); }
    };
    window.addEventListener("message", this.listener);
    this.ready = new Promise((resolve, reject) => this.waiters.set("boot", {resolve, reject}));
    this.bootTimer=setTimeout(()=>{this.stop();this.phase="error";this.onStatus("Java preparation timed out. Run to retry.");},120000);
    return this.ready;
  }
  preload(){if(this.phase!=="cold")return this.ready||Promise.resolve();return this.boot().catch(()=>{this.stop();this.phase="error";this.onStatus("Java preparation paused. Run to retry.");});}
  async run(source, problem, cases) {
    if (source.length > 60000) throw new Error("Keep your solution under 60,000 characters.");
    const tests = buildTests(problem, cases);
    if(this.phase==="error")this.stop();
    await this.boot();
    this.onStatus("Compiling your Java and running " + cases.length + " tests…");
    const id = ++this.sequence;
    let watchdog;
    const result = new Promise((resolve, reject) => this.waiters.set(id, {
      resolve: value => { clearTimeout(watchdog); resolve(value); },
      reject: error => { clearTimeout(watchdog); reject(error); }
    }));
    // Untrusted Java may loop forever. Recreate the iframe/JVM rather than
    // leaving the editor waiting indefinitely or reusing the stuck runtime.
    watchdog = setTimeout(() => {
      if (!this.waiters.has(id)) return;
      this.onStatus("Java execution timed out. Your code is saved; the next Run starts a fresh JVM.");
      this.stop();
    }, 90000);
    try {
      this.frame.contentWindow.postMessage({channel:"bytequest-java",type:"run",id,source,tests}, location.origin);
    } catch (error) {
      this.waiters.get(id)?.reject(error);
      this.waiters.delete(id);
    }
    return result;
  }
  stop() {
    clearTimeout(this.bootTimer);this.phase="cold";
    window.removeEventListener("message", this.listener);
    this.frame?.remove();
    this.frame = null;
    this.ready = null;
    for (const waiter of this.waiters.values()) waiter.reject(new Error("Java stopped. Your code is saved; the next run starts a fresh JVM."));
    this.waiters.clear();
  }
}
