import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { colors } from '@/theme'
import { formatPhone, phoneProblem } from '@/lib/phone'
import { pickPhoto, type PhotoSource } from '@/lib/files'
import { useApp } from '@/store'
import { useAction } from '@/hooks/useAction'
import { useAvatar } from '@/hooks/useAvatar'
import { Avatar, Button, Card, PhoneField, Screen, SectionTitle, Text, TextField } from '@/components/ui'

export default function ProfileScreen() {
  const app = useApp()
  const user = app.currentUser
  const avatar = useAvatar(user?.id)
  const action = useAction()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [login, setLogin] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setFullName(user?.fullName ?? '')
    setPhone(formatPhone(user?.phone).replace('+998 ', ''))
    setLogin(user?.login ?? '')
  }, [user?.id, user?.fullName, user?.phone, user?.login])

  const nameChanged = (user?.fullName ?? '') !== fullName.trim()
  const phoneChanged = formatPhone(user?.phone) !== formatPhone(phone)
  const loginChanged = Boolean(login.trim()) && login.trim().toLowerCase() !== user?.login
  const accountChanged = loginChanged || Boolean(newPassword)

  const choose = (source: PhotoSource) => action.run(async () => {
    const photo = await pickPhoto(source, { maxSide: 900, quality: 0.7, square: true })
    if (photo) await app.uploadAvatar(photo)
  }, 'Rasmni yuklab bo‘lmadi.')

  const savePhone = () => {
    setError('')
    const problem = phoneProblem(phone)
    if (problem) return setError(problem)
    void action.run(() => app.updateMyProfile({ phone: formatPhone(phone) }))
  }
  const saveAccount = () => {
    setError('')
    void action.run(async () => {
      await app.updateMyAccount({ login: login.trim().toLowerCase(), currentPassword, password: newPassword })
      setCurrentPassword('')
      setNewPassword('')
    })
  }

  return (
    <Screen title="Profil" back>
      <Card style={{ alignItems: 'center', gap: 12 }}>
        <Avatar name={user?.fullName ?? ''} uri={avatar} size={88} />
        <Text variant="caption" tone="muted">JPG, PNG yoki WebP · 2 MB gacha</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Kamera" icon="camera-outline" variant="quiet" small onPress={() => void choose('camera')} disabled={action.busy} style={{ flex: 1 }} />
          <Button title="Galereya" icon="images-outline" variant="quiet" small onPress={() => void choose('library')} disabled={action.busy} style={{ flex: 1 }} />
          {user?.avatarPath ? <Button title="O‘chirish" icon="trash-outline" variant="secondary" small onPress={() => void action.run(() => app.removeAvatar())} disabled={action.busy} style={{ flex: 1 }} /> : null}
        </View>
      </Card>

      <Card>
        <SectionTitle title="Ism-familiya" />
        <View style={{ height: 10 }} />
        <TextField value={fullName} onChangeText={setFullName} autoCapitalize="words" hint="Xodimlar ro‘yxatida ko‘rinadi" />
        <Button title="Ismni saqlash" onPress={() => void action.run(() => app.updateMyProfile({ fullName }))} disabled={!nameChanged} loading={action.busy} />
      </Card>

      <Card>
        <SectionTitle title="Telefon nomer" />
        <View style={{ height: 10 }} />
        <PhoneField label="" value={phone} onChangeText={setPhone} error={error} hint="Ichki aloqa uchun" />
        <Button title="Telefonni saqlash" onPress={savePhone} disabled={!phoneChanged} loading={action.busy} />
      </Card>

      <Card>
        <SectionTitle title="Login va parol" />
        <Text variant="caption" tone="muted" style={{ marginVertical: 8 }}>Parolni o‘zgartirish uchun joriy parol kerak. Biometrik kirish yoqilgan bo‘lsa, yangi parol avtomatik yangilanadi.</Text>
        <TextField label="Login" value={login} onChangeText={(value) => setLogin(value.toLowerCase())} autoCapitalize="none" autoCorrect={false} />
        <TextField label="Joriy parol" optional value={currentPassword} onChangeText={setCurrentPassword} secure autoCapitalize="none" autoCorrect={false} />
        <TextField label="Yangi parol" optional value={newPassword} onChangeText={setNewPassword} secure autoCapitalize="none" autoCorrect={false} hint="Kamida 8 ta belgi: katta/kichik harf va raqam." />
        <Button title="Saqlash" onPress={saveAccount} disabled={!accountChanged} loading={action.busy} />
      </Card>
      <View style={{ height: 1, backgroundColor: colors.canvas }} />
    </Screen>
  )
}
