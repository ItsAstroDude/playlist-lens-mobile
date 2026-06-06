/**
 * Tests for utils/color.ts — the contrast clamp that keeps cover-derived
 * accents legible, and the vibe→colour mapping.
 */
import { ensureReadable, vibeColor } from '../utils/color'
import { Colors } from '../constants/theme'

// Relative luminance, mirrored from the implementation, for assertions.
function lum(hex: string): number {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

describe('ensureReadable', () => {
  it('leaves an already-bright colour untouched', () => {
    expect(ensureReadable('#53e076')).toBe('#53e076')
  })

  it('lifts a too-dark colour toward white', () => {
    const dark = '#3a0a0a' // near-black maroon — the Compare bug
    const out  = ensureReadable(dark)
    expect(out).not.toBe(dark)
    expect(lum(out)).toBeGreaterThan(lum(dark))
  })

  it('falls back to the brand green for null/undefined', () => {
    expect(ensureReadable(null)).toBe(Colors.greenPrimary)
    expect(ensureReadable(undefined)).toBe(Colors.greenPrimary)
  })

  it('produces a result that clears the contrast floor', () => {
    // A pure dark blue that fails against #131315 should be lifted enough to read.
    const out = ensureReadable('#101a4a')
    expect(lum(out)).toBeGreaterThan(lum('#101a4a'))
  })
})

describe('vibeColor', () => {
  it('maps dark/intense vibes to pink', () => {
    expect(vibeColor('🌑 Intense & dark')).toBe(Colors.pink)
  })

  it('maps melancholic / calm / instrumental to lavender', () => {
    expect(vibeColor('🌙 Melancholic & calm')).toBe(Colors.lavender)
    expect(vibeColor('🎹 Instrumental')).toBe(Colors.lavender)
  })

  it('maps raw & organic to the warm accent', () => {
    expect(vibeColor('🎸 Raw & organic')).toBe(Colors.warning)
  })

  it('defaults energetic / unknown vibes to brand green', () => {
    expect(vibeColor('💃 Made to move')).toBe(Colors.greenPrimary)
    expect(vibeColor('🎉 Feel-good & upbeat')).toBe(Colors.greenPrimary)
    expect(vibeColor(null)).toBe(Colors.greenPrimary)
  })
})
