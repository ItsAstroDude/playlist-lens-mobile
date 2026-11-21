import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio'
import { previewUrl } from '@/utils/preview'
import { storage } from '@/utils/cache'
import type { SlideSong } from '@/utils/story'

const MUSIC_KEY = 'settings.storyMusic'   // settings.* survives Clear cache
const VOLUME = 0.85
const FADE_OUT_MS = 250
const FADE_IN_MS = 400
const STEPS = 8

/**
 * Story mode's music (2.0.15): the preview for the current slide's song (slideSongs),
 * crossfading when the song changes, following the story's pause, with a remembered
 * mute. Ducks other audio (Spotify) while it plays.
 *
 * CRASH GUARD (same as SwipeDeck): useAudioPlayer releases the native player at unmount
 * before effect cleanups run, and touching it afterwards is fatal in a release build —
 * so never call the player in a cleanup, and wrap every call.
 */
export function useStoryMusic(plan: (SlideSong | null)[] | null, index: number) {
  const player = useAudioPlayer(null)
  const [on, setOn] = useState(() => storage.getBoolean(MUSIC_KEY) ?? true)
  const onRef = useRef(on)
  onRef.current = on
  const playing = useRef<string | null>(null)       // the url loaded in the player
  const paused = useRef(false)
  const fade = useRef<ReturnType<typeof setInterval> | null>(null)
  const alive = useRef(true)
  const safe = (fn: () => void) => { if (!alive.current) return; try { fn() } catch { /* released player */ } }

  useEffect(() => {
    alive.current = true
    setAudioModeAsync({ interruptionMode: 'duckOthers', playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {})
    return () => { alive.current = false; if (fade.current) clearInterval(fade.current) }   // no player calls here
  }, [])

  const ramp = (from: number, to: number, ms: number, done?: () => void) => {
    if (fade.current) clearInterval(fade.current)
    let k = 0
    safe(() => { player.volume = from })
    fade.current = setInterval(() => {
      k++
      safe(() => { player.volume = from + ((to - from) * k) / STEPS })
      if (k >= STEPS) { if (fade.current) clearInterval(fade.current); fade.current = null; done?.() }
    }, ms / STEPS)
  }

  const switchTo = (url: string) => {
    const start = () => {
      safe(() => { player.replace(url); player.volume = 0 })
      playing.current = url
      if (paused.current || !onRef.current) return
      safe(() => player.play())
      ramp(0, VOLUME, FADE_IN_MS)
    }
    if (playing.current && !paused.current) ramp(VOLUME, 0, FADE_OUT_MS, start)
    else start()
  }

  // Look every slide's preview up as soon as the story is ready, so songs start on time.
  const planKey = plan?.map(p => p?.uri || p?.name || '').join('|') ?? ''
  useEffect(() => { plan?.forEach(p => { if (p) previewUrl(p) }) }, [planKey])

  const song = plan?.[index] ?? null
  const songKey = song ? song.uri || `${song.artist ?? ''}|${song.name}` : null
  useEffect(() => {
    if (!on || !song) return
    let current = true
    previewUrl(song).then(url => {
      if (!current || !url || url === playing.current) return   // same song: keep playing
      switchTo(url)
    })
    return () => { current = false }
  }, [songKey, on])

  const pause = useCallback(() => {
    paused.current = true
    if (fade.current) { clearInterval(fade.current); fade.current = null }
    safe(() => player.pause())
  }, [])
  const resume = useCallback(() => {
    paused.current = false
    if (onRef.current && playing.current) { safe(() => { player.volume = VOLUME; player.play() }) }
  }, [])
  const toggle = useCallback(() => {
    const next = !onRef.current
    storage.set(MUSIC_KEY, next)
    onRef.current = next
    setOn(next)
    if (!next) { if (fade.current) { clearInterval(fade.current); fade.current = null }; safe(() => player.pause()) }
    else if (playing.current && !paused.current) safe(() => { player.volume = VOLUME; player.play() })
  }, [])

  return useMemo(() => ({ on, toggle, pause, resume }), [on, toggle, pause, resume])
}
