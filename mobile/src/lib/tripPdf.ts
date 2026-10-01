import { dateTime, displayId, number, tripCode } from '@/lib/format'
import { isAutoApproved, isPendingMonitoring, monitoringLabel } from '@/lib/monitoring'
import type { AppView } from '@/store'
import type { Trip } from '@/store/types'

// Reys varaqasi (PDF): web'dagi `tripPdf.js` bilan bir xil tarkib — asosiy ko'rsatkichlar,
// yuk va savdo tafsilotlari, monitoring, izoh, yuk fotosurati va imzo joylari.
// pdfmake o'rniga HTML → expo-print (tizimning o'z PDF dvigateli) ishlatiladi.

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))
const sum = (value: number) => `${Math.round(Number(value) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so‘m`

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

type Row = { label: string; value?: string; sub?: string; color?: string }
const section = (title: string, rows: Row[]) => {
  const visible = rows.filter((row) => row.value)
  if (!visible.length) return ''
  return `<table class="sec"><tr><th colspan="2">${esc(title)}</th></tr>${visible.map((row) =>
    `<tr><td class="l">${esc(row.label)}</td><td class="r"><b${row.color ? ` style="color:${row.color}"` : ''}>${esc(row.value)}</b>${row.sub ? `<div class="sub">${esc(row.sub)}</div>` : ''}</td></tr>`).join('')}</table>`
}

export async function buildTripHtml(trip: Trip, app: AppView): Promise<string> {
  let photo: string | null = null
  if (trip.photoPath) {
    try {
      const url = trip.photoUrl || await app.ensurePhotoUrl(trip)
      photo = url ? await toDataUrl(url) : null
    } catch { /* rasmsiz davom etamiz */ }
  }
  const code = tripCode(trip.id)
  const userName = (id?: string | null) => (id ? app.users.find((user) => user.id === id)?.fullName ?? '' : '')
  const vehicle = app.vehicles.find((item) => item.id === trip.vehicleId)
  const prices = app.canSeePrices
  const pending = isPendingMonitoring(trip)
  const auto = isAutoApproved(trip)

  const stats = [{ label: 'Og‘irlik', value: `${number(trip.weightTons, 1)} t`, primary: true }]
  if (prices) {
    stats.push({ label: 'Tonna narxi', value: sum(trip.unitPrice), primary: false })
    stats.push({ label: 'Reys qiymati', value: sum(trip.totalAmount), primary: false })
  }
  stats.push({ label: 'Ish vaqti', value: `${number(trip.hoursWorked, 1)} soat`, primary: false })

  const signature = (title: string, name: string) => `<div class="sig"><div class="line"></div><div class="cap">${esc(title)}</div><div class="nm">${esc(name) || '&nbsp;'}</div></div>`

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { margin: 28px 32px; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color:#17231D; font-size:12px; line-height:1.35; }
  .top { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0A4FA8; padding-bottom:12px; margin-bottom:14px; }
  .brand { font-size:19px; font-weight:800; color:#0A4FA8; } .brand small { display:block; font-size:8px; letter-spacing:1.4px; color:#6E7B8F; font-weight:600; margin-top:2px; }
  .doc { text-align:right; } .doc .t { font-size:9px; letter-spacing:1.4px; color:#6E7B8F; font-weight:700; } .doc .n { font-size:24px; font-weight:800; } .doc .d { color:#6E7B8F; }
  .stats { display:flex; gap:8px; margin-bottom:14px; } .stat { flex:1; background:#F5F7FB; border-radius:8px; padding:10px 12px; } .stat.p { background:#E6F1FF; }
  .stat .k { font-size:9px; font-weight:700; color:#6E7B8F; } .stat.p .k { color:#0A4FA8; } .stat .v { font-size:15px; font-weight:800; margin-top:3px; white-space:nowrap; }
  .cols { display:flex; gap:12px; align-items:flex-start; } .cols > * { flex:1; }
  table.sec { width:100%; border:1px solid #E7ECF3; border-radius:8px; border-collapse:separate; border-spacing:0; margin-bottom:12px; }
  table.sec th { background:#F5F7FB; text-align:left; font-size:8.5px; letter-spacing:.7px; color:#6E7B8F; padding:7px 10px; text-transform:uppercase; }
  table.sec td { padding:7px 10px; border-top:1px solid #E7ECF3; vertical-align:top; } td.l { color:#6E7B8F; } td.r { text-align:right; }
  .sub { font-size:10px; color:#6E7B8F; }
  .note { background:#F5F7FB; border-radius:8px; padding:9px 11px; margin-bottom:12px; } .note .k { font-size:8.5px; font-weight:700; letter-spacing:.7px; color:#6E7B8F; }
  .photo { page-break-inside:avoid; margin-top:6px; } .photo .k { font-size:8.5px; font-weight:700; letter-spacing:.7px; color:#6E7B8F; margin-bottom:6px; } .photo img { display:block; max-width:100%; max-height:300px; margin:0 auto; border-radius:8px; }
  .sigs { display:flex; gap:18px; margin-top:26px; page-break-inside:avoid; } .sig { flex:1; } .sig .line { border-top:1px solid #9AA6B6; margin-top:30px; margin-bottom:4px; } .sig .cap { font-size:9px; color:#6E7B8F; } .sig .nm { font-size:10px; font-weight:700; }
  .foot { margin-top:18px; font-size:9px; color:#6E7B8F; }
</style></head><body>
  <div class="top">
    <div class="brand">AliBuilding.uz<small>TEXNIKA BOSHQARUVI</small></div>
    <div class="doc"><div class="t">REYS VARAQASI</div><div class="n">№ ${esc(code)}</div><div class="d">${esc(dateTime(trip.createdAt))}</div></div>
  </div>
  <div class="stats">${stats.map((stat) => `<div class="stat${stat.primary ? ' p' : ''}"><div class="k">${esc(stat.label)}</div><div class="v">${esc(stat.value)}</div></div>`).join('')}</div>
  <div class="cols">
    <div>${section('Yuk va transport', [
      { label: 'Tosh turi', value: app.materialName(trip.materialId) },
      { label: 'Samosval', value: vehicle?.plate || '—', sub: vehicle?.model },
      { label: 'Haydovchi', value: app.driverName(trip.driverId) },
    ])}</div>
    <div>${section('Savdo', [
      { label: 'Mijoz', value: app.tripClient(trip) },
      { label: 'Savdo turi', value: trip.saleType === 'cash' ? 'Naqd savdo' : 'Qarzga' },
      { label: 'Kiritildi', value: dateTime(trip.createdAt), sub: userName(trip.createdBy) },
    ])}</div>
  </div>
  ${section('Monitoring', [
    { label: 'Holat', value: auto ? 'Avto tasdiqlangan' : monitoringLabel(trip), color: pending ? '#96621D' : '#0F7A4D' },
    { label: pending ? 'Bekor qilgan' : 'Tasdiqlagan', value: trip.monitoredAt && !auto ? userName(trip.monitoredBy) || '—' : '', sub: trip.monitoredAt && !auto ? dateTime(trip.monitoredAt) : '' },
    { label: 'Izoh', value: trip.monitoringNote },
  ])}
  ${trip.note ? `<div class="note"><div class="k">IZOH</div><div>${esc(trip.note)}</div></div>` : ''}
  ${photo ? `<div class="photo"><div class="k">YUK FOTOSURATI</div><img src="${photo}" /></div>` : ''}
  <div class="sigs">
    ${signature('Haydovchi', app.driverName(trip.driverId))}
    ${signature('Tarozi ustasi', userName(trip.createdBy))}
    ${signature('Qabul qildi (mijoz)', trip.clientId ? app.tripClient(trip) : '')}
  </div>
  <div class="foot">ID: ${esc(displayId(trip.id))} · Chop etildi: ${esc(dateTime(new Date()))}</div>
</body></html>`
}
