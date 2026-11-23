/** Smoke test: the cover-screen player (after Samsung's open Now Bar) renders and closes. */
import React from 'react'
import { render, act, fireEvent } from '@testing-library/react-native'

require('react-native-gesture-handler/jestSetup')
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 30, bottom: 100, left: 0, right: 0 }) }))
jest.mock('expo-image', () => ({ Image: 'Image' }))
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }))
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('@/components/motion', () => ({ useMotionReduced: () => false }))
jest.mock('@/hooks/usePalette', () => ({ usePalette: () => ({ palettes: {}, extract: jest.fn(() => Promise.resolve({})) }) }))
jest.mock('@/hooks/useWrapped', () => ({ loadTrackIndex: () => null }))
jest.mock('@/utils/wrapped', () => ({ fmtMinutesShort: () => '2h' }))
jest.mock('@/utils/playback', () => ({
  fetchDevices: () => Promise.resolve([{ id: 'a', name: 'Pixel', type: 'Smartphone', is_active: true, is_restricted: false, volume_percent: 50 }]),
  resumePlayback: jest.fn(), pausePlayback: jest.fn(), skipNext: jest.fn(), skipPrevious: jest.fn(),
  classifyPlaybackError: () => 'other', transportErrorMessage: () => '', setPlaybackScopeMissing: jest.fn(),
}))
jest.mock('@/hooks/useNowPlaying', () => ({ pokeNowPlaying: jest.fn() }))

import { CoverPlayer } from '@/components/cover/CoverPlayer'

const np: any = {
  type: 'track', is_playing: true, progress_ms: 26000, receivedAt: Date.now(),
  item: { id: 't1', uri: 'spotify:track:t1', name: 'PPPP (feat. Hatsune Miku, Kasane Teto)', artists: ['TAK', 'Hatsune Miku'], duration_ms: 154000, album: { images: [{ url: 'https://x/y.jpg' }] } },
}

it('shows the song, the device and the controls, and closes', async () => {
  const onClose = jest.fn()
  const r = render(React.createElement(CoverPlayer, { np, open: true, onClose }))
  await act(async () => { await Promise.resolve() })
  expect(r.getAllByText('PPPP (feat. Hatsune Miku, Kasane Teto)').length).toBeGreaterThan(0)
  expect(r.getByText('TAK, Hatsune Miku')).toBeTruthy()
  expect(r.getByText('This phone')).toBeTruthy()
  expect(r.getByLabelText('Pause')).toBeTruthy()
  fireEvent.press(r.getByLabelText('Close'))
  expect(onClose).toHaveBeenCalled()
  r.unmount()
})
