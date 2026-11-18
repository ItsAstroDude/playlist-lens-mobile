import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Screen, ScreenHeader, Section, Button } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { Colors, Spacing, Radius, Type, FontFamily, alpha } from '@/constants/theme'
import { RollingNumber, RackFocus, SaveBurst, RippleCell, Aperture, LiquidFill, Aurora } from '@/components/motion'

const PALETTES: [string, string, string, string][] = [
  ['#ff70a5', '#ffb347', '#6a2bd9', '#b39dff'],
  ['#4fc3f7', '#1e4fa3', '#2ec4a6', '#3a6fd8'],
  ['#ff7a5c', '#ffb347', '#a3341f', '#ff70a5'],
]
const WEEKS = [[18, 24, 412], [26, 51, 588], [9, 7, 163]]
const ARTISTS = ['Radiohead', 'Björk', 'Floating Points', 'Massive Attack', 'Caribou']
const LV = [alpha(Colors.text, 0.06), alpha(Colors.greenPrimary, 0.3), alpha(Colors.greenPrimary, 0.6), Colors.greenPrimary]
const pad = (n: number) => (n < 10 ? '0' : '') + n

/**
 * Settings › About › Motion lab — every 2.0 motion primitive, live on the phone,
 * before they're woven into the new UI.
 */
export default function MotionLab() {
  const [pal, setPal] = useState(0)
  const [wk, setWk] = useState(0)
  const [saved, setSaved] = useState(false)
  const [focus, setFocus] = useState(0)
  const [ripple, setRipple] = useState(0)
  const [loading, setLoading] = useState(false)
  const [fill, setFill] = useState(0.62)
  const w = WEEKS[wk]

  return (
    <Screen>
      <ScreenHeader title="motion lab" subtitle="The 2.0 animations, one by one. Tap each to replay." />

      <Section label="album-art aurora" footer="Tap to change track: the colours cross-fade.">
        <Pressable onPress={() => setPal((pal + 1) % PALETTES.length)} style={styles.stage} accessibilityRole="button" accessibilityLabel="Change track">
          <Aurora colors={PALETTES[pal]} style={StyleSheet.absoluteFill} />
          <Text style={styles.onArt}>Tap to change track</Text>
        </Pressable>
      </Section>

      <Section label="rolling numbers">
        <Pressable onPress={() => setWk((wk + 1) % WEEKS.length)} style={styles.pad} accessibilityRole="button" accessibilityLabel="Change week">
          <RollingNumber value={`${pad(w[0])}h ${pad(w[1])}m`} style={styles.big} unitStyle={styles.unit} />
          <View style={styles.inline}>
            <RollingNumber value={String(w[2])} style={Type.label} />
            <Text style={Type.caption}> plays this week</Text>
          </View>
        </Pressable>
      </Section>

      <Section label="save burst">
        <View style={[styles.pad, styles.center]}>
          <SaveBurst active={saved} onPress={() => setSaved(s => !s)} label={saved ? 'Saved' : 'Save'} size={64}
            colors={[Colors.greenPrimary, Colors.lavender, Colors.pink, Colors.warning]}>
            <Icon name={saved ? 'heart' : 'heart-outline'} size={34} color={saved ? Colors.greenPrimary : Colors.text} />
          </SaveBurst>
        </View>
      </Section>

      <Section label="rack focus">
        <View style={styles.pad}>
          {ARTISTS.map((a, i) => (
            <RackFocus key={a} index={i} trigger={focus} blur>
              <View style={styles.row}><Text style={styles.rank}>{i + 1}</Text><Text style={Type.label}>{a}</Text></View>
            </RackFocus>
          ))}
          <Button label="Refocus" variant="secondary" size="sm" onPress={() => setFocus(f => f + 1)} style={styles.btn} />
        </View>
      </Section>

      <Section label="calendar ripple">
        <Pressable onPress={() => setRipple(r => r + 1)} style={[styles.pad, styles.center]} accessibilityRole="button" accessibilityLabel="Ripple again">
          <View style={styles.heat}>
            {Array.from({ length: 15 }, (_, col) => (
              <View key={col} style={styles.heatCol}>
                {Array.from({ length: 7 }, (_, row) => {
                  const v = (col * 7 + row) * 37 % 13
                  return <RippleCell key={row} col={col} row={row} trigger={ripple} style={[styles.cell, { backgroundColor: LV[v < 3 ? 0 : v < 7 ? 1 : v < 11 ? 2 : 3] }]} />
                })}
              </View>
            ))}
          </View>
        </Pressable>
      </Section>

      <Section label="aperture" footer="Tap to refresh: the blades spin while loading, then spring open.">
        <Pressable onPress={() => { setLoading(true); setTimeout(() => setLoading(false), 1600) }} style={[styles.pad, styles.center]} accessibilityRole="button" accessibilityLabel="Refresh">
          <Aperture size={110} loading={loading} cut={Colors.sheet} />
        </Pressable>
      </Section>

      <Section label="liquid fill">
        <Pressable onPress={() => setFill(0.3 + Math.random() * 0.65)} style={[styles.pad, styles.center]} accessibilityRole="button" accessibilityLabel="Refill">
          <LiquidFill progress={fill} size={180} color={Colors.greenPrimary} label="Import progress">
            <RollingNumber value={`${Math.round(fill * 100)}%`} style={styles.pct} />
          </LiquidFill>
        </Pressable>
      </Section>
    </Screen>
  )
}

const styles = StyleSheet.create({
  stage:  { height: 200, borderRadius: Radius.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  onArt:  { ...Type.label, color: '#fff' },
  pad:    { padding: Spacing.lg, gap: Spacing.sm },
  center: { alignItems: 'center' },
  inline: { flexDirection: 'row', alignItems: 'flex-end' },
  big:    { fontFamily: FontFamily.syneBold, fontSize: 56, color: Colors.text, letterSpacing: -2 },
  unit:   { fontFamily: FontFamily.syneBold, fontSize: 24, color: Colors.textMuted, marginBottom: 8 },
  pct:    { fontFamily: FontFamily.syneBold, fontSize: 36, color: '#fff' },
  row:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  rank:   { ...Type.heading, width: 20, color: Colors.textMuted },
  btn:    { alignSelf: 'flex-start', marginTop: Spacing.sm },
  heat:   { flexDirection: 'row', gap: 4 },
  heatCol:{ gap: 4 },
  cell:   { width: 14, height: 14, borderRadius: 3 },
})
