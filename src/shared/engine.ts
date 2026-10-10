import { tacticalSpecs, skillMechanics, skillActions } from "./abilities";
import {
  defaultSkills,
  actions,
  defaultMappings,
  defaultSettings,
  fighters,
  arenas,
  type Action,
  type Actor,
  type Command,
  type Control,
  type Fighter,
  type LiveEvent,
  type Mapping,
  type MatchState,
  type Settings,
  type Team,
} from "./model";
const other = (t: Team): Team => (t === "red" ? "blue" : "red");
function actor(f: Fighter, c: Control, x: number): Actor {
  return {
    fighter: structuredClone(f),
    control: c,
    x,
    y: 0,
    vy: 0,
    hp: f.hp,
    stamina: 100,
    energy: 0,
    shield: 0,
    state: "idle",
    until: 0,
    cooldown: 0,
    combo: 0,
    damage: 0,
    invulnerable: 0,
  };
}
export class Engine {
  state: MatchState;
  seen = new Map<string, number>();
  quotas = new Map<string, { at: number; count: number }>();
  mappings: Mapping[] = structuredClone(defaultMappings);
  lastAI: Record<Team, number> = { red: 0, blue: 0 };
  seed = 73421;
  constructor(environment = "preview", settings: Partial<Settings> = {}) {
    this.state = {
      id: crypto.randomUUID(),
      environment,
      status: "idle",
      tick: 0,
      time: 99,
      round: 1,
      scores: { red: 0, blue: 0 },
      winner: null,
      red: actor(fighters[0], "ai", 330),
      blue: actor(fighters[1], "ai", 670),
      arena: structuredClone(arenas[0]),
      settings: { ...defaultSettings, ...settings },
      queues: { red: [], blue: [] },
      members: {},
      contributions: {},
      logs: [],
      stats: { received: 0, rejected: 0, duplicate: 0, applied: 0 },
      rosters: { red: [fighters[0]], blue: [fighters[1]] },
      rosterIndex: { red: 0, blue: 0 },
    };
    this.state.time = this.state.settings.duration;
  }
  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  log(
    event: string,
    status: string,
    reason: string,
    team?: Team,
    action?: string,
    user?: string,
  ) {
    this.state.logs.unshift({
      id: crypto.randomUUID(),
      at: Date.now(),
      team,
      event,
      status,
      reason,
      action,
      user,
    });
    this.state.logs.length = Math.min(60, this.state.logs.length);
    return { status, reason, team, action };
  }
  lifecycle(action: string) {
    const s = this.state;
    if (action === "start") {
      if (s.status !== "idle")
        throw Error("Reset pertandingan sebelum memulai.");
      s.status = "running";
    } else if (action === "pause") {
      if (s.status !== "running")
        throw Error("Pertandingan tidak sedang berjalan.");
      s.status = "paused";
    } else if (action === "resume") {
      if (s.status !== "paused")
        throw Error("Pertandingan tidak sedang dijeda.");
      s.status = "running";
    } else if (action === "end") {
      if (s.status === "idle" || s.status === "finished")
        throw Error("Tidak ada pertandingan aktif.");
      this.finish(
        s.red.hp / s.red.fighter.hp === s.blue.hp / s.blue.fighter.hp
          ? "draw"
          : s.red.hp / s.red.fighter.hp > s.blue.hp / s.blue.fighter.hp
            ? "red"
            : "blue",
        true,
      );
    } else if (action === "reset") {
      const replacement = new Engine(s.environment, s.settings);
      replacement.state.red = actor(s.rosters.red[0], s.red.control, 330);
      replacement.state.blue = actor(s.rosters.blue[0], s.blue.control, 670);
      replacement.state.arena = s.arena;
      replacement.state.rosters = s.rosters;
      this.state = replacement.state;
      // Ingress dedup/quota windows belong to the room and survive match resets.
      this.lastAI = { red: 0, blue: 0 };
    } else if (action === "next") {
      if (s.status !== "round-over") throw Error("Ronde belum selesai.");
      s.round++;
      for (const t of ["red", "blue"] as Team[]) {
        if (s.settings.mode === "elimination" && s[t].hp <= 0)
          s.rosterIndex[t]++;
        const f = s.rosters[t][s.rosterIndex[t]] || s[t].fighter;
        s[t] = actor(f, s[t].control, t === "red" ? 330 : 670);
      }
      s.time = s.settings.duration;
      s.winner = null;
      s.queues = { red: [], blue: [] };
      s.status = "running";
    } else throw Error("Kontrol tidak dikenal.");
    return this.state;
  }
  configure(config: {
    red?: Fighter;
    blue?: Fighter;
    redControl?: Control;
    blueControl?: Control;
    arena?: MatchState["arena"];
    settings?: Partial<Settings>;
    rosters?: MatchState["rosters"];
  }) {
    if (this.state.status !== "idle")
      throw Error("Reset pertandingan sebelum mengganti konfigurasi.");
    const s = this.state;
    if (config.red) {
      s.red = actor(config.red, s.red.control, 330);
      s.rosters.red = [config.red];
    }
    if (config.blue) {
      s.blue = actor(config.blue, s.blue.control, 670);
      s.rosters.blue = [config.blue];
    }
    if (config.redControl) s.red.control = config.redControl;
    if (config.blueControl) s.blue.control = config.blueControl;
    if (config.arena) s.arena = structuredClone(config.arena);
    if (config.settings) {
      s.settings = { ...s.settings, ...config.settings };
      s.time = s.settings.duration;
    }
    if (config.rosters) {
      s.rosters = structuredClone(config.rosters);
      s.rosterIndex = { red: 0, blue: 0 };
      s.red = actor(s.rosters.red[0], s.red.control, 330);
      s.blue = actor(s.rosters.blue[0], s.blue.control, 670);
    }
  }
  event(e: LiveEvent, now = Date.now()) {
    const s = this.state;
    s.stats.received++;
    const reject = (reason: string) => {
      s.stats.rejected++;
      return this.log(
        e.event_type || "invalid",
        "rejected",
        reason,
        undefined,
        undefined,
        e.user_id,
      );
    };
    if (
      typeof e.event_id !== "string" ||
      e.event_id.length < 1 ||
      e.event_id.length > 128 ||
      typeof e.user_id !== "string" ||
      e.user_id.length < 1 ||
      e.user_id.length > 100 ||
      typeof e.occurred_at !== "string" ||
      (e.text !== undefined &&
        (typeof e.text !== "string" || e.text.length > 500)) ||
      (e.gift !== undefined &&
        (typeof e.gift !== "string" || e.gift.length > 100)) ||
      (e.count !== undefined &&
        (!Number.isInteger(e.count) || e.count < 1 || e.count > 1000)) ||
      (e.team !== undefined && !["red", "blue"].includes(e.team)) ||
      e.source !== "tiktok-live-konektor" ||
      !["comment", "gift", "like", "follow", "share"].includes(e.event_type)
    )
      return reject("Payload internal tidak valid.");
    const time = Date.parse(e.occurred_at);
    if (!Number.isFinite(time) || Math.abs(now - time) > 30000)
      return reject("Timestamp kedaluwarsa (>30 detik).");
    for (const [id, at] of this.seen)
      if (now - at > 60000) this.seen.delete(id);
    if (this.seen.has(e.event_id)) {
      s.stats.duplicate++;
      return this.log(
        e.event_type,
        "duplicate",
        "event_id sudah diproses.",
        undefined,
        undefined,
        e.user_id,
      );
    }
    this.seen.set(e.event_id, now);
    if (this.seen.size > 5000) this.seen.delete(this.seen.keys().next().value!);
    let q = this.quotas.get(e.user_id);
    if (!q || now - q.at > 1000) {
      q = { at: now, count: 0 };
      this.quotas.set(e.user_id, q);
    }
    if (++q.count > s.settings.userQuota)
      return reject("Kuota pengguna per detik tercapai.");
    if (this.quotas.size > 5000)
      for (const [id, v] of this.quotas)
        if (now - v.at > 30000) this.quotas.delete(id);
    const text = (e.text || "").trim().toLowerCase();
    const join = text === "!merah" ? "red" : text === "!biru" ? "blue" : null;
    if (join) {
      if (
        s.members[e.user_id] &&
        s.members[e.user_id] !== join &&
        !s.settings.allowSwitch
      )
        return reject("Perpindahan tim dikunci.");
      if (Object.keys(s.members).length >= 5000 && !s.members[e.user_id])
        return reject("Batas anggota tercapai.");
      s.members[e.user_id] = join;
      return this.log(
        "join",
        "accepted",
        "Keanggotaan tim disimpan.",
        join,
        undefined,
        e.user_id,
      );
    }
    let team = s.members[e.user_id];
    if (!team) {
      if (s.settings.unknown === "ignore")
        return reject("Pengguna belum bergabung ke tim.");
      if (Object.keys(s.members).length >= 5000)
        return reject("Batas anggota tercapai.");
      const n = Object.keys(s.members).length;
      team = e.team || (n % 2 === 0 ? "red" : "blue");
      s.members[e.user_id] = team;
    }
    if (s.status !== "running") return reject("Pertandingan tidak berjalan.");
    if (e.event_type === "gift" && e.streak_finished === false)
      return this.log("gift", "pending", "Menunggu gift streak selesai.", team);
    const m = this.mappings.find(
      (m) =>
        m.event === e.event_type &&
        (m.team === "any" || m.team === team) &&
        (!m.command ||
          (e.event_type === "comment"
            ? text === m.command.toLowerCase()
            : e.gift === m.command)),
    );
    if (!m) return reject("Tidak ada mapping yang cocok.");
    if (["manual", "ai"].includes(s[team].control))
      return reject("Mode fighter tidak menerima webhook.");
    const cmd: Command = {
      id: e.event_id,
      user: e.user_id,
      team,
      action: m.action,
      at: now,
      priority: m.priority,
      amount: Math.min(
        s.settings.rewardCap,
        m.amount * Math.max(1, Math.min(100, e.count || 1)),
      ),
      origin: "webhook",
    };
    if (s.queues[team].length >= s.settings.queueCap)
      return reject("Antrean tim penuh.");
    if (
      m.action === "energy" &&
      s.queues[team].some((c) => c.action === "energy" && c.user === e.user_id)
    ) {
      const existing = s.queues[team].find(
        (c) => c.action === "energy" && c.user === e.user_id,
      )!;
      existing.amount = Math.min(
        s.settings.rewardCap,
        existing.amount + cmd.amount,
      );
      return this.log(
        e.event_type,
        "merged",
        "Energi digabung dalam batas cap.",
        team,
        m.action,
        e.user_id,
      );
    }
    s.queues[team].push(cmd);
    return this.log(
      e.event_type,
      "queued",
      "Masuk antrean tim.",
      team,
      m.action,
      e.user_id,
    );
  }
  manual(team: Team, action: Action, now = Date.now()) {
    if (!["red", "blue"].includes(team)) throw Error("Tim tidak valid.");
    if (!actions.includes(action)) throw Error("Aksi tidak valid.");
    if (!["manual", "hybrid"].includes(this.state[team].control))
      throw Error("Fighter tidak menerima input manual.");
    if (this.state.status !== "running")
      throw Error("Pertandingan tidak berjalan.");
    if (this.state.queues[team].length >= this.state.settings.queueCap)
      throw Error("Antrean penuh.");
    this.state.queues[team].push({
      id: crypto.randomUUID(),
      user: "manual",
      team,
      action,
      at: now,
      priority: 10,
      amount: 1,
      origin: "manual",
    });
  }
  take(team: Team, now: number) {
    const s = this.state;
    const queue = s.queues[team];
    s.queues[team] = queue.filter((c) => {
      if (now - c.at > s.settings.ttl) {
        this.log(
          "command",
          "expired",
          "TTL perintah terlewati.",
          team,
          c.action,
          c.user,
        );
        s.stats.rejected++;
        return false;
      }
      return true;
    });
    const q = s.queues[team];
    if (!q.length) return undefined;
    if (s.settings.strategy === "priority")
      q.sort(
        (a, b) =>
          b.priority - a.priority || a.at - b.at || a.id.localeCompare(b.id),
      );
    if (s.settings.strategy === "voting") {
      if (now - q[0].at < s.settings.votingWindow) return undefined;
      const votes = new Map<Action, number>();
      for (const c of q) votes.set(c.action, (votes.get(c.action) || 0) + 1);
      const ranked = [...votes].sort(
        (a, b) => b[1] - a[1] || actions.indexOf(a[0]) - actions.indexOf(b[0]),
      );
      const selected = q.find((c) => c.action === ranked[0][0]);
      s.queues[team] = [];
      return selected;
    }
    return q.shift();
  }
  moveActor(a: Actor, b: Actor, delta: number) {
    const next = Math.max(90, Math.min(910, a.x + delta));
    a.x =
      Math.abs(a.y - b.y) > 80
        ? next
        : a.x < b.x
          ? Math.min(next, b.x - 65)
          : Math.max(next, b.x + 65);
  }
  act(team: Team, action: Action, amount = 1) {
    const s = this.state,
      a = s[team],
      b = s[other(team)],
      tick = s.tick;
    if (s.status !== "running" || a.hp <= 0 || a.until > tick) return false;
    if (["energy", "heal", "shield"].includes(action)) {
      if (s.settings.balance === "competitive" && action === "heal")
        return false;
      s.rewardBudget ||= {
        red: { window: -1, spent: 0 },
        blue: { window: -1, spent: 0 },
      };
      const budget = s.rewardBudget[team],
        window = Math.floor(tick / 30);
      if (budget.window !== window) {
        budget.window = window;
        budget.spent = 0;
      }
      const space =
        action === "energy"
          ? 100 - a.energy
          : action === "heal"
            ? a.fighter.hp - a.hp
            : s.settings.rewardCap - a.shield;
      const credit = Math.min(
        amount,
        s.settings.rewardCap - budget.spent,
        space,
      );
      if (credit <= 0) {
        this.log(
          "reward",
          "rejected",
          "Cap reward tim per detik atau batas resource tercapai.",
          team,
          action,
        );
        return false;
      }
      budget.spent += credit;
      if (action === "energy") a.energy += credit;
      if (action === "heal") a.hp += credit;
      if (action === "shield") a.shield += credit;
      return true;
    }
    if (action === "move_left" || action === "move_right") {
      this.moveActor(
        a,
        b,
        (action === "move_left" ? -1 : 1) *
          a.fighter.speed *
          0.13 *
          ((a.slowUntil || 0) > tick ? 0.55 : 1),
      );
      a.state = "move";
      a.until = tick + 2;
      return true;
    }
    if (action === "jump") {
      if (a.y !== 0 || a.stamina < 10) return false;
      a.vy = 11;
      a.stamina -= 10;
      a.state = "jump";
      a.until = tick + 3;
      return true;
    }
    if (action === "block") {
      a.state = "guard";
      a.until = tick + 12;
      return true;
    }
    if (action === "dodge") {
      if (a.stamina < 20) return false;
      a.stamina -= 20;
      a.invulnerable = tick + 10;
      a.until = tick + 12;
      a.state = "dodge";
      a.x = Math.max(90, Math.min(910, a.x + (a.x < b.x ? -1 : 1) * 65));
      return true;
    }
    const tactical = tacticalSpecs[action as keyof typeof tacticalSpecs];
    if (tactical) {
      if (a.stamina < tactical.cost || (a.cooldowns?.[action] || 0) > tick)
        return false;
      if (
        [
          "high_jump",
          "crouch",
          "parry",
          "focus",
          "taunt",
          "brace",
          "feint",
        ].includes(action) &&
        a.y > 0
      )
        return false;
      if (action === "air_dash" && (a.y <= 0 || a.airDashUsed)) return false;
      a.stamina -= tactical.cost;
      (a.cooldowns ||= {})[action] = tick + tactical.cooldown;
      a.until = tick + tactical.duration;
      a.state = action;
      const facing = a.x < b.x ? 1 : -1;
      const slow = (a.slowUntil || 0) > tick ? 0.55 : 1;
      if (action === "dash_forward" || action === "dash_back")
        this.moveActor(
          a,
          b,
          facing * (action === "dash_back" ? -85 : 85) * slow,
        );
      if (action === "high_jump") {
        a.vy = 13;
        a.airDashUsed = false;
      }
      if (action === "air_dash") {
        this.moveActor(a, b, facing * 100 * slow);
        a.vy = 2;
        a.airDashUsed = true;
      }
      if (action === "focus") a.pendingEnergy = 12;
      if (action === "taunt") a.pendingEnergy = 8;
      if (action === "feint") a.feintUntil = tick + 60;
      return true;
    }
    const mechanics = skillMechanics[action];
    if ((mechanics?.airborne && a.y <= 0) || (mechanics?.grounded && a.y > 0))
      return false;
    const spec = this.spec(action, a.fighter);
    if (
      !spec ||
      a.cooldown > tick ||
      (a.cooldowns?.[action] || 0) > tick ||
      a.stamina < spec.cost ||
      a.energy < spec.energy
    )
      return false;
    a.stamina -= spec.cost;
    a.energy -= spec.energy;
    a.state = "startup";
    const start =
      (a.feintUntil || 0) > tick
        ? Math.max(1, Math.floor(spec.start * 0.65))
        : spec.start;
    a.feintUntil = 0;
    const facing = a.x < b.x ? 1 : -1;
    if (mechanics?.dash)
      this.moveActor(
        a,
        b,
        facing * mechanics.dash * ((a.slowUntil || 0) > tick ? 0.55 : 1),
      );
    if (action === "meteor_dive") a.vy = -10;
    a.attack = { action, at: tick, hit: false, facing, start };
    a.until = tick + start + spec.active + spec.recovery;
    // Recovery locks all attacks; each ability also retains its own cooldown.
    a.cooldown = a.until;
    (a.cooldowns ||= {})[action] = tick + spec.cooldown;
    return true;
  }
  spec(action: Action, fighter?: Fighter) {
    return fighter?.combat?.skills?.[action] || defaultSkills[action];
  }
  step(now = Date.now()) {
    const s = this.state;
    if (s.status !== "running") return;
    s.tick++;
    s.time = Math.max(0, s.time - 1 / 30);
    for (const team of ["red", "blue"] as Team[]) {
      const a = s[team],
        b = s[other(team)];
      if (s.tick - (a.lastHitTick || 0) > (a.fighter.combat?.comboWindow || 45))
        a.combo = 0;
      a.stamina = Math.min(100, a.stamina + 0.23);
      a.energy = Math.min(100, a.energy + 0.045);
      if (a.y > 0 || a.vy > 0) {
        a.y = Math.max(0, a.y + a.vy);
        a.vy -= 0.65;
        if (a.y === 0) {
          a.vy = 0;
          a.airDashUsed = false;
        }
      }
      if (a.attack) {
        const attack = a.attack;
        const spec = this.spec(attack.action, a.fighter)!;
        const mechanics = skillMechanics[attack.action];
        const startup = attack.start ?? spec.start;
        const age = s.tick - attack.at;
        a.state =
          age < startup
            ? "startup"
            : age < startup + spec.active
              ? "active"
              : "recovery";
        if (
          age >= startup &&
          age < startup + spec.active &&
          !a.attack.hit &&
          b.invulnerable < s.tick &&
          Math.abs(a.x - b.x) <=
            spec.range + (b.fighter.combat?.hurtbox.width || 50) / 2 - 25 &&
          (mechanics?.omnidirectional ||
            (b.x - a.x) * (attack.facing || 1) >= -25) &&
          !(mechanics?.high && b.state === "crouch") &&
          Math.abs(a.y - b.y) <
            (b.fighter.combat?.hurtbox.height || 140) *
              (b.state === "crouch" ? 0.4 : 0.64)
        ) {
          a.attack.hit = true;
          if (b.state === "parry" && b.until > s.tick) {
            a.attack = undefined;
            a.pendingEnergy = undefined;
            a.state = "hit";
            a.until = s.tick + 16;
            b.state = "idle";
            b.until = s.tick + 3;
            b.energy = Math.min(100, b.energy + 6);
            this.log(
              "parry",
              "applied",
              "Parry berhasil; penyerang terkena stun.",
              other(team),
              attack.action,
            );
          } else {
            const guarding = b.state === "guard";
            const braced = b.state === "brace";
            const mitigation = guarding
              ? (mechanics?.guardPierce ?? 0.18)
              : braced
                ? mechanics?.guardPierce === 1
                  ? 1
                  : 0.45
                : 1;
            let damage = Math.round(
              ((spec.damage * a.fighter.attack) / b.fighter.defense) *
                s.settings.damageScale *
                (a.combo > 0 ? a.fighter.combat?.comboMultiplier || 1 : 1) *
                mitigation,
            );
            const shield = Math.min(b.shield, damage);
            b.shield -= shield;
            damage -= shield;
            b.hp = Math.max(0, b.hp - damage);
            a.damage += damage;
            s.totalDamage ||= { red: 0, blue: 0 };
            s.totalDamage[team] += damage;
            a.energy = Math.min(100, a.energy + 9);
            a.combo = guarding ? 0 : Math.min(5, a.combo + 1);
            a.lastHitTick = s.tick;
            b.combo = 0;
            if ((!guarding && !braced) || mechanics?.guardPierce === 1) {
              b.attack = undefined;
              b.state = b.hp <= 0 ? "ko" : "hit";
              b.pendingEnergy = undefined;
              b.feintUntil = 0;
              b.until = s.tick + (mechanics?.stun || 8);
              this.moveActor(
                b,
                a,
                (b.x > a.x ? 1 : -1) * (mechanics?.knockback || 18),
              );
              if (mechanics?.launch && b.hp > 0) b.vy = mechanics.launch;
              if (mechanics?.slow) b.slowUntil = s.tick + mechanics.slow;
              if (mechanics?.drain)
                b.energy = Math.max(0, b.energy - mechanics.drain);
            }
            this.log(
              "hit",
              "applied",
              guarding ? "Serangan ditahan." : `${damage} damage`,
              team,
              attack.action,
            );
          }
        }
        if (a.attack && s.tick >= a.until) {
          if (!a.attack.hit)
            this.log(
              "miss",
              "completed",
              "Serangan tidak mengenai hurtbox lawan.",
              team,
              a.attack.action,
            );
          a.attack = undefined;
          a.state = "idle";
        }
      } else if (s.tick >= a.until && a.state !== "ko") {
        if (a.pendingEnergy) {
          a.energy = Math.min(100, a.energy + a.pendingEnergy);
          a.pendingEnergy = undefined;
        }
        a.state = a.y > 0 ? "jump" : "idle";
      }
      if (!a.attack && a.until <= s.tick) {
        const cmd = this.take(team, now);
        if (cmd) {
          const ok = this.act(team, cmd.action, cmd.amount);
          this.log(
            "command",
            ok ? "applied" : "rejected",
            ok
              ? "Aksi dieksekusi."
              : "Cooldown, stamina, energi atau state tidak memenuhi.",
            team,
            cmd.action,
            cmd.user,
          );
          if (ok) {
            s.stats.applied++;
            if (cmd.origin === "webhook")
              s.contributions[cmd.user] = (s.contributions[cmd.user] || 0) + 1;
          } else s.stats.rejected++;
        } else if (
          ["ai", "ai-webhook", "hybrid"].includes(a.control) &&
          s.tick - this.lastAI[team] >
            { easy: 14, normal: 8, hard: 4 }[s.settings.difficulty]
        ) {
          this.lastAI[team] = s.tick;
          const distance = Math.abs(a.x - b.x),
            r = this.random();
          const defensive = a.fighter.personality === "defensive";
          let action: Action =
            distance > 130
              ? a.x < b.x
                ? "move_right"
                : "move_left"
              : r < (defensive ? 0.3 : 0.14)
                ? "block"
                : a.energy >= 100
                  ? "ultimate"
                  : a.energy >= 25 && r > 0.6
                    ? "special_attack"
                    : r > 0.65
                      ? "heavy_attack"
                      : "light_attack";
          if (r > 0.76 && a.energy >= 15) {
            const available = skillActions.filter((key) => {
              const spec = this.spec(key, a.fighter)!;
              const m = skillMechanics[key];
              return (
                a.energy >= spec.energy &&
                a.stamina >= spec.cost &&
                (a.cooldowns?.[key] || 0) <= s.tick &&
                distance <= spec.range + (m?.dash || 0) &&
                (!m?.airborne || a.y > 0) &&
                (!m?.grounded || a.y === 0)
              );
            });
            if (available.length)
              action = available[Math.floor(this.random() * available.length)];
          } else if (r < 0.06 && a.y === 0)
            action = distance < 170 ? "parry" : "focus";
          else if (distance > 200 && r > 0.58) action = "dash_forward";
          this.act(team, action);
        }
      }
    }
    if (
      s.arena.hazard &&
      s.settings.balance !== "competitive" &&
      s.tick % 60 === 0
    ) {
      for (const team of ["red", "blue"] as Team[]) {
        const a = s[team];
        if (
          a.y < 20 &&
          Math.abs(a.x - (s.arena.hazardX || 500)) <=
            (s.arena.hazardRadius || 70)
        ) {
          const damage = s.arena.hazardDamage || 10;
          a.hp = Math.max(0, a.hp - damage);
          this.log("hazard", "applied", `${damage} arena damage`, team);
        }
      }
    }
    if (s.red.hp <= 0 || s.blue.hp <= 0)
      this.finish(
        s.red.hp === s.blue.hp ? "draw" : s.red.hp > s.blue.hp ? "red" : "blue",
      );
    else if (s.time <= 0) {
      const r = s.red.hp / s.red.fighter.hp,
        b = s.blue.hp / s.blue.fighter.hp;
      this.finish(Math.abs(r - b) < 0.00001 ? "draw" : r > b ? "red" : "blue");
    }
  }
  finish(winner: Team | "draw", force = false) {
    const s = this.state;
    s.winner = winner;
    if (winner !== "draw") s.scores[winner]++;
    const classic =
      s.settings.mode === "classic" &&
      Math.max(s.scores.red, s.scores.blue) >= Math.ceil(s.settings.bestOf / 2);
    const elimination =
      s.settings.mode === "elimination" &&
      (["red", "blue"] as Team[]).some(
        (t) => s[t].hp <= 0 && s.rosterIndex[t] + 1 >= s.rosters[t].length,
      );
    s.status = force || classic || elimination ? "finished" : "round-over";
    s.queues = { red: [], blue: [] };
    for (const t of ["red", "blue"] as Team[]) {
      s[t].attack = undefined;
      s[t].state = s[t].hp <= 0 ? "ko" : winner === t ? "victory" : "idle";
    }
    this.log(
      "round",
      "completed",
      winner === "draw"
        ? "Seri — ronde berikutnya harus dimulai admin."
        : `${s[winner].fighter.name} memenangkan ronde.`,
      winner === "draw" ? undefined : winner,
    );
  }
}
