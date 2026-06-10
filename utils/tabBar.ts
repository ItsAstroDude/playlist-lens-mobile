import { makeMutable, withTiming } from 'react-native-reanimated'

/**
 * Module-level shared value so any screen can drive the floating tab bar without
 * prop-drilling through the navigator. 0 = fully visible, 1 = slid away/hidden.
 * Used for auto-hide-on-scroll (Lenses) and force-hide in reorder mode.
 */
export const tabBarHidden = makeMutable(0)

export function setTabBarHidden(hidden: boolean) {
  tabBarHidden.value = withTiming(hidden ? 1 : 0, { duration: 220 })
}
