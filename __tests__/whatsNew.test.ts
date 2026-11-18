import { storage } from '@/utils/cache'
import {
  shouldShowWhatsNew, markWhatsNewSeen, latestPatch,
  shouldShowTutorial, markTutorialSeen, replayTutorial,
} from '@/utils/whatsNew'

beforeEach(() => storage.clearAll())

describe('patch notes gating', () => {
  it('does NOT show on a fresh install (no seen version yet)', () => {
    expect(shouldShowWhatsNew()).toBe(false)
  })

  it('shows when the seen version is older than the latest', () => {
    storage.set('patch_seen_version', '1.0')
    expect(shouldShowWhatsNew()).toBe(true)
  })

  it('stops showing once marked seen', () => {
    storage.set('patch_seen_version', '1.0')
    markWhatsNewSeen()
    expect(shouldShowWhatsNew()).toBe(false)
    expect(storage.getString('patch_seen_version')).toBe(latestPatch().version)
  })
})

describe('tutorial gating', () => {
  it('shows once, then not again', () => {
    expect(shouldShowTutorial()).toBe(true)
    markTutorialSeen()
    expect(shouldShowTutorial()).toBe(false)
  })

  it('marking the tutorial seen also silences the immediate patch popup', () => {
    markTutorialSeen()
    expect(storage.getString('patch_seen_version')).toBe(latestPatch().version)
  })

  it('replay re-arms the tutorial', () => {
    markTutorialSeen()
    replayTutorial()
    expect(shouldShowTutorial()).toBe(true)
  })
})

describe('unseen patches', () => {
  const { unseenPatches, compareVersions, CHANGELOG } = require('@/utils/whatsNew')

  it('compares dotted versions numerically', () => {
    expect(compareVersions('1.9', '1.8.7')).toBe(1)
    expect(compareVersions('1.9.1', '1.9')).toBe(1)
    expect(compareVersions('1.10', '1.9')).toBe(1)
    expect(compareVersions('1.8', '1.8.0')).toBe(0)
    expect(compareVersions('1.8.3', '1.8.4')).toBe(-1)
  })

  it('lists every entry newer than the seen one, newest first', () => {
    const third = CHANGELOG[2].version
    storage.set('patch_seen_version', third)
    expect(unseenPatches().map((p: { version: string }) => p.version))
      .toEqual([CHANGELOG[0].version, CHANGELOG[1].version])
  })

  it('works when the seen version was merged away (compares by version)', () => {
    storage.set('patch_seen_version', '1.8.6')   // folded into 1.9
    const v = unseenPatches().map((p: { version: string }) => p.version)
    expect(v).toContain('1.9')
    expect(v).not.toContain('1.8.4')
  })

  it('falls back to just the newest entry', () => {
    expect(unseenPatches()).toEqual([CHANGELOG[0]])
  })
})
