<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { EllipsisVertical, LoaderCircle } from 'lucide-vue-next'

// Uch nuqtali amallar menyusi. items: [{ label, icon?, action, disabled?, danger? }]
defineProps({
  items: { type: Array, default: () => [] },
  busy: { type: Boolean, default: false },
  label: { type: String, default: 'Amallar' },
})
const open = ref(false)
const root = ref(null)

function onPointer(event) {
  if (open.value && root.value && !root.value.contains(event.target)) open.value = false
}
// Escape avval menyuni yopadi — modal esa ochiq qoladi.
function onKey(event) {
  if (open.value && event.key === 'Escape') {
    event.stopImmediatePropagation()
    open.value = false
  }
}
onMounted(() => {
  document.addEventListener('mousedown', onPointer)
  window.addEventListener('keydown', onKey, true)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onPointer)
  window.removeEventListener('keydown', onKey, true)
})
function run(item) {
  open.value = false
  item.action?.()
}
</script>

<template>
  <div ref="root" class="relative">
    <button type="button" class="btn-quiet !p-2" :aria-label="label" :title="label" aria-haspopup="menu" :aria-expanded="open" :disabled="busy" @click="open = !open">
      <LoaderCircle v-if="busy" :size="18" class="animate-spin" />
      <EllipsisVertical v-else :size="18" />
    </button>
    <Transition enter-active-class="transition duration-100 ease-out" enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition duration-75 ease-in" leave-to-class="opacity-0">
      <div v-if="open" role="menu" class="absolute right-0 top-full z-30 mt-1.5 min-w-[210px] overflow-hidden rounded-xl border border-line bg-white py-1.5 shadow-float">
        <button v-for="item in items" :key="item.label" type="button" role="menuitem" :disabled="item.disabled"
          class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium transition hover:bg-canvas disabled:opacity-50"
          :class="item.danger ? 'text-danger' : 'text-ink'" @click="run(item)">
          <component :is="item.icon" v-if="item.icon" :size="16" :class="item.danger ? '' : 'text-muted'" />
          {{ item.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>
