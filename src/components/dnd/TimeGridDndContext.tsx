/**
 * TimeGridDndContext — wraps the time grid with dnd-kit's DndContext
 * and SortableContext, pre-configured for SiGanPyo's time grid.
 *
 * Provides:
 * - Pointer (mouse/touch) sensor with activation distance
 * - Keyboard sensor with 15-min snap coordinate getter
 * - Vertical list sorting strategy
 * - Custom collision detection for the time grid
 * - Snap modifier to constrain to 15-min grid
 * - Drag overlay rendering
 * - onDragStart / onDragMove / onDragEnd event handling
 *
 * Usage:
 * ```tsx
 * <TimeGridDndContext
 *   blockIds={blocks.map(b => b.id)}
 *   onMoveBlock={handleMoveBlock}
 *   onResizeBlock={handleResizeBlock}
 * >
 *   {blocks.map(block => (
 *     <SortableTimeBlock key={block.id} id={block.id} ...>
 *       <TimeBlockCard block={block} />
 *     </SortableTimeBlock>
 *   ))}
 * </TimeGridDndContext>
 * ```
 */

import {
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import type {
  DragStartEvent,
  DragMoveEvent,
  DragEndEvent,
  UniqueIdentifier,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  snapModifier,
  ACTIVATION_DISTANCE,
  type TimeBlockDragData,
  yToTime,
  clampTime,
  durationMinutes,
  addMinutesToTime,
} from '@/lib/dnd'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeGridDndContextProps {
  /** Ordered list of block IDs for the sortable context */
  blockIds: UniqueIdentifier[]
  /** The start hour of the grid (default 6) */
  gridStartHour?: number
  /** The end hour of the grid (default 24) */
  gridEndHour?: number
  /** Height of one hour in pixels */
  hourHeight?: number
  /** Called when a block is moved to a new start time */
  onMoveBlock?: (blockId: string, newStartTime: string, newEndTime: string) => void
  /** Called when a block is resized (end time changed) */
  onResizeBlock?: (blockId: string, newEndTime: string) => void
  /** Called when a drag starts */
  onDragStart?: (blockId: string) => void
  /** Called when a drag ends (regardless of outcome) */
  onDragEnd?: () => void
  /** Render the drag overlay content for the active block */
  renderDragOverlay?: (blockId: string) => ReactNode
  children: ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimeGridDndContext({
  blockIds,
  gridStartHour = 6,
  gridEndHour = 24,
  hourHeight = 60,
  onMoveBlock,
  onResizeBlock,
  onDragStart,
  onDragEnd,
  renderDragOverlay,
  children,
}: TimeGridDndContextProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const dragDataRef = useRef<TimeBlockDragData | null>(null)
  const deltaRef = useRef({ x: 0, y: 0 })

  // ---- Sensors ----

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: ACTIVATION_DISTANCE,
    },
  })

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: (event, { currentCoordinates }) => {
      // Arrow up/down move by 15-min snap
      const snapPx = (15 / 60) * hourHeight
      switch (event.code) {
        case 'ArrowUp':
          return {
            ...currentCoordinates,
            y: currentCoordinates.y - snapPx,
          }
        case 'ArrowDown':
          return {
            ...currentCoordinates,
            y: currentCoordinates.y + snapPx,
          }
        default:
          return undefined
      }
    },
  })

  const sensors = useSensors(pointerSensor, keyboardSensor)

  // ---- Collision Detection ----

  const collisionDetection = useMemo(
    () => closestCenter,
    [],
  )

  // ---- Event Handlers ----

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event
      setActiveId(active.id)

      // Store drag data for use in dragEnd
      const data = active.data.current as TimeBlockDragData | undefined
      if (data) {
        dragDataRef.current = data
      }

      deltaRef.current = { x: 0, y: 0 }

      onDragStart?.(String(active.id))
    },
    [onDragStart],
  )

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { delta } = event
    deltaRef.current = { x: delta.x, y: delta.y }
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over: _over } = event
      const dragData = dragDataRef.current
      const delta = deltaRef.current

      setActiveId(null)
      dragDataRef.current = null
      deltaRef.current = { x: 0, y: 0 }

      if (!dragData || !active) {
        onDragEnd?.()
        return
      }

      const blockId = dragData.blockId

      if (dragData.mode === 'move') {
        // Calculate new start time from Y delta
        const originalY =
          ((parseInt(dragData.originalStartTime.split(':')[0]) - gridStartHour) * 60 +
            parseInt(dragData.originalStartTime.split(':')[1])) /
          60 *
          hourHeight

        const newY = originalY + delta.y
        const snapPx = (15 / 60) * hourHeight
        const snappedY = Math.round(newY / snapPx) * snapPx

        const newStartTime = clampTime(
          yToTime(snappedY, gridStartHour, hourHeight, 15),
          gridStartHour,
          gridEndHour,
        )

        const duration = durationMinutes(dragData.originalStartTime, dragData.originalEndTime)
        const newEndTime = clampTime(
          addMinutesToTime(newStartTime, duration),
          gridStartHour,
          gridEndHour,
        )

        // Only call if the time actually changed
        if (newStartTime !== dragData.originalStartTime) {
          onMoveBlock?.(blockId, newStartTime, newEndTime)
        }
      } else if (dragData.mode === 'resize-bottom') {
        // Calculate new end time from Y delta
        const originalEndY =
          ((parseInt(dragData.originalEndTime.split(':')[0]) - gridStartHour) * 60 +
            parseInt(dragData.originalEndTime.split(':')[1])) /
          60 *
          hourHeight

        const newEndY = originalEndY + delta.y
        const snapPx = (15 / 60) * hourHeight
        const snappedEndY = Math.round(newEndY / snapPx) * snapPx

        const newEndTime = clampTime(
          yToTime(snappedEndY, gridStartHour, hourHeight, 15),
          gridStartHour,
          gridEndHour,
        )

        // Ensure minimum duration of 15 minutes
        const duration = durationMinutes(dragData.originalStartTime, newEndTime)
        if (duration >= 15) {
          onResizeBlock?.(blockId, newEndTime)
        }
      }

      onDragEnd?.()
    },
    [gridStartHour, gridEndHour, hourHeight, onMoveBlock, onResizeBlock, onDragEnd],
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    dragDataRef.current = null
    deltaRef.current = { x: 0, y: 0 }
    onDragEnd?.()
  }, [onDragEnd])

  // ---- Render ----

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      modifiers={[snapModifier]}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={blockIds}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeId && renderDragOverlay
          ? renderDragOverlay(String(activeId))
          : null}
      </DragOverlay>
    </DndContext>
  )
}
