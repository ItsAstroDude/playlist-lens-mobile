import {
  weekKey, monthKey, seasonOf, seasonYear, seasonKey, seasonLabel, yearKey, periodKeys,
} from '@/utils/periods'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

describe('period keys', () => {
  it('months are zero-padded YYYY-MM', () => {
    expect(monthKey(utc(2026, 6, 15))).toBe('2026-06')
    expect(monthKey(utc(2026, 12, 1))).toBe('2026-12')
  })

  it('years', () => {
    expect(yearKey(utc(2026, 6, 15))).toBe('2026')
  })

  describe('meteorological seasons (N. hemisphere)', () => {
    it('maps months to the right season', () => {
      expect(seasonOf(utc(2026, 1, 10))).toBe('Winter')  // Jan
      expect(seasonOf(utc(2026, 4, 10))).toBe('Spring')  // Apr
      expect(seasonOf(utc(2026, 7, 10))).toBe('Summer')  // Jul
      expect(seasonOf(utc(2026, 10, 10))).toBe('Autumn') // Oct
      expect(seasonOf(utc(2025, 12, 10))).toBe('Winter') // Dec
    })

    it('winter is labelled by its starting year (Dec); Jan/Feb join the previous December', () => {
      expect(seasonKey(utc(2025, 12, 25))).toBe('2025-Winter')
      expect(seasonYear(utc(2025, 12, 25))).toBe(2025)
      expect(seasonKey(utc(2026, 1, 5))).toBe('2025-Winter')  // same winter as Dec 2025
      expect(seasonKey(utc(2026, 2, 20))).toBe('2025-Winter')
    })

    it('labels a season key for saving', () => {
      expect(seasonLabel('2026-Spring')).toBe('Spring 2026')
    })
  })

  describe('ISO weeks', () => {
    it('formats a padded week key', () => {
      expect(weekKey(utc(2026, 6, 15))).toMatch(/^2026-W\d{2}$/)
    })

    it('Jan 4 is always in week 1', () => {
      expect(weekKey(utc(2026, 1, 4))).toBe('2026-W01')
    })

    it('handles the year-boundary week-year (Dec 29 2025 is in ISO week-year 2026)', () => {
      // 2025-12-29 is a Monday whose ISO week (W01) belongs to 2026.
      expect(weekKey(utc(2025, 12, 29))).toBe('2026-W01')
    })
  })

  it('periodKeys returns all four buckets at once', () => {
    expect(periodKeys(utc(2026, 6, 15))).toEqual({
      week: weekKey(utc(2026, 6, 15)),
      month: '2026-06',
      season: '2026-Summer',
      year: '2026',
    })
  })
})
