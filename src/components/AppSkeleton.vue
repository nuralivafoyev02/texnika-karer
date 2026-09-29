<script setup>
// ── Skeleton (ma'lumot kelguncha) ─────────────────────────────────────────────
// Haqiqiy ilova yuklanayotgan paytdagi "soy" tuzilma. Ma'lumot kelishi sekin
// bo'lsa, foydalanuvchi bo'sh oq sahifani emas, o'z sahifasiga o'xshash
// skeletonni ko'radi — so'ng real ma'lumot shu joyga tushadi.
//
// Ruxsatlar va ma'lumot kelgandan keyin bu komponent butunlay almashtiriladi
// (App.vue), shuning uchun uni alohida qayta ishlatish shart emas.
//
// Qaysi sahifa ochilayotgani URL dan olinadi: router birinchi navigatsiyani
// ma'lumot kelmagacha ushlab turadi, lekin `router.resolve()` sahifani
// aniqlashga imkon beradi — skeleton har doim kerakli tuzilmani ko'rsatadi.
import { router } from '../router'

const path = typeof window !== 'undefined' ? window.location.pathname : '/dashboard'
// `/` kabi redirect yozuvlari `name` bermaydi — bir marta qayta yechib, haqiqiy
// sahifa nomini olamiz (aks holda asosiy kirish nuqtasida dashboard skeletoni
// o'rniga ro'yxat skeletoni ko'rinardi).
const resolveName = (target) => {
  const location = router.resolve(target)
  if (location.name) return location.name
  const redirect = location.matched[location.matched.length - 1]?.redirect
  return typeof redirect === 'string' ? router.resolve(redirect).name ?? '' : ''
}
const routeName = resolveName(path)

// Sahifalar tuzilma bo'yicha guruhlanadi: dashboard — ko'rsatkichlar + grafik,
// ro'yxatlar — jadval, "Yangi reys" — forma, sozlamalar — panellar.
const variant = (() => {
  if (routeName === 'scale') return 'form'
  if (routeName === 'settings') return 'panels'
  if (routeName === 'dashboard') return 'dashboard'
  if (routeName === 'no-access') return 'panels'
  return 'list'
})()

const navGroups = [
  { items: 3 },
  { items: 5 },
  { items: 1 },
]
const metricCards = 4
const tableRows = 7
const tableCols = 5
const chartBars = 7
const formFields = 8
</script>

<template>
  <div class="app-shell" role="status" aria-busy="true">
    <span class="sr-only">Ma’lumotlar yuklanmoqda…</span>

    <!-- Yon panel: brend belgisi statik, shuning uchun haqiqiydek ko'rsatiladi -->
    <aside class="sidebar" aria-hidden="true">
      <div class="brand-lockup">
        <div class="brand-mark"><span></span><span></span><span></span></div>
        <div class="brand-copy"><strong>AliBuilding<span style="color:#9fd1ac">.uz</span></strong><small>TEXNIKA BOSHQARUVI</small></div>
      </div>
      <div class="sidebar-scroll">
        <section v-for="(group, index) in navGroups" :key="index">
          <div class="skeleton mx-3 mt-[17px] mb-2 h-2 w-16 rounded" style="background: rgba(255,255,255,.16)" />
          <div v-for="item in group.items" :key="item" class="flex items-center gap-3 rounded-[11px] px-3 py-2.5">
            <div class="skeleton h-[17px] w-[17px] rounded-md" style="background: rgba(255,255,255,.14)" />
            <div class="skeleton h-2.5 flex-1 rounded" style="background: rgba(255,255,255,.12)" />
          </div>
        </section>
      </div>
      <div class="sidebar-bottom">
        <div class="text-center text-[10px] font-semibold text-[#7f9f8a]">v1.3.2</div>
      </div>
    </aside>

    <div class="app-content">
      <header class="app-header" aria-hidden="true">
        <div class="min-w-0">
          <div class="skeleton h-2 w-24 rounded" />
          <div class="skeleton mt-2.5 h-3.5 w-32 rounded" />
        </div>
        <div class="flex min-w-0 items-center gap-3">
          <div class="header-search">
            <div class="skeleton h-3 w-3 rounded-full" />
            <div class="skeleton h-2.5 flex-1 rounded" />
            <div class="skeleton h-3.5 w-7 rounded-md" />
          </div>
          <div class="header-icon-btn"><div class="skeleton h-4 w-4 rounded-md" /></div>
          <div class="flex items-center gap-2 px-1.5 py-1">
            <div class="skeleton skeleton-round h-8 w-8" />
            <div class="hidden gap-1.5 sm:flex sm:flex-col">
              <div class="skeleton h-2.5 w-24 rounded" />
              <div class="skeleton h-2 w-16 rounded" />
            </div>
          </div>
        </div>
      </header>

      <main class="content-area">
        <!-- Sahifa sarlavhasi va amallar -->
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div class="w-full max-w-md">
            <div class="skeleton h-2.5 w-32 rounded" />
            <div class="skeleton mt-3 h-6 w-64 rounded" />
            <div class="skeleton mt-2.5 h-2.5 w-72 rounded" />
          </div>
          <div class="skeleton h-[38px] w-32 rounded-xl" />
        </div>

        <!-- Dashboard: ko'rsatkich kartalari -->
        <section v-if="variant === 'dashboard'" class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div v-for="item in metricCards" :key="item" class="card p-5">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="skeleton h-2.5 w-24 rounded" />
                <div class="skeleton mt-3 h-6 w-20 rounded" />
                <div class="skeleton mt-2.5 h-2 w-32 rounded" />
              </div>
              <div class="skeleton h-9 w-9 rounded-xl" />
            </div>
          </div>
        </section>

        <!-- Dashboard: grafik + qoldiq -->
        <section v-if="variant === 'dashboard'" class="mt-5 grid gap-5 xl:grid-cols-12">
          <article class="card p-5 sm:p-6 xl:col-span-8">
            <div class="skeleton h-3.5 w-44 rounded" />
            <div class="skeleton mt-2.5 h-2.5 w-32 rounded" />
            <div class="mt-7 flex h-[185px] items-end gap-2 border-b border-line sm:gap-5">
              <div v-for="bar in chartBars" :key="bar" class="flex h-full flex-1 items-end justify-center gap-1.5">
                <div class="skeleton w-[min(27%,18px)] rounded-t-[5px]" :style="{ height: `${38 + ((bar * 23) % 58)}%` }" />
                <div class="skeleton skeleton-soft w-[min(27%,18px)] rounded-t-[5px]" :style="{ height: `${22 + ((bar * 17) % 46)}%` }" />
              </div>
            </div>
            <div class="skeleton mt-4 h-[46px] w-full rounded-xl" />
          </article>
          <article class="card p-5 sm:p-6 xl:col-span-4">
            <div class="skeleton h-3.5 w-36 rounded" />
            <div class="skeleton mt-2.5 h-2.5 w-28 rounded" />
            <div class="mt-6 space-y-3">
              <div v-for="item in 2" :key="item" class="flex items-center justify-between rounded-xl border border-line px-3.5 py-3">
                <div class="flex items-center gap-3">
                  <div class="skeleton h-8 w-8 rounded-lg" />
                  <div class="space-y-2">
                    <div class="skeleton h-2.5 w-20 rounded" />
                    <div class="skeleton h-2 w-16 rounded" />
                  </div>
                </div>
                <div class="skeleton h-3 w-16 rounded" />
              </div>
            </div>
            <div class="skeleton mt-4 h-[46px] w-full rounded-xl" />
          </article>
        </section>

        <!-- Ro'yxat sahifalari: filtr paneli + jadval -->
        <template v-if="variant === 'list'">
          <section class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div v-for="item in 3" :key="item" class="card flex items-center gap-3 p-4">
              <div class="skeleton h-9 w-9 rounded-xl" />
              <div class="flex-1 space-y-2">
                <div class="skeleton h-2.5 w-20 rounded" />
                <div class="skeleton h-3 w-28 rounded" />
              </div>
            </div>
          </section>
          <section class="card mt-5 overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
              <div class="space-y-2">
                <div class="skeleton h-3.5 w-40 rounded" />
                <div class="skeleton h-2.5 w-28 rounded" />
              </div>
              <div class="skeleton h-9 w-28 rounded-xl" />
            </div>
            <div class="flex gap-5 border-y border-line px-5 py-3 sm:px-6">
              <div v-for="col in tableCols" :key="col" class="skeleton h-2.5 flex-1 rounded" />
            </div>
            <div v-for="row in tableRows" :key="row" class="flex items-center gap-5 border-b border-[#f0f2f0] px-5 py-4 last:border-0 sm:px-6">
              <div v-for="(col, index) in tableCols" :key="col" class="flex-1">
                <div class="skeleton h-2.5 rounded" :style="{ width: `${[70, 55, 85, 45, 60][index]}%` }" />
                <div class="skeleton skeleton-soft mt-2 h-2 w-1/2 rounded" />
              </div>
            </div>
          </section>
        </template>

        <!-- "Yangi reys": forma maydonlari -->
        <template v-if="variant === 'form'">
          <section class="mt-6 grid gap-5 xl:grid-cols-12">
            <article class="card p-5 sm:p-6 xl:col-span-8">
              <div class="skeleton h-3.5 w-44 rounded" />
              <div class="skeleton mt-2.5 h-2.5 w-56 rounded" />
              <div class="mt-6 grid gap-4 sm:grid-cols-2">
                <div v-for="field in formFields" :key="field" class="space-y-2">
                  <div class="skeleton h-2.5 w-24 rounded" />
                  <div class="skeleton h-[42px] w-full rounded-xl" />
                </div>
              </div>
            </article>
            <article class="card p-5 sm:p-6 xl:col-span-4">
              <div class="skeleton h-3.5 w-32 rounded" />
              <div class="skeleton mt-2.5 h-2.5 w-24 rounded" />
              <div class="skeleton mt-6 h-[110px] w-full rounded-xl" />
              <div class="skeleton mt-4 h-12 w-full rounded-xl" />
              <div class="skeleton mt-3 h-12 w-full rounded-xl" />
            </article>
          </section>
        </template>

        <!-- Sozlamalar / bo'limli panel ro'yxati -->
        <template v-if="variant === 'panels'">
          <section class="card mt-6 overflow-hidden">
            <div class="space-y-2 px-5 py-5 sm:px-6">
              <div class="skeleton h-3.5 w-40 rounded" />
              <div class="skeleton h-2.5 w-64 rounded" />
            </div>
            <div v-for="row in 5" :key="row" class="flex items-center gap-4 border-t border-[#f0f2f0] px-5 py-4 sm:px-6">
              <div class="skeleton h-9 w-9 rounded-xl" />
              <div class="flex-1 space-y-2">
                <div class="skeleton h-2.5 w-40 rounded" />
                <div class="skeleton skeleton-soft h-2 w-24 rounded" />
              </div>
              <div class="skeleton h-8 w-20 rounded-xl" />
            </div>
          </section>
          <section class="card mt-5 overflow-hidden">
            <div class="space-y-2 px-5 py-5 sm:px-6">
              <div class="skeleton h-3.5 w-32 rounded" />
              <div class="skeleton h-2.5 w-48 rounded" />
            </div>
            <div class="grid gap-4 border-t border-[#f0f2f0] px-5 py-5 sm:grid-cols-2 sm:px-6">
              <div v-for="row in 4" :key="row" class="skeleton h-[52px] w-full rounded-xl" />
            </div>
          </section>
        </template>
      </main>
    </div>
  </div>
</template>
