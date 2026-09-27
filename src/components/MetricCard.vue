<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: String, required: true },
  detail: { type: String, default: '' },
  // lucide-vue-next ikonkalari funksiya (functional component) sifatida export qilinadi,
  // shuning uchun Object bilan birga Function ham qabul qilinadi.
  icon: { type: [Object, Function], required: true },
  tone: { type: String, default: 'green' },
  trend: { type: String, default: '' },
})
const toneClass = computed(() => ({
  green: 'bg-[#e8f3eb] text-[#2a7650]',
  blue: 'bg-[#eaf2fa] text-[#4f7595]',
  amber: 'bg-[#fff4e3] text-[#b77824]',
  violet: 'bg-[#f0edfb] text-[#7061a2]',
}[props.tone] || 'bg-mint text-leaf'))
</script>

<template>
  <article class="card flex min-h-[140px] flex-col justify-between p-5">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0"><p class="text-xs font-semibold text-muted">{{ label }}</p><p class="mt-2 text-[23px] font-bold tracking-tight text-ink">{{ value }}</p></div>
      <div :class="toneClass" class="grid h-10 w-10 shrink-0 place-items-center rounded-[13px]"><component :is="icon" :size="19" :stroke-width="1.9" /></div>
    </div>
    <div class="mt-4 flex items-center justify-between gap-2">
      <p class="truncate text-[11px] text-muted">{{ detail }}</p>
      <span v-if="trend" class="shrink-0 rounded-md bg-[#eaf5ee] px-1.5 py-1 text-[10px] font-bold text-[#3b8056]">{{ trend }}</span>
    </div>
  </article>
</template>
