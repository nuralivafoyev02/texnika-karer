<script setup>
import { computed, ref } from 'vue'
import { Truck, UserRound, Weight, Clock3, Boxes, CalendarClock, WalletCards, Image as ImageIcon, StickyNote } from 'lucide-vue-next'
import ModalDialog from './ModalDialog.vue'
import { useQuarryStore } from '../stores/quarry'
import { dateTime, money, number, displayId } from '../lib/format'
import { isAutoApproved, isPendingMonitoring, monitoringLabel } from '../lib/monitoring'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  trip: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue'])
const store = useQuarryStore()

// Fotosurat modal ichida ochiladi: tashqi handler yozmaslik uchun
// preview o'zi rasmni yuklaydi (remote rejida — signed URL oladi).
const photoOpen = ref(false)
const photoLoading = ref(false)
const photoError = ref('')
async function togglePhoto() {
  if (photoOpen.value) { photoOpen.value = false; return }
  photoOpen.value = true
  photoError.value = ''
  const trip = props.trip
  if (!trip || trip.photoUrl || !store.remoteMode) return
  photoLoading.value = true
  try {
    if (!await store.ensurePhotoUrl(trip)) photoError.value = 'Rasmni yuklab bo‘lmadi. RLS ruxsatini tekshiring.'
  } catch (error) {
    photoError.value = error.message || 'Rasmni yuklab bo‘lmadi.'
  } finally { photoLoading.value = false }
}

const vehicle = computed(() => store.vehicles.find((item) => item.id === props.trip?.vehicleId))

// Asosiy tafsilotlar: qiymat faqat ruxsati bor xodimga ko'rinadi.
const details = computed(() => {
  const trip = props.trip
  if (!trip) return []
  const rows = [
    { icon: CalendarClock, label: 'Sana va vaqt', value: dateTime(trip.createdAt) },
    { icon: Truck, label: 'Texnika', value: store.vehicleName(trip.vehicleId) },
    { icon: UserRound, label: 'Haydovchi', value: store.driverName(trip.driverId) },
    { icon: Boxes, label: 'Tosh turi', value: store.materialName(trip.materialId) },
    { icon: WalletCards, label: 'Mijoz', value: store.tripClient(trip) },
    { icon: Weight, label: 'Og‘irlik', value: `${number(trip.weightTons, 1)} t` },
    { icon: Clock3, label: 'Ishlangan vaqt', value: `${number(trip.hoursWorked, 1)} soat` },
  ]
  if (store.canSeePrices) {
    rows.push({ icon: WalletCards, label: 'Tonna narxi', value: money(trip.unitPrice) })
    rows.push({ icon: WalletCards, label: 'Reys qiymati', value: money(trip.totalAmount) })
  }
  return rows
})
</script>

<template>
  <ModalDialog
    :model-value="modelValue"
    title="Reys tafsiloti"
    :description="trip ? `${dateTime(trip.createdAt)} · ${store.materialName(trip.materialId)}` : ''"
    width="max-w-2xl"
    @update:model-value="(value) => emit('update:modelValue', value)"
  >
    <div v-if="trip" class="space-y-4">
      <!-- Yuqori blok: og'irlik va holatlar -->
      <div class="overflow-hidden rounded-2xl bg-[#0a4fa8] p-5 text-white">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-white/55">Yuk og‘irligi</p>
            <p class="mt-1 text-3xl font-bold tracking-tight">{{ number(trip.weightTons, 1) }} <span class="text-base font-semibold text-white/70">tonna</span></p>
            <p class="mt-1.5 flex items-center gap-1.5 text-xs text-white/75"><Truck :size="14" /> {{ vehicle?.plate || '—' }}<span v-if="vehicle?.model" class="text-white/55">· {{ vehicle.model }}</span></p>
          </div>
          <div class="flex flex-col items-end gap-2">
            <span class="rounded-lg bg-white/15 px-2.5 py-1 text-[10px] font-bold">{{ trip.saleType === 'cash' ? 'Naqd savdo' : 'Hisobga (qarzga)' }}</span>
            <span class="rounded-lg px-2.5 py-1 text-[10px] font-bold" :class="isPendingMonitoring(trip) ? 'bg-[#ffefcf] text-[#764b16]' : 'bg-white/15 text-white'">{{ monitoringLabel(trip) }}</span>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-white/15 pt-3 text-[10px] text-white/70">
          <span v-if="isAutoApproved(trip)" class="rounded-md bg-white/10 px-2 py-1 font-semibold" title="Avtomatik tasdiqlangan">Avto tasdiqlangan</span>
          <span v-else-if="trip.monitoringNote" class="truncate rounded-md bg-white/10 px-2 py-1 font-semibold">Monitoring izohi: {{ trip.monitoringNote }}</span>
          <span class="ml-auto font-mono" :title="trip.id">ID: {{ displayId(trip.id) }}</span>
        </div>
      </div>

      <!-- Tafsilotlar -->
      <dl class="grid gap-2.5 sm:grid-cols-2">
        <div v-for="row in details" :key="row.label" class="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-3.5 py-3">
          <dt class="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-muted"><component :is="row.icon" :size="14" class="shrink-0 text-slate-400" />{{ row.label }}</dt>
          <dd class="truncate text-xs font-bold text-ink">{{ row.value }}</dd>
        </div>
      </dl>

      <!-- Savdo turi va izoh -->
      <div class="space-y-2.5">
        <div class="flex items-center justify-between rounded-xl border border-line px-3.5 py-3 text-xs">
          <span class="font-semibold text-muted">Hisobga yozish</span>
          <span class="font-bold text-ink">{{ trip.saleType === 'cash' ? 'Naqd — kassaga tushadi' : 'Mijoz balansiga qarz yoziladi' }}</span>
        </div>
        <div v-if="trip.note" class="flex items-start gap-2.5 rounded-xl border border-line bg-canvas px-3.5 py-3 text-xs">
          <StickyNote :size="14" class="mt-0.5 shrink-0 text-slate-400" />
          <p class="leading-relaxed text-ink"><span class="font-bold">Izoh:</span> {{ trip.note }}</p>
        </div>
      </div>

      <!-- Fotosurat (preview ichida ochiladi) -->
      <div v-if="photoOpen" class="space-y-2">
        <div v-if="photoLoading" class="grid h-[35vh] place-items-center rounded-xl bg-canvas text-xs text-muted">Rasm yuklanmoqda…</div>
        <img v-else-if="trip.photoUrl" :src="trip.photoUrl" :alt="`Reys ${displayId(trip.id)} yuk surati`"
          class="max-h-[50vh] w-full rounded-xl bg-canvas object-contain" />
        <div v-else class="grid h-[24vh] place-items-center rounded-xl bg-canvas px-4 text-center text-xs text-muted">{{ photoError || 'Bu reys uchun rasm biriktirilmagan.' }}</div>
      </div>

      <div class="flex items-center justify-between gap-2 border-t border-line pt-3">
        <button v-if="store.hasPhoto(trip)" class="btn-secondary !py-2 text-xs" type="button" @click="togglePhoto">
          <ImageIcon :size="15" /> {{ photoOpen ? 'Fotosurati yashirish' : 'Yuk fotosuratini ko‘rish' }}
        </button>
        <span v-else class="text-[11px] text-muted">Fotosurat biriktirilmagan</span>
        <button class="btn-primary !py-2 text-xs" type="button" @click="emit('update:modelValue', false)">Yopish</button>
      </div>
    </div>
  </ModalDialog>
</template>
