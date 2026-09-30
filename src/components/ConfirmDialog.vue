<script setup>
import { TriangleAlert } from 'lucide-vue-next'
import ModalDialog from './ModalDialog.vue'

// window.confirm o'rniga: dizaynga mos, telefonda ham qulay tasdiqlash oynasi.
const open = defineModel({ type: Boolean, default: false })
defineProps({
  title: { type: String, default: 'Tasdiqlang' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'O‘chirish' },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['confirm'])
</script>

<template>
  <ModalDialog v-model="open" :title="title" width="max-w-sm">
    <div class="flex items-start gap-3">
      <div class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-danger"><TriangleAlert :size="19" /></div>
      <div class="min-w-0 pt-0.5 text-sm leading-6 text-ink/80">
        <p>{{ message }}</p>
        <slot />
      </div>
    </div>
    <div class="mt-5 flex justify-end gap-2">
      <button type="button" class="btn-quiet" :disabled="loading" @click="open = false">Bekor qilish</button>
      <button type="button" class="btn-danger" :disabled="loading" @click="emit('confirm')">{{ loading ? 'Bajarilmoqda…' : confirmLabel }}</button>
    </div>
  </ModalDialog>
</template>
