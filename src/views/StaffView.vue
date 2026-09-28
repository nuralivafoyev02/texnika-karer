<script setup>
import { computed, ref } from 'vue'
import { UserRoundCog, Plus, Search, Phone, ShieldCheck, UsersRound, ArrowUpRight, UserPlus, KeyRound, Pencil, Copy, Check } from 'lucide-vue-next'
import ModalDialog from '../components/ModalDialog.vue'
import StaffForm from '../components/forms/StaffForm.vue'
import { useQuarryStore } from '../stores/quarry'
import { initials, money } from '../lib/format'

const store = useQuarryStore()
const search = ref('')
const showCreate = ref(false)
const editing = ref(null)
const credentials = ref(null)
const saving = ref(false)
const passwordUser = ref(null)
const password = ref('')
const passwordError = ref('')
const copied = ref(false)
const staff = computed(() => store.users.filter((user) => !search.value.trim() || `${user.fullName} ${user.login} ${user.phone} ${store.roleName(user)}`.toLowerCase().includes(search.value.trim().toLowerCase())))
const rolesInUse = computed(() => new Set(store.users.map((user) => user.roleId)).size)
const drivers = computed(() => store.users.filter((user) => store.userCan(user, 'driver.self')))

function notify(message, type = 'error') { store.notify(message, type) }

async function create(payload) {
  saving.value = true
  try {
    const result = await store.createStaff(payload)
    showCreate.value = false
    if (result?.password) credentials.value = { login: result.login, password: result.password, name: result.fullName || payload.fullName }
  } catch (error) { notify(error.message || 'Xodimni qo‘shib bo‘lmadi.') }
  finally { saving.value = false }
}
async function save(payload) {
  saving.value = true
  try { await store.updateStaffProfile(editing.value.id, payload); editing.value = null }
  catch (error) { notify(error.message || 'Saqlab bo‘lmadi.') }
  finally { saving.value = false }
}
async function savePassword() {
  passwordError.value = ''
  if (String(password.value).trim().length < 8) { passwordError.value = 'Parol kamida 8 ta belgidan iborat bo‘lishi kerak.'; return }
  saving.value = true
  try { await store.setStaffPassword(passwordUser.value.id, password.value); passwordUser.value = null; password.value = '' }
  catch (error) { passwordError.value = error.message || 'Parolni yangilab bo‘lmadi.' }
  finally { saving.value = false }
}
function openPassword(user) { passwordUser.value = user; password.value = ''; passwordError.value = '' }
async function copyCredentials() {
  if (!credentials.value) return
  try {
    await navigator.clipboard.writeText(`Login: ${credentials.value.login}\nParol: ${credentials.value.password}`)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch { notify('Kiritishga ruxsat berilmadi: matnni qo‘lda ko‘chiring.') }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4"><div><div class="mb-1 flex items-center gap-2 text-xs font-semibold text-leaf"><UserRoundCog :size="15" /> Jamoa boshqaruvi</div><h1 class="page-title">Xodimlar</h1><p class="page-subtitle">Xodimlarning logini va parolini siz yaratasiz — email yoki taklif linkisiz.</p></div><button v-if="store.canManageStaff" class="btn-primary" @click="showCreate = true"><UserPlus :size="16" /> Xodim qo‘shish</button></div>

    <section class="grid gap-4 sm:grid-cols-3"><article class="card flex items-center gap-3 p-4"><div class="grid h-10 w-10 place-items-center rounded-xl bg-mint text-leaf"><UsersRound :size="18" /></div><div><p class="text-[10px] font-bold uppercase tracking-wide text-muted">Jami xodimlar</p><p class="mt-1 text-lg font-bold text-ink">{{ store.users.length }} <span class="text-xs font-medium text-muted">kishi</span></p></div></article><article class="card flex items-center gap-3 p-4"><div class="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3fa] text-[#4f7595]"><ShieldCheck :size="18" /></div><div><p class="text-[10px] font-bold uppercase tracking-wide text-muted">Faol lavozimlar</p><p class="mt-1 text-lg font-bold text-ink">{{ store.roles.length }} <span class="text-xs font-medium text-muted">rol</span></p></div></article><article class="card flex items-center gap-3 p-4"><div class="grid h-10 w-10 place-items-center rounded-xl bg-[#fff4e3] text-[#b77824]"><ArrowUpRight :size="18" /></div><div><p class="text-[10px] font-bold uppercase tracking-wide text-muted">Lavozim biriktirilgan</p><p class="mt-1 text-lg font-bold text-ink">{{ rolesInUse }} <span class="text-xs font-medium text-muted">tur</span></p></div></article></section>

    <section class="card overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 class="section-title">Jamoa a’zolari</h2><p class="mt-1 text-xs text-muted">Har bir xodim faqat o‘z lavozimiga biriktirilgan huquqlarni oladi.</p></div><label class="relative w-full sm:max-w-[280px]"><Search :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="search" class="field !py-2.5 !pl-9" placeholder="Ism, login yoki lavozim..." /></label></div>
      <div class="overflow-x-auto"><table class="w-full min-w-[820px] border-collapse text-left"><thead><tr class="table-head border-b border-line"><th class="px-5 py-3">Xodim</th><th class="px-4 py-3">Login</th><th class="px-4 py-3">Lavozim</th><th class="px-4 py-3">Telefon</th><th class="px-4 py-3">Reys stavkasi</th><th class="px-5 py-3 text-right">Holati</th><th v-if="store.canManageStaff" class="px-5 py-3 text-right">Amallar</th></tr></thead><tbody>
        <tr v-for="user in staff" :key="user.id" class="border-b border-[#f0f2f0] last:border-0 hover:bg-[#fbfcfb]"><td class="px-5 py-4"><div class="flex items-center gap-3"><div class="avatar" :class="store.userCan(user, 'driver.self') ? 'avatar-driver' : store.roleName(user) === 'Buxgalter' ? 'avatar-blue' : ''">{{ initials(user.fullName) }}</div><div><p class="text-xs font-bold text-ink">{{ user.fullName }} <span v-if="store.isSuperadmin(user)" class="ml-1 rounded bg-[#fff4e3] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#b77824]">super</span></p><p class="mt-1 text-[10px] text-muted">{{ user.title || store.roleName(user) }}</p></div></div></td>
          <td class="px-4 py-4"><code class="rounded-md bg-canvas px-2 py-1 text-[11px] text-ink">{{ user.login || '—' }}</code></td>
          <td class="px-4 py-4"><div class="inline-flex items-center gap-1.5 rounded-lg bg-canvas px-2.5 py-1.5 text-[10px] font-bold text-ink"><ShieldCheck :size="12" class="text-leaf" />{{ store.roleName(user) }}</div></td>
          <td class="px-4 py-4"><a v-if="user.phone" :href="`tel:${user.phone}`" class="flex items-center gap-1.5 text-[10px] text-muted hover:text-leaf"><Phone :size="12" />{{ user.phone }}</a><span v-else class="text-[10px] text-muted">—</span></td>
          <td class="px-4 py-4"><span v-if="user.driverRatePerTrip" class="text-xs font-semibold text-ink">{{ money(user.driverRatePerTrip) }} <small class="text-[9px] font-normal text-muted">/ reys</small></span><span v-else class="text-xs text-muted">—</span></td>
          <td class="px-5 py-4 text-right"><span class="status-pill" :class="user.isActive ? 'status-active' : 'status-service'">{{ user.isActive ? 'Faol' : 'Faol emas' }}</span></td>
          <td v-if="store.canManageStaff" class="px-5 py-4"><div class="flex items-center justify-end gap-1"><button class="btn-quiet !p-1.5" title="Parolni yangilash" @click="openPassword(user)"><KeyRound :size="14" /></button><button class="btn-quiet !p-1.5" title="Tahrirlash" @click="editing = user"><Pencil :size="14" /></button></div></td></tr>
        <tr v-if="!staff.length"><td :colspan="store.canManageStaff ? 7 : 6" class="px-6 py-14 text-center text-sm text-muted">Xodim topilmadi.</td></tr>
      </tbody></table></div>
      <footer class="border-t border-line px-5 py-3 text-[10px] text-muted">{{ staff.length }} ta xodim</footer>
    </section>

    <ModalDialog v-model="showCreate" title="Yangi xodim qo‘shish" description="Login va parol shu zahotiyoq yaratiladi."><StaffForm :roles="store.roles" :demo-mode="!store.remoteMode" :loading="saving" @submit="create" @cancel="showCreate = false" /></ModalDialog>
    <ModalDialog :model-value="Boolean(editing)" title="Xodimni tahrirlash" description="Lavozim, aloqa va holatni yangilang." @update:model-value="editing = null"><StaffForm v-if="editing" :roles="store.roles" :user="editing" :demo-mode="!store.remoteMode" :loading="saving" @submit="save" @cancel="editing = null" /></ModalDialog>
    <ModalDialog :model-value="Boolean(passwordUser)" :title="`Parolni yangilash${passwordUser ? ` — ${passwordUser.fullName}` : ''}`" description="Xodim yangi parol bilan tizimga kiradi." @update:model-value="passwordUser = null">
      <form @submit.prevent="savePassword">
        <label class="block"><span class="label">Yangi parol</span><div class="relative"><KeyRound :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="password" class="field pl-10" type="password" autocomplete="new-password" placeholder="Kamida 8 ta belgi" /></div></label>
        <p class="mt-3 rounded-xl bg-canvas p-3 text-[11px] leading-4 text-muted">Xodimga parolni alohida yetkazing. U boshqa kish bilan bo‘lishmasligi kerak — kim bilsa, o‘z nomidan ma’lumot kiritishi mumkin.</p>
        <p v-if="passwordError" class="mt-3 text-xs font-semibold text-danger">{{ passwordError }}</p>
        <div class="mt-4 flex justify-end gap-2"><button type="button" class="btn-secondary" @click="passwordUser = null">Bekor qilish</button><button class="btn-primary" :disabled="saving">{{ saving ? 'Saqlanmoqda…' : 'Parolni yangilash' }}</button></div>
      </form>
    </ModalDialog>
    <ModalDialog :model-value="Boolean(credentials)" title="Xodim tizimga tayyor" description="Login va parolni xodimga yetkazing." @update:model-value="credentials = null">
      <div class="space-y-4">
        <div class="rounded-2xl border border-mint bg-[#f4faf5] p-4"><p class="text-[10px] font-bold uppercase tracking-wide text-muted">{{ credentials?.name }}</p><dl class="mt-3 space-y-2 text-sm"><div class="flex items-center justify-between gap-3"><dt class="text-muted">Login</dt><dd><code class="rounded-md bg-white px-2 py-1 text-xs font-bold text-ink">{{ credentials?.login }}</code></dd></div><div class="flex items-center justify-between gap-3"><dt class="text-muted">Parol</dt><dd><code class="rounded-md bg-white px-2 py-1 text-xs font-bold text-ink">{{ credentials?.password }}</code></dd></div></dl></div>
        <p class="text-[11px] leading-4 text-muted">Parol faqat shu oynada bir marta ko‘rsatiladi va tizimda shifrlangan holda saqlanadi. Uni yo‘qotib qo‘ysangiz, “Parol” tugmasi orqali yangilaysiz.</p>
        <div class="flex justify-end gap-2"><button class="btn-secondary" type="button" @click="credentials = null">Yopish</button><button class="btn-primary" type="button" @click="copyCredentials"><Check v-if="copied" :size="15" /><Copy v-else :size="15" />{{ copied ? 'Nusxalandi' : 'Nusxa olish' }}</button></div>
      </div>
    </ModalDialog>
  </div>
</template>
