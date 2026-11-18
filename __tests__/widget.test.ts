import { storage } from '@/utils/cache'
import { _resetForTests, insertPlays } from '@/utils/playDb'
import { buildWidgetData } from '@/widgets/data'
import type { StreamRow } from '@/utils/wrapped'

const play = (ts: string, artist: string, track: string, ms = 30 * 60_000): StreamRow => ({
  ts, ms_played: ms, spotify_track_uri: `u:${track}`,
  master_metadata_track_name: track, master_metadata_album_artist_name: artist,
})

beforeEach(() => { storage.clearAll(); _resetForTests() })

describe('widget data', () => {
  const now = new Date('2026-11-18T12:00:00Z')   // a Wednesday

  it('shows an empty state with no plays, in the default accent', () => {
    expect(buildWidgetData(now)).toMatchObject({ hasData: false, topArtist: null, accent: '#53e076' })
  })

  it('sums this week, compares with last week at the same point, names top + last', () => {
    insertPlays([
      play('2026-11-10T09:00:00Z', 'Old', 'prev'),                        // last week, same elapsed window
      play('2026-11-16T09:00:00Z', 'Radiohead', 'Reckoner'),
      play('2026-11-17T09:00:00Z', 'Radiohead', 'Nude'),
      play('2026-11-18T09:00:00Z', 'Björk', 'Joga'),
    ], 'tracked')
    const d = buildWidgetData(now)
    expect(d).toMatchObject({ hasData: true, time: '1h 30m', delta: '+200% vs last week', topArtist: 'Radiohead', lastTrack: 'Joga', lastArtist: 'Björk' })
  })

  it('follows the chosen accent', () => {
    storage.set('settings.accentId', 'pink')
    expect(buildWidgetData(now).accent).toBe('#FF70A5')
  })
})
