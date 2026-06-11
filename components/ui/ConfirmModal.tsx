import React, { useEffect } from 'react'
import { View, Text, StyleSheet, Pressable, BackHandler } from 'react-native'
import { BlurView } from 'expo-blur'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'

/**
 * On-brand confirm dialog — replaces the stock OS Alert for moments that deserve
 * the Liquid Lens look (e.g. the "update ready, restart?" prompt). Glass card,
 * springy scale-in, optional emoji/glyph. Backdrop + Android back both cancel.
 */
export function ConfirmModal({
  visible, title, message, glyph, confirmLabel = 'OK', cancelLabel = 'Cancel',
  onConfirm, onCancel, destructive,
}: {
  visible:      boolean
  title:        string
  message:      string
  glyph?:       string
  confirmLabel?: string
  cancelLabel?:  string
  onConfirm:    () => void
  onCancel:     () => void
  destructive?: boolean
}) {
  const scale    = useSharedValue(0.9)
  const opacity  = useSharedValue(0)
  const backdrop = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      scale.value    = withSpring(1, Spring.bouncy)
      opacity.value  = withTiming(1, { duration: 180 })
      backdrop.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) })
    } else {
      scale.value    = withTiming(0.92, { duration: 140 })
      opacity.value  = withTiming(0, { duration: 140 })
      backdrop.value = withTiming(0, { duration: 160 })
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onCancel(); return true })
    return () => sub.remove()
  }, [visible, onCancel])

  const cardStyle     = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }))

  const accent = destructive ? Colors.error : Colors.greenPrimary

  return (
    <Animated.View style={[styles.root, backdropStyle]} pointerEvents={visible ? 'auto' : 'none'}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel}>
        <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>

      <Animated.View style={[styles.card, cardStyle]}>
        <View style={styles.specular} />
        {glyph ? <Text style={[styles.glyph, { color: accent }]}>{glyph}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={() => { haptic.light(); onCancel() }}>
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </Pressable>
          <Pressable
            style={[styles.confirmBtn, { backgroundColor: accent }]}
            onPress={() => { haptic.success(); onConfirm() }}
          >
            <Text style={styles.confirmText}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 50, paddingHorizontal: Spacing.xl,
  },
  card: {
    width: '100%', maxWidth: 360,
    backgroundColor: Colors.sheet,
    borderRadius: Radius['2xl'], borderWidth: 1, borderColor: Colors.glassBorder,
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.lg,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 20,
  },
  specular: { position: 'absolute', top: 0, left: Spacing.xl, right: Spacing.xl, height: 1, backgroundColor: Colors.glassHighlight },
  glyph: { fontSize: 30, marginBottom: Spacing.sm },
  title: { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, color: Colors.text, letterSpacing: -0.5 },
  message: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.sm, lineHeight: FontSize.sm * 1.5 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl, justifyContent: 'flex-end' },
  cancelBtn: { paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.lg, borderRadius: Radius.full },
  cancelText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.textMuted },
  confirmBtn: { paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.xl, borderRadius: Radius.full },
  confirmText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.background },
})
