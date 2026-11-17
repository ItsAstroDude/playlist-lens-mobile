import React from 'react'
import {
  Pressable,
  Text,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Radius, Spacing, alpha } from '@/constants/theme'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Spring, haptic } from '@/constants/animation'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface ButtonProps extends PressableProps {
  label:      string
  /**
   * accent    — the main action on a screen (filled with the chosen accent)
   * secondary — glass pill, for the actions beside it
   * ghost     — outline only
   * danger    — destructive
   * spotify   — Spotify's own green; ONLY "Log in with Spotify"
   */
  variant?:   'accent' | 'secondary' | 'ghost' | 'danger' | 'spotify'
  icon?:      IconName
  size?:      'sm' | 'md' | 'lg'
  loading?:   boolean
  fullWidth?: boolean
  style?:     StyleProp<ViewStyle>
  textStyle?: TextStyle
}

export function Button({
  label,
  variant   = 'accent',
  icon,
  size      = 'md',
  loading   = false,
  fullWidth = false,
  onPress,
  style,
  textStyle,
  disabled,
  ...rest
}: ButtonProps) {
  const scale = useSharedValue(1)

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = () => {
    scale.value = withSpring(0.96, Spring.snappy)
    haptic.medium()
  }

  const handlePressOut = () => {
    scale.value = withSpring(1, Spring.snappy)
  }

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        animStyle,
        styles.base,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 13 : 16} color={LABEL_COLOR[variant]} /> : null}
      <Text style={[styles.label, styles[`${variant}Label`], styles[`${size}Label`], textStyle]}>
        {loading ? '...' : label}
      </Text>
    </AnimatedPressable>
  )
}

const LABEL_COLOR = {
  accent: Colors.background, secondary: Colors.textSecondary, ghost: Colors.textSecondary,
  danger: Colors.error, spotify: '#000',
} as const

const styles = StyleSheet.create({
  base: {
    borderRadius:    Radius.full,
    alignItems:      'center',
    justifyContent:  'center',
    flexDirection:   'row',
    gap:             Spacing.sm,
  },
  fullWidth: { width: '100%' },
  disabled:  { opacity: 0.4 },

  // Variants
  accent:    { backgroundColor: Colors.greenPrimary },
  secondary: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder },
  ghost:     { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
  danger:    { backgroundColor: alpha(Colors.error, 0.08), borderWidth: 1, borderColor: alpha(Colors.error, 0.4) },
  spotify:   { backgroundColor: Colors.green },

  // Sizes
  sm:  { paddingHorizontal: Spacing.md,   paddingVertical: Spacing.xs },
  md:  { paddingHorizontal: Spacing.xl,   paddingVertical: Spacing.md },
  lg:  { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.lg },

  // Labels
  label:        { fontFamily: FontFamily.monoMedium, color: Colors.text },
  accentLabel:    { color: LABEL_COLOR.accent },
  secondaryLabel: { color: LABEL_COLOR.secondary },
  ghostLabel:     { color: LABEL_COLOR.ghost },
  dangerLabel:    { color: LABEL_COLOR.danger },
  spotifyLabel:   { color: LABEL_COLOR.spotify },

  smLabel: { fontSize: FontSize.xs },
  mdLabel: { fontSize: FontSize.base },
  lgLabel: { fontSize: FontSize.md },
})
