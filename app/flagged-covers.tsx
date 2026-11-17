import React, { useState, useCallback } from 'react'
import { confirmDialog } from '@/utils/dialog'
import { loadArtReports, clearArtReports, type ArtReport } from '@/hooks/useArtwork'
import { Screen, ScreenHeader, Section, ListRow, EmptyState, IconButton, type IconName, type Tint } from '@/components/ui'

const KIND_ICON: Record<string, { icon: IconName; tint: Tint }> = {
  artist: { icon: 'person-outline', tint: 'accent' },
  track:  { icon: 'musical-note',   tint: 'pink' },
  album:  { icon: 'disc-outline',   tint: 'violet' },
}

export default function FlaggedCoversScreen() {
  const [reports, setReports] = useState<ArtReport[]>(() => loadArtReports())

  const onClear = useCallback(() => {
    if (!reports.length) return
    confirmDialog({
      glyph: 'trash-outline', destructive: true, confirmLabel: 'Clear',
      title: 'Clear flagged covers?',
      message: 'Removes the locally-stored list of covers you reported as wrong.',
      onConfirm: () => { clearArtReports(); setReports([]) },
    })
  }, [reports.length])

  return (
    <Screen>
      <ScreenHeader
        title="flagged covers"
        subtitle={reports.length ? `${reports.length} reported` : undefined}
        right={reports.length ? <IconButton icon="trash-outline" label="Clear flagged covers" onPress={onClear} /> : undefined}
      />

      {reports.length === 0 ? (
        <EmptyState
          icon="flag-outline"
          title="Nothing flagged"
          body="Covers you report as wrong from Wrapped show up here."
        />
      ) : (
        <Section
          label="reported"
          footer="Stored on this device only. The cover fixer (pick · re-search · upload) solves most covers without a report."
        >
          {reports.map((r, i) => {
            const k = KIND_ICON[r.kind] ?? { icon: 'image-outline' as IconName, tint: 'sky' as Tint }
            return (
              <ListRow
                key={`${r.name}-${r.at}-${i}`}
                icon={k.icon} tint={k.tint}
                label={r.name}
                hint={[r.kind, r.artist].filter(Boolean).join(' · ')}
                value={new Date(r.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                last={i === reports.length - 1}
              />
            )
          })}
        </Section>
      )}
    </Screen>
  )
}
