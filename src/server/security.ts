export const bytesHex = (b: ArrayBuffer | Uint8Array) =>
  Array.from(
    new Uint8Array(
      b instanceof Uint8Array
        ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
        : b,
    ),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
export async function passwordHash(
  password: string,
  salt = crypto.getRandomValues(new Uint8Array(16)),
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt as BufferSource,
      iterations: 310000,
    },
    key,
    256,
  );
  return `310000:${bytesHex(salt)}:${bytesHex(hash)}`;
}
export async function constantEqual(a: string, b: string) {
  const digest = async (v: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)),
    );
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
export async function verifyPassword(password: string, stored: string) {
  const [iterations, salt, hash] = stored.split(":");
  if (
    iterations !== "310000" ||
    !/^[a-f0-9]{32}$/.test(salt) ||
    !/^[a-f0-9]{64}$/.test(hash)
  )
    return false;
  const actual = await passwordHash(
    password,
    new Uint8Array(salt.match(/../g)!.map((v) => parseInt(v, 16))),
  );
  return constantEqual(actual, stored);
}
export function imageSize(
  data: Uint8Array,
  mime: string,
): { width: number; height: number } | null {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (
    mime === "image/png" &&
    data.length >= 24 &&
    data.slice(0, 8).every((b, i) => b === [137, 80, 78, 71, 13, 10, 26, 10][i])
  )
    return { width: v.getUint32(16), height: v.getUint32(20) };
  if (
    mime === "image/webp" &&
    data.length >= 30 &&
    String.fromCharCode(...data.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...data.slice(8, 12)) === "WEBP"
  ) {
    const type = String.fromCharCode(...data.slice(12, 16));
    if (type === "VP8X")
      return {
        width: 1 + data[24] + (data[25] << 8) + (data[26] << 16),
        height: 1 + data[27] + (data[28] << 8) + (data[29] << 16),
      };
    if (
      type === "VP8 " &&
      data[23] === 157 &&
      data[24] === 1 &&
      data[25] === 42
    )
      return {
        width: v.getUint16(26, true) & 16383,
        height: v.getUint16(28, true) & 16383,
      };
    if (type === "VP8L" && data[20] === 47) {
      const bits = v.getUint32(21, true);
      return { width: (bits & 16383) + 1, height: ((bits >>> 14) & 16383) + 1 };
    }
  }
  return null;
}

/** Enforce byte budgets while reading, including requests without Content-Length. */
export async function readLimited(
  req: Request,
  limit: number,
): Promise<Uint8Array> {
  if (Number(req.headers.get("Content-Length") || 0) > limit)
    throw Error("Payload terlalu besar.");
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw Error("Payload terlalu besar.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Structural checks complement signature/dimension checks; not a full image decoder. */
export function validImageContainer(data: Uint8Array, mime: string): boolean {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (mime === "image/png") {
    if (!imageSize(data, mime)) return false;
    let offset = 8,
      idat = false,
      header = false;
    while (offset + 12 <= data.length) {
      const len = v.getUint32(offset);
      if (len > data.length - offset - 12) return false;
      const type = String.fromCharCode(...data.slice(offset + 4, offset + 8));
      if (offset === 8 && (type !== "IHDR" || len !== 13)) return false;
      if (type === "IHDR") header = true;
      if (type === "IDAT" && len > 0) idat = true;
      offset += 12 + len;
      if (type === "IEND")
        return len === 0 && offset === data.length && header && idat;
    }
    return false;
  }
  if (mime === "image/webp") {
    if (!imageSize(data, mime) || v.getUint32(4, true) + 8 !== data.length)
      return false;
    let offset = 12,
      pixels = false;
    while (offset + 8 <= data.length) {
      const len = v.getUint32(offset + 4, true);
      if (len > data.length - offset - 8) return false;
      const type = String.fromCharCode(...data.slice(offset, offset + 4));
      if ((type === "VP8 " && len >= 10) || (type === "VP8L" && len >= 5))
        pixels = true;
      if (type === "ANIM") return false;
      offset += 8 + len + (len % 2);
    }
    return offset === data.length && pixels;
  }
  return false;
}
