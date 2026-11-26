/**
 * The backup file (2.0.47): every play, plus the few choices you made by hand, in one
 * small file. Pure — no files, no database — so it's tested end to end.
 *
 * Layout: gzip of one JSON object. Plays are stored by column, every song / artist /
 * album / Spotify link once in a string table and referred to by number, and times as
 * the gap from the play before — 150,000 plays come to a couple of megabytes.
 */
import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate'
import type { PlayRow } from '@/utils/playDb'

export const BACKUP_KIND = 'playlist.lens backup'
export const BACKUP_VERSION = 1
export const BACKUP_EXT = '.plbackup'

/** What you chose by hand that a new phone should have too. */
export interface BackupPrefs {
  /** Covers you picked ("Wrong image? Fix it"): MMKV key → image address. */
  covers: Record<string, string>
  /** Recaps: seasons you kept, years you discarded. */
  keptSeasons: string[]
  hiddenYears: string[]
}

export interface BackupSummary {
  createdAt: string
  app: string
  plays: number
  /** First and last play, UTC seconds (null when there are none). */
  first: number | null
  last: number | null
  /** Newest play an import covered (the import is authoritative up to here). */
  importMaxT: number | null
}

export interface Backup extends BackupSummary {
  rows: PlayRow[]
  prefs: BackupPrefs
}

/** The JSON inside the file. */
interface Wire {
  kind: string; v: number
  createdAt: string; app: string
  importMaxT: number | null
  plays: number
  /** The string table. */
  s: string[]
  /** Per play: time as the gap from the previous play (the first from 0), ms, source,
   *  and string-table indexes for track / artist / album / uri (-1 = none). */
  t: number[]; ms: number[]; src: number[]
  tr: number[]; ar: number[]; al: number[]; u: number[]
  prefs: BackupPrefs
}

export class BackupError extends Error {}

const EMPTY_PREFS: BackupPrefs = { covers: {}, keptSeasons: [], hiddenYears: [] }

export function encodeBackup(rows: PlayRow[], opts: { importMaxT: number | null; app: string; prefs?: BackupPrefs; now?: Date }): Uint8Array {
  const strings: string[] = []
  const index = new Map<string, number>()
  const ref = (v: string | null | undefined): number => {
    if (v == null || v === '') return -1
    let i = index.get(v)
    if (i === undefined) { i = strings.length; strings.push(v); index.set(v, i) }
    return i
  }
  // Oldest first, so the gaps stay small and positive.
  const sorted = rows.slice().sort((a, b) => a.t - b.t || (a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0))
  const w: Wire = {
    kind: BACKUP_KIND, v: BACKUP_VERSION,
    createdAt: (opts.now ?? new Date()).toISOString(), app: opts.app,
    importMaxT: opts.importMaxT, plays: sorted.length,
    s: strings, t: [], ms: [], src: [], tr: [], ar: [], al: [], u: [],
    prefs: opts.prefs ?? EMPTY_PREFS,
  }
  let prev = 0
  for (const r of sorted) {
    w.t.push(r.t - prev); prev = r.t
    w.ms.push(r.ms); w.src.push(r.src)
    w.tr.push(ref(r.track)); w.ar.push(ref(r.artist)); w.al.push(ref(r.album)); w.u.push(ref(r.uri))
  }
  return gzipSync(strToU8(JSON.stringify(w)), { level: 6 })
}

const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x)
const strArr = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [])

/** Read a backup file's bytes. Throws BackupError with a message fit to show. */
export function decodeBackup(bytes: Uint8Array): Backup {
  let w: Wire
  try {
    w = JSON.parse(strFromU8(gunzipSync(bytes))) as Wire
  } catch {
    throw new BackupError('That file isn’t a playlist.lens backup.')
  }
  if (!w || w.kind !== BACKUP_KIND) throw new BackupError('That file isn’t a playlist.lens backup.')
  if (!isInt(w.v) || w.v > BACKUP_VERSION) throw new BackupError('This backup is from a newer version of playlist.lens. Update the app, then try again.')
  const n = w.plays
  const cols = [w.t, w.ms, w.src, w.tr, w.ar, w.al, w.u]
  if (!isInt(n) || n < 0 || !Array.isArray(w.s) || cols.some(c => !Array.isArray(c) || c.length !== n)) {
    throw new BackupError('This backup is damaged and can’t be read.')
  }
  const str = (i: number): string | null => (i >= 0 && i < w.s.length && typeof w.s[i] === 'string' ? w.s[i] : null)
  const rows: PlayRow[] = new Array(n)
  let t = 0
  for (let i = 0; i < n; i++) {
    t += w.t[i]
    const src = w.src[i]
    if (!isInt(t) || !isInt(w.ms[i]) || w.ms[i] < 0 || !isInt(src) || src < 0 || src > 3) {
      throw new BackupError('This backup is damaged and can’t be read.')
    }
    rows[i] = { t, ms: w.ms[i], src, track: str(w.tr[i]), artist: str(w.ar[i]), album: str(w.al[i]), uri: str(w.u[i]) ?? '' }
  }
  const p = (w.prefs ?? {}) as Partial<BackupPrefs>
  const covers: Record<string, string> = {}
  if (p.covers && typeof p.covers === 'object') {
    for (const [k, v] of Object.entries(p.covers)) if (k.startsWith('artov:') && typeof v === 'string') covers[k] = v
  }
  return {
    createdAt: typeof w.createdAt === 'string' ? w.createdAt : '',
    app: typeof w.app === 'string' ? w.app : '',
    plays: n,
    first: n ? rows[0].t : null,
    last: n ? rows[n - 1].t : null,
    importMaxT: isInt(w.importMaxT) ? w.importMaxT : null,
    rows,
    prefs: { covers, keptSeasons: strArr(p.keptSeasons), hiddenYears: strArr(p.hiddenYears) },
  }
}

/** The file name for a backup made on `now` (local date). */
export function backupFileName(now: Date = new Date()): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return `playlist-lens-backup-${d}${BACKUP_EXT}`
}

/** Is this (Android folder) file one of our backups? Folder entries are content:// links. */
export function isBackupUri(uri: string): boolean {
  let s = uri
  try { s = decodeURIComponent(uri) } catch { /* keep it raw */ }
  return /playlist-lens-backup-\d{4}-\d\d-\d\d(?: ?\(\d+\))?\.plbackup$/.test(s)
}

/** Of our backups in a folder, the ones to delete so only the newest `keep` remain. */
export function backupsToPrune(uris: string[], keep = 2): string[] {
  const ours = uris.filter(isBackupUri).sort((a, b) => {
    const da = decodeURIComponent(a), db = decodeURIComponent(b)
    return da < db ? 1 : da > db ? -1 : 0          // newest first (dates sort as text)
  })
  return ours.slice(keep)
}

export const WEEK_MS = 7 * 86_400_000

/** Weekly backup: on, a folder chosen, a week since the last one, and new plays since. */
export function autoBackupDue(o: { enabled: boolean; hasFolder: boolean; lastAt: number | null; lastVersion: number | null; version: number; now: number }): boolean {
  if (!o.enabled || !o.hasFolder) return false
  if (o.lastAt !== null && o.now - o.lastAt < WEEK_MS) return false
  return o.lastVersion === null || o.version !== o.lastVersion
}
