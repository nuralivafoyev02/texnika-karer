<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  UserRound, Truck, Weight, Banknote, WalletCards, CircleAlert, Clock3, HandCoins,
  Pencil, Check, X, CalendarDays, ClipboardList, CircleCheck, UserRoundPlus, Copy,
} from 'lucide-vue-next'
import ModalDialog from '../components/ModalDialog.vue'
import TripPreviewModal from '../components/TripPreviewModal.vue'
import ExpenseForm from '../components/forms/ExpenseForm.vue'
import MaintenanceReportForm from '../components/forms/MaintenanceReportForm.vue'
import StaffForm from '../components/forms/StaffForm.vue'
import { useQuarryStore } from '../stores/quarry'
import { dateOnly, dateTime, timeOnly, money, monthYear, number, initials, isToday, formatAmountInput, parseAmountInput, captureAmountInput } from '../lib/format'
import { isPendingMonitoring, monitoringLabel, monitoringTagClass } from '../lib/monitoring'

const store = useQuarryStore()
const route = useRoute()
const isDriver = computed(() => store.can('driver.self') && !store.can('staff.view'))
const driver = computed(() => store.currentUser)
const driverTrips = computed(() => store.trips.filter((trip) => trip.driverId === driver.value?.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
const todayTrips = computed(() => driverTrips.value.filter((trip) => isToday(trip.createdAt)))
const ownMonthTrips = computed(() => driverTrips.value.filter((trip) => { const date = new Date(trip.createdAt); const now = new Date(); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() }))
const ownPay = computed(() => driver.value ? store.balanceForDriver(driver.value.id) : { trips: 0, earned: 0, paid: 0, remaining: 0 })
const ownVehicles = computed(() => store.vehicles.filter((vehicle) => vehicle.driverId === driver.value?.id))
const ownPayroll = computed(() => store.transactions.filter((tx) => tx.driverId === driver.value?.id && tx.category === 'payroll').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5))
const drivers = computed(() => store.users.filter((user) => store.userCan(user, 'driver.self')))
const driverRows = computed(() => drivers.value.map((person) => ({ person, pay: store.balanceForDriver(person.id), vehicles: store.vehicles.filter((vehicle) => vehicle.driverId === person.id) })))
const showCreate = ref(false)
const credentials = ref(null)
const copied = ref(false)
const driverRoleId = computed(() => store.roles.find((role) => role.permissions?.includes('driver.self'))?.id ?? '')
const selectedTrip = ref(null)
const editingRate = ref('')
const rateInput = ref('')
const onRate = (event) => captureAmountInput(event, (value) => { rateInput.value = value })
const showAdvance = ref(false)
const showReport = ref(false)
const saving = ref(false)
const advanceDriverId = ref('')
function beginRate(driver) { editingRate.value = driver.id; rateInput.value = formatAmountInput(Number(driver.driverRatePerTrip || 0)) }
async function saveRate(driver) {
  saving.value = true
  try { await store.updateDriverRate(driver.id, parseAmountInput(rateInput.value)); editingRate.value = '' }
  catch (error) { store.notify(error.message || 'Stavkani saqlab bo‘lmadi.', 'error') }
  finally { saving.value = false }
}
async function saveAdvance(payload) {
  saving.value = true
  try { await store.createExpense({ ...payload, category: 'payroll', driverId: advanceDriverId.value }); showAdvance.value = false }
  catch (error) { store.notify(error.message || 'Avansni saqlab bo‘lmadi.', 'error') }
  finally { saving.value = false }
}
async function sendReport(payload) {
  saving.value = true
  try { await store.createMaintenanceReport(payload); showReport.value = false }
  catch (error) { store.notify(error.message || 'Xabar yuborilmadi.', 'error') }
  finally { saving.value = false }
}
function openAdvance(id) { advanceDriverId.value = id; showAdvance.value = true }
async function createDriver(payload) {
  saving.value = true
  try {
    const result = await store.createStaff(payload)
    showCreate.value = false
    if (result?.password) credentials.value = { login: result.login, password: result.password, name: result.fullName || payload.fullName }
  } catch (error) { store.notify(error.message || 'Haydovchini qo‘shib bo‘lmadi.', 'error') }
  finally { saving.value = false }
}
async function copyCredentials() {
  try {
    await navigator.clipboard.writeText(`Login: ${credentials.value.login}\nParol: ${credentials.value.password}`)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch { store.notify('Kiritishga ruxsat berilmadi: matnni qo‘lda ko‘chiring.', 'error') }
}
</script>

<template>
  <div v-if="isDriver" class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4"><div><div class="mb-1 flex items-center gap-2 text-xs font-semibold text-leaf"><UserRound :size="15" /> Haydovchi kabineti</div><h1 class="page-title">Mening hisobim</h1></div><button v-if="store.can('maintenance.report')" class="btn-secondary" @click="showReport = true"><CircleAlert :size="16" /> Nosozlik haqida xabar</button></div>

    <section class="overflow-hidden rounded-2xl bg-[#0a4fa8] text-white shadow-soft"><div class="flex flex-wrap items-center gap-4 p-5 sm:p-6"><div class="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-base font-bold">{{ initials(driver?.fullName) }}</div><div class="min-w-[180px] flex-1"><div class="flex flex-wrap items-center gap-2"><h2 class="text-lg font-bold">{{ driver?.fullName }}</h2><span class="rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-bold text-[#cde0ff]">Faol haydovchi</span></div><p class="mt-1 text-xs text-white/65">{{ driver?.phone }} · {{ ownVehicles.map((vehicle) => vehicle.plate).join(', ') || 'Texnika biriktirilmagan' }}</p></div><div class="grid grid-cols-2 gap-2 sm:gap-4"><div class="rounded-xl bg-white/[.08] px-4 py-3"><p class="text-[9px] text-white/60">Bir reys uchun</p><p class="mt-1 text-sm font-bold">{{ money(driver?.driverRatePerTrip) }}</p></div><div class="rounded-xl bg-white/[.08] px-4 py-3"><p class="text-[9px] text-white/60">Shu oydagi reys</p><p class="mt-1 text-sm font-bold">{{ ownMonthTrips.length }} ta</p></div></div></div></section>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="card p-4"><div class="flex items-center justify-between"><p class="text-[10px] font-bold uppercase tracking-wide text-muted">Bugungi reyslar</p><div class="grid h-8 w-8 place-items-center rounded-lg bg-mint text-leaf"><Truck :size="15" /></div></div><p class="mt-3 text-2xl font-bold text-ink">{{ todayTrips.length }}</p><p class="mt-1 text-[10px] text-muted">{{ number(todayTrips.reduce((sum, trip) => sum + trip.weightTons, 0), 1) }} tonna yuk</p></div>
      <div class="card p-4"><div class="flex items-center justify-between"><p class="text-[10px] font-bold uppercase tracking-wide text-muted">Oylik reyslar</p><div class="grid h-8 w-8 place-items-center rounded-lg bg-[#edf3fa] text-[#4f7595]"><CalendarDays :size="15" /></div></div><p class="mt-3 text-2xl font-bold text-ink">{{ ownPay.trips }}</p><p class="mt-1 text-[10px] text-muted">{{ ownPay.pending ? `${ownPay.pending} ta reys kutilmoqda` : 'Joriy oy hisobida' }}</p></div>
      <div class="card p-4"><div class="flex items-center justify-between"><p class="text-[10px] font-bold uppercase tracking-wide text-muted">Hisoblangan maosh</p><div class="grid h-8 w-8 place-items-center rounded-lg bg-[#e6f1ff] text-leaf"><Banknote :size="15" /></div></div><p class="mt-3 text-xl font-bold text-ink">{{ money(ownPay.earned, { short: true }) }}</p><p class="mt-1 text-[10px] text-muted">Reyslar soni × stavka</p></div>
      <div class="card p-4"><div class="flex items-center justify-between"><p class="text-[10px] font-bold uppercase tracking-wide text-muted">To‘lanishi kerak</p><div class="grid h-8 w-8 place-items-center rounded-lg bg-[#fff4e3] text-amber"><WalletCards :size="15" /></div></div><p class="mt-3 text-xl font-bold" :class="ownPay.remaining > 0 ? 'text-[#ac6e27]' : 'text-leaf'">{{ money(Math.max(0, ownPay.remaining), { short: true }) }}</p><p class="mt-1 text-[10px] text-muted">Avans: {{ money(ownPay.paid, { short: true }) }}</p></div>
    </section>

    <section class="grid gap-5 xl:grid-cols-12">
      <article class="card overflow-hidden xl:col-span-8"><div class="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 class="section-title">Mening reyslarim</h2><p class="mt-1 text-xs text-muted">Joriy oy reyslari</p></div><span class="tag tag-blue">{{ ownMonthTrips.length }} reys</span></div><div class="overflow-x-auto"><table class="w-full min-w-[600px] border-collapse text-left"><thead><tr class="table-head border-b border-line"><th class="px-5 py-3">Sana / Vaqt</th><th class="px-4 py-3">Texnika</th><th class="px-4 py-3">Yuk</th><th class="px-4 py-3">Ishlangan vaqt</th><th class="px-4 py-3">Monitoring</th><th class="px-5 py-3 text-right">Reys haqi</th></tr></thead><tbody><tr v-for="trip in ownMonthTrips" :key="trip.id" class="cursor-pointer border-b border-[#f0f2f0] last:border-0 transition hover:bg-[#f7fafd]" title="Batafsil ko‘rish" @click="selectedTrip = trip"><td class="px-5 py-3.5"><p class="text-xs font-bold text-ink">{{ dateOnly(trip.createdAt) }}</p><p class="mt-1 text-[10px] text-muted">{{ timeOnly(trip.createdAt) }}</p></td><td class="px-4 py-3.5 text-xs text-ink">{{ store.vehicles.find((item) => item.id === trip.vehicleId)?.plate || '—' }}</td><td class="px-4 py-3.5"><p class="text-xs font-bold text-ink">{{ number(trip.weightTons, 1) }} t</p><p class="mt-1 text-[10px] text-muted">{{ store.materialName(trip.materialId) }}</p></td><td class="px-4 py-3.5 text-xs text-muted">{{ number(trip.hoursWorked, 1) }} soat</td><td class="px-4 py-3.5"><span class="tag" :class="monitoringTagClass(trip)">{{ monitoringLabel(trip) }}</span></td><td class="px-5 py-3.5 text-right text-xs font-bold" :class="isPendingMonitoring(trip) ? 'text-muted' : 'text-leaf'">{{ isPendingMonitoring(trip) ? 'Kutilmoqda' : money(driver?.driverRatePerTrip) }}</td></tr><tr v-if="!ownMonthTrips.length"><td colspan="6" class="px-5 py-12 text-center text-xs text-muted">Joriy oyda reys yozilmagan.</td></tr></tbody></table></div></article>
      <aside class="space-y-5 xl:col-span-4"><article class="card p-5"><div class="flex items-center justify-between"><div><h2 class="section-title">Olingan avanslar</h2><p class="mt-1 text-xs text-muted">Joriy oyda buxgalter bergan to‘lovlar</p></div><HandCoins :size="18" class="text-leaf" /></div><div class="mt-3 divide-y divide-[#f0f2f0]"><div v-for="tx in ownPayroll" :key="tx.id" class="flex items-center justify-between gap-2 py-3"><div><p class="text-xs font-semibold text-ink">{{ tx.note || 'Ish haqi avansi' }}</p><p class="mt-1 text-[10px] text-muted">{{ dateTime(tx.createdAt) }} · {{ tx.paymentMethod === 'cash' ? 'Naqd' : 'Bank' }}</p></div><strong class="text-xs text-amber">−{{ money(tx.amount, { short: true }) }}</strong></div><div v-if="!ownPayroll.length" class="py-8 text-center text-xs text-muted">Hozircha avans yozilmagan.</div></div></article></aside>
    </section>
    <TripPreviewModal :model-value="Boolean(selectedTrip)" :trip="selectedTrip" @update:model-value="(value) => { if (!value) selectedTrip = null }" />
    <ModalDialog v-model="showReport" title="Nosozlik haqida xabar"><MaintenanceReportForm :vehicles="ownVehicles" :loading="saving" @submit="sendReport" @cancel="showReport = false" /></ModalDialog>
  </div>

  <div v-else class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4"><div><div class="mb-1 flex items-center gap-2 text-xs font-semibold text-leaf"><UserRound :size="15" /> Haydovchilar hisobi</div><h1 class="page-title">Haydovchilar</h1></div><button v-if="store.canManageStaff" class="btn-primary" @click="showCreate = true"><UserRoundPlus :size="16" /> Haydovchi qo‘shish</button></div>
    <section class="grid gap-4 sm:grid-cols-3"><div class="card p-4"><p class="text-[10px] font-bold uppercase tracking-wide text-muted">Faol haydovchilar</p><p class="mt-2 text-2xl font-bold text-ink">{{ drivers.length }}</p><p class="mt-1 text-[10px] text-muted">Tizimda ro‘yxatdan o‘tgan</p></div><div class="card p-4"><p class="text-[10px] font-bold uppercase tracking-wide text-muted">Shu oy reyslari</p><p class="mt-2 text-2xl font-bold text-ink">{{ driverRows.reduce((sum, item) => sum + item.pay.trips, 0) }}</p><p class="mt-1 text-[10px] text-muted">Barcha haydovchilar bo‘yicha</p></div><div class="card p-4"><p class="text-[10px] font-bold uppercase tracking-wide text-muted">Hisoblangan ish haqi</p><p class="mt-2 text-2xl font-bold text-ink">{{ money(driverRows.reduce((sum, item) => sum + item.pay.earned, 0), { short: true }) }}</p><p class="mt-1 text-[10px] text-muted">Reyslar × haydovchi stavkasi</p></div></section>
    <section class="card overflow-hidden"><div class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4"><div><h2 class="section-title">Oylik hisob-kitob</h2><p class="mt-1 text-xs text-muted">Joriy oy uchun reys stavkasi va to‘lovlar</p></div><span class="tag tag-blue">{{ monthYear() }}</span></div><div class="overflow-x-auto"><table class="w-full min-w-[880px] border-collapse text-left"><thead><tr class="table-head border-b border-line"><th class="px-5 py-3">Haydovchi / Texnika</th><th class="px-4 py-3">Reyslar</th><th class="px-4 py-3">Stavka / reys</th><th class="px-4 py-3">Hisoblangan</th><th class="px-4 py-3">Avans / to‘lov</th><th class="px-4 py-3">Qoldiq</th><th class="px-5 py-3 text-right">Amal</th></tr></thead><tbody><tr v-for="row in driverRows" :key="row.person.id" class="border-b border-[#f0f2f0] last:border-0 hover:bg-[#fbfcfb]"><td class="px-5 py-4"><div class="flex items-center gap-3"><div class="avatar avatar-driver">{{ initials(row.person.fullName) }}</div><div><p class="text-xs font-bold text-ink">{{ row.person.fullName }}</p><p class="mt-1 text-[10px] text-muted">{{ row.vehicles.map((vehicle) => vehicle.plate).join(', ') || 'Texnika biriktirilmagan' }}</p></div></div></td><td class="px-4 py-4"><span class="rounded-lg bg-canvas px-2.5 py-1.5 text-xs font-bold text-ink">{{ row.pay.trips }}</span></td><td class="px-4 py-4"><div v-if="editingRate === row.person.id" class="flex items-center gap-1"><input :value="rateInput" type="text" inputmode="numeric" autocomplete="off" class="field !w-[116px] !px-2 !py-1.5 !text-xs" @input="onRate" /><button class="grid h-7 w-7 place-items-center rounded-lg bg-mint text-leaf" @click="saveRate(row.person)"><Check :size="14" /></button><button class="grid h-7 w-7 place-items-center rounded-lg bg-canvas text-muted" @click="editingRate = ''"><X :size="14" /></button></div><button v-else class="flex items-center gap-1.5 text-xs font-semibold text-ink" :class="store.can('payroll.manage') ? 'hover:text-leaf' : ''" @click="store.can('payroll.manage') && beginRate(row.person)">{{ money(row.person.driverRatePerTrip) }}<Pencil v-if="store.can('payroll.manage')" :size="11" class="text-slate-400" /></button></td><td class="px-4 py-4 text-xs font-bold text-ink">{{ money(row.pay.earned, { short: true }) }}</td><td class="px-4 py-4 text-xs font-semibold text-amber">{{ money(row.pay.paid, { short: true }) }}</td><td class="px-4 py-4"><span class="text-xs font-bold" :class="row.pay.remaining > 0 ? 'text-[#bd594d]' : 'text-leaf'">{{ money(Math.max(0, row.pay.remaining), { short: true }) }}</span></td><td class="px-5 py-4 text-right"><button v-if="store.can('finance.expenses.create')" class="btn-quiet !rounded-lg !px-2.5 !py-2 text-[10px]" @click="openAdvance(row.person.id)"><HandCoins :size="14" /> Avans</button></td></tr><tr v-if="!driverRows.length"><td colspan="7" class="px-6 py-12 text-center"><p class="text-xs text-muted">Tizimda haydovchi topilmadi.</p><button v-if="store.canManageStaff" class="btn-secondary mt-3" @click="showCreate = true"><UserRoundPlus :size="15" /> Haydovchi qo‘shish</button></td></tr></tbody></table></div></section>
    <ModalDialog v-model="showAdvance" title="Haydovchiga avans berish"><ExpenseForm :vehicles="store.vehicles" :drivers="drivers" :categories="store.expenseCategories" initial-category="payroll" :initial-driver-id="advanceDriverId" :loading="saving" @submit="saveAdvance" @cancel="showAdvance = false" /></ModalDialog>
    <ModalDialog v-model="showCreate" title="Yangi haydovchi qo‘shish" width="max-w-2xl"><StaffForm :roles="store.roles" :initial-role-id="driverRoleId" :demo-mode="!store.remoteMode" :loading="saving" @submit="createDriver" @cancel="showCreate = false" /></ModalDialog>
    <ModalDialog :model-value="Boolean(credentials)" title="Xodim tizimga tayyor" @update:model-value="credentials = null">
      <div class="rounded-2xl border border-mint bg-[#f4f9ff] p-4"><p class="text-[10px] font-bold uppercase tracking-wide text-muted">{{ credentials?.name }}</p><dl class="mt-3 space-y-2 text-sm"><div class="flex items-center justify-between gap-3"><dt class="text-muted">Login</dt><dd><code class="rounded-md bg-white px-2 py-1 text-xs font-bold text-ink">{{ credentials?.login }}</code></dd></div><div class="flex items-center justify-between gap-3"><dt class="text-muted">Parol</dt><dd><code class="rounded-md bg-white px-2 py-1 text-xs font-bold text-ink">{{ credentials?.password }}</code></dd></div></dl><div class="mt-4 flex justify-end gap-2"><button class="btn-secondary" type="button" @click="credentials = null">Yopish</button><button class="btn-primary" type="button" @click="copyCredentials"><Check v-if="copied" :size="15" /><Copy v-else :size="15" />{{ copied ? 'Nusxalandi' : 'Nusxa olish' }}</button></div></div>
    </ModalDialog>
  </div>
</template>
