import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, radius } from '@/theme'
import { isToday, money, number } from '@/lib/format'
import { isPendingMonitoring } from '@/lib/monitoring'
import { useApp } from '@/store'
import { Guard } from '@/components/Guard'
import { TripRow } from '@/components/trips/TripRow'
import { TripSheet } from '@/components/trips/TripSheet'
import { Button, EmptyState, FilterChips, ListScreen, SearchBar, Text } from '@/components/ui'

export default function TripsScreen() {
  return <Guard permission="trips.view"><Trips /></Guard>
}

function Trips() {
  const app = useApp()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState<'all' | 'today'>('all')
  const [saleType, setSaleType] = useState<'all' | 'cash' | 'credit'>('all')
  const [tripId, setTripId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return [...app.trips]
      .filter((trip) => {
        const joined = [trip.id, app.tripClient(trip), app.vehicleName(trip.vehicleId), app.driverName(trip.driverId), app.materialName(trip.materialId), trip.note].join(' ').toLowerCase()
        return (!search || joined.includes(search)) && (period !== 'today' || isToday(trip.createdAt)) && (saleType === 'all' || trip.saleType === saleType)
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [app.trips, app.clients, app.vehicles, app.users, app.materials, query, period, saleType]) // eslint-disable-line react-hooks/exhaustive-deps

  const tons = filtered.reduce((sum, trip) => sum + Number(trip.weightTons), 0)
  const sales = app.canSeePrices ? filtered.filter((trip) => !isPendingMonitoring(trip)).reduce((sum, trip) => sum + Number(trip.totalAmount), 0) : null
  const pending = filtered.filter(isPendingMonitoring).length

  return (
    <>
      <ListScreen
        title="Reyslar jurnali"
        subtitle="Karerdan chiqqan har bir samosval reysi"
        tabbed
        right={app.can('trips.create') ? <Button title="Yangi" icon="add" small full={false} onPress={() => router.push('/scale')} /> : undefined}
        data={filtered}
        keyExtractor={(trip) => trip.id}
        renderItem={({ item }) => <TripRow trip={item} app={app} onPress={() => setTripId(item.id)} />}
        ListEmptyComponent={<EmptyState icon="list-outline" title="Reyslar topilmadi" text="Filtrlarni o‘zgartirib ko‘ring yoki yangi reys kiriting." />}
        header={(
          <>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Reys, mijoz, samosval, haydovchi…" />
            <FilterChips value={period} onChange={setPeriod} options={[{ value: 'all', label: 'Barcha sana' }, { value: 'today', label: 'Bugun' }]} />
            <FilterChips value={saleType} onChange={setSaleType} options={[{ value: 'all', label: 'Barcha savdo' }, { value: 'cash', label: 'Naqd' }, { value: 'credit', label: 'Qarzga' }]} />
            <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 8 }}>
              <Summary label="Reyslar" value={String(filtered.length)} />
              <Summary label="Tonna" value={number(tons, 1)} />
              <Summary label="Sotuv" value={sales === null ? '—' : money(sales, { short: true, currency: false })} />
              {pending ? <Summary label="Kutilmoqda" value={String(pending)} warn /> : null}
            </View>
          </>
        )}
      />
      <TripSheet tripId={tripId} onClose={() => setTripId(null)} />
    </>
  )
}

function Summary({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="caption" tone="muted">{label}</Text>
      <Text variant="subheading" tone={warn ? 'amber' : 'ink'} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  )
}
