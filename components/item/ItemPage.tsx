import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Linking, Pressable } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getColors } from 'react-native-image-colors'
import { Colors, FontFamily, FontSize, Radius, Spacing, Type, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { AmbientBackground } from '@/components/ui/AmbientBackground'
import { BackButton, BACK_BUTTON_SIZE } from '@/components/ui/BackButton'
import { useIsCover } from '@/hooks/useScreen'
import { Card, ListRow, RankRow, ArtThumb, Button, EmptyState, Icon, type IconName } from '@/components/ui'
import { useCollapsingCover, RollingNumber, RackFocus } from '@/components/motion'
import { AddToQueueButton } from '@/components/queue/AddToQueueButton'
import { ArtworkFixSheet, type ArtworkTarget } from '@/components/wrapped/ArtworkFixSheet'
import { useArtwork } from '@/hooks/useArtwork'
import { useNowPlayingGutter } from '@/hooks/useNowPlayingGutter'
import { emitOpenStartQueue } from '@/utils/overlayEvents'
import { addManyToCart, addAllMessage, cartFull, type QueueItem } from '@/utils/queueCart'
import { showToast } from '@/utils/dialog'
import { ensureReadable } from '@/utils/color'
import { toHex } from '@/utils/liquidTint'
import { memorialFor, MEMORIAL_MARK } from '@/utils/tribute'
import { fmtHours, fmtMinutesShort } from '@/utils/wrapped'
import { localOffsetSec } from '@/utils/stats'
import { itemStatsAsync, peekItemStats, artistHref, songHref, type ItemRef, type ItemStats } from '@/utils/itemStats'

/**
 * Artist and song pages (2.0.43): your whole history with one artist or one song.
 * A cover hero that collapses as you scroll (motion #10), then what the play database
 * knows: time and plays, when you found it, listening over time, top songs, when you
 * play it, your longest run, and "Play top 10" / "Add to queue".
 */

/** Hero height below the top bar; the bar (status bar + back button row) adds to it. */
const HERO_H = 270
const HERO_H_COVER = 112
const BAR_H = 52
const COVER = 156
const COVER_SMALL = 92
/** How far the hero's glow runs on past it, fading out. */
const GLOW_TAIL = 140
const DAY_MS = 86_400_000
const WEEKDAY_NAME = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const WEEKDAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const TOP_N = 10

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}
function tDate(t: number): string {
  return new Date(t * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
function dayDate(day: number, weekday = false): string {
  return new Date(day * DAY_MS).toLocaleDateString(undefined, {
    ...(weekday ? { weekday: 'short' as const } : {}), day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}
function monthYear(t: number): string {
  return new Date(t * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}
/** "today", "yesterday", "3 days ago", "in March 2024". */
function ago(t: number, now = Date.now()): string {
  const days = Math.floor((now / 1000 - t) / 86_400)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return `in ${new Date(t * 1000).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
}
function hourLabel(h: number): string {
  const ap = h < 12 ? 'am' : 'pm'
  const n = h % 12 === 0 ? 12 : h % 12
  return `${n}${ap}`
}

/**
 * Two colours from the cover: a readable accent (buttons, numbers, bars) and a deeper
 * glow for the hero's backdrop. Fall back to the app accent.
 */
function useCoverColours(url: string | null, fallback: string): { accent: string; glow: string } {
  const [c, setC] = useState<{ accent: string; glow: string } | null>(null)
  useEffect(() => {
    setC(null)
    if (!url) return
    let alive = true
    getColors(url, { fallback, cache: true, key: url })
      .then(r => {
        if (!alive) return
        const [a, g] = r.platform === 'android' ? [r.vibrant ?? r.dominant, r.darkVibrant ?? r.dominant ?? r.average]
          : r.platform === 'ios' ? [r.primary ?? r.detail, r.background ?? r.secondary]
          : r.platform === 'web' ? [r.vibrant ?? r.dominant, r.darkVibrant ?? r.dominant] : [null, null]
        const accent = toHex(a)
        if (accent) setC({ accent: ensureReadable(accent), glow: toHex(g) ?? accent })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [url, fallback])
  return c ?? { accent: fallback, glow: fallback }
}

export function ItemPage({ item }: { item: ItemRef }) {
  const insets = useSafeAreaInsets()
  const gutter = useNowPlayingGutter()
  const isArtist = item.kind === 'artist'
  const name = isArtist ? item.artist : item.track
  const artKind = isArtist ? 'artist' : 'track'
  const fetched = useArtwork(artKind, name, isArtist ? undefined : item.artist)
  const [override, setOverride] = useState<string | null>(null)
  const art = override ?? fetched
  const baseAccent = isArtist ? Colors.greenPrimary : Colors.pink
  const { accent, glow } = useCoverColours(art, baseAccent)
  const [fixOpen, setFixOpen] = useState(false)
  // The Flip's cover screen (474×524 dp) gets a short hero: the cover beside the title.
  const cover = useIsCover()
  const barH = insets.top + BAR_H
  const heroH = (cover ? HERO_H_COVER : HERO_H) + barH
  const cc = useCollapsingCover(heroH)

  // Off the UI thread: a rank means grouping every play.
  const off = useMemo(() => localOffsetSec(), [])
  // A page seen before (and no play since) opens on its numbers, no spinner.
  const [stats, setStats] = useState<ItemStats | null>(() => peekItemStats(item, off))
  const [failed, setFailed] = useState(false)
  const key = isArtist ? item.artist : `${item.track}\u0000${item.artist}`
  useEffect(() => {
    let alive = true
    setStats(peekItemStats(item, off)); setFailed(false); setOverride(null)
    itemStatsAsync(item, off).then(s => { if (alive) setStats(s) }, () => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [key, off])  // eslint-disable-line react-hooks/exhaustive-deps

  const mem = memorialFor(item.artist)
  const fixTarget: ArtworkTarget | null = fixOpen
    ? { kind: artKind, name, artist: isArtist ? undefined : item.artist, accent, currentArt: art }
    : null

  const subtitle = !stats || !stats.plays ? (isArtist ? null : item.artist)
    : isArtist
      ? `${stats.rank ? `Your #${stats.rank.n} artist · ` : ''}since ${monthYear(stats.first!.t)}`
      : null

  const coverArt = (size: number) => (
    <Animated.View style={[styles.coverWrap, { shadowColor: accent }, cc.cover]}>
      <Pressable onLongPress={() => { haptic.light(); setFixOpen(true) }} accessibilityLabel={`${name} cover`} accessibilityHint="Long-press to fix the picture">
        {art ? (
          <Image source={{ uri: art }} style={coverShape(size, isArtist)} contentFit="cover" transition={200} cachePolicy="memory-disk" />
        ) : (
          <LinearGradient colors={[alpha(accent, 0.4), alpha(accent, 0.08)]} style={[coverShape(size, isArtist), styles.coverEmpty]}>
            <Icon name={isArtist ? 'person' : 'musical-note'} size={Math.round(size * 0.36)} color={accent} />
          </LinearGradient>
        )}
      </Pressable>
    </Animated.View>
  )
  const info = (
    <Animated.View style={[cover ? styles.heroInfoSide : styles.heroInfo, cc.title]}>
      <Text style={styles.kind}>{isArtist ? 'ARTIST' : 'SONG'}</Text>
      <Text style={[styles.name, cover && styles.nameSide]} numberOfLines={2} accessibilityRole="header">{name}</Text>
      {!isArtist ? (
        <Pressable onPress={() => { haptic.light(); router.push(artistHref(item.artist)) }} hitSlop={6} accessibilityRole="link" accessibilityLabel={`Open ${item.artist}`}>
          <Text style={[styles.sub, cover && styles.left, { color: accent }]} numberOfLines={1}>
            {item.artist}{stats?.album ? <Text style={styles.subMuted}>{`  ·  ${stats.album}`}</Text> : null}
          </Text>
        </Pressable>
      ) : subtitle ? <Text style={[styles.sub, cover && styles.left]} numberOfLines={1}>{subtitle}</Text> : null}
      {mem ? <Text style={styles.memorial}>{`${MEMORIAL_MARK}  in memory · ${mem.years}`}</Text> : null}
    </Animated.View>
  )

  return (
    <View style={styles.container}>
      <AmbientBackground />
      <Animated.ScrollView
        onScroll={cc.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        // The cover screen keeps the last card above the cameras (as the lens sheet does).
        contentContainerStyle={{ paddingBottom: cover ? 150 : insets.bottom + Spacing['4xl'] + gutter }}
      >
        {/* ── Hero (collapses as you scroll); runs up under the status bar and back button ── */}
        <View style={[styles.hero, { height: heroH, paddingTop: barH }]}>
          {/* A glow in the cover's colours that fades out to nothing, past the hero and
              under the first cards, so there's no edge where the hero ends (2.0.46: a
              blurred copy of the cover ended in a hard line above the buttons). */}
          <Animated.View style={[styles.glow, { height: heroH + GLOW_TAIL }, cc.backdrop]} pointerEvents="none">
            <LinearGradient
              colors={[alpha(glow, 0.7), alpha(accent, 0.3), alpha(accent, 0.1), alpha(accent, 0)]}
              locations={[0, 0.45, 0.72, 1]}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
          {cover ? (
            <View style={styles.heroRow}>{coverArt(COVER_SMALL)}{info}</View>
          ) : (
            <>{coverArt(COVER)}{info}</>
          )}
        </View>

        <View style={styles.body}>
          {failed ? (
            <EmptyState icon="alert-circle-outline" title="Couldn’t read your plays" body="Go back and open this page again." />
          ) : !stats ? (
            <View style={styles.loading}>
              <ActivityIndicator color={accent} />
              <Text style={Type.caption}>Going through your plays…</Text>
            </View>
          ) : !stats.plays ? (
            <EmptyState
              icon="musical-notes-outline"
              title={isArtist ? `No plays of ${name} yet` : 'You haven’t played this yet'}
              body="Plays from your import and from listening tracking show up here."
            />
          ) : (
            <ItemBody stats={stats} item={item} accent={accent} />
          )}
        </View>
      </Animated.ScrollView>

      {/* compact title bar on the back button's row, fades in once the hero has scrolled away */}
      <Animated.View style={[styles.miniBar, { height: barH, paddingTop: insets.top }, cc.bar]} pointerEvents="none" importantForAccessibility="no-hide-descendants">
        <Text style={styles.miniBarText} numberOfLines={1}>{name}</Text>
      </Animated.View>
      <View style={[styles.backFloat, { top: insets.top + (BAR_H - BACK_BUTTON_SIZE) / 2 }]}><BackButton /></View>

      <ArtworkFixSheet target={fixTarget} onClose={() => setFixOpen(false)} onResolved={url => setOverride(url)} />
    </View>
  )
}

function coverShape(size: number, round: boolean) {
  return { width: size, height: size, borderRadius: round ? size / 2 : Radius.xl * (size / COVER) }
}

// ─── Body ─────────────────────────────────────────────────────────────────────
function ItemBody({ stats: s, item, accent }: { stats: ItemStats; item: ItemRef; accent: string }) {
  const isArtist = item.kind === 'artist'
  const queueItems: QueueItem[] = isArtist
    ? s.topTracks.filter(t => t.uri).slice(0, TOP_N).map(t => ({ uri: t.uri!, name: t.name, artist: item.artist }))
    : s.uri ? [{ uri: s.uri, name: item.track, artist: item.artist }] : []

  const historyParams = isArtist ? { artist: item.artist } : { artist: item.artist, track: item.track }

  return (
    <View style={styles.sections}>
      {/* Actions */}
      {queueItems.length > 0 && (
        <View style={styles.actions}>
          <Button
            label={isArtist ? (queueItems.length >= TOP_N ? `Play top ${TOP_N}` : 'Play top songs') : 'Play'}
            icon="play" style={[styles.action, { backgroundColor: accent }]}
            onPress={() => emitOpenStartQueue(queueItems)}
          />
          <Button
            label="Add to queue" icon="add" variant="secondary" style={styles.action}
            onPress={() => {
              const added = addManyToCart(queueItems)
              showToast(addAllMessage(added, queueItems.length, cartFull()), added ? 'checkmark-circle' : 'information-circle-outline')
            }}
          />
        </View>
      )}

      {/* Headline numbers */}
      <View style={styles.tiles}>
        <Tile value={fmtHours(s.ms)} label="listened" accent={accent} />
        <Tile value={s.plays.toLocaleString()} label={s.plays === 1 ? 'play' : 'plays'} accent={accent} />
        <Tile value={s.days.toLocaleString()} label={s.days === 1 ? 'day' : 'days'} accent={accent} />
      </View>

      {/* The story so far */}
      <Card padded>
        <Text style={[Type.overline, styles.cardTitle]}>{isArtist ? 'you and them' : 'you and this song'}</Text>
        {s.first && (
          <Line icon="sparkles" accent={accent}
            big={isArtist ? `Found ${tDate(s.first.t)}` : `First played ${tDate(s.first.t)}`}
            sub={isArtist ? `with ${s.first.track}${s.first.album ? ` · ${s.first.album}` : ''}` : undefined}
            onPress={isArtist ? () => { haptic.light(); router.push(songHref(s.first!.track, item.artist)) } : undefined} />
        )}
        {s.last !== null && <Line icon="time" accent={accent} big={`Last played ${ago(s.last)}`} />}
        {s.rank && (
          <Line icon="trophy" accent={accent}
            big={`#${s.rank.n.toLocaleString()} of ${plural(s.rank.of, isArtist ? 'artist' : 'song')}`}
            sub={`${isArtist ? 'by time listened' : 'by plays'} · ${pctLabel(s.share)} of all your listening`} />
        )}
        {isArtist && s.trackCount > 1 && <Line icon="musical-notes" accent={accent} big={`${plural(s.trackCount, 'song')} of theirs`} sub="that you’ve played" />}
      </Card>

      {/* Over time */}
      {s.series && s.series.ms.length > 1 && <OverTime series={s.series} accent={accent} />}

      {/* Top songs (artist) */}
      {isArtist && s.topTracks.length > 0 && (
        <Card padded>
          <Text style={[Type.overline, styles.cardTitle]}>your top songs · by plays</Text>
          {s.topTracks.slice(0, TOP_N).map((t, i) => (
            <RackFocus key={t.name} index={Math.min(i, 8)} step={70} settle>
              <RankRow rank={i + 1} name={t.name} value={`${t.plays}×`} frac={t.plays / (s.topTracks[0].plays || 1)} color={accent}
                leading={<ArtThumb kind="track" name={t.name} artist={item.artist} />}
                onPress={() => { haptic.light(); router.push(songHref(t.name, item.artist)) }}
                trailing={t.uri ? <AddToQueueButton item={{ uri: t.uri, name: t.name, artist: item.artist }} /> : undefined} />
            </RackFocus>
          ))}
        </Card>
      )}

      {/* Top albums (artist) */}
      {isArtist && s.topAlbums.length > 1 && (
        <Card padded>
          <Text style={[Type.overline, styles.cardTitle]}>albums · by time</Text>
          {s.topAlbums.map((a, i) => (
            <RankRow key={a.name} rank={i + 1} name={a.name} value={fmtHours(a.ms)} frac={a.ms / (s.topAlbums[0].ms || 1)} color={Colors.lavender}
              leading={<ArtThumb kind="album" name={a.name} artist={item.artist} />}
              onPress={() => { haptic.light(); router.push({ pathname: '/history', params: { album: a.name, artist: item.artist } }) }} />
          ))}
        </Card>
      )}

      {/* When you play it */}
      {s.clock.some(v => v > 0) && <WhenCard clock={s.clock} weekdays={s.weekdays} accent={accent} them={isArtist} />}

      {/* Runs and big days */}
      {(s.longestRun || s.biggestDay) && (
        <Card padded>
          <Text style={[Type.overline, styles.cardTitle]}>runs</Text>
          {s.longestRun && s.longestRun.length >= 2 && (
            <Line icon="flame" accent={accent}
              big={`${plural(s.longestRun.length, 'day')} in a row`}
              sub={`Your longest run · ${dayDate(s.longestRun.startDay)} – ${dayDate(s.longestRun.endDay)}`} />
          )}
          {s.biggestDay && (
            <Line icon={isArtist ? 'calendar' : 'repeat'} accent={accent}
              big={isArtist ? `${fmtMinutesShort(s.biggestDay.ms)} in one day` : `${plural(s.biggestDay.plays, 'play')} in one day`}
              sub={`${isArtist ? 'Your biggest day' : 'On repeat'} · ${dayDate(s.biggestDay.day, true)}`}
              onPress={() => { haptic.light(); router.push({ pathname: '/history', params: { ...historyParams, day: String(s.biggestDay!.day) } }) }} />
          )}
        </Card>
      )}

      {/* Every play */}
      <Card>
        <ListRow icon="list" label={isArtist ? `Every play of ${item.artist}` : 'Every play of this song'}
          hint={`${plural(s.plays, 'play')}, newest first, in History`}
          onPress={() => { haptic.light(); router.push({ pathname: '/history', params: historyParams }) }}
          last={isArtist || !s.uri} />
        {!isArtist && s.uri && (
          <ListRow icon="open-outline" label="Open in Spotify" last
            onPress={() => { haptic.light(); Linking.openURL(s.uri!).catch(() => {}) }} />
        )}
      </Card>
    </View>
  )
}

function pctLabel(share: number): string {
  const p = share * 100
  if (p <= 0) return '0%'
  if (p < 0.1) return '<0.1%'
  return `${p < 10 ? p.toFixed(1) : Math.round(p)}%`
}

// ─── Pieces ───────────────────────────────────────────────────────────────────
function Tile({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${value} ${label}`}>
      <RollingNumber value={value} style={[styles.tileValue, { color: accent }]} />
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  )
}

function Line({ icon, big, sub, accent, onPress }: { icon: IconName; big: string; sub?: string; accent: string; onPress?: () => void }) {
  const body = (
    <View style={styles.line}>
      <View style={[styles.lineIcon, { backgroundColor: alpha(accent, 0.12) }]}><Icon name={icon} size={15} color={accent} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.lineBig} numberOfLines={2}>{big}</Text>
        {sub ? <Text style={Type.caption} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {onPress ? <Icon name="chevron-forward" size={14} color={Colors.textMuted} /> : null}
    </View>
  )
  return onPress
    ? <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed} accessibilityRole="button" accessibilityLabel={`${big}${sub ? `, ${sub}` : ''}`}>{body}</Pressable>
    : body
}

const OverTime = React.memo(function OverTime({ series, accent }: { series: NonNullable<ItemStats['series']>; accent: string }) {
  const max = Math.max(...series.ms, 1)
  const n = series.ms.length
  const peakLabel = series.labels[series.peak]
  return (
    <Card padded>
      <Text style={[Type.overline, styles.cardTitle]}>over time · by {series.unit}</Text>
      <View style={styles.bars} accessible accessibilityLabel={`Listening by ${series.unit}; the biggest was ${peakLabel}`}>
        {series.ms.map((ms, i) => (
          <View key={i} style={styles.barCol}>
            <View style={[styles.bar, {
              height: `${ms > 0 ? Math.max(4, (ms / max) * 100) : 0}%`,
              backgroundColor: i === series.peak ? accent : alpha(accent, 0.38),
            }]} />
          </View>
        ))}
      </View>
      <View style={styles.barLabels}>
        <Text style={styles.axis}>{series.labels[0]}</Text>
        {n > 2 ? <Text style={styles.axis}>{series.labels[Math.floor((n - 1) / 2)]}</Text> : null}
        <Text style={styles.axis}>{series.labels[n - 1]}</Text>
      </View>
      <Text style={styles.peak}>Biggest {series.unit}: <Text style={{ color: accent }}>{peakLabel}</Text> · {fmtMinutesShort(series.ms[series.peak])}</Text>
    </Card>
  )
})

const WhenCard = React.memo(function WhenCard({ clock, weekdays, accent, them }: { clock: number[]; weekdays: number[]; accent: string; them: boolean }) {
  const maxH = Math.max(...clock, 1), peakH = clock.indexOf(maxH)
  const maxD = Math.max(...weekdays, 1), peakD = weekdays.indexOf(maxD)
  return (
    <Card padded>
      <Text style={[Type.overline, styles.cardTitle]}>{them ? 'when you play them' : 'when you play it'}</Text>
      <View style={styles.bars} accessible accessibilityLabel={`Listening clock; most often around ${hourLabel(peakH)}`}>
        {clock.map((ms, h) => (
          <View key={h} style={styles.barCol}>
            <View style={[styles.bar, { height: `${Math.max(3, (ms / maxH) * 100)}%`, backgroundColor: h === peakH ? accent : alpha(accent, 0.35) }]} />
          </View>
        ))}
      </View>
      <View style={styles.barLabels}>
        <Text style={styles.axis}>12am</Text><Text style={styles.axis}>6am</Text><Text style={styles.axis}>12pm</Text><Text style={styles.axis}>6pm</Text><Text style={styles.axis}>11pm</Text>
      </View>
      <View style={styles.weekRow} accessible accessibilityLabel={`Most often on ${WEEKDAY_NAME[peakD]}s`}>
        {weekdays.map((ms, d) => (
          <View key={d} style={styles.weekCell}>
            <View style={[styles.weekDot, {
              backgroundColor: alpha(accent, 0.12 + 0.88 * (ms / maxD)),
              borderColor: d === peakD ? accent : 'transparent',
            }]} />
            <Text style={[styles.axis, d === peakD && { color: accent }]}>{WEEKDAY_SHORT[d]}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.peak}>Mostly around <Text style={{ color: accent }}>{hourLabel(peakH)}</Text>, and on <Text style={{ color: accent }}>{WEEKDAY_NAME[peakD]}s</Text></Text>
    </Card>
  )
})

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  backFloat: { position: 'absolute', left: Spacing.lg, zIndex: 3 },

  hero:      { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: Spacing.lg },
  glow:      { position: 'absolute', top: 0, left: 0, right: 0 },
  heroRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, alignSelf: 'stretch', paddingHorizontal: Spacing.lg },
  coverWrap: {
    shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.55, shadowRadius: 26, elevation: 16,
  },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  heroInfo:  { alignItems: 'center', paddingHorizontal: Spacing.xl, gap: 2, marginTop: Spacing.lg },
  heroInfoSide: { flex: 1, minWidth: 0, gap: 2 },
  nameSide:  { fontSize: FontSize.xl, textAlign: 'left' },
  left:      { textAlign: 'left' },
  kind:      { ...Type.overline, color: Colors.textSecondary },
  name:      { fontFamily: FontFamily.syneBold, fontSize: FontSize['2xl'], color: Colors.text, letterSpacing: -1, textAlign: 'center' },
  sub:       { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  subMuted:  { fontFamily: FontFamily.mono, color: Colors.textMuted },
  memorial:  { ...Type.caption, marginTop: Spacing.xs, letterSpacing: 0.5 },

  miniBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
    paddingHorizontal: Spacing.lg + BACK_BUTTON_SIZE + Spacing.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: alpha(Colors.background, 0.96), borderBottomWidth: 1, borderBottomColor: Colors.glassBorder,
  },
  miniBarText: { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: Colors.text, letterSpacing: -0.3 },

  body:      { paddingHorizontal: Spacing.lg },
  sections:  { gap: Spacing.md },
  loading:   { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing['3xl'] },
  actions:   { flexDirection: 'row', gap: Spacing.sm },
  action:    { flex: 1 },

  tiles:     { flexDirection: 'row', gap: Spacing.sm },
  tile: {
    flex: 1, alignItems: 'center', gap: 2, paddingVertical: Spacing.md,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.lg,
  },
  tileValue: { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, letterSpacing: -0.8 },
  tileLabel: { ...Type.caption, textTransform: 'uppercase', letterSpacing: 1 },

  cardTitle: { marginBottom: Spacing.sm },
  line:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  lineIcon:  { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  lineBig:   { ...Type.label, color: Colors.text },
  pressed:   { opacity: 0.6 },

  bars:      { flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 2 },
  barCol:    { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar:       { width: '100%', borderRadius: 2 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axis:      { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.textMuted },
  peak:      { ...Type.caption, marginTop: Spacing.sm },
  weekRow:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
  weekCell:  { alignItems: 'center', gap: 4 },
  weekDot:   { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5 },
})
