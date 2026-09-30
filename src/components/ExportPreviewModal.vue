<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { FileSpreadsheet, FileText, FileDown, Search, Check } from 'lucide-vue-next'
import ModalDialog from './ModalDialog.vue'
import { useQuarryStore } from '../stores/quarry'
import { EXPORT_COLUMNS, buildExportRows, exportTotals, formatSum, downloadCsv, downloadXlsx, downloadPdf, isoDay, dateOnly } from '../lib/export'
import { isPendingMonitoring } from '../lib/monitoring'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  transactions: { type: Array, default: () => [] },
  initialDirection: { type: String, default: 'all' },
  initialSearch: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
const store = useQuarryStore()

const PERIODS = [
  { value: 'all', label: 'Barcha davr' },
  { value: 'today', label: 'Bugun' },
  { value: 'week', label: 'Shu hafta' },
  { value: 'month', label: 'Shu oy' },
  { value: 'prev_month', label: 'O‘tgan oy' },
  { value: 'custom', label: 'Oraliq…' },
]
const PREVIEW_LIMIT = 100

const state = reactive({ period: 'all', from: '', to: '', direction: 'all', search: '', includePending: true })
const selected = ref(new Set(EXPORT_COLUMNS.map((column) => column.key)))
const busy = ref('')

// Har safar ochilganda sahifadagi filtrlardan boshlanadi.
watch(() => props.modelValue, (open) => {
  if (!open) return
  Object.assign(state, { period: 'all', from: '', to: '', direction: props.initialDirection, search: props.initialSearch, includePending: true })
  busy.value = ''
}, { immediate: true })

const parseDay = (value) => {
  const [y, m, d] = String(value).split('-').map(Number)
  return y ? new Date(y, m - 1, d) : null
}
// [start, end) oralig'i; null — chegara yo'q.
const range = computed(() => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
  switch (state.period) {
    case 'today': return [today, addDays(today, 1)]
    case 'week': { const start = addDays(today, -((today.getDay() + 6) % 7)); return [start, addDays(start, 7)] }
    case 'month': return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)]
    case 'prev_month': return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)]
    case 'custom': {
      const from = parseDay(state.from)
      const to = parseDay(state.to)
      return [from, to ? addDays(to, 1) : null]
    }
    default: return [null, null]
  }
})
const periodLabel = computed(() => {
  const [start, end] = range.value
  if (!start && !end) return 'Barcha davr'
  const last = end ? new Date(end.getTime() - 1) : null
  if (start && last && dateOnly(start) === dateOnly(last)) return dateOnly(start)
  return `${start ? dateOnly(start) : '…'} — ${last ? dateOnly(last) : '…'}`
})

const filtered = computed(() => {
  const [start, end] = range.value
  const query = state.search.trim().toLowerCase()
  return props.transactions
    .filter((tx) => state.direction === 'all' || tx.direction === state.direction)
    .filter((tx) => state.includePending || !(tx.direction === 'out' && isPendingMonitoring(tx)))
    .filter((tx) => {
      const time = new Date(tx.createdAt).getTime()
      return (!start || time >= start.getTime()) && (!end || time < end.getTime())
    })
    .filter((tx) => !query || [tx.note, store.categoryLabel(tx.category), store.clientName(tx.clientId), store.driverName(tx.driverId), store.vehicleName(tx.vehicleId)]
      .join(' ').toLowerCase().includes(query))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})
const rows = computed(() => buildExportRows(filtered.value, store))
const totals = computed(() => exportTotals(rows.value))
const columns = computed(() => EXPORT_COLUMNS.filter((column) => selected.value.has(column.key)))
const previewRows = computed(() => rows.value.slice(0, PREVIEW_LIMIT))
const canExport = computed(() => rows.value.length > 0 && columns.value.length > 0 && !busy.value)

function toggleColumn(key) {
  const next = new Set(selected.value)
  if (next.has(key)) { if (next.size > 1) next.delete(key) } else next.add(key)
  selected.value = next
}

const meta = computed(() => {
  const direction = state.direction === 'in' ? 'Kirimlar' : state.direction === 'out' ? 'Chiqimlar' : 'Kirim-chiqim'
  const [start, end] = range.value
  const suffix = start || end
    ? [start ? isoDay(start) : 'boshidan', end ? isoDay(new Date(end.getTime() - 1)) : isoDay()].filter((v, i, list) => list.indexOf(v) === i).join('_')
    : isoDay()
  return {
    brand: 'AliBuilding.uz · Texnika boshqaruvi',
    title: `${direction} hisoboti`,
    subtitle: `Davr: ${periodLabel.value} · ${rows.value.length} ta yozuv · Tuzildi: ${dateOnly(new Date())} ${new Date().toTimeString().slice(0, 5)}`,
    fileSuffix: suffix,
  }
})

async function download(format) {
  if (!canExport.value) return
  busy.value = format
  try {
    if (format === 'xlsx') await downloadXlsx(rows.value, columns.value, meta.value)
    else if (format === 'pdf') await downloadPdf(rows.value, columns.value, meta.value)
    else downloadCsv(rows.value, columns.value, meta.value)
    store.notify('Fayl yuklab olindi.')
  } catch (error) {
    store.notify(error?.message || 'Faylni tayyorlab bo‘lmadi.', 'error')
  } finally { busy.value = '' }
}
</script>

<template>
  <ModalDialog
    :model-value="modelValue"
    title="Hisobotni yuklab olish"
    :description="`${periodLabel} · ${rows.length} ta yozuv`"
    width="max-w-6xl"
    @update:model-value="(value) => emit('update:modelValue', value)"
  >
    <div class="space-y-4">
      <!-- Yuklab olish formatlari -->
      <div class="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-canvas p-2">
        <button type="button" class="flex items-center gap-2 rounded-lg bg-[#107c41] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0c6734] disabled:opacity-50" :disabled="!canExport" @click="download('xlsx')">
          <FileSpreadsheet :size="17" /> {{ busy === 'xlsx' ? 'Tayyorlanmoqda…' : 'Excel (.xlsx)' }}
        </button>
        <button type="button" class="flex items-center gap-2 rounded-lg bg-[#c9423a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#ad3730] disabled:opacity-50" :disabled="!canExport" @click="download('pdf')">
          <FileText :size="17" /> {{ busy === 'pdf' ? 'Tayyorlanmoqda…' : 'PDF' }}
        </button>
        <button type="button" class="flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-mint disabled:opacity-50" :disabled="!canExport" @click="download('csv')">
          <FileDown :size="17" /> CSV
        </button>
        <span class="ml-auto hidden px-2 text-xs text-muted sm:block">{{ columns.length }} ustun · {{ rows.length }} qator</span>
      </div>

      <!-- Filtrlar -->
      <div class="grid gap-3 md:grid-cols-[auto_auto_1fr]">
        <div class="flex flex-wrap items-center gap-2">
          <select v-model="state.period" class="field !w-auto !py-2 text-sm">
            <option v-for="option in PERIODS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
          <template v-if="state.period === 'custom'">
            <input v-model="state.from" type="date" class="field !w-auto !py-2 text-sm" aria-label="Boshlanish sanasi" />
            <span class="text-muted">—</span>
            <input v-model="state.to" type="date" class="field !w-auto !py-2 text-sm" aria-label="Tugash sanasi" />
          </template>
        </div>
        <div class="flex gap-1 self-center rounded-xl bg-canvas p-1">
          <button v-for="tab in [{ value: 'all', label: 'Barchasi' }, { value: 'in', label: 'Kirim' }, { value: 'out', label: 'Chiqim' }]"
            :key="tab.value" type="button" class="rounded-lg px-3.5 py-1.5 text-xs font-bold transition"
            :class="state.direction === tab.value ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'"
            @click="state.direction = tab.value">{{ tab.label }}</button>
        </div>
        <div class="flex flex-wrap items-center gap-3 md:justify-end">
          <label class="relative w-full sm:w-[240px]">
            <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input v-model="state.search" class="field !py-2 !pl-9 text-sm" placeholder="Izoh yoki mijoz..." />
          </label>
          <label class="flex cursor-pointer select-none items-center gap-2 text-xs font-semibold text-ink">
            <input v-model="state.includePending" type="checkbox" class="h-4 w-4 accent-[#1F90FF]" /> Kutilayotgan chiqimlar
          </label>
        </div>
      </div>

      <!-- Ustunlar -->
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="mr-1 text-[11px] font-bold uppercase tracking-wide text-muted">Ustunlar</span>
        <button v-for="column in EXPORT_COLUMNS" :key="column.key" type="button"
          class="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition"
          :class="selected.has(column.key) ? 'border-leaf bg-mint text-forest' : 'border-line bg-white text-muted hover:text-ink'"
          @click="toggleColumn(column.key)">
          <Check v-if="selected.has(column.key)" :size="12" /> {{ column.label }}
        </button>
      </div>

      <!-- Jami ko'rsatkichlar -->
      <div class="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div class="rounded-xl bg-canvas px-4 py-3"><p class="text-[11px] font-semibold text-muted">Yozuvlar</p><p class="mt-0.5 text-base font-bold sm:text-lg text-ink">{{ totals.count }} ta</p></div>
        <div class="rounded-xl bg-[#eaf7f0] px-4 py-3"><p class="text-[11px] font-semibold text-[#0f7a4d]">Jami kirim</p><p class="mt-0.5 text-base font-bold sm:text-lg text-ink">{{ formatSum(totals.income) }} so‘m</p></div>
        <div class="rounded-xl bg-[#fdf3e9] px-4 py-3"><p class="text-[11px] font-semibold text-[#b36e35]">Jami chiqim</p><p class="mt-0.5 text-base font-bold sm:text-lg text-ink">{{ formatSum(totals.expense) }} so‘m</p><p v-if="totals.pendingExpense" class="text-[11px] text-muted">shundan kutilmoqda: {{ formatSum(totals.pendingExpense) }}</p></div>
        <div class="rounded-xl bg-canvas px-4 py-3"><p class="text-[11px] font-semibold text-muted">Farq</p><p class="mt-0.5 text-base font-bold sm:text-lg" :class="totals.net < 0 ? 'text-danger' : 'text-ink'">{{ formatSum(totals.net) }} so‘m</p></div>
      </div>

      <!-- Fayl ko'rinishi -->
      <div class="overflow-hidden rounded-xl border border-line">
        <div class="max-h-[46vh] overflow-auto">
          <table class="w-full border-collapse text-left text-xs">
            <thead class="sticky top-0 z-[1]">
              <tr class="bg-forest text-white">
                <th v-for="column in columns" :key="column.key" class="whitespace-nowrap px-3 py-2.5 font-semibold" :class="column.align === 'right' ? 'text-right' : ''">{{ column.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in previewRows" :key="row.id" class="border-b border-line even:bg-[#f8fafd]">
                <td v-for="column in columns" :key="column.key" class="px-3 py-2 align-top"
                  :class="[column.align === 'right' ? 'text-right' : '', column.money ? 'font-bold' : '', column.key === 'income' ? 'text-[#0f7a4d]' : '', column.key === 'expense' ? 'text-[#b36e35]' : '', column.key === 'note' || column.key === 'party' ? 'min-w-[160px] max-w-[280px]' : 'whitespace-nowrap']">
                  <span v-if="column.key === 'status' && row.pending" class="tag tag-warn">{{ row.status }}</span>
                  <template v-else>{{ column.money ? formatSum(row[column.key]) : row[column.key] }}</template>
                </td>
              </tr>
              <tr v-if="!rows.length">
                <td :colspan="columns.length" class="px-4 py-12 text-center text-sm text-muted">Tanlangan filtr bo‘yicha yozuv yo‘q.</td>
              </tr>
            </tbody>
            <tfoot v-if="rows.length && (selected.has('income') || selected.has('expense'))" class="sticky bottom-0">
              <tr class="bg-mint font-bold text-ink">
                <td v-for="(column, index) in columns" :key="column.key" class="whitespace-nowrap px-3 py-2.5" :class="column.align === 'right' ? 'text-right' : ''">
                  <template v-if="column.key === 'income'">{{ formatSum(totals.income) }}</template>
                  <template v-else-if="column.key === 'expense'">{{ formatSum(totals.expense) }}</template>
                  <template v-else-if="index === 0">Jami</template>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p v-if="rows.length > PREVIEW_LIMIT" class="border-t border-line bg-canvas px-4 py-2 text-xs text-muted">Oynada birinchi {{ PREVIEW_LIMIT }} ta qator ko‘rsatildi — faylga barcha {{ rows.length }} ta qator kiradi.</p>
      </div>
    </div>
  </ModalDialog>
</template>
