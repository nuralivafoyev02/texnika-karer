import { createApp } from 'vue'
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

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)

  const store = useQuarryStore(pinia)
  await store.initialize()
  app.use(router)
  await router.isReady()
  app.mount('#app')

  if (typeof window !== 'undefined') {
    const warm = () => prefetchSections()
    if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 3000 })
    else setTimeout(warm, 1200)
  }
}

bootstrap()
