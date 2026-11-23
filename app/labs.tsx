import React, { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { router } from 'expo-router'
import { Screen, ScreenHeader, Section, ListRow, ToggleRow } from '@/components/ui'
import { haptic } from '@/constants/animation'
import { updateDetails } from '@/utils/updates'
import { flexPanelEnabled, onFoldSettings, setFlexPanelEnabled, setSimulateHalfFold, setTabletopEnabled, simulateHalfFold, tabletopEnabled } from '@/utils/settings'
import { postureSupported, usePosture } from '@/hooks/usePosture'

const go = (path: Parameters<typeof router.push>[0]) => () => { haptic.light(); router.push(path) }

/**
 * Settings › About › Labs — every lab, prototype and testing tool in one place.
 * New experiments get a row here instead of a row in Settings.
 */
export default function Labs() {
  const upd = updateDetails()
  const posture = usePosture()
  const [tabletop, setTabletop] = useState(tabletopEnabled)
  const [simulate, setSimulate] = useState(simulateHalfFold)
  const [flexOn, setFlexOn] = useState(flexPanelEnabled)
  useEffect(() => onFoldSettings(() => { setTabletop(tabletopEnabled()); setSimulate(simulateHalfFold()); setFlexOn(flexPanelEnabled()) }), [])
  const fold = posture.state === 'none'
    ? (postureSupported ? 'no fold here' : 'needs the new APK')
    : `${posture.state === 'half' ? 'half-folded' : 'flat'} · hinge at ${Math.round(posture.top)} dp${posture.source === 'simulated' ? ' (simulated)' : ''}`
  return (
    <Screen>
      <ScreenHeader title="labs" subtitle="Prototypes and testing tools. Things here may change or go away." />

      <Section label="prototypes">
        <ListRow icon="disc-outline" tint="violet" label="Wrapped (work in progress)"
          hint="Being rebuilt to scroll smoothly. Its tab is the Play minigame for now"
          onPress={go('/wrapped')} />
        {/* Galaxy Z Flip only (Android): no cover screen or hinge on an iPhone */}
        {Platform.OS === 'android' && (
          <ListRow icon="phone-portrait-outline" tint="sky" label="Cover screen lab"
            hint="A ring round the cameras on the Flip's cover screen"
            onPress={go('/cover-lab')} />
        )}
        <ListRow icon="sparkles-outline" tint="violet" label="Motion lab"
          hint="Try the 2.0 animations one by one"
          onPress={go('/motion-lab')} last />
      </Section>

      {Platform.OS === 'android' && (
      <Section label="half-folded">
        <ToggleRow icon="laptop-outline" tint="sky" label="Flex panel"
          hint="Folded, the app moves to the top half and the flat half becomes a music remote"
          value={flexOn} onValueChange={v => { haptic.light(); setFlexPanelEnabled(v) }} />
        <ToggleRow icon="expand-outline" tint="violet" label="Open Now playing when you fold"
          hint="Folding while a song plays opens Now playing full screen instead"
          value={tabletop} onValueChange={v => { haptic.light(); setTabletopEnabled(v) }} />
        <ToggleRow icon="contrast-outline" tint="amber" label="Simulate half-folded"
          hint="Pretend the phone is folded halfway, to try the layout flat on the table"
          value={simulate} onValueChange={v => { haptic.light(); setSimulateHalfFold(v) }} />
        <ListRow icon="analytics-outline" tint="violet" label="Fold right now"
          value={fold} last />
      </Section>
      )}

      <Section label="testing">
        <ListRow icon="git-commit-outline" tint="amber" label="Update details"
          value={upd.running} hint={upd.detail} />
        <ListRow icon="image-outline" tint="sky" label="Covers check"
          hint="Why song and artist covers aren't showing, step by step"
          onPress={go('/covers-check')} />
        <ListRow icon="timer-outline" tint="amber" label="Load times"
          hint="How fast each screen opens on this phone"
          onPress={go('/load-times')} />
        <ListRow icon="bug-outline" tint="pink" label="Errors"
          hint="Crash and error reports, sent to your own server"
          onPress={go('/errors')} />
        <ListRow icon="color-palette-outline" label="Design system"
          hint="Every colour, type style and component the app is built from"
          onPress={go('/design')} last />
      </Section>
    </Screen>
  )
}
