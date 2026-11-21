import { useWindowDimensions } from 'react-native'

/**
 * True when the window is the Flip's cover screen. Flip 7: apps get the cover panel
 * (948×1048 px) at 2.0 px/dp, so ≈474×524 dp (nearly square, short); the main screen
 * is 360×840 dp. A split-screen or pop-up window on the main screen can be short too,
 * so require "nearly square" as well as "short".
 */
export function isCoverWindow(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false
  const ratio = width / height
  return height < 600 && ratio > 0.75 && ratio < 1.35
}

export function useCoverScreen(): boolean {
  const { width, height } = useWindowDimensions()
  return isCoverWindow(width, height)
}
