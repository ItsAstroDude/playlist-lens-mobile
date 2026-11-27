import { useEffect, useState } from 'react'
import { AppState, PixelRatio, useWindowDimensions } from 'react-native'
import { requireOptionalNativeModule } from 'expo-modules-core'
import { isCoverWindow } from './useCoverScreen'

/** What the native DisplayInfo module reports (modules/display-info). */
export interface NativeDisplay {
  /** Android display id: 0 = main (inner) screen; the Flip's cover screen is another id. */
  id: number
  isDefault: boolean
  widthPx: number
  heightPx: number
  densityDpi: number
  /** The app's own px-per-dp there (One UI runs apps on the Flip 7 cover at 2.0). */
  appDensity: number
}

interface DisplayInfoModule {
  get(): NativeDisplay | null
  addListener?(event: 'onChange', cb: (d: NativeDisplay) => void): { remove(): void }
}

// Null on an APK built before the module existed: OTA bundles fall back to window size.
const Native = requireOptionalNativeModule<DisplayInfoModule>('DisplayInfo')

export type ScreenKind = 'cover' | 'main'

export interface ScreenInfo {
  kind: ScreenKind
  /** 'display' = Android said which display; 'size' = guessed from the window size. */
  source: 'display' | 'size'
  /** One line for debug readouts. */
  detail: string
}

function read(): NativeDisplay | null {
  try { return Native?.get() ?? null } catch { return null }
}

/**
 * Which screen the app is drawing on right now: the Flip's cover screen or the main one.
 * Asks Android for the activity's display when the native module is in the APK;
 * otherwise falls back to the window's size (short and nearly square = cover).
 * Re-checks whenever the window changes size, the app comes back, or the display changes.
 */
export function useScreen(): ScreenInfo {
  const { width, height } = useWindowDimensions()
  const [display, setDisplay] = useState<NativeDisplay | null>(read)

  useEffect(() => { setDisplay(read()) }, [width, height])
  useEffect(() => {
    const app = AppState.addEventListener('change', s => { if (s === 'active') setDisplay(read()) })
    const sub = Native?.addListener?.('onChange', d => setDisplay(d))
    return () => { app.remove(); sub?.remove() }
  }, [])

  const w = Math.round(width), h = Math.round(height), k = `×${PixelRatio.get()}`
  if (display) {
    const kind: ScreenKind = display.isDefault ? 'main' : 'cover'
    return {
      kind, source: 'display',
      detail: `display ${display.id} (${kind}) · ${display.widthPx}×${display.heightPx} px · ${w}×${h} dp · ${k}`,
    }
  }
  const kind: ScreenKind = isCoverWindow(width, height) ? 'cover' : 'main'
  return { kind, source: 'size', detail: `${kind} (guessed from size) · ${w}×${h} dp · ${k}` }
}

/** True while the app is on the Flip's cover screen. */
export function useIsCover(): boolean {
  return useScreen().kind === 'cover'
}
