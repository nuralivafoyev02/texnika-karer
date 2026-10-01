import { useState } from 'react'
import { View } from 'react-native'
import { colors, radius } from '@/theme'
import { formatAmountInput, money, parseAmountInput } from '@/lib/format'
import { useApp } from '@/store'
import type { Material } from '@/store/types'
import { confirmAction, useAction } from '@/hooks/useAction'
import { Guard } from '@/components/Guard'
import { FormFooter } from '@/components/FormFooter'
import { AmountField, Banner, Button, Card, EmptyState, IconBadge, Screen, Sheet, Tag, Text, TextField } from '@/components/ui'

export default function MaterialsScreen() {
  return <Guard any={['materials.create', 'materials.manage']}><Materials /></Guard>
}

function Materials() {
  const app = useApp()
  const action = useAction()
  const canManage = app.can('materials.manage')
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [editing, setEditing] = useState<Material | null>(null)
  const [error, setError] = useState('')

  const create = () => {
    setError('')
    void action.run(async () => {
      try { await app.createMaterial({ name, unitPrice: parseAmountInput(price) }) } catch (e: any) { setError(e?.message || 'Qo‘shib bo‘lmadi.'); return }
      setShowNew(false)
    })
  }
  const savePrice = () => {
    setError('')
    void action.run(async () => {
      try { if (editing) await app.updateMaterial(editing.id, parseAmountInput(price)) } catch (e: any) { setError(e?.message || 'Saqlab bo‘lmadi.'); return }
      setEditing(null)
    })
  }
  const remove = async (material: Material) => {
    if (!(await confirmAction('Mahsulotni o‘chirish', `“${material.name}” mahsuloti o‘chirilsinmi?`, 'O‘chirish', true))) return
    void action.run(() => app.deleteMaterial(material.id), 'Mahsulotni o‘chirib bo‘lmadi.')
  }

  return (
    <Screen title="Mahsulotlar" subtitle="Tosh turlari va tonna narxlari" back right={<Button title="Yangi" icon="add" small full={false} onPress={() => { setName(''); setPrice(''); setError(''); setShowNew(true) }} />}>
      {!canManage ? <Banner tone="info" icon="information-circle" title="Faqat mahsulot qo‘shish ruxsati bor" text="Narx o‘zgartirish va o‘chirish uchun “Mahsulotlarni boshqarish” ruxsati kerak." /> : null}
      {app.materials.length ? app.materials.map((material) => (
        <Card key={material.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBadge name="cube-outline" tone="grey" size={42} />
            <View style={{ flex: 1 }}>
              <Text variant="subheading" numberOfLines={1}>{material.name}</Text>
              <Tag label={material.isActive ? 'Sotuvda' : 'Faol emas'} tone={material.isActive ? 'leaf' : 'muted'} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="heading">{money(material.unitPrice)}</Text>
              <Text variant="caption" tone="muted">bir tonna uchun</Text>
            </View>
          </View>
          {canManage ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Button title="Narxni o‘zgartirish" icon="create-outline" small variant="secondary" onPress={() => { setEditing(material); setPrice(formatAmountInput(material.unitPrice)); setError('') }} style={{ flex: 1 }} />
              <Button title="O‘chirish" icon="trash-outline" small variant="quiet" onPress={() => void remove(material)} disabled={action.busy} style={{ flex: 1 }} />
            </View>
          ) : null}
        </Card>
      )) : <EmptyState icon="cube-outline" title="Hali mahsulot qo‘shilmagan." />}
      <View style={{ backgroundColor: colors.amberBg, borderRadius: radius.md, padding: 12 }}>
        <Text variant="caption" style={{ color: colors.amberText }}>Narx o‘zgarishi yangi reyslarga ta’sir qiladi — eski reyslar o‘z narxida qoladi.</Text>
      </View>

      <Sheet visible={showNew} onClose={() => setShowNew(false)} title="Yangi mahsulot">
        <TextField label="Mahsulot nomi" value={name} onChangeText={setName} placeholder="Masalan: Shag‘al 5–20" maxLength={60} />
        <AmountField label="Tonna narxi" value={price} onChangeText={setPrice} suffix="so‘m / t" />
        <FormFooter onCancel={() => setShowNew(false)} onSubmit={create} submitLabel="Mahsulot qo‘shish" loading={action.busy} error={error} />
      </Sheet>
      <Sheet visible={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.name ?? ''} subtitle="Tonna narxini o‘zgartirish">
        <AmountField label="Yangi narx" value={price} onChangeText={setPrice} suffix="so‘m / t" />
        <FormFooter onCancel={() => setEditing(null)} onSubmit={savePrice} submitLabel="Saqlash" loading={action.busy} error={error} />
      </Sheet>
    </Screen>
  )
}
