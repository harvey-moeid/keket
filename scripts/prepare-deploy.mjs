import { readFileSync } from "node:fs";

for (const name of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
  if (!process.env[name]?.trim()) throw new Error(`Missing ${name} secret`);
}
const config = readFileSync("wrangler.toml", "utf8");
if (!config.includes('name = "kizuna-production"')) {
  throw new Error("Production Worker configuration is required");
}
if (!config.includes('database_id = "65db506b-4e7e-4926-b8cc-56cc3fa88c16"')) {
  throw new Error("Production D1 binding is missing");
}
console.log("Production Cloudflare configuration verified");
