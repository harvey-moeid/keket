import { readFileSync, writeFileSync } from "node:fs";

const target = process.env.KIZUNA_DEPLOY_TARGET;
if (!["preview", "production"].includes(target)) {
  throw new Error("KIZUNA_DEPLOY_TARGET must be preview or production");
}
for (const name of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
  if (!process.env[name]?.trim()) throw new Error(`Missing ${name} secret`);
}
const source = readFileSync("wrangler.toml", "utf8");
const sections = source.split("[env.production]");
if (sections.length !== 2)
  throw new Error("Expected one production environment");
const sectionIndex = target === "production" ? 1 : 0;
const section = sections[sectionIndex];
const matches = [...section.matchAll(/^database_id\s*=\s*"([^"]+)"/gm)];
if (matches.length !== 1) throw new Error("Expected one target D1 database");
const databaseId = process.env.D1_DATABASE_ID?.trim() || matches[0][1];
if (
  !databaseId ||
  !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(databaseId) ||
  databaseId.startsWith("00000000-0000-0000-0000-")
) {
  throw new Error(
    "Set a real D1_DATABASE_ID variable in the GitHub environment",
  );
}
sections[sectionIndex] = section.replace(
  matches[0][0],
  `database_id = "${databaseId}"`,
);
writeFileSync(".wrangler-deploy.toml", sections.join("[env.production]"));
console.log(`Prepared ${target} configuration; source configuration unchanged`);
