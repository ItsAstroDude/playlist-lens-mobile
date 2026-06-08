# History Import (stats.fm-style) — Research + Plan

> Status: schema **verified against real export** (Astro's, 104,231 plays, Sep 2023–May 2026).
> Build order: **this first**, then swipe-refresh.

## Why it matters
Playlist "CORE ARCHITECTS" = track-count in playlists. Real listening is different:
by hours, top artists were Kendrick (134h), **DECO*27 (112h)**, VocaloKAT, Jamie Paige…
C418 (the playlist #1) isn't top 10. This feature gives the *true* taste and complements
the playlist view.

## Source data
- Spotify **Extended Streaming History** ZIP (requested via Privacy settings; takes ~days).
- Folder: `Spotify Extended Streaming History/`
- Files: `Streaming_History_Audio_<year>[_n].json` (use these) + `Streaming_History_Video_*.json` (ignore).
- One sample (~81 MB total here) had 104k rows across 2023–2026.

### Verified record schema
```
ts                                ISO8601 string (e.g. 2023-11-04T20:34:36Z)
ms_played                         int
master_metadata_track_name        string | null
master_metadata_album_artist_name string | null
master_metadata_album_album_name  string | null
spotify_track_uri                 "spotify:track:..." | null  (non-null = music)
episode_name / episode_show_name / spotify_episode_uri   (non-null = podcast)
audiobook_title / audiobook_uri / audiobook_chapter_*     (audiobooks)
reason_start / reason_end          string
shuffle / skipped / offline / incognito_mode   bool
offline_timestamp                  int | null
conn_country / platform / ip_addr  string
```

## Parsing approach (on-device, privacy-aligned)
- `expo-document-picker` → user picks the ZIP.
- Unzip in pure JS with **`fflate`** (Hermes-compatible, no native module).
- Parse `Streaming_History_Audio_*.json` **one file at a time**: `JSON.parse` → fold into
  accumulators → drop the array before next file (never hold all ~100k objects at once).
- Show progress (per-file). Peak memory ≈ one file's objects.
- Persist only the computed **aggregates** to MMKV (few KB), not raw rows.

### Counting rules
- A "stream" = any row. A "real listen" = `ms_played >= 30000` (Wrapped-style), since the
  sample had a **47% skip rate** — raw counts overcount badly.
- Classify row: music (`spotify_track_uri`), podcast (`spotify_episode_uri`), audiobook.

## Stats to compute
- Lifetime: total hours/days, total streams, unique artists/tracks/albums, date range,
  music vs podcast split, skip rate, shuffle %, offline %.
- Top **artists / tracks / albums** by **hours** and by **plays** — all-time + **per-year**.
- Listening **clock** (by hour-of-day) and by **weekday**; most-active single day.
- "Listening since" (earliest ts per artist/track).
- Per-year "wrapped" summary.

## Tech / new deps
- `expo-document-picker`
- `fflate` (unzip)
- New screen(s) + MMKV aggregate storage. No backend, no OAuth scope changes, no network.

## IA decision (FINAL)
App is being restructured around the two new features:
- **Bottom nav (4 pills):** `Lenses · Compare · Wrapped · Swipe`
  - **Wrapped** = this listening-history import feature (takes the old `taste` slot).
  - **Swipe** = swipe-to-refresh (takes the old `share` slot).
  - **Compare** unchanged.
- **Taste** (the playlist aggregate that's currently the `taste` tab) moves OFF the nav into a
  **pushed full-screen route**, reached via a slim pill in the empty top strip on the Lenses
  page (the area the cold-start `ServerState` indicator uses).
- That Taste screen **absorbs Share/Friends** (generate code, load a friend, compatibility) —
  the **Share tab is removed**.

So this build = Wrapped (history) feature **+** nav restructure **+** Taste pushed-screen w/ sharing.
Swipe is the separate later build that fills the 4th pill.

## Risks
- Very large histories (500 MB+) → keep strictly incremental parsing; consider a row cap or
  streaming parse if needed. 81 MB parsed fine.
- Export takes days to arrive from Spotify → onboarding/empty-state must explain the request flow.
- Two export variants exist: **Extended** (`Streaming_History_Audio_*`, rich, lifetime) vs
  **Account Data** (`StreamingHistory*.json`, ~1yr, fields `endTime/artistName/trackName/msPlayed`).
  Detect by filename/shape; prefer Extended, support Account as a lighter fallback.
