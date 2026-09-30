
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
