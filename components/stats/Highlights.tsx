import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Colors, FontFamily, FontSize, Spacing, Radius, Type, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { Card, Chip, RankRow, Icon, ArtThumb, type IconName } from '@/components/ui'
import { fmtHours, fmtMinutesShort } from '@/utils/wrapped'
import { emitOpenStartQueue } from '@/utils/overlayEvents'
import { artistHref } from '@/utils/itemStats'
import { addManyToCart, addAllMessage, cartFull, type QueueItem } from '@/utils/queueCart'
import { showToast } from '@/utils/dialog'
import {
  milestoneTitle, type NewToYou, type OnThisDayYear, type Streaks, type Milestone, type NextMilestone,
} from '@/utils/highlights'

/**
 * Phase 3 highlights for Wrapped: new to you (a period), on this day (the week view),
 * streaks and milestones (all time). Pure presentation — the numbers come from
 * utils/highlights.
 */

const DAY_MS = 86_400_000
const PERIOD_WORD: Record<string, string> = { week: 'week', month: 'month', year: 'year' }

function dayDate(day: number, withYear = true): string {
  return new Date(day * DAY_MS).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
  })
}
function tDate(t: number): string {
  return new Date(t * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}

// ─── New to you ───────────────────────────────────────────────────────────────
export function NewToYouCard({ kind, n }: { kind: string; n: NewToYou }) {
  const max = n.topArtists[0]?.ms || 1
  return (
    <Card padded>
      <Text style={[Type.overline, styles.title]}>new to you</Text>
      <Text style={styles.lead}>
        {plural(n.artists, 'artist')} and {plural(n.tracks, 'song')} you’d never played before this {PERIOD_WORD[kind] ?? kind}.
      </Text>
      {n.topArtists.map((a, i) => (
        <RankRow key={a.name} rank={i + 1} name={a.name} value={fmtMinutesShort(a.ms)} frac={a.ms / max} color={Colors.lavender}
          leading={<ArtThumb kind="artist" name={a.name} />}
          onPress={() => { haptic.light(); router.push(artistHref(a.name)) }} />
      ))}
    </Card>
  )
}

// ─── On this day ──────────────────────────────────────────────────────────────
export function OnThisDayCard({ years }: { years: OnThisDayYear[] }) {
  return (
    <Card padded>
      <Text style={[Type.overline, styles.title]}>on this day</Text>
      {years.slice(0, 3).map((y, idx) => {
        const items: QueueItem[] = y.tracks.filter(t => t.uri).map(t => ({ uri: t.uri!, name: t.name, artist: t.artist }))
        const ago = new Date().getFullYear() - y.year
        return (
          <View key={y.year} style={[styles.otdYear, idx > 0 && styles.otdDivider]}>
            <View style={styles.otdHead}>
              <Text style={styles.otdYearText}>{ago === 1 ? 'A year ago' : `${ago} years ago`}</Text>
              <Text style={Type.caption}>{y.year} · {plural(y.plays, 'play')} · {fmtMinutesShort(y.ms)}</Text>
            </View>
            {y.tracks.slice(0, 3).map(t => (
              <Text key={t.name + t.artist} style={styles.otdTrack} numberOfLines={1}>
                {t.name}<Text style={styles.otdArtist}>  {t.artist}{t.plays > 1 ? `  ×${t.plays}` : ''}</Text>
              </Text>
            ))}
            {items.length > 0 && (
              <View style={styles.actions}>
                <Chip label="Play these" icon="play" onPress={() => { haptic.medium(); emitOpenStartQueue(items) }} />
                <Chip label="Add to queue" icon="add" onPress={() => {
                  const added = addManyToCart(items)
                  showToast(addAllMessage(added, items.length, cartFull()), added ? 'checkmark-circle' : 'information-circle-outline')
                }} />
              </View>
            )}
          </View>
        )
      })}
    </Card>
  )
}

// ─── Streaks ──────────────────────────────────────────────────────────────────
function StatLine({ icon, big, label, sub }: { icon: IconName; big: string; label: string; sub?: string }) {
  return (
    <View style={styles.statLine}>
      <View style={styles.statIcon}><Icon name={icon} size={16} color={Colors.greenPrimary} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.statText} numberOfLines={2}><Text style={styles.statBig}>{big}</Text>  {label}</Text>
        {sub ? <Text style={Type.caption} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </View>
  )
}

export function StreaksCard({ s }: { s: Streaks }) {
  if (!s.longest) return null
  return (
    <Card padded>
      <Text style={[Type.overline, styles.title]}>streaks</Text>
      <StatLine icon="flame" big={plural(s.current, 'day')} label="in a row with music, right now"
        sub={s.current ? undefined : 'Play something today to start one'} />
      <StatLine icon="trophy" big={plural(s.longest.length, 'day')} label="your longest streak"
        sub={`${dayDate(s.longest.startDay)} – ${dayDate(s.longest.endDay)}`} />
      {s.artistBest && s.artistBest.length >= 2 && (
        <StatLine icon="person" big={plural(s.artistBest.length, 'day')} label={`of ${s.artistBest.artist} in a row`}
          sub={`Your longest run with one artist · ${dayDate(s.artistBest.startDay)} – ${dayDate(s.artistBest.endDay)}`} />
      )}
      {s.artistNow && (!s.artistBest || s.artistNow.artist !== s.artistBest.artist || s.artistNow.endDay !== s.artistBest.endDay) && (
        <StatLine icon="repeat" big={plural(s.artistNow.length, 'day')} label={`of ${s.artistNow.artist} and counting`} />
      )}
    </Card>
  )
}

// ─── Milestones ───────────────────────────────────────────────────────────────
const KIND_ICON: Record<Milestone['kind'], IconName> = { plays: 'play-circle', artists: 'people', hours: 'time' }

export function MilestonesCard({ reached, next }: { reached: Milestone[]; next: NextMilestone[] }) {
  if (!reached.length && !next.length) return null
  return (
    <Card padded>
      <Text style={[Type.overline, styles.title]}>milestones</Text>
      {next.map(n => (
        <View key={n.kind} style={styles.next}>
          <View style={styles.nextHead}>
            <Text style={styles.nextLabel}>Next: {milestoneTitle(n)}</Text>
            <Text style={Type.caption}>
              {n.kind === 'hours' ? `${fmtHours((n.n - n.have) * 3_600_000)} to go` : `${(n.n - n.have).toLocaleString()} to go`}
            </Text>
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(2, Math.min(1, n.progress) * 100)}%` }]} /></View>
        </View>
      ))}
      {reached.slice(0, 6).map(m => (
        <StatLine key={m.kind + m.n} icon={KIND_ICON[m.kind]} big={milestoneTitle(m)} label={`· ${tDate(m.t)}`}
          sub={m.kind === 'artists' ? `${m.artist}${m.track ? ` — ${m.track}` : ''}` : [m.track, m.artist].filter(Boolean).join(' — ')} />
      ))}
    </Card>
  )
}

const styles = StyleSheet.create({
  title:       { marginBottom: Spacing.sm },
  lead:        { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: FontSize.sm * 1.5, marginBottom: Spacing.sm },
  otdYear:     { gap: 4, paddingVertical: Spacing.sm },
  otdDivider:  { borderTopWidth: 1, borderTopColor: Colors.glassBorder },
  otdHead:     { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm, marginBottom: 2 },
  otdYearText: { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: Colors.text },
  otdTrack:    { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.text },
  otdArtist:   { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  actions:     { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, flexWrap: 'wrap' },
  statLine:    { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: 6 },
  statIcon:    { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(Colors.greenPrimary, 0.12) },
  statText:    { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary },
  statBig:     { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: Colors.text },
  next:        { gap: 6, marginBottom: Spacing.md },
  nextHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  nextLabel:   { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.text },
  track:       { height: 4, borderRadius: 2, backgroundColor: alpha(Colors.greenPrimary, 0.15), overflow: 'hidden' },
  fill:        { height: 4, borderRadius: 2, backgroundColor: Colors.greenPrimary },
})
