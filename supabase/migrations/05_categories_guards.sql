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
