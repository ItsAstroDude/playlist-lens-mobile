/**
 * Recap archive prefs (v1.4 S3). Which SEASONS the user opted to keep (saved with
 * a year stamp) and which YEARS they discarded (hidden, but regenerable). Plain
 * MMKV-backed string sets.
 */
import { storage } from '@/utils/cache'

const KEPT_SEASONS_KEY = 'recap_kept_seasons'
const HIDDEN_YEARS_KEY = 'recap_hidden_years'

function loadSet(key: string): Set<string> {
  const raw = storage.getString(key)
  if (!raw) return new Set()
  try { return new Set(JSON.parse(raw) as string[]) } catch { return new Set() }
}
function saveSet(key: string, set: Set<string>): void {
  storage.set(key, JSON.stringify([...set]))
}

// ── Seasons: opt-in keep ──
export function keptSeasons(): Set<string> { return loadSet(KEPT_SEASONS_KEY) }
export function setSeasonKept(key: string, kept: boolean): void {
  const s = keptSeasons()
  if (kept) s.add(key); else s.delete(key)
  saveSet(KEPT_SEASONS_KEY, s)
}

// ── Years: discard (hide) + regenerate (unhide) ──
export function hiddenYears(): Set<string> { return loadSet(HIDDEN_YEARS_KEY) }
export function setYearHidden(key: string, hidden: boolean): void {
  const s = hiddenYears()
  if (hidden) s.add(key); else s.delete(key)
  saveSet(HIDDEN_YEARS_KEY, s)
}

export function clearRecapPrefs(): void {
  storage.remove(KEPT_SEASONS_KEY)
  storage.remove(HIDDEN_YEARS_KEY)
}
