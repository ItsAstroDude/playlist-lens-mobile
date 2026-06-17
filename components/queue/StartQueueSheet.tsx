import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, BackHandler, Linking, ActivityIndicator, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { router } from 'expo-router'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing } from 'react-native-reanimated'
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist'
import { Colors, FontFamily, FontSize, Spacing, Radius, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { getCart, clearCart, reorderCart, removeFromCart, type QueueItem } from '@/utils/queueCart'
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
 * the Premium gate, and the reconnect-for-scope path. Root-mounted.
 */
export function StartQueueSheet({ visible, onClose, tracks }: {
  visible: boolean; onClose: () => void; tracks?: QueueItem[]
}) {
  const insets = useSafeAreaInsets()
  const [phase, setPhase]   = useState<Phase>('checking')
  const [target, setTarget] = useState<DeviceTarget | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [shuffle, setShuffle] = useState(false)
  const [queue, setQueue]   = useState<QueueItem[]>([])
  const cancelled = useRef(false)
  const adhocRef  = useRef(false)
  const queueRef  = useRef<QueueItem[]>([])
  queueRef.current = queue

  const ty       = useSharedValue(800)
  const backdrop = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      cancelled.current = false
      const adhoc = !!(tracks && tracks.length)
      adhocRef.current = adhoc
      const seed = adhoc ? tracks! : getCart()
      setQueue(seed)
      ty.value       = withSpring(0, Spring.sheet)
      backdrop.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) })
      prepare(seed)
    } else {
      cancelled.current = true
      ty.value       = withTiming(800, { duration: 220 })
      backdrop.value = withTiming(0, { duration: 160 })
    }
    return () => { cancelled.current = true }
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true })
    return () => sub.remove()
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
    haptic.medium()
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

  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }))

  const renderRow = ({ item, drag, isActive }: RenderItemParams<QueueItem>) => (
    <ScaleDecorator activeScale={1.03}>
      <Pressable
        onLongPress={drag}
        delayLongPress={180}
        disabled={isActive}
        style={[styles.trackRow, isActive && styles.trackRowActive]}
      >
        {item.image
          ? <Image source={{ uri: item.image }} style={styles.cover} />
          : <View style={[styles.cover, styles.coverEmpty]}><Text style={styles.coverGlyph}>♪</Text></View>}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.trackName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
        </View>
        <Pressable onPress={() => removeTrack(item.uri)} hitSlop={8} style={styles.remove}>
          <Text style={styles.removeGlyph}>✕</Text>
        </Pressable>
      </Pressable>
    </ScaleDecorator>
  )

  // ── Footer (per phase) ──
  function Footer() {
    switch (phase) {
      case 'checking':  return <Status spinner label="Finding a device…" />
      case 'opening':   return <Status spinner label="Opening Spotify…" />
      case 'starting':  return <Status spinner label="Starting your queue…" />
      case 'done':      return <Status label="✦ Playing on Spotify" tone="ok" />
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
            body="Grant playback control once to start queues. It also switches on auto-updating Wrapped."
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
              <Pressable onPress={() => { haptic.light(); setShuffle(s => !s) }} hitSlop={8} style={[styles.shuffle, shuffle && styles.shuffleOn]}>
                <Text style={[styles.shuffleText, shuffle && styles.shuffleTextOn]}>⇄ shuffle</Text>
              </Pressable>
            </View>
            <Pressable style={styles.startBtn} onPress={primary} accessibilityRole="button">
              <Text style={styles.startText} numberOfLines={1}>{cta}</Text>
            </Pressable>
            {target?.kind === 'none' && (
              <Text style={styles.hint}>Spotify isn’t running. We’ll open it and start your queue automatically.</Text>
            )}
          </View>
        )
      }
    }
  }

  return (
    <Animated.View style={[styles.root, backdropStyle]} pointerEvents={visible ? 'auto' : 'none'}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close}>
        <BlurView intensity={16} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>

      <Animated.View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + Spacing.md }, sheetStyle]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{adhocRef.current ? 'Play these' : 'Start a queue'}</Text>
          <Text style={styles.count}>{queue.length} {queue.length === 1 ? 'track' : 'tracks'}</Text>
        </View>

        {queue.length >= 2 && (
          <Text style={styles.reorderHint}>Long-press to reorder · ✕ to remove</Text>
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
      </Animated.View>
    </Animated.View>
  )
}

// ── Small footer pieces ──
function Status({ label, spinner, tone }: { label: string; spinner?: boolean; tone?: 'ok' | 'muted' }) {
  return (
    <View style={styles.statusRow}>
      {spinner && <ActivityIndicator size="small" color={Colors.greenPrimary} />}
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
      <Pressable style={styles.noticeBtn} onPress={() => { haptic.medium(); onAction() }} accessibilityRole="button">
        <Text style={styles.noticeBtnText}>{actionLabel}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 60, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: Colors.sheet, borderTopLeftRadius: Radius['2xl'], borderTopRightRadius: Radius['2xl'],
    borderWidth: 1, borderColor: Colors.glassBorder, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 24,
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: Spacing.sm },
  title: { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: Colors.text, letterSpacing: -0.5 },
  count: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted },
  reorderHint: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textDim, marginBottom: Spacing.xs },

  list: { maxHeight: 260 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, paddingHorizontal: 4, borderRadius: Radius.sm },
  trackRowActive: { backgroundColor: alpha(Colors.text, 0.05) },
  cover: { width: 38, height: 38, borderRadius: Radius.sm, backgroundColor: Colors.glass },
  coverEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.glassBorder },
  coverGlyph: { fontFamily: FontFamily.mono, fontSize: FontSize.md, color: Colors.textMuted },
  trackName: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.text },
  trackArtist: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  remove: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(Colors.text, 0.06) },
  removeGlyph: { fontFamily: FontFamily.mono, fontSize: 12, color: Colors.textMuted, marginTop: -1 },

  footer: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  deviceText: { flex: 1, fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary },
  shuffle: { paddingVertical: 5, paddingHorizontal: Spacing.sm, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.glassBorder },
  shuffleOn: { borderColor: alpha(Colors.greenPrimary, 0.5), backgroundColor: alpha(Colors.greenPrimary, 0.12) },
  shuffleText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  shuffleTextOn: { color: Colors.greenPrimary },

  startBtn: { backgroundColor: Colors.greenPrimary, borderRadius: Radius.full, paddingVertical: Spacing.md, alignItems: 'center' },
  startText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.md, color: Colors.background, letterSpacing: 0.3 },
  hint: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },

  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  statusText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary },

  noticeTitle: { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: Colors.text },
  noticeBody: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: FontSize.sm * 1.5 },
  noticeBtn: { backgroundColor: Colors.greenPrimary, borderRadius: Radius.full, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.xs },
  noticeBtnText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.md, color: Colors.background },
})
