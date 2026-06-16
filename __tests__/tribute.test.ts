import { memorialFor, withMemorialMark, MEMORIAL_MARK } from '@/utils/tribute'
import { setTributeEnabled } from '@/utils/settings'

describe('memorial marks', () => {
  beforeEach(() => setTributeEnabled(true))

  it('matches a memorialized artist, case- and space-insensitively', () => {
    expect(memorialFor('Oliver Tree')?.years).toBe('1993–2026')
    expect(memorialFor('  oliver   tree ')?.name).toBe('Oliver Tree')
  })

  it('returns null for everyone else (and for empty/missing names)', () => {
    expect(memorialFor('Smiley')).toBeNull()
    expect(memorialFor('')).toBeNull()
    expect(memorialFor(undefined)).toBeNull()
  })

  it('appends a dagger only to memorialized names', () => {
    expect(withMemorialMark('Oliver Tree')).toContain(MEMORIAL_MARK)
    expect(withMemorialMark('Smiley')).toBe('Smiley')
  })

  it('respects the Settings opt-out', () => {
    setTributeEnabled(false)
    expect(memorialFor('Oliver Tree')).toBeNull()
    expect(withMemorialMark('Oliver Tree')).toBe('Oliver Tree')
  })
})
