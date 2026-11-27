import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native'
import { Colors, FontFamily, FontSize, Spacing, Type, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { Screen, ScreenHeader, Card, Section, ListRow, ToggleRow } from '@/components/ui'
import { confirmDialog, showToast } from '@/utils/dialog'
import { playCounts } from '@/utils/playDb'
import { BackupError, type Backup } from '@/utils/backupFormat'
import {
  backupStatus, onBackupStatus, backupToFolder, shareBackup, chooseFolder, setWeeklyBackup,
  pickBackup, restoreBackup, backupAgo as ago, type BackupStatus,
} from '@/utils/backup'

/**
 * Backup and restore (2.0.47): your history lives only on this phone, so keep a copy
 * — one small file in a folder you choose (Drive, Documents…), every week if you like —
 * and bring it back on a new phone. Restoring adds to what's here; nothing is replaced.
 */

const dateOf = (t: number) => new Date(t * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`

export default function BackupScreen() {
  const [st, setSt] = useState<BackupStatus>(backupStatus)
  useEffect(() => onBackupStatus(() => setSt(backupStatus())), [])
  const [here, setHere] = useState(() => { try { return playCounts().total } catch { return 0 } })
  const [busy, setBusy] = useState<null | 'folder' | 'share' | 'restore'>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const android = Platform.OS === 'android'

  const onBackup = useCallback(async () => {
    if (busy) return
    setBusy('folder')
    try {
      const r = await backupToFolder()
      if (r.ok) { haptic.success(); showToast(`Backed up · ${plural(r.plays, 'play')}`, 'checkmark-circle') }
      else if (r.reason === 'failed') { haptic.warning(); showToast(r.message ?? 'Couldn’t back up — try again', 'alert-circle-outline') }
    } finally { setBusy(null) }
  }, [busy])

  const onShare = useCallback(async () => {
    if (busy) return
    setBusy('share')
    try {
      const r = await shareBackup()
      if (!r.ok) showToast('Sharing isn’t available on this phone', 'alert-circle-outline')
    } catch {
      showToast('Couldn’t make the backup — try again', 'alert-circle-outline')
    } finally { setBusy(null) }
  }, [busy])

  const onWeekly = useCallback(async (on: boolean) => {
    haptic.light()
    if (on && !st.folder && !(await chooseFolder())) return
    setWeeklyBackup(on)
    if (on && !st.lastAt) onBackup()          // start with one now
  }, [st.folder, st.lastAt, onBackup])

  const runRestore = useCallback(async (b: Backup) => {
    setBusy('restore'); setProgress(0)
    try {
      const r = await restoreBackup(b, (done, total) => setProgress(done / total))
      setHere(playCounts().total)
      haptic.success()
      showToast(r.added
        ? `Restored · ${plural(r.added, 'play')} added`
        : 'Nothing new — every play in it is already here', 'checkmark-circle', 3200)
    } catch {
      haptic.error()
      showToast('The restore stopped part way. Run it again: what’s already in is skipped.', 'alert-circle-outline', 4200)
    } finally { setBusy(null); setProgress(null) }
  }, [])

  const onRestore = useCallback(async () => {
    if (busy) return
    let b: Backup | null
    try { b = await pickBackup() } catch (e) {
      haptic.warning()
      showToast(e instanceof BackupError ? e.message : 'Couldn’t open that file.', 'alert-circle-outline', 3600)
      return
    }
    if (!b) return
    const made = b.createdAt ? new Date(b.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null
    const span = b.first !== null && b.last !== null ? `, ${dateOf(b.first)} – ${dateOf(b.last)}` : ''
    const backup = b
    confirmDialog({
      glyph: 'cloud-download-outline',
      title: 'Restore this backup?',
      message: `${plural(b.plays, 'play')}${span}${made ? ` · made ${made}` : ''}.\n\nIts plays are added to the ${here.toLocaleString()} on this phone. Nothing here is replaced, and plays you already have are skipped.`,
      confirmLabel: 'Restore',
      onConfirm: () => { runRestore(backup) },
    })
  }, [busy, here, runRestore])

  const never = !st.lastAt
  return (
    <Screen>
      <ScreenHeader title="backup" subtitle="Your history lives only on this phone — keep a copy" />

      <Card tone={never ? 'accent' : 'glass'} padded>
        <Text style={Type.overline}>{never ? 'not backed up yet' : 'last backup'}</Text>
        <Text style={[styles.big, never && { color: Colors.warning }]}>{never ? 'Never' : ago(st.lastAt!)}</Text>
        <Text style={Type.caption}>
          {never
            ? `${plural(here, 'play')} exist only on this phone. A lost or reset phone would take them with it.`
            : `${plural(st.lastPlays ?? 0, 'play')}${st.lastWhere === 'folder' && st.folderName ? ` · in ${st.folderName}` : st.lastWhere === 'shared' ? ' · shared' : ''}`}
        </Text>
        {st.lastError ? <Text style={styles.error}>{st.lastError}</Text> : null}
      </Card>

      {busy === 'restore' && (
        <Card padded>
          <View style={styles.progressHead}>
            <ActivityIndicator color={Colors.greenPrimary} />
            <Text style={Type.label}>Restoring… {Math.round((progress ?? 0) * 100)}%</Text>
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(2, (progress ?? 0) * 100)}%` }]} /></View>
          <Text style={Type.caption}>Keep the app open until it’s done.</Text>
        </Card>
      )}

      <Section label="back up">
        {android && (
          <ListRow icon={busy === 'folder' ? 'hourglass-outline' : 'save-outline'} label={busy === 'folder' ? 'Backing up…' : 'Back up now'}
            hint={st.folderName ? `Into ${st.folderName} · the two newest are kept` : 'Choose a folder once (Drive, Documents…)'}
            onPress={busy ? undefined : () => { haptic.light(); onBackup() }} />
        )}
        <ListRow icon={busy === 'share' ? 'hourglass-outline' : 'share-outline'} tint="sky" label={busy === 'share' ? 'Making it…' : 'Share a copy'}
          hint="Send the file to Drive, email or another app" onPress={busy ? undefined : () => { haptic.light(); onShare() }}
          last={!android} />
        {android && (
          <ToggleRow icon="repeat" tint="violet" label="Back up every week" value={st.weekly} onValueChange={onWeekly}
            hint={st.folderName ? `When you open the app, into ${st.folderName} — only when there are new plays` : 'Into a folder you choose, when you open the app'}
            last={!st.folder} />
        )}
        {android && st.folder && (
          <ListRow icon="folder-open-outline" tint="amber" label="Change folder" hint={st.folderName ?? undefined}
            onPress={() => { haptic.light(); chooseFolder() }} last />
        )}
      </Section>

      <Section label="restore">
        <ListRow icon="cloud-download-outline" tint="pink" label={busy === 'restore' ? 'Restoring…' : 'Restore from a backup'}
          hint="Adds its plays to this phone — nothing here is replaced"
          onPress={busy ? undefined : () => { haptic.light(); onRestore() }} last />
      </Section>

      <Text style={styles.foot}>
        A backup holds every play (your Spotify import, tracked and recent plays), the covers you picked and your Recaps
        choices — not your Spotify login or settings. It stays wherever you put it: playlist.lens never uploads it.
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  big:   { fontFamily: FontFamily.syneBold, fontSize: FontSize['3xl'], color: Colors.greenPrimary, letterSpacing: -1.2, marginVertical: Spacing.xs },
  error: { ...Type.caption, color: Colors.error, marginTop: Spacing.sm },
  progressHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  track: { height: 6, borderRadius: 3, backgroundColor: alpha(Colors.greenPrimary, 0.15), overflow: 'hidden', marginVertical: Spacing.sm },
  fill:  { height: 6, borderRadius: 3, backgroundColor: Colors.greenPrimary },
  foot:  { ...Type.caption, textAlign: 'center', paddingHorizontal: Spacing.md },
})
