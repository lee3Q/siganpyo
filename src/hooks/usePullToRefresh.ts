import { useRef, useState, useCallback } from 'react'

const PULL_THRESHOLD = 80
const MAX_PULL = 120

export function usePullToRefresh(onRefresh: () => void) {
  const [pullDistance, setPullDistance] = useState(0)
  const startYRef = useRef<number | null>(null)
  const isPullingRef = useRef(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = e.currentTarget as HTMLElement
    if (el.scrollTop > 0) return
    startYRef.current = e.touches[0].clientY
    isPullingRef.current = false
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startYRef.current === null) return
    const dy = e.touches[0].clientY - startYRef.current
    if (dy > 0) {
      isPullingRef.current = true
      setPullDistance(Math.min(dy * 0.4, MAX_PULL))
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (isPullingRef.current && pullDistance >= PULL_THRESHOLD) {
      onRefresh()
    }
    setPullDistance(0)
    startYRef.current = null
    isPullingRef.current = false
  }, [pullDistance, onRefresh])

  const isTriggered = pullDistance >= PULL_THRESHOLD

  return { pullDistance, isTriggered, onTouchStart, onTouchMove, onTouchEnd }
}
