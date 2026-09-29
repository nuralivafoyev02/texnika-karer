import { defineStore } from 'pinia'
import { createDemoData } from '../lib/demo-data'
import { isSameMonth, isToday, localDayKey } from '../lib/format'
import { formatPhone } from '../lib/phone'
import { FULL_ACCESS_KEYS, hasFullAccess } from '../lib/permissions'
import { supabase, supabaseConfigured, toAuthEmail } from '../lib/supabase'

const STORAGE_KEY = 'qazilma-erp-demo-v1'
// Remote ma'lumotlarning tezkor nusxasi: ilova birinchi ochilganda va bo'limga o'tganda
// to'liq yuklashni kutmasin — cache'dan darhol ko'rsatamiz, yangi ma'lumot fon'da keladi.
const REMOTE_CACHE_PREFIX = 'qazilma-erp-remote-v1:'
const REMOTE_CACHE_MAX_AGE = 14 * 24 * 60 * 60 * 1000 // 14 kundan eski nusxa ishlatilmaydi
const REMOTE_CACHE_FIELDS = ['users', 'roles', 'clients', 'materials', 'vehicles', 'trips', 'transactions', 'maintenanceReports', 'categories']
const remoteCacheKey = (userId) => `${REMOTE_CACHE_PREFIX}${userId}`
const readRemoteCache = (userId) => {
  if (!userId || typeof localStorage === 'undefined') return null
  try {
    const snapshot = JSON.parse(localStorage.getItem(remoteCacheKey(userId)) || 'null')
    if (snapshot?.version !== 1 || !Array.isArray(snapshot.users) || !Array.isArray(snapshot.roles)) return null
    if (Date.now() - Number(snapshot.savedAt || 0) > REMOTE_CACHE_MAX_AGE) return null
    return snapshot
  } catch { return null }
}
const writeRemoteCache = (userId, snapshot) => {
  if (!userId || typeof localStorage === 'undefined') return
  try { localStorage.setItem(remoteCacheKey(userId), JSON.stringify(snapshot)) } catch { /* kvota to'lgan bo'lsa — cachesiz ishlayveramiz */ }
}
const clearRemoteCache = (userId) => {
  if (!userId || typeof localStorage === 'undefined') return
  try { localStorage.removeItem(remoteCacheKey(userId)) } catch { /* o'chirib bo'lmasa ham asosiy oqim buzilmaydi */ }
}
const makeId = (prefix = 'ID') => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 11)}`
const roleMap = (roleId, roles) => roles.find((role) => role.id === roleId)
// The server rounds a trip total with numeric round(x, 2); mirror it so the preview matches.
const round2 = (value) => Math.round(Number(value) * 100) / 100
const readDataUrl = (file) => new Promise((resolve) => {
  if (!file || file.size > 1_500_000) return resolve('')
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => resolve('')
  reader.readAsDataURL(file)
})
const safeFileName = (name = 'yuk.jpg') => name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100)
// Edge Function xatolari tanasini o'zida saqlaydi; supabase-js faqat status kodini ko'rsatadi,
// shuning uchun javob tanasini o'qib, foydalanuvchiga haqiqiy sababni yetkazamiz.
const SCHEMA_HINT = ' Server sxemasi eskirgan: supabase/schema.sql faylini qayta ishga tushiring.'
const readFunctionError = async (name, error) => {
  if (error?.status === 404 || /not found/i.test(error?.message ?? '')) {
    return `${name} Edge Function deploy qilinmagan. Supabase CLI bilan: supabase functions deploy ${name}`
  }
  // Fetch/CORS xatosi: javob o'qilmaydi, brauzer faqat "preflight ... HTTP ok status" yozadi.
  // Asosiy sabab — funksiya deploy qilinmagan (shaffof 404) yoki tarmoq bloki.
  if (error?.name === 'FunctionsFetchError' || /failed to send a request/i.test(error?.message ?? '')) {
    return `${name} Edge Function javob bermadi (CORS yoki tarmoq xatosi). Supabase loyihasida deploy qilinganini tekshiring: supabase functions deploy ${name}`
  }
  let detail = ''
  try { detail = String((await error?.context?.json())?.error ?? '') } catch { detail = '' }
  const message = detail || error?.message || 'Serverga ulanishda xatolik.'
  return /column .* does not exist|schema cache|42703|PGRST204/i.test(message) ? `${message}${SCHEMA_HINT}` : message
}
// Postgres cheklov xatolarini foydalanuvchi tushunadigan xabarga aylantiramiz.
// Oddiy trigger xabolar (masalan, “o‘chirib bo‘lmaydi”) to‘g‘ridan-to‘g‘ri o‘tadi.
const readableDbError = (error, fallback) => {
  const message = String(error?.message ?? '').trim()
  if (!message) return fallback
  if (error?.code === '23503' || /violates foreign key constraint/i.test(message)) {
    return 'Ushbu yozuv boshqa ma’lumotlar bilan bog‘langan — avval bog‘lanishlarni tozalash kerak.'
  }
  if (error?.code === '23505' || /duplicate key value/i.test(message)) return 'Bu nom allaqachon mavjud.'
  if (error?.code === '42501' || /row-level security/i.test(message)) return 'Bu amalni bajarish ruxsati yo‘q.'
  return message
}
// “Yoqilg‘i xarajati” → “yoqilgi_xarajati”: DB key talabi ^[a-z][a-z0-9_]{1,39}$.
const slugify = (value) => {
  const slug = String(value).toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[‘’'`´ʼ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!slug) return ''
  return (/^[a-z]/.test(slug) ? slug : `t_${slug}`).slice(0, 40)
}
const invokeStaffFunction = async (name, body) => {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) throw new Error(await readFunctionError(name, error))
  if (data?.error) throw new Error(/column .* does not exist|schema cache|42703|PGRST204/i.test(String(data.error)) ? `${data.error}${SCHEMA_HINT}` : String(data.error))
  return data
}

const mapUser = (row) => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email ?? '',
  login: row.login ?? String(row.email ?? '').split('@')[0] ?? '',
  phone: row.phone ?? '',
  roleId: row.role_id,
  title: row.title ?? '',
  driverRatePerTrip: Number(row.driver_rate_per_trip ?? 0),
  isActive: row.is_active !== false,
  isSuperadmin: row.is_superadmin === true,
  avatarPath: row.avatar_path ?? '',
  avatarUrl: '',
})
const mapClient = (row) => ({
  id: row.id, name: row.name, phone: row.phone ?? '', contactName: row.contact_name ?? '',
  openingBalance: Number(row.opening_balance ?? 0), createdAt: row.created_at,
})
const mapMaterial = (row) => ({ id: row.id, name: row.name, unitPrice: Number(row.unit_price ?? 0), isActive: row.is_active !== false })
const mapVehicle = (row) => ({
  id: row.id, plate: row.plate, model: row.model ?? '', driverId: row.driver_id ?? null,
  status: row.status ?? 'active', year: row.year ?? null,
})
const mapTrip = (row) => ({
  id: row.id, vehicleId: row.vehicle_id, driverId: row.driver_id, clientId: row.client_id ?? null,
  materialId: row.material_id, weightTons: Number(row.weight_tons ?? 0), unitPrice: Number(row.unit_price ?? 0),
  totalAmount: Number(row.total_amount ?? 0), saleType: row.sale_type ?? 'credit',
  hoursWorked: Number(row.hours_worked ?? 0), photoPath: row.photo_path ?? '', photoUrl: '',
  photoName: '', note: row.note ?? '', createdAt: row.created_at, createdBy: row.created_by,
})
const mapTransaction = (row) => ({
  id: row.id, direction: row.direction, category: row.category, amount: Number(row.amount ?? 0),
  paymentMethod: row.payment_method ?? 'cash', clientId: row.client_id ?? null,
  driverId: row.driver_id ?? null, vehicleId: row.vehicle_id ?? null, tripId: row.trip_id ?? null,
  note: row.note ?? '', createdAt: row.created_at,
})
const mapReport = (row) => ({
  id: row.id, vehicleId: row.vehicle_id, driverId: row.driver_id, description: row.description,
  status: row.status ?? 'open', createdAt: row.created_at,
})
const mapCategory = (row) => ({
  id: row.id, key: row.key, label: row.label, direction: row.direction === 'in' ? 'in' : 'out',
  hint: row.hint ?? '', needsClient: row.needs_client === true, needsVehicle: row.needs_vehicle === true,
  needsDriver: row.needs_driver === true, isActive: row.is_active !== false, isSystem: row.is_system === true,
})

// Ilova mount qilingandan keyin `initialize()` fon ishlaydi. Router shu paytda
// ruxsatlarni hali bilmaydi (`can()` har doim false qaytaradi), shuning uchun
// birinchi navigatsiyani initialize tugaguncha ushlab turamiz — aks holda foydalanuvchi
// noto'g'ri sahifaga tashlanib qolardi. Promise reaktiv emas, shuning uchun modul
// darajasida saqlanadi (store'ga qo'yilsa, har o'zgarishda qayta seryalizatsiya bo'lardi).
// Eshik modul yuklanganda yaratiladi: `initialize()` `whenReady()` dan OLDIN ham
// chaqirilishi mumkin (demo rejimi), aks holda eshik hech qachon ochilmasdi.
let bootResolve = null
let bootSettled = false
const bootPromise = new Promise((resolve) => { bootResolve = resolve })
const openBootGate = () => {
  if (bootSettled) return
  bootSettled = true
  bootResolve?.()
}

export const useQuarryStore = defineStore('quarry', {
  state: () => {
    const blank = createDemoData()
    let saved = null
    if (!supabaseConfigured && typeof localStorage !== 'undefined') {
      try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { saved = null }
    }
    const seed = saved?.version === 1 ? saved : blank
    return {
      remoteMode: supabaseConfigured,
      ready: false,
      loading: false,
      refreshing: false,
      session: null,
      authError: '',
      dataError: '',
      dataWarnings: [],
      loadedUserId: '',
      activeUserId: seed.activeUserId ?? 'u-boss',
      users: seed.users ?? blank.users,
      roles: seed.roles ?? blank.roles,
      // Ruxsat kalitlari bazadan olinadi: "to'liq dostub" baholasi shu ro'yxatga qarab
      // qo'yiladi, shuning uchun serverga yangi kalit qo'shilsa UI ham to'g'ri qaror beradi.
      permissionKeys: [],
      clients: seed.clients ?? blank.clients,
      materials: seed.materials ?? blank.materials,
      vehicles: seed.vehicles ?? blank.vehicles,
      trips: seed.trips ?? blank.trips,
      transactions: seed.transactions ?? blank.transactions,
      categories: seed.categories ?? blank.categories,
      remoteClientBalances: {},
      remoteFinancialBalances: { cash: null, bank: null },
      maintenanceReports: seed.maintenanceReports ?? blank.maintenanceReports,
      toast: null,
      toastTimer: null,
      realtimeChannel: null,
    }
  },
  getters: {
    currentUser(state) {
      const id = state.remoteMode ? state.session?.user?.id : state.activeUserId
      return state.users.find((user) => user.id === id) ?? null
    },
    currentRole() {
      return this.currentUser ? roleMap(this.currentUser.roleId, this.roles) ?? null : null
    },
    // Xodim qo'shish, parol berish va profil tahrirlash — faqat to'liq huquqli (superadmin).
    // Getter bo'lishi muhim: action bo'lsa, `v-if="store.canManageStaff"` har doim rost bo'lib
    // qolardi va tugmalar ruxsatsiz xodimlarga ham ko'rinib turardi.
    canManageStaff() {
      return this.isSuperadmin(this.currentUser)
    },
    // "To'liq dostub" kalitlari: bazadan yuklangan katalog, yo'q bo'lsa lokal ko'rsatma.
    fullAccessKeys(state) {
      return state.permissionKeys.length ? state.permissionKeys : FULL_ACCESS_KEYS
    },
    // Ma'lumot kelguncha (cache ham bo'lmasa) o'rniga skeleton ko'rsatamiz.
    // Keshdan hydrate bo'lgan holatda `loadedUserId` darhol to'g'rlanadi, ya'ni real
    // ma'lumot ko'rinadi va fon yangilanishi skeletonni qaytarib keltirmaydi.
    // Xato holatida ham skeletonni ko'rsatmaymiz — aks holda xato matni ko'rinmay qolardi.
    bootstrapping(state) {
      if (!state.remoteMode) return false
      if (state.authError || state.dataError) return false
      const userId = state.session?.user?.id
      return Boolean(userId) && state.loadedUserId !== userId
    },
    // materials.create — faqat qo'shish; materials.manage — qo'shish, narx va o'chirish.
    canCreateMaterial() {
      return this.can('materials.manage') || this.can('materials.create')
    },
    // finance.categories.create — faqat yangi tur yaratish; finance.manage — to'liq boshqaruv.
    canCreateCategory() {
      return this.can('finance.manage') || this.can('finance.categories.create')
    },
    homeRoute() {
      if (this.can('dashboard.view')) return { name: 'dashboard' }
      if (this.can('driver.self')) return { name: 'drivers' }
      if (this.can('trips.create')) return { name: 'scale' }
      if (this.can('trips.view')) return { name: 'trips' }
      return { name: 'no-access' }
    },
    todayTrips(state) {
      return state.trips.filter((trip) => isToday(trip.createdAt))
    },
    todayTonnage() {
      return this.todayTrips.reduce((sum, trip) => sum + Number(trip.weightTons || 0), 0)
    },
    todaySales() {
      return this.todayTrips.reduce((sum, trip) => sum + Number(trip.totalAmount || 0), 0)
    },
    todayCashIn(state) {
      return state.transactions.filter((tx) => tx.direction === 'in' && isToday(tx.createdAt)).reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
    },
    todayExpenses(state) {
      return state.transactions.filter((tx) => tx.direction === 'out' && isToday(tx.createdAt)).reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
    },
    todayProfit() {
      return this.todaySales - this.todayExpenses
    },
    cashBalance(state) {
      if (!state.remoteMode) return state.transactions.filter((tx) => tx.paymentMethod === 'cash').reduce((sum, tx) => sum + (tx.direction === 'in' ? 1 : -1) * Number(tx.amount || 0), 0)
      return state.remoteFinancialBalances.cash
    },
    bankBalance(state) {
      if (!state.remoteMode) return state.transactions.filter((tx) => tx.paymentMethod === 'bank').reduce((sum, tx) => sum + (tx.direction === 'in' ? 1 : -1) * Number(tx.amount || 0), 0)
      return state.remoteFinancialBalances.bank
    },
    monthExpenses(state) {
      return state.transactions.filter((tx) => tx.direction === 'out' && isSameMonth(tx.createdAt)).reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
    },
    monthTrips(state) {
      return state.trips.filter((trip) => isSameMonth(trip.createdAt))
    },
    openReports(state) {
      return state.maintenanceReports.filter((report) => report.status === 'open').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    },
    weeklySummary(state) {
      const days = []
      for (let offset = 6; offset >= 0; offset -= 1) {
        const day = new Date()
        day.setDate(day.getDate() - offset)
        const key = localDayKey(day)
        const trips = state.trips.filter((trip) => localDayKey(trip.createdAt) === key)
        const expenses = state.transactions.filter((tx) => tx.direction === 'out' && localDayKey(tx.createdAt) === key)
        days.push({
          key,
          label: new Intl.DateTimeFormat('uz-UZ', { weekday: 'short' }).format(day).replace('.', ''),
          sales: trips.reduce((sum, trip) => sum + Number(trip.totalAmount || 0), 0),
          expenses: expenses.reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
          tons: trips.reduce((sum, trip) => sum + Number(trip.weightTons || 0), 0),
        })
      }
      return days
    },
    incomeCategories(state) {
      return state.categories.filter((item) => item.direction === 'in' && item.isActive !== false)
    },
    expenseCategories(state) {
      return state.categories.filter((item) => item.direction === 'out' && item.isActive !== false)
    },
  },
  actions: {
    // Router shu yerda kutadi: sessiya va birinchi ma'lumot hali kelmaganda
    // ruxsat tekshiruvi noto'g'ri qaror qabul qilishi mumkin.
    whenReady() {
      return bootSettled ? Promise.resolve() : bootPromise
    },
    can(permission) {
      if (!this.currentUser || !this.currentRole || !this.currentUser.isActive) return false
      return this.currentRole.permissions?.includes(permission) ?? false
    },
    // To'liq dostub — lavozim katalogdagi barcha ruxsatlarni qamrab olgan bo'lsa, xodim
    // superadmin deb hisoblanadi. DB (is_superadmin) ustuni ham shu qoidani trigger orqali
    // saqlaydi, lekin UI uchun role.permissions dan hisoblash tez va har doim dolzarb.
    roleHasFullAccess(roleId) {
      return hasFullAccess(roleMap(roleId, this.roles)?.permissions, this.fullAccessKeys)
    },
    isSuperadmin(user = this.currentUser) {
      if (!user || user.isActive === false) return false
      if (user.isSuperadmin === true) return true
      return this.roleHasFullAccess(user.roleId)
    },
    roleName(user) {
      return roleMap(user?.roleId, this.roles)?.name ?? 'Lavozim belgilanmagan'
    },
    userCan(user, permission) {
      return roleMap(user?.roleId, this.roles)?.permissions?.includes(permission) ?? false
    },
    clientName(id) {
      if (!id) return '—'
      return this.clients.find((client) => client.id === id)?.name ?? 'Noma’lum mijoz'
    },
    tripClient(trip) {
      // Mijoz har qanday savdo turida ham ko'rsatiladi: naqd reysda ham tanlangan
      // mijoz jurnalda qoladi (balansga esa faqat credit reyslar ta'sir qiladi).
      if (trip.clientId) return this.clients.find((client) => client.id === trip.clientId)?.name ?? 'Noma’lum mijoz'
      return trip.saleType === 'cash' ? 'Naqd savdo' : 'Mijozsiz'
    },
    hasPhoto(trip) {
      return this.remoteMode ? Boolean(trip.photoPath) : Boolean(trip.photoUrl)
    },
    vehicleName(id) {
      const vehicle = this.vehicles.find((item) => item.id === id)
      return vehicle ? `${vehicle.plate} · ${vehicle.model}` : '—'
    },
    driverName(id) {
      return this.users.find((user) => user.id === id)?.fullName ?? 'Biriktirilmagan'
    },
    materialName(id) {
      return this.materials.find((material) => material.id === id)?.name ?? '—'
    },
    // Parametr oladigan yordamchi — Pinia getter'lari argument qabul qilmaydi,
    // shuning uchun kategoriya nomini shu yerda ko'ramiz.
    categoryLabel(key) {
      return this.categories.find((item) => item.key === key)?.label ?? key
    },
    clientBalance(clientId) {
      if (this.remoteMode && Object.prototype.hasOwnProperty.call(this.remoteClientBalances, clientId)) return Number(this.remoteClientBalances[clientId])
      const client = this.clients.find((item) => item.id === clientId)
      if (!client) return 0
      const billed = this.trips.filter((trip) => trip.clientId === clientId && trip.saleType === 'credit').reduce((sum, trip) => sum + Number(trip.totalAmount || 0), 0)
      const paid = this.transactions.filter((tx) => tx.clientId === clientId && tx.direction === 'in' && tx.category === 'customer_payment').reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
      return Number(client.openingBalance || 0) + billed - paid
    },
    balanceForDriver(driverId) {
      const user = this.users.find((item) => item.id === driverId)
      const trips = this.trips.filter((trip) => trip.driverId === driverId && isSameMonth(trip.createdAt))
      const earned = trips.length * Number(user?.driverRatePerTrip || 0)
      const paid = this.transactions.filter((tx) => tx.driverId === driverId && tx.category === 'payroll' && isSameMonth(tx.createdAt)).reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
      return { trips: trips.length, earned, paid, remaining: earned - paid }
    },
    vehicleStats(vehicleId) {
      const trips = this.trips.filter((trip) => trip.vehicleId === vehicleId && isSameMonth(trip.createdAt))
      const spent = this.transactions.filter((tx) => tx.vehicleId === vehicleId && tx.direction === 'out').reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
      return {
        trips: trips.length,
        hours: trips.reduce((sum, trip) => sum + Number(trip.hoursWorked || 0), 0),
        tons: trips.reduce((sum, trip) => sum + Number(trip.weightTons || 0), 0),
        spent,
      }
    },
    ingestRemoteTrip(trip) {
      const existing = this.trips.find((item) => item.id === trip.id)
      if (existing) {
        Object.assign(existing, trip)
        return existing
      }
      this.trips.unshift(trip)
      if (trip.saleType === 'credit' && trip.clientId && Object.prototype.hasOwnProperty.call(this.remoteClientBalances, trip.clientId)) {
        this.remoteClientBalances[trip.clientId] += Number(trip.totalAmount || 0)
      }
      return trip
    },
    ingestRemoteTransaction(transaction) {
      const existing = this.transactions.find((item) => item.id === transaction.id)
      if (existing) return existing
      this.transactions.unshift(transaction)
      const method = transaction.paymentMethod
      if (this.remoteFinancialBalances[method] !== null && this.remoteFinancialBalances[method] !== undefined) {
        this.remoteFinancialBalances[method] += (transaction.direction === 'in' ? 1 : -1) * Number(transaction.amount || 0)
      }
      if (transaction.category === 'customer_payment' && transaction.clientId && Object.prototype.hasOwnProperty.call(this.remoteClientBalances, transaction.clientId)) {
        this.remoteClientBalances[transaction.clientId] -= Number(transaction.amount || 0)
      }
      return transaction
    },
    persistDemo() {
      if (this.remoteMode || typeof localStorage === 'undefined') return
      const data = {
        version: 1, activeUserId: this.activeUserId, users: this.users, roles: this.roles,        clients: this.clients, materials: this.materials, vehicles: this.vehicles, trips: this.trips, transactions: this.transactions,
        maintenanceReports: this.maintenanceReports, categories: this.categories,
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* demo keeps running if browser storage is full */ }
    },
    notify(message, type = 'success') {
      this.toast = { id: Date.now(), message, type }
      if (this.toastTimer) clearTimeout(this.toastTimer)
      this.toastTimer = setTimeout(() => { this.toast = null }, 3600)
    },
    resetRemoteState() {
      this.users = []
      this.roles = []
      this.clients = []
      this.materials = []
      this.vehicles = []
      this.trips = []
      this.transactions = []
      this.maintenanceReports = []
      this.categories = []
      this.remoteClientBalances = {}
      this.remoteFinancialBalances = { cash: null, bank: null }
      this.loadedUserId = ''
    },
    // Boshqa hisobga o'tganda eski profil rasmining signed URL'i ishlatilmasin —
    // aks holda header'da birinchi xodimning rasmi ko'rinib turadi.
    clearAvatarCache() {
      for (const user of this.users) {
        user.avatarUrl = ''
        user.avatarUrlAt = 0
      }
    },
    // Cache'dan darhol ko'rsatish: to'liq yuklash kutinmaydi, interfeys zudlikda ochiladi.
    hydrateRemoteCache(userId) {
      const snapshot = readRemoteCache(userId)
      if (!snapshot) return false
      for (const field of REMOTE_CACHE_FIELDS) this[field] = snapshot[field] ?? []
      this.remoteClientBalances = snapshot.remoteClientBalances ?? {}
      this.remoteFinancialBalances = snapshot.remoteFinancialBalances ?? { cash: null, bank: null }
      this.loadedUserId = userId
      return true
    },
    saveRemoteCache() {
      if (!this.remoteMode) return
      const userId = this.session?.user?.id
      if (!userId || this.loadedUserId !== userId) return
      // Profil rasmining signed URL'i vaqt bilan eskiradi; keshga saqlashdan oldin
      // vaqtini tekshiramiz, aks holda eskirgan URL saqlanib qolardi.
      this.clearAvatarCache()
      const snapshot = {
        version: 1,
        savedAt: Date.now(),
        remoteClientBalances: this.remoteClientBalances,
        remoteFinancialBalances: this.remoteFinancialBalances,
      }
      for (const field of REMOTE_CACHE_FIELDS) snapshot[field] = this[field]
      writeRemoteCache(userId, snapshot)
    },
    // Ekrani bloklamaydigan yangilash: cache'dagi ma'lumot ishlab turadi,
    // serverdagi yangi nusxa fonda yuklanib, tayyor bo'lganda almashadi.
    refreshInBackground() {
      if (this.refreshing || !this.session?.user?.id) return
      this.refreshing = true
      Promise.resolve(this.loadRemoteData({ background: true }))
        .catch((error) => console.warn('Fon yangilash amalga oshmadi:', error?.message))
        .finally(() => { this.refreshing = false })
    },
    async initialize() {
      if (!this.remoteMode) {
        this.ready = true
        this.persistDemo()
        // Demo rejimida `try/finally` ga umuman kirilmaydi, shuning uchun eshikni
        // shu yerda ochamiz — aks holda router birinchi navigatsiyani kutishda
        // qolib ketar edi.
        openBootGate()
        return
      }
      this.loading = true
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        this.session = session
        if (session) {
          const hydrated = this.hydrateRemoteCache(session.user.id)
          if (hydrated) this.refreshInBackground()
          else await this.loadRemoteData()
        }
        supabase.auth.onAuthStateChange((_event, nextSession) => {
          this.session = nextSession
          if (!nextSession) {
            this.resetRemoteState()
          } else if (!this.loading && !this.refreshing && nextSession.user.id !== this.loadedUserId) {
            this.clearAvatarCache()
            setTimeout(() => this.loadRemoteData(), 0)
          }
        })
      } catch (error) {
        this.authError = error.message || 'Supabase bilan ulanishda xatolik.'
      } finally {
        this.loading = false
        this.ready = true
        // Navigatsiyani ushlab turgan eshikni ochamiz — endi ruxsatlar ma'lum.
        openBootGate()
      }
    },
    async signIn(login, password) {
      const email = toAuthEmail(login)
      if (!email) throw new Error('Login yoki email kiriting.')
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Login yoki parol noto‘g‘ri.' : error.message)
      this.session = data.session
      this.authError = ''
      // Oldin kirilgan hisob uchun cache bo'lsa — kirish ham darhol yakunlanadi.
      if (this.hydrateRemoteCache(data.session.user.id)) {
        this.refreshInBackground()
        return
      }
      this.loadedUserId = data.session.user.id
      try { await this.loadRemoteData() } catch (loadError) {
        this.loadedUserId = ''
        throw loadError
      }
    },
    // ── O'z profili ─────────────────────────────────────────────────────────
    // Profil rasmi: signed URL har 1 soat yangilanadi, shuning uchun `avatarUrl` ni
    // keshga solamiz va faqat o'zi yo'q bo'lganda so'raymiz.
    async ensureAvatarUrl(user = this.currentUser) {
      if (!user) return ''
      if (!this.remoteMode) return user.avatarUrl ?? ''
      if (!user.avatarPath) return ''
      if (user.avatarUrl && user.avatarUrlAt && Date.now() - user.avatarUrlAt < 50 * 60 * 1000) return user.avatarUrl
      const { data, error } = await supabase.storage.from('avatars').createSignedUrl(user.avatarPath, 3600)
      if (error) throw new Error(error.message)
      user.avatarUrl = data?.signedUrl ?? ''
      user.avatarUrlAt = Date.now()
      return user.avatarUrl
    },
    // Ism-familiya / telefon / rasm. role_id va is_active bu yo'l bilan umuman
    // o'zgartirilmaydi — shuning uchun xodim o'zini bloklamaydi.
    async updateMyProfile(patch) {
      const user = this.currentUser
      if (!user) throw new Error('Sessiya topilmadi.')
      const body = {}
      if (patch.fullName !== undefined) {
        const fullName = String(patch.fullName).trim()
        if (fullName.length < 2) throw new Error('Ism-familiya kamida 2 ta belgidan iborat bo‘lishi kerak.')
        body.full_name = fullName
      }
      // Bo'sh qiymat telefon raqamini o'chirishni bildiradi. RPC bo'yicha `null`
      // "o'zgartirma" degan ma'noda, shuning uchun tozalash uchun bo'sh satn
      // yuboriladi (server uni NULL ga aylantiradi). To'liq qiymat har doim
      // "+998 90 123 45 67" shaklida saqlanadi.
      if (patch.phone !== undefined) body.phone = formatPhone(patch.phone)
      if (patch.avatarPath !== undefined) body.avatar_path = patch.avatarPath
      if (!Object.keys(body).length) return
      if (this.remoteMode) {
        const { error } = await supabase.rpc('update_my_profile', body)
        if (error) throw new Error(readableDbError(error, 'Profilni saqlab bo‘lmadi.'))
        await this.loadRemoteData()
        this.notify('Profilingiz yangilandi.')
        return
      }
      if (body.full_name) user.fullName = body.full_name
      if ('phone' in body) user.phone = body.phone
      if ('avatar_path' in body) { user.avatarPath = body.avatar_path; user.avatarUrl = ''; user.avatarUrlAt = 0 }
      this.persistDemo()
      this.notify('Profilingiz yangilandi.')
    },
    // Profil rasmini yuklash. storage RLS faqat `avatars/<o'z user_id>/` papkasini ruxsat beradi.
    async uploadAvatar(file) {
      const user = this.currentUser
      if (!user) throw new Error('Sessiya topilmadi.')
      if (!file?.type?.startsWith('image/')) throw new Error('Faqat rasm fayli tanlang (JPG, PNG, WebP).')
      if (file.size > 2 * 1024 * 1024) throw new Error('Rasm 2 MB dan kichik bo‘lishi kerak.')
      // Fayl nomi va kengaytmasini tekshiramiz — yo'l storage'ga to'g'ri ketishi uchun
      // o'zgartirilmaydi, yangi fayl esa eskisini almashtiradi (upsert).
      const extension = String(file.name).split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
        throw new Error('Faqat JPG, PNG yoki WebP formatida rasm yuklang.')
      }
      const path = `avatars/${user.id}/avatar-${Date.now()}.${extension}`
      if (!this.remoteMode) {
        user.avatarPath = path
        user.avatarUrl = URL.createObjectURL(file)
        user.avatarUrlAt = Date.now()
        this.persistDemo()
        this.notify('Profil rasmi yangilandi (demo rejimida fayl saqlanmaydi).')
        return
      }
      const { error: uploadError } = await supabase.storage.from('avatars')
        .upload(path, file, { contentType: file.type, upsert: true })
      if (uploadError) throw new Error(`Rasmni yuklab bo‘lmadi: ${uploadError.message}`)
      await this.updateMyProfile({ avatarPath: path })
      this.notify('Profil rasmi yangilandi.')
    },
    async removeAvatar() {
      const user = this.currentUser
      if (!user) throw new Error('Sessiya topilmadi.')
      if (this.remoteMode && user.avatarPath) {
        const { error } = await supabase.storage.from('avatars').remove([user.avatarPath])
        if (error) throw new Error(`Rasmni o‘chira olmadim: ${error.message}`)
      }
      if (user.avatarUrl?.startsWith('blob:')) URL.revokeObjectURL(user.avatarUrl)
      await this.updateMyProfile({ avatarPath: '' })
    },
    // Login va parol — Edge Function orqali (Auth email/hash'ini faqat service_role o'zgartiradi).
    async updateMyAccount({ login, currentPassword, password }) {
      const user = this.currentUser
      if (!user) throw new Error('Sessiya topilmadi.')
      const body = {}
      const nextLogin = String(login ?? '').trim().toLowerCase()
      if (nextLogin && nextLogin !== user.login) body.login = nextLogin
      if (password) body.password = String(password).trim()
      if (body.password && !currentPassword) throw new Error('Parolni o‘zgartirish uchun joriy parolni kiriting.')
      if (!body.login && !body.password) throw new Error('Kamida bitta maydonni o‘zgartiring.')
      if (!this.remoteMode) {
        if (body.login) user.login = body.login
        this.persistDemo()
        this.notify(body.login
          ? `Login “${body.login}” ga o‘zgartirildi (demo rejimida Auth ga ta’sir qilinmaydi).`
          : 'Parol o‘zgartirildi (demo rejimida saqlanmaydi).')
        return
      }
      if (body.password) body.currentPassword = String(currentPassword).trim()
      const data = await invokeStaffFunction('update-my-account', body)
      if (data?.login) user.login = data.login
      this.notify(data?.passwordChanged && data?.login
        ? 'Login va parol yangilandi. Yangi login bilan kiring.'
        : data?.passwordChanged
          ? 'Parolingiz yangilandi.'
          : `Loginingiz “${data?.login}” ga o‘zgartirildi.`)
    },
    async signOut() {
      if (this.realtimeChannel) await supabase.removeChannel(this.realtimeChannel)
      this.realtimeChannel = null
      const previousUserId = this.session?.user?.id
      await supabase.auth.signOut()
      // Umumiy qurilmada boshqa odam kirsa, avvalgi hisob ma'lumoti qolmasin.
      clearRemoteCache(previousUserId)
      this.resetRemoteState()
      this.session = null
      this.authError = ''
      this.dataError = ''
      this.dataWarnings = []
    },
    switchDemoUser(userId) {
      if (this.remoteMode || !this.users.some((user) => user.id === userId)) return
      this.activeUserId = userId
      this.persistDemo()
    },
    async loadRemoteData(options = {}) {
      // background: ekrani bloklamaydigan yangilash — xato bo'lsa cache'dagi nusxa bilan ishlayveramiz.
      const background = options.background === true
      if (!this.session?.user?.id) return
      this.loading = true
      if (!background) {
        this.dataError = ''
        this.dataWarnings = []
      }
      try {
        // Profil, lavozim va ruxsatlar bir vaqtda olinadi: 3 ta ketma-ket to'lqin o'rniga 1 ta.
        const [profileResult, rolesResult, permissionsResult, rolePermissionsResult] = await Promise.all([
          supabase.from('users').select('*').eq('id', this.session.user.id).single(),
          supabase.from('roles').select('id,name,description,is_system'),
          supabase.from('permissions').select('id,key,label,group_name,description'),
          supabase.from('role_permissions').select('role_id,permission_id'),
        ])
        const profile = profileResult.data
        if (profileResult.error) throw new Error(`Xodim profili topilmadi. Admin Supabase'da profil/lavozim biriktirsin. ${profileResult.error.message}`)
        if (rolesResult.error) throw rolesResult.error
        if (permissionsResult.error) throw new Error(`Ruxsatlar ro‘yxatini o‘qib bo‘lmadi: ${permissionsResult.error.message}`)
        if (rolePermissionsResult.error) throw new Error(`Lavozim ruxsatlarini o‘qib bo‘lmadi: ${rolePermissionsResult.error.message}`)
        const permissionRows = permissionsResult.data ?? []
        this.permissionKeys = permissionRows.map((permission) => permission.key)
        const permissionKeys = new Map(permissionRows.map((permission) => [permission.id, permission.key]))
        const assigned = new Map()
        for (const row of rolePermissionsResult.data ?? []) {
          if (!assigned.has(row.role_id)) assigned.set(row.role_id, [])
          const key = permissionKeys.get(row.permission_id)
          if (key) assigned.get(row.role_id).push(key)
        }
        this.roles = (rolesResult.data ?? []).map((role) => ({
          id: role.id, name: role.name, description: role.description ?? '', isSystem: role.is_system,
          permissions: assigned.get(role.id) ?? [],
        }))
        this.users = [mapUser(profile)]
        const permissionsForUser = this.currentRole?.permissions ?? []
        const can = (key) => permissionsForUser.includes(key)
        const failed = []
        const getRows = async (label, query) => {
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
        const needsTrips = can('trips.view') || can('trips.create') || can('clients.view') || can('clients.manage') || can('driver.self') || can('dashboard.view')
        const needsTransactions = can('finance.view') || can('clients.view') || can('clients.manage') || can('driver.self') || can('dashboard.view')
        const needsReports = can('dashboard.view') || can('finance.view') || can('fleet.manage') || can('driver.self')
        const needsClientBalances = can('clients.view') || can('clients.manage') || can('dashboard.view')
        const needsFinancialTotals = can('finance.view') || can('dashboard.view')
        const needsCategories = can('finance.manage') || can('finance.categories.create') || can('finance.view') || can('finance.payments.create') || can('finance.expenses.create') || can('dashboard.view')
        const requests = [
          needsClients ? getRows('mijozlar', supabase.from('clients').select('*').order('name')) : Promise.resolve([]),
          needsVehicles ? getRows('texnikalar', supabase.from('vehicles').select('*').order('plate')) : Promise.resolve([]),
          getRows('mahsulotlar', supabase.from('materials').select('*').order('name')),
          needsTrips ? (() => {
            let q = supabase.from('trips').select('*').order('created_at', { ascending: false }).limit(500)
            if (can('driver.self') && !can('trips.view')) q = q.eq('driver_id', profile.id)
            return getRows('reyslar', q)
          })() : Promise.resolve([]),
          needsTransactions ? (() => {
            let q = supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(700)
            if (can('driver.self') && !can('finance.view')) q = q.eq('driver_id', profile.id)
            return getRows('moliya', q)
          })() : Promise.resolve([]),
          needsReports ? (() => {
            let q = supabase.from('maintenance_reports').select('*').order('created_at', { ascending: false }).limit(100)
            if (can('driver.self') && !can('dashboard.view') && !can('finance.view') && !can('fleet.manage')) q = q.eq('driver_id', profile.id)
            return getRows('nosozliklar', q)
          })() : Promise.resolve([]),
          can('staff.view') || can('payroll.manage') ? getRows('xodimlar', supabase.from('users').select('*').order('full_name')) : getRows('xodimlar', supabase.from('staff_directory').select('*').order('full_name')),
          needsClientBalances ? getRows('mijoz balanslari', supabase.from('client_balances').select('client_id,current_balance')) : Promise.resolve([]),
          needsFinancialTotals ? getRows('kassa qoldiqlari', supabase.from('financial_balances').select('payment_method,current_balance')) : Promise.resolve([]),
          needsCategories ? getRows('moliya turlari', supabase.from('transaction_categories').select('*').order('direction').order('label')) : Promise.resolve([]),
        ]
        const [clients, vehicles, materials, trips, transactions, reports, users, clientBalances, financialTotals, categories] = await Promise.all(requests)
        this.clients = clients.map(mapClient)
        this.vehicles = vehicles.map(mapVehicle)
        this.materials = materials.map(mapMaterial)
        this.trips = trips.map(mapTrip)
        this.transactions = transactions.map(mapTransaction)
        this.maintenanceReports = reports.map(mapReport)
        this.users = users.map(mapUser)
        if (!this.users.some((user) => user.id === profile.id)) this.users.unshift(mapUser(profile))
        this.categories = categories.map(mapCategory)
        this.remoteClientBalances = Object.fromEntries(clientBalances.map((row) => [row.client_id, Number(row.current_balance || 0)]))
        this.remoteFinancialBalances = { cash: null, bank: null }
        for (const row of financialTotals) {
          if (row.payment_method === 'cash' || row.payment_method === 'bank') this.remoteFinancialBalances[row.payment_method] = Number(row.current_balance || 0)
        }
        this.dataWarnings = failed
        this.dataError = ''
        this.loadedUserId = this.session.user.id
        // Keyingi ochilishda to'liq yuklash kutmasin deb, yangi nusxani saqlab qo'yamiz.
        this.saveRemoteCache()

        if (this.realtimeChannel) await supabase.removeChannel(this.realtimeChannel)
        const channel = supabase.channel('qazilma-operations-live')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'maintenance_reports' }, (payload) => {
            const report = mapReport(payload.new)
            if (!this.maintenanceReports.some((item) => item.id === report.id)) this.maintenanceReports.unshift(report)
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'maintenance_reports' }, (payload) => {
            const report = mapReport(payload.new)
            const existing = this.maintenanceReports.find((item) => item.id === report.id)
            if (existing) Object.assign(existing, report)
          })
        if (can('finance.view') || can('dashboard.view') || can('clients.view') || can('finance.payments.create') || can('finance.expenses.create')) {
          channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, (payload) => {
            this.ingestRemoteTransaction(mapTransaction(payload.new))
          })
        }
        if (can('trips.view') || can('trips.create') || can('clients.view') || can('dashboard.view') || can('driver.self')) {
          channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trips' }, (payload) => {
            this.ingestRemoteTrip(mapTrip(payload.new))
          })
        }
        if (can('fleet.view') || can('fleet.manage') || can('dashboard.view') || can('driver.self')) {
          channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vehicles' }, (payload) => {
            const vehicle = this.vehicles.find((item) => item.id === payload.new.id)
            if (vehicle) Object.assign(vehicle, mapVehicle(payload.new))
          })
        }
        this.realtimeChannel = channel.subscribe()
      } catch (error) {
        if (background) {
          console.warn('Fon yangilash amalga oshmadi:', error?.message || error)
          return
        }
        this.dataError = error.message || 'Ma’lumotlarni yuklash imkoni bo‘lmadi.'
        throw error
      } finally {
        this.loading = false
      }
    },
    async ensurePhotoUrl(trip) {
      if (!this.remoteMode) return trip?.photoUrl ?? ''
      if (!trip?.photoPath) return ''
      const { data, error } = await supabase.storage.from('trip-photos').createSignedUrl(trip.photoPath, 3600)
      if (error) throw new Error(error.message)
      trip.photoUrl = data?.signedUrl ?? ''
      return trip.photoUrl
    },
    async createTrip(payload) {
      const vehicle = this.vehicles.find((item) => item.id === payload.vehicleId)
      const material = this.materials.find((item) => item.id === payload.materialId)
      if (!vehicle || !material) throw new Error('Samosval yoki tosh turini tanlang.')
      if (vehicle.status !== 'active') throw new Error('Servisdagi texnika uchun reys ochib bo‘lmaydi.')
      const weight = Number(payload.weightTons)
      if (!(weight > 0)) throw new Error('Og‘irlik 0 dan katta bo‘lishi kerak.')
      if (payload.saleType !== 'cash' && !payload.clientId) throw new Error('Mijozni tanlang.')
      // Naqd savdoda mijoz ixtiyoriy: tanlansa, reysda yuk kimka tashilgani ko'rinadi
      // (balansga esa qarz yozilmaydi — client_balances faqat credit reyslarni hisoblaydi).
      const clientId = payload.clientId || null
      const note = payload.note?.trim() || ''
      const id = this.remoteMode ? globalThis.crypto.randomUUID() : makeId('T')
      const createdAt = new Date().toISOString()
      const total = round2(weight * Number(material.unitPrice))
      if (this.remoteMode) {
        const row = {
          id, vehicle_id: vehicle.id, driver_id: vehicle.driverId,
          client_id: clientId,
          material_id: material.id, weight_tons: weight, unit_price: material.unitPrice,
          total_amount: total, sale_type: payload.saleType, hours_worked: Number(payload.hoursWorked || 0),
          note: note || null,
          created_by: this.session.user.id,
        }
        const { data, error } = await supabase.from('trips').insert(row).select('*').single()
        if (error) {
          // Eski bazada naqd+ijoz yoki `note` ustuni bo'lmasa — foydalanuvchiga
          // aniq qo'llanma ko'rsatamiz (schema.sql qayta ishga tushirish kerak).
          if (error.code === '23514' && /trip_sale_client_check/.test(String(error.message ?? ''))) {
            throw new Error('Naqd savdoda mijoz tanlash eski cheklovga to‘kramoqda — supabase/schema.sql faylini qayta ishga tushiring.')
          }
          if (/column .* does not exist/.test(String(error.message ?? ''))) {
            throw new Error('Reys uchun izoh ustuni yo‘q — supabase/schema.sql faylini qayta ishga tushiring.')
          }
          throw new Error(readableDbError(error, 'Reysni saqlab bo‘lmadi.'))
        }
        const trip = mapTrip(data)
        if (payload.photoFile) {
          const path = `${id}/${Date.now()}-${safeFileName(payload.photoFile.name)}`
          const { error: uploadError } = await supabase.storage.from('trip-photos').upload(path, payload.photoFile, { contentType: payload.photoFile.type, upsert: true })
          if (uploadError) {
            this.ingestRemoteTrip(trip)
            throw new Error(`Reys saqlandi, ammo rasm yuklanmadi: ${uploadError.message}`)
          }
          const { error: updateError } = await supabase.from('trips').update({ photo_path: path }).eq('id', id)
          if (updateError) throw new Error(`Reys saqlandi, foto biriktirilmadi: ${updateError.message}`)
          trip.photoPath = path
          const { data: signed } = await supabase.storage.from('trip-photos').createSignedUrl(path, 3600)
          trip.photoUrl = signed?.signedUrl ?? ''
        }
        const savedTrip = this.ingestRemoteTrip(trip)
        this.notify('Yangi reys muvaffaqiyatli saqlandi.')
        return savedTrip
      }
      const trip = {
        id, vehicleId: vehicle.id, driverId: vehicle.driverId, clientId,
        materialId: material.id, weightTons: weight, unitPrice: material.unitPrice, totalAmount: total,
        saleType: payload.saleType, hoursWorked: Number(payload.hoursWorked || 0), photoUrl: await readDataUrl(payload.photoFile),
        photoName: payload.photoFile?.name ?? '', note, createdAt, createdBy: this.activeUserId,
      }
      this.trips.unshift(trip)
      if (trip.saleType === 'cash') {
        this.transactions.unshift({ id: makeId('TX'), direction: 'in', category: 'cash_sale', amount: total, paymentMethod: 'cash', clientId, driverId: null, vehicleId: vehicle.id, tripId: id, note: `Naqd savdo · ${id}`, createdAt })
      }
      this.persistDemo()
      this.notify('Yangi reys muvaffaqiyatli saqlandi.')
      return trip
    },
    async createPayment(payload) {
      const amount = Number(payload.amount)
      if (!(amount > 0)) throw new Error('Summa 0 dan katta bo‘lishi kerak.')
      const categoryKey = payload.category || 'customer_payment'
      const definition = this.categories.find((item) => item.key === categoryKey)
      if (definition && definition.direction !== 'in') throw new Error('Bu turi faqat kirim uchun ishlatiladi.')
      const needsClient = definition ? definition.needsClient : categoryKey === 'customer_payment'
      if (needsClient && !payload.clientId) throw new Error('Mijozni tanlang.')
      const row = {
        direction: 'in', category: categoryKey, amount,
        payment_method: payload.paymentMethod, client_id: needsClient ? payload.clientId : null,
        note: payload.note?.trim() || null,
      }
      if (this.remoteMode) {
        const { data, error } = await supabase.from('transactions').insert(row).select('*').single()
        if (error) throw new Error(readableDbError(error, 'To‘lovni saqlab bo‘lmadi.'))
        this.ingestRemoteTransaction(mapTransaction(data))
      } else {
        this.transactions.unshift({ id: makeId('TX'), direction: 'in', category: categoryKey, amount,
          paymentMethod: payload.paymentMethod, clientId: needsClient ? payload.clientId : null, driverId: null, vehicleId: null,
          note: payload.note?.trim() || '', createdAt: new Date().toISOString() })
        this.persistDemo()
      }
      this.notify('Mijoz to‘lovi hisobga olindi.')
    },
    async createExpense(payload) {
      const amount = Number(payload.amount)
      if (!(amount > 0)) throw new Error('Summa 0 dan katta bo‘lishi kerak.')
      const row = {
        direction: 'out', category: payload.category, amount,
        payment_method: payload.paymentMethod, vehicle_id: payload.vehicleId || null,
        driver_id: payload.driverId || null, note: payload.note?.trim() || null,
      }
      if (this.remoteMode) {
        const { data, error } = await supabase.from('transactions').insert(row).select('*').single()
        if (error) throw error
        this.ingestRemoteTransaction(mapTransaction(data))
      } else {
        this.transactions.unshift({ id: makeId('TX'), direction: 'out', category: payload.category, amount,
          paymentMethod: payload.paymentMethod, clientId: null, driverId: payload.driverId || null,
          vehicleId: payload.vehicleId || null, note: payload.note?.trim() || '', createdAt: new Date().toISOString() })
        this.persistDemo()
      }
      this.notify('Xarajat muvaffaqiyatli saqlandi.')
    },
    async createClient(payload) {
      const row = { name: payload.name.trim(), phone: formatPhone(payload.phone) || null, contact_name: payload.contactName?.trim() || null, opening_balance: Number(payload.openingBalance || 0) }
      if (this.remoteMode) {
        const { data, error } = await supabase.from('clients').insert(row).select('*').single()
        if (error) throw error
        this.clients.unshift(mapClient(data))
      } else {
        this.clients.unshift({ id: makeId('C'), name: row.name, phone: row.phone ?? '', contactName: row.contact_name ?? '', openingBalance: row.opening_balance, createdAt: new Date().toISOString() })
        this.persistDemo()
      }
      this.notify('Yangi mijoz qo‘shildi.')
    },
    async createStaff(payload) {
      if (!this.canManageStaff) throw new Error('Xodim qo‘shish huquqi faqat to‘liq huquqli (superadmin) xodimda bor.')
      const role = this.roles.find((item) => item.id === payload.roleId)
      if (!role) throw new Error('Lavozimni tanlang.')
      const request = {
        fullName: payload.fullName.trim(), login: String(payload.login || '').trim().toLowerCase(),
        password: payload.password || '', generatePassword: Boolean(payload.generatePassword),
        phone: formatPhone(payload.phone), title: payload.title?.trim() || '',
        roleId: payload.roleId, driverRatePerTrip: Number(payload.driverRatePerTrip || 0),
      }
      if (this.remoteMode) {
        const data = await invokeStaffFunction('create-staff', request)
        await this.loadRemoteData()
        this.notify(`${data?.fullName || request.fullName} uchun login va parol yaratildi.`)
        return data
      }
      if (this.users.some((user) => user.login === request.login)) throw new Error('Bu login allaqachon band.')
      // To'liq huquqli lavozim berilsa, demo rejimida ham xodim superadmin bo'ladi.
      const grantedFullAccess = this.roleHasFullAccess(role.id)
      this.users.push({
        id: makeId('U'), fullName: request.fullName, login: request.login,
        email: toAuthEmail(request.login), phone: request.phone, roleId: role.id,
        title: request.title || role.name, driverRatePerTrip: request.driverRatePerTrip,
        isActive: true, isSuperadmin: grantedFullAccess,
      })
      this.persistDemo()
      this.notify(grantedFullAccess
        ? `${request.fullName} — to‘liq huquqli lavozim bilan qo‘shildi, superadmin sifatida boshqaradi.`
        : 'Demo rejimida xodim ro‘yxatiga qo‘shildi.')
      return { ok: true, login: request.login, isSuperadmin: grantedFullAccess }
    },
    async setStaffPassword(userId, password) {
      if (!this.canManageStaff) throw new Error('Parolni o‘zgartirish huquqi faqat to‘liq huquqli (superadmin) xodimda bor.')
      if (String(password || '').trim().length < 8) throw new Error('Parol kamida 8 ta belgidan iborat bo‘lishi kerak.')
      if (!this.remoteMode) { this.notify('Demo rejimida parol haqiqiy hisobga saqlanmaydi.'); return }
      const { data, error } = await supabase.functions.invoke('set-staff-password', { body: { userId, password: String(password).trim() } })
      if (error) throw new Error(await readFunctionError('set-staff-password', error))
      if (data?.error) throw new Error(String(data.error))
      this.notify(`${data?.fullName || 'Xodim'} uchun yangi parol saqlandi.`)
    },
    async updateStaffProfile(userId, patch) {
      if (!this.canManageStaff) throw new Error('Xodimni tahrirlash huquqi faqat to‘liq huquqli (superadmin) xodimda bor.')
      const body = {
        full_name: patch.fullName?.trim() || undefined,
        phone: patch.phone === undefined ? undefined : (formatPhone(patch.phone) || null),
        title: patch.title?.trim() || null,
        role_id: patch.roleId || undefined,
        is_active: patch.isActive === undefined ? undefined : Boolean(patch.isActive),
      }
      Object.keys(body).forEach((key) => body[key] === undefined && delete body[key])
      if (!Object.keys(body).length) return
      // O'zini o'zi bloklamaslik: boshqa superadmin'lar boshqaruvni qayta taqsimlashi mumkin,
      // lekin o'z lavozimi yoki holatini o'zgartirish tizimdan chiqib ketishga olib keladi.
      if (userId === this.currentUser?.id && (body.role_id || body.is_active === false)) {
        throw new Error('O‘z lavozimingiz yoki holatingizni o‘zgartirib bo‘lmaydi.')
      }
      if (body.role_id && !this.roles.some((role) => role.id === body.role_id)) throw new Error('Lavozim topilmadi.')
      if (this.remoteMode) {
        const { error } = await supabase.from('users').update(body).eq('id', userId)
        if (error) throw error
        await this.loadRemoteData()
      } else {
        const user = this.users.find((item) => item.id === userId)
        if (user) {
          if (body.full_name) user.fullName = body.full_name
          if ('phone' in body) user.phone = body.phone ?? ''
          if ('title' in body) user.title = body.title ?? ''
          if (body.role_id) { user.roleId = body.role_id; user.isSuperadmin = this.roleHasFullAccess(body.role_id) }
          if (body.is_active !== undefined) user.isActive = body.is_active
          this.persistDemo()
        }
      }
      this.notify('Xodim ma’lumotlari yangilandi.')
    },
    async saveRole(payload) {
      const selected = [...new Set(payload.permissions || [])]
      if (!payload.name?.trim()) throw new Error('Lavozim nomini kiriting.')
      const elevated = selected.filter((key) => !this.currentRole?.permissions?.includes(key))
      if (elevated.length) throw new Error(`Sizda ushbu ruxsatlarni berish huquqi yo‘q: ${elevated.join(', ')}`)
      if (this.remoteMode) {
        let roleId = payload.id
        if (roleId) {
          const { error } = await supabase.from('roles').update({ name: payload.name.trim(), description: payload.description?.trim() || '' }).eq('id', roleId)
          if (error) throw error
        } else {
          const { data, error } = await supabase.from('roles').insert({ name: payload.name.trim(), description: payload.description?.trim() || '' }).select('id').single()
          if (error) throw error
          roleId = data.id
        }
        const { error: permissionsError } = await supabase.rpc('save_role_permissions', { p_role_id: roleId, p_permission_keys: selected })
        if (permissionsError) throw permissionsError
        await this.loadRemoteData()
      } else {
        const old = this.roles.find((role) => role.id === payload.id)
        if (old) Object.assign(old, { name: payload.name.trim(), description: payload.description?.trim() || '', permissions: selected })
        else this.roles.push({ id: makeId('R'), name: payload.name.trim(), description: payload.description?.trim() || '', permissions: selected, color: 'slate', isSystem: false })
        this.persistDemo()
      }
      this.notify('Lavozim ruxsatlari saqlandi.')
    },
    async deleteRole(roleId) {
      const role = this.roles.find((item) => item.id === roleId)
      if (!role || role.isSystem) throw new Error('Tizim lavozimini o‘chirib bo‘lmaydi.')
      if (this.users.some((user) => user.roleId === roleId)) throw new Error('Bu lavozimda xodimlar bor. Avval ularni boshqa lavozimga o‘tkazing.')
      if (this.remoteMode) {
        const { error } = await supabase.from('roles').delete().eq('id', roleId)
        if (error) throw error
        this.roles = this.roles.filter((item) => item.id !== roleId)
      } else {
        this.roles = this.roles.filter((item) => item.id !== roleId)
        this.persistDemo()
      }
      this.notify('Lavozim o‘chirildi.')
    },
    async updateMaterial(materialId, unitPrice) {
      if (!this.can('materials.manage')) throw new Error('Mahsulot narxini o‘zgartirish ruxsati yo‘q.')
      const price = Number(unitPrice)
      if (!(price > 0)) throw new Error('Narx 0 dan katta bo‘lishi kerak.')
      if (this.remoteMode) {
        const { error } = await supabase.from('materials').update({ unit_price: price }).eq('id', materialId)
        if (error) throw new Error(readableDbError(error, 'Mahsulot narxini saqlab bo‘lmadi.'))
      }
      const material = this.materials.find((item) => item.id === materialId)
      if (material) material.unitPrice = price
      this.persistDemo()
      this.notify('Mahsulot narxi yangilandi.')
    },
    // materials.create — faqat qo'shish; materials.manage — qo'shish, narx va o'chirish.
    async createMaterial(payload) {
      if (!this.canCreateMaterial) throw new Error('Mahsulot qo‘shish ruxsati yo‘q.')
      const name = String(payload.name || '').trim()
      const unitPrice = Number(payload.unitPrice)
      if (name.length < 2) throw new Error('Mahsulot nomini kiriting.')
      if (name.length > 60) throw new Error('Mahsulot nomi 60 ta belgidan oshmasligi kerak.')
      if (!(unitPrice > 0)) throw new Error('Tonna narxi 0 dan katta bo‘lishi kerak.')
      if (this.materials.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('Bu nomdagi mahsulot allaqachon mavjud.')
      }
      if (this.remoteMode) {
        const { data, error } = await supabase.from('materials').insert({ name, unit_price: unitPrice }).select('*').single()
        if (error) throw new Error(readableDbError(error, 'Mahsulotni qo‘shib bo‘lmadi.'))
        this.materials.push(mapMaterial(data))
      } else {
        this.materials.push({ id: makeId('M'), name, unitPrice, isActive: true })
      }
      this.materials.sort((a, b) => a.name.localeCompare(b.name))
      this.persistDemo()
      this.notify(`“${name}” mahsuloti qo‘shildi.`)
    },
    // O‘chirish ikki qatlamda himoyalangan: demo rejimda do‘kon o‘zi tekshiradi,
    // uzoq rejimda esa schema.sql dagi trigger reyslar sonini sanab, tushunarli xabar beradi.
    async deleteMaterial(materialId) {
      if (!this.can('materials.manage')) throw new Error('Mahsulot o‘chirish ruxsati yo‘q.')
      const material = this.materials.find((item) => item.id === materialId)
      if (!material) throw new Error('Mahsulot topilmadi.')
      if (this.remoteMode) {
        const { error } = await supabase.from('materials').delete().eq('id', materialId)
        if (error) throw new Error(readableDbError(error, `“${material.name}” mahsulotini o‘chirib bo‘lmadi.`))
      } else {
        const used = this.trips.filter((trip) => trip.materialId === materialId).length
        if (used) throw new Error(`“${material.name}” mahsuloti ${used} ta reysda ishlatilgan — o‘chirib bo‘lmaydi.`)
      }
      this.materials = this.materials.filter((item) => item.id !== materialId)
      this.persistDemo()
      this.notify(`“${material.name}” mahsuloti o‘chirildi.`)
    },
    // finance.categories.create — faqat yangi tur yaratish; finance.manage — qo'shish,
    // tahrirlash va o'chirish. Ikkalasi bo'lmasa, xodim o'z turini yarata olmaydi va
    // superadminga murojaat qilishi kerak bo'ladi.
    async createCategory(payload) {
      if (!this.canCreateCategory) throw new Error('Moliya turi qo‘shish ruxsati yo‘q.')
      const label = String(payload.label || '').trim()
      const hint = String(payload.hint || '').trim()
      const direction = payload.direction === 'in' ? 'in' : 'out'
      if (label.length < 2) throw new Error('Tur nomini kiriting (kamida 2 ta belgi).')
      if (label.length > 60) throw new Error('Tur nomi 60 ta belgidan oshmasligi kerak.')
      if (hint.length > 140) throw new Error('Izoh 140 ta belgidan oshmasligi kerak.')
      const key = slugify(label)
      if (!key) throw new Error('Tur nomi lotin harflaridan iborat bo‘lishi kerak.')
      if (this.categories.some((item) => item.key === key)) throw new Error('Bu nomdagi turi allaqachon mavjud.')
      const row = {
        key, label, direction, hint,
        needs_client: direction === 'in' && payload.needsClient === true,
        needs_vehicle: direction === 'out' && payload.needsVehicle === true,
        needs_driver: direction === 'out' && payload.needsDriver === true,
      }
      if (this.remoteMode) {
        const { data, error } = await supabase.from('transaction_categories').insert(row).select('*').single()
        if (error) throw new Error(readableDbError(error, 'Moliya turini qo‘shib bo‘lmadi.'))
        this.categories.push(mapCategory(data))
      } else {
        this.categories.push({
          id: makeId('CAT'), key, label, direction, hint,
          needsClient: row.needs_client, needsVehicle: row.needs_vehicle, needsDriver: row.needs_driver,
          isActive: true, isSystem: false,
        })
      }
      this.categories.sort((a, b) => a.label.localeCompare(b.label))
      this.persistDemo()
      this.notify(`“${label}” turi yaratildi.`)
    },
    async updateCategory(categoryId, payload) {
      if (!this.can('finance.manage')) throw new Error('Moliya turlarini boshqarish ruxsati yo‘q.')
      const category = this.categories.find((item) => item.id === categoryId)
      if (!category) throw new Error('Moliya turi topilmadi.')
      const label = String(payload.label ?? category.label).trim()
      const hint = String(payload.hint ?? category.hint).trim()
      if (label.length < 2) throw new Error('Tur nomini kiriting (kamida 2 ta belgi).')
      if (label.length > 60) throw new Error('Tur nomi 60 ta belgidan oshmasligi kerak.')
      if (hint.length > 140) throw new Error('Izoh 140 ta belgidan oshmasligi kerak.')
      // Faqat ko‘rinadigan qism o‘zgaradi: key o‘zgarmaydi, shuning uchun eskirgan
      // yozuvlar (trips.category / transactions.category) ham buzilmaydi.
      if (this.remoteMode) {
        const { error } = await supabase.from('transaction_categories').update({ label, hint }).eq('id', categoryId)
        if (error) throw new Error(readableDbError(error, 'Moliya turini yangilab bo‘lmadi.'))
      }
      category.label = label
      category.hint = hint
      this.persistDemo()
      this.notify('Moliya turi yangilandi.')
    },
    async deleteCategory(categoryId) {
      if (!this.can('finance.manage')) throw new Error('Moliya turlarini boshqarish ruxsati yo‘q.')
      const category = this.categories.find((item) => item.id === categoryId)
      if (!category) throw new Error('Moliya turi topilmadi.')
      if (category.isSystem) throw new Error(`“${category.label}” — tizim turi, uni o‘chirib bo‘lmaydi.`)
      if (this.remoteMode) {
        const { error } = await supabase.from('transaction_categories').delete().eq('id', categoryId)
        if (error) throw new Error(readableDbError(error, `“${category.label}” turini o‘chirib bo‘lmadi.`))
      } else {
        const used = this.transactions.filter((tx) => tx.category === category.key).length
        if (used) throw new Error(`“${category.label}” turi ${used} ta amalda ishlatilgan — o‘chirib bo‘lmaydi.`)
      }
      this.categories = this.categories.filter((item) => item.id !== categoryId)
      this.persistDemo()
      this.notify(`“${category.label}” turi o‘chirildi.`)
    },
    // Haydovchi roli bor xodimlar — texnika biriktirish uchun.
    drivers() {
      return this.users.filter((user) => user.isActive !== false && this.userCan(user, 'driver.self'))
    },
    async createVehicle(payload) {
      if (!this.can('fleet.manage')) throw new Error('Texnika qo‘shish huquqi yo‘q.')
      const plate = String(payload.plate || '').trim().toUpperCase()
      const model = String(payload.model || '').trim()
      if (!plate) throw new Error('Texnika raqamini kiriting.')
      if (!model) throw new Error('Texnika markasini kiriting.')
      if (this.vehicles.some((vehicle) => vehicle.plate.toUpperCase() === plate)) throw new Error('Bu raqamdagi texlika allaqachon bor.')
      const row = {
        plate, model, year: payload.year ? Number(payload.year) : null,
        driver_id: payload.driverId || null, status: payload.status || 'active',
      }
      if (this.remoteMode) {
        const { data, error } = await supabase.from('vehicles').insert(row).select('*').single()
        if (error) throw error
        this.vehicles.push(mapVehicle(data))
        this.vehicles.sort((a, b) => a.plate.localeCompare(b.plate))
      } else {
        this.vehicles.push({
          id: makeId('V'), plate: row.plate, model: row.model, year: row.year,
          driverId: row.driver_id, status: row.status,
        })
        this.vehicles.sort((a, b) => a.plate.localeCompare(b.plate))
        this.persistDemo()
      }
      this.notify(`${plate} qo‘shildi.`)
      return mapVehicle(row)
    },
    async updateVehicle(vehicleId, payload) {
      if (!this.can('fleet.manage')) throw new Error('Texnikani tahrirlash huquqi yo‘q.')
      const vehicle = this.vehicles.find((item) => item.id === vehicleId)
      if (!vehicle) throw new Error('Texnika topilmadi.')
      const plate = String(payload.plate || '').trim().toUpperCase()
      const model = String(payload.model || '').trim()
      if (!plate || !model) throw new Error('Raqam va marka to‘ldirilishi shart.')
      if (this.vehicles.some((item) => item.id !== vehicleId && item.plate.toUpperCase() === plate)) {
        throw new Error('Bu raqamdagi texnika allaqachon bor.')
      }
      const row = {
        plate, model, year: payload.year ? Number(payload.year) : null,
        driver_id: payload.driverId || null, status: payload.status || 'active',
      }
      if (this.remoteMode) {
        const { error } = await supabase.from('vehicles').update(row).eq('id', vehicleId)
        if (error) throw error
      }
      Object.assign(vehicle, mapVehicle({ ...vehicle, ...row, id: vehicleId }))
      this.persistDemo()
      this.notify(`${plate} yangilandi.`)
    },
    async updateVehicleStatus(vehicleId, status) {
      if (!['active', 'service', 'repair'].includes(status)) throw new Error('Noma’lum texnika holati.')
      if (this.remoteMode) {
        const { error } = await supabase.from('vehicles').update({ status }).eq('id', vehicleId)
        if (error) throw error
      }
      const vehicle = this.vehicles.find((item) => item.id === vehicleId)
      if (vehicle) vehicle.status = status
      this.persistDemo()
      this.notify(status === 'active' ? 'Texnika ishga qaytarildi.' : 'Texnika servis holatiga o‘tkazildi.')
    },
    async updateDriverRate(userId, rate) {
      const value = Number(rate)
      if (value < 0) throw new Error('Stavka manfiy bo‘lishi mumkin emas.')
      if (this.remoteMode) {
        const { error } = await supabase.rpc('set_driver_rate', { p_user_id: userId, p_rate: value })
        if (error) throw error
      }
      const user = this.users.find((item) => item.id === userId)
      if (user) user.driverRatePerTrip = value
      this.persistDemo()
      this.notify('Reys uchun stavka saqlandi.')
    },
    async createMaintenanceReport(payload) {
      const vehicle = this.vehicles.find((item) => item.id === payload.vehicleId)
      if (!vehicle) throw new Error('Texnikani tanlang.')
      if (!payload.description?.trim()) throw new Error('Nosozlik haqida qisqacha yozing.')
      if (this.remoteMode) {
        const { data, error } = await supabase.from('maintenance_reports').insert({
          vehicle_id: vehicle.id, driver_id: this.currentUser.id, description: payload.description.trim(), status: 'open',
        }).select('*').single()
        if (error) throw error
        const report = mapReport(data)
        this.maintenanceReports.unshift(report)
      } else {
        this.maintenanceReports.unshift({ id: makeId('MR'), vehicleId: vehicle.id, driverId: this.currentUser.id, description: payload.description.trim(), status: 'open', createdAt: new Date().toISOString() })
      }
      vehicle.status = 'repair'
      this.persistDemo()
      this.notify('Nosozlik xabari yuborildi, texnika remont holatiga o‘tkazildi.')
    },
    async resolveMaintenanceReport(reportId) {
      if (this.remoteMode) {
        const { error } = await supabase.from('maintenance_reports').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', reportId)
        if (error) throw error
      }
      const report = this.maintenanceReports.find((item) => item.id === reportId)
      if (report) report.status = 'resolved'
      this.persistDemo()
      this.notify('Nosozlik xabari yopildi.')
    },
    resetDemo() {
      if (this.remoteMode) return
      const fresh = createDemoData()
      Object.assign(this, fresh, { activeUserId: 'u-boss' })
      this.persistDemo()
      this.notify('Demo ma’lumotlari qayta tiklandi.')
    },
    clearDemoRecords() {
      if (this.remoteMode) return
      const fresh = createDemoData()
      this.activeUserId = 'u-boss'
      this.clients = []
      this.vehicles = []
      this.trips = []
      this.transactions = []
      this.maintenanceReports = []
      this.users = fresh.users
      this.roles = fresh.roles
      this.materials = fresh.materials.map((material) => ({ ...material, unitPrice: 0 }))
      this.persistDemo()
      this.notify('Demo yozuvlar to‘zalandi: mijoz, texnika, reys, moliya va nosozliklar bo‘sh.')
    },
  },
})
