/**
 * TimeGrid — the main time grid layout for SiGanPyo.
 *
 * Renders a scroll-free grid of 30-minute slots from dayStartHour to dayEndHour.
 * Each slot height = available viewport height / total slots, ensuring the entire day
 * fits within the viewport without scrolling.
 *
 * Data binding flow:
 *   useScheduleLoader (App.tsx) → fetch + cache → schedule-store → getMergedBlocks()
 *   → TimeBlock[] sorted by startTime → absolute-positioned TimeBlockCards
 *
 * Structure:
 * - Header bar (date + controls + loading/error indicators)
 * - Offline banner (when applicable)
 * - Grid area:
 *   - Left: time labels
 *   - Right: slot rows with grid lines + absolutely positioned TimeBlockCards
 *   - CurrentTimeIndicator overlay
 *   - Empty state overlay (when no blocks)
 */

import { useMemo, useCallback, useRef } from 'react'
import { useGridDimensions, HEADER_HEIGHT_PX } from '@/hooks/useGridDimensions'
import { useScheduleStore } from '@/stores/schedule-store'
import { useUIStore } from '@/stores/ui-store'
import { TimeSlot } from './TimeSlot'
import { TimeBlockCard } from './TimeBlockCard'
import { CurrentTimeIndicator } from './CurrentTimeIndicator'
import { TimeGridDndContext } from '@/components/dnd/TimeGridDndContext'
import { SortableTimeBlock } from '@/components/dnd/SortableTimeBlock'
import { MobileEditSheet } from './MobileEditSheet'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateKorean(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const weekday = weekdays[date.getDay()]
  return `${year}년 ${month}월 ${day}일 (${weekday})`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimeGrid() {
  const grid = useGridDimensions()
  const currentDate = useScheduleStore((s) => s.currentDate)
  const isLoading = useScheduleStore((s) => s.isLoading)
  const error = useScheduleStore((s) => s.error)
  const remoteSchedule = useScheduleStore((s) => s.remoteSchedule)
  const getMergedBlocks = useScheduleStore((s) => s.getMergedBlocks)
  const moveBlock = useScheduleStore((s) => s.moveBlock)
  const resizeBlock = useScheduleStore((s) => s.resizeBlock)
  const navigateToDate = useScheduleStore((s) => s.navigateToDate)
  const closeCreateBlock = useUIStore((s) => s.closeCreateBlock)
  const isOffline = useUIStore((s) => s.isOffline)

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768

  // Swipe state for mobile date navigation
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // Merge remote + local data → sorted TimeBlock[] for rendering
  const blocks = useMemo(() => getMergedBlocks(), [getMergedBlocks, remoteSchedule])

  // Generate slot data: [startHour:00, startHour:30, startHour+1:00, ...]
  const slots = useMemo(() => {
    const result: { hour: number; minutes: number }[] = []
    for (let h = grid.startHour; h < grid.endHour; h++) {
      result.push({ hour: h, minutes: 0 })
      result.push({ hour: h, minutes: 30 })
    }
    return result
  }, [grid.startHour, grid.endHour])

  const handleGridClick = (e: React.MouseEvent) => {
    // Close create block modal if clicking on the grid background
    const target = e.target as HTMLElement
    if (target.closest('[data-time-block]')) return
    if (target.closest('button')) return
    closeCreateBlock()
  }

  // Determine empty state message
  const isEmpty = blocks.length === 0
  const hasRemoteData = remoteSchedule !== null
  const emptyMessage = isLoading
    ? '데이터를 불러오는 중...'
    : hasRemoteData
      ? '일정이 없습니다. 빈 슬롯을 클릭하여 새 블록을 만드세요.'
      : error
        ? '데이터를 불러올 수 없습니다. 빈 슬롯을 클릭하여 새 블록을 만드세요.'
        : '계획을 세워보세요. 빈 슬롯을 클릭하여 새 블록을 만들 수 있습니다.'

  const shiftDate = useCallback((days: number) => {
    const d = new Date(currentDate + 'T00:00:00')
    d.setDate(d.getDate() + days)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    navigateToDate(`${y}-${m}-${day}`)
  }, [currentDate, navigateToDate])

  // Mobile swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y
    touchStartRef.current = null

    // Only horizontal swipe (> 50px) and more horizontal than vertical
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      shiftDate(dx < 0 ? 1 : -1)
    }
  }, [shiftDate])

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Header — uses shared HEADER_HEIGHT_PX constant */}
      <header
        className="flex items-center justify-between px-4 border-b border-border flex-shrink-0"
        style={{ height: HEADER_HEIGHT_PX }}
      >
        <div className="flex items-center gap-1">
          <button
            className={`flex items-center justify-center rounded hover:bg-muted text-text-secondary text-sm ${isDesktop ? 'w-7 h-7' : 'w-11 h-11'}`}
            onClick={() => shiftDate(-1)}
            aria-label="이전 날짜"
          >
            &lt;
          </button>
          <h1 className={`font-semibold text-text-primary ${isDesktop ? 'text-base' : 'text-sm'}`}>
            {formatDateKorean(currentDate)}
          </h1>
          <button
            className={`flex items-center justify-center rounded hover:bg-muted text-text-secondary text-sm ${isDesktop ? 'w-7 h-7' : 'w-11 h-11'}`}
            onClick={() => shiftDate(1)}
            aria-label="다음 날짜"
          >
            &gt;
          </button>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <span className="text-xs text-text-tertiary animate-pulse">
              로딩중...
            </span>
          )}
          {error && !isLoading && (
            <span className="text-xs text-red-500 truncate max-w-32" title={error}>
              {error}
            </span>
          )}
          <span className="text-xs text-text-tertiary">시간표</span>
        </div>
      </header>

      {/* Offline banner */}
      {isOffline && (
        <div className="flex-shrink-0 px-4 py-1 bg-amber-50 border-b border-amber-200 text-center">
          <span className="text-xs text-amber-700">
            오프라인 모드 — 마지막 캐시 데이터를 표시합니다
          </span>
        </div>
      )}

      {/* Grid area — responsive layout */}
      <div
        className={`flex-1 relative ${isDesktop ? 'overflow-y-auto' : 'overflow-hidden'}`}
        onClick={handleGridClick}
        onTouchStart={!isDesktop ? handleTouchStart : undefined}
        onTouchEnd={!isDesktop ? handleTouchEnd : undefined}
      >
        {/* Desktop: center column with max-width */}
        <div className={`mx-auto ${isDesktop ? 'max-w-xl' : ''}`} style={{ height: isDesktop ? grid.gridHeight : undefined }}>
          {/* Slot rows (background grid lines + time labels) */}
          <div className={`absolute inset-0 ${isDesktop ? 'max-w-xl mx-auto' : ''}`}>
            {slots.map((slot, index) => (
              <TimeSlot
                key={`${slot.hour}:${slot.minutes}`}
                hour={slot.hour}
                minutes={slot.minutes}
                height={grid.slotHeight}
                isFirst={index === 0}
              />
            ))}
          </div>

          {/* Time blocks — wrapped in DnD context */}
          <TimeGridDndContext
            blockIds={blocks.map((b) => b.id)}
            gridStartHour={grid.startHour}
            gridEndHour={grid.endHour}
            hourHeight={grid.slotHeight * 2}
            onMoveBlock={(blockId, newStartTime) => moveBlock(blockId, newStartTime)}
            onResizeBlock={(blockId, newEndTime) => resizeBlock(blockId, newEndTime)}
          >
            <div className={`absolute inset-0 pointer-events-none ${isDesktop ? 'max-w-xl mx-auto' : ''}`}>
              {blocks.map((block) => (
                <SortableTimeBlock
                  key={block.id}
                  id={block.id}
                  startTime={block.startTime}
                  endTime={block.endTime}
                >
                  <div data-time-block className="pointer-events-auto">
                    <TimeBlockCard block={block} grid={grid} />
                  </div>
                </SortableTimeBlock>
              ))}
            </div>
          </TimeGridDndContext>

          {/* Empty state overlay — only when no blocks */}
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <p className="text-sm text-text-tertiary text-center px-8 max-w-xs">
                {emptyMessage}
              </p>
            </div>
          )}

          {/* Current time indicator overlay */}
          <CurrentTimeIndicator grid={grid} />
        </div>
      </div>

      {/* Mobile edit sheet */}
      {!isDesktop && <MobileEditSheet />}
    </div>
  )
}
