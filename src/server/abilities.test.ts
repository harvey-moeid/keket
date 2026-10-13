import { memoryKV, memoryDurableStorage } from "./storage-fixture";
import { AuthStore } from "./auth-store";
import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { type Env } from "./index";
import { expandedMappings, fighters, defaultSkills } from "../shared/model";

async function fixture() {
  const kv = memoryKV();
  const storage = memoryDurableStorage().binding;
  const auth = new AuthStore({ storage } as DurableObjectState);
  const rooms: string[] = [];
  const env = {
    APP_ENV: "preview",
    DATA: kv.binding,
    AUTH: { idFromName: (name: string) => name, get: () => auth },
    ROOMS: {
      idFromName(name: string) {
        return name;
      },
      get(name: string) {
        return {
          async fetch() {
            rooms.push(name);
            return Response.json({ ok: true });
          },
        };
      },
    },
  } as unknown as Env;
  await storage.put("session:00000000-0000-4000-8000-000000000000", {
    id: "00000000-0000-4000-8000-000000000000",
    csrf: "test-only-csrf",
    expires: Date.now() + 10000,
    credential_version: "bootstrap",
  });
  const send = (path: string, value: unknown, csrf = "test-only-csrf") =>
    worker.fetch(
      new Request("https://game.test/api" + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "kizuna_session=00000000-0000-4000-8000-000000000000",
          "X-CSRF-Token": csrf,
          Origin: "https://game.test",
        },
        body: JSON.stringify(value),
      }),
      env,
    );
  return { send, writes: kv.writes, rooms };
}

test("admin mapping API accepts all 20 new abilities, updates both rooms and retains validation/CSRF", async () => {
  const f = await fixture();
  assert.equal((await f.send("/mappings", expandedMappings)).status, 200);
  assert.deepEqual(JSON.parse(f.writes[0].value), expandedMappings);
  assert.deepEqual(f.rooms, ["preview", "sandbox"]);
  assert.equal(
    (await f.send("/mappings", [{ ...expandedMappings[0], action: "unknown" }]))
      .status,
    400,
  );
  assert.equal(
    (await f.send("/mappings", expandedMappings, "wrong")).status,
    403,
  );
  assert.equal(f.writes.length, 1);
});

test("fighter API persists all 14 editable skills and rejects invalid new skill frame data", async () => {
  const f = await fixture();
  const fighter = {
    ...fighters[0],
    id: "",
    name: "Ability fixture",
    combat: {
      hurtbox: { width: 50, height: 140 },
      comboWindow: 45,
      comboMultiplier: 1,
      skills: structuredClone(defaultSkills),
    },
  };
  assert.equal((await f.send("/fighters", fighter)).status, 200);
  const saved = JSON.parse(f.writes[0].value).find(
    (item: { name: string }) => item.name === fighter.name,
  );
  assert.equal(Object.keys(saved.combat.skills).length, 14);
  fighter.combat.skills.meteor_dive!.damage = 99999;
  assert.equal((await f.send("/fighters", fighter)).status, 400);
  assert.equal(f.writes.length, 1);
});
