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
  throw new Error("Unsupported parameter type.");
}

export function buildTests(problem, cases) {
  return cases.map((c, i) => {
    if (!Array.isArray(c.args) || c.args.length !== problem.params.length) throw new Error("Provide " + problem.params.length + " argument(s) in args.");
    let call = "new Solution()." + problem.method + "(" + c.args.map((v, j) => javaLiteral(v, problem.params[j].type)).join(", ") + ")";
    let expected = javaLiteral(c.expected, problem.returns);
    if (problem.normalize === "sort-int") {
      call = "sorted(" + call + ")";
      expected = "sorted(" + expected + ")";
    }
    return "check(" + javaLiteral("Case " + (i + 1) + ": " + (c.label || "Custom input"), "String", false) + ", () -> " + call + ", " + expected + ");";
  }).join("\n");
}

export class JavaJudge {
  constructor(onStatus = () => {}) { this.onStatus = onStatus; this.frame = null; this.waiters = new Map(); this.sequence = 0; }
  async boot() {
    if (this.ready) return this.ready;
    this.onStatus("Starting Java 17… First launch downloads the browser JDK.");
    this.frame = document.createElement("iframe");
    this.frame.src = new URL("runner.html", import.meta.url).href;
    this.frame.hidden = true;
    this.frame.title = "Java execution sandbox";
    document.body.appendChild(this.frame);
    this.listener = event => {
      if (event.source !== this.frame?.contentWindow || event.origin !== location.origin || event.data?.channel !== "bytequest-java") return;
      if (event.data.type === "status") this.onStatus(event.data.message);
      const w = this.waiters.get(event.data.id);
      if (w) { this.waiters.delete(event.data.id); event.data.type === "error" ? w.reject(new Error(event.data.message)) : w.resolve(event.data.result); }
    };
    window.addEventListener("message", this.listener);
    this.ready = new Promise((resolve, reject) => this.waiters.set("boot", {resolve, reject}));
    return this.ready;
  }
  async run(source, problem, cases) {
    if (source.length > 60000) throw new Error("Keep your solution under 60,000 characters.");
    const tests = buildTests(problem, cases);
    await this.boot();
    this.onStatus("Compiling your Java and running " + cases.length + " tests…");
    const id = ++this.sequence;
    const result = new Promise((resolve, reject) => this.waiters.set(id, {resolve, reject}));
    this.frame.contentWindow.postMessage({channel:"bytequest-java",type:"run",id,source,tests}, location.origin);
    return result;
  }
  stop() {
    window.removeEventListener("message", this.listener);
    this.frame?.remove();
    this.frame = null;
    this.ready = null;
    for (const waiter of this.waiters.values()) waiter.reject(new Error("Java stopped. Your code is saved; the next run starts a fresh JVM."));
    this.waiters.clear();
  }
}
