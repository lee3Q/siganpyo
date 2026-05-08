/**
 * Schedule Fetch + Cache Utility
 *
 * Multi-layer caching strategy for timetable data:
 *
 *   L1: In-memory TTLCache (5 min)  — fast repeated access, avoids GitHub rate limit
 *   L2: localStorage cache (24h)     — enables offline access and page-reload persistence
 *   L3: GitHub Raw URL fetch         — remote data source
 *
 * Flow:
 *   1. Check L1 (memory) → return if fresh hit
 *   2. Check L2 (localStorage) → return if hit & promote to L1
 *   3. Fetch from L3 (GitHub) → cache in L1 + L2 → return
 *   4. On fetch failure → try L2 stale data as fallback
 *
 * @example
 * ```ts
 * const result = await fetchSchedule('2026-05-08', config)
 * // result.schedule → DaySchedule | null
 * // result.fromCache → boolean
 * // result.error → string | null
 *
 * // Synchronous offline read (no network)
 * const cached = getCachedSchedule('2026-05-08', config)
 * ```
 */

import type { DaySchedule } from '@/types'
import { TTLCache } from '@/lib/ttl-cache'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** GitHub repository configuration (mirrors github-data.ts) */
export interface RepoConfig {
  repoOwner: string
  repoName: string
  branch: string
}

/** Result of a fetch attempt */
export interface ScheduleFetchResult {
  /** The fetched schedule, or null if no data exists for the date */
  schedule: DaySchedule | null
  /** Whether the result came from a cache (memory or localStorage) */
  fromCache: boolean
  /** Error message if fetch failed (schedule may still be available from cache) */
  error: string | null
}

/** Options for fetch operations */
export interface FetchOptions {
  /** AbortSignal for cancellation */
  signal?: AbortSignal
  /** Force bypass all caches and fetch from network */
  forceRefresh?: boolean
}

// ---------------------------------------------------------------------------
// L1: In-memory cache (5-minute TTL)
// ---------------------------------------------------------------------------

const memoryCache = new TTLCache<string, DaySchedule | null>({
  ttlMs: 5 * 60 * 1000, // 5 minutes
})

// ---------------------------------------------------------------------------
// L2: localStorage cache (24-hour TTL)
// ---------------------------------------------------------------------------

/** Key prefix for localStorage entries */
const LS_PREFIX = 'siganpyo-remote-'

/** TTL for localStorage cache entries (24 hours) */
const LS_TTL_MS = 24 * 60 * 60 * 1000

/** localStorage cache entry structure */
interface LSCacheEntry {
  /** The DaySchedule data (or null for "no data" entries) */
  data: DaySchedule | null
  /** Timestamp when this entry was cached */
  cachedAt: number
  /** Repo config fingerprint for cache invalidation */
  configKey: string
}

/**
 * Build a composite cache key from date + repo config.
 * Ensures cache invalidation when the user changes repo settings.
 */
function compositeKey(date: string, config: RepoConfig): string {
  return `${date}:${config.repoOwner}/${config.repoName}/${config.branch}`
}

/**
 * Build the localStorage key for a given date.
 * Uses date-only key since localStorage is keyed differently from in-memory.
 */
function lsKey(date: string): string {
  return `${LS_PREFIX}${date}`
}

/**
 * Build a config fingerprint for detecting config changes.
 */
function configFingerprint(config: RepoConfig): string {
  return `${config.repoOwner}/${config.repoName}/${config.branch}`
}

/**
 * Read a schedule from localStorage cache.
 * Returns null if: not found, expired, or config mismatch.
 */
function readFromLocalStorage(
  date: string,
  config: RepoConfig,
): DaySchedule | null | undefined {
  try {
    const raw = localStorage.getItem(lsKey(date))
    if (!raw) return undefined // no entry

    const entry: LSCacheEntry = JSON.parse(raw)

    // Check TTL
    if (Date.now() - entry.cachedAt >= LS_TTL_MS) {
      return undefined // expired
    }

    // Check config fingerprint
    if (entry.configKey !== configFingerprint(config)) {
      return undefined // config changed
    }

    return entry.data
  } catch {
    return undefined // parse error
  }
}

/**
 * Write a schedule to localStorage cache.
 */
function writeToLocalStorage(
  date: string,
  config: RepoConfig,
  data: DaySchedule | null,
): void {
  try {
    const entry: LSCacheEntry = {
      data,
      cachedAt: Date.now(),
      configKey: configFingerprint(config),
    }
    localStorage.setItem(lsKey(date), JSON.stringify(entry))
  } catch {
    // localStorage quota exceeded — silently fail
    console.warn(`[schedule-fetch] Failed to cache schedule for ${date} in localStorage`)
  }
}

/**
 * Remove a schedule from localStorage cache.
 */
function removeFromLocalStorage(date: string): void {
  try {
    localStorage.removeItem(lsKey(date))
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// L3: GitHub Raw URL fetch
// ---------------------------------------------------------------------------

/**
 * Build the GitHub raw URL for a given date and repo config.
 *
 * @example
 *   buildGitHubUrl('2026-05-08', { repoOwner: 'user', repoName: 'plans', branch: 'main' })
 *   // → 'https://raw.githubusercontent.com/user/plans/main/data/2026-05-08.json'
 */
function buildGitHubUrl(date: string, config: RepoConfig): string {
  return `https://raw.githubusercontent.com/${config.repoOwner}/${config.repoName}/${config.branch}/data/${date}.json`
}

/**
 * Validate that a parsed JSON object conforms to the DaySchedule shape.
 */
function isValidDaySchedule(data: unknown): data is DaySchedule {
  if (typeof data !== 'object' || data === null) return false

  const obj = data as Record<string, unknown>

  if (typeof obj.date !== 'string') return false
  if (typeof obj.generated_at !== 'string') return false
  if (!Array.isArray(obj.blocks)) return false
  if (typeof obj.meta !== 'object' || obj.meta === null) return false

  for (const block of obj.blocks as Record<string, unknown>[]) {
    if (typeof block.id !== 'string') return false
    if (typeof block.startTime !== 'string') return false
    if (typeof block.endTime !== 'string') return false
    if (typeof block.title !== 'string') return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Main fetch function
// ---------------------------------------------------------------------------

/**
 * Fetch day schedule data with multi-layer caching.
 *
 * @param date    Date string in YYYY-MM-DD format
 * @param config  GitHub repository configuration
 * @param options Optional fetch options (signal, forceRefresh)
 * @returns ScheduleFetchResult with schedule data, cache status, and any error
 */
export async function fetchSchedule(
  date: string,
  config: RepoConfig,
  options?: FetchOptions,
): Promise<ScheduleFetchResult> {
  // Validate config
  if (!config.repoOwner || !config.repoName) {
    return {
      schedule: null,
      fromCache: false,
      error: 'GitHub 저장소 설정이 필요합니다. (owner/repo)',
    }
  }

  const key = compositeKey(date, config)

  // ---- L1: In-memory cache hit (unless force refresh) ----
  if (!options?.forceRefresh) {
    const memHit = memoryCache.get(key)
    if (memHit !== undefined) {
      return { schedule: memHit, fromCache: true, error: null }
    }
  }

  // ---- L2: localStorage cache hit (unless force refresh) ----
  if (!options?.forceRefresh) {
    const lsHit = readFromLocalStorage(date, config)
    if (lsHit !== undefined) {
      // Promote to L1 memory cache
      memoryCache.set(key, lsHit)
      return { schedule: lsHit, fromCache: true, error: null }
    }
  }

  // ---- L3: Fetch from GitHub ----
  return doNetworkFetch(date, config, key, options)
}

/**
 * Perform the actual network fetch from GitHub.
 * Separated out for deduplication logic.
 */
async function doNetworkFetch(
  date: string,
  config: RepoConfig,
  key: string,
  options?: FetchOptions,
): Promise<ScheduleFetchResult> {
  const url = buildGitHubUrl(date, config)

  try {
    const response = await fetch(url, {
      signal: options?.signal,
      headers: { Accept: 'application/json' },
    })

    // 404 = no data for this date (normal case)
    if (response.status === 404) {
      memoryCache.set(key, null)
      writeToLocalStorage(date, config, null)
      return { schedule: null, fromCache: false, error: null }
    }

    // 403 = rate limited
    if (response.status === 403) {
      const retryAfter = response.headers.get('Retry-After')
      const message = retryAfter
        ? `GitHub 요청 제한에 도달했습니다. ${retryAfter}초 후 재시도하세요.`
        : 'GitHub 요청 제한에 도달했습니다. 잠시 후 다시 시도하세요.'

      // Try stale localStorage cache as fallback
      const stale = readFromLocalStorage(date, config)
      if (stale !== undefined) {
        memoryCache.set(key, stale)
        return { schedule: stale, fromCache: true, error: message }
      }

      return { schedule: null, fromCache: false, error: message }
    }

    // Other HTTP errors
    if (!response.ok) {
      // Try stale cache on server errors (5xx)
      if (response.status >= 500) {
        const stale = readFromLocalStorage(date, config)
        if (stale !== undefined) {
          memoryCache.set(key, stale)
          return {
            schedule: stale,
            fromCache: true,
            error: `서버 오류 (HTTP ${response.status}). 캐시된 데이터를 표시합니다.`,
          }
        }
      }

      return {
        schedule: null,
        fromCache: false,
        error: `데이터를 불러오지 못했습니다. (HTTP ${response.status})`,
      }
    }

    // Parse JSON
    let data: unknown
    try {
      data = await response.json()
    } catch {
      return {
        schedule: null,
        fromCache: false,
        error: '데이터 형식이 올바르지 않습니다.',
      }
    }

    // Validate schema
    if (!isValidDaySchedule(data)) {
      return {
        schedule: null,
        fromCache: false,
        error: '데이터 스키마가 올바르지 않습니다.',
      }
    }

    // Cache in L1 + L2
    memoryCache.set(key, data)
    writeToLocalStorage(date, config, data)

    return { schedule: data, fromCache: false, error: null }
  } catch (err) {
    // Aborted request
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { schedule: null, fromCache: false, error: null }
    }

    // Network error
    const message =
      err instanceof TypeError
        ? '네트워크 연결을 확인하세요.'
        : err instanceof Error
          ? err.message
          : '알 수 없는 오류가 발생했습니다.'

    // Try stale cache as fallback (try memory first, then localStorage)
    const staleMemory = memoryCache.get(key, { allowStale: true })
    if (staleMemory !== undefined && staleMemory !== null) {
      return { schedule: staleMemory, fromCache: true, error: message }
    }

    const staleLS = readFromLocalStorage(date, config)
    if (staleLS !== undefined && staleLS !== null) {
      memoryCache.set(key, staleLS)
      return { schedule: staleLS, fromCache: true, error: message }
    }

    return { schedule: null, fromCache: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// Synchronous cache read (for offline / instant access)
// ---------------------------------------------------------------------------

/**
 * Synchronously get a cached schedule.
 * Checks in-memory cache first, then localStorage.
 * Returns `undefined` if no cache available.
 *
 * Use this for instant renders before network fetch completes,
 * or for offline mode.
 */
export function getCachedSchedule(
  date: string,
  config: RepoConfig,
): DaySchedule | null | undefined {
  const key = compositeKey(date, config)

  // L1: Memory
  const mem = memoryCache.get(key)
  if (mem !== undefined) return mem

  // L2: localStorage
  const ls = readFromLocalStorage(date, config)
  if (ls !== undefined) {
    // Promote to L1
    memoryCache.set(key, ls)
    return ls
  }

  return undefined
}

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

/**
 * Clear all cached data (in-memory + localStorage).
 */
export function clearAllScheduleCache(): void {
  memoryCache.clear()

  // Clear all localStorage entries with our prefix
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(LS_PREFIX)) {
        keysToRemove.push(k)
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k))
  } catch {
    // ignore
  }
}

/**
 * Invalidate cache for a specific date + config.
 * If config is omitted, clears all entries for that date.
 */
export function invalidateScheduleCache(
  date: string,
  config?: RepoConfig,
): void {
  if (config) {
    const key = compositeKey(date, config)
    memoryCache.delete(key)
  } else {
    // Clear all memory entries for this date
    const stats = memoryCache.getStats()
    for (const entry of stats.entries) {
      if (String(entry.key).startsWith(`${date}:`)) {
        memoryCache.delete(entry.key)
      }
    }
  }

  // Always clear localStorage for this date
  removeFromLocalStorage(date)
}

/**
 * Prune expired entries from in-memory cache.
 * @returns Number of entries evicted
 */
export function pruneScheduleCache(): number {
  return memoryCache.prune()
}

/**
 * Get cache statistics for debugging.
 */
export function getScheduleCacheStats() {
  return {
    memory: memoryCache.getStats(),
  }
}

/**
 * Prefetch schedule data in the background.
 * Useful for preloading tomorrow's data before midnight.
 * Errors are silently ignored.
 */
export function prefetchSchedule(
  date: string,
  config: RepoConfig,
): void {
  // Don't await — fire and forget
  fetchSchedule(date, config).catch(() => {
    // Silently ignore prefetch errors
  })
}
