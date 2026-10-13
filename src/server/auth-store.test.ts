import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AuthStore,
  authRequest,
  type AuthSnapshot,
  type AdminCredentials,
  type AdminSession,
} from "./auth-store";
import { memoryDurableStorage } from "./storage-fixture";

function fixture() {
  const storage = memoryDurableStorage().binding;
  let store = new AuthStore({ storage } as DurableObjectState);
  const env = {
    APP_ENV: "production",
    AUTH: {
      idFromName: (name: string) => name,
      get: () => store,
    } as unknown as DurableObjectNamespace,
  };
  const session: AdminSession = {
    id: crypto.randomUUID(),
    csrf: "fixture-csrf",
    expires: Date.now() + 86400000,
    credential_version: "bootstrap",
  };
  return {
    storage,
    env,
    session,
    restart() {
      store = new AuthStore({ storage } as DurableObjectState);
    },
    alarm() {
      return store.alarm();
    },
  };
}

test("concurrent auth attempts enforce five attempts globally, including after eviction", async () => {
  const f = fixture();
  const attempts = await Promise.all(
    Array.from({ length: 20 }, () =>
      authRequest<boolean>(f.env, { action: "attempt", ip: "fixture" }),
    ),
  );
  assert.equal(attempts.filter(Boolean).length, 5);
  f.restart();
  assert.equal(
    await authRequest(f.env, { action: "attempt", ip: "fixture" }),
    false,
  );
  await f.storage.put("limit:fixture", {
    attempts: 5,
    expires: Date.now() - 1,
  });
  assert.equal(
    await authRequest(f.env, { action: "attempt", ip: "fixture" }),
    true,
  );
});

test("credential rotation is atomic and rejects stale login creation and concurrent rotations", async () => {
  const f = fixture();
  assert.equal(
    await authRequest(f.env, {
      action: "login",
      session: f.session,
      ip: "fixture",
    }),
    true,
  );
  const next: AdminCredentials = {
    username: "new-admin",
    passwordHash: "fixture-hash",
    mustChange: false,
    version: crypto.randomUUID(),
  };
  const rotations = await Promise.all(
    Array.from({ length: 2 }, () =>
      authRequest<boolean>(f.env, {
        action: "rotate",
        expectedVersion: "bootstrap",
        next,
        ip: "fixture",
      }),
    ),
  );
  assert.deepEqual(rotations.sort(), [false, true]);
  assert.equal(
    await authRequest(f.env, {
      action: "login",
      session: f.session,
      ip: "fixture",
    }),
    false,
  );
  f.restart();
  const snapshot = await authRequest<AuthSnapshot>(f.env, {
    action: "snapshot",
    cookie: f.session.id,
  });
  assert.equal(snapshot.session, null);
  assert.deepEqual(snapshot.credentials, next);
});

test("logout revokes a copied cookie immediately and expiration rejects sessions before cleanup", async () => {
  const f = fixture();
  await authRequest(f.env, {
    action: "login",
    session: f.session,
    ip: "fixture",
  });
  assert.ok(
    (
      await authRequest<AuthSnapshot>(f.env, {
        action: "snapshot",
        cookie: f.session.id,
      })
    ).session,
  );
  await authRequest(f.env, { action: "logout", id: f.session.id });
  f.restart();
  assert.equal(
    (
      await authRequest<AuthSnapshot>(f.env, {
        action: "snapshot",
        cookie: f.session.id,
      })
    ).session,
    null,
  );
  await f.storage.put(`session:${f.session.id}`, {
    ...f.session,
    expires: Date.now() - 1,
  });
  assert.equal(
    (
      await authRequest<AuthSnapshot>(f.env, {
        action: "snapshot",
        cookie: f.session.id,
      })
    ).session,
    null,
  );
});

test("auth alarm removes expired and revoked entries across pages while preserving active sessions", async () => {
  const f = fixture();
  for (let i = 0; i < 1005; i++)
    await f.storage.put(`session:old-${String(i).padStart(4, "0")}`, {
      ...f.session,
      expires: Date.now() - 1,
    });
  await f.storage.put("session:revoked", {
    ...f.session,
    credential_version: "old",
  });
  await f.storage.put("limit:expired", {
    attempts: 5,
    expires: Date.now() - 1,
  });
  await f.storage.put(`session:${f.session.id}`, f.session);
  await f.alarm();
  assert.equal((await f.storage.list()).size, 1);
  assert.deepEqual(await f.storage.get(`session:${f.session.id}`), f.session);
  assert.ok((await f.storage.getAlarm())! > Date.now());
});
