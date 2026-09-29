<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Plus, Image, Download, Weight, Truck } from 'lucide-vue-next'
import ModalDialog from '../components/ModalDialog.vue'
import { useQuarryStore } from '../stores/quarry'
import { dateTime, money, number, isToday } from '../lib/format'
import { sectionShort } from '../lib/guide'

const store = useQuarryStore()
const route = useRoute()
const router = useRouter()
const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const period = ref('all')
const saleType = ref('all')
const selectedPhoto = ref(null)
const photoLoading = ref(false)
const photoError = ref('')
const filteredTrips = computed(() => [...store.trips]
  .filter((trip) => {
    const search = query.value.trim().toLowerCase()
    const joined = [trip.id, store.tripClient(trip), store.vehicleName(trip.vehicleId), store.driverName(trip.driverId), store.materialName(trip.materialId)].join(' ').toLowerCase()
    return (!search || joined.includes(search)) && (period.value !== 'today' || isToday(trip.createdAt)) && (saleType.value === 'all' || trip.saleType === saleType.value)
  })
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
const filteredTons = computed(() => filteredTrips.value.reduce((sum, trip) => sum + Number(trip.weightTons), 0))
const filteredSales = computed(() => filteredTrips.value.reduce((sum, trip) => sum + Number(trip.totalAmount), 0))
async function openPhoto(trip) {
  selectedPhoto.value = trip
  photoError.value = ''
  if (store.remoteMode) {
    photoLoading.value = true
    try {
      if (!await store.ensurePhotoUrl(trip)) photoError.value = 'Rasmni yuklab bo‘lmadi. RLS ruxsatini tekshiring.'
    } catch (error) {
      photoError.value = error.message || 'Rasmni yuklab bo‘lmadi.'
    } finally { photoLoading.value = false }
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div><div class="mb-1 flex items-center gap-2 text-xs font-semibold text-leaf"><Weight :size="15" /> Ishlab chiqarish</div><h1 class="page-title">Reyslar jurnali</h1><p class="page-subtitle">{{ sectionShort(route.path) }}</p></div>
      <button v-if="store.can('trips.create')" class="btn-primary" @click="router.push('/scale')"><Plus :size="17" /> Yangi reys kiritish</button>
    </div>

    <section class="grid gap-3 sm:grid-cols-3">
      <div class="card flex items-center gap-3 p-4"><div class="grid h-10 w-10 place-items-center rounded-xl bg-mint text-leaf"><Truck :size="18" /></div><div><p class="text-[10px] font-semibold uppercase tracking-wide text-muted">Ko‘rsatilgan reys</p><p class="mt-1 text-lg font-bold text-ink">{{ filteredTrips.length }} <span class="text-xs font-medium text-muted">ta</span></p></div></div>
      <div class="card flex items-center gap-3 p-4"><div class="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf2fa] text-[#4f7595]"><Weight :size="18" /></div><div><p class="text-[10px] font-semibold uppercase tracking-wide text-muted">Jami og‘irlik</p><p class="mt-1 text-lg font-bold text-ink">{{ number(filteredTons, 1) }} <span class="text-xs font-medium text-muted">tonna</span></p></div></div>
      <div class="card flex items-center gap-3 p-4"><div class="grid h-10 w-10 place-items-center rounded-xl bg-[#fff4e3] text-[#b77824]"><Download :size="18" /></div><div><p class="text-[10px] font-semibold uppercase tracking-wide text-muted">Sotuv qiymati</p><p class="mt-1 text-lg font-bold text-ink">{{ money(filteredSales, { short: true }) }}</p></div></div>
    </section>

    <section class="card overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div class="relative w-full sm:max-w-[300px]"><Search :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="query" class="field !py-2.5 !pl-9" placeholder="Reys, mijoz yoki samosval..." /></div>
        <div class="flex flex-wrap items-center gap-2"><select v-model="period" class="field !w-auto !py-2.5"><option value="all">Barcha sanalar</option><option value="today">Faqat bugun</option></select><select v-model="saleType" class="field !w-auto !py-2.5"><option value="all">Barcha savdo</option><option value="credit">Hisobga</option><option value="cash">Naqd savdo</option></select></div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[870px] border-collapse text-left">
          <thead><tr class="table-head border-b border-line"><th class="px-5 py-3">Reys / Sana</th><th class="px-4 py-3">Texnika / Haydovchi</th><th class="px-4 py-3">Mijoz</th><th class="px-4 py-3">Tosh turi</th><th class="px-4 py-3">Og‘irlik / vaqt</th><th class="px-4 py-3">Savdo turi</th><th class="px-5 py-3 text-right">Qiymati</th></tr></thead>
          <tbody>
            <tr v-for="trip in filteredTrips" :key="trip.id" class="border-b border-[#f0f2f0] last:border-0 hover:bg-[#fbfcfb]">
              <td class="px-5 py-3.5"><div class="flex items-center gap-2"><p class="text-xs font-bold text-ink">{{ trip.id }}</p><button v-if="store.hasPhoto(trip)" class="grid h-6 w-6 place-items-center rounded-md bg-mint text-leaf hover:bg-[#dcece0]" title="Yuk fotosurati" @click="openPhoto(trip)"><Image :size="13" /></button></div><p class="mt-1 text-[10px] text-muted">{{ dateTime(trip.createdAt) }}</p></td>
              <td class="px-4 py-3.5"><p class="text-xs font-semibold text-ink">{{ store.vehicles.find((v) => v.id === trip.vehicleId)?.plate || '—' }}</p><p class="mt-1 text-[10px] text-muted">{{ store.driverName(trip.driverId) }}</p></td>
              <td class="max-w-[180px] px-4 py-3.5"><p class="truncate text-xs text-ink">{{ store.tripClient(trip) }}</p></td>
              <td class="px-4 py-3.5"><span class="tag tag-blue">{{ store.materialName(trip.materialId) }}</span></td>
              <td class="px-4 py-3.5"><p class="text-xs font-bold text-ink">{{ number(trip.weightTons, 1) }} t</p><p class="mt-1 text-[10px] text-muted">{{ number(trip.hoursWorked, 1) }} soat</p></td>
              <td class="px-4 py-3.5"><span :class="trip.saleType === 'cash' ? 'tag-cash' : 'tag-credit'" class="tag">{{ trip.saleType === 'cash' ? 'Naqd' : 'Hisobga' }}</span></td>
              <td class="px-5 py-3.5 text-right"><p class="text-xs font-bold text-ink">{{ money(trip.totalAmount, { short: true }) }}</p><p class="mt-1 text-[10px] text-muted">{{ money(trip.unitPrice, { short: true }) }} / t</p></td>
            </tr>
            <tr v-if="!filteredTrips.length"><td colspan="7" class="px-6 py-16 text-center"><div class="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-canvas text-muted"><Search :size="19" /></div><p class="text-sm font-semibold text-ink">Reys topilmadi</p><p class="mt-1 text-xs text-muted">Qidiruv yoki filtrlarni o‘zgartirib ko‘ring.</p></td></tr>
          </tbody>
        </table>
      </div>
      <footer class="flex items-center justify-between border-t border-line px-5 py-3 text-[10px] text-muted"><span>{{ filteredTrips.length }} ta yozuv ko‘rsatildi</span></footer>
    </section>

    <ModalDialog :model-value="Boolean(selectedPhoto)" title="Yuk fotosurati" description="Reysga biriktirilgan tasdiqlovchi surat." width="max-w-2xl" @update:model-value="(value) => { if (!value) selectedPhoto = null }">
      <div v-if="selectedPhoto" class="space-y-4"><div v-if="photoLoading" class="grid h-[45vh] place-items-center rounded-xl bg-canvas text-xs text-muted">Rasm yuklanmoqda…</div><img v-else-if="selectedPhoto.photoUrl" :src="selectedPhoto.photoUrl" :alt="`Reys ${selectedPhoto.id} yuk surati`" class="max-h-[65vh] w-full rounded-xl object-contain bg-canvas" /><div v-else class="grid h-[30vh] place-items-center rounded-xl bg-canvas px-4 text-center text-xs text-muted">{{ photoError || 'Bu reys uchun rasm biriktirilmagan.' }}</div><div class="flex items-center justify-between text-xs"><span class="font-bold text-ink">{{ selectedPhoto.id }} · {{ store.materialName(selectedPhoto.materialId) }}</span><span class="text-muted">{{ number(selectedPhoto.weightTons, 1) }} t</span></div></div>
    </ModalDialog>
  </div>
</template>
