# playlist.lens: notes for coding agents

## Shipping rule (from Andrei, permanent)

Once an app has its first APK, **every change ships as an OTA update** (EAS Update), not a
new APK. Before publishing, check the native fingerprint still matches the installed build:

```bash
npx expo-updates runtimeversion:resolve --platform android   # must equal the APK's runtime
export EXPO_TOKEN=dummy-token-proxy-injects                  # the proxy injects the real token
npx eas-cli@latest update --branch preview --platform android --message "..." --non-interactive
```

**Installed APK (from 2026-11-23): versionCode 5, runtime
`b0b14760bcffaa123ab3b80282ceb5669f662b6b`.** Publish OTAs for this runtime only; older
APKs (versionCode 4 and below) no longer get updates.

Only build a new APK when a change touches native code (a new native dependency, a config
plugin, app.json native fields, `modules/`), and say so before building. "Push" means
publish an OTA update.

## Motion is final (from Andrei)

playlist.lens's animations are **perfectly tuned as they are**: playful and bouncy on
purpose. Don't retune, damp or "calm" its springs, and don't port Soundwave's calmer
motion settings here. (Soundwave is deliberately calmer; the two apps differ.)
