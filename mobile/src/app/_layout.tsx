import { useEffect, useRef } from 'react'
import { AppState, StyleSheet, View } from 'react-native'
import { Stack, SplashScreen } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { colors } from '@/theme'
import { useApp, useQuarryStore } from '@/store'
import { useSecurityStore } from '@/store/security'
import { supabaseConfigured } from '@/lib/supabase'
import { useAppUpdates } from '@/lib/updates'
import { LockScreen } from '@/components/LockScreen'
import { Text, ToastHost } from '@/components/ui'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const [fontsLoaded] = useFonts(Ionicons.font)
  const initialize = useQuarryStore((s) => s.initialize)
  const app = useApp()
  const locked = useSecurityStore((s) => s.locked)
  const coldStartHandled = useRef(false)
  // OTA yangilanish: ilova ochilganda va fondan qaytganda jimgina tekshiriladi.
  useAppUpdates()

  useEffect(() => { void initialize() }, [initialize])

  const userId = app.session?.user?.id
  // Ilova yangi ochilganda (sessiya tiklangan) qulf holati yuklanadi; yangi kirishda qulflanmaydi.
  useEffect(() => {
    if (!app.ready) return
    if (userId) void useSecurityStore.getState().load(userId, { coldStart: !coldStartHandled.current })
    else useSecurityStore.getState().reset()
    coldStartHandled.current = true
  }, [app.ready, userId])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') useSecurityStore.getState().setBackgrounded()
      else if (state === 'active') useSecurityStore.getState().resume()
    })
    return () => subscription.remove()
  }, [])

  const hidden = useRef(false)
  useEffect(() => {
    if ((app.ready && fontsLoaded) && !hidden.current) {
      hidden.current = true
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [app.ready, fontsLoaded])

  if (!app.ready || !fontsLoaded) return <View style={styles.boot} />
  if (!supabaseConfigured) return <ConfigMissing />

  // Sessiya bor va profil keldi (yoki hozir yuklanmoqda) → asosiy ilova; aks holda kirish ekrani.
  const signedIn = Boolean(app.session) && (Boolean(app.currentUser) || app.bootstrapping)

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
      <ToastHost />
      {signedIn && locked ? <LockScreen /> : null}
    </SafeAreaProvider>
  )
}

function ConfigMissing() {
  return (
    <View style={[styles.boot, { justifyContent: 'center', padding: 28, backgroundColor: colors.canvas }]}>
      <Text variant="title" center>Sozlanmagan</Text>
      <Text tone="muted" center style={{ marginTop: 10 }}>
        Supabase ulanishi topilmadi. mobile/.env faylida EXPO_PUBLIC_SUPABASE_URL va EXPO_PUBLIC_SUPABASE_ANON_KEY qiymatlarini kiriting (web ilovadagi VITE_SUPABASE_* bilan bir xil), so‘ng ilovani qayta ishga tushiring.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({ boot: { flex: 1, backgroundColor: colors.navy } })
