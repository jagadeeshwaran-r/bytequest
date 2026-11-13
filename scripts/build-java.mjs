import { mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
const out = "build/classes";
mkdirSync(out, { recursive: true });
for (const args of [
  ["com.sun.tools.javac.Main", "-source", "17", "-target", "17", "-Xlint:-options", "-d", out, "java/JavaRunner.java"],
  ["sun.tools.jar.Main", "--create", "--file", "dist/java-runner.jar", "-C", out, "."]
]) {
  const p = spawnSync("java", args, { stdio: "inherit" });
  if (p.status !== 0) process.exit(p.status || 1);
}
rmSync("build", { recursive: true, force: true });
console.log("Built browser Java bridge (Java 17).");
