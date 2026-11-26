/**
 * Backup and restore (2.0.47). Your history lives only on this phone; a backup is one
 * small file (utils/backupFormat) you keep in a folder (Drive's, Files…) or share.
 *
 *  - Back up: every play + the covers you picked + your Recaps choices.
 *  - The folder is Android's folder access (part of expo-file-system, no new native
 *    module), chosen once and remembered. Each backup is a new dated file; the two
 *    newest stay, older ones are removed — a backup is never overwritten in place.
 *  - Weekly: on app open, if it's been a week and there are new plays.
 *  - Restore adds a backup to what's here and never replaces anything (utils/playDb
 *    mergePlayChunk), so it's safe to run on a phone that already has plays.
 */
import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import { File } from 'expo-file-system'
import * as DocumentPicker from 'expo-document-picker'
import * as Sharing from 'expo-sharing'
import { storage } from '@/utils/cache'
import {
  allPlaysAsync, mergePlayChunk, applyImportCover, importMaxT, playsVersion, type PlayRow,
} from '@/utils/playDb'
import {
  encodeBackup, decodeBackup, backupFileName, backupsToPrune, autoBackupDue, BackupError,
  type Backup, type BackupPrefs,
} from '@/utils/backupFormat'
import { bytesToBase64, base64ToBytes } from '@/utils/base64'
import { keptSeasons, hiddenYears, setSeasonKept, setYearHidden } from '@/utils/recapPrefs'
import { appVersion } from '@/utils/version'

const SAF = FileSystem.StorageAccessFramework
const MIME = 'application/octet-stream'

// settings.* survives Clear cache.
const K = {
  folder:      'settings.backup.folder',
  auto:        'settings.backup.weekly',
  lastAt:      'settings.backup.lastAt',
  lastPlays:   'settings.backup.lastPlays',
  lastVersion: 'settings.backup.lastVersion',
  lastWhere:   'settings.backup.lastWhere',     // 'folder' | 'shared'
  lastError:   'settings.backup.lastError',
}

// ─── status ─────────────────────────────────────────────────────────────────────
export interface BackupStatus {
  lastAt: number | null
  lastPlays: number | null
  lastWhere: 'folder' | 'shared' | null
  folder: string | null
  /** A readable name for the folder ("Download", "Drive › Backups"). */
  folderName: string | null
  weekly: boolean
  lastError: string | null
}

/** "primary:Download/playlist.lens" → "Download › playlist.lens". */
export function folderLabel(uri: string | null): string | null {
  if (!uri) return null
  let s = uri
  try { s = decodeURIComponent(uri) } catch { /* raw */ }
  const tail = s.split('/tree/').pop() ?? s
  const path = tail.includes(':') ? tail.slice(tail.indexOf(':') + 1) : tail
  return path ? path.split('/').filter(Boolean).join(' › ') : 'your folder'
}

const subs = new Set<() => void>()
const emit = () => subs.forEach(cb => cb())
export function onBackupStatus(cb: () => void): () => void { subs.add(cb); return () => { subs.delete(cb) } }

export function backupStatus(): BackupStatus {
  const folder = storage.getString(K.folder) ?? null
  const where = storage.getString(K.lastWhere)
  return {
    lastAt: storage.getNumber(K.lastAt) ?? null,
    lastPlays: storage.getNumber(K.lastPlays) ?? null,
    lastWhere: where === 'folder' || where === 'shared' ? where : null,
    folder, folderName: folderLabel(folder),
    weekly: storage.getBoolean(K.auto) ?? false,
    lastError: storage.getString(K.lastError) ?? null,
  }
}

/** "just now", "3 h ago", "yesterday", "12 days ago", then the date. */
export function backupAgo(ms: number, now = Date.now()): string {
  const min = Math.round((now - ms) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d} days ago`
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function setWeeklyBackup(on: boolean): void { storage.set(K.auto, on); emit() }

function markDone(plays: number, where: 'folder' | 'shared'): void {
  storage.set(K.lastAt, Date.now())
  storage.set(K.lastPlays, plays)
  storage.set(K.lastVersion, playsVersion())
  storage.set(K.lastWhere, where)
  storage.remove(K.lastError)
  emit()
}
function markError(msg: string): void { storage.set(K.lastError, msg); emit() }

// ─── preferences that travel with a backup ────────────────────────────────────────
export function collectPrefs(): BackupPrefs {
  const covers: Record<string, string> = {}
  try {
    for (const k of storage.getAllKeys()) {
      if (!k.startsWith('artov:')) continue
      const v = storage.getString(k)
      if (typeof v === 'string') covers[k] = v
    }
  } catch { /* best effort */ }
  return { covers, keptSeasons: [...keptSeasons()], hiddenYears: [...hiddenYears()] }
}

/** Covers you picked on this phone win; Recaps choices are combined. */
export function applyPrefs(p: BackupPrefs): number {
  let n = 0
  for (const [k, v] of Object.entries(p.covers)) {
    if (storage.getString(k) === undefined) { storage.set(k, v); n++ }
  }
  const kept = keptSeasons(), hidden = hiddenYears()
  for (const s of p.keptSeasons) if (!kept.has(s)) { setSeasonKept(s, true); n++ }
  for (const y of p.hiddenYears) if (!hidden.has(y)) { setYearHidden(y, true); n++ }
  return n
}

// ─── make one ─────────────────────────────────────────────────────────────────────
export interface Made { bytes: Uint8Array; name: string; plays: number }

/** The whole history as a backup file's bytes. Reads the plays off the UI thread. */
export async function makeBackup(now: Date = new Date()): Promise<Made> {
  const rows = await allPlaysAsync()
  const bytes = encodeBackup(rows, { importMaxT: importMaxT(), app: appVersion(), prefs: collectPrefs(), now })
  return { bytes, name: backupFileName(now), plays: rows.length }
}

// ─── the folder ───────────────────────────────────────────────────────────────────
/** Ask for a folder (Android's picker). Returns false if you backed out. */
export async function chooseFolder(): Promise<boolean> {
  if (Platform.OS !== 'android') return false
  const perm = await SAF.requestDirectoryPermissionsAsync()
  if (!perm.granted) return false
  storage.set(K.folder, perm.directoryUri)
  storage.remove(K.lastError)
  emit()
  return true
}

async function writeToFolder(dir: string, made: Made): Promise<void> {
  // octet-stream: the folder keeps the name as given (no extension added for a type).
  const dest = await SAF.createFileAsync(dir, made.name, MIME)
  await FileSystem.writeAsStringAsync(dest, bytesToBase64(made.bytes), { encoding: FileSystem.EncodingType.Base64 })
  // Only once the new one is written: keep the two newest, remove older ones.
  try {
    const old = backupsToPrune(await SAF.readDirectoryAsync(dir), 2)
    for (const uri of old) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})
  } catch { /* pruning is a nicety */ }
}

export type FolderResult = { ok: true; plays: number } | { ok: false; reason: 'cancelled' | 'unsupported' | 'failed'; message?: string }

/** Back up into the chosen folder (asks for one the first time, or if it's gone). */
export async function backupToFolder(opts: { ask?: boolean } = {}): Promise<FolderResult> {
  if (Platform.OS !== 'android') return { ok: false, reason: 'unsupported' }
  const ask = opts.ask ?? true
  let dir = storage.getString(K.folder)
  if (!dir) {
    if (!ask || !(await chooseFolder())) return { ok: false, reason: 'cancelled' }
    dir = storage.getString(K.folder)!
  }
  let made: Made
  try { made = await makeBackup() } catch (e) {
    const message = 'Couldn’t read your plays to back them up.'
    markError(message); return { ok: false, reason: 'failed', message }
  }
  try {
    await writeToFolder(dir, made)
  } catch {
    // The folder was removed or access was taken back: ask again (when we may).
    storage.remove(K.folder)
    if (ask && (await chooseFolder())) {
      try { await writeToFolder(storage.getString(K.folder)!, made) } catch {
        const message = 'Couldn’t write to that folder. Try another one.'
        markError(message); return { ok: false, reason: 'failed', message }
      }
    } else {
      const message = 'The backup folder can’t be reached any more. Choose it again.'
      markError(message); return { ok: false, reason: ask ? 'cancelled' : 'failed', message }
    }
  }
  markDone(made.plays, 'folder')
  return { ok: true, plays: made.plays }
}

/** Make a backup and hand it to the share sheet (Drive, email, another app). */
export async function shareBackup(): Promise<{ ok: boolean; plays: number }> {
  const made = await makeBackup()
  const uri = `${FileSystem.cacheDirectory}${made.name}`
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(made.bytes), { encoding: FileSystem.EncodingType.Base64 })
  if (!(await Sharing.isAvailableAsync())) return { ok: false, plays: made.plays }
  await Sharing.shareAsync(uri, { mimeType: MIME, dialogTitle: 'Save your playlist.lens backup' })
  markDone(made.plays, 'shared')
  return { ok: true, plays: made.plays }
}

// ─── weekly ───────────────────────────────────────────────────────────────────────
let autoRunning = false
/** On app open: back up quietly if it's due (never asks for anything). */
export async function maybeAutoBackup(now: number = Date.now()): Promise<void> {
  if (autoRunning || Platform.OS !== 'android') return
  const due = autoBackupDue({
    enabled: storage.getBoolean(K.auto) ?? false,
    hasFolder: !!storage.getString(K.folder),
    lastAt: storage.getNumber(K.lastAt) ?? null,
    lastVersion: storage.getNumber(K.lastVersion) ?? null,
    version: playsVersion(),
    now,
  })
  if (!due) return
  autoRunning = true
  try { await backupToFolder({ ask: false }) } finally { autoRunning = false }
}

// ─── restore ──────────────────────────────────────────────────────────────────────
/** Pick a backup file and read it. null = you backed out. Throws BackupError. */
export async function pickBackup(): Promise<Backup | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false })
  if (res.canceled || !res.assets?.length) return null
  const uri = res.assets[0].uri
  let bytes: Uint8Array
  try { bytes = await new File(uri).bytes() } catch {
    try { bytes = base64ToBytes(await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })) } catch {
      throw new BackupError('Couldn’t open that file.')
    }
  }
  return decodeBackup(bytes)
}

export interface Restored { added: number; already: number; replaced: number; prefs: number }

const CHUNK = 4000

/**
 * Add a backup to this phone. In chunks, a frame apart, so the screen keeps moving
 * (and a restore cut short is simply run again: what's in is skipped).
 */
export async function restoreBackup(b: Backup, onProgress?: (done: number, total: number) => void): Promise<Restored> {
  const local = importMaxT()
  const cover = b.importMaxT === null ? local : local === null ? b.importMaxT : Math.max(local, b.importMaxT)
  let added = 0
  const rows: PlayRow[] = b.rows
  for (let i = 0; i < rows.length; i += CHUNK) {
    added += mergePlayChunk(rows.slice(i, i + CHUNK), cover)
    onProgress?.(Math.min(rows.length, i + CHUNK), rows.length)
    await new Promise(r => setTimeout(r, 0))
  }
  const replaced = applyImportCover(cover)
  const prefs = applyPrefs(b.prefs)
  return { added, already: rows.length - added, replaced, prefs }
}
