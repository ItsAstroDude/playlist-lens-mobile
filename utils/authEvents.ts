// ─── Global auth event bus ────────────────────────────────────────────────────
// Lets apiFetch signal a session expiry without depending on React state.
// _layout.tsx subscribes and routes back to the auth screen.

type Listener = () => void
const listeners = new Set<Listener>()

export function onSessionExpired(cb: Listener): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function emitSessionExpired(): void {
  listeners.forEach(cb => cb())
}
