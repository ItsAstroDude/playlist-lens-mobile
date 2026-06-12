/**
 * Tiny pub/sub so any screen can open the root-mounted overlays (Tutorial,
 * What's New) — same pattern as authEvents. Avoids prop-drilling through the
 * navigator just to replay onboarding / show patch notes from Settings.
 */
type Cb = () => void

const tutorialSubs: Cb[] = []
const whatsNewSubs: Cb[] = []

export function onOpenTutorial(cb: Cb): () => void {
  tutorialSubs.push(cb)
  return () => { const i = tutorialSubs.indexOf(cb); if (i >= 0) tutorialSubs.splice(i, 1) }
}
export function emitOpenTutorial(): void { tutorialSubs.forEach(c => c()) }

export function onOpenWhatsNew(cb: Cb): () => void {
  whatsNewSubs.push(cb)
  return () => { const i = whatsNewSubs.indexOf(cb); if (i >= 0) whatsNewSubs.splice(i, 1) }
}
export function emitOpenWhatsNew(): void { whatsNewSubs.forEach(c => c()) }

// Now-playing stats sheet — owned by the always-mounted NowPlayingBar (a sheet
// mounted inside the Lenses list header would anchor to the LIST, not the
// screen), so the home-strip placement opens it through here.
const nowPlayingSubs: Cb[] = []
export function onOpenNowPlaying(cb: Cb): () => void {
  nowPlayingSubs.push(cb)
  return () => { const i = nowPlayingSubs.indexOf(cb); if (i >= 0) nowPlayingSubs.splice(i, 1) }
}
export function emitOpenNowPlaying(): void { nowPlayingSubs.forEach(c => c()) }
