// In-memory bindings for Node tests; API shape follows the installed Workers types.
export function memoryKV(pageSize = 1000) {
  const values = new Map<string, { value: string; expiration?: number }>();
  const writes: {
    key: string;
    value: string;
    options?: KVNamespacePutOptions;
  }[] = [];
  const deletes: string[] = [];
  const binding = {
    async get(key: string, type?: string) {
      const entry = values.get(key);
      if (!entry || (entry.expiration && entry.expiration <= Date.now() / 1000))
        return null;
      return type === "json" ? JSON.parse(entry.value) : entry.value;
    },
    async put(key: string, value: string, options?: KVNamespacePutOptions) {
      writes.push({ key, value, options });
      values.set(key, {
        value,
        expiration:
          options?.expiration ??
          (options?.expirationTtl
            ? Math.floor(Date.now() / 1000) + options.expirationTtl
            : undefined),
      });
    },
    async delete(key: string) {
      deletes.push(key);
      values.delete(key);
    },
    async list(options: KVNamespaceListOptions = {}) {
      const names = [...values.keys()]
        .sort()
        .filter(
          (key) =>
            key.startsWith(options.prefix || "") &&
            key > (options.cursor || "") &&
            (!values.get(key)?.expiration ||
              values.get(key)!.expiration! > Date.now() / 1000),
        );
      const selected = names.slice(
        0,
        Math.min(options.limit || 1000, pageSize),
      );
      return {
        keys: selected.map((name) => ({ name })),
        list_complete: selected.length === names.length,
        cursor: selected.at(-1) || options.cursor || "",
      };
    },
  } as unknown as KVNamespace;
  return { binding, values, writes, deletes };
}

export function memoryDurableStorage() {
  let values = new Map<string, unknown>();
  let tail: Promise<unknown> = Promise.resolve();
  let alarm: number | null = null;
  const binding = {
    async get(key: string) {
      return structuredClone(values.get(key));
    },
    async put(key: string, value: unknown) {
      values.set(key, structuredClone(value));
    },
    async delete(keys: string | string[]) {
      if (typeof keys === "string") return values.delete(keys);
      return keys.reduce((count, key) => count + Number(values.delete(key)), 0);
    },
    async list(options: DurableObjectListOptions = {}) {
      return new Map(
        [...values.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .filter(
            ([key]) =>
              key.startsWith(options.prefix || "") &&
              key > (options.startAfter || ""),
          )
          .slice(0, options.limit || 1000)
          .map(([key, value]) => [key, structuredClone(value)]),
      );
    },
    async getAlarm() {
      return alarm;
    },
    async setAlarm(time: number) {
      alarm = time;
    },
    transaction<T>(
      callback: (storage: DurableObjectTransaction) => Promise<T>,
    ): Promise<T> {
      const result = tail.then(async () => {
        const before = structuredClone(values);
        const previousAlarm = alarm;
        try {
          return await callback(binding as unknown as DurableObjectTransaction);
        } catch (error) {
          values = before;
          alarm = previousAlarm;
          throw error;
        }
      });
      tail = result.catch(() => {});
      return result;
    },
  } as unknown as DurableObjectStorage;
  return { binding };
}
