-- Texnika ERP · demo va sinov ma’lumotlarini tozalash
-- Supabase SQL Editor’da ishga tushiring. Avval 1-qadamni (ko‘rish) bajarib, keyin 2-qadamni
-- (o‘chirish) ishga tushiring.
--
-- 2-qadam barcha operatsion yozuvlarni o‘chiradi. Agar bazada haqiqiy ma’lumot bo‘lsa, uni avval
-- zaxiralang: `create table backup_trips as select * from public.trips;` va h.k.

-- ── 1-qadam: hozirgi holat (hech narsa o‘chirilmaydi) ────────────────────────
select 'clients' as jadval, count(*) as yozuvlar, null::timestamptz as birinchi, null::timestamptz as oxirgi from public.clients
union all select 'vehicles', count(*), null, null from public.vehicles
union all select 'trips', count(*), min(created_at), max(created_at) from public.trips
union all select 'transactions', count(*), min(created_at), max(created_at) from public.transactions
union all select 'maintenance_reports', count(*), min(created_at), max(created_at) from public.maintenance_reports
union all select 'users', count(*), min(created_at), max(created_at) from public.users
union all select 'trip-photos (storage)', count(*), min(created_at), max(created_at) from storage.objects where bucket_id = 'trip-photos';

-- Xodimlar ro‘yxati: bu yozuvlar saqlanadi, chunki ular auth.users bilan bog‘langan.
select u.id, u.full_name, u.email, u.is_active, r.name as lavozim
from public.users u
left join public.roles r on r.id = u.role_id
order by u.full_name;

-- ── 2-qadam: o‘chirish ───────────────────────────────────────────────────────
-- O‘chiriladi: moliya jurnali, nosozlik xabarlari, reyslar, texnikalar, mijozlar.
-- Saqlanadi: lavozimlar, ruxsatlar, mahsulot narxlari, foydalanuvchi profillari.
begin;

delete from public.transactions;
delete from public.maintenance_reports;
delete from public.trips;
delete from public.vehicles;
delete from public.clients;

commit;

-- Nazorat: barcha jadvallar bo‘sh bo‘lishi kerak.
select 'clients' as jadval, count(*) as yozuvlar from public.clients
union all select 'vehicles', count(*) from public.vehicles
union all select 'trips', count(*) from public.trips
union all select 'transactions', count(*) from public.transactions
union all select 'maintenance_reports', count(*) from public.maintenance_reports;

-- ── 3-qadam (ixtiyoriy): eski yuk suratlari ──────────────────────────────────
-- Supabase storage jadvalidan to‘g‘ridan-to‘g‘ri o‘chirishga yo‘l qo‘ymaydi
-- (ERROR 42501: Direct deletion from storage tables is not allowed), shuning uchun
-- Storage API orqali o‘chiriladi: Dashboard → Storage → trip-photos →
-- barcha fayllarni belgilab → Delete. Bu rasm endi hech qanday reysga bog‘lanmagan.
--
-- Agar suratlar kerak bo‘lmasa, ularni o‘chiring; aks holda o‘tib ketishingiz mumkin.

-- ── Ixtiyoriy: betartib qilingan xodim profilini butunlay o‘chirish ──────────
-- public.users auth.users bilan bog‘langan, shuning uchun auth.users dan o‘chiriladi (cascade).
-- Buni alohida, keyinroq ishga tushiring — hozir jamoangizga tegmang.
--
-- delete from auth.users where id = 'BU-YERGA-XODIM-UUID';
