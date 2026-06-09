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

**NON-DESTRUCTIVE BY DEFAULT — the original must always survive.** Spotify has no
user-facing undo (snapshot_id is only write-concurrency, not rollback), so safety = a copy.

**Output choice (FINAL): ask each session.** The end-of-swipe summary offers two buttons:
- **Save as new playlist** — create a new playlist with the *kept* tracks; original untouched.
  `POST /me/playlists` (or `/users/{id}/playlists`) → `POST /playlists/{new}/tracks` (kept URIs).
- **Trim original (with backup)** — first duplicate the original into a private backup
  ("playlist.lens backup — {name} — {date}") with ALL tracks, **then** `DELETE` the cut tracks
  from the original. Keeps the playlist's identity (name/followers/order) + a recovery copy.

Mechanics (both paths):
- Add tracks: `POST /v1/playlists/{id}/tracks` — **max 100 URIs/call** → batch. Preserve order.
- Remove tracks: `DELETE /v1/playlists/{id}/tracks`, body `{ tracks: [{uri}], snapshot_id }`,
  100/call.
- **Mandatory confirm/preview screen** before any write ("Keeping 58 · removing 28 → [Create]").
- **Scopes:** `playlist-modify-public` + `playlist-modify-private` (covers create/add/remove).
  Current scopes are read-only → **one-time re-auth** (batch with live-tracking's read scopes).
- Only **owned/collaborative** playlists are editable → gate the entry point; hide "Refresh" on
  followed playlists.
- **Local files can't be added to a copy** via the API → detect + keep/flag them (for the
  new-playlist path) / leave untouched (for the trim path).
- Backend endpoints, e.g. `POST /api/playlist/create`, `POST /api/playlist/{id}/add`,
  `POST /api/playlist/{id}/remove`, plus a `duplicate` helper.

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
