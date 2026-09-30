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
