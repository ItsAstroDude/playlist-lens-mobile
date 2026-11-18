import { useReducedMotion } from 'react-native-reanimated'
import { reduceMotionEnabled } from '@/utils/settings'

/** True when the phone's Reduce motion OR the app's own setting is on. */
export function useMotionReduced(): boolean {
  const os = useReducedMotion()
  return os || reduceMotionEnabled()
}
