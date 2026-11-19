import { useEffect, useState } from 'react'
import { getWakingSince, onWakingChange } from '@/utils/serverStatus'

/** Seconds spent waking the server so far (ticks every second), or null when it isn't waking. */
export function useServerWaking(): number | null {
  const [since, setSince] = useState<number | null>(getWakingSince())
  const [now, setNow] = useState(Date.now())

  useEffect(() => onWakingChange(setSince), [])

  useEffect(() => {
    if (since === null) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [since])

  return since === null ? null : Math.max(0, Math.floor((now - since) / 1000))
}
