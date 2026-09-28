// ── Telefon raqam kiritish va ko'rsatish ──────────────────────────────────
// O'zbekiston raqamlari: +998 XX XXX XX XX
//   +998 — mamlakat kodi, keyin 9 ta raqam: operator kodi (2) + 3 + 2 + 2.
//
// `+998` maydonga MATN qilib yozilmaydi — u `PhoneField` komponentida maydon
// chapida doimiy ko'rinadigan qism. Sababi: agar prefiks matn bo'lsa, foydalanuvchi
// to'liq raqamni (`+998901234567`) yozganda `998` ikki marta bo'lib ketardi —
// birinchi belgi yozilishi bilan maydon allaqach `+998` ko'rsatadi, keyingi
// "998" esa milliy raqamning boshiga tushib qolardi. Shu sababli maydonda faqat
// milliy qism turadi: "90 123 45 67".

const UZ_CODE = '998'
const NATIONAL_LENGTH = 9
export const PHONE_MAX_LENGTH = 12 // "90 123 45 67" — eng uzun ko'rinish

// Kiritilgan matndan milliy (998'siz) raqamlarni oladi, 9 tadan ko'pini kesib
// tashlaydi.
//
// Boshdagi `998` mamlakat kodi deb qaraladi, agar foydalanuvchi uni qo'lda
// yozgan bo'lsa (`+998…` — `+` belgisi xalqaro yozuvni aniq bildiradi) yoki
// raqamlar 9 tadan ko'p bo'lsa (to'liq raqam nusxalangan: 12 ta raqam).
// Aks holda `998` milliy raqamning o'zi bo'lib qoladi: operator kodi `99` +
// keyingi raqam `8` — ya'ni `+998 99 8xx xx xx` shunday raqamlar bor.
//
// Maydon matni hech qachon `+` bilan boshlanmaydi (prefiks alohida ko'rsatiladi),
// shuning uchun bu qoida kiritish paytida xarakterga ta'sir qilmaydi.
export const nationalDigits = (value) => {
  const text = String(value ?? '')
  const digits = text.replace(/\D/g, '')
  const isCountryCode = digits.startsWith(UZ_CODE)
    && (text.trim().startsWith('+') || digits.length > NATIONAL_LENGTH)
  const body = isCountryCode ? digits.slice(UZ_CODE.length) : digits
  return body.slice(0, NATIONAL_LENGTH)
}

// Milliy qismni guruhlarga ajratadi: 901234567 → "90 123 45 67".
export const formatNational = (value) => {
  const body = nationalDigits(value)
  if (!body) return ''
  return [
    body.slice(0, 2),
    body.slice(2, 5),
    body.slice(5, 7),
    body.slice(7, 9),
  ].filter(Boolean).join(' ')
}

// To'liq raqamni ko'rsatish/saqlash shakli: 901234567 → "+998 90 123 45 67".
// Allaqach to'liq yoki milliy qiymatni ham qabul qiladi.
export const formatPhone = (value) => {
  const national = formatNational(value)
  return national ? `+${UZ_CODE} ${national}` : ''
}

// Xatolik matni yoki bo'sh satr (raqam to'liq va to'g'ri bo'lsa).
export const phoneProblem = (value) => {
  const text = String(value ?? '')
  if (!formatNational(text)) {
    return String(value ?? '').trim() ? 'Telefon raqamini kiriting.' : ''
  }
  const digits = text.replace(/\D/g, '')
  if (digits.length > UZ_CODE.length + NATIONAL_LENGTH) {
    return `Telefon raqami ${UZ_CODE.length + NATIONAL_LENGTH} ta raqamdan oshmasligi kerak.`
  }
  const missing = NATIONAL_LENGTH - nationalDigits(text).length
  if (missing > 0) return `Raqam yana ${missing} ta raqamga to‘ldirilishi kerak.`
  return ''
}

export const isCompletePhone = (value) => Boolean(nationalDigits(value).length) && phoneProblem(value) === ''

// `tel:` havolasi uchun — bo'shliqsiz shakl. Aks holda `tel:+998 90 123 45 67`
// buzilgan havola bo'ladi.
export const phoneHref = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits ? `tel:+${digits}` : ''
}

// Input hodisasi uchun: qiymatni formatlaydi, reaktiv holatni yangilaydi va
// kursor joyini saqlaydi — o'rtasidan tahrirlashda ham qulay bo'lsin.
export const capturePhoneInput = (event, setValue) => {
  const el = event.target
  const caret = el.selectionStart ?? el.value.length
  // Kursorda oldingi milliy raqamlar soni (mamlakat kodi hisobga olinmaydi).
  const bodyBefore = nationalDigits(el.value.slice(0, caret)).length
  const previous = el.value
  const next = formatNational(previous)

  if (next !== previous) {
    el.value = next
    // Kursor kiritilgan yangi raqamdan keyingi joyda turishi kerak.
    let pos = 0
    let seen = 0
    const target = bodyBefore + 1
    while (pos < next.length && seen < target) {
      if (next[pos] >= '0' && next[pos] <= '9') seen += 1
      pos += 1
    }
    while (next[pos] === ' ') pos += 1
    try { el.setSelectionRange(pos, pos) } catch { /* kursor qayta o'rnatilmaydi */ }
  }
  setValue(next)
  return next
}
