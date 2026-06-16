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
    version: '1.5',
    name:    'Custom Queues',
    date:    '2026-06-16',
    sections: [
      {
        label: 'New',
        items: [
          'Custom Queues — build a queue from anywhere and play it straight on your Spotify. There’s a new Queue tab with a queue cart, a ＋ on tracks across the app, and a smart device hand-off (it’ll even wake Spotify for you). Spotify Premium required for playback.',
          'Rediscovery — let the Queue tab resurface music for you: Fading favorites (loved, then forgotten), Second chances (the ones that almost stuck), and a Time machine to a past season.',
          'Pull from your playlists — pick songs out of any playlist straight into your queue.',
          'Recap notifications — opt in from Settings › Recap notifications for a nudge when your weekly, monthly, seasonal or yearly recap is ready.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Compare now lives in a playlist’s long-press menu (“Compare with…”), making room for the Queue tab.',
          'A softer, fading top edge as you scroll — and the now-playing bar no longer covers the bottom of your lists.',
        ],
      },
    ],
  },
  {
    version: '1.4',
    name:    'Rewind & Refresh',
    date:    '2026-06-15',
    sections: [
      {
        label: 'New',
        items: [
          'Recaps — your listening by week, month, season and year, each with its own top artists, tracks and albums. Keep a season as a keepsake, archive a year, and revisit any of them from the Wrapped tab.',
          'Auto-updating Wrapped — your recent plays now top themselves up automatically, so your stats and the current week, month and season stay fresh between imports.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Recaps open straight from the Wrapped tab, with a quick switch between week, month, season and year.',
        ],
      },
    ],
  },
  {
    version: '1.3.1',
    name:    'Faces & Facets',
    date:    '2026-06-14',
    sections: [
      {
        label: 'New',
        items: [
          'Real artist faces — Wrapped now shows actual artist photos instead of album-cover stand-ins.',
          'Tap to go deeper, everywhere — open the full panel for any artist straight from your Taste profile and an expanded playlist, just like Wrapped already does.',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'Tidied the expanded-playlist stats — the duration now lines up neatly with the numbers beside it.',
        ],
      },
    ],
  },
  {
    version: '1.3',
    name:    'Pulse & Lively',
    date:    '2026-06-14',
    sections: [
      {
        label: 'New',
        items: [
          'Now playing — a live bar shows the track you’re streaming on Spotify. Tap it for your personal play count, listening time and rank for that song.',
          'Swipe to refresh — tidy any playlist Tinder-style with 30-second previews. Swipe to keep or cut, then save the keepers as a new playlist or trim the original (a backup is made first). Nothing changes until you confirm.',
          'Guided tour — a hands-on walkthrough that spotlights each part of the app and steps you through it. Replay anytime from Settings › Replay tutorial.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Place the now-playing bar where you like it — above the tab bar or up top on the Lenses screen (Settings › Appearance › Now playing).',
          'Reconnect Spotify right where you need it — an inline prompt on the now-playing bar and the Swipe tab, plus a permanent entry in Settings.',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'No more surprise logouts — your session now refreshes quietly in the background.',
          'Cleaning up a playlist no longer disturbs your lens analyses or Compare.',
        ],
      },
    ],
  },
  {
    version: '1.2',
    name:    'Expressive Expressions',
    date:    '2026-06-11',
    sections: [
      {
        label: 'New',
        items: [
          'Light mode — a bright new theme for the whole app. Flip between Dark and Light in Settings › Appearance.',
          'Accent colours — six to choose from. Your pick flows through every screen, button and highlight.',
          'Fonts — swap the body typeface (DM Mono, Space Mono or IBM Plex Mono). The playlist.lens wordmark and headers stay on-brand.',
          'Pick your navigation — the floating bar, a minimal icons-only pill, or no bar at all (swipe anywhere to switch tabs).',
          'Grid or list — view your lenses as full-width cards or a compact two-column grid, toggled right on the Lenses screen.',
          'Custom home banner — add your own line to the home screen’s rotating tips.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Everything you pick is saved instantly and applies with a quick restart — accent, font, theme and navigation all in one new Appearance section.',
          'Your accent automatically adapts between dark and light so it always stays readable.',
        ],
      },
    ],
  },
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
