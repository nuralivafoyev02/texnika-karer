import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, View } from 'react-native'
import { colors, radius } from '@/theme'
import { buildTripHtml } from '@/lib/tripPdf'
import { shareHtmlAsPdf } from '@/lib/files'
import { dateTime, money, number, tripCode } from '@/lib/format'
import { isAutoApproved, isPendingMonitoring } from '@/lib/monitoring'
import { useApp } from '@/store'
import type { Trip } from '@/store/types'
import { useAction } from '@/hooks/useAction'
import { Button, DetailRow, Icon, Sheet, Tag, Text } from '@/components/ui'

// Reys tafsilotlari (web'dagi TripPreviewModal): ko'rsatkichlar, yuk, savdo, monitoring, izoh, foto, PDF.
export function TripSheet({ tripId, onClose }: { tripId: string | null; onClose: () => void }) {
  const app = useApp()
  const trip: Trip | undefined = tripId ? app.trips.find((item) => item.id === tripId) : undefined
  const [photoOpen, setPhotoOpen] = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const pdf = useAction()

  useEffect(() => { setPhotoOpen(false); setPhotoError('') }, [tripId])

  if (!trip) return <Sheet visible={false} onClose={onClose} title="Reys"><View /></Sheet>

  const vehicle = app.vehicles.find((item) => item.id === trip.vehicleId)
  const userName = (id?: string | null) => (id ? app.users.find((user) => user.id === id)?.fullName ?? '' : '')
  const pending = isPendingMonitoring(trip)
  const auto = isAutoApproved(trip)

  const showPhoto = async () => {
    setPhotoOpen(true)
    setPhotoError('')
    if (trip.photoUrl) return
    setPhotoLoading(true)
    try { if (!(await app.ensurePhotoUrl(trip))) setPhotoError('Rasmni yuklab bo‘lmadi.') }
    catch (error: any) { setPhotoError(error?.message || 'Rasmni yuklab bo‘lmadi.') }
    finally { setPhotoLoading(false) }
  }

  const sharePdf = () => pdf.run(async () => {
    await shareHtmlAsPdf(await buildTripHtml(trip, app), `Reys ${tripCode(trip.id)}`)
  }, 'PDF tayyorlab bo‘lmadi.')

  return (
    <Sheet visible onClose={onClose} title={`Reys ${tripCode(trip.id)}`} subtitle={dateTime(trip.createdAt)} tall>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Stat label="Og‘irlik" value={`${number(trip.weightTons, 1)} t`} primary />
        {app.canSeePrices ? <Stat label="Reys qiymati" value={money(trip.totalAmount, { short: true })} sub={`${money(trip.unitPrice, { short: true })} / t`} /> : null}
        <Stat label="Ish vaqti" value={`${number(trip.hoursWorked, 1)} soat`} />
      </View>

      <Block title="Yuk va transport">
        <DetailRow label="Tosh turi" value={app.materialName(trip.materialId)} />
        <DetailRow label="Samosval" value={vehicle?.plate || '—'} sub={vehicle?.model} />
        <DetailRow label="Haydovchi" value={app.driverName(trip.driverId)} />
      </Block>
      <Block title="Savdo">
        <DetailRow label="Mijoz" value={app.tripClient(trip)} />
        <DetailRow label="Savdo turi" tag={trip.saleType === 'cash' ? 'Naqd savdo' : 'Qarzga'} tagTone={trip.saleType === 'cash' ? 'cash' : 'credit'} />
        <DetailRow label="Kiritildi" value={dateTime(trip.createdAt)} sub={userName(trip.createdBy)} />
      </Block>
      <Block title="Monitoring">
        <DetailRow label="Holat" tag={auto ? 'Avto tasdiqlangan' : pending ? 'Kutilmoqda' : 'Tasdiqlangan'} tagTone={pending ? 'warn' : 'leaf'} />
        <DetailRow label={pending ? 'Bekor qilgan' : 'Tasdiqlagan'} value={trip.monitoredAt && !auto ? userName(trip.monitoredBy) || '—' : ''} sub={trip.monitoredAt && !auto ? dateTime(trip.monitoredAt) : ''} />
        <DetailRow label="Izoh" value={trip.monitoringNote} />
      </Block>

      {trip.note ? (
        <View style={{ flexDirection: 'row', gap: 10, backgroundColor: colors.canvas, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.line, marginBottom: 12 }}>
          <Icon name="document-text-outline" size={18} color={colors.muted} />
          <Text style={{ flex: 1 }}>{trip.note}</Text>
        </View>
      ) : null}

      {trip.photoPath ? (
        photoOpen ? (
          <View style={{ marginBottom: 12 }}>
            {photoLoading ? <ActivityIndicator color={colors.forest} style={{ padding: 30 }} /> : null}
            {photoError ? <Text tone="danger" variant="label" center>{photoError}</Text> : null}
            {trip.photoUrl ? <Image source={{ uri: trip.photoUrl }} resizeMode="contain" style={{ width: '100%', height: 300, borderRadius: radius.md, backgroundColor: colors.canvas }} /> : null}
          </View>
        ) : <Button title="Yuk rasmini ko‘rish" variant="quiet" icon="image-outline" onPress={showPhoto} style={{ marginBottom: 12 }} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Tag label="Rasm biriktirilmagan" tone="muted" />
        </View>
      )}

      <Button title="PDF varaqasini ulashish" icon="document-attach-outline" variant="secondary" onPress={sharePdf} loading={pdf.busy} />
    </Sheet>
  )
}

function Stat({ label, value, sub, primary }: { label: string; value: string; sub?: string; primary?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: primary ? colors.mint : colors.canvas, borderRadius: radius.md, padding: 10 }}>
      <Text variant="caption" style={{ color: primary ? colors.forest : colors.muted, fontWeight: '700' }}>{label}</Text>
      <Text variant="subheading" style={{ marginTop: 3, color: primary ? colors.forest : colors.ink }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {sub ? <Text variant="caption" tone="muted" numberOfLines={1}>{sub}</Text> : null}
    </View>
  )
}

export function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text variant="eyebrow" tone="muted" style={{ marginBottom: 2 }}>{title}</Text>
      {children}
    </View>
  )
}
