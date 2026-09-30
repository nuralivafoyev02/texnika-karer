<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ShieldCheck, Plus, Pencil, Trash2, Package, WalletCards, Settings2 } from 'lucide-vue-next'
import ModalDialog from '../components/ModalDialog.vue'
import RoleEditor from '../components/forms/RoleEditor.vue'
import MaterialsPanel from '../components/settings/MaterialsPanel.vue'
import FinanceCategoriesPanel from '../components/settings/FinanceCategoriesPanel.vue'
import { PERMISSION_CATALOG } from '../lib/permissions'
import { initials } from '../lib/format'
import { useQuarryStore } from '../stores/quarry'

const store = useQuarryStore()
const route = useRoute()

// Yangi tablar: *create — faqat qo'shish, *manage — to'liq boshqaruv (qo'shish + tahrirlash + o'chirish).
const tabs = computed(() => [
  { key: 'roles', label: 'Lavozimlar', icon: ShieldCheck, show: store.can('roles.manage') },
  { key: 'materials', label: 'Mahsulotlar', icon: Package, show: store.canCreateMaterial },
  { key: 'finance', label: 'Moliya turlari', icon: WalletCards, show: store.canCreateCategory },
].filter((tab) => tab.show))

const activeTab = ref('')
const showEditor = ref(false)
const editingRole = ref(null)
const saving = ref(false)

// Ruxsatlar kech yuklansa (cache'dan ochilish holati), joriy tab ko'rinmay qolmasligi kerak.
watch(tabs, (items) => {
  if (!items.length) return
  if (!items.some((tab) => tab.key === activeTab.value)) activeTab.value = items[0].key
}, { immediate: true })

const roles = computed(() => store.roles.map((role) => ({
  ...role,
  // Karta ostidagi hover menyuda odamlar TAGMA-TAG ko'rinadi,
  // shuning uchun faqat son emas, o'z ro'yxati ham kerak.
  members: store.users.filter((user) => user.roleId === role.id && user.isActive !== false),
  // To'liq dostugini belgilash: ushbu lavozimdagi xodimlar superadmin bo'ladi.
  fullAccess: store.roleHasFullAccess(role.id),
})))

function openRole(role = null) {
  editingRole.value = role ? { ...role, permissions: [...role.permissions] } : null
  showEditor.value = true
}
async function saveRole(payload) {
  saving.value = true
  try {
    await store.saveRole(payload)
    showEditor.value = false
  } catch (error) {
    store.notify(error.message || 'Lavozimni saqlab bo‘lmadi.', 'error')
  } finally {
    saving.value = false
  }
}
async function removeRole(role) {
  if (!window.confirm(`“${role.name}” lavozimini o‘chirishni tasdiqlaysizmi?`)) return
  try { await store.deleteRole(role.id) }
  catch (error) { store.notify(error.message || 'Lavozimni o‘chirib bo‘lmadi.', 'error') }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div class="mb-1 flex items-center gap-2 text-xs font-semibold text-leaf"><Settings2 :size="15" /> Tizim sozlamalari</div>
        <h1 class="page-title">Sozlamalar</h1>
      </div>
      <button v-if="activeTab === 'roles' && store.can('roles.manage')" class="btn-primary" @click="openRole()"><Plus :size="16" /> Yangi lavozim</button>
    </div>

    <div class="flex w-fit flex-wrap gap-1 rounded-xl border border-line bg-white p-1">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition"
        :class="activeTab === tab.key ? 'bg-mint text-forest' : 'text-muted hover:text-ink'"
        @click="activeTab = tab.key"
      >
        <component :is="tab.icon" :size="15" /> {{ tab.label }}
      </button>
    </div>

    <template v-if="activeTab === 'roles' && store.can('roles.manage')">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <!-- Minimal karta: ikonkasiz, tahrirlash nom qatorida, odamlar hover menyusi ustma-ust. -->
        <article v-for="role in roles" :key="role.id" class="card p-5 transition hover:shadow-soft">
          <div class="flex items-center justify-between gap-3">
            <h2 class="min-w-0 truncate text-base font-bold text-ink">{{ role.name }}</h2>
            <div class="flex shrink-0 items-center gap-0.5">
              <button class="btn-quiet !p-1.5" aria-label="Lavozimni tahrirlash" @click="openRole(role)"><Pencil :size="14" /></button>
              <button v-if="!role.isSystem" class="btn-quiet !p-1.5 !text-danger" aria-label="Lavozimni o‘chirish" @click="removeRole(role)"><Trash2 :size="14" /></button>
            </div>
          </div>
          <p class="mt-1 min-h-[34px] text-xs leading-5 text-muted">{{ role.description || 'Lavozim tavsifi kiritilmagan.' }}</p>
          <div class="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
            <!-- Odamlar: hover → ro'yxat ochiladi, menuga o'tganda ochiq qoladi (group-hover) -->
            <div class="group relative">
              <button type="button"
                class="flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-[10px] font-semibold text-muted transition hover:text-ink"
                :aria-label="`${role.members.length} nafar xodim — ro‘yxatni ko‘rish`">
                <span class="flex -space-x-1.5">
                  <span v-for="person in role.members.slice(0, 3)" :key="person.id"
                    class="avatar avatar-small !h-6 !w-6 !rounded-full !text-[8px] ring-2 ring-white">{{ initials(person.fullName) }}</span>
                  <span v-if="role.members.length > 3"
                    class="avatar avatar-small !h-6 !w-6 !rounded-full !bg-[#eff2f7] !text-[#56667e] !text-[8px] ring-2 ring-white">+{{ role.members.length - 3 }}</span>
                  <span v-if="!role.members.length"
                    class="avatar avatar-small !h-6 !w-6 !rounded-full !bg-canvas !text-muted !text-[8px] ring-2 ring-white">—</span>
                </span>
                {{ role.members.length }} nafar xodim
              </button>
              <!-- pb-2: oraliqni menyu qamrab oladi — hover uzilmasdan davom etadi -->
              <div v-if="role.members.length"
                class="invisible absolute bottom-full left-0 z-30 w-60 translate-y-1 pb-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                <div class="max-h-[260px] overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-float">
                  <p class="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">{{ role.name }} · xodimlar</p>
                  <div v-for="person in role.members" :key="person.id" class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition hover:bg-canvas">
                    <span class="avatar avatar-small !h-7 !w-7 !rounded-full !text-[9px]">{{ initials(person.fullName) }}</span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-[11px] font-semibold text-ink">{{ person.fullName }}</span>
                      <span class="mt-0.5 block truncate text-[9px] text-muted">{{ person.title || person.phone || 'Xodim' }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div class="shrink-0 rounded-lg bg-canvas px-2 py-1 text-[10px] font-bold text-ink">{{ role.permissions.length }} ruxsat</div>
          </div>
          <div class="mt-3 flex flex-wrap gap-1.5">
            <span v-for="permission in role.permissions.slice(0, 4)" :key="permission" class="rounded-md bg-[#f4f7fc] px-2 py-1 text-[9px] font-semibold text-[#607067]">{{ PERMISSION_CATALOG.find((item) => item.key === permission)?.label || permission }}</span>
            <span v-if="role.permissions.length > 4" class="rounded-md bg-[#f4f7fc] px-2 py-1 text-[9px] font-semibold text-muted">+{{ role.permissions.length - 4 }} ta</span>
          </div>
        </article>
      </div>
    </template>

    <MaterialsPanel v-else-if="activeTab === 'materials' && store.canCreateMaterial" />
    <FinanceCategoriesPanel v-else-if="activeTab === 'finance' && store.canCreateCategory" />

    <ModalDialog v-model="showEditor" :title="editingRole ? 'Lavozimni tahrirlash' : 'Yangi lavozim yaratish'" width="max-w-2xl">
      <RoleEditor :key="editingRole?.id || 'new-role'" :role="editingRole" :catalog="PERMISSION_CATALOG" :loading="saving" @submit="saveRole" @cancel="showEditor = false" />
    </ModalDialog>
  </div>
</template>
