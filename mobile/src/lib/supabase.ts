import 'react-native-url-polyfill/auto'
import { AppState } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { createClient } from '@supabase/supabase-js'

// Ichki login → Auth email. Xodimlar email bilan emas, login bilan kiradi:
// `ali` avtomatik `ali@karer.erp` bo'ladi. Tashqi email kiritilsa, o'z holicha qo'llaniladi.
export const INTERNAL_DOMAIN = 'karer.erp'
export const toAuthEmail = (value: unknown) => {
  const login = String(value ?? '').trim().toLowerCase()
  if (!login) return ''
  return login.includes('@') ? login : `${login}@${INTERNAL_DOMAIN}`
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && anonKey && !url.includes('YOUR_PROJECT'))

// Sessiya tokenlari qurilmaning xavfsiz xotirasida (iOS Keychain / Android Keystore)
// saqlanadi. SecureStore bitta qiymat hajmini cheklaydi, sessiya JSON'i esa undan
// katta bo'lishi mumkin — shuning uchun bo'laklarga bo'lib yozamiz.
const CHUNK = 1800
const countKey = (key: string) => `${key}.n`
const chunkKey = (key: string, index: number) => `${key}.${index}`

const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const count = Number(await SecureStore.getItemAsync(countKey(key)))
      if (!count) return null
      const parts: string[] = []
      for (let i = 0; i < count; i += 1) {
        const part = await SecureStore.getItemAsync(chunkKey(key, i))
        if (part === null) return null
        parts.push(part)
      }
      return parts.join('')
    } catch {
      return null
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    const previous = Number(await SecureStore.getItemAsync(countKey(key)).catch(() => 0)) || 0
    const chunks = value.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, 'g')) ?? ['']
    for (let i = 0; i < chunks.length; i += 1) await SecureStore.setItemAsync(chunkKey(key, i), chunks[i])
    await SecureStore.setItemAsync(countKey(key), String(chunks.length))
    for (let i = chunks.length; i < previous; i += 1) await SecureStore.deleteItemAsync(chunkKey(key, i)).catch(() => {})
  },
  async removeItem(key: string): Promise<void> {
    const count = Number(await SecureStore.getItemAsync(countKey(key)).catch(() => 0)) || 0
    for (let i = 0; i < count; i += 1) await SecureStore.deleteItemAsync(chunkKey(key, i)).catch(() => {})
    await SecureStore.deleteItemAsync(countKey(key)).catch(() => {})
  },
}

export const supabase = supabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: secureSessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null

// Ilova fonda bo'lganda token yangilash to'xtatiladi, ochilganda davom etadi.
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh()
    else supabase.auth.stopAutoRefresh()
  })
}

// Store faqat sozlangan holatda ishlaydi; sozlanmagan bo'lsa ilova "Sozlanmagan" ekranini ko'rsatadi.
export const db = () => {
  if (!supabase) throw new Error('Supabase sozlanmagan: .env faylida EXPO_PUBLIC_SUPABASE_URL va EXPO_PUBLIC_SUPABASE_ANON_KEY ni to‘ldiring.')
  return supabase
}
