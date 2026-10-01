import { dateTime, tripCode } from '@/lib/format'
import { isPendingMonitoring, monitoringLabel } from '@/lib/monitoring'
import type { AppView } from '@/store'
import type { Transaction } from '@/store/types'

// Kirim-chiqim jurnalini eksport qilish: CSV va PDF (web'dagi `export.js` ning mobil varianti).
// Excel (.xlsx) ni CSV o'rnini bosadi: Excel / Google Sheets CSV ni to'g'ridan-to'g'ri ochadi.

export const EXPORT_COLUMNS = [
  { key: 'index', label: '№', align: 'right' },
  { key: 'date', label: 'Sana' },
  { key: 'category', label: 'Turi' },
  { key: 'direction', label: 'Yo‘nalish' },
  { key: 'party', label: 'Mijoz / Xodim' },
  { key: 'note', label: 'Izoh' },
  { key: 'vehicle', label: 'Texnika' },
  { key: 'trip', label: 'Reys' },
  { key: 'method', label: 'Hisob' },
  { key: 'status', label: 'Holat' },
  { key: 'income', label: 'Kirim', money: true, align: 'right' },
  { key: 'expense', label: 'Chiqim', money: true, align: 'right' },
] as const

export type ExportRow = {
  id: string; pending: boolean; index: number; date: string; category: string; direction: string; party: string; note: string
  vehicle: string; trip: string; method: string; status: string; income: number | null; expense: number | null
}

// 1500000 → "1 500 000" (qurilma locale'iga bog'liq bo'lmasin).
export const formatSum = (value: number | null | undefined) => {
  if (value === null || value === undefined) return ''
  const rounded = Math.round(Number(value) || 0)
  return (rounded < 0 ? '−' : '') + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export function buildExportRows(transactions: Transaction[], app: AppView): ExportRow[] {
  return transactions.map((tx, index) => {
    const isIn = tx.direction === 'in'
    return {
      id: tx.id, pending: !isIn && isPendingMonitoring(tx), index: index + 1, date: dateTime(tx.createdAt),
      category: app.categoryLabel(tx.category), direction: isIn ? 'Kirim' : 'Chiqim',
      party: tx.clientId ? app.clientName(tx.clientId) : (tx.driverId ? app.driverName(tx.driverId) : ''),
      note: tx.note || '', vehicle: tx.vehicleId ? app.vehicleName(tx.vehicleId) : '', trip: tx.tripId ? tripCode(tx.tripId) : '',
      method: tx.paymentMethod === 'bank' ? 'Bank' : 'Naqd', status: isIn ? '' : monitoringLabel(tx),
      income: isIn ? Number(tx.amount || 0) : null, expense: isIn ? null : Number(tx.amount || 0),
    }
  })
}

export function exportTotals(rows: ExportRow[]) {
  const income = rows.reduce((sum, row) => sum + (row.income || 0), 0)
  const expense = rows.reduce((sum, row) => sum + (row.expense || 0), 0)
  return { count: rows.length, income, expense, net: income - expense }
}

export const isoDay = (value: string | number | Date = new Date()) => {
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function toCsv(rows: ExportRow[]): string {
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const lines = [EXPORT_COLUMNS.map((column) => escape(column.label)).join(',')]
  for (const row of rows) lines.push(EXPORT_COLUMNS.map((column) => escape(row[column.key])).join(','))
  // BOM: Excel UTF-8 ni to'g'ri taniydi.
  return `﻿${lines.join('\n')}`
}

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))

export function buildJournalHtml(rows: ExportRow[], meta: { title: string; subtitle: string }): string {
  const totals = exportTotals(rows)
  const cell = (label: string, value: string, color = '#17231D') => `<div class="c"><div class="k">${esc(label)}</div><div class="v" style="color:${color}">${esc(value)}</div></div>`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { size: A4 landscape; margin: 20px 24px; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color:#17231D; font-size:9px; }
  h1 { font-size:16px; margin:0; } .sub { color:#6E7B8F; margin:3px 0 10px; }
  .sum { display:flex; background:#F5F7FB; border:1px solid #E7ECF3; margin-bottom:10px; } .c { flex:1; padding:7px 10px; } .k { color:#6E7B8F; font-size:8px; } .v { font-size:12px; font-weight:700; margin-top:2px; }
  table { width:100%; border-collapse:collapse; } th { background:#0A4FA8; color:#fff; text-align:left; padding:5px; font-size:8px; } td { padding:4px 5px; border-bottom:1px solid #E7ECF3; vertical-align:top; }
  tr:nth-child(even) td { background:#F8FAFD; } .r { text-align:right; white-space:nowrap; font-weight:700; } .in { color:#0F7A4D; } .out { color:#B36E35; } .pend { color:#96621D; font-weight:700; }
  tfoot td { background:#E6F1FF !important; font-weight:700; }
</style></head><body>
  <h1>${esc(meta.title)}</h1><div class="sub">${esc(meta.subtitle)}</div>
  <div class="sum">${cell('Yozuvlar', `${totals.count} ta`)}${cell('Jami kirim', `${formatSum(totals.income)} so‘m`, '#0F7A4D')}${cell('Jami chiqim', `${formatSum(totals.expense)} so‘m`, '#B36E35')}${cell('Farq', `${formatSum(totals.net)} so‘m`)}</div>
  <table><thead><tr>${EXPORT_COLUMNS.map((column) => `<th${'align' in column ? ' style="text-align:right"' : ''}>${esc(column.label)}</th>`).join('')}</tr></thead><tbody>
  ${rows.map((row) => `<tr>${EXPORT_COLUMNS.map((column) => {
    const value = row[column.key]
    if (column.key === 'income') return `<td class="r in">${esc(formatSum(row.income))}</td>`
    if (column.key === 'expense') return `<td class="r out">${esc(formatSum(row.expense))}</td>`
    if (column.key === 'status' && row.pending) return `<td class="pend">${esc(value)}</td>`
    return `<td${'align' in column ? ' style="text-align:right"' : ''}>${esc(value)}</td>`
  }).join('')}</tr>`).join('')}
  </tbody><tfoot><tr><td colspan="10">Jami</td><td class="r">${esc(formatSum(totals.income))}</td><td class="r">${esc(formatSum(totals.expense))}</td></tr></tfoot></table>
</body></html>`
}
