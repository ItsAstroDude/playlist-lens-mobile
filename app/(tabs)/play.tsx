import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, FontFamily, FontSize, Spacing, Radius, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { TabHeader, IconButton } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { useNowPlayingGutter } from '@/hooks/useNowPlayingGutter'
import { MoreOrLess } from '@/components/play/MoreOrLess'
import { BlindFive } from '@/components/play/BlindFive'
import { RankIt } from '@/components/play/RankIt'
import { WhenGame } from '@/components/play/WhenGame'

type GameId = 'more' | 'blind' | 'rank' | 'when'
const GAMES: GameId[] = ['more', 'blind', 'rank', 'when']

/**
 * The Play tab: minigames on your own listening, in Wrapped's old slot while Wrapped is
 * rebuilt (it lives in Settings › About › Labs for now). Four games (components/play),
 * one under the other (2.0.40; chips in 2.0.39): press Play on one and it has the screen
 * to itself, with "all games" to come back.
 */
export default function PlayTab() {
  const gutter = useNowPlayingGutter()
  const [active, setActive] = useState<GameId | null>(null)
  // Back to all games: the game left starts over at its own card (a new key remounts it).
  const [gen, setGen] = useState<Record<GameId, number>>({ more: 0, blind: 0, rank: 0, when: 0 })
  const back = () => {
    if (!active) return
    haptic.light()
    setGen(x => ({ ...x, [active]: x[active] + 1 }))
    setActive(null)
  }

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

          {active && (
            <Pressable onPress={back} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="All games">
              <Icon name="chevron-back" size={16} color={Colors.textSecondary} />
              <Text style={styles.backText}>all games</Text>
            </Pressable>
          )}
          {GAMES.map(id => (active == null || active === id) && (
            <View key={`${id}-${gen[id]}`} style={{ gap: Spacing.md }}>
              {id === 'more' && <MoreOrLess onStart={() => setActive('more')} />}
              {id === 'blind' && <BlindFive onStart={() => setActive('blind')} />}
              {id === 'rank' && <RankIt onStart={() => setActive('rank')} />}
              {id === 'when' && <WhenGame onStart={() => setActive('when')} />}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  safe:      { flex: 1 },
  back:      { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 32 },
  backText:  { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.textSecondary },

  wall:      { borderRadius: Radius.lg, borderWidth: 1, borderColor: alpha(Colors.warning, 0.45), backgroundColor: alpha(Colors.warning, 0.08), overflow: 'hidden' },
  tape:      { height: 6, backgroundColor: alpha(Colors.warning, 0.55) },
  wallRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  wallTitle: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.base, color: Colors.text },
  wallBody:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
})
