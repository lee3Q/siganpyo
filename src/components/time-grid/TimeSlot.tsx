/**
 * TimeSlot — a single 30-minute row in the time grid.
 *
 * Renders:
 * - A subtle grid line (thicker for hour boundaries)
 * - The time label on the left (only for full-hour slots)
 * - A clickable area for creating new blocks
 */

import { useCallback } from 'react'
import { useUIStore } from '@/stores/ui-store'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeSlotProps {
  /** Hour component (0–23) */
  hour: number
  /** Minutes component (0 or 30) */
  minutes: number
  /** Height of this slot in pixels */
  height: number
  /** Whether this is the first slot (don't show top border) */
  isFirst?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeLabel(hour: number, minutes: number): string {
  if (minutes === 0) {
    const period = hour < 12 ? '오전' : '오후'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${period} ${displayHour}시`
  }
  return ''
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimeSlot({
  hour,
  minutes,
  height,
  isFirst = false,
}: TimeSlotProps) {
  const openCreateBlock = useUIStore((s) => s.openCreateBlock)

  const isHourBoundary = minutes === 0
  const timeLabel = formatTimeLabel(hour, minutes)
  const timeString = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

  const handleClick = useCallback(() => {
    openCreateBlock(timeString)
  }, [openCreateBlock, timeString])

  return (
    <div
      className="relative flex w-full"
      style={{ height }}
      onClick={handleClick}
      role="button"
      tabIndex={-1}
      aria-label={`${timeString} - 빈 슬롯 (클릭하여 새 블록 생성)`}
    >
      {/* Time label column */}
      <div className="w-14 flex-shrink-0 flex items-start justify-end pr-2 pt-0.5 select-none">
        {isHourBoundary && (
          <span className="text-[11px] font-medium text-text-tertiary leading-none">
            {timeLabel}
          </span>
        )}
      </div>

      {/* Grid area */}
      <div className="flex-1 relative">
        {/* Grid lines */}
        {!isFirst && (
          <div
            className={`absolute top-0 left-0 right-0 ${
              isHourBoundary
                ? 'border-t border-[var(--color-grid-line-hour)]'
                : 'border-t border-dashed border-[var(--color-grid-line)]'
            }`}
          />
        )}
      </div>
    </div>
  )
}
