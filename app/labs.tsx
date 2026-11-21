import React from 'react'
import { router } from 'expo-router'
import { Screen, ScreenHeader, Section, ListRow } from '@/components/ui'
import { haptic } from '@/constants/animation'
import { updateDetails } from '@/utils/updates'

const go = (path: Parameters<typeof router.push>[0]) => () => { haptic.light(); router.push(path) }

/**
 * Settings › About › Labs — every lab, prototype and testing tool in one place.
 * New experiments get a row here instead of a row in Settings.
 */
export default function Labs() {
  const upd = updateDetails()
  return (
    <Screen>
      <ScreenHeader title="labs" subtitle="Prototypes and testing tools. Things here may change or go away." />

      <Section label="prototypes">
        <ListRow icon="disc-outline" tint="violet" label="Wrapped (work in progress)"
          hint="Being rebuilt to scroll smoothly. Its tab is the Play minigame for now"
          onPress={go('/wrapped')} />
        <ListRow icon="phone-portrait-outline" tint="sky" label="Cover screen lab"
          hint="A ring round the cameras on the Flip's cover screen"
          onPress={go('/cover-lab')} />
        <ListRow icon="sparkles-outline" tint="violet" label="Motion lab"
          hint="Try the 2.0 animations one by one"
          onPress={go('/motion-lab')} last />
      </Section>

      <Section label="testing">
        <ListRow icon="git-commit-outline" tint="amber" label="Update details"
          value={upd.running} hint={upd.detail} />
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
