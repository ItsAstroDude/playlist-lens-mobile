import { useEffect } from 'react'
import { AppState } from 'react-native'
import { storage } from '@/utils/cache'
import { loadCachedWrapped } from '@/hooks/useWrapped'
import { pullRecentlyPlayed, setAutoPullScopeMissing } from '@/utils/recents'
import { ApiError } from '@/utils/api'

const LAST_PULL_KEY = 'wrapped_last_autopull'
const THROTTLE_MS   = 6 * 60 * 60 * 1000 // ~6h — safe against the rolling 50-play cap, cheap on-device

/**
 * Best-effort auto-Wrapped refresh. On app foreground (throttled to ~6h) it tops up
 * the recent-plays buffer from /api/recently-played so recaps stay fresh. Silent on
 * any error — a pre-v1.4 token (no recently-played scope) just 403s and recaps fall
 * back to the imported data. Mounted once at the app root.
 */
export function useAutoWrapped(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const run = async () => {
      const last = storage.getNumber(LAST_PULL_KEY) ?? 0
      if (Date.now() - last < THROTTLE_MS) return
      try {
        const stats = loadCachedWrapped()
        await pullRecentlyPlayed(stats?.lastTs ?? null)
        setAutoPullScopeMissing(false)
        if (!cancelled) storage.set(LAST_PULL_KEY, Date.now())
      } catch (e) {
        // 403 = token predates the v1.4 recently-played scope → flag a reconnect hint
        // and throttle (don't hammer) until they reconnect. Other errors: silent retry.
        if (e instanceof ApiError && e.status === 403) {
          setAutoPullScopeMissing(true)
          if (!cancelled) storage.set(LAST_PULL_KEY, Date.now())
        }
      }
    }
    run()
    const sub = AppState.addEventListener('change', s => { if (s === 'active') run() })
    return () => { cancelled = true; sub.remove() }
  }, [enabled])
}
