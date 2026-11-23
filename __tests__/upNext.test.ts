import { _resetDropped, deckCards, dropSong, forgetDropped, inLabel, isDropped, skipsTo, startsIn, visibleQueue, type UpNextTrack } from '@/utils/upNext'

const t = (id: string, s = 180): UpNextTrack => ({ id, uri: `spotify:track:${id}`, name: id, duration_ms: s * 1000, artists: ['A'], image: null })
const q = [t('a', 120), t('b', 200), t('c', 150), t('d')]

beforeEach(() => _resetDropped())

describe('up next', () => {
  it('deck leaves out the songs decided this round; dropped ones come back next round', () => {
    dropSong('b')
    expect(deckCards(q, new Set(['a', 'b'])).map(x => x.id)).toEqual(['c', 'd'])
    expect(deckCards(q, new Set()).map(x => x.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(visibleQueue(q).map(x => x.id)).toEqual(['a', 'c', 'd'])
  })
  it('a dropped song is forgotten once skipped', () => {
    dropSong('c'); expect(isDropped('c')).toBe(true)
    forgetDropped('c'); expect(isDropped('c')).toBe(false)
  })
  it('works out when each song starts (dropped ones take no time)', () => {
    expect(startsIn(q, 60_000)).toEqual([60_000, 180_000, 380_000, 530_000])
    dropSong('b')
    expect(startsIn(q, 60_000)).toEqual([60_000, 180_000, 180_000, 330_000])
  })
  it('counts the skips to reach a song', () => {
    expect(skipsTo(q, 'a')).toBe(1)
    expect(skipsTo(q, 'c')).toBe(3)
    expect(skipsTo(q, 'zzz')).toBe(0)
  })
  it('labels the start', () => {
    expect(inLabel(5_000)).toBe('next')
    expect(inLabel(132_000)).toBe('in 2:12')
  })
})
