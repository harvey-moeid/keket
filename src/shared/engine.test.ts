import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "./engine";
import { fighters, validateFighter, type LiveEvent } from "./model";
const event = (
  id: string,
  user: string,
  text: string,
  now: number,
): LiveEvent => ({
  event_id: id,
  user_id: user,
  source: "tiktok-live-konektor",
  event_type: "comment",
  text,
  occurred_at: new Date(now).toISOString(),
});
test("one LIVE routes membership to the correct fighter and deduplicates before damage", () => {
  const e = new Engine();
  e.configure({ redControl: "webhook", blueControl: "webhook" });
  e.lifecycle("start");
  const now = 100000;
  e.event(event("join-r", "alice", "!merah", now), now);
  e.event(event("join-b", "bob", "!biru", now), now);
  assert.equal(e.event(event("a1", "alice", "!attack", now), now).team, "red");
  assert.equal(e.state.queues.red.length, 1);
  assert.equal(e.state.queues.blue.length, 0);
  assert.equal(
    e.event(event("a1", "alice", "!attack", now), now).status,
    "duplicate",
  );
  assert.equal(e.state.queues.red.length, 1);
  e.state.red.x = 430;
  e.state.blue.x = 530;
  for (let i = 0; i < 20; i++) e.step(now + i * 33);
  assert.equal(e.state.red.hp, 1000);
  assert.equal(e.state.blue.hp, 950);
  assert.equal(e.state.stats.applied, 1);
});
test("lifecycle is manual; pause freezes combat and next round requires a completed round", () => {
  const e = new Engine();
  assert.throws(() => e.lifecycle("next"));
  const x = e.state.red.x;
  e.step();
  assert.equal(e.state.red.x, x);
  e.lifecycle("start");
  e.lifecycle("pause");
  const tick = e.state.tick;
  e.step();
  assert.equal(e.state.tick, tick);
  e.lifecycle("resume");
  e.state.blue.hp = 0;
  e.step();
  assert.equal(e.state.status, "round-over");
  const before = e.state.tick;
  e.step();
  assert.equal(e.state.tick, before);
  e.lifecycle("next");
  assert.equal(e.state.round, 2);
  assert.equal(e.state.status, "running");
  e.lifecycle("end");
  assert.equal(e.state.status, "finished");
  assert.throws(() => e.lifecycle("start"));
});
test("priority, TTL and voting are deterministic and do not double execute a burst", () => {
  const e = new Engine();
  e.configure({ redControl: "webhook", settings: { strategy: "priority" } });
  e.lifecycle("start");
  e.state.queues.red = [
    {
      id: "b",
      user: "b",
      team: "red",
      action: "jump",
      at: 1000,
      priority: 1,
      amount: 1,
      origin: "webhook",
    },
    {
      id: "a",
      user: "a",
      team: "red",
      action: "block",
      at: 1000,
      priority: 3,
      amount: 1,
      origin: "webhook",
    },
  ];
  assert.equal(e.take("red", 1100)?.action, "block");
  assert.equal(e.take("red", 5000), undefined);
  assert.equal(e.state.stats.rejected, 1);
  e.state.settings.strategy = "voting";
  e.state.queues.red = Array.from({ length: 3 }, (_, i) => ({
    id: String(i),
    user: String(i),
    team: "red",
    action: i === 0 ? "block" : "light_attack",
    at: 6000,
    priority: 0,
    amount: 1,
    origin: "webhook",
  }));
  assert.equal(e.take("red", 6200), undefined);
  assert.equal(e.take("red", 6600)?.action, "light_attack");
  assert.equal(e.state.queues.red.length, 0);
});
test("guards reduce damage, special requires energy and invulnerability avoids hits", () => {
  const e = new Engine();
  e.configure({ redControl: "manual", blueControl: "manual" });
  e.lifecycle("start");
  e.state.red.x = 450;
  e.state.blue.x = 550;
  assert.equal(e.act("red", "ultimate"), false);
  e.act("blue", "block");
  e.act("red", "light_attack");
  for (let i = 0; i < 6; i++) e.step();
  assert.ok(e.state.blue.hp > 980);
  const e2 = new Engine();
  e2.configure({ redControl: "manual", blueControl: "manual" });
  e2.lifecycle("start");
  e2.state.red.x = 450;
  e2.state.blue.x = 550;
  e2.state.blue.invulnerable = 100;
  e2.act("red", "light_attack");
  for (let i = 0; i < 15; i++) e2.step();
  assert.equal(e2.state.blue.hp, 1000);
});
test("team lock, timestamp, quota and competitive heal enforce boundaries", () => {
  const e = new Engine();
  const now = 100000;
  e.event(event("a", "u", "!merah", now), now);
  assert.equal(e.event(event("b", "u", "!biru", now), now).status, "rejected");
  assert.equal(e.state.members.u, "red");
  assert.equal(e.event(event("c", "u", "!attack", 0), now).status, "rejected");
  e.lifecycle("start");
  e.state.red.hp = 500;
  assert.equal(e.act("red", "heal", 50), false);
  assert.equal(e.state.red.hp, 500);
  assert.equal(
    e.event(event("d", "u", "!attack", now), now).status,
    "rejected",
  );
});
test("match fighter snapshot survives roster edits; elimination advances manually", () => {
  const e = new Engine();
  const f = structuredClone(fighters[0]);
  e.configure({
    red: f,
    rosters: { red: [f, fighters[2]], blue: [fighters[1], fighters[3]] },
    settings: { mode: "elimination" },
  });
  f.attack = 150;
  assert.equal(e.state.red.fighter.attack, 105);
  e.lifecycle("start");
  e.state.red.hp = 0;
  e.step();
  assert.equal(e.state.status, "round-over");
  e.lifecycle("next");
  assert.equal(e.state.red.fighter.id, "yuki");
  e.state.red.hp = 0;
  e.step();
  assert.equal(e.state.status, "finished");
});
test("uploaded sprites require complete animation metadata", () => {
  const f = {
    ...fighters[0],
    asset: "/api/assets/test.png",
    frameWidth: 128,
    frameHeight: 128,
  };
  assert.equal(validateFighter(f).length, 9);
  assert.equal(validateFighter(fighters[0]).length, 0);
});
test("custom frame data, hurtbox and combo validation preserve combat limits", () => {
  const f = structuredClone(fighters[0]);
  f.combat = {
    hurtbox: { width: 50, height: 140 },
    comboWindow: 45,
    comboMultiplier: 1.2,
    skills: {
      light_attack: {
        damage: 45,
        range: 145,
        start: 3,
        active: 3,
        recovery: 6,
        cooldown: 12,
        cost: 7,
        energy: 0,
      },
    },
  };
  assert.equal(validateFighter(f).length, 0);
  const e = new Engine();
  e.configure({ red: f, redControl: "manual", blueControl: "manual" });
  e.lifecycle("start");
  e.state.red.x = 450;
  e.state.blue.x = 550;
  e.act("red", "light_attack");
  for (let i = 0; i < 13; i++) e.step();
  const first = e.state.blue.hp;
  e.act("red", "light_attack");
  for (let i = 0; i < 10; i++) e.step();
  assert.ok(first - e.state.blue.hp > 1000 - first);
  f.combat.skills.light_attack!.damage = 10000;
  assert.ok(validateFighter(f).some((v) => v.includes("damage")));
});
test("arena hazard is authoritative and disabled in competitive mode", () => {
  const e = new Engine();
  e.configure({
    redControl: "manual",
    blueControl: "manual",
    arena: {
      ...e.state.arena,
      hazard: true,
      hazardX: 330,
      hazardRadius: 70,
      hazardDamage: 10,
    },
  });
  e.lifecycle("start");
  for (let i = 0; i < 60; i++) e.step();
  assert.equal(e.state.red.hp, 1000);
  e.state.settings.balance = "support";
  for (let i = 0; i < 60; i++) e.step();
  assert.equal(e.state.red.hp, 990);
  assert.equal(e.state.blue.hp, 1000);
});

test("deduplication survives a match reset within the ingress replay window", () => {
  const e = new Engine();
  const now = 100000;
  const ev = event("stable-id", "viewer", "!merah", now);
  assert.equal(e.event(ev, now).status, "accepted");
  e.lifecycle("reset");
  assert.equal(e.event(ev, now + 100).status, "duplicate");
});
test("classic finishes at the majority score and timeout draws never auto advance", () => {
  const e = new Engine();
  e.configure({ redControl: "manual", blueControl: "manual" });
  e.lifecycle("start");
  e.state.blue.hp = 0;
  e.step();
  assert.equal(e.state.status, "round-over");
  e.lifecycle("next");
  e.state.blue.hp = 0;
  e.step();
  assert.equal(e.state.status, "finished");
  assert.equal(e.state.scores.red, 2);
  const draw = new Engine();
  draw.lifecycle("start");
  draw.state.time = 0;
  draw.step();
  assert.equal(draw.state.winner, "draw");
  assert.equal(draw.state.status, "round-over");
  assert.equal(draw.state.scores.red + draw.state.scores.blue, 0);
});

test("reward budget caps a whole team per simulation second, even across different users", () => {
  const e = new Engine();
  e.configure({
    redControl: "webhook",
    blueControl: "webhook",
    settings: { rewardCap: 50, balance: "support" },
  });
  e.lifecycle("start");
  assert.equal(e.act("red", "energy", 50), true);
  assert.equal(e.act("red", "shield", 20), false);
  assert.equal(e.state.red.shield, 0);
  assert.equal(e.act("blue", "shield", 20), true);
  for (let i = 0; i < 30; i++) e.step();
  assert.equal(e.act("red", "shield", 20), true);
  assert.equal(e.state.red.shield, 20);
});
