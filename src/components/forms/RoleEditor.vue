<script setup>
import { computed, reactive, watch, ref } from 'vue'
import { ShieldCheck } from 'lucide-vue-next'
import { PERMISSION_GROUPS } from '../../lib/permissions'
import FormActions from './FormActions.vue'

const props = defineProps({ role: { type: Object, default: null }, catalog: { type: Array, default: () => [] }, loading: Boolean })
const emit = defineEmits(['submit', 'cancel'])
const form = reactive({ id: '', name: '', description: '', permissions: [] })
const error = ref('')
const groupedPermissions = computed(() => PERMISSION_GROUPS.map((group) => ({ group, items: props.catalog.filter((item) => item.group === group) })))
watch(() => props.role, (role) => {
  form.id = role?.id || ''
  form.name = role?.name || ''
  form.description = role?.description || ''
  form.permissions = [...(role?.permissions || [])]
}, { immediate: true })
function toggle(key) {
  form.permissions = form.permissions.includes(key) ? form.permissions.filter((item) => item !== key) : [...form.permissions, key]
}
function selectGroup(items, enabled) {
  const keys = items.map((item) => item.key)
  form.permissions = enabled ? [...new Set([...form.permissions, ...keys])] : form.permissions.filter((key) => !keys.includes(key))
}
function submit() {
  error.value = ''
  if (!form.name.trim()) { error.value = 'Lavozim nomini kiriting.'; return }
  emit('submit', { ...form, name: form.name.trim() })
}
</script>

<template>
  <form @submit.prevent="submit">
    <div class="grid gap-4 sm:grid-cols-2">
      <label><span class="label">Lavozim nomi</span><input v-model="form.name" class="field" placeholder="Masalan, Omborchi" required /></label>
      <label><span class="label">Qisqa tavsif</span><input v-model="form.description" class="field" placeholder="Ushbu lavozim vazifalari" /></label>
    </div>
    <div class="mt-5 flex items-center justify-between rounded-xl bg-[#f4f8f5] px-3.5 py-3">
      <div class="flex items-center gap-2 text-xs font-bold text-forest"><ShieldCheck :size="16" /> Ruxsatlar <span class="rounded-md bg-white px-1.5 py-0.5 text-[10px] text-leaf">{{ form.permissions.length }}</span></div>
      <span class="text-[10px] text-muted">Faqat tanlangan bo‘limlar ochiladi</span>
    </div>
    <div class="mt-3 max-h-[45vh] space-y-3 overflow-y-auto pr-1">
      <section v-for="group in groupedPermissions" :key="group.group" class="rounded-xl border border-line p-3">
        <div class="mb-2 flex items-center justify-between"><h3 class="text-xs font-bold text-ink">{{ group.group }}</h3><button type="button" class="text-[10px] font-semibold text-leaf hover:underline" @click="selectGroup(group.items, !group.items.every((item) => form.permissions.includes(item.key)))">{{ group.items.every((item) => form.permissions.includes(item.key)) ? 'Hammasini bekor qilish' : 'Hammasini tanlash' }}</button></div>
        <label v-for="permission in group.items" :key="permission.key" class="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-canvas">
          <input :checked="form.permissions.includes(permission.key)" type="checkbox" class="mt-0.5 h-4 w-4 accent-[#2a7650]" @change="toggle(permission.key)" />
          <span class="min-w-0"><span class="block text-xs font-semibold text-ink">{{ permission.label }}</span><span class="mt-0.5 block text-[10px] leading-4 text-muted">{{ permission.description }}</span></span>
        </label>
      </section>
    </div>
    <p v-if="error" class="mt-3 text-xs font-semibold text-danger">{{ error }}</p>
    <FormActions :loading="loading" submit-label="Lavozimni saqlash" @cancel="emit('cancel')" />
  </form>
</template>
