// ─── Input Sanitization ───────────────────────────────────────────────────────

/**
 * Strips everything except uppercase letters, digits, and hyphens.
 * Auto-inserts hyphen after 3 chars. Caps at 7 chars (XXX-XXX).
 */
export function sanitizeFriendCode(input: string): string {
  const stripped = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (stripped.length <= 3) return stripped
  return `${stripped.slice(0, 3)}-${stripped.slice(3, 6)}`
}

/**
 * Validates a friend code is exactly XXX-XXX format.
 */
export function isValidFriendCode(code: string): boolean {
  return /^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(code)
}

/**
 * Strips anything that isn't a safe search character.
 * Used for playlist/track search inputs.
 */
export function sanitizeSearchQuery(input: string): string {
  return input.replace(/[<>'";&]/g, '').slice(0, 100)
}
