import { readLimited } from "./security";

export interface AdminCredentials {
  username: string;
  passwordHash: string;
  mustChange: boolean;
  version: string;
}
export interface AdminSession {
  id: string;
  csrf: string;
  expires: number;
  credential_version: string;
}
export interface AuthSnapshot {
  credentials: AdminCredentials | null;
  session: AdminSession | null;
}
type AuthOperation =
  | { action: "snapshot"; cookie?: string }
  | { action: "attempt"; ip: string }
  | { action: "login"; session: AdminSession; ip: string }
  | { action: "logout"; id: string }
  | {
      action: "rotate";
      expectedVersion: string;
      next: AdminCredentials;
      ip: string;
    };

export async function authRequest<T>(
  env: { AUTH: DurableObjectNamespace; APP_ENV: string },
  operation: AuthOperation,
): Promise<T> {
  const store = env.AUTH.get(env.AUTH.idFromName(env.APP_ENV));
  const response = await store.fetch(
    new Request("https://auth/internal", {
      method: "POST",
      body: JSON.stringify(operation),
    }),
  );
  if (!response.ok) throw Error("Penyimpanan autentikasi tidak tersedia.");
  return response.json() as Promise<T>;
}

// Only called through the private DO binding; no public Worker route forwards here.
// Transactions keep revocation, rotation and rate limits independent of KV caches.
export class AuthStore {
  constructor(private ctx: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    if (req.method !== "POST") return new Response(null, { status: 405 });
    const operation = JSON.parse(
      new TextDecoder().decode(await readLimited(req, 4096)),
    ) as AuthOperation;
    const now = Date.now();
    const result = await this.ctx.storage.transaction(async (storage) => {
      const credentials =
        await storage.get<AdminCredentials>("admin_credentials");
      const version = credentials?.version || "bootstrap";
      switch (operation.action) {
        case "snapshot": {
          const candidate = operation.cookie
            ? await storage.get<AdminSession>(`session:${operation.cookie}`)
            : undefined;
          const session =
            candidate &&
            candidate.expires > now &&
            candidate.credential_version === version
              ? candidate
              : null;
          return { credentials: credentials || null, session };
        }
        case "attempt": {
          const key = `limit:${operation.ip}`;
          const limit = await storage.get<{
            attempts: number;
            expires: number;
          }>(key);
          if (limit && limit.expires > now && limit.attempts >= 5) return false;
          await storage.put(key, {
            attempts: limit && limit.expires > now ? limit.attempts + 1 : 1,
            expires:
              limit && limit.expires > now ? limit.expires : now + 900000,
          });
          await storage.setAlarm(now + 900000);
          return true;
        }
        case "login":
          if (operation.session.credential_version !== version) return false;
          await storage.put(
            `session:${operation.session.id}`,
            operation.session,
          );
          await storage.delete(`limit:${operation.ip}`);
          await storage.setAlarm(now + 900000);
          return true;
        case "logout":
          await storage.delete(`session:${operation.id}`);
          return true;
        case "rotate":
          if (operation.expectedVersion !== version) return false;
          await storage.put("admin_credentials", operation.next);
          await storage.delete(`limit:${operation.ip}`);
          // Sessions from every older version immediately fail snapshot validation.
          await storage.setAlarm(now + 900000);
          return true;
        default:
          throw Error("Operasi autentikasi tidak valid.");
      }
    });
    return Response.json(result);
  }

  async alarm() {
    let startAfter: string | undefined;
    let remaining = false;
    for (;;) {
      // Atomic cleanup cannot delete a limit refreshed by a concurrent request.
      const rows = await this.ctx.storage.transaction(async (storage) => {
        const credentials =
          await storage.get<AdminCredentials>("admin_credentials");
        const page = await storage.list<{
          expires?: number;
          credential_version?: string;
        }>({ limit: 1000, startAfter });
        const expired: string[] = [];
        for (const [key, value] of page) {
          if (!key.startsWith("session:") && !key.startsWith("limit:"))
            continue;
          if (
            (value.expires || 0) <= Date.now() ||
            (key.startsWith("session:") &&
              value.credential_version !==
                (credentials?.version || "bootstrap"))
          )
            expired.push(key);
          else remaining = true;
        }
        for (let i = 0; i < expired.length; i += 128)
          await storage.delete(expired.slice(i, i + 128));
        return page;
      });
      if (!rows.size) break;
      startAfter = Array.from(rows.keys()).at(-1);
      if (rows.size < 1000) break;
    }
    if (remaining) await this.ctx.storage.setAlarm(Date.now() + 900000);
  }
}
