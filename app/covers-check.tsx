import React, { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Screen, ScreenHeader, Section, Button, Card } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { probeArtwork, forgetArtworkMisses, artworkCounts, type ArtProbe } from '@/hooks/useArtwork'

/**
 * Labs › Covers check: runs each step of the song/artist cover lookup on this phone
 * and shows which one fails, plus a way to retry covers the app gave up on.
 */
export default function CoversCheck() {
  const [running, setRunning] = useState(false)
  const [probes, setProbes] = useState<ArtProbe[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [counts, setCounts] = useState(artworkCounts)

  const run = useCallback(async () => {
    haptic.medium(); setRunning(true); setMsg(null)
    try { setProbes(await probeArtwork()) } finally { setRunning(false); setCounts(artworkCounts()) }
  }, [])

  const forget = () => {
    haptic.medium()
    const n = forgetArtworkMisses()
    setCounts(artworkCounts())
    setMsg(`Forgot ${n} "no picture" answers. Those covers are looked up again as you scroll (they fill in over a minute or two).`)
  }

  return (
    <Screen>
      <ScreenHeader mainScreenOnly title="covers check" subtitle="Why song and artist covers aren't showing, step by step." />
      <Section label="this phone">
        <Card padded>
          <Text style={styles.line}>{counts.cached} covers saved · {counts.misses} remembered as "no picture" · {counts.overrides} pinned</Text>
          <View style={styles.buttons}>
            <Button label={running ? 'Checking…' : 'Run the check'} icon="pulse" onPress={run} disabled={running} />
            <Button label="Retry missing covers" icon="refresh" variant="secondary" onPress={forget} />
          </View>
          {!!msg && <Text style={styles.msg}>{msg}</Text>}
        </Card>
      </Section>
      {running && <ActivityIndicator color={Colors.greenPrimary} style={{ marginTop: Spacing.lg }} />}
      {probes && (
        <Section label="results">
          <Card padded>
            {probes.map(p => (
              <View key={p.step} style={styles.row}>
                <Icon name={p.ok ? 'checkmark-circle' : 'close-circle'} size={18} color={p.ok ? Colors.greenPrimary : Colors.error} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.step}>{p.step}</Text>
                  <Text style={styles.detail} selectable>{p.detail}</Text>
                </View>
              </View>
            ))}
          </Card>
        </Section>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  line:    { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted },
  buttons: { gap: Spacing.sm, marginTop: Spacing.md },
  msg:     { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.greenPrimary, marginTop: Spacing.sm },
  row:     { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 8, alignItems: 'flex-start' },
  step:    { fontFamily: FontFamily.monoMedium, fontSize: FontSize.base, color: Colors.text },
  detail:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
})
