import { isSameMonth, isToday, localDayKey, weekdayShort } from '@/lib/format'
import { affectsFinance as isFinancial, isPendingMonitoring as isPending } from '@/lib/monitoring'
import { FULL_ACCESS_KEYS, hasFullAccess, roleGrantsAll } from '@/lib/permissions'
import type { QuarryState } from './quarry'
import type { Role, Trip, User } from './types'

const sum = <T,>(rows: T[], pick: (row: T) => number) => rows.reduce((total, row) => total + Number(pick(row) || 0), 0)
const byNewest = <T extends { createdAt: string }>(a: T, b: T) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()

// Web'dagi Pinia getter'lari va yordamchi action'lari — bitta joyda, holatdan hisoblanadi.
// `useApp()` va store action'lari shu funksiyadan foydalanadi.
export function deriveView(s: QuarryState) {
  const roleOf = (roleId?: string | null): Role | undefined => s.roles.find((role) => role.id === roleId)
  const currentUser: User | null = s.users.find((user) => user.id === s.session?.user?.id) ?? null
  const currentRole = currentUser ? roleOf(currentUser.roleId) ?? null : null
  const fullAccessKeys = s.permissionKeys.length ? s.permissionKeys : FULL_ACCESS_KEYS

  const can = (permission: string) => {
    if (!currentUser || !currentRole || !currentUser.isActive) return false
    return currentRole.permissions?.includes(permission) ?? false
  }
  const userCan = (user: User | null | undefined, permission: string) => {
    const role = roleOf(user?.roleId)
    if (roleGrantsAll(role)) return true
    return role?.permissions?.includes(permission) ?? false
  }
  const roleHasFullAccess = (roleId: string) => {
    const role = roleOf(roleId)
    if (!role) return false
    return roleGrantsAll(role) || hasFullAccess(role.permissions, fullAccessKeys)
  }
  const isSuperadmin = (user: User | null | undefined = currentUser) => {
    if (!user || user.isActive === false) return false
    if (user.isSuperadmin === true) return true
    return roleHasFullAccess(user.roleId)
  }

  const clientName = (id?: string | null) => (id ? s.clients.find((client) => client.id === id)?.name ?? 'Noma’lum mijoz' : '—')
  const tripClient = (trip: Trip) => {
    if (trip.clientId) return s.clients.find((client) => client.id === trip.clientId)?.name ?? 'Noma’lum mijoz'
    return trip.saleType === 'cash' ? 'Naqd savdo' : 'Mijozsiz'
  }
  const vehicleName = (id?: string | null) => {
    const vehicle = s.vehicles.find((item) => item.id === id)
    return vehicle ? `${vehicle.plate} · ${vehicle.model}` : '—'
  }
  const vehiclePlate = (id?: string | null) => s.vehicles.find((item) => item.id === id)?.plate ?? '—'
  const driverName = (id?: string | null) => s.users.find((user) => user.id === id)?.fullName ?? 'Biriktirilmagan'
  const materialName = (id?: string | null) => s.materials.find((material) => material.id === id)?.name ?? '—'
  const categoryLabel = (key: string) => s.categories.find((item) => item.key === key)?.label ?? key
  const roleName = (user?: User | null) => roleOf(user?.roleId)?.name ?? 'Lavozim belgilanmagan'

  const clientBalance = (clientId: string) => Number(s.remoteClientBalances[clientId] ?? 0)

  const balanceForDriver = (driverId: string) => {
    const user = s.users.find((item) => item.id === driverId)
    const trips = s.trips.filter((trip) => trip.driverId === driverId && isSameMonth(trip.createdAt))
    const approved = trips.filter(isFinancial)
    const earned = approved.length * Number(user?.driverRatePerTrip || 0)
    const paid = sum(s.transactions.filter((tx) => tx.driverId === driverId && tx.category === 'payroll' && isSameMonth(tx.createdAt) && isFinancial(tx)), (tx) => tx.amount)
    return { trips: approved.length, pending: trips.length - approved.length, earned, paid, remaining: earned - paid }
  }
  const vehicleStats = (vehicleId: string) => {
    const trips = s.trips.filter((trip) => trip.vehicleId === vehicleId && isSameMonth(trip.createdAt))
    const spent = sum(s.transactions.filter((tx) => tx.vehicleId === vehicleId && tx.direction === 'out' && isFinancial(tx)), (tx) => tx.amount)
    return { trips: trips.length, hours: sum(trips, (trip) => trip.hoursWorked), tons: sum(trips, (trip) => trip.weightTons), spent }
  }

  const todayTrips = s.trips.filter((trip) => isToday(trip.createdAt))
  const todaySales = sum(todayTrips.filter(isFinancial), (trip) => trip.totalAmount)
  const todayExpenses = sum(s.transactions.filter((tx) => tx.direction === 'out' && isToday(tx.createdAt) && isFinancial(tx)), (tx) => tx.amount)
  const pendingTrips = s.trips.filter(isPending).sort(byNewest)
  const pendingExpenses = s.transactions.filter((tx) => tx.direction === 'out' && isPending(tx)).sort(byNewest)

  const homeRoute = (): string => {
    if (can('dashboard.view')) return '/dashboard'
    if (can('driver.self')) return '/drivers'
    if (can('monitoring.view') || can('monitoring.approve')) return '/monitoring'
    if (can('trips.create')) return '/scale'
    if (can('trips.view')) return '/trips'
    return '/no-access'
  }

  return {
    ...s,
    currentUser,
    currentRole,
    fullAccessKeys,
    can,
    userCan,
    roleHasFullAccess,
    isSuperadmin,
    canManageStaff: isSuperadmin(currentUser),
    canCreateMaterial: can('materials.manage') || can('materials.create'),
    canCreateCategory: can('finance.manage') || can('finance.categories.create'),
    canAutoApproveTrips: can('trips.auto_approve'),
    canViewMonitoring: can('monitoring.view') || can('monitoring.approve'),
    canApproveMonitoring: can('monitoring.approve'),
    canEditTransactions: can('finance.transactions.edit'),
    canDeleteTransactions: can('finance.transactions.delete'),
    // Narx haydovchi va tarozi ustasiga ko'rinmaydi (materials.prices.view yoki finance.view kerak).
    canSeePrices: can('materials.prices.view') || can('finance.view'),
    // Ma'lumot kelguncha skeleton ko'rsatiladi (xato bo'lsa — yo'q).
    bootstrapping: Boolean(s.session?.user?.id) && !s.authError && !s.dataError && s.loadedUserId !== s.session?.user?.id,
    pendingTrips,
    pendingExpenses,
    pendingMonitoringCount: pendingTrips.length + pendingExpenses.length,
    homeRoute,
    todayTrips,
    todayTonnage: sum(todayTrips, (trip) => trip.weightTons),
    todaySales,
    todayCashIn: sum(s.transactions.filter((tx) => tx.direction === 'in' && isToday(tx.createdAt) && isFinancial(tx)), (tx) => tx.amount),
    todayExpenses,
    todayProfit: todaySales - todayExpenses,
    cashBalance: s.remoteFinancialBalances.cash,
    bankBalance: s.remoteFinancialBalances.bank,
    monthExpenses: sum(s.transactions.filter((tx) => tx.direction === 'out' && isSameMonth(tx.createdAt) && isFinancial(tx)), (tx) => tx.amount),
    openReports: s.maintenanceReports.filter((report) => report.status === 'open').sort(byNewest),
    weeklySummary: (() => {
      const days = []
      for (let offset = 6; offset >= 0; offset -= 1) {
        const day = new Date()
        day.setDate(day.getDate() - offset)
        const key = localDayKey(day)
        const trips = s.trips.filter((trip) => localDayKey(trip.createdAt) === key)
        const expenses = s.transactions.filter((tx) => tx.direction === 'out' && localDayKey(tx.createdAt) === key && isFinancial(tx))
        days.push({
          key, label: weekdayShort(day),
          sales: sum(trips.filter(isFinancial), (trip) => trip.totalAmount),
          expenses: sum(expenses, (tx) => tx.amount),
          tons: sum(trips, (trip) => trip.weightTons),
        })
      }
      return days
    })(),
    incomeCategories: s.categories.filter((item) => item.direction === 'in' && item.isActive !== false),
    expenseCategories: s.categories.filter((item) => item.direction === 'out' && item.isActive !== false),
    drivers: s.users.filter((user) => user.isActive !== false && userCan(user, 'driver.self')),
    transactionLocked: (tx: { tripId?: string | null; category?: string } | null | undefined) => Boolean(tx?.tripId) || tx?.category === 'cash_sale',
    clientName,
    tripClient,
    vehicleName,
    vehiclePlate,
    driverName,
    materialName,
    categoryLabel,
    roleName,
    clientBalance,
    balanceForDriver,
    vehicleStats,
  }
}

export type AppView = ReturnType<typeof deriveView>
