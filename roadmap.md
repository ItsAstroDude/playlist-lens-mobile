# Final Merged Stack

**Framework**: Expo (Managed Workflow)
**Navigation**: Expo Router
**Animations**: Reanimated 3 (spring: mass 1, damping 18, stiffness 200)
**Charts**: React Native Skia
**Lists**: FlashList
**Cache**: MMKV (metadata, palettes — 24h TTL)
**Secure storage**: Expo SecureStore (tokens only)
**Palette**: @bam.tech/react-native-image-colors
**Images**: react-native-fast-image (or expo-image)
**Export**: react-native-view-shot + native share sheet
**Haptics**: Expo Haptics (Light / Medium / Heavy hierarchy)
**Blur**: Expo BlurView
**Auth**: Expo AuthSession + CSRF state param
**Backend**: Flask on Railway

---

# Final Phase Order

## Phase 1 
Auth screen + Expo Router shell + OAuth + SecureStore + flush()

## Phase 2 
Playlist grid — FlashList, palette, MMKV cache, stagger, skeletons

## Phase 3 
Detail bottom sheet — Skia charts, tooltips, palette gradient, cold start UI

## Phase 4 
Compare + Taste Profile

## Phase 5 
Friends — share codes, compatibility

## Phase 6 
Story export — playlist card + compatibility card templates
