import React from 'react'
import { Platform } from 'react-native'

/**
 * Redraw the home-screen widget with fresh numbers — after a sync, an import, or when
 * the app goes to the background. No-op off Android or on builds without the widget.
 */
export async function refreshWidget(): Promise<void> {
  if (Platform.OS !== 'android') return
  try {
    const { requestWidgetUpdate } = require('react-native-android-widget')
    const { ThisWeekWidget } = require('@/widgets/ThisWeekWidget')
    const { buildWidgetData } = require('@/widgets/data')
    const { WIDGET_NAME } = require('@/widgets/taskHandler')
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: () => <ThisWeekWidget data={buildWidgetData()} />,
    })
  } catch { /* no widget placed / module missing — nothing to do */ }
}
