import { createClient } from '@supabase/supabase-js'

// Ichki login → Auth email. Xodimlar email bilan emas, login bilan kiradi:
// `ali` avtomatik `ali@karer.erp` bo'ladi. Tashqi email kiritilsa, o'z holicha qo'llaniladi.
export const INTERNAL_DOMAIN = 'karer.erp'
export const toAuthEmail = (value) => {
  const login = String(value ?? '').trim().toLowerCase()
  if (!login) return ''
  return login.includes('@') ? login : `${login}@${INTERNAL_DOMAIN}`
}

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && anonKey && !url.includes('YOUR_PROJECT'))
export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null
