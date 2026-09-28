import { createClient } from 'npm:@supabase/supabase-js@2'

// Bitta ichki domen: login `ali` → `ali@karer.erp`. Tashqi email kiritilsa, u o'z holicha saqlanadi.
export const INTERNAL_DOMAIN = 'karer.erp'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

export const authEmailFor = (login: string) => `${login}@${INTERNAL_DOMAIN}`

export const LOGIN_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/

// Kiritilgan parolni hech qaerda saqlamaydi: bcrypt hash'ini Supabase Auth o'zi qo'yadi.
export const normalizePassword = (value: unknown) => String(value ?? '').trim()
export const passwordProblem = (password: string) => {
  if (password.length < 8) return 'Parol kamida 8 ta belgidan iborat bo‘lishi kerak.'
  if (password.length > 72) return 'Parol juda uzun (maksimum 72 belgi).'
  if (password === password.toLowerCase() && /^[a-z0-9]+$/.test(password)) return 'Parol faqat kichik harflar va raqamlardan iborat bo‘lmasin.'
  return ''
}

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const generatePassword = (length = 11) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

type Caller = { id: string; roleId: string; roleName: string; isSuperadmin: boolean }

// ── To'liq dostugni aniqlash ────────────────────────────────────────────────
// Superadmin — maxfiy lavozim emas: lavozimda ruxsat katalogidagi BARCHA kalitlar bor bo'lgan
// xodim. Shu sabab bazadagi role_has_full_access() bilan bir xil qoida bu yerga ko'chiriladi,
// ya'ni sxema triggerlari ishlamagan holatda ham to'g'ri javob keladi.
export const permissionKeysForRole = async (admin: ReturnType<typeof createClient>, roleId: string) => {
  const [{ data: links }, { data: catalog }] = await Promise.all([
    admin.from('role_permissions').select('permission_id').eq('role_id', roleId),
    admin.from('permissions').select('id,key'),
  ])
  const keyById = new Map((catalog ?? []).map((row) => [row.id, row.key]))
  const keys = new Set((links ?? []).map((row) => keyById.get(row.permission_id)).filter(Boolean) as string[])
  const all = (catalog ?? []).map((row) => row.key)
  // Katalog bo'sh bo'lsa hech kim to'liq dostubga ega deb hisoblanmasin.
  return { keys, fullAccess: all.length > 0 && all.every((key) => keys.has(key)) }
}
// To'liq huquqli xodim xodim qo'sha, login/parol o'zgartira, lavozim va ruxsatlarni boshqara
// oladi. Boshqa hech kim, roli qanchalik kuchli bo'lmasin.
export const requireSuperadmin = async (request: Request): Promise<Caller | Response> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Server sozlamalari to‘liq emas.' }, 500)

  const authorization = request.headers.get('Authorization')
  if (!authorization) return json({ error: 'Kirish sessiyasi talab qilinadi.' }, 401)

  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: authData, error: authError } = await callerClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Sessiya haqiqiy emas.' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: profile, error: profileError } = await admin
    .from('users').select('id,role_id,is_active,is_superadmin').eq('id', authData.user.id).single()
  if (profileError) {
    // Eng ko'p uchraydigan sabab: schema.sql yangilanganidan keyin qayta ishga tushirilmagan.
    // Bu holda "profil topilmadi" xabari chalkash bo'lardi, shuning uchun aniq yo'nalish beramiz.
    if (schemaIsStale(profileError.message)) {
      return json({ error: 'Server sxemasi eskirgan: supabase/schema.sql faylini qayta ishga tushiring.' }, 500)
    }
    return json({ error: 'Xodim profili topilmadi.' }, 403)
  }
  if (!profile) return json({ error: 'Xodim profili topilmadi.' }, 403)
  if (!profile.is_active) return json({ error: 'Hisobingiz faol emas. Administratorga murojaat qiling.' }, 403)

  const { fullAccess } = await permissionKeysForRole(admin, profile.role_id)
  const isSuperadmin = profile.is_superadmin === true || fullAccess
  if (!isSuperadmin) return json({ error: 'Bu amalni faqat to‘liq huquqli (superadmin) xodim bajarishi mumkin.' }, 403)

  const { data: role } = await admin.from('roles').select('id,name').eq('id', profile.role_id).single()
  return { id: profile.id, roleId: profile.role_id, roleName: role?.name ?? '', isSuperadmin }
}

export const serviceClient = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// PostgREST/Postgres xatolarida "ustun yo'q" belgisi — sxema yangilanmagan.
export const schemaIsStale = (message = '') => /column .* does not exist|schema cache|42703|PGRST204/i.test(String(message))
