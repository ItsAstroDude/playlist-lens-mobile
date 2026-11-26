import { makeMutable, withTiming } from 'react-native-reanimated'

/**
 * Module-level shared value so any screen can drive the floating tab bar without
 * prop-drilling through the navigator. 0 = fully visible, 1 = slid away/hidden.
 * The bar, the now-playing pill and the queue tray all follow it.
 *
 * 2.0.45: hiding is per reason. The bar shows only when no reason is left, so one
 * screen showing it (Lenses scrolled back to the top, a tab switch) no longer pulls it
 * back over an open sheet. Every open Sheet is a reason of its own (components/ui/Sheet).
 */
export const tabBarHidden = makeMutable(0)

const reasons = new Set<string>()

function apply(): void {
  tabBarHidden.value = withTiming(reasons.size > 0 ? 1 : 0, { duration: 220 })
}

/** Hide the bar for `reason` (or stop hiding it for that reason). */
export function hideTabBar(reason: string, hidden: boolean): void {
  if (hidden === reasons.has(reason)) return
  if (hidden) reasons.add(reason); else reasons.delete(reason)
  apply()
}

/** Every reason the bar is hidden right now (tests, debugging). */
export function tabBarHideReasons(): string[] { return [...reasons] }

/** The tour shows the bar whatever else wants it hidden. */
export function resetTabBar(): void {
  if (!reasons.size) return
  reasons.clear()
  apply()
}
