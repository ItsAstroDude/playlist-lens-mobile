/**
 * Expo config plugin — null-safe onUserLeaveHint override
 *
 * Fixes a known React Native NPE that occurs when Android calls
 * onUserLeaveHint() during the OAuth WebBrowser flow. The React
 * instance manager can be null at that moment, causing a hard crash.
 *
 * Fix: override the method in MainActivity with a try/catch so the
 * app survives the lifecycle event instead of crashing.
 */
const { withMainActivity } = require('@expo/config-plugins')

module.exports = function withSafeUserLeaveHint(config) {
  return withMainActivity(config, (config) => {
    const src      = config.modResults.contents
    const isKotlin = config.modResults.language === 'kotlin'

    const override = isKotlin
      ? `
  // Workaround: ReactActivityDelegate.onUserLeaveHint() NPE on Android.
  // Triggered by expo-web-browser OAuth flow. Safe to suppress.
  override fun onUserLeaveHint() {
    try { super.onUserLeaveHint() } catch (_: NullPointerException) {}
  }
`
      : `
  // Workaround: ReactActivityDelegate.onUserLeaveHint() NPE on Android.
  @Override
  public void onUserLeaveHint() {
    try { super.onUserLeaveHint(); } catch (NullPointerException e) {}
  }
`

    // Insert the override just before the final closing brace of the class.
    const lastBrace = src.lastIndexOf('}')
    config.modResults.contents =
      src.slice(0, lastBrace) + override + '\n}'

    return config
  })
}
