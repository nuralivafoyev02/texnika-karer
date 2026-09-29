<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ShieldCheck, Plus, Pencil, Trash2, Package, UsersRound, LockKeyhole, WalletCards, Settings2 } from 'lucide-vue-next'
import ModalDialog from '../components/ModalDialog.vue'
import RoleEditor from '../components/forms/RoleEditor.vue'
import MaterialsPanel from '../components/settings/MaterialsPanel.vue'
import FinanceCategoriesPanel from '../components/settings/FinanceCategoriesPanel.vue'
import { PERMISSION_CATALOG } from '../lib/permissions'
import { sectionShort } from '../lib/guide'
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
  people: store.users.filter((user) => user.roleId === role.id).length,
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
        <p class="page-subtitle">{{ sectionShort(route.path) }}</p>
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
        <article v-for="role in roles" :key="role.id" class="card p-5 transition hover:-translate-y-0.5 hover:shadow-soft">
          <div class="flex items-start justify-between gap-3">
            <div class="grid h-11 w-11 place-items-center rounded-[14px]" :class="role.name === 'Boshliq' ? 'bg-[#e8f3eb] text-leaf' : role.name === 'Buxgalter' ? 'bg-[#eaf2fa] text-[#4f7595]' : role.name.toLowerCase().includes('haydovchi') ? 'bg-[#eff2f7] text-[#56667e]' : 'bg-[#fff4e3] text-[#b77824]'"><ShieldCheck :size="20" /></div>
            <div class="flex items-center gap-1">
              <span v-if="role.isSystem" class="tag tag-blue">Tizim roli</span>
              <span v-if="role.fullAccess" class="tag" title="Bu lavozimdagi har bir xodim superadmin huquqiga ega bo‘ladi"><LockKeyhole :size="10" class="mr-1" />To‘liq dostup</span>
              <button class="btn-quiet !p-2" aria-label="Lavozimni tahrirlash" @click="openRole(role)"><Pencil :size="14" /></button>
              <button v-if="!role.isSystem" class="btn-quiet !p-2 !text-danger" aria-label="Lavozimni o‘chirish" @click="removeRole(role)"><Trash2 :size="14" /></button>
            </div>
          </div>
          <h2 class="mt-4 text-base font-bold text-ink">{{ role.name }}</h2>
          <p class="mt-1 min-h-[34px] text-xs leading-5 text-muted">{{ role.description || 'Lavozim tavsifi kiritilmagan.' }}</p>
          <div class="mt-4 flex items-center justify-between border-t border-line pt-3">
            <div class="flex items-center gap-1.5 text-[10px] text-muted"><UsersRound :size="13" />{{ role.people }} nafar xodim</div>
            <div class="flex items-center gap-1.5 rounded-lg bg-canvas px-2 py-1 text-[10px] font-bold text-ink"><LockKeyhole :size="12" class="text-leaf" />{{ role.permissions.length }} ruxsat</div>
          </div>
          <div class="mt-3 flex flex-wrap gap-1.5">
            <span v-for="permission in role.permissions.slice(0, 4)" :key="permission" class="rounded-md bg-[#f4f7f4] px-2 py-1 text-[9px] font-semibold text-[#607067]">{{ PERMISSION_CATALOG.find((item) => item.key === permission)?.label || permission }}</span>
            <span v-if="role.permissions.length > 4" class="rounded-md bg-[#f4f7f4] px-2 py-1 text-[9px] font-semibold text-muted">+{{ role.permissions.length - 4 }} ta</span>
          </div>
        </article>
      </div>
    </template>

    <MaterialsPanel v-else-if="activeTab === 'materials' && store.canCreateMaterial" />
    <FinanceCategoriesPanel v-else-if="activeTab === 'finance' && store.canCreateCategory" />

    <ModalDialog v-model="showEditor" :title="editingRole ? 'Lavozimni tahrirlash' : 'Yangi lavozim yaratish'" description="Kirish huquqlarini alohida bo‘lim va amallar bo‘yicha belgilang." width="max-w-2xl">
      <RoleEditor :key="editingRole?.id || 'new-role'" :role="editingRole" :catalog="PERMISSION_CATALOG" :loading="saving" @submit="saveRole" @cancel="showEditor = false" />
    </ModalDialog>
  </div>
</template>
