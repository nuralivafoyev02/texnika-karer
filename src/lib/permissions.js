export const PERMISSION_CATALOG = [
  { key: 'dashboard.view', label: 'Dashboardni ko‘rish', group: 'Umumiy', description: 'Kunlik svotka va monitoring ko‘rsatkichlari' },
  { key: 'trips.view', label: 'Reyslarni ko‘rish', group: 'Karer', description: 'Barcha reyslar jurnali va yuklar tarixi' },
  { key: 'trips.create', label: 'Yangi reys kiritish', group: 'Karer', description: 'Tarozi orqali yangi reysni kiritish — reys monitoring navbatiga tasdiqlash uchun yuboriladi' },
  { key: 'trips.auto_approve', label: 'Yangi reysni avtomatik tasdiqlash', group: 'Karer', description: 'Kiritilgan reys monitoring bo‘limiga o‘tmasdan, darhol tasdiqlangan holda saqlanadi' },
  { key: 'materials.prices.view', label: 'Mahsulot narxlarini ko‘rish', group: 'Karer', description: 'Tonna narxi va reys qiymatini ko‘rish — haydovchi va tarozi ustasi ko‘rmaydi' },
  { key: 'monitoring.view', label: 'Monitoringni ko‘rish', group: 'Monitoring', description: 'Tasdiqlash kutilayotgan reys va xarajatlarni ko‘rish' },
  { key: 'monitoring.approve', label: 'Reys va xarajatlarni tasdiqlash', group: 'Monitoring', description: 'Reyslar va xarajatlarni tasdiqlash yoki tasdiqlashni bekor qilish' },
  { key: 'clients.view', label: 'Mijozlarni ko‘rish', group: 'Mijozlar', description: 'Mijozlar ro‘yxati va balanslari' },
  { key: 'clients.manage', label: 'Mijoz qo‘shish / tahrirlash', group: 'Mijozlar', description: 'Mijoz ma’lumotlarini boshqarish' },
  { key: 'fleet.view', label: 'Texnikalarni ko‘rish', group: 'Texnika', description: 'Samosvallar holati va ishlash ko‘rsatkichlari' },
  { key: 'fleet.manage', label: 'Texnika holatini boshqarish', group: 'Texnika', description: 'Servis va ta’mir holatiga o‘tkazish' },
  { key: 'finance.view', label: 'Moliyani ko‘rish', group: 'Moliya', description: 'Kassa, bank, kirim-chiqim jurnali' },
  { key: 'finance.payments.create', label: 'Mijoz to‘lovini kiritish', group: 'Moliya', description: 'Naqd yoki bank orqali kirim yozish' },
  { key: 'finance.expenses.create', label: 'Xarajat kiritish', group: 'Moliya', description: 'Karer xarajatlari va ish haqi to‘lovi' },
  { key: 'finance.transactions.edit', label: 'Kvitansiyani tahrirlash', group: 'Moliya', description: 'Kirim va chiqim yozuvlarini tahrirlash' },
  { key: 'finance.transactions.delete', label: 'Kvitansiyani o‘chirish', group: 'Moliya', description: 'Kirim va chiqim yozuvlarini o‘chirish' },
  { key: 'payroll.manage', label: 'Oylik va stavkani boshqarish', group: 'Xodimlar', description: 'Reys stavkasi va haydovchi avanslari' },
  { key: 'staff.view', label: 'Xodimlarni ko‘rish', group: 'Xodimlar', description: 'Xodimlar va haydovchilar ro‘yxati' },
  { key: 'staff.manage', label: 'Xodim qo‘shish', group: 'Xodimlar', description: 'Xodim qo‘shish, login va parol berish (faqat to‘liq huquqli — superadmin)' },
  { key: 'roles.manage', label: 'Lavozim va ruxsatlarni sozlash', group: 'Sozlamalar', description: 'Dinamik RBAC lavozimlari va huquqlari (faqat to‘liq huquqli — superadmin)' },
  { key: 'materials.create', label: 'Mahsulot qo‘shish', group: 'Sozlamalar', description: 'Yangi tosh turi va tonna narxini kiritish' },
  { key: 'materials.manage', label: 'Mahsulotlarni boshqarish', group: 'Sozlamalar', description: 'Mahsulot narxi, faolligi va o‘chirish (qo‘shishdan tashqari)' },
  { key: 'finance.categories.create', label: 'Moliya turi qo‘shish', group: 'Sozlamalar', description: 'Yangi daromat yoki xarajat turini yaratish' },
  { key: 'finance.manage', label: 'Moliya turlarini boshqarish', group: 'Sozlamalar', description: 'Moliya turlarini tahrirlash va o‘chirish (qo‘shishdan tashqari)' },
  { key: 'driver.self', label: 'Shaxsiy haydovchi kabineti', group: 'Haydovchi', description: 'Faqat o‘z reyslari, maoshi va xabarlari' },
  { key: 'maintenance.report', label: 'Nosozlik haqida xabar berish', group: 'Texnika', description: 'Texnika bo‘yicha tezkor xabar yuborish' },
]

// "To'liq dostup" — lavozimdagi barcha ruxsat kalitlari. Shu holatdagi xodim superadmin
// deb hisoblanadi: xodim qo'sha, login/parol beradi, lavozim va ruxsatlarni boshqaradi.
// DB dagi role_has_full_access() va Edge Function'dagi permissionKeysForRole() bilan bir xil qoida.
// Kalitlar ro'yxati berilishi mumkin: store bazadan yuklangan katalogni uzatadi, aks holda
// bu yeridagi ko'rsatma ishlatiladi. Shunda serverga yangi kalit qo'shilsa ham
// "full dostub" baholasi buzilmaydi.
export const FULL_ACCESS_KEYS = PERMISSION_CATALOG.map((permission) => permission.key)
export const hasFullAccess = (permissions, catalog = FULL_ACCESS_KEYS) => {
  const keys = catalog?.length ? catalog : FULL_ACCESS_KEYS
  const owned = new Set(permissions ?? [])
  return keys.length > 0 && keys.every((key) => owned.has(key))
}

// `grantsAll` — serverdagi roles.grants_all belgisi. Bunday lavozim katalogdagi barcha
// kalitga ega bo'lishi shart emas: yangi kalit qo'shilsa ham u avtomatik oladi. Shu
// sababli "barcha kalitni qo'lda belgilash" usuli yangi kalitda superadminni buzardi.
export const roleGrantsAll = (role) => role?.grantsAll === true
export const isFullAccessRole = (role, permissions, catalog) => roleGrantsAll(role) || hasFullAccess(permissions, catalog)

export const PERMISSION_GROUPS = [...new Set(PERMISSION_CATALOG.map((item) => item.group))]
export const permissionLabel = (key) => PERMISSION_CATALOG.find((item) => item.key === key)?.label ?? key
