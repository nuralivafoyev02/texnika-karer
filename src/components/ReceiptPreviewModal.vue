<script setup>
import { computed } from 'vue'
import { ArrowDownLeft, ArrowUpRight, ArrowRight, CalendarClock, WalletCards, Truck, UserRound, ReceiptText, StickyNote, Fuel, Wrench, Pickaxe, BriefcaseBusiness, HandCoins, Banknote, CircleDollarSign } from 'lucide-vue-next'
import ModalDialog from './ModalDialog.vue'
import { useQuarryStore } from '../stores/quarry'
import { dateTime, money, displayId, tripCode } from '../lib/format'
import { isPendingMonitoring, monitoringLabel } from '../lib/monitoring'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  transaction: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'open-trip'])
const store = useQuarryStore()

// Kirim kvitansiyasi qaysi reysga bog'langanini ko'rsatamiz:
// strelka bosilsa — shu reys preview'i kvitansiya ustidan ochiladi.
const trip = computed(() => store.trips.find((item) => item.id === props.transaction?.tripId) || null)
// Reys savdo turiga qarab to'lov holati: naqd savdo → To'langan,
// qarzga sotilgan reys → To'lanmagan (mijoz hali to'lamagan).
const paidState = computed(() => {
  if (!trip.value) return null
  return trip.value.saleType === 'cash' ? 'paid' : 'unpaid'
})
const openTrip = () => { if (trip.value) emit('open-trip', trip.value) }

const categoryIcons = { blasting: Pickaxe, fuel: Fuel, repair: Wrench, salary: BriefcaseBusiness, payroll: HandCoins, cash_sale: Banknote, customer_payment: CircleDollarSign }
const icon = computed(() => categoryIcons[props.transaction?.category] || ReceiptText)

const details = computed(() => {
  const tx = props.transaction
  if (!tx) return []
  const rows = [
    { icon: ReceiptText, label: 'Yo‘nalish', value: tx.direction === 'in' ? 'Kirim' : 'Chiqim' },
    { icon: CalendarClock, label: 'Sana va vaqt', value: dateTime(tx.createdAt) },
    { icon: WalletCards, label: 'Hisob', value: tx.paymentMethod === 'cash' ? 'Naqd kassa' : 'Bank hisobi' },
  ]
  if (tx.clientId) rows.push({ icon: UserRound, label: 'Mijoz', value: store.clientName(tx.clientId) })
  if (tx.driverId) rows.push({ icon: UserRound, label: 'Xodim', value: store.driverName(tx.driverId) })
  if (tx.vehicleId) rows.push({ icon: Truck, label: 'Texnika', value: store.vehicleName(tx.vehicleId) })
  if (store.canSeePrices) rows.push({ icon: WalletCards, label: 'Summa', value: money(tx.amount) })
  return rows
})
</script>

<template>
  <ModalDialog
    :model-value="modelValue"
    title="Kvitansiya"
    :description="transaction ? `${store.categoryLabel(transaction.category)} · ${dateTime(transaction.createdAt)}` : ''"
    width="max-w-lg"
    @update:model-value="(value) => emit('update:modelValue', value)"
  >
    <div v-if="transaction" class="space-y-4">
      <!-- Summa bloki -->
      <div class="overflow-hidden rounded-2xl p-5 text-white" :class="transaction.direction === 'in' ? 'bg-[#0f7a4d]' : 'bg-[#b36e35]'">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-white/60">{{ transaction.direction === 'in' ? 'Kirim summasi' : 'Chiqim summasi' }}</p>
            <p class="mt-1 text-2xl font-bold tracking-tight">
              <span class="align-middle">{{ transaction.direction === 'in' ? '+' : '−' }}</span>
              {{ store.canSeePrices ? money(transaction.amount) : 'Ruxsat yo‘q' }}
            </p>
            <p class="mt-1.5 flex items-center gap-1.5 text-xs text-white/75"><component :is="icon" :size="14" /> {{ store.categoryLabel(transaction.category) }}</p>
          </div>
          <div class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15">
            <component :is="transaction.direction === 'in' ? ArrowDownLeft : ArrowUpRight" :size="20" />
          </div>
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-white/15 pt-3 text-[10px] text-white/70">
          <span v-if="transaction.direction === 'out'" class="rounded-md px-2 py-1 font-semibold" :class="isPendingMonitoring(transaction) ? 'bg-[#ffefcf] text-[#764b16]' : 'bg-white/15 text-white'">{{ monitoringLabel(transaction) }}</span>
          <span v-else class="rounded-md bg-white/15 px-2 py-1 font-semibold">Darhol hisobga yoziladi</span>
          <span class="ml-auto font-mono" :title="transaction.id">ID: {{ displayId(transaction.id) }}</span>
        </div>
      </div>

      <!-- Reysga bog'lanish: strelka ustiga bosilsa — reys preview'i ochiladi -->
      <button v-if="transaction.tripId" type="button"
        class="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-3.5 py-3 transition hover:border-leaf hover:bg-[#f7fafd]"
        :title="`Reys ${tripCode(transaction.tripId)} tafsilotini ochish`"
        @click="openTrip">
        <span class="flex items-center gap-2 text-xs font-bold text-ink">
          <ArrowRight :size="15" class="text-leaf" />
          Reys {{ tripCode(transaction.tripId) }}
        </span>
        <span v-if="paidState" class="tag" :class="paidState === 'paid' ? 'tag-leaf' : 'tag-warn'">{{ paidState === 'paid' ? 'To‘langan' : 'To‘lanmagan' }}</span>
      </button>

      <!-- Tafsilotlar -->
      <dl class="space-y-2">
        <div v-for="row in details" :key="row.label" class="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-3.5 py-3">
          <dt class="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-muted"><component :is="row.icon" :size="14" class="shrink-0 text-slate-400" />{{ row.label }}</dt>
          <dd class="truncate text-xs font-bold text-ink">{{ row.value }}</dd>
        </div>
      </dl>

      <div v-if="transaction.note" class="flex items-start gap-2.5 rounded-xl border border-line bg-canvas px-3.5 py-3 text-xs">
        <StickyNote :size="14" class="mt-0.5 shrink-0 text-slate-400" />
        <p class="leading-relaxed text-ink"><span class="font-bold">Izoh:</span> {{ transaction.note }}</p>
      </div>

      <p v-if="transaction.direction === 'out' && !isPendingMonitoring(transaction) && transaction.monitoredAt" class="text-[10px] text-muted">
        Monitoringdan o‘tgan: {{ dateTime(transaction.monitoredAt) }}
      </p>

      <div class="flex justify-end border-t border-line pt-3">
        <button class="btn-primary !py-2 text-xs" type="button" @click="emit('update:modelValue', false)">Yopish</button>
      </div>
    </div>
  </ModalDialog>
</template>
