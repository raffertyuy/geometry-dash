import { describe, expect, it } from 'vitest';
import { createInMemoryKVAdapter } from './kv-adapter';

describe('createInMemoryKVAdapter', () => {
  it('returns null for a missing key', async () => {
    const kv = createInMemoryKVAdapter();
    expect(await kv.get('missing')).toBeNull();
  });

  it('round-trips a put + get', async () => {
    const kv = createInMemoryKVAdapter();
    await kv.put('foo', { hello: 'world' });
    expect(await kv.get<{ hello: string }>('foo')).toEqual({ hello: 'world' });
  });

  it('overwrites a previous value', async () => {
    const kv = createInMemoryKVAdapter();
    await kv.put('foo', 1);
    await kv.put('foo', 2);
    expect(await kv.get<number>('foo')).toBe(2);
  });

  it('returns a fresh object on each get (callers cannot mutate the persisted value)', async () => {
    const kv = createInMemoryKVAdapter();
    await kv.put('foo', { items: ['a', 'b'] });
    const first = (await kv.get<{ items: string[] }>('foo'))!;
    first.items.push('mutated');
    const second = (await kv.get<{ items: string[] }>('foo'))!;
    expect(second.items).toEqual(['a', 'b']);
  });

  it('expires after the TTL elapses', async () => {
    let nowMs = 1_000_000;
    const kv = createInMemoryKVAdapter(() => nowMs);
    await kv.put('counter', 7, { expirationTtlSeconds: 5 });
    expect(await kv.get<number>('counter')).toBe(7);
    nowMs += 4_999;
    expect(await kv.get<number>('counter')).toBe(7);
    nowMs += 2;
    expect(await kv.get<number>('counter')).toBeNull();
  });

  it('treats no TTL as "never expires"', async () => {
    let nowMs = 0;
    const kv = createInMemoryKVAdapter(() => nowMs);
    await kv.put('forever', true);
    nowMs += 1_000_000_000;
    expect(await kv.get<boolean>('forever')).toBe(true);
  });
});
