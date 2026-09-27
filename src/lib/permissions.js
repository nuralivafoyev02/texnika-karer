export const PERMISSION_CATALOG = [
  { key: 'dashboard.view', label: 'Dashboardni ko‘rish', group: 'Umumiy', description: 'Kunlik svotka va monitoring ko‘rsatkichlari' },
  { key: 'trips.view', label: 'Reyslarni ko‘rish', group: 'Karer', description: 'Barcha reyslar jurnali va yuklar tarixi' },
  { key: 'trips.create', label: 'Yangi reys kiritish', group: 'Karer', description: 'Tarozi orqali yangi reysni tasdiqlash' },
  { key: 'clients.view', label: 'Mijozlarni ko‘rish', group: 'Mijozlar', description: 'Mijozlar ro‘yxati va balanslari' },
  { key: 'clients.manage', label: 'Mijoz qo‘shish / tahrirlash', group: 'Mijozlar', description: 'Mijoz ma’lumotlarini boshqarish' },
  { key: 'fleet.view', label: 'Texnikalarni ko‘rish', group: 'Texnika', description: 'Samosvallar holati va ishlash ko‘rsatkichlari' },
  { key: 'fleet.manage', label: 'Texnika holatini boshqarish', group: 'Texnika', description: 'Servis va ta’mir holatiga o‘tkazish' },
  { key: 'finance.view', label: 'Moliyani ko‘rish', group: 'Moliya', description: 'Kassa, bank, kirim-chiqim jurnali' },
  { key: 'finance.payments.create', label: 'Mijoz to‘lovini kiritish', group: 'Moliya', description: 'Naqd yoki bank orqali kirim yozish' },
  { key: 'finance.expenses.create', label: 'Xarajat kiritish', group: 'Moliya', description: 'Karer xarajatlari va ish haqi to‘lovi' },
  { key: 'payroll.manage', label: 'Oylik va stavkani boshqarish', group: 'Xodimlar', description: 'Reys stavkasi va haydovchi avanslari' },
  { key: 'staff.view', label: 'Xodimlarni ko‘rish', group: 'Xodimlar', description: 'Xodimlar va haydovchilar ro‘yxati' },
  { key: 'staff.manage', label: 'Xodim qo‘shish', group: 'Xodimlar', description: 'Xodim qo‘shish, login va parol berish (faqat superadmin)' },
  { key: 'roles.manage', label: 'Lavozim va ruxsatlarni sozlash', group: 'Sozlamalar', description: 'Dinamik RBAC lavozimlari va huquqlari (faqat superadmin)' },
  { key: 'materials.manage', label: 'Mahsulotlarni boshqarish', group: 'Sozlamalar', description: 'Mahsulot qo‘shish, narxi va o‘chirish' },
  { key: 'finance.manage', label: 'Moliya turlarini boshqarish', group: 'Sozlamalar', description: 'Daromat va xarajat turlarini yaratish' },
  { key: 'driver.self', label: 'Shaxsiy haydovchi kabineti', group: 'Haydovchi', description: 'Faqat o‘z reyslari, maoshi va xabarlari' },
  { key: 'maintenance.report', label: 'Nosozlik haqida xabar berish', group: 'Texnika', description: 'Texnika bo‘yicha tezkor xabar yuborish' },
]

export const PERMISSION_GROUPS = [...new Set(PERMISSION_CATALOG.map((item) => item.group))]
export const permissionLabel = (key) => PERMISSION_CATALOG.find((item) => item.key === key)?.label ?? key
