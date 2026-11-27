import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { Colors, FontFamily, FontSize, Radius, Spacing, Type, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { Screen, ScreenHeader, Chip, EmptyState, Icon, TINT, Tile } from '@/components/ui'
import { emitOpenTutorial, emitOpenWhatsNew } from '@/utils/overlayEvents'
import { LEARN, searchLearn, learnCount, type LearnAction, type LearnItem, type LearnChapter } from '@/utils/learn'

/**
 * Learn the app (2.0.50): everything playlist.lens does, a chapter at a time, each with
 * where to find it and a way straight in. Search finds a feature by any word.
 */

function run(a: LearnAction): void {
  haptic.light()
  if (a.kind === 'tour') { emitOpenTutorial(); return }   // the tour takes you back to the tabs itself
  if (a.kind === 'whatsNew') { emitOpenWhatsNew(); return }
  if (a.tab) router.navigate(a.path as never)
  else router.push(a.path as never)
}

export default function LearnScreen() {
  const [query, setQuery] = useState('')
  const [chapter, setChapter] = useState<string | null>(null)
  const results = useMemo(() => searchLearn(query), [query])
  const shown = chapter && !query.trim() ? results.filter(c => c.id === chapter) : results
  const total = learnCount()

  return (
    <Screen scrollProps={{ keyboardShouldPersistTaps: 'handled', keyboardDismissMode: 'on-drag' }}>
      <ScreenHeader title="learn" subtitle={`Everything playlist.lens can do · ${total} things to try`} />

      <View style={styles.searchBox}>
        <Icon name="search" size={15} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput} value={query} onChangeText={setQuery}
          placeholder="Search: queue, backup, fold, stories…" placeholderTextColor={Colors.textMuted}
          autoCorrect={false} autoCapitalize="none" returnKeyType="search" accessibilityLabel="Search what the app can do"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
            <Icon name="close-circle" size={16} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {!query.trim() && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
          <Chip label="All" selected={chapter === null} onPress={() => setChapter(null)} />
          {LEARN.map(c => <Chip key={c.id} label={c.title} selected={chapter === c.id} onPress={() => setChapter(c.id)} />)}
        </ScrollView>
      )}

      {shown.length === 0 ? (
        <EmptyState icon="search-outline" title="Nothing by that name" body="Try another word, like queue, story, fold or backup." />
      ) : shown.map(c => <Chapter key={c.id} chapter={c} />)}

      <Text style={styles.foot}>Something missing or unclear? Every update’s notes are in What’s new.</Text>
    </Screen>
  )
}

function Chapter({ chapter: c }: { chapter: LearnChapter }) {
  return (
    <View style={styles.chapter}>
      <View style={styles.chapterHead} accessibilityRole="header">
        <Text style={[Type.overline, { color: TINT[c.tint] }]}>{c.title}</Text>
        <Text style={Type.caption}>{c.intro}</Text>
      </View>
      <View style={styles.card}>
        {c.items.map((it, i) => <Item key={it.id} item={it} tint={c.tint} last={i === c.items.length - 1} />)}
      </View>
    </View>
  )
}

function Item({ item: it, tint, last }: { item: LearnItem; tint: LearnChapter['tint']; last: boolean }) {
  const a = it.action
  const body = (
    <View style={[styles.item, !last && styles.itemDivider]}>
      <Tile icon={it.icon} tint={tint} size={34} />
      <View style={styles.itemText}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{it.title}</Text>
          {it.premium ? <Text style={styles.premium}>Premium</Text> : null}
        </View>
        <Text style={styles.body}>{it.body}</Text>
        <Text style={[styles.where, { color: TINT[tint] }]}>{it.where}</Text>
      </View>
      {a ? <Icon name="chevron-forward" size={15} color={Colors.textMuted} /> : null}
    </View>
  )
  if (!a) return <View accessible accessibilityLabel={`${it.title}. ${it.body} Where: ${it.where}`}>{body}</View>
  return (
    <Pressable onPress={() => run(a)} style={({ pressed }) => pressed && styles.pressed}
      accessibilityRole="button" accessibilityLabel={`${it.title}. ${it.body} Where: ${it.where}`}
      accessibilityHint={a.kind === 'route' ? 'Opens it' : undefined}>
      {body}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, height: 42, borderRadius: Radius.full,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder,
  },
  searchInput: { flex: 1, fontFamily: FontFamily.mono, fontSize: FontSize.base, color: Colors.text, paddingVertical: 0 },
  chipsScroll: { marginHorizontal: -Spacing.lg, marginTop: -Spacing.sm },
  chips:       { gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  chapter:     { gap: Spacing.sm },
  chapterHead: { gap: 2, paddingHorizontal: 2 },
  card: {
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder,
    borderRadius: Radius.lg, overflow: 'hidden',
  },
  item:        { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, padding: Spacing.md + 2 },
  itemDivider: { borderBottomWidth: 1, borderBottomColor: Colors.glassBorder },
  itemText:    { flex: 1, minWidth: 0, gap: 4 },
  titleRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  title:       { ...Type.label, color: Colors.text },
  premium: {
    fontFamily: FontFamily.monoMedium, fontSize: 10, letterSpacing: 0.5, color: Colors.pink,
    borderWidth: 1, borderColor: alpha(Colors.pink, 0.4), borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 1,
  },
  body:        { fontFamily: FontFamily.mono, fontSize: FontSize.sm, lineHeight: FontSize.sm * 1.45, color: Colors.textSecondary },
  where:       { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, marginTop: 2 },
  pressed:     { backgroundColor: alpha('#ffffff', 0.04) },
  foot:        { ...Type.caption, textAlign: 'center' },
})
