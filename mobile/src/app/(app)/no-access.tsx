import { View } from 'react-native'
import { Redirect } from 'expo-router'
import { useApp } from '@/store'
import { Button, EmptyState } from '@/components/ui'

export default function NoAccessScreen() {
  const app = useApp()
  // Ruxsatlar kech kelgan bo'lsa (kesh/yangilash) — avtomatik tegishli bo'limga o'tadi.
  if (app.homeRoute() !== '/no-access') return <Redirect href={app.homeRoute() as any} />
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 14 }}>
      <EmptyState icon="lock-closed-outline" title="Ruxsat yo‘q" text="Sizning lavozimingizga hech qanday bo‘lim ochilmagan. Administrator bilan bog‘laning." />
      <Button title="Chiqish" variant="secondary" onPress={() => void app.signOut()} />
    </View>
  )
}
