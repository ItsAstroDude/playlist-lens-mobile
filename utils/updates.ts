/**
 * Over-the-air update helpers (EAS Update / expo-updates).
 *
 * The app auto-checks on launch (app.json → updates.checkAutomatically ON_LOAD),
 * so most fixes land silently on the next cold start. This wrapper powers the
 * manual "Check for updates" row in Settings and guards every call behind
 * `Updates.isEnabled` so it's a no-op in Expo Go / dev where OTA isn't wired.
 */
import * as Updates from 'expo-updates'

export type UpdateOutcome =
  | 'disabled'      // OTA not available (dev client / Expo Go)
  | 'checking'
  | 'none'          // already on the latest bundle
  | 'downloading'
  | 'ready'         // fetched — caller should reload to apply
  | 'error'

export function otaEnabled(): boolean {
  return Updates.isEnabled
}

/** Current bundle id, short — handy to show in About. */
export function currentUpdateLabel(): string {
  if (!Updates.isEnabled) return 'dev'
  if (Updates.isEmbeddedLaunch) return 'base build'
  const id = Updates.updateId
  return id ? id.slice(0, 8) : 'base build'
}

/**
 * Check for and (if found) download a newer bundle. Returns the outcome so the
 * UI can report it. Does NOT reload — the caller decides when to apply.
 */
export async function checkForUpdate(
  onStage?: (s: UpdateOutcome) => void,
): Promise<UpdateOutcome> {
  if (!Updates.isEnabled) { onStage?.('disabled'); return 'disabled' }
  try {
    onStage?.('checking')
    const res = await Updates.checkForUpdateAsync()
    if (!res.isAvailable) { onStage?.('none'); return 'none' }
    onStage?.('downloading')
    await Updates.fetchUpdateAsync()
    onStage?.('ready')
    return 'ready'
  } catch {
    onStage?.('error')
    return 'error'
  }
}

export async function applyUpdate(): Promise<void> {
  if (Updates.isEnabled) await Updates.reloadAsync()
}
