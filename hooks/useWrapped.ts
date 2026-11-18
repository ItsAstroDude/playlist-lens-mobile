import { useState, useCallback, useEffect } from 'react'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { File } from 'expo-file-system'
import { unzipSync, strFromU8 } from 'fflate'
import { storage } from '@/utils/cache'
import { timed, recordSize } from '@/utils/perf'
import {
  createAccumulator, addRows, finalize, buildTrackIndex, buildRecaps,
  type StreamRow, type WrappedStats, type TrackStat, type RecapBundle,
} from '@/utils/wrapped'
import { clearBuffer } from '@/utils/recents'
import { beginImport, addImportChunk, finishImport, abortImport } from '@/utils/playDb'
import { refreshWidget } from '@/utils/widget'

const WRAPPED_KEY     = 'wrapped_stats'
const TRACK_INDEX_KEY = 'wrapped_track_index'
const RECAPS_KEY      = 'wrapped_recaps'
const AUDIO_RE    = /Streaming_History_Audio[^/]*\.json$/i
const LEGACY_RE   = /StreamingHistory[^/]*\.json$/i

type Status = 'idle' | 'parsing' | 'ready' | 'error'

/**
 * The file's raw bytes. Native read (expo-file-system's File) — no base64 string of
 * the whole ZIP in JS. Falls back to the old base64 route if the native read fails.
 */
async function readBytes(uri: string): Promise<Uint8Array> {
  try { return await new File(uri).bytes() } catch {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
    return base64ToBytes(b64)
  }
}

// ─── base64 → bytes (fallback) ───────────────────────────────────────────────
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const LUT = (() => { const l = new Uint8Array(256); for (let i = 0; i < B64.length; i++) l[B64.charCodeAt(i)] = i; return l })()
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s/g, '')
  const len = clean.length
  let outLen = (len * 3) >> 2
  if (clean[len - 1] === '=') outLen--
  if (clean[len - 2] === '=') outLen--
  const out = new Uint8Array(outLen)
  let p = 0
  for (let i = 0; i < len; i += 4) {
    const a = LUT[clean.charCodeAt(i)],     b = LUT[clean.charCodeAt(i + 1)]
    const c = LUT[clean.charCodeAt(i + 2)], d = LUT[clean.charCodeAt(i + 3)]
    out[p++] = (a << 2) | (b >> 4)
    if (p < outLen) out[p++] = ((b & 15) << 4) | (c >> 2)
    if (p < outLen) out[p++] = ((c & 3) << 6) | d
  }
  return out
}

function readCached(): WrappedStats | null {
  const raw = storage.getString(WRAPPED_KEY)
  if (!raw) return null
  recordSize('stats', raw.length)
  try { return timed('read_stats', () => JSON.parse(raw) as WrappedStats) } catch { return null }
}

/** Synchronous one-shot read of the cached Wrapped stats (for non-hook callers). */
export function loadCachedWrapped(): WrappedStats | null {
  return readCached()
}

/**
 * Full per-track index — loaded lazily (it's MBs), only when something needs
 * arbitrary-track play counts (the live now-playing bar). null if not imported.
 */
export function loadTrackIndex(): TrackStat[] | null {
  const raw = storage.getString(TRACK_INDEX_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as TrackStat[] } catch { return null }
}

/** Per-period recaps (week/month/season/year). null until a history import. */
export function loadRecaps(): RecapBundle | null {
  const raw = storage.getString(RECAPS_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as RecapBundle } catch { return null }
}

/** Wipe just the imported listening history (leaves playlist caches intact). */
export function clearWrappedStats(): void {
  storage.remove(WRAPPED_KEY)
  storage.remove(TRACK_INDEX_KEY)
  storage.remove(RECAPS_KEY)
  clearBuffer()
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useWrapped() {
  const [stats,    setStats]    = useState<WrappedStats | null>(null)
  const [status,   setStatus]   = useState<Status>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => { setStats(readCached()) }, [])

  const importHistory = useCallback(async () => {
    setErrorMsg(null)
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', 'application/json', '*/*'],
        multiple: true,
        copyToCacheDirectory: true,
      })
      if (res.canceled || !res.assets?.length) return

      setStatus('parsing')
      setProgress({ done: 0, total: 0 })
      // Defer so the spinner can paint before the heavy work begins.
      await new Promise(r => setTimeout(r, 30))

      const acc = createAccumulator()
      // Every play goes into the play database (a re-import replaces the last one);
      // the accumulator still builds the lifetime stats + recaps blobs for now.
      beginImport()
      const ingest = (rows: StreamRow[]) => {
        addRows(acc, rows)
        addImportChunk(rows)
      }
      let done = 0
      let sawAny = false

      for (const asset of res.assets) {
        const name = asset.name ?? ''
        const isZip = name.toLowerCase().endsWith('.zip') || asset.mimeType === 'application/zip'

        if (isZip) {
          const bytes = await readBytes(asset.uri)
          // pass 1 — collect matching entry names without decompressing
          const targets: string[] = []
          unzipSync(bytes, { filter: f => {
            if (AUDIO_RE.test(f.name) || LEGACY_RE.test(f.name)) targets.push(f.name)
            return false
          } })
          setProgress({ done: 0, total: targets.length })
          // pass 2 — decompress + parse one file at a time
          for (const t of targets) {
            const out = unzipSync(bytes, { filter: f => f.name === t })
            const u8  = out[t]
            if (u8) {
              const rows = JSON.parse(strFromU8(u8)) as StreamRow[]
              if (Array.isArray(rows)) { ingest(rows); sawAny = true }
            }
            done++
            setProgress({ done, total: targets.length })
            await new Promise(r => setTimeout(r, 0)) // yield to UI
          }
        } else if (name.toLowerCase().endsWith('.json')) {
          const txt  = await FileSystem.readAsStringAsync(asset.uri)
          const rows = JSON.parse(txt) as StreamRow[]
          if (Array.isArray(rows)) { ingest(rows); sawAny = true }
          done++
          setProgress({ done, total: res.assets.length })
        }
      }

      if (!sawAny) {
        abortImport()
        setStatus('error')
        setErrorMsg('No streaming history found. Pick the ZIP from Spotify (or its Streaming_History_Audio_*.json files).')
        return
      }

      finishImport()
      refreshWidget()
      const result = finalize(acc)
      storage.set(WRAPPED_KEY, JSON.stringify(result))
      // Full per-track index, stored separately (loaded on demand later).
      try { storage.set(TRACK_INDEX_KEY, JSON.stringify(buildTrackIndex(acc))) } catch { /* index is best-effort */ }
      // Per-period recaps (week/month/season/year), loaded on demand by the Recaps view.
      try { storage.set(RECAPS_KEY, JSON.stringify(buildRecaps(acc))) } catch { /* recaps best-effort */ }
      setStats(result)
      setStatus('ready')
    } catch (e: any) {
      try { abortImport() } catch { /* nothing staged */ }
      setStatus('error')
      setErrorMsg(e?.message ?? 'Could not read that file. Make sure it’s your Spotify data export.')
    }
  }, [])

  const clearHistory = useCallback(() => {
    storage.remove(WRAPPED_KEY)
    storage.remove(TRACK_INDEX_KEY)
    storage.remove(RECAPS_KEY)
    clearBuffer()
    setStats(null)
    setStatus('idle')
    setErrorMsg(null)
  }, [])

  return { stats, status, progress, errorMsg, importHistory, clearHistory }
}
