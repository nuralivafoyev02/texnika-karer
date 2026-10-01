import { StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius } from '@/theme'
import { useApp } from '@/store'
import { Button, Icon, Skeleton, Text } from '@/components/ui'
import { BrandMark } from '@/components/BrandMark'

export default function AppLayout() {
  const app = useApp()
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
      {!app.online ? (
        <View pointerEvents="none" style={[styles.offline, { bottom: insets.bottom + 76 }]}>
          <Icon name="cloud-offline-outline" size={14} color="#fff" />
          <Text variant="caption" style={{ color: '#fff', fontWeight: '700' }}>Internet yo‘q — saqlangan ma’lumot ko‘rsatilmoqda</Text>
        </View>
      ) : null}
      {app.bootstrapping || (app.dataError && !app.currentUser) ? <BootOverlay /> : null}
    </View>
  )
}

function BootOverlay() {
  const insets = useSafeAreaInsets()
  const app = useApp()
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.canvas, paddingTop: insets.top + 24, paddingHorizontal: 16, zIndex: 90 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BrandMark size={40} light={false} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton height={16} width="55%" />
          <Skeleton height={11} width="35%" />
        </View>
      </View>
      {app.dataError ? (
        <View style={{ marginTop: 40, gap: 12 }}>
          <Text variant="heading" center>Ma’lumotni yuklab bo‘lmadi</Text>
          <Text tone="muted" center>{app.dataError}</Text>
          <Button title="Qayta urinish" icon="refresh" onPress={() => void app.loadRemoteData().catch(() => {})} />
          <Button title="Boshqa hisob bilan kirish" variant="secondary" onPress={() => void app.signOut()} />
        </View>
      ) : (
        <View style={{ marginTop: 28, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}><Skeleton height={110} width="48%" /><Skeleton height={110} width="48%" /></View>
          <View style={{ flexDirection: 'row', gap: 12 }}><Skeleton height={110} width="48%" /><Skeleton height={110} width="48%" /></View>
          <Skeleton height={200} />
          <Text variant="caption" tone="muted" center>AliBuilding tizimi yuklanmoqda…</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  offline: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(23,35,29,0.9)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, zIndex: 80 },
})
