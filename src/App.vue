<script setup>
import { computed } from 'vue'
import { useQuarryStore } from './stores/quarry'
import AppShell from './layouts/AppShell.vue'
import AppSkeleton from './components/AppSkeleton.vue'
import AuthView from './views/AuthView.vue'

const store = useQuarryStore()
const showAuth = computed(() => store.remoteMode && (!store.session || !store.currentUser))
</script>

<template>
  <!-- 1) Sessiya tekshirilmoqda — brendli qisqa ekran (index.html dagi statik
       splash bilan bir xil ko'rinish, o'tish sezilmaydi). -->
  <div v-if="!store.ready" class="loading-screen">
    <div class="brand-mark brand-mark-large"><span></span><span></span><span></span></div>
    <p>AliBuilding tizimi yuklanmoqda</p>
    <div class="loading-track"><span></span></div>
  </div>
  <!-- 2) Kirish ekransi (sessiya yo'q) — o'z vaqtida chiqadi. -->
  <AuthView v-else-if="showAuth" />
  <!-- 3) Ma'lumot kelguncha — sahifaning o'z skeletoni. Keshdan hydrate bo'lgan
       holatda bu bosqich o'tib ketadi va to'liq ma'lumot darhol ko'rinadi. -->
  <AppSkeleton v-else-if="store.bootstrapping" />
  <!-- 4) Ma'lumot tayyor. -->
  <AppShell v-else />
</template>
