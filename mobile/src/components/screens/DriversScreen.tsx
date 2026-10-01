import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { colors, radius } from '@/theme'
import { dateTime, formatAmountInput, isToday, money, monthYear, parseAmountInput } from '@/lib/format'
import { isSameMonth } from '@/lib/format'
import { useApp } from '@/store'
import { useAction } from '@/hooks/useAction'
import { useAvatar } from '@/hooks/useAvatar'
import { ExpenseSheet } from '@/components/forms/ExpenseSheet'
import { MaintenanceSheet } from '@/components/forms/MaintenanceSheet'
import { StaffSheet } from '@/components/forms/StaffSheet'
import { TripRow } from '@/components/trips/TripRow'
import { TripSheet } from '@/components/trips/TripSheet'
import { AmountField, Avatar, Button, Card, EmptyState, MetricCard, Screen, SectionTitle, Sheet, Tag, Text } from '@/components/ui'

// Haydovchi kabineti (driver.self) va xodimlar uchun "Haydovchilar hisobi" — web'dagi DriversView.
export function DriversScreen({ tabbed }: { tabbed?: boolean }) {
  const app = useApp()
  const isDriver = app.can('driver.self') && !app.can('staff.view')
  return isDriver ? <DriverCabinet tabbed={tabbed} /> : <DriversAdmin tabbed={tabbed} />
}

function DriverCabinet({ tabbed }: { tabbed?: boolean }) {
  const app = useApp()
  const driver = app.currentUser
  const avatar = useAvatar(driver?.id)
  const [tripId, setTripId] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const trips = useMemo(() => app.trips.filter((trip) => trip.driverId === driver?.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [app.trips, driver?.id])
  const monthTrips = trips.filter((trip) => isSameMonth(trip.createdAt))
  const todayCount = trips.filter((trip) => isToday(trip.createdAt)).length
  const pay = driver ? app.balanceForDriver(driver.id) : { trips: 0, pending: 0, earned: 0, paid: 0, remaining: 0 }
  const vehicles = app.vehicles.filter((vehicle) => vehicle.driverId === driver?.id)
  const payroll = app.transactions.filter((tx) => tx.driverId === driver?.id && tx.category === 'payroll').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)

  return (
    <Screen title="Mening hisobim" subtitle="Haydovchi kabineti" back={!tabbed} tabbed={tabbed}
      right={app.can('maintenance.report') ? <Button title="Nosozlik" icon="construct-outline" small variant="secondary" full={false} onPress={() => setShowReport(true)} /> : undefined}>
      <View style={{ backgroundColor: colors.forest, borderRadius: radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={driver?.fullName ?? ''} uri={avatar} size={56} />
        <View style={{ flex: 1 }}>
          <Text variant="heading" tone="white" numberOfLines={1}>{driver?.fullName}</Text>
          <Text variant="caption" style={{ color: '#CFE4FF' }}>{app.roleName(driver)}{driver?.phone ? ` · ${driver.phone}` : ''}</Text>
          <Text variant="caption" style={{ color: '#CFE4FF', marginTop: 4 }}>{vehicles.map((vehicle) => `${vehicle.plate}`).join(', ') || 'Texnika biriktirilmagan'}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <MetricCard label="Bugungi reyslar" value={String(todayCount)} icon="bus-outline" tone="brand" />
        <MetricCard label="Oylik reyslar" value={String(monthTrips.length)} detail={pay.pending ? `${pay.pending} ta kutilmoqda` : undefined} icon="calendar-outline" tone="violet" />
        <MetricCard label="Hisoblangan maosh" value={money(pay.earned, { short: true })} detail={`${money(driver?.driverRatePerTrip ?? 0)} / reys`} icon="cash-outline" tone="green" />
        <MetricCard label="To‘lanishi kerak" value={money(Math.max(0, pay.remaining), { short: true })} detail={`Avans: ${money(pay.paid, { short: true })}`} icon="wallet-outline" tone="amber" />
      </View>

      <SectionTitle title={`Mening reyslarim · ${monthYear()}`} />
      {monthTrips.length ? monthTrips.slice(0, 30).map((trip) => <TripRow key={trip.id} trip={trip} app={app} onPress={() => setTripId(trip.id)} />)
        : <Card><EmptyState icon="bus-outline" title="Bu oy reyslar yo‘q" /></Card>}

      <SectionTitle title="Olingan avanslar" />
      <Card padded={false}>
        {payroll.length ? payroll.map((tx, index) => (
          <View key={tx.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderTopWidth: index ? 1 : 0, borderTopColor: colors.line }}>
            <View><Text variant="label">{money(tx.amount)}</Text><Text variant="caption" tone="muted">{dateTime(tx.createdAt)}</Text></View>
            <Tag label={tx.monitoringStatus === 'pending' ? 'Kutilmoqda' : 'Tasdiqlangan'} tone={tx.monitoringStatus === 'pending' ? 'warn' : 'leaf'} dot />
          </View>
        )) : <EmptyState icon="hand-left-outline" title="Avanslar yo‘q" />}
      </Card>
      <TripSheet tripId={tripId} onClose={() => setTripId(null)} />
      <MaintenanceSheet visible={showReport} onClose={() => setShowReport(false)} vehicleIds={vehicles.length ? vehicles.map((item) => item.id) : undefined} />
    </Screen>
  )
}

function DriversAdmin({ tabbed }: { tabbed?: boolean }) {
  const app = useApp()
  const action = useAction()
  const [showCreate, setShowCreate] = useState(false)
  const [advanceFor, setAdvanceFor] = useState<string | null>(null)
  const [rateFor, setRateFor] = useState<string | null>(null)
  const [rate, setRate] = useState('')
  const driverRoleId = app.roles.find((role) => role.permissions?.includes('driver.self'))?.id ?? ''
  const drivers = app.users.filter((user) => app.userCan(user, 'driver.self'))
  const rows = useMemo(() => drivers.map((person) => ({ person, pay: app.balanceForDriver(person.id), vehicles: app.vehicles.filter((vehicle) => vehicle.driverId === person.id) })),
    [app.users, app.roles, app.trips, app.transactions, app.vehicles]) // eslint-disable-line react-hooks/exhaustive-deps
  const person = rateFor ? app.users.find((user) => user.id === rateFor) : null

  return (
    <Screen title="Haydovchilar" subtitle={`Oylik hisob-kitob · ${monthYear()}`} back={!tabbed} tabbed={tabbed}
      right={app.canManageStaff ? <Button title="Qo‘shish" icon="person-add-outline" small full={false} onPress={() => setShowCreate(true)} /> : undefined}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Sum label="Haydovchilar" value={String(drivers.length)} />
        <Sum label="Oy reyslari" value={String(rows.reduce((sum, item) => sum + item.pay.trips, 0))} />
        <Sum label="Hisoblangan" value={money(rows.reduce((sum, item) => sum + item.pay.earned, 0), { short: true })} />
      </View>
      {rows.length ? rows.map(({ person: driver, pay, vehicles }) => (
        <Card key={driver.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={driver.fullName} size={42} tone="grey" />
            <View style={{ flex: 1 }}>
              <Text variant="subheading" numberOfLines={1}>{driver.fullName}</Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>{vehicles.map((vehicle) => vehicle.plate).join(', ') || 'Texnika biriktirilmagan'}</Text>
            </View>
            <View style={{ backgroundColor: colors.canvas, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text variant="heading">{pay.trips}</Text>
              <Text variant="caption" tone="muted" style={{ fontSize: 9 }}>reys</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Cell label="Stavka" value={money(driver.driverRatePerTrip, { short: true })} />
            <Cell label="Hisoblangan" value={money(pay.earned, { short: true })} />
            <Cell label="Avans" value={money(pay.paid, { short: true })} amber />
            <Cell label="Qoldiq" value={money(Math.max(0, pay.remaining), { short: true })} danger={pay.remaining > 0} />
          </View>
          {app.can('payroll.manage') || app.can('finance.expenses.create') ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {app.can('payroll.manage') ? <Button title="Stavka" icon="create-outline" small variant="secondary" style={{ flex: 1 }} onPress={() => { setRateFor(driver.id); setRate(formatAmountInput(Number(driver.driverRatePerTrip || 0))) }} /> : null}
              {app.can('finance.expenses.create') ? <Button title="Avans" icon="hand-left-outline" small variant="quiet" style={{ flex: 1 }} onPress={() => setAdvanceFor(driver.id)} /> : null}
            </View>
          ) : null}
        </Card>
      )) : (
        <Card>
          <EmptyState icon="person-outline" title="Tizimda haydovchi topilmadi." />
          {app.canManageStaff ? <Button title="Haydovchi qo‘shish" icon="person-add-outline" variant="secondary" onPress={() => setShowCreate(true)} /> : null}
        </Card>
      )}

      <ExpenseSheet visible={advanceFor !== null} onClose={() => setAdvanceFor(null)} initialCategory="payroll" initialDriverId={advanceFor ?? ''} title="Haydovchiga avans berish" />
      <StaffSheet visible={showCreate} onClose={() => setShowCreate(false)} initialRoleId={driverRoleId} title="Yangi haydovchi" />
      <Sheet visible={Boolean(person)} onClose={() => setRateFor(null)} title="Reys uchun stavka" subtitle={person?.fullName}>
        <AmountField label="Bir reys uchun haq" value={rate} onChangeText={setRate} />
        <Button title="Saqlash" loading={action.busy} onPress={() => void action.run(async () => { if (person) await app.updateDriverRate(person.id, parseAmountInput(rate)); setRateFor(null) }, 'Stavkani saqlab bo‘lmadi.')} />
      </Sheet>
    </Screen>
  )
}

function Sum({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 12 }}>
      <Text variant="caption" tone="muted">{label}</Text>
      <Text variant="subheading" numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  )
}
function Cell({ label, value, amber, danger }: { label: string; value: string; amber?: boolean; danger?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 8 }}>
      <Text variant="caption" tone="muted" style={{ fontSize: 10 }}>{label}</Text>
      <Text variant="label" tone={danger ? 'danger' : amber ? 'amber' : 'ink'} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  )
}
