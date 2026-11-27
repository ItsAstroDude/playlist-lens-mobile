/**
 * The window's real size (2.0.45): measured from the root view, which always fills the
 * window, rather than taken from React Native's Dimensions. Moving between the Flip's
 * cover screen and the main one, Dimensions could still report the other screen's size
 * for a while, and screens laid out from it (Now playing full screen) came out a quarter
 * of the size. The root's onLayout feeds this; until it has, the Dimensions value stands in.
 */
import { useSyncExternalStore } from 'react'
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native'

export interface WindowSize { width: number; height: number }

let measured: WindowSize | null = null
const subs = new Set<() => void>()

/** For the root view's onLayout. Ignores sub-pixel jitter. */
export function setLiveWindow(w: number, h: number): void {
  if (!(w > 0 && h > 0)) return
  if (measured && Math.abs(measured.width - w) < 1 && Math.abs(measured.height - h) < 1) return
  measured = { width: w, height: h }
  subs.forEach(cb => cb())
}
export const onRootLayout = (e: LayoutChangeEvent): void =>
  setLiveWindow(e.nativeEvent.layout.width, e.nativeEvent.layout.height)

export function liveWindow(): WindowSize | null { return measured }

/** The window's size in dp, like useWindowDimensions — but measured. */
export function useLiveWindow(): WindowSize {
  const dims = useWindowDimensions()
  const m = useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb) } }, liveWindow, liveWindow)
  return m ?? { width: dims.width, height: dims.height }
}

/** Test hook. */
export function _resetLiveWindow(): void { measured = null }
