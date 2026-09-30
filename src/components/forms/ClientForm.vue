<script setup>
import { computed, reactive, ref } from 'vue'
import FormActions from './FormActions.vue'
import PhoneField from './PhoneField.vue'
import { captureAmountInput, parseAmountInput } from '../../lib/format'
import { formatPhone, phoneProblem } from '../../lib/phone'

const props = defineProps({ loading: Boolean })
const emit = defineEmits(['submit', 'cancel'])
const form = reactive({ name: '', contactName: '', phone: '', openingBalance: '' })
const error = ref('')
const onBalance = (event) => captureAmountInput(event, (value) => { form.openingBalance = value })
const phoneError = computed(() => phoneProblem(form.phone))
function submit() {
  error.value = ''
  if (!form.name.trim()) { error.value = 'Korxona yoki mijoz nomini kiriting.'; return }
  if (phoneError.value) { error.value = phoneError.value; return }
  emit('submit', { ...form, phone: formatPhone(form.phone), openingBalance: parseAmountInput(form.openingBalance) })
}
</script>

<template>
  <form @submit.prevent="submit">
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="sm:col-span-2"><span class="label">Mijoz / korxona nomi</span><input v-model="form.name" class="field" placeholder="Masalan, Toshkent Yo‘l Qurilish" required /></label>
      <label><span class="label">Mas’ul shaxs</span><input v-model="form.contactName" class="field" placeholder="Ism familiya" /></label>
      <PhoneField v-model="form.phone" label="Telefon" hint="Aloqa uchun. +998 avtomatik qo‘shiladi." />
      <label class="sm:col-span-2"><span class="label">Boshlang‘ich balans</span><input :value="form.openingBalance" class="field" type="text" inputmode="text" autocomplete="off" placeholder="0" @input="onBalance" /><span class="mt-1 block text-[11px] text-muted">Musbat summa — mijoz qarzi; manfiy summa — mijoz avansi.</span></label>
    </div>
    <p v-if="error" class="mt-3 text-xs font-semibold text-danger">{{ error }}</p>
    <FormActions :loading="loading" submit-label="Mijozni qo‘shish" @cancel="emit('cancel')" />
  </form>
</template>
