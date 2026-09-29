<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  width: { type: String, default: 'max-w-xl' },
})
const emit = defineEmits(['update:modelValue'])
function close() { emit('update:modelValue', false) }
function onKey(event) { if (event.key === 'Escape' && props.modelValue) close() }
watch(() => props.modelValue, (value) => { document.body.style.overflow = value ? 'hidden' : '' })
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' })
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed inset-0 z-[80] flex items-center justify-center bg-[#0e2244]/45 p-4 backdrop-blur-[3px]" @click.self="close">
        <section :class="width" data-modal-panel class="max-h-[calc(100vh-32px)] w-full overflow-y-auto rounded-lg border border-white/50 bg-white shadow-float">
          <header class="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-white/95 px-6 py-5 backdrop-blur">
            <div><h2 class="text-lg font-bold tracking-tight text-ink">{{ title }}</h2><p v-if="description" class="mt-1 text-xs text-muted">{{ description }}</p></div>
            <button class="btn-quiet !p-2" aria-label="Yopish" @click="close"><X :size="18" /></button>
          </header>
          <div class="px-6 py-5"><slot :close="close" /></div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
