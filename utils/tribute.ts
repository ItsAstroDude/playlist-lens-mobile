/**
 * Quiet in-memoriam marks.
 *
 * A small typographic dagger (†, the traditional "deceased" mark) sits beside a
 * memorialized artist's name wherever it's listed, and their expanded panel shows
 * a subtle remembrance line. Deliberately understated — no colour, no animation —
 * and fully opt-out from Settings.
 *
 * Oliver Tree (1993–2026) added 2026-06-15.
 */
import { tributeEnabled } from '@/utils/settings'

export interface Memorial { name: string; years: string }

// Keyed by normalized name (see normName). Keep this list small + considered.
const MEMORIALS: Record<string, Memorial> = {
  'oliver tree': { name: 'Oliver Tree', years: '1993–2026' },
}

function normName(s: string | undefined | null): string {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // drop diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export const MEMORIAL_MARK = '†'

/** Memorial for an artist name, or null. Respects the Settings opt-out. */
export function memorialFor(name: string | undefined | null): Memorial | null {
  if (!name || !tributeEnabled()) return null
  return MEMORIALS[normName(name)] ?? null
}

/** Artist name with a thin-spaced dagger appended when memorialized, else as-is. */
export function withMemorialMark(name: string): string {
  return memorialFor(name) ? `${name} ${MEMORIAL_MARK}` : name
}
