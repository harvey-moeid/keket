import { readFileSync } from "node:fs";

for (const name of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
  if (!process.env[name]?.trim()) throw new Error(`Missing ${name} secret`);
}
const config = readFileSync("wrangler.toml", "utf8");
if (!config.includes('name = "kizuna-production"')) {
  throw new Error("Production Worker configuration is required");
}
if (
  !/\[\[kv_namespaces\]\]\s*(?:#[^\n]*\n\s*)?binding\s*=\s*"DATA"/.test(config)
) {
  throw new Error("Production KV binding DATA is missing");
}
if (config.includes("[[d1_databases]]")) {
  throw new Error("D1 is no longer supported; use KV DATA");
}
if (!config.includes('class_name = "AuthStore"')) {
  throw new Error("Production authentication Durable Object is missing");
}
console.log("Production Cloudflare configuration verified");
