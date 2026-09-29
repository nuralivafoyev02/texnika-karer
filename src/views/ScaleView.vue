<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Scale, Truck, UserRound, UsersRound, Camera, ImagePlus, CircleCheck, ArrowLeft,
  Weight, Clock3, Coins, Sparkles, ChevronDown, X, ClipboardCheck, Plus,
} from 'lucide-vue-next'
import ModalDialog from '../components/ModalDialog.vue'
import VehicleForm from '../components/forms/VehicleForm.vue'
import { useQuarryStore } from '../stores/quarry'
import { money, number, dateTime, initials } from '../lib/format'
import { sectionShort } from '../lib/guide'

const store = useQuarryStore()
const router = useRouter()
const route = useRoute()
const form = reactive({ vehicleId: '', saleType: 'credit', clientId: '', materialId: '', weightTons: '', hoursWorked: '1.2' })
const photoFile = ref(null)
const photoPreview = ref('')
const saving = ref(false)
const error = ref('')
const latestTrip = ref(null)
const fileInput = ref(null)
const showVehicle = ref(false)
const vehicleSaving = ref(false)
const activeVehicles = computed(() => store.vehicles.filter((vehicle) => vehicle.status === 'active'))
const selectedVehicle = computed(() => store.vehicles.find((vehicle) => vehicle.id === form.vehicleId))
const selectedDriver = computed(() => store.users.find((user) => user.id === selectedVehicle.value?.driverId))
const selectedMaterial = computed(() => store.materials.find((material) => material.id === form.materialId))
const selectedClient = computed(() => store.clients.find((client) => client.id === form.clientId))
const amount = computed(() => Math.round(Number(form.weightTons || 0) * Number(selectedMaterial.value?.unitPrice || 0) * 100) / 100)
const readyToSave = computed(() => Boolean(form.vehicleId && form.materialId && Number(form.weightTons) > 0 && (form.saleType === 'cash' || form.clientId)))
watch(activeVehicles, (vehicles) => { if (!form.vehicleId && vehicles.length) form.vehicleId = vehicles[0].id }, { immediate: true })
watch(() => store.materials, (materials) => { if (!form.materialId && materials.length) form.materialId = materials[0].id }, { immediate: true })
watch(() => store.clients, (clients) => { if (!form.clientId && clients.length) form.clientId = clients[0].id }, { immediate: true })
async function addVehicle(payload) {
  vehicleSaving.value = true
  try {
    const vehicle = await store.createVehicle(payload)
    showVehicle.value = false
    if (vehicle?.id) form.vehicleId = vehicle.id
  } catch (err) { error.value = err.message || 'Texnika qo‘shib bo‘lmadi.' }
  finally { vehicleSaving.value = false }
}
function choosePhoto(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { error.value = 'Faqat rasm faylini tanlang.'; return }
  // Serverga yuklanadigan rasm kichik bo'lishi kerak; demo rejimida rasm faqat
  // brauzer xotirasida saqlanadi, shuning uchun chegara bo'shroq.
  const sizeLimit = store.remoteMode ? 1_500_000 : 10_000_000
  if (file.size > sizeLimit) { error.value = `Rasm hajmi ${sizeLimit >= 10_000_000 ? '10' : '1,5'} MB dan oshmasligi kerak.`; return }
  error.value = ''
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photoFile.value = file
  photoPreview.value = URL.createObjectURL(file)
}
function removePhoto() {
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photoFile.value = null
  photoPreview.value = ''
  if (fileInput.value) fileInput.value.value = ''
}
async function submit() {
  error.value = ''
  if (!readyToSave.value) { error.value = 'Barcha majburiy maydonlarni to‘ldiring.'; return }
  saving.value = true
  try {
    latestTrip.value = await store.createTrip({ ...form, photoFile: photoFile.value })
    removePhoto()
    form.weightTons = ''
    form.hoursWorked = '1.2'
  } catch (exception) {
    error.value = exception.message || 'Reysni saqlashda xatolik yuz berdi.'
  } finally { saving.value = false }
}
onBeforeUnmount(() => { if (photoPreview.value) URL.revokeObjectURL(photoPreview.value) })
</script>

<template>
  <div class="mx-auto max-w-[1150px] space-y-5">
    <button class="btn-quiet !px-1 !py-1 text-xs" @click="router.push('/trips')"><ArrowLeft :size="15" /> Reyslar jurnaliga qaytish</button>
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div><div class="mb-1 flex items-center gap-2 text-xs font-semibold text-leaf"><Scale :size="15" /> Tarozixona</div><h1 class="page-title">Yangi reys</h1><p class="page-subtitle">{{ sectionShort(route.path) }}</p></div>
      <div v-if="activeVehicles.length" class="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-xs text-muted"><span class="status-dot"></span> {{ activeVehicles.length }} ta faol texnika</div>
    </div>

    <div v-if="latestTrip" class="flex items-center gap-3 rounded-2xl border border-[#cde4d4] bg-[#f0f8f2] p-4"><div class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-leaf"><CircleCheck :size="20" /></div><div class="min-w-0 flex-1"><p class="text-sm font-bold text-forest">Reys muvaffaqiyatli tasdiqlandi</p><p class="mt-0.5 text-xs text-muted">{{ latestTrip.id }} · {{ number(latestTrip.weightTons, 1) }} t · {{ dateTime(latestTrip.createdAt) }}</p></div><button class="btn-secondary !px-3 !py-2 text-xs" @click="router.push('/trips')">Jurnalni ko‘rish</button><button class="btn-quiet !p-1" @click="latestTrip = null"><X :size="15" /></button></div>

    <form class="grid items-start gap-5 lg:grid-cols-12" @submit.prevent="submit">
      <section class="card overflow-hidden lg:col-span-8">
        <div class="flex items-center gap-3 border-b border-line bg-[#fbfcfb] px-5 py-4 sm:px-6"><div class="grid h-9 w-9 place-items-center rounded-xl bg-mint text-leaf"><ClipboardCheck :size="18" /></div><div><h2 class="text-sm font-bold text-ink">Reys ma’lumotlari</h2><p class="mt-0.5 text-[10px] text-muted">1-qadam · Transport va mijoz</p></div><span class="ml-auto rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-muted">1 / 2</span></div>
        <div class="space-y-6 p-5 sm:p-6">
          <div class="grid gap-4 sm:grid-cols-2">
            <label><span class="label">Samosval</span><div class="relative"><Truck :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-leaf" /><select v-model="form.vehicleId" class="field appearance-none pl-10 pr-9" required><option value="" disabled>Texnikani tanlang</option><option v-for="vehicle in activeVehicles" :key="vehicle.id" :value="vehicle.id">{{ vehicle.plate }} · {{ vehicle.model }}</option></select><ChevronDown :size="14" class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" /></div></label>
            <div v-if="!activeVehicles.length" class="rounded-xl border border-dashed border-[#e8d3ae] bg-[#fff9ef] px-3 py-2.5 sm:col-span-2"><p class="text-[11px] font-semibold text-[#96621d]">Reys uchun faol texnika kerak.</p><button v-if="store.can('fleet.manage')" class="btn-secondary mt-2 !border-[#e8d3ae] !bg-white !text-[#96621d]" @click="showVehicle = true"><Plus :size="14" /> Texnika qo‘shish</button></div>
            <div v-else><span class="label">Biriktirilgan haydovchi</span><div class="flex h-[42px] items-center gap-2.5 rounded-xl border border-line bg-[#f8faf8] px-3"><div class="avatar avatar-small avatar-driver">{{ initials(selectedDriver?.fullName) }}</div><div class="min-w-0"><p class="truncate text-xs font-semibold text-ink">{{ selectedDriver?.fullName || 'Haydovchi biriktirilmagan' }}</p><p class="mt-0.5 text-[9px] text-muted">{{ selectedDriver?.phone || 'Telefon kiritilmagan' }}</p></div></div></div>
          </div>

          <div>
            <div class="mb-2 flex items-center justify-between"><span class="label !mb-0">Mijoz / sotuv turi</span></div>
            <div class="grid gap-2 sm:grid-cols-2">
              <button type="button" :class="form.saleType === 'credit' ? 'border-leaf bg-mint/70 ring-2 ring-emerald-50' : 'border-line bg-white hover:bg-canvas'" class="flex items-center gap-3 rounded-xl border p-3.5 text-left" @click="form.saleType = 'credit'"><div class="grid h-9 w-9 place-items-center rounded-xl bg-white text-leaf"><UsersRound :size="17" /></div><span><strong class="block text-xs text-ink">Mijozga hisobga</strong><small class="mt-1 block text-[10px] text-muted">Balansga qarz sifatida yoziladi</small></span><span class="ml-auto h-4 w-4 rounded-full border" :class="form.saleType === 'credit' ? 'border-[5px] border-leaf bg-white' : 'border-slate-300'"></span></button>
              <button type="button" :class="form.saleType === 'cash' ? 'border-leaf bg-mint/70 ring-2 ring-emerald-50' : 'border-line bg-white hover:bg-canvas'" class="flex items-center gap-3 rounded-xl border p-3.5 text-left" @click="form.saleType = 'cash'"><div class="grid h-9 w-9 place-items-center rounded-xl bg-white text-amber"><Coins :size="17" /></div><span><strong class="block text-xs text-ink">Naqd savdo</strong><small class="mt-1 block text-[10px] text-muted">Tushum kassaga qo‘shiladi</small></span><span class="ml-auto h-4 w-4 rounded-full border" :class="form.saleType === 'cash' ? 'border-[5px] border-leaf bg-white' : 'border-slate-300'"></span></button>
            </div>
            <label v-if="form.saleType === 'credit'" class="mt-3 block"><span class="label">Mijozni tanlang</span><div class="relative"><UserRound :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><select v-model="form.clientId" class="field pl-10" required><option value="" disabled>Mijozlar ro‘yxati</option><option v-for="client in store.clients" :key="client.id" :value="client.id">{{ client.name }}</option></select></div></label>
          </div>

          <div class="border-t border-dashed border-line pt-5">
            <div class="mb-3 flex items-center justify-between"><div><h3 class="text-xs font-bold text-ink">Yuk ma’lumotlari</h3><p class="mt-1 text-[10px] text-muted">2-qadam · Material va tarozi ko‘rsatkichi</p></div><Sparkles :size="16" class="text-amber" /></div>
            <div class="grid gap-4 sm:grid-cols-2">
              <label><span class="label">Tosh turi</span><select v-model="form.materialId" class="field" required><option value="" disabled>Tosh turini tanlang</option><option v-for="material in store.materials.filter((item) => item.isActive)" :key="material.id" :value="material.id">{{ material.name }} · {{ money(material.unitPrice, { short: true }) }}/t</option></select></label>
              <label><span class="label">Og‘irligi</span><div class="relative"><Weight :size="17" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-leaf" /><input v-model="form.weightTons" class="field pl-10 pr-12 !py-3" type="number" min="0.1" step="0.1" inputmode="decimal" placeholder="0.0" required /><span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">tonna</span></div></label>
              <label><span class="label">Ish vaqti <span class="normal-case tracking-normal text-slate-400">(ixtiyoriy)</span></span><div class="relative"><Clock3 :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="form.hoursWorked" class="field pl-10 pr-12" type="number" min="0" step="0.1" placeholder="1.2" /><span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted">soat</span></div></label>
              <div><span class="label">Yuk fotosurati <span class="normal-case tracking-normal text-slate-400">(tavsiya etiladi)</span></span><input ref="fileInput" type="file" accept="image/*" capture="environment" class="hidden" @change="choosePhoto" /><div v-if="!photoPreview" class="flex h-[42px] items-center gap-3 rounded-xl border border-dashed border-[#bfd5c5] bg-[#f8fbf8] px-3"><button type="button" class="flex items-center gap-2 text-xs font-semibold text-leaf" @click="fileInput?.click()"><ImagePlus :size="16" /> Rasm tanlash</button><span class="text-[10px] text-slate-400">JPG yoki PNG · maks. {{ store.remoteMode ? '10' : '1,5' }} MB</span></div><div v-else class="flex h-[42px] items-center gap-2 rounded-xl border border-line px-2"><img :src="photoPreview" alt="Yuk rasmi" class="h-8 w-8 rounded-lg object-cover" /><span class="min-w-0 flex-1 truncate text-[10px] font-semibold text-ink">{{ photoFile?.name }}</span><button type="button" class="btn-quiet !p-1.5" @click="removePhoto"><X :size="14" /></button></div></div>
            </div>
          </div>
          <div v-if="error" class="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-xs font-semibold text-danger">{{ error }}</div>
        </div>
      </section>

      <aside class="space-y-4 lg:sticky lg:top-[98px] lg:col-span-4">
        <div class="overflow-hidden rounded-2xl bg-[#174a32] text-white shadow-soft">
          <div class="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><p class="text-[10px] font-bold uppercase tracking-[.15em] text-[#acd0b7]">Reys hisob-kitobi</p><p class="mt-1 text-xs text-white/65">Narx avtomatik hisoblandi</p></div><div class="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-[#b9ddc3]"><Coins :size="18" /></div></div>
          <div class="px-5 py-5"><div class="flex items-end justify-between gap-3"><div><p class="text-[10px] text-white/65">Umumiy qiymati</p><p class="mt-1 text-[27px] font-bold tracking-tight">{{ money(amount, { currency: false }) }}<span class="ml-1 text-xs font-semibold text-white/60">so‘m</span></p></div><div class="mb-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-[#d2ead9]">{{ selectedMaterial ? money(selectedMaterial.unitPrice) : 'Narx yo‘q' }} / t</div></div>
            <div class="mt-5 space-y-2 border-t border-white/10 pt-4 text-xs"><div class="flex justify-between text-white/65"><span>Og‘irlik</span><strong class="font-semibold text-white">{{ number(form.weightTons, 1) }} t</strong></div><div class="flex justify-between text-white/65"><span>Mahsulot</span><strong class="font-semibold text-white">{{ selectedMaterial?.name || 'Tanlanmagan' }}</strong></div><div class="flex justify-between text-white/65"><span>Sotuv turi</span><strong class="font-semibold text-white">{{ form.saleType === 'cash' ? 'Naqd savdo' : 'Mijozga hisobga' }}</strong></div></div>
          </div>
          <div class="bg-white/[.07] px-5 py-3 text-[10px] leading-4 text-white/65">Tasdiqlangan reys jurnalga yoziladi.</div>
        </div>

        <div class="card p-4">
          <p class="text-[10px] font-bold uppercase tracking-[.12em] text-muted">Tekshirish</p>
          <div class="mt-3 space-y-2.5">
            <div class="flex items-center gap-2.5 text-xs"><span class="grid h-6 w-6 place-items-center rounded-lg bg-mint text-leaf"><Truck :size="13" /></span><span class="flex-1 text-muted">Samosval</span><strong class="max-w-[145px] truncate text-right text-ink">{{ selectedVehicle?.plate || 'Tanlanmagan' }}</strong></div>
            <div class="flex items-center gap-2.5 text-xs"><span class="grid h-6 w-6 place-items-center rounded-lg bg-[#edf3fa] text-[#4f7595]"><UserRound :size="13" /></span><span class="flex-1 text-muted">Haydovchi</span><strong class="max-w-[145px] truncate text-right text-ink">{{ selectedDriver?.fullName || '—' }}</strong></div>
            <div v-if="form.saleType === 'credit'" class="flex items-center gap-2.5 text-xs"><span class="grid h-6 w-6 place-items-center rounded-lg bg-[#fff4e3] text-amber"><UsersRound :size="13" /></span><span class="flex-1 text-muted">Mijoz</span><strong class="max-w-[145px] truncate text-right text-ink">{{ selectedClient?.name || 'Tanlanmagan' }}</strong></div>
          </div>
        </div>

        <button type="submit" class="btn-primary w-full !rounded-2xl !py-3.5 !text-sm" :disabled="saving || !readyToSave || !activeVehicles.length"><CircleCheck :size="18" />{{ saving ? 'Saqlanmoqda…' : 'Reysni tasdiqlash' }}</button>
      </aside>
    </form>
    <ModalDialog v-model="showVehicle" title="Yangi texnika qo‘shish" description="Reys kiritish uchun samosval kerak.">
      <VehicleForm :drivers="store.drivers" :can-add-driver="store.canManageStaff" :loading="vehicleSaving" @submit="addVehicle" @cancel="showVehicle = false" />
    </ModalDialog>
  </div>
</template>
