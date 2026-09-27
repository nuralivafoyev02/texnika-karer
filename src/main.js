import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useQuarryStore } from './stores/quarry'
import './style.css'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)

  const store = useQuarryStore(pinia)
  await store.initialize()
  app.use(router)
  await router.isReady()
  app.mount('#app')
}

bootstrap()
