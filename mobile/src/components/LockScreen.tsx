import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '@/theme'
import { useQuarryStore } from '@/store'
import { useSecurityStore } from '@/store/security'
import { BrandMark } from '@/components/BrandMark'
import { Button, Text } from '@/components/ui'
import { confirmAction } from '@/hooks/useAction'

// Ilova qulflanganda barcha ekran ustida chiqadi. Ochilishi bilan biometriya avtomatik so'raladi.
export function LockScreen() {
  const insets = useSafeAreaInsets()
  const info = useSecurityStore((s) => s.info)
  const unlock = useSecurityStore((s) => s.unlock)
  const signOut = useQuarryStore((s) => s.signOut)
  const user = useQuarryStore((s) => s.users.find((item) => item.id === s.session?.user?.id))
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const attempt = useCallback(async () => {
    if (busy) return
    setBusy(true)
    const result = await unlock()
    setBusy(false)
    setMessage(result.ok ? '' : result.message)
  }, [busy, unlock])

  useEffect(() => { void attempt() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const logout = async () => {
    if (await confirmAction('Chiqish', 'Hisobdan chiqasizmi? Keyingi kirishda login va parol (yoki biometriya) kerak bo‘ladi.', 'Chiqish', true)) {
      useSecurityStore.getState().reset()
      await signOut()
    }
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.root, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
      <View style={{ alignItems: 'center' }}><BrandMark size={64} /></View>
      <Text variant="title" tone="white" center style={{ marginTop: 20 }}>Ilova qulflangan</Text>
      <Text tone="white" center style={{ marginTop: 8, opacity: 0.75 }}>
        {user ? `${user.fullName}, davom etish uchun` : 'Davom etish uchun'} {info.available ? `${info.label} yoki qurilma kodi` : 'qurilma kodi'} bilan tasdiqlang.
      </Text>
      <View style={{ flex: 1 }} />
      {message ? <Text variant="label" center style={{ color: '#FFB4B4', marginBottom: 12 }}>{message}</Text> : null}
      <Button title={info.available ? `${info.label} bilan ochish` : 'Ochish'} icon={info.label === 'Face ID' ? 'scan' : 'finger-print'} onPress={attempt} loading={busy} />
      <Button title="Boshqa hisob bilan kirish" variant="quiet" onPress={logout} style={{ marginTop: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'transparent' }} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.navy, paddingHorizontal: 24, alignItems: 'stretch', zIndex: 200 },
})
