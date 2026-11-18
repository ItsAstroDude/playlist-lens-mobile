/**
 * What the "This week" widget shows — computed from the play database, so it works
 * both inside the app and in the widget's background task (no React tree there).
 */
import { storage } from '@/utils/cache'
import { ACCENTS } from '@/constants/theme'
import { playsSince } from '@/utils/playDb'
import { comparePeriods, periodRange } from '@/utils/listening'
import { fmtDuration } from '@/utils/analyze'

export interface WidgetData {
  hasData:    boolean
  time:       string          // "18h 24m"
  delta:      string | null   // "+12% vs last week"
  topArtist:  string | null
  lastTrack:  string | null
  lastArtist: string | null
  accent:     string          // raw accent hex (the widget is always dark)
}

function accentHex(): string {
  const id = storage.getString('settings.accentId')
  return (ACCENTS.find(a => a.id === id) ?? ACCENTS[0]).hex
}

export function buildWidgetData(now: Date = new Date()): WidgetData {
  const accent = accentHex()
  try {
    const since = Math.floor(periodRange('week', now, 1).start / 1000)
    const rows = playsSince(since)
    const c = comparePeriods(rows, 'week', now)
    const last = rows[rows.length - 1]
    const d = c.deltaMs
    return {
      hasData:    c.current.plays > 0 || !!last,
      time:       fmtDuration(c.current.ms),
      delta:      d === null ? null : `${d > 0 ? '+' : ''}${d}% vs last week`,
      topArtist:  c.current.topArtists[0]?.name ?? null,
      lastTrack:  last?.master_metadata_track_name ?? null,
      lastArtist: last?.master_metadata_album_artist_name ?? null,
      accent,
    }
  } catch {
    return { hasData: false, time: '0m', delta: null, topArtist: null, lastTrack: null, lastArtist: null, accent }
  }
}
