<script setup>
import { ref, watch, onErrorCaptured } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { Check, CircleAlert, X, RefreshCw } from 'lucide-vue-next'
import AppSidebar from '../components/AppSidebar.vue'
import AppHeader from '../components/AppHeader.vue'
import { useQuarryStore } from '../stores/quarry'
import { supabaseConfigured } from '../lib/supabase'

const store = useQuarryStore()
const route = useRoute()
// Xato chegarasi: bitta bo'lim render paytida xato qilsa, butun ilova oq
// ekranga aylanmasin. Avvalgi holatda bitta noto'g'ri ifoda barcha bo'limlarni
// "refresh qilmaguncha oq" qilib qo'yardi — endi faqat shu bo'limga xabar
// ko'rsatiladi, boshqa bo'limga o'tish esa o'zi tiklanadi.
const viewError = ref('')
const viewAttempt = ref(0)
onErrorCaptured((error) => {
  viewError.value = error?.message || 'Kutilmagan xatolik yuz berdi.'
  return false
})
watch(() => route.name, () => { viewError.value = '' })
function retryView() {
  viewError.value = ''
  viewAttempt.value += 1
}
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
          <p class="flex-1"><strong class="font-bold">Demo rejim:</strong> ma’lumotlar faqat shu brauzerda saqlanadi.</p>
        </div>
        <div v-if="store.dataWarnings.length" class="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-4 text-amber-800">
          <CircleAlert :size="14" class="mt-0.5 shrink-0" />
          <p class="flex-1">Yuklanmadi: {{ store.dataWarnings.join(', ') }}.</p>
          <button class="btn-quiet !p-1" aria-label="Ogohlantirishni yopish" @click="store.dataWarnings = []"><X :size="14" /></button>
        </div>
        <RouterView v-slot="{ Component, route: current }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" v-if="!viewError" :key="`${current.name}-${viewAttempt}`" />
            <div v-else :key="`error-${current.name}`" class="card p-6 text-center">
              <div class="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-red-50 text-danger"><CircleAlert :size="19" /></div>
              <h2 class="text-sm font-bold text-ink">Bu bo‘limni ko‘rsatib bo‘lmadi</h2>
              <p class="mx-auto mt-1 max-w-md text-xs text-muted">{{ viewError }}</p>
              <div class="mt-4 flex items-center justify-center gap-2">
                <button class="btn-primary !py-2 text-xs" @click="retryView"><RefreshCw :size="14" /> Qayta urinish</button>
                <RouterLink to="/dashboard" class="btn-quiet !py-2 text-xs" @click="viewError = ''">Bosh sahifaga</RouterLink>
              </div>
            </div>
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
