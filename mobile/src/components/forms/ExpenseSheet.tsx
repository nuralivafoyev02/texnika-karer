import { useEffect, useMemo, useState } from 'react'
import { formatAmountInput, parseAmountInput } from '@/lib/format'
import { useApp } from '@/store'
import type { PaymentMethod, Transaction } from '@/store/types'
import { useAction } from '@/hooks/useAction'
import { FormFooter } from '@/components/FormFooter'
import { AmountField, SelectField, Segmented, Sheet, TextField } from '@/components/ui'

const FALLBACK = [
  { key: 'blasting', label: 'Portlatish ishlari', hint: 'Ruxsatnoma, portlovchi modda, mutaxassis', needsVehicle: false, needsDriver: false },
  { key: 'fuel', label: 'Yoqilg‘i-moylash', hint: 'Solyarka va moylash materiallari', needsVehicle: true, needsDriver: false },
  { key: 'repair', label: 'Texnika ta’miri', hint: 'Ehtiyot qismlar va usta haqi', needsVehicle: true, needsDriver: false },
  { key: 'salary', label: 'Oyliklar', hint: 'Smena va ma’muriyat ish haqi', needsVehicle: false, needsDriver: false },
  { key: 'payroll', label: 'Haydovchi avansi', hint: 'Haydovchi hisob-kitobidan avans', needsVehicle: false, needsDriver: true },
  { key: 'other', label: 'Boshqa xarajat', hint: 'Boshqa bo‘limlar uchun to‘lov', needsVehicle: false, needsDriver: false },
]

// Chiqim (xarajat): yangi yozuv yoki mavjudini tahrirlash. Yangi chiqim monitoringga tushadi.
export function ExpenseSheet({ visible, onClose, initialCategory = 'fuel', initialDriverId = '', transaction, title }: {
  visible: boolean; onClose: () => void; initialCategory?: string; initialDriverId?: string; transaction?: Transaction | null; title?: string
}) {
  const app = useApp()
  const action = useAction()
  const options = useMemo(() => (app.expenseCategories.length ? app.expenseCategories : FALLBACK), [app.expenseCategories])
  const [form, setForm] = useState({ category: 'fuel', amount: '', paymentMethod: 'cash' as PaymentMethod, vehicleId: '', driverId: '', note: '' })
  const [error, setError] = useState('')
  const patch = (next: Partial<typeof form>) => setForm((current) => ({ ...current, ...next }))

  useEffect(() => {
    if (!visible) return
    setError('')
    setForm(transaction
      ? { category: transaction.category, amount: formatAmountInput(Math.round(transaction.amount)), paymentMethod: transaction.paymentMethod, vehicleId: transaction.vehicleId ?? '', driverId: transaction.driverId ?? '', note: transaction.note }
      : { category: initialCategory, amount: '', paymentMethod: 'cash', vehicleId: '', driverId: initialDriverId, note: '' })
  }, [visible, transaction?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = options.find((item) => item.key === form.category)
  const changeCategory = (category: string) => {
    const next = options.find((item) => item.key === category)
    patch({ category, vehicleId: '', driverId: next?.needsDriver ? form.driverId : '' })
  }

  const submit = () => {
    setError('')
    const amount = parseAmountInput(form.amount)
    if (!(amount > 0)) return setError('Xarajat summasini kiriting.')
    if (selected?.needsDriver && !form.driverId) return setError('Haydovchini tanlang.')
    void action.run(async () => {
      const payload = { category: form.category, amount, paymentMethod: form.paymentMethod, vehicleId: form.vehicleId || null, driverId: form.driverId || null, note: form.note }
      if (transaction) await app.updateTransaction(transaction.id, payload)
      else await app.createExpense(payload)
      onClose()
    }, 'Xarajatni saqlab bo‘lmadi.')
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={title ?? (transaction ? 'Chiqimni tahrirlash' : 'Yangi xarajat')} tall>
      <SelectField label="Xarajat yo‘nalishi" value={form.category} onChange={changeCategory} hint={selected?.hint} options={options.map((item) => ({ value: item.key, label: item.label }))} />
      <AmountField label="Summa" value={form.amount} onChangeText={(amount) => patch({ amount })} />
      {selected?.needsVehicle ? (
        <SelectField label="Texnika" optional value={form.vehicleId} onChange={(vehicleId) => patch({ vehicleId })} emptyLabel="Umumiy xarajat" searchable
          options={app.vehicles.map((item) => ({ value: item.id, label: `${item.plate} · ${item.model}` }))} />
      ) : null}
      {selected?.needsDriver ? (
        <SelectField label="Haydovchi" value={form.driverId} onChange={(driverId) => patch({ driverId })} placeholder="Haydovchini tanlang" searchable
          options={app.drivers.map((item) => ({ value: item.id, label: item.fullName }))} />
      ) : null}
      <Segmented label="To‘lov manbasi" value={form.paymentMethod} onChange={(paymentMethod) => patch({ paymentMethod })}
        options={[{ value: 'cash', label: 'Naqd kassa', icon: 'cash-outline' }, { value: 'bank', label: 'Bank', icon: 'card-outline' }]} />
      <TextField label="Izoh" optional value={form.note} onChangeText={(note) => patch({ note })} placeholder="Xarajat tafsiloti" />
      <FormFooter onCancel={onClose} onSubmit={submit} submitLabel={transaction ? 'Saqlash' : 'Xarajatni saqlash'} loading={action.busy} error={error} />
    </Sheet>
  )
}
