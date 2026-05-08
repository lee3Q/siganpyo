/**
 * useGridDimensions — calculates time grid slot sizes to fit the viewport.
 *
 * The grid spans from `startHour` to `endHour` (default 6–24 = 18h = 36 slots).
 * Each 30-minute slot height = available viewport height / total slots.
 * Returns pixel values that keep the entire grid scroll-free.
 *
 * Uses both window resize events and a ResizeObserver on the grid container
 * for maximum responsiveness across devices.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useConfigStore } from '@/stores/config-store'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Header height in px — single source of truth, shared with TimeGrid */
export const HEADER_HEIGHT_PX = 48

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GridDimensions {
  /** Total number of 30-min slots */
  slotCount: number
  /** Height of each 30-min slot in px */
  slotHeight: number
  /** Height of one full hour in px (= slotHeight * 2) */
  hourHeight: number
  /** The grid start hour (e.g. 6) */
  startHour: number
  /** The grid end hour (e.g. 24) */
  endHour: number
  /** Total grid height in px */
  gridHeight: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DESKTOP_BREAKPOINT = 768
const MOBILE_MIN_SLOT_HEIGHT = 8
const DESKTOP_MIN_SLOT_HEIGHT = 30

function computeFromViewportHeight(
  viewportHeight: number,
  viewportWidth: number,
  slotCount: number,
  startHour: number,
  endHour: number,
): GridDimensions {
  const isDesktop = viewportWidth >= DESKTOP_BREAKPOINT
  const availableHeight = viewportHeight - HEADER_HEIGHT_PX
  const minSlotHeight = isDesktop ? DESKTOP_MIN_SLOT_HEIGHT : MOBILE_MIN_SLOT_HEIGHT
  const slotHeight = Math.max(availableHeight / slotCount, minSlotHeight)
  const hourHeight = slotHeight * 2
  const gridHeight = slotHeight * slotCount

  return {
    slotCount,
    slotHeight,
    hourHeight,
    startHour,
    endHour,
    gridHeight,
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGridDimensions(): GridDimensions {
  const { dayStartHour, dayEndHour } = useConfigStore()

  const startHour = dayStartHour
  const endHour = dayEndHour
  const slotCount = (endHour - startHour) * 2 // 30-min slots

  const calcDimensions = useCallback(() => {
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    return computeFromViewportHeight(viewportHeight, viewportWidth, slotCount, startHour, endHour)
  }, [slotCount, startHour, endHour])

  const [dimensions, setDimensions] = useState<GridDimensions>(calcDimensions)

  // Keep a ref to the latest calcDimensions for the resize handler
  const calcRef = useRef(calcDimensions)
  calcRef.current = calcDimensions

  useEffect(() => {
    const handleResize = () => {
      setDimensions(calcRef.current())
    }

    // Recalculate on window resize
    window.addEventListener('resize', handleResize)

    // Also recalculate on orientation change (mobile)
    window.addEventListener('orientationchange', handleResize)

    // Use ResizeObserver as an additional trigger for container size changes
    // (e.g., browser chrome changes, virtual keyboard on mobile)
    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        // Debounce: only update if the height actually changed
        const newDims = calcRef.current()
        setDimensions((prev) => {
          // Avoid unnecessary state updates
          if (
            prev.slotHeight === newDims.slotHeight &&
            prev.gridHeight === newDims.gridHeight
          ) {
            return prev
          }
          return newDims
        })
      })
      // Observe the document body for viewport changes
      observer.observe(document.documentElement)
    }

    // Initial calculation
    handleResize()

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      observer?.disconnect()
    }
  }, [calcDimensions])

  return dimensions
}
