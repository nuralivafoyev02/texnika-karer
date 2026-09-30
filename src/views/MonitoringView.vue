<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ClipboardCheck, Search, CircleCheck, CircleAlert, WalletCards, Coins, Undo2, Check, StickyNote } from 'lucide-vue-next'
import ModalDialog from '../components/ModalDialog.vue'
import PreviewSection from '../components/PreviewSection.vue'
import { useQuarryStore } from '../stores/quarry'
import { dateOnly, dateTime, timeOnly, money, number, tripCode } from '../lib/format'
import { isAutoApproved, isPendingMonitoring, monitoringLabel, monitoringTagClass } from '../lib/monitoring'

const store = useQuarryStore()
const route = useRoute()
const tab = ref('trips')
// Holat filtri: navbatdagi (kutilayotgan) yozuvlar asosiy ko'rinish; tasdiqlanganlari
// arxiv — u yerdan tasdiqlashni bekor qilish mumkin.
const status = ref('pending')
const search = ref('')
const selected = ref(null)
const note = ref('')
const saving = ref(false)
const matchStatus = (row) => status.value === 'all' || (status.value === 'pending' ? isPendingMonitoring(row) : !isPendingMonitoring(row))
const trips = computed(() => {
  const query = search.value.trim().toLowerCase()
  return store.trips.filter((trip) => matchStatus(trip) && (!query || [trip.id, store.tripClient(trip), store.vehicleName(trip.vehicleId), store.driverName(trip.driverId), store.materialName(trip.materialId), trip.note]
    .join(' ').toLowerCase().includes(query)))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})
const expenses = computed(() => {
  const query = search.value.trim().toLowerCase()
  return store.transactions.filter((tx) => tx.direction === 'out' && matchStatus(tx) && (!query || [tx.note, store.categoryLabel(tx.category), store.vehicleName(tx.vehicleId), store.driverName(tx.driverId)]
    .join(' ').toLowerCase().includes(query)))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})
const pendingTons = computed(() => store.pendingTrips.reduce((sum, trip) => sum + Number(trip.weightTons || 0), 0))
const archivedTrips = computed(() => store.trips.filter((trip) => !isPendingMonitoring(trip)).length)
const archivedExpenses = computed(() => store.transactions.filter((tx) => tx.direction === 'out' && !isPendingMonitoring(tx)).length)
// Narxni faqat tegishli ruxsati bor xodim ko'radi (store.canSeePrices).
const listedTotal = computed(() => (tab.value === 'trips'
  ? trips.value.reduce((sum, trip) => sum + Number(trip.totalAmount || 0), 0)
  : expenses.value.reduce((sum, tx) => sum + Number(tx.amount || 0), 0)))
function openTrip(trip) { selected.value = { kind: 'trip', row: trip }; note.value = trip.monitoringNote || '' }
function openExpense(tx) { selected.value = { kind: 'expense', row: tx }; note.value = tx.monitoringNote || '' }
// Preview qatorlari: reys yoki xarajat turiga qarab.
const selectedRows = computed(() => {
  const item = selected.value
  if (!item) return []
  const row = item.row
  const userName = (id) => (id ? store.users.find((user) => user.id === id)?.fullName ?? '—' : '')
  const common = [
    { label: isPendingMonitoring(row) ? 'Bekor qilgan' : 'Tasdiqlagan', value: row.monitoredAt ? userName(row.monitoredBy) : '', sub: row.monitoredAt ? dateTime(row.monitoredAt) : '' },
  ]
  if (item.kind === 'trip') {
    return [
      { label: 'Samosval', value: store.vehicleName(row.vehicleId) },
      { label: 'Haydovchi', value: store.driverName(row.driverId) },
      { label: 'Tosh turi', value: store.materialName(row.materialId) },
      { label: 'Mijoz', value: store.tripClient(row) },
      { label: 'Savdo turi', value: row.saleType === 'cash' ? 'Naqd savdo' : 'Qarzga', tag: row.saleType === 'cash' ? 'tag-cash' : 'tag-credit' },
      ...common,
    ]
  }
  return [
    { label: 'Hisob', value: row.paymentMethod === 'cash' ? 'Naqd kassa' : 'Bank' },
    { label: 'Texnika', value: row.vehicleId ? store.vehicleName(row.vehicleId) : '' },
    { label: 'Xodim', value: row.driverId ? store.driverName(row.driverId) : '' },
    ...common,
  ]
})
function close() { selected.value = null; note.value = '' }
// Eski bazada `monitoring_status` ustuni va RPC'lar yo'q bo'lsa, yangi reyslar
// "tasdiqlangan" deb o'qiladi va navbat hech qachon to'lib kelmaydi. Bu holatni
// jim qoldirmaslik uchun sahifa ochilishida sxema tekshiriladi.
const schemaChecking = ref(false)
async function verifySchema(force = false) {
  schemaChecking.value = true
  try { await store.checkMonitoringSchema(force) } finally { schemaChecking.value = false }
}
onMounted(() => verifySchema())
async function decide(approved) {
  if (!selected.value) return
  saving.value = true
  try {
    if (selected.value.kind === 'trip') await store.setTripMonitoring(selected.value.row.id, approved, note.value.trim())
    else await store.setExpenseMonitoring(selected.value.row.id, approved, note.value.trim())
    close()
  } catch (error) {
    store.notify(error.message || 'Holatni o‘zgartirib bo‘lmadi.', 'error')
  } finally { saving.value = false }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div class="mb-1 flex items-center gap-2 text-xs font-semibold text-leaf"><ClipboardCheck :size="15" /> Monitoring</div>
        <h1 class="page-title">Tasdiqlash navbati</h1>
      </div>
      <p v-if="!store.canApproveMonitoring" class="rounded-xl border border-[#e3d3ae] bg-[#fff9ec] px-3 py-2 text-[11px] text-[#96621d]">Sizda faqat ko‘rish huquqi bor.</p>
    </div>

    <div v-if="store.monitoringSchema === false" class="flex flex-wrap items-center gap-3 rounded-2xl border border-[#f0c9c9] bg-[#fff4f4] px-4 py-3 text-[12px] text-[#a33a3a]">
      <CircleAlert :size="17" class="shrink-0" />
      <p class="flex-1 leading-relaxed">
        <strong>Monitoring bazada yo‘lgan.</strong> Server sxemasi eskirgan: <code class="rounded bg-white/70 px-1">monitoring_status</code> ustuni va tasdiqlash funksiyalari mavjud emas. Shu sababli yangi reyslar monitoring navbatiga tushmaydi.
        <strong>supabase/schema.sql</strong> faylini Supabase SQL Editor’da to‘liq qayta ishga tushiring, keyin <em>“Qayta tekshirish”</em> bosing.
      </p>
      <button class="btn-secondary text-[12px]" type="button" :disabled="schemaChecking" @click="verifySchema(true)">
        {{ schemaChecking ? 'Tekshirilyapti…' : 'Qayta tekshirish' }}
      </button>
    </div>

    <section class="grid gap-3 sm:grid-cols-3">
      <div class="card flex items-center gap-3 p-4"><div class="grid h-10 w-10 place-items-center rounded-xl bg-[#fff2d9] text-[#b77824]"><CircleAlert :size="18" /></div><div><p class="text-[10px] font-semibold uppercase tracking-wide text-muted">Reyslar kutilmoqda</p><p class="mt-1 text-lg font-bold text-ink">{{ store.pendingTrips.length }} <span class="text-xs font-medium text-muted">ta · {{ number(pendingTons, 1) }} t</span></p></div></div>
      <div class="card flex items-center gap-3 p-4"><div class="grid h-10 w-10 place-items-center rounded-xl bg-[#fff2d9] text-[#b77824]"><WalletCards :size="18" /></div><div><p class="text-[10px] font-semibold uppercase tracking-wide text-muted">Xarajatlari kutilmoqda</p><p class="mt-1 text-lg font-bold text-ink">{{ store.pendingExpenses.length }} <span class="text-xs font-medium text-muted">ta</span></p></div></div>
      <div class="card flex items-center gap-3 p-4"><div class="grid h-10 w-10 place-items-center rounded-xl bg-mint text-leaf"><Coins :size="18" /></div><div><p class="text-[10px] font-semibold uppercase tracking-wide text-muted">{{ status === 'pending' ? (tab === 'trips' ? 'Navbatdagi reyslar' : 'Navbatdagi xarajatlar') : 'Ko‘rsatilgan summa' }}</p><p class="mt-1 text-lg font-bold text-ink">{{ store.canSeePrices ? money(listedTotal, { short: true }) : 'Ruxsat yo‘q' }}</p></div></div>
    </section>

    <section class="card overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div class="flex flex-wrap gap-2">
          <div class="flex gap-1 rounded-xl bg-canvas p-1">
            <button v-for="item in [{ value: 'trips', label: `Reyslar (${store.pendingTrips.length})` }, { value: 'expenses', label: `Xarajatlari (${store.pendingExpenses.length})` }]" :key="item.value" class="rounded-lg px-3 py-1.5 text-[10px] font-bold transition" :class="tab === item.value ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'" @click="tab = item.value">{{ item.label }}</button>
          </div>
          <div class="flex gap-1 rounded-xl bg-canvas p-1">
            <button v-for="item in [{ value: 'pending', label: 'Kutilmoqda' }, { value: 'approved', label: 'Tasdiqlangan' }, { value: 'all', label: 'Hammasi' }]" :key="item.value" class="rounded-lg px-3 py-1.5 text-[10px] font-bold transition" :class="status === item.value ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'" @click="status = item.value">{{ item.label }}</button>
          </div>
        </div>
        <div class="relative w-full sm:max-w-[260px]"><Search :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="search" class="field !py-2.5 !pl-9" :placeholder="tab === 'trips' ? 'Reys, mijoz yoki samosval...' : 'Xarajat yoki turi...'" /></div>
      </div>

      <div v-if="tab === 'trips'" class="overflow-x-auto">
        <table class="w-full min-w-[800px] border-collapse text-left">
          <thead><tr class="table-head border-b border-line"><th class="px-5 py-3">Sana / Vaqt</th><th class="px-4 py-3">Texnika / Haydovchi</th><th class="px-4 py-3">Mijoz</th><th class="px-4 py-3">Tosh turi</th><th class="px-4 py-3">Og‘irlik</th><th class="px-4 py-3">Holat</th><th class="px-5 py-3 text-right">Qiymati</th></tr></thead>
          <tbody>
            <tr v-for="trip in trips" :key="trip.id" class="cursor-pointer border-b border-[#f0f2f0] last:border-0 hover:bg-[#fbfcfb]" @click="openTrip(trip)">
              <td class="px-5 py-3.5"><p class="text-xs font-bold text-ink">{{ dateOnly(trip.createdAt) }}<span v-if="isAutoApproved(trip)" class="tag tag-blue ml-1.5 align-middle" title="Avtomatik tasdiqlangan">Avto</span></p><p class="mt-1 text-[10px] text-muted">{{ timeOnly(trip.createdAt) }}</p></td>
              <td class="px-4 py-3.5"><p class="text-xs font-semibold text-ink">{{ store.vehicles.find((item) => item.id === trip.vehicleId)?.plate || '—' }}</p><p class="mt-1 text-[10px] text-muted">{{ store.driverName(trip.driverId) }}</p></td>
              <td class="max-w-[170px] px-4 py-3.5"><p class="truncate text-xs text-ink">{{ store.tripClient(trip) }}</p></td>
              <td class="px-4 py-3.5"><span class="tag tag-blue">{{ store.materialName(trip.materialId) }}</span></td>
              <td class="px-4 py-3.5"><p class="text-xs font-bold text-ink">{{ number(trip.weightTons, 1) }} t</p></td>
              <td class="px-4 py-3.5"><span class="tag" :class="monitoringTagClass(trip)">{{ monitoringLabel(trip) }}</span></td>
              <td class="px-5 py-3.5 text-right"><p v-if="store.canSeePrices" class="text-xs font-bold text-ink">{{ money(trip.totalAmount, { short: true }) }}</p><p v-else class="text-[10px] text-muted">Ruxsat yo‘q</p></td>
            </tr>
            <tr v-if="!trips.length"><td colspan="7" class="px-6 py-16 text-center"><div class="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-canvas text-muted"><CircleCheck :size="19" /></div><p class="text-sm font-semibold text-ink">{{ status === 'pending' ? 'Reyslar kutilmoqda emas' : 'Reyslar topilmadi' }}</p><p class="mt-1 text-xs text-muted">{{ status === 'pending' ? 'Tarozixonadan kelgan yangi reyslar shu yerda paydo bo‘ladi.' : 'Holat filtrini o‘zgartirib ko‘ring.' }}</p></td></tr>
          </tbody>
        </table>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[760px] border-collapse text-left">
          <thead><tr class="table-head border-b border-line"><th class="px-5 py-3">Sana</th><th class="px-4 py-3">Xarajat turi</th><th class="px-4 py-3">Tafsilot</th><th class="px-4 py-3">Hisob</th><th class="px-4 py-3">Holat</th><th class="px-5 py-3 text-right">Summa</th></tr></thead>
          <tbody>
            <tr v-for="tx in expenses" :key="tx.id" class="cursor-pointer border-b border-[#f0f2f0] last:border-0 hover:bg-[#fbfcfb]" @click="openExpense(tx)">
              <td class="px-5 py-3.5"><p class="text-[11px] text-ink">{{ dateTime(tx.createdAt) }}</p><p class="mt-1 text-[10px] text-muted">Kiritgan: {{ store.driverName(tx.driverId) || 'Boshqarma' }}</p></td>
              <td class="px-4 py-3.5"><span class="tag tag-credit">{{ store.categoryLabel(tx.category) }}</span></td>
              <td class="max-w-[220px] px-4 py-3.5"><p class="truncate text-xs text-ink" :title="tx.note">{{ tx.note || '—' }}</p><p v-if="tx.vehicleId" class="mt-1 truncate text-[10px] text-muted">{{ store.vehicleName(tx.vehicleId) }}</p></td>
              <td class="px-4 py-3.5"><span class="tag" :class="tx.paymentMethod === 'cash' ? 'tag-cash' : 'tag-blue'">{{ tx.paymentMethod === 'cash' ? 'Naqd' : 'Bank' }}</span></td>
              <td class="px-4 py-3.5"><span class="tag" :class="monitoringTagClass(tx)">{{ monitoringLabel(tx) }}</span></td>
              <td class="px-5 py-3.5 text-right"><p v-if="store.canSeePrices" class="text-xs font-bold text-ink">{{ money(tx.amount, { short: true }) }}</p><p v-else class="text-[10px] text-muted">Ruxsat yo‘q</p></td>
            </tr>
            <tr v-if="!expenses.length"><td colspan="6" class="px-6 py-16 text-center"><div class="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-canvas text-muted"><CircleCheck :size="19" /></div><p class="text-sm font-semibold text-ink">{{ status === 'pending' ? 'Xarajatlari kutilmoqda emas' : 'Xarajatlari topilmadi' }}</p><p class="mt-1 text-xs text-muted">{{ status === 'pending' ? 'Moliya bo‘limidan kiritilgan chiqimlar shu yerda paydo bo‘ladi.' : 'Holat filtrini o‘zgartirib ko‘ring.' }}</p></td></tr>
          </tbody>
        </table>
      </div>

      <footer class="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[10px] text-muted"><span>{{ tab === 'trips' ? trips.length : expenses.length }} ta yozuv ko‘rsatildi</span><span>Jami tasdiqlangan: {{ archivedTrips }} reys · {{ archivedExpenses }} xarajat</span></footer>
    </section>

    <ModalDialog :model-value="Boolean(selected)"
      :title="selected ? (selected.kind === 'expense' ? store.categoryLabel(selected.row.category) : `Reys ${tripCode(selected.row.id)}`) : 'Yozuv'"
      :description="selected ? dateTime(selected.row.createdAt) : ''" width="max-w-md"
      @update:model-value="(value) => { if (!value) close() }">
      <div v-if="selected" class="space-y-4">
        <div class="flex items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3">
          <div>
            <p class="text-[11px] font-semibold text-muted">{{ selected.kind === 'expense' ? 'Chiqim summasi' : 'Og‘irlik' }}</p>
            <p class="mt-0.5 text-xl font-bold tracking-tight text-ink">
              <template v-if="selected.kind === 'expense'">{{ store.canSeePrices ? money(selected.row.amount) : 'Yashirilgan' }}</template>
              <template v-else>{{ number(selected.row.weightTons, 1) }} t</template>
            </p>
            <p v-if="selected.kind === 'trip' && store.canSeePrices" class="text-[11px] text-muted">{{ money(selected.row.totalAmount) }}</p>
          </div>
          <span class="tag" :class="monitoringTagClass(selected.row)">{{ monitoringLabel(selected.row) }}</span>
        </div>
        <PreviewSection :rows="selectedRows" />
        <div v-if="selected.row.note" class="flex items-start gap-2.5 rounded-xl border border-line bg-canvas px-4 py-3">
          <StickyNote :size="15" class="mt-0.5 shrink-0 text-muted" />
          <p class="text-[13px] leading-relaxed text-ink">{{ selected.row.note }}</p>
        </div>
        <label v-if="store.canApproveMonitoring" class="block"><span class="label">Monitoring izohi (ixtiyoriy)</span><input v-model="note" class="field" placeholder="Masalan: hujjat tekshirildi" /></label>
        <div class="flex items-center justify-end gap-2 border-t border-line pt-3">
          <button class="btn-quiet !text-xs" :disabled="saving" @click="close">Yopish</button>
          <template v-if="store.canApproveMonitoring">
            <button v-if="!isPendingMonitoring(selected.row)" class="btn-secondary !py-2.5 text-xs" :disabled="saving || store.monitoringSchema === false" @click="decide(false)"><Undo2 :size="15" /> Tasdiqlashni bekor qilish</button>
            <button v-else class="btn-primary !py-2.5 text-xs" :disabled="saving || store.monitoringSchema === false" @click="decide(true)"><Check :size="15" /> {{ saving ? 'Saqlanmoqda…' : 'Tasdiqlash' }}</button>
          </template>
        </div>
      </div>
    </ModalDialog>
  </div>
</template>
