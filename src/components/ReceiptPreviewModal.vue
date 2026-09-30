<script setup>
import { computed } from 'vue'
import { ArrowDownLeft, ArrowUpRight, ChevronRight, StickyNote, Pencil, Trash2, Lock, ReceiptText, Fuel, Wrench, Pickaxe, BriefcaseBusiness, HandCoins, Banknote, CircleDollarSign } from 'lucide-vue-next'
import ModalDialog from './ModalDialog.vue'
import PreviewSection from './PreviewSection.vue'
import { useQuarryStore } from '../stores/quarry'
import { dateTime, money, displayId, tripCode } from '../lib/format'
import { isPendingMonitoring, monitoringLabel, monitoringTagClass } from '../lib/monitoring'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  transaction: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'open-trip', 'edit', 'delete'])
const store = useQuarryStore()

const isIn = computed(() => props.transaction?.direction === 'in')
const trip = computed(() => store.trips.find((item) => item.id === props.transaction?.tripId) || null)
// Naqd savdo → To'langan, qarzga sotilgan reys → To'lanmagan.
const paidState = computed(() => (trip.value ? (trip.value.saleType === 'cash' ? 'paid' : 'unpaid') : null))
const openTrip = () => { if (trip.value) emit('open-trip', trip.value) }

const categoryIcons = { blasting: Pickaxe, fuel: Fuel, repair: Wrench, salary: BriefcaseBusiness, payroll: HandCoins, cash_sale: Banknote, customer_payment: CircleDollarSign }
const icon = computed(() => categoryIcons[props.transaction?.category] || ReceiptText)
const userName = (id) => (id ? store.users.find((user) => user.id === id)?.fullName ?? '' : '')

const locked = computed(() => store.transactionLocked(props.transaction))
const canEdit = computed(() => store.canEditTransactions && !locked.value)
const canDelete = computed(() => store.canDeleteTransactions && !locked.value)
const showLockedHint = computed(() => locked.value && (store.canEditTransactions || store.canDeleteTransactions))

const detailRows = computed(() => {
  const tx = props.transaction
  if (!tx) return []
  return [
    { label: 'Hisob', value: tx.paymentMethod === 'cash' ? 'Naqd kassa' : 'Bank hisobi' },
    { label: 'Mijoz', value: tx.clientId ? store.clientName(tx.clientId) : '' },
    { label: 'Xodim', value: tx.driverId ? store.driverName(tx.driverId) : '' },
    { label: 'Texnika', value: tx.vehicleId ? store.vehicleName(tx.vehicleId) : '' },
    { label: 'Kiritildi', value: dateTime(tx.createdAt), sub: userName(tx.createdBy) },
  ]
})
const monitoringRows = computed(() => {
  const tx = props.transaction
  if (!tx || tx.direction !== 'out') return []
  return [
    { label: 'Holat', value: monitoringLabel(tx), tag: monitoringTagClass(tx) },
    { label: isPendingMonitoring(tx) ? 'Bekor qilgan' : 'Tasdiqlagan', value: tx.monitoredAt ? userName(tx.monitoredBy) || '—' : '', sub: tx.monitoredAt ? dateTime(tx.monitoredAt) : '' },
    { label: 'Izoh', value: tx.monitoringNote },
  ]
})
</script>

<template>
  <ModalDialog
    :model-value="modelValue"
    title="Kvitansiya"
    :description="transaction ? dateTime(transaction.createdAt) : ''"
    width="max-w-lg"
    @update:model-value="(value) => emit('update:modelValue', value)"
  >
    <div v-if="transaction" class="space-y-4">
      <div class="flex items-center gap-4 rounded-xl p-4" :class="isIn ? 'bg-[#eaf7f0]' : 'bg-[#fdf3e9]'">
        <div class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white" :class="isIn ? 'text-[#0f7a4d]' : 'text-[#b36e35]'">
          <component :is="icon" :size="21" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="flex items-center gap-1 text-[11px] font-semibold" :class="isIn ? 'text-[#0f7a4d]' : 'text-[#b36e35]'">
            <component :is="isIn ? ArrowDownLeft : ArrowUpRight" :size="13" /> {{ isIn ? 'Kirim' : 'Chiqim' }} · {{ store.categoryLabel(transaction.category) }}
          </p>
          <p class="mt-0.5 truncate text-2xl font-bold tracking-tight text-ink">
            {{ store.canSeePrices ? `${isIn ? '+' : '−'} ${money(transaction.amount)}` : 'Yashirilgan' }}
          </p>
        </div>
      </div>

      <button v-if="transaction.tripId" type="button"
        class="flex w-full items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-left transition hover:border-leaf hover:bg-[#f7fafd]"
        @click="openTrip">
        <span class="text-[13px] font-bold text-ink">Reys {{ tripCode(transaction.tripId) }}</span>
        <span class="flex items-center gap-2">
          <span v-if="paidState" class="tag" :class="paidState === 'paid' ? 'tag-leaf' : 'tag-warn'">{{ paidState === 'paid' ? 'To‘langan' : 'To‘lanmagan' }}</span>
          <ChevronRight :size="16" class="text-muted" />
        </span>
      </button>

      <PreviewSection title="Tafsilotlar" :rows="detailRows" />
      <PreviewSection title="Monitoring" :rows="monitoringRows" />

      <div v-if="transaction.note" class="flex items-start gap-2.5 rounded-xl border border-line bg-canvas px-4 py-3">
        <StickyNote :size="15" class="mt-0.5 shrink-0 text-muted" />
        <p class="text-[13px] leading-relaxed text-ink">{{ transaction.note }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <button v-if="canDelete" type="button" class="btn-danger !px-3 !py-2 text-xs" @click="emit('delete', transaction)"><Trash2 :size="14" /> O‘chirish</button>
        <button v-if="canEdit" type="button" class="btn-secondary !px-3 !py-2 text-xs" @click="emit('edit', transaction)"><Pencil :size="14" /> Tahrirlash</button>
        <span v-if="showLockedHint" class="flex items-center gap-1.5 text-[11px] text-muted"><Lock :size="12" /> Reys orqali boshqariladi</span>
        <span v-if="!canEdit && !canDelete && !showLockedHint" class="font-mono text-[11px] text-muted" :title="transaction.id">ID: {{ displayId(transaction.id) }}</span>
        <button class="btn-primary ml-auto !py-2 text-xs" type="button" @click="emit('update:modelValue', false)">Yopish</button>
      </div>
    </div>
  </ModalDialog>
</template>
