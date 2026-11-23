/** Smoke tests: the drop card and the cover bento render in their states. */
import React from 'react'
import { render, act, fireEvent } from '@testing-library/react-native'

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 40, bottom: 24, left: 0, right: 0 }) }))
jest.mock('expo-router', () => ({ useFocusEffect: (cb: () => void | (() => void)) => { const R = require('react'); R.useEffect(cb, [cb]) } }))
jest.mock('expo-image', () => ({ Image: 'Image' }))
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }))
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Circle: 'Circle' }))
jest.mock('@/components/ui/Icon', () => ({ Icon: 'Icon', GlyphOrIcon: 'GlyphOrIcon' }))
jest.mock('@/components/ui', () => ({ ArtThumb: 'ArtThumb' }))
jest.mock('@/components/motion', () => ({ useMotionReduced: () => false }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ login: jest.fn(), isLoading: false }) }))
let mockCover = false
jest.mock('@/hooks/useScreen', () => ({ useIsCover: () => mockCover }))
jest.mock('@/hooks/usePalette', () => ({ usePalette: () => ({ palettes: {}, extract: jest.fn(() => Promise.resolve({})) }) }))
jest.mock('@/hooks/useWrapped', () => ({ loadTrackIndex: () => null }))
jest.mock('@/utils/wrapped', () => ({ fmtMinutesShort: () => '2h', fmtHours: () => '14h' }))
jest.mock('@/utils/sqlJob', () => ({ cachedAsync: () => Promise.resolve({ ms: 51_000_000, plays: 210, activeDays: 6, topArtists: [{ name: 'Moe Shop', ms: 1, plays: 1 }] }) }))
jest.mock('@/utils/stats', () => ({ periodStatsJob: jest.fn() }))
jest.mock('@/utils/highlights', () => ({ streaksAsync: () => Promise.resolve({ current: 12 }) }))
const track = {
  type: 'track', is_playing: true, progress_ms: 30000, receivedAt: Date.now(),
  item: { id: 't1', uri: 'spotify:track:t1', name: 'PPPP', artists: ['TAK'], duration_ms: 200000, album: { images: [{ url: 'https://x/y.jpg' }] } },
}
let mockNp: any = track
jest.mock('@/hooks/useNowPlaying', () => ({ useNowPlaying: () => ({ np: mockNp, needsReconnect: false }), pokeNowPlaying: jest.fn() }))

import { NowPlayingButton, DropCardHost } from '@/components/nowplaying/DropCard'
import { CoverBento } from '@/components/cover/CoverBento'
import { showToast } from '@/utils/dialog'
import { setNowPlayingPos } from '@/utils/settings'
import { _resetDropNews } from '@/utils/dropCard'

beforeEach(() => { jest.useFakeTimers(); mockNp = track; mockCover = false; _resetDropNews(); setNowPlayingPos('top') })
afterEach(() => { jest.useRealTimers(); setNowPlayingPos('bottom') })

const Screen = () => React.createElement(React.Fragment, null, React.createElement(NowPlayingButton), React.createElement(DropCardHost))

describe('drop card', () => {
  it('drops a toast out of the button, then puts it away', () => {
    const r = render(React.createElement(Screen))
    act(() => { showToast('Added to queue', 'checkmark') })
    expect(r.getByText('Added to queue')).toBeTruthy()
    act(() => { jest.advanceTimersByTime(3000) })
    r.unmount()
  })
  it('opens into the whole card on tap, with what happened lately', () => {
    const r = render(React.createElement(Screen))
    act(() => { showToast('Synced 12 new plays') })
    fireEvent.press(r.getByLabelText(/Now playing: PPPP by TAK/))
    expect(r.getByLabelText('Pause')).toBeTruthy()
    expect(r.getByText('LATELY')).toBeTruthy()
    expect(r.getAllByText('Synced 12 new plays').length).toBeGreaterThan(0)
    r.unmount()
  })
  it('stays away with Now playing above the nav, and on the cover screen', () => {
    setNowPlayingPos('bottom')
    const a = render(React.createElement(Screen))
    act(() => { showToast('Hello') })
    expect(a.queryByText('Hello')).toBeNull()
    a.unmount()
    setNowPlayingPos('top'); mockCover = true
    const b = render(React.createElement(Screen))
    expect(b.queryByLabelText(/Now playing/)).toBeNull()
    b.unmount()
  })
})

describe('cover bento', () => {
  // The bento sizes itself from its own width: give it the Flip 7 cover's.
  const layout = (r: ReturnType<typeof render>) =>
    fireEvent(r.UNSAFE_root.findAll((n: any) => typeof n.props?.onLayout === 'function')[0], 'layout', { nativeEvent: { layout: { width: 474, height: 400, x: 0, y: 0 } } })

  it('shows the song and this week', async () => {
    const r = render(React.createElement(CoverBento))
    act(() => { layout(r) })
    await act(async () => { await Promise.resolve() })
    expect(r.getByText('PPPP')).toBeTruthy()
    expect(r.getByText('THIS WEEK')).toBeTruthy()
    r.unmount()
  })
  it('says when nothing is playing', () => {
    mockNp = null
    const r = render(React.createElement(CoverBento))
    act(() => { layout(r) })
    expect(r.getByText('Nothing playing')).toBeTruthy()
    r.unmount()
  })
})

