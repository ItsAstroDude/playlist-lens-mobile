/**
 * Time-period keys for Recaps (v1.4 S3) — pure, UTC-based, dependency-free.
 *
 * Buckets a play timestamp into week / month / season / year identifiers. Seasons
 * are METEOROLOGICAL, northern hemisphere (Astro's call): Winter Dec–Feb,
 * Spring Mar–May, Summer Jun–Aug, Autumn Sep–Nov. December rolls into the NEXT
 * year's winter, so Dec 2025 → "Winter 2026" (the season most people would call it).
 *
 * UTC throughout, to match the existing clock/weekday bucketing in wrapped.ts.
 */

export type Season = 'Winter' | 'Spring' | 'Summer' | 'Autumn'
export type PeriodKind = 'week' | 'month' | 'season' | 'year'

// ── Week (ISO-8601: Monday-start; week 1 contains the year's first Thursday) ──
export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  // Thursday of the current ISO week decides the week-year.
  const dayNum = (d.getUTCDay() + 6) % 7          // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3)        // → that Thursday
  const weekYear = d.getUTCFullYear()
  const firstThu = new Date(Date.UTC(weekYear, 0, 4)) // Jan 4 is always in week 1
  const firstDayNum = (firstThu.getUTCDay() + 6) % 7
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDayNum + 3)
  const week = 1 + Math.round((d.getTime() - firstThu.getTime()) / (7 * 86_400_000))
  return { year: weekYear, week }
}

export function weekKey(d: Date): string {
  const { year, week } = isoWeek(d)
  return `${year}-W${String(week).padStart(2, '0')}`
}

// ── Month ──
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// ── Season (meteorological, N. hemisphere) ──
export function seasonOf(d: Date): Season {
  const m = d.getUTCMonth() // 0=Jan … 11=Dec
  if (m === 11 || m <= 1) return 'Winter'
  if (m <= 4)  return 'Spring'
  if (m <= 7)  return 'Summer'
  return 'Autumn'
}

/**
 * Season-year: winter is labelled by the year it BEGINS (December). So Dec keeps
 * its own year, and the Jan/Feb tail joins the *previous* December's winter. That
 * way "Winter 2026" can't appear before Dec 2026, and within a year the order reads
 * Spring → Summer → Autumn → Winter.
 */
export function seasonYear(d: Date): number {
  const m = d.getUTCMonth()
  return (m === 0 || m === 1) ? d.getUTCFullYear() - 1 : d.getUTCFullYear()
}

export function seasonKey(d: Date): string {
  return `${seasonYear(d)}-${seasonOf(d)}`
}

/** "Winter 2026" from a season key "2026-Winter" — the user-facing saved name. */
export function seasonLabel(key: string): string {
  const [year, season] = key.split('-')
  return `${season} ${year}`
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December']

/** "June 2026" from a month key "2026-06". */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  return `${MONTHS[Number(m) - 1] ?? '?'} ${y}`
}

/** "Week 24 · 2026" from a week key "2026-W24". */
export function weekLabel(key: string): string {
  const [y, w] = key.split('-W')
  return `Week ${Number(w)} · ${y}`
}

// ── Year ──
export function yearKey(d: Date): string {
  return String(d.getUTCFullYear())
}

/** All four period keys for one timestamp. */
export function periodKeys(d: Date): Record<PeriodKind, string> {
  return { week: weekKey(d), month: monthKey(d), season: seasonKey(d), year: yearKey(d) }
}
