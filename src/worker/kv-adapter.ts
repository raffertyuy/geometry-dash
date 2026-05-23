/**
 * KVAdapter: thin interface over Cloudflare KV so the Worker's handlers
 * stay testable. `createKVAdapter` wraps the real binding; `createInMemoryKVAdapter`
 * is a Map-backed stub used by unit + integration tests.
 *
 * The adapter is JSON-typed: callers pass / receive structured values, and
 * the adapter handles (de)serialisation + TTLs.
 */

export interface KVAdapter {
  get<T>(key: string): Promise<T | null>;
  put<T>(
    key: string,
    value: T,
    options?: { readonly expirationTtlSeconds?: number },
  ): Promise<void>;
}

export function createKVAdapter(kv: KVNamespace): KVAdapter {
  return {
    async get<T>(key: string): Promise<T | null> {
      // `kv.get(key, 'json')` returns null on missing OR unparseable JSON.
      return (await kv.get<T>(key, 'json')) ?? null;
    },
    async put<T>(
      key: string,
      value: T,
      options?: { readonly expirationTtlSeconds?: number },
    ): Promise<void> {
      const body = JSON.stringify(value);
      if (options?.expirationTtlSeconds !== undefined) {
        await kv.put(key, body, { expirationTtl: options.expirationTtlSeconds });
      } else {
        await kv.put(key, body);
      }
    },
  };
}

interface InMemoryRecord {
  readonly value: unknown;
  /** Absolute epoch-ms after which the record is considered expired; null = no TTL. */
  readonly expiresAt: number | null;
}

/**
 * Test-only Map-backed implementation. Honours TTL on read; no background
 * eviction. Safe to share across multiple handler invocations in the same
 * test — that's the whole point.
 */
export function createInMemoryKVAdapter(
  now: () => number = () => Date.now(),
): KVAdapter {
  const store = new Map<string, InMemoryRecord>();

  return {
    async get<T>(key: string): Promise<T | null> {
      const record = store.get(key);
      if (!record) return null;
      if (record.expiresAt !== null && now() >= record.expiresAt) {
        store.delete(key);
        return null;
      }
      // Round-trip through JSON so the stub matches the real adapter's
      // "you get a fresh object back" semantics — callers can't mutate
      // the persisted value via a returned reference.
      return JSON.parse(JSON.stringify(record.value)) as T;
    },
    async put<T>(
      key: string,
      value: T,
      options?: { readonly expirationTtlSeconds?: number },
    ): Promise<void> {
      const ttl = options?.expirationTtlSeconds;
      const expiresAt = ttl !== undefined ? now() + ttl * 1000 : null;
      store.set(key, { value, expiresAt });
    },
  };
}
