/**
 * "More or less": the Play tab's minigame, built on the player's own listening.
 * Two of your songs (or two artists): you know how often you played the first;
 * did you play the second MORE or LESS? Right answers chain: the mystery card
 * becomes the next known one. One wrong answer ends the run.
 *
 * Pure logic (no React, no storage) so it's testable; the screen is app/(tabs)/play.tsx.
 */
import type { PeriodStats } from '@/utils/stats'

export type GameKind = 'track' | 'artist'

export interface GameItem {
  kind: GameKind
  name: string
  /** Artist, for songs. */
  sub?: string
  plays: number
}

export type Guess = 'more' | 'less'

/** Fewer than this many usable items of a kind and that kind sits out. */
export const MIN_KIND = 6

/** Songs and artists with at least 2 plays, de-duplicated. */
export function buildPool(stats: Pick<PeriodStats, 'topTracks' | 'topArtists'> | null | undefined): GameItem[] {
  if (!stats) return []
  const seen = new Set<string>()
  const out: GameItem[] = []
  const add = (kind: GameKind, name: string, sub: string | undefined, plays: number) => {
    const key = `${kind}|${name.toLowerCase()}|${(sub ?? '').toLowerCase()}`
    if (plays < 2 || !name.trim() || seen.has(key)) return
    seen.add(key)
    out.push({ kind, name, sub, plays })
  }
  for (const t of stats.topTracks ?? []) add('track', t.name, t.sub, t.plays)
  for (const a of stats.topArtists ?? []) add('artist', a.name, undefined, a.plays)
  return out
}

/** Kinds with enough items (and at least two distinct play counts) to play. */
export function playableKinds(pool: GameItem[]): GameKind[] {
  return (['track', 'artist'] as GameKind[]).filter(k => {
    const items = pool.filter(i => i.kind === k)
    return items.length >= MIN_KIND && new Set(items.map(i => i.plays)).size >= 2
  })
}

export function canPlay(pool: GameItem[]): boolean {
  return playableKinds(pool).length > 0
}

const keyOf = (i: GameItem) => `${i.kind}|${i.name}|${i.sub ?? ''}`

/**
 * A challenger for `known`: same kind, a different play count (no ties), not one of
 * the recently shown. Falls back to allowing recent ones before giving up.
 */
export function pickChallenger(pool: GameItem[], known: GameItem, recent: string[], rand: () => number = Math.random): GameItem | null {
  const same = pool.filter(i => i.kind === known.kind && i.plays !== known.plays && keyOf(i) !== keyOf(known))
  const fresh = same.filter(i => !recent.includes(keyOf(i)))
  const from = fresh.length ? fresh : same
  return from.length ? from[Math.floor(rand() * from.length)] : null
}

/** A first pair: a random playable kind, a random known card and a challenger for it. */
export function firstPair(pool: GameItem[], rand: () => number = Math.random): [GameItem, GameItem] | null {
  const kinds = playableKinds(pool)
  if (!kinds.length) return null
  const kind = kinds[Math.floor(rand() * kinds.length)]
  const items = pool.filter(i => i.kind === kind)
  for (let tries = 0; tries < 8; tries++) {
    const known = items[Math.floor(rand() * items.length)]
    const challenger = pickChallenger(pool, known, [], rand)
    if (challenger) return [known, challenger]
  }
  return null
}

/** The next round after a right answer: the challenger becomes the known card. */
export function nextPair(pool: GameItem[], prevChallenger: GameItem, recent: string[], rand: () => number = Math.random): [GameItem, GameItem] | null {
  // Every few rounds, switch between songs and artists when both are playable.
  const kinds = playableKinds(pool)
  if (kinds.length > 1 && rand() < 0.2) {
    const pair = firstPair(pool.filter(i => i.kind !== prevChallenger.kind), rand)
    if (pair) return pair
  }
  const c = pickChallenger(pool, prevChallenger, recent, rand)
  return c ? [prevChallenger, c] : firstPair(pool, rand)
}

export function isRight(guess: Guess, known: GameItem, challenger: GameItem): boolean {
  return guess === 'more' ? challenger.plays > known.plays : challenger.plays < known.plays
}

export function itemKey(i: GameItem): string { return keyOf(i) }

/** A short line for the result, by score. */
export function verdict(score: number): string {
  if (score === 0) return 'Ouch. Your own listening fooled you.'
  if (score < 3) return 'A warm-up. Go again?'
  if (score < 7) return 'You know your music.'
  if (score < 12) return 'Scary good. Do you keep a spreadsheet?'
  return 'You ARE the algorithm.'
}
