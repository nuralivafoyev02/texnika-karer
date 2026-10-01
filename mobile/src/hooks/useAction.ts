import { useCallback, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useQuarryStore } from '@/store'

// Tugma bosilganda: band holatini boshqaradi, xatoni toast sifatida ko'rsatadi
// (web'dagi `try { await store.x() } catch { store.notify(error, 'error') } finally { saving = false }` naqshi).
export function useAction() {
  const notify = useQuarryStore((s) => s.notify)
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const run = useCallback(async <T,>(task: () => Promise<T>, fallback = 'Amalni bajarib bo‘lmadi.'): Promise<T | undefined> => {
    if (running.current) return undefined
    running.current = true
    setBusy(true)
    try {
      return await task()
    } catch (error: any) {
      notify(error?.message || fallback, 'error')
      return undefined
    } finally {
      running.current = false
      setBusy(false)
    }
  }, [notify])
  return { busy, run }
}

export function confirmAction(title: string, message: string, confirmLabel = 'Tasdiqlash', destructive = false): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Bekor qilish', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) })
  })
}
