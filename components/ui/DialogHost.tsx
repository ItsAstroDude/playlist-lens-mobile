import React, { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, activeThemeMode } from '@/constants/theme'
import { Spring } from '@/constants/animation'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { onDialog, onToast, resolveDialog, type DialogOptions, type ToastOptions } from '@/utils/dialog'
import { Icon } from '@/components/ui/Icon'

/**
 * Root-mounted renderer for `showDialog()` / `showToast()` (utils/dialog.ts).
 * Mount once, after the navigator, so both float above every screen.
 */
export function DialogHost() {
  return (
    <>
      <DialogLayer />
      <ToastLayer />
    </>
  )
}

function DialogLayer() {
  const [open, setOpen] = useState<DialogOptions | null>(null)
  // Keep the last dialog's content while it fades out — otherwise the card would
  // empty itself mid-animation.
  const [shown, setShown] = useState<DialogOptions | null>(null)

  useEffect(() => onDialog(d => { setOpen(d); if (d) setShown(d) }), [])

  if (!shown) return null
  return (
    <ConfirmModal
      visible={!!open}
      title={shown.title}
      message={shown.message}
      glyph={shown.glyph}
      confirmLabel={shown.confirmLabel ?? 'OK'}
      cancelLabel={shown.cancelLabel ?? null}
      destructive={shown.destructive}
      onConfirm={() => resolveDialog(true)}
      onCancel={() => resolveDialog(false)}
    />
  )
}

const TOAST_MS = 2600

function ToastLayer() {
  const insets = useSafeAreaInsets()
  const [toast, setToast] = useState<ToastOptions | null>(null)
  const y = useSharedValue(-24)
  const o = useSharedValue(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unsub = onToast(t => {
      if (timer.current) clearTimeout(timer.current)
      setToast(t)
      AccessibilityInfo.announceForAccessibility(t.message)
      y.value = -24
      y.value = withSpring(0, Spring.bouncy)
      o.value = withTiming(1, { duration: 160 })
      timer.current = setTimeout(() => {
        y.value = withTiming(-24, { duration: 220 })
        o.value = withTiming(0, { duration: 220 })
      }, t.duration ?? TOAST_MS)
    })
    return () => { unsub(); if (timer.current) clearTimeout(timer.current) }
  }, [])

  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }))

  if (!toast) return null
  return (
    <Animated.View pointerEvents="none" style={[styles.toastWrap, { top: insets.top + Spacing.sm }, style]}>
      <View style={styles.toast} accessibilityLiveRegion="polite">
        <BlurView intensity={30} tint={activeThemeMode() === 'light' ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />
        <View style={styles.specular} />
        {toast.glyph ? <Icon name={toast.glyph} style={styles.glyph} /> : null}
        <Text style={styles.text} numberOfLines={2}>{toast.message}</Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  toastWrap: {
    position: 'absolute', left: Spacing.lg, right: Spacing.lg,
    alignItems: 'center', zIndex: 60,
  },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    maxWidth: 420,
    paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.glassBorder,
    backgroundColor: Colors.sheet, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12,
  },
  specular: { position: 'absolute', top: 0, left: Spacing.lg, right: Spacing.lg, height: 1, backgroundColor: Colors.glassHighlight },
  glyph: { fontSize: FontSize.md, color: Colors.greenPrimary },
  text: { flexShrink: 1, fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.text },
})
