import { useEffect, useMemo, useState } from 'react'
import { Image, Pressable, View } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, radius } from '@/theme'
import { money, number, dateTime, tripCode } from '@/lib/format'
import { pickPhoto, type PhotoSource } from '@/lib/files'
import { useApp } from '@/store'
import type { PickedPhoto, Trip } from '@/store/types'
import { useAction } from '@/hooks/useAction'
import { Guard } from '@/components/Guard'
import { VehicleSheet } from '@/components/forms/VehicleSheet'
import { Banner, Button, Card, DecimalField, EmptyState, Icon, IconBadge, Screen, SelectField, Segmented, Tag, TextField, Text } from '@/components/ui'

export default function ScaleScreen() {
  return <Guard permission="trips.create"><Scale /></Guard>
}

function Scale() {
  const app = useApp()
  const router = useRouter()
  const action = useAction()
  const [form, setForm] = useState({ vehicleId: '', saleType: 'credit' as 'cash' | 'credit', clientId: '', materialId: '', weightTons: '', hoursWorked: '1.2', note: '' })
  const [photo, setPhoto] = useState<PickedPhoto | null>(null)
  const [error, setError] = useState('')
  const [latest, setLatest] = useState<Trip | null>(null)
  const [showVehicle, setShowVehicle] = useState(false)
  const patch = (next: Partial<typeof form>) => setForm((current) => ({ ...current, ...next }))

  const activeVehicles = app.vehicles.filter((vehicle) => vehicle.status === 'active')
  const vehicle = app.vehicles.find((item) => item.id === form.vehicleId)
  const material = app.materials.find((item) => item.id === form.materialId)
  const amount = Math.round(Number(form.weightTons || 0) * Number(material?.unitPrice || 0) * 100) / 100
  const ready = Boolean(form.vehicleId && form.materialId && Number(form.weightTons) > 0 && (form.saleType === 'cash' || form.clientId))

  // Birinchi faol texnika, tosh va (qarzga savdoda) mijoz avtomatik tanlanadi — web'dagi kabi.
  useEffect(() => { if (!form.vehicleId && activeVehicles.length) patch({ vehicleId: activeVehicles[0].id }) }, [activeVehicles.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!form.materialId && app.materials.length) patch({ materialId: app.materials[0].id }) }, [app.materials.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!form.clientId && form.saleType === 'credit' && app.clients.length) patch({ clientId: app.clients[0].id }) }, [app.clients.length, form.saleType]) // eslint-disable-line react-hooks/exhaustive-deps

  const choosePhoto = (source: PhotoSource) => {
    void action.run(async () => {
      const picked = await pickPhoto(source)
      if (picked) setPhoto(picked)
    }, 'Rasmni olib bo‘lmadi.')
  }

  const submit = () => {
    setError('')
    if (!ready) return setError('Barcha majburiy maydonlarni to‘ldiring.')
    void action.run(async () => {
      const saved = await app.createTrip({ ...form, clientId: form.clientId || null, photo })
      setLatest(saved)
      setPhoto(null)
      patch({ weightTons: '', hoursWorked: '1.2', note: '' })
    }, 'Reysni saqlashda xatolik yuz berdi.')
  }

  const clientOptions = useMemo(() => app.clients.map((client) => ({ value: client.id, label: client.name, hint: client.contactName || client.phone || undefined })), [app.clients])

  if (latest) {
    const pending = latest.monitoringStatus === 'pending'
    return (
      <Screen title="Reys saqlandi" tabbed>
        <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
          <IconBadge name="checkmark-circle" tone="green" size={64} />
          <Text variant="heading" style={{ marginTop: 14 }}>Reys {tripCode(latest.id)}</Text>
          <Text tone="muted" center style={{ marginTop: 6 }}>
            {pending ? 'Monitoringga yuborildi — tasdiqlashdan keyin balansga yoziladi.' : 'Darhol tasdiqlandi — balansga yozildi.'}
          </Text>
          <Tag label={pending ? 'Kutilmoqda' : 'Tasdiqlangan'} tone={pending ? 'warn' : 'leaf'} dot />
          <View style={{ marginTop: 16, alignSelf: 'stretch', gap: 6 }}>
            <Line label="Samosval" value={app.vehicleName(latest.vehicleId)} />
            <Line label="Tosh turi" value={app.materialName(latest.materialId)} />
            <Line label="Og‘irlik" value={`${number(latest.weightTons, 1)} t`} />
            {app.canSeePrices ? <Line label="Qiymati" value={money(latest.totalAmount)} /> : null}
            <Line label="Mijoz" value={app.tripClient(latest)} />
            <Line label="Vaqt" value={dateTime(latest.createdAt)} />
          </View>
        </Card>
        <Button title="Yana reys kiritish" icon="add-circle-outline" onPress={() => setLatest(null)} />
        {app.can('trips.view') ? <Button title="Reyslar jurnaliga o‘tish" variant="secondary" onPress={() => router.push('/trips')} /> : null}
      </Screen>
    )
  }

  return (
    <Screen title="Yangi reys" subtitle="Tarozi: yukni kiriting — reys monitoring navbatiga tushadi" tabbed
      footer={<Button title={action.busy ? 'Saqlanmoqda…' : 'Reysni saqlash'} icon="checkmark-circle" onPress={submit} loading={action.busy} disabled={!ready} />}>
      {app.canAutoApproveTrips ? <Banner tone="info" icon="flash" title="Avtomatik tasdiqlash yoqilgan" text="Kiritilgan reys monitoringga o‘tmasdan, darhol tasdiqlanadi." /> : null}
      {!activeVehicles.length ? <Banner tone="danger" icon="warning" title="Faol texnika yo‘q" text="Reys ochish uchun avval texnikani ishga qaytaring yoki yangisini qo‘shing." /> : null}

      <Card>
        <SelectField label="Samosval" value={form.vehicleId} onChange={(vehicleId) => patch({ vehicleId })} placeholder="Samosvalni tanlang" searchable
          options={activeVehicles.map((item) => ({ value: item.id, label: `${item.plate} · ${item.model}`, hint: app.driverName(item.driverId) }))} />
        {app.can('fleet.manage') ? <Button title="Yangi texnika qo‘shish" icon="add" variant="quiet" small full={false} onPress={() => setShowVehicle(true)} style={{ marginTop: -4, marginBottom: 12 }} /> : null}
        {vehicle ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.canvas, borderRadius: radius.md, padding: 12 }}>
            <Icon name="person-circle-outline" size={22} color={colors.forest} />
            <View style={{ flex: 1 }}>
              <Text variant="caption" tone="muted">Haydovchi</Text>
              <Text variant="label">{app.driverName(vehicle.driverId)}</Text>
            </View>
          </View>
        ) : null}
      </Card>

      <Card>
        <Segmented label="Savdo turi" value={form.saleType} onChange={(saleType) => patch({ saleType })}
          options={[{ value: 'credit', label: 'Qarzga', icon: 'receipt-outline' }, { value: 'cash', label: 'Naqd', icon: 'cash-outline' }]} />
        <SelectField label="Mijoz" optional={form.saleType === 'cash'} value={form.clientId} onChange={(clientId) => patch({ clientId })} placeholder="Mijozni tanlang" searchable
          emptyLabel={form.saleType === 'cash' ? 'Mijozsiz' : undefined} options={clientOptions}
          hint={form.saleType === 'cash' ? 'Naqd savdoda mijoz ixtiyoriy: tanlansa, jurnalda ko‘rinadi (balansga qarz yozilmaydi).' : undefined} />
        {!app.clients.length && form.saleType === 'credit' ? <EmptyState icon="people-outline" title="Mijozlar yo‘q" text="Qarzga savdo uchun avval mijoz qo‘shing." /> : null}
        <SelectField label="Tosh turi" value={form.materialId} onChange={(materialId) => patch({ materialId })} placeholder="Tosh turini tanlang"
          options={app.materials.filter((item) => item.isActive).map((item) => ({ value: item.id, label: item.name, hint: app.canSeePrices ? `${money(item.unitPrice)} / t` : undefined }))} />
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}><DecimalField label="Og‘irlik" value={form.weightTons} onChangeText={(weightTons) => patch({ weightTons })} suffix="t" /></View>
          <View style={{ flex: 1 }}><DecimalField label="Ish vaqti" value={form.hoursWorked} onChangeText={(hoursWorked) => patch({ hoursWorked })} suffix="soat" /></View>
        </View>
        {app.canSeePrices ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.mint, borderRadius: radius.md, padding: 12, marginBottom: 14 }}>
            <Text variant="label" tone="brand">Reys qiymati</Text>
            <Text variant="heading" tone="brand">{money(amount)}</Text>
          </View>
        ) : null}
        <TextField label="Izoh" optional value={form.note} onChangeText={(note) => patch({ note })} placeholder="Qaysi obyektga tashilgani…" multiline />
      </Card>

      <Card>
        <Text variant="label" tone="muted" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Yuk fotosurati <Text variant="caption" tone="muted"> (ixtiyoriy)</Text></Text>
        {photo ? (
          <View>
            <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 200, borderRadius: radius.md, backgroundColor: colors.canvas }} resizeMode="cover" />
            <Pressable onPress={() => setPhoto(null)} style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 16, padding: 6 }} accessibilityLabel="Rasmni olib tashlash">
              <Icon name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Kamera" icon="camera-outline" variant="quiet" onPress={() => choosePhoto('camera')} style={{ flex: 1 }} disabled={action.busy} />
            <Button title="Galereya" icon="images-outline" variant="quiet" onPress={() => choosePhoto('library')} style={{ flex: 1 }} disabled={action.busy} />
          </View>
        )}
      </Card>

      {error ? <Text variant="label" tone="danger">{error}</Text> : null}
      <VehicleSheet visible={showVehicle} onClose={() => setShowVehicle(false)} onSaved={(created) => patch({ vehicleId: created.id })} />
    </Screen>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text variant="caption" tone="muted">{label}</Text>
      <Text variant="label" style={{ flex: 1, textAlign: 'right' }} numberOfLines={1}>{value}</Text>
    </View>
  )
}
