# Live Listening Tracking — Research (parked)

> Status: **research only.** Decide direction after Wrapped + Swipe ship.
> Goal: after the one-time Extended-History import (the baseline), keep appending
> new listens so Wrapped stays current — and make it **more reliable than stats.fm**.

## The only live data Spotify gives
- **`GET /me/player/recently-played`** — last **50** tracks, `played_at` timestamps,
  `before`/`after` cursors. Lossy: max 50 per fetch, **no `ms_played`** (duration unknown),
  **no podcasts / local files / offline plays**.
- **`GET /me/player/currently-playing`** (and `/me/player`) — real-time now-playing +
  `progress_ms`. Needs polling while app is foreground.
- Scopes required: `user-read-recently-played` + `user-read-currently-playing`
  (app has none today → **re-auth**; batch with Swipe's `playlist-modify-*`).

## Why stats.fm is unreliable (failure modes to beat)
1. **50-track cap** → listen to >50 between polls = permanent loss of the overflow.
2. **No ms_played** → minutes are estimated (they assume full track length → overcount,
   esp. with a high skip rate).
3. **Closed-app listening** can only be captured server-side — phones throttle background
   tasks hard (`expo-background-fetch` is unreliable). On-device-only ⇒ gaps.
4. Poller downtime / token expiry → silent gaps; their DB drifts from truth over time.

## The fork (chosen later)
- **Tier 1 — client-only, poll-on-open.** On app open: `recently-played?after=last`,
  infer durations, append. 100% on-device (keeps the privacy promise), zero infra.
  Misses listening beyond ~50 tracks between opens (lossy for heavy days).
- **Tier 2/3 — backend poller.** Server cron polls each user every ~20-30 min with a
  stored refresh token → DB of plays. Captures closed-app listening. Needs persistent
  **encrypted token storage + scheduler + small DB + always-on worker** (Render free tier
  sleeps → need a cron-pinger or paid worker). **Breaks "data never leaves your device."**

## How we beat stats.fm (the differentiators)
1. **Self-healing via export reconciliation.** Live-polled data is *provisional*. The
   Extended History export is ground truth (real `ms_played`, offline + podcasts) but laggy.
   On each re-import, **overwrite provisional data up to the export's end date**, then keep
   live-tracking after it. Errors get corrected instead of drifting forever.
2. **Gap-based duration inference.** From `recently-played` alone:
   `actual ≈ min(track.duration_ms, played_at[next] − played_at[this])`.
   The gap to the next play bounds how long this one was actually heard → skips stop
   overcounting. Cap at full length; treat large gaps as "stopped".
3. **Confidence labeling.** Mark stats *confirmed* (from export) vs *live estimate* so the
   numbers stay trustworthy. (stats.fm shows estimates as fact.)
4. **Foreground high-res sampling.** While the app is open, poll `currently-playing` every
   ~20-30s for an accurate active session + a "now playing" widget.

## Data model sketch
- Keep the imported baseline aggregate (current `wrapped_stats`) as the confirmed layer.
- Add a provisional `live_plays` log (played_at, track/artist, est_ms, source) since the
  baseline's `lastTs`. Merge confirmed + provisional at display time.
- Dedup by `played_at` (unique per play); persist `lastSeenPlayedAt`.

## Honest constraints
- Reliable closed-app capture is **impossible from the mobile client** (OS background
  limits) → reliability requires the backend poller. Tier 1 is the on-device compromise.
- Backend path conflicts with the on-device privacy tagline — surface that to the user.
- Recently-played excludes podcasts/local/offline → live layer is inherently music-only and
  approximate until the next export reconciles it.

## Recommendation
Ship Tier 1 (on-device, poll-on-open) first — it's honest, free, and the gap-duration +
reconciliation tricks make it surprisingly good. Offer Tier 2 (server poller) later as an
opt-in "always-on sync" for power users who accept server-side storage.
