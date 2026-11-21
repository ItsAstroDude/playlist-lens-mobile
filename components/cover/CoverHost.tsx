import React, { useEffect } from 'react'
import { useScreen } from '@/hooks/useScreen'
import { setCoverActive, setCoverFullApp, useCoverFullApp } from '@/utils/coverMode'
import { CoverApp } from './CoverApp'

/**
 * Shows the compact cover-screen app over the normal one while the app is on the
 * Flip's cover screen (unless the user chose the full app there). The normal app
 * stays mounted underneath, so opening the phone continues where you were.
 */
// OFF (2026-11-21): the separate mini-app wasn't the direction. The cover screen gets
// the real app with compact layouts instead; this stays until that replaces it.
const MINI_APP_ENABLED = false

export function CoverHost() {
  const screen = useScreen()
  const fullApp = useCoverFullApp()
  const onCover = screen.kind === 'cover'
  const show = MINI_APP_ENABLED && onCover && !fullApp

  useEffect(() => { setCoverActive(show) }, [show])
  // Back on the main screen: next time the phone closes, show the cover UI again.
  useEffect(() => { if (!onCover && fullApp) setCoverFullApp(false) }, [onCover, fullApp])
  useEffect(() => () => setCoverActive(false), [])

  return show ? <CoverApp /> : null
}
