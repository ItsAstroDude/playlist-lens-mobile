require('react-native-gesture-handler/jestSetup')
/** The lens sheet (L2 bento): header, tiles, a tile opens in full, Play starts the queue. */
import React from 'react'
import { render, fireEvent, act } from '@testing-library/react-native'

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaInsetsContext: require('react').createContext(null),
}))
jest.mock('@shopify/react-native-skia', () => new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) }))
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: jest.fn(), usePathname: () => '/' }))
jest.mock('expo-image', () => ({ Image: 'Image' }))
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }))
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('@/components/ui/ArtThumb', () => ({ ArtThumb: 'ArtThumb' }))
jest.mock('@/components/ui/RadarChart', () => ({ RadarChart: 'RadarChart' }))
jest.mock('@/components/wrapped/WrappedItemSheet', () => ({ WrappedItemSheet: () => null }))
jest.mock('@/hooks/useNowPlayingGutter', () => ({ useNowPlayingGutter: () => 0 }))
jest.mock('@/hooks/useScreen', () => ({ useIsCover: () => false }))
const mockData = {
  playlistId: 'p1', playlistName: 'late night drive', coverUrl: '', palette: null, cachedAt: 1,
  tracks: [
    { id: 'a', name: 'A', popularity: 30, duration_ms: 1, artists: [{ id: 'k', name: 'KMNZ' }], album: { name: '', release_date: '2021', images: [] }, external_urls: { spotify: '' }, uri: 'spotify:track:a' },
    { id: 'b', name: 'B', popularity: 30, duration_ms: 1, artists: [{ id: 't', name: 'TAK' }], album: { name: '', release_date: '2022', images: [] }, external_urls: { spotify: '' }, uri: 'spotify:track:b' },
  ],
  topArtists: [{ id: 'k', name: 'KMNZ', count: 9 }, { id: 't', name: 'TAK', count: 3 }],
  topGenres: [{ genre: 'future funk', count: 5 }, { genre: 'j-pop', count: 3 }],
  audioFeatures: { danceability: 0.74, energy: 0.82, valence: 0.6, acousticness: 0.1, instrumentalness: 0, liveness: 0.1, avgTempo: 122 },
  decades: [{ label: '2010s', count: 2 }, { label: '2020s', count: 8 }],
  popBuckets: [{ label: 'deep cuts', count: 6 }, { label: 'hits', count: 4 }],
  totalMs: 18_720_000, avgPop: 38, avgTrackMs: 1, artistCount: 41, vibe: 'bright and fast',
}
jest.mock('@/hooks/useAnalysis', () => ({
  useAnalysis: () => ({ status: 'success', data: mockData, error: null, analyze: jest.fn(), reset: jest.fn() }),
}))
const mockQueue = jest.fn()
jest.mock('@/utils/overlayEvents', () => ({ emitOpenStartQueue: (x: any) => mockQueue(x) }))

import { DetailSheet } from '@/components/sheet/DetailSheet'

it('shows the header and the tiles, opens a tile, and plays', () => {
  const pl: any = { id: 'p1', name: 'late night drive', images: [], tracks: { total: 84 }, owner: { display_name: 'me' } }
  const r = render(React.createElement(DetailSheet, { playlist: pl, palette: null, onClose: jest.fn() }))
  act(() => {})
  expect(r.getByText('late night drive')).toBeTruthy()
  expect(r.getByText(/^84 songs · /)).toBeTruthy()
  expect(r.getByLabelText(/^Sound: bright and fast/)).toBeTruthy()
  expect(r.getByLabelText(/^Top artist KMNZ, 9 songs/)).toBeTruthy()
  expect(r.getByLabelText(/^Eras: 80% from the 2020s/)).toBeTruthy()
  expect(r.getByLabelText(/^Fame 38, a bit of both/)).toBeTruthy()
  expect(r.getByLabelText(/^You played/)).toBeTruthy()
  fireEvent.press(r.getByLabelText(/^Eras:/))
  expect(r.getByText('By decade')).toBeTruthy()
  fireEvent.press(r.getByLabelText('Play late night drive'))
  expect(mockQueue).toHaveBeenCalledWith([
    { uri: 'spotify:track:a', name: 'A', artist: 'KMNZ', image: undefined },
    { uri: 'spotify:track:b', name: 'B', artist: 'TAK', image: undefined },
  ])
  r.unmount()
})
