// App entry: expo-router, plus the home-screen widget's background handler
// (Android runs it headless to draw the widget, even when the app isn't open).
import 'expo-router/entry'
import { registerWidgetTaskHandler } from 'react-native-android-widget'
import { widgetTaskHandler } from './widgets/taskHandler'

registerWidgetTaskHandler(widgetTaskHandler)
