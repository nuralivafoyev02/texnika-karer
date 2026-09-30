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
