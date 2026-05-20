/**
 * playlist.lens — icon generator
 *
 * Generates all three icon assets:
 *   assets/icon.png           — 1024×1024, solid dark bg (iOS / general)
 *   assets/adaptive-icon.png  — 1024×1024, transparent bg (Android adaptive)
 *   assets/splash-icon.png    — 1024×1024, transparent bg (Expo splash)
 *
 * Design: "The Lens" — a glowing green sphere with a dark iris at the center,
 * referencing the "." in playlist.lens. Glass specular highlight gives depth.
 *
 * Run: node scripts/generate-icons.js
 */

const { createCanvas } = require('canvas')
const fs   = require('fs')
const path = require('path')

// ─── Drawing function ─────────────────────────────────────────────────────────
function drawLens(canvas, {
  solidBackground = true,   // false → transparent outer area
  sphereRadius,             // px
  lensRings = true,         // outer decorative rings
}) {
  const ctx = canvas.getContext('2d')
  const W   = canvas.width
  const H   = canvas.height
  const cx  = W / 2
  const cy  = H / 2
  const r   = sphereRadius

  ctx.clearRect(0, 0, W, H)

  // ── Solid background ──
  if (solidBackground) {
    ctx.fillStyle = '#090910'
    ctx.fillRect(0, 0, W, H)

    // Ambient aurora — faint green glow from top-center
    const aurora = ctx.createRadialGradient(cx, H * 0.18, 0, cx, cy, H * 0.65)
    aurora.addColorStop(0, 'rgba(29,185,84,0.10)')
    aurora.addColorStop(1, 'rgba(9,9,16,0.00)')
    ctx.fillStyle = aurora
    ctx.fillRect(0, 0, W, H)
  }

  // ── Outer bloom (soft halo around the sphere) ──
  const bloom = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.55)
  bloom.addColorStop(0,   'rgba(29,185,84,0.22)')
  bloom.addColorStop(0.4, 'rgba(29,185,84,0.07)')
  bloom.addColorStop(1,   'rgba(29,185,84,0.00)')
  ctx.fillStyle = bloom
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.55, 0, Math.PI * 2)
  ctx.fill()

  // ── Outer lens rings (decorative frame) ──
  if (lensRings) {
    ctx.strokeStyle = 'rgba(29,185,84,0.22)'
    ctx.lineWidth   = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, r * 1.24, 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(29,185,84,0.10)'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2)
    ctx.stroke()
  }

  // ── Main sphere — green radial gradient, highlight top-left ──
  const sphere = ctx.createRadialGradient(
    cx - r * 0.34, cy - r * 0.34, 0,   // highlight origin
    cx,            cy,            r    // full sphere
  )
  sphere.addColorStop(0,    '#45ffaa')   // bright highlight
  sphere.addColorStop(0.28, '#1DB954')   // brand green
  sphere.addColorStop(0.72, '#13883b')   // mid shadow
  sphere.addColorStop(1,    '#09551f')   // deep edge
  ctx.fillStyle = sphere
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // ── Glass specular (clipped to sphere) ──
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  const spec = ctx.createRadialGradient(
    cx - r * 0.30, cy - r * 0.32, 0,
    cx - r * 0.08, cy - r * 0.08, r * 0.72
  )
  spec.addColorStop(0,    'rgba(255,255,255,0.54)')
  spec.addColorStop(0.38, 'rgba(255,255,255,0.14)')
  spec.addColorStop(1,    'rgba(255,255,255,0.00)')
  ctx.fillStyle = spec
  ctx.fillRect(0, 0, W, H)
  ctx.restore()

  // ── Inner iris — dark center, the "." from playlist.lens ──
  const irisR = r * 0.268

  if (solidBackground) {
    // Solid icon: fill iris with background colour
    ctx.fillStyle = '#090910'
    ctx.beginPath()
    ctx.arc(cx, cy, irisR, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // Transparent adaptive/splash icon: punch a hole through the sphere
    // so the OS-provided background colour (#090910 from app.json) shows
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0,0,0,1)'
    ctx.beginPath()
    ctx.arc(cx, cy, irisR, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // ── Iris ring ──
  ctx.strokeStyle = 'rgba(29,185,84,0.55)'
  ctx.lineWidth   = r * 0.007
  ctx.beginPath()
  ctx.arc(cx, cy, irisR, 0, Math.PI * 2)
  ctx.stroke()

  // ── Iris gleam — tiny specular inside the dark center ──
  const gleam = ctx.createRadialGradient(
    cx - irisR * 0.33, cy - irisR * 0.33, 0,
    cx - irisR * 0.18, cy - irisR * 0.18, irisR * 0.55
  )
  gleam.addColorStop(0, 'rgba(255,255,255,0.28)')
  gleam.addColorStop(1, 'rgba(255,255,255,0.00)')
  ctx.fillStyle = gleam
  ctx.beginPath()
  ctx.arc(cx, cy, irisR, 0, Math.PI * 2)
  ctx.fill()
}

// ─── Generate ─────────────────────────────────────────────────────────────────
const assetsDir = path.join(__dirname, '../assets')

// icon.png — solid dark background, outer lens rings, full icon
;(function () {
  const canvas = createCanvas(1024, 1024)
  drawLens(canvas, { solidBackground: true, sphereRadius: 355, lensRings: true })
  const buf = canvas.toBuffer('image/png')
  fs.writeFileSync(path.join(assetsDir, 'icon.png'), buf)
  console.log('✓  assets/icon.png       (1024×1024, solid bg)')
})()

// adaptive-icon.png — transparent bg, content stays in 66% safe zone
;(function () {
  const canvas = createCanvas(1024, 1024)
  drawLens(canvas, { solidBackground: false, sphereRadius: 326, lensRings: false })
  const buf = canvas.toBuffer('image/png')
  fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), buf)
  console.log('✓  assets/adaptive-icon.png (1024×1024, transparent bg)')
})()

// splash-icon.png — transparent bg, smaller sphere, centered for splash screen
;(function () {
  const canvas = createCanvas(1024, 1024)
  drawLens(canvas, { solidBackground: false, sphereRadius: 260, lensRings: false })
  const buf = canvas.toBuffer('image/png')
  fs.writeFileSync(path.join(assetsDir, 'splash-icon.png'), buf)
  console.log('✓  assets/splash-icon.png   (1024×1024, transparent bg)')
})()

console.log('\n  Done. Run `npx expo start` to preview the new icons.\n')
