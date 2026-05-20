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
import type { BlockColumnLayout } from '@/utils/blockLayout'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeBlockCardProps {
  block: TimeBlock
  grid: GridDimensions
  columnLayout?: BlockColumnLayout
  readOnly?: boolean
}

// ---------------------------------------------------------------------------
// Color mappings
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<BlockColor, { bg: string; border: string; text: string; dot: string }> = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/40',
    border: 'border-blue-300 dark:border-blue-700',
    text: 'text-blue-800 dark:text-blue-200',
    dot: 'bg-blue-500',
  },
  green: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/40',
    border: 'border-emerald-300 dark:border-emerald-700',
    text: 'text-emerald-800 dark:text-emerald-200',
    dot: 'bg-emerald-500',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-900/40',
    border: 'border-red-300 dark:border-red-700',
    text: 'text-red-800 dark:text-red-200',
    dot: 'bg-red-500',
  },
  yellow: {
    bg: 'bg-amber-50 dark:bg-amber-900/40',
    border: 'border-amber-300 dark:border-amber-700',
    text: 'text-amber-800 dark:text-amber-200',
    dot: 'bg-amber-500',
  },
  purple: {
    bg: 'bg-violet-50 dark:bg-violet-900/40',
    border: 'border-violet-300 dark:border-violet-700',
    text: 'text-violet-800 dark:text-violet-200',
    dot: 'bg-violet-500',
  },
  gray: {
    bg: 'bg-slate-50 dark:bg-slate-800/40',
    border: 'border-slate-300 dark:border-slate-600',
    text: 'text-slate-800 dark:text-slate-200',
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
  planned: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  skipped: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
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

export function TimeBlockCard({ block, grid, columnLayout, readOnly }: TimeBlockCardProps) {
  const focusedBlockId = useUIStore((s) => s.focusedBlockId)
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)
  const focusBlock = useUIStore((s) => s.focusBlock)
  const updateBlockField = useScheduleStore((s) => s.updateBlockField)

  const colors = COLOR_MAP[block.color] ?? COLOR_MAP.gray

  const col = columnLayout?.column ?? 0
  const totalCols = columnLayout?.totalColumns ?? 1

  const style = useMemo(() => {
    const startIndex = timeToSlotIndex(block.startTime, grid.startHour)
    const endIndex = timeToSlotIndex(block.endTime, grid.startHour)
    const durationSlots = Math.max(endIndex - startIndex, 1)
    const top = startIndex * grid.slotHeight
    const height = durationSlots * grid.slotHeight

    if (totalCols <= 1) {
      return {
        top,
        height: Math.max(height, grid.slotHeight),
        width: 'calc(100% - 1rem)',
      }
    }

    const gap = 2
    return {
      top,
      height: Math.max(height, grid.slotHeight),
      width: `calc(${100 / totalCols}% - ${gap}px)`,
      left: `calc(${(col * 100) / totalCols}% + ${col * gap}px)`,
    }
  }, [block.startTime, block.endTime, grid, col, totalCols])

  const isFocused = focusedBlockId === block.id

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    focusBlock(block.id)
    openDetailPanel(block.id)
  }

  const cycleStatus = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (readOnly) return
    const statusOrder: BlockStatus[] = ['planned', 'in_progress', 'done', 'skipped']
    const currentIdx = statusOrder.indexOf(block.status)
    const nextStatus = statusOrder[(currentIdx + 1) % statusOrder.length]
    updateBlockField(block.id, 'status', nextStatus)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openDetailPanel(block.id)
    }
    // Toggle status with 's' key
    if (!readOnly && (e.key === 's' || e.key === 'S')) {
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
        absolute rounded-md border-l-[3px]
        px-1.5 py-0.5 md:px-2.5 md:py-1
        cursor-pointer transition-shadow select-none
        ${totalCols <= 1 ? 'left-14 md:left-16 right-2' : ''}
        ${colors.bg} ${colors.border.replace('border-', 'border-l-')}
        ${isFocused ? 'ring-2 ring-primary shadow-md z-10' : 'hover:shadow-sm z-0'}
        ${block.status === 'done' ? 'opacity-60' : ''}
        ${block.status === 'skipped' ? 'opacity-40' : ''}
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
        <span className={`text-[11px] md:text-sm font-medium truncate ${colors.text} ${block.status === 'done' ? 'line-through' : ''}`}>
          {block.title}
        </span>

        {/* Status badge — tap to cycle */}
        {!isCompact && (
          <button
            className={`text-[10px] md:text-xs px-1 py-0 rounded-full flex-shrink-0 hover:scale-110 active:scale-95 transition-transform ${STATUS_COLOR[block.status]}`}
            onClick={cycleStatus}
            aria-label={`상태 변경: ${STATUS_LABEL[block.status]}`}
          >
            {STATUS_LABEL[block.status]}
          </button>
        )}
        {/* Compact status dot */}
        {isCompact && (
          <button
            className={`w-2 h-2 rounded-full flex-shrink-0 hover:scale-125 active:scale-95 transition-transform ${
              block.status === 'done' ? 'bg-emerald-500' :
              block.status === 'in_progress' ? 'bg-blue-500' :
              block.status === 'skipped' ? 'bg-amber-500' :
              'bg-slate-300 dark:bg-slate-600'
            }`}
            onClick={cycleStatus}
            aria-label={`상태 변경: ${STATUS_LABEL[block.status]}`}
          />
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
