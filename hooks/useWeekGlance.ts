import { useEffect, useState } from 'react'
import { cachedAsync } from '@/utils/sqlJob'
import { periodStatsJob, type PeriodStats } from '@/utils/stats'
import { streaksAsync } from '@/utils/highlights'

/**
 * This week at a glance — hours, plays, days, top artist — and the current streak, from
 * the tracked plays (off the UI thread, cached). Shared by the cover-screen bento and the
 * half-folded Lenses stage. `week` is null until loaded, or when nothing is tracked.
 */
export function useWeekGlance(): { loaded: boolean; week: PeriodStats | null; streak: number } {
  const [state, setState] = useState<{ loaded: boolean; week: PeriodStats | null; streak: number }>({ loaded: false, week: null, streak: 0 })
  useEffect(() => {
    let alive = true
    Promise.all([
      cachedAsync('cover.week', 'v1', () => periodStatsJob('week', { topN: 1 })).catch(() => null),
      streaksAsync().then(s => s.current).catch(() => 0),
    ]).then(([w, s]) => { if (alive) setState({ loaded: true, week: w && w.plays ? w : null, streak: s }) })
    return () => { alive = false }
  }, [])
  return state
}
