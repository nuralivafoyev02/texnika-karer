-- Texnika ERP · Supabase / PostgreSQL schema
-- Run this file once in Supabase SQL Editor (project owner).
-- Authentication identities live in auth.users; public.users stores their ERP profile.

create extension if not exists pgcrypto;

-- ── Core identity and dynamic RBAC ────────────────────────────────────────
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  is_system boolean not null default false,
  -- "Barcha ruxsatlar avtomatik" belgisi. To'liq huquqli (superadmin) lavozim shunday
  -- belgilansa, serverga yangi ruxsat kaliti qo'shilganda u shu roliga avtomatik
  -- beriladi va xodim superadminligini yo'qotmaydi. Aks holda "barcha kalit bor"
  -- qoidasi yangi kalit qo'shilishi bilan buzilardi.
  grants_all boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  group_name text not null,
  description text not null default ''
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  login text,
  phone text,
  title text,
  role_id uuid not null references public.roles(id) on delete restrict,
  driver_rate_per_trip numeric(14,2) not null default 0 check (driver_rate_per_trip >= 0),
  is_active boolean not null default true,
  is_superadmin boolean not null default false,
  password_changed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists users_role_id_idx on public.users(role_id);

-- Logins: created by the superadmin at the moment a staff member is added. Supabase Auth
-- credentials are never created from the client; the server-side create-staff Edge Function
-- hashes the password (bcrypt) and stores only that hash.
alter table public.users add column if not exists login text;
alter table public.users add column if not exists is_superadmin boolean not null default false;
alter table public.users add column if not exists password_changed_at timestamptz;
-- Profil rasmi: storage'da 'avatars/<user_id>/<fayl>' ko'rinishida saqlanadi, bu jadvalda
-- faqat yo'l saqlanadi. O'zgartirish faqat `update_my_profile` RPC orqali (o'z profiliga).
alter table public.users add column if not exists avatar_path text;
update public.users set login = lower(regexp_replace(coalesce(split_part(email, '@', 1), ''), '[^a-z0-9._-]', '', 'g'))
where login is null or login = '';
-- Har qanday eski qiymat formatga mos kelmasa, uni o'qiladigan zaxira loginga almashtiramiz,
-- shunda keyingi CHECK/UNIQUE/NOT NULL qatlamlari hech qachon to'xtab qolmaydi.
update public.users set login = 'xodim_' || left(id::text, 8)
where login is null or login = '' or login !~ '^[a-z0-9][a-z0-9._-]{2,31}$';
update public.users u set login = 'xodim_' || left(u.id::text, 8)
where u.id in (
  select id from (
    select id, row_number() over (partition by login order by created_at, id) as rn from public.users
  ) ranked where ranked.rn > 1
);
alter table public.users drop constraint if exists users_login_format;
alter table public.users add constraint users_login_format check (login ~ '^[a-z0-9][a-z0-9._-]{2,31}$');
create unique index if not exists users_login_key on public.users(login) where login is not null;
-- ── Superadmin = to'liq dostup ──────────────────────────────────────────────
-- Eski cheklov: `users_single_superadmin` unique indeksi faqat BITTA superadmin'ga ruxsat berardi,
-- shuning uchun "Boshliq" lavozimini olgan yangi xodim ham boshqaruvga chiqmay qolardi.
-- Endi to'g'ri qoida: lavozimdagi barcha ruxsat kalitlari bor bo'lsa, xodim superadmin hisoblanadi
-- (role_has_full_access, quyida) va superadminlar soni cheklanmaydi.
drop index if exists public.users_single_superadmin;

-- Eski "taklif xati" oqimi qo'ygan auth trigger'lari profilni o'zlari yaratardi va
-- role_id (not null) tufayli har bir yangi xodim yaratilishini "Database error saving new user"
-- bilan buzardi. Endi profil faqat Edge Function tomonidan yoziladi.
drop trigger if exists on_auth_user_created on auth.users;
do $$
declare
  trigger_name text;
begin
  for trigger_name in
    select tg.tgname from pg_trigger tg
    where tg.tgrelid = 'auth.users'::regclass and not tg.tgisinternal and tg.tgname <> 'on_auth_user_created'
  loop
    execute format('drop trigger if exists %I on auth.users', trigger_name);
  end loop;
end $$;
drop function if exists public.handle_new_user() cascade;

-- Login har bir xodim uchun majburiy: "siz" ro'yxatga o'tkazilgan bo'lishi kerak.
alter table public.users alter column login set not null;

-- Permissions are stable machine keys; role-to-permission membership is dynamic.
insert into public.permissions (key, label, group_name, description) values
  ('dashboard.view', 'Dashboardni ko‘rish', 'Umumiy', 'Kunlik svotka va monitoring ko‘rsatkichlari'),
  ('trips.view', 'Reyslarni ko‘rish', 'Karer', 'Barcha reyslar jurnali va yuklar tarixi'),
  ('trips.create', 'Yangi reys kiritish', 'Karer', 'Tarozi orqali yangi reysni kiritish — reys monitoring tasdiqlashiga yuboriladi'),
  ('trips.auto_approve', 'Yangi reysni avtomatik tasdiqlash', 'Karer', 'Kiritilgan reys monitoring bo‘limiga o‘tmasdan, darhol tasdiqlangan holda saqlanadi'),
  ('materials.prices.view', 'Mahsulot narxlarini ko‘rish', 'Karer', 'Tonna narxi va reys summasini ko‘rish (haydovchilar ko‘rmaydi)'),
  ('monitoring.view', 'Monitoringni ko‘rish', 'Monitoring', 'Tasdiqlash kutilayotgan reys va xarajatlarni ko‘rish'),
  ('monitoring.approve', 'Reyslarni tasdiqlash', 'Monitoring', 'Reyslar va xarajatlarni tasdiqlash yoki tasdiqlashni bekor qilish'),
  ('clients.view', 'Mijozlarni ko‘rish', 'Mijozlar', 'Mijozlar ro‘yxati va balanslari'),
  ('clients.manage', 'Mijoz qo‘shish / tahrirlash', 'Mijozlar', 'Mijoz ma’lumotlarini boshqarish'),
  ('fleet.view', 'Texnikalarni ko‘rish', 'Texnika', 'Samosvallar holati va ishlash ko‘rsatkichlari'),
  ('fleet.manage', 'Texnika holatini boshqarish', 'Texnika', 'Servis va ta’mir holatiga o‘tkazish'),
  ('finance.view', 'Moliyani ko‘rish', 'Moliya', 'Kassa, bank, kirim-chiqim jurnali'),
  ('finance.payments.create', 'Mijoz to‘lovini kiritish', 'Moliya', 'Naqd yoki bank orqali kirim yozish'),
  ('finance.expenses.create', 'Xarajat kiritish', 'Moliya', 'Karer xarajatlari va ish haqi to‘lovi'),
  ('payroll.manage', 'Oylik va stavkani boshqarish', 'Xodimlar', 'Reys stavkasi va haydovchi avanslari'),
  ('staff.view', 'Xodimlarni ko‘rish', 'Xodimlar', 'Xodimlar va haydovchilar ro‘yxati'),
  ('staff.manage', 'Xodim qo‘shish', 'Xodimlar', 'Xodim qo‘shish va login/parol berish (faqat to‘liq huquqli — superadmin)'),
  ('roles.manage', 'Lavozim va ruxsatlarni sozlash', 'Sozlamalar', 'Dinamik RBAC lavozimlari va huquqlari (faqat to‘liq huquqli — superadmin)'),
  ('materials.create', 'Mahsulot qo‘shish', 'Sozlamalar', 'Yangi tosh turi va tonna narxini kiritish'),
  ('materials.manage', 'Mahsulotlarni boshqarish', 'Sozlamalar', 'Mahsulot narxi, faolligi va o‘chirish (qo‘shishdan tashqari)'),
  ('finance.categories.create', 'Moliya turi qo‘shish', 'Sozlamalar', 'Yangi daromat yoki xarajat turini yaratish'),
  ('finance.manage', 'Moliya turlarini boshqarish', 'Sozlamalar', 'Moliya turlarini tahrirlash va o‘chirish (qo‘shishdan tashqari)'),
  ('driver.self', 'Shaxsiy haydovchi kabineti', 'Haydovchi', 'Faqat o‘z reyslari, maoshi va xabarlari'),
  ('maintenance.report', 'Nosozlik haqida xabar berish', 'Texnika', 'Texnika bo‘yicha tezkor xabar yuborish')
on conflict (key) do update set label = excluded.label, group_name = excluded.group_name, description = excluded.description;

insert into public.roles (name, description, is_system, grants_all) values
  ('Boshliq', 'Barcha bo‘limlar va tizim sozlamalari', true, true),
  ('Buxgalter', 'Moliya, mijozlar va ish haqi hisobi', true, false),
  ('Tarozi ustasi', 'Reyslarni ro‘yxatga olish', true, false),
  ('Haydovchi', 'Faqat o‘z ish faoliyati va xabarlari', true, false)
on conflict (name) do update set description = excluded.description, is_system = true, grants_all = excluded.grants_all;

-- "Boshliq" — to'liq huquqli lavozim: katalogdagi barcha kalitlar beriladi.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p where r.name = 'Boshliq'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = any(array[
  'dashboard.view','trips.view','clients.view','clients.manage','fleet.view','finance.view',
  'finance.payments.create','finance.expenses.create','finance.manage','payroll.manage','staff.view','maintenance.report'
]) where r.name = 'Buxgalter'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = any(array[
  'trips.view','trips.create','fleet.view'
]) where r.name = 'Tarozi ustasi'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = any(array[
  'driver.self','maintenance.report'
]) where r.name = 'Haydovchi'
on conflict do nothing;
