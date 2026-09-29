<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Plus, Search, UsersRound, ArrowDownLeft, ArrowUpRight, HandCoins, Phone, CircleDollarSign, ChevronRight, Building2 } from 'lucide-vue-next'
import ModalDialog from '../components/ModalDialog.vue'
import ClientForm from '../components/forms/ClientForm.vue'
import { phoneHref } from '../lib/phone'
import PaymentForm from '../components/forms/PaymentForm.vue'
import { useQuarryStore } from '../stores/quarry'
import { initials, money } from '../lib/format'
import { sectionShort } from '../lib/guide'

const store = useQuarryStore()
const route = useRoute()
// Global qidiruvdan kelgan ?q= bilan ochilsa, ro'yxat shu so'z bo'yicha filtrlanadi.
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const showNewClient = ref(false)
const showPayment = ref(false)
const selectedClientId = ref('')
const saving = ref(false)
const clients = computed(() => store.clients.map((client) => ({ ...client, balance: store.clientBalance(client.id) }))
  .filter((client) => !search.value.trim() || `${client.name} ${client.contactName} ${client.phone}`.toLowerCase().includes(search.value.trim().toLowerCase()))
  .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)))
const totalDebt = computed(() => store.clients.reduce((sum, client) => sum + Math.max(0, store.clientBalance(client.id)), 0))
const totalAdvance = computed(() => store.clients.reduce((sum, client) => sum + Math.max(0, -store.clientBalance(client.id)), 0))
async function createClient(payload) {
  saving.value = true
  try { await store.createClient(payload); showNewClient.value = false }
  catch (error) { store.notify(error.message || 'Mijozni saqlab bo‘lmadi.', 'error') }
  finally { saving.value = false }
}
async function createPayment(payload) {
  saving.value = true
  try { await store.createPayment(payload); showPayment.value = false; selectedClientId.value = '' }
  catch (error) { store.notify(error.message || 'To‘lovni saqlab bo‘lmadi.', 'error') }
  finally { saving.value = false }
}
function openPayment(clientId = '') { selectedClientId.value = clientId; showPayment.value = true }
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div><div class="mb-1 flex items-center gap-2 text-xs font-semibold text-leaf"><UsersRound :size="15" /> Mijozlar bilan ishlash</div><h1 class="page-title">Mijozlar</h1><p class="page-subtitle">{{ sectionShort(route.path) }}</p></div>
      <div class="flex gap-2"><button v-if="store.can('finance.payments.create')" class="btn-secondary" @click="openPayment()"><CircleDollarSign :size="16" /> To‘lov kiritish</button><button v-if="store.can('clients.manage')" class="btn-primary" @click="showNewClient = true"><Plus :size="17" /> Yangi mijoz</button></div>
    </div>

    <section class="grid gap-4 sm:grid-cols-3">
      <article class="card flex items-center gap-3.5 p-4"><div class="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3fa] text-[#4f7595]"><Building2 :size="18" /></div><div><p class="text-[10px] font-bold uppercase tracking-wide text-muted">Faol mijozlar</p><p class="mt-1 text-xl font-bold text-ink">{{ store.clients.length }} <span class="text-xs font-medium text-muted">korxona</span></p></div></article>
      <article class="card flex items-center gap-3.5 p-4"><div class="grid h-10 w-10 place-items-center rounded-xl bg-[#fff0ee] text-[#bd594d]"><ArrowDownLeft :size="19" /></div><div><p class="text-[10px] font-bold uppercase tracking-wide text-muted">Mijozlar qarzi</p><p class="mt-1 text-xl font-bold text-[#bd594d]">{{ money(totalDebt, { short: true }) }}</p></div></article>
      <article class="card flex items-center gap-3.5 p-4"><div class="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf5ee] text-leaf"><ArrowUpRight :size="18" /></div><div><p class="text-[10px] font-bold uppercase tracking-wide text-muted">Mijozlar avansi</p><p class="mt-1 text-xl font-bold text-leaf">{{ money(totalAdvance, { short: true }) }}</p></div></article>
    </section>

    <section class="card overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div><h2 class="section-title">Mijozlar ro‘yxati</h2><p class="mt-1 text-xs text-muted">Balans reyslar va tushgan to‘lovlar asosida hisoblanadi</p></div>
        <label class="relative w-full sm:max-w-[290px]"><Search :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="search" class="field !py-2.5 !pl-9" placeholder="Mijoz yoki telefon..." /></label>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[770px] border-collapse text-left">
          <thead><tr class="table-head border-b border-line"><th class="px-5 py-3">Mijoz</th><th class="px-4 py-3">Mas’ul shaxs</th><th class="px-4 py-3">Aloqa</th><th class="px-4 py-3">Hisob holati</th><th class="px-5 py-3 text-right">Balans</th><th class="px-5 py-3"></th></tr></thead>
          <tbody><tr v-for="client in clients" :key="client.id" class="border-b border-[#f0f2f0] last:border-0 hover:bg-[#fbfcfb]">
            <td class="px-5 py-4"><div class="flex items-center gap-3"><div class="avatar" :class="client.balance < 0 ? 'avatar-blue' : ''">{{ initials(client.name) }}</div><div class="max-w-[230px]"><p class="truncate text-xs font-bold text-ink">{{ client.name }}</p><p class="mt-1 text-[10px] text-muted">Mijoz ID · {{ String(client.id).slice(-5).toUpperCase() }}</p></div></div></td>
            <td class="px-4 py-4"><p class="text-xs text-ink">{{ client.contactName || '—' }}</p></td>
            <td class="px-4 py-4"><a v-if="client.phone" :href="phoneHref(client.phone)" class="flex items-center gap-1.5 text-xs text-muted hover:text-leaf"><Phone :size="13" />{{ client.phone }}</a><span v-else class="text-xs text-muted">—</span></td>
            <td class="px-4 py-4"><span v-if="client.balance > 0" class="inline-flex items-center gap-1.5 rounded-lg bg-[#fff0ee] px-2 py-1 text-[10px] font-bold text-[#bd594d]"><ArrowDownLeft :size="12" /> Qarzdor</span><span v-else-if="client.balance < 0" class="inline-flex items-center gap-1.5 rounded-lg bg-[#eaf5ee] px-2 py-1 text-[10px] font-bold text-leaf"><ArrowUpRight :size="12" /> Avans bor</span><span v-else class="rounded-lg bg-canvas px-2 py-1 text-[10px] font-semibold text-muted">Hisob yopiq</span></td>
            <td class="px-5 py-4 text-right"><span class="text-sm font-bold" :class="client.balance > 0 ? 'text-[#bd594d]' : client.balance < 0 ? 'text-leaf' : 'text-ink'">{{ money(Math.abs(client.balance), { short: true }) }}</span><p v-if="client.balance < 0" class="mt-0.5 text-[9px] text-muted">mijoz foydasiga</p></td>
            <td class="px-5 py-4 text-right"><button v-if="store.can('finance.payments.create')" class="btn-quiet !rounded-lg !px-2.5 !py-2 text-[10px]" @click="openPayment(client.id)"><HandCoins :size="14" /> To‘lov</button><span v-else class="text-slate-300"><ChevronRight :size="16" /></span></td>
          </tr><tr v-if="!clients.length"><td colspan="6" class="px-6 py-14 text-center text-sm text-muted">Qidiruv bo‘yicha mijoz topilmadi.</td></tr></tbody>
        </table>
      </div>
      <footer class="flex items-center justify-between border-t border-line px-5 py-3 text-[10px] text-muted"><span>{{ clients.length }} ta mijoz</span><span class="hidden sm:block">Yashil — avans · Qizil — mijoz qarzi</span></footer>
    </section>

    <ModalDialog v-model="showNewClient" title="Yangi mijoz qo‘shish" description="Mijoz profili va boshlang‘ich hisob holatini kiriting."><ClientForm :loading="saving" @submit="createClient" @cancel="showNewClient = false" /></ModalDialog>
    <ModalDialog v-model="showPayment" title="Mijozdan to‘lov qabul qilish" description="Kirim tanlangan to‘lov turiga ko‘ra kassa yoki bankka yoziladi."><PaymentForm :clients="store.clients" :balance-for="store.clientBalance" :initial-client-id="selectedClientId" :loading="saving" @submit="createPayment" @cancel="showPayment = false" /></ModalDialog>
  </div>
</template>
