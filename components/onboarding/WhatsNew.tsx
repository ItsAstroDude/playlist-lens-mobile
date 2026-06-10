import React, { useEffect } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, BackHandler, Dimensions } from 'react-native'
import { BlurView } from 'expo-blur'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { latestPatch, type ChangeKind } from '@/utils/whatsNew'

const { height: SH } = Dimensions.get('window')

const KIND_COLOR: Record<ChangeKind, string> = {
  New:      Colors.greenPrimary,
  Improved: Colors.lavender,
  Fixed:    Colors.pink,
}

export function WhatsNew({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const patch = latestPatch()
  const scale    = useSharedValue(0.92)
  const opacity  = useSharedValue(0)
  const backdrop = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      scale.value    = withSpring(1, Spring.bouncy)
      opacity.value  = withTiming(1, { duration: 180 })
      backdrop.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) })
    } else {
      scale.value    = withTiming(0.94, { duration: 140 })
      opacity.value  = withTiming(0, { duration: 140 })
      backdrop.value = withTiming(0, { duration: 160 })
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true })
    return () => sub.remove()
  }, [visible, onClose])

  const cardStyle     = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }))

  return (
    <Animated.View style={[styles.root, backdropStyle]} pointerEvents={visible ? 'auto' : 'none'}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>

      <Animated.View style={[styles.card, cardStyle]}>
        <View style={styles.specular} />

        <Text style={styles.eyebrow}>WHAT'S NEW</Text>
        <Text style={styles.title}>
          v{patch.version} <Text style={styles.titleName}>· {patch.name}</Text>
        </Text>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {patch.sections.map(sec => (
            <View key={sec.label} style={styles.section}>
              <View style={[styles.tag, { borderColor: `${KIND_COLOR[sec.label]}66` }]}>
                <Text style={[styles.tagText, { color: KIND_COLOR[sec.label] }]}>{sec.label}</Text>
              </View>
              {sec.items.map((it, i) => (
                <View key={i} style={styles.item}>
                  <View style={[styles.dot, { backgroundColor: KIND_COLOR[sec.label] }]} />
                  <Text style={styles.itemText}>{it}</Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>

        <Pressable style={styles.btn} onPress={() => { haptic.success(); onClose() }}>
          <Text style={styles.btnText}>Got it</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 60, paddingHorizontal: Spacing.lg,
  },
  card: {
    width: '100%', maxWidth: 380, maxHeight: SH * 0.78,
    backgroundColor: '#1b1b20', borderRadius: Radius['2xl'], borderWidth: 1, borderColor: Colors.glassBorder,
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.lg, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 20,
  },
  specular: { position: 'absolute', top: 0, left: Spacing.xl, right: Spacing.xl, height: 1, backgroundColor: Colors.glassHighlight },
  eyebrow: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 2 },
  title: { fontFamily: FontFamily.syneBold, fontSize: FontSize['2xl'], color: Colors.text, letterSpacing: -1, marginTop: 2 },
  titleName: { color: Colors.greenPrimary },
  scroll: { marginTop: Spacing.lg },
  section: { marginBottom: Spacing.lg, gap: Spacing.sm },
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  tagText: { fontFamily: FontFamily.monoMedium, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  item: { flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.sm },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 6 },
  itemText: { flex: 1, fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: FontSize.sm * 1.5 },
  btn: { marginTop: Spacing.md, backgroundColor: Colors.greenPrimary, borderRadius: Radius.full, paddingVertical: Spacing.md, alignItems: 'center' },
  btnText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.md, color: Colors.background },
})
