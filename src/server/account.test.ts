import { memoryKV, memoryDurableStorage } from "./storage-fixture";
import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { AuthStore, type Env } from "./index";
import { verifyPassword } from "./security";
import { fighters } from "../shared/model";

async function fixture() {
  const kv = memoryKV();
  const storage = memoryDurableStorage().binding;
  const auth = new AuthStore({ storage } as DurableObjectState);
  const env = {
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "initial8",
    ADMIN_REQUIRE_PASSWORD_CHANGE: "true",
    APP_ENV: "preview",
    ROOMS: {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: () => {
          throw Error("Unexpected room mutation");
        },
      }),
    },
    DATA: kv.binding,
    AUTH: { idFromName: (name: string) => name, get: () => auth },
  } as unknown as Env;
  let cookie = "",
    csrf = "";
  const send = (
    path: string,
    data?: unknown,
    headers: Record<string, string> = {},
  ) =>
    worker.fetch(
      new Request("https://game.test/api" + path, {
        method: data ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          "X-CSRF-Token": csrf,
          Origin: "https://game.test",
          ...headers,
        },
        body: data ? JSON.stringify(data) : undefined,
      }),
      env,
    );
  async function login(username = "admin", password = "initial8") {
    const response = await send("/login", { username, password });
    if (response.ok) {
      cookie = response.headers.get("Set-Cookie")!.split(";")[0];
      csrf = ((await response.clone().json()) as any).csrf;
    }
    return response;
  }
  return { storage, kv, auth, env, send, login };
}

test("bootstrap accepts plain password, rejects wrong password and missing secret", async () => {
  const f = await fixture();
  assert.equal((await f.login("admin", "wrong")).status, 401);
  assert.equal((await f.login()).status, 200);
  f.env.ADMIN_PASSWORD = undefined;
  const auth = (await (await f.send("/auth")).json()) as any;
  assert.equal(auth.configured, false);
  assert.equal((await f.login()).status, 503);
});

test("initial admin must rotate password; account response contains no password hash", async () => {
  const f = await fixture();
  assert.equal((await f.login()).status, 200);
  assert.equal((await f.send("/catalog")).status, 409);
  const account = await (await f.send("/account")).json();
  assert.deepEqual(account, { username: "admin", mustChangePassword: true });
  assert.equal((await f.send("/auth")).status, 200);
});
test("account rotation rejects CSRF, wrong current password and short/same password", async () => {
  const f = await fixture();
  await f.login();
  const update = {
    username: "new-admin",
    currentPassword: "initial8",
    newPassword: "new-password-12345",
  };
  assert.equal(
    (await f.send("/account", update, { "X-CSRF-Token": "bad" })).status,
    403,
  );
  assert.equal(
    (await f.send("/account", { ...update, currentPassword: "wrong" })).status,
    400,
  );
  assert.equal(
    (await f.send("/account", { ...update, newPassword: "short" })).status,
    400,
  );
  assert.equal(await f.storage.get("admin_credentials"), undefined);
});
test("rotation persists salted hash, revokes sessions and rejects stale in-flight logins", async () => {
  const f = await fixture();
  await f.login();
  assert.equal(
    (
      await f.send("/account", {
        username: "new-admin",
        currentPassword: "initial8",
        newPassword: "new-password-12345",
      })
    ).status,
    200,
  );
  const saved = (await f.storage.get("admin_credentials")) as any;
  assert.equal(saved.mustChange, false);
  assert.ok(await verifyPassword("new-password-12345", saved.passwordHash));
  f.env.ADMIN_PASSWORD = undefined;
  assert.equal((await f.login()).status, 401);
  assert.equal((await f.login("new-admin", "new-password-12345")).status, 200);
  assert.equal((await f.send("/catalog")).status, 200);
  const id = "00000000-0000-4000-8000-000000000000";
  await f.storage.put(`session:${id}`, {
    id,
    csrf: "old-csrf",
    expires: Date.now() + 60000,
    credential_version: "bootstrap",
  });
  assert.equal(
    (await f.send("/account", undefined, { Cookie: `kizuna_session=${id}` }))
      .status,
    401,
  );
});
test("account password attempts are bounded and cannot reset the attempt limit", async () => {
  const f = await fixture();
  await f.login();
  const data = {
    username: "admin",
    currentPassword: "wrong",
    newPassword: "new-password-12345",
  };
  for (let i = 0; i < 5; i++)
    assert.equal((await f.send("/account", data)).status, 400);
  assert.equal((await f.send("/account", data)).status, 429);
});
test("modular face uploads persist independently and reject missing/oversize assets and whole sheets", async () => {
  const f = await fixture();
  f.env.ADMIN_REQUIRE_PASSWORD_CHANGE = "false";
  await f.login();
  const image = new Uint8Array(24);
  image.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(image.buffer);
  view.setUint32(16, 280);
  view.setUint32(20, 340);
  f.env.ASSET_BUCKET = {
    async get(id: string) {
      return id.startsWith("1111")
        ? {
            arrayBuffer: async () => image.buffer,
            httpMetadata: { contentType: "image/png" },
          }
        : null;
    },
  } as unknown as R2Bucket;
  const fighter = {
    ...structuredClone(fighters[0]),
    appearance: {
      hairColor: "#642c40",
      outfitColor: "#382635",
      facePreset: "ren",
      outfitStyle: "robe",
      faceAsset: "/api/assets/11111111-2222-3333-4444-555555555555.png",
    },
  };
  assert.equal((await f.send("/fighters", fighter)).status, 200);
  const saved = (await (await f.send("/catalog")).json()) as any;
  assert.equal(
    saved.fighters.find((item: any) => item.id === fighter.id).appearance
      .faceAsset,
    fighter.appearance.faceAsset,
  );
  assert.equal(
    (
      await f.send("/fighters", {
        ...fighter,
        asset: fighter.appearance.faceAsset,
      })
    ).status,
    400,
  );
  view.setUint32(16, 1025);
  assert.equal((await f.send("/fighters", fighter)).status, 400);
  assert.equal(
    (
      await f.send("/fighters", {
        ...fighter,
        appearance: {
          ...fighter.appearance,
          faceAsset: "https://foreign.test/face.png",
        },
      })
    ).status,
    400,
  );
});
