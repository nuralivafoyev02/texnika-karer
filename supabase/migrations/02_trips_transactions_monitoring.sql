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
