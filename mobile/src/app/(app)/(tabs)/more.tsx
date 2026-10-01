import { useRouter } from 'expo-router'
import { View } from 'react-native'
import { useApp } from '@/store'
import { useSecurityStore } from '@/store/security'
import { confirmAction } from '@/hooks/useAction'
import { Avatar, Card, Divider, ListItem, Screen, Text } from '@/components/ui'
import { useAvatar } from '@/hooks/useAvatar'

export default function MoreScreen() {
  const app = useApp()
  const router = useRouter()
  const user = app.currentUser
  const avatarUrl = useAvatar(user?.id)
  const settingsAllowed = ['roles.manage', 'materials.create', 'materials.manage', 'finance.categories.create', 'finance.manage'].some((key) => app.can(key))

  const items = [
    { icon: 'people-outline', title: 'Mijozlar', subtitle: 'Ro‘yxat, balans va to‘lovlar', to: '/clients', show: app.can('clients.view') },
    { icon: 'bus-outline', title: 'Texnikalar', subtitle: 'Samosvallar holati va nosozliklar', to: '/fleet', show: app.can('fleet.view') },
    { icon: 'wallet-outline', title: 'Moliya', subtitle: 'Kassa, bank, kirim-chiqim jurnali', to: '/finance', show: app.can('finance.view') },
    { icon: 'person-circle-outline', title: 'Haydovchilar', subtitle: 'Reys stavkasi, avans va hisob-kitob', to: '/drivers', show: app.can('staff.view') },
    { icon: 'id-card-outline', title: 'Xodimlar', subtitle: 'Login, parol va lavozimlar', to: '/staff', show: app.can('staff.view') },
  ] as const

  const logout = async () => {
    if (await confirmAction('Chiqish', 'Hisobdan chiqmoqchimisiz?', 'Chiqish', true)) {
      useSecurityStore.getState().reset()
      await app.signOut()
    }
  }

  return (
    <Screen title="Yana" tabbed>
      <Card onPress={() => router.push('/settings/profile')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={user?.fullName ?? ''} uri={avatarUrl} size={52} />
          <View style={{ flex: 1 }}>
            <Text variant="heading" numberOfLines={1}>{user?.fullName}</Text>
            <Text variant="caption" tone="muted">{app.roleName(user)}{user?.login ? ` · @${user.login}` : ''}</Text>
          </View>
        </View>
      </Card>
      {items.some((item) => item.show) ? (
        <Card padded={false}>
          {items.filter((item) => item.show).map((item, index, list) => (
            <View key={item.to}>
              <ListItem icon={item.icon} title={item.title} subtitle={item.subtitle} onPress={() => router.push(item.to)} />
              {index < list.length - 1 ? <Divider /> : null}
            </View>
          ))}
        </Card>
      ) : null}
      <Card padded={false}>
        <ListItem icon="settings-outline" title="Sozlamalar" subtitle={settingsAllowed ? 'Profil, xavfsizlik, lavozim, mahsulot, moliya turlari' : 'Profil va xavfsizlik (Face ID)'} onPress={() => router.push('/settings')} />
        <Divider />
        <ListItem icon="book-outline" title="Foydalanish yo‘riqnomasi" subtitle="Bo‘limlar va ishlash tartibi" onPress={() => router.push('/settings/guide')} />
        <Divider />
        <ListItem icon="log-out-outline" title="Chiqish" danger onPress={logout} />
      </Card>
      <Text variant="caption" tone="muted" center>AliBuilding · mobil ilova</Text>
    </Screen>
  )
}
