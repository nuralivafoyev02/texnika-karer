<script setup>
import { reactive, ref, watch } from 'vue'
import { Truck, UserRoundPlus } from 'lucide-vue-next'
import FormActions from './FormActions.vue'

const props = defineProps({
  drivers: { type: Array, default: () => [] },
  loading: Boolean,
  user: { type: Object, default: null },
  canAddDriver: Boolean,
})
const emit = defineEmits(['submit', 'cancel', 'add-driver'])
const isEdit = Boolean(props.user)
const form = reactive({ plate: '', model: '', year: '', status: 'active', driverId: '' })
const error = ref('')

watch(() => props.user, (user) => {
  if (!user) return
  Object.assign(form, {
    plate: user.plate ?? '', model: user.model ?? '', year: user.year ?? '',
    status: user.status ?? 'active', driverId: user.driverId || '',
  })
}, { immediate: true })

const PLATE_PATTERN = /^[A-Z0-9][A-Z0-9\s-]{2,15}$/
function submit() {
  error.value = ''
  const plate = form.plate.trim().toUpperCase()
  if (!PLATE_PATTERN.test(plate)) { error.value = 'Raqam 3–16 ta belgi: harflar, raqamlar, bo‘shliq yoki chiziqcha.'; return }
  if (!form.model.trim()) { error.value = 'Texnika markasini kiriting.'; return }
  if (form.year && (Number(form.year) < 1950 || Number(form.year) > new Date().getFullYear() + 1)) {
    error.value = 'Ilojiy yil noto‘g‘ri.'; return
  }
  emit('submit', { ...form, plate, model: form.model.trim(), year: form.year ? Number(form.year) : null, driverId: form.driverId || null })
}
</script>

<template>
  <form @submit.prevent="submit">
    <div class="grid gap-4 sm:grid-cols-2">
      <label><span class="label">Texnika raqami</span><input v-model="form.plate" class="field uppercase" placeholder="01 B 123 KA" maxlength="16" autocomplete="off" spellcheck="false" required /></label>
      <label><span class="label">Marka / model</span><input v-model="form.model" class="field" placeholder="MAN TGS 6x4" required /></label>
      <label><span class="label">Ilojiy yili</span><input v-model="form.year" class="field" type="number" min="1950" :max="new Date().getFullYear() + 1" placeholder="2021" /></label>
      <label><span class="label">Holati</span><select v-model="form.status" class="field"><option value="active">Faol — reys ochish mumkin</option><option value="service">Servisda</option><option value="repair">Remontda</option></select></label>
      <label class="sm:col-span-2">
        <span class="label">Haydovchi</span>
        <div class="flex gap-2">
          <select v-model="form.driverId" class="field flex-1">
            <option value="">Biriktirilmagan</option>
            <option v-for="person in drivers" :key="person.id" :value="person.id">{{ person.fullName }}{{ person.phone ? ` · ${person.phone}` : '' }}</option>
          </select>
          <button v-if="canAddDriver" type="button" class="btn-secondary shrink-0 !px-3" title="Yangi haydovchi qo‘shish" @click="emit('add-driver')"><UserRoundPlus :size="16" /></button>
        </div>
        <span class="mt-1 block text-[10px] text-muted">Faqat <b>Haydovchi</b> huquqiga ega xodimlar ro‘yxatda chiqadi. Yaratish superadmin tomonidan amalga oshiriladi.</span>
      </label>
    </div>
    <div class="mt-4 flex gap-2 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-[11px] leading-4 text-blue-800"><Truck :size="15" class="mt-0.5 shrink-0" /><span>Texnika serviska o‘tkazilsa, uni reyslarga tanlab bo‘lmaydi.</span></div>
    <p v-if="error" class="mt-3 text-xs font-semibold text-danger">{{ error }}</p>
    <FormActions :loading="loading" :submit-label="isEdit ? 'Saqlash' : 'Texnika qo‘shish'" @cancel="emit('cancel')" />
  </form>
</template>
