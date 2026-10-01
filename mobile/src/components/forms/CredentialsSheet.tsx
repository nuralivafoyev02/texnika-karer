import * as Clipboard from 'expo-clipboard'
import { useState } from 'react'
import { View } from 'react-native'
import { colors, radius } from '@/theme'
import { Button, Sheet, Text } from '@/components/ui'

export type Credentials = { login: string; password: string; name: string }

// Yangi xodim uchun yaratilgan login va parol: faqat bir marta ko'rsatiladi — nusxalab olish kerak.
export function CredentialsSheet({ credentials, onClose }: { credentials: Credentials | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!credentials) return
    await Clipboard.setStringAsync(`Login: ${credentials.login}\nParol: ${credentials.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Sheet visible={Boolean(credentials)} onClose={onClose} title="Kirish ma’lumotlari" subtitle={credentials?.name}>
      <Text tone="muted" style={{ marginBottom: 12 }}>Parol faqat hozir ko‘rinadi. Uni xodimga xavfsiz yo‘l bilan yetkazing — xodim keyin o‘zi o‘zgartira oladi.</Text>
      <View style={{ backgroundColor: colors.canvas, borderRadius: radius.md, padding: 14, gap: 10, marginBottom: 14 }}>
        <View><Text variant="caption" tone="muted">Login</Text><Text variant="heading" selectable>{credentials?.login}</Text></View>
        <View><Text variant="caption" tone="muted">Parol</Text><Text variant="heading" selectable>{credentials?.password}</Text></View>
      </View>
      <Button title={copied ? 'Nusxalandi' : 'Nusxalash'} icon={copied ? 'checkmark' : 'copy-outline'} variant="secondary" onPress={copy} />
      <Button title="Tayyor" onPress={onClose} style={{ marginTop: 10 }} />
    </Sheet>
  )
}
