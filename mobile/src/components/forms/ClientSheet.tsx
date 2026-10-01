import { useEffect, useState } from 'react'
import { formatPhone, phoneProblem } from '@/lib/phone'
import { parseAmountInput } from '@/lib/format'
import { useApp } from '@/store'
import { useAction } from '@/hooks/useAction'
import { FormFooter } from '@/components/FormFooter'
import { AmountField, PhoneField, Sheet, TextField } from '@/components/ui'

export function ClientSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const app = useApp()
  const action = useAction()
  const [form, setForm] = useState({ name: '', contactName: '', phone: '', openingBalance: '' })
  const [error, setError] = useState('')
  const patch = (next: Partial<typeof form>) => setForm((current) => ({ ...current, ...next }))
  useEffect(() => { if (visible) { setForm({ name: '', contactName: '', phone: '', openingBalance: '' }); setError('') } }, [visible])

  const submit = () => {
    setError('')
    if (!form.name.trim()) return setError('Korxona yoki mijoz nomini kiriting.')
    const phoneError = phoneProblem(form.phone)
    if (phoneError) return setError(phoneError)
    void action.run(async () => {
      await app.createClient({ name: form.name, contactName: form.contactName, phone: formatPhone(form.phone), openingBalance: parseAmountInput(form.openingBalance) })
      onClose()
    }, 'Mijozni saqlab bo‘lmadi.')
  }
  return (
    <Sheet visible={visible} onClose={onClose} title="Yangi mijoz" tall>
      <TextField label="Mijoz / korxona nomi" value={form.name} onChangeText={(name) => patch({ name })} placeholder="Masalan, Toshkent Yo‘l Qurilish" autoCapitalize="sentences" />
      <TextField label="Mas’ul shaxs" optional value={form.contactName} onChangeText={(contactName) => patch({ contactName })} placeholder="Ism familiya" autoCapitalize="words" />
      <PhoneField value={form.phone} onChangeText={(phone) => patch({ phone })} hint="Aloqa uchun. +998 avtomatik qo‘shiladi." />
      <AmountField label="Boshlang‘ich balans" optional allowNegative value={form.openingBalance} onChangeText={(openingBalance) => patch({ openingBalance })}
        hint="Musbat — mijoz qarzdor, manfiy (−) — avans to‘lagan." />
      <FormFooter onCancel={onClose} onSubmit={submit} submitLabel="Mijozni qo‘shish" loading={action.busy} error={error} />
    </Sheet>
  )
}
