/**
 * Auto-Wrapped live layer (v1.4 S2).
 *
 * Keeps recaps fresh between manual GDPR re-imports. A small rolling buffer of the
 * user's most recent plays (seeded from the import's recent tail, then topped up
 * from /api/recently-played) lets us recompute the CURRENT week/month/season/year
 * with up-to-the-hour data, while past periods come from the stored import recaps.
 *
 * Merge is by high-water-mark (only plays newer than what we already have), so
 * there's no double-counting. On-device, additive, non-destructive.
 */
import { storage } from '@/utils/cache'
import { api } from '@/utils/api'
import { periodKeys } from '@/utils/periods'
import {
  createAccumulator, addRows, buildRecaps,
  type StreamRow, type RecapBundle, type RecapPeriod,
} from '@/utils/wrapped'

const BUFFER_KEY = 'wrapped_recent'
const BUFFER_MAX = 8000 // cap rows so the buffer stays a few MB at most
const SCOPE_FLAG_KEY = 'wrapped_autopull_scope_missing'

// Set when the auto-pull 403s (token lacks the v1.4 recently-played scope) so the
// Recaps screen can surface a gentle "reconnect to keep fresh" hint. Cleared on a
// successful pull (i.e. after a reconnect).
export function setAutoPullScopeMissing(missing: boolean): void {
  if (missing) storage.set(SCOPE_FLAG_KEY, true)
  else storage.remove(SCOPE_FLAG_KEY)
}
export function autoPullScopeMissing(): boolean {
  return storage.getBoolean(SCOPE_FLAG_KEY) ?? false
}

interface RpItem {
  played_at?: string
  track?: {
    uri?: string; name?: string; duration_ms?: number
    artists?: string[]; album?: { name?: string }
  }
}

// ─── Buffer storage ───────────────────────────────────────────────────────────
export function loadBuffer(): StreamRow[] {
  const raw = storage.getString(BUFFER_KEY)
  if (!raw) return []
  try { return JSON.parse(raw) as StreamRow[] } catch { return [] }
}
export function saveBuffer(rows: StreamRow[]): void {
  storage.set(BUFFER_KEY, JSON.stringify(rows))
}
export function clearBuffer(): void { storage.remove(BUFFER_KEY) }

/** Newest play timestamp we hold (buffer's max ts), or null. */
export function bufferWatermark(buffer: StreamRow[]): string | null {
  let max: string | null = null
  for (const r of buffer) { const ts = r.ts; if (ts && (!max || ts > max)) max = ts }
  return max
}

/** Append new rows, dedupe by ts+uri, keep time-sorted, prune to BUFFER_MAX. */
export function appendToBuffer(buffer: StreamRow[], incoming: StreamRow[]): StreamRow[] {
  const seen = new Set(buffer.map(r => `${r.ts ?? ''}|${r.spotify_track_uri ?? ''}`))
  const merged = buffer.slice()
  for (const r of incoming) {
    if (!r.ts) continue
    const k = `${r.ts}|${r.spotify_track_uri ?? ''}`
    if (!seen.has(k)) { seen.add(k); merged.push(r) }
  }
  merged.sort((a, b) => (a.ts! < b.ts! ? -1 : a.ts! > b.ts! ? 1 : 0))
  return merged.length > BUFFER_MAX ? merged.slice(merged.length - BUFFER_MAX) : merged
}

/** Normalize either export shape to the canonical extended row (buffer dedupes on `ts`). */
export function normalizeRow(r: StreamRow): StreamRow {
  return {
    ts:        r.ts ?? r.endTime,
    ms_played: r.ms_played ?? r.msPlayed ?? 0,
    master_metadata_track_name:        r.master_metadata_track_name ?? r.trackName ?? null,
    master_metadata_album_artist_name: r.master_metadata_album_artist_name ?? r.artistName ?? null,
    master_metadata_album_album_name:  r.master_metadata_album_album_name ?? null,
    spotify_track_uri:                 r.spotify_track_uri ?? null,
  }
}

// ─── Pull from Spotify ──────────────────────────────────────────────────────────
function toStreamRow(it: RpItem): StreamRow {
  return {
    ts: it.played_at,
    ms_played: it.track?.duration_ms ?? 0,   // recently-played gives no listen duration
    master_metadata_track_name:        it.track?.name ?? null,
    master_metadata_album_artist_name: it.track?.artists?.[0] ?? null,
    master_metadata_album_album_name:  it.track?.album?.name ?? null,
    spotify_track_uri:                 it.track?.uri ?? null,
  }
}

/**
 * Pull plays newer than our watermark into the buffer. Returns how many new rows
 * landed. Throws on network/auth errors — callers treat it as best-effort.
 */
export async function pullRecentlyPlayed(importLastTs?: string | null): Promise<number> {
  const buffer = loadBuffer()
  // Watermark = newest of (what's in the buffer, the import's last play).
  const candidates = [bufferWatermark(buffer), importLastTs ?? null].filter(Boolean) as string[]
  const after = candidates.length ? candidates.sort().pop()! : null
  const afterMs = after ? Date.parse(after) : NaN
  const q = Number.isFinite(afterMs) ? `?after=${afterMs}` : '?limit=50'

  const data = await api.get<{ items?: RpItem[] }>(`/api/recently-played${q}`)
  const rows = (data.items ?? []).map(toStreamRow).filter(r => !!r.ts)
  if (!rows.length) return 0

  saveBuffer(appendToBuffer(buffer, rows))
  return rows.length
}

// ─── Merge stored (import) recaps with a live recompute of the buffer ──────────
function accFrom(rows: StreamRow[]) {
  const a = createAccumulator(); addRows(a, rows); return a
}

/**
 * Recaps for display: stored archive (past periods) refreshed with the live buffer.
 * - Year & season: keep the stored archive, but swap the CURRENT period for the
 *   live one (the buffer fully covers it, so it's complete + fresh).
 * - Month & week: prefer the live list outright (rolling, latest, freshest).
 */
export function mergeRecaps(stored: RecapBundle | null, buffer: StreamRow[]): RecapBundle | null {
  const live = buffer.length ? buildRecaps(accFrom(buffer)) : null
  if (!stored) return live
  if (!live)   return stored

  const cur = periodKeys(new Date())
  const swapCurrent = (storedList: RecapPeriod[], liveList: RecapPeriod[], curKey: string): RecapPeriod[] => {
    const liveCur = liveList.find(p => p.key === curKey)
    if (!liveCur) return storedList
    return [liveCur, ...storedList.filter(p => p.key !== curKey)] // liveCur is the newest → leads
  }

  return {
    version: stored.version,
    generatedAt: new Date().toISOString(),
    years:   swapCurrent(stored.years,   live.years,   cur.year),
    seasons: swapCurrent(stored.seasons, live.seasons, cur.season),
    months:  live.months.length ? live.months : stored.months,
    weeks:   live.weeks.length  ? live.weeks  : stored.weeks,
  }
}
