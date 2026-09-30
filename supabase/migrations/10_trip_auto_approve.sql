-- 10 · trips.auto_approve — kiritish va tasdiqlashni ajratish
-- Qachon ishga tushirish: Monitoring'da reys "kutilmoqda"dan chiqib ketsin deb
-- xohlasangiz, lekin kirituvchi o'zi tasdiqlamasin. Yoki aksincha.
-- Ishlatish: SQL Editor'da faqat shu faylni Run qiling (boshqa hech narsa kerak emas).
-- Xavfsiz: mavjud ma'lumotlarga tegilmaydi, faqat yangi kalit va trigger qayta yoziladi.

-- 1) Yangi ruxsat kaliti. Karer guruhida `trips.create` yonida turadi:
--      trips.create       → reys monitoring navbatiga tushadi (balansga yozilmaydi)
--      trips.auto_approve → reys darhol tasdiqlangan bo'lib saqlanadi
insert into public.permissions (key, label, group_name, description) values
  ('trips.auto_approve', 'Yangi reysni avtomatik tasdiqlash', 'Karer', 'Kiritilgan reys monitoring bo‘limiga o‘tmasdan, darhol tasdiqlangan holda saqlanadi')
on conflict (key) do update set label = excluded.label, group_name = excluded.group_name, description = excluded.description;

-- 2) Kiritish trigger'ini qayta yozamiz: endi monitoring holati kirituvchining
--    ruxsatiga qarab belgilanadi. Eski qoida: har doim 'pending'.
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
  -- Kirituvchi monitoring_status'ni o'zi yubora olmaydi (INSERT grantida bu ustun yo'q):
  -- qaror serverda, uning ruxsati asosida qabul qilinadi.
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

-- 3) "Boshliq" lavozimiga avtomatik beriladi. Bu lavozim grants_all = true bo'lgani
--    uchun uni qo'lda yangilash shart emas: 11_superadmin_grants_all.sql ishga
--    tushgandan keyin har bir yangi kalit o'zi avtomatik oladi.
--    Eski sxemada esa quyidagi qator kerak (barcha kalitlarni qo'lda oladi).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
 where r.name = 'Boshliq' and p.key = 'trips.auto_approve'
on conflict do nothing;

-- 4) To'liq-dostub belgisini qayta hisoblaymiz (Boshliqdagilar uchun).
update public.users u
   set is_superadmin = public.role_has_full_access(u.role_id)
 where u.is_superadmin is distinct from public.role_has_full_access(u.role_id);

-- 5) Tekshirish: `permission_row` = 1 bo'lishi kerak, `roles_with_it` esa nechta
--    lavozimga berilganini ko'rsatadi (faqat "Boshliq" = 1 bo'lishi kerak).
select
  (select count(*) from public.permissions where key = 'trips.auto_approve') as permission_row,
  (select count(*) from public.role_permissions rp
     join public.permissions p on p.id = rp.permission_id
    where p.key = 'trips.auto_approve') as roles_with_it,
  (select string_agg(r.name, ', ' order by r.name) from public.roles r
     join public.role_permissions rp on rp.role_id = r.id
     join public.permissions p on p.id = rp.permission_id
    where p.key = 'trips.auto_approve') as which_roles;
