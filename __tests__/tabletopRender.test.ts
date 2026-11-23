require('react-native-gesture-handler/jestSetup')
/**
 * Smoke tests: the half-folded tabletop view renders, and only when it should.
 */
import React from 'react'
import { render, act, fireEvent } from '@testing-library/react-native'

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 24, left: 0, right: 0 }),
}))
let mockPath = '/'
jest.mock('expo-router', () => ({ usePathname: () => mockPath }))
jest.mock('expo-image', () => ({ Image: 'Image' }))
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }))
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('@/components/motion/Aurora', () => ({ Aurora: 'Aurora' }))
jest.mock('@/components/ui/ServerState', () => ({ WakeDot: 'WakeDot' }))
jest.mock('@/components/ui/Icon', () => ({ Icon: 'Icon', GlyphOrIcon: 'GlyphOrIcon' }))
jest.mock('@/components/motion', () => ({ useMotionReduced: () => false }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ login: jest.fn(), isLoading: false }) }))
let mockWaking: number | null = null
jest.mock('@/hooks/useServerWaking', () => ({ useServerWaking: () => mockWaking }))
let mockCover = false
jest.mock('@/hooks/useScreen', () => ({ useIsCover: () => mockCover }))
jest.mock('@/hooks/usePalette', () => ({ usePalette: () => ({ palettes: {}, extract: jest.fn(() => Promise.resolve({})) }) }))
jest.mock('@/hooks/useWrapped', () => ({ loadTrackIndex: () => null, loadCachedWrapped: () => null }))
jest.mock('@/utils/liveLines', () => ({ weekFacts: () => null, weekLines: () => [] }))
jest.mock('@/utils/wrapped', () => ({ wrappedTeasers: () => [], fmtMinutesShort: (ms: number) => `${Math.round(ms / 60000)}m` }))
const track = {
  type: 'track', is_playing: true, progress_ms: 30000, receivedAt: Date.now(),
  item: { id: 't1', uri: 'spotify:track:t1', name: 'Song', artists: ['Artist'], duration_ms: 200000, album: { images: [{ url: 'https://x/y.jpg' }] } },
}
let mockNp: any = null
jest.mock('@/hooks/useNowPlaying', () => ({
  useNowPlaying: () => ({ np: mockNp, needsReconnect: false }),
  pokeNowPlaying: jest.fn(),
}))

jest.mock('@/utils/api', () => {
  class ApiError extends Error { mockStatus = 0 }
  const img = null
  return {
    ApiError,
    api: { get: jest.fn(() => Promise.resolve({ current: null, queue: [
      { id: 'n1', uri: 'spotify:track:n1', name: 'Lovesick Girls', duration_ms: 182000, artists: ['Moe Shop'], image: img },
      { id: 'n2', uri: 'spotify:track:n2', name: 'Hitorinbo Envy', duration_ms: 228000, artists: ['25-ji'], image: img },
    ] })) },
  }
})

import { TabletopNowPlaying } from '@/components/fold/TabletopNowPlaying'
import { setSimulateHalfFold, setTabletopEnabled, setTabletopLayout } from '@/utils/settings'
import { requestTabletop } from '@/utils/coverMode'

beforeEach(() => { jest.useFakeTimers(); mockNp = null; mockWaking = null; mockCover = false; mockPath = '/' })
afterEach(() => { jest.useRealTimers() })

describe('TabletopNowPlaying', () => {
  beforeEach(() => setTabletopEnabled(true))
  afterEach(() => { setTabletopEnabled(false); requestTabletop(false) })

  it('stays shut when folding with auto-open off, and opens when asked for', () => {
    setTabletopEnabled(false)
    mockNp = track
    setSimulateHalfFold(true)
    const r = render(React.createElement(TabletopNowPlaying))
    act(() => { jest.advanceTimersByTime(50) })
    expect(r.queryByLabelText('Close tabletop view')).toBeNull()
    act(() => { requestTabletop() })
    expect(r.getByLabelText('Close tabletop view')).toBeTruthy()
    r.unmount()
    setSimulateHalfFold(false)
  })
  it('appears when simulated half-folded with a song playing', () => {
    mockNp = track
    setSimulateHalfFold(true)
    const r = render(React.createElement(TabletopNowPlaying))
    act(() => { jest.advanceTimersByTime(50) })
    expect(r.getByLabelText('Close tabletop view')).toBeTruthy()
    expect(r.getByText('Song')).toBeTruthy()
    r.unmount()
    setSimulateHalfFold(false)
  })
  it('shows up next as a deck over the touch strip', async () => {
    mockNp = track
    setSimulateHalfFold(true)
    setTabletopLayout('strip')
    const r = render(React.createElement(TabletopNowPlaying))
    await act(async () => { jest.advanceTimersByTime(800); await Promise.resolve(); await Promise.resolve() })
    expect(r.getByLabelText(/Up next: Lovesick Girls/)).toBeTruthy()
    expect(r.getByLabelText(/Touch strip/)).toBeTruthy()
    expect(r.getByLabelText('Up next')).toBeTruthy()
    r.unmount()
    setTabletopLayout('now')
    setSimulateHalfFold(false)
  })
  it('opens on a flat phone when asked for (the Lenses cover button), split at the middle', () => {
    setTabletopEnabled(false)
    mockNp = track
    const r = render(React.createElement(TabletopNowPlaying))
    expect(r.queryByLabelText('Close tabletop view')).toBeNull()
    act(() => { requestTabletop() })
    expect(r.getByLabelText('Close tabletop view')).toBeTruthy()
    act(() => { requestTabletop(false) })
    r.unmount()
  })
  it('stays away when flat', () => {
    mockNp = track
    const r = render(React.createElement(TabletopNowPlaying))
    expect(r.queryByLabelText('Close tabletop view')).toBeNull()
    r.unmount()
  })
})

import { FlexPanel } from '@/components/fold/FlexPanel'
import { tabletopRequested } from '@/utils/coverMode'

describe('FlexPanel', () => {
  it('is a remote for the song, and opens Now playing full screen', () => {
    mockNp = track
    const r = render(React.createElement(FlexPanel, { height: 480 }))
    expect(r.getByText('Song')).toBeTruthy()
    expect(r.getByLabelText(/Remote\. Playing/)).toBeTruthy()
    fireEvent.press(r.getByLabelText('Open Now playing full screen'))
    expect(tabletopRequested()).toBe(true)
    requestTabletop(false)
    r.unmount()
  })
  it('offers to resume when nothing plays', () => {
    mockNp = null
    const r = render(React.createElement(FlexPanel, { height: 480 }))
    expect(r.getByText('Nothing playing')).toBeTruthy()
    expect(r.queryByLabelText('Open Now playing full screen')).toBeNull()
    r.unmount()
  })
})
