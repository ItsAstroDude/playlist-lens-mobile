import { setLiveWindow, liveWindow, _resetLiveWindow } from '@/utils/liveWindow'

beforeEach(() => _resetLiveWindow())

describe('liveWindow', () => {
  it('holds the measured root size', () => {
    expect(liveWindow()).toBeNull()
    setLiveWindow(411, 960)
    expect(liveWindow()).toEqual({ width: 411, height: 960 })
  })
  it('moves with the window (cover screen → main) and ignores sub-pixel jitter', () => {
    setLiveWindow(474, 524)
    const cover = liveWindow()
    setLiveWindow(474.4, 524.3)
    expect(liveWindow()).toBe(cover)
    setLiveWindow(411, 960)
    expect(liveWindow()).toEqual({ width: 411, height: 960 })
  })
  it('ignores empty layouts', () => {
    setLiveWindow(0, 0)
    expect(liveWindow()).toBeNull()
  })
})
