import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  authEmailFor, corsHeaders, json, LOGIN_PATTERN, normalizePassword, passwordProblem,
  requireUser, serviceClient,
} from '../_shared/auth.ts'

// Xodim o'z login va parolini o'zgartiradi. Superadmin kerak emas — faqat sessiya tekshiriladi.
//
// Nega Edge Function? Ichki login — bu aslida Supabase Auth email'i (`ali` → `ali@karer.erp`).
// Auth email'ini o'zgartirish faqat service_role orqali mumkin: `users` jadvalidagi login ustuni
// yetarli emas, Auth hisobi ham yangilanishi kerak. Parol ham xuddi shunday — bcrypt hash'ini
// Supabase Auth o'zi qo'yadi, mijoz tomonidan yozib bo'lmaydi.
//
// Xavfsizlik: parol o'zgartirilganda avval JORIY parol so'raladi. Aks holda kimdir
// qurilmada ochiq qolgan sessiyani topib, parolni o'zgartirib, hisobni bosib olardi.
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Faqat POST so‘rovi qabul qilinadi.' }, 405)

  const caller = await requireUser(request)
  if (caller instanceof Response) return caller

  let input: Record<string, unknown>
  try { input = await request.json() } catch { return json({ error: 'JSON so‘rovi noto‘g‘ri.' }, 400) }

  const newLogin = String(input.login ?? '').trim().toLowerCase()
  const newPassword = input.password === undefined || input.password === null
    ? null
    : normalizePassword(input.password)
  const currentPassword = normalizePassword(input.currentPassword)

  if (!newLogin && !newPassword) return json({ error: 'Kamida bitta maydonni to‘ldiring.' }, 400)
  if (newLogin && !LOGIN_PATTERN.test(newLogin)) {
    return json({ error: 'Login 3–32 ta belgidan iborat bo‘lsin: kichik harflar, raqamlar, nuqta va chiziqcha.' }, 400)
  }
  if (newPassword) {
    const problem = passwordProblem(newPassword)
    if (problem) return json({ error: problem }, 400)
  }
  if (newPassword && !currentPassword) {
    return json({ error: 'Parolni o‘zgartirish uchun joriy parolni kiriting.' }, 400)
  }

  const admin = serviceClient()
  const { data: profile } = await admin
    .from('users').select('login,email').eq('id', caller.id).maybeSingle()
  if (!profile) return json({ error: 'Xodim profili topilmadi.' }, 404)

  // Joriy Auth email'i: tashqi email bilan yaratilgan xodimlarda `login` bo'sh bo'lishi mumkin,
  // shuning uchun email ustuniga qaytamiz.
  const currentAuthEmail = String(profile.email || authEmailFor(String(profile.login ?? '')))

  // Parol o'zgartirilayotgan bo'lsa, avval JORIY parolni tekshiramiz. Noto'g'ri bo'lsa
  // hech narsa o'zgartirmay qaytamiz — login ham, parol ham.
  if (newPassword) {
    const verifier = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: signInError } = await verifier.auth.signInWithPassword({
      email: currentAuthEmail,
      password: currentPassword,
    })
    if (signInError) return json({ error: 'Joriy parol to‘g‘ri emas.' }, 400)
  }

  if (newLogin) {
    // Login bandmi? `users_login_key` unique indeksi ham qo'lda tekshirish bilan himoya qilinadi.
    const { data: taken } = await admin.from('users').select('id').eq('login', newLogin).maybeSingle()
    if (taken) return json({ error: 'Bu login allaqachon band. Boshqasini tanlang.' }, 409)
  }

  // Avval Auth hisobini yangilaymiz: agar u muvaffaqiyatsiz bo'lsa, `users` jadvali
  // chalkash holatda qolmasligi kerak (login Auth email'idan keladi).
  if (newLogin) {
    const { error: authError } = await admin.auth.admin.updateUserById(caller.id, {
      email: authEmailFor(newLogin),
      email_confirm: true,
    })
    if (authError) return json({ error: `Login o‘zgartirilmadi: ${authError.message}` }, 400)
  }
  if (newPassword) {
    const { error: authError } = await admin.auth.admin.updateUserById(caller.id, { password: newPassword })
    if (authError) return json({ error: `Parol o‘zgartirilmadi: ${authError.message}` }, 400)
  }

  if (newLogin || newPassword) {
    const patch: Record<string, unknown> = { password_changed_at: new Date().toISOString() }
    if (newLogin) patch.login = newLogin
    const { error: updateError } = await admin.from('users').update(patch).eq('id', caller.id)
    if (updateError) {
      return json({ error: `O‘zgarish saqlandi, lekin profilni yangilab bo‘lmadi: ${updateError.message}` }, 400)
    }
  }

  return json({ ok: true, login: newLogin || undefined, passwordChanged: Boolean(newPassword) })
})
