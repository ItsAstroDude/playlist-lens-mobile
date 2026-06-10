/**
 * In-app changelog + first-run flags.
 *
 * Patch notes auto-show once after an update bumps the top CHANGELOG version
 * (decoupled from the OTA mechanics — just compare the stored "seen" version).
 * The tutorial shows once ever (separate flag), and can be replayed from Settings.
 */
import { storage } from '@/utils/cache'

export type ChangeKind = 'New' | 'Improved' | 'Fixed'

export interface PatchEntry {
  version:  string
  name:     string
  date:     string
  sections: { label: ChangeKind; items: string[] }[]
}

// Newest first. Bump the top entry's `version` whenever a drop should surface notes.
export const CHANGELOG: PatchEntry[] = [
  {
    version: '1.1',
    name:    'Polish & Power',
    date:    '2026-06-09',
    sections: [
      {
        label: 'New',
        items: [
          'Wrapped — import your lifetime Spotify history for all-time stats. Tap any artist, track or album for its own art panel.',
          'Over-the-air updates — fixes and features now arrive without reinstalling the app.',
          'Drag-to-reorder your lenses, plus long-press for quick actions: Pin to top, Share, Re-analyze.',
          'Fix a wrong cover yourself: pick a candidate, re-search, or upload your own image.',
          'New Settings: reduce motion, show artwork, clear Wrapped history, and a flagged-covers list.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'A new floating navbar that auto-hides as you scroll, with a cleaner icon set and bouncier feel.',
          'Livelier ambient backgrounds and a stat-aware tips strip on the home screen.',
          'Springier, more tactile presses across the whole app.',
          'An on-brand prompt when an update is ready (bye, stock popup).',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'Deleted Spotify playlists now quietly remove themselves instead of erroring.',
          'Artist artwork matches the right artist (Tyler, Kendrick and friends).',
          'The home tips strip no longer jumps around when you pull to refresh.',
          'The “upload your own cover” button is no longer hidden behind the navbar.',
        ],
      },
    ],
  },
]

const SEEN_KEY = 'patch_seen_version'
const TUT_KEY  = 'tutorial_seen_v1'

export function latestPatch(): PatchEntry { return CHANGELOG[0] }

// ── Patch notes ──
export function shouldShowWhatsNew(): boolean {
  const seen = storage.getString(SEEN_KEY)
  if (seen === undefined) return false      // fresh install → tutorial handles first-run
  return seen !== latestPatch().version
}
export function markWhatsNewSeen(): void { storage.set(SEEN_KEY, latestPatch().version) }

// ── Tutorial ──
export function shouldShowTutorial(): boolean { return storage.getBoolean(TUT_KEY) !== true }
export function markTutorialSeen(): void {
  storage.set(TUT_KEY, true)
  // Prevent the patch-notes popup from firing right after onboarding.
  if (storage.getString(SEEN_KEY) === undefined) storage.set(SEEN_KEY, latestPatch().version)
}
export function replayTutorial(): void { storage.set(TUT_KEY, false) }
