import { useEffect, useState } from 'react'
import { useNowPlayingSelect } from './useNowPlaying'
import { getNowPlayingPos, onNowPlayingPos } from '@/utils/settings'

// Vertical space the bottom now-playing pill occupies (its height + breathing
// room). Scroll content, sheets, and the queue tray add this so the pill never
// covers anything. Returns 0 when the pill isn't docked at the bottom — parked in
// the Lenses header button, or nothing playing AND no reconnect prompt — so we don't reserve
// dead space for a bar that isn't there.
export const NOW_PLAYING_BAR_CLEARANCE = 60

export function useNowPlayingGutter(): number {
  // Only "is there a bar?" — not the whole now-playing state, which changes every poll.
  const barShown = useNowPlayingSelect((np, needsReconnect) => !!np?.item || needsReconnect)
  const [pos, setPos] = useState(getNowPlayingPos)
  useEffect(() => onNowPlayingPos(setPos), [])
  const showsBottomBar = pos === 'bottom' && barShown
  return showsBottomBar ? NOW_PLAYING_BAR_CLEARANCE : 0
}
