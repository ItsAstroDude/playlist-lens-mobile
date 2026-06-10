import { applyOrder, pinToTop } from '@/utils/playlistOrder'

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

describe('applyOrder', () => {
  it('returns items unchanged when no custom order is set', () => {
    expect(applyOrder(items, []).map(i => i.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('reorders known ids to the saved sequence', () => {
    expect(applyOrder(items, ['c', 'a', 'b', 'd']).map(i => i.id)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('keeps unknown (newly added) playlists at the end in original order', () => {
    // order only mentions c and a; b and d are "new"
    expect(applyOrder(items, ['c', 'a']).map(i => i.id)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('ignores stale ids no longer present', () => {
    expect(applyOrder(items, ['z', 'b', 'a']).map(i => i.id)).toEqual(['b', 'a', 'c', 'd'])
  })
})

describe('pinToTop', () => {
  it('moves an id to the front, preserving the rest', () => {
    expect(pinToTop(['a', 'b', 'c', 'd'], 'c')).toEqual(['c', 'a', 'b', 'd'])
  })
  it('is a no-op position-wise if already first', () => {
    expect(pinToTop(['a', 'b', 'c'], 'a')).toEqual(['a', 'b', 'c'])
  })
})
