import { PERMISSION_CATALOG, PERMISSION_GROUPS } from './permissions'

// ── Bitta manba ──────────────────────────────────────────────────────────────
// Bo'lim haqidagi matnlar bitta yerda saqlanadi va uch joyda ishlatiladi:
//   1) sahifaning qisqa tavsifi (page subtitle),
//   2) "Foydalanish yo'riqnomasi" modali,
//   3) global qidiruvdagi bo'limlar natijasi.
// Shu sababli tavsiflar bir-biridan ajralib qolmaydi.
//
// `permission` / `permissionAny` — bo'limga kirish uchun kerakli ruxsat.
// Yo'riqnoma foydalanuvchining haqiqiy ruxsatlariga qarab filtrlanadi:
// ruxsati yo'q bo'limlar umuman ko'rsatilmaydi.

export const GUIDE_SECTIONS = [
  {
    id: 'dashboard',
    route: '/dashboard',
    permission: 'dashboard.view',
    title: 'Umumiy ko‘rinish',
    eyebrow: 'Monitoring',
    short: 'Kareringizdagi bugungi ish faoliyati va asosiy ko‘rsatkichlar.',
    purpose: 'Kunlik svotka: karerda nechta reys bo‘ldi, qancha tonna tashildi, tushum va foyda qancha, qanday ochiq nosozliklar bor. Rahbar uchun birinchi o‘lchov nuqtasi.',
    actions: [
      'Bugungi reys, tonnage, tushum, sof foyda va faol texnikalar ko‘rsatkichlari',
      'Haftalik sotuv va xarajat grafigi (7 kun)',
      'Kassa va bank qoldig‘i',
      'So‘nggi 5 ta reys, texnikalar holati va eng katta mijozlar balansi',
      'Ochiq nosozliklar haqida ogohlantirish',
    ],
    steps: [
      'Yuqoridagi 4 ta kartadan kunlik natijani ko‘ring.',
      'Grafikda qaysi kun xarajati yuqori ekanini aniqlang.',
      'Ogohlantirish banneri chiqsa, u haqiqiy nosozlikka bosib «Texnikalar» sahifasiga o‘ting.',
    ],
    tips: ['Qiymatlar reyslar va moliya yozuvlaridan avtomatik hisoblanadi — qo‘lda kiritish shart emas.', 'Ruxsati bo‘lmagan xodim faqat o‘z reyslarini ko‘radi.'],
  },
  {
    id: 'trips',
    route: '/trips',
    permission: 'trips.view',
    title: 'Reyslar jurnali',
    eyebrow: 'Ishlab chiqarish',
    short: 'Karerdan chiqqan har bir samosval reysi va yuk tafsilotlari.',
    purpose: 'Barcha reyslarning tarixi: qaysi texnika, qaysi haydovchi, qaysi mijoz, qancha tonna, qaysi tosh va qancha summa. Yer ostidagi ishlab chiqarish hujjati shu yerda.',
    actions: [
      'Reyslarni matn bo‘yicha qidirish (reys ID, mijoz, samosval, haydovchi, tosh turi, izoh)',
      'Bugungi yoki barcha sana filtri',
      'Naqd / hisobga savdo filtri',
      'Ko‘rsatilgan reyslar uchun jami tonna va sotuv qiymati',
      'Yuk fotosuratini ko‘rish (tarozidan olingan surat)',
      'Reys izohini ko‘rish — qaysi obyektga tashilgani jadvalda yoziladi',
    ],
    steps: [
      'Qidiruv maydoniga reys ID, mijoz yoki samosval nomini yozing.',
      'Sana va savdo turi filtrlarini kerak bo‘lsa o‘zgartiring.',
      'Fotosurati bor reys yonidagi rasm tugmasini bosing.',
    ],
    tips: ['Reyslar «Yangi reys» sahifasidan tasdiqlanadi — bu yerda faqat ko‘riladi va qidiriladi.', 'Jadvalda ko‘rsatilgan qiymatlar filtrga mos keladigan reyslar bo‘yicha hisoblanadi.'],
  },
  {
    id: 'scale',
    route: '/scale',
    permission: 'trips.create',
    title: 'Yangi reys',
    eyebrow: 'Tarozixona',
    short: 'Yuk ma’lumotlarini tekshirib, reysni tasdiqlang.',
    purpose: 'Tarozidan chiqqan yukni darhol kiritish: samosval, tosh turi, og‘irlik, soat va savdo turi. Summa avtomatik hisoblanadi, naqd savdo esa kassaga ham yoziladi.',
    actions: [
      'Faol samosvalni tanlash (servisdagi texnika tanlanmaydi)',
      'Tosh turi va tonna narxini tanlash — summa o‘zi chiqadi',
      'Og‘irlik (tonna) va ish vaqti (soat) kiritish',
      'Naqd savdo yoki mijozga hisobga savdo tanlash — naqdda mijoz ixtiyoriy',
      'Reysga izoh yozish — qaysi obyektga tashilgani',
      'Yuk fotosurati qo‘shish (ixtiyoriy, 1,5 MB gacha)',
    ],
    steps: [
      'Samosvalni tanlang — haydovchi avtomatik to‘ldiriladi.',
      'Tosh turini tanlang: tonna narxi sizning kiritgan qiymatingiz.',
      'Tarozidagi og‘irlikni kiriting (0 dan katta bo‘lishi shart).',
      'Savdo turini tanlang: «Hisobga» — mijoz majburiy, «Naqd» — mijoz ixtiyoriy (yuk kimka ekanini yozib qolish uchun).',
      'Rasm qo‘shib, «Reyni tasdiqlash»ni bosing.',
    ],
    tips: ['Tasdiqlangan reys narxi keyin o‘zgarmaydi — xato bo‘lsa tahrirlash o‘rniga yangi reys kiritish kerak.', 'Naqd reysda mijoz tanlansa, u jurnalda ko‘rinadi — balansga qarz yozilmaydi.', 'Servisdagi texnika reys uchun tanlanmaydi — avval holatini «Faol»ga qaytaring.'],
  },
  {
    id: 'clients',
    route: '/clients',
    permission: 'clients.view',
    title: 'Mijozlar',
    eyebrow: 'Mijozlar bilan ishlash',
    short: 'Mijozlar ro‘yxati, hisob-kitob va avanslarni nazorat qiling.',
    purpose: 'Korxonalar ro‘yxati va ularning qarz/avans holati. Balans reyslar (hisobga savdo) va tushgan to‘lovlardan avtomatik hisoblanadi.',
    actions: [
      'Mijoz nomi, mas’ul shaxs yoki telefon bo‘yicha qidirish',
      'Jami qarz va jami avans ko‘rsatkichlari',
      'Yangi mijoz qo‘shish (boshlang‘ich qarz bilan)',
      'Biror mijozdan to‘lov qabul qilish (kassa yoki bankga)',
    ],
    steps: [
      'Avval mijozni qo‘shing: nom, mas’ul shaxs, telefon va boshlang‘ich qarz.',
      'Reys kiritishda mijozni tanlang — savdo qiymati uning qarziga qo‘shiladi.',
      'To‘lov kiritishda mijozni, summani va to‘lov usulini tanlang.',
    ],
    tips: ['Qizil balans — mijozning qarzi, yashil — mijozning avansi. Hisob yopiq bo‘lsa balans 0.', 'To‘lovni o‘zgartirish yoki o‘chirish shu versiyalarda mumkin emas; xato yozuvni avval to‘g‘rilang.'],
  },
  {
    id: 'fleet',
    route: '/fleet',
    permission: 'fleet.view',
    title: 'Texnikalar',
    eyebrow: 'Texnika',
    short: 'Samosvallar ro‘yxati, haydovchilar va holati.',
    purpose: 'Samosvallar ro‘yxati, ularga biriktirilgan haydovchilar, oylik statistikasi va ta’mir/nosozlik holati.',
    actions: [
      'Texnika qo‘shish va tahrirlash (raqam, marka, yil, haydovchi)',
      'Holatni «Faol» ↔ «Servisda» ga o‘tkazish',
      'Nosozlik xabarlarini ko‘rish va yopish',
      'Oylik reys, soat, tonna va xarajat statistikasi',
      'Reys kerak bo‘lmagan texnika uchun yangi haydovchi qo‘shish',
    ],
    steps: [
      'Texnika qo‘shish: raqam, marka, holat va haydovchini tanlang.',
      'Haydovchini o‘zgartirmoq uchun «Tahrirlash»ni bosing.',
      'Ta’mirga yuborish uchun holatni «Servisda»ga o‘zgartiring.',
      'Xabar kelganda banner yoki «Nosozliklar» ro‘yxatidan «Bajarildi»ni bosing.',
    ],
    tips: ['Servisdagi texnika «Yangi reys» sahifasida tanlanmaydi.', 'Nosozlik haqida xabar berish uchun `maintenance.report` ruxsati kerak.'],
  },
  {
    id: 'finance',
    route: '/finance',
    permission: 'finance.view',
    title: 'Moliya',
    eyebrow: 'Hisob-kitob',
    short: 'Pul oqimi, mijoz to‘lovlari va karer xarajatlarini boshqaring.',
    purpose: 'Barcha kirim-chiqimlar: mijoz to‘lovlari, yoqilg‘i, ta’mir, ish haqi. Kassa va bank qoldig‘i shu yozuvlardan chiqadi.',
    actions: [
      'Mijozdan to‘lov kabul qilish (naqd yoki bank)',
      'Xarajat kiritish: yoqilg‘i, ta’mir, ish haqi, avans va boshqa turlar',
      'Kassa / bank / hammasi filtri va matn qidiruvi',
      'Shu oygi xarajatlarning turlar bo‘yicha taqsimoti',
      'Jadvalni CSV faylga eksport qilish',
      'Har bir kirim va chiqimga izoh yozish — jurnalda «Tafsilot» sifatida ko‘rinadi',
    ],
    steps: [
      'To‘lov uchun «To‘lov kiritish»: tur, mijoz, summa, usul.',
      'Xarajat uchun «Xarajat kiritish»: tur, summa, usul, ixtiyoriy texnika/haydovchi.',
      'Ish haqi (payroll) yozuvida haydovchini tanlang — oylik hisoboti shundan chiqadi.',
      'Eksport tugmasi jadvaldagi joriy filtrni CSV sifatida yuklab oladi.',
    ],
    tips: ['Naqd savdo reysi kassaga avtomatik kirim qilinadi — uni qo‘shatib yozmang.', 'To‘lov turi mijozga bog‘langan bo‘lsa (masalan «Mijoz to‘lovi»), mijozni tanlash shart.'],
  },
  {
    id: 'drivers',
    route: '/drivers',
    permissionAny: ['staff.view', 'driver.self'],
    title: 'Haydovchilar',
    eyebrow: 'Haydovchi kabineti',
    short: 'Faqat sizga biriktirilgan reyslar va oylik hisob-kitobi.',
    // Xodim ko'rishida (staff.view) boshqacha ko'rinadi — matn ham shu manbada.
    shortStaff: 'Reyslar asosidagi avtomatik oylik, avans va stavkalar.',
    purpose: 'Haydovchilar uchun oylik hisob-kitobi (stavka × reys soni), berilgan avanslar va qolgan qarz. Haydovchi o‘zi faqat shu ma’lumotlarni ko‘radi.',
    actions: [
      'Har bir haydovchi bo‘yicha: shu oy reyslari, ish haqi, to‘langan, qolgan',
      'Avans berish (ish haqidan ayiriladi)',
      'Oylik stavkasini ko‘rish va o‘zgartirish (payroll.manage)',
      'Yangi haydovchi qo‘shish (login va parol bilan)',
      'Reyslarni haydovchi bo‘yicha ko‘rish',
    ],
    steps: [
      'Oylik stavkasini xodimlar bo‘limidan belgilang.',
      'Avans berish uchun «Avans» tugmasini bosing: tur «Ish haqi», haydovchi tanlang.',
      'Qarz qolsa, to‘lov turi «Ish haqi» bo‘lgan yozuv kiriting.',
    ],
    tips: ['Reyssiz stavka hisobga olinmaydi — hisob oy ichidagi reyslar bo‘yicha.', 'Haydovchi o‘z kabinetida boshqa xodimlarni ko‘ra olmaydi.'],
  },
  {
    id: 'staff',
    route: '/staff',
    permission: 'staff.view',
    title: 'Xodimlar',
    eyebrow: 'Jamoa boshqaruvi',
    short: 'Xodimlarning logini va parolini siz yaratasiz — email yoki taklif linkisiz.',
    purpose: 'Tizimga kireadigan xodimlarni boshqarish. Har bir xodimning logini, paroli, lavozimi, telefon va holati shu yerda.',
    actions: [
      'Xodim qo‘shish va unga login + parol berish',
      'Lavozim, telefon, lavozim nomi va oylik stavkasini tahrirlash',
      'Xodimni vaqtincha bloklash (holatini o‘zgartirish)',
      'Parolni tiklash',
    ],
    steps: [
      '«Yangi xodim qo‘shish»ni bosing: ism, login, parol (yoki avtomatik), telefon, lavozim.',
      'Login va parolni xodimga yetkazing — u shu login bilan `karer.erp` domenga kiradi.',
      'Lavozimni «Sozlamalar»da yaratganingizdan keyin shu yerda tanlang.',
    ],
    tips: ['Xodim qo‘shish va parol berish faqat to‘liq huquqli (superadmin) xodimga berilgan.', 'O‘z lavozimingizni yoki holatingizni o‘zgartira olmaysiz — bu bloklanishning oldini oladi.'],
  },
  {
    id: 'settings',
    route: '/settings',
    permissionAny: ['roles.manage', 'materials.create', 'materials.manage', 'finance.categories.create', 'finance.manage'],
    title: 'Sozlamalar',
    eyebrow: 'Tizim sozlamalari',
    short: 'Lavozim va ruxsatlar, mahsulot narxlari hamda moliya turlari — barchasi bitta joyda.',
    purpose: 'Tizimning uchta asosiy katalogi: lavozimlar va ularning ruxsatlari, tosh turlari va ularning narxi, moliya kirim-chiqim turlari.',
    actions: [
      'Lavozim yaratish va uning ruxsatlarini belgilash',
      'Tosh turi (mahsulot) qo‘shish, narxini o‘zgartirish, o‘chirish',
      'Moliya turi (kirim va chiqim) qo‘shish va boshqarish',
      'Ruxsat kalitlarini bo‘lim va amallar bo‘yicha guruhlash',
    ],
    steps: [
      '«Mahsulotlar» tabida tosh turini va tonna narxini kiriting — narx «Yangi reys»da shundan olinadi.',
      '«Moliya turlari» tabida xarajat turlarini oldindan yaratib qo‘ying.',
      '«Lavozimlar» tabida lavozim yarating va ruxsatlarni belgilang.',
      'Barcha ruxsatlar berilgan lavozim egasi superadmin deb hisoblanadi.',
    ],
    tips: ['Lavozimdagi ruxsatlar darhol kuchga kiradi — xodim shu zahoti yangi imkoniyatni oladi.', 'O‘zgartirish uchun `*manage`, faqat qo‘shish uchun `*create` ruxsati kerak.'],
  },
]

// Bo'limni topish yoki uning qisqa tavsifini olish (sahifa sarlavhalari shu yerdan o'qiydi).
export const sectionByRoute = (route) => GUIDE_SECTIONS.find((section) => section.route === route) ?? null
export const sectionShort = (route) => sectionByRoute(route)?.short ?? ''
// Xodimlar uchun ko'rinish (staff view) — bo'lim matni boshqacha bo'lganda.
export const sectionShortStaff = (route) => sectionByRoute(route)?.shortStaff ?? sectionShort(route)

// Foydalanuvchining haqiqiy ruxsatlariga mos keladigan bo'limlar.
// `store` kerak, shuning uchun bu funksiya komponent ichida chaqiriladi.
export const availableSections = (store) => GUIDE_SECTIONS.filter((section) => {
  if (section.permission) return store.can(section.permission)
  if (section.permissionAny?.length) return section.permissionAny.some((permission) => store.can(permission))
  return false
})

// ── Ruxsat katalogi: yo'riqnomaning "Ruxsatlar" bo'limi ─────────────────────
// Ro'yxat PERMISSION_CATALOG'dan olinadi, shuning uchun serverga yangi kalit
// qo'shilsa, yo'riqnoma ham o'zi yangilanadi. Foydalanuvchiga faqat o'z
// lavozimidagi ruxsatlar tegishli (berilmaganlari o'chgan holda ko'rsatiladi).
export const permissionGroupsFor = (store) => PERMISSION_GROUPS.map((group) => ({
  group,
  items: PERMISSION_CATALOG
    .filter((permission) => permission.group === group)
    .map((permission) => ({ ...permission, granted: store.can(permission.key) })),
}))

// Umumiy ishlash tartibi — barcha foydalanuvchilar uchun bir xil.
export const GUIDE_BASICS = [
  {
    title: 'Kunlik tartib',
    items: [
      'Ertaga har bir samosval uchun «Yangi reys» sahifasidan yukni tasdiqlang.',
      'Moliya kelganda «Moliya» bo‘limidan to‘lov (kirim) va xarajat (chiqim) yozuvlarini kiriting.',
      'Yakunda «Umumiy ko‘rinish» dan tushum, foyda va ochiq nosozliklarni tekshiring.',
    ],
  },
  {
    title: 'Tezkor tugmalar',
    items: [
      'Ctrl / Cmd + K — qidiruv maydonini kengaytiradi va fikrlashga tayyorlaydi.',
      'Esc — qidiruvdan chiqadi; matn qolsa maydon keng holatda qoladi.',
      'Har bir oyna (modalda) Esc yoki tashqariga bosish bilan yopiladi.',
    ],
  },
  {
    title: 'Hisob-kitob qoidalari',
    items: [
      'Reys qiymati = og‘irlik (tonna) × tosh turi tonna narxi.',
      'Mijoz balansi = boshlang‘ich qarz + hisobga savdolar − to‘langan to‘lovlar.',
      'Naqd savdo reysi kassaga avtomatik kirim qilinadi.',
    ],
  },
  {
    title: 'Ruxsatlar',
    items: [
      'Har bir xodim faqat o‘z lavozimiga berilgan amallarni ko‘radi va bajaradi.',
      'Lavozim va ruxsatlarni faqat to‘liq huquqli (superadmin) xodim o‘zgartiradi.',
      'Barcha ruxsatlarga ega lavozim avtomatik superadmin deb hisoblanadi.',
    ],
  },
]
