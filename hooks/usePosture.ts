import { useEffect, useState } from 'react'
import { AppState, useWindowDimensions } from 'react-native'
import { requireOptionalNativeModule } from 'expo-modules-core'
import { NO_FOLD, parsePosture, simulatedPosture, type Posture } from '@/utils/posture'
import { onFoldSettings, simulateHalfFold } from '@/utils/settings'

interface PostureModule {
  getPosture?(): unknown
  addListener?(event: 'onPosture', cb: (p: unknown) => void): { remove(): void }
}

// The same DisplayInfo module as hooks/useScreen. `getPosture` only exists from APK
// versionCode 5; on older APKs this reads as "no fold" (unless Labs simulates one).
const Native = requireOptionalNativeModule<PostureModule>('DisplayInfo')

/** True when this APK can report the fold (Labs shows it). */
export const postureSupported = typeof Native?.getPosture === 'function'

function readNative(): Posture {
  if (!postureSupported) return NO_FOLD
  try { return parsePosture(Native!.getPosture!()) } catch { return NO_FOLD }
}

/**
 * The fold right now: flat, half-folded (tabletop on a Flip), or no fold at all.
 * Live: Android pushes every change (the hinge moving past ~150°/~30° flips it).
 */
export function usePosture(): Posture {
  const { width, height } = useWindowDimensions()
  const [native, setNative] = useState<Posture>(readNative)
  const [sim, setSim] = useState(simulateHalfFold)

  useEffect(() => onFoldSettings(() => setSim(simulateHalfFold())), [])
  useEffect(() => {
    if (!postureSupported) return
    const sub = Native!.addListener?.('onPosture', p => setNative(parsePosture(p)))
    const app = AppState.addEventListener('change', s => { if (s === 'active') setNative(readNative()) })
    setNative(readNative())
    return () => { sub?.remove(); app.remove() }
  }, [])

  // Only pretend on a screen that could fold (not the cover screen: there's no hinge there).
  if (sim && native.state !== 'half' && height > width * 1.4) return simulatedPosture(height, width)
  return native
}
