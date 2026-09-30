import { PERMISSION_CATALOG } from './permissions'

const shiftDate = (daysAgo, hour = 9, minute = 0) => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

const allKeys = PERMISSION_CATALOG.map((permission) => permission.key)
const accountantKeys = [
  'dashboard.view', 'trips.view', 'clients.view', 'clients.manage', 'fleet.view', 'finance.view',
  'finance.payments.create', 'finance.expenses.create', 'finance.manage', 'payroll.manage', 'staff.view',
  'maintenance.report',
]
// "Faqat kiritish" namunasi: to'liq boshqaruvsiz, o'z mahsulot/turini yaratadigan xodim.
const entryKeys = ['dashboard.view', 'trips.view', 'fleet.view', 'materials.create', 'finance.view', 'finance.categories.create']
const scaleKeys = ['trips.view', 'trips.create', 'fleet.view']
// Tarozi ustasining kuchaytirilgan varianti: kiritgan reysi monitoringga yubormaydi.
const scaleAutoKeys = [...scaleKeys, 'trips.auto_approve']
const driverKeys = ['driver.self', 'maintenance.report']

// Moliya turlari — supabase/schema.sql dagi transaction_categories seedi bilan bir xil.
const categories = [
  { id: 'cat-customer_payment', key: 'customer_payment', label: 'Mijoz to‘lovi', direction: 'in', hint: 'Kelgan to‘lov mijoz balansini kamaytiradi', needsClient: true, needsVehicle: false, needsDriver: false, isActive: true, isSystem: true },
  { id: 'cat-cash_sale', key: 'cash_sale', label: 'Naqd savdo', direction: 'in', hint: 'Reyssiz naqd savdo — kassaga tushadigan tushum', needsClient: false, needsVehicle: false, needsDriver: false, isActive: true, isSystem: true },
  { id: 'cat-blasting', key: 'blasting', label: 'Portlatish ishlari', direction: 'out', hint: 'Ruxsatnoma, portlovchi modda, mutaxassis', needsClient: false, needsVehicle: false, needsDriver: false, isActive: true, isSystem: true },
  { id: 'cat-fuel', key: 'fuel', label: 'Yoqilg‘i-moylash', direction: 'out', hint: 'Solyarka va moylash materiallari', needsClient: false, needsVehicle: true, needsDriver: false, isActive: true, isSystem: true },
  { id: 'cat-repair', key: 'repair', label: 'Texnika ta’miri', direction: 'out', hint: 'Ehtiyot qismlar va usta haqi', needsClient: false, needsVehicle: true, needsDriver: false, isActive: true, isSystem: true },
  { id: 'cat-salary', key: 'salary', label: 'Oyliklar', direction: 'out', hint: 'Smena va ma’muriyat ish haqi', needsClient: false, needsVehicle: false, needsDriver: false, isActive: true, isSystem: true },
  { id: 'cat-payroll', key: 'payroll', label: 'Haydovchi avansi', direction: 'out', hint: 'Haydovchi hisob-kitobidan avans', needsClient: false, needsVehicle: false, needsDriver: true, isActive: true, isSystem: true },
  { id: 'cat-other', key: 'other', label: 'Boshqa xarajat', direction: 'out', hint: 'Boshqa bo‘limlar uchun to‘lov', needsClient: false, needsVehicle: false, needsDriver: false, isActive: true, isSystem: true },
]

export function createDemoData() {
  const roles = [
    { id: 'role-boss', name: 'Boshliq', description: 'Barcha bo‘limlar va tizim sozlamalari', color: 'green', isSystem: true, grantsAll: true, permissions: allKeys },
    { id: 'role-accountant', name: 'Buxgalter', description: 'Moliya, mijozlar va ish haqi hisobi', color: 'blue', isSystem: true, permissions: accountantKeys },
    { id: 'role-entry', name: 'Kirituvchi', description: 'Mahsulot va moliya turlarini kiritadi, boshqarmaydi', color: 'slate', isSystem: false, permissions: entryKeys },
    { id: 'role-scale', name: 'Tarozi ustasi', description: 'Reyslarni ro‘yxatga olish', color: 'amber', isSystem: true, permissions: scaleKeys },
    { id: 'role-scale-auto', name: 'Tarozi ustasi (avto)', description: 'Reyslarni kiritadi va darhol tasdiqlaydi', color: 'amber', isSystem: false, permissions: scaleAutoKeys },
    { id: 'role-driver', name: 'Haydovchi', description: 'Faqat o‘z ish faoliyati va xabarlari', color: 'slate', isSystem: true, permissions: driverKeys },
  ]

  const users = [
    { id: 'u-boss', fullName: 'Javlon Karimov', login: 'karersuperadmin', email: 'javlon@qazilma.uz', phone: '+998 90 123 45 67', roleId: 'role-boss', title: 'Bosh direktor', driverRatePerTrip: 0, isActive: true, isSuperadmin: true },
    { id: 'u-accountant', fullName: 'Nargiza Tursunova', email: 'nargiza@qazilma.uz', phone: '+998 90 234 56 78', roleId: 'role-accountant', title: 'Bosh buxgalter', driverRatePerTrip: 0, isActive: true },
    { id: 'u-entry', fullName: 'Otabek Rustamov', email: 'otabek@qazilma.uz', phone: '+998 90 555 44 33', roleId: 'role-entry', title: 'Omborchi', driverRatePerTrip: 0, isActive: true },
    { id: 'u-scale', fullName: 'Sherzod Islomov', email: 'sherzod@qazilma.uz', phone: '+998 91 345 67 89', roleId: 'role-scale', title: 'Tarozi ustasi', driverRatePerTrip: 0, isActive: true },
    { id: 'u-driver-1', fullName: 'Mansur Rahimov', email: 'mansur@qazilma.uz', phone: '+998 93 111 22 33', roleId: 'role-driver', title: 'Haydovchi', driverRatePerTrip: 50000, isActive: true },
    { id: 'u-driver-2', fullName: 'Azizbek Qodirov', email: 'azizbek@qazilma.uz', phone: '+998 93 222 33 44', roleId: 'role-driver', title: 'Haydovchi', driverRatePerTrip: 50000, isActive: true },
    { id: 'u-driver-3', fullName: 'Doston Ergashev', email: 'doston@qazilma.uz', phone: '+998 93 333 44 55', roleId: 'role-driver', title: 'Haydovchi', driverRatePerTrip: 55000, isActive: true },
    { id: 'u-driver-4', fullName: 'Ulug‘bek Hasanov', email: 'ulugbek@qazilma.uz', phone: '+998 93 444 55 66', roleId: 'role-driver', title: 'Haydovchi', driverRatePerTrip: 50000, isActive: true },
  ]

  const clients = [
    { id: 'c-1', name: 'Samarqand Qurilish Servis', phone: '+998 66 233 10 20', contactName: 'Akmal aka', openingBalance: 8_400_000, createdAt: shiftDate(25) },
    { id: 'c-2', name: 'Toshkent Yo‘l Qurilish', phone: '+998 71 244 20 30', contactName: 'Dilshod Karimov', openingBalance: -3_200_000, createdAt: shiftDate(18) },
    { id: 'c-3', name: 'Bekobod Beton', phone: '+998 70 925 32 10', contactName: 'Sardor Rustamov', openingBalance: 5_750_000, createdAt: shiftDate(12) },
    { id: 'c-4', name: 'Orient Build Group', phone: '+998 90 555 74 00', contactName: 'Malika Iskandarova', openingBalance: 0, createdAt: shiftDate(6) },
    { id: 'c-5', name: 'Nurafshon Yo‘l Servis', phone: '+998 97 421 00 19', contactName: 'Farrux aka', openingBalance: -1_100_000, createdAt: shiftDate(3) },
  ]

  const materials = [
    { id: 'm-1', name: 'Yirik tosh', unitPrice: 95_000, isActive: true },
    { id: 'm-2', name: 'Sheben', unitPrice: 120_000, isActive: true },
    { id: 'm-3', name: 'Qum', unitPrice: 68_000, isActive: true },
  ]

  const vehicles = [
    { id: 'v-1', plate: '01 A 724 AB', model: 'HOWO T5G', driverId: 'u-driver-1', status: 'active', year: 2022 },
    { id: 'v-2', plate: '01 B 391 CB', model: 'SHACMAN X3000', driverId: 'u-driver-2', status: 'active', year: 2021 },
    { id: 'v-3', plate: '01 C 208 DB', model: 'KAMAZ 6520', driverId: 'u-driver-3', status: 'active', year: 2020 },
    { id: 'v-4', plate: '01 D 877 EB', model: 'HOWO A7', driverId: 'u-driver-4', status: 'service', year: 2019 },
    { id: 'v-5', plate: '01 E 551 FB', model: 'SHACMAN F3000', driverId: 'u-driver-1', status: 'active', year: 2023 },
  ]

  const tripSeed = [
    { id: 'T-2401', vehicleId: 'v-1', driverId: 'u-driver-1', clientId: 'c-1', materialId: 'm-1', weightTons: 28.4, hoursWorked: 1.2, saleType: 'credit', note: 'Chorsu qurilish maydonchasiga', daysAgo: 0, hour: 8, minute: 5 },
    { id: 'T-2402', vehicleId: 'v-2', driverId: 'u-driver-2', clientId: 'c-1', materialId: 'm-2', weightTons: 32.1, hoursWorked: 1.4, saleType: 'cash', note: 'Naqd, «Tosh omboni» — mijoz ko‘rsatildi', daysAgo: 0, hour: 8, minute: 48 },
    { id: 'T-2403', vehicleId: 'v-3', driverId: 'u-driver-3', clientId: 'c-3', materialId: 'm-3', weightTons: 25.8, hoursWorked: 1.1, saleType: 'credit', note: 'Shartnoma №45 bo‘yicha', daysAgo: 0, hour: 9, minute: 32 },
    { id: 'T-2404', vehicleId: 'v-1', driverId: 'u-driver-1', clientId: 'c-2', materialId: 'm-1', weightTons: 29.7, hoursWorked: 1.3, saleType: 'credit', daysAgo: 0, hour: 10, minute: 16 },
    { id: 'T-2405', vehicleId: 'v-5', driverId: 'u-driver-1', clientId: null, materialId: 'm-3', weightTons: 31.0, hoursWorked: 1.5, saleType: 'cash', daysAgo: 0, hour: 10, minute: 54 },
    { id: 'T-2406', vehicleId: 'v-2', driverId: 'u-driver-2', clientId: 'c-4', materialId: 'm-2', weightTons: 27.2, hoursWorked: 1.2, saleType: 'credit', daysAgo: 0, hour: 11, minute: 21 },
    { id: 'T-2399', vehicleId: 'v-3', driverId: 'u-driver-3', clientId: 'c-1', materialId: 'm-1', weightTons: 30.6, hoursWorked: 1.4, saleType: 'credit', daysAgo: 1, hour: 15, minute: 42 },
    { id: 'T-2398', vehicleId: 'v-1', driverId: 'u-driver-1', clientId: 'c-2', materialId: 'm-2', weightTons: 26.5, hoursWorked: 1.3, saleType: 'credit', daysAgo: 1, hour: 13, minute: 17 },
    { id: 'T-2397', vehicleId: 'v-5', driverId: 'u-driver-1', clientId: 'c-3', materialId: 'm-3', weightTons: 29.4, hoursWorked: 1.5, saleType: 'credit', daysAgo: 1, hour: 11, minute: 9 },
    { id: 'T-2396', vehicleId: 'v-2', driverId: 'u-driver-2', clientId: null, materialId: 'm-1', weightTons: 30.2, hoursWorked: 1.4, saleType: 'cash', daysAgo: 2, hour: 14, minute: 10 },
    { id: 'T-2395', vehicleId: 'v-3', driverId: 'u-driver-3', clientId: 'c-4', materialId: 'm-2', weightTons: 31.8, hoursWorked: 1.6, saleType: 'credit', daysAgo: 2, hour: 9, minute: 22 },
    { id: 'T-2394', vehicleId: 'v-1', driverId: 'u-driver-1', clientId: 'c-1', materialId: 'm-1', weightTons: 27.6, hoursWorked: 1.2, saleType: 'credit', daysAgo: 3, hour: 16, minute: 2 },
    { id: 'T-2393', vehicleId: 'v-5', driverId: 'u-driver-1', clientId: 'c-5', materialId: 'm-3', weightTons: 28.7, hoursWorked: 1.3, saleType: 'credit', daysAgo: 4, hour: 12, minute: 36 },
    { id: 'T-2392', vehicleId: 'v-2', driverId: 'u-driver-2', clientId: null, materialId: 'm-2', weightTons: 30.4, hoursWorked: 1.5, saleType: 'cash', daysAgo: 5, hour: 10, minute: 14 },
    { id: 'T-2391', vehicleId: 'v-3', driverId: 'u-driver-3', clientId: 'c-2', materialId: 'm-1', weightTons: 26.8, hoursWorked: 1.2, saleType: 'credit', daysAgo: 6, hour: 8, minute: 54 },
    { id: 'T-2390', vehicleId: 'v-1', driverId: 'u-driver-1', clientId: 'c-3', materialId: 'm-2', weightTons: 32.3, hoursWorked: 1.5, saleType: 'credit', daysAgo: 7, hour: 13, minute: 47 },
  ]

  // Monitoring demo uchun navbat: bugungi 3 ta reys tasdiqlanmagan — ular moliyaviy
  // hisobga HALI kirmaydi (kassa, mijoz balansi va dashboard shuni ko'rsatadi).
  const pendingTripIds = new Set(['T-2404', 'T-2405', 'T-2406'])

  const trips = tripSeed.map((item) => {
    const material = materials.find((m) => m.id === item.materialId)
    return {
      id: item.id,
      vehicleId: item.vehicleId,
      driverId: item.driverId,
      clientId: item.clientId,
      materialId: item.materialId,
      weightTons: item.weightTons,
      unitPrice: material.unitPrice,
      totalAmount: Math.round(item.weightTons * material.unitPrice),
      saleType: item.saleType,
      hoursWorked: item.hoursWorked,
      photoUrl: '',
      photoName: '',
      note: item.note || '',
      createdAt: shiftDate(item.daysAgo, item.hour, item.minute),
      createdBy: 'u-scale',
      // Monitoring demo holati: oxirgi 3 ta reys navbatda (kutilmoqda), qolgani tasdiqlangan.
      monitoringStatus: pendingTripIds.has(item.id) ? 'pending' : 'approved',
      monitoredAt: pendingTripIds.has(item.id) ? null : shiftDate(item.daysAgo, item.hour, item.minute + 20),
      monitoringNote: '',
    }
  })

  const transactions = [
    { id: 'TX-801', direction: 'in', category: 'customer_payment', amount: 7_500_000, paymentMethod: 'bank', clientId: 'c-1', driverId: null, vehicleId: null, note: 'Hisob-faktura bo‘yicha to‘lov', createdAt: shiftDate(0, 8, 35) },
    { id: 'TX-802', direction: 'in', category: 'customer_payment', amount: 4_200_000, paymentMethod: 'cash', clientId: 'c-2', driverId: null, vehicleId: null, note: 'Qisman to‘lov', createdAt: shiftDate(0, 9, 46) },
    { id: 'TX-803', direction: 'out', category: 'fuel', amount: 2_150_000, paymentMethod: 'bank', clientId: null, driverId: null, vehicleId: 'v-1', note: 'Solyarka, 500 litr', createdAt: shiftDate(0, 10, 4) },
    { id: 'TX-804', direction: 'out', category: 'blasting', amount: 1_300_000, paymentMethod: 'cash', clientId: null, driverId: null, vehicleId: null, note: 'Portlatish ishlari', createdAt: shiftDate(0, 10, 42) },
    { id: 'TX-805', direction: 'out', category: 'payroll', amount: 300_000, paymentMethod: 'cash', clientId: null, driverId: 'u-driver-1', vehicleId: null, note: 'Haydovchiga avans', createdAt: shiftDate(0, 11, 2) },
    { id: 'TX-806', direction: 'in', category: 'customer_payment', amount: 6_800_000, paymentMethod: 'bank', clientId: 'c-3', driverId: null, vehicleId: null, note: 'Shartnoma bo‘yicha', createdAt: shiftDate(1, 14, 28) },
    { id: 'TX-807', direction: 'out', category: 'repair', amount: 875_000, paymentMethod: 'cash', clientId: null, driverId: null, vehicleId: 'v-4', note: 'G‘ildirak va ustaxona xizmati', createdAt: shiftDate(1, 16, 5) },
    { id: 'TX-808', direction: 'out', category: 'salary', amount: 4_500_000, paymentMethod: 'bank', clientId: null, driverId: null, vehicleId: null, note: 'Smena xodimlari oyligi', createdAt: shiftDate(2, 15, 10) },
    { id: 'TX-809', direction: 'out', category: 'fuel', amount: 1_850_000, paymentMethod: 'cash', clientId: null, driverId: null, vehicleId: 'v-2', note: 'Yoqilg‘i quyish', createdAt: shiftDate(3, 9, 14) },
    { id: 'TX-810', direction: 'in', category: 'customer_payment', amount: 5_000_000, paymentMethod: 'cash', clientId: 'c-5', driverId: null, vehicleId: null, note: 'Avans hisobiga', createdAt: shiftDate(4, 12, 25) },
  ]

  // Monitoring: faqat CHIQIM yozuvlari tasdiqlanadi va faqat ular kutilmoqda bo'ladi.
  // Kirimlar (TX-801/802/806/810 va naqd savdo) doim tasdiqlangan hisoblanadi.
  const pendingExpenseIds = new Set(['TX-803', 'TX-805'])
  transactions.forEach((tx) => {
    tx.monitoringStatus = tx.direction === 'out' && pendingExpenseIds.has(tx.id) ? 'pending' : 'approved'
    tx.monitoredAt = tx.monitoringStatus === 'approved' ? tx.createdAt : null
    tx.monitoringNote = ''
  })

  // Naqd savdo tushumi faqat TASDIQLANGAN reyslar uchun yoziladi — kutilayotgan
  // reysning tushumi kassada ko'rinmaydi (DB trigger'i bilan bir xil qoida).
  trips.filter((trip) => trip.saleType === 'cash' && trip.monitoringStatus === 'approved').forEach((trip) => {
    transactions.push({
      id: `TX-${trip.id}`, direction: 'in', category: 'cash_sale', amount: trip.totalAmount,
      paymentMethod: 'cash', clientId: trip.clientId, driverId: null, vehicleId: trip.vehicleId,
      note: `Naqd savdo · ${trip.id}`, tripId: trip.id, createdAt: trip.createdAt,
      monitoringStatus: 'approved', monitoredAt: trip.createdAt, monitoringNote: '',
    })
  })

  const maintenanceReports = [
    { id: 'MR-19', vehicleId: 'v-4', driverId: 'u-driver-4', description: 'Orqa chap balon bosimi tushyapti, ustaga ko‘rsatish kerak.', status: 'open', createdAt: shiftDate(0, 8, 20) },
    { id: 'MR-18', vehicleId: 'v-2', driverId: 'u-driver-2', description: 'Tormoz kolodkalarida shovqin sezildi.', status: 'resolved', createdAt: shiftDate(2, 15, 50) },
  ]

  return { roles, users, clients, materials, vehicles, trips, transactions, maintenanceReports, categories }
}
