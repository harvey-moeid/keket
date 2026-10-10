import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { type Env } from "./index";
import { expandedMappings, fighters, defaultSkills } from "../shared/model";

function fixture() {
  const writes: { key: string; value: string }[] = [];
  const rooms: string[] = [];
  const env = {
    APP_ENV: "preview",
    DB: {
      prepare(query: string) {
        let bindings: unknown[] = [];
        return {
          bind(...args: unknown[]) {
            bindings = args;
            return this;
          },
          async first() {
            return query.includes("FROM sessions")
              ? {
                  id: "00000000-0000-4000-8000-000000000000",
                  csrf: "test-only-csrf",
                  expires: Date.now() + 10000,
                }
              : null;
          },
          async run() {
            writes.push({
              key: bindings[0] as string,
              value: bindings[1] as string,
            });
            return { success: true };
          },
        };
      },
    },
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
  return { send, writes, rooms };
}

test("admin mapping API accepts all 20 new abilities, updates both rooms and retains validation/CSRF", async () => {
  const f = fixture();
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
  const f = fixture();
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
