// Hermes (React Native) da `uz-UZ` Intl ma'lumoti kafolatlanmagan, shuning uchun
// raqamlarni qo'lda guruhlaymiz: 1500000 → "1 500 000" (har joyda bir xil chiqadi).
const groupDigits = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
const formatFixed = (value: number, maxDecimals: number, minDecimals = 0) => {
  const negative = value < 0
  const fixed = Math.abs(value).toFixed(maxDecimals)
  let [whole, fraction = ''] = fixed.split('.')
  while (fraction.length > minDecimals && fraction.endsWith('0')) fraction = fraction.slice(0, -1)
  const grouped = groupDigits(whole)
  const text = fraction ? `${grouped},${fraction}` : grouped
  return negative && Number(fixed) !== 0 ? `−${text}` : text
}

export const money = (value: number | null | undefined, { short = false, currency = true }: { short?: boolean; currency?: boolean } = {}) => {
  if (value === null || value === undefined) return '—'
  const amount = Number(value || 0)
  if (short && Math.abs(amount) >= 1_000_000) return `${formatFixed(amount / 1_000_000, 1)} mln${currency ? ' so‘m' : ''}`
  if (short && Math.abs(amount) >= 1_000) return `${formatFixed(amount / 1_000, 0)} ming${currency ? ' so‘m' : ''}`
  return `${formatFixed(amount, 0)}${currency ? ' so‘m' : ''}`
}

export const number = (value: unknown, decimals = 0) => formatFixed(Number(value || 0), decimals, decimals)

// ── Sana va vaqt: DD.MM.YYYY ────────────────────────────────────────────
// Butun tizimda bitta format: 01.02.2025. Vaqt qo'shilganda 01.02.2025 14:30.
// Intl o'rniga qo'lda yozamiz — aks holda brauzer/locale farqi turli xil
// chiqaradi (masalan 1 fev 2025 yoki 02/01/2025).
const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
const WEEKDAYS_SHORT = ['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha']
const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr']
const pad2 = (n: number) => String(n).padStart(2, '0')

// DD.MM.YYYY
export const dateOnly = (value?: string | number | Date | null) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`
}

// DD.MM.YYYY HH:MM
export const dateTime = (value?: string | number | Date | null) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${dateOnly(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

// DD.MM.YYYY HH:MM:SS
export const dateTimeSeconds = (value?: string | number | Date | null) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${dateOnly(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

// "Chorshanba, 01.02.2025" — haftaning kuni + DD.MM.YYYY
export const dateLong = (value: string | number | Date = new Date()) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${WEEKDAYS[d.getDay()]}, ${dateOnly(d)}`
}

// HH:MM — jadvaldagi birinchi qatorda sana ostidagi vaqt uchun.
export const timeOnly = (value?: string | number | Date | null) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

// "Sentyabr 2025" — oy sarlavhalari uchun (to'liq sana emas, oy nomi kerak).
export const monthYear = (value: string | number | Date = new Date()) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// "Du" — haftaning qisqa kuni (grafik o'qidagi uchun).
export const weekdayShort = (value: string | number | Date) => WEEKDAYS_SHORT[new Date(value).getDay()]

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'Q'

export const shortId = (value = '') => String(value).slice(-5).toUpperCase()

export const isToday = (value: string | number | Date) => {
  const date = new Date(value)
  const today = new Date()
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
}

// ── ID ko‘rinishi ──────────────────────────────────────────────────────────
// Ichki ID (UUID) saqlanib qoladi, UI da esa qisqa va tushunarli ko‘rinish.
// Demo rejimda: "T-abc123" → "T-abc123"
// Remote (UUID): "550e8400-e29b-41d4-a716-446655440000" → "550e8400"
export const displayId = (value = '', prefix = '') => {
  const raw = String(value)
  if (!raw) return '—'
  // Demo ID lari allaqachon qisqa (T-..., TX-..., C-... va h.k.)
  if (raw.includes('-') && !raw.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return raw
  }
  // UUID → birinchi 8 belgisi (yoki oxirgi 6 tasi)
  return `${prefix ? prefix + '-' : ''}${raw.slice(0, 8).toUpperCase()}`
}

// Reys ID dan qisqa kod: birinchi 6 ta alfanumerik belgi (UUID → "550E84").
// Kvitsiya va jadvaldagi "Reys → XXXXXX" linklari uchun.
export const tripCode = (value = '', length = 6) => {
  const raw = String(value).replace(/[^0-9a-z]/gi, '').slice(0, length).toUpperCase()
  return raw || '—'
}

export const isSameMonth = (value: string | number | Date) => {
  const date = new Date(value)
  const today = new Date()
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()
}

export const localDayKey = (value: string | number | Date) => {
  const d = new Date(value)
  return `${String(d.getFullYear()).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const greeting = () => {
  const hour = new Date().getHours()
  if (hour < 11) return 'Xayrli tong'
  if (hour < 17) return 'Xayrli kun'
  return 'Xayrli kech'
}

// ── Summa kiritish maydonlari ───────────────────────────────────────────
// Har 3 xonada bo'shliq: 1 500 000. Maydonda faqat raqam saqlanadi,
// boshida esa minus mumkin (mijozning manfiy boshlang'ich balansi uchun).
export const formatAmountInput = (value: unknown) => {
  const raw = String(value ?? '')
  const negative = raw.trim().startsWith('-')
  const digits = raw.replace(/\D/g, '')
  if (!digits) return negative ? '-' : ''
  const grouped = groupDigits(digits)
  return negative ? `-${grouped}` : grouped
}

// Kiritilgan matndan raqam oladi: "1 500 000" → 1500000.
export const parseAmountInput = (value: unknown) => {
  const raw = String(value ?? '').trim()
  const digits = raw.replace(/\D/g, '')
  if (!digits) return 0
  return raw.startsWith('-') ? -Number(digits) : Number(digits)
}
