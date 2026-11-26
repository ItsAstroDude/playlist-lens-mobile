import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { FitHeadline } from './FitHeadline'
import { FontFamily, Spacing } from '@/constants/theme'
import { RackFocus } from '@/components/motion'
import { ArtThumb } from '@/components/ui'
import { ShareCard, CARD_W, CARD_H } from './ShareCard'
import { fmtListen, type StorySlide, type Palette } from '@/utils/story'
import type { PeriodSummary } from '@/utils/listening'
import { useLiveWindow } from '@/utils/liveWindow'

/**
 * Story mode's pictures (2.0.13): each slide fills the space under its words with
 * something to look at — the period's bars, this-vs-before, a wall of covers, the
 * day's clock, a preview of the share card. They enter with the rack-focus motion.
 */

const PAD = Spacing.xl

/** Sizes from the live window (the Flip's cover screen is about half the main one). */
function useStorySize() {
  const { width: SW, height: SH } = useLiveWindow()
  return { SW, SH, INNER: SW - PAD * 2 }
}

/** The period's bars, the biggest one solid and labelled. */
export function StoryBars({ bars, height }: { bars: NonNullable<StorySlide['bars']>; height?: number }) {
  const { SH } = useStorySize()
  const max = Math.max(...bars.values, 1)
  const many = bars.values.length > 14
  return (
    <RackFocus index={1} step={120}>
      {bars.peakText ? <Text style={styles.peakCaption}>{bars.peakText}</Text> : null}
      <View style={[styles.barsRow, { height: height ?? Math.min(280, SH * 0.32) }]} accessible accessibilityLabel={bars.peakText ?? 'Listening across the period; the biggest is highlighted'}>
        {bars.values.map((v, i) => (
          <View key={i} style={styles.barCol}>
            <View style={[styles.bar, {
              height: `${Math.max(3, (v / max) * 100)}%`,
              opacity: i === bars.peak ? 1 : 0.38,
              borderRadius: many ? 2 : 6,
            }]}>
              {/* the peak's value sits right on top of its bar (unless the caption says it) */}
              {i === bars.peak && !bars.peakText && <Text style={styles.peakTag} numberOfLines={1}>{fmtListen(v)}</Text>}
            </View>
          </View>
        ))}
      </View>
      {/* Each label centred under its own bar, 32 pt wide — a month's 30 thin bars
          can't each hold "29" in their own width (it showed as "…"). */}
      <View style={styles.barLabelRow}>
        {bars.labels.map((l, i) => (l ? (
          <Text
            key={i}
            style={[styles.barLabelAbs, { left: `${((i + 0.5) / bars.labels.length) * 100}%` }, i === bars.peak && styles.barLabelPeak]}
            numberOfLines={1}
          >{l}</Text>
        ) : null))}
      </View>
    </RackFocus>
  )
}

/** A grid of covers, three across — as many rows as fit the space (measured). */
export function StoryMosaic({ items }: { items: NonNullable<StorySlide['mosaic']> }) {
  const { INNER } = useStorySize()
  const cols = 3
  const gap = Spacing.sm
  const size = Math.floor((INNER - gap * (cols - 1)) / cols)
  const [boxH, setBoxH] = useState(0)
  const rows = boxH ? Math.max(1, Math.floor((boxH + gap) / (size + gap))) : 0
  return (
    <View style={styles.mosaicBox} onLayout={e => setBoxH(e.nativeEvent.layout.height)}>
      <View style={[styles.mosaic, { gap }]}>
        {items.slice(0, rows * cols).map((m, k) => (
          <RackFocus key={m.name + k} index={k + 1} step={60}>
            <ArtThumb kind={m.kind} name={m.name} artist={m.artist} size={size} />
          </RackFocus>
        ))}
      </View>
    </View>
  )
}

/** A few songs under a title — what you play at your peak hour. */
export function StorySongs({ songs, start = 2 }: { songs: NonNullable<StorySlide['songs']>; start?: number }) {
  return (
    <View style={styles.songs}>
      <Text style={styles.songsTitle}>{songs.title}</Text>
      {songs.items.map((t, k) => (
        <RackFocus key={t.name + k} index={start + k} step={90}>
          <View style={styles.songRow}>
            <ArtThumb kind="track" name={t.name} artist={t.artist} size={48} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowName} numberOfLines={1}>{t.name}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>{t.artist}</Text>
            </View>
            <Text style={styles.rowValue}>{t.plays}×</Text>
          </View>
        </RackFocus>
      ))}
    </View>
  )
}

/** A day's soundtrack: three compact rows — cover, the whole name, artist, plays. */
function SongStrip({ songs }: { songs: NonNullable<StorySlide['songs']> }) {
  return (
    <RackFocus index={4} step={140}>
      <Text style={styles.songsTitle}>{songs.title}</Text>
      {songs.items.slice(0, 3).map((t, k) => (
        <View key={t.name + k} style={styles.compactRow}>
          <ArtThumb kind="track" name={t.name} artist={t.artist} size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.compactName} numberOfLines={1}>{t.name}</Text>
            <Text style={styles.rowSub} numberOfLines={1}>{t.artist}</Text>
          </View>
          <Text style={styles.rowValue}>{t.plays}×</Text>
        </View>
      ))}
    </RackFocus>
  )
}

/** The listening clock, big: 24 bars with hour marks. */
export function StoryClock({ clock, compact }: { clock: number[]; compact?: boolean }) {
  const { SH } = useStorySize()
  const max = Math.max(...clock, 1)
  const peak = clock.indexOf(max)
  return (
    <RackFocus index={1} step={120}>
      <View style={[styles.clockRow, { height: compact ? Math.min(170, SH * 0.19) : Math.min(240, SH * 0.28) }]}>
        {clock.map((v, h) => (
          <View key={h} style={styles.barCol}>
            <View style={[styles.bar, { height: `${Math.max(3, (v / max) * 100)}%`, opacity: h === peak ? 1 : 0.38, borderRadius: 3 }]} />
          </View>
        ))}
      </View>
      <View style={styles.barLabels}>
        {['00', '06', '12', '18', '23'].map(l => <Text key={l} style={styles.clockMark}>{l}</Text>)}
      </View>
    </RackFocus>
  )
}

/** The share card itself, scaled to the free space — what you'd send. */
export function StoryCardPreview({ s, all, palette, maxHeight, line }: { s: PeriodSummary; all: boolean; palette: Palette; maxHeight: number; line?: string }) {
  const { INNER } = useStorySize()
  const scale = Math.min(INNER / CARD_W, maxHeight / CARD_H, 1)
  return (
    <RackFocus index={1} step={120} style={{ alignSelf: 'center' }}>
      <View style={[styles.preview, { width: CARD_W * scale, height: CARD_H * scale }]}>
        <View style={{ width: CARD_W, height: CARD_H, transform: [{ scale }], transformOrigin: 'top left' }}>
          <ShareCard s={s} all={all} palette={palette} line={line} />
        </View>
      </View>
    </RackFocus>
  )
}

/**
 * The time slide's lower half: the period's bars (biggest picked out), this vs before
 * as two slim bars, and a row of small numbers.
 */
export function StoryTime({ slide }: { slide: StorySlide }) {
  const { SH } = useStorySize()
  return (
    <View style={styles.timeStack}>
      {slide.bars ? <StoryBars bars={slide.bars} height={slide.songs ? Math.min(130, SH * 0.15) : Math.min(200, SH * 0.22)} /> : null}
      {slide.compare ? (
        <RackFocus index={2} step={140} style={styles.slimCompare}>
          {[
            { label: slide.compare.nowLabel, ms: slide.compare.now, strong: true },
            { label: slide.compare.beforeLabel, ms: slide.compare.before, strong: false },
          ].map((r, k, arr) => {
            const max = Math.max(arr[0].ms, arr[1].ms, 1)
            return (
              <View key={k} style={styles.slimRow}>
                <View style={styles.slimHead}>
                  <Text style={styles.slimLabel} numberOfLines={1}>{r.label}</Text>
                  <Text style={styles.slimValue}>{fmtListen(r.ms)}</Text>
                </View>
                <View style={styles.slimTrack}>
                  <View style={[styles.slimFill, { width: `${Math.max(3, (r.ms / max) * 100)}%`, opacity: r.strong ? 1 : 0.42 }]} />
                </View>
              </View>
            )
          })}
        </RackFocus>
      ) : null}
      {slide.chips?.length ? (
        <RackFocus index={3} step={140} style={styles.chips}>
          {slide.chips.map(c => (
            <View key={c.label} style={styles.chip}>
              <Text style={styles.chipValue} numberOfLines={1} adjustsFontSizeToFit>{c.value}</Text>
              <Text style={styles.chipLabel} numberOfLines={2}>{c.label}</Text>
            </View>
          ))}
        </RackFocus>
      ) : null}
      {slide.songs ? <SongStrip songs={slide.songs} /> : null}
    </View>
  )
}

const ROW_H = 58

/**
 * #1 big — cover, name, numbers — then the runners-up as rows, as many as fit the
 * space that's left (measured), so a tall phone shows more.
 */
export function StoryHero({ slide }: { slide: StorySlide }) {
  const h = slide.hero!
  const { SW, SH } = useStorySize()
  const [listH, setListH] = useState(0)
  const rows = (slide.list ?? []).slice(0, listH ? Math.max(0, Math.floor(listH / ROW_H)) : 0)
  const size = Math.min(Math.round(SW * 0.44), Math.round(SH * 0.24), 184)
  return (
    <View style={styles.heroWrap}>
      <RackFocus index={0} style={styles.heroCover}>
        <ArtThumb kind={h.kind} name={h.name} artist={h.artist} size={size} />
      </RackFocus>
      <FitHeadline text={h.name} style={styles.heroName} maxLines={2} delay={200} stagger={90} containerStyle={styles.centerRow} />
      <Text style={styles.heroMeta} numberOfLines={1}>{h.meta}</Text>
      <View style={styles.heroList} onLayout={e => setListH(e.nativeEvent.layout.height)}>
        {rows.map((r, k) => (
          <RackFocus key={r.name + k} index={k + 2} step={80}>
            <View style={styles.row}>
              <Text style={styles.rowRank}>{k + 2}</Text>
              {slide.listKind ? <ArtThumb kind={slide.listKind} name={r.name} artist={r.sub} size={44} /> : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowName} numberOfLines={1}>{r.name}</Text>
                {r.sub ? <Text style={styles.rowSub} numberOfLines={1}>{r.sub}</Text> : null}
              </View>
              <Text style={styles.rowValue}>{r.value}</Text>
            </View>
          </RackFocus>
        ))}
      </View>
    </View>
  )
}

const PYRAMID = [1, 2, 3, 4]
const PYRAMID_SIZE = [128, 92, 74, 62]

/** Artists in rows of 1, 2, 3, 4 — biggest first — each with its name; scaled to fit. */
export function StoryPyramid({ items }: { items: NonNullable<StorySlide['pyramid']> }) {
  const { INNER } = useStorySize()
  const [boxH, setBoxH] = useState(0)
  const rows: { name: string; value: string }[][] = []
  let i = 0
  for (const n of PYRAMID) { if (i >= items.length) break; rows.push(items.slice(i, i + n)); i += n }
  // Natural height: circles + a name line (+ time on the first row) + gaps.
  const natural = rows.reduce((a, r, k) => a + PYRAMID_SIZE[k] + (k === 0 ? 40 : 22), 0) + (rows.length - 1) * Spacing.md
  const scale = boxH ? Math.min(1, boxH / natural) : 1
  return (
    <View style={styles.pyramidBox} onLayout={e => setBoxH(e.nativeEvent.layout.height)}>
      {boxH > 0 && rows.map((row, k) => {
        const size = Math.floor(Math.min(PYRAMID_SIZE[k] * scale, (INNER - Spacing.md * (row.length - 1)) / row.length))
        return (
          <View key={k} style={[styles.pyramidRow, { gap: Spacing.md }]}>
            {row.map((a, j) => (
              <RackFocus key={a.name} index={k * 2 + j} step={70} style={{ width: Math.max(size, 64), alignItems: 'center' }}>
                <ArtThumb kind="artist" name={a.name} size={size} />
                <Text style={[styles.pyrName, k === 0 && [styles.pyrNameTop, { maxWidth: INNER }]]} numberOfLines={1}>{a.name}</Text>
                {k === 0 ? <Text style={styles.pyrValue}>{a.value}</Text> : null}
              </RackFocus>
            ))}
          </View>
        )
      })}
    </View>
  )
}

/** Room for a card preview between the words and the Share button. */
export const previewMaxH = (windowHeight: number) => Math.round(windowHeight * 0.4)

const styles = StyleSheet.create({
  timeStack:    { gap: Spacing.md },
  peakCaption:  { fontFamily: FontFamily.monoMedium, fontSize: 13, color: '#fff', marginBottom: 8 },
  slimCompare:  { gap: Spacing.sm },
  slimRow:      { gap: 5 },
  slimHead:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  slimLabel:    { fontFamily: FontFamily.mono, fontSize: 12, color: 'rgba(255,255,255,0.8)', flexShrink: 1 },
  slimValue:    { fontFamily: FontFamily.syneBold, fontSize: 15, color: '#fff' },
  slimTrack:    { height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  slimFill:     { height: '100%', borderRadius: 7, backgroundColor: '#fff' },
  chips:        { flexDirection: 'row', gap: Spacing.sm },
  chip:         { flex: 1, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  chipValue:    { fontFamily: FontFamily.syneBold, fontSize: 20, color: '#fff', letterSpacing: -0.5 },
  chipLabel:    { fontFamily: FontFamily.mono, fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  heroWrap:     { flex: 1, alignItems: 'center' },
  heroCover:    {
    marginBottom: Spacing.md, borderRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 16,
  },
  heroName:     { fontFamily: FontFamily.syneBold, fontSize: 34, lineHeight: 39, color: '#fff', letterSpacing: -1, textAlign: 'center' },
  heroMeta:     { fontFamily: FontFamily.mono, fontSize: 13, color: 'rgba(255,255,255,0.86)', marginTop: 4 },
  centerRow:    { justifyContent: 'center' },
  heroList:     { flex: 1, alignSelf: 'stretch', marginTop: Spacing.lg, overflow: 'hidden' },
  row:          { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, height: ROW_H },
  rowRank:      { fontFamily: FontFamily.syneBold, fontSize: 18, color: 'rgba(255,255,255,0.6)', width: 26 },
  rowName:      { fontFamily: FontFamily.syneBold, fontSize: 17, lineHeight: 21, color: '#fff', letterSpacing: -0.4 },
  rowSub:       { fontFamily: FontFamily.mono, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  rowValue:     { fontFamily: FontFamily.mono, fontSize: 13, color: 'rgba(255,255,255,0.86)' },
  pyramidBox:   { flex: 1, justifyContent: 'center', gap: Spacing.md },
  pyramidRow:   { flexDirection: 'row', justifyContent: 'center' },
  pyrName:      { fontFamily: FontFamily.monoMedium, fontSize: 11, color: '#fff', marginTop: 6, maxWidth: 110, textAlign: 'center' },
  pyrNameTop:   { fontFamily: FontFamily.syneBold, fontSize: 17, letterSpacing: -0.4 },
  pyrValue:     { fontFamily: FontFamily.mono, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  barsRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  clockRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barCol:       { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar:          { width: '100%', backgroundColor: '#fff' },
  peakTag:      { position: 'absolute', bottom: '100%', left: '50%', width: 80, marginLeft: -40, marginBottom: 6, textAlign: 'center', fontFamily: FontFamily.monoMedium, fontSize: 12, color: '#fff' },
  barLabels:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  barLabelRow:  { height: 16, marginTop: 6 },
  barLabelAbs:  { position: 'absolute', top: 0, width: 32, marginLeft: -16, textAlign: 'center', fontFamily: FontFamily.mono, fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  compactRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, height: 48 },
  compactName:  { fontFamily: FontFamily.syneBold, fontSize: 15, lineHeight: 19, color: '#fff', letterSpacing: -0.3 },
  barLabel:     { flex: 1, textAlign: 'center', fontFamily: FontFamily.mono, fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  barLabelPeak: { color: '#fff', fontFamily: FontFamily.monoMedium },
  clockMark:    { fontFamily: FontFamily.mono, fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  mosaic:       { flexDirection: 'row', flexWrap: 'wrap' },
  mosaicBox:    { flex: 1, justifyContent: 'center' },
  songs:        { gap: 6, marginTop: Spacing.lg },
  songsTitle:   { fontFamily: FontFamily.monoMedium, fontSize: 13, color: '#fff', marginBottom: 6 },
  songRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, height: 56 },
  preview:      {
    borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 16,
  },
})
