import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TTLCache } from '../ttl-cache'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Advance Date.now by the given number of milliseconds (via mocking) */
function advanceTime(ms: number): void {
  vi.advanceTimersByTime(ms)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TTLCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ---- Construction & defaults -------------------------------------------

  describe('construction', () => {
    it('uses 5-minute default TTL when no options provided', () => {
      const cache = new TTLCache<string, number>()
      expect(cache.ttl).toBe(5 * 60 * 1000)
    })

    it('uses custom TTL when specified', () => {
      const cache = new TTLCache<string, number>({ ttlMs: 1000 })
      expect(cache.ttl).toBe(1000)
    })
  })

  // ---- set / get (basic) -------------------------------------------------

  describe('set & get', () => {
    it('stores and retrieves a value', () => {
      const cache = new TTLCache<string, string>()
      cache.set('a', 'hello')
      expect(cache.get('a')).toBe('hello')
    })

    it('returns undefined for non-existent key', () => {
      const cache = new TTLCache<string, string>()
      expect(cache.get('missing')).toBeUndefined()
    })

    it('overwrites existing value', () => {
      const cache = new TTLCache<string, string>()
      cache.set('a', 'first')
      cache.set('a', 'second')
      expect(cache.get('a')).toBe('second')
    })

    it('stores null and undefined values correctly', () => {
      const cache = new TTLCache<string, string | null>()
      cache.set('null', null)
      expect(cache.get('null')).toBeNull()

      // undefined is not distinguishable from "not present" by default
      // so we use `has()` to check existence
    })
  })

  // ---- TTL expiry --------------------------------------------------------

  describe('TTL expiry', () => {
    it('returns cached value within TTL', () => {
      const cache = new TTLCache<string, number>({ ttlMs: 5 * 60_000 })
      cache.set('date', 42)

      advanceTime(4 * 60_000) // 4 minutes
      expect(cache.get('date')).toBe(42)
    })

    it('returns undefined after TTL expires', () => {
      const cache = new TTLCache<string, number>({ ttlMs: 5 * 60_000 })
      cache.set('date', 42)

      advanceTime(5 * 60_000) // exactly 5 minutes
      expect(cache.get('date')).toBeUndefined()
    })

    it('keeps expired entry in store for stale fallback', () => {
      const cache = new TTLCache<string, number>({ ttlMs: 1000 })
      cache.set('x', 1)

      advanceTime(1000)
      const result = cache.get('x') // returns undefined but keeps entry
      expect(result).toBeUndefined()

      // Entry still in store for stale fallback
      expect(cache.get('x', { allowStale: true })).toBe(1)
      // prune() removes it
      cache.prune()
      expect(cache.getStats().size).toBe(0)
    })

    it('handles different TTLs independently', () => {
      const cache = new TTLCache<string, number>({ ttlMs: 10_000 })

      cache.set('fast', 1)
      advanceTime(5_000)
      cache.set('slow', 2)

      advanceTime(6_000) // fast is 11s old, slow is 6s old
      expect(cache.get('fast')).toBeUndefined()
      expect(cache.get('slow')).toBe(2)
    })
  })

  // ---- allowStale --------------------------------------------------------

  describe('allowStale', () => {
    it('returns expired value when allowStale is true', () => {
      const cache = new TTLCache<string, number>({ ttlMs: 1000 })
      cache.set('date', 99)

      advanceTime(5000)
      expect(cache.get('date')).toBeUndefined()
      expect(cache.get('date', { allowStale: true })).toBe(99)
    })

    it('returns undefined for non-existent key even with allowStale', () => {
      const cache = new TTLCache<string, number>()
      expect(cache.get('ghost', { allowStale: true })).toBeUndefined()
    })
  })

  // ---- has ---------------------------------------------------------------

  describe('has', () => {
    it('returns true for non-expired entry', () => {
      const cache = new TTLCache<string, number>()
      cache.set('a', 1)
      expect(cache.has('a')).toBe(true)
    })

    it('returns false for expired entry', () => {
      const cache = new TTLCache<string, number>({ ttlMs: 100 })
      cache.set('a', 1)
      advanceTime(100)
      expect(cache.has('a')).toBe(false)
    })

    it('returns false for non-existent entry', () => {
      const cache = new TTLCache<string, number>()
      expect(cache.has('nope')).toBe(false)
    })
  })

  // ---- delete & clear ----------------------------------------------------

  describe('delete & clear', () => {
    it('delete removes a specific entry', () => {
      const cache = new TTLCache<string, number>()
      cache.set('a', 1)
      cache.set('b', 2)
      expect(cache.delete('a')).toBe(true)
      expect(cache.get('a')).toBeUndefined()
      expect(cache.get('b')).toBe(2)
    })

    it('delete returns false for non-existent key', () => {
      const cache = new TTLCache<string, number>()
      expect(cache.delete('ghost')).toBe(false)
    })

    it('clear removes all entries', () => {
      const cache = new TTLCache<string, number>()
      cache.set('a', 1)
      cache.set('b', 2)
      cache.clear()
      expect(cache.getStats().size).toBe(0)
    })
  })

  // ---- getOrFetch --------------------------------------------------------

  describe('getOrFetch', () => {
    it('returns cached value on cache hit', async () => {
      const cache = new TTLCache<string, number>({ ttlMs: 5 * 60_000 })
      cache.set('key', 42)

      const fetcher = vi.fn().mockResolvedValue(99)
      const result = await cache.getOrFetch('key', fetcher)

      expect(result).toBe(42)
      expect(fetcher).not.toHaveBeenCalled()
    })

    it('calls fetcher on cache miss and caches result', async () => {
      const cache = new TTLCache<string, number>({ ttlMs: 5 * 60_000 })
      const fetcher = vi.fn().mockResolvedValue(42)

      const result = await cache.getOrFetch('key', fetcher)
      expect(result).toBe(42)
      expect(fetcher).toHaveBeenCalledOnce()

      // Second call should hit cache
      const result2 = await cache.getOrFetch('key', vi.fn().mockResolvedValue(99))
      expect(result2).toBe(42)
    })

    it('bypasses cache with forceRefresh', async () => {
      const cache = new TTLCache<string, number>({ ttlMs: 5 * 60_000 })
      cache.set('key', 42)

      const fetcher = vi.fn().mockResolvedValue(99)
      const result = await cache.getOrFetch('key', fetcher, { forceRefresh: true })

      expect(result).toBe(99)
      expect(fetcher).toHaveBeenCalledOnce()
    })

    it('re-fetches after TTL expires', async () => {
      const cache = new TTLCache<string, number>({ ttlMs: 1000 })
      const fetcher = vi.fn().mockResolvedValue(42)

      // First fetch
      const r1 = await cache.getOrFetch('key', fetcher)
      expect(r1).toBe(42)

      advanceTime(1000)

      // Second fetch — cache expired
      const fetcher2 = vi.fn().mockResolvedValue(99)
      const r2 = await cache.getOrFetch('key', fetcher2)
      expect(r2).toBe(99)
      expect(fetcher2).toHaveBeenCalledOnce()
    })

    it('propagates fetcher error', async () => {
      const cache = new TTLCache<string, number>()
      const fetcher = vi.fn().mockRejectedValue(new Error('network fail'))

      await expect(cache.getOrFetch('key', fetcher)).rejects.toThrow('network fail')
    })
  })

  // ---- prune -------------------------------------------------------------

  describe('prune', () => {
    it('removes only expired entries', () => {
      const cache = new TTLCache<string, number>({ ttlMs: 1000 })
      cache.set('old', 1)
      advanceTime(500)
      cache.set('fresh', 2)
      advanceTime(600) // old = 1100ms, fresh = 600ms

      const evicted = cache.prune()
      expect(evicted).toBe(1)
      expect(cache.get('old')).toBeUndefined()
      expect(cache.get('fresh')).toBe(2)
    })

    it('returns 0 when nothing to prune', () => {
      const cache = new TTLCache<string, number>({ ttlMs: 60_000 })
      cache.set('a', 1)
      expect(cache.prune()).toBe(0)
    })
  })

  // ---- getStats ----------------------------------------------------------

  describe('getStats', () => {
    it('reports accurate stats', () => {
      const cache = new TTLCache<string, number>({ ttlMs: 10_000 })
      cache.set('a', 1)
      advanceTime(3_000)
      cache.set('b', 2)

      const stats = cache.getStats()
      expect(stats.size).toBe(2)

      const entryA = stats.entries.find((e) => e.key === 'a')
      const entryB = stats.entries.find((e) => e.key === 'b')

      expect(entryA?.ageSec).toBe(3)
      expect(entryA?.isAlive).toBe(true)
      expect(entryB?.ageSec).toBe(0)
      expect(entryB?.isAlive).toBe(true)
    })
  })

  // ---- Same-date cache hit (SiGanPyo specific scenario) -----------------

  describe('SiGanPyo: same-date cache hit', () => {
    it('returns cached schedule for same date within 5 min', () => {
      const cache = new TTLCache<string, string | null>({ ttlMs: 5 * 60_000 })

      // Simulate: fetch returned schedule for 2026-05-07
      cache.set('2026-05-07:user/plans/main', 'schedule-data')

      // Immediate re-request → cache hit
      expect(cache.get('2026-05-07:user/plans/main')).toBe('schedule-data')
    })

    it('re-fetches when 5 min TTL expires', () => {
      const cache = new TTLCache<string, string | null>({ ttlMs: 5 * 60_000 })

      cache.set('2026-05-07:user/plans/main', 'schedule-data')

      // After 5 minutes → cache miss
      advanceTime(5 * 60_000)
      expect(cache.get('2026-05-07:user/plans/main')).toBeUndefined()
    })

    it('different dates have independent cache entries', () => {
      const cache = new TTLCache<string, string | null>({ ttlMs: 5 * 60_000 })

      cache.set('2026-05-07:user/plans/main', 'may-7')
      cache.set('2026-05-08:user/plans/main', 'may-8')

      // Expire only May 7
      advanceTime(5 * 60_000)
      // May 7 expired, but we can't test independently with same timer
      // Let's test differently:

      const cache2 = new TTLCache<string, string | null>({ ttlMs: 5 * 60_000 })
      cache2.set('2026-05-07:user/plans/main', 'may-7')
      advanceTime(1 * 60_000)
      cache2.set('2026-05-08:user/plans/main', 'may-8')
      advanceTime(4 * 60_000 + 1) // May 7 is 5min+1ms old, May 8 is 4min+1ms old

      expect(cache2.get('2026-05-07:user/plans/main')).toBeUndefined()
      expect(cache2.get('2026-05-08:user/plans/main')).toBe('may-8')
    })
  })
})
