import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { colors, radius } from '@/theme'
import { formatAmountInput, money, parseAmountInput } from '@/lib/format'
import { useApp } from '@/store'
import type { PaymentMethod, Transaction } from '@/store/types'
import { useAction } from '@/hooks/useAction'
import { FormFooter } from '@/components/FormFooter'
import { AmountField, Banner, SelectField, Segmented, Sheet, Text, TextField } from '@/components/ui'

const FALLBACK = [{ key: 'customer_payment', label: 'Mijoz to‘lovi', hint: 'Kelgan to‘lov mijoz balansini kamaytiradi', needsClient: true }]

// Kirim (mijoz to'lovi va boshqa daromad turlari): yangi yozuv yoki mavjudini tahrirlash.
export function PaymentSheet({ visible, onClose, initialClientId = '', transaction }: { visible: boolean; onClose: () => void; initialClientId?: string; transaction?: Transaction | null }) {
  const app = useApp()
  const action = useAction()
  const options = useMemo(() => {
    const list = app.incomeCategories.filter((item) => item.key !== 'cash_sale')
    return list.length ? list : FALLBACK
  }, [app.incomeCategories])
  const [form, setForm] = useState({ category: 'customer_payment', clientId: '', amount: '', paymentMethod: 'cash' as PaymentMethod, note: '' })
  const [error, setError] = useState('')
  const patch = (next: Partial<typeof form>) => setForm((current) => ({ ...current, ...next }))

  useEffect(() => {
    if (!visible) return
    setError('')
    if (transaction) {
      setForm({ category: transaction.category, clientId: transaction.clientId ?? '', amount: formatAmountInput(Math.round(transaction.amount)), paymentMethod: transaction.paymentMethod, note: transaction.note })
    } else {
      setForm({ category: options.find((item) => item.key === 'customer_payment')?.key ?? options[0]?.key ?? 'customer_payment', clientId: initialClientId, amount: '', paymentMethod: 'cash', note: '' })
    }
  }, [visible, transaction?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = options.find((item) => item.key === form.category) ?? options[0]
  const needsClient = selected?.needsClient !== false
  const client = app.clients.find((item) => item.id === form.clientId)

  const submit = () => {
    setError('')
    const amount = parseAmountInput(form.amount)
    if (needsClient && !form.clientId) return setError('Mijozni tanlang.')
    if (!(amount > 0)) return setError('To‘lov summasini kiriting.')
    void action.run(async () => {
      const payload = { category: form.category, amount, paymentMethod: form.paymentMethod, clientId: needsClient ? form.clientId : null, note: form.note }
      if (transaction) await app.updateTransaction(transaction.id, payload)
      else await app.createPayment(payload)
      onClose()
    }, 'To‘lovni saqlab bo‘lmadi.')
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={transaction ? 'Kirimni tahrirlash' : 'Yangi kirim'} tall>
      <Banner tone="info" icon="cash-outline" title={selected?.label || 'Mijoz to‘lovi'} text={selected?.hint || 'To‘lov kassa yoki bank qoldig‘iga qo‘shiladi va mijoz balansidagi qarzni kamaytiradi.'} />
      <View style={{ height: 14 }} />
      {options.length > 1 ? <SelectField label="Daromat turi" value={form.category} onChange={(category) => patch({ category })} options={options.map((item) => ({ value: item.key, label: item.label }))} /> : null}
      {needsClient ? (
        <>
          <SelectField label="Mijoz" value={form.clientId} onChange={(clientId) => patch({ clientId })} placeholder="Mijozni tanlang" searchable
            options={app.clients.map((item) => ({ value: item.id, label: item.name, hint: item.contactName || undefined }))} />
          {client ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12, marginTop: -4, marginBottom: 14 }}>
              <Text variant="caption" tone="muted">Joriy balans</Text>
              <Text variant="label">{money(app.clientBalance(client.id))}</Text>
            </View>
          ) : null}
        </>
      ) : null}
      <AmountField label="To‘lov summasi" value={form.amount} onChangeText={(amount) => patch({ amount })} />
      <Segmented label="To‘lov turi" value={form.paymentMethod} onChange={(paymentMethod) => patch({ paymentMethod })}
        options={[{ value: 'cash', label: 'Naqd', icon: 'cash-outline' }, { value: 'bank', label: 'Bank', icon: 'card-outline' }]} />
      <TextField label="Izoh" optional value={form.note} onChangeText={(note) => patch({ note })} placeholder="Masalan, shartnoma bo‘yicha" />
      <FormFooter onCancel={onClose} onSubmit={submit} submitLabel={transaction ? 'Saqlash' : 'To‘lovni kiritish'} loading={action.busy} error={error} />
    </Sheet>
  )
}
