import React from 'react'
import { FlexWidget, TextWidget } from 'react-native-android-widget'
import type { WidgetData } from './data'

type Hex = `#${string}`
const BG: Hex    = '#131315'
const TEXT: Hex  = '#E5E1E4'
const MUTED: Hex = '#869585'
const OPEN = { clickAction: 'OPEN_URI', clickActionData: { uri: 'playlistlens://wrapped' } } as const

/**
 * The "This week" home-screen widget: time listened (with the change vs last week),
 * top artist, last played. Always dark, in your accent. Tap → Wrapped.
 */
export function ThisWeekWidget({ data }: { data: WidgetData }) {
  const accent = data.accent as Hex
  return (
    <FlexWidget
      {...OPEN}
      accessibilityLabel="This week in music — open Wrapped"
      style={{
        height: 'match_parent', width: 'match_parent',
        backgroundColor: BG, borderRadius: 24,
        paddingHorizontal: 18, paddingVertical: 14,
        flexDirection: 'column', justifyContent: 'space-between',
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent', alignItems: 'center' }}>
        <TextWidget text="THIS WEEK" style={{ fontSize: 11, fontFamily: 'DMMono_500Medium', color: MUTED, letterSpacing: 0.15 }} />
        <TextWidget text="playlist.lens" style={{ fontSize: 11, fontFamily: 'Syne_800ExtraBold', color: accent }} />
      </FlexWidget>

      {data.hasData ? (
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
          <TextWidget text={data.time} style={{ fontSize: 30, fontFamily: 'Syne_800ExtraBold', color: TEXT }} maxLines={1} />
          {data.delta ? (
            <TextWidget text={data.delta} style={{ fontSize: 11, fontFamily: 'DMMono_400Regular', color: accent }} maxLines={1} />
          ) : null}
        </FlexWidget>
      ) : (
        <TextWidget text="Open the app to start counting" style={{ fontSize: 13, fontFamily: 'DMMono_400Regular', color: MUTED }} maxLines={2} />
      )}

      <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
        {data.topArtist ? (
          <TextWidget text={`Top · ${data.topArtist}`} style={{ fontSize: 12, fontFamily: 'DMMono_500Medium', color: TEXT }} maxLines={1} truncate="END" />
        ) : null}
        {data.lastTrack ? (
          <TextWidget
            text={`Last · ${data.lastTrack}${data.lastArtist ? ` — ${data.lastArtist}` : ''}`}
            style={{ fontSize: 11, fontFamily: 'DMMono_400Regular', color: MUTED }} maxLines={1} truncate="END"
          />
        ) : null}
      </FlexWidget>
    </FlexWidget>
  )
}
