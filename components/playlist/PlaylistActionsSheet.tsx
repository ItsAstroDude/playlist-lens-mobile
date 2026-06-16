import React, { useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, Pressable, Dimensions, BackHandler, Share, TouchableOpacity,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import type { SpotifyPlaylist } from '@/types'

const { height: SH } = Dimensions.get('window')

interface Action { glyph: string; label: string; sub?: string; onPress: () => void; tint?: string }

export function PlaylistActionsSheet({ playlist, onClose, onPin, onReanalyze, onReorder, onCompare }: {
  playlist:    SpotifyPlaylist | null
  onClose:     () => void
  onPin:       (id: string) => void
  onReanalyze: (id: string) => void
  onReorder:   () => void
  onCompare:   (id: string) => void
}) {
  const isOpen = playlist !== null
  const insets = useSafeAreaInsets()
  const translateY = useSharedValue(SH)
  const backdrop   = useSharedValue(0)

  useEffect(() => {
    if (isOpen) {
      translateY.value = withSpring(0, Spring.sheet)
      backdrop.value   = withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) })
    } else {
      translateY.value = withSpring(SH, Spring.sheet)
      backdrop.value   = withTiming(0, { duration: 160 })
    }
  }, [isOpen])

  const dismiss = useCallback(() => { haptic.light(); onClose() }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { dismiss(); return true })
    return () => sub.remove()
  }, [isOpen, dismiss])

  const run = (fn: () => void) => { fn(); onClose() }

  const onShare = async () => {
    if (!playlist) return
    haptic.light()
    const url = (playlist as any).external_urls?.spotify
    const msg = [`${playlist.name} — ${playlist.tracks.total} tracks, via playlist.lens`, url].filter(Boolean).join('\n')
    onClose()
    await Share.share({ message: msg })
  }

  const actions: Action[] = playlist ? [
    { glyph: '↑', label: 'Pin to top',     sub: 'Jump this lens to the front',     onPress: () => run(() => { haptic.success(); onPin(playlist.id) }) },
    { glyph: '↗', label: 'Share',          sub: 'Send this playlist',               onPress: onShare },
    { glyph: '↻', label: 'Re-analyze',     sub: 'Recompute from fresh data',        onPress: () => run(() => { haptic.medium(); onReanalyze(playlist.id) }) },
    { glyph: '⇆', label: 'Compare with…',  sub: 'Stack this against another lens',   onPress: () => run(() => { haptic.medium(); onCompare(playlist.id) }) },
    { glyph: '≡', label: 'Reorder lenses', sub: 'Drag to set your own order',       onPress: () => run(() => { haptic.medium(); onReorder() }) },
  ] : []

  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }))

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents={isOpen ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      <Animated.View
        style={[styles.sheet, { paddingBottom: insets.bottom + 92 }, sheetStyle]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <View style={styles.handle} />
        <Text style={styles.title} numberOfLines={1}>{playlist?.name}</Text>

        {actions.map((a, i) => (
          <TouchableOpacity key={a.label} style={[styles.row, i === actions.length - 1 && styles.rowLast]} onPress={a.onPress} activeOpacity={0.7}>
            <View style={styles.glyphWrap}><Text style={[styles.glyph, a.tint ? { color: a.tint } : null]}>{a.glyph}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{a.label}</Text>
              {a.sub ? <Text style={styles.sub}>{a.sub}</Text> : null}
            </View>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 25 },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.sheet, borderTopLeftRadius: Radius['2xl'], borderTopRightRadius: Radius['2xl'],
    borderTopWidth: 1, borderColor: Colors.glassBorder, zIndex: 26,
    paddingTop: Spacing.sm, paddingHorizontal: Spacing.lg,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.glassBorder, marginBottom: Spacing.md },
  title: { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: Colors.text, marginBottom: Spacing.sm, letterSpacing: -0.3 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder,
  },
  rowLast: { borderBottomWidth: 0 },
  glyphWrap: {
    width: 38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder,
  },
  glyph: { fontFamily: FontFamily.monoMedium, fontSize: 18, color: Colors.greenPrimary },
  label: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.text },
  sub: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
})
