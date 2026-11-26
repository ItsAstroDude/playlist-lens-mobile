/**
 * The play database (2.0 Phase 1) — every play in one SQLite table.
 *
 * Replaces the MMKV JSON play buffer (`wrapped_recent`: one array, 20k cap, parsed
 * whole on every read). Plays from every source land here, deduped:
 *   import  — the Spotify data export (real listen time; authoritative for its range)
 *   tracked — the server tracker's plays (estimated listen time, refined later)
 *   recent  — Spotify's recently-played, pulled by the app
 *   legacy  — rows migrated from the old MMKV buffer (source unknown)
 *
 * Rows go in and come out as the export's StreamRow shape, so every stats function
 * keeps working unchanged. Time is stored as unix SECONDS (`t`, end of play, UTC):
 * the export has second precision, and the key (t, uri) then matches the same play
 * arriving from tracking and recently-played.
 *
 * Overlap rule: the import covers everything up to its newest play (`import_max_t`).
 * Importing deletes non-import rows in that range; non-import rows in that range are
 * skipped on insert. So an import and tracking never double-count.
 */
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite'
import { storage } from '@/utils/cache'
import type { StreamRow } from '@/utils/wrapped'

export const Source = { legacy: 0, import: 1, tracked: 2, recent: 3 } as const
export type SourceName = keyof typeof Source

const DB_NAME       = 'plays.db'
const SCHEMA        = 1
const LEGACY_KEY    = 'wrapped_recent'      // the old MMKV buffer (utils/recents)
const MIGRATED_META = 'migrated_mmkv_buffer'

/** A play as stored (UTC seconds, source code). Backups carry these as they are. */
export interface PlayRow {
  t: number; uri: string; ms: number
  track: string | null; artist: string | null; album: string | null
  src: number
}

let _db: SQLiteDatabase | null = null
let _stats: SQLiteDatabase | null = null

// ─── change counter ─────────────────────────────────────────────────────────────
// Bumped by every write below (all writes go through this module), so cached stats
// can tell "nothing changed" without scanning the table. Persisted, so answers saved
// before a restart are still known to be current.
const VERSION_KEY = 'plays.version'
/** Increases whenever plays are added, replaced or removed. */
export function playsVersion(): number { return storage.getNumber(VERSION_KEY) ?? 0 }
function bump(): void { storage.set(VERSION_KEY, playsVersion() + 1); playsSubs.forEach(cb => { try { cb() } catch { /* a listener's problem */ } }) }

/** Called after every write (a sync, an import, a clear) — screens that count plays
 *  re-count. Returns an unsubscribe. */
const playsSubs = new Set<() => void>()
export function onPlaysChanged(cb: () => void): () => void { playsSubs.add(cb); return () => { playsSubs.delete(cb) } }

/** Open (once) and bring the schema up to date. */
export function db(): SQLiteDatabase {
  if (_db) return _db
  const d = openDatabaseSync(DB_NAME)
  d.execSync('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;')
  const v = d.getFirstSync<{ user_version: number }>('PRAGMA user_version', [])?.user_version ?? 0
  if (v < 1) {
    d.execSync(`
      CREATE TABLE IF NOT EXISTS plays (
        t      INTEGER NOT NULL,
        uri    TEXT    NOT NULL DEFAULT '',
        ms     INTEGER NOT NULL DEFAULT 0,
        track  TEXT,
        artist TEXT,
        album  TEXT,
        src    INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (t, uri)
      ) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS plays_uri    ON plays(uri);
      CREATE INDEX IF NOT EXISTS plays_artist ON plays(artist);
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT) WITHOUT ROWID;
    `)
  }
  if (v < SCHEMA) d.execSync(`PRAGMA user_version = ${SCHEMA}`)
  _db = d
  _stats = null
  migrateLegacyBuffer(d)
  return d
}

/**
 * A second connection to the same file, for heavy reads that run off the UI thread
 * (utils/sqlJob's runAsync). One SQLite connection runs one query at a time: on the
 * main connection, a quick query from the screen would wait behind a second-long stats
 * query and freeze the UI. In WAL mode the two connections don't block each other.
 */
export function statsDb(): SQLiteDatabase {
  db()                                   // schema up to date first
  if (!_stats) _stats = openDatabaseSync(DB_NAME, { useNewConnection: true })
  return _stats
}

/** Test hook: forget the open handle (the test mock gives each open a fresh DB). */
export function _resetForTests(): void { _db = null; _stats = null }

// ─── meta ─────────────────────────────────────────────────────────────────────
function getMeta(d: SQLiteDatabase, k: string): string | null {
  return d.getFirstSync<{ v: string }>('SELECT v FROM meta WHERE k = ?', [k])?.v ?? null
}
function setMeta(d: SQLiteDatabase, k: string, v: string | null): void {
  if (v === null) d.runSync('DELETE FROM meta WHERE k = ?', [k])
  else d.runSync('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', [k, v])
}

/** Newest play the import covers (unix seconds), or null without an import. */
export function importMaxT(): number | null {
  const v = getMeta(db(), 'import_max_t')
  return v === null ? null : Number(v)
}

// ─── time ─────────────────────────────────────────────────────────────────────
/** Export timestamp → unix seconds. Handles the extended `ts` (ISO, UTC) and the
 *  legacy `endTime` ("2023-01-01 12:00", UTC). NaN when unparseable. */
export function toT(ts: string | null | undefined): number {
  if (!ts) return NaN
  let s = ts.trim()
  if (/^\d{4}-\d\d-\d\d \d\d:\d\d(:\d\d)?$/.test(s)) s = s.replace(' ', 'T') + 'Z'
  const ms = Date.parse(s)
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : NaN
}
/** Unix seconds → "2024-03-01T12:00:00Z" (the export's own format). */
export function fromT(t: number): string {
  return new Date(t * 1000).toISOString().replace('.000Z', 'Z')
}

// ─── write ────────────────────────────────────────────────────────────────────
function toPlay(r: StreamRow, src: number): PlayRow | null {
  const t = toT(r.ts ?? r.endTime)
  if (!Number.isFinite(t)) return null
  if (r.spotify_episode_uri && !r.spotify_track_uri) return null   // podcasts aren't music stats
  return {
    t,
    uri:    r.spotify_track_uri ?? '',
    ms:     Math.max(0, Math.round(r.ms_played ?? r.msPlayed ?? 0)),
    track:  r.master_metadata_track_name ?? r.trackName ?? null,
    artist: r.master_metadata_album_artist_name ?? r.artistName ?? null,
    album:  r.master_metadata_album_album_name ?? null,
    src,
  }
}

/**
 * Add plays. Returns how many rows were written. `replace` overwrites a play with the
 * same key (a tracked play whose listen-time estimate improved). Non-import rows inside
 * the import's range are skipped (see the overlap rule above).
 */
export function insertPlays(rows: StreamRow[], source: SourceName, opts?: { replace?: boolean }): number {
  if (!rows.length) return 0
  const d = db()
  const src = Source[source]
  const cutoff = src === Source.import ? null : importMaxT()
  const verb = opts?.replace ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE'
  let written = 0
  d.withTransactionSync(() => {
    const stmt = d.prepareSync(`${verb} INTO plays (t, uri, ms, track, artist, album, src) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    try {
      for (const r of rows) {
        const p = toPlay(r, src)
        if (!p) continue
        if (cutoff !== null && p.t <= cutoff) continue
        written += stmt.executeSync([p.t, p.uri, p.ms, p.track, p.artist, p.album, p.src]).changes
      }
    } finally { stmt.finalizeSync() }
  })
  if (written) bump()
  return written
}

/**
 * Replace the imported history with a new import (a re-import is a full replacement:
 * the export always contains your whole history). Rows arrive in chunks into a staging
 * table: `beginImport` → `addImportChunk`… → `finishImport` swaps them in atomically and
 * clears non-import rows the import now covers. Until then — a wrong file, a crash —
 * the previous import is untouched; `abortImport` discards the staged rows.
 */
export function beginImport(): void {
  const d = db()
  d.execSync(`
    DROP TABLE IF EXISTS import_stage;
    CREATE TABLE import_stage (
      t INTEGER NOT NULL, uri TEXT NOT NULL DEFAULT '', ms INTEGER NOT NULL DEFAULT 0,
      track TEXT, artist TEXT, album TEXT, src INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (t, uri)
    ) WITHOUT ROWID;
  `)
}
export function addImportChunk(rows: StreamRow[]): number {
  const d = db()
  let written = 0
  d.withTransactionSync(() => {
    const stmt = d.prepareSync('INSERT OR IGNORE INTO import_stage (t, uri, ms, track, artist, album, src) VALUES (?, ?, ?, ?, ?, ?, ?)')
    try {
      for (const r of rows) {
        const p = toPlay(r, Source.import)
        if (p) written += stmt.executeSync([p.t, p.uri, p.ms, p.track, p.artist, p.album, p.src]).changes
      }
    } finally { stmt.finalizeSync() }
  })
  return written
}
/** Swap the staged import in. Returns how many plays it holds (0 = nothing staged:
 *  the previous import is kept). */
export function finishImport(): number {
  const d = db()
  const n = d.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM import_stage', [])?.n ?? 0
  if (!n) { abortImport(); return 0 }
  d.withTransactionSync(() => {
    d.runSync('DELETE FROM plays WHERE src = ?', [Source.import])
    d.runSync('INSERT OR REPLACE INTO plays SELECT t, uri, ms, track, artist, album, src FROM import_stage', [])
    const max = d.getFirstSync<{ m: number }>('SELECT MAX(t) AS m FROM import_stage', [])!.m
    setMeta(d, 'import_max_t', String(max))
    d.runSync('DELETE FROM plays WHERE src != ? AND t <= ?', [Source.import, max])
  })
  d.execSync('DROP TABLE IF EXISTS import_stage')
  bump()
  return n
}
export function abortImport(): void {
  db().execSync('DROP TABLE IF EXISTS import_stage')
}

/** Remove the imported history (tracked / recent plays stay). */
export function clearImport(): void {
  const d = db()
  d.runSync('DELETE FROM plays WHERE src = ?', [Source.import])
  setMeta(d, 'import_max_t', null)
  bump()
}
/** Remove everything. */
export function clearAllPlays(): void {
  const d = db()
  d.runSync('DELETE FROM plays', [])
  setMeta(d, 'import_max_t', null)
  bump()
}

// ─── read ─────────────────────────────────────────────────────────────────────
function toRow(p: PlayRow): StreamRow {
  return {
    ts: fromT(p.t),
    ms_played: p.ms,
    master_metadata_track_name:        p.track,
    master_metadata_album_artist_name: p.artist,
    master_metadata_album_album_name:  p.album,
    spotify_track_uri:                 p.uri || null,
  }
}

/** Plays with t ≥ `sinceT` (unix seconds), oldest first. */
export function playsSince(sinceT: number): StreamRow[] {
  return db()
    .getAllSync<PlayRow>('SELECT t, uri, ms, track, artist, album, src FROM plays WHERE t >= ? ORDER BY t', [sinceT])
    .map(toRow)
}

/**
 * The working window the period views and recaps need: this year and last (so a year
 * compares with the one before), and never less than the last 400 days. The same span
 * the old MMKV buffer held, without its cap.
 */
export function windowStartT(now: Date = new Date()): number {
  const jan1LastYear = Date.UTC(now.getUTCFullYear() - 1, 0, 1) / 1000
  const days400      = Math.floor(now.getTime() / 1000) - 400 * 86_400
  return Math.min(jan1LastYear, days400)
}
export function windowPlays(now: Date = new Date()): StreamRow[] {
  return playsSince(windowStartT(now))
}

export interface PlayCounts { total: number; import: number; tracked: number; recent: number; legacy: number; firstT: number | null; lastT: number | null }
export function playCounts(): PlayCounts {
  const d = db()
  const by = d.getAllSync<{ src: number; n: number }>('SELECT src, COUNT(*) AS n FROM plays GROUP BY src', [])
  const span = d.getFirstSync<{ a: number | null; b: number | null }>('SELECT MIN(t) AS a, MAX(t) AS b FROM plays', [])
  const n = (s: number) => by.find(x => x.src === s)?.n ?? 0
  return {
    total: by.reduce((a, x) => a + x.n, 0),
    import: n(Source.import), tracked: n(Source.tracked), recent: n(Source.recent), legacy: n(Source.legacy),
    firstT: span?.a ?? null, lastT: span?.b ?? null,
  }
}

/** How many plays at or after `sinceT` (cheap: index range count, no rows built). */
export function countSince(sinceT: number): number {
  return db().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM plays WHERE t >= ?', [sinceT])?.n ?? 0
}

/** Artists heard at or after `sinceT` that never appear before it ("new to you"). */
export function newArtistsSince(sinceT: number): number {
  return db().getFirstSync<{ n: number }>(
    `SELECT COUNT(DISTINCT artist) AS n FROM plays
     WHERE t >= ? AND artist IS NOT NULL
       AND artist NOT IN (SELECT DISTINCT artist FROM plays WHERE t < ? AND artist IS NOT NULL)`,
    [sinceT, sinceT],
  )?.n ?? 0
}

/** Distinct local days (days since epoch, shifted by `offsetSec`) with a play since `sinceT`, newest first. */
export function activeDays(sinceT: number, offsetSec: number): number[] {
  return db()
    .getAllSync<{ d: number }>('SELECT DISTINCT CAST((t + ?) / 86400 AS INTEGER) AS d FROM plays WHERE t >= ? ORDER BY d DESC', [offsetSec, sinceT])
    .map(r => r.d)
}

/** Newest play we hold, as an export timestamp (the recently-played watermark). */
export function newestTs(): string | null {
  const m = db().getFirstSync<{ m: number | null }>('SELECT MAX(t) AS m FROM plays', [])?.m ?? null
  return m === null ? null : fromT(m)
}

// ─── one-time migration from MMKV ───────────────────────────────────────────────
function migrateLegacyBuffer(d: SQLiteDatabase): void {
  if (getMeta(d, MIGRATED_META)) return
  const raw = storage.getString(LEGACY_KEY)
  if (raw) {
    try {
      const rows = JSON.parse(raw) as StreamRow[]
      if (Array.isArray(rows)) insertPlays(rows, 'legacy')
    } catch { /* unreadable buffer — nothing to keep */ }
  }
  setMeta(d, MIGRATED_META, String(Date.now()))
  // Keep the MMKV copy until 2.0 has proven itself; a later update deletes it.
}

export interface SongPlays {
  plays: number
  ms: number
  /** UTC seconds of the first and the latest play. */
  firstT: number | null
  lastT: number | null
  /** Plays at or after `weekStartT`. */
  thisWeek: number
}

/**
 * Your plays of one song (imported history + tracked), by its Spotify uri — or, for
 * plays saved without one, by name + artist. Cheap: the uri is indexed.
 */
export function songPlays(uri: string | null, name: string, artist: string, weekStartT: number): SongPlays {
  const where = uri ? '(uri = ? OR (uri = \'\' AND track = ? AND artist = ?))' : '(track = ? AND artist = ?)'
  const args = uri ? [uri, name, artist] : [name, artist]
  const r = db().getFirstSync<{ n: number; ms: number | null; a: number | null; b: number | null; w: number | null }>(
    `SELECT COUNT(*) AS n, SUM(ms) AS ms, MIN(t) AS a, MAX(t) AS b, SUM(CASE WHEN t >= ? THEN 1 ELSE 0 END) AS w
     FROM plays WHERE ${where}`,
    [weekStartT, ...args],
  )
  return { plays: r?.n ?? 0, ms: r?.ms ?? 0, firstT: r?.a ?? null, lastT: r?.b ?? null, thisWeek: r?.w ?? 0 }
}

/**
 * How many of these songs you've played since `sinceT` (the lens sheet's "you played"
 * tile). By uri; chunked to stay well under SQLite's parameter limit.
 */
export function playedOf(uris: string[], sinceT: number): number {
  const list = [...new Set(uris.filter(Boolean))]
  let n = 0
  for (let i = 0; i < list.length; i += 400) {
    const chunk = list.slice(i, i + 400)
    const r = db().getFirstSync<{ n: number }>(
      `SELECT COUNT(DISTINCT uri) AS n FROM plays WHERE t >= ? AND uri IN (${chunk.map(() => '?').join(',')})`,
      [sinceT, ...chunk])
    n += r?.n ?? 0
  }
  return n
}

// ─── backup & restore (2.0.47) ───────────────────────────────────────────────────
/** Every play as stored, oldest first — off the UI thread (the stats connection). */
export async function allPlaysAsync(): Promise<PlayRow[]> {
  return statsDb().getAllAsync<PlayRow>('SELECT t, uri, ms, track, artist, album, src FROM plays ORDER BY t, uri', [])
}

/**
 * Add a backup's plays without replacing anything here (restore merges). Plays already
 * on the phone stay as they are (same key = skipped). The import's overlap rule holds:
 * `importCover` is the newest play any import covers (this phone's or the backup's), and
 * non-import plays inside it are skipped. Call `applyImportCover` once after the last chunk.
 * Returns how many plays were added.
 */
export function mergePlayChunk(rows: PlayRow[], importCover: number | null): number {
  if (!rows.length) return 0
  const d = db()
  let added = 0
  d.withTransactionSync(() => {
    const stmt = d.prepareSync('INSERT OR IGNORE INTO plays (t, uri, ms, track, artist, album, src) VALUES (?, ?, ?, ?, ?, ?, ?)')
    try {
      for (const r of rows) {
        if (r.src !== Source.import && importCover !== null && r.t <= importCover) continue
        added += stmt.executeSync([r.t, r.uri, r.ms, r.track, r.artist, r.album, r.src]).changes
      }
    } finally { stmt.finalizeSync() }
  })
  if (added) bump()
  return added
}

/** After a merge: the import now covers up to `cover`; tracked/recent plays inside it go
 *  (the import is authoritative for its range, as on an import). Returns how many went. */
export function applyImportCover(cover: number | null): number {
  if (cover === null) return 0
  const d = db()
  const current = importMaxT()
  let removed = 0
  d.withTransactionSync(() => {
    if (current === null || cover > current) setMeta(d, 'import_max_t', String(cover))
    removed = d.runSync('DELETE FROM plays WHERE src != ? AND t <= ?', [Source.import, Math.max(cover, current ?? cover)]).changes
  })
  if (removed) bump()
  return removed
}
