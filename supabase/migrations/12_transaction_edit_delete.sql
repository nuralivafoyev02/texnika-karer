-- 12 · Kvitansiyalarni tahrirlash va o'chirish (ruxsat bilan)
-- Ishlatish: SQL Editor'da faqat shu faylni Run qiling.
-- Xavfsiz: mavjud ma'lumotlarga tegilmaydi — 2 ta ruxsat kaliti va 2 ta RPC qo'shiladi.
--
--   finance.transactions.edit   → kirim/chiqim yozuvini tahrirlash
--   finance.transactions.delete → kirim/chiqim yozuvini o'chirish
--
-- Qoidalar:
--   • Reysga bog'langan yozuv (naqd savdo) bu yerdan o'zgarmaydi — u reys monitoringi orqali boshqariladi.
--   • Yo'nalish (kirim/chiqim) o'zgarmaydi.
--   • Tasdiqlangan chiqimning summasi, hisobi yoki turi o'zgarsa va tahrirlovchida
--     monitoring.approve bo'lmasa — yozuv qayta monitoringga ('pending') tushadi.
--   • Tur/mijoz/haydovchi tekshiruvi mavjud validate_transaction_category() trigger'ida.

-- 0-1) Ruxsat kalitlari. Hozir to'liq huquqli lavozimlar yangi kalitlarni ham oladi —
--      aks holda kalit qo'shilgach ular to'liq huquqni yo'qotardi. Hammasi BITTA
--      buyruqda: full_roles kalitlar qo'shilishidan oldingi holat bo'yicha hisoblanadi
--      (SQL Editor'da temp jadval ishlamaydi — har buyruq alohida ulanishda bo'lishi mumkin).
with full_roles as (
  select r.id from public.roles r where public.role_has_full_access(r.id)
), new_permissions as (
  insert into public.permissions (key, label, group_name, description) values
    ('finance.transactions.edit', 'Kvitansiyani tahrirlash', 'Moliya', 'Kirim va chiqim yozuvlarini tahrirlash'),
    ('finance.transactions.delete', 'Kvitansiyani o‘chirish', 'Moliya', 'Kirim va chiqim yozuvlarini o‘chirish')
  on conflict (key) do update set label = excluded.label, group_name = excluded.group_name, description = excluded.description
  returning id
)
insert into public.role_permissions (role_id, permission_id)
select f.id, p.id from full_roles f cross join new_permissions p
on conflict do nothing;

-- 2) Tahrirlash
create or replace function public.update_transaction(
  p_transaction_id uuid,
  p_category text,
  p_amount numeric,
  p_payment_method text,
  p_client_id uuid default null,
  p_vehicle_id uuid default null,
  p_driver_id uuid default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tx public.transactions;
  financial_change boolean;
begin
  if not public.has_permission('finance.transactions.edit') then
    raise exception 'Kvitansiyani tahrirlash huquqi yo‘q.' using errcode = '42501';
  end if;
  select * into tx from public.transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Kvitansiya topilmadi.' using errcode = 'P0002';
  end if;
  if tx.trip_id is not null or tx.category = 'cash_sale' or p_category = 'cash_sale' then
    raise exception 'Reysga bog‘langan yozuv reys orqali boshqariladi.' using errcode = '23514';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Summa 0 dan katta bo‘lishi kerak.' using errcode = '23514';
  end if;
  if p_payment_method not in ('cash', 'bank') then
    raise exception 'Hisob turi noto‘g‘ri.' using errcode = '23514';
  end if;

  financial_change := p_amount <> tx.amount or p_payment_method <> tx.payment_method or p_category <> tx.category;

  update public.transactions set
    category = p_category,
    amount = round(p_amount, 2),
    payment_method = p_payment_method,
    client_id = p_client_id,
    vehicle_id = p_vehicle_id,
    driver_id = p_driver_id,
    note = nullif(btrim(coalesce(p_note, '')), '')
  where id = tx.id;

  if tx.direction = 'out' and financial_change and not public.has_permission('monitoring.approve') then
    update public.transactions set
      monitoring_status = 'pending', monitored_by = null, monitored_at = null, monitoring_note = null
    where id = tx.id;
  end if;
end;
$$;

-- 3) O'chirish
create or replace function public.delete_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tx public.transactions;
begin
  if not public.has_permission('finance.transactions.delete') then
    raise exception 'Kvitansiyani o‘chirish huquqi yo‘q.' using errcode = '42501';
  end if;
  select * into tx from public.transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Kvitansiya topilmadi.' using errcode = 'P0002';
  end if;
  if tx.trip_id is not null or tx.category = 'cash_sale' then
    raise exception 'Reysga bog‘langan yozuv reys orqali boshqariladi.' using errcode = '23514';
  end if;
  delete from public.transactions where id = tx.id;
end;
$$;

revoke all on function public.update_transaction(uuid, text, numeric, text, uuid, uuid, uuid, text) from public, anon;
revoke all on function public.delete_transaction(uuid) from public, anon;
grant execute on function public.update_transaction(uuid, text, numeric, text, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.delete_transaction(uuid) to authenticated;

-- 4) To'liq-dostub belgisini qayta hisoblash (yangi kalit qo'shilgani uchun).
update public.users u
   set is_superadmin = public.role_has_full_access(u.role_id)
 where u.is_superadmin is distinct from public.role_has_full_access(u.role_id);

-- PostgREST yangi funksiyalarni darhol ko'rishi uchun.
notify pgrst, 'reload schema';

-- 5) Tekshirish: ikkala qiymat ham 2 bo'lishi kerak.
select
  (select count(*) from public.permissions where key in ('finance.transactions.edit', 'finance.transactions.delete')) as permission_rows,
  (select count(*) from pg_proc where proname in ('update_transaction', 'delete_transaction')) as functions;
