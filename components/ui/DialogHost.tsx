import React, { useEffect, useState } from 'react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { onDialog, resolveDialog, type DialogOptions } from '@/utils/dialog'

/**
 * Root-mounted renderer for `showDialog()` (utils/dialog.ts). Mount once, after the
 * navigator. Toasts (`showToast()`) open out of the spot (components/spot).
 */
export function DialogHost() {
  return <DialogLayer />
}

function DialogLayer() {
  const [open, setOpen] = useState<DialogOptions | null>(null)
  // Keep the last dialog's content while it fades out — otherwise the card would
  // empty itself mid-animation.
  const [shown, setShown] = useState<DialogOptions | null>(null)

  useEffect(() => onDialog(d => { setOpen(d); if (d) setShown(d) }), [])

  if (!shown) return null
  return (
    <ConfirmModal
      visible={!!open}
      title={shown.title}
      message={shown.message}
      glyph={shown.glyph}
      confirmLabel={shown.confirmLabel ?? 'OK'}
      cancelLabel={shown.cancelLabel ?? null}
      destructive={shown.destructive}
      onConfirm={() => resolveDialog(true)}
      onCancel={() => resolveDialog(false)}
    />
  )
}
