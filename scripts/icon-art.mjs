/**
 * playlist.lens — app icon artwork (SVG source of truth).
 *
 * "The Aperture": six lens blades in the brand green, opening onto a dark iris
 * with a 3-bar equalizer inside — a lens on your music. Pure geometry, so it stays crisp
 * from the 1024px store icon down to a 24px notification badge.
 *
 * Exports SVG strings for each asset; scripts/render-icons.mjs rasterises them.
 */
const TAU = Math.PI * 2
const f = n => n.toFixed(2)

// ── Colourways (2.0 icon picker) ──────────────────────────────────────────────
// The default green keeps its original hand-tuned stops; the other accents derive
// theirs from the accent hex (same recipe: a light top, the accent, a deep bottom).
const hexRgb = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const rgbHex = c => '#' + c.map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('').toUpperCase()
const mix = (a, b, t) => rgbHex(hexRgb(a).map((x, i) => x + (hexRgb(b)[i] - x) * t))

const GREEN = { light: '#9BF7B2', mid: '#53E076', dark: '#1E9E4A', dotHi: '#E9FFEF', dotMid: '#7CF29A', bgTint: '#1F3A28' }
export function palette(hex) {
  if (!hex || hex.toUpperCase() === GREEN.mid) return GREEN
  return {
    light: mix(hex, '#FFFFFF', 0.42), mid: hex.toUpperCase(), dark: mix(hex, '#000000', 0.42),
    dotHi: mix(hex, '#FFFFFF', 0.88), dotMid: mix(hex, '#FFFFFF', 0.3),
    bgTint: mix('#121417', hex, 0.16),
  }
}

/** The picker's colourways — one per Appearance accent. `name` is the Android alias. */
export const ICON_VARIANTS = [
  { name: 'Default',  label: 'Neon Green', hex: '#53E076' },
  { name: 'Lavender', label: 'Lavender',   hex: '#CCBDFF' },
  { name: 'Pink',     label: 'Hot Pink',   hex: '#FF70A5' },
  { name: 'Sky',      label: 'Sky',        hex: '#4FC3F7' },
  { name: 'Amber',    label: 'Amber',      hex: '#FFB347' },
  { name: 'Coral',    label: 'Coral',      hex: '#FF7A5C' },
]

/**
 * Aperture mark centred at (cx, cy).
 *  R = outer radius, r = iris (hexagon) radius, gap = blade-separator width.
 *  mono = single-colour silhouette (Android themed icon).
 */
export function aperture({ cx, cy, R, r, gap, mono = false, id = 'a', color }) {
  const P = palette(color)
  const rot = -Math.PI / 2 + Math.PI / 6          // flat-topped iris, blades spiral clockwise
  const v = Array.from({ length: 6 }, (_, i) => {
    const t = rot + (i * TAU) / 6
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)]
  })
  // Each separator extends a hexagon edge past its vertex out to the rim.
  const seps = v.map((p, i) => {
    const q = v[(i + 5) % 6]                        // previous vertex
    const dx = p[0] - q[0], dy = p[1] - q[1]
    const len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len
    // solve |p + t·u - c| = R for t > 0
    const px = p[0] - cx, py = p[1] - cy
    const b = px * ux + py * uy
    const t = -b + Math.sqrt(b * b - (px * px + py * py - R * R))
    return `M${f(p[0])},${f(p[1])} L${f(p[0] + ux * (t + gap))},${f(p[1] + uy * (t + gap))}`
  })
  const hex = `M${v.map(p => `${f(p[0])},${f(p[1])}`).join(' L')} Z`

  if (mono) {
    // White-on-transparent: ring of blades with the iris + separators cut out.
    return `
      <defs><mask id="${id}m">
        <circle cx="${cx}" cy="${cy}" r="${R}" fill="#fff"/>
        <path d="${hex}" fill="#000" stroke="#000" stroke-width="${gap}" stroke-linejoin="round"/>
        <path d="${seps.join(' ')}" stroke="#000" stroke-width="${gap}" stroke-linecap="round"/>
      </mask></defs>
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="#fff" mask="url(#${id}m)"/>
      ${eqBars(cx, cy, r, '#fff')}`
  }

  return `
    <defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0"   stop-color="${P.light}"/>
        <stop offset="0.45" stop-color="${P.mid}"/>
        <stop offset="1"   stop-color="${P.dark}"/>
      </linearGradient>
      <radialGradient id="${id}iris" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0"   stop-color="#1B1B21"/>
        <stop offset="1"   stop-color="#08080B"/>
      </radialGradient>
      <radialGradient id="${id}dot" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0"    stop-color="${P.dotHi}"/>
        <stop offset="0.35" stop-color="${P.dotMid}"/>
        <stop offset="1"    stop-color="${P.mid}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${id}spec" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.55"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <mask id="${id}m">
        <circle cx="${cx}" cy="${cy}" r="${R}" fill="#fff"/>
        <path d="${hex}" fill="#000" stroke="#000" stroke-width="${gap}" stroke-linejoin="round"/>
        <path d="${seps.join(' ')}" stroke="#000" stroke-width="${gap}" stroke-linecap="round"/>
      </mask>
    </defs>
    <!-- blades -->
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${id}g)" mask="url(#${id}m)"/>
    <!-- iris -->
    <path d="${hex}" fill="url(#${id}iris)" stroke="url(#${id}iris)" stroke-width="${gap * 0.4}" stroke-linejoin="round"/>
    <!-- the music inside the lens — a 3-bar equalizer with a soft glow -->
    <circle cx="${cx}" cy="${cy}" r="${r * 0.78}" fill="url(#${id}dot)" opacity="0.35"/>
    ${eqBars(cx, cy, r, 'url(#' + id + 'g)')}`
}

/** Three rounded equalizer bars sized to sit inside the iris. */
function eqBars(cx, cy, r, fill) {
  const w = r * 0.2, gap = r * 0.13
  const hs = [0.62, 1.0, 0.78].map(k => k * r * 0.95)
  return hs.map((h, i) => {
    const x = cx + (i - 1) * (w + gap) - w / 2
    return `<rect x="${f(x)}" y="${f(cy + r * 0.47 - h)}" width="${f(w)}" height="${f(h)}" rx="${f(w / 2)}" fill="${fill}"/>`
  }).join('')
}

const svg = (w, h, body, bg = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg}${body}</svg>`

const BG = (s, hex) => `
  <defs>
    <radialGradient id="bgglow" cx="0.5" cy="0.46" r="0.62">
      <stop offset="0"   stop-color="${palette(hex).bgTint}"/>
      <stop offset="0.55" stop-color="#121417"/>
      <stop offset="1"   stop-color="#0B0B0E"/>
    </radialGradient>
  </defs>
  <rect width="${s}" height="${s}" fill="url(#bgglow)"/>`

/** iOS / store icon — full-bleed square, opaque (the OS rounds the corners). */
export const iconSvg = () =>
  svg(1024, 1024, aperture({ cx: 512, cy: 512, R: 318, r: 128, gap: 24 }), BG(1024))

/** Android adaptive foreground — transparent; mark kept inside the 66% safe circle. */
export const adaptiveSvg = (hex) =>
  svg(1024, 1024, aperture({ cx: 512, cy: 512, R: 250, r: 100, gap: 19, color: hex }))

/** In-app picker preview — the full square icon in a colourway. */
export const previewSvg = (hex) =>
  svg(1024, 1024, aperture({ cx: 512, cy: 512, R: 318, r: 128, gap: 24, color: hex, id: 'p' }), BG(1024, hex))

/** Android 13+ themed icon — single-colour silhouette, same safe zone. */
export const monochromeSvg = () =>
  svg(1024, 1024, aperture({ cx: 512, cy: 512, R: 250, r: 100, gap: 22, mono: true, id: 'm' }))

/** Splash — the mark alone on transparent (splash bg colour comes from app.json). */
export const splashSvg = () =>
  svg(1024, 1024, aperture({ cx: 512, cy: 512, R: 300, r: 120, gap: 22, id: 's' }))

/** Web favicon. */
export const faviconSvg = () =>
  svg(48, 48, aperture({ cx: 24, cy: 24, R: 20, r: 8.5, gap: 1.8, id: 'f' }), BG(48))
