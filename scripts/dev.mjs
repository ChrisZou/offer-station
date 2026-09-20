import { spawn } from "node:child_process";

const processes = [
  spawn("npm", ["--prefix", "apps/web", "run", "dev"], { stdio: "inherit" }),
  spawn("npm", ["--prefix", "apps/resume-studio", "run", "dev:workbench"], { stdio: "inherit" }),
];

let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  processes.forEach((child) => {
    if (!child.killed) child.kill("SIGTERM");
  });
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
processes.forEach((child) => child.on("exit", (code) => {
  if (!stopping && code && code !== 0) {
    process.exitCode = code;
    stop();
  }
}));
