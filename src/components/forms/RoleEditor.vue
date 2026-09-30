<script setup>
import { computed, reactive, watch, ref } from 'vue'
import { ShieldCheck, CircleAlert, LockKeyhole } from 'lucide-vue-next'
import { PERMISSION_GROUPS } from '../../lib/permissions'
import { useQuarryStore } from '../../stores/quarry'
import FormActions from './FormActions.vue'

const props = defineProps({ role: { type: Object, default: null }, catalog: { type: Array, default: () => [] }, loading: Boolean })
const emit = defineEmits(['submit', 'cancel'])
const store = useQuarryStore()
const form = reactive({ id: '', name: '', description: '', permissions: [], grantsAll: false })
const error = ref('')
const groupedPermissions = computed(() => PERMISSION_GROUPS.map((group) => ({ group, items: props.catalog.filter((item) => item.group === group) })))
// To'liq huquq = katalogdagi BARCHA kalitlar YOKI "grantsAll" belgisi. Bu yagona ta'rif:
// store (roleHasFullAccess) va baza (role_has_full_access()) ham shu qoidani qo'llaydi.
const total = computed(() => props.catalog.length)
const missing = computed(() => props.catalog.filter((item) => !form.permissions.includes(item.key)))
const isFullAccess = computed(() => form.grantsAll || (total.value > 0 && missing.value.length === 0))
// Berish mumkin bo'lgan kalitlar: to'liq huquqli xodim hammasini beradi,
// qolganlari faqat o'zlarida bor kalitni (serverdagi subset qoidasi bilan bir xil).
const heldKeys = computed(() => new Set(store.isSuperadmin() ? props.catalog.map((item) => item.key) : (store.currentRole?.permissions ?? [])))
const isGrantable = (key) => form.grantsAll || heldKeys.value.has(key)
const lockedKeys = computed(() => missing.value.filter((item) => !heldKeys.value.has(item.key)))
// Ruxsat kalitlarini massiv qilib qaytaradi (eski holat undefined qaytarib,
// `form.permissions` undefined bo'lib, shablon `.length` da xato berardi).
function grantableOnly() {
  return props.catalog.filter((item) => heldKeys.value.has(item.key)).map((item) => item.key)
}
function toggleFullAccess() {
  form.grantsAll = false
  form.permissions = isFullAccess.value ? [] : grantableOnly()
}
watch(() => props.role, (role) => {
  form.id = role?.id || ''
  form.name = role?.name || ''
  form.description = role?.description || ''
  form.grantsAll = role?.grantsAll === true
  form.permissions = [...(role?.permissions || [])]
}, { immediate: true })
function toggle(key) {
  form.permissions = form.permissions.includes(key) ? form.permissions.filter((item) => item !== key) : [...form.permissions, key]
}
function toggleGrantsAll() {
  form.grantsAll = !form.grantsAll
  if (form.grantsAll) form.permissions = grantableOnly()
}
function selectGroup(items, enabled) {
  const keys = items.map((item) => item.key).filter(isGrantable)
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
    <div class="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f4f8fd] px-3.5 py-3">
      <div class="flex items-center gap-2 text-xs font-bold text-forest"><ShieldCheck :size="16" /> Ruxsatlar <span class="rounded-md bg-white px-1.5 py-0.5 text-[10px] text-leaf">{{ form.permissions.length }} / {{ total }}</span></div>
      <button v-if="!form.grantsAll" type="button" class="text-[10px] font-bold text-leaf hover:underline" @click="toggleFullAccess">{{ isFullAccess ? 'To‘liq huquqni olib tashlash' : 'To‘liq huquq berish' }}</button>
    </div>
    <!-- grantsAll: lavozimga yangi ruxsat kaliti qo'shilsa ham u avtomatik beriladi.
         Qo'lda "barchasini belgilash" esa yangi kalitda superadminni buzardi. -->
    <label class="mt-2 flex cursor-pointer items-start gap-2 rounded-lg bg-[#f4f8fd] px-3 py-2.5 text-[10px] leading-4 text-forest">
      <input :checked="form.grantsAll" type="checkbox" class="mt-0.5 h-4 w-4 accent-[#1f90ff]" @change="toggleGrantsAll" />
      <span class="min-w-0"><b>Barcha ruxsatlar avtomatik</b><template v-if="form.grantsAll"> — <b>{{ form.permissions.length }} / {{ total }}</b></template>.</span>
    </label>
    <div v-if="isFullAccess" class="mt-2 flex items-start gap-2 rounded-lg bg-[#eefaf1] px-3 py-2 text-[10px] leading-4 text-[#2c6b46]">
      <ShieldCheck :size="13" class="mt-px shrink-0" />
      <span>To‘liq huquq: ushbu lavozimdagi xodimlar <b>superadmin</b> bo‘lib, lavozim va ruxsatlarni boshqaradi.</span>
    </div>
    <div v-else class="mt-2 flex items-start gap-2 rounded-lg bg-[#fff7ec] px-3 py-2 text-[10px] leading-4 text-[#8a5a12]">
      <CircleAlert :size="13" class="mt-px shrink-0" />
      <span>To‘liq huquq uchun yana <b>{{ missing.length }} ta</b> ruxsat kerak<template v-if="lockedKeys.length"> — shulardan {{ lockedKeys.length }} tasi sizda yo‘q, shuning uchun berib bo‘lmaydi</template>.</span>
    </div>
    <div class="mt-3 max-h-[45vh] space-y-3 overflow-y-auto pr-1">
      <section v-for="group in groupedPermissions" :key="group.group" class="rounded-xl border border-line p-3">
        <div class="mb-2 flex items-center justify-between"><h3 class="text-xs font-bold text-ink">{{ group.group }}</h3><button type="button" class="text-[10px] font-semibold text-leaf hover:underline" @click="selectGroup(group.items, !group.items.every((item) => form.permissions.includes(item.key)))">{{ group.items.every((item) => form.permissions.includes(item.key)) ? 'Hammasini bekor qilish' : 'Hammasini tanlash' }}</button></div>
        <label v-for="permission in group.items" :key="permission.key" class="flex items-start gap-3 rounded-lg px-2 py-2" :class="isGrantable(permission.key) ? 'cursor-pointer hover:bg-canvas' : 'cursor-not-allowed opacity-60'">
          <input :checked="form.permissions.includes(permission.key)" :disabled="!isGrantable(permission.key)" type="checkbox" class="mt-0.5 h-4 w-4 accent-[#1f90ff]" @change="toggle(permission.key)" />
          <span class="min-w-0"><span class="flex flex-wrap items-center gap-1.5"><span class="text-xs font-semibold text-ink">{{ permission.label }}</span><span v-if="!isGrantable(permission.key)" class="inline-flex items-center gap-1 rounded bg-[#f1f4f8] px-1.5 py-0.5 text-[9px] font-semibold text-muted"><LockKeyhole :size="9" /> sizda yo‘q</span></span><span class="mt-0.5 block text-[10px] leading-4 text-muted">{{ permission.description }}</span></span>
        </label>
      </section>
    </div>
    <p v-if="error" class="mt-3 text-xs font-semibold text-danger">{{ error }}</p>
    <FormActions :loading="loading" submit-label="Lavozimni saqlash" @cancel="emit('cancel')" />
  </form>
</template>
