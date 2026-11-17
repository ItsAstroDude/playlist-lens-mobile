import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Spacing, Radius, Type, ACCENTS } from '@/constants/theme'
import {
  Screen, ScreenHeader, Card, Section, ListRow, ToggleRow, IconButton, Chip, Stat, EmptyState, Icon,
} from '@/components/ui'
import { showToast, showDialog } from '@/utils/dialog'

/**
 * Design system gallery — every token and primitive on one screen, rendered with
 * the live theme (dark/light, accent, font). Settings › About › Design system.
 * When a piece looks wrong here, it's wrong everywhere — fix it once.
 */
export default function DesignGallery() {
  const [on, setOn] = useState(true)
  const [chip, setChip] = useState('week')

  return (
    <Screen>
      <ScreenHeader title="design" subtitle="The building blocks every screen is made of" />

      <Section label="type">
        <View style={styles.pad}>
          <Text style={Type.display}>Display</Text>
          <Text style={Type.title}>Title</Text>
          <Text style={Type.heading}>Heading</Text>
          <Text style={Type.stat}>12,480</Text>
          <Text style={Type.label}>Label — buttons, row titles</Text>
          <Text style={Type.body}>Body — paragraphs and anything you read at length.</Text>
          <Text style={Type.caption}>Caption — hints, meta, secondary info</Text>
          <Text style={Type.overline}>Overline — section labels</Text>
        </View>
      </Section>

      <Section label="colour" footer="One accent (yours, from Appearance). Text in three steps: text, secondary, muted.">
        <View style={[styles.pad, styles.wrap]}>
          {[
            ['accent', Colors.greenPrimary], ['text', Colors.text], ['secondary', Colors.textSecondary],
            ['muted', Colors.textMuted], ['surface', Colors.sheet], ['error', Colors.error],
          ].map(([name, c]) => (
            <View key={name} style={styles.swatchCol}>
              <View style={[styles.swatch, { backgroundColor: c }]} />
              <Text style={Type.caption}>{name}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.pad, styles.wrap, { paddingTop: 0 }]}>
          {ACCENTS.map(a => <View key={a.id} style={[styles.dot, { backgroundColor: a.hex }]} />)}
        </View>
      </Section>

      <Section label="spacing & radius" footer="Spacing 4 · 8 · 12 · 16 · 20 · 24 · 32. Radius: cards lg, pills full, tiles 10.">
        <View style={[styles.pad, styles.row]}>
          {[Spacing.xs, Spacing.sm, Spacing.md, Spacing.lg, Spacing.xl, Spacing['2xl'], Spacing['3xl']].map(s => (
            <View key={s} style={[styles.space, { width: s, height: s }]} />
          ))}
        </View>
      </Section>

      <Section label="rows">
        <ListRow icon="sparkles-outline" label="List row" hint="Icon tile, label, hint, chevron when tappable" onPress={() => {}} />
        <ListRow icon="layers-outline" tint="sky" label="With a value" value="1.7.1" />
        <ListRow icon="checkmark-done-outline" tint="violet" label="Confirmation" value="Cleared" valueTone="ok" />
        <ToggleRow icon="pulse" tint="pink" label="Toggle row" hint="Switches live here" value={on} onValueChange={setOn} />
        <ListRow icon="log-out-outline" label="Danger row" danger onPress={() => {}} last />
      </Section>

      <Section label="controls">
        <View style={[styles.pad, styles.row]}>
          <IconButton icon="search" label="Search" onPress={() => {}} />
          <IconButton icon="grid-outline" label="Grid" active onPress={() => {}} />
          {['week', 'month', 'year'].map(k => (
            <Chip key={k} label={k} selected={chip === k} onPress={() => setChip(k)} />
          ))}
        </View>
        <View style={[styles.pad, styles.row, { paddingTop: 0 }]}>
          <Chip icon="play" label="Play" />
          <Chip icon="add" label="Queue all" />
        </View>
      </Section>

      <Section label="stats">
        <View style={[styles.pad, styles.stats]}>
          <Stat value="18.2h" label="listened" delta={12} style={{ flex: 1 }} />
          <Stat value="412" label="plays" delta={-4} style={{ flex: 1 }} />
          <Stat value="96" label="artists" style={{ flex: 1 }} />
        </View>
      </Section>

      <Section label="cards">
        <Card tone="accent" padded>
          <Text style={Type.heading}>Accent card</Text>
          <Text style={[Type.caption, { marginTop: 4 }]}>For the one thing on a screen that should stand out.</Text>
        </Card>
      </Section>

      <Section label="feedback">
        <View style={[styles.pad, styles.row]}>
          <Chip icon="chatbubble-ellipses-outline" label="Toast" onPress={() => showToast('This is a toast', 'checkmark-circle')} />
          <Chip icon="alert-circle-outline" label="Dialog" onPress={() => showDialog({ glyph: 'sparkles', title: 'A dialog', message: 'On-brand, queued, accessible.' })} />
        </View>
      </Section>

      <Section label="empty state">
        <EmptyState icon="disc-outline" title="Nothing here yet" body="Every empty or no-result screen uses this." actionLabel="Do the thing" onAction={() => {}} />
      </Section>

      <View style={styles.foot}>
        <Icon name="aperture" size={22} color={Colors.textMuted} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  pad:       { padding: Spacing.lg, gap: Spacing.sm },
  wrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  row:       { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm },
  stats:     { flexDirection: 'row', gap: Spacing.md },
  swatchCol: { alignItems: 'center', gap: 4 },
  swatch:    { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: Colors.glassBorder },
  dot:       { width: 20, height: 20, borderRadius: Radius.full },
  space:     { backgroundColor: Colors.greenPrimary, borderRadius: 2 },
  foot:      { alignItems: 'center', paddingTop: Spacing.md },
})
