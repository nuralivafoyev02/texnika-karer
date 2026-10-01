# AliBuilding — mobil ilova (React Native / Expo)

Web tizimning (`../src`) to‘liq mobil nusxasi. Bir xil Supabase bazasi, bir xil lavozim/ruxsat (RBAC) tizimi,
bir xil biznes qoidalari — web va mobil bir-birini buzmaydi.

| Web (Vue)                    | Mobil (shu papka)                                   |
| ---------------------------- | --------------------------------------------------- |
| `src/stores/quarry.js`       | `src/store/quarry.ts` (+ `derive.ts`, `mappers.ts`) |
| `src/lib/permissions.js`     | `src/lib/permissions.ts`                            |
| `src/lib/format.js / phone.js / monitoring.js` | `src/lib/*.ts`                    |
| `src/views/*View.vue`        | `src/app/**` (Expo Router ekranlari)                |
| `src/components/forms/*`     | `src/components/forms/*Sheet.tsx`                   |

**Bo‘limlar:** Umumiy ko‘rinish · Reyslar jurnali (+PDF varaqa) · Yangi reys (kamera/galereya) · Monitoring ·
Mijozlar · Texnikalar · Moliya (kvitansiya, tahrir/o‘chirish, PDF/CSV eksport) · Haydovchilar / Mening hisobim ·
Xodimlar · Sozlamalar (profil, xavfsizlik, lavozimlar, mahsulotlar, moliya turlari) · Yo‘riqnoma.
Har bir foydalanuvchi faqat o‘z lavozimiga ruxsat berilgan bo‘limlarni ko‘radi (web bilan bir xil).

## Ishga tushirish

```bash
cd mobile
npm install
cp .env.example .env        # web'dagi VITE_SUPABASE_* qiymatlari bilan bir xil (EXPO_PUBLIC_SUPABASE_*)
npx expo start              # QR kod → Expo Go yoki development build
npm run typecheck           # tsc --noEmit
```

> **Muhim:** Face ID / barmoq izi bilan kirish (`expo-secure-store` + `requireAuthentication`) va OTA yangilanish
> **Expo Go da to‘liq ishlamaydi** — buning uchun development build kerak:
> `npx eas-cli build --profile development --platform android` (yoki ios), so‘ng `npx expo start --dev-client`.

## Biometrik kirish va avto-qulf (Sozlamalar → Xavfsizlik)

Har bir foydalanuvchi o‘zi yoqadi/o‘chiradi:

* **Face ID / barmoq izi bilan kirish.** Yoqishda joriy parol tasdiqlanadi, login+parol qurilmaning xavfsiz xotirasiga
  (iOS Keychain / Android Keystore) `requireAuthentication` bilan yoziladi. Chiqib ketgandan keyin ham login ekranida
  biometriya so‘raladi — parolni qayta yozish shart emas. Yangi barmoq izi qo‘shilsa yoki parol o‘zgarsa, saqlangan
  ma’lumot bekor bo‘ladi va parol qayta so‘raladi. Biometrik ma’lumotning o‘zi ilovaga/serverga hech qachon uzatilmaydi.
* **Ilovani qulflash.** Fondan qaytganda (darhol / 30 s / 1 daq / 5 daq) biometriya yoki qurilma PIN kodi so‘raladi.
* Sessiya tokenlari ham `SecureStore` da (bo‘laklarga bo‘lib) saqlanadi — oddiy AsyncStorage da emas.

## Yangilanishlar: `.apk` ni qayta o‘rnatmasdan (OTA)

JS kodi, matnlar va rasmlar `expo-updates` (EAS Update) orqali o‘zi yangilanadi. Ilova ochilganda va fondan
qaytganda tekshiradi; yangi versiya topilsa "Qayta ishga tushirish" taklif qilinadi
(Sozlamalar → Yangilanishlar orqali qo‘lda ham tekshiriladi).

Bir martalik sozlash:

```bash
npx eas-cli login
npx eas-cli init                 # eas projectId yaratadi
npx eas-cli update:configure     # app.json ga updates.url va runtimeVersion qo‘shadi
```

Birinchi build (APK, to‘g‘ridan-to‘g‘ri o‘rnatish uchun) va keyingi yangilanishlar:

```bash
npm run build:android                                   # eas build -p android --profile preview  → .apk
npx eas-cli channel:edit preview --branch preview       # preview kanali ↔ preview branch (bir marta)
npx eas-cli update --branch preview --message "Moliya jadvali tuzatildi"   # ← har yangilanishda faqat shu
```

Production uchun `--profile production` build va `--branch production`.

**Qachon yangi build kerak?** Faqat *native* qism o‘zgarganda: yangi native kutubxona qo‘shilsa, `app.json` dagi
ruxsat/plagin o‘zgarsa yoki Expo SDK ko‘tarilsa. Bunda `app.json` → `version` ni oshiring (`runtimeVersion` siyosati
`appVersion`) — eski o‘rnatilgan ilovalar mos kelmaydigan yangilanishni olmaydi.

## Tuzilma

```
mobile/src
├─ app/                 Expo Router: login, (app)/(tabs)/{dashboard,trips,scale,monitoring,cabinet,more},
│                       (app)/{clients,fleet,finance,drivers,staff}, (app)/settings/*
├─ components/          ui/ (kit), forms/ (varaqlar), trips/, screens/, Toast, LockScreen
├─ lib/                 supabase, security (biometriya), format, phone, permissions, export, tripPdf, updates, files
├─ store/               quarry.ts (zustand), derive.ts (getter‘lar), security.ts, cache.ts
└─ theme.ts             web bilan bir xil ranglar
```

## Eslatmalar

* Web ilovadagi demo rejim mobilga ko‘chirilmagan — mobil faqat haqiqiy Supabase bilan ishlaydi.
* Oxirgi yuklangan ma’lumot qurilmada keshlanadi (14 kun): internet uzilsa ham jurnallar ko‘rinadi; yangi yozuv
  kiritish uchun internet kerak.
