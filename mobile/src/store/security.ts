import { create } from 'zustand'
import {
  authenticate, biometricErrorText, DEFAULT_LOCK, disableBiometric, enableBiometric, getBiometricInfo, getLockSettings,
  isBiometricEnabled, saveLockSettings, type BiometricInfo, type LockSettings,
} from '@/lib/security'

type SecurityState = {
  info: BiometricInfo
  biometricEnabled: boolean
  lock: LockSettings
  locked: boolean
  userId: string
  // Ilova fonga o'tgan vaqt (ms) — qaytganda qulf kerakmi, shundan hisoblanadi.
  backgroundedAt: number | null
  // Kamera / galereya / tizim oynasi ochiq bo'lganda ilova "fonga o'tdi" deb hisoblanmasin.
  external: boolean
  setExternal: (value: boolean) => void
  load: (userId: string, options?: { coldStart?: boolean }) => Promise<void>
  reset: () => void
  setBackgrounded: () => void
  resume: () => void
  unlock: () => Promise<{ ok: boolean; message: string }>
  setLock: (patch: Partial<LockSettings>) => Promise<string>
  enableBiometricLogin: (hint: { userId: string; login: string; fullName: string }, password: string) => Promise<void>
  disableBiometricLogin: () => Promise<void>
}

const NO_INFO: BiometricInfo = { available: false, hasHardware: false, enrolled: false, deviceSecured: false, label: 'Biometrik' }

export const useSecurityStore = create<SecurityState>((set, get) => ({
  info: NO_INFO,
  biometricEnabled: false,
  lock: DEFAULT_LOCK,
  locked: false,
  userId: '',
  backgroundedAt: null,
  external: false,
  setExternal(value) { set({ external: value, ...(value ? {} : { backgroundedAt: null }) }) },

  async load(userId, { coldStart = false } = {}) {
    const [info, biometricEnabled, lock] = await Promise.all([getBiometricInfo(), isBiometricEnabled(userId), getLockSettings(userId)])
    // Qurilma qulfi (PIN/biometriya) bo'lmasa, qulflashning ma'nosi yo'q — foydalanuvchi qulfda qolib ketmasin.
    const lockable = lock.enabled && info.deviceSecured
    set({ info, biometricEnabled, lock, userId, locked: coldStart ? lockable : get().locked && lockable })
  },
  reset() { set({ info: NO_INFO, biometricEnabled: false, lock: DEFAULT_LOCK, locked: false, userId: '', backgroundedAt: null, external: false }) },

  setBackgrounded() {
    if (get().backgroundedAt === null && !get().external) set({ backgroundedAt: Date.now() })
  },
  resume() {
    const { backgroundedAt, lock, info, locked } = get()
    set({ backgroundedAt: null })
    if (locked || backgroundedAt === null || !lock.enabled || !info.deviceSecured) return
    if ((Date.now() - backgroundedAt) / 1000 >= lock.timeoutSec) set({ locked: true })
  },

  async unlock() {
    const result = await authenticate('Ilovani ochish uchun tasdiqlang')
    if (result.success) {
      set({ locked: false })
      return { ok: true, message: '' }
    }
    return { ok: false, message: biometricErrorText(result.error) }
  },

  // Qulfni yoqishdan oldin tasdiqlatamiz: aks holda noto'g'ri sozlama foydalanuvchini qulflab qo'yishi mumkin.
  async setLock(patch) {
    const { userId, lock, info } = get()
    const next = { ...lock, ...patch }
    if (patch.enabled === true) {
      if (!info.deviceSecured) return 'Avval qurilmada ekran qulfini (PIN yoki biometriya) sozlang.'
      const check = await authenticate('Ilovani qulflashni yoqish')
      if (!check.success) return biometricErrorText(check.error) || 'Tasdiqlash bekor qilindi.'
    }
    await saveLockSettings(userId, next)
    set({ lock: next })
    return ''
  },

  async enableBiometricLogin(hint, password) {
    await enableBiometric(hint, password, get().info.label)
    set({ biometricEnabled: true })
  },
  async disableBiometricLogin() {
    await disableBiometric(get().userId)
    set({ biometricEnabled: false })
  },
}))
