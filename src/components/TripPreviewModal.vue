<script setup>
import { computed, ref, watch } from 'vue'
import { Weight, Clock3, Coins, StickyNote, ImageOff, FileDown, Image as ImageIcon, EyeOff } from 'lucide-vue-next'
import ModalDialog from './ModalDialog.vue'
import PreviewSection from './PreviewSection.vue'
import DropdownMenu from './DropdownMenu.vue'
import { useQuarryStore } from '../stores/quarry'
import { dateTime, money, number, displayId, tripCode } from '../lib/format'
import { isAutoApproved, isPendingMonitoring, monitoringLabel, monitoringTagClass } from '../lib/monitoring'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  trip: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue'])
const store = useQuarryStore()

// Fotosurat faqat "Rasmni ko'rish" bosilganda yuklanadi (remote rejimda — signed URL).
const photoOpen = ref(false)
const photoLoading = ref(false)
const photoError = ref('')
async function showPhoto() {
  const trip = props.trip
  if (!trip) return
  photoOpen.value = true
  photoError.value = ''
  if (trip.photoUrl || !store.remoteMode) return
  photoLoading.value = true
  try {
    if (!await store.ensurePhotoUrl(trip)) photoError.value = 'Rasmni yuklab bo‘lmadi.'
  } catch (error) {
    photoError.value = error.message || 'Rasmni yuklab bo‘lmadi.'
  } finally { photoLoading.value = false }
}
// Boshqa reys ochilganda yoki oyna yopilganda rasm yana yashiriladi.
watch(() => [props.modelValue, props.trip?.id], () => { photoOpen.value = false; photoError.value = '' })

// ── Uch nuqtali menyu: reys varaqasini PDF qilib yuklab olish ──────────────
const downloading = ref(false)
async function downloadPdf() {
  if (!props.trip || downloading.value) return
  downloading.value = true
  try {
    const { downloadTripPdf } = await import('../lib/tripPdf')
    await downloadTripPdf(props.trip, store)
    store.notify('Reys varaqasi yuklab olindi.')
  } catch (error) {
    store.notify(error?.message || 'PDF tayyorlab bo‘lmadi.', 'error')
  } finally { downloading.value = false }
}
const menuItems = computed(() => [{ label: 'Yuklab olish (PDF)', icon: FileDown, action: downloadPdf }])

const vehicle = computed(() => store.vehicles.find((item) => item.id === props.trip?.vehicleId))
const userName = (id) => (id ? store.users.find((user) => user.id === id)?.fullName ?? '' : '')

const stats = computed(() => {
  const trip = props.trip
  if (!trip) return []
  const rows = [{ icon: Weight, label: 'Og‘irlik', value: `${number(trip.weightTons, 1)} t` }]
  if (store.canSeePrices) rows.push({ icon: Coins, label: 'Reys qiymati', value: money(trip.totalAmount), sub: `${money(trip.unitPrice)} / t` })
  rows.push({ icon: Clock3, label: 'Ish vaqti', value: `${number(trip.hoursWorked, 1)} soat` })
  return rows
})

const cargoRows = computed(() => {
  const trip = props.trip
  if (!trip) return []
  return [
    { label: 'Tosh turi', value: store.materialName(trip.materialId) },
    { label: 'Samosval', value: vehicle.value?.plate || '—', sub: vehicle.value?.model },
    { label: 'Haydovchi', value: store.driverName(trip.driverId) },
  ]
})
const saleRows = computed(() => {
  const trip = props.trip
  if (!trip) return []
  return [
    { label: 'Mijoz', value: store.tripClient(trip) },
    { label: 'Savdo turi', value: trip.saleType === 'cash' ? 'Naqd savdo' : 'Qarzga', tag: trip.saleType === 'cash' ? 'tag-cash' : 'tag-credit' },
    { label: 'Kiritildi', value: dateTime(trip.createdAt), sub: userName(trip.createdBy) },
  ]
})
const monitoringRows = computed(() => {
  const trip = props.trip
  if (!trip) return []
  return [
    { label: 'Holat', value: isAutoApproved(trip) ? 'Avto tasdiqlangan' : monitoringLabel(trip), tag: monitoringTagClass(trip) },
    { label: isPendingMonitoring(trip) ? 'Bekor qilgan' : 'Tasdiqlagan', value: trip.monitoredAt && !isAutoApproved(trip) ? userName(trip.monitoredBy) || '—' : '', sub: trip.monitoredAt && !isAutoApproved(trip) ? dateTime(trip.monitoredAt) : '' },
    { label: 'Izoh', value: trip.monitoringNote },
  ]
})
</script>

<template>
  <ModalDialog
    :model-value="modelValue"
    :title="trip ? `Reys ${tripCode(trip.id)}` : 'Reys'"
    :description="trip ? dateTime(trip.createdAt) : ''"
    width="max-w-2xl"
    @update:model-value="(value) => emit('update:modelValue', value)"
  >
    <template #actions>
      <DropdownMenu v-if="trip" :items="menuItems" :busy="downloading" label="Amallar" />
    </template>
    <div v-if="trip" class="space-y-4">
      <div class="grid gap-2.5" :class="stats.length === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'">
        <div v-for="(stat, index) in stats" :key="stat.label" class="rounded-xl px-4 py-3"
          :class="[index === 0 ? 'bg-mint' : 'bg-canvas', stats.length === 3 && index === 2 ? 'col-span-2 sm:col-span-1' : '']">
          <p class="flex items-center gap-1.5 text-[11px] font-semibold text-muted"><component :is="stat.icon" :size="13" /> {{ stat.label }}</p>
          <p class="mt-1 text-lg font-bold tracking-tight" :class="index === 0 ? 'text-forest' : 'text-ink'">{{ stat.value }}</p>
          <p v-if="stat.sub" class="text-[11px] text-muted">{{ stat.sub }}</p>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <PreviewSection title="Yuk va transport" :rows="cargoRows" />
        <PreviewSection title="Savdo" :rows="saleRows" />
      </div>

      <PreviewSection title="Monitoring" :rows="monitoringRows" />

      <div v-if="trip.note" class="flex items-start gap-2.5 rounded-xl border border-line bg-canvas px-4 py-3">
        <StickyNote :size="15" class="mt-0.5 shrink-0 text-muted" />
        <p class="text-[13px] leading-relaxed text-ink">{{ trip.note }}</p>
      </div>

      <section v-if="store.hasPhoto(trip)" class="overflow-hidden rounded-xl border border-line">
        <div class="flex items-center justify-between gap-3 bg-canvas px-4 py-2">
          <h3 class="text-[11px] font-bold uppercase tracking-wide text-muted">Yuk fotosurati</h3>
          <button v-if="photoOpen" type="button" class="flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-ink" @click="photoOpen = false"><EyeOff :size="14" /> Yashirish</button>
        </div>
        <button v-if="!photoOpen" type="button" class="flex w-full items-center justify-center gap-2 border-t border-line py-4 text-sm font-semibold text-leaf transition hover:bg-mint" @click="showPhoto">
          <ImageIcon :size="16" /> Rasmni ko‘rish
        </button>
        <template v-else>
          <div v-if="photoLoading" class="grid h-48 place-items-center border-t border-line text-xs text-muted">Rasm yuklanmoqda…</div>
          <a v-else-if="trip.photoUrl" :href="trip.photoUrl" target="_blank" rel="noopener" class="block border-t border-line bg-canvas">
            <img :src="trip.photoUrl" :alt="`Reys ${tripCode(trip.id)} yuk surati`" class="max-h-[46vh] w-full object-contain" />
          </a>
          <div v-else class="flex h-32 flex-col items-center justify-center gap-2 border-t border-line text-xs text-muted"><ImageOff :size="18" />{{ photoError || 'Rasm topilmadi.' }}</div>
        </template>
      </section>

      <div class="flex items-center justify-between gap-2 border-t border-line pt-3">
        <span class="font-mono text-[11px] text-muted" :title="trip.id">ID: {{ displayId(trip.id) }}</span>
        <button class="btn-primary !py-2 text-xs" type="button" @click="emit('update:modelValue', false)">Yopish</button>
      </div>
    </div>
  </ModalDialog>
</template>
