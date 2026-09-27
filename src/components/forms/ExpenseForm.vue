<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { WalletCards } from 'lucide-vue-next'
import FormActions from './FormActions.vue'
import { captureAmountInput, parseAmountInput } from '../../lib/format'

const props = defineProps({ vehicles: { type: Array, default: () => [] }, drivers: { type: Array, default: () => [] }, categories: { type: Array, default: () => [] }, initialCategory: { type: String, default: 'fuel' }, initialDriverId: { type: String, default: '' }, loading: Boolean })
const emit = defineEmits(['submit', 'cancel'])
// Moliya turlari Sozlamalar → Moliya bo‘limida yaratiladi; ro‘yxat bo‘sh bo‘lsa
// tizim standartlari ko‘rsatiladi.
const fallbackCategories = [
  { key: 'blasting', label: 'Portlatish ishlari', hint: 'Ruxsatnoma, portlovchi modda, mutaxassis', needsVehicle: false, needsDriver: false },
  { key: 'fuel', label: 'Yoqilg‘i-moylash', hint: 'Solyarka va moylash materiallari', needsVehicle: true, needsDriver: false },
  { key: 'repair', label: 'Texnika ta’miri', hint: 'Ehtiyot qismlar va usta haqi', needsVehicle: true, needsDriver: false },
  { key: 'salary', label: 'Oyliklar', hint: 'Smena va ma’muriyat ish haqi', needsVehicle: false, needsDriver: false },
  { key: 'payroll', label: 'Haydovchi avansi', hint: 'Haydovchi hisob-kitobidan avans', needsVehicle: false, needsDriver: true },
  { key: 'other', label: 'Boshqa xarajat', hint: 'Boshqa bo‘limlar uchun to‘lov', needsVehicle: false, needsDriver: false },
]
const options = computed(() => (props.categories.length ? props.categories : fallbackCategories))
const form = reactive({ category: props.initialCategory || 'fuel', amount: '', paymentMethod: 'cash', vehicleId: '', driverId: props.initialDriverId || '', note: '' })
watch(() => props.initialCategory, (value) => { form.category = value || 'fuel' })
watch(() => props.initialDriverId, (value) => { form.driverId = value || '' })
const error = ref('')
const selectedCategory = computed(() => options.value.find((category) => category.key === form.category))
watch(() => form.category, () => {
  form.vehicleId = ''
  if (!selectedCategory.value?.needsDriver) form.driverId = ''
})
function submit() {
  error.value = ''
  const amount = parseAmountInput(form.amount)
  if (!(amount > 0)) { error.value = 'Xarajat summasini kiriting.'; return }
  if (selectedCategory.value?.needsDriver && !form.driverId) { error.value = 'Haydovchini tanlang.'; return }
  emit('submit', { ...form, amount })
}
// Summa maydoni: har 3 xonada bo'shliq bilan yoziladi, saqlashda raqamga aylanadi.
const onAmount = (event) => captureAmountInput(event, (value) => { form.amount = value })
</script>

<template>
  <form @submit.prevent="submit">
    <label><span class="label">Xarajat yo‘nalishi</span><select v-model="form.category" class="field"><option v-for="item in options" :key="item.key" :value="item.key">{{ item.label }}</option></select><span class="mt-1.5 block text-[11px] text-muted">{{ selectedCategory?.hint }}</span></label>
    <div class="mt-4 grid gap-4 sm:grid-cols-2">
      <label><span class="label">Summa</span><div class="relative"><input :value="form.amount" class="field pr-14" type="text" inputmode="numeric" autocomplete="off" placeholder="0" @input="onAmount"><span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">so‘m</span></div></label>
      <label v-if="selectedCategory?.needsVehicle"><span class="label">Texnika <span class="normal-case tracking-normal text-slate-400">(ixtiyoriy)</span></span><select v-model="form.vehicleId" class="field"><option value="">Umumiy xarajat</option><option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.id">{{ vehicle.plate }} · {{ vehicle.model }}</option></select></label>
      <label v-if="selectedCategory?.needsDriver" class="sm:col-span-2"><span class="label">Haydovchi</span><select v-model="form.driverId" class="field"><option value="">Haydovchini tanlang</option><option v-for="driver in drivers" :key="driver.id" :value="driver.id">{{ driver.fullName }}</option></select></label>
    </div>
    <fieldset class="mt-4"><legend class="label">To‘lov manbasi</legend><div class="grid grid-cols-2 gap-2">
      <button type="button" :class="form.paymentMethod === 'cash' ? 'border-leaf bg-mint text-forest ring-2 ring-emerald-50' : 'border-line bg-white text-muted'" class="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold" @click="form.paymentMethod = 'cash'"><span class="h-2 w-2 rounded-full bg-amber"></span> Naqd kassa</button>
      <button type="button" :class="form.paymentMethod === 'bank' ? 'border-leaf bg-mint text-forest ring-2 ring-emerald-50' : 'border-line bg-white text-muted'" class="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold" @click="form.paymentMethod = 'bank'"><WalletCards :size="16" /> Bank</button>
    </div></fieldset>
    <label class="mt-4 block"><span class="label">Izoh</span><input v-model="form.note" class="field" placeholder="Xarajat tafsiloti" /></label>
    <p v-if="error" class="mt-3 text-xs font-semibold text-danger">{{ error }}</p>
    <FormActions :loading="loading" submit-label="Xarajatni saqlash" @cancel="emit('cancel')" />
  </form>
</template>
