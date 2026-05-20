import React from 'react'
import {
  Pressable,
  Text,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface ButtonProps extends PressableProps {
  label:      string
  variant?:   'primary' | 'ghost' | 'danger'
  size?:      'sm' | 'md' | 'lg'
  loading?:   boolean
  fullWidth?: boolean
  style?:     ViewStyle
  textStyle?: TextStyle
}

export function Button({
  label,
  variant   = 'primary',
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
      <Text style={[styles.label, styles[`${variant}Label`], styles[`${size}Label`], textStyle]}>
        {loading ? '...' : label}
      </Text>
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius:    Radius.lg,
    alignItems:      'center',
    justifyContent:  'center',
    flexDirection:   'row',
    gap:             Spacing.sm,
  },
  fullWidth: { width: '100%' },
  disabled:  { opacity: 0.4 },

  // Variants
  primary: { backgroundColor: Colors.green },
  ghost:   { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
  danger:  { backgroundColor: Colors.errorSubtle, borderWidth: 1, borderColor: Colors.error },

  // Sizes
  sm:  { paddingHorizontal: Spacing.md,   paddingVertical: Spacing.xs },
  md:  { paddingHorizontal: Spacing.xl,   paddingVertical: Spacing.md },
  lg:  { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.lg },

  // Labels
  label:        { fontFamily: FontFamily.monoMedium, color: Colors.text },
  primaryLabel: { color: '#000' },
  ghostLabel:   { color: Colors.textSecondary },
  dangerLabel:  { color: Colors.error },

  smLabel: { fontSize: FontSize.xs },
  mdLabel: { fontSize: FontSize.base },
  lgLabel: { fontSize: FontSize.md },
})
