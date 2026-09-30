// ── Monitoring holati (bo'limlar, store va jadvallar uchun umumiy yordamchilar) ──
// 'pending' — monitoring tasdiqlashini kutilmoqda; moliyaviy hisobga KIRMAYDI.
//
// Ikki xil shakl qo'llab-quvvatlanadi:
//   • xom DB qatori / realtime payload — snake_case `monitoring_status`;
//   • mapTrip/mapTransaction dan o'tgan obyekt — camelCase `monitoringStatus`.
// Faqat camelCase ga qaraganda xato tahlil qilindi: remote rejida har bir yangi reys
// (hatto 'pending' yozilganda ham) "tasdiqlangan" bo'lib ko'rinardi — sababi xom
// qatorda `monitoringStatus` undefined edi. Shu sababli avval snake qidiriladi.
//
// Eski sxema (ustun hali qo'shilmagan) yoki eski demo nusxasida qiymat `undefined`
// bo'ladi — uni tasdiqlangan deb olamiz, aks holda migratsiyadan oldingi ma'lumotlar
// balanslardan butunlay chiqib qolardi.
const monitoringStatusOf = (row) => row?.monitoring_status ?? row?.monitoringStatus
export const isPendingMonitoring = (row) => monitoringStatusOf(row) === 'pending'
export const isApprovedMonitoring = (row) => !isPendingMonitoring(row)
// Moliyaviy hisobga kirish sharti: tasdiqlangan bo'lishi kerak.
export const affectsFinance = (row) => isApprovedMonitoring(row)

export const MONITORING_LABELS = { pending: 'Kutilmoqda', approved: 'Tasdiqlangan' }
export const monitoringStatus = (row) => (isPendingMonitoring(row) ? 'pending' : 'approved')
export const monitoringLabel = (row) => MONITORING_LABELS[monitoringStatus(row)]
export const monitoringTagClass = (row) => (isPendingMonitoring(row) ? 'tag-warn' : 'tag-leaf')

// `trips.auto_approve` ruxsati bilan kiritilgan reys monitoringdan o‘tmaydi:
// server trigger uni INSERT paytida tasdiqlaydi, ya'ni `monitored_at` ≈ `created_at`.
// Monitoring bo‘limidan tasdiqlangan reysda esa bu oraliq katta bo‘ladi.
export const isAutoApproved = (row) => {
  if (isPendingMonitoring(row)) return false
  if (!row?.monitoredAt || !row?.createdAt) return false
  const monitored = new Date(row.monitoredAt).getTime()
  const created = new Date(row.createdAt).getTime()
  if (Number.isNaN(monitored) || Number.isNaN(created)) return false
  return Math.abs(monitored - created) < 60_000
}
