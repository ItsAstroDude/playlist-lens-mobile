/**
 * Colour utilities — contrast clamping + vibe→colour mapping.
 *
 * The app extracts a dominant colour from each playlist's cover art and uses it
 * as an accent. Dark covers produce dark accents that are illegible on the
 * #131315 background, so `ensureReadable` lifts any colour toward white until it
 * clears a minimum WCAG contrast ratio — keeping the hue, fixing the legibility.
 */
import { Colors } from '@/constants/theme'

const BG: RGB = [0x13, 0x13, 0x15] // app background #131315

type RGB = [number, number, number]

function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(rgb: RGB): string {
  const c = (x: number) =>
    Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')
  return `#${c(rgb[0])}${c(rgb[1])}${c(rgb[2])}`
}

function luminance(rgb: RGB): number {
  const f = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2])
}

function contrast(a: RGB, b: RGB): number {
  const la = luminance(a)
  const lb = luminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Returns `hex` unchanged if it already meets `min` contrast against the app
 * background; otherwise blends it toward white in 10% steps until it does.
 */
export function ensureReadable(hex: string | null | undefined, min = 3.5): string {
  if (!hex) return Colors.greenPrimary
  let rgb: RGB
  try { rgb = hexToRgb(hex) } catch { return Colors.greenPrimary }

  if (contrast(rgb, BG) >= min) return rgbToHex(rgb)

  const white: RGB = [255, 255, 255]
  for (let t = 0.1; t < 1; t += 0.1) {
    const mixed: RGB = [
      rgb[0] + (white[0] - rgb[0]) * t,
      rgb[1] + (white[1] - rgb[1]) * t,
      rgb[2] + (white[2] - rgb[2]) * t,
    ]
    if (contrast(mixed, BG) >= min) return rgbToHex(mixed)
  }
  return '#ffffff'
}

/**
 * A single source of truth for vibe→accent colour, used by every screen that
 * renders a vibe label (cards, compare, taste, friends). All returned colours
 * are bright enough to read on the dark background.
 */
export function vibeColor(vibe?: string | null): string {
  if (!vibe) return Colors.greenPrimary
  const v = vibe.toLowerCase()
  if (v.includes('dark') || v.includes('intense'))                         return Colors.pink
  if (v.includes('melanchol') || v.includes('calm') || v.includes('instrumental')) return Colors.lavender
  if (v.includes('raw') || v.includes('organic') || v.includes('acoustic')) return Colors.warning
  // "made to move", "feel-good", "upbeat", and anything energetic
  return Colors.greenPrimary
}
