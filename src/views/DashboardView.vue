<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Weight, Truck, CircleDollarSign, TrendingUp, WalletCards, ArrowUpRight, ArrowDownRight,
  ChevronRight, Activity, Wrench, UsersRound, CircleAlert, Banknote,
} from 'lucide-vue-next'
import MetricCard from '../components/MetricCard.vue'
import { useQuarryStore } from '../stores/quarry'
import { dateLong, dateTime, money, number, greeting, initials } from '../lib/format'

const store = useQuarryStore()
const router = useRouter()
const week = computed(() => store.weeklySummary)
const chartMax = computed(() => Math.max(1, ...week.value.map((day) => Math.max(day.sales, day.expenses))))
const recentTrips = computed(() => [...store.trips].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5))
const activeVehicles = computed(() => store.vehicles.filter((vehicle) => vehicle.status === 'active').length)
const clientRows = computed(() => store.clients.map((client) => ({ ...client, balance: store.clientBalance(client.id) })).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)).slice(0, 4))
const fleetPreview = computed(() => store.vehicles.slice(0, 4))
const todayLabel = computed(() => dateLong())
function barHeight(amount) { return Math.max(4, Math.round((amount / chartMax.value) * 136)) }
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-semibold capitalize text-leaf">{{ todayLabel }}</p>
        <h1 class="mt-1 text-[27px] font-bold tracking-[-.035em] text-ink">{{ greeting() }}, {{ store.currentUser?.fullName?.split(' ')[0] }} <span>👋</span></h1>
        <p class="mt-1 text-sm text-muted">Kareringizdagi bugungi ish faoliyati va asosiy ko‘rsatkichlar.</p>
      </div>
      <div class="flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-muted"><span class="status-dot"></span> Jonli monitoring <span class="ml-1 text-slate-300">·</span><span>{{ store.todayTrips.length }} ta reys</span></div>
    </div>

    <button v-if="store.openReports.length" class="flex w-full items-center gap-3 rounded-2xl border border-[#f2dfc2] bg-[#fff9ef] px-4 py-3.5 text-left transition hover:border-[#e6c891]" @click="router.push('/fleet')">
      <div class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#ffefcf] text-[#ad7122]"><CircleAlert :size="17" /></div>
      <div class="min-w-0 flex-1"><p class="text-xs font-bold text-[#764b16]">{{ store.openReports.length }} ta texnika bo‘yicha ogohlantirish</p><p class="mt-0.5 truncate text-[11px] text-[#99784b]">{{ store.vehicleName(store.openReports[0].vehicleId) }} · {{ store.openReports[0].description }}</p></div>
      <ChevronRight :size="17" class="shrink-0 text-[#ad7122]" />
    </button>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Bugun tashilgan" :value="`${number(store.todayTonnage, 1)} t`" :detail="`${store.todayTrips.length} ta reys amalga oshirildi`" :icon="Weight" tone="green" trend="Bugun" />
      <MetricCard label="Bugungi tushum" :value="money(store.todayCashIn, { short: true })" detail="Naqd va bank kirimlari" :icon="CircleDollarSign" tone="blue" />
      <MetricCard label="Kunlik sof foyda" :value="money(store.todayProfit, { short: true })" detail="Sotuv qiymati − kunlik chiqim" :icon="TrendingUp" tone="amber" />
      <MetricCard label="Faol samosvallar" :value="`${activeVehicles} / ${store.vehicles.length}`" detail="Hozir ishga tayyor texnika" :icon="Truck" tone="violet" />
    </section>

    <section class="grid gap-5 xl:grid-cols-12">
      <article class="card p-5 sm:p-6 xl:col-span-8">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div><h2 class="section-title">Haftalik moliyaviy oqim</h2><p class="mt-1 text-xs text-muted">Sotuv qiymati va karer xarajatlari</p></div>
          <div class="flex items-center gap-4 text-[10px] font-semibold text-muted"><span class="flex items-center gap-1.5"><i class="h-2 w-2 rounded-full bg-leaf"></i>Sotuv</span><span class="flex items-center gap-1.5"><i class="h-2 w-2 rounded-full bg-[#e8ad62]"></i>Xarajat</span></div>
        </div>
        <div class="mt-7 grid h-[185px] grid-cols-7 gap-2 sm:gap-5">
          <div v-for="day in week" :key="day.key" class="flex min-w-0 flex-col items-center justify-end">
            <div class="flex h-[145px] w-full items-end justify-center gap-1.5 border-b border-line pb-0.5">
              <div class="group relative w-[min(27%,18px)] rounded-t-[5px] bg-[#75ae87] transition-all hover:bg-leaf" :style="{ height: `${barHeight(day.sales)}px` }" :title="`Sotuv: ${money(day.sales)}`"><span class="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[9px] text-white group-hover:block">{{ money(day.sales, { short: true }) }}</span></div>
              <div class="group relative w-[min(27%,18px)] rounded-t-[5px] bg-[#f0c58f] transition-all hover:bg-amber" :style="{ height: `${barHeight(day.expenses)}px` }" :title="`Xarajat: ${money(day.expenses)}`"><span class="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[9px] text-white group-hover:block">{{ money(day.expenses, { short: true }) }}</span></div>
            </div>
            <span class="mt-2 text-[10px] capitalize text-muted">{{ day.label }}</span>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f7faf7] px-4 py-3">
          <div class="flex items-center gap-2 text-[11px] text-muted"><Activity :size="15" class="text-leaf" /><span>Bugungi savdo qiymati</span></div>
          <div class="flex items-center gap-2"><span class="text-sm font-bold text-ink">{{ money(store.todaySales, { short: true }) }}</span><span class="rounded-md bg-[#e9f4ec] px-1.5 py-1 text-[9px] font-bold text-leaf">{{ number(store.todayTonnage, 1) }} t</span></div>
        </div>
      </article>

      <article class="card p-5 sm:p-6 xl:col-span-4">
        <div class="flex items-start justify-between"><div><h2 class="section-title">Pul mablag‘lari</h2><p class="mt-1 text-xs text-muted">Kassa va bank qoldig‘i</p></div><div class="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf2fa] text-[#4f7595]"><WalletCards :size="18" /></div></div>
        <div class="mt-6 space-y-3">
          <div class="flex items-center justify-between rounded-xl border border-line px-3.5 py-3"><div class="flex items-center gap-3"><div class="grid h-8 w-8 place-items-center rounded-lg bg-[#fff4e3] text-[#b77824]"><Banknote :size="16" /></div><div><p class="text-xs font-semibold text-ink">Naqd kassa</p><p class="mt-0.5 text-[10px] text-muted">Joriy qoldiq</p></div></div><strong class="text-sm font-bold text-ink">{{ money(store.cashBalance, { short: true }) }}</strong></div>
          <div class="flex items-center justify-between rounded-xl border border-line px-3.5 py-3"><div class="flex items-center gap-3"><div class="grid h-8 w-8 place-items-center rounded-lg bg-[#eaf2fa] text-[#4f7595]"><WalletCards :size="16" /></div><div><p class="text-xs font-semibold text-ink">Bank hisob raqami</p><p class="mt-0.5 text-[10px] text-muted">Joriy qoldiq</p></div></div><strong class="text-sm font-bold text-ink">{{ money(store.bankBalance, { short: true }) }}</strong></div>
        </div>
        <div class="mt-4 flex items-center justify-between rounded-xl bg-[#f7faf7] px-3.5 py-3"><span class="text-xs font-semibold text-muted">Ochiq nosozliklar</span><span class="text-sm font-bold" :class="store.openReports.length ? 'text-amber' : 'text-leaf'">{{ store.openReports.length }} ta</span></div>
        <button v-if="store.can('finance.view')" class="mt-3 flex w-full items-center justify-between px-1 py-2 text-xs font-bold text-leaf hover:text-forest" @click="router.push('/finance')">Moliyaviy hisobotga o‘tish <ArrowUpRight :size="15" /></button>
      </article>
    </section>

    <section class="grid gap-5 xl:grid-cols-12">
      <article class="card min-w-0 overflow-hidden xl:col-span-8">
        <div class="flex items-center justify-between gap-3 px-5 py-5 sm:px-6"><div><h2 class="section-title">So‘nggi reyslar</h2><p class="mt-1 text-xs text-muted">Karerdan chiqqan oxirgi yuklar</p></div><button v-if="store.can('trips.view')" class="btn-quiet !px-2.5 !py-2 text-xs" @click="router.push('/trips')">Barchasi <ChevronRight :size="15" /></button></div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[640px] border-collapse text-left">
            <thead><tr class="table-head border-y border-line"><th class="px-5 py-3 sm:px-6">Reys / vaqt</th><th class="px-4 py-3">Samosval</th><th class="px-4 py-3">Mijoz</th><th class="px-4 py-3">Og‘irlik</th><th class="px-5 py-3 text-right sm:px-6">Qiymati</th></tr></thead>
            <tbody><tr v-for="trip in recentTrips" :key="trip.id" class="border-b border-[#f0f2f0] last:border-0 hover:bg-[#fbfcfb]">
              <td class="px-5 py-3.5 sm:px-6"><p class="text-xs font-bold text-ink">{{ trip.id }}</p><p class="mt-1 text-[10px] text-muted">{{ dateTime(trip.createdAt) }}</p></td>
              <td class="px-4 py-3.5"><p class="text-xs font-semibold text-ink">{{ store.vehicles.find((v) => v.id === trip.vehicleId)?.plate || '—' }}</p><p class="mt-1 text-[10px] text-muted">{{ store.driverName(trip.driverId) }}</p></td>
              <td class="max-w-[175px] px-4 py-3.5"><p class="truncate text-xs text-ink">{{ store.tripClient(trip) }}</p><span :class="trip.saleType === 'cash' ? 'tag-cash' : 'tag-credit'" class="tag mt-1">{{ trip.saleType === 'cash' ? 'Naqd' : 'Hisobga' }}</span></td>
              <td class="px-4 py-3.5"><span class="text-xs font-bold text-ink">{{ number(trip.weightTons, 1) }} t</span><p class="mt-1 text-[10px] text-muted">{{ store.materialName(trip.materialId) }}</p></td>
              <td class="px-5 py-3.5 text-right sm:px-6"><span class="text-xs font-bold text-ink">{{ money(trip.totalAmount, { short: true }) }}</span></td>
            </tr><tr v-if="!recentTrips.length"><td colspan="5" class="px-6 py-10 text-center text-sm text-muted">Hozircha reyslar yo‘q.</td></tr></tbody>
          </table>
        </div>
      </article>

      <div class="space-y-5 xl:col-span-4">
        <article class="card p-5">
          <div class="flex items-center justify-between"><div><h2 class="section-title">Texnikalar holati</h2><p class="mt-1 text-xs text-muted">{{ activeVehicles }} ta ishga tayyor</p></div><button v-if="store.can('fleet.view')" class="btn-quiet !p-2" aria-label="Texnikalarni ko‘rish" @click="router.push('/fleet')"><ChevronRight :size="16" /></button></div>
          <div class="mt-3 divide-y divide-[#f0f2f0]">
            <div v-for="vehicle in fleetPreview" :key="vehicle.id" class="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
              <div class="grid h-9 w-9 shrink-0 place-items-center rounded-xl" :class="vehicle.status === 'active' ? 'bg-mint text-leaf' : 'bg-amber-50 text-amber'"><Truck :size="17" /></div>
              <div class="min-w-0 flex-1"><p class="truncate text-xs font-bold text-ink">{{ vehicle.plate }}</p><p class="mt-0.5 truncate text-[10px] text-muted">{{ store.driverName(vehicle.driverId) }}</p></div>
              <span class="status-pill" :class="vehicle.status === 'active' ? 'status-active' : 'status-service'">{{ vehicle.status === 'active' ? 'Faol' : 'Servisda' }}</span>
            </div>
          </div>
        </article>

        <article class="card p-5">
          <div class="flex items-center justify-between"><div><h2 class="section-title">Mijozlar balansi</h2><p class="mt-1 text-xs text-muted">Qarz va avanslar</p></div><button v-if="store.can('clients.view')" class="btn-quiet !p-2" aria-label="Mijozlarni ko‘rish" @click="router.push('/clients')"><ChevronRight :size="16" /></button></div>
          <div class="mt-3 space-y-2.5">
            <div v-for="client in clientRows" :key="client.id" class="flex items-center gap-2.5">
              <div class="avatar avatar-small" :class="client.balance < 0 ? 'avatar-blue' : ''">{{ initials(client.name) }}</div>
              <div class="min-w-0 flex-1"><p class="truncate text-[11px] font-semibold text-ink">{{ client.name }}</p><p class="mt-0.5 text-[9px] text-muted">{{ client.balance < 0 ? 'Avans mavjud' : client.balance > 0 ? 'To‘lanmagan qarz' : 'Hisob yopiq' }}</p></div>
              <span class="text-[11px] font-bold" :class="client.balance > 0 ? 'text-[#bd594d]' : client.balance < 0 ? 'text-leaf' : 'text-muted'">{{ money(Math.abs(client.balance), { short: true }) }}</span>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
