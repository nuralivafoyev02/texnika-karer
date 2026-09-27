<script setup>
import { computed } from 'vue'
import { useQuarryStore } from './stores/quarry'
import AppShell from './layouts/AppShell.vue'
import AuthView from './views/AuthView.vue'

const store = useQuarryStore()
const showAuth = computed(() => store.remoteMode && (!store.session || !store.currentUser))
</script>

<template>
  <div v-if="!store.ready" class="loading-screen">
    <div class="brand-mark brand-mark-large"><span></span><span></span><span></span></div>
    <p>Texnika tizimi yuklanmoqda</p>
    <div class="loading-track"><span></span></div>
  </div>
  <AuthView v-else-if="showAuth" />
  <AppShell v-else />
</template>