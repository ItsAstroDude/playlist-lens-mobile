import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Screen, ScreenHeader, Section, ListRow, EmptyState, Card } from '@/components/ui'
import { Colors, Spacing, Type } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { confirmDialog } from '@/utils/dialog'
import {
  fetchErrors, flushErrors, pendingErrors, sentErrors, clearErrors, type ErrorReport,
} from '@/utils/errorReport'

/**
 * Settings › About › Errors — crash + error reports from this account, read back from
 * your backend (falls back to what this phone sent when the server can't be reached).
 */
export default function ErrorsScreen() {
  const [items, setItems]     = useState<ErrorReport[] | null>(null)
  const [offline, setOffline] = useState(false)
  const [pending, setPending] = useState(pendingErrors().length)
  const [open, setOpen]       = useState<number | null>(null)

  const load = useCallback(async () => {
    await flushErrors()
    setPending(pendingErrors().length)
    try { setItems(await fetchErrors()); setOffline(false) }
    catch { setItems(sentErrors()); setOffline(true) }
  }, [])
  useEffect(() => { load() }, [load])

  const onClear = () => confirmDialog({
    glyph: 'trash-outline', destructive: true, confirmLabel: 'Clear',
    title: 'Clear error reports?',
    message: 'Deletes every report from your server and this phone.',
    onConfirm: async () => { try { await clearErrors() } catch {} ; load() },
  })

  return (
    <Screen>
      <ScreenHeader mainScreenOnly title="errors" subtitle="Crashes and errors, sent to your own server" />

      {pending > 0 && (
        <Card tone="accent">
          <ListRow icon="cloud-upload-outline" label={`${pending} waiting to send`}
            hint="They go out automatically when the server is reachable"
            onPress={() => { haptic.light(); load() }} last />
        </Card>
      )}

      {items === null ? (
        <ActivityIndicator color={Colors.greenPrimary} style={{ marginTop: Spacing['3xl'] }} />
      ) : items.length === 0 ? (
        <EmptyState icon="checkmark-circle-outline" title="No errors"
          body={offline ? 'Couldn’t reach the server — nothing sent from this phone either.' : 'Nothing has gone wrong. Long may it last.'} />
      ) : (
        <>
          <Section label={offline ? 'sent from this phone (server unreachable)' : `${items.length} most recent`}>
            {items.map((e, i) => (
              <View key={`${e.at}${i}`}>
                <ListRow
                  icon={e.fatal ? 'warning-outline' : 'bug-outline'} tint={e.fatal ? 'pink' : 'amber'}
                  label={e.message.split('\n')[0]}
                  hint={[new Date(e.at).toLocaleString(), e.screen, e.version && `v${e.version}`].filter(Boolean).join(' · ')}
                  onPress={() => setOpen(open === i ? null : i)}
                  last={i === items.length - 1 && open !== i}
                />
                {open === i && (
                  <View style={styles.detail}>
                    <Text style={styles.mono} selectable>{e.message}</Text>
                    {e.stack ? <Text style={[styles.mono, styles.stack]} selectable>{e.stack}</Text> : null}
                    <Text style={Type.caption}>{[e.platform, e.update && `update ${e.update.slice(0, 8)}`].filter(Boolean).join(' · ')}</Text>
                  </View>
                )}
              </View>
            ))}
          </Section>
          <Section>
            <ListRow icon="trash-outline" label="Clear reports" danger onPress={onClear} last />
          </Section>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  detail:  { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.sm },
  mono:    { ...Type.caption, color: Colors.textSecondary },
  stack:   { color: Colors.textMuted },
})
