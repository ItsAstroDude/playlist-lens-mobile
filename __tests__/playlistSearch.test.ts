import { filterPlaylists, normalize } from '@/utils/playlistSearch'
import type { SpotifyPlaylist } from '@/types'

const pl = (id: string, name: string, owner = 'me'): SpotifyPlaylist => ({
  id, name, images: [], tracks: { total: 0 }, owner: { display_name: owner },
})
const LIST = [
  pl('1', 'Jazz to chill to'),
  pl('2', 'Beyoncé essentials', 'Spotify'),
  pl('3', 'Gym — heavy'),
  pl('4', 'Late night drive', 'Alex'),
]

describe('playlist search', () => {
  it('returns the same list for an empty / blank query', () => {
    expect(filterPlaylists(LIST, '')).toBe(LIST)
    expect(filterPlaylists(LIST, '   ')).toBe(LIST)
  })
  it('matches every word, in any order, case-insensitively', () => {
    expect(filterPlaylists(LIST, 'CHILL jazz').map(p => p.id)).toEqual(['1'])
    expect(filterPlaylists(LIST, 'jazz gym')).toEqual([])
  })
  it('ignores accents both ways', () => {
    expect(filterPlaylists(LIST, 'beyonce').map(p => p.id)).toEqual(['2'])
    expect(normalize('Beyoncé')).toBe('beyonce')
  })
  it('searches the owner too', () => {
    expect(filterPlaylists(LIST, 'alex').map(p => p.id)).toEqual(['4'])
    expect(filterPlaylists(LIST, 'spotify').map(p => p.id)).toEqual(['2'])
  })
})
