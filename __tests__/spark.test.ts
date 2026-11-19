import { storage } from '@/utils/cache'
import * as live from '@/utils/liveLines'
import { LINES, factLines, greetingBank } from '@/components/spark/lines'
import {
  getSparkMode, setSparkMode, nextSparkMode, greetingLine, tapLine, drawFrom, _resetSession,
  GREET_GAP_MS, SESSION_CAP,
} from '@/components/spark/director'

const wordCount = (s: string) => s.trim().split(/\s+/).length

beforeEach(() => { storage.clearAll(); _resetSession(); jest.restoreAllMocks() })

describe('spark lines', () => {
  it('every scripted line is lowercase, short and emoji-free', () => {
    for (const bank of Object.values(LINES)) for (const l of bank) {
      expect(l).toBe(l.toLowerCase())
      expect(wordCount(l)).toBeLessThanOrEqual(14)
      expect(l).not.toMatch(/\p{Extended_Pictographic}/u)
    }
  })

  it('fact lines only use numbers that are in the facts', () => {
    const f = { ms: 3 * 3600_000 + 5 * 60_000, deltaMs: 12, topArtist: 'Björk', topTrack: { name: 'Hyperballad', plays: 7 }, newArtists: 4, streak: 9 }
    const lines = factLines(f)
    expect(lines.length).toBeGreaterThan(0)
    const allowed = new Set(['3', '05', '12', '7', '4', '9'])
    for (const l of lines) for (const n of l.match(/\d+/g) ?? []) expect(allowed.has(n)).toBe(true)
    expect(factLines(null)).toEqual([])
  })

  it('says nothing about quiet weeks', () => {
    expect(factLines({ ms: 0, deltaMs: null, topArtist: null, topTrack: null, newArtists: 0, streak: 0 })).toEqual([])
  })

  it('picks a greeting for the hour', () => {
    expect(greetingBank(3)).toBe('greeting_night')
    expect(greetingBank(9)).toBe('greeting_morning')
    expect(greetingBank(14)).toBe('greeting_afternoon')
    expect(greetingBank(20)).toBe('greeting_evening')
    expect(greetingBank(23)).toBe('greeting_night')
  })
})

describe('spark director', () => {
  it('defaults to on and cycles on → quiet → off', () => {
    expect(getSparkMode()).toBe('on')
    expect(nextSparkMode('on')).toBe('quiet')
    expect(nextSparkMode('quiet')).toBe('off')
    expect(nextSparkMode('off')).toBe('on')
    setSparkMode('quiet')
    expect(getSparkMode()).toBe('quiet')
  })

  it('introduces himself first, then waits 12 h between greetings', () => {
    const t0 = new Date(2026, 10, 18, 9)
    expect(greetingLine(t0)).toBe(LINES.greeting_first[0])
    expect(greetingLine(new Date(t0.getTime() + GREET_GAP_MS - 1))).toBeNull()
    const later = new Date(t0.getTime() + GREET_GAP_MS)
    expect(LINES[greetingBank(later.getHours())]).toContain(greetingLine(later))
  })

  it('welcomes you back after a few days away', () => {
    const t0 = new Date(2026, 10, 1, 9)
    greetingLine(t0)
    expect(LINES.greeting_return).toContain(greetingLine(new Date(2026, 10, 6, 9)))
  })

  it('never greets unprompted when quiet or off', () => {
    setSparkMode('quiet')
    expect(greetingLine()).toBeNull()
    setSparkMode('off')
    expect(greetingLine()).toBeNull()
  })

  it('stops talking unprompted after the session cap', () => {
    let t = new Date(2026, 10, 1).getTime()
    for (let i = 0; i < SESSION_CAP; i++) { expect(greetingLine(new Date(t))).not.toBeNull(); t += GREET_GAP_MS }
    expect(greetingLine(new Date(t))).toBeNull()
  })

  it('goes through a whole deck before repeating, and never says the same line twice in a row', () => {
    const lines = ['a', 'b', 'c', 'd']
    let prev = ''
    for (let round = 0; round < 5; round++) {
      const drawn = Array.from({ length: 4 }, () => drawFrom('t', lines))
      expect(new Set(drawn).size).toBe(4)
      expect(drawn[0]).not.toBe(prev)
      prev = drawn[3]
    }
  })

  it('turns to stone after five quick taps', () => {
    jest.spyOn(live, 'weekFacts').mockReturnValue(null)
    const now = 1_000_000
    for (let i = 0; i < 4; i++) expect(tapLine(now + i * 200).rock).toBe(false)
    const r = tapLine(now + 900)
    expect(r.rock).toBe(true)
    expect(LINES.rock).toContain(r.line)
    expect(tapLine(now + 1100).rock).toBe(false)
  })

  it('slow taps never trigger the rock', () => {
    jest.spyOn(live, 'weekFacts').mockReturnValue(null)
    for (let i = 0; i < 8; i++) expect(tapLine(i * 3000).rock).toBe(false)
  })

  it('tap facts come from the real week', () => {
    jest.spyOn(live, 'weekFacts').mockReturnValue({ ms: 0, deltaMs: null, topArtist: 'Caribou', topTrack: null, newArtists: 0, streak: 0 })
    expect(tapLine(0, () => 0.1).line).toBe('Caribou again. your artist of the week.')
  })
})
