import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { adaptTikTokEvent, verifyTikTokSignature } from "./tiktok";
import worker, { type Env } from "./index";
import { Engine } from "../shared/engine";

const secret = "test-only-connector-signing-secret-123456";
// Contract fixture from createEvent + webhookHeaders in the pinned connector.
function fixture(
  event = "chat",
  data: Record<string, unknown> = {
    username: "viewer.one",
    nickname: "Same display name",
    message: "!merah",
  },
) {
  const value = {
    id: randomUUID(),
    event,
    timestamp: new Date().toISOString(),
    roomId: "7693584931198438164",
    username: "broadcaster",
    version: 1,
    data,
  };
  const body = JSON.stringify(value);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers = new Headers({
    "content-type": "application/json",
    "x-tlk-event-id": value.id,
    "x-tlk-event-version": "1",
    "x-tlk-timestamp": timestamp,
    "x-tlk-signature":
      "sha256=" +
      createHmac("sha256", secret)
        .update(timestamp + "." + body)
        .digest("hex"),
  });
  return { value, body, headers };
}

test("connector HMAC verifies raw bytes and rejects tampering, stale time, wrong secret and missing signature", async () => {
  const f = fixture();
  const raw = new TextEncoder().encode(f.body);
  assert.equal(await verifyTikTokSignature(raw, f.headers, secret), true);
  assert.equal(
    await verifyTikTokSignature(
      new TextEncoder().encode(f.body + " "),
      f.headers,
      secret,
    ),
    false,
  );
  assert.equal(
    await verifyTikTokSignature(raw, f.headers, secret + "wrong"),
    false,
  );
  assert.equal(
    await verifyTikTokSignature(raw, f.headers, secret, Date.now() + 32000),
    false,
  );
  assert.equal(await verifyTikTokSignature(raw, new Headers(), secret), false);
  assert.equal(await verifyTikTokSignature(raw, f.headers, "short"), false);
});

test("actual connector envelopes map counts, identities, non-streak gifts and final streaks", () => {
  const chat = fixture();
  const e = adaptTikTokEvent(chat.value, chat.headers)!;
  assert.equal(e.user_id, "tlk:viewer.one");
  assert.equal(e.event_type, "comment");
  assert.equal(e.text, "!merah");
  assert.equal(e.event_id, chat.value.id);
  for (const kind of ["follow", "share"]) {
    const f = fixture(kind, { username: "viewer.one" });
    assert.equal(adaptTikTokEvent(f.value, f.headers)!.event_type, kind);
  }
  const like = fixture("like", {
    username: "viewer.one",
    likeCount: 6000,
    totalLikeCount: 123456,
  });
  assert.equal(adaptTikTokEvent(like.value, like.headers)!.count, 1000);
  for (const [giftType, repeatEnd, finished] of [
    [1, false, false],
    [1, true, true],
    [0, false, true],
  ] as const) {
    const f = fixture("gift", {
      username: "viewer.one",
      giftId: "5953",
      giftName: "Rose",
      repeatCount: 4,
      giftType,
      streakable: giftType === 1,
      repeatEnd,
    });
    const adapted = adaptTikTokEvent(f.value, f.headers)!;
    assert.equal(adapted.streak_finished, finished);
    assert.equal(adapted.count, 4);
    assert.equal(adapted.gift, "Rose");
  }
});

test("connector rejects ambiguous viewer identity, malformed metadata, foreign room and old envelope", () => {
  for (const username of [
    "Penonton TikTok",
    "unknown",
    "Display Name",
    "",
    null,
  ]) {
    const f = fixture("chat", { username, message: "!attack" });
    assert.throws(() => adaptTikTokEvent(f.value, f.headers));
  }
  const f = fixture();
  assert.throws(() => adaptTikTokEvent(f.value, f.headers, "other-room"));
  assert.throws(() => adaptTikTokEvent({ ...f.value, version: 2 }, f.headers));
  assert.throws(() =>
    adaptTikTokEvent({ ...f.value, data: { truncated: true } }, f.headers),
  );
  assert.throws(() =>
    adaptTikTokEvent(f.value, f.headers, undefined, Date.now() + 31000),
  );
  const headers = new Headers(f.headers);
  headers.set("x-tlk-event-id", "forged");
  assert.throws(() => adaptTikTokEvent(f.value, headers));
  const like = fixture("like", { username: "viewer.one", likeCount: -1 });
  assert.throws(() => adaptTikTokEvent(like.value, like.headers));
  const ignored = fixture("viewer", { viewerCount: 123 });
  assert.equal(adaptTikTokEvent(ignored.value, ignored.headers), null);
});

test("Worker signed ingress routes to authoritative game, blocks spoofed admin headers, deduplicates and never auto-starts", async () => {
  const engine = new Engine();
  engine.configure({ redControl: "webhook", blueControl: "webhook" });
  let routed = 0;
  const env = {
    APP_ENV: "preview",
    WEBHOOK_SIGNING_SECRET: secret,
    TIKTOK_ROOM_ID: "7693584931198438164",
    ROOMS: {
      idFromName(name: string) {
        assert.equal(name, "preview");
        return name;
      },
      get() {
        return {
          async fetch(req: Request) {
            routed++;
            assert.equal(req.headers.get("X-Internal-Admin"), null);
            assert.equal(req.headers.get("X-Internal-Live"), "yes");
            assert.equal(req.headers.get("X-Internal-Room"), "preview");
            return Response.json(engine.event(await req.json()));
          },
        };
      },
    },
  } as unknown as Env;
  const send = (f: ReturnType<typeof fixture>) =>
    worker.fetch(
      new Request("https://game.test/api/game/tiktok", {
        method: "POST",
        headers: f.headers,
        body: f.body,
      }),
      env,
    );
  const join = fixture();
  join.headers.set("X-Internal-Admin", "yes");
  assert.equal((await send(join)).status, 200);
  assert.equal(engine.state.status, "idle");
  engine.lifecycle("start");
  const action = fixture("chat", {
    username: "viewer.one",
    message: "!attack",
  });
  assert.equal(
    ((await (await send(action)).json()) as { status: string }).status,
    "queued",
  );
  assert.equal(
    ((await (await send(action)).json()) as { status: string }).status,
    "duplicate",
  );
  assert.equal(engine.state.queues.red.length, 1);
  engine.state.red.x = 430;
  engine.state.blue.x = 530;
  for (let i = 0; i < 20; i++) engine.step();
  assert.equal(engine.state.blue.hp, 950);
  const before = routed;
  const invalid = fixture();
  invalid.body += " ";
  assert.equal((await send(invalid)).status, 401);
  const viewer = fixture("viewer", { viewerCount: 30 });
  assert.equal((await send(viewer)).status, 200);
  assert.equal(routed, before);
  assert.equal(
    (
      await worker.fetch(
        new Request("https://game.test/api/game/tiktok", {
          method: "POST",
          body: "{}",
        }),
        { ...env, WEBHOOK_SIGNING_SECRET: undefined },
      )
    ).status,
    503,
  );
});
