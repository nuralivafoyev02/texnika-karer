import { useState } from 'react'
import { View } from 'react-native'
import { colors, radius } from '@/theme'
import { toAuthEmail, db } from '@/lib/supabase'
import { LOCK_TIMEOUTS } from '@/lib/security'
import { useApp } from '@/store'
import { useSecurityStore } from '@/store/security'
import { useAction } from '@/hooks/useAction'
import { Banner, Button, Card, Icon, Screen, Segmented, Sheet, SwitchRow, Text, TextField } from '@/components/ui'

export default function SecurityScreen() {
  const app = useApp()
  const action = useAction()
  const info = useSecurityStore((s) => s.info)
  const biometricEnabled = useSecurityStore((s) => s.biometricEnabled)
  const lock = useSecurityStore((s) => s.lock)
  const enableBiometricLogin = useSecurityStore((s) => s.enableBiometricLogin)
  const disableBiometricLogin = useSecurityStore((s) => s.disableBiometricLogin)
  const setLock = useSecurityStore((s) => s.setLock)
  const [askPassword, setAskPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const user = app.currentUser

  // Biometrik kirishni yoqish: parolni tasdiqlaymiz (noto'g'ri parol saqlanib qolmasin) va xavfsiz xotiraga yozamiz.
  const confirmEnable = () => {
    setError('')
    if (!password || !user) return setError('Parolni kiriting.')
    void action.run(async () => {
      const { error: authError } = await db().auth.signInWithPassword({ email: toAuthEmail(user.login || user.email), password })
      if (authError) { setError('Parol noto‘g‘ri.'); return }
      try {
        await enableBiometricLogin({ userId: user.id, login: user.login || user.email, fullName: user.fullName }, password)
      } catch (e: any) { setError(e?.message || 'Yoqib bo‘lmadi.'); return }
      setAskPassword(false)
      setPassword('')
      app.notify(`${info.label} bilan kirish yoqildi.`)
    })
  }

  const toggleBiometric = (on: boolean) => {
    if (on) { setPassword(''); setError(''); setAskPassword(true) }
    else void action.run(async () => { await disableBiometricLogin(); app.notify(`${info.label} bilan kirish o‘chirildi.`) })
  }
  const toggleLock = (on: boolean) => {
    void action.run(async () => {
      const problem = await setLock({ enabled: on })
      if (problem) app.notify(problem, 'error')
      else app.notify(on ? 'Ilova qulflash yoqildi.' : 'Ilova qulflash o‘chirildi.')
    })
  }

  return (
    <Screen title="Xavfsizlik" subtitle="Face ID / barmoq izi va avto-qulf" back>
      {!info.available ? (
        <Banner icon="warning" title={info.hasHardware ? 'Biometriya sozlanmagan' : 'Biometrik tekshiruv mavjud emas'}
          text={info.hasHardware ? 'Telefon sozlamalarida Face ID yoki barmoq izini sozlang, so‘ng bu yerga qayting.' : 'Bu qurilmada Face ID / barmoq izi yo‘q. Ilovani qurilma PIN kodi bilan qulflash mumkin.'} />
      ) : null}

      <Card>
        <SwitchRow icon={info.label === 'Face ID' ? 'scan' : 'finger-print'} title={`${info.label} bilan kirish`}
          description="Login va parolni har safar yozmasdan, biometriya orqali kiring. Ma’lumot qurilmaning xavfsiz xotirasida (Keychain / Keystore) saqlanadi."
          value={biometricEnabled} onValueChange={toggleBiometric} disabled={!info.available || action.busy} />
      </Card>

      <Card>
        <SwitchRow icon="lock-closed-outline" title="Ilovani qulflash"
          description={`Ilova fonga o‘tib qaytganda ${info.available ? `${info.label} yoki ` : ''}qurilma kodi so‘raladi — telefon boshqa birovga tushsa ham ma’lumot himoyalangan.`}
          value={lock.enabled} onValueChange={toggleLock} disabled={!info.deviceSecured || action.busy} />
        {lock.enabled ? (
          <View style={{ marginTop: 6 }}>
            <Segmented label="Qachon qulflansin" value={String(lock.timeoutSec)} onChange={(value) => void setLock({ timeoutSec: Number(value) })}
              options={LOCK_TIMEOUTS.map((item) => ({ value: String(item.value), label: item.label }))} />
          </View>
        ) : null}
        {!info.deviceSecured ? <Text variant="caption" tone="amber" style={{ marginTop: 8 }}>Avval telefonda ekran qulfini (PIN, rasm kaliti yoki biometriya) o‘rnating.</Text> : null}
      </Card>

      <View style={{ flexDirection: 'row', gap: 10, backgroundColor: colors.mint, borderRadius: radius.lg, padding: 14 }}>
        <Icon name="shield-checkmark" size={20} color={colors.forest} />
        <Text variant="caption" style={{ flex: 1, color: colors.forest, lineHeight: 17 }}>
          Biometrik ma’lumotingiz (yuz, barmoq izi) ilovaga yoki serverga uzatilmaydi — uni faqat telefon tizimi tekshiradi. Yangi barmoq izi qo‘shilsa yoki parol o‘zgarsa, biometrik kirish bekor bo‘ladi va parol qayta so‘raladi.
        </Text>
      </View>

      <Sheet visible={askPassword} onClose={() => setAskPassword(false)} title={`${info.label} bilan kirishni yoqish`}>
        <Text tone="muted" style={{ marginBottom: 12 }}>Xavfsizlik uchun joriy parolingizni tasdiqlang.</Text>
        <TextField label="Joriy parol" value={password} onChangeText={setPassword} secure autoCapitalize="none" autoCorrect={false} error={error} onSubmitEditing={confirmEnable} returnKeyType="go" />
        <Button title="Tasdiqlash va yoqish" icon="checkmark" onPress={confirmEnable} loading={action.busy} />
      </Sheet>
    </Screen>
  )
}
