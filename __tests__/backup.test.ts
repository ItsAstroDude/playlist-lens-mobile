import { gzipSync, strToU8 } from 'fflate'
import { storage } from '@/utils/cache'
import { insertPlays, beginImport, addImportChunk, finishImport, importMaxT, playCounts, db, _resetForTests, Source, type PlayRow } from '@/utils/playDb'
import {
  encodeBackup, decodeBackup, BackupError, backupFileName, isBackupUri, backupsToPrune, autoBackupDue, WEEK_MS,
} from '@/utils/backupFormat'
import { bytesToBase64, base64ToBytes } from '@/utils/base64'
import { restoreBackup, applyPrefs, folderLabel } from '@/utils/backup'
import { keptSeasons } from '@/utils/recapPrefs'
import type { StreamRow } from '@/utils/wrapped'

const row = (ts: string, track: string, artist = 'A', ms = 180_000, album: string | null = 'Al'): StreamRow => ({
  ts, ms_played: ms, spotify_track_uri: `spotify:track:${track}`,
  master_metadata_track_name: track, master_metadata_album_artist_name: artist, master_metadata_album_album_name: album,
})
const T = (iso: string) => Date.parse(iso) / 1000
const all = (): PlayRow[] => db().getAllSync<PlayRow>('SELECT t, uri, ms, track, artist, album, src FROM plays ORDER BY t, uri', [])

beforeEach(() => { storage.clearAll(); _resetForTests() })

describe('backup format', () => {
  const rows: PlayRow[] = [
    { t: 1_700_000_100, uri: 'spotify:track:b', ms: 200_000, track: 'B', artist: 'Y', album: null, src: Source.tracked },
    { t: 1_700_000_000, uri: 'spotify:track:a', ms: 180_000, track: 'A', artist: 'X', album: 'One', src: Source.import },
    { t: 1_700_000_000, uri: '', ms: 0, track: null, artist: null, album: null, src: Source.legacy },
  ]

  it('round-trips every play, oldest first, with the summary', () => {
    const b = decodeBackup(encodeBackup(rows, { importMaxT: 1_700_000_000, app: '2.0.47', now: new Date('2026-11-26T10:00:00Z') }))
    expect(b.plays).toBe(3)
    expect(b.rows).toEqual([rows[2], rows[1], rows[0]])
    expect(b).toMatchObject({ first: 1_700_000_000, last: 1_700_000_100, importMaxT: 1_700_000_000, app: '2.0.47', createdAt: '2026-11-26T10:00:00.000Z' })
  })

  it('stores each string once (a big history stays small)', () => {
    const many: PlayRow[] = Array.from({ length: 5000 }, (_, i) => ({
      t: 1_700_000_000 + i * 200, uri: `spotify:track:${i % 50}`, ms: 180_000, track: `Song ${i % 50}`, artist: `Artist ${i % 7}`, album: 'Album', src: Source.tracked,
    }))
    const bytes = encodeBackup(many, { importMaxT: null, app: 'x' })
    expect(bytes.length).toBeLessThan(25_000)          // ~5 bytes a play
    expect(decodeBackup(bytes).rows).toEqual(many)
  })

  it('carries the covers you picked and your Recaps choices', () => {
    const prefs = { covers: { 'artov:artist:x:': 'https://img/x.jpg' }, keptSeasons: ['2025-Summer'], hiddenYears: ['2019'] }
    expect(decodeBackup(encodeBackup([], { importMaxT: null, app: 'x', prefs })).prefs).toEqual(prefs)
  })

  it('refuses other files, newer versions and damage, in words fit to show', () => {
    expect(() => decodeBackup(strToU8('PK\u0003\u0004 a zip'))).toThrow(BackupError)
    expect(() => decodeBackup(gzipSync(strToU8(JSON.stringify({ kind: 'something else' }))))).toThrow('isn’t a playlist.lens backup')
    expect(() => decodeBackup(gzipSync(strToU8(JSON.stringify({ kind: 'playlist.lens backup', v: 9 }))))).toThrow('newer version')
    const broken = { kind: 'playlist.lens backup', v: 1, plays: 2, s: [], t: [1], ms: [1], src: [1], tr: [-1], ar: [-1], al: [-1], u: [-1] }
    expect(() => decodeBackup(gzipSync(strToU8(JSON.stringify(broken))))).toThrow('damaged')
  })

  it('names files by date; knows its own files in a folder; keeps the two newest', () => {
    expect(backupFileName(new Date(2026, 10, 6))).toBe('playlist-lens-backup-2026-11-06.plbackup')
    const dir = 'content://com.android.externalstorage.documents/tree/primary%3ABackups/document/primary%3ABackups%2F'
    const files = ['playlist-lens-backup-2026-11-01.plbackup', 'playlist-lens-backup-2026-11-15.plbackup', 'notes.txt', 'playlist-lens-backup-2026-11-08.plbackup']
      .map(f => dir + encodeURIComponent(f))
    expect(isBackupUri(files[2])).toBe(false)
    expect(backupsToPrune(files, 2)).toEqual([files[0]])
    const sameDay = ['playlist-lens-backup-2026-11-28.plbackup', 'playlist-lens-backup-2026-11-28 (1).plbackup', 'playlist-lens-backup-2026-11-28 (2).plbackup']
      .map(f => dir + encodeURIComponent(f))
    expect(backupsToPrune(sameDay, 2)).toEqual([sameDay[0]])            // the plain name is that day's first
  })

  it('weekly: only when on, with a folder, a week on, and new plays', () => {
    const base = { enabled: true, hasFolder: true, lastAt: 0, lastVersion: 4, version: 5, now: WEEK_MS + 1 }
    expect(autoBackupDue(base)).toBe(true)
    expect(autoBackupDue({ ...base, now: WEEK_MS - 1 })).toBe(false)
    expect(autoBackupDue({ ...base, version: 4 })).toBe(false)       // nothing new since
    expect(autoBackupDue({ ...base, hasFolder: false })).toBe(false)
    expect(autoBackupDue({ ...base, enabled: false })).toBe(false)
    expect(autoBackupDue({ ...base, lastAt: null, lastVersion: null })).toBe(true)
  })
})

describe('base64', () => {
  it('round-trips any bytes', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 100, 0x6001]) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 255)
      expect(base64ToBytes(bytesToBase64(b))).toEqual(b)
    }
    expect(bytesToBase64(strToU8('hi!?'))).toBe(Buffer.from('hi!?').toString('base64'))
  })
})

describe('restore (merge)', () => {
  const backupOf = (rows: PlayRow[], importMax: number | null) =>
    decodeBackup(encodeBackup(rows, { importMaxT: importMax, app: 'x' }))

  it('restores onto an empty phone, import rule and all', async () => {
    insertPlays([row('2024-01-01T10:00:00Z', 'One'), row('2024-02-01T10:00:00Z', 'Two')], 'tracked')
    beginImport(); addImportChunk([row('2023-06-01T10:00:00Z', 'Old')]); finishImport()
    const b = backupOf(all(), importMaxT())
    _resetForTests(); storage.clearAll()                 // a new phone
    const r = await restoreBackup(b)
    expect(r.added).toBe(3)
    expect(all()).toEqual(b.rows)
    expect(importMaxT()).toBe(T('2023-06-01T10:00:00Z'))
  })

  it('never replaces what’s here; a second restore adds nothing', async () => {
    insertPlays([row('2024-03-01T10:00:00Z', 'Here', 'A', 111)], 'tracked')
    const b = backupOf([
      { t: T('2024-03-01T10:00:00Z'), uri: 'spotify:track:Here', ms: 999, track: 'Here', artist: 'A', album: 'Al', src: Source.tracked },
      { t: T('2024-04-01T10:00:00Z'), uri: 'spotify:track:New', ms: 5, track: 'New', artist: 'B', album: null, src: Source.tracked },
    ], null)
    expect((await restoreBackup(b)).added).toBe(1)
    expect(all().find(p => p.track === 'Here')!.ms).toBe(111)
    expect((await restoreBackup(b)).added).toBe(0)
    expect(playCounts().total).toBe(2)
  })

  it('a backup’s import covers its range: tracked plays inside it go, as on an import', async () => {
    // This phone only tracked; the backup has the import up to 1 May.
    insertPlays([row('2024-04-15T10:00:00Z', 'TrackedTwice'), row('2024-06-01T10:00:00Z', 'After')], 'tracked')
    const b = backupOf([
      { t: T('2024-04-15T10:00:05Z'), uri: 'spotify:track:TrackedTwice', ms: 170_000, track: 'TrackedTwice', artist: 'A', album: 'Al', src: Source.import },
      { t: T('2024-05-01T00:00:00Z'), uri: 'spotify:track:Last', ms: 170_000, track: 'Last', artist: 'A', album: 'Al', src: Source.import },
    ], T('2024-05-01T00:00:00Z'))
    const r = await restoreBackup(b)
    expect(r.added).toBe(2)
    expect(r.replaced).toBe(1)                                         // the tracked copy of the same listen
    expect(all().map(p => p.track)).toEqual(['TrackedTwice', 'Last', 'After'])
    expect(importMaxT()).toBe(T('2024-05-01T00:00:00Z'))
  })

  it('this phone’s import wins its own range: backup tracked plays inside it are skipped', async () => {
    beginImport(); addImportChunk([row('2024-05-01T00:00:00Z', 'Imported')]); finishImport()
    const b = backupOf([
      { t: T('2024-04-20T10:00:00Z'), uri: 'spotify:track:Inside', ms: 1, track: 'Inside', artist: 'A', album: null, src: Source.tracked },
      { t: T('2024-07-01T10:00:00Z'), uri: 'spotify:track:Outside', ms: 1, track: 'Outside', artist: 'A', album: null, src: Source.tracked },
    ], null)
    expect((await restoreBackup(b)).added).toBe(1)
    expect(all().map(p => p.track)).toEqual(['Imported', 'Outside'])
  })

  it('a play held here as tracked and in the backup as imported survives the restore', async () => {
    insertPlays([row('2024-04-15T10:00:00Z', 'Same')], 'tracked')
    const b = backupOf([
      { t: T('2024-04-15T10:00:00Z'), uri: 'spotify:track:Same', ms: 180_000, track: 'Same', artist: 'A', album: 'Al', src: Source.import },
    ], T('2024-04-15T10:00:00Z'))
    await restoreBackup(b)
    expect(all().map(p => [p.track, p.src])).toEqual([['Same', Source.import]])
  })

  it('a backup can’t claim an import cover past its own imported plays', async () => {
    insertPlays([row('2025-01-01T10:00:00Z', 'Mine')], 'tracked')
    const b = backupOf([
      { t: T('2024-01-01T10:00:00Z'), uri: 'spotify:track:Old', ms: 1, track: 'Old', artist: 'A', album: null, src: Source.import },
    ], T('2100-01-01T00:00:00Z'))
    expect(b.importMaxT).toBe(T('2024-01-01T10:00:00Z'))
    await restoreBackup(b)
    expect(all().map(p => p.track)).toEqual(['Old', 'Mine'])
    expect(backupOf([], 123).importMaxT).toBeNull()                    // no imported plays, no cover
  })

  it('reports progress in chunks', async () => {
    const rows: PlayRow[] = Array.from({ length: 9000 }, (_, i) => ({ t: 1_700_000_000 + i, uri: `u${i}`, ms: 1, track: 'x', artist: 'a', album: null, src: Source.tracked }))
    const seen: number[] = []
    await restoreBackup(backupOf(rows, null), done => seen.push(done))
    expect(seen).toEqual([4000, 8000, 9000])
    expect(playCounts().total).toBe(9000)
  })
})

describe('preferences', () => {
  it('your own covers win; Recaps choices are combined', () => {
    storage.set('artov:artist:x:', 'mine.jpg')
    const n = applyPrefs({ covers: { 'artov:artist:x:': 'theirs.jpg', 'artov:track:y:z': 'y.jpg' }, keptSeasons: ['2025-Summer'], hiddenYears: [] })
    expect(storage.getString('artov:artist:x:')).toBe('mine.jpg')
    expect(storage.getString('artov:track:y:z')).toBe('y.jpg')
    expect(keptSeasons().has('2025-Summer')).toBe(true)
    expect(n).toBe(2)
  })
})

describe('folderLabel', () => {
  it('reads the folder out of Android’s folder link', () => {
    expect(folderLabel('content://com.android.externalstorage.documents/tree/primary%3ADocuments%2Fplaylist.lens')).toBe('Documents › playlist.lens')
    expect(folderLabel(null)).toBeNull()
  })
})
