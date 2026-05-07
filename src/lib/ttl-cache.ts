/**
 * TTLCache — Generic time-to-live in-memory cache.
 *
 * Features:
 * - Configurable TTL (default 5 minutes)
 * - Type-safe key → value storage
 * - Automatic expiry on read (lazy eviction)
 * - Stale-while-error: optionally return expired data on fetch failure
 * - `getOrFetch()` convenience method for the fetch-with-cache pattern
 * - Stats for debugging
 * - `prune()` to bulk-evict all expired entries
 *
 * @example
 * ```ts
 * const cache = new TTLCache<string, DaySchedule>({ ttlMs: 5 * 60_000 })
 *
 * // Simple get/set
 * cache.set('2026-05-08', schedule)
 * const hit = cache.get('2026-05-08') // → DaySchedule | undefined
 *
 * // Fetch with cache
 * const data = await cache.getOrFetch('2026-05-08', () => fetchSchedule(date))
 *
 * // Stale data on error
 * try {
 *   const fresh = await cache.getOrFetch('2026-05-08', fetcher)
 * } catch {
 *   const stale = cache.get('2026-05-08', { allowStale: true })
 * }
 * ```
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for the TTLCache constructor */
export interface TTLCacheOptions {
  /** Time-to-live in milliseconds. Default: 5 minutes (300 000 ms) */
  ttlMs?: number
}

/** Options for the `get()` method */
export interface GetOptions {
  /** If true, return the value even if TTL has expired (stale data) */
  allowStale?: boolean
}

/** Internal cache entry */
interface CacheEntry<V> {
  value: V
  timestamp: number
}

/** Cache statistics */
export interface CacheStats<K> {
  /** Total number of entries (including possibly expired ones) */
  size: number
  /** Detailed entry info */
  entries: Array<{
    key: K
    /** Age in seconds */
    ageSec: number
    /** Whether the entry is still within TTL */
    isAlive: boolean
  }>
}

// ---------------------------------------------------------------------------
// TTLCache
// ---------------------------------------------------------------------------

export class TTLCache<K, V> {
  private readonly store = new Map<K, CacheEntry<V>>()
  private readonly ttlMs: number

  constructor(options: TTLCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? 5 * 60_000 // default 5 minutes
  }

  // ---- Core operations ----------------------------------------------------

  /**
   * Store a value in the cache.
   * Overwrites any existing entry for the same key.
   */
  set(key: K, value: V): void {
    this.store.set(key, {
      value,
      timestamp: Date.now(),
    })
  }

  /**
   * Retrieve a cached value.
   * Returns `undefined` if the key doesn't exist or has expired
   * (unless `allowStale` is true).
   *
   * Expired entries are retained in the store so that callers can
   * still retrieve them with `allowStale: true` as a fallback
   * (e.g. on network failure). Use `prune()` to bulk-evict expired entries.
   */
  get(key: K, options?: GetOptions): V | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined

    const age = Date.now() - entry.timestamp
    const isExpired = age >= this.ttlMs

    if (isExpired && !options?.allowStale) {
      return undefined
    }

    return entry.value
  }

  /**
   * Check whether a non-expired entry exists for the given key.
   */
  has(key: K): boolean {
    return this.get(key) !== undefined
  }

  /**
   * Remove a specific entry. Returns true if the entry existed (even if expired).
   */
  delete(key: K): boolean {
    return this.store.delete(key)
  }

  /**
   * Remove all entries.
   */
  clear(): void {
    this.store.clear()
  }

  // ---- Convenience --------------------------------------------------------

  /**
   * Get a cached value or fetch it if not available / expired.
   *
   * On fetch failure the error propagates — the caller can then try
   * `get(key, { allowStale: true })` to fall back to stale data.
   *
   * @param key      Cache key
   * @param fetcher  Async function that produces the value when cache misses
   * @param options  Optional: forceRefresh bypasses the cache
   */
  async getOrFetch(
    key: K,
    fetcher: (key: K) => Promise<V>,
    options?: { forceRefresh?: boolean },
  ): Promise<V> {
    // Return cached value if valid (unless force-refresh)
    if (!options?.forceRefresh) {
      const cached = this.get(key)
      if (cached !== undefined) {
        return cached
      }
    }

    // Fetch fresh value
    const value = await fetcher(key)
    this.set(key, value)
    return value
  }

  // ---- Maintenance --------------------------------------------------------

  /**
   * Remove all expired entries.
   * @returns Number of entries evicted
   */
  prune(): number {
    const now = Date.now()
    let evicted = 0

    for (const [key, entry] of this.store) {
      if (now - entry.timestamp >= this.ttlMs) {
        this.store.delete(key)
        evicted++
      }
    }

    return evicted
  }

  /**
   * Get cache statistics for debugging.
   */
  getStats(): CacheStats<K> {
    const now = Date.now()
    const entries: CacheStats<K>['entries'] = []

    for (const [key, entry] of this.store) {
      entries.push({
        key,
        ageSec: Math.round((now - entry.timestamp) / 1000),
        isAlive: now - entry.timestamp < this.ttlMs,
      })
    }

    return { size: this.store.size, entries }
  }

  /**
   * The configured TTL in milliseconds.
   */
  get ttl(): number {
    return this.ttlMs
  }
}
