import { Tabs } from 'expo-router/js-tabs'
import { Platform, type ColorValue } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '@/theme'
import { useApp } from '@/store'
import { Icon, type IconName } from '@/components/ui'

const tabIcon = (name: IconName, focusedName: IconName) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => <Icon name={focused ? focusedName : name} size={22} color={String(color)} />

export default function TabsLayout() {
  const app = useApp()
  const insets = useSafeAreaInsets()
  // Haydovchi (driver.self, xodimlarni ko'rish huquqisiz) uchun "Hisobim" tabi; boshqalarga "Yana" ichida.
  const isDriver = app.can('driver.self') && !app.can('staff.view')
  const show = (visible: boolean) => (visible ? {} : { href: null })
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: colors.placeholder,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: '#fff', borderTopColor: colors.line, borderTopWidth: 1,
          height: 56 + Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0), paddingBottom: Math.max(insets.bottom, 8), paddingTop: 6,
        },
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Bosh sahifa', tabBarIcon: tabIcon('grid-outline', 'grid'), ...show(app.can('dashboard.view')) }} />
      <Tabs.Screen name="cabinet" options={{ title: 'Hisobim', tabBarIcon: tabIcon('person-outline', 'person'), ...show(isDriver) }} />
      <Tabs.Screen name="trips" options={{ title: 'Reyslar', tabBarIcon: tabIcon('list-outline', 'list'), ...show(app.can('trips.view')) }} />
      <Tabs.Screen name="scale" options={{ title: 'Yangi reys', tabBarIcon: tabIcon('add-circle-outline', 'add-circle'), ...show(app.can('trips.create')) }} />
      <Tabs.Screen
        name="monitoring"
        options={{
          title: 'Monitoring', tabBarIcon: tabIcon('shield-checkmark-outline', 'shield-checkmark'),
          tabBarBadge: app.pendingMonitoringCount > 0 ? app.pendingMonitoringCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10 },
          ...show(app.canViewMonitoring),
        }}
      />
      <Tabs.Screen name="more" options={{ title: 'Yana', tabBarIcon: tabIcon('ellipsis-horizontal-circle-outline', 'ellipsis-horizontal-circle') }} />
    </Tabs>
  )
}
