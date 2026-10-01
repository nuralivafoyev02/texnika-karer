import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { colors, radius } from '@/theme'
import { PERMISSION_CATALOG, PERMISSION_GROUPS } from '@/lib/permissions'
import { useApp } from '@/store'
import type { Role } from '@/store/types'
import { useAction } from '@/hooks/useAction'
import { FormFooter } from '@/components/FormFooter'
import { Banner, Button, Sheet, SwitchRow, Text, TextField } from '@/components/ui'

// Lavozim va ruxsatlar (web'dagi RoleEditor). Faqat o'zida bor ruxsatni berish mumkin;
// to'liq huquqli (superadmin) hammasini beradi.
export function RoleSheet({ visible, onClose, role }: { visible: boolean; onClose: () => void; role?: Role | null }) {
  const app = useApp()
  const action = useAction()
  const [form, setForm] = useState({ id: '', name: '', description: '', grantsAll: false, permissions: [] as string[] })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setError('')
    setForm({ id: role?.id ?? '', name: role?.name ?? '', description: role?.description ?? '', grantsAll: role?.grantsAll === true, permissions: [...(role?.permissions ?? [])] })
  }, [visible, role]) // eslint-disable-line react-hooks/exhaustive-deps

  const catalog = useMemo(() => {
    const keys = new Set(app.permissionKeys)
    return keys.size ? PERMISSION_CATALOG.filter((item) => keys.has(item.key)) : PERMISSION_CATALOG
  }, [app.permissionKeys])
  const held = useMemo(() => new Set(app.isSuperadmin() ? catalog.map((item) => item.key) : (app.currentRole?.permissions ?? [])), [app.currentRole, catalog]) // eslint-disable-line react-hooks/exhaustive-deps
  const grantable = (key: string) => form.grantsAll || held.has(key)
  const toggle = (key: string, on: boolean) => setForm((c) => ({ ...c, permissions: on ? [...new Set([...c.permissions, key])] : c.permissions.filter((item) => item !== key) }))
  const selectGroup = (keys: string[], on: boolean) => setForm((c) => {
    const allowed = keys.filter(grantable)
    return { ...c, permissions: on ? [...new Set([...c.permissions, ...allowed])] : c.permissions.filter((key) => !allowed.includes(key)) }
  })
  const toggleGrantsAll = (on: boolean) => setForm((c) => ({ ...c, grantsAll: on, permissions: on ? catalog.filter((item) => held.has(item.key)).map((item) => item.key) : c.permissions }))

  const submit = () => {
    setError('')
    if (!form.name.trim()) return setError('Lavozim nomini kiriting.')
    void action.run(async () => {
      await app.saveRole({ id: form.id || undefined, name: form.name.trim(), description: form.description, grantsAll: form.grantsAll, permissions: form.permissions })
      onClose()
    }, 'Lavozimni saqlab bo‘lmadi.')
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={role ? 'Lavozimni tahrirlash' : 'Yangi lavozim'} tall>
      <TextField label="Lavozim nomi" value={form.name} onChangeText={(name) => setForm((c) => ({ ...c, name }))} placeholder="Masalan: Buxgalter" />
      <TextField label="Tavsif" optional value={form.description} onChangeText={(description) => setForm((c) => ({ ...c, description }))} placeholder="Qisqa izoh" />
      {app.isSuperadmin() ? (
        <View style={{ backgroundColor: colors.amberBg, borderColor: colors.amberLine, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, marginBottom: 14 }}>
          <SwitchRow icon="shield-checkmark" title="Barcha ruxsatlar avtomatik" description="Yangi ruxsat qo‘shilsa ham shu lavozim darhol oladi (superadmin)." value={form.grantsAll} onValueChange={toggleGrantsAll} />
        </View>
      ) : null}
      {PERMISSION_GROUPS.map((group) => {
        const items = catalog.filter((item) => item.group === group)
        if (!items.length) return null
        const keys = items.map((item) => item.key)
        const allOn = keys.filter(grantable).every((key) => form.permissions.includes(key) || form.grantsAll)
        return (
          <View key={group} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="eyebrow" tone="brand">{group}</Text>
              <Button title={allOn ? 'Hammasini olish' : 'Hammasini belgilash'} variant="quiet" small full={false} onPress={() => selectGroup(keys, !allOn)} disabled={form.grantsAll} />
            </View>
            {items.map((item) => (
              <SwitchRow key={item.key} title={item.label} description={grantable(item.key) ? item.description : `${item.description} · sizda bu ruxsat yo‘q`}
                value={form.grantsAll || form.permissions.includes(item.key)} onValueChange={(on) => toggle(item.key, on)} disabled={form.grantsAll || !grantable(item.key)} />
            ))}
          </View>
        )
      })}
      {!app.isSuperadmin() ? <Banner tone="info" icon="information-circle" title="Faqat o‘zingizda bor ruxsatlarni bera olasiz." /> : null}
      <FormFooter onCancel={onClose} onSubmit={submit} submitLabel="Saqlash" loading={action.busy} error={error} />
    </Sheet>
  )
}
