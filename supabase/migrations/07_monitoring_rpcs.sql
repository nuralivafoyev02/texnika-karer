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
