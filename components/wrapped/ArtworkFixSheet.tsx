import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, Pressable, Dimensions, BackHandler, Alert,
  TextInput, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import {
  fetchArtworkCandidates, setArtworkOverride, reportWrongArtwork,
  type ArtKind, type ArtCandidate,
} from '@/hooks/useArtwork'

const { width: W, height: SH } = Dimensions.get('window')
const SHEET_H = Math.min(620, SH * 0.82)
const GRID_PAD = Spacing.xl
const COLS = 3
const GAP = Spacing.sm
const CELL = Math.floor((W - GRID_PAD * 2 - GAP * (COLS - 1)) / COLS)

export interface ArtworkTarget {
  kind:       ArtKind
  name:       string
  artist?:    string
  accent:     string
  currentArt: string | null
}

export function ArtworkFixSheet({ target, onClose, onResolved }: {
  target:     ArtworkTarget | null
  onClose:    () => void
  onResolved: (url: string) => void
}) {
  const isOpen = target !== null
  const insets = useSafeAreaInsets()
  // Clear the floating navbar pill (height ~62, sits at insets.bottom + ~28).
  const navClearance = insets.bottom + 92
  const [term, setTerm]       = useState('')
  const [items, setItems]     = useState<ArtCandidate[]>([])
  const [loading, setLoading] = useState(false)

  const translateY = useSharedValue(SHEET_H)
  const backdrop   = useSharedValue(0)

  const runSearch = useCallback(async (t?: string) => {
    if (!target) return
    setLoading(true)
    const res = await fetchArtworkCandidates(target.kind, target.name, target.artist, t)
    setItems(res)
    setLoading(false)
  }, [target])

  // Open / close + initial fetch
  useEffect(() => {
    if (isOpen && target) {
      const initial = target.kind === 'artist' ? target.name : `${target.name} ${target.artist ?? ''}`.trim()
      setTerm(initial)
      setItems([])
      runSearch() // default query
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

  const onPick = useCallback((url: string) => {
    if (!target) return
    haptic.success()
    setArtworkOverride(target.kind, target.name, target.artist, url)
    onResolved(url)
    onClose()
  }, [target, onResolved, onClose])

  const onUpload = useCallback(async () => {
    if (!target) return
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted && perm.canAskAgain === false) {
        Alert.alert('Photo access needed', 'Enable photo access in system settings to use your own image.')
        return
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9,
      })
      if (res.canceled || !res.assets?.length) return
      // Copy into app storage so the override survives the picked cache being cleared.
      const dir = `${FileSystem.documentDirectory}artwork/`
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {})
      const dest = `${dir}${Date.now()}.jpg`
      await FileSystem.copyAsync({ from: res.assets[0].uri, to: dest })
      onPick(dest)
    } catch {
      Alert.alert('Couldn’t use that image', 'Something went wrong reading the photo. Try another.')
    }
  }, [target, onPick])

  const onReport = useCallback(() => {
    if (!target) return
    haptic.warning()
    reportWrongArtwork(target.kind, target.name, target.artist, target.currentArt)
    Alert.alert('Thanks for the flag', 'We logged this one. We’ll use these reports to improve matching in an update.')
    onClose()
  }, [target, onClose])

  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }))
  const accent = target?.accent ?? Colors.greenPrimary

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents={isOpen ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetStyle]} pointerEvents={isOpen ? 'auto' : 'none'}>
        <View style={styles.handle} />
        <Text style={styles.title}>Fix the cover</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {target?.name}{target?.artist ? ` — ${target.artist}` : ''}
        </Text>

        {/* Re-search */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            value={term}
            onChangeText={setTerm}
            placeholder="Search a different term…"
            placeholderTextColor={Colors.textDim}
            returnKeyType="search"
            onSubmitEditing={() => runSearch(term)}
          />
          <TouchableOpacity style={[styles.searchBtn, { borderColor: `${accent}66` }]} onPress={() => { haptic.light(); runSearch(term) }} activeOpacity={0.7}>
            <Text style={[styles.searchBtnText, { color: accent }]}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* Candidate grid */}
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={accent} /></View>
        ) : items.length === 0 ? (
          <View style={styles.center}><Text style={styles.empty}>No covers found. Try a different search, or upload your own.</Text></View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {items.map(it => (
              <TouchableOpacity key={it.id} style={styles.cell} onPress={() => onPick(it.url)} activeOpacity={0.8}>
                <Image source={{ uri: it.url }} style={styles.cellImg} contentFit="cover" transition={150} />
                <Text style={styles.cellTitle} numberOfLines={1}>{it.title}</Text>
                <Text style={styles.cellSub} numberOfLines={1}>{it.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Actions */}
        <View style={[styles.actions, { paddingBottom: navClearance }]}>
          <TouchableOpacity style={[styles.uploadBtn, { borderColor: `${accent}66` }]} onPress={onUpload} activeOpacity={0.8}>
            <Text style={[styles.uploadText, { color: accent }]}>Upload your own</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reportBtn} onPress={onReport} activeOpacity={0.6} hitSlop={6}>
            <Text style={styles.reportText}>None of these — report it</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 30 },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: SHEET_H,
    backgroundColor: Colors.sheet, borderTopLeftRadius: Radius['2xl'], borderTopRightRadius: Radius['2xl'],
    borderTopWidth: 1, borderColor: Colors.glassBorder, zIndex: 31,
    paddingTop: Spacing.sm, paddingHorizontal: GRID_PAD,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.glassBorder, marginBottom: Spacing.md },
  title: { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, color: Colors.text, letterSpacing: -0.5 },
  sub: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, marginBottom: Spacing.md },

  searchRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  input: {
    flex: 1, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.text,
  },
  searchBtn: {
    justifyContent: 'center', paddingHorizontal: Spacing.lg, borderWidth: 1,
    borderRadius: Radius.md, backgroundColor: Colors.glass,
  },
  searchBtnText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing['3xl'] },
  empty: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: Spacing.xl },

  scroll: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingBottom: Spacing.md },
  cell: { width: CELL },
  cellImg: { width: CELL, height: CELL, borderRadius: Radius.md, backgroundColor: Colors.glass },
  cellTitle: { fontFamily: FontFamily.monoMedium, fontSize: 10, color: Colors.textSecondary, marginTop: 4 },
  cellSub: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.textDim },

  actions: { paddingTop: Spacing.sm, paddingBottom: Spacing.lg, alignItems: 'center', gap: Spacing.sm },
  uploadBtn: { borderWidth: 1, borderRadius: Radius.full, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing['3xl'], backgroundColor: Colors.glass },
  uploadText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm },
  reportBtn: { paddingVertical: Spacing.xs },
  reportText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textDim, textDecorationLine: 'underline' },
})
