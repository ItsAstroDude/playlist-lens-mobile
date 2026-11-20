import React, { forwardRef } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { FontFamily } from '@/constants/theme'
import { periodTitle, type PeriodSummary } from '@/utils/listening'
import { fmtListen, type Palette } from '@/utils/story'

/** The share card's size in layout points; captured at 3× = 1080 × 1920 (a story). */
export const CARD_W = 360
export const CARD_H = 640

/**
 * Story mode's share card (2.0 Phase 4): the period on one story-sized image.
 * Plain views and a gradient — no Skia — so react-native-view-shot captures it
 * reliably. Rendered off-screen by the story screen and captured on "Share".
 */
export const ShareCard = forwardRef<View, { s: PeriodSummary; all: boolean; palette: Palette }>(
  function ShareCard({ s, all, palette }, ref) {
    const title = all ? 'All time' : periodTitle(s)
    const kicker = all ? 'Everything I’ve played' : `My ${s.kind} in music`
    const artist = s.topArtists[0], track = s.topTracks[0]
    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        <LinearGradient colors={[palette[0], palette[1], '#0d0b14']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.veil} />

        <Text style={styles.brand}>playlist<Text style={{ color: palette[2] }}>.</Text>lens</Text>

        <View style={styles.head}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
        </View>

        <View>
          <Text style={styles.label}>Listened</Text>
          <Text style={styles.big}>{fmtListen(s.ms)}</Text>
          <Text style={styles.meta}>{s.plays.toLocaleString()} plays · {s.artists.toLocaleString()} artists</Text>
        </View>

        {artist && (
          <View>
            <Text style={styles.label}>Top artist</Text>
            <Text style={styles.name} numberOfLines={1}>{artist.name}</Text>
          </View>
        )}
        {track && (
          <View>
            <Text style={styles.label}>On repeat</Text>
            <Text style={styles.name} numberOfLines={1}>{track.name}</Text>
            {track.sub ? <Text style={styles.meta} numberOfLines={1}>{track.sub}</Text> : null}
          </View>
        )}

        {s.topArtists.length > 1 && (
          <View style={styles.list}>
            {s.topArtists.slice(0, 5).map((a, i) => (
              <Text key={a.name} style={styles.row} numberOfLines={1}>
                <Text style={styles.rank}>{i + 1}  </Text>{a.name}
              </Text>
            ))}
          </View>
        )}
      </View>
    )
  },
)

const styles = StyleSheet.create({
  card:   { width: CARD_W, height: CARD_H, padding: 28, gap: 18, overflow: 'hidden', backgroundColor: '#0d0b14' },
  veil:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,6,14,0.28)' },
  brand:  { fontFamily: FontFamily.syneBold, fontSize: 15, color: 'rgba(255,255,255,0.9)', letterSpacing: -0.5 },
  head:   { gap: 2, marginTop: 6 },
  kicker: { fontFamily: FontFamily.mono, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  title:  { fontFamily: FontFamily.syneBold, fontSize: 28, lineHeight: 32, color: '#fff', letterSpacing: -1 },
  label:  { fontFamily: FontFamily.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' },
  big:    { fontFamily: FontFamily.syneBold, fontSize: 52, lineHeight: 58, color: '#fff', letterSpacing: -2 },
  name:   { fontFamily: FontFamily.syneBold, fontSize: 22, lineHeight: 27, color: '#fff', letterSpacing: -0.6 },
  meta:   { fontFamily: FontFamily.mono, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  list:   { gap: 4, marginTop: 'auto' },
  row:    { fontFamily: FontFamily.monoMedium, fontSize: 13, color: '#fff' },
  rank:   { color: 'rgba(255,255,255,0.55)' },
})
