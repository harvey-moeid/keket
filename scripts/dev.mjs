import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
const env = {
  ...process.env,
  XDG_CONFIG_HOME: resolve(".wrangler/config"),
  WRANGLER_LOG_PATH: "/tmp/kizuna-wrangler-logs",
  WRANGLER_SEND_METRICS: "false",
};
const run = (bin, args) =>
  spawn(process.execPath, [resolve("node_modules", bin), ...args], {
    env,
    stdio: "inherit",
  });
const once = (bin, args) =>
  new Promise((resolve, reject) => {
    const p = run(bin, args);
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(Error(`Setup command exited ${code}`)),
    );
  });
try {
  await access("dist/index.html");
} catch {
  await once("vite/bin/vite.js", ["build"]);
}
await once("wrangler/bin/wrangler.js", [
  "d1",
  "migrations",
  "apply",
  "kizuna-preview",
  "--local",
]);
const api = run("wrangler/bin/wrangler.js", ["dev", "--port", "8787"]);
const ui = run("vite/bin/vite.js", [
  "--host",
  "0.0.0.0",
  ...process.argv.slice(2),
]);
let closing = false;
const stop = () => {
  if (closing) return;
  closing = true;
  api.kill("SIGTERM");
  ui.kill("SIGTERM");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
api.on("exit", (code) => {
  stop();
  process.exitCode = code || 0;
});
ui.on("exit", (code) => {
  stop();
  process.exitCode = code || 0;
});
