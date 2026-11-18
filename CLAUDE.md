# playlist.lens: notes for coding agents

## Shipping rule (from Andrei, permanent)

Once an app has its first APK, **every change ships as an OTA update** (EAS Update), not a
new APK. Before publishing, check the native fingerprint still matches the installed build:

```bash
npx expo-updates runtimeversion:resolve --platform android   # must equal the APK's runtime
export EXPO_TOKEN=dummy-token-proxy-injects                  # the proxy injects the real token
npx eas-cli@latest update --branch preview --platform android --message "..." --non-interactive
```

Only build a new APK when a change touches native code (a new native dependency, a config
plugin, app.json native fields, `modules/`), and say so before building. "Push" means
publish an OTA update.
