import { Platform } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'

// ── Biometrik kirish va ilovani qulflash ──────────────────────────────────────
// 1) Biometrik kirish: login/parol qurilmaning xavfsiz xotirasida `requireAuthentication`
//    bilan saqlanadi — o'qish uchun tizim Face ID / barmoq izini so'raydi. Biometriya
//    o'zgarsa (yangi barmoq izi qo'shilsa) tizim kalitni bekor qiladi va parol qaytadan so'raladi.
// 2) Ilovani qulflash: fondan qaytganda belgilangan vaqtdan keyin biometriya (yoki
//    qurilma PIN kodi) so'raladi. Ma'lumot serverdan qayta yuklanmaydi.

export type BiometricInfo = {
  available: boolean // qurilmada uskuna bor va foydalanuvchi biometriya sozlagan
  hasHardware: boolean
  enrolled: boolean
  deviceSecured: boolean // kamida PIN / ekran qulfi o'rnatilgan (qulf uchun yetarli)
  label: string // "Face ID", "Barmoq izi" yoki "Biometrik"
}

export async function getBiometricInfo(): Promise<BiometricInfo> {
  try {
    const [hasHardware, enrolled, types, level] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
    ])
    let label = 'Biometrik'
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) && Platform.OS === 'ios') label = 'Face ID'
    else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) label = 'Barmoq izi'
    else if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) label = 'Yuz orqali ochish'
    return { available: hasHardware && enrolled, hasHardware, enrolled, deviceSecured: level !== LocalAuthentication.SecurityLevel.NONE, label }
  } catch {
    return { available: false, hasHardware: false, enrolled: false, deviceSecured: false, label: 'Biometrik' }
  }
}

export const biometricErrorText = (error?: string) => {
  switch (error) {
    case 'user_cancel':
    case 'app_cancel':
    case 'system_cancel':
      return ''
    case 'lockout': return 'Urinishlar ko‘payib ketdi. Bir ozdan keyin qayta urinib ko‘ring yoki parol bilan kiring.'
    case 'not_enrolled': return 'Qurilmada Face ID / barmoq izi sozlanmagan.'
    case 'not_available': return 'Biometrik tekshiruv bu qurilmada mavjud emas.'
    case 'passcode_not_set': return 'Avval qurilmada ekran qulfini (PIN) o‘rnating.'
    default: return 'Tasdiqlab bo‘lmadi. Qayta urinib ko‘ring.'
  }
}

export type AuthResult = { success: boolean; error?: string }

export async function authenticate(promptMessage: string, { allowDeviceFallback = true } = {}): Promise<AuthResult> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Bekor qilish',
      fallbackLabel: 'Parol / PIN',
      disableDeviceFallback: !allowDeviceFallback,
    })
    return result.success ? { success: true } : { success: false, error: result.error }
  } catch {
    return { success: false, error: 'unknown' }
  }
}

// ── Saqlangan kirish ma'lumoti ────────────────────────────────────────────────
const credKey = (userId: string) => `qz_bio_cred_${userId}`
const LAST_KEY = 'qz_bio_last'
const lockKey = (userId: string) => `qz_lock_${userId}`

export type BiometricUserHint = { userId: string; login: string; fullName: string }
type Credentials = { login: string; password: string }

export async function getBiometricHint(): Promise<BiometricUserHint | null> {
  try {
    const raw = await SecureStore.getItemAsync(LAST_KEY)
    return raw ? (JSON.parse(raw) as BiometricUserHint) : null
  } catch {
    return null
  }
}

export async function isBiometricEnabled(userId: string): Promise<boolean> {
  const hint = await getBiometricHint()
  return Boolean(hint && hint.userId === userId)
}

export async function enableBiometric(hint: BiometricUserHint, password: string, label: string): Promise<void> {
  // iOS: yozish paytida so'rov chiqmaydi — shuning uchun biometriyani shu yerda tasdiqlaymiz.
  // Android: kalit yozishning o'zida tasdiq so'raydi, ikkinchi so'rov kerak emas.
  if (Platform.OS === 'ios') {
    const check = await authenticate(`${label} orqali kirishni yoqish`, { allowDeviceFallback: false })
    if (!check.success) throw new Error(biometricErrorText(check.error) || 'Tasdiqlash bekor qilindi.')
  }
  const payload: Credentials = { login: hint.login, password }
  await SecureStore.setItemAsync(credKey(hint.userId), JSON.stringify(payload), {
    requireAuthentication: true,
    authenticationPrompt: `${label} orqali kirishni yoqish`,
  })
  await SecureStore.setItemAsync(LAST_KEY, JSON.stringify(hint))
}

export async function readBiometricCredentials(userId: string, label: string): Promise<Credentials | null> {
  try {
    const raw = await SecureStore.getItemAsync(credKey(userId), {
      requireAuthentication: true,
      authenticationPrompt: `${label} bilan tizimga kirish`,
    })
    return raw ? (JSON.parse(raw) as Credentials) : null
  } catch {
    // Foydalanuvchi bekor qildi yoki biometriya o'zgargani uchun kalit bekor qilindi.
    return null
  }
}

// Parol o'zgarganda saqlangan ma'lumotni yangilaymiz (aks holda keyingi kirish rad etiladi).
export async function updateBiometricPassword(userId: string, login: string, password: string): Promise<void> {
  if (!(await isBiometricEnabled(userId))) return
  try {
    await SecureStore.setItemAsync(credKey(userId), JSON.stringify({ login, password }), {
      requireAuthentication: true,
      authenticationPrompt: 'Yangi parolni saqlash',
    })
    const hint = await getBiometricHint()
    if (hint) await SecureStore.setItemAsync(LAST_KEY, JSON.stringify({ ...hint, login }))
  } catch {
    await disableBiometric(userId)
  }
}

export async function disableBiometric(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(credKey(userId)).catch(() => {})
  const hint = await getBiometricHint()
  if (hint?.userId === userId) await SecureStore.deleteItemAsync(LAST_KEY).catch(() => {})
}

// ── Ilovani qulflash sozlamalari (har bir foydalanuvchi uchun alohida) ───────────
export type LockSettings = { enabled: boolean; timeoutSec: number }
export const LOCK_TIMEOUTS: { label: string; value: number }[] = [
  { label: 'Darhol', value: 0 },
  { label: '30 soniya', value: 30 },
  { label: '1 daqiqa', value: 60 },
  { label: '5 daqiqa', value: 300 },
]
export const DEFAULT_LOCK: LockSettings = { enabled: false, timeoutSec: 30 }

export async function getLockSettings(userId: string): Promise<LockSettings> {
  try {
    const raw = await SecureStore.getItemAsync(lockKey(userId))
    if (!raw) return DEFAULT_LOCK
    const parsed = JSON.parse(raw) as Partial<LockSettings>
    return { enabled: parsed.enabled === true, timeoutSec: Number(parsed.timeoutSec ?? DEFAULT_LOCK.timeoutSec) }
  } catch {
    return DEFAULT_LOCK
  }
}

export async function saveLockSettings(userId: string, settings: LockSettings): Promise<void> {
  await SecureStore.setItemAsync(lockKey(userId), JSON.stringify(settings))
}
