import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { colors, radius } from '@/theme'
import { dateTime, number } from '@/lib/format'
import { money } from '@/lib/format'
import { useApp } from '@/store'
import type { Vehicle } from '@/store/types'
import { useAction } from '@/hooks/useAction'
import { Guard } from '@/components/Guard'
import { VehicleSheet } from '@/components/forms/VehicleSheet'
import { Banner, Button, Card, EmptyState, FilterChips, IconBadge, ListScreen, SearchBar, SectionTitle, Tag, Text } from '@/components/ui'

export default function FleetScreen() {
  return <Guard permission="fleet.view"><Fleet /></Guard>
}

const statusLabel = { active: 'Faol', service: 'Servisda', repair: 'Remontda' } as const
const statusTone = { active: 'cash', service: 'service', repair: 'repair' } as const

function Fleet() {
  const app = useApp()
  const action = useAction()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'service' | 'repair'>('all')
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [showNew, setShowNew] = useState(false)
  const canManage = app.can('fleet.manage')

  const vehicles = useMemo(() => app.vehicles.filter((vehicle) => {
    const text = `${vehicle.plate} ${vehicle.model} ${app.driverName(vehicle.driverId)}`.toLowerCase()
    return (!search.trim() || text.includes(search.trim().toLowerCase())) && (filter === 'all' || vehicle.status === filter)
  }), [app.vehicles, app.users, search, filter]) // eslint-disable-line react-hooks/exhaustive-deps
  const activeCount = app.vehicles.filter((vehicle) => vehicle.status === 'active').length
  const withoutDriver = app.vehicles.filter((vehicle) => !vehicle.driverId && vehicle.status === 'active').length
  const repairSpend = app.transactions.filter((tx) => tx.category === 'repair' && tx.direction === 'out').reduce((sum, tx) => sum + Number(tx.amount), 0)

  const toggleStatus = (vehicle: Vehicle) => action.run(() => app.updateVehicleStatus(vehicle.id, vehicle.status === 'active' ? 'service' : 'active'), 'Texnika holatini yangilab bo‘lmadi.')
  const resolve = (id: string) => action.run(() => app.resolveMaintenanceReport(id), 'Xabarni yangilab bo‘lmadi.')

  return (
    <>
      <ListScreen
        title="Texnikalar"
        subtitle="Samosvallar holati va ishlash ko‘rsatkichlari"
        back
        right={canManage ? <Button title="Texnika" icon="add" small full={false} onPress={() => setShowNew(true)} /> : undefined}
        data={vehicles}
        keyExtractor={(vehicle) => vehicle.id}
        ListEmptyComponent={<EmptyState icon="bus-outline" title="Texnika topilmadi" />}
        renderItem={({ item: vehicle }) => {
          const stats = app.vehicleStats(vehicle.id)
          return (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconBadge name="bus-outline" tone={vehicle.status === 'active' ? 'brand' : 'amber'} size={44} />
                <View style={{ flex: 1 }}>
                  <Text variant="subheading" numberOfLines={1}>{vehicle.plate}</Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>{vehicle.model}{vehicle.year ? ` · ${vehicle.year}` : ''}</Text>
                </View>
                <Tag dot label={statusLabel[vehicle.status]} tone={statusTone[vehicle.status]} />
              </View>
              <Text variant="caption" tone="muted" style={{ marginTop: 10 }}>Haydovchi: <Text variant="label">{app.driverName(vehicle.driverId)}</Text></Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Mini label="Reys (oy)" value={String(stats.trips)} />
                <Mini label="Tonna" value={number(stats.tons, 1)} />
                <Mini label="Soat" value={number(stats.hours, 1)} />
                {app.canSeePrices ? <Mini label="Xarajat" value={money(stats.spent, { short: true, currency: false })} /> : null}
              </View>
              {canManage ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <Button title="Tahrirlash" icon="create-outline" variant="secondary" small onPress={() => setEditing(vehicle)} style={{ flex: 1 }} />
                  <Button title={vehicle.status === 'active' ? 'Servisga' : 'Ishga qaytarish'} icon={vehicle.status === 'active' ? 'build-outline' : 'play-outline'} variant="quiet" small onPress={() => void toggleStatus(vehicle)} disabled={action.busy} style={{ flex: 1 }} />
                </View>
              ) : null}
            </Card>
          )
        }}
        header={(
          <>
            {app.openReports.length ? (
              <View style={{ gap: 8 }}>
                <SectionTitle title={`Ochiq nosozliklar (${app.openReports.length})`} />
                {app.openReports.map((report) => (
                  <Card key={report.id} style={{ borderColor: colors.amberLine, backgroundColor: colors.amberBg }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <Text variant="subheading" numberOfLines={1} style={{ flex: 1 }}>{app.vehicleName(report.vehicleId)}</Text>
                      <Tag label="Ochiq" tone="credit" dot />
                    </View>
                    <Text style={{ marginTop: 4 }}>{report.description}</Text>
                    <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>{app.driverName(report.driverId)} · {dateTime(report.createdAt)}</Text>
                    {canManage ? <Button title="Yopish" icon="checkmark" small variant="success" full={false} onPress={() => void resolve(report.id)} disabled={action.busy} style={{ marginTop: 10 }} /> : null}
                  </Card>
                ))}
              </View>
            ) : null}
            {withoutDriver ? <Banner icon="person-remove-outline" title={`${withoutDriver} ta faol texnikaga haydovchi biriktirilmagan`} /> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Sum label="Faol" value={`${activeCount} / ${app.vehicles.length}`} />
              {app.canSeePrices ? <Sum label="Ta’mir xarajati" value={money(repairSpend, { short: true })} /> : null}
            </View>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Raqam, model yoki haydovchi" />
            <FilterChips value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Barchasi' }, { value: 'active', label: 'Faol' }, { value: 'service', label: 'Servisda' }, { value: 'repair', label: 'Remontda' }]} />
          </>
        )}
      />
      <VehicleSheet visible={showNew} onClose={() => setShowNew(false)} />
      <VehicleSheet visible={editing !== null} vehicle={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 10 }}>
      <Text variant="caption" tone="muted" style={{ fontSize: 10 }}>{label}</Text>
      <Text variant="label" numberOfLines={1}>{value}</Text>
    </View>
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
