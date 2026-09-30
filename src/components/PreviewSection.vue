<script setup>
import { computed } from 'vue'

// Preview oynalaridagi ma'lumot bloki: sarlavha + "yorliq — qiymat" qatorlari.
// Bo'sh qiymatli qatorlar ko'rsatilmaydi.
const props = defineProps({
  title: { type: String, default: '' },
  rows: { type: Array, default: () => [] },
})
const visibleRows = computed(() => props.rows.filter((row) => row && row.value !== undefined && row.value !== null && row.value !== ''))
</script>

<template>
  <section v-if="visibleRows.length || $slots.default" class="overflow-hidden rounded-xl border border-line bg-white">
    <h3 v-if="title" class="border-b border-line bg-canvas px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-muted">{{ title }}</h3>
    <dl class="divide-y divide-line">
      <div v-for="row in visibleRows" :key="row.label" class="flex items-start justify-between gap-4 px-4 py-2.5">
        <dt class="shrink-0 pt-px text-xs text-muted">{{ row.label }}</dt>
        <dd class="min-w-0 break-words text-right text-[13px] font-semibold text-ink">
          <span v-if="row.tag" class="tag" :class="row.tag">{{ row.value }}</span>
          <template v-else>{{ row.value }}</template>
          <span v-if="row.sub" class="mt-0.5 block text-[11px] font-normal text-muted">{{ row.sub }}</span>
        </dd>
      </div>
    </dl>
    <slot />
  </section>
</template>
