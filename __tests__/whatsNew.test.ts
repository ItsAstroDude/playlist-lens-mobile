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
