/**
 * Smoke tests: the island and the tabletop view render in each state without throwing.
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

import { Island } from '@/components/island/Island'
import { TabletopNowPlaying } from '@/components/fold/TabletopNowPlaying'
import { showToast } from '@/utils/dialog'
import { setNowPlayingPos, setSimulateHalfFold } from '@/utils/settings'

beforeEach(() => { jest.useFakeTimers(); mockNp = null; mockWaking = null; mockCover = false; mockPath = '/' })
afterEach(() => { jest.useRealTimers() })

describe('Island', () => {
  it('renders idle, peeks a line on Lenses, then shows a toast', () => {
    const r = render(React.createElement(Island, { authed: true }))
    act(() => { jest.advanceTimersByTime(800) })   // the Lenses peek
    act(() => { showToast('Added to queue', 'checkmark') })
    expect(r.getByText('Added to queue')).toBeTruthy()
    act(() => { jest.advanceTimersByTime(3000) })
    r.unmount()
  })
  it('shows the song lobes in Top island placement and opens the panel on tap', () => {
    setNowPlayingPos('top')
    mockNp = track
    mockPath = '/queue'
    const r = render(React.createElement(Island, { authed: true }))
    fireEvent.press(r.getByLabelText(/Now playing: Song/))
    expect(r.getByText('Song')).toBeTruthy()
    r.unmount()
    setNowPlayingPos('bottom')
  })
  it('shows the wake-up logged out and on the cover screen', () => {
    mockWaking = 12
    const r = render(React.createElement(Island, { authed: false }))
    r.unmount()
    mockCover = true
    const c = render(React.createElement(Island, { authed: true }))
    expect(c.getByText(/Waking up the server/)).toBeTruthy()
    c.unmount()
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
