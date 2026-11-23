# Final Merged Stack

**Framework**: Expo (Managed Workflow)
**Navigation**: Expo Router
**Animations**: Reanimated 3 (spring: mass 1, damping 18, stiffness 200)
**Charts**: React Native SVG (radar chart)
**Lists**: FlashList
**Cache**: MMKV (metadata, palettes — 24h TTL)
**Secure storage**: Expo SecureStore (tokens only)
**Palette**: @bam.tech/react-native-image-colors
**Images**: expo-image
**Export**: react-native-view-shot + native share sheet
**Haptics**: Expo Haptics (Light / Medium / Heavy hierarchy)
**Blur**: Expo BlurView
**Auth**: Expo AuthSession + CSRF state param
**Backend**: Flask on Railway

---

# Design System — Liquid Lens

Implemented from the `stitch_liquid_glass_playlist_analytics` stitch files.

- **Background**: `#131315` (near-black)
- **Primary accent**: `#53e076` (bright neon green)
- **Secondary**: `#CCBDFF` (lavender)
- **Tertiary/pink**: `#FF70A5`
- **Ambient glows**: violet (`rgba(78,3,208,0.14)`) top-left · pink (`rgba(255,112,165,0.09)`) bottom-right
- **Glass surfaces**: `rgba(255,255,255,0.04)` fill · `rgba(255,255,255,0.10)` border · `rgba(255,255,255,0.13)` specular highlight
- **Typography**: Syne 700/800 (headlines) · DM Mono 400/500 (data & labels)
- **Shape**: rounded-xl (28px) for cards · rounded-full for pills and badges

---

# Design Overhaul Phases

## Design Phase A — Design System ✅ DONE
- Updated `constants/theme.ts` to Liquid Lens palette
- New colors: `greenPrimary`, `violet`, `violetGlow`, `pink`, `pinkGlow`, `lavender`
- Added `display` font alias, `VioletGlow` shadow token
- `react-native-svg` installed for radar charts

## Design Phase B — Playlist Library ✅ DONE
- `PlaylistCard` redesigned: full-width, 188dp tall, cover art fills card
- Linear gradient overlay (transparent → near-black at bottom)
- Glass specular top edge, vibe badge from MMKV cache if available
- `index.tsx` switched to single-column FlashList
- Violet + pink ambient blobs added to background
- "Your Lenses" section heading added below logo header
- `PlaylistCardSkeleton` updated to match new full-width card shape
- Tab label: "playlists" → "lenses", "profile" → "taste", "friends" → "share"
- Active tab accent updated to `greenPrimary` (#53e076)

## Design Phase C — Analytics Detail Sheet ✅ DONE
- `DetailSheet` fully redesigned:
  - Hero section: blurred cover art background (BlurView) + crisp centered album art
  - Playlist name + owner at bottom of hero
  - Vibe pill with animated pulsing dot
  - Quick stats row (4 glass cards: tracks, artists, duration, avg pop)
  - Audio DNA glass panel with `RadarChart` SVG (6-axis hexagonal radar)
  - BPM display below radar
  - Micro-Genres cloud (color-coded pills cycling accent → pink → lavender)
  - Top Artists, Popularity, By Decade sections retained as bar rows
  - New `RadarChart` component in `components/ui/RadarChart.tsx`

## Design Phase D — Taste Profile ✅ DONE
- `profile.tsx` redesigned with Liquid Lens aesthetic
- Glass card placeholder with feature list
- Violet ambient glow + green aurora background

## Design Phase E — Web Redesign (Liquid Data) ✅ DONE
- `playlist.lens-web/index.html` CSS overhauled to Liquid Data design system
- Background: `#13131b` (violet tint near-black, replaces `#090910`)
- Primary accent: `#53e076` (Liquid Lens green, replaces Spotify `#1DB954` throughout all UI)
- Ambient glows: violet `rgba(78,3,208,0.14)` top-left + pink `rgba(255,112,165,0.09)` bottom-right + green aurora at top (via `body` background-image)
- Glass surfaces: `rgba(255,255,255,0.04)` fill · `rgba(255,255,255,0.10)` border · `rgba(255,255,255,0.13)` specular
- Nav active indicator updated to `#53e076`; bottom nav background updated to `rgba(19,19,27,.92)`
- Playlist card hover: green glow + inset ring, smoother transform
- All Chart.js radar/bar dataset colors updated to `#53e076`
- Radar pointLabels: `rgba(180,180,200,.45)` (readable against dark bg)
- Genre cloud pills, overlap tags, code display, compat section all updated
- Spinner iris: updated gradient to new green
- Comparison B value color: updated to `#FF70A5` (Liquid Lens pink)
- Friends avatar gradient: updated to `rgba(78,3,208)` → `#CCBDFF` (violet/lavender)

---

# App Build Phases

## Phase 1 ✅ DONE
Auth screen + Expo Router shell + OAuth + SecureStore + flush()

## Phase 2 ✅ DONE
Playlist grid — FlashList, palette, MMKV cache, stagger, skeletons

## Phase 3 ✅ DONE
Detail bottom sheet — analysis, bar charts, vibe chip, palette gradient

## Phase 4 ✅ DONE
Compare + Taste Profile shell

## Phase 5 — Taste Profile (full)
Aggregate analysis across all playlists, radar chart, share code

## Phase 6 — Friends / Share
Share codes, compatibility view, story export

---

# v1.8 — "Real Wrapped" + Design System (planned 2026-11-17)

Goal: Wrapped that tracks itself like stats.fm, loads fast, and an app that stops
feeling like a prototype.

## Why weekly stats never worked (diagnosis)
1. The Wrapped tab only renders the manual GDPR import — auto-collected plays only
   reach the secondary Recaps screen. No import → empty Wrapped.
2. Collection is on-device: one 50-play page on app open, throttled to 6h. >50 plays
   between opens (~2.5h of listening) are lost for good.
3. Collected plays count the full track duration (Spotify gives no listen time), so
   hours/"finished" are inflated and skips look like full listens.

## S1 — Server tracker ✅ live (web repo `tracking.py`, Neon + hourly GitHub Action)
Encrypted refresh tokens + Postgres + hourly GitHub Actions poll. Off until configured.
Setup checklist (owner):
- [ ] Create a free Postgres (Neon or Supabase) → copy its connection string
- [ ] Render env vars: `DATABASE_URL`, `TRACKING_KEY` (Fernet key), `CRON_SECRET`
- [ ] Merge + deploy the web branch (start command should be gunicorn, see S5)
- [ ] GitHub repo secrets (web repo): `TRACKER_URL`, `CRON_SECRET`; run the workflow once by hand

## S2 — App: opt-in + sync ✅ done (v1.7.1 OTA)
- "Listening tracking" switch (Settings + Wrapped empty state): enroll / status / delete-my-data
- Incremental sync of `/api/tracking/plays?after=` into a local play store
- Estimate real listen time from gaps between consecutive plays (cap at track length)
- Keep the device pull as a fallback for users who don't opt in

## S3 — Wrapped revamp (logic + UI) 🚧 v1.8: this-week-first period views shipped
- One play store (import + tracked) → one stats engine; week/month/season/year/all-time
- Wrapped tab leads with *this week* (stats.fm-style), lifetime below; works with no import
- Week-over-week deltas ✅, top artists/tracks/albums ✅, by-day bars ✅ — still to do: listening clock per period, streaks, artwork in period lists, Recaps on the new engine

## S4 — Design system 🚧 foundation shipped (tokens + primitives + gallery); screen migration next
Tokens (exists: colour/space/radius/type) + primitives in `components/ui`:
Screen, ScreenHeader, Card, Section, ListRow (from the Settings rows), Button, IconButton,
Chip, SegmentedControl, Stat, EmptyState, Sheet, Skeleton. Migrate screens onto them,
starting with Wrapped/Recaps. One radius set, one accent, calmer ambient glow.

## S5 — Load times
Measure first. Suspects: ZIP decoded via base64 in JS; multi-MB `wrapped_stats` JSON
parsed on every Wrapped visit; Recaps recomputes the buffer on open; backend runs the
Flask dev server (`Procfile: python app.py`) — switch to gunicorn.

## Next native build (bundle these — each changes the runtime fingerprint)
- App icon picker (alternate launcher icons — user's choice of icon)
- `eas.json`: `autoIncrement: true` on preview/production (every build so far is versionCode 1;
  the Play Store needs it to rise). Editing eas.json changes the fingerprint, so only with a build.
- jest-expo → ~54 (reinstall hoists build tooling that the fingerprint hashes)
- Move the play store from an MMKV JSON blob to SQLite (expo-sqlite) — S5 load times

---

# 2.0 — plan (drafted 2026-11-17)

**Audience:** solo-first (you, sideloaded APK), built so a public launch stays possible.
Spotify Development Mode caps an app at a small allow-list of users; extended quota is
currently only granted to established businesses — so nothing in 2.0 may *depend* on
strangers signing in. Social is parked behind that gate (see the end).

**Shape:** one native build at the start of 2.0 (everything that changes the runtime
fingerprint goes in together), then the rest ships over the air in phases.

## The headline — three big things (chosen 2026-11-18)
1. **Full redesign** — a new visual language end to end, new onboarding, a home-screen widget.
2. **Lifetime history explorer** — every play you've ever made: search, calendar heatmap,
   streaks, milestones, first listens, "on this day".
3. **Story mode Wrapped** — your own Wrapped any time: full-screen swipeable story for any
   week / month / year / all time, ending on a share card.

Order matters: the play database comes first (both 2 and 3 read from it), and the new look is
settled before 2 and 3 are built, so they're born in it rather than restyled after.

## Phase 0 — finish 1.8 "refine in place" (OTA)
- [x] DetailSheet + StartQueueSheet onto the shared Sheet (careful: their own drag gestures) — 1.9
- [x] Lenses PlaylistCard + login screen onto the design system — 1.9
- [x] Onboarding tour onto the design system — 1.9
- [~] Measure load times (cold start, Lenses, Wrapped, Recaps) → numbers in this file
      (the baseline the play database has to beat). Instrumentation shipped in 1.9.1
      (`utils/perf.ts`, Settings › About › Load times); numbers from the phone still to copy here.
- [ ] Update the Claude design system with TabHeader / RankRow / TrackRow / Sheet / Button
- ~~Wrapped extras (listening clock per period, artwork in period lists)~~ → folded into
  Phase 3, on the new engine

## Phase 1 — 2.0 foundations (the native build)
- [x] **Local play database** (expo-sqlite, new native module): one `plays` table for
      import + tracked + device plays, deduped, indexed by time. Replaces the MMKV JSON
      buffer (20k cap, re-parsed on every read) and the multi-MB `wrapped_stats` blob.
      Biggest load-time win, and the base for the explorer and story mode.
- [x] Import straight into SQLite (native byte read, no base64 round-trip in JS; staged + atomic)
- [x] Android home-screen widget: "This week" + now playing (react-native-android-widget,
      new native module — part of the redesign, but it has to ride this build)
- [x] App icon picker (the Aperture in all six accent colours)
- [x] `eas.json` autoIncrement; jest-expo → 54; app version 2.0.0 (+ expo-system-ui)
- [x] Crash + error reporting → own backend (`/api/errors`, Neon) + Settings › About › Errors
- [~] Backend: run on gunicorn (Procfile done — deploys when merged; check Render's start command)
- [x] Cold starts: accepted (free tier). 2.0.2 warms the server on launch/foreground
      (`/api/health`) and shows "Waking up the server · Ns" on every screen while it boots
- Already in the build, so no native work needed later: react-native-view-shot + expo-sharing
  (share cards), expo-notifications (weekly recap)

## Phase 2 — Headline 1: Design 2.0 = a NEW UI, motion-first (OTA)
Decided 2026-11-18. Not a restyle of the 1.x look: a new interface whose design starts
from motion. Direction: **Liquid** (prototype: claude.ai/artifact/YJ8PEesdsJxQpXH2KdALjS):
the playing song's cover colours the whole UI, frosted glass over a moving aurora, controls
that melt into each other. (Bouncy was the other prototype, not chosen.)
The 12 motions picked from the Motion Reel (claude.ai/artifact/5bdHJcHSDSsQb26SinuFLn):

| # | Motion | Where | Built with |
|---|---|---|---|
| 1 | Album-art aurora | Now Playing + story backgrounds; tints the app | Skia |
| 2 | Save burst | Save / pin / add to queue | Reanimated |
| 3 | Rolling numbers | Every stat (Wrapped hero, counts) | Reanimated |
| 4 | Liquid tab bar | Tab bar (gooey stretch between tabs) | Skia + Reanimated |
| 5 | Card opens into the lens | Lenses → playlist detail | Reanimated |
| 6 | Story mode, kinetic type | Story mode Wrapped | Reanimated |
| 7 | Liquid fill | Import progress, weekly goal | Skia |
| 8 | Aperture pull-to-refresh | Pull to refresh, splash, loading | Reanimated + SVG |
| 9 | Calendar ripple | History heatmap | Reanimated |
| 10 | Collapsing cover | Playlist / artist pages | Reanimated |
| 11 | Rack focus | Lists and sheets entering | Reanimated |
| 12 | Swipe with physics | Swipe tab | Gesture Handler + Reanimated |

- [x] Skia (`@shopify/react-native-skia`) added to the 2.0 native build
- [x] Motion primitives in `components/motion/` (one per row above), each honouring Reduce motion — 2.0
      (endless ones run on `useMotionClock`, never `timeSinceFirstFrame` — see `clock.ts`)
- [x] Liquid visual language: tokens (glass, aurora, type), tab bar, screens rebuilt on it — 2.0
- [ ] New onboarding: what the app does, tracking opt-in, optional import
- [ ] Widget restyled in the new look

## Phase 3 — Headline 2: Lifetime history explorer (OTA)
- [x] One stats engine on the play database: Week / Month / Year / All time and Recaps
      (`utils/stats.ts`: SQL-only, local time, tested — 2.0.3; Wrapped, Recaps, Story and
      the home strip moved onto it in 2.0.4. `utils/listening.ts`' summarize/comparePeriods
      are now only used by their own tests — delete them once 2.0.4 has settled)
- [x] History screen: search every play; scroll by day; filter by artist / track / album — 2.0.3
- [x] Calendar heatmap (a year of listening at a glance, tap a day → that day in History) — 2.0.4
      (Wrapped › Year and › All time with a year picker; longest streak per year)
- [x] Streaks (days in a row, an artist's run), milestones (10,000th play, 100th artist),
      first-ever listens ("new this week") — 2.0.5 (`utils/highlights.ts`; Wrapped › All time
      and the period views)
- [x] "On this day" throwbacks, one tap to queue them — 2.0.5 (Wrapped › Week)
- Heavy stats (All time, Recaps, streaks, milestones) run off the UI thread via
  `utils/sqlJob.ts` (one generator, sync or async runner) and open on the last saved
  answer. Measured at 150k plays in Node: recaps ~1.1 s, milestones ~0.7 s, All time
  ~0.5 s — fine off-thread, but worth precomputing per closed period if it grows
- [x] Listening clock + by-day for every period; artwork on every top list — 2.0.9
      (iTunes lookups spaced ~3 s apart: covers fill in over a minute the first time, cached after)
- **Phase 3 done (2.0.3–2.0.9).** Perf notes: heavy stats on a second SQLite connection
  (`statsDb`), cached by `plays.version`; Wrapped is a ScrollView, not FlashList (cards built once)

## Phase 4 — Headline 3: Story mode Wrapped (OTA) ✅ 2.0.10
- [x] Story player: full-screen slides, progress bars, tap / hold, music-free (2.0 motion #6)
- [x] Slides: time listened, top artist reveal (with photo), top-5 artists and songs, biggest
      day / month / year, listening clock + "personality" (night owl…), new-to-you artists
      - genres: not possible (no audio features / genres in the play data) — dropped
      - milestones and streaks: live in All time; not story slides yet (see "Next up" 3)
- [x] Any period: this or a past week / month / year, or all time — Wrapped (every view) and
      Recaps (weeks, months, years; seasons aren't an engine period). `utils/storyData.ts`
- [x] Share card at the end (`components/story/ShareCard`, 1080×1920 via view-shot + share sheet)
- [x] Recap notifications open the period that just ended as a story (week / month / year)

## Phase 4.5 — Discovery, after the headline (OTA + backend)
- [ ] Smart playlists, one tap to save to Spotify: Top 50 this month, Discoveries,
      Fading favorites, Second chances, Time machine
- [ ] Auto-updating smart playlists — the server already holds your (encrypted) token
      and runs hourly, so it can refresh "Your Weekly Top 30" every Monday
- [ ] Vibe / mood playlists from genres (audio features are unavailable to this app)

## Next up — proposed features (planned 2026-11-20)
Ranked by value for effort. Everything here works with data the app already has, ships
as OTA updates unless marked, and keeps history on the phone.

**Tier 1 — next**
1. **Artist and song pages.** Tap any artist or song anywhere (Wrapped, Recaps, History,
   stories) → its own page: lifetime time and plays, first listen ("you found them on
   3 Mar 2021"), a listening-over-time chart, your top songs by them, when you play them
   (clock), your longest run with them, and "Play top 10" / "Add to queue". The explorer's
   missing depth — the play database already answers all of it.
2. **Backup and restore.** The whole history lives only on the phone: a lost or reset phone
   loses years of imported + tracked plays. Export the play database to one file (share
   sheet → Drive / Files), import it back on a new phone. Also covers Phase 5's
   "export + delete" requirement.
3. **Smart playlists to Spotify** (Phase 4.5, now cheap): Top 50 this month, On repeat,
   Discoveries (new to you), Forgotten favorites, On this day — one tap creates the
   playlist via the existing `/api/playlist/create` + `/add`. Then auto-refresh weekly
   from the hourly server job (backend work).

**Tier 2 — after**
4. **Eras.** Detect your phases automatically: stretches where one artist (or album)
   dominated your weeks — "Your Radiohead era, Mar–May 2024". A timeline in All time and
   a story slide; Spark gets lines about them.
5. **Listening goal + streak saver.** A weekly minutes goal shown with the Liquid fill
   (motion #7 was designed for it), and an opt-in evening nudge when a long streak is
   about to break.
6. **Then vs now.** This month vs the same month last year (or any two periods side by
   side): who stayed, who's new, who faded. Uses the engine's existing comparisons.
7. **Milestones in stories.** A slide when a milestone fell in the period ("your
   10,000th play was in this month: …") and the streak record.

**Tier 3 — later**
8. **Skips.** Store the export's `skipped` flag (schema v2) for "most skipped", skip rate
   per artist, and songs you always skip at the same point.
9. **More widgets** (native build): streak, on this day, now-playing with the cover tint.
10. **Year-in-review season** — every 1 December, a full-year story with extra slides
    (eras, milestones, firsts), plus a printable poster-sized share card.

## Phase 5 — ship-ready (only if going public)
- [ ] Privacy policy + in-app data page (what's stored, where; export + delete)
- [ ] Play Store listing + Data safety form; iOS build / TestFlight
- [ ] Rate limits + abuse protection on the backend; tracker scaling beyond a handful of users
- [ ] Decide the Spotify question: extended quota vs an import-first public version

## Parked — Social (only with extended quota)
Real friend profiles, compatibility scores, weekly friend leaderboard, compare weeks.
The tracker's per-user play store is the foundation, so nothing in 2.0 blocks it.

## Open decisions
1. ~~Crash reporting~~ → own backend (decided 2026-11-18)
2. Backend cold starts: pay for an always-on Render instance (~$7/mo) or live with them?
3. iOS at all for 2.0, or Android-only?
4. ~~Alternate icons~~ → the six accents (decided 2026-11-18)

---

# Wrapped behind the wall (decided 2026-11-21)
Wrapped Year / All time still dropped ~30% of frames after two rounds of fixes (the UI
thread is fixed; the RenderThread/GPU drawing of the aurora + many glass cards is the limit),
and as a tab it stayed mounted and slowed the other tabs. So until it's fixed:
- Wrapped is its own page, `/wrapped` (Settings › About › Labs › Wrapped). It mounts only
  while open. Stories, Recaps, History and notifications are unchanged.
- Its tab is **Play**: a construction wall linking to Labs, and **More or less**, a game on
  your own listening (`utils/game.ts`, `app/(tabs)/play.tsx`): did you play this song /
  artist more or less than that one? Chains until a wrong answer; best score saved. Cheap to
  draw on purpose (two cards, no endless motion).
- [ ] Profile Wrapped's drawing (lag session), fix, then decide: back as a tab, or stay a page.

---

# Cover screen — Galaxy Z Flip 7 (started 2026-11-21)
A compact playlist.lens for the Flip's cover screen, built around the cameras the way
Samsung's own cover UI is. One UI 9 lets almost any app run there.

## The screen (measured on the phone)
| | Main (display 0) | Cover (display 1) |
|---|---|---|
| Panel | 1080 × 2520 px | 948 × 1048 px |
| What the app gets | 411 × 960 dp at ×2.625 | **474 × 524 dp at ×2.625** (1244 × 1375 px, scaled down to the panel) |
| Refresh rate | 120 Hz | 60 Hz by default (supports 120) |

- **Cameras bottom-right**, two lenses side by side, the flash to their left. Outline in
  panel px: lenses at x 649 / 836, y 935, radius 85 (`FLIP7_OUTLINE`, checked on the phone).
- **Samsung's "open on main screen" button sits at the bottom centre** (panel px x 455–523,
  `FLIP7_SYSTEM_BUTTON`). The tab strip runs from the left edge up to it. Keep controls and
  gestures clear of it; it's also why the cover UI has no bottom tab bar.
- **App pixels aren't panel pixels on the cover screen**: One UI gives apps a 1244 × 1375 px
  display at ×2.625 and scales it down to the 948 × 1048 panel (screenshots are panel-sized).
  Place things by panel position: scale by window size ÷ panel size (`panelScale`).
  Screenshots also leave out the camera cutout.
- **Which screen:** `useScreen()` (hooks/useScreen.ts) asks Android for the activity's
  display through the `DisplayInfo` native module (modules/display-info, APK versionCode 4,
  2026-11-21; confirmed on the phone: display 1 = cover). Older APKs fall back to window
  size (short + nearly square = cover).

## Camera ring (motion, prototype in Settings › About › Labs › Cover screen lab)
A ring hugging both lenses (`components/cover/`), in the cover art's colours:
- **Progress:** fills clockwise from the top centre (right lens first) as the song plays,
  with a glowing white tip. A new song rewinds it on `Spring.bouncy`; seeks use `Spring.snappy`.
- **Playing:** three soft pulses ripple out from the cameras (1.7 s cycle, 26 dp travel).
- **Paused:** the track breathes for 30 s, then holds still (no frame work while idle).
- **Reduce motion:** progress only, no pulses or breathing.
- Geometry: a stadium 7 dp outside the glass, 3.5 dp stroke; maths in `outline.ts` (tested).
- The lab draws at the real camera positions (no simulator), has a Tune mode (drag,
  steppers, red lens guide, saved per phone) and a background picker: the animated aurora
  in 20 colour sets + black/white + the cover art's colours, to check the ring on any backdrop.
- **Before it leaves the lab:** progress advances a fraction of a pixel every frame. Snap
  it to whole pixels like the now-playing line (`ProgressFill`) so it doesn't redraw at 60/120 Hz.

## Direction (changed 2026-11-21): the real app, compact
A separate 3-page cover mini-app (`CoverApp`: Now playing / This week / More) was built
and rejected: the cover screen shows **the real app** with compact layouts. The mini-app
is switched off in `CoverHost` (`MINI_APP_ENABLED = false`), kept only for reference.
- [x] Shared chrome (2.0.21): `TabHeader` collapses to one row (title + buttons, 24 pt);
      the tab bar becomes a small icon strip in the free bottom-left corner
      (`CoverTabs`); swipe anywhere off the edges changes tab (paused on Swipe, whose
      deck swipes sideways); the now-playing pill hides; `CoverRing` draws the ring over
      everything and a tap round the cameras opens Now playing.
- [x] Sizes from the live window, not the launch one: playlist cards (smaller row cover
      on the cover screen), `Sheet`, the swipe deck, What's new.
- [x] Sized from the live window too (2.0.22): story + its pictures, auth, artwork-fix
      sheet (DetailSheet and the tour already read the live window when they open).
- [x] Now Playing on the cover (2.0.22): compact layout (cover beside the title, stats on
      one line, Spotify as an icon or hold the cover), all above the cameras.
- [ ] Per screen on the cover: Lenses, Queue, Play, Swipe, Settings, sheets clear of the cameras.

## Plan (decided 2026-11-21)
- [x] Measure the screen; find the cameras; camera ring prototype + lab — OTA on 2.0.18
- [x] Native "which screen" flag (`DisplayInfo`) — APK
- [x] Ring without per-frame redraws (draws only round the cameras; progress steps whole pixels), then out of the lab — 2.0.21
- [x] Cover shell (`CoverHost` → `CoverApp`): over the normal app, which stays mounted and whose background pauses; "Use the full app" escape — 2.0.21
- [x] First sections: Now playing (tap art = play/pause, hold = open in Spotify, prev/next) and This week — 2.0.21
- [ ] Gesture-only navigation: swipe left/right between sections, swipe up for a section
      picker that springs out of the cameras; tap = play/pause, long-press = actions.
      Avoid the system's edges (top = quick panel, sides = back) and the bottom-centre button
- [x] A first-time hint (the pager nudges, "swipe for more") — 2.0.21; [ ] swipe-up section picker from the cameras
- [ ] Compact screens, in order: Now Playing, Home/stats, Swipe, Queue, then Wrapped and
      stories; dev/settings screens say "open on the main screen"
- [ ] More camera moments: a new song's cover flies out from behind the lenses; toasts and
      "added to queue" pop out of the cameras
- [ ] Ask for 120 Hz on the cover screen if the app can
- [ ] Restart test: does the app reload when moving between screens? If yes, handle
      `density` in `configChanges` (native, next APK)

## Half-folded (Flex mode / tabletop) — started 2026-11-23
Stand the Flip half-folded on a table while a song plays: Now Playing splits at the hinge
(`components/fold/TabletopNowPlaying.tsx`). The half that stands up: cover, title,
artist. The half lying flat: progress, big controls, your plays / time / rank, Spotify.
Opening the phone flat (or the arrow, or back) springs it away; the app underneath stays
where it was and its background holds still meanwhile.
- **Posture:** Jetpack WindowManager's `FoldingFeature` (state flat / half-opened,
  orientation, hinge bounds) through the `DisplayInfo` module's `getPosture` +
  `onPosture` (`androidx.window` 1.3.0) — **native, APK versionCode 5**. JS:
  `hooks/usePosture.ts`, maths in `utils/posture.ts` (tested). Older APKs read "no fold".
- Only when the hinge runs across the screen and leaves both halves ≥ 25% of the height;
  never on the cover screen. Dismissed with the arrow = stays away until the next fold.
- Labs › half-folded: on/off (default on), **Simulate half-folded** (a fold across the
  middle, to check the layout on APK 4), and a live "Fold right now" readout.
- Motion: the standing half drops in, the flat half rises (`Spring.entrance`); a new
  song's cover pops on `Spring.bouncy`. Reduce motion: fades only.
- [ ] Check on the phone: hinge position reported vs the real crease; which angles count
      as half-opened on One UI.
- [ ] Next: other screens in tabletop (stories with the controls below, the Play game).

## Tried and rolled back (2026-11-23): top island, floating spot
Two takes on "one living thing that speaks up when it matters" — both rejected on the
phone, both reverted in 2.0.25 (bar, toasts, wake banner as in 2.0.22):
- 2.0.23 **top island**: black pill round the selfie camera holding toasts, wake-up, the
  song and the tips lines. Verdict: "doesn't feel natural".
- 2.0.24 **spot**: a floating draggable dot that opened into a card for news. Verdict:
  "meh"; also it should *replace the now-playing bar* (the home-strip slot), not float.
  Code kept in git (`f83fa93`: components/spot, utils/spot.ts + tests).
- [ ] Next: prototype in the Motion lab first, not on the live app. Candidates: a dot in
      the bar's slot that spreads into the pill with news; a dot that rides the top while
      scrolling; an edge droplet.

## Designs picked (2026-11-23, design board "Flip: cover, pill, half-folded")
- **Pill → P2 "Drop card"** — 2.0.26. Settings › Now playing › Header button (the old
  Home strip value): a cover button with a progress ring by settings on Lenses
  (`components/nowplaying/DropCard.tsx`). Toasts (while Lenses is in front, via
  `claimToasts` in utils/dialog) and new songs drop out of it as a small card (2.6 s /
  3.5 s, `Spring.bouncy`); tap = the whole card (song, controls, stats, LATELY from
  `utils/dropCard.ts`, tested). The tips strip stays.
- **Cover → C2+ B "Bento"** — 2.0.26. On the cover screen Lenses shows `CoverBento`
  (now-playing tile 2×2, this week, top artist + streak) over playlist tiles three across
  (`PlaylistCard` layout 'tile'; sizes in `utils/bento.ts`, tested).
- **Cover Now playing → after Samsung's open Now Bar** — 2.0.27 (`components/cover/
  CoverPlayer.tsx`, replaces the compact sheet on the cover). Missing vs Samsung: seek,
  shuffle, save (✓) — the backend has no endpoints for them yet (needs /api/playback/seek,
  /shuffle and a library save + the user-library-modify scope).
- **Half-folded H2 → both C+D layouts built** — 2.0.28, to choose between on the phone:
  `components/fold/UpNext.tsx` ('strip' = C+D 1, 'pad' = C+D 2), switch in the view
  (now · 1 · 2) and in Labs (`settings.tabletopLayout`). Queue from the new server route
  GET /api/playback/upnext (playlist-lens-web branch ccr-fb44cf78-jfekr9 — **live only
  once merged to master**; until then the deck says the server needs updating).
  Spotify can't remove queue items, so "drop" = skip it when it starts (watcher in
  NowPlayingBar, `utils/upNext.ts`, tested); "play now" = skip ahead to it.
- **Half-folded Lenses "stage"** — 2.0.31, **rejected and removed in 2.0.32** ("I don't
  like this layout idea": a big stage card between the header and the hinge, playlists
  below). Kept: folded, the cover button opens the full view (`requestTabletop`);
  auto-open on fold back ON by default. [ ] A better half-fold idea for Lenses / when
  nothing plays — design first, on the board.
- **Drop card open/close** — 2.0.28: unfolds from the button (top-right corner held,
  content fades in), folds back in; anchor corrected for the status bar.
  2.0.29: the cover is a shared element (button art → card cover, `Spring.default` open,
  240 ms in-out close), words then controls stagger in, the button hides until it has
  folded back.

# iOS build — plan (2026-11-23, nothing built yet)
**Account:** a friend's paid Apple Developer account (Andrei is asking what's easiest for
him). Simplest: he adds Andrei to his team in App Store Connect (App Manager), registers
the bundle id `com.andrei.playlistlens`, and creates an **App Store Connect API key**
(Issuer ID + Key ID + .p8) for EAS. With the key, builds and TestFlight uploads run from
here with no Apple sign-in. The app shows under his name until it moves to an account
of Andrei's own (App Store Connect can transfer apps).

**Where it goes:** TestFlight (recommended: no device registration, friends can join,
OTAs still work). Ad hoc needs every iPhone's UDID registered first.

**Already checked (no account needed):**
- [x] The JS bundles for iOS (`expo export --platform ios`, 7 MB) — no blockers.
- [x] Android-only widget library no longer loads on iOS (index.ts).
- iOS gets its own fingerprint (`e9dd482d…` today); Android stays `b0b14760…`.
- **Don't touch eas.json casually:** it is part of the ANDROID fingerprint too (checked:
  adding a profile changes it), so any iOS profile change waits for the next APK.
  TestFlight uses the existing `production` profile → channel `production`, so iOS OTAs
  go to the `production` branch (Android stays on `preview`).

**Before the first iOS build (code, no account):**
- [x] Recap notifications: already cross-platform (only the Android channel is skipped on iOS).
- [x] Save image: iOS already falls back to the share sheet (its "Save Image" saves to
      Photos) — no new native module, so the Android fingerprint stays put.
- [x] Android-only bits hidden on iOS: Flip cover/fold Labs rows, the app-icon picker
      (until iOS icon images are added to the plugin config — next APK + first iOS build);
      the widget has no iOS UI and its library isn't loaded there.
- [x] Spotify sign-in: `Linking.createURL('/callback')` = `playlistlens://callback` in a
      standalone build, which the server allows. [ ] Confirm on a real iPhone.
- [ ] Check the header, tab bar and sheets round the notch / Dynamic Island.

**Build day:** `eas build -p ios --profile production` → `eas submit -p ios` →
TestFlight → install. Then the shipping rule gains a second runtime: publish each OTA
for Android (preview) and iOS (production).

---

# The family — Spark + a sister player (planned 2026-11-18)

Two things, planned together because they share code: **Spark** comes into
playlist.lens, and a **sister media player** joins the family (local files + Spotify,
in one app). Spark's source of truth: `docs/spark/SPARK_BRIEF.md` + `docs/spark/art/`.

## A. Spark in playlist.lens

**Accessory (decided):** Spark wears **headphones in both apps** — designed to fit the
SVG spec (a band over the top point, cups on the side points), amber body unchanged.

**Who:** a chubby amber four-point star with a face — "a little smarter than a rock.
but hey." Lowercase one-liners, moves on springs, never covers the music, never makes
things up. Fixed amber `#FFC23D` — he does NOT take the album-art tint (he's a separate
little being sitting on the UI). Credit: "made by astro".

**Principle: scripted first.** Every line comes from a line bank filled with the app's
own computed numbers (code inserts them; nothing generated states a number). A
generated tier (an LLM writing lines from aggregate stats) stays out unless Andrei
decides otherwise — no cloud LLM, no new cost, no listening data leaving for Spark.

### S1 — Spark himself (the component)
- [ ] `Spark` component: the exact SVG spec drawn with react-native-svg, animated with
      Reanimated — a parametric face (eye shape, mouth path, blush) + body squash/stretch,
      tilt and an extras layer (ring, orbiting stars, sparkles, z's, glitch ghost)
- [ ] Moods: idle (bob, sway, blink ~3.4 s ± jitter), listening, thinking, talking,
      happy (hop + sparkles), error (> <, glitch), sleeping (14° tilt, z's), loading
      (squish to a square), uwu, shocked — plus the missing ones: unsure (one squinted
      eye), unloaded/offline (dim), vibing (eyes shut, bob to the beat)
- [ ] Tiny Spark (body + two eyes) for ≤ 24 px: chips, the widget, notification icon
- [ ] Rules baked in: transform/opacity only, ONE loop at a time, pauses off-screen and
      in the background, static pose under Reduce motion, soft dark glow when he sits
      on yellow/orange artwork
- [ ] Speech bubble: Outfit 500/700, cream on dark glass, auto-dismiss ~4 s,
      `accessibilityLabel="Spark: <line>"`
- [ ] Motion lab page for Spark: every mood, the tiny version, the bubble

### S2 — his brain (the director + line banks)
- [ ] `SparkDirector`: decides when he speaks — at most 1 unprompted line per screen
      visit and ~3 per session; quiet while scrolling, editing or reading a chart;
      never on every song change; greeting only on first open or after ≥ 12 h
- [ ] Line banks per event × mood, drawn as a shuffled deck (no repeats), in his voice
      (canon lines from the brief + the proposed ones, all lowercase, no emoji)
- [ ] Memory on the phone only (MMKV): last greeting, lines shown, milestones already
      celebrated, mute setting
- [ ] Setting: Spark **on / quiet (visible, silent) / off**

### S2b — his AI brain ("local on cloud", $0) — decided 2026-11-18: Spark's AI must work
Andrei wants Spark's real AI, free. Free AI APIs shrank in 2026 (Gemini free ≈ 20
requests/day on Flash; Groq's free limits keep moving), and the laptop is only sometimes
on — so Spark gets **his own small model on a free cloud server**, like he runs locally
on astrobox, just somewhere that's always on.
- [ ] **spark-brain**: llama.cpp server with a small instruct model (Qwen-class, ~2–4B,
      Q4) on **Oracle Cloud Always Free ARM** (2 OCPU / 12 GB since the June 2026 cut).
      HTTPS + an API key; only the playlist.lens backend talks to it, never the phone.
- [ ] **Pre-baked, not live**: the backend asks Spark for lines when your stats change
      (after each hourly tracker run, after an import, on Monday for the week) and stores
      them; the app reads ready lines instantly. CPU slowness (seconds per line) never
      shows. Tap-to-ask questions use the same server live, with a "thinking" Spark.
- [ ] **Guard rails in code**: Spark's system prompt from the brief; output must be one
      line, ≤ 14 words, lowercase, no emoji, and **every number in it must appear in the
      facts sent** (else rejected and a scripted line is used). Only aggregates go in —
      no tokens, ids or play-by-play history.
- [ ] **Fallback chain**: spark-brain → (optional) the laptop over Tailscale Funnel when
      it's on → scripted line banks. Spark never goes silent because a server is down;
      he just gets less clever ("unloaded" mood when the brain is unreachable).
- [ ] Free cloud APIs (Groq / Gemini / Cloudflare Workers AI's 10k neurons/day) stay an
      optional extra fallback, not the plan — their free tiers keep shrinking.

### S3 — where he lives in playlist.lens
| Place | Spark |
|---|---|
| Home | **the dot in the playlist.lens wordmark is his home** (his lore: he lives in the crossbar of the A). Off duty it's just a dot; he pops out of it, squash-lands, and hops back in |
| Lenses strip | the live weekly lines (already built) become things Spark says when you tap him |
| Opening a lens | `loading` while analysing → `happy` hop + one headline insight |
| Vibe from genres | `unsure` face + an honest line (audio features are unavailable to this app) |
| Stat explainer | long-press a stat → Spark explains it in one line |
| Wrapped / story mode | reacts to the week; the story's last slide is his ("that's your week. i counted. twice.") |
| Pull to refresh | sits inside the aperture while it spins |
| Empty states | `sleeping` ("nothing here yet. i'll nap till you add one.") |
| Errors / offline | `error` / `unloaded` + one honest line — the real message and its button come first |
| Widget | tiny Spark beside the week's time |
| Notifications | off by default; the weekly recap in his voice, opt-in |
| Easter eggs | tap him 5× → big hop + a rock joke; a hidden rock somewhere ("that's my rival. we don't talk.") |
| About | fine-print humour ("the most intelligent star ever made.* *out of 1 star tested.") + "made by astro" |

## B. Soundwave — the sister player (local files + Spotify, one app)

**What:** a music player in the playlist.lens family. It plays music files on the
phone (MP3, FLAC, M4A, OGG) AND drives Spotify, from one Liquid interface, with Spark
vibing in the corner. playlist.lens stays the stats/analysis app; the player is where
you listen. Your local plays count in playlist.lens's Wrapped too.

### The honest constraint
Spotify does not let third-party apps stream its audio. "Spotify" in the player means
**controlling the Spotify app** (play, pause, skip, seek, queue, start playlists) and
showing it beautifully — the same thing playlist.lens's transport already does, done
properly. It needs Premium. Local files play inside the player itself.

### Architecture
- **Separate repo** (decided: the two apps' designs will differ a lot). The player gets
  its own design language; only **Spark** must be identical in both, so he lives in a
  tiny shared package (`spark`: component + moods + line banks + the brain client),
  pulled into both apps as a git dependency. Everything else is copied once and then
  allowed to diverge.
- **Two playback engines behind one `Player` interface:**
  - *Local* — expo-audio's native `AudioPlaylist` (Media3/ExoPlayer): background play,
    lock-screen + notification controls, Bluetooth buttons, FLAC. (Changed 2026-11-18:
    react-native-track-player still isn't solid on the new architecture that SDK 58 requires.)
  - *Spotify* — remote control through the existing backend's playback endpoints (and
    later the Spotify App Remote SDK for instant state, if it's worth a native module)
  - One "now playing" state, one queue screen; the UI never cares which engine plays
- **Library:** Android's media store (expo-media-library) for songs/albums/artists/
  folders; embedded cover art; `.lrc` lyrics next to the file when present
- **Shared listening:** local plays are posted to the same backend tracker
  (`src = local`), so playlist.lens shows them in Wrapped, recaps and story mode
- Same Spotify app + backend + allow-list as playlist.lens (Development Mode cap applies)

### Phases
- **P0 — setup**: new repo + Expo app; the `spark` package extracted from playlist.lens and
  shared by both; same Spotify app + backend
- **P1 — local player MVP:** library (songs / albums / artists / folders), search, queue,
  full-screen Liquid Now Playing (cover-tinted aurora, big cover, swipe to change track),
  lock-screen controls, gapless, shuffle/repeat, sleep timer, Spark vibing
- **P2 — Spotify mode:** your Spotify now playing in the same screen; browse your
  playlists and start them; the queue cart from playlist.lens works here too
- **P3 — the family link:** local plays flow into playlist.lens stats; "open in
  playlist.lens" from any album/artist; shared accent + icon colourways
- **P4 — nice to have:** an equaliser (native effect), `.lrc` synced lyrics, a widget,
  Android Auto, a mixed queue (local → Spotify hand-off), iOS

### Status (2026-11-18)
- **P0 + P1 built** as Soundwave 0.1: Expo SDK 58, local library (tags + covers via
  `@missingcore/react-native-metadata-retriever`), queue engine, Wave UI, Spark, play log.
  First APK built on EAS (`@itsastrodudr/soundwave`). Waiting on a GitHub repo to push to.
- **Design — "Wave":** flat ink surfaces (no glass), cream type, one mint accent,
  Bricolage Grotesque headlines + Outfit body; wave scrubber, live wave, swipeable cover.
- Spark is copied in for now (`src/spark`), identical to playlist.lens; becomes the
  shared package in P3.

### Decisions
- ~~Spark default~~ → **on**, with his AI working (S2b) · ~~Headphones~~ → **both apps**
  · ~~Code setup~~ → **separate repo**, Spark shared as a package
- ~~Name~~ → **Soundwave** (decided 2026-11-18). Wordmark idea to try: **sound.wave**, the
  family dot like playlist.lens, which is also a home for Spark
