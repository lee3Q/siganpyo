/**
 * CurrentTimeIndicator — a horizontal line showing the current time.
 *
 * Positioned absolutely within the grid at the precise pixel location.
 * Updates aligned to minute boundaries for accurate positioning.
 * Hidden when current time is outside the grid range (6:00–24:00 default).
 *
 * Sub-AC 2b: 수평 라인 표시, 분 단위 갱신, 범위 밖 숨김.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GridDimensions } from '@/hooks/useGridDimensions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CurrentTimeIndicatorProps {
  grid: GridDimensions
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TimePosition {
  top: number
  visible: boolean
}

/**
 * Calculate the vertical position of the current time line.
 * Includes seconds for sub-minute accuracy on initial render.
 */
function getCurrentTimePosition(grid: GridDimensions): TimePosition {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentSecond = now.getSeconds()

  // Hide when outside the grid's hour range
  if (currentHour < grid.startHour || currentHour >= grid.endHour) {
    return { top: 0, visible: false }
  }

  // Fractional minutes (including seconds) for smooth initial positioning
  const minutesFromStart =
    (currentHour - grid.startHour) * 60 + currentMinute + currentSecond / 60
  const top = (minutesFromStart / 60) * grid.hourHeight

  return { top, visible: true }
}

function formatCurrentTime(): string {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/**
 * Calculate milliseconds until the next minute boundary.
 * Used to align the first update to the exact start of a new minute.
 */
function msUntilNextMinute(): number {
  const now = new Date()
  const msIntoMinute = now.getSeconds() * 1000 + now.getMilliseconds()
  return 60_000 - msIntoMinute
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CurrentTimeIndicator({ grid }: CurrentTimeIndicatorProps) {
  const [position, setPosition] = useState(() => getCurrentTimePosition(grid))
  const [timeLabel, setTimeLabel] = useState(() => formatCurrentTime())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const update = useCallback(() => {
    setPosition(getCurrentTimePosition(grid))
    setTimeLabel(formatCurrentTime())
  }, [grid])

  useEffect(() => {
    // Initial update with seconds-accurate position
    update()

    // Align the first update to the next minute boundary,
    // then switch to a regular 60-second interval.
    // This ensures the position updates exactly when the minute changes.
    const delay = msUntilNextMinute()

    timerRef.current = setTimeout(() => {
      update()

      // Now update every 60 seconds, aligned to minute boundaries
      intervalRef.current = setInterval(update, 60_000)
    }, delay)

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      if (intervalRef.current !== null) clearInterval(intervalRef.current)
    }
  }, [update])

  if (!position.visible) {
    return null
  }

  return (
    <div
      className="absolute left-14 right-0 pointer-events-none z-20"
      style={{ top: position.top }}
      aria-hidden="true"
    >
      {/* Time label bubble */}
      <div
        className="absolute -left-0 -top-2 bg-[var(--color-now-line)] text-white text-[9px] font-bold px-1 py-0.5 rounded"
      >
        {timeLabel}
      </div>

      {/* Horizontal line */}
      <div className="w-full h-[2px] bg-[var(--color-now-line)]" />

      {/* Dot at the right edge */}
      <div className="absolute right-0 -top-[3px] w-2 h-2 rounded-full bg-[var(--color-now-line)]" />
    </div>
  )
}
