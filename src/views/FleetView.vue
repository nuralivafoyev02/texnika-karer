<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Truck, Wrench, CircleAlert, CircleCheck, Gauge, Search, Settings2, Plus, Pencil, UserRoundPlus, Check, Copy } from 'lucide-vue-next'
import ModalDialog from '../components/ModalDialog.vue'
import VehicleForm from '../components/forms/VehicleForm.vue'
import StaffForm from '../components/forms/StaffForm.vue'
import { useQuarryStore } from '../stores/quarry'
import { money, number, initials } from '../lib/format'
import { sectionShort } from '../lib/guide'

const store = useQuarryStore()
const route = useRoute()
// Global qidiruvdan kelgan ?q= (masalan, avtomobil raqami) shu yerda filtrlanadi.
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const filter = ref('all')
const showCreate = ref(false)
const editing = ref(null)
const showDriver = ref(false)
const saving = ref(false)
const credentials = ref(null)
const copied = ref(false)
// Yangi yaratilgan haydovchi — texnika formasi ochiq turganda uning select'iga
// avtomatik tanlab qo'yiladi (yangi reys/qo'shish oynasida ham).
const newDriverId = ref('')

const canManage = computed(() => store.can('fleet.manage'))
const drivers = computed(() => store.drivers)
const driverRole = computed(() => store.roles.find((role) => role.permissions?.includes('driver.self'))?.id ?? '')
const vehicles = computed(() => store.vehicles.filter((vehicle) => {
  const text = `${vehicle.plate} ${vehicle.model} ${store.driverName(vehicle.driverId)}`.toLowerCase()
  return (!search.value.trim() || text.includes(search.value.trim().toLowerCase())) && (filter.value === 'all' || vehicle.status === filter.value)
}))
const statsByVehicle = computed(() => Object.fromEntries(store.vehicles.map((vehicle) => [vehicle.id, store.vehicleStats(vehicle.id)])))
const activeCount = computed(() => store.vehicles.filter((vehicle) => vehicle.status === 'active').length)
const withoutDriver = computed(() => store.vehicles.filter((vehicle) => !vehicle.driverId && vehicle.status === 'active').length)
const repairSpend = computed(() => store.transactions.filter((tx) => tx.category === 'repair' && tx.direction === 'out').reduce((sum, tx) => sum + Number(tx.amount), 0))
const totalTrips = computed(() => store.vehicles.reduce((sum, vehicle) => sum + (statsByVehicle.value[vehicle.id]?.trips ?? 0), 0))
const totalHours = computed(() => store.vehicles.reduce((sum, vehicle) => sum + (statsByVehicle.value[vehicle.id]?.hours ?? 0), 0))

function notify(message) { store.notify(message, 'error') }
async function create(payload) {
  saving.value = true
  try { await store.createVehicle(payload); showCreate.value = false }
  catch (error) { notify(error.message || 'Texnika qo‘shib bo‘lmadi.') }
  finally { saving.value = false }
}
async function save(payload) {
  saving.value = true
  try { await store.updateVehicle(editing.value.id, payload); editing.value = null }
  catch (error) { notify(error.message || 'Saqlab bo‘lmadi.') }
  finally { saving.value = false }
}
// "Haydovchi yo'q bo'lsa shu yerda qo'shish": avval yaratamiz, keyin shu texnikaga biriktiramiz.
async function createDriver(payload) {
  saving.value = true
  try {
    const result = await store.createStaff(payload)
    showDriver.value = false
    if (result?.password) credentials.value = { login: result.login, password: result.password, name: result.fullName || payload.fullName }
    // Yaratilgan haydovchini shu texnikaga biriktiramiz: forma :key orqali qayta chiziladi.
    if (result?.userId && editing.value?.id) {
      await store.updateVehicle(editing.value.id, { ...editing.value, driverId: result.userId })
      editing.value = { ...editing.value, driverId: result.userId }
    } else if (result?.userId) {
      // Texnika hali yaratilmagan bo'lsa (qo'shish oynasi) — formada tanlab qo'yamiz,
      // foydalanuvchi saqlash tugmasini bosadi.
      newDriverId.value = result.userId
    }
  } catch (error) { notify(error.message || 'Haydovchini qo‘shib bo‘lmadi.') }
  finally { saving.value = false }
}
async function toggleStatus(vehicle) {
  try { await store.updateVehicleStatus(vehicle.id, vehicle.status === 'active' ? 'service' : 'active') }
  catch (error) { notify(error.message || 'Texnika holatini yangilab bo‘lmadi.') }
}
async function resolve(report) {
  try { await store.resolveMaintenanceReport(report.id) }
  catch (error) { notify(error.message || 'Xabarni yangilab bo‘lmadi.') }
}
async function copyCredentials() {
  try {
    await navigator.clipboard.writeText(`Login: ${credentials.value.login}\nParol: ${credentials.value.password}`)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch { notify('Kiritishga ruxsat berilmadi: matnni qo‘lda ko‘chiring.') }
}
function openCreate() { editing.value = null; newDriverId.value = ''; showCreate.value = true }
// Texnika formasi yopilmaydi: haydovchi yaratilgach foydalanuvchi o'sha formada
// davom etadi (avval eshakchalak qilib qo'yardi).
function openDriverForm() { showDriver.value = true }
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div><h1 class="page-title">Texnikalar</h1><p class="page-subtitle">{{ sectionShort(route.path) }}</p></div>
      <button v-if="canManage" class="btn-primary" @click="openCreate"><Plus :size="16" /> Texnika qo‘shish</button>
    </div>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div class="card flex items-center gap-3 p-4"><div class="grid h-10 w-10 place-items-center rounded-xl bg-mint text-leaf"><Truck :size="18" /></div><div><p class="text-[10px] font-bold uppercase tracking-wide text-muted">Jami texnika</p><p class="mt-1 text-lg font-bold text-ink">{{ store.vehicles.length }}</p></div></div>
      <div class="card flex items-center gap-3 p-4"><div class="grid h-10 w-10 place-items-center rounded-xl bg-[#e6f1ff] text-leaf"><CircleCheck :size="18" /></div><div><p class="text-[10px] font-bold uppercase tracking-wide text-muted">Ishga tayyor</p><p class="mt-1 text-lg font-bold text-ink">{{ activeCount }}</p></div></div>
      <div class="card flex items-center gap-3 p-4"><div class="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3fa] text-[#4f7595]"><Gauge :size="18" /></div><div><p class="text-[10px] font-bold uppercase tracking-wide text-muted">Joriy oy</p><p class="mt-1 text-lg font-bold text-ink">{{ totalTrips }} <span class="text-xs font-medium text-muted">reys · {{ number(totalHours, 1) }} soat</span></p></div></div>
      <div class="card flex items-center gap-3 p-4"><div class="grid h-10 w-10 place-items-center rounded-xl bg-[#fff4e3] text-[#b77824]"><Wrench :size="18" /></div><div><p class="text-[10px] font-bold uppercase tracking-wide text-muted">Remont xarajati</p><p class="mt-1 text-lg font-bold text-ink">{{ money(repairSpend, { short: true }) }}</p></div></div>
    </section>

    <section v-if="canManage && !drivers.length" class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f2dfc2] bg-[#fff9ef] px-4 py-3">
      <div class="flex items-center gap-2 text-[#96621d]"><UserRoundPlus :size="16" /><p class="text-xs font-bold">Hali haydovchi yo‘q</p></div>
      <button class="btn-secondary" @click="openDriverForm"><UserRoundPlus :size="15" /> Birinchi haydovchini qo‘shish</button>
    </section>

    <section v-if="store.maintenanceReports.length" class="card overflow-hidden">
      <div class="flex items-center justify-between border-b border-line px-5 py-4"><h2 class="section-title">Nosozlik xabarlari</h2><span class="rounded-lg bg-canvas px-2 py-1 text-[10px] font-bold text-muted">{{ store.openReports.length }} ta ochiq</span></div>
      <div class="divide-y divide-[#f0f2f0]">
        <div v-for="report in store.maintenanceReports.slice(0, 6)" :key="report.id" class="flex flex-wrap items-start gap-3 px-5 py-4">
          <div class="grid h-9 w-9 shrink-0 place-items-center rounded-xl" :class="report.status === 'open' ? 'bg-[#fff4e3] text-amber' : 'bg-mint text-leaf'"><Wrench :size="16" /></div>
          <div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><p class="text-xs font-bold text-ink">{{ store.vehicleName(report.vehicleId) }}</p><span class="status-pill" :class="report.status === 'open' ? 'status-open' : 'status-resolved'">{{ report.status === 'open' ? 'Ko‘rib chiqilmoqda' : 'Bajarildi' }}</span></div><p class="mt-1 text-xs leading-5 text-muted">{{ report.description }}</p><p class="mt-1 text-[10px] text-slate-400">{{ store.driverName(report.driverId) }}</p></div>
          <button v-if="report.status === 'open' && canManage" class="btn-secondary !px-2.5 !py-2 text-[10px]" @click="resolve(report)"><CircleCheck :size="14" /> Yopish</button>
        </div>
      </div>
    </section>

    <section class="card overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <h2 class="section-title">Transport parki</h2>
        <div class="flex flex-wrap gap-2">
          <label class="relative"><Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="search" class="field !w-[190px] !py-2.5 !pl-9" placeholder="Raqam yoki haydovchi" /></label>
          <select v-model="filter" class="field !w-auto !py-2.5"><option value="all">Barcha holat</option><option value="active">Faol</option><option value="service">Servisda</option><option value="repair">Remontda</option></select>
        </div>
      </div>
      <div class="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
        <article v-for="vehicle in vehicles" :key="vehicle.id" class="rounded-2xl border border-line bg-white p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 items-center gap-3"><div class="grid h-11 w-11 shrink-0 place-items-center rounded-lg" :class="vehicle.status === 'active' ? 'bg-mint text-leaf' : vehicle.status === 'repair' ? 'bg-red-50 text-danger' : 'bg-[#fff4e3] text-amber'"><Truck :size="21" /></div><div class="min-w-0"><p class="truncate text-xs font-bold text-ink">{{ vehicle.plate }}</p><p class="mt-1 truncate text-[10px] text-muted">{{ vehicle.model }}<span v-if="vehicle.year"> · {{ vehicle.year }}</span></p></div></div>
            <span class="status-pill shrink-0" :class="vehicle.status === 'active' ? 'status-active' : vehicle.status === 'repair' ? 'status-repair' : 'status-service'">{{ vehicle.status === 'active' ? 'Faol' : vehicle.status === 'repair' ? 'Remontda' : 'Servisda' }}</span>
          </div>

          <div class="mt-4 flex items-center gap-2 border-y border-[#f0f2f0] py-3">
            <div v-if="vehicle.driverId" class="avatar avatar-small avatar-driver">{{ initials(store.driverName(vehicle.driverId)) }}</div>
            <div v-else class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-canvas text-slate-400"><UserRoundPlus :size="15" /></div>
            <div class="min-w-0 flex-1"><p class="text-[9px] font-semibold uppercase tracking-wide text-muted">Haydovchi</p><p class="mt-0.5 truncate text-xs font-semibold" :class="vehicle.driverId ? 'text-ink' : 'text-slate-400'">{{ vehicle.driverId ? store.driverName(vehicle.driverId) : 'Biriktirilmagan' }}</p></div>
            <button v-if="canManage" class="btn-quiet !p-1.5" :title="vehicle.driverId ? 'Tahrirlash' : 'Haydovchi biriktirish'" @click="editing = vehicle"><Pencil :size="14" /></button>
          </div>

          <div class="mt-3 grid grid-cols-3 gap-2">
            <div class="rounded-xl bg-canvas px-2.5 py-2"><p class="text-[9px] text-muted">Reys</p><p class="mt-1 text-sm font-bold text-ink">{{ statsByVehicle[vehicle.id]?.trips ?? 0 }}</p></div>
            <div class="rounded-xl bg-canvas px-2.5 py-2"><p class="text-[9px] text-muted">Soat</p><p class="mt-1 text-sm font-bold text-ink">{{ number(statsByVehicle[vehicle.id]?.hours ?? 0, 1) }}</p></div>
            <div class="rounded-xl bg-canvas px-2.5 py-2"><p class="text-[9px] text-muted">Tashildi</p><p class="mt-1 text-sm font-bold text-ink">{{ number(statsByVehicle[vehicle.id]?.tons ?? 0, 0) }} <small class="text-[9px] font-medium text-muted">t</small></p></div>
          </div>
          <div class="mt-3 flex items-center justify-between text-[10px]"><span class="text-muted">Xarajat</span><strong class="text-ink">{{ money(statsByVehicle[vehicle.id]?.spent ?? 0, { short: true }) }}</strong></div>

          <div v-if="canManage" class="mt-4 flex gap-2">
            <button class="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[10px] font-bold text-muted transition hover:border-leaf hover:text-leaf" @click="toggleStatus(vehicle)"><Settings2 :size="13" />{{ vehicle.status === 'active' ? 'Servisga' : 'Ishga' }}</button>
            <button class="flex items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[10px] font-bold text-muted transition hover:border-leaf hover:text-leaf" @click="editing = vehicle"><Pencil :size="13" /> Tahrirlash</button>
          </div>
        </article>

        <div v-if="!vehicles.length" class="rounded-2xl border border-dashed border-line px-6 py-12 text-center md:col-span-2 xl:col-span-3">
          <Truck :size="22" class="mx-auto mb-2 text-slate-400" />
          <p class="text-sm font-semibold text-ink">{{ store.vehicles.length ? 'Filtrga mos texnika yo‘q' : 'Park bo‘sh' }}</p>
          <p class="mt-1 text-xs text-muted">{{ store.vehicles.length ? 'Qidiruv yoki filtrni o‘zgartiring.' : 'Birinchi samosvalni qo‘shing.' }}</p>
          <button v-if="canManage && !store.vehicles.length" class="btn-primary mt-4" @click="openCreate"><Plus :size="16" /> Texnika qo‘shish</button>
        </div>
      </div>
      <footer v-if="withoutDriver" class="flex items-center gap-2 border-t border-line px-5 py-3 text-[10px] text-amber"><CircleAlert :size="13" />{{ withoutDriver }} ta faol texnikada haydovchi biriktirilmagan.</footer>
    </section>

    <ModalDialog v-model="showCreate" title="Yangi texnika qo‘shish" description="Raqam, marka va haydovchini kiriting.">
      <VehicleForm :drivers="drivers" :initial-driver-id="newDriverId" :can-add-driver="store.canManageStaff" :loading="saving" @submit="create" @add-driver="openDriverForm" @cancel="showCreate = false" />
    </ModalDialog>
    <ModalDialog :model-value="Boolean(editing)" title="Texnikani tahrirlash" description="Ma’lumot va haydovchini yangilang." @update:model-value="editing = null">
      <VehicleForm v-if="editing" :key="`${editing.id}-${editing.driverId || 'none'}`" :drivers="drivers" :initial-driver-id="newDriverId" :user="editing" :can-add-driver="store.canManageStaff" :loading="saving" @submit="save" @add-driver="openDriverForm" @cancel="editing = null" />
    </ModalDialog>
    <ModalDialog v-model="showDriver" title="Yangi haydovchi qo‘shish" description="Login va parol shu zahotiyoq yaratiladi." width="max-w-2xl">
      <StaffForm :roles="store.roles" :initial-role-id="driverRole" :demo-mode="!store.remoteMode" :loading="saving" @submit="createDriver" @cancel="showDriver = false" />
    </ModalDialog>
    <ModalDialog :model-value="Boolean(credentials)" title="Xodim tizimga tayyor" description="Login va parolni xodimga yetkazing." @update:model-value="credentials = null">
      <div class="space-y-4">
        <div class="rounded-2xl border border-mint bg-[#f4f9ff] p-4"><p class="text-[10px] font-bold uppercase tracking-wide text-muted">{{ credentials?.name }}</p><dl class="mt-3 space-y-2 text-sm"><div class="flex items-center justify-between gap-3"><dt class="text-muted">Login</dt><dd><code class="rounded-md bg-white px-2 py-1 text-xs font-bold text-ink">{{ credentials?.login }}</code></dd></div><div class="flex items-center justify-between gap-3"><dt class="text-muted">Parol</dt><dd><code class="rounded-md bg-white px-2 py-1 text-xs font-bold text-ink">{{ credentials?.password }}</code></dd></div></dl></div>
        <div class="flex justify-end gap-2"><button class="btn-secondary" type="button" @click="credentials = null">Yopish</button><button class="btn-primary" type="button" @click="copyCredentials"><Check v-if="copied" :size="15" /><Copy v-else :size="15" />{{ copied ? 'Nusxalandi' : 'Nusxa olish' }}</button></div>
      </div>
    </ModalDialog>
  </div>
</template>
