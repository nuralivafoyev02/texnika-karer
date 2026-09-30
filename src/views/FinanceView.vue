<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { CircleDollarSign, ArrowDownToLine, ArrowUpFromLine, WalletCards, Banknote, Plus, Search, Download, ReceiptText, Fuel, Wrench, Pickaxe, BriefcaseBusiness, HandCoins, ArrowDownLeft, ArrowUpRight, ArrowRight } from 'lucide-vue-next'
import ModalDialog from '../components/ModalDialog.vue'
import ReceiptPreviewModal from '../components/ReceiptPreviewModal.vue'
import TripPreviewModal from '../components/TripPreviewModal.vue'
import PaymentForm from '../components/forms/PaymentForm.vue'
import ExpenseForm from '../components/forms/ExpenseForm.vue'
import MetricCard from '../components/MetricCard.vue'
import { useQuarryStore } from '../stores/quarry'
import { dateOnly, dateTime, money, isSameMonth, tripCode } from '../lib/format'
import { isPendingMonitoring, monitoringLabel, monitoringTagClass } from '../lib/monitoring'

const store = useQuarryStore()
const route = useRoute()
const filter = ref('all')
const search = ref('')
const showPayment = ref(false)
const showExpense = ref(false)
const selectedTx = ref(null)
const selectedTrip = ref(null)

// Kirim qatoridagi reys: kvitansiya qaysi reysga bog'langan va u to'langanmi?
// Qoida (tanlangan variant): naqd savdo → To'langan, qarzga sotilgan reys →
// To'lanmagan; reysga bog'lanmagan kirimlarda (mijoz to'lovi) holat "—".
const linkedTrip = (tx) => (tx?.tripId ? store.trips.find((item) => item.id === tx.tripId) || null : null)
const paidState = (tx) => {
  const trip = linkedTrip(tx)
  if (!trip) return null
  return trip.saleType === 'cash' ? 'paid' : 'unpaid'
}
const paidLabel = (tx) => (paidState(tx) === 'paid' ? 'To‘langan' : 'To‘lanmagan')
// Jadvaldagi reys kodini bosish — reys preview'i to'g'ridan-to'g'ri ochiladi.
function openTripFromRow(tx) {
  const trip = linkedTrip(tx)
  if (trip) selectedTrip.value = trip
}
// Kvitansiya preview'idagi strelka — kvitansiya ostida qoladi, reys preview'i ustma-ust ochiladi.
function openTripFromReceipt(trip) { selectedTrip.value = trip }
const saving = ref(false)
const categoryIcons = { blasting: Pickaxe, fuel: Fuel, repair: Wrench, salary: BriefcaseBusiness, payroll: HandCoins, cash_sale: Banknote, customer_payment: CircleDollarSign }
const categoryLabel = (key) => store.categoryLabel(key)
// Tafsilot: avval mijoz nomi (naqd reysda ham ko'rinadi), keyin izoh —
// "qaysi mijozga" va "nima uchun" bir qatorda bo'ladi.
const txDetail = (tx) => {
  if (tx.clientId) return [store.clientName(tx.clientId), tx.note].filter(Boolean).join(' · ')
  return tx.note || (tx.driverId ? store.driverName(tx.driverId) : '—')
}
const transactions = computed(() => [...store.transactions]
  .filter((tx) => filter.value === 'all' || tx.direction === filter.value)
  .filter((tx) => !search.value.trim() || `${tx.note} ${categoryLabel(tx.category)} ${store.clientName(tx.clientId)} ${store.vehicleName(tx.vehicleId)}`.toLowerCase().includes(search.value.trim().toLowerCase()))
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
const categoryTotals = computed(() => {
  // Tarkib faqat tasdiqlangan chiqimlarni ko'rsatadi — kutilayotgan xarajatlar
  // monitoringda tasdiqlangandan keyin shu yerda paydo bo'ladi.
  const rows = store.transactions.filter((tx) => tx.direction === 'out' && isSameMonth(tx.createdAt) && !isPendingMonitoring(tx))
  return store.expenseCategories
    .map((item) => ({
      key: item.key,
      title: item.label,
      amount: rows.filter((tx) => tx.category === item.key).reduce((sum, tx) => sum + Number(tx.amount), 0),
      icon: categoryIcons[item.key] || ReceiptText,
    }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
})
const drivers = computed(() => store.users.filter((user) => store.userCan(user, 'driver.self')))
async function savePayment(payload) {
  saving.value = true
  try { await store.createPayment(payload); showPayment.value = false }
  catch (error) { store.notify(error.message || 'To‘lovni saqlab bo‘lmadi.', 'error') }
  finally { saving.value = false }
}
async function saveExpense(payload) {
  saving.value = true
  try { await store.createExpense(payload); showExpense.value = false }
  catch (error) { store.notify(error.message || 'Xarajatni saqlab bo‘lmadi.', 'error') }
  finally { saving.value = false }
}
function transactionIcon(category) { return categoryIcons[category] || ReceiptText }
function openReceipt(tx) { selectedTx.value = tx }
function closeReceipt() { selectedTx.value = null }
function closeTrip() { selectedTrip.value = null }
function exportCsv() {
  const header = ['Sana', 'Turi', 'Yo‘nalish', 'Summa', 'To‘lov turi', 'Izoh']
  const rows = transactions.value.map((tx) => [dateTime(tx.createdAt), categoryLabel(tx.category), tx.direction === 'in' ? 'Kirim' : 'Chiqim', tx.amount, tx.paymentMethod === 'cash' ? 'Naqd' : 'Bank', tx.note || ''])
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `qazilma-moliya-${dateOnly(new Date())}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div class="mb-1 flex items-center gap-2 text-xs font-semibold text-leaf">
          <WalletCards :size="15" /> Hisob-kitob
        </div>
        <h1 class="page-title">Moliya</h1>
      </div>
      <div class="flex flex-wrap gap-2"><button v-if="store.can('finance.payments.create')" class="btn-secondary"
          @click="showPayment = true">
          <ArrowDownToLine :size="16" /> Kirim
        </button><button v-if="store.can('finance.expenses.create')" class="btn-primary" @click="showExpense = true">
          <ArrowUpFromLine :size="16" /> Chiqim kiritish
        </button></div>
    </div>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Naqd kassa qoldig‘i" :value="money(store.cashBalance, { short: true })" :icon="Banknote" tone="amber" />
      <MetricCard label="Bank hisob raqami" :value="money(store.bankBalance, { short: true })" :icon="WalletCards" tone="blue" />
      <MetricCard label="Bugungi kirim" :value="money(store.todayCashIn, { short: true })" :icon="ArrowDownToLine" tone="green" />
      <MetricCard label="Joriy oy xarajatlari" :value="money(store.monthExpenses, { short: true })"
        :detail="store.pendingExpenses.length ? `${store.pendingExpenses.length} ta xarajat monitoringda kutilmoqda` : ''"
        :icon="ArrowUpFromLine" tone="violet" />
    </section>

    <section class="grid gap-5 xl:grid-cols-12">
      <article class="card overflow-hidden xl:col-span-8">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
          <div>
            <h2 class="section-title">Kirim-chiqim jurnali</h2>
            <p class="mt-1 text-xs text-muted">Barcha moliyaviy amallar · {{ store.transactions.length }} ta yozuv</p>
          </div><button class="btn-secondary !px-3 !py-2 text-[11px]" @click="exportCsv">
            <Download :size="14" /> CSV yuklash
          </button>
        </div>
        <div
          class="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div class="flex gap-1 rounded-xl bg-canvas p-1"><button
              v-for="tab in [{ value: 'all', label: 'Barchasi' }, { value: 'in', label: 'Kirim' }, { value: 'out', label: 'Chiqim' }]"
              :key="tab.value" class="rounded-lg px-3 py-1.5 text-[10px] font-bold transition"
              :class="filter === tab.value ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'"
              @click="filter = tab.value">{{ tab.label }}</button></div><label class="relative w-full sm:max-w-[240px]">
            <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="search"
              class="field !py-2 !pl-9" placeholder="Izoh yoki mijoz..." />
          </label>
        </div>
        <div class="max-h-[590px] overflow-auto">
          <table class="w-full min-w-[760px] border-collapse text-left">
            <thead class="sticky top-0">
              <tr class="table-head border-b border-line">
                <th class="px-5 py-3">Amaliyot</th>
                <th class="px-4 py-3">Tafsilot</th>
                <th class="px-4 py-3">Sana</th>
                <th class="px-4 py-3">Reys / To‘lov</th>
                <th class="px-4 py-3">Hisob</th>
                <th class="px-4 py-3">Monitoring</th>
                <th class="px-5 py-3 text-right">Summa</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tx in transactions" :key="tx.id"
                class="cursor-pointer border-b border-[#f0f2f0] last:border-0 transition hover:bg-[#f7fafd]" title="Kvitansiyani ko‘rish"
                @click="openReceipt(tx)">
                <td class="px-5 py-3.5">
                  <div class="flex items-center gap-2.5">
                    <div class="grid h-8 w-8 place-items-center rounded-lg"
                      :class="tx.direction === 'in' ? 'bg-[#e6f1ff] text-leaf' : 'bg-[#fff4e3] text-amber'">
                      <component :is="transactionIcon(tx.category)" :size="15" />
                    </div>
                    <div>
                      <p class="text-xs font-bold text-ink">{{ categoryLabel(tx.category) }}</p>
                      <p class="mt-0.5 text-[9px] text-muted">{{ tx.direction === 'in' ? 'Kirim' : 'Chiqim' }}</p>
                    </div>
                  </div>
                </td>
                <td class="max-w-[190px] px-4 py-3.5">
                  <p class="truncate text-xs text-ink" :title="txDetail(tx)">{{ txDetail(tx) }}</p>
                  <p v-if="tx.vehicleId" class="mt-1 truncate text-[9px] text-muted">{{ store.vehicleName(tx.vehicleId)
                    }}</p>
                </td>
                <td class="px-4 py-3.5">
                  <p class="text-[11px] text-ink">{{ dateTime(tx.createdAt) }}</p>
                </td>
                <td class="px-4 py-3.5">
                  <template v-if="linkedTrip(tx)">
                    <button type="button"
                      class="inline-flex items-center gap-1.5 rounded-lg border border-line bg-canvas px-2 py-1 text-[10px] font-bold text-ink transition hover:border-leaf hover:bg-mint"
                      :title="`Reys ${tripCode(tx.tripId)} tafsilotini ochish`" @click.stop="openTripFromRow(tx)">
                      <ArrowRight :size="12" class="text-leaf" /> Reys {{ tripCode(tx.tripId) }}
                    </button>
                    <p class="mt-1"><span class="tag" :class="paidState(tx) === 'paid' ? 'tag-leaf' : 'tag-warn'">{{ paidLabel(tx) }}</span></p>
                  </template>
                  <span v-else class="text-[11px] text-muted">—</span>
                </td>
                <td class="px-4 py-3.5"><span class="tag"
                    :class="tx.paymentMethod === 'cash' ? 'tag-credit' : 'tag-blue'">{{ tx.paymentMethod === 'cash' ?
                    'Naqd' : 'Bank' }}</span></td>
                <td class="px-4 py-3.5"><span v-if="tx.direction === 'out'" class="tag"
                    :class="monitoringTagClass(tx)">{{ monitoringLabel(tx) }}</span><span v-else
                    class="text-[10px] text-muted">Kirim</span></td>
                <td class="px-5 py-3.5 text-right"><span class="text-xs font-bold"
                    :class="tx.direction === 'in' ? 'text-leaf' : 'text-[#b36e35]'">{{ tx.direction === 'in' ? '+' : '−'
                    }}{{ money(tx.amount, { short: true }) }}</span></td>
              </tr>
              <tr v-if="!transactions.length">
                <td colspan="7" class="px-6 py-14 text-center text-sm text-muted">Tanlangan filtr bo‘yicha operatsiya
                  yo‘q.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between border-t border-line px-5 py-3 text-[10px] text-muted"><span>{{ transactions.length }} ta yozuv</span></div>
      </article>

      <aside class="space-y-5 xl:col-span-4">
        <article class="card p-5">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="section-title">Xarajatlar tarkibi</h2>
              <p class="mt-1 text-xs text-muted">Jami {{ money(store.monthExpenses, { short: true }) }} chiqim</p>
            </div>
            <div class="grid h-9 w-9 place-items-center rounded-xl bg-[#fff4e3] text-amber">
              <ReceiptText :size="17" />
            </div>
          </div>
          <div class="mt-4 space-y-3.5">
            <div v-for="item in categoryTotals" :key="item.key" class="flex items-center gap-3">
              <div class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-canvas text-muted">
                <component :is="item.icon" :size="15" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2"><span
                    class="truncate text-[11px] font-semibold text-ink">{{ item.title }}</span><strong
                    class="text-[11px] text-ink">{{ money(item.amount, { short: true }) }}</strong></div>
                <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eef1f7]">
                  <div class="h-full rounded-full bg-leaf"
                    :style="{ width: `${store.monthExpenses ? Math.min(100, item.amount / store.monthExpenses * 100) : 0}%` }">
                  </div>
                </div>
              </div>
            </div>
            <p v-if="!categoryTotals.length" class="py-4 text-center text-xs text-muted">Joriy oydagi chiqim yo‘q.</p>
          </div>
        </article>
        <article class="overflow-hidden rounded-2xl bg-[#0a4fa8] p-5 text-white">
          <div class="flex items-center gap-2">
            <div class="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-[#b9d4ff]">
              <CircleDollarSign :size="16" />
            </div>
            <p class="text-xs font-bold">Pul mablag‘lari</p>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-2">
            <div class="rounded-xl bg-white/[.07] p-3">
              <p class="text-[9px] text-white/55">Kassada</p>
              <p class="mt-1 text-sm font-bold">{{ money(store.cashBalance, { short: true }) }}</p>
            </div>
            <div class="rounded-xl bg-white/[.07] p-3">
              <p class="text-[9px] text-white/55">Bankda</p>
              <p class="mt-1 text-sm font-bold">{{ money(store.bankBalance, { short: true }) }}</p>
            </div>
          </div>
        </article>
      </aside>
    </section>

    <ModalDialog v-model="showPayment" title="Mijozdan to‘lov qabul qilish">
      <PaymentForm :clients="store.clients" :categories="store.incomeCategories" :balance-for="store.clientBalance"
        :loading="saving" @submit="savePayment" @cancel="showPayment = false" />
    </ModalDialog>
    <ModalDialog v-model="showExpense" title="Yangi xarajat kiritish">
      <ExpenseForm :vehicles="store.vehicles" :drivers="drivers" :categories="store.expenseCategories" :loading="saving"
        @submit="saveExpense" @cancel="showExpense = false" />
    </ModalDialog>

    <ReceiptPreviewModal :model-value="Boolean(selectedTx)" :transaction="selectedTx"
      @update:model-value="(value) => { if (!value) closeReceipt() }" @open-trip="openTripFromReceipt" />

    <TripPreviewModal :model-value="Boolean(selectedTrip)" :trip="selectedTrip"
      @update:model-value="(value) => { if (!value) closeTrip() }" />
  </div>
</template>
