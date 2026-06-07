// ─── Global auth event bus ────────────────────────────────────────────────────
// Lets non-React code (apiFetch, the OAuth finalizer) signal auth changes.
// _layout.tsx subscribes and flips its auth state — which purges the auth screen
// from the navigator so "back" can't land on it after login.

type Listener = () => void

const expiredListeners = new Set<Listener>()
const signedInListeners = new Set<Listener>()

// ── Session expired (401 / logout) ──
export function onSessionExpired(cb: Listener): () => void {
  expiredListeners.add(cb)
  return () => expiredListeners.delete(cb)
}
export function emitSessionExpired(): void {
  expiredListeners.forEach(cb => cb())
}

// ── Signed in (OAuth completed, tokens stored) ──
export function onSignedIn(cb: Listener): () => void {
  signedInListeners.add(cb)
  return () => signedInListeners.delete(cb)
}
export function emitSignedIn(): void {
  signedInListeners.forEach(cb => cb())
}
