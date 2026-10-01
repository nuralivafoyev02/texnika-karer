import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { colors } from '@/theme'
import { dateTime, money, number, timeOnly, dateOnly, tripCode } from '@/lib/format'
import { isPendingMonitoring } from '@/lib/monitoring'
import { useApp } from '@/store'
import type { Transaction, Trip } from '@/store/types'
import { useAction } from '@/hooks/useAction'
import { Guard } from '@/components/Guard'
import { Block } from '@/components/trips/TripSheet'
import { Banner, Button, Card, DetailRow, EmptyState, FilterChips, ListScreen, SearchBar, Segmented, Sheet, Tag, Text, TextField } from '@/components/ui'

export default function MonitoringScreen() {
  return <Guard any={['monitoring.view', 'monitoring.approve']}><Monitoring /></Guard>
}

type Selected = { kind: 'trip'; id: string } | { kind: 'expense'; id: string } | null

function Monitoring() {
  const app = useApp()
  const [tab, setTab] = useState<'trips' | 'expenses'>('trips')
  const [status, setStatus] = useState<'pending' | 'approved' | 'all'>('pending')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Selected>(null)
  const [note, setNote] = useState('')
  const action = useAction()

  // Eski bazada `monitoring_status` ustuni yo'q bo'lsa — sahifa ochilganda ogohlantiramiz.
  useEffect(() => { void app.checkMonitoringSchema().catch(() => {}) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const matchStatus = (row: Trip | Transaction) => status === 'all' || (status === 'pending' ? isPendingMonitoring(row) : !isPendingMonitoring(row))
  const query = search.trim().toLowerCase()
  const trips = useMemo(() => app.trips.filter((trip) => matchStatus(trip) && (!query || [trip.id, app.tripClient(trip), app.vehicleName(trip.vehicleId), app.driverName(trip.driverId), app.materialName(trip.materialId), trip.note].join(' ').toLowerCase().includes(query)))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [app.trips, status, query]) // eslint-disable-line react-hooks/exhaustive-deps
  const expenses = useMemo(() => app.transactions.filter((tx) => tx.direction === 'out' && matchStatus(tx) && (!query || [tx.note, app.categoryLabel(tx.category), app.vehicleName(tx.vehicleId), app.driverName(tx.driverId)].join(' ').toLowerCase().includes(query)))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [app.transactions, status, query]) // eslint-disable-line react-hooks/exhaustive-deps

  const archivedTrips = app.trips.filter((trip) => !isPendingMonitoring(trip)).length
  const archivedExpenses = app.transactions.filter((tx) => tx.direction === 'out' && !isPendingMonitoring(tx)).length
  const pendingTons = app.pendingTrips.reduce((sum, trip) => sum + Number(trip.weightTons || 0), 0)

  const trip = selected?.kind === 'trip' ? app.trips.find((item) => item.id === selected.id) : undefined
  const expense = selected?.kind === 'expense' ? app.transactions.find((item) => item.id === selected.id) : undefined
  const row = trip ?? expense
  const userName = (id?: string | null) => (id ? app.users.find((user) => user.id === id)?.fullName ?? '—' : '')

  const open = (kind: 'trip' | 'expense', item: Trip | Transaction) => { setSelected({ kind, id: item.id }); setNote(item.monitoringNote || '') }
  const close = () => { setSelected(null); setNote('') }
  const decide = (approved: boolean) => {
    if (!selected) return
    void action.run(async () => {
      if (selected.kind === 'trip') await app.setTripMonitoring(selected.id, approved, note.trim())
      else await app.setExpenseMonitoring(selected.id, approved, note.trim())
      close()
    }, 'Holatni o‘zgartirib bo‘lmadi.')
  }

  const list = tab === 'trips' ? trips : expenses
  return (
    <>
      <ListScreen
        title="Monitoring"
        subtitle="Reys va xarajatlarni tasdiqlang — shundan keyin moliyaviy hisobga kiradi"
        tabbed
        data={list as (Trip | Transaction)[]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (tab === 'trips'
          ? <TripCard trip={item as Trip} onPress={() => open('trip', item)} />
          : <ExpenseCard tx={item as Transaction} onPress={() => open('expense', item)} />)}
        ListEmptyComponent={<EmptyState icon="shield-checkmark-outline" title={status === 'pending' ? 'Kutilayotgan yozuvlar yo‘q' : 'Yozuv topilmadi'} text={status === 'pending' ? 'Barcha reys va xarajatlar ko‘rib chiqilgan.' : undefined} />}
        header={(
          <>
            {app.monitoringSchema === false ? <Banner tone="danger" icon="warning" title="Monitoring bazada yo‘q" text="Server sxemasi eskirgan: supabase/migrations fayllarini qayta ishga tushiring." /> : null}
            <Segmented value={tab} onChange={setTab} options={[
              { value: 'trips', label: `Reyslar (${app.pendingTrips.length})`, icon: 'list-outline' },
              { value: 'expenses', label: `Xarajatlar (${app.pendingExpenses.length})`, icon: 'wallet-outline' },
            ]} />
            <SearchBar value={search} onChangeText={setSearch} />
            <FilterChips value={status} onChange={setStatus} options={[
              { value: 'pending', label: 'Kutilmoqda', count: tab === 'trips' ? app.pendingTrips.length : app.pendingExpenses.length },
              { value: 'approved', label: 'Tasdiqlangan', count: tab === 'trips' ? archivedTrips : archivedExpenses },
              { value: 'all', label: 'Barchasi' },
            ]} />
            {tab === 'trips' && pendingTons > 0 && status === 'pending' ? <Text variant="caption" tone="muted">Kutilayotgan: {number(pendingTons, 1)} t</Text> : null}
          </>
        )}
      />

      <Sheet visible={Boolean(row)} onClose={close} tall
        title={trip ? `Reys ${tripCode(trip.id)}` : expense ? app.categoryLabel(expense.category) : ''}
        subtitle={row ? dateTime(row.createdAt) : ''}>
        {row ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text variant="title">
                {trip ? `${number(trip.weightTons, 1)} t` : expense ? (app.canSeePrices ? `− ${money(expense.amount)}` : 'Yashirilgan') : ''}
              </Text>
              <Tag label={isPendingMonitoring(row) ? 'Kutilmoqda' : 'Tasdiqlangan'} tone={isPendingMonitoring(row) ? 'warn' : 'leaf'} dot />
            </View>
            {trip && app.canSeePrices ? <Text variant="subheading" tone="brand" style={{ marginBottom: 10 }}>{money(trip.totalAmount)}</Text> : null}
            <Block title="Tafsilotlar">
              {trip ? (
                <>
                  <DetailRow label="Samosval" value={app.vehicleName(trip.vehicleId)} />
                  <DetailRow label="Haydovchi" value={app.driverName(trip.driverId)} />
                  <DetailRow label="Tosh turi" value={app.materialName(trip.materialId)} />
                  <DetailRow label="Mijoz" value={app.tripClient(trip)} />
                  <DetailRow label="Savdo turi" tag={trip.saleType === 'cash' ? 'Naqd savdo' : 'Qarzga'} tagTone={trip.saleType === 'cash' ? 'cash' : 'credit'} />
                </>
              ) : expense ? (
                <>
                  <DetailRow label="Hisob" value={expense.paymentMethod === 'cash' ? 'Naqd kassa' : 'Bank'} />
                  <DetailRow label="Texnika" value={expense.vehicleId ? app.vehicleName(expense.vehicleId) : ''} />
                  <DetailRow label="Xodim" value={expense.driverId ? app.driverName(expense.driverId) : ''} />
                </>
              ) : null}
              <DetailRow label="Kiritdi" value={userName(row.createdBy)} sub={dateTime(row.createdAt)} />
              <DetailRow label={isPendingMonitoring(row) ? 'Bekor qilgan' : 'Tasdiqlagan'} value={row.monitoredAt ? userName(row.monitoredBy) : ''} sub={row.monitoredAt ? dateTime(row.monitoredAt) : ''} />
            </Block>
            {(trip?.note || expense?.note) ? (
              <View style={{ backgroundColor: colors.canvas, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.line }}>
                <Text variant="caption" tone="muted">Izoh</Text>
                <Text style={{ marginTop: 2 }}>{trip?.note || expense?.note}</Text>
              </View>
            ) : null}
            {app.canApproveMonitoring ? (
              <>
                <TextField label="Monitoring izohi" optional value={note} onChangeText={setNote} placeholder="Masalan: yuk tarozida tekshirildi" multiline />
                {isPendingMonitoring(row) ? (
                  <Button title="Tasdiqlash" icon="checkmark-circle" variant="success" onPress={() => decide(true)} loading={action.busy} />
                ) : (
                  <Button title="Tasdiqlashni bekor qilish" icon="arrow-undo" variant="danger" onPress={() => decide(false)} loading={action.busy} />
                )}
              </>
            ) : <Text variant="caption" tone="muted">Tasdiqlash huquqi yo‘q — faqat ko‘rish mumkin.</Text>}
          </>
        ) : null}
      </Sheet>
    </>
  )
}

function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const app = useApp()
  const pending = isPendingMonitoring(trip)
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text variant="subheading" numberOfLines={1}>{app.vehiclePlate(trip.vehicleId)} · {app.driverName(trip.driverId)}</Text>
          <Text variant="caption" tone="muted">{dateOnly(trip.createdAt)} · {timeOnly(trip.createdAt)} · {app.tripClient(trip)}</Text>
        </View>
        <Tag label={pending ? 'Kutilmoqda' : 'Tasdiqlangan'} tone={pending ? 'warn' : 'leaf'} dot />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Text variant="label">{number(trip.weightTons, 1)} t · {app.materialName(trip.materialId)}</Text>
        <Text variant="label" tone="brand">{app.canSeePrices ? money(trip.totalAmount, { short: true }) : ''}</Text>
      </View>
    </Card>
  )
}

function ExpenseCard({ tx, onPress }: { tx: Transaction; onPress: () => void }) {
  const app = useApp()
  const pending = isPendingMonitoring(tx)
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text variant="subheading" numberOfLines={1}>{app.categoryLabel(tx.category)}</Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>{dateOnly(tx.createdAt)} · {timeOnly(tx.createdAt)} · {tx.note || (tx.driverId ? app.driverName(tx.driverId) : tx.vehicleId ? app.vehicleName(tx.vehicleId) : '—')}</Text>
        </View>
        <Tag label={pending ? 'Kutilmoqda' : 'Tasdiqlangan'} tone={pending ? 'warn' : 'leaf'} dot />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Tag label={tx.paymentMethod === 'cash' ? 'Naqd' : 'Bank'} tone={tx.paymentMethod === 'cash' ? 'cash' : 'blue'} />
        <Text variant="label" tone="danger">{app.canSeePrices ? `− ${money(tx.amount, { short: true })}` : ''}</Text>
      </View>
    </Card>
  )
}

