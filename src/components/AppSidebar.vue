<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import {
  LayoutDashboard, ClipboardList, Scale, UsersRound, Truck, WalletCards,
  UserRoundCog, SlidersHorizontal, UserRound, Wrench,
} from 'lucide-vue-next'
import { useQuarryStore } from '../stores/quarry'

const store = useQuarryStore()
const groups = computed(() => {
  const operational = [
    { label: 'Umumiy ko‘rinish', to: '/dashboard', permission: 'dashboard.view', icon: LayoutDashboard },
    { label: 'Reyslar jurnali', to: '/trips', permission: 'trips.view', icon: ClipboardList },
    { label: 'Yangi reys', to: '/scale', permission: 'trips.create', icon: Scale, accent: true },
  ].filter((item) => store.can(item.permission))
  const resources = [
    { label: 'Mijozlar', to: '/clients', permission: 'clients.view', icon: UsersRound },
    { label: 'Texnikalar', to: '/fleet', permission: 'fleet.view', icon: Truck },
    { label: 'Moliya', to: '/finance', permission: 'finance.view', icon: WalletCards },
    { label: store.can('staff.view') ? 'Haydovchilar' : 'Mening hisobim', to: '/drivers', any: ['staff.view', 'driver.self'], icon: UserRound },
    { label: 'Xodimlar', to: '/staff', permission: 'staff.view', icon: UserRoundCog },
  ].filter((item) => item.permission ? store.can(item.permission) : item.any?.some((permission) => store.can(permission)))
  const settings = [
    { label: 'Sozlamalar', to: '/settings', any: ['roles.manage', 'materials.create', 'materials.manage', 'finance.categories.create', 'finance.manage'], icon: SlidersHorizontal },
  ].filter((item) => item.any.some((permission) => store.can(permission)))
  return [
    { title: 'ISH JARAYONI', items: operational },
    { title: 'RESURSLAR', items: resources },
    { title: 'TIZIM', items: settings },
  ].filter((group) => group.items.length)
})
</script>

<template>
  <aside class="sidebar">
    <div class="brand-lockup">
      <div class="brand-mark"><span></span><span></span><span></span></div>
      <div class="brand-copy"><strong>AliBuilding<span style="color:#7db3ff">.uz</span></strong><small>TEXNIKA BOSHQARUVI</small></div>
    </div>
    <nav class="sidebar-scroll" aria-label="Asosiy navigatsiya">
      <section v-for="group in groups" :key="group.title">
        <p class="nav-label">{{ group.title }}</p>
        <RouterLink v-for="item in group.items" :key="item.to" :to="item.to" class="nav-link">
          <component :is="item.icon" class="nav-icon" :size="17" :stroke-width="1.8" />
          <span>{{ item.label }}</span>
          <span v-if="item.accent" class="ml-auto h-1.5 w-1.5 rounded-full bg-[#7db3ff]"></span>
        </RouterLink>
      </section>
    </nav>
    <div class="sidebar-bottom">
      <!-- <div class="sidebar-status">
        <span class="status-dot"></span>
        <span>{{ store.remoteMode ? 'Supabase bilan ulangan' : 'Demo ma’lumotlar rejimi' }}</span>
      </div> -->
      <div class="mt-0 flex items-center justify-center px-0.5 text-[10px] text-[#7f9cc4]">
        <span class="text-center font-semibold">v1.6.5</span>
      </div>
    </div>
  </aside>
</template>
