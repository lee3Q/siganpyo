/**
 * Drag-and-drop configuration utilities for the SiGanPyo time grid.
 *
 * Provides:
 * - 15-minute snap grid (vertical-only for time slots)
 * - Custom collision detection for time grid columns
 * - Keyboard coordinate getter with 15-min snap
 * - Modifier to apply snap during drag
 * - Helper to convert time ↔ pixel positions
 */

import type { CollisionDetection, KeyboardCoordinateGetter, Modifier } from '@dnd-kit/core'
import { closestCenter, rectIntersection } from '@dnd-kit/core'
import type { KeyboardSensorOptions } from '@dnd-kit/core'
import { KeyboardCode } from '@dnd-kit/core'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Snap interval in minutes */
export const SNAP_MINUTES = 15

/** Height of one hour in pixels (will be calculated dynamically) */
export const HOUR_HEIGHT_PX = 60

/** Height of one snap step in pixels */
export const SNAP_PX = (SNAP_MINUTES / 60) * HOUR_HEIGHT_PX // 15px per 15min

/** Minimum block duration in minutes */
export const MIN_BLOCK_DURATION_MINUTES = 15

// ---------------------------------------------------------------------------
// Snap Grid
// ---------------------------------------------------------------------------

/**
 * Snap a Y-pixel offset to the nearest 15-minute grid position.
 * Only snaps vertically (time axis). Horizontal position is free.
 */
export function snapToGrid(
  deltaY: number,
  snapPx: number = SNAP_PX,
): { y: number } {
  return {
    y: Math.round(deltaY / snapPx) * snapPx,
  }
}

// ---------------------------------------------------------------------------
// Time ↔ Pixel Conversion
// ---------------------------------------------------------------------------

/**
 * Convert a "HH:mm" time string to a Y-pixel position within the grid.
 *
 * @param time - "HH:mm" format
 * @param startHour - The first hour displayed (default 6)
 * @param hourHeight - Height of one hour in pixels
 */
export function timeToY(
  time: string,
  startHour: number = 6,
  hourHeight: number = HOUR_HEIGHT_PX,
): number {
  const [h, m] = time.split(':').map(Number)
  const minutesFromStart = (h - startHour) * 60 + m
  return (minutesFromStart / 60) * hourHeight
}

/**
 * Convert a Y-pixel position back to a "HH:mm" time string,
 * snapped to SNAP_MINUTES intervals.
 */
export function yToTime(
  y: number,
  startHour: number = 6,
  hourHeight: number = HOUR_HEIGHT_PX,
  snapMinutes: number = SNAP_MINUTES,
): string {
  const totalMinutes = (y / hourHeight) * 60 + startHour * 60
  const snapped = Math.round(totalMinutes / snapMinutes) * snapMinutes
  const h = Math.floor(snapped / 60)
  const m = snapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Calculate the duration between two "HH:mm" times in minutes.
 */
export function durationMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}

/**
 * Add minutes to a "HH:mm" time string and return the result.
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor(total / 60)
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

/**
 * Clamp a "HH:mm" time within the grid bounds [startHour, endHour].
 */
export function clampTime(
  time: string,
  startHour: number = 6,
  endHour: number = 24,
): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m
  const min = startHour * 60
  const max = endHour * 60
  const clamped = Math.max(min, Math.min(max, total))
  const ch = Math.floor(clamped / 60)
  const cm = clamped % 60
  return `${String(ch).padStart(2, '0')}:${String(cm).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Modifier: Apply snap during drag
// ---------------------------------------------------------------------------

/**
 * dnd-kit modifier that constrains drag movement to 15-minute vertical snap.
 * Horizontal movement is locked (blocks stay in their column).
 */
export const snapModifier: Modifier = ({ transform, containerNodeRect: _containerNodeRect }) => {
  // Snap vertical movement to 15-min grid
  const snapped = snapToGrid(transform.y)

  return {
    ...transform,
    x: 0, // Lock horizontal movement
    y: snapped.y,
  }
}

/**
 * Modifier that only allows vertical resizing (for bottom handle).
 */
export const resizeModifier: Modifier = ({ transform }) => {
  const snapped = snapToGrid(transform.y)
  return {
    ...transform,
    x: 0,
    y: snapped.y,
  }
}

// ---------------------------------------------------------------------------
// Custom Collision Detection
// ---------------------------------------------------------------------------

/**
 * Collision detection strategy for the time grid.
 *
 * Uses closestCenter for the primary axis (vertical/time).
 * For overlapping time ranges, uses rectIntersection as fallback.
 */
export const timeGridCollisionDetection: CollisionDetection = (args) => {
  // First try closest center — good for most grid movements
  const closestCollisions = closestCenter(args)

  if (closestCollisions.length > 0) {
    return closestCollisions
  }

  // Fallback to rect intersection
  return rectIntersection(args)
}

// ---------------------------------------------------------------------------
// Keyboard Coordinate Getter
// ---------------------------------------------------------------------------

/**
 * Custom keyboard coordinate getter for the time grid.
 *
 * - ArrowUp/ArrowDown: Move by 15 minutes (one snap step)
 * - Does not handle horizontal movement (handled by focus system)
 */
export const timeGridKeyboardCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  { currentCoordinates },
) => {
  const { code } = event

  switch (code) {
    case KeyboardCode.Up:
      return {
        ...currentCoordinates,
        y: currentCoordinates.y - SNAP_PX,
      }
    case KeyboardCode.Down:
      return {
        ...currentCoordinates,
        y: currentCoordinates.y + SNAP_PX,
      }
    default:
      return undefined
  }
}

/**
 * Keyboard sensor options for the time grid.
 */
export const keyboardSensorOptions: KeyboardSensorOptions = {
  coordinateGetter: timeGridKeyboardCoordinateGetter,
}

// ---------------------------------------------------------------------------
// Drag Data Types
// ---------------------------------------------------------------------------

export type DragMode = 'move' | 'resize-bottom'

/** Data attached to a draggable time block */
export interface TimeBlockDragData {
  blockId: string
  mode: DragMode
  originalStartTime: string
  originalEndTime: string
}

/** Data attached to a droppable time slot */
export interface TimeSlotDropData {
  slotTime: string // "HH:mm" — the start time of this 30-min slot
}

// ---------------------------------------------------------------------------
// Activation Constraints
// ---------------------------------------------------------------------------

/** Distance threshold before starting a drag (prevents accidental drags) */
export const ACTIVATION_DISTANCE = 5

/** Tolerance in pixels for considering a drop "in place" */
export const DROP_IN_PLACE_TOLERANCE = 2
