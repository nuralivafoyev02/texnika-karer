<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { CircleDollarSign, WalletCards } from 'lucide-vue-next'
import FormActions from './FormActions.vue'
import { money, captureAmountInput, parseAmountInput } from '../../lib/format'

const props = defineProps({ clients: { type: Array, default: () => [] }, categories: { type: Array, default: () => [] }, balanceFor: { type: Function, default: () => 0 }, initialClientId: { type: String, default: '' }, loading: Boolean })
const emit = defineEmits(['submit', 'cancel'])
// Daromat turlari Sozlamalar → Moliya bo‘limida yaratiladi; ro‘yxat bo‘sh bo‘lsa
// tizim standarti (mijoz to‘lovi) qo‘llanadi.
const fallbackCategories = [{ key: 'customer_payment', label: 'Mijoz to‘lovi', hint: 'Kelgan to‘lov mijoz balansini kamaytiradi', needsClient: true }]
const options = computed(() => (props.categories.length ? props.categories : fallbackCategories))
const form = reactive({
  clientId: props.initialClientId,
  amount: '', paymentMethod: 'cash', note: '',
  category: options.value.find((item) => item.key === 'customer_payment')?.key ?? options.value[0]?.key ?? 'customer_payment',
})
const error = ref('')
const chosenClient = computed(() => props.clients.find((client) => client.id === form.clientId))
const chosenBalance = computed(() => chosenClient.value ? props.balanceFor(chosenClient.value.id) : 0)
const selectedCategory = computed(() => options.value.find((item) => item.key === form.category) ?? options.value[0])
const needsClient = computed(() => selectedCategory.value?.needsClient !== false)
watch(() => props.initialClientId, (value) => { form.clientId = value || '' })
watch(() => form.category, () => { if (!needsClient.value) form.clientId = '' })
function submit() {
  error.value = ''
  const amount = parseAmountInput(form.amount)
  if (needsClient.value && !form.clientId) { error.value = 'Mijozni tanlang.'; return }
  if (!(amount > 0)) { error.value = 'To‘lov summasini kiriting.'; return }
  emit('submit', { ...form, amount })
}
// Summa maydoni: har 3 xonada bo'shliq bilan yoziladi, saqlashda raqamga aylanadi.
const onAmount = (event) => captureAmountInput(event, (value) => { form.amount = value })
</script>

<template>
  <form @submit.prevent="submit">
    <div class="rounded-2xl bg-[#f4f8f5] p-4">
      <div class="mb-3 flex items-center gap-2 text-sm font-bold text-forest"><CircleDollarSign :size="17" /> {{ selectedCategory?.label || 'Mijoz to‘lovi' }}</div>
      <p class="text-xs leading-5 text-muted">{{ selectedCategory?.hint || 'To‘lov kassa yoki bank qoldig‘iga qo‘shiladi va mijoz balansidagi qarzni kamaytiradi.' }}</p>
    </div>
    <div class="mt-5 grid gap-4">
      <label v-if="options.length > 1"><span class="label">Daromat turi</span>
        <select v-model="form.category" class="field"><option v-for="item in options" :key="item.key" :value="item.key">{{ item.label }}</option></select>
      </label>
      <label v-if="needsClient"><span class="label">Mijoz</span><select v-model="form.clientId" class="field" required><option value="" disabled>Mijozni tanlang</option><option v-for="client in clients" :key="client.id" :value="client.id">{{ client.name }}</option></select></label>
      <div v-if="needsClient && chosenClient" class="flex items-center justify-between rounded-xl border border-line px-3.5 py-3 text-xs"><span class="text-muted">Joriy balans</span><strong class="text-ink">{{ money(chosenBalance) }}</strong></div>
      <label><span class="label">To‘lov summasi</span><div class="relative"><input :value="form.amount" class="field pr-14" type="text" inputmode="numeric" autocomplete="off" placeholder="0" @input="onAmount"><span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">so‘m</span></div></label>
      <fieldset><legend class="label">To‘lov turi</legend><div class="grid grid-cols-2 gap-2">
        <button type="button" :class="form.paymentMethod === 'cash' ? 'border-leaf bg-mint text-forest ring-2 ring-emerald-50' : 'border-line bg-white text-muted'" class="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold" @click="form.paymentMethod = 'cash'"><CircleDollarSign :size="17" /> Naqd kassa</button>
        <button type="button" :class="form.paymentMethod === 'bank' ? 'border-leaf bg-mint text-forest ring-2 ring-emerald-50' : 'border-line bg-white text-muted'" class="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold" @click="form.paymentMethod = 'bank'"><WalletCards :size="17" /> Bank</button>
      </div></fieldset>
      <label><span class="label">Izoh <span class="normal-case tracking-normal text-slate-400">(ixtiyoriy)</span></span><input v-model="form.note" class="field" placeholder="Masalan, shartnoma bo‘yicha" /></label>
      <p v-if="error" class="text-xs font-semibold text-danger">{{ error }}</p>
    </div>
    <FormActions :loading="loading" submit-label="To‘lovni saqlash" @cancel="emit('cancel')" />
  </form>
</template>
