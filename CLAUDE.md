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

**Build on the live branch, not `master`.** `master` has fallen behind the app on the
phone before (2026-11-25: master was 2.0.16 while 2.0.42 lived on an unmerged branch).
Before starting, compare the newest `preview` update (`npx eas-cli@latest update:list
--branch preview --limit 1 --non-interactive`) with the top `utils/whatsNew.ts` entry; if
they differ, find the branch whose top entry matches and work from it.

Only build a new APK when a change touches native code (a new native dependency, a config
plugin, app.json native fields, `modules/`), and say so before building. "Push" means
publish an OTA update.

## Motion is final (from Andrei)

playlist.lens's animations are **perfectly tuned as they are**: playful and bouncy on
purpose. Don't retune, damp or "calm" its springs, and don't port Soundwave's calmer
motion settings here. (Soundwave is deliberately calmer; the two apps differ.)

## Instant, like Instagram (from Andrei, 2026-11-23)

Things that depend on the server should feel instant; only the things that must be live
are allowed to wait (playback: skip, pause, the queue).
- **Reads:** show whatever is saved straight away, however old (`readCache` in
  utils/cache), and refresh quietly behind it. A loading state only when nothing is
  saved. A failed refresh keeps what's on screen.
- **Writes that can wait** (playlist changes and the like): show them as done at once and
  send them through the outbox (`enqueue` in utils/outbox), which retries across restarts.
