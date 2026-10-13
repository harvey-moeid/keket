import { createInterface } from "node:readline/promises";
import { readFile, writeFile, chmod } from "node:fs/promises";
import { webcrypto } from "node:crypto";
const rl = createInterface({ input: process.stdin, output: process.stdout });
const initial = process.argv.includes("--initial");
const minimum = initial ? 8 : 12;
console.log(
  "Konfigurasi akun pengembangan lokal. Password disimpan sebagai secret lokal di .dev.vars (ignored).",
);
const username = (await rl.question("Username [admin]: ")) || "admin";
if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) {
  rl.close();
  throw Error(
    "Username 3–32 karakter: huruf, angka, titik, underscore atau minus.",
  );
}
if (!process.stdin.isTTY) {
  rl.close();
  throw Error(
    "Jalankan pada terminal interaktif untuk memasukkan password secara aman.",
  );
}
rl.close();
process.stdout.write(
  `Password ${initial ? "awal" : "baru"} (minimal ${minimum} karakter, input tersembunyi): `,
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
if (password.length < minimum || password.length > 256)
  throw Error(`Password ${minimum}–256 karakter.`);
const hex = (b) => Buffer.from(b).toString("hex");
let old = "";
try {
  old = await readFile(".dev.vars", "utf8");
} catch {}
const retained = old
  .split("\n")
  .filter(
    (line) =>
      !/^ADMIN_(USERNAME|PASSWORD|PASSWORD_HASH|REQUIRE_PASSWORD_CHANGE)=/.test(
        line,
      ) && line.trim(),
  )
  .join("\n");
const secret = retained.includes("WEBHOOK_SECRET=")
  ? ""
  : "WEBHOOK_SECRET=" +
    hex(webcrypto.getRandomValues(new Uint8Array(32))) +
    "\n";
await writeFile(
  ".dev.vars",
  `ADMIN_USERNAME=${JSON.stringify(username)}\nADMIN_PASSWORD=${JSON.stringify(password)}\nADMIN_REQUIRE_PASSWORD_CHANGE=${JSON.stringify(initial ? "true" : "false")}\n${secret}${retained}\n`,
  { mode: 0o600 },
);
await chmod(".dev.vars", 0o600);
console.log(
  "Akun bootstrap tersimpan di .dev.vars (ignored). Restart npm run dev:api. Akun yang sudah diganti melalui UI memakai data Durable Object autentikasi; lihat panduan pemulihan akun. Secret webhook lokal dibuat bila belum ada.",
);
