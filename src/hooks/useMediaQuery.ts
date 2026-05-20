import { useState, useEffect } from 'react'

/**
 * useMediaQuery — reactive CSS media query hook.
 * Re-evaluates on viewport changes (resize, orientation).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)

    setMatches(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** Convenience hook for the desktop breakpoint (>= 768px) */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)')
}
