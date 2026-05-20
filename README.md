<div align="center">

```
playlist.lens — mobile
```

**Premium Spotify playlist analytics for Android & iOS.**

[![Expo SDK](https://img.shields.io/badge/Expo-SDK_54-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB?style=flat-square&logo=react&logoColor=white)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Platform](https://img.shields.io/badge/Platform-Android_%7C_iOS-1DB954?style=flat-square&logo=android&logoColor=white)](https://github.com/ItsAstroDude/playlist-lens-mobile)
[![EAS Build](https://img.shields.io/badge/Built_with-EAS-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev/eas)

[**Web version**](https://github.com/ItsAstroDude/playlist-lens-web) · [**Backend**](https://playlist-lens-mobile.onrender.com)

</div>

---

## What it does

playlist.lens mobile is a native Android/iOS app that connects to your Spotify account and turns your playlists into rich analytics. Glassmorphism UI, spring animations, palette-adaptive colors extracted from each playlist's artwork, and a full breakdown of artists, genres, decades, popularity, and audio character.

Native companion to [playlist.lens web](https://github.com/ItsAstroDude/playlist-lens-web) — both use the same Flask backend.

---

## Features

- **Playlist grid** — Your Spotify playlists with palette-adaptive glass cards. Colors extracted from each album cover and applied to the card, glow, and sheet accent.
- **Detail sheet** — Bottom sheet with spring gesture dismiss. Shows vibe label, stats, top artists, audio profile, popularity distribution, decade breakdown, and genre cloud.
- **Vibe classification** — Computed from audio features (energy, danceability, valence, acousticness) when available. Falls back to genre keyword matching when audio features are deprecated for the app.
- **MMKV caching** — All analysis results and palette data cached locally with a 24h TTL for instant re-opens.
- **Cold start indicator** — Animated overlay when the Render backend is waking up from idle.
- **Glass UI** — Specular highlight lines, ambient aurora gradient, glass-border stat cards, spring-animated tab bar with glowing pill indicators.

---

## Tech stack

```
Framework     Expo SDK 54 · React Native 0.76 · Expo Router 4
Language      TypeScript (strict)
Animations    react-native-reanimated 4 (spring / timing / shared values)
Gestures      react-native-gesture-handler 2
Cache         react-native-mmkv (synchronous, native)
Images        expo-image (fast, cached, blurhash)
List          @shopify/flash-list
Auth          expo-secure-store · expo-web-browser · expo-linking
Palette       react-native-image-colors (dominant color extraction)
Typography    Syne 800 · DM Mono 400/500 (via expo-google-fonts)
Build         EAS Build (Expo Application Services)
Backend       Flask 3.1 on Render — shared with the web version
```

---

## Getting started

### Prerequisites

- Node.js 18+
- [EAS CLI](https://docs.expo.dev/eas-update/getting-started/): `npm install -g eas-cli`
- A Spotify app ([developer.spotify.com/dashboard](https://developer.spotify.com/dashboard))
- The backend running — either [self-hosted](https://github.com/ItsAstroDude/playlist-lens-web) or pointed at your own Render deploy

### 1. Clone & install

```bash
git clone https://github.com/ItsAstroDude/playlist-lens-mobile.git
cd playlist-lens-mobile
npm install
```

### 2. Point at your backend

Open `utils/api.ts` and update `BACKEND_URL` for production:

```ts
export const BACKEND_URL = __DEV__
  ? getDevUrl()                                      // auto-detected from Expo dev server
  : 'https://your-backend.onrender.com'              // ← your deployed backend
```

### 3. Build a development client

This app uses MMKV (native module) and requires a dev build — it will not run in standard Expo Go.

```bash
# Android
eas build --profile development --platform android

# iOS
eas build --profile development --platform ios
```

Install the resulting APK/IPA on your device, then:

```bash
npx expo start --dev-client
```

---

## Project structure

```
app/
  (tabs)/
    index.tsx          # Playlist grid screen
    compare.tsx        # Side-by-side playlist comparison
    profile.tsx        # Taste profile view
    friends.tsx        # Friend profile sharing
    _layout.tsx        # Animated tab bar with spring icons + glow pill

components/
  playlist/
    PlaylistCard.tsx   # Glass card with palette tint + specular highlight
  sheet/
    DetailSheet.tsx    # Full analysis bottom sheet (gesture-dismissible)
  ui/
    Skeleton.tsx       # Shimmer skeletons for loading states
    Button.tsx
    ServerState.tsx    # Cold-start overlay + retry banner

hooks/
  useSpotify.ts        # Playlist fetching with retry + cache
  useAnalysis.ts       # Full analysis pipeline (batched API calls)
  usePalette.ts        # Per-playlist color extraction
  useAuth.ts           # Spotify OAuth flow

utils/
  api.ts               # Fetch wrapper (cold-start timer, rate-limit retry, backoff)
  analyze.ts           # buildAnalysis() + vibe classification (audio + genre fallback)
  cache.ts             # MMKV wrapper with TTL

constants/
  theme.ts             # Colors, FontSize, Spacing, Radius, GreenGlow
  animation.ts         # Spring configs, haptic helpers
```

---

## Architecture notes

**Analysis pipeline** (`hooks/useAnalysis.ts`)

1. Fetch all tracks for the playlist (backend paginates, up to 500)
2. Rank artists by appearance frequency — ensures genre lookup covers the most representative artists
3. Batch-fetch audio features (100/request) and artist genres (50/request) **in parallel**
4. Build full analysis object client-side via `buildAnalysis()`

**Vibe classification** (`utils/analyze.ts`)

When audio features are available, each of 8 vibe labels is scored across multiple audio dimensions (multi-dimensional scoring, not hard thresholds). When audio features are unavailable (Spotify deprecated the endpoint for apps registered after Nov 2024), genre keywords are pattern-matched against the weighted top-genre list.

**Palette extraction** (`hooks/usePalette.ts`)

Colors are extracted once per playlist using `react-native-image-colors`, stored in a `useRef` map to avoid re-extraction across re-renders, and shared across the card, sheet header, bar charts, genre tags, and vibe chip.

---

## Notes

- **Audio features**: Only available for Spotify apps created before November 2024. Newer apps receive graceful empty responses — the app falls back to genre-based vibe classification automatically.
- **Track cap**: The backend fetches up to 500 tracks per playlist for performance. The displayed track count shows the real Spotify total; analysis is based on the fetched sample.
- **Expo Go**: Not supported — MMKV requires a native build. Use `eas build --profile development` to get a dev client.

---

<div align="center">
<sub>Built with Expo · React Native · Reanimated · a lot of DM Mono</sub>
</div>
