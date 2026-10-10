import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "./engine";
import {
  actions,
  defaultSkills,
  fighters,
  defaultMappings,
  expandedMappings,
  mergeMappings,
  validateFighter,
  type Action,
} from "./model";
import {
  tacticalActions,
  skillActions,
  tacticalSpecs,
  abilityCommand,
} from "./abilities";

function arena() {
  const e = new Engine();
  e.configure({ redControl: "manual", blueControl: "manual" });
  e.lifecycle("start");
  e.state.red.x = 430;
  e.state.blue.x = 550;
  e.state.red.energy = 100;
  e.state.blue.energy = 80;
  return e;
}
function ticks(e: Engine, n: number) {
  for (let i = 0; i < n; i++) e.step();
}

test("20 new commands are unique, existing mappings import once and every custom skill validates", () => {
  assert.equal(actions.length, 32);
  assert.equal(new Set(actions).size, 32);
  assert.equal(tacticalActions.length, 10);
  assert.equal(skillActions.length, 10);
  assert.equal(Object.keys(defaultSkills).length, 14);
  const custom = { ...defaultMappings[0], id: "custom", command: "!mine" };
  const merged = mergeMappings([custom]);
  assert.equal(merged.length, 21);
  assert.deepEqual(mergeMappings(merged), merged);
  assert.deepEqual(merged[0], custom);
  assert.equal(new Set(expandedMappings.map((m) => m.command)).size, 20);
  const f = structuredClone(fighters[0]);
  f.combat = {
    hurtbox: { width: 50, height: 140 },
    comboWindow: 45,
    comboMultiplier: 1,
    skills: structuredClone(defaultSkills),
  };
  assert.deepEqual(validateFighter(f), []);
  f.combat.skills.frost_lance!.cooldown = 6;
  assert.ok(validateFighter(f).some((error) => error.includes("frost_lance")));
});

for (const action of skillActions) {
  test(`${action}: costs and startup are authoritative, damage once and per-skill cooldown blocks replay`, () => {
    const e = arena();
    const a = e.state.red,
      b = e.state.blue;
    if (action === "meteor_dive") {
      a.y = 75;
      a.vy = 0;
    }
    const spec = defaultSkills[action]!;
    const hp = b.hp;
    assert.equal(e.act("red", action), true);
    assert.equal(a.energy, 100 - spec.energy);
    assert.equal(a.stamina, 100 - spec.cost);
    ticks(e, spec.start - 1);
    assert.equal(b.hp, hp);
    ticks(e, 1);
    assert.equal(
      b.hp,
      hp - Math.round((spec.damage * a.fighter.attack) / b.fighter.defense),
    );
    const hitHP = b.hp;
    ticks(e, spec.active + spec.recovery);
    assert.equal(b.hp, hitHP);
    a.energy = 100;
    a.stamina = 100;
    if (action === "meteor_dive") a.y = 50;
    assert.equal(e.act("red", action), false);
    assert.equal(e.state.totalDamage?.red, hp - hitHP);
  });
}

test("dash collision, high jump and once-per-jump air dash obey geometry and stamina", () => {
  const e = arena();
  const a = e.state.red,
    b = e.state.blue;
  e.act("red", "dash_forward");
  assert.equal(a.x, b.x - 65);
  ticks(e, 6);
  e.act("red", "dash_back");
  assert.equal(a.x, b.x - 150);
  ticks(e, 6);
  assert.equal(e.act("red", "air_dash"), false);
  assert.equal(e.act("red", "high_jump"), true);
  ticks(e, 5);
  assert.ok(a.y > 40);
  assert.equal(e.act("red", "air_dash"), true);
  ticks(e, 36);
  assert.equal(e.act("red", "air_dash"), false);
  const empty = arena();
  empty.state.red.stamina = 0;
  for (const action of tacticalActions)
    assert.equal(empty.act("red", action), false);
});

test("parry has a narrow window, interrupts attacker, grants capped energy and cannot be spammed", () => {
  const e = arena();
  const hp = e.state.blue.hp;
  e.act("blue", "parry");
  e.act("red", "light_attack");
  ticks(e, 3);
  assert.equal(e.state.blue.hp, hp);
  assert.equal(e.state.red.state, "hit");
  assert.equal(e.state.red.attack, undefined);
  assert.ok(e.state.blue.energy > 85 && e.state.blue.energy <= 100);
  ticks(e, 7);
  assert.equal(e.act("blue", "parry"), false);
  const late = arena();
  late.act("blue", "parry");
  ticks(late, 7);
  late.act("red", "light_attack");
  ticks(late, 3);
  assert.ok(late.state.blue.hp < hp);
});

test("focus and taunt grant energy only on completion, are interrupted by hits, and stay bounded", () => {
  for (const action of ["focus", "taunt"] as const) {
    const e = arena();
    e.state.red.energy = 0;
    e.act("red", action);
    ticks(e, 10);
    assert.ok(e.state.red.energy < 1);
    e.act("blue", "light_attack");
    ticks(e, 30);
    assert.equal(e.state.red.pendingEnergy, undefined);
    assert.ok(e.state.red.energy < 3);
    const done = arena();
    done.state.red.energy = 0;
    done.act("red", action);
    ticks(done, tacticalSpecs[action].duration);
    assert.ok(done.state.red.energy >= (action === "focus" ? 12 : 8));
    assert.equal(done.state.red.pendingEnergy, undefined);
  }
});

test("feint changes the next startup once, expires, and brace mitigates without granting invulnerability", () => {
  const e = arena();
  e.act("red", "feint");
  ticks(e, 4);
  e.act("red", "heavy_attack");
  assert.equal(e.state.red.attack?.start, 4);
  assert.equal(e.state.red.feintUntil, 0);
  const expired = arena();
  expired.act("red", "feint");
  ticks(expired, 61);
  expired.act("red", "heavy_attack");
  assert.equal(expired.state.red.attack?.start, 7);
  const brace = arena();
  brace.act("blue", "brace");
  brace.act("red", "light_attack");
  ticks(brace, 3);
  assert.equal(
    brace.state.blue.hp,
    1000 - Math.round(((45 * 105) / 95) * 0.45),
  );
  assert.equal(brace.state.blue.state, "brace");
});

test("skills apply slow/stun/launch/drain, piercing bypasses guard but respects shield, crouch avoids high wave", () => {
  for (const action of [
    "frost_lance",
    "thunder_strike",
    "rising_slash",
    "crescent_wave",
  ] as const) {
    const e = arena();
    e.act("red", action);
    ticks(e, defaultSkills[action]!.start);
    if (action === "frost_lance") {
      assert.ok(e.state.blue.slowUntil! > e.state.tick);
      ticks(e, 9);
      const x = e.state.blue.x;
      e.act("blue", "move_right");
      assert.ok(e.state.blue.x - x < e.state.blue.fighter.speed * 0.13);
    }
    if (action === "thunder_strike")
      assert.equal(e.state.blue.until - e.state.tick, 14);
    if (action === "rising_slash") assert.ok(e.state.blue.y > 0);
    if (action === "crescent_wave") assert.ok(e.state.blue.energy < 66);
  }
  const piercing = arena();
  piercing.state.blue.shield = 30;
  piercing.act("blue", "block");
  piercing.act("red", "piercing_thrust");
  ticks(piercing, 6);
  assert.equal(
    piercing.state.blue.hp,
    1000 - Math.round((105 * 105) / 95) + 30,
  );
  assert.equal(piercing.state.blue.shield, 0);
  const crouch = arena();
  crouch.act("blue", "crouch");
  crouch.act("red", "crescent_wave");
  ticks(crouch, 12);
  assert.equal(crouch.state.blue.hp, 1000);
  const grounded = arena();
  assert.equal(grounded.act("red", "meteor_dive"), false);
  grounded.state.red.y = 40;
  assert.equal(grounded.act("red", "earth_shatter"), false);
});

test("whirlwind hits behind cached facing; other skill attacks do not, and out-of-range attacks miss", () => {
  const spin = arena();
  spin.act("red", "whirlwind");
  spin.state.blue.x = 330;
  ticks(spin, 8);
  assert.ok(spin.state.blue.hp < 1000);
  const forward = arena();
  forward.act("red", "piercing_thrust");
  forward.state.blue.x = 330;
  ticks(forward, 6);
  assert.equal(forward.state.blue.hp, 1000);
  for (const action of skillActions) {
    const miss = arena();
    miss.state.red.x = 90;
    miss.state.blue.x = 910;
    if (action === "meteor_dive") miss.state.red.y = 60;
    miss.act("red", action);
    ticks(miss, 45);
    assert.equal(miss.state.blue.hp, 1000, action);
  }
});

test("all added LIVE commands route once and obey manual lifecycle; AI selection remains deterministic", () => {
  for (const action of [...tacticalActions, ...skillActions]) {
    const e = arena();
    e.state.red.control = "webhook";
    e.state.members.viewer = "red";
    const event = {
      event_id: action,
      user_id: "viewer",
      source: "tiktok-live-konektor",
      event_type: "comment",
      text: abilityCommand(action),
      occurred_at: new Date().toISOString(),
    };
    assert.equal(e.event(event).status, "queued");
    assert.equal(e.state.queues.red[0].action, action);
    assert.equal(e.event(event).status, "duplicate");
  }
  const idle = new Engine();
  assert.equal(idle.act("red", "focus"), false);
  const one = new Engine(),
    two = new Engine();
  one.lifecycle("start");
  two.lifecycle("start");
  for (let i = 0; i < 300; i++) {
    one.step(100000 + i * 33);
    two.step(100000 + i * 33);
  }
  assert.deepEqual(one.state.red, two.state.red);
  assert.deepEqual(one.state.blue, two.state.blue);
});
