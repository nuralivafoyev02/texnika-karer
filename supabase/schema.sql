-- ══════════ 01_core_rbac ══════════

-- Texnika ERP · Supabase / PostgreSQL schema
-- Run this file once in Supabase SQL Editor (project owner).
-- Bu fayl supabase/migrations/01..09 dan yig'ilgan. Yangi ruxsat kaliti qo'shilsa,
-- to'liq huquqli lavozim uni avtomatik oladi (roles.grants_all + trigger).
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

-- ══════════ 02_trips_transactions_monitoring ══════════

-- ── Quarry operations ─────────────────────────────────────────────────────
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  opening_balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists clients_name_idx on public.clients(name);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit_price numeric(14,2) not null check (unit_price > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.materials (name, unit_price) values
  ('Yirik tosh', 95000), ('Sheben', 120000), ('Qum', 68000)
on conflict (name) do nothing;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique,
  model text not null,
  driver_id uuid references public.users(id) on delete set null,
  status text not null default 'active' check (status in ('active','service','repair')),
  year integer check (year is null or year between 1950 and 2100),
  created_at timestamptz not null default now()
);
create index if not exists vehicles_driver_id_idx on public.vehicles(driver_id);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  driver_id uuid not null references public.users(id) on delete restrict,
  client_id uuid references public.clients(id) on delete restrict,
  material_id uuid not null references public.materials(id) on delete restrict,
  weight_tons numeric(12,3) not null check (weight_tons > 0),
  unit_price numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  sale_type text not null check (sale_type in ('cash','credit')),
  hours_worked numeric(8,2) not null default 0 check (hours_worked >= 0),
  photo_path text,
  note text,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint trip_sale_client_check check (
    -- Hisobga savdo: mijoz majburiy. Naqd savdo: mijoz ixtiyoriy —
    -- yuk kimka tashilganini qayd qilish uchun tanlanadi va balansga ta'sir qilmaydi.
    (sale_type = 'credit' and client_id is not null) or (sale_type = 'cash')
  )
);
-- `create table if not exists` mavjud bazani yangimaydi — shu satrlar eski
-- bazalarni ham shu fayl qayta ishga tushirilganda yangilaydi.
alter table public.trips add column if not exists note text;
-- ── Monitoring: reys va xarajat tasdiqlanmaguncha moliyaviy hisobga kiritilmaydi ──
-- Reys yaratilgach 'pending' bo'ladi; monitoring bo'limidan tasdiqlanganda 'approved'
-- bo'ladi va shu zahoti naqd savdo kassaga yoziladi hamda mijoz balansiga ta'sir qiladi.
alter table public.trips add column if not exists monitoring_status text;
alter table public.trips add column if not exists monitored_by uuid references public.users(id) on delete set null;
alter table public.trips add column if not exists monitored_at timestamptz;
alter table public.trips add column if not exists monitoring_note text;
-- Eski reyslar allaqachon ishga tushgan edi — ularni "kutilmoqda"ga qaytarib qo'yib,
-- butun tarixni monitoring navbatiga tushirishdan saqlanamyiz.
update public.trips set monitoring_status = 'approved', monitored_at = created_at
  where monitoring_status is null;
alter table public.trips alter column monitoring_status set default 'pending';
alter table public.trips alter column monitoring_status set not null;
alter table public.trips drop constraint if exists trips_monitoring_status_check;
alter table public.trips add constraint trips_monitoring_status_check check (monitoring_status in ('pending','approved'));
create index if not exists trips_monitoring_status_idx on public.trips(monitoring_status, created_at desc);
alter table public.trips drop constraint if exists trip_sale_client_check;
alter table public.trips add constraint trip_sale_client_check check (
  (sale_type = 'credit' and client_id is not null) or (sale_type = 'cash')
);
create index if not exists trips_created_at_idx on public.trips(created_at desc);
create index if not exists trips_driver_date_idx on public.trips(driver_id, created_at desc);
create index if not exists trips_client_date_idx on public.trips(client_id, created_at desc);
create index if not exists trips_vehicle_date_idx on public.trips(vehicle_id, created_at desc);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('in','out')),
  category text not null check (category in ('customer_payment','cash_sale','blasting','fuel','repair','salary','payroll','other')),
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash','bank')),
  client_id uuid references public.clients(id) on delete restrict,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  driver_id uuid references public.users(id) on delete set null,
  trip_id uuid references public.trips(id) on delete set null,
  note text,
  created_by uuid not null references public.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  constraint transaction_direction_category_check check (
    (direction = 'in' and category in ('customer_payment','cash_sale')) or
    (direction = 'out' and category in ('blasting','fuel','repair','salary','payroll','other'))
  ),
  constraint customer_payment_client_check check (category <> 'customer_payment' or client_id is not null),
  constraint payroll_driver_check check (category <> 'payroll' or driver_id is not null)
);
create index if not exists transactions_created_at_idx on public.transactions(created_at desc);
create index if not exists transactions_client_idx on public.transactions(client_id, created_at desc);
create index if not exists transactions_vehicle_idx on public.transactions(vehicle_id);
create index if not exists transactions_driver_idx on public.transactions(driver_id, created_at desc);

-- ── Monitoring (moliya): chiqimlar tasdiqlanmaguncha kassa va xarajatlarga tushmaydi ──
-- Faqat CHIQIM ('out') yozuvlar monitoringga keladi: mijoz to'lovi (kirim) darhol
-- hisobga olinadi. Kiritgan xodim monitoring_status'ni o'zi ko'ra olmaydi —
-- quyidagi trigger qiymatni serverda belgilaydi.
alter table public.transactions add column if not exists monitoring_status text;
alter table public.transactions add column if not exists monitored_by uuid references public.users(id) on delete set null;
alter table public.transactions add column if not exists monitored_at timestamptz;
alter table public.transactions add column if not exists monitoring_note text;
update public.transactions set monitoring_status = 'approved', monitored_at = created_at
  where monitoring_status is null;
alter table public.transactions alter column monitoring_status set default 'approved';
alter table public.transactions alter column monitoring_status set not null;
alter table public.transactions drop constraint if exists transactions_monitoring_status_check;
alter table public.transactions add constraint transactions_monitoring_status_check check (monitoring_status in ('pending','approved'));
create index if not exists transactions_monitoring_idx on public.transactions(monitoring_status, direction, created_at desc);

create table if not exists public.maintenance_reports (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  driver_id uuid not null references public.users(id) on delete restrict,
  description text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists maintenance_open_idx on public.maintenance_reports(status, created_at desc);

-- ══════════ 03_maintenance_views ══════════

-- A driver-submitted fault automatically removes the vehicle from dispatch until a manager reactivates it.
create or replace function public.flag_reported_vehicle_for_repair()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.vehicles set status = 'repair' where id = new.vehicle_id;
  return new;
end;
$$;
drop trigger if exists maintenance_flag_vehicle on public.maintenance_reports;
create trigger maintenance_flag_vehicle after insert on public.maintenance_reports
for each row execute function public.flag_reported_vehicle_for_repair();

-- Security-invoker views keep large ledgers accurate without downloading every row to the browser.
-- Ikkalasi ham faqat TASDIQLANGAN yozuvlarni hisobga oladi: monitoringdan o'tmagan reys
-- mijozga qarz yozmaydi, tasdiqlanmagan chiqim esa kassa qoldig'ini kamaytirmaydi.
create or replace view public.client_balances with (security_invoker = true) as
select c.id as client_id,
  c.opening_balance
  + coalesce((select sum(t.total_amount) from public.trips t where t.client_id = c.id and t.sale_type = 'credit' and t.monitoring_status = 'approved'), 0)
  - coalesce((select sum(tx.amount) from public.transactions tx where tx.client_id = c.id and tx.direction = 'in' and tx.category = 'customer_payment'), 0)
  as current_balance
from public.clients c;

create or replace view public.financial_balances with (security_invoker = true) as
select payment_method,
  coalesce(sum(case when direction = 'in' then amount else -amount end), 0) as current_balance
from public.transactions
where monitoring_status = 'approved'
group by payment_method;

-- Always calculate a trip's unit price and total on the server, then validate its assigned truck/driver.
create or replace function public.prepare_trip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_driver uuid;
  vehicle_status text;
  current_price numeric(14,2);
begin
  select v.driver_id, v.status into assigned_driver, vehicle_status
  from public.vehicles v where v.id = new.vehicle_id;
  if assigned_driver is null or assigned_driver <> new.driver_id then
    raise exception 'Tanlangan samosvalga ushbu haydovchi biriktirilmagan.' using errcode = '23514';
  end if;
  if vehicle_status <> 'active' then
    raise exception 'Servis yoki remontdagi texnikaga reys ochib bo‘lmaydi.' using errcode = '23514';
  end if;
  select m.unit_price into current_price from public.materials m where m.id = new.material_id and m.is_active = true;
  if current_price is null then
    raise exception 'Mahsulot mavjud emas yoki faol emas.' using errcode = '23514';
  end if;
  new.unit_price := current_price;
  new.total_amount := round(new.weight_tons * current_price, 2);
  -- Ikki xil kiritish bor:
  --   trips.create         → reys monitoring navbatiga tushadi ('pending'), balansga yozilmaydi.
  --   trips.auto_approve   → reys monitoringdan o'tmaydi, darhol tasdiqlangan ('approved')
  --                          bo'lib saqlanadi va balansga yoziladi.
  -- Kirituvchi monitoring_status'ni o'zi yubora olmaydi (INSERT grantida bu ustun yo'q):
  -- qaror serverda, kirituvchining ruxsati asosida qabul qilinadi. Monitoringdan keyin
  -- o'zgartirish esa faqat set_trip_monitoring() orqali (RPC) mumkin.
  if public.has_permission('trips.auto_approve') then
    new.monitoring_status := 'approved';
    new.monitored_by := auth.uid();
    new.monitored_at := now();
  else
    new.monitoring_status := 'pending';
    new.monitored_by := null;
    new.monitored_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trips_prepare_before_insert on public.trips;
create trigger trips_prepare_before_insert before insert on public.trips
  for each row execute function public.prepare_trip();

-- Naqd savdo reysi faqat TASDIQLANGANDAN keyin kassaga yoziladi. Monitoringdan
-- tasdiqlangan zahoti trigger yozuvni yaratadi, tasdiqlash bekor qilinganda esa
-- o'zi yaratgan yozuvni olib tashlaydi — shuning uchun kassa hech qachon
-- "tasdiqlanmagan" reys pulini ko'rsatmaydi. Idempotent: mavjud yozuv qayta
-- yaratilmaydi (trigger bir necha marta ishga tushsa ham).
create or replace function public.sync_trip_cash_income()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sale_type = 'cash' and new.monitoring_status = 'approved' then
    if not exists (
      select 1 from public.transactions tx
      where tx.trip_id = new.id and tx.category = 'cash_sale'
    ) then
      insert into public.transactions (direction, category, amount, payment_method, client_id, vehicle_id, trip_id, note, created_by, created_at)
      values ('in', 'cash_sale', new.total_amount, 'cash', new.client_id, new.vehicle_id, new.id, 'Naqd savdo · ' || new.id::text, new.created_by, new.created_at);
    end if;
  elsif new.monitoring_status = 'pending' then
    delete from public.transactions tx where tx.trip_id = new.id and tx.category = 'cash_sale';
  end if;
  return new;
end;
$$;

drop trigger if exists trips_sync_cash_income on public.trips;
create trigger trips_sync_cash_income after insert or update of monitoring_status on public.trips
  for each row execute function public.sync_trip_cash_income();

-- Eski sxema trigger'i: naqd savdo kassaga DARHOL yozilardi. Uni olib tashlash
-- shart — aks holda u yangi monitoring qoidasi bilan birga ishlab, tasdiqlanmagan
-- reys pulini kassaga kiritib yuborardi.
drop trigger if exists trips_record_cash_income on public.trips;
drop function if exists public.record_cash_trip_income();

-- Moliya yozuvlari: chiqim har doim monitoringga tushadi, kirim esa darhol hisobga olinadi.
-- Kirituvchi monitoring_status'ni yubora olmaydi (grantda bu ustun yo'q), shuning uchun
-- qiymat faqat shu trigger orqali qo'yiladi.
create or replace function public.set_transaction_monitoring_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.monitoring_status := case when new.direction = 'out' then 'pending' else 'approved' end;
  new.monitored_by := null;
  new.monitored_at := case when new.direction = 'out' then null else new.created_at end;
  return new;
end;
$$;

drop trigger if exists transactions_monitoring_default on public.transactions;
create trigger transactions_monitoring_default before insert on public.transactions
  for each row execute function public.set_transaction_monitoring_default();

-- ══════════ 04_triggers_monitoring ══════════

-- ── Moliya turlari (daromat / xarajat) ────────────────────────────────────
-- transactions.category endi qattiq ro'yxatga bog'lanmaydi: tur jadvali orqali
-- boshqariladi, validatsiya esa triggersiz (trigger orqali) bajariladi.
create table if not exists public.transaction_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  label text not null check (length(label) between 2 and 60),
  direction text not null check (direction in ('in','out')),
  hint text not null default '',
  needs_client boolean not null default false,
  needs_vehicle boolean not null default false,
  needs_driver boolean not null default false,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.transaction_categories (key, label, direction, hint, needs_client, needs_vehicle, needs_driver, is_system) values
  ('customer_payment', 'Mijoz to‘lovi', 'in',  'Kelgan to‘lov mijoz balansini kamaytiradi', true,  false, false, true),
  ('cash_sale',        'Naqd savdo',   'in',  'Reyssiz naqd savdo — kassaga tushadigan tushum', false, false, false, true),
  ('blasting',         'Portlatish ishlari', 'out', 'Ruxsatnoma, portlovchi modda, mutaxassis', false, false, false, true),
  ('fuel',             'Yoqilg‘i-moylash',   'out', 'Solyarka va moylash materiallari', false, true, false, true),
  ('repair',           'Texnika ta’miri',    'out', 'Ehtiyot qismlar va usta haqi', false, true, false, true),
  ('salary',           'Oyliklar',           'out', 'Smena va ma’muriyat ish haqi', false, false, false, true),
  ('payroll',          'Haydovchi avansi',   'out', 'Haydovchi hisob-kitobidan avans', false, false, true, true),
  ('other',            'Boshqa xarajat',     'out', 'Boshqa bo‘limlar uchun to‘lov', false, false, false, true)
on conflict (key) do update set
  label = excluded.label, direction = excluded.direction, hint = excluded.hint,
  needs_client = excluded.needs_client, needs_vehicle = excluded.needs_vehicle,
  needs_driver = excluded.needs_driver, is_system = true;

-- transactions jadvalidagi qattiq ro'yxatli CHECK'lar olib tashlanadi; ularni
-- validate_transaction_category() trigger'i almashtiradi.
alter table public.transactions drop constraint if exists transactions_category_check;
alter table public.transactions drop constraint if exists transaction_direction_category_check;
alter table public.transactions drop constraint if exists customer_payment_client_check;
alter table public.transactions drop constraint if exists payroll_driver_check;
-- drop ... if exists addimida bo'lishi shart: aks holda fayl ikkinchi marta ishga tushganda
-- 42710 "constraint ... already exists" xatosi chiqadi va skript to'xtaydi.

-- ══════════ 05_categories_guards ══════════

alter table public.transactions drop constraint if exists transactions_category_format_check;
alter table public.transactions add constraint transactions_category_format_check check (category ~ '^[a-z][a-z0-9_]{1,39}$');
-- O'zgaruvchan CHECK Postgres'da mumkin emas, shuning uchun trigger ishlatiladi.
create or replace function public.validate_transaction_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.transaction_categories;
begin
  select * into target from public.transaction_categories where key = new.category;
  if not found or not target.is_active then
    raise exception 'Moliya turi topilmadi yoki faol emas: %', new.category using errcode = '23514';
  end if;
  if target.direction <> new.direction then
    raise exception '“%” turi faqat % uchun ishlatiladi.', target.label,
      case when target.direction = 'in' then 'kirim' else 'chiqim' end using errcode = '23514';
  end if;
  if target.needs_client and new.client_id is null then
    raise exception '“%” turi uchun mijozni tanlash shart.', target.label using errcode = '23514';
  end if;
  if target.needs_driver and new.driver_id is null then
    raise exception '“%” turi uchun haydovchini tanlash shart.', target.label using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists transactions_validate_category on public.transactions;
create trigger transactions_validate_category before insert or update of category, direction, client_id, driver_id
on public.transactions for each row execute function public.validate_transaction_category();

-- ── Xavfsiz o‘chirish qoidalari ───────────────────────────────────────────
-- UI bu xabarlarni toast orqali ko‘rsatadi; qaror esa brauzerda emas, bazada
-- qabul qilinadi: RLS + trigger + foreign key restrict uch bosqichli himoya.

-- Mahsulot reyslarda ishlatilgan bo‘lsa o‘chirilmaydi.
create or replace function public.guard_material_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  used_count integer;
begin
  select count(*) into used_count from public.trips where material_id = old.id;
  if used_count > 0 then
    raise exception '“%” mahsuloti % ta reysda ishlatilgan — o‘chirib bo‘lmaydi.', old.name, used_count;
  end if;
  return old;
end;
$$;
drop trigger if exists materials_guard_delete on public.materials;
create trigger materials_guard_delete before delete on public.materials
for each row execute function public.guard_material_delete();

-- Moliya turlari: tizim turlari umuman, foydalanuvchi turlari esa amalda
-- ishlatilganda o‘chirilmaydi (transactions.category FK emas, shuning uchun
-- trigger himoyasi zarur).
create or replace function public.guard_transaction_category_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  used_count integer;
begin
  if old.is_system then
    raise exception '“%” — tizim turi, uni o‘chirib bo‘lmaydi.', old.label;
  end if;
  select count(*) into used_count from public.transactions where category = old.key;
  if used_count > 0 then
    raise exception '“%” turi % ta amalda ishlatilgan — o‘chirib bo‘lmaydi.', old.label, used_count;
  end if;
  return old;
end;
$$;
drop trigger if exists transaction_categories_guard_delete on public.transaction_categories;
create trigger transaction_categories_guard_delete before delete on public.transaction_categories
for each row execute function public.guard_transaction_category_delete();

-- Kalit (key) yozuvlarda ishlatilsa o‘zgartirilmaydi: aks holda eski reys va
-- to‘lovlar tarmoqsiz qoladi. Nom (label) va izoh esa erkin tahrirlanadi.
create or replace function public.guard_transaction_category_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  used_count integer;
begin
  if old.key is distinct from new.key then
    select count(*) into used_count from public.transactions where category = old.key;
    if used_count > 0 then
      raise exception '“%” turining kaliti % ta yozuvda ishlatilgan — kalitni o‘zgartirib bo‘lmaydi.', old.label, used_count;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists transaction_categories_guard_update on public.transaction_categories;
create trigger transaction_categories_guard_update before update on public.transaction_categories
for each row execute function public.guard_transaction_category_update();

-- ══════════ 06_functions_rbac ══════════

-- ── Dynamic permission check used by RLS and client-side navigation ────────
-- Earlier revisions declared the argument as p_code, and create or replace cannot rename an
-- argument (42P13). RLS policies hold a stored reference to the function, so they are dropped
-- first, otherwise the drop itself is rejected for having dependent objects.
drop function if exists public.set_driver_rate(uuid, numeric);

-- staff_directory view has_permission() ga bog'langan bo'lgani uchun uni funksiyadan
-- OLDIN olib tashlaymiz: aks holda "2BP01: other objects depend on it" xatosi chiqadi.
drop view if exists public.staff_directory;

do $$
declare
  fn_rec record;
  pol_rec record;
begin
  for fn_rec in
    select p.oid as fn_oid, p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'has_permission'
  loop
    for pol_rec in
      select distinct on (pol.oid)
             pol.oid as policy_oid,
             pol.polname as policy_name,
             quote_ident(rel_n.nspname) || '.' || quote_ident(rel_c.relname) as table_name
      from pg_depend d
      join pg_policy pol on pol.oid = d.objid
      join pg_class rel_c on rel_c.oid = pol.polrelid
      join pg_namespace rel_n on rel_n.oid = rel_c.relnamespace
      where d.classid = 'pg_policy'::regclass
        and d.refclassid = 'pg_proc'::regclass
        and d.refobjid = fn_rec.fn_oid
      order by pol.oid
    loop
      if exists (select 1 from pg_policy where oid = pol_rec.policy_oid) then
        execute format('drop policy if exists %I on %s', pol_rec.policy_name, pol_rec.table_name);
      end if;
    end loop;
    -- CASCADE: policy'lar yuqorida tozalangan, lekin view yoki boshqa funksiya ham
    -- bog'liq bo'lishi mumkin. Hammasi shu faylda darhol qayta yaratiladi.
    execute format('drop function %s cascade', fn_rec.signature);
  end loop;
end $$;

create or replace function public.has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    -- grants_all roliga yangi kalit avtomatik beriladi; bu shart trigger ishlamagan
    -- yoki kesh eskirgan holatda ham to'liq huquqni kafolatlaydi.
    where u.id = auth.uid() and u.is_active = true
      and (r.grants_all or exists (
        select 1 from public.role_permissions rp
        join public.permissions p on p.id = rp.permission_id
        where rp.role_id = u.role_id and p.key = p_key
      ))
  );
$$;

-- ── To'liq dostup = superadmin ──────────────────────────────────────────────
-- "Superadmin" — alohida belgilanadigan maxfiy lavozim emas, balki xodimning lavozimida
-- ruxsat katalogidagi BARCHA kalitlar mavjud bo'lgan holat. Shu tarzda xodim yaratilib
-- unga to'liq huquq berilganda u darhol boshqaruvga kiradi: xodim qo'shadi, login/parol
-- beradi, lavozim va ruxsatlarni boshqaradi. Superadminlar soni cheklanmaydi.
create or replace function public.role_has_full_access(p_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Katalog bo'sh bo'lsa hech kim to'liq dostubga ega emas (aksi holda trigger har yozuvni
  -- superadmin qilib qo'yardi). `grants_all` belgilangan lavozim esa doim to'liq huquqli.
  select coalesce((select r.grants_all from public.roles r where r.id = p_role_id), false)
     or (
       exists (select 1 from public.permissions)
       and not exists (
         select 1
         from public.permissions p
         where not exists (
           select 1 from public.role_permissions rp
           where rp.role_id = p_role_id and rp.permission_id = p.id
         )
       )
     );
$$;
revoke all on function public.role_has_full_access(uuid) from public;
grant execute on function public.role_has_full_access(uuid) to authenticated;

-- users.is_superadmin — saqlangan natija. Triggerlar uni lavozim ruxsatlari bilan sinxron qiladi,
-- shuning uchun "full dostup berildi" degani darhol ishlaydi. is_superadmin() esa ustunga
-- role_has_full_access() ni qo'shib, eski sxema qoldirilgan holatda ham to'g'ri javob beradi.
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.is_superadmin or public.role_has_full_access(u.role_id)
       from public.users u where u.id = auth.uid() and u.is_active),
    false
  );
$$;
revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to authenticated;

-- Xodim yaratilganda yoki lavozimi o'zgarganda full-dostub belgisini qayta hisoblaymiz.
create or replace function public.sync_user_superadmin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.is_superadmin := public.role_has_full_access(new.role_id);
  return new;
end;
$$;
drop trigger if exists users_sync_superadmin on public.users;
create trigger users_sync_superadmin
  before insert or update of role_id on public.users
  for each row execute function public.sync_user_superadmin();

-- Aksincha: lavozimga ruxsat qo'shilib/olib tashlansa, o'sha lavozimdagi xodimlarning
-- belgisi darhol yangilanadi — superadmin rolini faqat reload'da emas, o'sha zahoti yo'qolmaydi.
create or replace function public.sync_role_superadmins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role uuid;
  full_access boolean;
begin
  -- Muhim: PL/pgSQL'da INSERT trigger'ida OLD, DELETE trigger'ida NEW "not assigned"
  -- deb hisoblanadi — coalesce(new.role_id, old.role_id) yozsa bitta holatda ham xato beradi.
  -- Shuning uchun TG_OP orqali aniq ajratamiz.
  if tg_op = 'DELETE' then
    target_role := old.role_id;
  else
    target_role := new.role_id;
  end if;
  if target_role is null then return null; end if;
  full_access := public.role_has_full_access(target_role);
  update public.users u set is_superadmin = full_access
  where u.role_id = target_role and u.is_superadmin is distinct from full_access;
  return null;
end;
$$;
drop trigger if exists role_permissions_sync_superadmins on public.role_permissions;
create trigger role_permissions_sync_superadmins
  after insert or delete on public.role_permissions
  for each row execute function public.sync_role_superadmins();

-- Yangi ruxsat kaliti katalogga qo'shilganda uni `grants_all` lavozimlarga darhol beramiz.
-- Aynan shu trigger "superadmin yangi kalitni qo'lda o'ziga qo'shishi kerak" muammosini
-- ildizidan hal qiladi: endi yangi kalit qo'shilsa, to'liq huquqli lavozim o'z-o'zidan oladi.
create or replace function public.sync_permission_to_full_access_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.role_permissions (role_id, permission_id)
  select r.id, new.id from public.roles r where r.grants_all
  on conflict do nothing;
  return null;
end;
$$;
drop trigger if exists permissions_grant_full_access on public.permissions;
create trigger permissions_grant_full_access
  after insert on public.permissions
  for each row execute function public.sync_permission_to_full_access_roles();

-- Lavozim `grants_all` deb belgilansa (yoki yangi ruxsatlar qo'shilgan bo'lsa), mavjud
-- barcha kalitlarni darhol beramiz. Belgi olib tashlansa, ruxsatlar qoladi — ular
-- lavozimlar orqali qo'lda boshqariladi.
create or replace function public.sync_role_grants_all()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.grants_all then
    insert into public.role_permissions (role_id, permission_id)
    select new.id, p.id from public.permissions p
    on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists roles_sync_grants_all on public.roles;
create trigger roles_sync_grants_all
  after insert or update of grants_all on public.roles
  for each row execute function public.sync_role_grants_all();

-- Faqat superadmin lavozimning "barcha ruxsatlar avtomatik" belgisini boshqaradi.
create or replace function public.set_role_grants_all(p_role_id uuid, p_grants_all boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Ruxsat berilmagan: faqat superadmin lavozimlarni boshqaradi.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.roles where id = p_role_id) then
    raise exception 'Lavozim topilmadi.' using errcode = 'P0002';
  end if;
  if p_grants_all = false
     and exists (select 1 from public.users u where u.id = auth.uid() and u.role_id = p_role_id)
  then
    raise exception 'O‘z lavozimingizdan to‘liq huquqni olib tashlay olmaysiz.' using errcode = '42501';
  end if;
  update public.roles set grants_all = p_grants_all where id = p_role_id;
end;
$$;
revoke all on function public.set_role_grants_all(uuid, boolean) from public;
grant execute on function public.set_role_grants_all(uuid, boolean) to authenticated;

-- Xodimlar ro'yxati (ism, login, telefon, lavozim) — ismlar jamiada ko'rinishi uchun
-- ochiq, ammo reys stavkasi faqat o'z egasi va xodimlar bo'limiga ko'rinadi.
-- View ataylab security definer (standart) qilingan: public.users dagi RLS bu yerda
-- ishlamaydi, aynan shuning uchun faqat kerakli ustunlar chiqariladi.
-- is_superadmin — samaraviy qiymat (trigger ishlamagan holat uchun ham qayta hisoblanadi).
create or replace view public.staff_directory as
select u.id, u.login, u.full_name, u.email, u.phone, u.title, u.role_id, u.is_active,
  -- Profil rasmi faqat "staff.view" yoki superadmin uchun ochiq (boshqa xodimga kerak emas).
  case when u.id = auth.uid() or public.has_permission('staff.view') or public.is_superadmin()
    then u.avatar_path else null end as avatar_path,
  (u.is_superadmin or public.role_has_full_access(u.role_id)) as is_superadmin,
  case when u.id = auth.uid() or public.has_permission('staff.view') or public.is_superadmin()
    then u.driver_rate_per_trip else 0 end as driver_rate_per_trip
from public.users u
where u.is_active;
revoke all on public.staff_directory from anon;
grant select on public.staff_directory to authenticated;

-- Roles may be edited in the browser, but driver-rate changes are restricted to a checked RPC.
create or replace function public.set_driver_rate(p_user_id uuid, p_rate numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('payroll.manage') then
    raise exception 'Ruxsat berilmagan.' using errcode = '42501';
  end if;
  if p_rate is null or p_rate < 0 then
    raise exception 'Reys stavkasi manfiy yoki bo‘sh bo‘lishi mumkin emas.' using errcode = '22023';
  end if;
  update public.users u set driver_rate_per_trip = p_rate
  where u.id = p_user_id and exists (
    select 1 from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where rp.role_id = u.role_id and p.key = 'driver.self'
  );
  if not found then raise exception 'Haydovchi profili topilmadi.' using errcode = 'P0002'; end if;
end;
$$;

-- ══════════ 07_monitoring_rpcs ══════════

-- ── Monitoring: tasdiqlash / tasdiqlashni bekor qilish ──────────────────────
-- Ikki alohida RPC — ikkalasi ham `monitoring.approve` ruxsatini tekshiradi va
-- SECURITY DEFINER bilan ishlaydi, shuning uchun brauzer to'g'ridan-to'g'ri
-- monitoring_status ni o'zgartira olmaydi: uni faqat monitoring bo'limidagi
-- shu tugmalar o'zgartiradi. Narx/ta'sir (kassa yozuvi, mijoz balansi) triggerlar
-- orqali avtomatik qayta hisoblanadi.
create or replace function public.set_trip_monitoring(p_trip_id uuid, p_approved boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('monitoring.approve') then
    raise exception 'Tasdiqlash huquqi yo‘q.' using errcode = '42501';
  end if;
  update public.trips t set
    monitoring_status = case when p_approved then 'approved' else 'pending' end,
    monitored_by = auth.uid(),
    monitored_at = now(),
    monitoring_note = nullif(btrim(coalesce(p_note, '')), '')
  where t.id = p_trip_id;
  if not found then raise exception 'Reys topilmadi.' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.set_expense_monitoring(p_transaction_id uuid, p_approved boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('monitoring.approve') then
    raise exception 'Tasdiqlash huquqi yo‘q.' using errcode = '42501';
  end if;
  update public.transactions tx set
    monitoring_status = case when p_approved then 'approved' else 'pending' end,
    monitored_by = auth.uid(),
    monitored_at = now(),
    monitoring_note = nullif(btrim(coalesce(p_note, '')), '')
  where tx.id = p_transaction_id and tx.direction = 'out';
  if not found then raise exception 'Xarajat yozuvi topilmadi.' using errcode = 'P0002'; end if;
end;
$$;

-- ══════════ 08_phone_profile ══════════

-- ── Telefon raqami: bitta kanonik shakl ─────────────────────────────────────
-- Frontend har doim "+998 90 123 45 67" shaklida saqlaydi, lekin himoya serverda
-- bo'lishi kerak: Edge Function'lar service-role orqali yozadi, superadmin esa
-- `grant update` bilan to'g'ridan-to'g'ri yozadi — bular RPC tekshiruvidan o'tmaydi.
--
-- `format_phone_uz` — istalgan shakldan kiritilgan raqamni kanonik shaklga
--   keltiradi: "+998 90 123 45 67", "998901234567", "90 123 45 67" → bir xil
--   natija. Milliy qism 9 ta raqamdan oshsa kesiladi.
-- `phone_is_valid_uz` — bo'sh/null yoki to'liq 9 raqamli milliy qism (ruxsat etiladi).
create or replace function public.format_phone_uz(p_value text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_digits text;
  v_body   text;
begin
  v_digits := regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
  -- Boshdagi 998 — mamlakat kodi, faqat "+" bilan yozilgan bo'lsa yoki jami
  -- raqamlar 9 tadan ko'p bo'lsa (ya'ni to'liq xalqaro raqam).
  if v_digits like '998%' and (left(btrim(p_value), 1) = '+' or length(v_digits) > 9) then
    v_digits := substr(v_digits, 4);
  end if;
  v_body := substr(v_digits, 1, 9);
  if v_body = '' then
    return null;
  end if;
  return '+998 ' || rtrim(
    btrim(substr(v_body, 1, 2) || ' ' || substr(v_body, 3, 3) || ' ' || substr(v_body, 6, 2) || ' ' || substr(v_body, 8, 2))
  );
end;
$$;

create or replace function public.phone_is_valid_uz(p_value text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    case
      when p_value is null or btrim(p_value) = '' then true
      -- Kiritilgan raqamlar soni ham nazorat qilinadi: aks holda ortiqcha raqamlar
      -- jim kesilib ketardi va xato foydalanuvchiga ko'rinmasdi. Bu frontend va
      -- Edge Function bilan bir xil qoida.
      when length(regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g')) > 12 then false
      else public.format_phone_uz(p_value) is not null
        and length(regexp_replace(public.format_phone_uz(p_value), '[^0-9]', '', 'g')) = 12
    end;
$$;

comment on function public.format_phone_uz(text) is 'Telefon raqamini "+998 90 123 45 67" kanonik shakliga keltiradi (bo‘sh kiritilsa NULL qaytaradi).';
comment on function public.phone_is_valid_uz(text) is 'Telefon raqami bo‘sh yoki to‘liq o‘zbekiston raqami bo‘lsa true.';


-- ── O'z profilini tahrirlash ────────────────────────────────────────────────
-- Xodim ism-familiyasi, telefon raqami va profil rasmini O'ZIGA o'zgartira oladi.
-- Muhim: bu funksiya atama-fetat shu 3 ustunga yozadi — role_id, is_active va
-- driver_rate_per_trip ga tegilmaydi. Shu sabab xodim o'z lavozimini yoki faollik
-- holatini o'zgartirib tizimdan chiqib ketolmaydi (boshqa superadmin esa
-- `updateStaffProfile` orqali bemalol boshqaradi).
create or replace function public.update_my_profile(
  p_full_name text default null,
  p_phone text default null,
  p_avatar_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Ruxsat berilmagan.' using errcode = '42501';
  end if;
  if p_full_name is not null then
    if length(btrim(p_full_name)) < 2 then
      raise exception 'Ism-familiya kamida 2 ta belgidan iborat bo‘lishi kerak.' using errcode = '22023';
    end if;
    if length(btrim(p_full_name)) > 120 then
      raise exception 'Ism-familiya 120 ta belgidan oshmasligi kerak.' using errcode = '22023';
    end if;
  end if;
  if p_phone is not null and not public.phone_is_valid_uz(p_phone) then
    raise exception 'Telefon raqami noto‘g‘ri. Shakl: +998 90 123 45 67' using errcode = '22023';
  end if;
  -- Rasm faqat shaxsiy papkaga: boshqa xodimning rasmini o'z profiliga bog'lab olmaydi.
  if p_avatar_path is not null and p_avatar_path <> ''
     and p_avatar_path not like 'avatars/' || auth.uid()::text || '/%' then
    raise exception 'Rasm fayli shaxsiy papkaga joylashishi kerak.' using errcode = '42501';
  end if;

  update public.users u
     set full_name = coalesce(btrim(p_full_name), u.full_name),
         -- null = o'zgartirilmadi, bo'sh satr = o'chirildi, to'liq = kanonik shaklda saqlandi
         phone = case when p_phone is null then u.phone else public.format_phone_uz(p_phone) end,
         avatar_path = case
           when p_avatar_path is null then u.avatar_path
           when p_avatar_path = '' then null
           else p_avatar_path
         end
   where u.id = auth.uid();
  if not found then raise exception 'Profil topilmadi.' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.update_my_profile(text, text, text) from public;
grant execute on function public.update_my_profile(text, text, text) to authenticated;


-- ── Telefon raqami ustunlariga qat'iy tekshiruv ─────────────────────────────
-- Yuqoridagi RPC va `create-staff` Edge Function'ni himoya qiladi, lekin ular
-- majburiy yo'l emas: superadmin `grant update` orqali to'g'ridan-to'g'ri yozadi,
-- mijozlar esa umuman `insert` qiladi. Shu sabab CHECK constraint ham kerak.
--
-- 1) Avval eski yozuvlarni kanonik shaklga keltiramiz. `format_phone_uz`
--    idempotent bo'lgani uchun bu xavfsiz va takrorlangan shaklda ham xuddi
--    shunday natija beradi. To'liq bo'lmagan raqamlar (masalan "+998 90 12")
--    esa normalizatsiyadan keyin ham to'g'ri bo'lmaydi — ularni qo'lda
--    ko'rib chiqish kerak (pastdagi so'rov).
--
-- 2) `not valid` — mavcut qatorlar o'sha qadamda tekshirilmaydi, ya'ni bu
--    skript buzilgan ma'lumotni ham o'z-o'zidan o'chirmaydi. Lekin eslatma:
--    `not valid` constraint YANGILANAYOTGAN qatorga ham qo'llaniladi. Shu sabab
--    (1)-qadam bajarilmasdan constraint qo'shilsa, eski noto'g'ri raqamli xodimga
--    keyin ism-familiyani o'zgartirish ham xato berib qo'yadi.
update public.users set phone = public.format_phone_uz(phone)
 where phone is not null and btrim(phone) <> ''
   and public.format_phone_uz(phone) is distinct from phone;
update public.clients set phone = public.format_phone_uz(phone)
 where phone is not null and btrim(phone) <> ''
   and public.format_phone_uz(phone) is distinct from phone;

-- 3) Constraint qo'shilgandan keyin qolgan buzilgan qatorlarni topish:
--
--    select id, login, phone from public.users
--     where phone is not null and btrim(phone) <> '' and not public.phone_is_valid_uz(phone);
--    select id, name, phone from public.clients
--     where phone is not null and btrim(phone) <> '' and not public.phone_is_valid_uz(phone);
--
--    Ularni to'g'rilang (yoki null qilib tozalang) — keyin constraintni
--    tekshirishga yoqishingiz mumkin:
--    alter table public.users validate constraint users_phone_format_check;
--    alter table public.clients validate constraint clients_phone_format_check;
alter table public.users
  drop constraint if exists users_phone_format_check;
alter table public.users
  add constraint users_phone_format_check
  check (public.phone_is_valid_uz(phone)) not valid;

alter table public.clients
  drop constraint if exists clients_phone_format_check;
alter table public.clients
  add constraint clients_phone_format_check
  check (public.phone_is_valid_uz(phone)) not valid;


-- Role permissions are replaced in one transaction, only with keys the caller already holds (the
-- same subset rule the create-staff Edge Function applies) and never at the cost of the caller's
-- own roles.manage grant, so a single editor cannot lock every administrator out of the system.
create or replace function public.save_role_permissions(p_role_id uuid, p_permission_keys text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted text[] := coalesce(p_permission_keys, '{}'::text[]);
  rejected text[];
  role_grants_all boolean;
begin
  if not public.is_superadmin() then
    raise exception 'Ruxsat berilmagan: faqat superadmin lavozim va ruxsatlarni boshqaradi.' using errcode = '42501';
  end if;
  select grants_all into role_grants_all from public.roles where id = p_role_id;
  if not found then
    raise exception 'Lavozim topilmadi.' using errcode = 'P0002';
  end if;
  -- "Barcha ruxsatlar avtomatik" lavozimda kalitni olib tashlab bo'lmaydi: aks holda
  -- u yangi kalitlarni olsa ham eski kalitlardan ayrilib, to'liq huquqdan chiqib ketardi.
  if role_grants_all then
    select array_agg(p.key) into rejected
    from public.permissions p where not (p.key = any (wanted));
    if rejected is not null then
      raise exception 'Bu lavozim «barcha ruxsatlar avtomatik» — undan ruxsat olib tashlab bo‘lmaydi.' using errcode = '42501';
    end if;
    return;
  end if;
  select array_agg(requested.key) into rejected
  from unnest(wanted) as requested(key)
  where not exists (select 1 from public.permissions p where p.key = requested.key);
  if rejected is not null then
    raise exception 'Noma’lum ruxsat kaliti: %', rejected using errcode = '22023';
  end if;
  -- Superadmin o'z lavozimi orqali kirish huquqini yo'qotmasin: o'ziga tegishli
  -- ruxsatlarni olib tashlash taqiqlanadi, qo'shish esa mumkin.
  if exists (select 1 from public.users u where u.id = auth.uid() and u.role_id = p_role_id and u.is_superadmin) then
    select array_agg(owned.key) into rejected
    from public.role_permissions rp
    join public.permissions owned on owned.id = rp.permission_id
    where rp.role_id = p_role_id and not (owned.key = any (wanted));
    if rejected is not null then
      raise exception 'O‘z lavozimingizdagi ruxsatlarni olib tashlash mumkin emas: %', rejected using errcode = '42501';
    end if;
  end if;

  delete from public.role_permissions
  where role_id = p_role_id
    and permission_id not in (select p.id from public.permissions p where p.key = any (wanted));

  insert into public.role_permissions (role_id, permission_id)
  select p_role_id, p.id from public.permissions p where p.key = any (wanted)
  on conflict do nothing;
end;
$$;


-- Function referenced above must exist before the rate RPC is called at runtime.
revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;
revoke all on function public.save_role_permissions(uuid, text[]) from public;
grant execute on function public.save_role_permissions(uuid, text[]) to authenticated;
revoke all on function public.set_driver_rate(uuid, numeric) from public;
grant execute on function public.set_driver_rate(uuid, numeric) to authenticated;
revoke all on function public.set_trip_monitoring(uuid, boolean, text) from public;
grant execute on function public.set_trip_monitoring(uuid, boolean, text) to authenticated;
revoke all on function public.set_expense_monitoring(uuid, boolean, text) from public;
grant execute on function public.set_expense_monitoring(uuid, boolean, text) to authenticated;

-- ══════════ 09_policies_storage_realtime ══════════

-- ── Row-level security ────────────────────────────────────────────────────
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.materials enable row level security;
alter table public.vehicles enable row level security;
alter table public.trips enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_categories enable row level security;
alter table public.maintenance_reports enable row level security;

-- Role catalog is visible to signed-in staff so the UI can resolve their own permissions.
drop policy if exists roles_read_authenticated on public.roles;
create policy roles_read_authenticated on public.roles for select to authenticated using (true);
-- To'liq huquqga ega (superadmin) xodim lavozim va ruxsatlarni boshqaradi. Boshqa hech kim,
-- roli qanchalik kuchli bo'lmasin — chunki is_superadmin() aynan "barcha ruxsatlarga ega" holatni tekshiradi.
drop policy if exists roles_insert_manage on public.roles;
create policy roles_insert_manage on public.roles for insert to authenticated with check (public.is_superadmin() and is_system = false);
drop policy if exists roles_update_manage on public.roles;
create policy roles_update_manage on public.roles for update to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists roles_delete_custom on public.roles;
create policy roles_delete_custom on public.roles for delete to authenticated using (public.is_superadmin() and is_system = false);

drop policy if exists permissions_read_authenticated on public.permissions;
create policy permissions_read_authenticated on public.permissions for select to authenticated using (true);
drop policy if exists role_permissions_read_authenticated on public.role_permissions;
create policy role_permissions_read_authenticated on public.role_permissions for select to authenticated using (true);
-- Writes go exclusively through save_role_permissions(), which applies the subset rule atomically.
drop policy if exists role_permissions_manage on public.role_permissions;

drop policy if exists users_read_self_or_staff on public.users;
create policy users_read_self_or_staff on public.users for select to authenticated using (id = auth.uid() or public.has_permission('staff.view') or public.is_superadmin());
-- Staff accounts are created only in the server-side create-staff Edge Function (it owns the
-- auth credential), and profile edits belong to the superadmin.
drop policy if exists users_update_staff on public.users;
create policy users_update_staff on public.users for update to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

-- A scale operator also needs customer and truck names to create a trip.
drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients for select to authenticated using (public.has_permission('clients.view') or public.has_permission('clients.manage') or public.has_permission('trips.create') or public.has_permission('dashboard.view'));
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated with check (public.has_permission('clients.manage'));
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated using (public.has_permission('clients.manage')) with check (public.has_permission('clients.manage'));

drop policy if exists materials_read on public.materials;
create policy materials_read on public.materials for select to authenticated using (true);
drop policy if exists materials_update on public.materials;
create policy materials_update on public.materials for update to authenticated using (public.has_permission('materials.manage')) with check (public.has_permission('materials.manage'));
-- Mahsulot qo'shish — alohida materials.create ruxsati bilan. Superadmin yoki boshqaruvchi
-- kabi to'liq manage huquqiga egalar ham shu siyosat orqali qo'sha oladi.
drop policy if exists materials_insert_manage on public.materials;
create policy materials_insert_manage on public.materials for insert to authenticated
  with check (public.has_permission('materials.manage') or public.has_permission('materials.create'));
-- Mahsulotni o'chirish faqat undan foydalanilmagan bo'lsa mumkin: trips.material_id
-- "on delete restrict" bilan bog'langan, shuning uchun DB ham bloklaydi.
drop policy if exists materials_delete_manage on public.materials;
create policy materials_delete_manage on public.materials for delete to authenticated using (public.has_permission('materials.manage'));

drop policy if exists transaction_categories_read on public.transaction_categories;
create policy transaction_categories_read on public.transaction_categories for select to authenticated using (
  public.has_permission('finance.view') or public.has_permission('finance.manage') or
  public.has_permission('finance.categories.create') or
  public.has_permission('finance.payments.create') or
  public.has_permission('finance.expenses.create') or public.has_permission('dashboard.view')
);
-- Tahrirlash va o'chirish faqat finance.manage egalarida. Yangi tur yaratish esa
-- finance.categories.create ruxsati bilan ham mumkin — shu bilan "faqat kiritish" vazifasi
-- berilgan xodim superadminga murojaat qilmasdan o'z turini yarata oladi.
drop policy if exists transaction_categories_manage on public.transaction_categories;
create policy transaction_categories_manage on public.transaction_categories for all to authenticated
  using (public.has_permission('finance.manage')) with check (public.has_permission('finance.manage'));
drop policy if exists transaction_categories_insert on public.transaction_categories;
create policy transaction_categories_insert on public.transaction_categories for insert to authenticated
  with check (public.has_permission('finance.manage') or public.has_permission('finance.categories.create'));

drop policy if exists vehicles_read on public.vehicles;
create policy vehicles_read on public.vehicles for select to authenticated using (
  public.has_permission('fleet.view') or public.has_permission('trips.create') or
  (public.has_permission('driver.self') and driver_id = auth.uid()) or public.has_permission('dashboard.view')
);
drop policy if exists vehicles_update_status on public.vehicles;
create policy vehicles_update_status on public.vehicles for update to authenticated using (public.has_permission('fleet.manage')) with check (public.has_permission('fleet.manage'));
-- Texnika qo'shish: faqat boshqaruvchi roli. Haydovchi maydoni users jadvaliga FK bilan
-- bog'langan, shuning uchun RLS allaqachon mavjud xodimni tekshiradi.
drop policy if exists vehicles_insert_manage on public.vehicles;
create policy vehicles_insert_manage on public.vehicles for insert to authenticated with check (public.has_permission('fleet.manage'));

-- Managers see operational data; drivers see only their assigned trip rows.
-- monitoring.view / monitoring.approve egalari reyslarni Monitoring bo'limida
-- ko'rish (va tasdiqlash) uchun kirishadi.
drop policy if exists trips_read on public.trips;
create policy trips_read on public.trips for select to authenticated using (
  public.has_permission('trips.view') or public.has_permission('clients.view') or public.has_permission('dashboard.view') or
  public.has_permission('monitoring.view') or public.has_permission('monitoring.approve') or
  (public.has_permission('trips.create') and created_by = auth.uid()) or
  (public.has_permission('driver.self') and (driver_id = auth.uid() or created_by = auth.uid()))
);
drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips for insert to authenticated with check (
  public.has_permission('trips.create') and created_by = auth.uid() and
  exists (select 1 from public.vehicles v where v.id = vehicle_id and v.driver_id = driver_id and v.status = 'active')
);
-- Only the photo path may be changed after the initial insert (the app uploads after creating the trip row).
-- Monitoring holati esa faqat set_trip_monitoring() orqali o'zgaradi — bu policy
-- monitoring_status ustuniga grant yo'qligi bilan ham himoyalangan.
drop policy if exists trips_attach_photo on public.trips;
create policy trips_attach_photo on public.trips for update to authenticated
  using (public.has_permission('trips.create') and created_by = auth.uid())
  with check (public.has_permission('trips.create') and created_by = auth.uid());

-- Cashier users cannot create arbitrary income/expense categories.
-- monitoring.view / monitoring.approve egalari Monitoring bo'limi uchun chiqimlarni
-- ko'ra (va tasdiqla) oladi.
drop policy if exists transactions_read on public.transactions;
create policy transactions_read on public.transactions for select to authenticated using (
  public.has_permission('finance.view') or public.has_permission('dashboard.view') or
  public.has_permission('monitoring.view') or public.has_permission('monitoring.approve') or
  (public.has_permission('clients.view') and category = 'customer_payment' and client_id is not null) or
  ((public.has_permission('finance.payments.create') or public.has_permission('finance.expenses.create')) and created_by = auth.uid()) or
  (public.has_permission('driver.self') and (driver_id = auth.uid() or created_by = auth.uid()))
);
-- Faqat faol va yo‘nalishiga mos turlar kiritiladi. Yangi daromat/xarajat turlari
-- Sozlamalar → Moliya bo‘limida yaratilgach shu yerda avtomatik qo‘llanadi;
-- tizim ichidagi “Naqd savdo” esa trigger orqali yozilgani uchun qo‘lda kiritilmaydi.
drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions for insert to authenticated with check (
  created_by = auth.uid() and (
    (direction = 'in' and public.has_permission('finance.payments.create') and exists (
      select 1 from public.transaction_categories tc
      where tc.key = category and tc.direction = 'in' and tc.is_active
        and (tc.key = 'customer_payment' or not tc.is_system)
        and (not tc.needs_client or client_id is not null)
    )) or
    (direction = 'out' and public.has_permission('finance.expenses.create') and exists (
      select 1 from public.transaction_categories tc
      where tc.key = category and tc.direction = 'out' and tc.is_active
        and (not tc.needs_driver or driver_id is not null)
    ))
  )
);

-- Drivers can submit only their own alert; managers/buxgalter can review and close reports.
drop policy if exists maintenance_reports_read on public.maintenance_reports;
create policy maintenance_reports_read on public.maintenance_reports for select to authenticated using (
  public.has_permission('dashboard.view') or public.has_permission('finance.view') or public.has_permission('fleet.manage') or
  (public.has_permission('driver.self') and driver_id = auth.uid())
);
drop policy if exists maintenance_reports_insert_driver on public.maintenance_reports;
create policy maintenance_reports_insert_driver on public.maintenance_reports for insert to authenticated with check (
  public.has_permission('maintenance.report') and public.has_permission('driver.self') and driver_id = auth.uid() and status = 'open' and
  exists (select 1 from public.vehicles v where v.id = vehicle_id and v.driver_id = auth.uid())
);
drop policy if exists maintenance_reports_update_manager on public.maintenance_reports;
create policy maintenance_reports_update_manager on public.maintenance_reports for update to authenticated using (public.has_permission('fleet.manage')) with check (public.has_permission('fleet.manage'));

-- ── Storage: profile avatars ──────────────────────────────────────────────
-- Har bir xodimning rasmi aniq o'z papkasida saqlanadi: avatars/<user_id>/<fayl>.
-- Bu shart siyosatlarda ham, `update_my_profile` RPC'sida ham tekshiriladi — shuning uchun
-- bir xodim boshqasining rasmini o'z profiliga bog'lab ololmaydi.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

-- ── Storage: private trip photos ──────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-photos', 'trip-photos', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists trip_photos_read on storage.objects;
create policy trip_photos_read on storage.objects for select to authenticated using (
  bucket_id = 'trip-photos' and (
    public.has_permission('trips.view') or public.has_permission('clients.view') or public.has_permission('dashboard.view') or
    exists (select 1 from public.trips t where t.id::text = (storage.foldername(name))[1] and (t.driver_id = auth.uid() or t.created_by = auth.uid()))
  )
);
drop policy if exists trip_photos_insert on storage.objects;
create policy trip_photos_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'trip-photos' and public.has_permission('trips.create') and
  exists (select 1 from public.trips t where t.id::text = (storage.foldername(name))[1] and t.created_by = auth.uid())
);

-- The browser uses only the Supabase anon/publishable key. RLS remains the security boundary.
grant usage on schema public to authenticated;
grant select on public.roles, public.permissions, public.role_permissions to authenticated;
grant insert, update, delete on public.roles to authenticated;
revoke insert, update, delete on public.role_permissions from authenticated;
grant select on public.users to authenticated;
-- Profil tahrirlash (ism, telefon, bo'lim, lavozim, holat) faqat users_update_staff siyosati
-- orqali — ya'ni to'liq huquqli xodim uchun. Ustun darajasida berish butun jadvalni
-- ochmasligimiz uchun kerak: is_superadmin va driver_rate_per_trip o'zga tegishli RPC/tablalar orqali.
grant update (full_name, phone, title, role_id, is_active) on public.users to authenticated;
-- avatar_path ustuniga faqat `update_my_profile` RPC yozadi (security definer), shuning uchun
-- authenticated roliga alohida grant berilmaydi.
grant select, insert, update on public.clients to authenticated;
grant select on public.materials to authenticated;
grant insert on public.materials to authenticated;
grant update (unit_price, is_active) on public.materials to authenticated;
grant delete on public.materials to authenticated;
grant select on public.vehicles to authenticated;
grant update (plate, model, year, status, driver_id) on public.vehicles to authenticated;
grant select on public.trips to authenticated;
-- trips insert — USTUN darajasida. unit_price va total_amount serverda trigger
-- hisoblaydi, monitoring_status esa monitoringdan tasdiqlanadi: shu uchun bu
-- ustunlarga grant berilmaydi va brauzer ularni yubora olmaydi.
revoke insert on public.trips from authenticated;
grant insert (id, vehicle_id, driver_id, client_id, material_id, weight_tons, sale_type, hours_worked, note, created_by) on public.trips to authenticated;
grant update (photo_path) on public.trips to authenticated;
grant select on public.transactions to authenticated;
-- Xuddi shu sabab: monitoring_status, monitored_by, monitored_at va monitoring_note
-- faqat set_expense_monitoring() RPC'si orqali o'zgaradi.
revoke insert on public.transactions from authenticated;
grant insert (direction, category, amount, payment_method, client_id, vehicle_id, driver_id, note) on public.transactions to authenticated;
grant select, insert, update, delete on public.transaction_categories to authenticated;
grant select on public.client_balances, public.financial_balances to authenticated;
grant select, insert on public.maintenance_reports to authenticated;
grant update (status, resolved_at) on public.maintenance_reports to authenticated;

-- ── Full-dostub belgisini qayta hisoblash ───────────────────────────────────
-- Triggerlar faqat keyingi o'zgarishlarda ishlaydi; shuning uchun mavjud xodimlar uchun
-- bir marta to'liq qayta hisoblaymiz. Shu bilan eng muhimi: yangi ruxsat kaliti qo'shilsa
-- yoki "Boshliq"ga biror ruxsat berilsa, o'sha lavozimdagi xodimlar superadmin bo'lib qoladi.
-- ESDA: monitoring.* va materials.prices.view kalitlari faqat "Boshliq"ga beriladi
-- (yuqoridagi cross join shuni avtomatik qiladi). Agar boshqa bir lavozim oldindan
-- BARCHA kalitlarga ega bo'lgan bo'lsa, u endi to'liq dostub hisoblanmaydi — bu kutilgan
-- xatti-harakat: monitoring huquqi qo'lda berilishi kerak.
update public.users u
set is_superadmin = public.role_has_full_access(u.role_id)
where u.is_superadmin is distinct from public.role_has_full_access(u.role_id);

-- Add the operational tables to Realtime when the standard Supabase publication exists.
-- RLS still filters the rows/events received by each user.
do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['maintenance_reports','trips','transactions','vehicles'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;