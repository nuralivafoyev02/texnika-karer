import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { getRandomBytes } from 'expo-crypto'
import { INTERNAL_DOMAIN } from '@/lib/supabase'
import { formatAmountInput, parseAmountInput } from '@/lib/format'
import { formatPhone, phoneProblem } from '@/lib/phone'
import { useApp } from '@/store'
import type { StaffResult, User } from '@/store/types'
import { useAction } from '@/hooks/useAction'
import { FormFooter } from '@/components/FormFooter'
import { AmountField, Button, PhoneField, SelectField, Sheet, SwitchRow, Text, TextField } from '@/components/ui'
import { CredentialsSheet, type Credentials } from './CredentialsSheet'

const LOGIN_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/

function randomPassword() {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(getRandomBytes(11), (byte) => alphabet[byte % alphabet.length]).join('')
}

// Xodim qo'shish / tahrirlash (web'dagi StaffForm). Yaratilganda login-parol ko'rsatiladi.
export function StaffSheet({ visible, onClose, user, initialRoleId = '', onCreated, title }: {
  visible: boolean
  onClose: () => void
  user?: User | null
  initialRoleId?: string
  onCreated?: (result: StaffResult) => void
  title?: string
}) {
  const app = useApp()
  const action = useAction()
  const isEdit = Boolean(user)
  const isSelf = Boolean(user) && user?.id === app.currentUser?.id
  const [form, setForm] = useState({ fullName: '', login: '', password: '', phone: '', title: '', roleId: '', rate: formatAmountInput(50000), isActive: true })
  const [error, setError] = useState('')
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const patch = (next: Partial<typeof form>) => setForm((current) => ({ ...current, ...next }))

  useEffect(() => {
    if (!visible) return
    setError('')
    setShowPassword(false)
    if (user) {
      setForm({
        fullName: user.fullName, login: user.login, password: '', phone: formatPhone(user.phone).replace('+998 ', ''), title: user.title,
        roleId: user.roleId, rate: formatAmountInput(user.driverRatePerTrip), isActive: user.isActive,
      })
    } else {
      const preferred = app.roles.find((role) => role.id === initialRoleId) ?? app.roles[0]
      setForm({ fullName: '', login: '', password: '', phone: '', title: '', roleId: preferred?.id ?? '', rate: formatAmountInput(50000), isActive: true })
    }
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  const role = app.roles.find((item) => item.id === form.roleId)
  const grantsFull = Boolean(form.roleId) && app.roleHasFullAccess(form.roleId)
  const loginProblem = useMemo(() => {
    if (isEdit) return ''
    if (!form.login) return 'Xodim uchun login belgilang.'
    if (!LOGIN_PATTERN.test(form.login.toLowerCase())) return 'Login: kichik harf, raqam, nuqta yoki chiziqcha (3–32 belgi).'
    return ''
  }, [form.login, isEdit])
  const passwordProblem = useMemo(() => {
    if (isEdit) return ''
    const value = form.password
    if (!value) return 'Parol kiriting yoki «Tayyor parol» tugmasini bosing.'
    if (value.length < 8) return `Parol ${8 - value.length} ta belgiga yetmayapti (minimum 8).`
    if (value.length > 72) return 'Parol juda uzun (maksimum 72 belgi).'
    if (/^[a-z0-9]+$/.test(value)) return 'Parolga katta harf yoki boshqa belgi qo‘shing.'
    return ''
  }, [form.password, isEdit])

  const submit = () => {
    setError('')
    if (form.fullName.trim().length < 3) return setError('Xodimning to‘liq ismini kiriting.')
    if (loginProblem) return setError(loginProblem)
    if (!isEdit && !form.roleId) return setError('Lavozimni tanlang.')
    if (passwordProblem) return setError(passwordProblem)
    const phoneError = phoneProblem(form.phone)
    if (phoneError) return setError(phoneError)
    void action.run(async () => {
      if (isEdit && user) {
        await app.updateStaffProfile(user.id, {
          fullName: form.fullName, phone: formatPhone(form.phone), title: form.title,
          roleId: isSelf ? undefined : form.roleId, isActive: isSelf ? undefined : form.isActive,
        })
        onClose()
        return
      }
      const result = await app.createStaff({
        fullName: form.fullName, login: form.login.toLowerCase(), password: form.password, generatePassword: false,
        phone: formatPhone(form.phone), title: form.title, roleId: form.roleId, driverRatePerTrip: parseAmountInput(form.rate),
      })
      onClose()
      // iOS: yopilayotgan varaq ustiga darhol yangisini ochib bo'lmaydi — qisqa kutamiz.
      if (result?.password) {
        const next = { login: result.login ?? form.login, password: result.password, name: result.fullName || form.fullName }
        setTimeout(() => setCredentials(next), 400)
      }
      onCreated?.(result)
    }, 'Xodimni saqlab bo‘lmadi.')
  }

  return (
    <>
      <Sheet visible={visible} onClose={onClose} title={title ?? (isEdit ? 'Xodimni tahrirlash' : 'Yangi xodim')} tall>
        <TextField label="To‘liq ism" value={form.fullName} onChangeText={(fullName) => patch({ fullName })} placeholder="Ism Familiya" autoCapitalize="words" />
        {!isEdit ? (
          <>
            <TextField label="Login" value={form.login} onChangeText={(login) => patch({ login: login.toLowerCase() })} placeholder="masalan: ali" autoCapitalize="none" autoCorrect={false}
              hint={form.login ? `${form.login.toLowerCase()}@${INTERNAL_DOMAIN}` : `@${INTERNAL_DOMAIN} bilan yakunlanadi`} />
            <TextField label="Parol" value={form.password} onChangeText={(password) => patch({ password })} secure={!showPassword} autoCapitalize="none" autoCorrect={false}
              placeholder="Kamida 8 ta belgi" hint="Katta/kichik harf va raqam aralash bo‘lsin." />
            <Button title="Tayyor parol yaratish" icon="refresh" variant="quiet" small onPress={() => { patch({ password: randomPassword() }); setShowPassword(true) }} style={{ marginBottom: 14 }} />
          </>
        ) : null}
        <PhoneField value={form.phone} onChangeText={(phone) => patch({ phone })} hint="Xodim bilan bog‘lanish uchun." />
        <TextField label="Lavozim bo‘limi" optional value={form.title} onChangeText={(next) => patch({ title: next })} placeholder={role?.name || 'Masalan: qurilma bo‘limi boshlig‘i'} />
        <SelectField label="Lavozim" value={form.roleId} onChange={(roleId) => patch({ roleId })} placeholder="Lavozimni tanlang"
          options={app.roles.map((item) => ({ value: item.id, label: item.name, hint: item.description || undefined }))} />
        {isSelf ? <Text variant="caption" tone="muted" style={{ marginTop: -8, marginBottom: 12 }}>O‘z lavozimingizni o‘zgartirib bo‘lmaydi.</Text> : null}
        {grantsFull ? <Text variant="caption" tone="amber" style={{ marginTop: -8, marginBottom: 12 }}>To‘liq huquqli lavozim (superadmin).</Text> : null}
        {role?.permissions?.includes('driver.self') || parseAmountInput(form.rate) > 0 ? (
          <AmountField label="Bir reys uchun haq" value={form.rate} onChangeText={(rate) => patch({ rate })} hint={isEdit ? 'Stavkani “Haydovchilar” bo‘limidan o‘zgartiring.' : undefined} />
        ) : null}
        {isEdit ? (
          <View>
            <SwitchRow title="Faol" description={isSelf ? 'O‘z holatingizni o‘zgartirib bo‘lmaydi.' : 'Bloklangan xodim tizimga kira olmaydi.'} value={form.isActive} onValueChange={(isActive) => patch({ isActive })} disabled={isSelf} />
          </View>
        ) : null}
        <FormFooter onCancel={onClose} onSubmit={submit} submitLabel={isEdit ? 'Saqlash' : 'Xodim qo‘shish'} loading={action.busy} error={error} />
      </Sheet>
      <CredentialsSheet credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  )
}
