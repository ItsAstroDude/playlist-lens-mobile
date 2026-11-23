import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, FontFamily, FontSize, Spacing, Radius, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { TabHeader, IconButton, Chip } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { useNowPlayingGutter } from '@/hooks/useNowPlayingGutter'
import { storage } from '@/utils/cache'
import { MoreOrLess } from '@/components/play/MoreOrLess'
import { BlindFive } from '@/components/play/BlindFive'
import { RankIt } from '@/components/play/RankIt'
import { WhenGame } from '@/components/play/WhenGame'

type GameId = 'more' | 'blind' | 'rank' | 'when'
const GAMES: { id: GameId; label: string }[] = [
  { id: 'more',  label: 'More or less' },
  { id: 'blind', label: 'Blind five' },
  { id: 'rank',  label: 'Rank it' },
  { id: 'when',  label: 'When?' },
]
const GAME_KEY = 'game.tab'

/**
 * The Play tab: minigames on your own listening, in Wrapped's old slot while Wrapped is
 * rebuilt (it lives in Settings › About › Labs for now). 2.0.39: four games behind a
 * row of chips — More or less, Blind five, Rank it, When? (components/play).
 */
export default function PlayTab() {
  const gutter = useNowPlayingGutter()
  const [game, setGame] = useState<GameId>(() => {
    const v = storage.getString(GAME_KEY)
    return GAMES.some(x => x.id === v) ? (v as GameId) : 'more'
  })
  const pick = (id: GameId) => { if (id !== game) { haptic.light(); storage.set(GAME_KEY, id); setGame(id) } }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TabHeader
          title="play"
          subtitle="How well do you know your own listening?"
          titleRight={
            <>
              <IconButton icon="time-outline" label="History: every play, searchable, by day" onPress={() => router.push('/history')} />
              <IconButton icon="albums-outline" label="Recaps: past weeks, months, seasons and years" onPress={() => router.push('/recaps')} />
            </>
          }
        />

        <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 130 + gutter, gap: Spacing.md }}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* The construction wall: Wrapped is being rebuilt, still reachable in Labs. */}
          <Pressable onPress={() => { haptic.light(); router.push('/wrapped') }} accessibilityRole="button"
            accessibilityLabel="Wrapped is being rebuilt. Open the work-in-progress version">
            <View style={styles.wall}>
              <View style={styles.tape} />
              <View style={styles.wallRow}>
                <Icon name="construct-outline" size={18} color={Colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.wallTitle}>Wrapped is being rebuilt</Text>
                  <Text style={styles.wallBody}>We're making it smooth. The work-in-progress version is in Labs, or tap here.</Text>
                </View>
                <Icon name="chevron-forward" size={16} color={Colors.textMuted} />
              </View>
            </View>
          </Pressable>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}
            accessibilityRole="tablist">
            {GAMES.map(x => <Chip key={x.id} label={x.label} selected={x.id === game} onPress={() => pick(x.id)} />)}
          </ScrollView>

          {/* Keyed: switching games starts the new one fresh. */}
          <View key={game} style={{ gap: Spacing.md }}>
            {game === 'more' && <MoreOrLess />}
            {game === 'blind' && <BlindFive />}
            {game === 'rank' && <RankIt />}
            {game === 'when' && <WhenGame />}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  safe:      { flex: 1 },
  chips:     { gap: Spacing.sm, paddingVertical: 2 },

  wall:      { borderRadius: Radius.lg, borderWidth: 1, borderColor: alpha(Colors.warning, 0.45), backgroundColor: alpha(Colors.warning, 0.08), overflow: 'hidden' },
  tape:      { height: 6, backgroundColor: alpha(Colors.warning, 0.55) },
  wallRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  wallTitle: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.base, color: Colors.text },
  wallBody:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
})
