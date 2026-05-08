/**
 * TimeBlockCard — visual representation of a TimeBlock in the grid.
 *
 * Positioned absolutely within the grid based on startTime/endTime.
 * Shows title, time range, category color indicator, and status badge.
 */

import { useMemo } from 'react'
import type { TimeBlock, BlockColor, BlockStatus } from '@/types'
import { useUIStore } from '@/stores/ui-store'
import { useScheduleStore } from '@/stores/schedule-store'
import type { GridDimensions } from '@/hooks/useGridDimensions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeBlockCardProps {
  block: TimeBlock
  grid: GridDimensions
}

// ---------------------------------------------------------------------------
// Color mappings
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<BlockColor, { bg: string; border: string; text: string; dot: string }> = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-800',
    dot: 'bg-blue-500',
  },
  green: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-800',
    dot: 'bg-red-500',
  },
  yellow: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
  },
  purple: {
    bg: 'bg-violet-50',
    border: 'border-violet-300',
    text: 'text-violet-800',
    dot: 'bg-violet-500',
  },
  gray: {
    bg: 'bg-slate-50',
    border: 'border-slate-300',
    text: 'text-slate-800',
    dot: 'bg-slate-500',
  },
}

const STATUS_LABEL: Record<BlockStatus, string> = {
  planned: '계획',
  in_progress: '진행',
  done: '완료',
  skipped: '건너뜀',
}

const STATUS_COLOR: Record<BlockStatus, string> = {
  planned: 'bg-slate-200 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-emerald-100 text-emerald-700',
  skipped: 'bg-amber-100 text-amber-700',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeToSlotIndex(time: string, startHour: number): number {
  const [h, m] = time.split(':').map(Number)
  return (h - startHour) * 2 + (m >= 30 ? 1 : 0)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimeBlockCard({ block, grid }: TimeBlockCardProps) {
  const focusedBlockId = useUIStore((s) => s.focusedBlockId)
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)
  const focusBlock = useUIStore((s) => s.focusBlock)
  const updateBlockField = useScheduleStore((s) => s.updateBlockField)

  const colors = COLOR_MAP[block.color] ?? COLOR_MAP.gray

  const style = useMemo(() => {
    const startIndex = timeToSlotIndex(block.startTime, grid.startHour)
    const endIndex = timeToSlotIndex(block.endTime, grid.startHour)
    // For end times that land on :00 or :30 exactly, the block extends to that slot boundary
    const durationSlots = Math.max(endIndex - startIndex, 1)
    const top = startIndex * grid.slotHeight
    const height = durationSlots * grid.slotHeight

    return {
      top,
      height: Math.max(height, grid.slotHeight), // minimum one slot height
      width: 'calc(100% - 1rem)',
    }
  }, [block.startTime, block.endTime, grid])

  const isFocused = focusedBlockId === block.id

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    focusBlock(block.id)
    openDetailPanel(block.id)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openDetailPanel(block.id)
    }
    // Toggle status with 's' key
    if (e.key === 's' || e.key === 'S') {
      e.preventDefault()
      const statusOrder: BlockStatus[] = ['planned', 'in_progress', 'done', 'skipped']
      const currentIdx = statusOrder.indexOf(block.status)
      const nextStatus = statusOrder[(currentIdx + 1) % statusOrder.length]
      updateBlockField(block.id, 'status', nextStatus)
    }
  }

  // Show title only if enough vertical space
  const isCompact = (style.height as number) < grid.slotHeight * 2

  return (
    <div
      className={`
        absolute left-14 md:left-16 right-2 rounded-md border-l-[3px]
        px-1.5 py-0.5 md:px-2.5 md:py-1
        cursor-pointer transition-shadow select-none
        ${colors.bg} ${colors.border.replace('border-', 'border-l-')}
        ${isFocused ? 'ring-2 ring-primary shadow-md z-10' : 'hover:shadow-sm z-0'}
      `}
      style={style}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-roledescription="시간 블록"
      aria-label={`${block.title}, ${block.startTime} - ${block.endTime}, ${STATUS_LABEL[block.status]}`}
    >
      <div className="flex items-center gap-1 md:gap-1.5 min-h-0 overflow-hidden">
        {/* Color dot */}
        <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full flex-shrink-0 ${colors.dot}`} />

        {/* Title */}
        <span className={`text-[11px] md:text-sm font-medium truncate ${colors.text}`}>
          {block.title}
        </span>

        {/* Status badge — only if not compact */}
        {!isCompact && (
          <span className={`text-[10px] md:text-xs px-1 py-0 rounded-full flex-shrink-0 ${STATUS_COLOR[block.status]}`}>
            {STATUS_LABEL[block.status]}
          </span>
        )}
      </div>

      {/* Time range — only if enough space */}
      {!isCompact && (
        <div className="text-[10px] md:text-xs text-text-tertiary mt-0.5 md:mt-1 truncate">
          {block.startTime} - {block.endTime}
          {block.category && (
            <span className="ml-1">· {block.category}</span>
          )}
        </div>
      )}
    </div>
  )
}
