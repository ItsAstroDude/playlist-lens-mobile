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
