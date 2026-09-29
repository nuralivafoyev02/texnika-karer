<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, LockKeyhole, UserRound, ShieldCheck } from 'lucide-vue-next'
import { useQuarryStore } from '../stores/quarry'
import { INTERNAL_DOMAIN } from '../lib/supabase'

const store = useQuarryStore()
const router = useRouter()
const login = ref('')
const password = ref('')
const busy = ref(false)
const error = ref(store.authError || store.dataError || '')
async function changeAccount() {
  await store.signOut()
  error.value = ''
}
async function submit() {
  error.value = ''
  busy.value = true
  try {
    await store.signIn(login.value, password.value)
    await router.replace(store.homeRoute)
  } catch (exception) {
    error.value = exception.message || 'Kirish imkoni bo‘lmadi.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="flex min-h-screen bg-white">
    <section class="relative hidden w-[48%] flex-col justify-between overflow-hidden bg-[#0b2f5e] p-12 text-white lg:flex">
      <div class="absolute -right-24 -top-28 h-[420px] w-[420px] rounded-full border border-white/10"></div><div class="absolute -right-8 -top-12 h-[290px] w-[290px] rounded-full border border-white/10"></div>
      <div class="relative z-10 flex items-center gap-3"><div class="brand-mark"><span></span><span></span><span></span></div><div class="brand-copy"><strong>AliBuilding<span style="color:#7db3ff">.</span></strong><small>KARER BOSHQARUVI</small></div></div>
      <div class="relative z-10 max-w-[490px]">
        <div class="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-[#bed6f5]"><ShieldCheck :size="14" /> Boshqaruv bir joyda</div>
        <h1 class="text-[42px] font-semibold leading-[1.12] tracking-[-.045em]">Karer ishini<br><span class="text-[#7db3ff]">aniq nazorat</span> qiling.</h1>
        <p class="mt-5 max-w-[400px] text-sm leading-6 text-[#b6cbe8]">Reyslar, texnika, mijozlar balansi va kunlik moliya — jamoangiz uchun yagona tizimda.</p>
        <div class="mt-9 grid grid-cols-3 gap-3">
          <div class="rounded-2xl border border-white/10 bg-white/[.06] p-4"><p class="text-lg font-bold">Reyslar</p><p class="mt-1 text-[10px] text-[#a8c4ea]">tonna va tushum nazorati</p></div>
          <div class="rounded-2xl border border-white/10 bg-white/[.06] p-4"><p class="text-lg font-bold">Ruxsatlar</p><p class="mt-1 text-[10px] text-[#a8c4ea]">lavozimga qarab kirish</p></div>
          <div class="rounded-2xl border border-white/10 bg-white/[.06] p-4"><p class="text-lg font-bold">Hisob-kitob</p><p class="mt-1 text-[10px] text-[#a8c4ea]">kassa va bank nazorati</p></div>
        </div>
      </div>
      <p class="relative z-10 text-[10px] text-[#84a3c9]">© {{ new Date().getFullYear() }} AliBuilding · Ichki foydalanish uchun</p>
    </section>
    <section class="flex flex-1 items-center justify-center px-6 py-12">
      <div class="w-full max-w-[390px]">
        <div class="mb-8 lg:hidden"><div class="brand-mark mb-3"><span></span><span></span><span></span></div><p class="font-bold">AliBuilding</p></div>
        <p class="text-[10px] font-bold uppercase tracking-[.16em] text-leaf">Xush kelibsiz</p>
        <h2 class="mt-2 text-3xl font-bold tracking-tight text-ink">Tizimga kirish</h2>
        <form class="mt-8 space-y-4" @submit.prevent="submit">
          <label class="block"><span class="label">Login</span><div class="relative"><UserRound :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="login" class="field pl-10" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Administrator bergan login" required /></div><span v-if="login.trim() && !login.includes('@')" class="mt-1 block text-[10px] text-muted">Tizimga {{ login.trim() }}@{{ INTERNAL_DOMAIN }} orqali kirasiz</span></label>
          <label class="block"><span class="label">Parol</span><div class="relative"><LockKeyhole :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="password" class="field pl-10" type="password" autocomplete="current-password" placeholder="Parolingiz" required /></div></label>
          <p v-if="error" class="rounded-xl bg-red-50 px-3 py-2.5 text-xs leading-5 text-danger">{{ error }}</p>
          <button class="btn-primary w-full !py-3" :disabled="busy">{{ busy ? 'Tekshirilmoqda…' : 'Kirish' }}<ArrowRight :size="16" /></button>
          <button v-if="store.session && store.dataError" type="button" class="btn-quiet w-full" @click="changeAccount">Boshqa hisob bilan kirish</button>
        </form>
        <div class="mt-7 rounded-2xl border border-line bg-canvas px-4 py-3 text-[11px] leading-5 text-muted">Login va parolni tizim administratori beradi — o‘z-ozidan ro‘yxatdan o‘tish yo‘q.</div>
      </div>
    </section>
  </main>
</template>
