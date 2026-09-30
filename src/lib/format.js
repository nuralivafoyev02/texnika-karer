export const money = (value, { short = false, currency = true } = {}) => {
  if (value === null) return '—'
  const amount = Number(value || 0)
  if (short && Math.abs(amount) >= 1_000_000) {
    const formatted = new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 1 }).format(amount / 1_000_000)
    return `${formatted} mln${currency ? ' so‘m' : ''}`
  }
  if (short && Math.abs(amount) >= 1_000) {
    const formatted = new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(amount / 1_000)
    return `${formatted} ming${currency ? ' so‘m' : ''}`
  }
  return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(amount)}${currency ? ' so‘m' : ''}`
}

export const number = (value, decimals = 0) => new Intl.NumberFormat('uz-UZ', {
  minimumFractionDigits: decimals,
  maximumFractionDigits: decimals,
}).format(Number(value || 0))

// ── Sana va vaqt: DD.MM.YYYY ────────────────────────────────────────────
// Butun tizimda bitta format: 01.02.2025. Vaqt qo'shilganda 01.02.2025 14:30.
// Intl o'rniga qo'lda yozamiz — aks holda brauzer/locale farqi turli xil
// chiqaradi (masalan 1 fev 2025 yoki 02/01/2025).
const pad2 = (n) => String(n).padStart(2, '0')

// DD.MM.YYYY
export const dateOnly = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`
}

// DD.MM.YYYY HH:MM
export const dateTime = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${dateOnly(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

// DD.MM.YYYY HH:MM:SS
export const dateTimeSeconds = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${dateOnly(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

// "Chorshanba, 01.02.2025" — haftaning kuni + DD.MM.YYYY
export const dateLong = (value = new Date()) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const weekday = new Intl.DateTimeFormat('uz-UZ', { weekday: 'long' }).format(d)
  return `${weekday}, ${dateOnly(d)}`
}

// HH:MM — jadvaldagi birinchi qatorda sana ostidagi vaqt uchun.
export const timeOnly = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

// "Sentyabr 2025" — oy sarlavhalari uchun (to'liq sana emas, oy nomi kerak).
export const monthYear = (value = new Date()) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const month = new Intl.DateTimeFormat('uz-UZ', { month: 'long' }).format(d)
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${d.getFullYear()}`
}

// "Du" — haftaning qisqa kuni (grafik o'qidagi uchun).
export const weekdayShort = (value) => new Intl.DateTimeFormat('uz-UZ', { weekday: 'short' })
  .format(new Date(value)).replace('.', '')

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'Q'

export const shortId = (value = '') => String(value).slice(-5).toUpperCase()

export const isToday = (value) => {
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

export const isSameMonth = (value) => {
  const date = new Date(value)
  const today = new Date()
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()
}

export const localDayKey = (value) => {
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
export const formatAmountInput = (value) => {
  const raw = String(value ?? '')
  const negative = raw.trim().startsWith('-')
  const digits = raw.replace(/\D/g, '')
  if (!digits) return negative ? '-' : ''
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return negative ? `-${grouped}` : grouped
}

// Kiritilgan matndan raqam oladi: "1 500 000" → 1500000.
export const parseAmountInput = (value) => {
  const raw = String(value ?? '').trim()
  const digits = raw.replace(/\D/g, '')
  if (!digits) return 0
  return raw.startsWith('-') ? -Number(digits) : Number(digits)
}

// Input hodisasi uchun: qiymatni formatlaydi, reaktiv holatni yangilaydi va
// kursor joyini saqlaydi — o'rtasidan tahrirlashda ham qulay bo'lsin.
export const captureAmountInput = (event, setValue) => {
  const el = event.target
  const caret = el.selectionStart ?? el.value.length
  const digitsBefore = el.value.slice(0, caret).replace(/\D/g, '').length
  const previous = el.value
  const next = formatAmountInput(previous)
  if (next !== previous) {
    el.value = next
    let pos = 0
    let seen = 0
    while (pos < next.length && seen < digitsBefore) {
      if (next[pos] >= '0' && next[pos] <= '9') seen += 1
      pos += 1
    }
    while (next[pos] === ' ') pos += 1
    try { el.setSelectionRange(pos, pos) } catch { /* kursor qayta o'rnatilmaydi */ }
  }
  setValue(next)
  return next
}
