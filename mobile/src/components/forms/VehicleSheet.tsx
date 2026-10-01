import { useEffect, useState } from 'react'
import { useApp } from '@/store'
import type { Vehicle, VehicleStatus } from '@/store/types'
import { useAction } from '@/hooks/useAction'
import { FormFooter } from '@/components/FormFooter'
import { Banner, Button, SelectField, Sheet, TextField } from '@/components/ui'
import { StaffSheet } from './StaffSheet'

const PLATE_PATTERN = /^[A-Z0-9][A-Z0-9\s-]{2,15}$/

// Texnika qo'shish / tahrirlash (web'dagi VehicleForm). Haydovchi bo'lmasa shu yerning o'zida yaratish mumkin.
export function VehicleSheet({ visible, onClose, vehicle, onSaved }: { visible: boolean; onClose: () => void; vehicle?: Vehicle | null; onSaved?: (vehicle: Vehicle) => void }) {
  const app = useApp()
  const action = useAction()
  const [form, setForm] = useState({ plate: '', model: '', year: '', status: 'active' as VehicleStatus, driverId: '' })
  const [error, setError] = useState('')
  const [showDriver, setShowDriver] = useState(false)
  const patch = (next: Partial<typeof form>) => setForm((current) => ({ ...current, ...next }))
  const driverRoleId = app.roles.find((role) => role.permissions?.includes('driver.self'))?.id ?? ''

  useEffect(() => {
    if (!visible) return
    setError('')
    setForm(vehicle
      ? { plate: vehicle.plate, model: vehicle.model, year: vehicle.year ? String(vehicle.year) : '', status: vehicle.status, driverId: vehicle.driverId ?? '' }
      : { plate: '', model: '', year: '', status: 'active', driverId: '' })
  }, [visible, vehicle]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    setError('')
    const plate = form.plate.trim().toUpperCase()
    if (!PLATE_PATTERN.test(plate)) return setError('Raqam 3–16 ta belgi: harflar, raqamlar, bo‘shliq yoki chiziqcha.')
    if (!form.model.trim()) return setError('Texnika markasini kiriting.')
    const year = form.year ? Number(form.year) : null
    if (year && (year < 1950 || year > new Date().getFullYear() + 1)) return setError('Ishlab chiqarilgan yil noto‘g‘ri.')
    void action.run(async () => {
      const payload = { plate, model: form.model.trim(), year, driverId: form.driverId || null, status: form.status }
      if (vehicle) {
        await app.updateVehicle(vehicle.id, payload)
        onSaved?.({ ...vehicle, ...payload })
      } else {
        onSaved?.(await app.createVehicle(payload))
      }
      onClose()
    }, 'Texnikani saqlab bo‘lmadi.')
  }

  return (
    <>
      <Sheet visible={visible} onClose={onClose} title={vehicle ? 'Texnikani tahrirlash' : 'Yangi texnika'} tall>
        <TextField label="Texnika raqami" value={form.plate} onChangeText={(plate) => patch({ plate: plate.toUpperCase() })} placeholder="01 B 123 KA" autoCapitalize="characters" autoCorrect={false} maxLength={16} />
        <TextField label="Model" value={form.model} onChangeText={(model) => patch({ model })} placeholder="MAN TGS 6x4" />
        <TextField label="Ishlab chiqarilgan yili" optional value={form.year} onChangeText={(year) => patch({ year: year.replace(/\D/g, '').slice(0, 4) })} keyboardType="number-pad" placeholder="2021" />
        <SelectField label="Holati" value={form.status} onChange={(status) => patch({ status: status as VehicleStatus })}
          options={[{ value: 'active', label: 'Faol' }, { value: 'service', label: 'Servisda' }, { value: 'repair', label: 'Remontda' }]} />
        <SelectField label="Haydovchi" value={form.driverId} onChange={(driverId) => patch({ driverId })} emptyLabel="Biriktirilmagan" searchable
          options={app.drivers.map((person) => ({ value: person.id, label: person.fullName, hint: person.phone || undefined }))}
          hint="Faqat Haydovchi huquqiga ega xodimlar ro‘yxatda chiqadi." />
        {app.canManageStaff ? <Button title="Yangi haydovchi qo‘shish" icon="person-add-outline" variant="quiet" small onPress={() => setShowDriver(true)} style={{ marginBottom: 14 }} /> : null}
        <Banner icon="information-circle" tone="info" title="Texnika servisga o‘tkazilsa, uni reyslarga tanlab bo‘lmaydi." />
        <FormFooter onCancel={onClose} onSubmit={submit} submitLabel={vehicle ? 'Saqlash' : 'Texnika qo‘shish'} loading={action.busy} error={error} />
      </Sheet>
      <StaffSheet visible={showDriver} onClose={() => setShowDriver(false)} initialRoleId={driverRoleId} title="Yangi haydovchi"
        onCreated={(result) => { if (result?.userId) patch({ driverId: result.userId }) }} />
    </>
  )
}
