import { useMemo } from 'react'
import { useIsCover } from '@/hooks/useScreen'
import { useLiveWindow } from '@/utils/liveWindow'
import { getCameraOutline } from '@/utils/settings'
import { cameraClearance } from '@/components/cover/outline'

/**
 * Bottom padding for a scroll view's content: `base` on the main screen; on the Flip's
 * cover screen at least enough for the last row to end above the cameras (whatever the
 * system's bottom inset says), so nothing can be left stuck behind the lenses.
 */
export function useBottomGutter(base: number): number {
  const cover = useIsCover()
  const { width, height } = useLiveWindow()
  const clear = useMemo(() => cover ? cameraClearance(getCameraOutline(), width, height) : 0, [cover, width, height])
  return Math.max(base, clear)
}
