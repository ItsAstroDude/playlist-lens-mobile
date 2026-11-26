import { storage } from '@/utils/cache'
import { previewOf, saveTastePreview, readTastePreview, analysesSignature } from '@/utils/tastePreview'
import type { TasteProfile } from '@/types'

const profile = (n: number): TasteProfile => ({
  version: 2, name: 'me', trackCount: 3000, playlistCount: n, artistCount: 1204, vibe: null, af: null, generatedAt: '',
  topArtists: [{ id: 'a', name: 'Jamie Paige', count: 60 }, { id: 'b', name: 'DECO*27', count: 50 }, { id: 'c', name: 'Moe Shop', count: 40 }, { id: 'd', name: 'X', count: 1 }],
  topGenres: [{ genre: 'vocaloid', count: 9 }, { genre: 'j-pop', count: 8 }, { genre: 'anime', count: 7 }, { genre: 'score', count: 1 }],
})

beforeEach(() => storage.clearAll())

describe('taste preview', () => {
  it('keeps just what the card shows: top 3 artists and genres, the counts', () => {
    expect(previewOf(profile(42), 's')).toEqual({
      lenses: 42, artists: 1204, tracks: 3000, vibe: null, sig: 's',
      topArtists: ['Jamie Paige', 'DECO*27', 'Moe Shop'], topGenres: ['vocaloid', 'j-pop', 'anime'],
    })
  })
  it('is saved for the next first frame, and cleared when there is no profile', () => {
    storage.set('analysis:p1', '{}')
    saveTastePreview(profile(1))
    expect(readTastePreview()?.lenses).toBe(1)
    expect(readTastePreview()?.sig).toBe(analysesSignature(['analysis:p1']))
    saveTastePreview(null)
    expect(readTastePreview()).toBeNull()
  })
  it('the signature follows which lenses are analysed, not other keys or order', () => {
    const a = analysesSignature(['analysis:p1', 'x', 'analysis:p2'])
    expect(analysesSignature(['analysis:p2', 'analysis:p1', 'settings.y'])).toBe(a)
    expect(analysesSignature(['analysis:p1'])).not.toBe(a)
  })
})
