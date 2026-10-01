import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useApp } from '@/store'
import { useAction } from '@/hooks/useAction'
import { FormFooter } from '@/components/FormFooter'
import { Banner, SelectField, Sheet, TextField } from '@/components/ui'

// Haydovchining tezkor nosozlik xabari: texnika remont holatiga o'tadi.
export function MaintenanceSheet({ visible, onClose, vehicleIds }: { visible: boolean; onClose: () => void; vehicleIds?: string[] }) {
  const app = useApp()
  const action = useAction()
  const [form, setForm] = useState({ vehicleId: '', description: '' })
  const [error, setError] = useState('')
  const vehicles = vehicleIds ? app.vehicles.filter((item) => vehicleIds.includes(item.id)) : app.vehicles
  useEffect(() => {
    if (!visible) return
    setError('')
    setForm({ vehicleId: vehicles.length === 1 ? vehicles[0].id : '', description: '' })
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    setError('')
    if (!form.vehicleId) return setError('Texnikani tanlang.')
    if (!form.description.trim()) return setError('Nosozlikni qisqacha yozing.')
    void action.run(async () => { await app.createMaintenanceReport(form); onClose() }, 'Xabar yuborilmadi.')
  }
  return (
    <Sheet visible={visible} onClose={onClose} title="Nosozlik haqida xabar" tall>
      <Banner icon="construct" title="Tezkor xabar" text="Texnika remont holatiga o‘tadi va mas’ullarga ko‘rinadi." />
      <View style={{ height: 14 }} />
      <SelectField label="Texnika" value={form.vehicleId} onChange={(vehicleId) => setForm((c) => ({ ...c, vehicleId }))} placeholder="Samosvalni tanlang"
        options={vehicles.map((item) => ({ value: item.id, label: `${item.plate} · ${item.model}` }))} />
      <TextField label="Nosozlik tavsifi" value={form.description} onChangeText={(description) => setForm((c) => ({ ...c, description }))} multiline
        placeholder="Masalan: orqa chap balon yorildi…" hint="Favqulodda xavf bo‘lsa, ishni to‘xtatib, mas’ul shaxsga telefon qiling." />
      <FormFooter onCancel={onClose} onSubmit={submit} submitLabel="Xabar yuborish" loading={action.busy} error={error} />
    </Sheet>
  )
}
