import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AppState } from 'react-native'
import * as Updates from 'expo-updates'

// OTA (over-the-air) yangilanish: JS kodi va rasmlar o'zgarganda foydalanuvchi .apk ni qayta o'rnatmaydi —
// ilova yangi versiyani o'zi yuklab oladi (EAS Update). Native kod (yangi kutubxona, ruxsat) o'zgarsa,
// yangi build kerak: runtimeVersion shuni nazorat qiladi.

export type UpdateState = 'idle' | 'checking' | 'downloading' | 'ready' | 'none' | 'error' | 'disabled'

export function useAppUpdates({ checkOnForeground = true } = {}) {
  const [state, setState] = useState<UpdateState>(Updates.isEnabled ? 'idle' : 'disabled')
  const [message, setMessage] = useState('')
  const busy = useRef(false)
  const lastCheck = useRef(0)

  const check = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!Updates.isEnabled) { setState('disabled'); return 'disabled' as const }
    if (busy.current) return 'idle' as const
    busy.current = true
    lastCheck.current = Date.now()
    try {
      setState('checking')
      const result = await Updates.checkForUpdateAsync()
      if (!result.isAvailable) { setState('none'); return 'none' as const }
      setState('downloading')
      await Updates.fetchUpdateAsync()
      setState('ready')
      Alert.alert('Yangi versiya tayyor', 'Ilovaning yangilangan versiyasi yuklab olindi. Hozir qayta ishga tushiramizmi?', [
        { text: 'Keyinroq', style: 'cancel' },
        { text: 'Qayta ishga tushirish', onPress: () => { void Updates.reloadAsync() } },
      ])
      return 'ready' as const
    } catch (error: any) {
      setState('error')
      setMessage(error?.message ?? 'Yangilanishni tekshirib bo‘lmadi.')
      return silent ? ('none' as const) : ('error' as const)
    } finally {
      busy.current = false
    }
  }, [])

  // Ilova fonga o'tib qaytganda (kamida 30 daqiqada bir marta) jimgina tekshiramiz.
  useEffect(() => {
    if (!checkOnForeground || !Updates.isEnabled || __DEV__) return
    void check({ silent: true })
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && Date.now() - lastCheck.current > 30 * 60 * 1000) void check({ silent: true })
    })
    return () => subscription.remove()
  }, [check, checkOnForeground])

  return { state, message, check, enabled: Updates.isEnabled }
}

export const updateInfo = () => ({
  enabled: Updates.isEnabled,
  channel: Updates.channel,
  runtimeVersion: Updates.runtimeVersion,
  updateId: Updates.updateId,
  createdAt: Updates.createdAt,
  embedded: Updates.isEmbeddedLaunch,
})
