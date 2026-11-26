import { useEffect, useState } from 'react'

/** Breakpoint below which the app switches to its phone layout (keep in sync with index.css). */
export const NARROW_QUERY = '(max-width: 700px)'

/** True while the window is phone-sized. */
export function useNarrow(): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(NARROW_QUERY).matches
  const [narrow, setNarrow] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia?.(NARROW_QUERY)
    if (!mq) return
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}
