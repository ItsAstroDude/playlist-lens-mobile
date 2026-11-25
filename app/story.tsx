import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, Pressable, BackHandler, ActivityIndicator, useWindowDimensions } from 'react-native'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, cancelAnimation, Easing, runOnJS, type SharedValue,
} from 'react-native-reanimated'
import { FontFamily, Spacing } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { Icon } from '@/components/ui/Icon'
import { Aurora, RollingNumber, RackFocus, useMotionReduced } from '@/components/motion'
import { KineticText } from '@/components/motion/KineticText'
import { ArtThumb } from '@/components/ui'
import { ShareCard, CARD_W, CARD_H } from '@/components/story/ShareCard'
import { FitHeadline } from '@/components/story/FitHeadline'
import { StoryMosaic, StoryClock, StorySongs, StoryCardPreview, StoryTime, StoryHero, StoryPyramid, previewMaxH } from '@/components/story/Visuals'
import { useArtwork } from '@/hooks/useArtwork'
import { usePalette } from '@/hooks/usePalette'
import { buildStory, slideSongs, cardLine, type Palette } from '@/utils/story'
import { storyAsync, type StoryData, type StoryKind } from '@/utils/storyData'
import { showToast } from '@/utils/dialog'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { saveImageToFolder } from '@/utils/saveImage'
import { useStoryMusic } from '@/hooks/useStoryMusic'
import { artistHref, songHref } from '@/utils/itemStats'

const SLIDE_MS = 5200

const LOADING_PALETTE: Palette = ['#6a2bd9', '#ff70a5', '#ffb347', '#b39dff']
/** Cover size on cover slides: big, but leaves room for a three-line title. */
const artSize = (SW: number, SH: number) => Math.min(Math.round(SW * 0.62), Math.round(SH * 0.3), 280)

/**
 * Motion #6 — Story mode. Your week / month / year as full-screen slides: progress bars,
 * tap right for next and left for back, hold to pause. Words rise line by line, numbers
 * roll, and the aurora behind changes colour with every slide.
 *
 * Phase 4: any period — /story?kind=week|month|year|all&back=N (N periods ago; 0 = so
 * far) — covers, top-5 lists, a listening-clock slide, and a share card at the end.
 * The data comes off the UI thread (a year or all time is real work).
 */
export default function StoryScreen() {
  const insets = useSafeAreaInsets()
  // The live window: the Flip's cover screen is a different shape from the main one.
  const { width: SW, height: SH } = useWindowDimensions()
  const reduced = useMotionReduced()
  const params = useLocalSearchParams<{ kind?: string; back?: string }>()
  const kind: StoryKind = params.kind === 'month' || params.kind === 'year' || params.kind === 'all' ? params.kind : 'week'
  const back = Math.max(0, Math.floor(Number(params.back) || 0))
  const [data, setData] = useState<StoryData | null>(null)
  useEffect(() => {
    let alive = true
    storyAsync(kind, back).then(d => { if (alive) setData(d) }, () => { if (alive) router.back() })
    return () => { alive = false }
  }, [kind, back])
  const slides = useMemo(
    () => (data ? buildStory(data.comparison, { all: data.all, past: data.past, newArtists: data.newArtists, hourTracks: data.hourTracks, dayTracks: data.dayTracks }) : null),
    [data],
  )

  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const prog = useSharedValue(0)
  const idx = useSharedValue(0)
  const remaining = useRef(SLIDE_MS)

  const close = useCallback(() => { haptic.light(); router.back() }, [])
  const count = slides?.length ?? 0
  const go = useCallback((n: number) => {
    if (n < 0) n = 0
    if (n >= count) { close(); return }
    haptic.light()
    setI(n)
  }, [count])

  const run = useCallback((ms: number) => {
    prog.value = withTiming(1, { duration: ms, easing: Easing.linear }, done => { if (done) runOnJS(go)(idx.value + 1) })
  }, [go])

  useEffect(() => {
    if (!slides) return                       // still loading: no timer yet
    idx.value = i
    cancelAnimation(prog)
    remaining.current = SLIDE_MS
    // Reduce motion: no timer — each slide waits for a tap (its bar shows full).
    if (reduced) { prog.value = 1; return }
    prog.value = 0
    run(SLIDE_MS)
  }, [i, reduced, slides])

  const pause = () => { if (reduced) return; cancelAnimation(prog); remaining.current = SLIDE_MS * (1 - prog.value); setPaused(true); music.pause() }
  const resume = () => { if (!paused) return; setPaused(false); run(remaining.current); music.resume() }

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true })
    return () => sub.remove()
  }, [])

  // ── Share card ──
  const card = useRef<View>(null)
  const [sharing, setSharing] = useState<null | 'share' | 'save'>(null)
  /** Make the card image, then share it or save it to the user's folder. */
  const cardAction = useCallback(async (action: 'share' | 'save') => {
    if (sharing || !data) return
    haptic.medium()
    // Hold the slide timer (and the music) while a sheet or folder picker is up.
    cancelAnimation(prog)
    remaining.current = SLIDE_MS * (1 - prog.value)
    music.pause()
    setSharing(action)
    try {
      const uri = await captureRef(card, { format: 'png', quality: 1, width: CARD_W * 3, height: CARD_H * 3 })
      if (action === 'share') {
        if (!(await Sharing.isAvailableAsync())) { showToast('Sharing isn’t available on this phone', 'alert-circle-outline'); return }
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your story' })
      } else {
        const name = `playlist-lens-${data.all ? 'all-time' : data.comparison.current.kind}-${new Date().toISOString().slice(0, 10)}`
        const r = await saveImageToFolder(uri, name)
        if (r === 'saved') { haptic.success(); showToast('Card saved', 'checkmark-circle') }
        else if (r === 'unsupported') await Sharing.shareAsync(uri, { mimeType: 'image/png' })
      }
    } catch {
      showToast(action === 'save' ? 'Couldn’t save the card — try again' : 'Couldn’t make the card — try again', 'alert-circle-outline')
    } finally {
      setSharing(null)
      music.resume()
      if (!reduced) run(Math.max(remaining.current, 1500))
    }
  }, [sharing, data, reduced, run])

  // Cover slides take their colours from the cover (like the Now Playing sheet).
  const artSlide = slides?.[i]?.art ?? slides?.[i]?.hero
  const coverUrl = useArtwork(artSlide?.kind ?? null, artSlide?.name, artSlide?.artist)
  const { palettes, extract } = usePalette()
  const palKey = coverUrl ? `story-${coverUrl}` : null
  useEffect(() => { if (palKey && coverUrl) extract(palKey, coverUrl) }, [palKey])
  const pal = palKey ? palettes[palKey] : undefined
  const coverPalette: Palette | null = artSlide && pal ? [pal.primary, pal.secondary, pal.detail, pal.background] : null

  // ── Share card: colours from your #1 song's cover (or the story's), and one line
  //    about you at the bottom. ──
  const topSong = data?.comparison.current.topTracks[0]
  const topCover = useArtwork(topSong ? 'track' : null, topSong?.name, topSong?.sub)
  const cardPal = usePalette()
  const cardPalKey = topCover ? `story-${topCover}` : null
  useEffect(() => { if (cardPalKey && topCover) cardPal.extract(cardPalKey, topCover) }, [cardPalKey])
  const coverColours = cardPalKey ? cardPal.palettes[cardPalKey] : undefined
  const [useCoverColours, setUseCoverColours] = useState(true)
  const line = useMemo(() => (data ? cardLine(data.comparison, { all: data.all, newArtists: data.newArtists }) : ''), [data])

  // ── Music: a 30-second preview under every slide (see slideSongs) ──
  const music = useStoryMusic(slides && data ? slideSongs(
    slides,
    data.comparison.current.topTracks,
    Math.floor(data.comparison.current.start / 86_400_000),
  ) : null, i)

  // ── Your page for this slide's artist or song (2.0.43) ──
  // Its own button, so a tap anywhere else still moves between slides. The story holds
  // (timer and music) while you're away and carries on when you come back.
  const away = useRef(false)
  const openPage = useCallback((href: ReturnType<typeof artistHref> | ReturnType<typeof songHref>) => {
    haptic.light()
    cancelAnimation(prog)
    remaining.current = SLIDE_MS * (1 - prog.value)
    music.pause()
    away.current = true
    router.push(href)
  }, [music])
  useFocusEffect(useCallback(() => {
    if (!away.current) return
    away.current = false
    music.resume()
    if (!reduced) run(Math.max(remaining.current, 1500))
  }, [music, reduced, run]))

  if (!slides || !data) {
    return (
      <View style={styles.root}>
        <Aurora colors={LOADING_PALETTE} style={StyleSheet.absoluteFill} dim={0.34} />
        <View style={[styles.top, { paddingTop: insets.top + Spacing.sm }]}>
          <View style={styles.topRow}>
            <Text style={styles.brand}>playlist<Text style={{ color: '#fff' }}>.</Text>lens</Text>
            <Pressable onPress={close} hitSlop={12} style={styles.close} accessibilityRole="button" accessibilityLabel="Close story">
              <Icon name="close" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>
        <View style={styles.loading}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.sub}>Getting your story ready…</Text>
        </View>
      </View>
    )
  }

  const s = slides[i]
  const cardPalette: Palette = useCoverColours && coverColours
    ? [coverColours.primary, coverColours.secondary, coverColours.detail, coverColours.background]
    : s.palette
  // The artist or song this slide is about (not albums: they have no page).
  const about = s.hero ?? s.art
  const pageHref = !about ? null
    : about.kind === 'artist' ? artistHref(about.name)
    : about.kind === 'track' && about.artist ? songHref(about.name, about.artist)
    : null
  const hasVisual = !!(s.hero || s.list || s.bars || s.compare || s.chips || s.mosaic || s.pyramid || s.clock || s.share)
  return (
    <View style={styles.root}>
      <Aurora colors={coverPalette ?? s.palette} style={StyleSheet.absoluteFill} dim={0.34} />

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={e => go(e.nativeEvent.locationX < SW / 3 ? i - 1 : i + 1)}
        onLongPress={pause} delayLongPress={180} onPressOut={resume}
        accessibilityRole="button"
        accessibilityLabel={`Slide ${i + 1} of ${slides.length}. Tap for the next slide.`}
      />

      <View style={[styles.top, { paddingTop: insets.top + Spacing.sm }]} pointerEvents="box-none">
        <View style={styles.bars} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: slides.length, now: i + 1 }}>
          {slides.map((_, k) => <Bar key={k} k={k} idx={idx} prog={prog} />)}
        </View>
        <View style={styles.topRow} pointerEvents="box-none">
          <Text style={styles.brand}>playlist<Text style={{ color: '#fff' }}>.</Text>lens</Text>
          <View style={styles.topBtns}>
            <Pressable onPress={music.toggle} hitSlop={10} style={styles.close} accessibilityRole="button"
              accessibilityLabel={music.on ? 'Mute the music' : 'Play music'}>
              <Icon name={music.on ? 'volume-high' : 'volume-mute'} size={21} color="#fff" />
            </Pressable>
            <Pressable onPress={close} hitSlop={12} style={styles.close} accessibilityRole="button" accessibilityLabel="Close story">
              <Icon name="close" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Slides with a picture: the words up top, the picture filling the space below.
          Cover slides keep the cover-and-words centred; the rest stay centred too. */}
      <View
        style={[
          styles.body,
          s.art && styles.bodyArt,
          hasVisual && !s.art && [styles.bodySplit, { paddingTop: insets.top + 92, paddingBottom: insets.bottom + (s.share ? 158 : 44) }],
        ]}
        pointerEvents="none" key={s.id} accessibilityLiveRegion="polite"
      >
        {s.art ? (
          // Cover slides: the cover big and centred, the words centred under it.
          <RackFocus index={0} style={styles.artWrap}>
            <ArtThumb kind={s.art.kind} name={s.art.name} artist={s.art.artist} size={artSize(SW, SH)} />
          </RackFocus>
        ) : null}
        <KineticText text={s.kicker} style={styles.kicker} stagger={60} containerStyle={s.art ? styles.center : undefined} />
        {!s.big ? null : s.roll
          ? <RollingNumber value={s.big} style={styles.big} unitStyle={styles.bigUnit} stagger={90} />
          : <FitHeadline text={s.big} style={styles.big} delay={260} stagger={110} containerStyle={s.art ? styles.center : undefined} />}
        {s.sub ? <KineticText text={s.sub} style={styles.sub} delay={700} stagger={40} containerStyle={s.art ? styles.center : undefined} /> : null}

        {hasVisual && !s.art ? (
          <View style={[styles.visual, (s.bars || s.compare || s.chips) && styles.visualTop]}>
            {s.hero ? <StoryHero slide={s} />
              : (s.bars || s.compare || s.chips) ? <StoryTime slide={s} />
              : s.mosaic ? <StoryMosaic items={s.mosaic} />
              : s.pyramid ? <StoryPyramid items={s.pyramid} />
              : s.clock ? (
                <View>
                  <StoryClock clock={s.clock} compact={!!s.songs} />
                  {s.songs ? <StorySongs songs={s.songs} /> : null}
                </View>
              )
              : s.share ? <StoryCardPreview s={data.comparison.current} all={data.all} palette={cardPalette} line={line} maxHeight={previewMaxH(SH)} />
              : null}
          </View>
        ) : null}
      </View>

      {pageHref && (
        <Pressable
          onPress={() => openPage(pageHref)} hitSlop={8}
          style={[styles.pageChip, { top: insets.top + 54 }]}
          accessibilityRole="link" accessibilityLabel={`Open your page for ${about!.name}`}
        >
          <Icon name={about!.kind === 'artist' ? 'person' : 'musical-note'} size={13} color="#fff" />
          <Text style={styles.colourText}>Your page</Text>
          <Icon name="chevron-forward" size={12} color="#fff" />
        </Pressable>
      )}
      {s.share && coverColours && (
        <Pressable
          onPress={() => { haptic.light(); setUseCoverColours(v => !v) }}
          style={[styles.colourChip, { bottom: insets.bottom + 112 }]}
          accessibilityRole="switch" accessibilityState={{ checked: useCoverColours }}
          accessibilityLabel="Card colours from your top song's cover"
        >
          <Icon name="color-palette-outline" size={14} color="#fff" />
          <Text style={styles.colourText}>{useCoverColours ? 'Cover colours' : 'Story colours'}</Text>
        </Pressable>
      )}
      {music.now && !paused && (
        <View style={[styles.nowPlaying, { bottom: insets.bottom + 18 }]} pointerEvents="none" accessible
          accessibilityLabel={`Playing ${music.now.name}${music.now.artist ? ` by ${music.now.artist}` : ''}`}>
          <Icon name="musical-notes" size={13} color="#fff" />
          <Text style={styles.nowText} numberOfLines={1}>
            {music.now.name}{music.now.artist ? <Text style={styles.nowArtist}>  ·  {music.now.artist}</Text> : null}
          </Text>
        </View>
      )}
      {s.share && (
        <View style={[styles.cardBtns, { bottom: insets.bottom + 56 }]}>
          <Pressable
            onPress={() => cardAction('save')} disabled={!!sharing}
            style={[styles.shareBtn, styles.saveBtn]}
            accessibilityRole="button" accessibilityLabel="Save your story card to a folder"
          >
            {sharing === 'save' ? <ActivityIndicator color="#fff" /> : <Icon name="download-outline" size={18} color="#fff" />}
            <Text style={[styles.shareText, { color: '#fff' }]}>Save</Text>
          </Pressable>
          <Pressable
            onPress={() => cardAction('share')} disabled={!!sharing}
            style={styles.shareBtn}
            accessibilityRole="button" accessibilityLabel="Share your story card"
          >
            {sharing === 'share' ? <ActivityIndicator color="#0d0b14" /> : <Icon name="share-outline" size={18} color="#0d0b14" />}
            <Text style={styles.shareText}>Share</Text>
          </Pressable>
        </View>
      )}
      {/* Off-screen, captured on Share. */}
      {s.share && (
        <View style={styles.offscreen} pointerEvents="none">
          <ShareCard ref={card} s={data.comparison.current} all={data.all} palette={cardPalette} line={line} />
        </View>
      )}

      {paused && <Text style={[styles.paused, { bottom: insets.bottom + 28 }]}>paused · let go to continue</Text>}
      {reduced && !paused && <Text style={[styles.paused, { bottom: insets.bottom + 28 }]}>tap to go on</Text>}
    </View>
  )
}

function Bar({ k, idx, prog }: { k: number; idx: SharedValue<number>; prog: SharedValue<number> }) {
  const a = useAnimatedStyle(() => ({ width: `${(k < idx.value ? 1 : k === idx.value ? prog.value : 0) * 100}%` }))
  return <View style={styles.bar}><Animated.View style={[styles.barFill, a]} /></View>
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0d0b14' },
  top:     { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: Spacing.lg, gap: Spacing.md },
  bars:    { flexDirection: 'row', gap: 4 },
  bar:     { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  topRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand:   { fontFamily: FontFamily.syneBold, fontSize: 16, color: 'rgba(255,255,255,0.85)', letterSpacing: -0.5 },
  close:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body:    { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.md },
  bodyArt: { alignItems: 'center' },
  bodySplit: { justifyContent: 'flex-start' },
  visual:  { flex: 1, justifyContent: 'center', marginTop: Spacing.lg },
  visualTop: { justifyContent: 'flex-start', marginTop: Spacing.xl },
  artWrap: {
    marginBottom: Spacing.md, borderRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 28, shadowOffset: { width: 0, height: 16 }, elevation: 18,
  },
  center:  { justifyContent: 'center' },
  kicker:  { fontFamily: FontFamily.mono, fontSize: 16, color: 'rgba(255,255,255,0.86)' },
  big:     { fontFamily: FontFamily.syneBold, fontSize: 46, lineHeight: 52, color: '#fff', letterSpacing: -1.5 },
  bigUnit: { fontFamily: FontFamily.syneBold, fontSize: 26, color: 'rgba(255,255,255,0.8)', marginBottom: 6 },
  sub:     { fontFamily: FontFamily.mono, fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.86)' },
  paused:  { position: 'absolute', alignSelf: 'center', fontFamily: FontFamily.mono, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  cardBtns:  { position: 'absolute', alignSelf: 'center', flexDirection: 'row', gap: Spacing.md },
  shareBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 22, height: 46, borderRadius: 23, backgroundColor: '#fff',
  },
  saveBtn:   { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  topBtns:   { flexDirection: 'row', alignItems: 'center' },
  colourChip: {
    position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  pageChip: {
    position: 'absolute', right: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  colourText: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: '#fff' },
  nowPlaying: {
    position: 'absolute', left: Spacing.xl, right: Spacing.xl, flexDirection: 'row', alignItems: 'center', gap: 6,
    justifyContent: 'center',
  },
  nowText:   { fontFamily: FontFamily.monoMedium, fontSize: 12, color: '#fff', flexShrink: 1 },
  nowArtist: { fontFamily: FontFamily.mono, color: 'rgba(255,255,255,0.7)' },
  shareText: { fontFamily: FontFamily.monoMedium, fontSize: 14, color: '#0d0b14' },
  offscreen: { position: 'absolute', left: -CARD_W * 3, top: 0 },
})
