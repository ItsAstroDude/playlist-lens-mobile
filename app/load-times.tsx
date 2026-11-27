import React, { useState } from 'react'
import { Screen, ScreenHeader, Section, ListRow, EmptyState } from '@/components/ui'
import { haptic } from '@/constants/animation'
import { summary, clearPerf, fmtMs, fmtSize, type Metric } from '@/utils/perf'
import type { IconName } from '@/components/ui/Icon'
import type { Tint } from '@/components/ui/ListRow'

const ICON: Record<Metric, { icon: IconName; tint: Tint }> = {
  cold_start:  { icon: 'flash-outline',      tint: 'accent' },
  js_start:    { icon: 'code-slash-outline', tint: 'accent' },
  lenses:      { icon: 'aperture-outline',   tint: 'sky' },
  wrapped:     { icon: 'disc-outline',       tint: 'violet' },
  recaps:      { icon: 'calendar-outline',   tint: 'pink' },
  read_buffer: { icon: 'list-outline',       tint: 'amber' },
  read_stats:  { icon: 'server-outline',     tint: 'amber' },
}

/**
 * Settings › About › Load times — the numbers recorded by utils/perf on this phone.
 * The 2.0 baseline: what the play database has to beat.
 */
export default function LoadTimes() {
  const [data, setData] = useState(summary)
  const screens = data.rows.filter(r => !r.metric.startsWith('read_'))
  const reads   = data.rows.filter(r => r.metric.startsWith('read_'))
  const sizeHint = (m: Metric) =>
    m === 'read_buffer' && data.sizes?.buffer ? ` · ${fmtSize(data.sizes.buffer)}` :
    m === 'read_stats'  && data.sizes?.stats  ? ` · ${fmtSize(data.sizes.stats)}`  : ''

  return (
    <Screen>
      <ScreenHeader mainScreenOnly title="load times" subtitle="Measured on this phone · median of the last 20" />

      {data.rows.length === 0 ? (
        <EmptyState icon="timer-outline" title="Nothing measured yet"
          body="Close the app fully, reopen it, then visit Lenses, Rewind and Recaps. The numbers land here." />
      ) : (
        <>
          {screens.length > 0 && (
            <Section label="screens" footer="From the first frame of the screen to its content on screen. Cold start runs from app launch.">
              {screens.map((r, i) => (
                <ListRow key={r.metric} {...ICON[r.metric]} label={r.label}
                  hint={`last ${fmtMs(r.last)} · ${r.count} ${r.count === 1 ? 'sample' : 'samples'}`}
                  value={fmtMs(r.median)} last={i === screens.length - 1} />
              ))}
            </Section>
          )}
          {reads.length > 0 && (
            <Section label="storage reads" footer="Parsing the stored JSON. The 2.0 play database replaces both.">
              {reads.map((r, i) => (
                <ListRow key={r.metric} {...ICON[r.metric]} label={r.label}
                  hint={`last ${fmtMs(r.last)} · ${r.count} ${r.count === 1 ? 'sample' : 'samples'}${sizeHint(r.metric)}`}
                  value={fmtMs(r.median)} last={i === reads.length - 1} />
              ))}
            </Section>
          )}
          <Section>
            <ListRow icon="trash-outline" label="Reset measurements" danger
              onPress={() => { haptic.medium(); clearPerf(); setData(summary()) }} last />
          </Section>
        </>
      )}
    </Screen>
  )
}
