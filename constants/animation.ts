import * as Haptics from 'expo-haptics'
import type { WithSpringConfig } from 'react-native-reanimated'
import { hapticsEnabled } from '@/utils/settings'

// ─── Spring Configs ───────────────────────────────────────────────────────────
// Base spring used for all transitions unless overridden
export const Spring: Record<string, WithSpringConfig> = {
  // Default — weighted, intentional
  default: { mass: 1, damping: 18, stiffness: 200 },
  // For large sheets expanding / collapsing
  sheet:   { mass: 1, damping: 22, stiffness: 180 },
  // For quick small interactions (button press, tag pop)
  snappy:  { mass: 0.8, damping: 14, stiffness: 280 },
  // For entrance animations (stagger, fade-up)
  entrance:{ mass: 1, damping: 20, stiffness: 160 },
  // For the pulsing auth orb
  pulse:   { mass: 1, damping: 10, stiffness: 80 },
} as const

// ─── Haptic Hierarchy ─────────────────────────────────────────────────────────
// Light   → passive interactions (tab switch, scroll snap)
// Medium  → intentional actions (button press, card tap)
// Heavy   → success / significant outcomes (profile generated, code copied)
// Gate every buzz behind the user's Haptics setting (default on).
const fire = (fn: () => void) => { if (hapticsEnabled()) fn() }
export const haptic = {
  light:   () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium:  () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy:   () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error:   () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
} as const

// ─── Stagger Delay ────────────────────────────────────────────────────────────
// Used for list entrance animations — 40ms per item as per spec
export const STAGGER_DELAY_MS = 40
