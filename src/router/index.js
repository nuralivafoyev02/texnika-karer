import { createRouter, createWebHistory } from 'vue-router'
import { useQuarryStore } from '../stores/quarry'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { permission: 'dashboard.view', title: 'Umumiy ko‘rinish' } },
    { path: '/trips', name: 'trips', component: () => import('../views/TripsView.vue'), meta: { permission: 'trips.view', title: 'Reyslar' } },
    { path: '/scale', name: 'scale', component: () => import('../views/ScaleView.vue'), meta: { permission: 'trips.create', title: 'Yangi reys' } },
    { path: '/clients', name: 'clients', component: () => import('../views/ClientsView.vue'), meta: { permission: 'clients.view', title: 'Mijozlar' } },
    { path: '/fleet', name: 'fleet', component: () => import('../views/FleetView.vue'), meta: { permission: 'fleet.view', title: 'Texnikalar' } },
    { path: '/finance', name: 'finance', component: () => import('../views/FinanceView.vue'), meta: { permission: 'finance.view', title: 'Moliya' } },
    { path: '/drivers', name: 'drivers', component: () => import('../views/DriversView.vue'), meta: { permissionAny: ['staff.view', 'driver.self'], title: 'Haydovchilar' } },
    { path: '/staff', name: 'staff', component: () => import('../views/StaffView.vue'), meta: { permission: 'staff.view', title: 'Xodimlar' } },
    { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue'), meta: { permissionAny: ['roles.manage', 'materials.manage', 'finance.manage'], title: 'Sozlamalar' } },
    { path: '/no-access', name: 'no-access', component: () => import('../views/NoAccessView.vue'), meta: { title: 'Ruxsat yo‘q' } },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
})

router.beforeEach((to) => {
  const store = useQuarryStore()
  const singlePermission = to.meta.permission
  const anyPermissions = to.meta.permissionAny
  if (singlePermission && !store.can(singlePermission)) return store.homeRoute.name === to.name ? true : store.homeRoute
  if (anyPermissions?.length && !anyPermissions.some((permission) => store.can(permission))) return store.homeRoute.name === to.name ? true : store.homeRoute
  return true
})
