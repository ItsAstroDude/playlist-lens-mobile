import { CARD, SPOT, cardRect, restPoint, snapSide, yRange, type SpotArea } from '@/utils/spot'

const main: SpotArea = { W: 411, H: 960, insetTop: 40, insetBottom: 24, cover: false }
const cover: SpotArea = { W: 474, H: 524, insetTop: 30, insetBottom: 100, cover: true }

describe('spot rest + snap', () => {
  it('rests on the chosen edge, inside the allowed band', () => {
    const r = restPoint('right', 0.2, main)
    expect(r.x).toBe(411 - SPOT.margin - SPOT.dot / 2)
    expect(r.y).toBe(192)
    const l = restPoint('left', 0, main)
    expect(l.x).toBe(SPOT.margin + SPOT.dot / 2)
    expect(l.y).toBe(yRange(main)[0])
    expect(restPoint('left', 1, main).y).toBe(yRange(main)[1])
  })
  it('keeps clear of the cover screen cameras at the bottom', () => {
    expect(restPoint('right', 1, cover).y).toBeLessThanOrEqual(524 - 150)
  })
  it('snaps to the side it is heading for (a flick counts)', () => {
    expect(snapSide(100, 0, 411)).toBe('left')
    expect(snapSide(300, 0, 411)).toBe('right')
    expect(snapSide(150, 1500, 411)).toBe('right')
    expect(snapSide(260, -1500, 411)).toBe('left')
  })
})

describe('cardRect', () => {
  it('opens on its own side, level with the dot', () => {
    const r = cardRect('right', 300, 80, main)
    expect(r.left + r.width).toBe(411 - CARD.margin)
    expect(r.top).toBe(278)
    expect(cardRect('left', 300, 80, main).left).toBe(CARD.margin)
  })
  it('stays on screen near the top and bottom', () => {
    expect(cardRect('right', 0, 80, main).top).toBe(48)
    const low = cardRect('right', 2000, 120, main)
    expect(low.top + 120).toBeLessThanOrEqual(960 - 24 - 16)
  })
  it('caps the width on wide windows', () => {
    expect(cardRect('left', 300, 80, { ...main, W: 900 }).width).toBe(CARD.maxW)
  })
})
