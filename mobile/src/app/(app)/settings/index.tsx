import { useRouter } from 'expo-router'
import Constants from 'expo-constants'
import { View } from 'react-native'
import { useApp } from '@/store'
import { useSecurityStore } from '@/store/security'
import { updateInfo, useAppUpdates } from '@/lib/updates'
import { useAvatar } from '@/hooks/useAvatar'
import { Avatar, Card, Divider, ListItem, Screen, Text } from '@/components/ui'

export default function SettingsScreen() {
  const app = useApp()
  const router = useRouter()
  const avatar = useAvatar(app.currentUser?.id)
  const biometricEnabled = useSecurityStore((s) => s.biometricEnabled)
  const lock = useSecurityStore((s) => s.lock)
  const info = useSecurityStore((s) => s.info)
  const updates = useAppUpdates({ checkOnForeground: false })
  const version = Constants.expoConfig?.version ?? '1.0.0'
  const meta = updateInfo()

  const securitySummary = [biometricEnabled ? `${info.label} bilan kirish yoqilgan` : null, lock.enabled ? 'avto-qulf yoqilgan' : null].filter(Boolean).join(' · ') || 'Face ID / barmoq izi bilan kirish va ilovani qulflash'
  const updateText = ({
    idle: 'Yangi versiyani tekshirish', checking: 'Tekshirilmoqda…', downloading: 'Yuklab olinmoqda…', ready: 'Yangi versiya tayyor',
    none: 'Eng so‘nggi versiya o‘rnatilgan', error: updates.message || 'Tekshirib bo‘lmadi', disabled: 'OTA yangilanish bu build‘da o‘chirilgan',
  } as const)[updates.state]
  const admin = [
    { icon: 'shield-checkmark-outline', title: 'Lavozimlar va ruxsatlar', subtitle: 'Dinamik RBAC', to: '/settings/roles', show: app.can('roles.manage') },
    { icon: 'cube-outline', title: 'Mahsulotlar va narxlar', subtitle: 'Tosh turi va tonna narxi', to: '/settings/materials', show: app.canCreateMaterial },
    { icon: 'pricetags-outline', title: 'Moliya turlari', subtitle: 'Kirim va chiqim turlari', to: '/settings/categories', show: app.canCreateCategory },
  ] as const

  return (
    <Screen title="Sozlamalar" back>
      <Card onPress={() => router.push('/settings/profile')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={app.currentUser?.fullName ?? ''} uri={avatar} size={52} />
          <View style={{ flex: 1 }}>
            <Text variant="heading" numberOfLines={1}>{app.currentUser?.fullName}</Text>
            <Text variant="caption" tone="muted">{app.roleName(app.currentUser)} · @{app.currentUser?.login}</Text>
          </View>
        </View>
      </Card>

      <Text variant="eyebrow" tone="muted">Hisob</Text>
      <Card padded={false}>
        <ListItem icon="person-outline" title="Profil" subtitle="Ism, telefon, rasm, login va parol" onPress={() => router.push('/settings/profile')} />
        <Divider />
        <ListItem icon="finger-print" title="Xavfsizlik" subtitle={securitySummary} onPress={() => router.push('/settings/security')} />
      </Card>

      {admin.some((item) => item.show) ? (
        <>
          <Text variant="eyebrow" tone="muted">Tizim</Text>
          <Card padded={false}>
            {admin.filter((item) => item.show).map((item, index, list) => (
              <View key={item.to}>
                <ListItem icon={item.icon} title={item.title} subtitle={item.subtitle} onPress={() => router.push(item.to)} />
                {index < list.length - 1 ? <Divider /> : null}
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Text variant="eyebrow" tone="muted">Yordam va ilova</Text>
      <Card padded={false}>
        <ListItem icon="book-outline" title="Foydalanish yo‘riqnomasi" subtitle="Bo‘limlar va ishlash tartibi" onPress={() => router.push('/settings/guide')} />
        <Divider />
        <ListItem icon="cloud-download-outline" title="Yangilanishlar" subtitle={updateText}
          onPress={updates.enabled && updates.state !== 'checking' && updates.state !== 'downloading' ? () => { void updates.check() } : undefined} />
      </Card>
      <Text variant="caption" tone="muted" center>
        AliBuilding mobil · v{version}{meta.runtimeVersion ? ` · runtime ${meta.runtimeVersion}` : ''}{meta.channel ? ` · ${meta.channel}` : ''}{meta.updateId ? `\nOTA: ${meta.updateId.slice(0, 8)}` : ''}
      </Text>
    </Screen>
  )
}
