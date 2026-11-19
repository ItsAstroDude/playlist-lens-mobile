/**
 * Pure maths behind the 2.0 motion primitives — kept apart from the components so it
 * can be unit-tested. Functions marked 'worklet' also run on the UI thread.
 */

// ─── Rolling numbers ────────────────────────────────────────────────────────────
export type RollPart = { kind: 'digit'; d: number; key: string } | { kind: 'char'; ch: string; key: string }

/** "18h 24m" → digit columns + static characters. Keys count from the RIGHT, so a
 *  value that grows a digit ("9" → "10") keeps the ones column in place. */
export function rollingParts(value: string): RollPart[] {
  const n = value.length
  return value.split('').map((ch, i) => {
    const key = String(n - i)
    return /\d/.test(ch) ? { kind: 'digit', d: +ch, key } : { kind: 'char', ch, key }
  })
}

/** Delay for each digit column: the leftmost starts first, the ones column lands last. */
export function rollDelays(parts: RollPart[], stagger: number): number[] {
  let k = 0
  return parts.map(p => (p.kind === 'digit' ? (k++) * stagger : 0))
}

// ─── Calendar ripple ──────────────────────────────────────────────────────────────
/** A diagonal wave: each cell starts `step` ms after its neighbour up-left. */
export function rippleDelay(col: number, row: number, step = 24): number {
  return (col + row) * step
}

// ─── Aperture ───────────────────────────────────────────────────────────────────────
export interface ApertureGeometry { iris: string; seps: string; r: number }

/**
 * The playlist.lens mark at a given opening. `open` 0 (shut) … 1 (wide open), `rot`
 * extra rotation in radians. Same construction as scripts/icon-art.mjs: a hexagonal
 * iris whose edges extend out to the rim as the blade separators.
 */
export function apertureGeometry(cx: number, cy: number, R: number, open: number, rot: number): ApertureGeometry {
  'worklet'
  const o = Math.max(0, Math.min(1.1, open))
  const r = R * (0.06 + 0.36 * o)
  const base = -Math.PI / 2 + Math.PI / 6 + rot + (1 - o) * 1.1
  const v: number[][] = []
  for (let i = 0; i < 6; i++) {
    const a = base + (i * Math.PI) / 3
    v.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  let iris = `M${v[0][0].toFixed(2)},${v[0][1].toFixed(2)}`
  for (let i = 1; i < 6; i++) iris += ` L${v[i][0].toFixed(2)},${v[i][1].toFixed(2)}`
  iris += ' Z'
  let seps = ''
  for (let i = 0; i < 6; i++) {
    const p = v[i], q = v[(i + 5) % 6]
    const dx = p[0] - q[0], dy = p[1] - q[1], len = Math.hypot(dx, dy) || 1
    const ux = dx / len, uy = dy / len
    const px = p[0] - cx, py = p[1] - cy
    const b = px * ux + py * uy
    const t = -b + Math.sqrt(Math.max(0, b * b - (px * px + py * py - R * R)))
    seps += `M${p[0].toFixed(2)},${p[1].toFixed(2)} L${(p[0] + ux * (t + 4)).toFixed(2)},${(p[1] + uy * (t + 4)).toFixed(2)} `
  }
  return { iris, seps: seps.trim(), r }
}

// ─── Liquid fill ────────────────────────────────────────────────────────────────────
/** y of a two-frequency wave across the gauge (top of the liquid). */
export function waveY(x: number, base: number, amp: number, phase: number, freq = 0.045): number {
  'worklet'
  return base + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 0.45 + phase * 0.5) * amp * 0.4
}

// ─── Save burst ─────────────────────────────────────────────────────────────────────
/** Evenly spread burst directions with a deterministic wobble (no Math.random in render). */
export function burstVectors(count: number, distance: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + (((i * 7919) % 13) / 13 - 0.5) * 0.35
    const d = distance * (0.75 + (((i * 104729) % 17) / 17) * 0.45)
    return { x: Math.cos(a) * d, y: Math.sin(a) * d }
  })
}
