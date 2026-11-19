/**
 * Liquid (2.0) — the colours the whole app floats in. The playing song's cover sets
 * them (fed from the root layout); with nothing playing it falls back to your accent
 * plus the brand violet and pink. The last palette is remembered across launches.
 */
import { useSyncExternalStore } from 'react'
import { storage } from '@/utils/cache'
import { Colors } from '@/constants/theme'

export type Tint = [string, string, string, string]
const KEY = 'liquid.tint.v1'
const HEX = /^#[0-9a-f]{6}$/i

export function fallbackTint(): Tint {
  return [Colors.greenPrimary, '#6a2bd9', '#ff70a5', '#ccbdff']
}

function load(): Tint {
  try {
    const t = JSON.parse(storage.getString(KEY) ?? 'null')
    if (Array.isArray(t) && t.length === 4 && t.every((c: unknown) => typeof c === 'string' && HEX.test(c))) return t as Tint
  } catch {}
  return fallbackTint()
}

let current: Tint = load()
const subs = new Set<() => void>()

/** Normalise any colour the palette extractor returns to #rrggbb (or null). */
export function toHex(c: string | undefined | null): string | null {
  if (!c) return null
  const s = c.trim()
  if (HEX.test(s)) return s.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(s)) return ('#' + s.slice(1).split('').map(x => x + x).join('')).toLowerCase()
  const m = s.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i)
  if (m) return '#' + [m[1], m[2], m[3]].map(n => Math.max(0, Math.min(255, +n)).toString(16).padStart(2, '0')).join('')
  return null
}

export function getTint(): Tint { return current }

export function setTint(t: Tint): void {
  if (t.join() === current.join()) return
  current = t
  try { storage.set(KEY, JSON.stringify(t)) } catch {}
  subs.forEach(f => f())
}

export function useTint(): Tint {
  return useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb) } }, getTint, getTint)
}
