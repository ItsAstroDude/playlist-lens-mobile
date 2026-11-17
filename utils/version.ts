import Constants from 'expo-constants'
import { latestPatch } from '@/utils/whatsNew'

/**
 * The version users see. Releases ship over-the-air, and bumping app.json's
 * `version` would change the runtime fingerprint (cutting existing installs off
 * from OTA updates) — so the release version comes from the newest patch-notes
 * entry, which every drop bumps anyway.
 */
export function appVersion(): string {
  return latestPatch().version
}

/** The native build's version (app.json) — only changes with a new store/APK build. */
export function nativeVersion(): string {
  return Constants.expoConfig?.version ?? '—'
}
