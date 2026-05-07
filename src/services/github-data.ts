/**
 * GitHub Raw URL Data Fetch Service
 *
 * Fetches day schedule data from GitHub raw URLs:
 *   https://raw.githubusercontent.com/{owner}/{repo}/{branch}/data/YYYY-MM-DD.json
 *
 * Features:
 * - 5-minute in-memory TTL cache (avoids GitHub rate limit: 60 req/hr for unauthenticated)
 * - Robust error handling (network, 404, parse errors)
 * - Schema validation for fetched data
 * - AbortController support for cancellable requests
 * - Stale-while-error: returns expired cache on network failure
 */

import type { DaySchedule } from '@/types'
import { TTLCache } from '@/lib/ttl-cache'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration needed to build the GitHub raw URL */
export interface GitHubRepoConfig {
  repoOwner: string
  repoName: string
  branch: string
}

/** Result of a fetch attempt */
export interface FetchResult {
  /** The fetched schedule, or null if no data exists for the date */
  schedule: DaySchedule | null
  /** Whether the fetch resulted in a cache hit */
  fromCache: boolean
  /** Error message if fetch failed (but schedule may still be available from cache) */
  error: string | null
}

// ---------------------------------------------------------------------------
// Cache (backed by TTLCache utility)
// ---------------------------------------------------------------------------

/** Cache entry keyed by composite key: "date:owner/repo/branch" */
const scheduleCache = new TTLCache<string, DaySchedule | null>({
  ttlMs: 5 * 60 * 1000, // 5 minutes
})

/**
 * Build a composite cache key from date + repo config.
 * This ensures cache invalidation when the user changes repo settings.
 */
function compositeKey(date: string, config: GitHubRepoConfig): string {
  return `${date}:${config.repoOwner}/${config.repoName}/${config.branch}`
}

// ---------------------------------------------------------------------------
// URL Builder
// ---------------------------------------------------------------------------

/**
 * Build the GitHub raw URL for a given date and repo config.
 *
 * @example
 *   buildRawUrl('2026-05-08', { repoOwner: 'user', repoName: 'plans', branch: 'main' })
 *   // → 'https://raw.githubusercontent.com/user/plans/main/data/2026-05-08.json'
 */
export function buildRawUrl(date: string, config: GitHubRepoConfig): string {
  const { repoOwner, repoName, branch } = config
  return `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${branch}/data/${date}.json`
}

// ---------------------------------------------------------------------------
// Schema Validation
// ---------------------------------------------------------------------------

/**
 * Validate that a parsed JSON object conforms to the DaySchedule shape.
 * Performs structural checks but does not validate every nested field deeply.
 */
function isValidDaySchedule(data: unknown): data is DaySchedule {
  if (typeof data !== 'object' || data === null) return false

  const obj = data as Record<string, unknown>

  // Required top-level fields
  if (typeof obj.date !== 'string') return false
  if (typeof obj.generated_at !== 'string') return false
  if (!Array.isArray(obj.blocks)) return false
  if (typeof obj.meta !== 'object' || obj.meta === null) return false

  // Validate each block has required fields
  for (const block of obj.blocks as Record<string, unknown>[]) {
    if (typeof block.id !== 'string') return false
    if (typeof block.startTime !== 'string') return false
    if (typeof block.endTime !== 'string') return false
    if (typeof block.title !== 'string') return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/** Active requests (keyed by composite key) — allows cancellation */
const activeRequests = new Map<string, AbortController>()

/**
 * Fetch day schedule data from GitHub.
 *
 * - Returns cached data if within 5-minute TTL
 * - Handles 404 gracefully (no data for that date → null)
 * - Handles network errors, JSON parse errors, schema validation failures
 * - Supports AbortController for cancellation
 * - On network failure, returns stale cache if available
 *
 * @param date  Date string in YYYY-MM-DD format
 * @param config  GitHub repo configuration
 * @param options  Optional fetch options
 * @returns FetchResult with schedule data, cache status, and any error
 */
export async function fetchDayFromGitHub(
  date: string,
  config: GitHubRepoConfig,
  options?: { signal?: AbortSignal; forceRefresh?: boolean },
): Promise<FetchResult> {
  const { repoOwner, repoName, branch } = config

  // Validate config
  if (!repoOwner || !repoName) {
    return {
      schedule: null,
      fromCache: false,
      error: 'GitHub 저장소 설정이 필요합니다. (owner/repo)',
    }
  }

  const key = compositeKey(date, config)

  // Check cache (unless force refresh)
  if (!options?.forceRefresh) {
    const cached = scheduleCache.get(key)
    if (cached !== undefined) {
      return { schedule: cached, fromCache: true, error: null }
    }
  }

  // Cancel any existing request for this key
  const existingController = activeRequests.get(key)
  if (existingController) {
    existingController.abort()
  }

  // Create new AbortController, linking to external signal if provided
  const controller = new AbortController()
  activeRequests.set(key, controller)

  if (options?.signal) {
    options.signal.addEventListener('abort', () => controller.abort())
  }

  const url = buildRawUrl(date, { repoOwner, repoName, branch })

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    })

    // 404 = no data for this date (normal case)
    if (response.status === 404) {
      scheduleCache.set(key, null)
      return { schedule: null, fromCache: false, error: null }
    }

    // 403 = rate limited
    if (response.status === 403) {
      const retryAfter = response.headers.get('Retry-After')
      const message = retryAfter
        ? `GitHub 요청 제한에 도달했습니다. ${retryAfter}초 후 재시도하세요.`
        : 'GitHub 요청 제한에 도달했습니다. 잠시 후 다시 시도하세요.'
      return { schedule: null, fromCache: false, error: message }
    }

    // Other HTTP errors
    if (!response.ok) {
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

    // Cache and return
    scheduleCache.set(key, data)
    return { schedule: data, fromCache: false, error: null }
  } catch (err) {
    // Aborted request — don't treat as error
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

    // On network error, try to return stale cache
    const stale = scheduleCache.get(key, { allowStale: true })
    if (stale !== undefined && stale !== null) {
      return { schedule: stale, fromCache: true, error: message }
    }

    return { schedule: null, fromCache: false, error: message }
  } finally {
    activeRequests.delete(key)
  }
}

// ---------------------------------------------------------------------------
// Cache Management
// ---------------------------------------------------------------------------

/**
 * Clear all cached data.
 */
export function clearCache(): void {
  scheduleCache.clear()
}

/**
 * Clear cached data for a specific date + config combination.
 * If only a date is provided, clears all entries matching that date prefix.
 */
export function invalidateCache(
  date: string,
  config?: GitHubRepoConfig,
): void {
  if (config) {
    scheduleCache.delete(compositeKey(date, config))
  } else {
    // Delete all entries starting with the date prefix
    const stats = scheduleCache.getStats()
    for (const entry of stats.entries) {
      // Key format is "date:owner/repo/branch"
      if (String(entry.key).startsWith(`${date}:`)) {
        scheduleCache.delete(entry.key)
      }
    }
  }
}

/**
 * Get cache statistics (useful for debugging).
 */
export function getCacheStats() {
  return scheduleCache.getStats()
}
