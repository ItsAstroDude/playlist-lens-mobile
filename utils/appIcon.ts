/**
 * App icon picker (2.0) — the Aperture in each Appearance accent.
 *
 * Android swaps the launcher icon by enabling one activity alias and disabling the
 * rest (expo-alternate-app-icons; aliases from app.json, artwork from
 * scripts/icon-art.mjs). The change shows once the launcher refreshes — usually a
 * few seconds.
 */
import { Platform, type ImageSourcePropType } from 'react-native'

export interface AppIconOption {
  name:     'Default' | 'Lavender' | 'Pink' | 'Sky' | 'Amber' | 'Coral'
  label:    string
  accentId: string
  preview:  ImageSourcePropType
}

export const APP_ICONS: AppIconOption[] = [
  { name: 'Default',  label: 'Neon Green', accentId: 'green',    preview: require('@/assets/icons/default-preview.png') },
  { name: 'Lavender', label: 'Lavender',   accentId: 'lavender', preview: require('@/assets/icons/lavender-preview.png') },
  { name: 'Pink',     label: 'Hot Pink',   accentId: 'pink',     preview: require('@/assets/icons/pink-preview.png') },
  { name: 'Sky',      label: 'Sky',        accentId: 'sky',      preview: require('@/assets/icons/sky-preview.png') },
  { name: 'Amber',    label: 'Amber',      accentId: 'amber',    preview: require('@/assets/icons/amber-preview.png') },
  { name: 'Coral',    label: 'Coral',      accentId: 'coral',    preview: require('@/assets/icons/coral-preview.png') },
]

type Native = {
  supportsAlternateIcons: boolean
  getAppIconName(): string | null
  setAlternateAppIcon(name: string | null): Promise<string | null>
}
// The native module only exists in builds that include it (2.0+).
function native(): Native | null {
  try { return require('expo-alternate-app-icons') as Native } catch { return null }
}

export function appIconsSupported(): boolean {
  // iOS needs its own icon set in app.json (the plugin's `ios` images) — none yet, so the
  // picker stays Android-only until the first iOS build adds them.
  if (Platform.OS !== 'android') return false
  try { return !!native()?.supportsAlternateIcons } catch { return false }
}

/** The active icon ('Default' when no alternate is set). */
export function getAppIcon(): AppIconOption['name'] {
  try {
    const n = native()?.getAppIconName() ?? null
    return (APP_ICONS.find(i => i.name === n)?.name) ?? 'Default'
  } catch { return 'Default' }
}

export async function setAppIcon(name: AppIconOption['name']): Promise<void> {
  const m = native()
  if (!m) throw new Error('Icon switching needs the 2.0 app build.')
  await m.setAlternateAppIcon(name === 'Default' ? null : name)
}

/** The icon that matches an Appearance accent. */
export function iconForAccent(accentId: string): AppIconOption {
  return APP_ICONS.find(i => i.accentId === accentId) ?? APP_ICONS[0]
}
