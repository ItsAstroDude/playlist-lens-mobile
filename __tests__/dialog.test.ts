/**
 * Tests for utils/dialog.ts — the on-brand Alert replacement (v1.6 polish).
 * Pure pub/sub, no mocks needed.
 */
import {
  showDialog, confirmDialog, resolveDialog, onDialog, showToast, onToast, _resetDialogs,
  type DialogOptions,
} from '@/utils/dialog'

afterEach(() => _resetDialogs())

describe('dialog queue', () => {
  it('shows the first dialog immediately and queues the rest FIFO', () => {
    const seen: (string | null)[] = []
    const unsub = onDialog(d => seen.push(d?.title ?? null))
    showDialog({ title: 'A', message: '' })
    showDialog({ title: 'B', message: '' })
    expect(seen).toEqual([null, 'A'])          // B waits its turn
    resolveDialog(true)
    expect(seen).toEqual([null, 'A', 'B'])
    resolveDialog(false)
    expect(seen).toEqual([null, 'A', 'B', null])
    unsub()
  })

  it('runs onConfirm or onCancel to match the choice', () => {
    const onConfirm = jest.fn(), onCancel = jest.fn()
    showDialog({ title: 'X', message: '', onConfirm, onCancel })
    resolveDialog(true)
    showDialog({ title: 'Y', message: '', onConfirm, onCancel })
    resolveDialog(false)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('lets a callback open a follow-up dialog', () => {
    let current: DialogOptions | null = null
    const unsub = onDialog(d => { current = d })
    showDialog({ title: 'first', message: '', onConfirm: () => showDialog({ title: 'second', message: '' }) })
    resolveDialog(true)
    expect(current).not.toBeNull()
    expect(current!.title).toBe('second')
    unsub()
  })

  it('late subscribers catch up with the open dialog', () => {
    showDialog({ title: 'open', message: '' })
    const cb = jest.fn()
    const unsub = onDialog(cb)
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ title: 'open' }))
    unsub()
  })

  it('confirmDialog adds a Cancel button; showDialog defaults to single-button', () => {
    let current: DialogOptions | null = null
    const unsub = onDialog(d => { current = d })
    confirmDialog({ title: 'c', message: '' })
    expect(current!.cancelLabel).toBe('Cancel')
    resolveDialog(false)
    showDialog({ title: 'info', message: '' })
    expect(current!.cancelLabel).toBeUndefined()
    unsub()
  })

  it('resolving with nothing open is a no-op', () => {
    expect(() => resolveDialog(true)).not.toThrow()
  })
})

describe('toast', () => {
  it('broadcasts to subscribers and stops after unsubscribe', () => {
    const cb = jest.fn()
    const unsub = onToast(cb)
    showToast('Saved', 'checkmark')
    expect(cb).toHaveBeenCalledWith({ message: 'Saved', glyph: 'checkmark', duration: undefined })
    unsub()
    showToast('again')
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
