import { Engine } from "../shared/engine";
import { adaptTikTokEvent, verifyTikTokSignature } from "./tiktok";
import {
  arenas,
  actions,
  fighters,
  defaultMappings,
  defaultSettings,
  validateFighter,
  type Fighter,
  type Arena,
  type Settings,
  type Mapping,
  type MatchState,
  type Team,
  type Control,
  type Action,
} from "../shared/model";
import {
  constantEqual,
  verifyPassword,
  imageSize,
  validImageContainer,
  readLimited,
} from "./security";
export interface Env {
  ROOMS: DurableObjectNamespace;
  DB: D1Database;
  ASSET_BUCKET: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD_HASH: string;
  WEBHOOK_SECRET: string;
  WEBHOOK_SIGNING_SECRET?: string;
  TIKTOK_ROOM_ID?: string;
  APP_ENV: string;
}
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function body(req: Request) {
  return JSON.parse(new TextDecoder().decode(await readLimited(req, 65536)));
}
async function readDoc<T>(env: Env, key: string, fallback: T): Promise<T> {
  const r = await env.DB.prepare("SELECT value FROM documents WHERE key=?")
    .bind(key)
    .first<{ value: string }>();
  return r ? JSON.parse(r.value) : structuredClone(fallback);
}
async function saveDoc(env: Env, key: string, value: unknown) {
  await env.DB.prepare(
    "INSERT INTO documents (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
  )
    .bind(key, JSON.stringify(value), new Date().toISOString())
    .run();
}
function publicState(s: MatchState) {
  return {
    ...s,
    members: {},
    contributions: {},
    logs: [],
    queues: {
      red: s.queues.red.map((c) => ({ action: c.action })),
      blue: s.queues.blue.map((c) => ({ action: c.action })),
    },
  };
}
export class MatchRoom {
  engine: Engine;
  timer?: ReturnType<typeof setInterval>;
  clients = new Set<WebSocket>();
  persistTick = 0;
  archived = new Set<string>();
  burst = { at: 0, count: 0 };
  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {
    this.engine = new Engine(
      ctx.id.name === "sandbox" ? "sandbox" : env.APP_ENV,
    );
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS room_snapshot (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
      );
      ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS event_dedup (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL)",
      );
      ctx.storage.sql.exec(
        "CREATE INDEX IF NOT EXISTS event_dedup_time ON event_dedup(created_at)",
      );
      const row = ctx.storage.sql
        .exec<{
          value: string;
        }>("SELECT value FROM room_snapshot WHERE key='state'")
        .toArray()[0];
      if (row) {
        const saved = JSON.parse(row.value);
        this.engine.state = saved.state;
        this.engine.seed = saved.seed ?? 73421;
        this.engine.lastAI = saved.lastAI || { red: 0, blue: 0 };
      } else {
        const previous = await ctx.storage.get<MatchState>("state");
        if (previous) this.engine.state = previous;
        const dedup = await ctx.storage.get<[string, number][]>("dedup");
        for (const [id, at] of dedup || [])
          ctx.storage.sql.exec(
            "INSERT OR IGNORE INTO event_dedup VALUES (?,?)",
            id,
            at,
          );
      }
      if (this.engine.state.status === "running")
        this.engine.state.status = "paused";
      this.persistTick = this.engine.state.tick;
      this.engine.mappings = await readDoc(env, "mappings", defaultMappings);
      const dedup = ctx.storage.sql
        .exec<{ id: string; created_at: number }>(
          "SELECT id,created_at FROM event_dedup WHERE created_at>? ORDER BY created_at DESC,rowid DESC LIMIT 5000",
          Date.now() - 60000,
        )
        .toArray()
        .reverse();
      this.engine.seen = new Map(dedup.map((r) => [r.id, r.created_at]));
    });
  }
  broadcast() {
    const data = JSON.stringify({
      type: "state",
      state: publicState(this.engine.state),
    });
    for (const ws of this.clients) {
      try {
        ws.send(data);
      } catch {
        this.clients.delete(ws);
      }
    }
  }
  startTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.engine.step();
      if (this.engine.state.tick % 3 === 0) this.broadcast();
      if (this.engine.state.tick - this.persistTick >= 60) {
        this.persistTick = this.engine.state.tick;
        this.ctx.waitUntil(this.persist());
      }
      if (this.engine.state.status !== "running") {
        clearInterval(this.timer);
        this.timer = undefined;
        this.broadcast();
        this.ctx.waitUntil(this.persist());
      }
    }, 1000 / 30);
  }
  async persist() {
    // Capture before awaiting D1 so a fast reset cannot replace the finished result.
    const s = structuredClone(this.engine.state);
    this.persistTick = s.tick;
    this.ctx.storage.sql.exec(
      "INSERT INTO room_snapshot VALUES ('state',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      JSON.stringify({
        state: s,
        seed: this.engine.seed,
        lastAI: this.engine.lastAI,
      }),
    );
    if (
      s.status === "finished" &&
      !this.archived.has(s.id) &&
      s.environment !== "sandbox"
    ) {
      await this.env.DB.prepare(
        "INSERT OR IGNORE INTO matches (id,environment,result,ended_at) VALUES (?,?,?,?)",
      )
        .bind(
          s.id,
          s.environment,
          JSON.stringify({ ...s, logs: [], queues: { red: [], blue: [] } }),
          new Date().toISOString(),
        )
        .run();
      this.archived.add(s.id);
      if (this.archived.size > 1000)
        this.archived.delete(this.archived.values().next().value!);
      await this.env.DB.prepare("DELETE FROM matches WHERE ended_at < ?")
        .bind(
          new Date(
            Date.now() - s.settings.retentionDays * 86400000,
          ).toISOString(),
        )
        .run();
    }
  }
  async fetch(req: Request) {
    const url = new URL(req.url);
    const roomKind = req.headers.get("X-Internal-Room");
    if (roomKind === "sandbox" || roomKind === this.env.APP_ENV)
      this.engine.state.environment = roomKind;
    try {
      if (url.pathname.endsWith("/ws")) {
        if (req.headers.get("Upgrade") !== "websocket")
          return json({ error: "WebSocket diperlukan." }, 400);
        const pair = new WebSocketPair();
        pair[1].accept();
        this.clients.add(pair[1]);
        pair[1].send(
          JSON.stringify({
            type: "state",
            state: publicState(this.engine.state),
          }),
        );
        pair[1].addEventListener("close", () => this.clients.delete(pair[1]));
        pair[1].addEventListener("error", () => this.clients.delete(pair[1]));
        return new Response(null, { status: 101, webSocket: pair[0] });
      }
      if (req.method === "GET")
        return json(
          req.headers.get("X-Internal-Admin") === "yes"
            ? this.engine.state
            : publicState(this.engine.state),
        );
      const data = await body(req);
      if (url.pathname.endsWith("/event")) {
        const now = Date.now();
        if (now - this.burst.at > 1000) this.burst = { at: now, count: 0 };
        if (++this.burst.count > 100)
          return json({ error: "Batas 100 event/detik." }, 429);
        const decision = this.engine.event(data);
        if (req.headers.get("X-Internal-Live") === "yes")
          this.engine.state.lastWebhookAt = Date.now();
        this.broadcast();
        const at = this.engine.seen.get(data.event_id);
        if (at !== undefined)
          this.ctx.storage.sql.exec(
            "INSERT OR IGNORE INTO event_dedup VALUES (?,?)",
            data.event_id,
            at,
          );
        this.ctx.storage.sql.exec(
          "DELETE FROM event_dedup WHERE created_at<?",
          Date.now() - 60000,
        );
        if (decision.status === "accepted") await this.persist();
        return json(decision);
      }
      if (req.headers.get("X-Internal-Admin") !== "yes")
        return json({ error: "Unauthorized" }, 401);
      if (url.pathname.endsWith("/control")) {
        this.engine.lifecycle(data.action);
        if (this.engine.state.status === "running") this.startTimer();
      } else if (url.pathname.endsWith("/input"))
        this.engine.manual(data.team, data.action);
      else if (url.pathname.endsWith("/configure")) {
        const roster = await readDoc<Fighter[]>(this.env, "fighters", fighters);
        const available = roster.filter(
          (f) =>
            (f.published || this.engine.state.environment === "sandbox") &&
            !f.disabled,
        );
        const arenaList = await readDoc<Arena[]>(this.env, "arenas", arenas);
        const config: any = {};
        for (const t of ["red", "blue"] as Team[]) {
          if (data[t]) {
            const f = available.find((f) => f.id === data[t]);
            if (!f) throw Error("Fighter tidak tersedia.");
            const errors = validateFighter({ ...f, published: true });
            if (errors.length) throw Error(errors.join(" "));
            config[t] = f;
          }
          if (data[t + "Control"]) {
            if (
              ![
                "manual",
                "ai",
                "direct",
                "ai-webhook",
                "webhook",
                "hybrid",
              ].includes(data[t + "Control"])
            )
              throw Error("Mode kontrol tidak valid.");
            config[t + "Control"] = data[t + "Control"];
          }
        }
        if (data.rosters) {
          config.rosters = {};
          for (const t of ["red", "blue"] as Team[]) {
            if (
              !Array.isArray(data.rosters[t]) ||
              data.rosters[t].length < 1 ||
              data.rosters[t].length > 8
            )
              throw Error("Roster harus berisi 1–8 fighter.");
            config.rosters[t] = data.rosters[t].map((id: string) => {
              const f = available.find((f) => f.id === id);
              if (!f) throw Error("Roster tidak valid.");
              return f;
            });
          }
        }
        if (data.arena) {
          config.arena = arenaList.find((a) => a.id === data.arena);
          if (!config.arena) throw Error("Arena tidak tersedia.");
        }
        if (data.settings) config.settings = validSettings(data.settings);
        this.engine.configure(config);
      } else if (url.pathname.endsWith("/mappings"))
        this.engine.mappings = await readDoc(
          this.env,
          "mappings",
          defaultMappings,
        );
      else return json({ error: "Not found" }, 404);
      this.broadcast();
      await this.persist();
      return json(this.engine.state);
    } catch (e) {
      return json(
        { error: e instanceof Error ? e.message : "Permintaan gagal." },
        400,
      );
    }
  }
}
function validSettings(data: Partial<Settings>): Settings {
  const s = { ...defaultSettings, ...data };
  for (const [k, min, max] of [
    ["duration", 10, 300],
    ["bestOf", 1, 9],
    ["ttl", 500, 10000],
    ["queueCap", 1, 100],
    ["userQuota", 1, 20],
    ["votingWindow", 100, 2000],
    ["rewardCap", 0, 100],
    ["damageScale", 0.2, 2],
    ["volume", 0, 1],
    ["retentionDays", 1, 365],
  ] as const) {
    if (!Number.isFinite(s[k]) || s[k] < min || s[k] > max)
      throw Error(`${k} harus ${min}–${max}.`);
  }
  for (const key of ["allowSwitch", "sound", "tts"] as const)
    if (typeof s[key] !== "boolean") throw Error(`${key} harus boolean.`);
  if (s.bestOf % 2 !== 1) throw Error("Best-of harus ganjil.");
  for (const [k, values] of Object.entries({
    mode: ["classic", "elimination", "endless"],
    strategy: ["fifo", "priority", "voting"],
    unknown: ["assign", "ignore"],
    difficulty: ["easy", "normal", "hard"],
    quality: ["low", "medium", "high"],
    balance: ["competitive", "support", "dynamic"],
  })) {
    if (!values.includes((s as any)[k])) throw Error(`${k} tidak valid.`);
  }
  return s;
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const u = new URL(req.url),
      p = u.pathname;
    try {
      if (!p.startsWith("/api/")) return env.ASSETS.fetch(req);
      const cookie = req.headers
        .get("Cookie")
        ?.match(/(?:^|;\s*)kizuna_session=([a-f0-9-]+)/)?.[1];
      const session = cookie
        ? await env.DB.prepare(
            "SELECT id,csrf,expires FROM sessions WHERE id=? AND expires>?",
          )
            .bind(cookie, Date.now())
            .first<{ id: string; csrf: string; expires: number }>()
        : null;
      const sameOrigin =
        !req.headers.get("Origin") || req.headers.get("Origin") === u.origin;
      if (p === "/api/auth" && req.method === "GET")
        return json({
          authenticated: !!session,
          csrf: session?.csrf,
          environment: env.APP_ENV,
          configured: !!env.ADMIN_PASSWORD_HASH,
        });
      if (p === "/api/login" && req.method === "POST") {
        if (!sameOrigin) return json({ error: "Origin ditolak." }, 403);
        if (!env.ADMIN_PASSWORD_HASH)
          return json(
            { error: "ADMIN_PASSWORD_HASH belum dikonfigurasi." },
            503,
          );
        const ip = req.headers.get("CF-Connecting-IP") || "local";
        let limit = await env.DB.prepare(
          "SELECT attempts,resets FROM login_limits WHERE ip=?",
        )
          .bind(ip)
          .first<{ attempts: number; resets: number }>();
        if (limit && limit.resets > Date.now() && limit.attempts >= 5)
          return json(
            { error: "Terlalu banyak percobaan. Coba dalam 15 menit." },
            429,
          );
        const d = await body(req);
        await env.DB.prepare(
          "INSERT INTO login_limits (ip,attempts,resets) VALUES (?,1,?) ON CONFLICT(ip) DO UPDATE SET attempts=CASE WHEN resets<? THEN 1 ELSE attempts+1 END,resets=CASE WHEN resets<? THEN excluded.resets ELSE resets END",
        )
          .bind(ip, Date.now() + 900000, Date.now(), Date.now())
          .run();
        if (
          d.username !== env.ADMIN_USERNAME ||
          typeof d.password !== "string" ||
          d.password.length > 256 ||
          !(await verifyPassword(d.password, env.ADMIN_PASSWORD_HASH))
        )
          return json({ error: "Username atau password salah." }, 401);
        const id = crypto.randomUUID(),
          csrf = crypto.randomUUID();
        await env.DB.prepare("DELETE FROM sessions WHERE expires<?")
          .bind(Date.now())
          .run();
        await env.DB.prepare("INSERT INTO sessions VALUES (?,?,?)")
          .bind(id, csrf, Date.now() + 86400000)
          .run();
        await env.DB.prepare("DELETE FROM login_limits WHERE ip=?")
          .bind(ip)
          .run();
        return Response.json(
          { csrf },
          {
            headers: {
              "Set-Cookie": `kizuna_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${u.protocol === "https:" ? "; Secure" : ""}`,
              "Cache-Control": "no-store",
            },
          },
        );
      }
      if (p.startsWith("/api/assets/") && req.method === "GET") {
        const id = p.split("/").pop()!;
        if (!/^[a-f0-9-]+\.(png|webp)$/.test(id))
          return json({ error: "Not found" }, 404);
        const asset = await env.ASSET_BUCKET.get(id);
        if (!asset) return json({ error: "Not found" }, 404);
        return new Response(asset.body, {
          headers: {
            "Content-Type":
              asset.httpMetadata?.contentType || "application/octet-stream",
            "Cache-Control": "public,max-age=31536000,immutable",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      const sandbox = p.startsWith("/api/sandbox");
      const room = env.ROOMS.get(
        env.ROOMS.idFromName(sandbox ? "sandbox" : env.APP_ENV),
      );
      const route = async (path: string, admin = false) => {
        const h = new Headers(req.headers);
        h.delete("X-Internal-Admin");
        h.delete("X-Internal-Live");
        h.set("X-Internal-Room", sandbox ? "sandbox" : env.APP_ENV);
        if (p === "/api/game/webhook") h.set("X-Internal-Live", "yes");
        if (admin) h.set("X-Internal-Admin", "yes");
        return room.fetch(
          new Request(`https://room${path}`, {
            method: req.method,
            headers: h,
            body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
          }),
        );
      };
      if (p === "/api/game/ws" || p === "/api/game/state") return route(p);
      if (p === "/api/game/tiktok" && req.method === "POST") {
        if (
          !env.WEBHOOK_SIGNING_SECRET ||
          env.WEBHOOK_SIGNING_SECRET.length < 32
        )
          return json({ error: "Webhook HMAC belum dikonfigurasi." }, 503);
        const raw = await readLimited(req, 65536);
        if (
          !(await verifyTikTokSignature(
            raw,
            req.headers,
            env.WEBHOOK_SIGNING_SECRET,
          ))
        )
          return json({ error: "Signature webhook ditolak." }, 401);
        let event;
        try {
          event = adaptTikTokEvent(
            JSON.parse(new TextDecoder().decode(raw)),
            req.headers,
            env.TIKTOK_ROOM_ID,
          );
        } catch {
          return json(
            {
              error:
                "Payload konektor tidak valid, identitas tidak tersedia, atau room tidak cocok.",
            },
            400,
          );
        }
        if (!event)
          return json({
            status: "ignored",
            reason: "Event tidak digunakan game.",
          });
        return room.fetch(
          new Request("https://room/event", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Internal-Live": "yes",
              "X-Internal-Room": env.APP_ENV,
            },
            body: JSON.stringify(event),
          }),
        );
      }
      if (p === "/api/game/webhook" && req.method === "POST") {
        if (!env.WEBHOOK_SECRET)
          return json({ error: "Webhook belum dikonfigurasi." }, 503);
        const token =
          req.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
        if (!(await constantEqual(token, env.WEBHOOK_SECRET)))
          return json({ error: "Token webhook ditolak." }, 401);
        return route("/event");
      }
      if (!session) return json({ error: "Login admin diperlukan." }, 401);
      if (
        req.method !== "GET" &&
        (!sameOrigin || req.headers.get("X-CSRF-Token") !== session.csrf)
      )
        return json({ error: "Validasi CSRF gagal." }, 403);
      if (p === "/api/logout" && req.method === "POST") {
        await env.DB.prepare("DELETE FROM sessions WHERE id=?")
          .bind(session.id)
          .run();
        return Response.json(
          { ok: true },
          {
            headers: {
              "Set-Cookie":
                "kizuna_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
            },
          },
        );
      }
      if (p === "/api/catalog" && req.method === "GET")
        return json({
          fighters: await readDoc(env, "fighters", fighters),
          arenas: await readDoc(env, "arenas", arenas),
          settings: await readDoc(env, "settings", defaultSettings),
          mappings: await readDoc(env, "mappings", defaultMappings),
        });
      if (p === "/api/admin/state") return route("/state", true);
      if (
        /^\/api\/(game|sandbox)\/(control|configure|input|event|state|ws)$/.test(
          p,
        )
      )
        return route(p.replace(/^\/api\/(game|sandbox)/, ""), true);
      if (p === "/api/settings" && req.method === "POST") {
        const d = validSettings(await body(req));
        await saveDoc(env, "settings", d);
        return json(d);
      }
      if (p === "/api/mappings" && req.method === "POST") {
        const d = await body(req);
        if (!Array.isArray(d) || d.length > 50)
          throw Error("Maksimal 50 mapping.");
        for (const m of d) {
          if (
            !["comment", "gift", "like", "follow", "share"].includes(m.event) ||
            !["any", "red", "blue"].includes(m.team) ||
            !actions.includes(m.action) ||
            !Number.isFinite(m.priority) ||
            m.priority < 0 ||
            m.priority > 10 ||
            !Number.isFinite(m.amount) ||
            m.amount < 1 ||
            m.amount > 100 ||
            typeof m.command !== "string" ||
            m.command.length > 100
          )
            throw Error("Mapping tidak valid.");
        }
        await saveDoc(env, "mappings", d);
        for (const name of [env.APP_ENV, "sandbox"])
          await env.ROOMS.get(env.ROOMS.idFromName(name)).fetch(
            new Request("https://room/mappings", {
              method: "POST",
              headers: { "X-Internal-Admin": "yes" },
              body: "{}",
            }),
          );
        return json({ ok: true });
      }
      if (p === "/api/fighters" && req.method === "POST") {
        const f = (await body(req)) as Fighter;
        const errors = validateFighter(f);
        if (errors.length) return json({ error: errors.join(" ") }, 400);
        if (f.asset) {
          if (!/^\/api\/assets\/[a-f0-9-]+\.(png|webp)$/.test(f.asset))
            throw Error("Path aset tidak valid.");
          const a = await env.ASSET_BUCKET.get(f.asset.split("/").pop()!);
          if (!a) throw Error("Aset tidak ditemukan.");
          const dim = imageSize(
            new Uint8Array(await a.arrayBuffer()),
            a.httpMetadata?.contentType || "",
          );
          const count = dim
            ? Math.floor(dim.width / f.frameWidth!) *
              Math.floor(dim.height / f.frameHeight!)
            : 0;
          for (const anim of Object.values(f.animations || {}))
            if (anim.end >= count)
              throw Error("Frame animasi melewati batas spritesheet.");
        }
        const list = await readDoc<Fighter[]>(env, "fighters", fighters);
        const previous = list.find((x) => x.id === f.id);
        f.id = previous?.id || crypto.randomUUID();
        f.version = (previous?.version || 0) + 1;
        f.name = f.name.trim();
        const next = list.filter((x) => x.id !== f.id);
        next.push(f);
        await saveDoc(env, "fighters", next);
        return json(f);
      }
      if (p === "/api/fighters" && req.method === "DELETE") {
        const d = await body(req);
        const list = await readDoc<Fighter[]>(env, "fighters", fighters);
        const f = list.find((f) => f.id === d.id);
        if (!f) throw Error("Fighter tidak ditemukan.");
        f.disabled = true;
        await saveDoc(env, "fighters", list);
        return json({ ok: true });
      }
      if (p === "/api/arenas" && req.method === "POST") {
        const a = (await body(req)) as Arena;
        if (
          !a.name?.trim() ||
          a.name.length > 40 ||
          !["shrine", "city", "void"].includes(a.theme) ||
          !/^#[a-f0-9]{6}$/i.test(a.color) ||
          a.floor !== 420
        )
          throw Error(
            "Arena tidak valid. Floor simulasi versi ini adalah 420.",
          );
        if (
          a.background &&
          !/^\/api\/assets\/[a-f0-9-]+\.(png|webp)$/.test(a.background)
        )
          throw Error("Path background tidak valid.");
        if (
          a.background &&
          !(await env.ASSET_BUCKET.head(a.background.split("/").pop()!))
        )
          throw Error("Background tidak ditemukan.");
        for (const [key, min, max] of [
          ["hazardX", 100, 900],
          ["hazardRadius", 30, 120],
          ["hazardDamage", 1, 20],
        ] as const)
          if (
            a[key] !== undefined &&
            (!Number.isFinite(a[key]) || a[key]! < min || a[key]! > max)
          )
            throw Error(`${key} di luar batas.`);
        if (typeof a.hazard !== "boolean") throw Error("Hazard harus boolean.");
        const list = await readDoc<Arena[]>(env, "arenas", arenas);
        a.id = list.find((v) => v.id === a.id)?.id || crypto.randomUUID();
        await saveDoc(env, "arenas", [...list.filter((v) => v.id !== a.id), a]);
        return json(a);
      }
      if (p === "/api/upload" && req.method === "POST") {
        if (
          Number(req.headers.get("Content-Length") || 0) >
          8 * 1024 * 1024 + 10000
        )
          throw Error("Maksimal 8 MB.");
        const multipart = await readLimited(req, 8 * 1024 * 1024 + 10000);
        const form = await new Response(multipart, {
          headers: { "Content-Type": req.headers.get("Content-Type") || "" },
        }).formData();
        const file: any = form.get("file");
        if (
          !(file instanceof File) ||
          file.size > 8 * 1024 * 1024 ||
          !["image/png", "image/webp"].includes(file.type)
        )
          throw Error("Gunakan PNG/WebP, maksimal 8 MB.");
        const data = new Uint8Array(await file.arrayBuffer());
        const size = imageSize(data, file.type);
        if (
          !size ||
          !validImageContainer(data, file.type) ||
          size.width < 8 ||
          size.height < 8 ||
          size.width > 8192 ||
          size.height > 8192 ||
          size.width * size.height > 8388608
        )
          throw Error(
            "Isi gambar/dimensi tidak valid (8–8192 px, maksimal 8 juta pixel).",
          );
        const id =
          crypto.randomUUID() +
          "." +
          (file.type === "image/png" ? "png" : "webp");
        await env.ASSET_BUCKET.put(id, data, {
          httpMetadata: { contentType: file.type },
        });
        await env.DB.prepare("INSERT INTO assets VALUES (?,?,?,?,?)")
          .bind(
            id,
            file.name.slice(0, 100),
            file.type,
            file.size,
            new Date().toISOString(),
          )
          .run();
        return json({ asset: `/api/assets/${id}`, ...size });
      }
      if (p === "/api/analytics" && req.method === "GET") {
        const rows = await env.DB.prepare(
          "SELECT id,ended_at,result FROM matches WHERE environment=? ORDER BY ended_at DESC LIMIT 100",
        )
          .bind(env.APP_ENV)
          .all<{ id: string; ended_at: string; result: string }>();
        return json({
          matches: rows.results.map((r) => ({
            ...r,
            result: JSON.parse(r.result),
          })),
        });
      }
      if (p === "/api/privacy/clear" && req.method === "POST") {
        await env.DB.prepare("DELETE FROM matches WHERE environment=?")
          .bind(env.APP_ENV)
          .run();
        return json({ ok: true });
      }
      return json({ error: "Endpoint tidak ditemukan." }, 404);
    } catch (e) {
      return json(
        { error: e instanceof Error ? e.message : "Server error" },
        400,
      );
    }
  },
};
