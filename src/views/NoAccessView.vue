<script setup>
import { ShieldAlert, LogOut } from 'lucide-vue-next'
import { useQuarryStore } from '../stores/quarry'

const store = useQuarryStore()
</script>

<template>
  <section class="mx-auto flex min-h-[65vh] max-w-md flex-col items-center justify-center text-center">
    <div class="grid h-16 w-16 place-items-center rounded-2xl bg-[#fff4e3] text-amber"><ShieldAlert :size="27" /></div>
    <h1 class="mt-5 text-xl font-bold text-ink">Kirish huquqi berilmagan</h1>
    <p class="mt-2 text-sm leading-6 text-muted">Hisobingizga hech qanday bo‘lim ruxsati biriktirilmagan. Administratoringizdan lavozim va ruxsatlarni tekshirishni so‘rang.</p>
    <button v-if="store.remoteMode" class="btn-secondary mt-5" @click="store.signOut"><LogOut :size="15" /> Hisobdan chiqish</button>
  </section>
</template>
