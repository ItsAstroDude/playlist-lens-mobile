// App entry: expo-router, plus the home-screen widget's background handler
// (Android runs it headless to draw the widget, even when the app isn't open).
// The widget library is Android-only: iOS never loads it.
import 'expo-router/entry'
import { Platform } from 'react-native'

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget')
  const { widgetTaskHandler } = require('./widgets/taskHandler')
  registerWidgetTaskHandler(widgetTaskHandler)
}
