import { record, recordSize, summary, clearPerf, timed, fmtMs, fmtSize } from '@/utils/perf'

describe('perf', () => {
  beforeEach(() => clearPerf())

  it('summarises median, last and count per metric, in display order', () => {
    ;[300, 100, 200].forEach(ms => record('wrapped', ms))
    record('lenses', 50)
    const { rows } = summary()
    expect(rows.map(r => r.metric)).toEqual(['lenses', 'wrapped'])
    expect(rows[1]).toMatchObject({ median: 200, last: 200, count: 3, label: 'Wrapped' })
  })

  it('takes the mean of the middle two for an even count', () => {
    ;[100, 200, 300, 400].forEach(ms => record('recaps', ms))
    expect(summary().rows[0].median).toBe(250)
  })

  it('keeps only the last 20 samples and ignores nonsense', () => {
    for (let i = 1; i <= 25; i++) record('lenses', i)
    record('lenses', -5); record('lenses', NaN); record('lenses', 10 * 60_000)
    const r = summary().rows[0]
    expect(r.count).toBe(20)
    expect(r.last).toBe(25)
  })

  it('times a function, returns its value, and records sizes', () => {
    expect(timed('read_buffer', () => 42)).toBe(42)
    recordSize('buffer', 1_234_567)
    const s = summary()
    expect(s.rows[0].metric).toBe('read_buffer')
    expect(s.sizes?.buffer).toBe(1_234_567)
  })

  it('formats durations and sizes', () => {
    expect(fmtMs(840)).toBe('840 ms')
    expect(fmtMs(2430)).toBe('2.4 s')
    expect(fmtMs(12_400)).toBe('12 s')
    expect(fmtSize(3_200_000)).toBe('3.2 MB')
    expect(fmtSize(640_000)).toBe('640 KB')
  })
})
