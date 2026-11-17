import React from 'react'
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Colors } from '@/constants/theme'
import { haptic } from '@/constants/animation'

export const BACK_BUTTON_SIZE = 36

/**
 * The one back button for every pushed screen (settings, taste, compare, recaps,
 * flagged covers) — glass circle, generous hit area, light haptic, screen-reader
 * label. Falls back to the tabs root when there's no history to pop (e.g. a
 * screen opened straight from a notification on a cold start).
 */
export function BackButton({ style, onPress }: { style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const goBack = () => {
    haptic.light()
    if (onPress) return onPress()
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }
  return (
    <Pressable
      onPress={goBack}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={({ pressed }) => [styles.btn, pressed && styles.pressed, style]}
    >
      <Ionicons name="arrow-back" size={19} color={Colors.text} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE, borderRadius: BACK_BUTTON_SIZE / 2,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
})
