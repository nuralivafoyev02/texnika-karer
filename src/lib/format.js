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

export const dateTime = (value, options = {}) => {
  if (!value) return '—'
  const date = new Date(value)
  return new Intl.DateTimeFormat('uz-UZ', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', ...options,
  }).format(date)
}

export const dateLong = (value = new Date()) => new Intl.DateTimeFormat('uz-UZ', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(value))

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'Q'

export const shortId = (value = '') => String(value).slice(-5).toUpperCase()

export const isToday = (value) => {
  const date = new Date(value)
  const today = new Date()
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
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
