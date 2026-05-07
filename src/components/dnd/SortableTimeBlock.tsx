/**
 * SortableTimeBlock — a draggable wrapper for time blocks in the grid.
 *
 * Uses @dnd-kit/sortable's `useSortable` hook to provide:
 * - Drag-to-move functionality
 * - Visual drag overlay placeholder
 * - Keyboard accessibility (arrow keys move by 15-min snap)
 *
 * Usage:
 * ```tsx
 * <SortableTimeBlock id={block.id}>
 *   <TimeBlockCard block={block} />
 * </SortableTimeBlock>
 * ```
 */

import { type ReactNode, useMemo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TimeBlockDragData } from '@/lib/dnd'

export interface SortableTimeBlockProps {
  /** Unique block ID — must match the TimeBlock.id */
  id: string
  /** Original start time "HH:mm" — used for drag calculations */
  startTime: string
  /** Original end time "HH:mm" — used for drag calculations */
  endTime: string
  children: ReactNode
  /** Whether this block is currently disabled (e.g., read-only mode) */
  disabled?: boolean
  /** Additional CSS class names for the wrapper */
  className?: string
}

export function SortableTimeBlock({
  id,
  startTime,
  endTime,
  children,
  disabled = false,
  className,
}: SortableTimeBlockProps) {
  const dragData: TimeBlockDragData = useMemo(
    () => ({
      blockId: id,
      mode: 'move',
      originalStartTime: startTime,
      originalEndTime: endTime,
    }),
    [id, startTime, endTime],
  )

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isSorting,
  } = useSortable({
    id,
    data: dragData,
    disabled,
    // Use vertical list strategy since blocks are arranged vertically
    animateLayoutChanges: () => false, // Disable layout animations for performance
  })

  const style = useMemo(
    () => ({
      transform: CSS.Translate.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      zIndex: (isDragging || isSorting) ? 50 : 'auto' as const,
      // Add touch-action for better mobile drag support
      touchAction: 'none' as const,
    }),
    [transform, transition, isDragging, isSorting],
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={className}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-roledescription="시간 블록"
      aria-label={`시간 블록: ${startTime} - ${endTime}`}
    >
      {children}
    </div>
  )
}
