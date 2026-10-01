// Edge Function va Postgres xatolarini foydalanuvchi tushunadigan xabarga aylantiradi
// (web `quarry.js` dagi mantiq bilan bir xil).
const SCHEMA_HINT = ' Server sxemasi eskirgan: supabase/migrations fayllarini qayta ishga tushiring.'
export const TX_SCHEMA_HINT = 'Bazada kvitansiya tahrirlash funksiyasi yo‘q: supabase/migrations/12_transaction_edit_delete.sql faylini SQL Editor’da ishga tushiring.'
export const isSchemaError = (message: string) => /column .* does not exist|schema cache|42703|PGRST204/i.test(message)
export { SCHEMA_HINT }

export const readFunctionError = async (name: string, error: any): Promise<string> => {
  if (error?.status === 404 || /not found/i.test(error?.message ?? '')) {
    return `${name} Edge Function deploy qilinmagan. Supabase CLI bilan: supabase functions deploy ${name}`
  }
  if (error?.name === 'FunctionsFetchError' || /failed to send a request/i.test(error?.message ?? '')) {
    return `${name} Edge Function javob bermadi (tarmoq xatosi). Internet aloqasini va funksiya deploy qilinganini tekshiring.`
  }
  let detail = ''
  try { detail = String((await error?.context?.json())?.error ?? '') } catch { detail = '' }
  const message = detail || error?.message || 'Serverga ulanishda xatolik.'
  return isSchemaError(message) ? `${message}${SCHEMA_HINT}` : message
}

// Postgres cheklov xatolari. Oddiy trigger xabarlari to'g'ridan-to'g'ri o'tadi.
export const readableDbError = (error: any, fallback: string): string => {
  const message = String(error?.message ?? '').trim()
  if (!message) return fallback
  if (error?.code === '23503' || /violates foreign key constraint/i.test(message)) {
    return 'Ushbu yozuv boshqa ma’lumotlar bilan bog‘langan — avval bog‘lanishlarni tozalash kerak.'
  }
  if (error?.code === '23505' || /duplicate key value/i.test(message)) return 'Bu nom allaqachon mavjud.'
  if (error?.code === '42501' || /row-level security/i.test(message)) return 'Bu amalni bajarish ruxsati yo‘q.'
  return message
}

// “Yoqilg‘i xarajati” → “yoqilgi_xarajati”: DB key talabi ^[a-z][a-z0-9_]{1,39}$.
export const slugify = (value: string): string => {
  const slug = String(value).toLowerCase().normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’'`´ʼ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!slug) return ''
  return (/^[a-z]/.test(slug) ? slug : `t_${slug}`).slice(0, 40)
}

// Reys summasi serverda `round(x, 2)` bilan hisoblanadi — oldindan ko'rsatish ham shunday.
export const round2 = (value: number) => Math.round(Number(value) * 100) / 100
export const safeFileName = (name = 'yuk.jpg') => name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100)
