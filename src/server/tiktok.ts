import type { LiveEvent } from "../shared/model";

/** Matches server/webhooks.js at connector c6105889968bd24aa372cace5f6341b5e21ecda0. */
export async function verifyTikTokSignature(
  raw: Uint8Array,
  headers: Headers,
  secret: string,
  now = Date.now(),
): Promise<boolean> {
  const timestamp = headers.get("x-tlk-timestamp") || "";
  const signature = headers.get("x-tlk-signature") || "";
  if (
    secret.length < 32 ||
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 30 ||
    !/^sha256=[a-f0-9]{64}$/.test(signature)
  )
    return false;
  const prefix = new TextEncoder().encode(timestamp + ".");
  const signed = new Uint8Array(prefix.length + raw.length);
  signed.set(prefix);
  signed.set(raw, prefix.length);
  const supplied = Uint8Array.from(signature.slice(7).match(/../g)!, (x) =>
    parseInt(x, 16),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, supplied, signed);
}

const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const count = (v: unknown): number => {
  if (!Number.isSafeInteger(v) || (v as number) < 1)
    throw Error("Jumlah event tidak valid.");
  // Internal receiver budget; do not split one provider ID into multiple rewards.
  return Math.min(v as number, 1000);
};

export function adaptTikTokEvent(
  value: unknown,
  headers: Headers,
  expectedRoom?: string,
  now = Date.now(),
): LiveEvent | null {
  if (
    !record(value) ||
    !text(value.id, 100) ||
    value.version !== 1 ||
    !text(value.event, 64) ||
    !text(value.timestamp, 64) ||
    !Number.isFinite(Date.parse(value.timestamp)) ||
    Math.abs(now - Date.parse(value.timestamp)) > 30000 ||
    !record(value.data) ||
    value.data.truncated === true ||
    headers.get("x-tlk-event-id") !== value.id ||
    headers.get("x-tlk-event-version") !== "1"
  )
    throw Error("Envelope konektor tidak valid atau kedaluwarsa.");
  if (expectedRoom && value.roomId !== expectedRoom)
    throw Error("Room LIVE tidak cocok.");
  if (!["chat", "like", "gift", "follow", "share"].includes(value.event))
    return null;
  const d = value.data;
  // The current connector discards numeric TikTok user IDs. Reject display-name
  // fallbacks instead of grouping unrelated viewers under a shared placeholder.
  if (
    !text(d.username, 80) ||
    !/^[A-Za-z0-9_.]+$/.test(d.username) ||
    ["unknown", "undefined", "null"].includes(d.username.toLowerCase())
  )
    throw Error("Username viewer tidak dapat digunakan sebagai identitas.");
  const e: LiveEvent = {
    event_id: value.id,
    source: "tiktok-live-konektor",
    user_id: "tlk:" + d.username.toLowerCase(),
    event_type: value.event === "chat" ? "comment" : value.event,
    occurred_at: value.timestamp,
  };
  if (value.event === "chat") {
    if (typeof d.message !== "string" || d.message.length > 500)
      throw Error("Komentar tidak valid atau terlalu panjang.");
    e.text = d.message;
  }
  if (value.event === "like") e.count = count(d.likeCount);
  if (value.event === "gift") {
    if (
      !text(d.giftName, 100) ||
      typeof d.repeatEnd !== "boolean" ||
      !Number.isInteger(d.giftType) ||
      (d.giftType as number) < 0 ||
      typeof d.streakable !== "boolean" ||
      d.streakable !== (d.giftType === 1)
    )
      throw Error("Metadata gift tidak valid.");
    e.gift = d.giftName;
    e.count = count(d.repeatCount);
    e.streak_finished = !d.streakable || d.repeatEnd;
  }
  return e;
}
