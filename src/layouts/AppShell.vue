<script setup>
import { RouterView } from 'vue-router'
import { Check, CircleAlert, X } from 'lucide-vue-next'
import AppSidebar from '../components/AppSidebar.vue'
import AppHeader from '../components/AppHeader.vue'
import { useQuarryStore } from '../stores/quarry'
import { supabaseConfigured } from '../lib/supabase'

const store = useQuarryStore()
</script>

<template>
  <div class="app-shell">
    <!-- Fon yangilanishi: cache'dagi ma'lumot o'z joyida qoladi, faqat yuqorida
         ingichka chiziq aylanadi. Skeleton bu holatda qaytmaydi. -->
    <div v-if="store.refreshing" class="refresh-bar" role="status" aria-live="polite">
      <span></span>
      <span class="sr-only">Ma’lumotlar yangilanmoqda…</span>
    </div>
    <AppSidebar />
    <div class="app-content">
      <AppHeader />
      <main class="content-area">
        <div v-if="!supabaseConfigured" class="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] leading-4 text-red-700">
          <CircleAlert :size="14" class="mt-0.5 shrink-0" />
          <p class="flex-1"><strong class="font-bold">Supabase ulanmagan — tizim demo rejimida ishlab turibdi.</strong> Loyiha ildizida `.env` faylida <code class="rounded bg-white/70 px-1">VITE_SUPABASE_URL</code> va <code class="rounded bg-white/70 px-1">VITE_SUPABASE_ANON_KEY</code> bo‘lishi kerak (`.env.example` ga emas), so‘ng <code class="rounded bg-white/70 px-1">npm run dev</code> ni qayta ishga tushiring. Barcha kiritilgan ma’lumotlar faqat shu brauzerning xotirasida saqlanadi.</p>
        </div>
        <div v-if="store.dataWarnings.length" class="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-4 text-amber-800">
          <CircleAlert :size="14" class="mt-0.5 shrink-0" />
          <p class="flex-1">Quyidagi ma’lumotlar yuklanmadi, ko‘rsatkichlar to‘liq bo‘lmasligi mumkin: {{ store.dataWarnings.join(', ') }}.</p>
          <button class="btn-quiet !p-1" aria-label="Ogohlantirishni yopish" @click="store.dataWarnings = []"><X :size="14" /></button>
        </div>
        <RouterView v-slot="{ Component, route }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" :key="route.name" />
          </Transition>
        </RouterView>
      </main>
    </div>
    <Transition name="fade">
      <div v-if="store.toast" class="fixed bottom-5 right-5 z-[100] flex max-w-[calc(100vw-40px)] items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-float">
        <div :class="store.toast.type === 'error' ? 'bg-red-50 text-danger' : 'bg-mint text-leaf'" class="grid h-8 w-8 place-items-center rounded-xl">
          <CircleAlert v-if="store.toast.type === 'error'" :size="17" />
          <Check v-else :size="17" />
        </div>
        <p class="text-sm font-semibold text-ink">{{ store.toast.message }}</p>
        <button class="btn-quiet ml-1 !p-1" aria-label="Xabarni yopish" @click="store.toast = null"><X :size="16" /></button>
      </div>
    </Transition>
  </div>
</template>
