/**
 * Run async work on items with at most `limit` operations in flight.
 * Results match input order. Safe for memory on low-end devices (cap 1–32).
 */

const MAX_POOL = 32;

export async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const n = items.length;
  if (n === 0) return [];

  const pool = Math.max(1, Math.min(Math.floor(limit) || 4, MAX_POOL, n));
  const results: R[] = new Array(n);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex++;
      if (i >= n) return;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: pool }, () => worker()));
  return results;
}
