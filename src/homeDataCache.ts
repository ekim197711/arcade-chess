type Entry = { promise: Promise<unknown>; pending: boolean };
const cache = new Map<string, Entry>();

// Home reads happen once per account/session, or on an explicit refresh.
// Cache failures too: remounting a card must not become an automatic retry loop.
export function readHomeOnce<T>(userId: string, resource: string, read: () => PromiseLike<T>): Promise<T> {
  const key = `${userId}:${resource}`;
  const previous = cache.get(key);
  if (previous) return previous.promise as Promise<T>;
  const entry: Entry = { pending: true, promise: Promise.resolve() };
  entry.promise = Promise.resolve().then(read).finally(() => { entry.pending = false; });
  cache.set(key, entry);
  return entry.promise as Promise<T>;
}

export function invalidateHomeData(userId: string) {
  for (const [key, entry] of cache) if (key.startsWith(`${userId}:`) && !entry.pending) cache.delete(key);
}
