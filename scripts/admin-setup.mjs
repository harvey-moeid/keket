import { createInterface } from "node:readline/promises";
import { readFile, writeFile, chmod } from "node:fs/promises";
import { webcrypto } from "node:crypto";
const rl = createInterface({ input: process.stdin, output: process.stdout });
console.log(
  "Konfigurasi akun pengembangan lokal. Password tidak disimpan plaintext.",
);
const username = (await rl.question("Username [admin]: ")) || "admin";
if (!process.stdin.isTTY) {
  rl.close();
  throw Error(
    "Jalankan pada terminal interaktif untuk memasukkan password secara aman.",
  );
}
rl.close();
process.stdout.write(
  "Password baru (minimal 12 karakter, input tersembunyi): ",
);
const password = await new Promise((resolve) => {
  let value = "";
  process.stdin.setRawMode(true);
  process.stdin.resume();
  const listener = (chunk) => {
    for (const ch of chunk.toString()) {
      if (ch === "\r" || ch === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off("data", listener);
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (ch === "\u0003") {
        process.exit(1);
      }
      if (ch === "\u007f") value = value.slice(0, -1);
      else value += ch;
    }
  };
  process.stdin.on("data", listener);
});
if (password.length < 12) throw Error("Password minimal 12 karakter.");
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const key = await webcrypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits"],
);
const hash = await webcrypto.subtle.deriveBits(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations: 310000 },
  key,
  256,
);
const hex = (b) => Buffer.from(b).toString("hex");
let old = "";
try {
  old = await readFile(".dev.vars", "utf8");
} catch {}
const retained = old
  .split("\n")
  .filter(
    (line) => !/^ADMIN_(USERNAME|PASSWORD_HASH)=/.test(line) && line.trim(),
  )
  .join("\n");
const secret = retained.includes("WEBHOOK_SECRET=")
  ? ""
  : "WEBHOOK_SECRET=" +
    hex(webcrypto.getRandomValues(new Uint8Array(32))) +
    "\n";
await writeFile(
  ".dev.vars",
  `ADMIN_USERNAME=${JSON.stringify(username)}\nADMIN_PASSWORD_HASH=${JSON.stringify("310000:" + hex(salt) + ":" + hex(hash))}\n${secret}${retained}\n`,
  { mode: 0o600 },
);
await chmod(".dev.vars", 0o600);
console.log(
  "Akun tersimpan di .dev.vars (ignored). Restart npm run dev:api. Secret webhook lokal dibuat bila belum ada.",
);
