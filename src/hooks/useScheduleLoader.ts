/**
 * useScheduleLoader — React hook that connects the schedule fetch+cache utility
 * to the schedule store.
 *
 * Responsibilities:
 * - Fetches day schedule from GitHub when date changes
 * - Respects multi-layer cache (memory 5min → localStorage 24h → network)
 * - Updates schedule store (loading, error, remoteSchedule)
 * - Handles midnight auto-transition
 * - Supports manual refresh with cache bypass
 * - Offline fallback via localStorage cache
 */

import { useEffect, useRef, useCallback } from 'react'
import { useScheduleStore } from '@/stores/schedule-store'
import { useConfigStore } from '@/stores/config-store'
import { useUIStore } from '@/stores/ui-store'
import {
  fetchSchedule,
  getCachedSchedule,
  invalidateScheduleCache,
  type RepoConfig,
} from '@/services/schedule-fetch'

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Interval for checking midnight crossover (every 30 seconds) */
const MIDNIGHT_CHECK_INTERVAL_MS = 30_000

/** Minimum time between fetches for the same date (prevents double-fetch in StrictMode) */
const FETCH_DEBOUNCE_MS = 1000

export function useScheduleLoader(): {
  /** Manually refresh data from GitHub (bypasses cache) */
  refresh: () => void
} {
  const currentDate = useScheduleStore((s) => s.currentDate)
  const setRemoteSchedule = useScheduleStore((s) => s.setRemoteSchedule)
  const setLoading = useScheduleStore((s) => s.setLoading)
  const setError = useScheduleStore((s) => s.setError)
  const setLastFetchedAt = useScheduleStore((s) => s.setLastFetchedAt)
  const navigateToDate = useScheduleStore((s) => s.navigateToDate)

  const repoOwner = useConfigStore((s) => s.repoOwner)
  const repoName = useConfigStore((s) => s.repoName)
  const branch = useConfigStore((s) => s.branch)

  const setOffline = useUIStore((s) => s.setOffline)

  // Track the last date we fetched to avoid duplicate fetches
  const lastFetchedDateRef = useRef<string | null>(null)
  const lastFetchTimeRef = useRef<number>(0)
  const abortRef = useRef<AbortController | null>(null)

  /** Build config from store values */
  const getConfig = useCallback((): RepoConfig => {
    return { repoOwner, repoName, branch }
  }, [repoOwner, repoName, branch])

  /** Core fetch logic */
  const doFetch = useCallback(
    async (date: string, forceRefresh = false) => {
      const config = getConfig()

      // Skip if repo isn't configured
      if (!config.repoOwner || !config.repoName) {
        setRemoteSchedule(null)
        setError('GitHub 저장소를 설정해주세요.')
        setLoading(false)
        return
      }

      // Debounce rapid re-fetches for same date
      const now = Date.now()
      if (
        !forceRefresh &&
        lastFetchedDateRef.current === date &&
        now - lastFetchTimeRef.current < FETCH_DEBOUNCE_MS
      ) {
        return
      }

      // Cancel previous request
      if (abortRef.current) {
        abortRef.current.abort()
      }
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      setError(null)

      // Try synchronous cache first for instant render
      const cached = getCachedSchedule(date, config)
      if (cached !== undefined) {
        setRemoteSchedule(cached)
        setOffline(false)
      }

      try {
        const result = await fetchSchedule(date, config, {
          signal: controller.signal,
          forceRefresh,
        })

        // Ignore if request was aborted (stale)
        if (controller.signal.aborted) return

        setRemoteSchedule(result.schedule)
        setOffline(false)

        if (result.error) {
          setError(result.error)
        } else {
          setError(null)
        }

        lastFetchedDateRef.current = date
        lastFetchTimeRef.current = Date.now()
        setLastFetchedAt(Date.now())
      } catch {
        // Should not happen (errors handled in service), but guard
        setError('예상치 못한 오류가 발생했습니다.')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    },
    [
      getConfig,
      setRemoteSchedule,
      setLoading,
      setError,
      setLastFetchedAt,
      setOffline,
    ],
  )

  // ---- Fetch on date change ----
  useEffect(() => {
    doFetch(currentDate)
  }, [currentDate, doFetch])

  // ---- Re-fetch when repo config changes ----
  useEffect(() => {
    if (repoOwner && repoName) {
      // Invalidate cache since config changed
      invalidateScheduleCache(currentDate)
      lastFetchedDateRef.current = null
      doFetch(currentDate)
    }
  }, [repoOwner, repoName, branch]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Midnight auto-transition ----
  useEffect(() => {
    let lastDate = todayString()

    const interval = setInterval(() => {
      const newDate = todayString()
      if (newDate !== lastDate) {
        lastDate = newDate
        navigateToDate(newDate)
      }
    }, MIDNIGHT_CHECK_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [navigateToDate])

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [])

  // ---- Manual refresh ----
  const refresh = useCallback(() => {
    invalidateScheduleCache(currentDate)
    lastFetchedDateRef.current = null
    doFetch(currentDate, true)
  }, [currentDate, doFetch])

  return { refresh }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayString(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
