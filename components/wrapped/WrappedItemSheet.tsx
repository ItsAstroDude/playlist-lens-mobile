import React, { useEffect, useCallback, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, Share, TouchableOpacity,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { Sheet, Button } from '@/components/ui'
import { useArtwork, type ArtKind } from '@/hooks/useArtwork'
import { ArtworkFixSheet, type ArtworkTarget } from '@/components/wrapped/ArtworkFixSheet'
import { fmtMinutesShort } from '@/utils/wrapped'
import { memorialFor, MEMORIAL_MARK } from '@/utils/tribute'
import { hasPlays, artistHref, songHref } from '@/utils/itemStats'


export interface WrappedSelection {
  kind:   ArtKind
  name:   string
  artist?: string
  rank:   number
  ms?:    number
  plays?: number
  tracks?: number   // cross-playlist track count (Taste / Lenses use this instead of ms/plays)
  accent: string
}

/**
 * One tap (2.0.46): an artist or song you've played opens its own page straight away;
 * anything else (an artist only in your playlists) opens the quick sheet via `sheet`.
 */
export function openSelection(s: WrappedSelection, sheet: (s: WrappedSelection) => void): void {
  haptic.light()
  try {
    if (s.kind === 'artist' && hasPlays({ kind: 'artist', artist: s.name })) { router.push(artistHref(s.name)); return }
    if (s.kind === 'track' && s.artist && hasPlays({ kind: 'track', track: s.name, artist: s.artist })) { router.push(songHref(s.name, s.artist)); return }
  } catch { /* no play database yet: the sheet it is */ }
  sheet(s)
}

export function WrappedItemSheet({ selection, onClose }: {
  selection: WrappedSelection | null
  onClose:   () => void
}) {
  const isOpen = selection !== null
  // Keep the last item on screen while the sheet slides closed.
  const lastSel = React.useRef(selection)
  if (selection) lastSel.current = selection
  selection = selection ?? lastSel.current
  const fetched = useArtwork(selection?.kind ?? null, selection?.name, selection?.artist)
  const [override, setOverride] = useState<string | null>(null)
  const [fixOpen, setFixOpen]   = useState(false)
  const art = override ?? fetched

  // A new item wipes any in-session override (the picked image is persisted in
  // the cache, so useArtwork re-reads it for that specific item anyway).
  useEffect(() => { setOverride(null) }, [selection?.kind, selection?.name, selection?.artist])

  const onShare = useCallback(async () => {
    if (!selection) return
    haptic.light()
    const parts = [
      `My #${selection.rank} ${selection.kind} on playlist.lens:`,
      selection.artist ? `${selection.name} — ${selection.artist}` : selection.name,
      selection.ms != null ? fmtMinutesShort(selection.ms) : null,
      selection.plays != null ? `${selection.plays.toLocaleString()} plays` : null,
      selection.tracks != null ? `${selection.tracks.toLocaleString()} ${selection.tracks === 1 ? 'track' : 'tracks'}` : null,
    ].filter(Boolean)
    await Share.share({ message: parts.join('  ·  ') })
  }, [selection])

  const onWrongImage = useCallback(() => { haptic.light(); setFixOpen(true) }, [])

  // Artists and songs you've played open their own page (2.0.43); albums open History.
  const page = useMemo(() => {
    if (!isOpen || !selection) return null
    try {
      if (selection.kind === 'artist' && hasPlays({ kind: 'artist', artist: selection.name })) return artistHref(selection.name)
      if (selection.kind === 'track' && selection.artist && hasPlays({ kind: 'track', track: selection.name, artist: selection.artist })) return songHref(selection.name, selection.artist)
      if (selection.kind === 'album') return { pathname: '/history' as const, params: { album: selection.name } }
    } catch { /* no play database yet */ }
    return null
  }, [isOpen, selection?.kind, selection?.name, selection?.artist])  // eslint-disable-line react-hooks/exhaustive-deps
  const onOpenPage = useCallback(() => {
    if (!page) return
    haptic.light(); onClose(); router.push(page)
  }, [page, onClose])

  const fixTarget: ArtworkTarget | null = fixOpen && selection
    ? { kind: selection.kind, name: selection.name, artist: selection.artist, accent: selection.accent, currentArt: art }
    : null

  const accent = selection?.accent ?? Colors.greenPrimary
  const initial = (selection?.name ?? '?').trim().charAt(0).toUpperCase()
  const kindLabel = selection ? selection.kind.toUpperCase() : ''
  // Quiet in-memoriam line — matches the artist (or a track's artist).
  const mem = memorialFor(selection?.kind === 'artist' ? selection?.name : selection?.artist)

  return (
    <>
      <Sheet open={isOpen} onClose={onClose} zIndex={20}>
        <View style={styles.body}>

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
        {mem ? <Text style={styles.memorial}>{`${MEMORIAL_MARK}  in memory · ${mem.years}`}</Text> : null}

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
          {selection?.tracks != null && (
            <View style={styles.statChip}>
              <Text style={[styles.statVal, { color: accent }]}>{selection.tracks.toLocaleString()}</Text>
              <Text style={styles.statLbl}>{selection.tracks === 1 ? 'track' : 'tracks'}</Text>
            </View>
          )}
        </View>

        <View style={styles.btnRow}>
          {page && (
            <Button label={selection?.kind === 'album' ? 'Every play' : 'Your listening'} icon={selection?.kind === 'album' ? 'list' : 'stats-chart'}
              variant="secondary" onPress={onOpenPage} style={styles.btn} />
          )}
          <Button label="Share" icon="share-outline" onPress={onShare} style={[styles.btn, { backgroundColor: accent }]} />
        </View>

        <TouchableOpacity style={styles.reportBtn} onPress={onWrongImage} activeOpacity={0.6} hitSlop={8} accessibilityRole="button">
          <Text style={styles.reportText}>{art ? 'Wrong image? Fix it' : 'Set a cover'}</Text>
        </TouchableOpacity>
        </View>
      </Sheet>

      <ArtworkFixSheet
        target={fixTarget}
        onClose={() => setFixOpen(false)}
        onResolved={url => setOverride(url)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', paddingHorizontal: Spacing.xs, paddingTop: Spacing.xs },
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
  memorial: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.sm, letterSpacing: 0.5 },
  statRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  statChip: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, alignItems: 'center', minWidth: 110 },
  statVal: { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, letterSpacing: -0.5 },
  statLbl: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl, alignSelf: 'stretch', justifyContent: 'center' },
  btn: { flex: 1, maxWidth: 220 },
  reportBtn: { marginTop: Spacing.md, paddingVertical: Spacing.xs },
  reportText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textDecorationLine: 'underline' },
})
