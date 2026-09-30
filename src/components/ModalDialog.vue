<script>
// Ochiq modallar steki MODUL darajasida saqlanadi: <script setup> har bir
// komponentga alohida nusxa yaratardi, stek esa umumiy bo'lishi shart
// (masalan kvitansiya ustidan reys preview ochilganda z-index tartibi).
// Eslatma: bu blok `<script setup>` bilan birga ishlaydi va uning
// o'zgaruvchilariga reference bo'lishi mumkin.
const openStack = []
const stackVersion = ref(0)
let instanceSeq = 0
</script>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

// Qoidalar:
//   • z-index ochilish tartibida o'sadi — keyin ochilgani oldinda turadi;
//   • Escape va body-scroll faqat ENG YUQORIDAGI modalga ta'sir qiladi;
//   • X tugmasi har doim o'z modalini yopadi (u faqat o'z emitini yuboradi).

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  width: { type: String, default: 'max-w-xl' },
})
const emit = defineEmits(['update:modelValue'])
const instanceId = ++instanceSeq

// isTop har bir hisobda stackVersion'ni o'qiydi: yuqoridagi modal
// yopilganda ostidagi modalning indeksi o'zgarmasa ham stale bo'lmasligi
// kerak — aks holda Escape faqat eng yuqoriga ishlardi.
const isTop = computed(() => {
  stackVersion.value
  const current = openStack.indexOf(instanceId)
  return current !== -1 && current === openStack.length - 1
})
const zIndex = computed(() => {
  stackVersion.value
  return 80 + Math.max(0, openStack.indexOf(instanceId))
})

function close() { emit('update:modelValue', false) }
function onKey(event) { if (event.key === 'Escape' && props.modelValue && isTop.value) close() }

watch(() => props.modelValue, (value) => {
  const index = openStack.indexOf(instanceId)
  if (value && index === -1) { openStack.push(instanceId); stackVersion.value += 1 }
  if (!value && index !== -1) { openStack.splice(index, 1); stackVersion.value += 1 }
  document.body.style.overflow = openStack.length ? 'hidden' : ''
}, { immediate: true })

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  const index = openStack.indexOf(instanceId)
  if (index !== -1) { openStack.splice(index, 1); stackVersion.value += 1 }
  document.body.style.overflow = openStack.length ? 'hidden' : ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed inset-0 flex items-center justify-center bg-[#0e2244]/45 p-4 backdrop-blur-[3px]" :style="{ zIndex }" @click.self="close">
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
