import React, { useEffect, useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, Pressable, Dimensions, BackHandler, Share, TouchableOpacity,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useArtwork, type ArtKind } from '@/hooks/useArtwork'
import { ArtworkFixSheet, type ArtworkTarget } from '@/components/wrapped/ArtworkFixSheet'
import { fmtMinutesShort } from '@/utils/wrapped'

const { height: SH } = Dimensions.get('window')
const SHEET_H = Math.min(560, SH * 0.66)

export interface WrappedSelection {
  kind:   ArtKind
  name:   string
  artist?: string
  rank:   number
  ms?:    number
  plays?: number
  accent: string
}

export function WrappedItemSheet({ selection, onClose }: {
  selection: WrappedSelection | null
  onClose:   () => void
}) {
  const isOpen = selection !== null
  const fetched = useArtwork(selection?.kind ?? null, selection?.name, selection?.artist)
  const [override, setOverride] = useState<string | null>(null)
  const [fixOpen, setFixOpen]   = useState(false)
  const art = override ?? fetched

  // A new item wipes any in-session override (the picked image is persisted in
  // the cache, so useArtwork re-reads it for that specific item anyway).
  useEffect(() => { setOverride(null) }, [selection?.kind, selection?.name, selection?.artist])

  const translateY = useSharedValue(SHEET_H)
  const backdrop   = useSharedValue(0)

  useEffect(() => {
    if (isOpen) {
      translateY.value = withSpring(0, Spring.sheet)
      backdrop.value   = withTiming(1, { duration: 240, easing: Easing.out(Easing.ease) })
    } else {
      translateY.value = withSpring(SHEET_H, Spring.sheet)
      backdrop.value   = withTiming(0, { duration: 180 })
    }
  }, [isOpen])

  const dismiss = useCallback(() => { haptic.light(); onClose() }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { dismiss(); return true })
    return () => sub.remove()
  }, [isOpen, dismiss])

  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }))

  const onShare = useCallback(async () => {
    if (!selection) return
    haptic.light()
    const parts = [
      `My #${selection.rank} ${selection.kind} on playlist.lens:`,
      selection.artist ? `${selection.name} — ${selection.artist}` : selection.name,
      selection.ms != null ? fmtMinutesShort(selection.ms) : null,
      selection.plays != null ? `${selection.plays.toLocaleString()} plays` : null,
    ].filter(Boolean)
    await Share.share({ message: parts.join('  ·  ') })
  }, [selection])

  const onWrongImage = useCallback(() => { haptic.light(); setFixOpen(true) }, [])

  const fixTarget: ArtworkTarget | null = fixOpen && selection
    ? { kind: selection.kind, name: selection.name, artist: selection.artist, accent: selection.accent, currentArt: art }
    : null

  const accent = selection?.accent ?? Colors.greenPrimary
  const initial = (selection?.name ?? '?').trim().charAt(0).toUpperCase()
  const kindLabel = selection ? selection.kind.toUpperCase() : ''

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents={isOpen ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetStyle]} pointerEvents={isOpen ? 'auto' : 'none'}>
        <View style={styles.handle} />

        {/* Artwork */}
        <View style={[styles.artWrap, { shadowColor: accent }]}>
          {art ? (
            <Image source={{ uri: art }} style={styles.art} contentFit="cover" transition={200} />
          ) : (
            <LinearGradient colors={[`${accent}55`, `${accent}11`]} style={styles.art}>
              <Text style={[styles.initial, { color: accent }]}>{initial}</Text>
            </LinearGradient>
          )}
          <View style={[styles.rankBadge, { borderColor: `${accent}66` }]}>
            <Text style={[styles.rankText, { color: accent }]}>#{selection?.rank}</Text>
          </View>
        </View>

        {/* Name */}
        <Text style={styles.kind}>{kindLabel}</Text>
        <Text style={styles.name} numberOfLines={2}>{selection?.name}</Text>
        {selection?.artist ? <Text style={styles.artist} numberOfLines={1}>{selection.artist}</Text> : null}

        {/* Stats */}
        <View style={styles.statRow}>
          {selection?.ms != null && (
            <View style={styles.statChip}>
              <Text style={[styles.statVal, { color: accent }]}>{fmtMinutesShort(selection.ms)}</Text>
              <Text style={styles.statLbl}>listened</Text>
            </View>
          )}
          {selection?.plays != null && (
            <View style={styles.statChip}>
              <Text style={[styles.statVal, { color: accent }]}>{selection.plays.toLocaleString()}</Text>
              <Text style={styles.statLbl}>plays</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={[styles.shareBtn, { backgroundColor: accent }]} onPress={onShare} activeOpacity={0.85}>
          <Text style={styles.shareText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.reportBtn} onPress={onWrongImage} activeOpacity={0.6} hitSlop={8}>
          <Text style={styles.reportText}>{art ? 'Wrong image? Fix it' : 'Set a cover'}</Text>
        </TouchableOpacity>
      </Animated.View>

      <ArtworkFixSheet
        target={fixTarget}
        onClose={() => setFixOpen(false)}
        onResolved={url => setOverride(url)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 20 },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: SHEET_H,
    backgroundColor: Colors.sheet, borderTopLeftRadius: Radius['2xl'], borderTopRightRadius: Radius['2xl'],
    borderTopWidth: 1, borderColor: Colors.glassBorder, zIndex: 21,
    alignItems: 'center', paddingTop: Spacing.sm, paddingHorizontal: Spacing.xl,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.glassBorder, marginBottom: Spacing.lg },
  artWrap: {
    width: 168, height: 168, borderRadius: Radius.xl, overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 14,
  },
  art: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: FontFamily.syneBold, fontSize: 72 },
  rankBadge: {
    position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  rankText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs },
  kind: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 2, marginTop: Spacing.lg },
  name: { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: Colors.text, textAlign: 'center', letterSpacing: -0.5, marginTop: 2 },
  artist: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  statRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  statChip: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, alignItems: 'center', minWidth: 110 },
  statVal: { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, letterSpacing: -0.5 },
  statLbl: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  shareBtn: { marginTop: Spacing.xl, borderRadius: Radius.full, paddingVertical: Spacing.md, paddingHorizontal: Spacing['3xl'], alignItems: 'center', minWidth: 200 },
  shareText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.md, color: Colors.background },
  reportBtn: { marginTop: Spacing.md, paddingVertical: Spacing.xs },
  reportText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textDim, textDecorationLine: 'underline' },
})
