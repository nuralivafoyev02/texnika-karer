import { useState } from 'react'
import { View } from 'react-native'
import { colors, radius } from '@/theme'
import { useApp } from '@/store'
import type { Category } from '@/store/types'
import { confirmAction, useAction } from '@/hooks/useAction'
import { Guard } from '@/components/Guard'
import { FormFooter } from '@/components/FormFooter'
import { Banner, Button, Card, EmptyState, FilterChips, Screen, Segmented, Sheet, SwitchRow, Tag, Text, TextField } from '@/components/ui'

export default function CategoriesScreen() {
  return <Guard any={['finance.categories.create', 'finance.manage']}><Categories /></Guard>
}

function Categories() {
  const app = useApp()
  const action = useAction()
  const canManage = app.can('finance.manage')
  const [tab, setTab] = useState<'out' | 'in'>('out')
  const [showEditor, setShowEditor] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState({ direction: 'out' as 'in' | 'out', label: '', hint: '', needsClient: false, needsVehicle: false, needsDriver: false })
  const [error, setError] = useState('')
  const patch = (next: Partial<typeof form>) => setForm((c) => ({ ...c, ...next }))
  const list = app.categories.filter((item) => item.direction === tab)

  const openCreate = () => { setEditing(null); setForm({ direction: tab, label: '', hint: '', needsClient: false, needsVehicle: false, needsDriver: false }); setError(''); setShowEditor(true) }
  const openEdit = (category: Category) => {
    setEditing(category)
    setForm({ direction: category.direction, label: category.label, hint: category.hint, needsClient: category.needsClient, needsVehicle: category.needsVehicle, needsDriver: category.needsDriver })
    setError('')
    setShowEditor(true)
  }
  const save = () => {
    setError('')
    void action.run(async () => {
      try {
        if (editing) await app.updateCategory(editing.id, { label: form.label, hint: form.hint })
        else await app.createCategory(form)
      } catch (e: any) { setError(e?.message || 'Saqlab bo‘lmadi.'); return }
      setShowEditor(false)
    })
  }
  const remove = async (category: Category) => {
    if (!category.isSystem && !(await confirmAction('Turni o‘chirish', `“${category.label}” turi o‘chirilsinmi?`, 'O‘chirish', true))) return
    void action.run(() => app.deleteCategory(category.id), 'Moliya turini o‘chirib bo‘lmadi.')
  }

  return (
    <Screen title="Moliya turlari" subtitle="Kirim va chiqim turlari" back right={<Button title="Yangi" icon="add" small full={false} onPress={openCreate} />}>
      {!canManage ? <Banner tone="info" icon="information-circle" title="Faqat yangi tur yaratish ruxsati bor" text="Tahrirlash va o‘chirish uchun “Moliya turlarini boshqarish” ruxsati kerak." /> : null}
      <FilterChips value={tab} onChange={setTab} options={[{ value: 'out', label: 'Chiqim turlari' }, { value: 'in', label: 'Kirim turlari' }]} />
      {list.length ? list.map((category) => (
        <Card key={category.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text variant="subheading">{category.label}</Text>
              {category.hint ? <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{category.hint}</Text> : null}
            </View>
            {category.isSystem ? <Tag label="Tizim" tone="muted" /> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {category.needsClient ? <Tag label="Mijoz majburiy" tone="blue" /> : null}
            {category.needsVehicle ? <Tag label="Texnika maydoni" tone="blue" /> : null}
            {category.needsDriver ? <Tag label="Haydovchi majburiy" tone="blue" /> : null}
          </View>
          {canManage ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Button title="Tahrirlash" icon="create-outline" small variant="secondary" onPress={() => openEdit(category)} style={{ flex: 1 }} />
              {!category.isSystem ? <Button title="O‘chirish" icon="trash-outline" small variant="quiet" onPress={() => void remove(category)} disabled={action.busy} style={{ flex: 1 }} /> : null}
            </View>
          ) : null}
        </Card>
      )) : <EmptyState icon="pricetags-outline" title="Turlar topilmadi" />}

      <Sheet visible={showEditor} onClose={() => setShowEditor(false)} title={editing ? 'Turni tahrirlash' : 'Yangi moliya turi'} tall>
        <Segmented label="Yo‘nalish" value={form.direction} onChange={(direction) => patch({ direction })} disabled={Boolean(editing)}
          options={[{ value: 'in', label: 'Kirim', icon: 'arrow-down' }, { value: 'out', label: 'Chiqim', icon: 'arrow-up' }]} />
        {editing ? <Text variant="caption" tone="muted" style={{ marginTop: -8, marginBottom: 12 }}>Tayyor turning yo‘nalishini o‘zgartirib bo‘lmaydi.</Text> : null}
        <TextField label="Tur nomi" value={form.label} onChangeText={(label) => patch({ label })} placeholder="Masalan, Qadoqlash xarajati" maxLength={60} />
        <TextField label="Izoh" optional value={form.hint} onChangeText={(hint) => patch({ hint })} placeholder="Qachon va kim uchun qo‘llanadi" maxLength={140} />
        {!editing ? (
          <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, marginBottom: 14 }}>
            <Text variant="label" style={{ marginTop: 12 }}>Majburiy bog‘lanishlar</Text>
            {form.direction === 'in'
              ? <SwitchRow title="Mijoz majburiy" description="Bu turdagi kirimda mijoz tanlash shart bo‘ladi." value={form.needsClient} onValueChange={(needsClient) => patch({ needsClient })} />
              : (
                <>
                  <SwitchRow title="Texnika maydoni" description="Xarajat formasida texnika tanlash maydoni ochiladi." value={form.needsVehicle} onValueChange={(needsVehicle) => patch({ needsVehicle })} />
                  <SwitchRow title="Haydovchi majburiy" description="Bunday xarajatni haydovchisiz kiritib bo‘lmaydi." value={form.needsDriver} onValueChange={(needsDriver) => patch({ needsDriver })} />
                </>
              )}
          </View>
        ) : null}
        <FormFooter onCancel={() => setShowEditor(false)} onSubmit={save} submitLabel={editing ? 'Saqlash' : 'Tur yaratish'} loading={action.busy} error={error} />
      </Sheet>
    </Screen>
  )
}
