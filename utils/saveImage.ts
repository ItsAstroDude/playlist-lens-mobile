/**
 * Save an image file to a folder the user picks once (Android's Storage Access
 * Framework, part of expo-file-system — no new native module). The folder is
 * remembered; if it's gone or no longer allowed, we ask again.
 */
import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import { storage } from '@/utils/cache'

// settings.* survives Clear cache.
const FOLDER_KEY = 'settings.saveFolderUri'
const SAF = FileSystem.StorageAccessFramework

async function writeInto(dir: string, fileUri: string, name: string): Promise<void> {
  const dest = await SAF.createFileAsync(dir, name, 'image/png')
  const b64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 })
  await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 })
}

/** 'saved', 'cancelled' (no folder picked) or 'unsupported' (not Android). */
export async function saveImageToFolder(fileUri: string, name: string): Promise<'saved' | 'cancelled' | 'unsupported'> {
  if (Platform.OS !== 'android') return 'unsupported'
  const known = storage.getString(FOLDER_KEY)
  if (known) {
    try { await writeInto(known, fileUri, name); return 'saved' } catch { storage.remove(FOLDER_KEY) }
  }
  const perm = await SAF.requestDirectoryPermissionsAsync()
  if (!perm.granted) return 'cancelled'
  storage.set(FOLDER_KEY, perm.directoryUri)
  await writeInto(perm.directoryUri, fileUri, name)
  return 'saved'
}
