import { useCallback, useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, shadow } from '@/theme'
import { useQuarryStore } from '@/store'
import { useSecurityStore } from '@/store/security'
import { getBiometricHint, disableBiometric, readBiometricCredentials, getBiometricInfo, type BiometricUserHint } from '@/lib/security'
import { BrandMark } from '@/components/BrandMark'
import { Button, Icon, Text, TextField } from '@/components/ui'

const PROMPT_DISMISSED_KEY = 'qz-bio-prompt-dismissed'

export default function LoginScreen() {
  const insets = useSafeAreaInsets()
  const signIn = useQuarryStore((s) => s.signIn)
  const signOut = useQuarryStore((s) => s.signOut)
  const session = useQuarryStore((s) => s.session)
  const storeError = useQuarryStore((s) => s.authError || s.dataError)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hint, setHint] = useState<BiometricUserHint | null>(null)
  const [label, setLabel] = useState('Biometrik')
  const [bioReady, setBioReady] = useState(false)

  // Oldin yoqilgan biometrik kirish bo'lsa — tugma chiqadi va bir marta o'zi so'raydi.
  useEffect(() => {
    let alive = true
    void (async () => {
      const [saved, info] = await Promise.all([getBiometricHint(), getBiometricInfo()])
      if (!alive) return
      setLabel(info.label)
      if (saved && info.available) {
        setHint(saved)
        setLogin((current) => current || saved.login)
        setBioReady(true)
      }
    })()
    return () => { alive = false }
  }, [])

  const offerBiometric = useCallback(async (typedLogin: string, typedPassword: string) => {
    const info = await getBiometricInfo()
    if (!info.available) return
    if (await AsyncStorage.getItem(PROMPT_DISMISSED_KEY).catch(() => null)) return
    const state = useQuarryStore.getState()
    const userId = state.session?.user?.id
    if (!userId) return
    const fullName = state.users.find((user) => user.id === userId)?.fullName ?? typedLogin
    Alert.alert(
      `${info.label} bilan kirish`,
      `Keyingi safar parol yozmasdan, ${info.label} orqali tez kirishni yoqasizmi? Buni keyinroq Sozlamalar → Xavfsizlik bo‘limidan ham o‘zgartirish mumkin.`,
      [
        { text: 'Hozir emas', style: 'cancel', onPress: () => { void AsyncStorage.setItem(PROMPT_DISMISSED_KEY, '1').catch(() => {}) } },
        {
          text: 'Yoqish',
          onPress: () => {
            void (async () => {
              try {
                await useSecurityStore.getState().load(userId)
                await useSecurityStore.getState().enableBiometricLogin({ userId, login: typedLogin, fullName }, typedPassword)
                useQuarryStore.getState().notify(`${info.label} bilan kirish yoqildi.`)
              } catch (e: any) {
                useQuarryStore.getState().notify(e?.message || 'Yoqib bo‘lmadi.', 'error')
              }
            })()
          },
        },
      ],
    )
  }, [])

  const submit = async () => {
    setError('')
    setBusy(true)
    const typedLogin = login.trim().toLowerCase()
    try {
      await signIn(typedLogin, password)
      void offerBiometric(typedLogin, password)
    } catch (exception: any) {
      setError(exception?.message || 'Kirish imkoni bo‘lmadi.')
    } finally {
      setBusy(false)
    }
  }

  const biometricSignIn = useCallback(async () => {
    if (!hint || busy) return
    setError('')
    setBusy(true)
    try {
      const credentials = await readBiometricCredentials(hint.userId, label)
      if (!credentials) {
        setError(`${label} tasdiqlanmadi. Parol bilan kiring yoki qayta urinib ko‘ring.`)
        return
      }
      try {
        await signIn(credentials.login, credentials.password)
      } catch (exception: any) {
        // Parol boshqa joyda o'zgartirilgan bo'lishi mumkin: eskirgan ma'lumotni o'chirib, parol so'raymiz.
        if (/noto‘g‘ri/.test(exception?.message ?? '')) {
          await disableBiometric(hint.userId)
          setBioReady(false)
          setHint(null)
          setError('Parol o‘zgargan. Iltimos, parol bilan kiring va biometrik kirishni qayta yoqing.')
        } else {
          setError(exception?.message || 'Kirish imkoni bo‘lmadi.')
        }
      }
    } finally {
      setBusy(false)
    }
  }, [hint, busy, label, signIn])

  useEffect(() => {
    if (bioReady && hint) void biometricSignIn()
  }, [bioReady]) // eslint-disable-line react-hooks/exhaustive-deps

  const shownError = error || storeError

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.navy }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={[styles.hero, { paddingTop: insets.top + 36 }]}>
          <BrandMark size={52} />
          <Text variant="title" tone="white" style={{ marginTop: 18, fontSize: 32 }}>AliBuilding<Text variant="title" style={{ color: '#7DB3FF', fontSize: 32 }}>.</Text></Text>
          <Text tone="white" style={{ marginTop: 8, opacity: 0.75 }}>Reyslar, texnika, mijozlar balansi va kunlik moliya — jamoangiz uchun yagona tizimda.</Text>
        </View>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <Text variant="eyebrow" tone="brand">Xush kelibsiz</Text>
          <Text variant="title" style={{ marginTop: 6, marginBottom: 20 }}>Tizimga kirish</Text>
          <TextField label="Login" value={login} onChangeText={setLogin} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" placeholder="login" returnKeyType="next" />
          <TextField label="Parol" value={password} onChangeText={setPassword} secure autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" placeholder="••••••••" returnKeyType="go" onSubmitEditing={submit} />
          {shownError ? <View style={styles.error}><Text variant="label" tone="danger">{shownError}</Text></View> : null}
          <Button title={busy ? 'Tekshirilmoqda…' : 'Kirish'} icon="arrow-forward" onPress={submit} loading={busy} disabled={!login.trim() || !password} />
          {bioReady && hint ? (
            <Button title={`${label} bilan kirish`} variant="quiet" icon={label === 'Face ID' ? 'scan' : 'finger-print'} onPress={biometricSignIn} disabled={busy} style={{ marginTop: 10 }} />
          ) : null}
          {session && storeError ? <Button title="Boshqa hisob bilan kirish" variant="secondary" onPress={() => void signOut()} style={{ marginTop: 10 }} /> : null}
          <View style={styles.note}>
            <Icon name="information-circle-outline" size={16} color={colors.muted} />
            <Text variant="caption" tone="muted" style={{ flex: 1 }}>Login va parolni administrator beradi.</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 24, paddingBottom: 36 },
  sheet: { flex: 1, backgroundColor: colors.canvas, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 28 },
  error: { backgroundColor: colors.dangerBg, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, padding: 12, borderRadius: radius.lg, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, ...shadow.soft },
})
