/**
 * Recap notifications (v1.5 S4) — local + on-device, no push server.
 *
 * Opt-in (off until the Settings toggle is flipped). When enabled we schedule a
 * small set of REPEATING calendar triggers that nudge when a recap period closes:
 * weekly (Mon), monthly (1st), seasonal (Mar/Jun/Sep/Dec 1) and yearly (Jan 1).
 * Tapping one opens the Recaps screen (wired in app/_layout). Android delivery is
 * best-effort (Doze / exact-alarm limits) — fine for a gentle nudge.
 */
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { storage } from '@/utils/cache'

const ENABLED_KEY = 'settings.notifications'
const CHANNEL_ID  = 'recaps'

export function notificationsEnabled(): boolean {
  return storage.getBoolean(ENABLED_KEY) ?? false
}
function setEnabledFlag(on: boolean): void { storage.set(ENABLED_KEY, on) }

// Show a banner even if the app is foregrounded when one fires.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  false,
    shouldSetBadge:   false,
  }),
})

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name:       'Recaps',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#53e076',
  })
}

async function requestPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return true
  const req = await Notifications.requestPermissionsAsync()
  return req.granted
}

const RECAP_DATA = { kind: 'recap' as const }

async function schedule(title: string, body: string, trigger: Notifications.NotificationTriggerInput): Promise<void> {
  await Notifications.scheduleNotificationAsync({ content: { title, body, data: RECAP_DATA }, trigger })
}

/** Wipe + (re)schedule the full set. Safe to call repeatedly. */
export async function scheduleRecapNotifications(): Promise<void> {
  await ensureChannel()
  await Notifications.cancelAllScheduledNotificationsAsync()
  const T = Notifications.SchedulableTriggerInputTypes

  await schedule('Your week in sound ✦', 'See what you played this week.',
    { type: T.WEEKLY, weekday: 2, hour: 18, minute: 0, channelId: CHANNEL_ID })
  await schedule('Your month, wrapped ✦', 'A fresh monthly recap is ready.',
    { type: T.MONTHLY, day: 1, hour: 18, minute: 5, channelId: CHANNEL_ID })
  for (const month of [3, 6, 9, 12]) {
    await schedule('A season just wrapped ✦', 'Your seasonal recap is ready to revisit.',
      { type: T.YEARLY, month, day: 1, hour: 19, minute: 0, channelId: CHANNEL_ID })
  }
  await schedule('Your year in music ✦', 'Your yearly recap is ready to revisit.',
    { type: T.YEARLY, month: 1, day: 1, hour: 20, minute: 0, channelId: CHANNEL_ID })
}

export async function cancelRecapNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()
}

/**
 * Settings toggle entry point. Requesting permission may be denied → returns the
 * resulting state (false if denied), which the UI reflects.
 */
export async function setNotificationsEnabled(on: boolean): Promise<boolean> {
  if (!on) {
    await cancelRecapNotifications()
    setEnabledFlag(false)
    return false
  }
  if (!(await requestPermission())) {
    setEnabledFlag(false)
    return false
  }
  await scheduleRecapNotifications()
  setEnabledFlag(true)
  return true
}

/** Re-assert the schedule on launch if the user has it enabled. Best-effort. */
export async function syncNotificationsOnLaunch(): Promise<void> {
  if (!notificationsEnabled()) return
  try {
    if (await requestPermission()) await scheduleRecapNotifications()
    else setEnabledFlag(false)   // permission revoked in OS settings → reflect it
  } catch { /* best-effort */ }
}
