import { _resetDropNews, agoLabel, clearNews, currentNews, latelyNews, pushNews, LATELY_MAX } from '@/utils/dropCard'
import { bentoSizes, BENTO_GAP, BENTO_PAD } from '@/utils/bento'

beforeEach(() => _resetDropNews())

describe('drop card news', () => {
  it('makes the newest item current and leads the lately list', () => {
    pushNews({ kind: 'toast', title: 'Added to queue' })
    const b = pushNews({ kind: 'song', title: 'PPPP', sub: 'TAK' })
    expect(currentNews()?.id).toBe(b.id)
    expect(latelyNews().map(n => n.title)).toEqual(['PPPP', 'Added to queue'])
  })
  it('keeps only the last few, and the same thing twice in a row once', () => {
    for (let i = 0; i < 6; i++) pushNews({ kind: 'toast', title: `t${i}` })
    pushNews({ kind: 'toast', title: 't5' })
    expect(latelyNews()).toHaveLength(LATELY_MAX)
    expect(latelyNews()[0].title).toBe('t5')
    expect(latelyNews()[1].title).toBe('t4')
  })
  it('clears only the news it was asked to', () => {
    const a = pushNews({ kind: 'toast', title: 'a' })
    const b = pushNews({ kind: 'toast', title: 'b' })
    clearNews(a.id)
    expect(currentNews()?.id).toBe(b.id)
    clearNews(b.id)
    expect(currentNews()).toBeNull()
  })
  it('says how long ago', () => {
    const now = 1_000_000_000
    expect(agoLabel(now - 20_000, now)).toBe('now')
    expect(agoLabel(now - 4 * 60_000, now)).toBe('4 min')
    expect(agoLabel(now - 2 * 3_600_000, now)).toBe('2 h')
  })
})

describe('bentoSizes', () => {
  it('fits three tiles and two gaps inside the side padding (Flip 7 cover)', () => {
    const { tile, big, gap } = bentoSizes(474)
    expect(tile * 3 + gap * 2).toBeLessThanOrEqual(474 - BENTO_PAD * 2)
    expect(big).toBe(tile * 2 + BENTO_GAP)
    expect(tile).toBe(139)
  })
  it('never collapses on a tiny window', () => {
    expect(bentoSizes(100).tile).toBe(60)
  })
})
