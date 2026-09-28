<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Bell, ChevronDown, ArrowUpRight, Wrench, LogOut, CheckCheck, Trash2, Settings } from 'lucide-vue-next'
import { useQuarryStore } from '../stores/quarry'
import { dateLong, dateTime, initials } from '../lib/format'
import ProfileEditor from './forms/ProfileEditor.vue'

const store = useQuarryStore()
const route = useRoute()
const router = useRouter()
const showUsers = ref(false)
const showAlerts = ref(false)
const showProfile = ref(false)
const userMenu = ref(null)
const alertMenu = ref(null)
const avatarUrl = ref('')
const searchInput = ref('')
const searchField = ref(null)
const title = computed(() => route.meta.title || 'Texnika')
const today = dateLong()
const availableReports = computed(() => {
  if (store.can('dashboard.view') || store.can('finance.view') || store.can('fleet.manage')) return store.openReports
  if (store.can('driver.self')) return store.maintenanceReports.filter((report) => report.status === 'open' && report.driverId === store.currentUser?.id)
  return []
})
const sortedReports = computed(() => availableReports.value.slice(0, 5))
const userOptions = computed(() => store.users.filter((user) => user.isActive))

function submitSearch() {
  const term = searchInput.value.trim()
  if (!term) return
  router.push({ path: '/trips', query: { q: term } })
}
function onShortcut(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    searchField.value?.focus()
  }
}

// ── Dropdown yopilishi ──────────────────────────────────────────────────────
// Uch xil yopish: Escape, menyudan tashqariga bosish, boshqa menyuni ochish.
// Tashqariga bosishni aniqlash uchun hodisa target'ni tekshiramiz — `closest`
// bilan "ichida" yoki "tashqarisida" ekanini bilamiz, shuning uchun menyudagi
// tugmalar bosilganda yopilmaydi.
function closeAllMenus() {
  showUsers.value = false
  showAlerts.value = false
}
function onDocumentPointerDown(event) {
  if (showAlerts.value && !alertMenu.value?.contains(event.target)) showAlerts.value = false
  if (showUsers.value && !userMenu.value?.contains(event.target)) showUsers.value = false
}
function onDocumentKeydown(event) {
  if (event.key === 'Escape') closeAllMenus()
}
onMounted(() => {
  window.addEventListener('keydown', onShortcut)
  window.addEventListener('keydown', onDocumentKeydown)
  // pointerdown (mousemove emas) — bosilgan zahoti yopiladi, chirsillash sezilmaydi.
  document.addEventListener('pointerdown', onDocumentPointerDown)
  loadAvatar()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onShortcut)
  window.removeEventListener('keydown', onDocumentKeydown)
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})

// Profil rasmi — signed URL 1 soat amal qiladi, shuning uchun keshga solamiz.
async function loadAvatar() {
  const user = store.currentUser
  if (!user?.avatarPath) { avatarUrl.value = ''; return }
  try { avatarUrl.value = await store.ensureAvatarUrl(user) } catch { avatarUrl.value = '' }
}

// Demoda foydalanuvchi almashganda rasm ham yangilanishi kerak.
watch(() => store.currentUser?.id, loadAvatar)

function openProfileEditor() {
  // Profil modalini ochishdan oldin menyuni yopamiz, aks holda modal tagida qoladi.
  showUsers.value = false
  showProfile.value = true
}

function selectUser(user) {
  store.switchDemoUser(user.id)
  closeAllMenus()
  router.replace(store.homeRoute)
}
function clearDemo() {
  closeAllMenus()
  if (!window.confirm('Barcha demo yozuvlar (mijoz, texnika, reys, moliya, nosozlik) o‘chirilsinmi?')) return
  store.clearDemoRecords()
}
async function logout() {
  await store.signOut()
  closeAllMenus()
  router.replace('/dashboard')
}
</script>

<template>
  <header class="app-header">
    <div class="min-w-0">
      <div class="header-overline">{{ today }}</div>
      <div class="header-title">{{ title }}</div>
    </div>
    <div class="flex min-w-0 items-center gap-3">
      <label class="header-search" aria-label="Qidiruv">
        <Search :size="16" />
        <input ref="searchField" v-model="searchInput" type="search" placeholder="Qidirish..." @keydown.enter="submitSearch" />
        <span class="rounded-md border border-line px-1.5 py-0.5 text-[9px] font-bold text-slate-400">⌘+K</span>
      </label>
      <button v-if="store.can('trips.create')" class="btn-primary !hidden !rounded-xl !px-3.5 !py-2.5 sm:!inline-flex" @click="router.push('/scale')">
        <ArrowUpRight :size="16" /> Yangi reys
      </button>
      <div ref="alertMenu" class="relative">
        <button class="header-icon-btn" aria-label="Bildirishnomalar" :aria-expanded="showAlerts" @click="showAlerts = !showAlerts; showUsers = false">
          <Bell :size="17" />
          <span v-if="availableReports.length" class="absolute -right-1 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full border-2 border-white bg-[#d97850] px-1 text-[8px] font-bold text-white">{{ availableReports.length }}</span>
        </button>
        <Transition name="dropdown">
          <div v-if="showAlerts" class="header-menu">
            <div class="header-menu-panel">
            <div class="header-menu-title"><span>Bildirishnomalar</span><span class="text-[10px] font-medium text-muted">{{ availableReports.length }} ta ochiq</span></div>
            <div v-if="sortedReports.length" class="max-h-[330px] overflow-y-auto pt-1">
              <div v-for="report in sortedReports" :key="report.id" class="header-menu-item items-start">
                <div class="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber"><Wrench :size="15" /></div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2"><p class="truncate text-xs font-bold">{{ store.vehicleName(report.vehicleId) }}</p><span class="status-pill status-open !px-1.5 !py-0.5">Yangi</span></div>
                  <p class="mt-1 line-clamp-2 text-[11px] leading-4 text-muted">{{ report.description }}</p>
                  <p class="mt-1 text-[10px] text-slate-400">{{ store.driverName(report.driverId) }} · {{ dateTime(report.createdAt) }}</p>
                </div>
              </div>
            </div>
            <div v-else class="px-5 py-8 text-center text-xs text-muted"><CheckCheck :size="22" class="mx-auto mb-2 text-leaf" />Yangi bildirishnoma yo‘q</div>
            <button v-if="store.can('fleet.view')" class="mt-1 w-full rounded-xl border-t border-line py-2.5 text-xs font-semibold text-leaf hover:bg-canvas" @click="closeAllMenus(); router.push('/fleet')">Texnikalar sahifasiga o‘tish</button>
            </div>
          </div>
        </Transition>
      </div>
      <div ref="userMenu" class="relative">
        <button class="flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-canvas" :aria-expanded="showUsers" @click="showUsers = !showUsers; showAlerts = false">
          <div class="avatar avatar-small">
            <img v-if="avatarUrl" :src="avatarUrl" :alt="store.currentUser?.fullName" class="h-full w-full rounded-[inherit] object-cover" />
            <template v-else>{{ initials(store.currentUser?.fullName) }}</template>
          </div>
          <div class="hidden text-left sm:block"><p class="max-w-[125px] truncate text-xs font-bold text-ink">{{ store.currentUser?.fullName }}</p><p class="mt-0.5 max-w-[125px] truncate text-[10px] text-muted">{{ store.isSuperadmin() ? 'Superadmin' : store.currentRole?.name }}</p></div>
          <ChevronDown :size="14" class="hidden text-slate-400 sm:block" />
        </button>
        <Transition name="dropdown">
          <div v-if="showUsers" class="header-menu !w-[286px]">
            <div class="header-menu-panel">
            <div class="header-menu-title"><span>{{ store.remoteMode ? 'Hisob' : 'Demo foydalanuvchi' }}</span><span v-if="!store.remoteMode" class="tag tag-blue">Rolni sinash</span></div>
            <!-- Profil qatori: bosilganda tahrirlash modali ochiladi. Ochilgan menyudagi
                 "profil ustiga bosish" talabi shu qatorni bosish bilan bajariladi. -->
            <button class="header-menu-item items-start" @click="openProfileEditor">
              <div class="avatar avatar-small shrink-0">
                <img v-if="avatarUrl" :src="avatarUrl" :alt="store.currentUser?.fullName" class="h-full w-full rounded-[inherit] object-cover" />
                <template v-else>{{ initials(store.currentUser?.fullName) }}</template>
              </div>
              <div class="min-w-0 flex-1 text-left">
                <p class="truncate text-xs font-bold">{{ store.currentUser?.fullName }}</p>
                <p class="text-[10px] text-muted">{{ store.currentUser?.login }} · {{ store.currentRole?.name }}</p>
                <span v-if="store.isSuperadmin()" class="mt-1 inline-block rounded bg-[#fff4e3] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#b77824]">super</span>
              </div>
              <Settings :size="14" class="mt-0.5 shrink-0 text-slate-400" />
            </button>
            <div v-if="!store.remoteMode" class="max-h-[350px] overflow-y-auto pt-1">
              <div class="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Rolni sinash</div>
              <button v-for="user in userOptions" :key="user.id" class="header-menu-item" :class="store.currentUser?.id === user.id ? 'bg-mint/60' : ''" @click="selectUser(user)">
                <div class="avatar avatar-small" :class="store.userCan(user, 'driver.self') ? 'avatar-driver' : ''">{{ initials(user.fullName) }}</div>
                <div class="min-w-0 flex-1"><p class="truncate text-xs font-bold">{{ user.fullName }}</p><p class="text-[10px] text-muted">{{ store.roleName(user) }}</p></div>
                <span v-if="store.currentUser?.id === user.id" class="h-2 w-2 rounded-full bg-leaf"></span>
              </button>
            </div>
            <button v-if="!store.remoteMode" class="header-menu-item mt-1 text-danger" @click="clearDemo"><Trash2 :size="15" />Demo yozuvlarni tozalash</button>
            <button v-if="store.remoteMode" class="header-menu-item mt-1 text-danger" @click="logout"><LogOut :size="15" />Tizimdan chiqish</button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </header>
  <ProfileEditor v-model="showProfile" />
</template>
