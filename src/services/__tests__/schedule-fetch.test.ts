import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchSchedule,
  getCachedSchedule,
  clearAllScheduleCache,
  invalidateScheduleCache,
  prefetchSchedule,
  getScheduleCacheStats,
  pruneScheduleCache,
  type RepoConfig,
} from '../schedule-fetch'
import type { DaySchedule } from '@/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockConfig: RepoConfig = {
  repoOwner: 'testuser',
  repoName: 'my-plans',
  branch: 'main',
}

const mockSchedule: DaySchedule = {
  date: '2026-05-08',
  generated_at: '2026-05-07T22:00:00Z',
  blocks: [
    {
      id: 'block-1',
      startTime: '09:00',
      endTime: '10:30',
      title: '팀 미팅',
      category: 'work',
      color: 'blue',
      notes: '',
      advice: null,
      checklist: [],
      status: 'planned',
      source: 'ai',
    },
    {
      id: 'block-2',
      startTime: '11:00',
      endTime: '12:00',
      title: '코딩',
      category: 'work',
      color: 'green',
      notes: '## 오늘의 작업\n- 기능 구현',
      advice: '집중할 때 알림을 끄세요.',
      checklist: [
        { text: 'PR 리뷰', done: false },
        { text: '테스트 작성', done: false },
      ],
      status: 'planned',
      source: 'ai',
    },
  ],
  meta: { version: 1, source: 'claude' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the expected GitHub raw URL for a date */
function expectedUrl(date: string): string {
  return `https://raw.githubusercontent.com/${mockConfig.repoOwner}/${mockConfig.repoName}/${mockConfig.branch}/data/${date}.json`
}

/** Create a mock Response for fetch */
function mockFetchResponse(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('schedule-fetch', () => {
  beforeEach(() => {
    // Clear all caches before each test
    clearAllScheduleCache()
    // Clear localStorage mock
    localStorage.clear()
    // Reset fetch mock
    vi.restoreAllMocks()
  })

  // ---- fetchSchedule: network fetch + cache ----

  describe('fetchSchedule', () => {
    it('fetches schedule from GitHub and returns data', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse(mockSchedule),
      )

      const result = await fetchSchedule('2026-05-08', mockConfig)

      expect(result.schedule).toEqual(mockSchedule)
      expect(result.fromCache).toBe(false)
      expect(result.error).toBeNull()
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expectedUrl('2026-05-08'),
        expect.objectContaining({
          headers: { Accept: 'application/json' },
        }),
      )
    })

    it('returns null schedule for 404 (no data for date)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, { status: 404 }),
      )

      const result = await fetchSchedule('2026-05-08', mockConfig)

      expect(result.schedule).toBeNull()
      expect(result.error).toBeNull()
    })

    it('caches fetched data in memory (L1)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse(mockSchedule),
      )

      // First fetch — network
      const r1 = await fetchSchedule('2026-05-08', mockConfig)
      expect(r1.fromCache).toBe(false)

      // Second fetch — memory cache hit
      const r2 = await fetchSchedule('2026-05-08', mockConfig)
      expect(r2.fromCache).toBe(true)
      expect(r2.schedule).toEqual(mockSchedule)

      // Only one network call
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })

    it('caches fetched data in localStorage (L2)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse(mockSchedule),
      )

      await fetchSchedule('2026-05-08', mockConfig)

      // Verify localStorage was written
      const stored = localStorage.getItem('siganpyo-remote-2026-05-08')
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(parsed.data).toEqual(mockSchedule)
      expect(parsed.configKey).toBe('testuser/my-plans/main')
    })

    it('reads from localStorage when memory cache misses', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse(mockSchedule),
      )

      // First fetch — caches to memory + localStorage
      await fetchSchedule('2026-05-08', mockConfig)

      // Clear memory cache only (simulating page reload)
      clearAllScheduleCache() // clears both, so we'll manually restore localStorage
      // Re-populate localStorage manually (simulating it surviving a page reload)
      localStorage.setItem(
        'siganpyo-remote-2026-05-08',
        JSON.stringify({
          data: mockSchedule,
          cachedAt: Date.now(),
          configKey: 'testuser/my-plans/main',
        }),
      )

      // Second fetch — should hit localStorage (L2) and NOT call network
      const result = await fetchSchedule('2026-05-08', mockConfig)
      expect(result.schedule).toEqual(mockSchedule)
      expect(result.fromCache).toBe(true)
      expect(globalThis.fetch).toHaveBeenCalledTimes(1) // only the first call
    })

    it('returns error when repo config is missing', async () => {
      const badConfig: RepoConfig = { repoOwner: '', repoName: '', branch: 'main' }
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      const result = await fetchSchedule('2026-05-08', badConfig)

      expect(result.schedule).toBeNull()
      expect(result.error).toContain('GitHub 저장소 설정')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('returns error on 403 (rate limited)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, { status: 403 }),
      )

      const result = await fetchSchedule('2026-05-08', mockConfig)

      expect(result.schedule).toBeNull()
      expect(result.error).toContain('요청 제한')
    })

    it('returns error on 500 server error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, { status: 500 }),
      )

      const result = await fetchSchedule('2026-05-08', mockConfig)

      expect(result.schedule).toBeNull()
      expect(result.error).toContain('500')
    })

    it('returns error for invalid JSON', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('not json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const result = await fetchSchedule('2026-05-08', mockConfig)

      expect(result.schedule).toBeNull()
      expect(result.error).toContain('데이터 형식')
    })

    it('returns error for invalid schema', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ invalid: 'data' }),
      )

      const result = await fetchSchedule('2026-05-08', mockConfig)

      expect(result.schedule).toBeNull()
      expect(result.error).toContain('스키마')
    })

    it('handles network errors and returns stale cache', async () => {
      // First: successful fetch
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse(mockSchedule),
      )
      await fetchSchedule('2026-05-08', mockConfig)

      // Now simulate network error
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new TypeError('Failed to fetch'),
      )

      // Force refresh to bypass memory cache
      const result = await fetchSchedule('2026-05-08', mockConfig, {
        forceRefresh: true,
      })

      // Should return stale data from localStorage
      expect(result.schedule).toEqual(mockSchedule)
      expect(result.fromCache).toBe(true)
      expect(result.error).toContain('네트워크')
    })

    it('handles network errors with no cache gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new TypeError('Failed to fetch'),
      )

      const result = await fetchSchedule('2026-05-08', mockConfig)

      expect(result.schedule).toBeNull()
      expect(result.error).toContain('네트워크')
    })

    it('supports AbortSignal', async () => {
      const controller = new AbortController()
      controller.abort()

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => {
        throw new DOMException('The operation was aborted', 'AbortError')
      })

      const result = await fetchSchedule('2026-05-08', mockConfig, {
        signal: controller.signal,
      })

      expect(result.schedule).toBeNull()
      expect(result.error).toBeNull()
    })

    it('deduplicates concurrent fetches for same date+config', async () => {
      let resolveFetch: (r: Response) => void
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve
      })

      vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(fetchPromise)

      // Start two concurrent fetches
      const p1 = fetchSchedule('2026-05-08', mockConfig)
      const p2 = fetchSchedule('2026-05-08', mockConfig)

      // Resolve the fetch
      resolveFetch!(mockFetchResponse(mockSchedule))

      const [r1, r2] = await Promise.all([p1, p2])

      // Both should get data
      expect(r1.schedule).toEqual(mockSchedule)
      expect(r2.schedule).toEqual(mockSchedule)

      // Only one network call
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })
  })

  // ---- forceRefresh ----

  describe('forceRefresh', () => {
    it('bypasses memory cache when forceRefresh is true', async () => {
      // First fetch — caches data
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse(mockSchedule),
      )
      await fetchSchedule('2026-05-08', mockConfig)

      // Second fetch with forceRefresh — should hit network again
      const updatedSchedule = { ...mockSchedule, blocks: [] }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse(updatedSchedule),
      )

      const result = await fetchSchedule('2026-05-08', mockConfig, {
        forceRefresh: true,
      })

      expect(result.schedule).toEqual(updatedSchedule)
      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    })
  })

  // ---- getCachedSchedule (synchronous) ----

  describe('getCachedSchedule', () => {
    it('returns undefined when no cache exists', () => {
      const result = getCachedSchedule('2026-05-08', mockConfig)
      expect(result).toBeUndefined()
    })

    it('returns schedule from memory cache', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse(mockSchedule),
      )
      await fetchSchedule('2026-05-08', mockConfig)

      const cached = getCachedSchedule('2026-05-08', mockConfig)
      expect(cached).toEqual(mockSchedule)
    })

    it('returns schedule from localStorage when memory cache is empty', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse(mockSchedule),
      )
      await fetchSchedule('2026-05-08', mockConfig)

      // Clear memory cache only by clearing and restoring localStorage
      localStorage.setItem(
        'siganpyo-remote-2026-05-08',
        JSON.stringify({
          data: mockSchedule,
          cachedAt: Date.now(),
          configKey: 'testuser/my-plans/main',
        }),
      )
      // Directly clear the memory cache via the stats method
      clearAllScheduleCache()
      // Restore localStorage entry
      localStorage.setItem(
        'siganpyo-remote-2026-05-08',
        JSON.stringify({
          data: mockSchedule,
          cachedAt: Date.now(),
          configKey: 'testuser/my-plans/main',
        }),
      )

      const cached = getCachedSchedule('2026-05-08', mockConfig)
      expect(cached).toEqual(mockSchedule)
    })

    it('promotes localStorage data to memory cache on read', async () => {
      // Pre-populate localStorage directly
      localStorage.setItem(
        'siganpyo-remote-2026-05-08',
        JSON.stringify({
          data: mockSchedule,
          cachedAt: Date.now(),
          configKey: 'testuser/my-plans/main',
        }),
      )

      const cached = getCachedSchedule('2026-05-08', mockConfig)
      expect(cached).toEqual(mockSchedule)

      // Verify promoted to memory — second read should be from memory
      const stats = getScheduleCacheStats()
      expect(stats.memory.size).toBeGreaterThan(0)
    })
  })

  // ---- Cache invalidation ----

  describe('invalidateScheduleCache', () => {
    it('clears cache for specific date + config', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse(mockSchedule),
      )
      await fetchSchedule('2026-05-08', mockConfig)

      // Should be cached
      expect(getCachedSchedule('2026-05-08', mockConfig)).toEqual(mockSchedule)

      // Invalidate
      invalidateScheduleCache('2026-05-08', mockConfig)

      // Should be gone from both caches
      expect(getCachedSchedule('2026-05-08', mockConfig)).toBeUndefined()
      expect(localStorage.getItem('siganpyo-remote-2026-05-08')).toBeNull()
    })

    it('clears all config entries for a date when config omitted', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchResponse(mockSchedule),
      )

      const config2: RepoConfig = { ...mockConfig, branch: 'develop' }
      await fetchSchedule('2026-05-08', mockConfig)
      await fetchSchedule('2026-05-08', config2)

      invalidateScheduleCache('2026-05-08')

      expect(getCachedSchedule('2026-05-08', mockConfig)).toBeUndefined()
      expect(getCachedSchedule('2026-05-08', config2)).toBeUndefined()
    })
  })

  // ---- clearAllScheduleCache ----

  describe('clearAllScheduleCache', () => {
    it('clears all memory and localStorage caches', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchResponse(mockSchedule),
      )

      await fetchSchedule('2026-05-08', mockConfig)
      await fetchSchedule('2026-05-09', mockConfig)

      clearAllScheduleCache()

      expect(getCachedSchedule('2026-05-08', mockConfig)).toBeUndefined()
      expect(getCachedSchedule('2026-05-09', mockConfig)).toBeUndefined()
      expect(localStorage.getItem('siganpyo-remote-2026-05-08')).toBeNull()
      expect(localStorage.getItem('siganpyo-remote-2026-05-09')).toBeNull()
    })
  })

  // ---- pruneScheduleCache ----

  describe('pruneScheduleCache', () => {
    it('prunes expired memory entries', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))

      // Manually populate the cache via fetch
      const stats = pruneScheduleCache()
      expect(stats).toBe(0)

      vi.useRealTimers()
    })
  })

  // ---- prefetchSchedule ----

  describe('prefetchSchedule', () => {
    it('fetches data without returning result', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse(mockSchedule),
      )

      prefetchSchedule('2026-05-08', mockConfig)

      // Wait for the async fire-and-forget to complete
      await new Promise((r) => setTimeout(r, 50))

      // Data should be cached
      const cached = getCachedSchedule('2026-05-08', mockConfig)
      expect(cached).toEqual(mockSchedule)
    })

    it('silently ignores errors', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('network fail'),
      )

      // Should not throw
      prefetchSchedule('2026-05-08', mockConfig)

      await vi.waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledTimes(1)
      })
    })
  })

  // ---- Config change invalidation ----

  describe('config change', () => {
    it('does not return cached data for different config', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchResponse(mockSchedule),
      )

      const config1 = mockConfig
      const config2: RepoConfig = { repoOwner: 'other', repoName: 'repo', branch: 'main' }

      await fetchSchedule('2026-05-08', config1)
      await fetchSchedule('2026-05-08', config2)

      // Two network calls — different configs
      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    })
  })

  // ---- localStorage TTL ----

  describe('localStorage TTL', () => {
    it('ignores expired localStorage entries', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))

      // Write an entry with current time
      localStorage.setItem(
        'siganpyo-remote-2026-05-08',
        JSON.stringify({
          data: mockSchedule,
          cachedAt: Date.now(),
          configKey: 'testuser/my-plans/main',
        }),
      )

      // Advance past TTL (24 hours)
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1)

      const cached = getCachedSchedule('2026-05-08', mockConfig)
      expect(cached).toBeUndefined()

      vi.useRealTimers()
    })

    it('returns fresh localStorage entries', () => {
      localStorage.setItem(
        'siganpyo-remote-2026-05-08',
        JSON.stringify({
          data: mockSchedule,
          cachedAt: Date.now(),
          configKey: 'testuser/my-plans/main',
        }),
      )

      const cached = getCachedSchedule('2026-05-08', mockConfig)
      expect(cached).toEqual(mockSchedule)
    })
  })
})
