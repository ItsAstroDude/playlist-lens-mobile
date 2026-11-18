import React from 'react'
import type { WidgetTaskHandlerProps } from 'react-native-android-widget'
import { ThisWeekWidget } from './ThisWeekWidget'
import { buildWidgetData } from './data'

export const WIDGET_NAME = 'ThisWeek'

/** Runs in the background when Android asks the widget to draw (added, resized, every 30 min). */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(<ThisWeekWidget data={buildWidgetData()} />)
      break
    default:
      break
  }
}
