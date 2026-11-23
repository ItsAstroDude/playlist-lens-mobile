import { useEffect, useState } from 'react'

/**
 * Whether the compact cover-screen UI is showing (it sits over the normal app, which
 * stays mounted underneath so unfolding returns you to where you were). Screens that
 * animate on their own (the Liquid background) pause while it's up.
 *
 * `fullApp` is the escape hatch: the user chose the normal app on the cover screen
 * (until the app restarts).
 */
let active = false
let fullApp = false
const subs = new Set<() => void>()
const emit = () => subs.forEach(cb => cb())

export function coverActive(): boolean { return active }
export function setCoverActive(v: boolean): void { if (v !== active) { active = v; emit() } }

/** The half-folded tabletop Now Playing is up, covering the whole app (components/fold). */
let tabletop = false
export function tabletopActive(): boolean { return tabletop }
export function setTabletopActive(v: boolean): void { if (v !== tabletop) { tabletop = v; emit() } }

export function coverFullApp(): boolean { return fullApp }
export function setCoverFullApp(v: boolean): void { if (v !== fullApp) { fullApp = v; emit() } }

function useStore<T>(read: () => T): T {
  const [v, setV] = useState(read)
  useEffect(() => {
    const cb = () => setV(read())
    subs.add(cb); cb()
    return () => { subs.delete(cb) }
  }, [])
  return v
}

export function useCoverActive(): boolean { return useStore(coverActive) }
export function useCoverFullApp(): boolean { return useStore(coverFullApp) }
export function useTabletopActive(): boolean { return useStore(tabletopActive) }
