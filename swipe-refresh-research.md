# Swipe-to-Refresh — Research Findings

> Status: **research only, not started.** Build order: history-import first, then this.
> Verdict: **feasible**, but the 30s audio cannot come from Spotify — needs an external preview source.
> Placement (FINAL): **4th bottom-nav pill** — nav becomes `Lenses · Compare · Wrapped · Swipe`.

## The feature
Tinder-style playlist cleanup: pick an owned playlist → each track plays a ~30s snippet →
swipe right = keep, swipe left = remove → summary ("Kept N / Removed M") → write removals
back to the Spotify playlist.

---

## 1. Audio previews — the critical path ⚠️

**Spotify `preview_url` is gone for this app.** Spotify removed preview URLs for new apps on
2024-11-27 (same change that killed audio-features). This app is past that cutoff, so
`preview_url` returns `null`. Snippet audio MUST come from elsewhere.

### Sourcing options
| Source | How | Pros | Cons |
|--------|-----|------|------|
| **Deezer** | unauth `GET api.deezer.com/track/isrc:{ISRC}` → `preview` (30s MP3) | no auth, exact via ISRC | preview URLs expire in hours (fetch at swipe-time); some ISRCs map to multiple tracks (take first) |
| **Spotify embed scrape** | fetch `open.spotify.com/embed/track/{id}`, parse preview URL from page JSON | exact track, real Spotify clip | fragile (HTML can change), grey-area, must run server-side |
| **iTunes Search** | `itunes.apple.com/search?term=...` → `previewUrl` (30s m4a) | no auth | text match only (less accurate), no ISRC lookup |

**Recommendation:** resolve previews **on the backend** — try embed-scrape (exact) → Deezer
ISRC fallback → iTunes text fallback. Return a normalized `preview_url` to the app so the
strategy can change without an app update. Prefetch the *next* card's preview during the
current one. Handle "no preview found anywhere" gracefully (swipe on art, or auto-skip with a note).

ISRC is available: the backend returns full track objects, so `external_ids.isrc` is present —
just not declared in the `SpotifyTrack` TS type yet.

### Playback
Add **`expo-audio`** (SDK 54's supported lib; `expo-av` is deprecated). Plays remote MP3/M4A.
Need play/pause, a 0:00–0:30 progress bar, auto-advance on end.

---

## 2. Writing changes back to Spotify

- Endpoint: `DELETE /v1/playlists/{playlist_id}/tracks`, body `{ tracks: [{uri}], snapshot_id }`.
- **Max 100 items per call** → batch for larger removals.
- Pass `snapshot_id` to target the right playlist version (concurrency safety).
- **Scopes:** needs `playlist-modify-public` + `playlist-modify-private`. Current scopes are
  read-only (`playlist-read-*`, `user-library-read`) → adding write requires a **one-time re-auth**.
- Only **owned or collaborative** playlists are editable → gate the entry point; hide "Refresh"
  on followed playlists.
- **Local files cannot be removed via the API** (known limitation) → detect + skip/explain.
- New backend endpoint, e.g. `POST /api/playlist/{id}/remove` taking the track URIs.

---

## 3. UI / client

- Swipe-card stack: **custom** with `react-native-reanimated` + `react-native-gesture-handler`
  (both already installed). Libraries like rn-deck-swiper are dated; custom gives full control +
  matches Liquid Lens.
- Reuses: track fetch (`/api/playlist/{id}/tracks`, 500 cap), palette, haptics, glass styling.
- Screens: entry (owned-playlist picker) → swipe session → summary (Kept/Removed, View playlist,
  Start over) with confirm-before-apply + undo.

---

## 4. Risks / open items
- **[verify live]** Confirm `preview_url` is actually null for a real token (2-min test). Assume
  yes given audio-features is dead.
- 500-track backend cap → big playlists refreshed in chunks.
- Deezer unauth rate limit (~50 req / 5s) → fine for on-demand single-card fetches; prefetch one ahead.
- Preview fetching sends track identifiers (ISRC/title) to Deezer/iTunes — not personal data, but
  note it against the "data never leaves your device" tagline.
- Cross-service preview sourcing is a pragmatic workaround, not Spotify-blessed.

## 5. New dependencies / changes
- `expo-audio` (playback)
- Backend: preview-resolver + `playlist-modify-*` scopes + remove-tracks endpoint (re-auth)
- Types: add `external_ids.isrc` + `preview_url` to `SpotifyTrack`

## 6. Rough size
Meaty (multi-day): new screens + audio + backend preview-resolution + backend write + re-auth.
Highest-impact feature on the table — turns the app from a viewer into a tool.

---

### Sources
- Spotify API changes (2024-11-27): https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api
- Preview URL workaround (embed): https://github.com/rexdotsh/spotify-preview-url-workaround
- Remove tracks endpoint: https://developer.spotify.com/documentation/web-api/reference/remove-tracks-playlist
- Deezer API: https://developers.deezer.com/api
