import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, radius } from '@/theme'
import { dateLong, greeting, money, number } from '@/lib/format'
import { useApp } from '@/store'
import { Guard } from '@/components/Guard'
import { TripRow } from '@/components/trips/TripRow'
import { TripSheet } from '@/components/trips/TripSheet'
import { Avatar, Banner, Card, EmptyState, Icon, IconBadge, MetricCard, Screen, SectionTitle, Tag, Text } from '@/components/ui'

export default function DashboardScreen() {
  return <Guard permission="dashboard.view"><Dashboard /></Guard>
}

function Dashboard() {
  const app = useApp()
  const router = useRouter()
  const [tripId, setTripId] = useState<string | null>(null)
  const week = app.weeklySummary
  const chartMax = Math.max(1, ...week.map((day) => Math.max(day.sales, day.expenses)))
  const recentTrips = useMemo(() => [...app.trips].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5), [app.trips])
  const activeVehicles = app.vehicles.filter((vehicle) => vehicle.status === 'active').length
  const clientRows = useMemo(() => app.clients.map((client) => ({ ...client, balance: app.clientBalance(client.id) }))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)).slice(0, 4), [app.clients, app.remoteClientBalances]) // eslint-disable-line react-hooks/exhaustive-deps
  const barHeight = (amount: number) => Math.max(4, Math.round((amount / chartMax) * 110))

  return (
    <Screen title={`${greeting()}!`} subtitle={`${dateLong()} · ${app.currentUser?.fullName?.split(' ')[0] ?? ''}`} tabbed>
      {app.canViewMonitoring && app.pendingMonitoringCount ? (
        <Banner icon="shield-checkmark" title={`${app.pendingMonitoringCount} ta yozuv monitoringda kutilmoqda`}
          text={`${app.pendingTrips.length} reys · ${app.pendingExpenses.length} xarajat`} onPress={() => router.push('/monitoring')} />
      ) : null}
      {app.openReports.length ? (
        <Banner icon="alert-circle" title={`${app.openReports.length} ta texnika bo‘yicha ogohlantirish`}
          text={app.openReports.slice(0, 2).map((report) => app.vehiclePlate(report.vehicleId)).join(', ')}
          onPress={app.can('fleet.view') ? () => router.push('/fleet') : undefined} />
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <MetricCard label="Bugun tashilgan" value={`${number(app.todayTonnage, 1)} t`} detail={`${app.todayTrips.length} ta reys`} icon="speedometer-outline" tone="green" />
        <MetricCard label="Bugungi tushum" value={money(app.todayCashIn, { short: true })} icon="cash-outline" tone="brand" />
        <MetricCard label="Kunlik sof foyda" value={money(app.todayProfit, { short: true })} icon="trending-up-outline" tone="amber" />
        <MetricCard label="Faol samosvallar" value={`${activeVehicles} / ${app.vehicles.length}`} icon="bus-outline" tone="violet" />
      </View>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="subheading">Haftalik moliyaviy oqim</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Legend color={colors.leaf} label="Sotuv" /><Legend color="#F0C58F" label="Xarajat" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', height: 135, alignItems: 'flex-end', marginTop: 16, gap: 6, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          {week.map((day) => (
            <View key={day.key} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 }}>
              <View style={{ width: 10, height: barHeight(day.sales), borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: colors.leaf }} />
              <View style={{ width: 10, height: barHeight(day.expenses), borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: '#F0C58F' }} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
          {week.map((day) => <Text key={day.key} variant="caption" tone="muted" center style={{ flex: 1, fontSize: 10 }}>{day.label}</Text>)}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F7FAFD', borderRadius: radius.md, padding: 12, marginTop: 14 }}>
          <Text variant="caption" tone="muted">Bugungi savdo qiymati</Text>
          <Text variant="subheading">{money(app.todaySales, { short: true })}</Text>
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="subheading">Pul mablag‘lari</Text>
          <IconBadge name="wallet-outline" tone="grey" size={34} />
        </View>
        <View style={{ gap: 10, marginTop: 12 }}>
          <Balance icon="cash-outline" tone="amber" label="Naqd kassa" value={app.cashBalance} />
          <Balance icon="card-outline" tone="brand" label="Bank hisobi" value={app.bankBalance} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F7FAFD', borderRadius: radius.md, padding: 12 }}>
            <Text variant="caption" tone="muted">Ochiq nosozliklar</Text>
            <Text variant="subheading" tone={app.openReports.length ? 'amber' : 'ink'}>{app.openReports.length}</Text>
          </View>
        </View>
        {app.can('finance.view') ? <Text variant="label" tone="brand" style={{ marginTop: 12 }} onPress={() => router.push('/finance')}>Moliyaviy hisobotga o‘tish →</Text> : null}
      </Card>

      <SectionTitle title="So‘nggi reyslar" action={app.can('trips.view') ? 'Barchasi' : undefined} onAction={() => router.push('/trips')} />
      {recentTrips.length ? recentTrips.map((trip) => <TripRow key={trip.id} trip={trip} app={app} onPress={() => setTripId(trip.id)} />)
        : <Card><EmptyState icon="list-outline" title="Hozircha reyslar yo‘q." /></Card>}

      <SectionTitle title="Texnikalar holati" action={app.can('fleet.view') ? 'Barchasi' : undefined} onAction={() => router.push('/fleet')} />
      <Card padded={false}>
        {app.vehicles.slice(0, 4).map((vehicle, index) => (
          <View key={vehicle.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: index ? 1 : 0, borderTopColor: colors.line }}>
            <IconBadge name="bus-outline" tone={vehicle.status === 'active' ? 'brand' : 'amber'} size={36} />
            <View style={{ flex: 1 }}>
              <Text variant="subheading" numberOfLines={1}>{vehicle.plate}</Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>{app.driverName(vehicle.driverId)}</Text>
            </View>
            <Tag dot label={vehicle.status === 'active' ? 'Faol' : vehicle.status === 'repair' ? 'Remontda' : 'Servisda'} tone={vehicle.status === 'active' ? 'cash' : vehicle.status === 'repair' ? 'repair' : 'service'} />
          </View>
        ))}
        {!app.vehicles.length ? <EmptyState icon="bus-outline" title="Texnikalar yo‘q" /> : null}
      </Card>

      {clientRows.length ? (
        <>
          <SectionTitle title="Mijozlar balansi" action={app.can('clients.view') ? 'Barchasi' : undefined} onAction={() => router.push('/clients')} />
          <Card padded={false}>
            {clientRows.map((client, index) => (
              <View key={client.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: index ? 1 : 0, borderTopColor: colors.line }}>
                <Avatar name={client.name} size={34} tone={client.balance < 0 ? 'brand' : 'grey'} />
                <View style={{ flex: 1 }}>
                  <Text variant="label" numberOfLines={1}>{client.name}</Text>
                  <Text variant="caption" tone="muted">{client.balance < 0 ? 'Avans mavjud' : client.balance > 0 ? 'Qarzdor' : 'Hisob teng'}</Text>
                </View>
                <Text variant="label" tone={client.balance > 0 ? 'danger' : client.balance < 0 ? 'success' : 'muted'}>{money(Math.abs(client.balance), { short: true })}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <TripSheet tripId={tripId} onClose={() => setTripId(null)} />
    </Screen>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text variant="caption" tone="muted">{label}</Text>
    </View>
  )
}

function Balance({ icon, tone, label, value }: { icon: React.ComponentProps<typeof Icon>['name']; tone: 'amber' | 'brand'; label: string; value: number | null }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconBadge name={icon} tone={tone} size={32} />
        <Text variant="label">{label}</Text>
      </View>
      <Text variant="subheading">{value === null ? '—' : money(value, { short: true })}</Text>
    </View>
  )
}
