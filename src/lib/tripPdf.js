import { loadPdfMake, formatSum, isoDay } from './export'
import { dateTime, number, tripCode, displayId } from './format'
import { isAutoApproved, isPendingMonitoring, monitoringLabel } from './monitoring'

// ── Reys varaqasi (PDF) ─────────────────────────────────────────────────────
// Bitta reys uchun chop etishga tayyor hujjat: asosiy ko'rsatkichlar, yuk va
// savdo tafsilotlari, monitoring, izoh, yuk fotosurati va imzo joylari.

const INK = '#17231D'
const MUTED = '#6E7B8F'
const LINE = '#E7ECF3'
const BRAND = '#0A4FA8'
const PAGE_WIDTH = 515 // A4 (595pt) − 2 × 40pt chekka

// Rasmni PDF uchun JPEG dataURL'ga aylantiradi (pdfmake faqat JPEG/PNG qabul qiladi),
// katta suratlar 1400px gacha kichraytiriladi. Xato bo'lsa — rasmsiz davom etamiz.
async function imageToDataUrl(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const bitmap = await createImageBitmap(await response.blob())
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  } catch {
    return null
  }
}

const sectionLayout = {
  hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0.8 : 0.5),
  vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length ? 0.8 : 0),
  hLineColor: () => LINE,
  vLineColor: () => LINE,
  paddingLeft: () => 9, paddingRight: () => 9, paddingTop: () => 6, paddingBottom: () => 6,
}

function section(title, rows) {
  const visible = rows.filter((row) => row && row.value !== undefined && row.value !== null && row.value !== '')
  if (!visible.length) return null
  return {
    table: {
      widths: ['auto', '*'],
      body: [
        [{ text: title.toUpperCase(), colSpan: 2, fontSize: 7.5, bold: true, color: MUTED, characterSpacing: 0.6, fillColor: '#F5F7FB' }, {}],
        ...visible.map((row) => [
          { text: row.label, color: MUTED },
          { stack: [{ text: String(row.value), bold: true, color: row.color || INK }, ...(row.sub ? [{ text: row.sub, fontSize: 8, color: MUTED }] : [])], alignment: 'right' },
        ]),
      ],
    },
    layout: sectionLayout,
  }
}

export async function downloadTripPdf(trip, store) {
  if (!trip) return
  if (store.hasPhoto(trip) && !trip.photoUrl && store.remoteMode) {
    try { await store.ensurePhotoUrl(trip) } catch { /* rasmsiz davom etamiz */ }
  }
  const [pdfMake, photo] = await Promise.all([
    loadPdfMake(),
    trip.photoUrl ? imageToDataUrl(trip.photoUrl) : Promise.resolve(null),
  ])

  const code = tripCode(trip.id)
  const userName = (id) => (id ? store.users.find((user) => user.id === id)?.fullName ?? '' : '')
  const vehicle = store.vehicles.find((item) => item.id === trip.vehicleId)
  const prices = store.canSeePrices
  const isCash = trip.saleType === 'cash'
  const pending = isPendingMonitoring(trip)
  const auto = isAutoApproved(trip)

  // ── Asosiy ko'rsatkichlar ────────────────────────────────────────────────
  const stats = [{ label: 'Og‘irlik', value: `${number(trip.weightTons, 1)} t` }]
  if (prices) {
    stats.push({ label: 'Tonna narxi', value: `${formatSum(trip.unitPrice)} so‘m` })
    stats.push({ label: 'Reys qiymati', value: `${formatSum(trip.totalAmount)} so‘m` })
  }
  stats.push({ label: 'Ish vaqti', value: `${number(trip.hoursWorked, 1)} soat` })
  const statsTable = {
    table: {
      widths: stats.map(() => '*'),
      body: [stats.map((stat, index) => ({
        stack: [
          { text: stat.label, fontSize: 8, color: index === 0 ? BRAND : MUTED, bold: true },
          { text: stat.value, fontSize: stats.length > 3 ? 13 : 15, bold: true, noWrap: true, color: index === 0 ? BRAND : INK, margin: [0, 3, 0, 0] },
        ],
        fillColor: index === 0 ? '#E6F1FF' : '#F5F7FB',
        margin: [10, 9, 10, 9],
      }))],
    },
    layout: { hLineWidth: () => 0, vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length ? 0 : 6), vLineColor: () => '#FFFFFF' },
  }

  const cargo = section('Yuk va transport', [
    { label: 'Tosh turi', value: store.materialName(trip.materialId) },
    { label: 'Samosval', value: vehicle?.plate || '—', sub: vehicle?.model },
    { label: 'Haydovchi', value: store.driverName(trip.driverId) },
  ])
  const sale = section('Savdo', [
    { label: 'Mijoz', value: store.tripClient(trip) },
    { label: 'Savdo turi', value: isCash ? 'Naqd savdo' : 'Qarzga' },
    { label: 'Kiritildi', value: dateTime(trip.createdAt), sub: userName(trip.createdBy) },
  ])
  const monitoring = section('Monitoring', [
    { label: 'Holat', value: auto ? 'Avto tasdiqlangan' : monitoringLabel(trip), color: pending ? '#96621D' : '#0F7A4D' },
    { label: pending ? 'Bekor qilgan' : 'Tasdiqlagan', value: trip.monitoredAt && !auto ? userName(trip.monitoredBy) || '—' : '', sub: trip.monitoredAt && !auto ? dateTime(trip.monitoredAt) : '' },
    { label: 'Izoh', value: trip.monitoringNote },
  ])

  const signature = (title, name) => ({
    stack: [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.8, lineColor: '#9AA6B6' }], margin: [0, 28, 0, 4] },
      { text: title, fontSize: 8, color: MUTED },
      { text: name || ' ', fontSize: 9, bold: true },
    ],
  })

  const content = [
    {
      columns: [
        { stack: [{ text: 'AliBuilding.uz', bold: true, fontSize: 15, color: BRAND }, { text: 'TEXNIKA BOSHQARUVI', fontSize: 7, color: MUTED, characterSpacing: 1.2, margin: [0, 2, 0, 0] }] },
        {
          stack: [
            { text: 'REYS VARAQASI', bold: true, fontSize: 8, color: MUTED, characterSpacing: 1.2 },
            { text: `№ ${code}`, bold: true, fontSize: 20, margin: [0, 1, 0, 0] },
            { text: dateTime(trip.createdAt), color: MUTED },
          ],
          alignment: 'right',
        },
      ],
    },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: PAGE_WIDTH, y2: 0, lineWidth: 1.5, lineColor: BRAND }], margin: [0, 12, 0, 14] },
    statsTable,
    { columns: [cargo || { text: '' }, sale || { text: '' }], columnGap: 12, margin: [0, 14, 0, 0] },
  ]
  if (monitoring) content.push({ ...monitoring, margin: [0, 12, 0, 0] })
  if (trip.note) {
    content.push({
      table: { widths: ['*'], body: [[{ stack: [{ text: 'IZOH', fontSize: 7.5, bold: true, color: MUTED, characterSpacing: 0.6 }, { text: trip.note, margin: [0, 3, 0, 0] }], fillColor: '#F5F7FB', margin: [9, 7, 9, 7] }]] },
      layout: 'noBorders',
      margin: [0, 12, 0, 0],
    })
  }
  if (photo) {
    content.push({
      unbreakable: true,
      stack: [
        { text: 'YUK FOTOSURATI', fontSize: 7.5, bold: true, color: MUTED, characterSpacing: 0.6, margin: [0, 14, 0, 6] },
        { image: photo, fit: [PAGE_WIDTH, 250], alignment: 'center' },
      ],
    })
  }
  content.push({
    unbreakable: true,
    columns: [
      signature('Haydovchi', store.driverName(trip.driverId)),
      signature('Tarozi ustasi', userName(trip.createdBy)),
      signature('Qabul qildi (mijoz)', trip.clientId ? store.tripClient(trip) : ''),
    ],
    columnGap: 18,
    margin: [0, 18, 0, 0],
  })

  const doc = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 48],
    info: { title: `Reys ${code}` },
    defaultStyle: { fontSize: 9.5, color: INK, lineHeight: 1.15 },
    footer: (current, total) => ({
      columns: [
        { text: `ID: ${displayId(trip.id)} · Chop etildi: ${dateTime(new Date())}`, fontSize: 7, color: MUTED },
        { text: `${current} / ${total}`, alignment: 'right', fontSize: 7, color: MUTED },
      ],
      margin: [40, 16, 40, 0],
    }),
    content,
  }
  await pdfMake.createPdf(doc).download(`reys_${code}_${isoDay(trip.createdAt)}.pdf`)
}
