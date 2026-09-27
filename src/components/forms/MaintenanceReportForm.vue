<script setup>
import { reactive, ref } from 'vue'
import { Wrench, Info } from 'lucide-vue-next'
import FormActions from './FormActions.vue'

const props = defineProps({ vehicles: { type: Array, default: () => [] }, loading: Boolean })
const emit = defineEmits(['submit', 'cancel'])
const form = reactive({ vehicleId: '', description: '' })
const error = ref('')
function submit() {
  error.value = ''
  if (!form.vehicleId) { error.value = 'Texnikani tanlang.'; return }
  if (!form.description.trim()) { error.value = 'Nosozlikni qisqacha yozing.'; return }
  emit('submit', { ...form })
}
</script>

<template>
  <form @submit.prevent="submit">
    <div class="flex gap-3 rounded-2xl bg-[#fff7eb] p-4 text-[#956320]"><div class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white"><Wrench :size="17" /></div><div><p class="text-sm font-bold">Tezkor xabar</p><p class="mt-1 text-[11px] leading-4">Xabar boshliq va buxgalter panelida darhol ko‘rinadi.</p></div></div>
    <label class="mt-5 block"><span class="label">Texnika</span><select v-model="form.vehicleId" class="field" required><option value="">Samosvalni tanlang</option><option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.id">{{ vehicle.plate }} · {{ vehicle.model }}</option></select></label>
    <label class="mt-4 block"><span class="label">Nosozlik tavsifi</span><textarea v-model="form.description" class="field min-h-[110px] resize-y" placeholder="Masalan: 1-samosvalning orqa chap baloni yorildi…" required></textarea></label>
    <div class="mt-3 flex items-start gap-2 text-[10px] leading-4 text-muted"><Info :size="14" class="mt-0.5 shrink-0" />Favqulodda xavf bo‘lsa, ishni to‘xtatib, mas’ul shaxsga telefon qiling.</div>
    <p v-if="error" class="mt-3 text-xs font-semibold text-danger">{{ error }}</p>
    <FormActions :loading="loading" submit-label="Xabar yuborish" @cancel="emit('cancel')" />
  </form>
</template>
