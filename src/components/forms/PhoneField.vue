<script setup>
// Telefon maydoni: `+998` doimiy prefiks, kiritilgan raqam esa avtomatik
// formatlanadi ("901234567" → "90 123 45 67"). Komponent bitta joyda yig'ilgan —
// shakllarda (xodim, mijoz, o'z profili) bir xil ko'rinish va xatti-harakat.
import { computed } from 'vue'
import { capturePhoneInput, formatNational, phoneProblem, PHONE_MAX_LENGTH } from '../../lib/phone'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: 'Telefon' },
  hint: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

// Model qiymati saqlanadigan shakl (to'liq "+998 90 …"), maydonga esa milliy qism.
const national = computed(() => formatNational(props.modelValue))
const problem = computed(() => phoneProblem(props.modelValue))
const onInput = (event) => capturePhoneInput(event, (value) => emit('update:modelValue', value))
</script>

<template>
  <label class="block">
    <span class="label">{{ label }}</span>
    <div class="relative">
      <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 select-none text-sm text-slate-400">+998</span>
      <input
        :value="national"
        class="field pl-14"
        type="tel"
        inputmode="numeric"
        autocomplete="off"
        spellcheck="false"
        :maxlength="PHONE_MAX_LENGTH"
        placeholder="90 123 45 67"
        @input="onInput"
      />
    </div>
    <span v-if="problem" class="mt-1 block text-[10px] font-semibold text-danger">{{ problem }}</span>
    <span v-else-if="hint" class="mt-1 block text-[10px] text-muted">{{ hint }}</span>
  </label>
</template>
