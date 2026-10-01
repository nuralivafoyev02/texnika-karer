import { View } from 'react-native'
import { dateOnly, money, number, timeOnly } from '@/lib/format'
import { isPendingMonitoring } from '@/lib/monitoring'
import type { AppView } from '@/store'
import type { Trip } from '@/store/types'
import { Card, Tag, Text } from '@/components/ui'

// Reyslar jurnalidagi bitta qator (karta ko'rinishida).
export function TripRow({ trip, app, onPress }: { trip: Trip; app: AppView; onPress: () => void }) {
  const pending = isPendingMonitoring(trip)
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text variant="subheading" numberOfLines={1}>{app.vehiclePlate(trip.vehicleId)} · {app.driverName(trip.driverId)}</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{dateOnly(trip.createdAt)} · {timeOnly(trip.createdAt)}</Text>
        </View>
        <Tag label={pending ? 'Kutilmoqda' : 'Tasdiqlangan'} tone={pending ? 'warn' : 'leaf'} dot />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="label" numberOfLines={1}>{app.tripClient(trip)}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Tag label={trip.saleType === 'cash' ? 'Naqd' : 'Qarzga'} tone={trip.saleType === 'cash' ? 'cash' : 'credit'} />
            {trip.photoPath ? <Tag label="Rasm" tone="blue" /> : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="heading">{number(trip.weightTons, 1)} t</Text>
          <Text variant="caption" tone="muted">{app.materialName(trip.materialId)}</Text>
          <Text variant="label" tone="brand" style={{ marginTop: 2 }}>{app.canSeePrices ? money(trip.totalAmount, { short: true }) : '—'}</Text>
        </View>
      </View>
    </Card>
  )
}
