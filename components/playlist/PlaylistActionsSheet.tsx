import React, { useRef } from 'react'
import { StyleSheet, Share } from 'react-native'
import { Spacing } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { Sheet, Card, ListRow } from '@/components/ui'
import type { SpotifyPlaylist } from '@/types'
import type { IconName } from '@/components/ui/Icon'

interface Action { glyph: IconName; label: string; sub?: string; onPress: () => void; tint?: string }

export function PlaylistActionsSheet({ playlist, onClose, onPin, onReanalyze, onReorder, onCompare }: {
  playlist:    SpotifyPlaylist | null
  onClose:     () => void
  onPin:       (id: string) => void
  onReanalyze: (id: string) => void
  onReorder:   () => void
  onCompare:   (id: string) => void
}) {
  const isOpen = playlist !== null
  // Keep showing the last playlist while the sheet slides closed.
  const last = useRef(playlist)
  if (playlist) last.current = playlist
  const shown = playlist ?? last.current

  const run = (fn: () => void) => { fn(); onClose() }

  const onShare = async () => {
    if (!shown) return
    haptic.light()
    const url = (shown as any).external_urls?.spotify
    const msg = [`${shown.name} — ${shown.tracks.total} tracks, via playlist.lens`, url].filter(Boolean).join('\n')
    onClose()
    await Share.share({ message: msg })
  }

  const actions: Action[] = shown ? [
    { glyph: 'pin-outline', label: 'Pin to top',     sub: 'Jump this lens to the front',     onPress: () => run(() => { haptic.success(); onPin(shown.id) }) },
    { glyph: 'share-outline', label: 'Share',          sub: 'Send this playlist',               onPress: onShare },
    { glyph: 'refresh', label: 'Re-analyze',     sub: 'Recompute from fresh data',        onPress: () => run(() => { haptic.medium(); onReanalyze(shown.id) }) },
    { glyph: 'git-compare-outline', label: 'Compare with…',  sub: 'Stack this against another lens',   onPress: () => run(() => { haptic.medium(); onCompare(shown.id) }) },
    { glyph: 'reorder-three', label: 'Reorder lenses', sub: 'Drag to set your own order',       onPress: () => run(() => { haptic.medium(); onReorder() }) },
  ] : []

  return (
    <Sheet open={isOpen} onClose={onClose} title={shown?.name} subtitle={shown ? `${shown.tracks.total} tracks` : undefined} bottomInset={76}>
      <Card style={styles.card}>
        {actions.map((a, i) => (
          <ListRow key={a.label} icon={a.glyph} label={a.label} hint={a.sub} onPress={a.onPress} last={i === actions.length - 1} />
        ))}
      </Card>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  card: { marginTop: Spacing.sm },
})
