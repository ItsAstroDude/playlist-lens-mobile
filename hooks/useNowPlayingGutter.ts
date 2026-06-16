import { useEffect, useState } from 'react'
import { useNowPlaying } from './useNowPlaying'
import { getNowPlayingPos, onNowPlayingPos } from '@/utils/settings'

// Vertical space the bottom now-playing pill occupies (its height + breathing
// room). Scroll content, sheets, and the queue tray add this so the pill never
// covers anything. Returns 0 when the pill isn't docked at the bottom — parked in
// the home strip, or nothing playing AND no reconnect prompt — so we don't reserve
// dead space for a bar that isn't there.
export const NOW_PLAYING_BAR_CLEARANCE = 60

export function useNowPlayingGutter(): number {
  const { np, needsReconnect } = useNowPlaying()
  const [pos, setPos] = useState(getNowPlayingPos)
  useEffect(() => onNowPlayingPos(setPos), [])
  const showsBottomBar = pos === 'bottom' && (!!np?.item || needsReconnect)
  return showsBottomBar ? NOW_PLAYING_BAR_CLEARANCE : 0
}
