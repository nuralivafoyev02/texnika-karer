<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ArrowDownLeft, ArrowUpRight, Truck, UserRound, UsersRound } from 'lucide-vue-next'
import FormActions from './FormActions.vue'

const props = defineProps({
  category: { type: Object, default: null },
  defaultDirection: { type: String, default: 'out' },
  loading: Boolean,
})
const emit = defineEmits(['submit', 'cancel'])

const form = reactive({ label: '', hint: '', direction: 'out', needsClient: false, needsVehicle: false, needsDriver: false })
const error = ref('')
const isEdit = computed(() => Boolean(props.category))

watch(() => [props.category, props.defaultDirection], () => {
  form.label = props.category?.label || ''
  form.hint = props.category?.hint || ''
  form.direction = props.category?.direction || props.defaultDirection
  form.needsClient = props.category?.needsClient === true
  form.needsVehicle = props.category?.needsVehicle === true
  form.needsDriver = props.category?.needsDriver === true
}, { immediate: true })

// Yo‘nalishni o‘zgartirish mavjud yozuvlarni noyob qilib qo‘yadi, shuning uchun
// tahrirlashda qulf langadi — yangi turi yaratgandagina tanlanadi.
function setDirection(direction) { if (!isEdit.value) form.direction = direction }

function submit() {
  error.value = ''
  const label = form.label.trim()
  const hint = form.hint.trim()
  if (label.length < 2) { error.value = 'Tur nomini kiriting (kamida 2 ta belgi).'; return }
  if (label.length > 60) { error.value = 'Tur nomi 60 ta belgidan oshmasligi kerak.'; return }
  if (hint.length > 140) { error.value = 'Izoh 140 ta belgidan oshmasligi kerak.'; return }
  emit('submit', { ...form, label, hint })
}
</script>

<template>
  <form @submit.prevent="submit">
    <fieldset :disabled="isEdit">
      <legend class="label">Yo‘nalish</legend>
      <div class="grid grid-cols-2 gap-2">
        <button type="button" :class="form.direction === 'in' ? 'border-leaf bg-mint text-forest ring-2 ring-emerald-50' : 'border-line bg-white text-muted'" class="flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition" @click="setDirection('in')"><ArrowDownLeft :size="16" /> Daromat</button>
        <button type="button" :class="form.direction === 'out' ? 'border-leaf bg-mint text-forest ring-2 ring-emerald-50' : 'border-line bg-white text-muted'" class="flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition" :disabled="isEdit" @click="setDirection('out')"><ArrowUpRight :size="16" /> Xarajat</button>
      </div>
      <p v-if="isEdit" class="mt-1.5 text-[10px] text-muted">Tayyor turing yo‘nalishini o‘zgartirib bo‘lmaydi.</p>
    </fieldset>

    <div class="mt-4 grid gap-4">
      <label><span class="label">Tur nomi</span><input v-model="form.label" class="field" maxlength="60" placeholder="Masalan, Qadoqlash xarajati" required /></label>
      <label><span class="label">Izoh <span class="normal-case tracking-normal text-slate-400">(ixtiyoriy)</span></span><input v-model="form.hint" class="field" maxlength="140" placeholder="Qachon va kim uchun qo‘llanadi" /></label>
    </div>

    <div class="mt-4 rounded-xl border border-line p-3">
      <p class="mb-2 text-xs font-bold text-ink">Majburiy bog‘lanishlar</p>
      <label v-if="form.direction === 'in'" class="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-canvas">
        <input v-model="form.needsClient" type="checkbox" class="mt-0.5 h-4 w-4 accent-[#2a7650]" />
        <span class="min-w-0"><span class="flex items-center gap-1.5 text-xs font-semibold text-ink"><UsersRound :size="13" /> Mijoz majburiy</span><span class="mt-0.5 block text-[10px] leading-4 text-muted">Bu turdagi kirimda mijoz tanlash shart bo‘ladi.</span></span>
      </label>
      <template v-else>
        <label class="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-canvas">
          <input v-model="form.needsVehicle" type="checkbox" class="mt-0.5 h-4 w-4 accent-[#2a7650]" />
          <span class="min-w-0"><span class="flex items-center gap-1.5 text-xs font-semibold text-ink"><Truck :size="13" /> Texnika maydoni</span><span class="mt-0.5 block text-[10px] leading-4 text-muted">Xarajat formasida samosval tanlash maydoni ochiladi.</span></span>
        </label>
        <label class="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-canvas">
          <input v-model="form.needsDriver" type="checkbox" class="mt-0.5 h-4 w-4 accent-[#2a7650]" />
          <span class="min-w-0"><span class="flex items-center gap-1.5 text-xs font-semibold text-ink"><UserRound :size="13" /> Haydovchi majburiy</span><span class="mt-0.5 block text-[10px] leading-4 text-muted">Bunday xarajatni haydovchisiz kiritib bo‘lmaydi.</span></span>
        </label>
      </template>
    </div>

    <p v-if="error" class="mt-3 text-xs font-semibold text-danger">{{ error }}</p>
    <FormActions :loading="loading" :submit-label="isEdit ? 'O‘zgarishni saqlash' : 'Turi yaratish'" @cancel="emit('cancel')" />
  </form>
</template>
