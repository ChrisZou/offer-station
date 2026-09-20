import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const processes = [
  spawn("node", ["scripts/typst-compiler.mjs"], { cwd: root, stdio: "inherit" }),
  spawn("npm", ["--prefix", "apps/web", "run", "dev:app"], { cwd: root, stdio: "inherit" }),
];

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  processes.forEach((child) => child.kill("SIGTERM"));
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
processes.forEach((child) => child.on("exit", (code) => {
  if (!stopping && code && code !== 0) {
    process.exitCode = code;
    stop();
  }
}));
