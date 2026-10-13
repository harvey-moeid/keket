import { test } from "node:test";
import assert from "node:assert/strict";
import { MatchRoom, type Env } from "./index";
import { memoryDurableStorage, memoryKV } from "./storage-fixture";

function roomFixture(kv: KVNamespace) {
  const snapshots = new Map<string, string>();
  const storage = memoryDurableStorage().binding;
  storage.sql = {
    exec(query: string, ...values: unknown[]) {
      if (query.startsWith("INSERT INTO room_snapshot"))
        snapshots.set("state", values[0] as string);
      return {
        toArray() {
          if (query.includes("SELECT value FROM room_snapshot")) {
            const value = snapshots.get("state");
            return value ? [{ value }] : [];
          }
          return [];
        },
      };
    },
  } as unknown as SqlStorage;
  let initialized: Promise<unknown> = Promise.resolve();
  const ctx = {
    id: { name: "production" },
    storage,
    blockConcurrencyWhile(callback: () => Promise<unknown>) {
      initialized = callback();
    },
  } as unknown as DurableObjectState;
  const env = { APP_ENV: "production", DATA: kv } as Env;
  return {
    async create() {
      const room = new MatchRoom(ctx, env);
      await initialized;
      return room;
    },
  };
}

test("finished match archival survives resets and concurrent persistence without duplicate writes", async () => {
  const kv = memoryKV();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const binding = {
    get: kv.binding.get.bind(kv.binding),
    async put(key: string, value: string, options?: KVNamespacePutOptions) {
      await gate;
      return kv.binding.put(key, value, options);
    },
  } as unknown as KVNamespace;
  const f = roomFixture(binding);
  const room = await f.create();
  room.engine.state.status = "finished";
  const id = room.engine.state.id;
  const first = room.persist();
  const second = room.persist();
  room.engine.lifecycle("reset");
  release();
  await Promise.all([first, second]);
  assert.equal(kv.writes.length, 1);
  assert.equal(JSON.parse(kv.writes[0].value).id, id);
  assert.equal(JSON.parse(kv.writes[0].value).result.status, "finished");
  assert.notEqual(room.engine.state.status, "finished");
});

test("room restoration reuses the archived result key and its original retention deadline", async () => {
  const kv = memoryKV();
  const f = roomFixture(kv.binding);
  const room = await f.create();
  room.engine.state.status = "finished";
  await room.persist();
  const restored = await f.create();
  await restored.persist();
  assert.equal(kv.writes.length, 2);
  assert.equal(kv.writes[0].key, kv.writes[1].key);
  assert.deepEqual(kv.writes[0].options, kv.writes[1].options);
  assert.equal(kv.values.size, 1);
});
