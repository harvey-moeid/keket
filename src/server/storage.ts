import type { MatchState } from "../shared/model";

export async function readDoc<T>(
  env: { DATA: KVNamespace },
  key: string,
  fallback: T,
): Promise<T> {
  return (
    (await env.DATA.get<T>(`document:${key}`, "json")) ??
    structuredClone(fallback)
  );
}
export async function saveDoc(
  env: { DATA: KVNamespace },
  key: string,
  value: unknown,
) {
  await env.DATA.put(`document:${key}`, JSON.stringify(value));
}
export interface ArchivedMatch {
  id: string;
  ended_at: string;
  result: MatchState;
}
export async function archiveMatch(
  kv: KVNamespace,
  state: MatchState,
  endedAt: number,
) {
  if (state.environment === "sandbox") return;
  const expiration = Math.floor(
    endedAt / 1000 + state.settings.retentionDays * 86400,
  );
  // A recovered room can retry archiving after its retention window ended.
  if (expiration <= Date.now() / 1000) return;
  // Reverse timestamps make KV's lexicographic list order newest-first.
  const key = `match:${state.environment}:${String(9999999999999 - endedAt).padStart(13, "0")}:${state.id}`;
  await kv.put(
    key,
    JSON.stringify({
      id: state.id,
      ended_at: new Date(endedAt).toISOString(),
      result: { ...state, logs: [], queues: { red: [], blue: [] } },
    }),
    { expiration },
  );
}
export async function listMatches(
  kv: KVNamespace,
  environment: string,
): Promise<ArchivedMatch[]> {
  const matches: ArchivedMatch[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({
      prefix: `match:${environment}:`,
      cursor,
      limit: 100 - matches.length,
    });
    const values = await Promise.all(
      page.keys.map((key) => kv.get<ArchivedMatch>(key.name, "json")),
    );
    matches.push(
      ...values.filter((value): value is ArchivedMatch => value !== null),
    );
    if (page.list_complete) break;
    cursor = page.cursor;
  } while (matches.length < 100);
  return matches;
}
export async function clearMatches(kv: KVNamespace, environment: string) {
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: `match:${environment}:`, cursor });
    await Promise.all(page.keys.map((key) => kv.delete(key.name)));
    if (page.list_complete) break;
    cursor = page.cursor;
  } while (true);
}
