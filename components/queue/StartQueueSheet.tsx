import React, { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, Linking, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist'
import { Colors, FontFamily, FontSize, Spacing, Radius, Type, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { getCart, clearCart, reorderCart, removeFromCart, type QueueItem } from '@/utils/queueCart'
import { Icon, type IconName } from '@/components/ui/Icon'
import { TrackRow } from '@/components/ui/TrackRow'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import {
  isPremium, fetchDevices, pickTarget, startQueue, classifyPlaybackError,
  type DeviceTarget,
} from '@/utils/playback'

type Phase =
  | 'checking' | 'ready' | 'premium' | 'scope'
  | 'opening'  | 'starting' | 'done' | 'error' | 'empty'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
const msgOf = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.')

/**
 * The start-queue flow (v1.5/v1.6). Opened from the floating tray / Queue tab (cart
 * mode) or from a rediscovery shelf's "Play now" (ad-hoc mode — `tracks` passed in,
 * the cart untouched). Drag-to-reorder + remove edit the working list; in cart mode
 * those write through to the cart. Handles the smart 3-state device onboarding,
 * the Premium gate, and the reconnect-for-scope path. Root-mounted, on the shared
 * Sheet — only its header drags, so the long-press reorder list keeps its gesture.
 */
export function StartQueueSheet({ visible, onClose, tracks }: {
  visible: boolean; onClose: () => void; tracks?: QueueItem[]
}) {
  const [phase, setPhase]   = useState<Phase>('checking')
  const [target, setTarget] = useState<DeviceTarget | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [shuffle, setShuffle] = useState(false)
  const [queue, setQueue]   = useState<QueueItem[]>([])
  const cancelled = useRef(false)
  const adhocRef  = useRef(false)
  const queueRef  = useRef<QueueItem[]>([])
  queueRef.current = queue

  useEffect(() => {
    if (visible) {
      cancelled.current = false
      const adhoc = !!(tracks && tracks.length)
      adhocRef.current = adhoc
      const seed = adhoc ? tracks! : getCart()
      setQueue(seed)
      prepare(seed)
    } else {
      cancelled.current = true
    }
    return () => { cancelled.current = true }
  }, [visible])

  // ── Flow ──
  async function prepare(seed?: QueueItem[]) {
    setErrMsg(null); setTarget(null); setShuffle(false)
    if ((seed ?? queueRef.current).length === 0) { setPhase('empty'); return }
    setPhase('checking')
    if (!(await isPremium())) { if (!cancelled.current) setPhase('premium'); return }
    try {
      const devs = await fetchDevices()
      if (cancelled.current) return
      setTarget(pickTarget(devs))
      setPhase('ready')
    } catch (err) {
      if (cancelled.current) return
      if (classifyPlaybackError(err) === 'scope') setPhase('scope')
      else { setErrMsg(msgOf(err)); setPhase('error') }
    }
  }

  async function doStart(deviceId?: string) {
    const uris = queueRef.current.map(i => i.uri)
    if (!uris.length) { setPhase('empty'); return }
    setPhase('starting')
    try {
      await startQueue(uris, { deviceId, shuffle })
      if (cancelled.current) return
      haptic.success()
      setPhase('done')
      if (!adhocRef.current) clearCart()   // ad-hoc "play now" leaves the cart alone
      setTimeout(() => { if (!cancelled.current) onClose() }, 1100)
    } catch (err) {
      if (cancelled.current) return
      const k = classifyPlaybackError(err)
      if (k === 'premium') setPhase('premium')
      else if (k === 'scope') setPhase('scope')
      else if (k === 'noDevice') { setErrMsg('That device went idle. Open Spotify and try again.'); setPhase('error') }
      else { setErrMsg(msgOf(err)); setPhase('error') }
    }
  }

  async function wakeAndStart() {
    setPhase('opening')
    try { await Linking.openURL('spotify://') } catch {
      try { await Linking.openURL('spotify:') } catch {}
    }
    for (let i = 0; i < 12; i++) {
      if (cancelled.current) return
      await delay(1300)
      if (cancelled.current) return
      try {
        const t = pickTarget(await fetchDevices())
        if (t.kind !== 'none') { setTarget(t); await doStart(t.device.id ?? undefined); return }
      } catch (err) {
        if (classifyPlaybackError(err) === 'scope') { setPhase('scope'); return }
      }
    }
    if (!cancelled.current) {
      setErrMsg('Couldn’t detect Spotify. Open it, press play once, then tap Start.')
      setPhase('error')
    }
  }

  function primary() {
    if (!target || target.kind === 'none') return wakeAndStart()
    return doStart(target.device.id ?? undefined)
  }

  // List edits — write through to the cart unless we're playing an ad-hoc set.
  function removeTrack(uri: string) {
    haptic.light()
    setQueue(q => q.filter(i => i.uri !== uri))
    if (!adhocRef.current) removeFromCart(uri)
  }
  function applyReorder(data: QueueItem[]) {
    setQueue(data)
    if (!adhocRef.current) reorderCart(data.map(i => i.uri))
  }

  function close() { cancelled.current = true; onClose() }
  function reconnect() { close(); router.push('/settings') }

  const renderRow = ({ item, drag, isActive }: RenderItemParams<QueueItem>) => (
    <ScaleDecorator activeScale={1.03}>
      <Pressable
        onLongPress={drag}
        delayLongPress={180}
        disabled={isActive}
        style={[styles.trackRow, isActive && styles.trackRowActive]}
        accessibilityLabel={`${item.name} by ${item.artist}`}
        accessibilityHint="Long-press and drag to reorder"
      >
        <Icon name="reorder-two" size={18} color={Colors.textMuted} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <TrackRow
            title={item.name} sub={item.artist} image={item.image}
            trailing={
              <Pressable
                onPress={() => removeTrack(item.uri)} hitSlop={8} style={styles.remove}
                accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`}
              >
                <Icon name="close" size={14} color={Colors.textMuted} />
              </Pressable>
            }
          />
        </View>
      </Pressable>
    </ScaleDecorator>
  )

  // ── Footer (per phase) ──
  function Footer() {
    switch (phase) {
      case 'checking':  return <Status spinner label="Finding a device…" />
      case 'opening':   return <Status spinner label="Opening Spotify…" />
      case 'starting':  return <Status spinner label="Starting your queue…" />
      case 'done':      return <Status icon="checkmark-circle" label="Playing on Spotify" tone="ok" />
      case 'empty':     return <Status label="Nothing to play — add some tracks first." tone="muted" />
      case 'premium':
        return (
          <Notice
            title="Spotify Premium required"
            body="Starting playback from another app needs a Premium account — it's a Spotify limit, not ours."
            actionLabel="Got it"
            onAction={close}
          />
        )
      case 'scope':
        return (
          <Notice
            title="Reconnect Spotify"
            body="Grant playback control once to start queues. It also switches on auto-updating Rewind."
            actionLabel="Reconnect Spotify"
            onAction={reconnect}
          />
        )
      case 'error':
        return (
          <Notice
            title="Couldn’t start"
            body={errMsg ?? 'Something went wrong.'}
            actionLabel="Try again"
            onAction={() => prepare()}
            tone="error"
          />
        )
      case 'ready': {
        const line =
          target?.kind === 'active' ? `Playing on ${target.device.name}` :
          target?.kind === 'idle'   ? `Ready on ${target.device.name}` :
          'No active device'
        const cta =
          target?.kind === 'idle' ? `Start on ${target.device.name}` :
          target?.kind === 'none' ? 'Open Spotify' :
          'Start queue'
        return (
          <View style={{ gap: Spacing.md }}>
            <View style={styles.deviceRow}>
              <View style={[styles.dot, { backgroundColor: target?.kind === 'active' ? Colors.greenPrimary : Colors.textMuted }]} />
              <Text style={styles.deviceText} numberOfLines={1}>{line}</Text>
              <Pressable onPress={() => { haptic.light(); setShuffle(s => !s) }} hitSlop={8} style={[styles.shuffle, shuffle && styles.shuffleOn]}
                accessibilityRole="switch" accessibilityLabel="Shuffle" accessibilityState={{ checked: shuffle }}
              >
                <Text style={[styles.shuffleText, shuffle && styles.shuffleTextOn]}><Icon name="shuffle" inline style={[styles.shuffleText, shuffle && styles.shuffleTextOn]} /> shuffle</Text>
              </Pressable>
            </View>
            <Button label={cta} onPress={primary} size="lg" fullWidth />
            {target?.kind === 'none' && (
              <Text style={styles.hint}>Spotify isn’t running. We’ll open it and start your queue automatically.</Text>
            )}
          </View>
        )
      }
    }
  }

  return (
    <Sheet
      open={visible}
      onClose={close}
      zIndex={60}
      scrolls
      header={
        <View style={styles.header}>
          <Text style={Type.heading} accessibilityRole="header">{adhocRef.current ? 'Play these' : 'Start a queue'}</Text>
          <Text style={styles.count}>{queue.length} {queue.length === 1 ? 'track' : 'tracks'}</Text>
        </View>
      }
    >
      {queue.length >= 2 && (
        <Text style={styles.reorderHint}>Hold and drag to reorder · tap × to remove</Text>
      )}

      <View style={styles.list}>
        <DraggableFlatList
          data={queue}
          keyExtractor={it => it.uri}
          renderItem={renderRow}
          onDragEnd={({ data }) => applyReorder(data)}
          activationDistance={12}
          contentContainerStyle={{ gap: 2 }}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <View style={styles.footer}><Footer /></View>
    </Sheet>
  )
}

// ── Small footer pieces ──
function Status({ label, spinner, tone, icon }: { label: string; spinner?: boolean; tone?: 'ok' | 'muted'; icon?: IconName }) {
  return (
    <View style={styles.statusRow}>
      {spinner && <ActivityIndicator size="small" color={Colors.greenPrimary} />}
      {icon && <Icon name={icon} size={15} color={tone === 'ok' ? Colors.greenPrimary : Colors.textMuted} />}
      <Text style={[styles.statusText, tone === 'ok' && { color: Colors.greenPrimary }, tone === 'muted' && { color: Colors.textMuted }]}>
        {label}
      </Text>
    </View>
  )
}

function Notice({ title, body, actionLabel, onAction, tone }: {
  title: string; body: string; actionLabel: string; onAction: () => void; tone?: 'error'
}) {
  return (
    <View style={{ gap: Spacing.sm }}>
      <Text style={[styles.noticeTitle, tone === 'error' && { color: Colors.error }]}>{title}</Text>
      <Text style={styles.noticeBody}>{body}</Text>
      <Button label={actionLabel} onPress={onAction} size="lg" fullWidth style={{ marginTop: Spacing.xs }} />
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  count: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted },
  reorderHint: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textDim, marginBottom: Spacing.xs },

  list: { maxHeight: 260 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, paddingHorizontal: 4, borderRadius: Radius.sm },
  trackRowActive: { backgroundColor: alpha(Colors.text, 0.05) },
  remove: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(Colors.text, 0.06) },

  footer: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  deviceText: { flex: 1, fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary },
  shuffle: { paddingVertical: 5, paddingHorizontal: Spacing.sm, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.glassBorder },
  shuffleOn: { borderColor: alpha(Colors.greenPrimary, 0.5), backgroundColor: alpha(Colors.greenPrimary, 0.12) },
  shuffleText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  shuffleTextOn: { color: Colors.greenPrimary },

  hint: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },

  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  statusText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary },

  noticeTitle: { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: Colors.text },
  noticeBody: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: FontSize.sm * 1.5 },
})
