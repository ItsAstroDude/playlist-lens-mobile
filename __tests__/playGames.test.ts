require('react-native-gesture-handler/jestSetup')
/** Smoke tests: the Play tab's newer games render and play a round. */
import React from 'react'
import { render, act, fireEvent } from '@testing-library/react-native'

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('@shopify/react-native-skia', () => new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) }))
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: jest.fn(), usePathname: () => '/' }))
jest.mock('expo-image', () => ({ Image: 'Image' }))
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }))
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('@/components/ui/Icon', () => ({ Icon: 'Icon', GlyphOrIcon: 'GlyphOrIcon' }))
jest.mock('@/components/motion', () => ({ useMotionReduced: () => true, RollingNumber: 'RollingNumber' }))
jest.mock('@/components/ui/ArtThumb', () => ({ ArtThumb: 'ArtThumb' }))
jest.mock('@/hooks/useNowPlaying', () => ({ useNowPlaying: () => ({ np: {
  type: 'track', is_playing: true, progress_ms: 1000, receivedAt: Date.now(),
  item: { id: 'x', uri: 'spotify:track:before', name: 'Before', mockArtists: ['B'], duration_ms: 1 } } }) }))
const mockPlayAt = jest.fn(() => Promise.resolve())
jest.mock('@/utils/playback', () => ({
  playAt: (...a: any[]) => (mockPlayAt as any)(...a), pausePlayback: jest.fn(() => Promise.resolve()),
  classifyPlaybackError: () => 'other', transportErrorMessage: () => 'nope',
}))
const mockTracks = Array.from({ length: 12 }, (_, i) => ({ name: `Song ${i}`, sub: `Artist ${i % 5}`, ms: 1, plays: 30 - i, uri: `spotify:track:s${i}` }))
const mockArtists = [50, 40, 30, 20, 10, 5].map((p, i) => ({ name: `Artist ${i}`, ms: 1, plays: p }))
jest.mock('@/utils/sqlJob', () => ({
  cachedAsync: () => Promise.resolve({ topTracks: mockTracks, topArtists: mockArtists }),
  runAsync: () => Promise.resolve([
    { name: 'Song 0', artist: 'Artist 0', plays: 30, peak: { y: 2025, m: 2 }, months: [{ y: 2025, m: 2, n: 9 }] },
    { name: 'Song 1', artist: 'Artist 1', plays: 29, peak: { y: 2025, m: 4 }, months: [{ y: 2025, m: 4, n: 5 }] },
    { name: 'Song 2', artist: 'Artist 2', plays: 28, peak: { y: 2026, m: 0 }, months: [{ y: 2026, m: 0, n: 4 }] },
  ]),
}))
jest.mock('@/utils/stats', () => ({
  periodStatsJob: jest.fn(), localOffsetSec: () => 0, yearsWithPlays: () => [2026, 2025],
}))

import { BlindFive } from '@/components/play/BlindFive'
import { RankIt } from '@/components/play/RankIt'
import { WhenGame } from '@/components/play/WhenGame'
import { storage } from '@/utils/cache'

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })

beforeEach(() => { storage.clearAll?.(); mockPlayAt.mockClear() })

it('Blind five plays a clip and scores an answer', async () => {
  const r = render(React.createElement(BlindFive))
  await flush()
  fireEvent.press(r.getByText('Play'))
  await flush()
  expect(mockPlayAt).toHaveBeenCalledTimes(1)
  const [uri, pos] = mockPlayAt.mock.calls[0] as any[]
  expect(uri).toMatch(/^spotify:track:s\d+$/)
  expect(pos).toBeGreaterThanOrEqual(20000)
  expect(r.getByText('ROUND 1 OF 10')).toBeTruthy()
  const n = Number(uri.replace('spotify:track:s', ''))
  fireEvent.press(r.getByLabelText(`Song ${n} by Artist ${n % 5}`))
  expect(r.getByText(/pts$/).props.children).not.toBe('0 pts')
  expect(r.getByText('Next song')).toBeTruthy()
  r.unmount()
})

it('Rank it deals five, moves one, and locks in', async () => {
  const onStart = jest.fn()
  const r = render(React.createElement(RankIt, { onStart }))
  await flush()
  fireEvent.press(r.getByText("Play today's five"))
  expect(onStart).toHaveBeenCalled()
  expect(r.getByText("TODAY'S FIVE")).toBeTruthy()
  const rows = r.getAllByLabelText(/^\d\. Artist \d$/)
  expect(rows).toHaveLength(5)
  fireEvent(rows[1], 'accessibilityAction', { nativeEvent: { actionName: 'increment' } })
  fireEvent.press(r.getByText('Lock it in'))
  expect(r.getByText(/\/ 5 right$/)).toBeTruthy()
  expect(r.getByText('Another five (practice)')).toBeTruthy()
  r.unmount()
})

it('When? takes a year and a month and shows the answer', async () => {
  const r = render(React.createElement(WhenGame))
  await flush()
  fireEvent.press(r.getByText('Play'))
  await flush()
  expect(r.getByText('ROUND 1 OF 3')).toBeTruthy()
  fireEvent.press(r.getByText('2025'))
  fireEvent.press(r.getByLabelText('Mar 2025'))
  fireEvent.press(r.getByText('Lock it in'))
  expect(r.getByText('+200')).toBeTruthy()
  expect(r.getByText('Mar 2025')).toBeTruthy()
  r.unmount()
})
