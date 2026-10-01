import { create } from 'zustand'
import { AppState } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import type { RealtimeChannel, Session } from '@supabase/supabase-js'
import { monitoringStatus as monitoringStatusOf, isPendingMonitoring as isPending, affectsFinance as isFinancial } from '@/lib/monitoring'
import { formatPhone } from '@/lib/phone'
import { toAuthEmail, supabase, supabaseConfigured, db } from '@/lib/supabase'
import { disableBiometric, isBiometricEnabled, updateBiometricPassword } from '@/lib/security'
import { CACHE_FIELDS, clearCache, readCache, writeCache, type Snapshot } from './cache'
import { deriveView } from './derive'
import {
  readableDbError, readFunctionError, round2, safeFileName, slugify, isSchemaError, SCHEMA_HINT, TX_SCHEMA_HINT,
} from './errors'
import { mapCategory, mapClient, mapMaterial, mapReport, mapTransaction, mapTrip, mapUser, mapVehicle } from './mappers'
import type {
  Category, CategoryPayload, Client, ExpensePayload, MaintenanceReport, Material, PaymentPayload, PickedPhoto,
  Role, RolePayload, StaffPayload, StaffResult, Transaction, TransactionEdit, Trip, TripPayload, User, Vehicle,
  VehiclePayload, VehicleStatus,
} from './types'

type Balances = { cash: number | null; bank: number | null }

export type QuarryState = {
  ready: boolean
  loading: boolean
  refreshing: boolean
  session: Session | null
  authError: string
  dataError: string
  dataWarnings: string[]
  loadedUserId: string
  online: boolean
  users: User[]
  roles: Role[]
  permissionKeys: string[]
  clients: Client[]
  materials: Material[]
  vehicles: Vehicle[]
  trips: Trip[]
  transactions: Transaction[]
  categories: Category[]
  maintenanceReports: MaintenanceReport[]
  remoteClientBalances: Record<string, number>
  remoteFinancialBalances: Balances
  toast: { id: number; message: string; type: 'success' | 'error' } | null
  // null = tekshirilmagan, true = monitoring ustunlari/RPC'lar bor, false = eski sxema.
  monitoringSchema: boolean | null
  notify: (message: string, type?: 'success' | 'error') => void
  initialize: () => Promise<void>
  signIn: (login: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  loadRemoteData: (options?: { background?: boolean }) => Promise<void>
  refreshInBackground: () => void
  refresh: () => Promise<void>
  refreshLedgerBalances: () => Promise<void>
  checkMonitoringSchema: (force?: boolean) => Promise<boolean | null>
  ensurePhotoUrl: (trip: Trip) => Promise<string>
  ensureAvatarUrl: (user?: User | null) => Promise<string>
  updateMyProfile: (patch: { fullName?: string; phone?: string; avatarPath?: string }) => Promise<void>
  uploadAvatar: (photo: PickedPhoto) => Promise<void>
  removeAvatar: () => Promise<void>
  updateMyAccount: (input: { login?: string; currentPassword?: string; password?: string }) => Promise<void>
  createTrip: (payload: TripPayload) => Promise<Trip>
  createPayment: (payload: PaymentPayload) => Promise<void>
  createExpense: (payload: ExpensePayload) => Promise<void>
  setTripMonitoring: (tripId: string, approved: boolean, note?: string) => Promise<void>
  setExpenseMonitoring: (transactionId: string, approved: boolean, note?: string) => Promise<void>
  updateTransaction: (transactionId: string, payload: TransactionEdit) => Promise<void>
  deleteTransaction: (transactionId: string) => Promise<void>
  createClient: (payload: { name: string; phone?: string; contactName?: string; openingBalance?: number }) => Promise<void>
  createStaff: (payload: StaffPayload) => Promise<StaffResult>
  setStaffPassword: (userId: string, password: string) => Promise<void>
  updateStaffProfile: (userId: string, patch: { fullName?: string; phone?: string; title?: string; roleId?: string; isActive?: boolean }) => Promise<void>
  saveRole: (payload: RolePayload) => Promise<void>
  deleteRole: (roleId: string) => Promise<void>
  updateMaterial: (materialId: string, unitPrice: number) => Promise<void>
  createMaterial: (payload: { name: string; unitPrice: number }) => Promise<void>
  deleteMaterial: (materialId: string) => Promise<void>
  createCategory: (payload: CategoryPayload) => Promise<void>
  updateCategory: (categoryId: string, payload: { label?: string; hint?: string }) => Promise<void>
  deleteCategory: (categoryId: string) => Promise<void>
  createVehicle: (payload: VehiclePayload) => Promise<Vehicle>
  updateVehicle: (vehicleId: string, payload: VehiclePayload) => Promise<void>
  updateVehicleStatus: (vehicleId: string, status: VehicleStatus) => Promise<void>
  updateDriverRate: (userId: string, rate: number) => Promise<void>
  createMaintenanceReport: (payload: { vehicleId: string; description: string }) => Promise<void>
  resolveMaintenanceReport: (reportId: string) => Promise<void>
}

const EMPTY_BALANCES: Balances = { cash: null, bank: null }
const patchById = <T extends { id: string }>(list: T[], id: string, patch: Partial<T>) => list.map((item) => (item.id === id ? { ...item, ...patch } : item))
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)

let realtimeChannel: RealtimeChannel | null = null
let listenersReady = false
let lastVisibleRefreshAt = 0
let toastTimer: ReturnType<typeof setTimeout> | null = null
let cacheTimer: ReturnType<typeof setTimeout> | null = null

const invokeStaffFunction = async (name: string, body: Record<string, unknown>) => {
  const { data, error } = await db().functions.invoke(name, { body })
  if (error) throw new Error(await readFunctionError(name, error))
  if (data?.error) throw new Error(isSchemaError(String(data.error)) ? `${data.error}${SCHEMA_HINT}` : String(data.error))
  return data
}

// RN da fayl URI'sini ArrayBuffer'ga o'qish (Supabase Storage yuklash uchun).
const readFileBuffer = async (uri: string): Promise<ArrayBuffer> => {
  const response = await fetch(uri)
  return response.arrayBuffer()
}

export const useQuarryStore = create<QuarryState>((set, get) => {
  const view = () => deriveView(get())

  const emptyData = () => ({
    users: [] as User[], roles: [] as Role[], clients: [] as Client[], materials: [] as Material[], vehicles: [] as Vehicle[],
    trips: [] as Trip[], transactions: [] as Transaction[], maintenanceReports: [] as MaintenanceReport[], categories: [] as Category[],
    remoteClientBalances: {} as Record<string, number>, remoteFinancialBalances: EMPTY_BALANCES, permissionKeys: [] as string[],
    loadedUserId: '',
  })

  const saveCacheNow = () => {
    const s = get()
    const userId = s.session?.user?.id
    if (!userId || s.loadedUserId !== userId) return
    const snapshot: Snapshot = {
      version: 1, savedAt: Date.now(),
      remoteClientBalances: s.remoteClientBalances, remoteFinancialBalances: s.remoteFinancialBalances, permissionKeys: s.permissionKeys,
      // Profil rasmining signed URL'i eskirishi mumkin — keshga yozmaymiz.
      users: s.users.map((user) => ({ ...user, avatarUrl: '', avatarUrlAt: 0 })),
      roles: s.roles, clients: s.clients, materials: s.materials, vehicles: s.vehicles, trips: s.trips,
      transactions: s.transactions, maintenanceReports: s.maintenanceReports, categories: s.categories,
    }
    void writeCache(userId, snapshot)
  }
  // Har bir o'zgarishdan keyin (1,5 s kutib) kesh serverdagi holatga tenglanadi: aks holda
  // "reys saqlandi" xabari chiqib, keyingi ochilishda eski jurnal ko'rinib qolardi.
  const scheduleCacheSave = () => {
    if (cacheTimer) clearTimeout(cacheTimer)
    cacheTimer = setTimeout(saveCacheNow, 1500)
  }

  const ingestTrip = (trip: Trip): Trip => {
    const existing = get().trips.find((item) => item.id === trip.id)
    if (existing) {
      const merged = { ...existing, ...trip, photoUrl: trip.photoUrl || existing.photoUrl }
      set((s) => ({ trips: patchById(s.trips, trip.id, merged) }))
      return merged
    }
    set((s) => {
      const next: Partial<QuarryState> = { trips: [trip, ...s.trips] }
      if (trip.saleType === 'credit' && isFinancial(trip) && trip.clientId && Object.prototype.hasOwnProperty.call(s.remoteClientBalances, trip.clientId)) {
        next.remoteClientBalances = { ...s.remoteClientBalances, [trip.clientId]: s.remoteClientBalances[trip.clientId] + Number(trip.totalAmount || 0) }
      }
      return next
    })
    return trip
  }
  const ingestTransaction = (tx: Transaction): Transaction => {
    if (get().transactions.some((item) => item.id === tx.id)) return tx
    set((s) => {
      const next: Partial<QuarryState> = { transactions: [tx, ...s.transactions] }
      const method = tx.paymentMethod
      const balances = { ...s.remoteFinancialBalances }
      if (isFinancial(tx) && balances[method] !== null && balances[method] !== undefined) {
        balances[method] = (balances[method] as number) + (tx.direction === 'in' ? 1 : -1) * Number(tx.amount || 0)
        next.remoteFinancialBalances = balances
      }
      if (tx.category === 'customer_payment' && tx.clientId && Object.prototype.hasOwnProperty.call(s.remoteClientBalances, tx.clientId)) {
        next.remoteClientBalances = { ...s.remoteClientBalances, [tx.clientId]: s.remoteClientBalances[tx.clientId] - Number(tx.amount || 0) }
      }
      return next
    })
    return tx
  }

  const startListeners = () => {
    if (listenersReady) return
    listenersReady = true
    // Ilova fondan qaytganda (va internet tiklanganda) ma'lumot fonda yangilanadi.
    AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !get().session) return
      if (Date.now() - lastVisibleRefreshAt < 45_000) return
      lastVisibleRefreshAt = Date.now()
      get().refreshInBackground()
    })
    NetInfo.addEventListener((netState) => {
      const online = netState.isConnected !== false && netState.isInternetReachable !== false
      const wasOffline = !get().online
      set({ online })
      if (online && wasOffline && get().session) get().refreshInBackground()
    })
    useQuarryStore.subscribe(scheduleCacheSave)
  }

  return {
    ready: false,
    loading: false,
    refreshing: false,
    session: null,
    authError: '',
    dataError: '',
    dataWarnings: [],
    online: true,
    ...emptyData(),
    toast: null,
    monitoringSchema: null,

    notify(message, type = 'success') {
      if (type === 'error') console.error('[ERP]', message)
      set({ toast: { id: Date.now(), message, type } })
      if (toastTimer) clearTimeout(toastTimer)
      toastTimer = setTimeout(() => set({ toast: null }), 3800)
    },

    // ── Sessiya ───────────────────────────────────────────────────────────────
    async initialize() {
      if (!supabaseConfigured || !supabase) {
        set({ ready: true, authError: 'Supabase sozlanmagan.' })
        return
      }
      set({ loading: true })
      try {
        startListeners()
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        set({ session })
        if (session) {
          const snapshot = await readCache(session.user.id)
          if (snapshot) {
            const next: Partial<QuarryState> = {
              remoteClientBalances: snapshot.remoteClientBalances ?? {},
              remoteFinancialBalances: snapshot.remoteFinancialBalances ?? EMPTY_BALANCES,
              permissionKeys: snapshot.permissionKeys ?? [],
              loadedUserId: session.user.id,
            }
            for (const field of CACHE_FIELDS) (next as any)[field] = snapshot[field] ?? []
            set(next)
            get().refreshInBackground()
          } else {
            await get().loadRemoteData()
          }
        }
        supabase.auth.onAuthStateChange((_event, nextSession) => {
          set({ session: nextSession })
          if (!nextSession) {
            set(emptyData())
          } else if (!get().loading && !get().refreshing && nextSession.user.id !== get().loadedUserId) {
            setTimeout(() => { void get().loadRemoteData().catch(() => {}) }, 0)
          }
        })
      } catch (error: any) {
        set({ authError: error?.message || 'Supabase bilan ulanishda xatolik.' })
      } finally {
        set({ loading: false, ready: true })
      }
    },

    async signIn(login, password) {
      const email = toAuthEmail(login)
      if (!email) throw new Error('Login yoki email kiriting.')
      if (!password) throw new Error('Parolni kiriting.')
      const { data, error } = await db().auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Login yoki parol noto‘g‘ri.' : error.message)
      set({ session: data.session, authError: '', dataError: '' })
      const snapshot = await readCache(data.session.user.id)
      if (snapshot) {
        const next: Partial<QuarryState> = {
          remoteClientBalances: snapshot.remoteClientBalances ?? {},
          remoteFinancialBalances: snapshot.remoteFinancialBalances ?? EMPTY_BALANCES,
          permissionKeys: snapshot.permissionKeys ?? [],
          loadedUserId: data.session.user.id,
        }
        for (const field of CACHE_FIELDS) (next as any)[field] = snapshot[field] ?? []
        set(next)
        get().refreshInBackground()
        return
      }
      set({ loadedUserId: data.session.user.id })
      try { await get().loadRemoteData() } catch (loadError) {
        set({ loadedUserId: '' })
        throw loadError
      }
    },

    async signOut() {
      if (realtimeChannel && supabase) await supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
      const previousUserId = get().session?.user?.id
      await supabase?.auth.signOut()
      // Umumiy qurilmada boshqa odam kirsa, avvalgi hisob ma'lumoti qolmasin.
      await clearCache(previousUserId)
      set({ ...emptyData(), session: null, authError: '', dataError: '', dataWarnings: [] })
    },

    refreshInBackground() {
      if (get().refreshing || !get().session?.user?.id) return
      set({ refreshing: true })
      Promise.resolve(get().loadRemoteData({ background: true }))
        .catch((error) => console.warn('Fon yangilash amalga oshmadi:', error?.message))
        .finally(() => set({ refreshing: false }))
    },
    // Pull-to-refresh uchun: tugagunga qadar kutadi.
    async refresh() {
      if (!get().session?.user?.id) return
      try { await get().loadRemoteData({ background: true }) } catch { /* fon xatosi: keshdagi nusxa bilan ishlaymiz */ }
    },

    async checkMonitoringSchema(force = false) {
      if (get().monitoringSchema !== null && !force) return get().monitoringSchema
      const { error } = await db().from('trips').select('monitoring_status').limit(1)
      if (!error) { set({ monitoringSchema: true }); return true }
      if (isSchemaError(String(error.message ?? ''))) { set({ monitoringSchema: false }); return false }
      set({ monitoringSchema: null })
      return null
    },

    // ── Ma'lumotlarni yuklash ───────────────────────────────────────────────────
    async loadRemoteData(options = {}) {
      const background = options.background === true
      const sb = db()
      const session = get().session
      if (!session?.user?.id) return
      set({ loading: true, ...(background ? {} : { dataError: '', dataWarnings: [] }) })
      try {
        const [profileResult, rolesResult, permissionsResult, rolePermissionsResult] = await Promise.all([
          sb.from('users').select('*').eq('id', session.user.id).single(),
          sb.from('roles').select('id,name,description,is_system,grants_all'),
          sb.from('permissions').select('id,key,label,group_name,description'),
          sb.from('role_permissions').select('role_id,permission_id'),
        ])
        const profile = profileResult.data
        if (profileResult.error || !profile) throw new Error(`Xodim profili topilmadi. Admin Supabase'da profil/lavozim biriktirsin. ${profileResult.error?.message ?? ''}`)
        if (rolesResult.error) throw rolesResult.error
        if (permissionsResult.error) throw new Error(`Ruxsatlar ro‘yxatini o‘qib bo‘lmadi: ${permissionsResult.error.message}`)
        if (rolePermissionsResult.error) throw new Error(`Lavozim ruxsatlarini o‘qib bo‘lmadi: ${rolePermissionsResult.error.message}`)
        const permissionRows = permissionsResult.data ?? []
        const permissionKeys = permissionRows.map((permission: any) => permission.key as string)
        const keyById = new Map<string, string>(permissionRows.map((permission: any) => [permission.id, permission.key]))
        const assigned = new Map<string, string[]>()
        for (const row of rolePermissionsResult.data ?? []) {
          if (!assigned.has(row.role_id)) assigned.set(row.role_id, [])
          const key = keyById.get(row.permission_id)
          if (key) assigned.get(row.role_id)!.push(key)
        }
        const roles: Role[] = (rolesResult.data ?? []).map((role: any) => ({
          id: role.id, name: role.name, description: role.description ?? '', isSystem: role.is_system,
          grantsAll: role.grants_all === true, permissions: assigned.get(role.id) ?? [],
        }))
        const ownPermissions = roles.find((role) => role.id === profile.role_id)?.permissions ?? []
        const can = (key: string) => ownPermissions.includes(key)
        const failed: string[] = []
        const getRows = async (label: string, query: PromiseLike<{ data: any[] | null; error: any }>) => {
          const result = await query
          if (result.error) {
            console.warn(`Supabase data load (${label}):`, result.error.message)
            failed.push(label)
            return []
          }
          return result.data ?? []
        }

        const needsClients = can('clients.view') || can('clients.manage') || can('trips.create') || can('dashboard.view')
        const needsVehicles = can('fleet.view') || can('fleet.manage') || can('trips.create') || can('driver.self') || can('dashboard.view')
        const needsTrips = can('trips.view') || can('trips.create') || can('clients.view') || can('clients.manage') || can('driver.self') || can('dashboard.view') || can('monitoring.view') || can('monitoring.approve')
        const needsTransactions = can('finance.view') || can('clients.view') || can('clients.manage') || can('driver.self') || can('dashboard.view') || can('monitoring.view') || can('monitoring.approve')
        const needsReports = can('dashboard.view') || can('finance.view') || can('fleet.manage') || can('driver.self')
        const needsClientBalances = can('clients.view') || can('clients.manage') || can('dashboard.view')
        const needsFinancialTotals = can('finance.view') || can('dashboard.view')
        const needsCategories = can('finance.manage') || can('finance.categories.create') || can('finance.view') || can('finance.payments.create') || can('finance.expenses.create') || can('dashboard.view')
        const empty = Promise.resolve([] as any[])
        const [clients, vehicles, materials, trips, transactions, reports, users, clientBalances, financialTotals, categories] = await Promise.all([
          needsClients ? getRows('mijozlar', sb.from('clients').select('*').order('name')) : empty,
          needsVehicles ? getRows('texnikalar', sb.from('vehicles').select('*').order('plate')) : empty,
          getRows('mahsulotlar', sb.from('materials').select('*').order('name')),
          needsTrips ? (() => {
            let q = sb.from('trips').select('*').order('created_at', { ascending: false }).limit(500)
            // Haydovchi faqat o'z reyslarini ko'radi: o'z driver_id si yoki o'zi kiritgan reyslar.
            if (can('driver.self') && !can('trips.view')) q = q.or(`driver_id.eq.${profile.id},created_by.eq.${profile.id}`)
            return getRows('reyslar', q)
          })() : empty,
          needsTransactions ? (() => {
            let q = sb.from('transactions').select('*').order('created_at', { ascending: false }).limit(700)
            if (can('driver.self') && !can('finance.view')) q = q.or(`driver_id.eq.${profile.id},created_by.eq.${profile.id}`)
            return getRows('moliya', q)
          })() : empty,
          needsReports ? (() => {
            let q = sb.from('maintenance_reports').select('*').order('created_at', { ascending: false }).limit(100)
            if (can('driver.self') && !can('dashboard.view') && !can('finance.view') && !can('fleet.manage')) q = q.eq('driver_id', profile.id)
            return getRows('nosozliklar', q)
          })() : empty,
          can('staff.view') || can('payroll.manage')
            ? getRows('xodimlar', sb.from('users').select('*').order('full_name'))
            : getRows('xodimlar', sb.from('staff_directory').select('*').order('full_name')),
          needsClientBalances ? getRows('mijoz balanslari', sb.from('client_balances').select('client_id,current_balance')) : empty,
          needsFinancialTotals ? getRows('kassa qoldiqlari', sb.from('financial_balances').select('payment_method,current_balance')) : empty,
          needsCategories ? getRows('moliya turlari', sb.from('transaction_categories').select('*').order('direction').order('label')) : empty,
        ])

        const mappedUsers = users.map(mapUser)
        if (!mappedUsers.some((user) => user.id === profile.id)) mappedUsers.unshift(mapUser(profile))
        // Profil rasmining signed URL'ini saqlab qolamiz (har yangilashda qayta so'ramaylik).
        const previousUsers = get().users
        const usersWithAvatar = mappedUsers.map((user) => {
          const old = previousUsers.find((item) => item.id === user.id)
          return old && old.avatarPath === user.avatarPath ? { ...user, avatarUrl: old.avatarUrl, avatarUrlAt: old.avatarUrlAt } : user
        })
        const balances: Balances = { cash: null, bank: null }
        for (const row of financialTotals) {
          if (row.payment_method === 'cash' || row.payment_method === 'bank') balances[row.payment_method as 'cash' | 'bank'] = Number(row.current_balance || 0)
        }
        // Eski sxema holati: monitoring ustuni bo'lmasa keyinroq Monitoring ekrani ogohlantiradi.
        set({
          permissionKeys, roles, users: usersWithAvatar,
          clients: clients.map(mapClient), vehicles: vehicles.map(mapVehicle), materials: materials.map(mapMaterial),
          trips: trips.map(mapTrip).map((trip) => {
            const old = get().trips.find((item) => item.id === trip.id)
            return old?.photoPath === trip.photoPath && old.photoUrl ? { ...trip, photoUrl: old.photoUrl } : trip
          }),
          transactions: transactions.map(mapTransaction), maintenanceReports: reports.map(mapReport),
          categories: categories.map(mapCategory),
          remoteClientBalances: Object.fromEntries(clientBalances.map((row: any) => [row.client_id, Number(row.current_balance || 0)])),
          remoteFinancialBalances: balances, dataWarnings: failed, dataError: '', loadedUserId: session.user.id,
        })
        saveCacheNow()

        if (realtimeChannel) await sb.removeChannel(realtimeChannel)
        const channel = sb.channel('qazilma-operations-live')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'maintenance_reports' }, (payload) => {
            const report = mapReport(payload.new)
            if (!get().maintenanceReports.some((item) => item.id === report.id)) set((s) => ({ maintenanceReports: [report, ...s.maintenanceReports] }))
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'maintenance_reports' }, (payload) => {
            const report = mapReport(payload.new)
            set((s) => ({ maintenanceReports: patchById(s.maintenanceReports, report.id, report) }))
          })
        if (can('finance.view') || can('dashboard.view') || can('clients.view') || can('finance.payments.create') || can('finance.expenses.create') || can('monitoring.view') || can('monitoring.approve')) {
          channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, (payload) => { ingestTransaction(mapTransaction(payload.new)) })
          channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transactions' }, (payload) => {
            const existing = get().transactions.find((item) => item.id === payload.new.id)
            if (!existing) return
            const signature = (tx: Transaction) => [isPending(tx), tx.amount, tx.paymentMethod, tx.category, tx.clientId].join('|')
            const next = mapTransaction(payload.new)
            set((s) => ({ transactions: patchById(s.transactions, next.id, next) }))
            if (signature(existing) !== signature(next)) void get().refreshLedgerBalances()
          })
          channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'transactions' }, (payload) => {
            const id = (payload.old as any)?.id
            if (!get().transactions.some((item) => item.id === id)) return
            set((s) => ({ transactions: s.transactions.filter((item) => item.id !== id) }))
            void get().refreshLedgerBalances()
          })
        }
        if (can('trips.view') || can('trips.create') || can('clients.view') || can('dashboard.view') || can('driver.self') || can('monitoring.view') || can('monitoring.approve')) {
          channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trips' }, (payload) => { ingestTrip(mapTrip(payload.new)) })
          channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips' }, (payload) => {
            const existing = get().trips.find((item) => item.id === payload.new.id)
            if (!existing) return
            const wasPending = isPending(existing)
            const next = mapTrip(payload.new)
            set((s) => ({ trips: patchById(s.trips, next.id, { ...next, photoUrl: existing.photoPath === next.photoPath ? existing.photoUrl : '' }) }))
            if (wasPending !== isPending(next)) void get().refreshLedgerBalances()
          })
        }
        if (can('fleet.view') || can('fleet.manage') || can('dashboard.view') || can('driver.self')) {
          channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vehicles' }, (payload) => {
            const next = mapVehicle(payload.new)
            set((s) => ({ vehicles: patchById(s.vehicles, next.id, next) }))
          })
        }
        realtimeChannel = channel.subscribe()
      } catch (error: any) {
        if (background) {
          console.warn('Fon yangilash amalga oshmadi:', error?.message || error)
          return
        }
        set({ dataError: error?.message || 'Ma’lumotlarni yuklash imkoni bo‘lmadi.' })
        throw error
      } finally {
        set({ loading: false })
      }
    },

    // Monitoring holati o'zgarganda balanslar ham o'zgaradi: qo'lda +/- qilmasdan, serverdagi
    // ikki view'ni qayta o'qiymiz — hisob-kitob hech qachon jamoaviy summadan ajralib qolmaydi.
    async refreshLedgerBalances() {
      const permissions = view().currentRole?.permissions ?? []
      const wantsClients = permissions.includes('clients.view') || permissions.includes('clients.manage') || permissions.includes('dashboard.view')
      const wantsCash = permissions.includes('finance.view') || permissions.includes('dashboard.view')
      if (!wantsClients && !wantsCash) return
      const sb = db()
      const [balances, totals] = await Promise.all([
        wantsClients ? sb.from('client_balances').select('client_id,current_balance') : Promise.resolve({ data: null }),
        wantsCash ? sb.from('financial_balances').select('payment_method,current_balance') : Promise.resolve({ data: null }),
      ])
      if (balances.data) set({ remoteClientBalances: Object.fromEntries(balances.data.map((row: any) => [row.client_id, Number(row.current_balance || 0)])) })
      if (totals.data) {
        const next: Balances = { cash: null, bank: null }
        for (const row of totals.data as any[]) {
          if (row.payment_method === 'cash' || row.payment_method === 'bank') next[row.payment_method as 'cash' | 'bank'] = Number(row.current_balance || 0)
        }
        set({ remoteFinancialBalances: next })
      }
    },

    // ── Fotosuratlar ───────────────────────────────────────────────────────────────
    async ensurePhotoUrl(trip) {
      if (!trip?.photoPath) return ''
      if (trip.photoUrl) return trip.photoUrl
      const { data, error } = await db().storage.from('trip-photos').createSignedUrl(trip.photoPath, 3600)
      if (error) throw new Error(error.message)
      const url = data?.signedUrl ?? ''
      set((s) => ({ trips: patchById(s.trips, trip.id, { photoUrl: url }) }))
      return url
    },
    async ensureAvatarUrl(user = view().currentUser) {
      if (!user?.avatarPath) return ''
      if (user.avatarUrl && user.avatarUrlAt && Date.now() - user.avatarUrlAt < 50 * 60 * 1000) return user.avatarUrl
      const { data, error } = await db().storage.from('avatars').createSignedUrl(user.avatarPath, 3600)
      if (error) throw new Error(error.message)
      const url = data?.signedUrl ?? ''
      set((s) => ({ users: patchById(s.users, user.id, { avatarUrl: url, avatarUrlAt: Date.now() }) }))
      return url
    },

    // ── O'z profili ──────────────────────────────────────────────────────────────
    async updateMyProfile(patch) {
      const user = view().currentUser
      if (!user) throw new Error('Sessiya topilmadi.')
      const body: Record<string, unknown> = {}
      if (patch.fullName !== undefined) {
        const fullName = String(patch.fullName).trim()
        if (fullName.length < 2) throw new Error('Ism-familiya kamida 2 ta belgidan iborat bo‘lishi kerak.')
        body.full_name = fullName
      }
      if (patch.phone !== undefined) body.phone = formatPhone(patch.phone)
      if (patch.avatarPath !== undefined) body.avatar_path = patch.avatarPath
      if (!Object.keys(body).length) return
      const { error } = await db().rpc('update_my_profile', body)
      if (error) throw new Error(readableDbError(error, 'Profilni saqlab bo‘lmadi.'))
      await get().loadRemoteData({ background: true })
      get().notify('Profilingiz yangilandi.')
    },
    async uploadAvatar(photo) {
      const user = view().currentUser
      if (!user) throw new Error('Sessiya topilmadi.')
      const extension = (photo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) throw new Error('Faqat JPG, PNG yoki WebP formatida rasm yuklang.')
      const buffer = await readFileBuffer(photo.uri)
      if (buffer.byteLength > 2 * 1024 * 1024) throw new Error('Rasm 2 MB dan kichik bo‘lishi kerak.')
      const path = `avatars/${user.id}/avatar-${Date.now()}.${extension}`
      const { error } = await db().storage.from('avatars').upload(path, buffer, { contentType: photo.mimeType, upsert: true })
      if (error) throw new Error(`Rasmni yuklab bo‘lmadi: ${error.message}`)
      await get().updateMyProfile({ avatarPath: path })
      get().notify('Profil rasmi yangilandi.')
    },
    async removeAvatar() {
      const user = view().currentUser
      if (!user) throw new Error('Sessiya topilmadi.')
      if (user.avatarPath) {
        const { error } = await db().storage.from('avatars').remove([user.avatarPath])
        if (error) throw new Error(`Rasmni o‘chira olmadim: ${error.message}`)
      }
      await get().updateMyProfile({ avatarPath: '' })
    },
    // Login va parol — Edge Function orqali (Auth email/hash'ini faqat service_role o'zgartiradi).
    async updateMyAccount({ login, currentPassword, password }) {
      const user = view().currentUser
      if (!user) throw new Error('Sessiya topilmadi.')
      const body: Record<string, string> = {}
      const nextLogin = String(login ?? '').trim().toLowerCase()
      if (nextLogin && nextLogin !== user.login) body.login = nextLogin
      if (password) body.password = String(password).trim()
      if (body.password && !currentPassword) throw new Error('Parolni o‘zgartirish uchun joriy parolni kiriting.')
      if (!body.login && !body.password) throw new Error('Kamida bitta maydonni o‘zgartiring.')
      if (body.password) body.currentPassword = String(currentPassword).trim()
      const data = await invokeStaffFunction('update-my-account', body)
      if (data?.login) set((s) => ({ users: patchById(s.users, user.id, { login: data.login }) }))
      // Saqlangan biometrik kirish ma'lumoti eskirdi: yangi parol bilan yangilaymiz,
      // faqat login o'zgargan bo'lsa (parolsiz) — xavfsizlik uchun o'chiramiz.
      if (await isBiometricEnabled(user.id)) {
        if (body.password) await updateBiometricPassword(user.id, data?.login || user.login, body.password)
        else await disableBiometric(user.id)
      }
      get().notify(data?.passwordChanged && data?.login
        ? 'Login va parol yangilandi. Yangi login bilan kiring.'
        : data?.passwordChanged ? 'Parolingiz yangilandi.' : `Loginingiz “${data?.login}” ga o‘zgartirildi.`)
    },

    // ── Reys ───────────────────────────────────────────────────────────────────────
    async createTrip(payload) {
      const v = view()
      const vehicle = v.vehicles.find((item) => item.id === payload.vehicleId)
      const material = v.materials.find((item) => item.id === payload.materialId)
      if (!vehicle || !material) throw new Error('Samosval yoki tosh turini tanlang.')
      if (vehicle.status !== 'active') throw new Error('Servisdagi texnika uchun reys ochib bo‘lmaydi.')
      const weight = Number(String(payload.weightTons).replace(',', '.'))
      if (!(weight > 0)) throw new Error('Og‘irlik 0 dan katta bo‘lishi kerak.')
      if (payload.saleType !== 'cash' && !payload.clientId) throw new Error('Mijozni tanlang.')
      const note = payload.note?.trim() || ''
      // unit_price va total_amount serverda trigger hisoblaydi, monitoring_status esa
      // monitoringdan tasdiqlanadi — shuning uchun ularni yubormaymiz. `id` ni ham server beradi.
      const row = {
        vehicle_id: vehicle.id, driver_id: vehicle.driverId, client_id: payload.clientId || null,
        material_id: material.id, weight_tons: weight, sale_type: payload.saleType,
        hours_worked: Number(String(payload.hoursWorked || 0).replace(',', '.')) || 0, note: note || null,
        created_by: get().session!.user.id,
      }
      const sb = db()
      const { data, error } = await sb.from('trips').insert(row).select('*').single()
      if (error) {
        if (error.code === '23514' && /trip_sale_client_check/.test(String(error.message ?? ''))) {
          throw new Error('Naqd savdoda mijoz tanlash eski cheklovga to‘qnashmoqda — supabase migratsiyalarini qayta ishga tushiring.')
        }
        if (/column .* does not exist/.test(String(error.message ?? ''))) {
          throw new Error('Reys uchun izoh ustuni yo‘q — supabase migratsiyalarini qayta ishga tushiring.')
        }
        throw new Error(readableDbError(error, 'Reysni saqlab bo‘lmadi.'))
      }
      let trip = mapTrip(data)
      if (payload.photo) {
        const path = `${trip.id}/${Date.now()}-${safeFileName(payload.photo.name)}`
        const buffer = await readFileBuffer(payload.photo.uri)
        const { error: uploadError } = await sb.storage.from('trip-photos').upload(path, buffer, { contentType: payload.photo.mimeType, upsert: true })
        if (uploadError) {
          ingestTrip(trip)
          throw new Error(`Reys saqlandi, ammo rasm yuklanmadi: ${uploadError.message}`)
        }
        const { error: updateError } = await sb.from('trips').update({ photo_path: path }).eq('id', trip.id)
        if (updateError) {
          ingestTrip(trip)
          throw new Error(`Reys saqlandi, foto biriktirilmadi: ${updateError.message}`)
        }
        const { data: signed } = await sb.storage.from('trip-photos').createSignedUrl(path, 3600)
        trip = { ...trip, photoPath: path, photoUrl: signed?.signedUrl ?? '' }
      }
      const saved = ingestTrip(trip)
      get().notify(saved.monitoringStatus === 'approved'
        ? 'Reys saqlandi va darhol tasdiqlangan — balansga yozildi.'
        : 'Reys saqlandi va monitoringga yuborildi — tasdiqlashdan keyin balansga yoziladi.')
      return saved
    },

    // ── Moliya ─────────────────────────────────────────────────────────────────────
    async createPayment(payload) {
      const amount = Number(payload.amount)
      if (!(amount > 0)) throw new Error('Summa 0 dan katta bo‘lishi kerak.')
      const categoryKey = payload.category || 'customer_payment'
      const definition = get().categories.find((item) => item.key === categoryKey)
      if (definition && definition.direction !== 'in') throw new Error('Bu turi faqat kirim uchun ishlatiladi.')
      const needsClient = definition ? definition.needsClient : categoryKey === 'customer_payment'
      if (needsClient && !payload.clientId) throw new Error('Mijozni tanlang.')
      const { data, error } = await db().from('transactions').insert({
        direction: 'in', category: categoryKey, amount, payment_method: payload.paymentMethod,
        client_id: needsClient ? payload.clientId : null, note: payload.note?.trim() || null,
      }).select('*').single()
      if (error) throw new Error(readableDbError(error, 'To‘lovni saqlab bo‘lmadi.'))
      ingestTransaction(mapTransaction(data))
      get().notify('Mijoz to‘lovi hisobga olindi.')
    },
    // Chiqim monitoringga tushadi: kassa va oylikka faqat tasdiqlashdan keyin ta'sir qiladi.
    async createExpense(payload) {
      const amount = Number(payload.amount)
      if (!(amount > 0)) throw new Error('Summa 0 dan katta bo‘lishi kerak.')
      const { data, error } = await db().from('transactions').insert({
        direction: 'out', category: payload.category, amount, payment_method: payload.paymentMethod,
        vehicle_id: payload.vehicleId || null, driver_id: payload.driverId || null, note: payload.note?.trim() || null,
      }).select('*').single()
      if (error) throw new Error(readableDbError(error, 'Xarajatni saqlab bo‘lmadi.'))
      ingestTransaction(mapTransaction(data))
      get().notify('Xarajat saqlandi va monitoringga yuborildi — tasdiqlashdan keyin kassadan hisobga olinadi.')
    },
    async setTripMonitoring(tripId, approved, note = '') {
      const trip = get().trips.find((item) => item.id === tripId)
      if (!trip) throw new Error('Reys topilmadi.')
      if (monitoringStatusOf(trip) === (approved ? 'approved' : 'pending') && !note) {
        get().notify(approved ? 'Reys allaqachon tasdiqlangan.' : 'Reys allaqachon kutilmoqda.')
        return
      }
      const sb = db()
      const { error } = await sb.rpc('set_trip_monitoring', { p_trip_id: tripId, p_approved: approved, p_note: note || null })
      if (error) throw new Error(readableDbError(error, 'Reys holatini o‘zgartirib bo‘lmadi.'))
      const { data, error: readError } = await sb.from('trips').select('*').eq('id', tripId).single()
      if (readError) throw new Error(readableDbError(readError, 'Reys holatini yangilab bo‘lmadi.'))
      ingestTrip(mapTrip(data))
      await get().refreshLedgerBalances()
      get().notify(approved ? 'Reys tasdiqlandi — moliyaviy hisobga kiritildi.' : 'Tasdiqlash bekor qilindi — moliyaviy ta’sir qaytarildi.')
    },
    async setExpenseMonitoring(transactionId, approved, note = '') {
      if (!view().canApproveMonitoring) throw new Error('Tasdiqlash huquqi yo‘q.')
      if ((await get().checkMonitoringSchema()) === false) throw new Error(`Monitoring bazada yo‘q. ${SCHEMA_HINT}`)
      const transaction = get().transactions.find((item) => item.id === transactionId)
      if (!transaction) throw new Error('Xarajat topilmadi.')
      if (monitoringStatusOf(transaction) === (approved ? 'approved' : 'pending') && !note) {
        get().notify(approved ? 'Xarajat allaqachon tasdiqlangan.' : 'Xarajat allaqachon kutilmoqda.')
        return
      }
      const sb = db()
      const { error } = await sb.rpc('set_expense_monitoring', { p_transaction_id: transactionId, p_approved: approved, p_note: note || null })
      if (error) throw new Error(readableDbError(error, 'Xarajat holatini o‘zgartirib bo‘lmadi.'))
      const { data, error: readError } = await sb.from('transactions').select('*').eq('id', transactionId).single()
      if (readError) throw new Error(readableDbError(readError, 'Xarajat holatini yangilab bo‘lmadi.'))
      const next = mapTransaction(data)
      set((s) => ({ transactions: patchById(s.transactions, next.id, next) }))
      await get().refreshLedgerBalances()
      get().notify(approved ? 'Xarajat tasdiqlandi — kassadan hisobga olindi.' : 'Tasdiqlash bekor qilindi — xarajat yana kutilmoqda.')
    },
    async updateTransaction(transactionId, payload) {
      const v = view()
      if (!v.canEditTransactions) throw new Error('Kvitansiyani tahrirlash ruxsati yo‘q.')
      const transaction = get().transactions.find((item) => item.id === transactionId)
      if (!transaction) throw new Error('Kvitansiya topilmadi.')
      if (v.transactionLocked(transaction)) throw new Error('Reysga bog‘langan yozuv reys orqali boshqariladi.')
      const amount = Number(payload.amount)
      if (!(amount > 0)) throw new Error('Summa 0 dan katta bo‘lishi kerak.')
      const category = payload.category || transaction.category
      const definition = get().categories.find((item) => item.key === category)
      if (definition && definition.direction !== transaction.direction) throw new Error('Tanlangan tur bu yozuv yo‘nalishiga mos emas.')
      const wasPending = isPending(transaction)
      const isIn = transaction.direction === 'in'
      const needsClient = isIn && (definition ? definition.needsClient : category === 'customer_payment')
      if (needsClient && !payload.clientId) throw new Error('Mijozni tanlang.')
      if (!isIn && definition?.needsDriver && !payload.driverId) throw new Error('Haydovchini tanlang.')
      const next = {
        category, amount, paymentMethod: payload.paymentMethod === 'bank' ? 'bank' : 'cash',
        clientId: isIn ? (needsClient ? payload.clientId ?? null : null) : transaction.clientId,
        vehicleId: isIn ? transaction.vehicleId : (payload.vehicleId || null),
        driverId: isIn ? transaction.driverId : (payload.driverId || null),
        note: payload.note?.trim() || '',
      }
      const sb = db()
      const { error } = await sb.rpc('update_transaction', {
        p_transaction_id: transactionId, p_category: next.category, p_amount: next.amount,
        p_payment_method: next.paymentMethod, p_client_id: next.clientId, p_vehicle_id: next.vehicleId,
        p_driver_id: next.driverId, p_note: next.note || null,
      })
      if (error) throw new Error(error.code === 'PGRST202' ? TX_SCHEMA_HINT : readableDbError(error, 'Kvitansiyani saqlab bo‘lmadi.'))
      const { data, error: readError } = await sb.from('transactions').select('*').eq('id', transactionId).single()
      if (readError) throw new Error(readableDbError(readError, 'Kvitansiyani yangilab bo‘lmadi.'))
      const updated = mapTransaction(data)
      set((s) => ({ transactions: patchById(s.transactions, updated.id, updated) }))
      await get().refreshLedgerBalances()
      get().notify(!wasPending && isPending(updated) ? 'Kvitansiya yangilandi va qayta monitoringga yuborildi.' : 'Kvitansiya yangilandi.')
    },
    async deleteTransaction(transactionId) {
      const v = view()
      if (!v.canDeleteTransactions) throw new Error('Kvitansiyani o‘chirish ruxsati yo‘q.')
      const transaction = get().transactions.find((item) => item.id === transactionId)
      if (!transaction) throw new Error('Kvitansiya topilmadi.')
      if (v.transactionLocked(transaction)) throw new Error('Reysga bog‘langan yozuv reys orqali boshqariladi.')
      const { error } = await db().rpc('delete_transaction', { p_transaction_id: transactionId })
      if (error) throw new Error(error.code === 'PGRST202' ? TX_SCHEMA_HINT : readableDbError(error, 'Kvitansiyani o‘chirib bo‘lmadi.'))
      set((s) => ({ transactions: s.transactions.filter((item) => item.id !== transactionId) }))
      await get().refreshLedgerBalances()
      get().notify('Kvitansiya o‘chirildi.')
    },

    // ── Mijozlar ───────────────────────────────────────────────────────────────────
    async createClient(payload) {
      const row = {
        name: payload.name.trim(), phone: formatPhone(payload.phone) || null,
        contact_name: payload.contactName?.trim() || null, opening_balance: Number(payload.openingBalance || 0),
      }
      const { data, error } = await db().from('clients').insert(row).select('*').single()
      if (error) throw new Error(readableDbError(error, 'Mijozni saqlab bo‘lmadi.'))
      set((s) => ({ clients: [mapClient(data), ...s.clients] }))
      await get().refreshLedgerBalances()
      get().notify('Yangi mijoz qo‘shildi.')
    },

    // ── Xodimlar ───────────────────────────────────────────────────────────────────
    async createStaff(payload) {
      const v = view()
      if (!v.canManageStaff) throw new Error('Xodim qo‘shish huquqi faqat to‘liq huquqli (superadmin) xodimda bor.')
      if (!get().roles.some((item) => item.id === payload.roleId)) throw new Error('Lavozimni tanlang.')
      const request = {
        fullName: payload.fullName.trim(), login: String(payload.login || '').trim().toLowerCase(),
        password: payload.password || '', generatePassword: Boolean(payload.generatePassword),
        phone: formatPhone(payload.phone), title: payload.title?.trim() || '',
        roleId: payload.roleId, driverRatePerTrip: Number(payload.driverRatePerTrip || 0),
      }
      const data = await invokeStaffFunction('create-staff', request)
      await get().loadRemoteData({ background: true })
      get().notify(`${data?.fullName || request.fullName} uchun login va parol yaratildi.`)
      return data as StaffResult
    },
    async setStaffPassword(userId, password) {
      if (!view().canManageStaff) throw new Error('Parolni o‘zgartirish huquqi faqat to‘liq huquqli (superadmin) xodimda bor.')
      if (String(password || '').trim().length < 8) throw new Error('Parol kamida 8 ta belgidan iborat bo‘lishi kerak.')
      const { data, error } = await db().functions.invoke('set-staff-password', { body: { userId, password: String(password).trim() } })
      if (error) throw new Error(await readFunctionError('set-staff-password', error))
      if (data?.error) throw new Error(String(data.error))
      get().notify(`${data?.fullName || 'Xodim'} uchun yangi parol saqlandi.`)
    },
    async updateStaffProfile(userId, patch) {
      if (!view().canManageStaff) throw new Error('Xodimni tahrirlash huquqi faqat to‘liq huquqli (superadmin) xodimda bor.')
      const body: Record<string, unknown> = {
        full_name: patch.fullName?.trim() || undefined,
        phone: patch.phone === undefined ? undefined : (formatPhone(patch.phone) || null),
        title: patch.title?.trim() || null,
        role_id: patch.roleId || undefined,
        is_active: patch.isActive === undefined ? undefined : Boolean(patch.isActive),
      }
      Object.keys(body).forEach((key) => body[key] === undefined && delete body[key])
      if (!Object.keys(body).length) return
      if (userId === view().currentUser?.id && (body.role_id || body.is_active === false)) {
        throw new Error('O‘z lavozimingiz yoki holatingizni o‘zgartirib bo‘lmaydi.')
      }
      if (body.role_id && !get().roles.some((role) => role.id === body.role_id)) throw new Error('Lavozim topilmadi.')
      const { error } = await db().from('users').update(body).eq('id', userId)
      if (error) throw new Error(readableDbError(error, 'Xodimni saqlab bo‘lmadi.'))
      await get().loadRemoteData({ background: true })
      get().notify('Xodim ma’lumotlari yangilandi.')
    },
    async updateDriverRate(userId, rate) {
      const value = Number(rate)
      if (value < 0) throw new Error('Stavka manfiy bo‘lishi mumkin emas.')
      const { error } = await db().rpc('set_driver_rate', { p_user_id: userId, p_rate: value })
      if (error) throw new Error(readableDbError(error, 'Stavkani saqlab bo‘lmadi.'))
      set((s) => ({ users: patchById(s.users, userId, { driverRatePerTrip: value }) }))
      get().notify('Reys uchun stavka saqlandi.')
    },

    // ── Lavozimlar ─────────────────────────────────────────────────────────────────
    async saveRole(payload) {
      const grantsAll = payload.grantsAll === true
      const selected = grantsAll ? [] : [...new Set(payload.permissions || [])]
      if (!payload.name?.trim()) throw new Error('Lavozim nomini kiriting.')
      const own = view().currentRole?.permissions ?? []
      const elevated = selected.filter((key) => !own.includes(key))
      if (elevated.length && !view().isSuperadmin()) {
        throw new Error(`Sizda ushbu ruxsatlarni berish huquqi yo‘q: ${elevated.join(', ')}.`)
      }
      const sb = db()
      let roleId = payload.id
      const fields = { name: payload.name.trim(), description: payload.description?.trim() || '', grants_all: grantsAll }
      if (roleId) {
        const { error } = await sb.from('roles').update(fields).eq('id', roleId)
        if (error) throw new Error(readableDbError(error, 'Lavozimni saqlab bo‘lmadi.'))
      } else {
        const { data, error } = await sb.from('roles').insert(fields).select('id').single()
        if (error) throw new Error(readableDbError(error, 'Lavozimni saqlab bo‘lmadi.'))
        roleId = data.id
      }
      if (!grantsAll) {
        const { error } = await sb.rpc('save_role_permissions', { p_role_id: roleId, p_permission_keys: selected })
        if (error) throw new Error(readableDbError(error, 'Ruxsatlarni saqlab bo‘lmadi.'))
      }
      await get().loadRemoteData({ background: true })
      get().notify('Lavozim ruxsatlari saqlandi.')
    },
    async deleteRole(roleId) {
      const role = get().roles.find((item) => item.id === roleId)
      if (!role || role.isSystem) throw new Error('Tizim lavozimini o‘chirib bo‘lmaydi.')
      if (get().users.some((user) => user.roleId === roleId)) throw new Error('Bu lavozimda xodimlar bor. Avval ularni boshqa lavozimga o‘tkazing.')
      const { error } = await db().from('roles').delete().eq('id', roleId)
      if (error) throw new Error(readableDbError(error, 'Lavozimni o‘chirib bo‘lmadi.'))
      set((s) => ({ roles: s.roles.filter((item) => item.id !== roleId) }))
      get().notify('Lavozim o‘chirildi.')
    },

    // ── Mahsulotlar ────────────────────────────────────────────────────────────────
    async updateMaterial(materialId, unitPrice) {
      if (!view().can('materials.manage')) throw new Error('Mahsulot narxini o‘zgartirish ruxsati yo‘q.')
      const price = Number(unitPrice)
      if (!(price > 0)) throw new Error('Narx 0 dan katta bo‘lishi kerak.')
      const { error } = await db().from('materials').update({ unit_price: price }).eq('id', materialId)
      if (error) throw new Error(readableDbError(error, 'Mahsulot narxini saqlab bo‘lmadi.'))
      set((s) => ({ materials: patchById(s.materials, materialId, { unitPrice: price }) }))
      get().notify('Mahsulot narxi yangilandi.')
    },
    async createMaterial(payload) {
      if (!view().canCreateMaterial) throw new Error('Mahsulot qo‘shish ruxsati yo‘q.')
      const name = String(payload.name || '').trim()
      const unitPrice = Number(payload.unitPrice)
      if (name.length < 2) throw new Error('Mahsulot nomini kiriting.')
      if (name.length > 60) throw new Error('Mahsulot nomi 60 ta belgidan oshmasligi kerak.')
      if (!(unitPrice > 0)) throw new Error('Tonna narxi 0 dan katta bo‘lishi kerak.')
      if (get().materials.some((item) => item.name.toLowerCase() === name.toLowerCase())) throw new Error('Bu nomdagi mahsulot allaqachon mavjud.')
      const { data, error } = await db().from('materials').insert({ name, unit_price: unitPrice }).select('*').single()
      if (error) throw new Error(readableDbError(error, 'Mahsulotni qo‘shib bo‘lmadi.'))
      set((s) => ({ materials: [...s.materials, mapMaterial(data)].sort(byName) }))
      get().notify(`“${name}” mahsuloti qo‘shildi.`)
    },
    async deleteMaterial(materialId) {
      if (!view().can('materials.manage')) throw new Error('Mahsulot o‘chirish ruxsati yo‘q.')
      const material = get().materials.find((item) => item.id === materialId)
      if (!material) throw new Error('Mahsulot topilmadi.')
      const { error } = await db().from('materials').delete().eq('id', materialId)
      if (error) throw new Error(readableDbError(error, `“${material.name}” mahsulotini o‘chirib bo‘lmadi.`))
      set((s) => ({ materials: s.materials.filter((item) => item.id !== materialId) }))
      get().notify(`“${material.name}” mahsuloti o‘chirildi.`)
    },

    // ── Moliya turlari ─────────────────────────────────────────────────────────────
    async createCategory(payload) {
      if (!view().canCreateCategory) throw new Error('Moliya turi qo‘shish ruxsati yo‘q.')
      const label = String(payload.label || '').trim()
      const hint = String(payload.hint || '').trim()
      const direction = payload.direction === 'in' ? 'in' : 'out'
      if (label.length < 2) throw new Error('Tur nomini kiriting (kamida 2 ta belgi).')
      if (label.length > 60) throw new Error('Tur nomi 60 ta belgidan oshmasligi kerak.')
      if (hint.length > 140) throw new Error('Izoh 140 ta belgidan oshmasligi kerak.')
      const key = slugify(label)
      if (!key) throw new Error('Tur nomi lotin harflaridan iborat bo‘lishi kerak.')
      if (get().categories.some((item) => item.key === key)) throw new Error('Bu nomdagi tur allaqachon mavjud.')
      const { data, error } = await db().from('transaction_categories').insert({
        key, label, direction, hint,
        needs_client: direction === 'in' && payload.needsClient === true,
        needs_vehicle: direction === 'out' && payload.needsVehicle === true,
        needs_driver: direction === 'out' && payload.needsDriver === true,
      }).select('*').single()
      if (error) throw new Error(readableDbError(error, 'Moliya turini qo‘shib bo‘lmadi.'))
      set((s) => ({ categories: [...s.categories, mapCategory(data)].sort((a, b) => a.label.localeCompare(b.label)) }))
      get().notify(`“${label}” turi yaratildi.`)
    },
    async updateCategory(categoryId, payload) {
      if (!view().can('finance.manage')) throw new Error('Moliya turlarini boshqarish ruxsati yo‘q.')
      const category = get().categories.find((item) => item.id === categoryId)
      if (!category) throw new Error('Moliya turi topilmadi.')
      const label = String(payload.label ?? category.label).trim()
      const hint = String(payload.hint ?? category.hint).trim()
      if (label.length < 2) throw new Error('Tur nomini kiriting (kamida 2 ta belgi).')
      if (label.length > 60) throw new Error('Tur nomi 60 ta belgidan oshmasligi kerak.')
      if (hint.length > 140) throw new Error('Izoh 140 ta belgidan oshmasligi kerak.')
      const { error } = await db().from('transaction_categories').update({ label, hint }).eq('id', categoryId)
      if (error) throw new Error(readableDbError(error, 'Moliya turini yangilab bo‘lmadi.'))
      set((s) => ({ categories: patchById(s.categories, categoryId, { label, hint }) }))
      get().notify('Moliya turi yangilandi.')
    },
    async deleteCategory(categoryId) {
      if (!view().can('finance.manage')) throw new Error('Moliya turlarini boshqarish ruxsati yo‘q.')
      const category = get().categories.find((item) => item.id === categoryId)
      if (!category) throw new Error('Moliya turi topilmadi.')
      if (category.isSystem) throw new Error(`“${category.label}” — tizim turi, uni o‘chirib bo‘lmaydi.`)
      const { error } = await db().from('transaction_categories').delete().eq('id', categoryId)
      if (error) throw new Error(readableDbError(error, `“${category.label}” turini o‘chirib bo‘lmadi.`))
      set((s) => ({ categories: s.categories.filter((item) => item.id !== categoryId) }))
      get().notify(`“${category.label}” turi o‘chirildi.`)
    },

    // ── Texnika ────────────────────────────────────────────────────────────────────
    async createVehicle(payload) {
      if (!view().can('fleet.manage')) throw new Error('Texnika qo‘shish huquqi yo‘q.')
      const plate = String(payload.plate || '').trim().toUpperCase()
      const model = String(payload.model || '').trim()
      if (!plate) throw new Error('Texnika raqamini kiriting.')
      if (!model) throw new Error('Texnika markasini kiriting.')
      if (get().vehicles.some((vehicle) => vehicle.plate.toUpperCase() === plate)) throw new Error('Bu raqamdagi texnika allaqachon bor.')
      const { data, error } = await db().from('vehicles').insert({
        plate, model, year: payload.year ? Number(payload.year) : null, driver_id: payload.driverId || null, status: payload.status || 'active',
      }).select('*').single()
      if (error) throw new Error(readableDbError(error, 'Texnikani saqlab bo‘lmadi.'))
      const vehicle = mapVehicle(data)
      set((s) => ({ vehicles: [...s.vehicles, vehicle].sort((a, b) => a.plate.localeCompare(b.plate)) }))
      get().notify(`${plate} qo‘shildi.`)
      return vehicle
    },
    async updateVehicle(vehicleId, payload) {
      if (!view().can('fleet.manage')) throw new Error('Texnikani tahrirlash huquqi yo‘q.')
      const vehicle = get().vehicles.find((item) => item.id === vehicleId)
      if (!vehicle) throw new Error('Texnika topilmadi.')
      const plate = String(payload.plate || '').trim().toUpperCase()
      const model = String(payload.model || '').trim()
      if (!plate || !model) throw new Error('Raqam va marka to‘ldirilishi shart.')
      if (get().vehicles.some((item) => item.id !== vehicleId && item.plate.toUpperCase() === plate)) throw new Error('Bu raqamdagi texnika allaqachon bor.')
      const row = { plate, model, year: payload.year ? Number(payload.year) : null, driver_id: payload.driverId || null, status: payload.status || 'active' }
      const { error } = await db().from('vehicles').update(row).eq('id', vehicleId)
      if (error) throw new Error(readableDbError(error, 'Texnikani saqlab bo‘lmadi.'))
      set((s) => ({ vehicles: patchById(s.vehicles, vehicleId, mapVehicle({ ...row, id: vehicleId })) }))
      get().notify(`${plate} yangilandi.`)
    },
    async updateVehicleStatus(vehicleId, status) {
      if (!['active', 'service', 'repair'].includes(status)) throw new Error('Noma’lum texnika holati.')
      const { error } = await db().from('vehicles').update({ status }).eq('id', vehicleId)
      if (error) throw new Error(readableDbError(error, 'Texnika holatini yangilab bo‘lmadi.'))
      set((s) => ({ vehicles: patchById(s.vehicles, vehicleId, { status }) }))
      get().notify(status === 'active' ? 'Texnika ishga qaytarildi.' : 'Texnika servis holatiga o‘tkazildi.')
    },
    async createMaintenanceReport(payload) {
      const vehicle = get().vehicles.find((item) => item.id === payload.vehicleId)
      if (!vehicle) throw new Error('Texnikani tanlang.')
      if (!payload.description?.trim()) throw new Error('Nosozlik haqida qisqacha yozing.')
      const user = view().currentUser
      const { data, error } = await db().from('maintenance_reports').insert({
        vehicle_id: vehicle.id, driver_id: user!.id, description: payload.description.trim(), status: 'open',
      }).select('*').single()
      if (error) throw new Error(readableDbError(error, 'Xabarni yuborib bo‘lmadi.'))
      const report = mapReport(data)
      set((s) => ({
        maintenanceReports: s.maintenanceReports.some((item) => item.id === report.id) ? s.maintenanceReports : [report, ...s.maintenanceReports],
        vehicles: patchById(s.vehicles, vehicle.id, { status: 'repair' as VehicleStatus }),
      }))
      get().notify('Nosozlik xabari yuborildi, texnika remont holatiga o‘tkazildi.')
    },
    async resolveMaintenanceReport(reportId) {
      const { error } = await db().from('maintenance_reports').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', reportId)
      if (error) throw new Error(readableDbError(error, 'Xabarni yangilab bo‘lmadi.'))
      set((s) => ({ maintenanceReports: patchById(s.maintenanceReports, reportId, { status: 'resolved' as const }) }))
      get().notify('Nosozlik xabari yopildi.')
    },
  }
})
