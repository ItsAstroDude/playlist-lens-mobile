import { createContext, useContext, useEffect, useState } from 'react'
import { usePosture } from '@/hooks/usePosture'
import { useIsCover } from '@/hooks/useScreen'
import { tabletopSplit } from '@/utils/posture'
import { flexPanelEnabled, onFoldSettings } from '@/utils/settings'
import { useLiveWindow } from '@/utils/liveWindow'

/**
 * Flex panel (2.0.35): folded like a laptop, the app moves to the half that stands up
 * and the flat half becomes a music remote (components/fold/FlexPanel). This says where
 * the fold is — null when the phone is flat, on the cover screen, or the panel is off.
 */
export function useFlexSplit(): { top: number; bottom: number } | null {
  const { height } = useLiveWindow()
  const posture = usePosture()
  const cover = useIsCover()
  const [on, setOn] = useState(flexPanelEnabled)
  useEffect(() => onFoldSettings(() => setOn(flexPanelEnabled())), [])
  return on && !cover ? tabletopSplit(posture, height) : null
}

/**
 * The height the app's screens actually have: the standing half while folded, else
 * null (= the window). Sheets read it so they open inside the half, not off the top.
 */
export const ContentHeightContext = createContext<number | null>(null)

export function useContentHeight(): number {
  const { height } = useLiveWindow()
  return useContext(ContentHeightContext) ?? height
}
