# Supabase migratsiyalar

`schema.sql` fayli katta. Uni maqsadga ko'ra alohida migratsiyalarga bo'ldik. Uni maqsadga ko'ra alohida migratsiyalarga bo'ldik.

**Har doim kerakli faylni alohida Run qiling** — bir butun faylni qayta ishlatish shart emas.

## Tartib (run order)
1. `01_core_rbac.sql` — jadval, RLS asoslari, permissions/roles seed, users bo'shliq.
2. `02_trips_transactions_monitoring.sql` — trips, transactions, monitoring ustunlari + indekslar.
3. `03_maintenance_views.sql` — maintenance, client_balances, financial_balances, prepare_trip.
4. `04_triggers_monitoring.sql` — trips_sync_cash_income, set_transaction_monitoring_default.
5. `05_categories_guards.sql` — transaction_categories, validate/guard trigger'lar.
6. `06_functions_rbac.sql` — has_permission (cascade drop), role_has_full_access, is_superadmin, sync_* trigger'lar, staff_directory, set_driver_rate, update_my_profile bog'liq funksiyalar.
7. `07_monitoring_rpcs.sql` — `set_trip_monitoring`, `set_expense_monitoring`, grant'lar.
8. `08_phone_profile.sql` — phone normalize/validate, update_my_profile, telefon CHECK'lari, save_role_permissions.
9. `09_policies_storage_realtime.sql` — RLS policy'lar, grants, storage bucket/policy'lar, realtime publication.
10. `10_trip_auto_approve.sql` — `trips.create` va `trips.auto_approve` ni ajratish.
11. `11_superadmin_grants_all.sql` — `roles.grants_all`: to'liq huquqli lavozim yangi ruxsat kalitlarini avtomatik oladi.
12. `12_transaction_edit_delete.sql` — kvitansiyani tahrirlash/o'chirish: `finance.transactions.edit`, `finance.transactions.delete` va `update_transaction` / `delete_transaction` RPC'lari.

## Alohida (mavjud bazaga) migratsiyalar
Baza allaqachon o'rnatilgan bo'lsa, butun fayllarni emas — **kerakli bitta faylni** Run qiling.

| Fayl | Nima uchun |
|---|---|
| `10_trip_auto_approve.sql` | Kiritish va tasdiqlashni ajratish: `trips.auto_approve` ruxsati. Reys monitoringga o'tmaydi, darhol tasdiqlangan bo'lib saqlanadi. |
| `11_superadmin_grants_all.sql` | **Muhim:** to'liq huquqli lavozim yangi ruxsatlarni avtomatik oladi. Bu migratsiyadan keyin yangi kalit qo'shilsa, superadmin o'ziga o'zi tiklashga majbur bo'lmaydi. |
| `12_transaction_edit_delete.sql` | Moliyada kvitansiyani tahrirlash va o'chirish (ruxsat bilan). Reysga bog'langan naqd savdo yozuvlari bu yerdan o'zgarmaydi. |
| `check-monitoring.sql` | Diagnostika (hech narsani o'zgartirmaydi, faqat o'qiydi). |
| `../grant-full-access.sql` | SUPER_ADMIN roli yaratish / to'liq huquqni tiklash. |
| `../clear-demo-data.sql` | Demo yozuvlarni tozalash. |

## Foydalanish
- Muammo yuz bergan joyga mos 1-2 ta faylni ishga tushiring (masalan, Monitoring RPC'lari o'zgarganda faqat `07_monitoring_rpcs.sql`).
- `schema.sql` — full dump (arxiv). Migratsiya fayllari — kundalik ishlatish uchun ajratilgan.

## Qoidalar
- Har bir fayl `IF NOT EXISTS` / `DROP IF EXISTS` ishlatadi (xavfsiz).
- Monitoring: `trips.monitoring_status` null bo'lsa, `02_*.sql` dagi UPDATE ularni `approved` qilib backfill qiladi (mavjud ma'lumotlar buzilmasligi uchun).
