import React, { forwardRef } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { FontFamily } from '@/constants/theme'
import { ArtThumb } from '@/components/ui/ArtThumb'
import { periodTitle, type PeriodSummary } from '@/utils/listening'
import { fmtListen, type Palette } from '@/utils/story'

/** The share card's size in layout points; captured at 3× = 1080 × 1920 (a story). */
export const CARD_W = 360
export const CARD_H = 640

/**
 * Story mode's share card (2.0.15 redesign): the period as a poster — your #1 song's
 * cover big, three numbers, your top artists' photos and your next songs with covers.
 * Plain views, a gradient and expo-image covers (no Skia), so react-native-view-shot
 * captures it reliably. Rendered off-screen for the capture, and scaled as a preview
 * on the last slide.
 */
export const ShareCard = forwardRef<View, { s: PeriodSummary; all: boolean; palette: Palette }>(
  function ShareCard({ s, all, palette }, ref) {
    const label = all ? 'All time' : periodTitle(s)
    const kicker = all ? 'Everything I’ve played' : `My ${s.kind} in music`
    const top = s.topTracks[0]
    const artists = s.topArtists.slice(0, 5)
    const more = s.topTracks.slice(1, 5)
    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        <LinearGradient colors={[palette[0], palette[1], '#0d0b14']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.veil} />

        <View style={styles.head}>
          <Text style={styles.brand}>playlist<Text style={{ color: palette[2] }}>.</Text>lens</Text>
          <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
            <Text style={styles.kicker} numberOfLines={1}>{kicker}</Text>
            <Text style={styles.label} numberOfLines={1}>{label}</Text>
          </View>
        </View>

        {top && (
          <View style={styles.hero}>
            <View style={styles.heroCover}><ArtThumb kind="track" name={top.name} artist={top.sub} size={128} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.cap}>On repeat</Text>
              <Text style={styles.heroName} numberOfLines={3}>{top.name}</Text>
              {top.sub ? <Text style={styles.meta} numberOfLines={1}>{top.sub}</Text> : null}
              <Text style={styles.meta}>{top.plays.toLocaleString()} plays</Text>
            </View>
          </View>
        )}

        <View style={styles.tiles}>
          {[
            { v: fmtListen(s.ms), l: 'listened' },
            { v: s.plays.toLocaleString(), l: 'plays' },
            { v: s.artists.toLocaleString(), l: 'artists' },
          ].map(t => (
            <View key={t.l} style={styles.tile}>
              <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{t.v}</Text>
              <Text style={styles.tileLabel}>{t.l}</Text>
            </View>
          ))}
        </View>

        {artists.length > 0 && (
          <View>
            <Text style={styles.cap}>Top artists</Text>
            <View style={styles.artists}>
              {artists.map(a => (
                <View key={a.name} style={styles.artist}>
                  <ArtThumb kind="artist" name={a.name} size={54} />
                  <Text style={styles.artistName} numberOfLines={1}>{a.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {more.length > 0 && (
          <View style={{ gap: 7 }}>
            <Text style={styles.cap}>Top songs</Text>
            {more.map((t, i) => (
              <View key={t.name + i} style={styles.song}>
                <Text style={styles.rank}>{i + 2}</Text>
                <ArtThumb kind="track" name={t.name} artist={t.sub} size={34} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.songName} numberOfLines={1}>{t.name}</Text>
                  {t.sub ? <Text style={styles.songArtist} numberOfLines={1}>{t.sub}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    )
  },
)

const styles = StyleSheet.create({
  card:       { width: CARD_W, height: CARD_H, paddingHorizontal: 24, paddingVertical: 26, gap: 18, overflow: 'hidden', backgroundColor: '#0d0b14' },
  veil:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,6,14,0.3)' },
  head:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  brand:      { fontFamily: FontFamily.syneBold, fontSize: 15, color: 'rgba(255,255,255,0.92)', letterSpacing: -0.5 },
  kicker:     { fontFamily: FontFamily.mono, fontSize: 10, color: 'rgba(255,255,255,0.75)' },
  label:      { fontFamily: FontFamily.syneBold, fontSize: 14, color: '#fff', letterSpacing: -0.3 },
  hero:       { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroCover:  { borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  cap:        { fontFamily: FontFamily.mono, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', marginBottom: 6 },
  heroName:   { fontFamily: FontFamily.syneBold, fontSize: 21, lineHeight: 25, color: '#fff', letterSpacing: -0.6 },
  meta:       { fontFamily: FontFamily.mono, fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  tiles:      { flexDirection: 'row', gap: 8 },
  tile:       { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  tileValue:  { fontFamily: FontFamily.syneBold, fontSize: 19, color: '#fff', letterSpacing: -0.5 },
  tileLabel:  { fontFamily: FontFamily.mono, fontSize: 10, color: 'rgba(255,255,255,0.75)' },
  artists:    { flexDirection: 'row', justifyContent: 'space-between' },
  artist:     { width: 58, alignItems: 'center', gap: 4 },
  artistName: { fontFamily: FontFamily.monoMedium, fontSize: 9, color: '#fff', maxWidth: 62, textAlign: 'center' },
  song:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank:       { fontFamily: FontFamily.syneBold, fontSize: 13, color: 'rgba(255,255,255,0.55)', width: 14 },
  songName:   { fontFamily: FontFamily.syneBold, fontSize: 13, color: '#fff', letterSpacing: -0.3 },
  songArtist: { fontFamily: FontFamily.mono, fontSize: 10, color: 'rgba(255,255,255,0.75)' },
})
