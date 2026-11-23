/**
 * Smoke tests: the spot and the tabletop view render in each state without throwing.
 */
import React from 'react'
import { render, act, fireEvent } from '@testing-library/react-native'

require('react-native-gesture-handler/jestSetup')
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

import { Spot } from '@/components/spot/Spot'
import { TabletopNowPlaying } from '@/components/fold/TabletopNowPlaying'
import { showToast } from '@/utils/dialog'
import { setSimulateHalfFold } from '@/utils/settings'

beforeEach(() => { jest.useFakeTimers(); mockNp = null; mockWaking = null; mockCover = false; mockPath = '/' })
afterEach(() => { jest.useRealTimers() })

describe('Spot', () => {
  it('rests as a dot, then opens for a toast and closes again', () => {
    const r = render(React.createElement(Spot, { authed: true }))
    expect(r.getByLabelText(/Spot\. Tap to open/)).toBeTruthy()
    act(() => { showToast('Added to queue', 'checkmark') })
    expect(r.getByText('Added to queue')).toBeTruthy()
    act(() => { jest.advanceTimersByTime(3000) })
    expect(r.getByLabelText(/Spot\. Tap to open/)).toBeTruthy()
    r.unmount()
  })
  it('opens the song panel on tap', () => {
    mockNp = track
    const r = render(React.createElement(Spot, { authed: true }))
    fireEvent(r.getByLabelText(/Song is playing/), 'accessibilityTap')
    expect(r.getByText('Song')).toBeTruthy()
    expect(r.getByLabelText('Pause')).toBeTruthy()
    r.unmount()
  })
  it('says the server is waking, logged out and on the cover screen', () => {
    mockWaking = 12
    const r = render(React.createElement(Spot, { authed: false }))
    expect(r.getByText(/Waking up the server/)).toBeTruthy()
    r.unmount()
    mockCover = true
    const c = render(React.createElement(Spot, { authed: true }))
    expect(c.getByText(/Waking up the server/)).toBeTruthy()
    c.unmount()
  })
  it('stays out of stories unless it has news', () => {
    mockPath = '/story'
    const r = render(React.createElement(Spot, { authed: true }))
    expect(r.queryByLabelText(/Spot\./)).toBeNull()
    act(() => { showToast('Saved') })
    expect(r.getByText('Saved')).toBeTruthy()
    r.unmount()
  })
})

describe('TabletopNowPlaying', () => {
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
  it('stays away when flat', () => {
    mockNp = track
    const r = render(React.createElement(TabletopNowPlaying))
    expect(r.queryByLabelText('Close tabletop view')).toBeNull()
    r.unmount()
  })
})
