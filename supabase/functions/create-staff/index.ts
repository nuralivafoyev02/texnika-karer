import {
  authEmailFor, corsHeaders, generatePassword, json, LOGIN_PATTERN, normalizePassword, passwordProblem,
  permissionKeysForRole, requireSuperadmin, schemaIsStale, serviceClient,
} from '../_shared/auth.ts'

// Xodim qo'shish: login va parol shu zahotiyoq yaratiladi. Taklif xati, email tasdiqi
// yoki redirect link ishlatilmaydi — parolni Supabase Auth o'zi bcrypt bilan hashlab saqlaydi.
// Yaratilgan xodimga to'liq huquqli lavozim biriktirilsa, u darhol superadmin bo'ladi.
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Faqat POST so‘rovi qabul qilinadi.' }, 405)

  const caller = await requireSuperadmin(request)
  if (caller instanceof Response) return caller

  let input: Record<string, unknown>
  try { input = await request.json() } catch { return json({ error: 'JSON so‘rovi noto‘g‘ri.' }, 400) }

  const fullName = String(input.fullName ?? '').trim().replace(/\s+/g, ' ')
  const login = String(input.login ?? '').trim().toLowerCase()
  const phone = String(input.phone ?? '').trim()
  const jobTitle = String(input.title ?? '').trim()
  const roleId = String(input.roleId ?? '').trim()
  const driverRate = Number(input.driverRatePerTrip ?? 0)
  const wantsGenerated = input.generatePassword === true
  const typedPassword = normalizePassword(input.password)

  if (fullName.length < 3) return json({ error: 'Xodimning to‘liq ismini kiriting.' }, 400)
  if (!LOGIN_PATTERN.test(login)) return json({ error: 'Login 3–32 ta belgidan iborat bo‘lsin: kichik harf, raqam, nuqta, chiziqcha.' }, 400)
  if (!roleId) return json({ error: 'Lavozimni tanlang.' }, 400)
  if (!Number.isFinite(driverRate) || driverRate < 0) return json({ error: 'Reys stavkasini tekshiring.' }, 400)
  if (wantsGenerated && typedPassword) return json({ error: 'Avtomatik parol tanlangan — parol maydonini bo‘sh qoldiring.' }, 400)
  if (!wantsGenerated) {
    if (!typedPassword) return json({ error: 'Parol kiriting yoki avtomatik yaratishni tanlang.' }, 400)
    const problem = passwordProblem(typedPassword)
    if (problem) return json({ error: problem }, 400)
  }

  const admin = serviceClient()
  const { data: targetRole, error: roleError } = await admin.from('roles').select('id,name,is_system').eq('id', roleId).single()
  if (roleError || !targetRole) return json({ error: 'Tanlangan lavozim topilmadi.' }, 400)

  // Nafas olish: superadmin o'ziga tegishli bo'lmagan ruxsatni boshqaruvga bermasin.
  // To'liq huquqli chaqiruvchida barcha kalitlar mavjud bo'lgani uchun bu tekshiruv hech qachon
  // to'g'ri lavozimni rad etmaydi.
  const [{ keys: targetKeys, fullAccess: targetIsFullAccess }, { keys: superadminKeys }] = await Promise.all([
    permissionKeysForRole(admin, roleId),
    permissionKeysForRole(admin, caller.roleId),
  ])
  const elevated = [...targetKeys].filter((key) => !superadminKeys.has(key))
  if (elevated.length) return json({ error: `Bu lavozimga berilayotgan ruxsatlar sizda yo‘q: ${elevated.join(', ')}` }, 403)

  const email = authEmailFor(login)
  const { data: loginTaken } = await admin.from('users').select('id').eq('login', login).maybeSingle()
  if (loginTaken) return json({ error: 'Bu login allaqachon band. Boshqasini tanlang.' }, 409)

  const password = wantsGenerated ? generatePassword() : typedPassword
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone, login },
  })
  if (createError || !created?.user) {
    const message = createError?.message ?? 'Hisob yaratilmadi.'
    if (/already|registered|exists/i.test(message)) return json({ error: 'Bu login allaqachon mavjud. Boshqasini tanlang.' }, 409)
    // GoTrue ichki trigger/constraint xatolarini yopadi; sababni tekshiramiz.
    if (/Database error saving new user|trigger|violates/i.test(message)) {
      return json({ error: 'Auth bazasi profilni qabul qilmadi (trigger yoki NOT NULL cheklovi). supabase/schema.sql ni qayta ishga tushiring.' }, 400)
    }
    if (schemaIsStale(message)) return json({ error: 'Server sxemasi eskirgan: supabase/schema.sql ni qayta ishga tushiring.' }, 400)
    return json({ error: message }, 400)
  }

  // To'liq huquq = superadmin: lavozim ruxsat katalogining hammasini qamrab olsa, yozuv
  // shu holda yaratiladi. (DB triggeri ham xuddi shuni qayta hisoblaydi — bu esa Edge Function
  // javobida darhol ko'rsatish uchun kerak.)
  const isSuperadmin = targetIsFullAccess === true

  const { error: insertError } = await admin.from('users').insert({
    id: created.user.id,
    full_name: fullName,
    email,
    login,
    phone: phone || null,
    title: jobTitle || targetRole.name,
    role_id: roleId,
    driver_rate_per_trip: driverRate,
    is_active: true,
    is_superadmin: isSuperadmin,
    password_changed_at: new Date().toISOString(),
  })
  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return json({ error: `Profil yaratilmadi: ${insertError.message}` }, 400)
  }

  return json({
    ok: true,
    userId: created.user.id,
    login,
    email,
    fullName,
    isSuperadmin,
    // Parol faqat shu javobda qaytariladi: hech qayerda saqlanmaydi.
    password: wantsGenerated ? password : undefined,
  }, 201)
})
