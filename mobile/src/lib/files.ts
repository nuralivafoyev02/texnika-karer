import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { useSecurityStore } from '@/store/security'
import type { PickedPhoto } from '@/store/types'

// Kamera yoki galereyadan rasm olib, serverga yuklashdan oldin kichraytiradi:
// uzun tomoni 1400 px, JPEG ~0.7 — odatda 300–600 KB (limit: reys 10 MB, profil 2 MB).
async function compress(uri: string, maxSide: number, quality: number): Promise<PickedPhoto> {
  const ref = await ImageManipulator.manipulate(uri).resize({ width: maxSide }).renderAsync()
  const result = await ref.saveAsync({ format: SaveFormat.JPEG, compress: quality })
  return { uri: result.uri, name: `photo-${Date.now()}.jpg`, mimeType: 'image/jpeg' }
}

export type PhotoSource = 'camera' | 'library'

export async function pickPhoto(source: PhotoSource, options: { maxSide?: number; quality?: number; square?: boolean } = {}): Promise<PickedPhoto | null> {
  // Kamera/galereya ochilganda Android ilovani "fonga" o'tkazadi — avto-qulf ishga tushmasligi uchun.
  useSecurityStore.getState().setExternal(true)
  try { return await pickPhotoInner(source, options) } finally { useSecurityStore.getState().setExternal(false) }
}

async function pickPhotoInner(source: PhotoSource, { maxSide = 1400, quality = 0.7, square = false }: { maxSide?: number; quality?: number; square?: boolean }): Promise<PickedPhoto | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) throw new Error('Kameraga ruxsat berilmagan. Telefon sozlamalaridan ruxsat bering.')
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) throw new Error('Galereyaga ruxsat berilmagan. Telefon sozlamalaridan ruxsat bering.')
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: square, aspect: square ? [1, 1] : undefined }
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
  if (result.canceled || !result.assets?.[0]) return null
  return compress(result.assets[0].uri, maxSide, quality)
}

// HTML → PDF → ulashish oynasi (Telegram, Gmail, Fayllarga saqlash…).
export async function shareHtmlAsPdf(html: string, dialogTitle: string): Promise<void> {
  const file = await Print.printToFileAsync({ html, base64: false })
  if (!(await Sharing.isAvailableAsync())) throw new Error('Bu qurilmada ulashish mavjud emas.')
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle, UTI: 'com.adobe.pdf' })
}

// Matn faylini (CSV) ulashish.
export async function shareTextFile(content: string, fileName: string, mimeType = 'text/csv'): Promise<void> {
  const { File, Paths } = await import('expo-file-system')
  const file = new File(Paths.cache, fileName)
  if (file.exists) file.delete()
  file.create()
  file.write(content)
  if (!(await Sharing.isAvailableAsync())) throw new Error('Bu qurilmada ulashish mavjud emas.')
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName })
}
