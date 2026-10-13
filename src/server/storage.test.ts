import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../shared/engine";
import {
  archiveMatch,
  clearMatches,
  listMatches,
  readDoc,
  saveDoc,
} from "./storage";
import { memoryKV } from "./storage-fixture";

test("KV documents use namespaced JSON keys and independent default copies", async () => {
  const kv = memoryKV();
  const env = { DATA: kv.binding };
  const fallback = { list: [1] };
  const first = await readDoc(env, "settings", fallback);
  first.list.push(2);
  assert.deepEqual(await readDoc(env, "settings", fallback), fallback);
  await saveDoc(env, "settings", { list: [3] });
  assert.deepEqual(await readDoc(env, "settings", fallback), { list: [3] });
  assert.equal(kv.writes[0].key, "document:settings");
});

test("KV archive preserves result shape, newest-first order, environment and retention across pages", async () => {
  const kv = memoryKV(7);
  const now = Date.now();
  const state = new Engine("production").state;
  state.status = "finished";
  state.settings.retentionDays = 2;
  for (let i = 0; i < 107; i++)
    await archiveMatch(
      kv.binding,
      { ...state, id: `match-${i}` },
      now - i * 1000,
    );
  await archiveMatch(
    kv.binding,
    { ...state, id: "other", environment: "other" },
    now,
  );
  await archiveMatch(
    kv.binding,
    { ...state, id: "sandbox", environment: "sandbox" },
    now,
  );
  const results = await listMatches(kv.binding, "production");
  assert.equal(results.length, 100);
  assert.deepEqual(
    results.map((r) => r.id),
    Array.from({ length: 100 }, (_, i) => `match-${i}`),
  );
  assert.equal(results[0].ended_at, new Date(now).toISOString());
  assert.deepEqual(results[0].result.logs, []);
  assert.deepEqual(results[0].result.queues, { red: [], blue: [] });
  assert.equal(
    kv.writes[0].options?.expiration,
    Math.floor(now / 1000) + 2 * 86400,
  );
  await clearMatches(kv.binding, "production");
  assert.equal(kv.deletes.length, 107);
  assert.equal((await listMatches(kv.binding, "production")).length, 0);
  assert.equal((await listMatches(kv.binding, "other")).length, 1);
});

test("KV list follows empty pages and skips missing values without losing the next result", async () => {
  const state = new Engine("production").state;
  let calls = 0;
  const kv = {
    async list(options: KVNamespaceListOptions) {
      calls++;
      if (!options.cursor)
        return { keys: [], list_complete: false, cursor: "next" };
      return {
        keys: [{ name: "missing" }, { name: "present" }],
        list_complete: true,
      };
    },
    async get(key: string) {
      return key === "missing" ? null : { id: "present", result: state };
    },
  } as unknown as KVNamespace;
  assert.deepEqual(
    (await listMatches(kv, "production")).map((r) => r.id),
    ["present"],
  );
  assert.equal(calls, 2);
});

test("expired match retries do not recreate deleted history or issue past-expiration KV writes", async () => {
  const kv = memoryKV();
  const state = new Engine("production").state;
  await archiveMatch(
    kv.binding,
    state,
    Date.now() - (state.settings.retentionDays + 1) * 86400000,
  );
  assert.equal(kv.writes.length, 0);
});
