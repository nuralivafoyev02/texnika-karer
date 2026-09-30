import { dateOnly, dateTime, tripCode } from './format'
import { isPendingMonitoring, monitoringLabel } from './monitoring'

// ── Kirim-chiqim jurnalini eksport qilish: CSV, Excel (.xlsx), PDF ──────────
// Excel va PDF kutubxonalari og'ir, shuning uchun faqat tugma bosilganda
// yuklanadi (dynamic import) — asosiy sahifa tezligiga ta'sir qilmaydi.

export const EXPORT_COLUMNS = [
  { key: 'index', label: '№', width: 6, pdfWidth: 20, align: 'right' },
  { key: 'date', label: 'Sana', width: 17, pdfWidth: 'auto' },
  { key: 'category', label: 'Turi', width: 20, pdfWidth: 'auto' },
  { key: 'direction', label: 'Yo‘nalish', width: 10, pdfWidth: 'auto' },
  { key: 'party', label: 'Mijoz / Xodim', width: 26, pdfWidth: '*' },
  { key: 'note', label: 'Izoh', width: 30, pdfWidth: '*' },
  { key: 'vehicle', label: 'Texnika', width: 22, pdfWidth: 'auto' },
  { key: 'trip', label: 'Reys', width: 10, pdfWidth: 'auto' },
  { key: 'method', label: 'Hisob', width: 9, pdfWidth: 'auto' },
  { key: 'status', label: 'Holat', width: 13, pdfWidth: 'auto' },
  { key: 'income', label: 'Kirim', width: 16, pdfWidth: 'auto', money: true, align: 'right' },
  { key: 'expense', label: 'Chiqim', width: 16, pdfWidth: 'auto', money: true, align: 'right' },
]

// 1500000 → "1 500 000" (brauzer locale'iga bog'liq bo'lmasin).
export const formatSum = (value) => {
  if (value === null || value === undefined || value === '') return ''
  const rounded = Math.round(Number(value) || 0)
  const sign = rounded < 0 ? '−' : ''
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// Jurnal yozuvlarini eksport qatorlariga aylantiradi (barcha formatlar uchun bitta manba).
export function buildExportRows(transactions, store) {
  return transactions.map((tx, index) => {
    const isIn = tx.direction === 'in'
    const party = tx.clientId ? store.clientName(tx.clientId) : (tx.driverId ? store.driverName(tx.driverId) : '')
    return {
      id: tx.id,
      createdAt: tx.createdAt,
      pending: !isIn && isPendingMonitoring(tx),
      index: index + 1,
      date: dateTime(tx.createdAt),
      category: store.categoryLabel(tx.category),
      direction: isIn ? 'Kirim' : 'Chiqim',
      party,
      note: tx.note || '',
      vehicle: tx.vehicleId ? store.vehicleName(tx.vehicleId) : '',
      trip: tx.tripId ? tripCode(tx.tripId) : '',
      method: tx.paymentMethod === 'bank' ? 'Bank' : 'Naqd',
      status: isIn ? '' : monitoringLabel(tx),
      income: isIn ? Number(tx.amount || 0) : null,
      expense: isIn ? null : Number(tx.amount || 0),
    }
  })
}

export function exportTotals(rows) {
  const income = rows.reduce((sum, row) => sum + (row.income || 0), 0)
  const expense = rows.reduce((sum, row) => sum + (row.expense || 0), 0)
  const pendingExpense = rows.filter((row) => row.pending).reduce((sum, row) => sum + (row.expense || 0), 0)
  return { count: rows.length, income, expense, pendingExpense, net: income - expense }
}

const pad2 = (n) => String(n).padStart(2, '0')
const isoDay = (value = new Date()) => {
  const d = new Date(value)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
export const exportFileName = (meta, extension) => `kirim-chiqim_${meta.fileSuffix || isoDay()}.${extension}`

function triggerDownload(blob, fileName) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

// ── CSV ─────────────────────────────────────────────────────────────────────
export function downloadCsv(rows, columns, meta) {
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const lines = [columns.map((column) => escape(column.label)).join(',')]
  for (const row of rows) lines.push(columns.map((column) => escape(column.money ? (row[column.key] ?? '') : row[column.key])).join(','))
  triggerDownload(new Blob(['﻿', lines.join('\n')], { type: 'text/csv;charset=utf-8' }), exportFileName(meta, 'csv'))
}

// ── Excel (.xlsx) ───────────────────────────────────────────────────────────
export async function downloadXlsx(rows, columns, meta) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const span = columns.length
  const padded = (cell) => [cell, ...Array(Math.max(0, span - 1)).fill(null)]
  const header = columns.map((column) => ({
    value: column.label, fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: '#0A4FA8',
    align: column.align || 'left', alignVertical: 'center', height: 22,
  }))
  const body = rows.map((row) => columns.map((column) => {
    const value = row[column.key]
    if (column.money) return value === null ? null : { value, type: Number, format: '#,##0', align: 'right' }
    if (column.key === 'index') return { value, type: Number, align: 'right' }
    if (column.key === 'status' && row.pending) return { value, type: String, textColor: '#96621D' }
    return { value: String(value ?? ''), type: String }
  }))
  const totals = exportTotals(rows)
  const totalRow = (label, key, amount) => columns.map((column, index) => {
    if (index === 0) return { value: label, fontWeight: 'bold' }
    if (column.key === key) return { value: amount, type: Number, format: '#,##0', fontWeight: 'bold', align: 'right' }
    return null
  })
  const hasIncome = columns.some((column) => column.key === 'income')
  const hasExpense = columns.some((column) => column.key === 'expense')
  const data = [
    padded({ value: meta.title, fontWeight: 'bold', fontSize: 14, height: 24 }),
    padded({ value: meta.subtitle, textColor: '#6E7B8F' }),
    padded(null),
    header,
    ...body,
  ]
  if (hasIncome || hasExpense) {
    data.push(columns.map(() => null))
    if (hasIncome && hasExpense) {
      const row = totalRow('Jami', 'income', totals.income)
      const expenseIndex = columns.findIndex((column) => column.key === 'expense')
      row[expenseIndex] = { value: totals.expense, type: Number, format: '#,##0', fontWeight: 'bold', align: 'right' }
      data.push(row)
      data.push(padded({ value: `Farq (kirim − chiqim): ${formatSum(totals.net)} so‘m`, fontWeight: 'bold' }))
    } else {
      data.push(totalRow('Jami', hasIncome ? 'income' : 'expense', hasIncome ? totals.income : totals.expense))
    }
  }
  // columnSpan'li katak: sarlavha qatorlari butun jadval kengligini egallaydi.
  data[0][0].columnSpan = span
  data[1][0].columnSpan = span
  await writeXlsxFile(data, {
    sheet: 'Kirim-chiqim',
    columns: columns.map((column) => ({ width: column.width })),
    stickyRowsCount: 4,
    orientation: 'landscape',
  }).toFile(exportFileName(meta, 'xlsx'))
}

// ── PDF ─────────────────────────────────────────────────────────────────────
// pdfmake + faqat kerakli 2 ta Roboto shrifti (oddiy va qalin).
export async function loadPdfMake() {
  const [{ default: pdfMake }, { default: regularUrl }, { default: mediumUrl }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/fonts/Roboto/Roboto-Regular.ttf?url'),
    import('pdfmake/build/fonts/Roboto/Roboto-Medium.ttf?url'),
  ])
  // To'liq vfs_fonts (4 ta shrift, ~850 KB JS) o'rniga faqat kerakli 2 ta TTF
  // alohida fayl sifatida olinadi va brauzer keshida qoladi.
  const absolute = (url) => new URL(url, window.location.href).href
  pdfMake.setUrlAccessPolicy((url) => url.startsWith(window.location.origin))
  pdfMake.setFonts({
    Roboto: { normal: absolute(regularUrl), bold: absolute(mediumUrl), italics: absolute(regularUrl), bolditalics: absolute(mediumUrl) },
  })
  return pdfMake
}

export async function downloadPdf(rows, columns, meta) {
  const pdfMake = await loadPdfMake()
  const totals = exportTotals(rows)
  const tableBody = [
    columns.map((column) => ({ text: column.label, style: 'th', alignment: column.align || 'left' })),
    ...rows.map((row) => columns.map((column) => {
      const value = row[column.key]
      if (column.money) {
        return { text: value === null ? '' : formatSum(value), alignment: 'right', bold: true, noWrap: true, color: column.key === 'income' ? '#0F7A4D' : '#B36E35' }
      }
      if (column.key === 'status' && row.pending) return { text: value, color: '#96621D', bold: true }
      return { text: String(value ?? ''), alignment: column.align || 'left', noWrap: column.key === 'date' }
    })),
  ]
  const hasIncome = columns.some((column) => column.key === 'income')
  const hasExpense = columns.some((column) => column.key === 'expense')
  if (hasIncome || hasExpense) {
    tableBody.push(columns.map((column, index) => {
      if (index === 0) return { text: 'Jami', bold: true }
      if (column.key === 'income') return { text: formatSum(totals.income), alignment: 'right', bold: true }
      if (column.key === 'expense') return { text: formatSum(totals.expense), alignment: 'right', bold: true }
      return { text: '' }
    }))
  }
  const summaryCell = (label, value, color = '#17231D') => ({
    stack: [{ text: label, fontSize: 8, color: '#6E7B8F' }, { text: value, fontSize: 12, bold: true, color, margin: [0, 2, 0, 0] }],
    margin: [8, 6, 8, 6],
  })
  const doc = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [28, 28, 28, 34],
    info: { title: meta.title },
    defaultStyle: { fontSize: 8, color: '#17231D' },
    styles: { th: { bold: true, color: '#FFFFFF', fontSize: 8 } },
    footer: (current, total) => ({
      columns: [
        { text: meta.brand, color: '#6E7B8F', fontSize: 7 },
        { text: `${current} / ${total}`, alignment: 'right', color: '#6E7B8F', fontSize: 7 },
      ],
      margin: [28, 10, 28, 0],
    }),
    content: [
      { text: meta.title, fontSize: 15, bold: true },
      { text: meta.subtitle, color: '#6E7B8F', margin: [0, 3, 0, 10] },
      {
        table: {
          widths: ['*', '*', '*', '*'],
          body: [[
            summaryCell('Yozuvlar', `${totals.count} ta`),
            summaryCell('Jami kirim', `${formatSum(totals.income)} so‘m`, '#0F7A4D'),
            summaryCell('Jami chiqim', `${formatSum(totals.expense)} so‘m`, '#B36E35'),
            summaryCell('Farq', `${formatSum(totals.net)} so‘m`),
          ]],
        },
        layout: { hLineColor: () => '#E7ECF3', vLineColor: () => '#E7ECF3', fillColor: () => '#F5F7FB' },
        margin: [0, 0, 0, 12],
      },
      {
        table: { headerRows: 1, widths: columns.map((column) => column.pdfWidth || 'auto'), body: tableBody },
        layout: {
          fillColor: (rowIndex) => (rowIndex === 0 ? '#0A4FA8' : rowIndex === tableBody.length - 1 && (hasIncome || hasExpense) ? '#E6F1FF' : rowIndex % 2 === 0 ? '#F8FAFD' : null),
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0 : 0.5),
          vLineWidth: () => 0,
          hLineColor: () => '#E7ECF3',
          paddingTop: () => 4, paddingBottom: () => 4, paddingLeft: () => 5, paddingRight: () => 5,
        },
      },
    ],
  }
  await pdfMake.createPdf(doc).download(exportFileName(meta, 'pdf'))
}

export { isoDay, dateOnly }
