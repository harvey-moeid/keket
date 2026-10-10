import { test } from "node:test";
import assert from "node:assert/strict";
import {
  passwordHash,
  verifyPassword,
  imageSize,
  constantEqual,
} from "./security";
test("salted PBKDF2 verifies only the correct password and rejects malformed hashes", async () => {
  const a = await passwordHash("test password only"),
    b = await passwordHash("test password only");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("test password only", a), true);
  assert.equal(await verifyPassword("incorrect", a), false);
  assert.equal(await verifyPassword("test password only", "invalid"), false);
  assert.equal(await constantEqual("abc", "abd"), false);
});
test("upload signature and dimension parser rejects renamed scripts", () => {
  assert.equal(
    imageSize(
      new TextEncoder().encode("<script>alert(1)</script>"),
      "image/png",
    ),
    null,
  );
  const d = new Uint8Array(24);
  d.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(d.buffer).setUint32(16, 256);
  new DataView(d.buffer).setUint32(20, 512);
  assert.deepEqual(imageSize(d, "image/png"), { width: 256, height: 512 });
});

test("chunked requests obey byte budgets and header-only images are rejected", async () => {
  const { readLimited, validImageContainer } = await import("./security");
  assert.equal(
    (
      await readLimited(
        new Request("https://test", { method: "POST", body: "small" }),
        10,
      )
    ).length,
    5,
  );
  await assert.rejects(() =>
    readLimited(
      new Request("https://test", {
        method: "POST",
        body: "too large payload",
      }),
      5,
    ),
  );
  const d = new Uint8Array(24);
  d.set([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(validImageContainer(d, "image/png"), false);
});
