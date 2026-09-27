import { corsHeaders, json, normalizePassword, passwordProblem, requireSuperadmin, schemaIsStale, serviceClient } from '../_shared/auth.ts'

// Parolni tiklash/o'zgartirish: "parolni unutdim" email o'rniga superadmin yangilaydi.
// Autentikatsiya parolini faqat service role o'zgartiradi (bcrypt hash'i shu yerda qo'yiladi).
Deno.serve(async (request: Request) => {
  // CORS preflight: brauzer Authorization sarlavhasi bilan so'rov yuborishda avval shu keladi.
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Faqat POST so‘rovi qabul qilinadi.' }, 405)

  const caller = await requireSuperadmin(request)
  if (caller instanceof Response) return caller

  let input: Record<string, unknown>
  try { input = await request.json() } catch { return json({ error: 'JSON so‘rovi noto‘g‘ri.' }, 400) }

  const userId = String(input.userId ?? '').trim()
  const password = normalizePassword(input.password)
  if (!userId) return json({ error: 'Xodimni tanlang.' }, 400)
  const problem = passwordProblem(password)
  if (problem) return json({ error: problem }, 400)

  const admin = serviceClient()
  const { data: target, error: targetError } = await admin
    .from('users').select('id,login,full_name,is_superadmin').eq('id', userId).single()
  if (targetError) {
    if (schemaIsStale(targetError.message)) return json({ error: 'Server sxemasi eskirgan: supabase/schema.sql ni qayta ishga tushiring.' }, 500)
    return json({ error: 'Xodim topilmadi.' }, 404)
  }
  if (!target) return json({ error: 'Xodim topilmadi.' }, 404)

  const { error: authError } = await admin.auth.admin.updateUserById(userId, { password })
  if (authError) return json({ error: `Parolni yangilab bo‘lmadi: ${authError.message}` }, 400)

  const { error: updateError } = await admin.from('users')
    .update({ password_changed_at: new Date().toISOString() })
    .eq('id', userId)
  if (updateError) return json({ error: `Parol yangilandi, lekin vaqtni yozib bo‘lmadi: ${updateError.message}` }, 400)

  return json({ ok: true, login: target.login, fullName: target.full_name, isSuperadmin: target.is_superadmin === true })
})
