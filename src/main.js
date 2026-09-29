import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useQuarryStore } from './stores/quarry'
import './style.css'

// Bo'limlarga birinchi marta o'tganda JS chunk'i yuklanib turmasin:
// ilova ochilgandan keyin barcha bo'lim modullarini bo'sh vaqtda oldindan yuklaymiz.
// Router dagi `import('../views/…')` shu fayllarga ishora qilgani uchun xuddi shu chunk qayta ishlatiladi.
const prefetchSections = () => {
  const sections = [
    () => import('./views/TripsView.vue'),
    () => import('./views/ScaleView.vue'),
    () => import('./views/ClientsView.vue'),
    () => import('./views/FleetView.vue'),
    () => import('./views/FinanceView.vue'),
    () => import('./views/DriversView.vue'),
    () => import('./views/StaffView.vue'),
    () => import('./views/SettingsView.vue'),
  ]
  // Ketma-ket: dastlabki ma'lumot yuklanishi bilan tarmoq band bo'lmasin.
  sections.forEach((load, index) => setTimeout(() => load().catch(() => {}), index * 80))
}

function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(router)

  // Skeleton darhol ko'rinsin: mount'dan OLDIN ma'lumotni kutmaymiz. Ilova o'z
  // skeletoni ko'rsatadi, router esa birinchi navigatsiyani `store.whenReady()`
  // da ushlab turadi — ruxsatlar kelmagandan oldin qaror qabul qilinmaydi.
  app.mount('#app')

  const store = useQuarryStore(pinia)
  store.initialize()

  if (typeof window !== 'undefined') {
    // Bo'lim modullarini faqat dastlabki ma'lumot yuklanib bo'lgandan keyin
    // oldindan yuklaymiz, aks holda ular asosiy so'rovlar bilan band bo'ladi.
    const warm = () => {
      const start = () => setTimeout(prefetchSections, 400)
      if (!store.loading) return start()
      const stop = watch(() => store.loading, (busy) => {
        if (busy) return
        stop()
        start()
      })
    }
    if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 3000 })
    else setTimeout(warm, 1200)
  }
}

bootstrap()
