import fs from 'fs'
import path from 'path'
import { LEARN, searchLearn, learnCount, norm } from '@/utils/learn'

const APP = path.join(__dirname, '..', 'app')
/** Does a route path ("/history", "/story?kind=week", "/queue") open a screen file? */
function screenExists(p: string): boolean {
  const name = p.split('?')[0].replace(/^\//, '') || 'index'
  return [path.join(APP, `${name}.tsx`), path.join(APP, '(tabs)', `${name}.tsx`)].some(f => fs.existsSync(f))
}

describe('learn the app', () => {
  const items = LEARN.flatMap(c => c.items)

  it('every entry is complete and has its own id', () => {
    expect(new Set(items.map(i => i.id)).size).toBe(items.length)
    for (const i of items) {
      expect(i.title.length).toBeGreaterThan(3)
      expect(i.body.length).toBeGreaterThan(20)
      expect(i.where.length).toBeGreaterThan(3)
    }
    expect(learnCount()).toBe(items.length)
  })

  it('every "open it" goes to a screen that exists', () => {
    for (const i of items) {
      if (i.action?.kind !== 'route') continue
      expect([i.id, screenExists(i.action.path)]).toEqual([i.id, true])
      // Tab screens are navigated to, not pushed on top
      const isTab = fs.existsSync(path.join(APP, '(tabs)', `${i.action.path.replace(/^\//, '').split('?')[0] || 'index'}.tsx`))
      expect([i.id, !!i.action.tab]).toEqual([i.id, isTab])
    }
  })

  it('search finds by any word, ignoring case, accents and apostrophes', () => {
    expect(searchLearn('BACKUP').flatMap(c => c.items.map(i => i.id))).toContain('backup')
    expect(searchLearn('whats new').flatMap(c => c.items.map(i => i.id))).toContain('whatsnew')
    expect(searchLearn('fold remote').flatMap(c => c.items.map(i => i.id))).toEqual(['fold'])
    expect(searchLearn('zzzz')).toEqual([])
    expect(searchLearn('  ')).toBe(LEARN)
    expect(norm('What’s Néw?')).toBe('whats new ')
  })
})
