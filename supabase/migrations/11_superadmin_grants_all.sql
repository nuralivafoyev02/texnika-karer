-- 11 · roles.grants_all — to'liq huquqli lavozim yangi ruxsatlarni avtomatik oladi
--
-- Nima uchun kerak?
--   To'liq huquq (superadmin) eski qoida bo'yicha "lavozimda katalogdagi BARCHA
--   kalit qo'lda belgilangan" holat edi. Shu qoida muammoli: monitoring,
--   trips.auto_approve kabi yangi kalit qo'shilganda o'sha lavozim to'liq
--   huquqdan chiqib ketardi — o'sha profil o'ziga o'zi tiklashga qurbon bo'lardi
--   ("Sizda ushbu ruxsatlarni berish huquqi yo'q" xatosi).
--
-- Yechim:
--   `roles.grants_all = true` — bunday lavozim katalogdagi barcha kalitga ega
--   bo'lishi shart emas. Yangi kalit qo'shilsa ham u avtomatik beriladi, demak
--   superadminlik doim saqlanadi.
--
-- Ishga tushirish: SQL Editor'da faqat shu faylni Run qiling.
-- Xavfsiz: mavjud ma'lumotga tegilmaydi, faqat belgilar va funksiyalar qo'shiladi.

-- 1) Ustun. Eski sxemada grants_all yo'q edi — shuning uchun alohida migratsiya.
alter table public.roles add column if not exists grants_all boolean not null default false;

-- 2) "Boshliq" va "SUPER_ADMIN" — to'liq huquqli lavozimlar. Ularga barcha kalit
--    beriladi (trigger ham, bu qator ham: qator trigger'dan oldin ishlaydi va
--    agar trigger yaratilishidan oldin bajarilsa ham natija to'g'ri bo'ladi).
update public.roles set grants_all = true where name in ('Boshliq', 'SUPER_ADMIN');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
 where r.grants_all
on conflict do nothing;

-- 3) To'liq huquqni aniqlash: grants_all yoki "barcha kalit qo'lda bor".
create or replace function public.role_has_full_access(p_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Katalog bo'sh bo'lsa hech kim to'liq dostubga ega emas (aksi holda trigger har
  -- yozuvni superadmin qilib qo'yardi). `grants_all` belgilangan lavozim esa
  -- doim to'liq huquqli — katalog bo'sh bo'lsa ham.
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

-- 4) Ruxsat tekshiruvi: grants_all lavozim har bir kalitni "berilgan" deb hisoblanadi.
--    Bu trigger bilan birga ikki qatlamli kafolat beradi: yangi kalit qo'shilsa ham
--    grant darhol keladi, kelmasa ham has_permission() uni rost qaytaradi.
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
    where u.id = auth.uid() and u.is_active = true
      and (r.grants_all or exists (
        select 1
        from public.role_permissions rp
        join public.permissions p on p.id = rp.permission_id
        where rp.role_id = u.role_id and p.key = p_key
      ))
  );
$$;

-- 5) Trigger 1: katalogga yangi kalit qo'shilsa, grants_all lavozimlarga darhol beriladi.
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

-- 6) Trigger 2: lavozimga grants_all belgisi qo'yilsa, mavjud barcha kalitlar beriladi.
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

-- 7) Belgini o'zgartirish RPC'si (faqat superadmin). Ilova Sozlamalar → Lavozimlar
--    orqali shuni chaqiradi; `save_role_permissions` esa ruxsat ro'yxatini saqlaydi.
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
  -- O'z rolingni "barcha ruxsat avtomatik" dan chiqarishga ruxsat yo'q: aks holda
  -- boshqaruvga kirish eshigi yopilib qolishi mumkin.
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

-- 8) ruxsat saqlash: grants_all lavozimdan kalitni olib tashlashga ruxsat yo'q,
--    aks holda u yangi kalitlarni olsa ham eskilaridan ayrilib qolardi.
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
  -- Bunday lavozim har doim to'liq huquqli bo'lishi kerak: o'ziga o'zi kaltak
  -- bo'lishiga yo'l qo'yamiz.
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

-- 9) Xodimlarning to'liq huquq belgisini qayta hisoblaymiz.
update public.users u
   set is_superadmin = public.role_has_full_access(u.role_id)
 where u.is_superadmin is distinct from public.role_has_full_access(u.role_id);

-- 10) Tekshirish: `grants_all_rol` = 1 bo'lishi kerak (Boshliq). `to'liq_huquqli_xodim`
--     esa nechta xodim superadmin bo'lib qolganini ko'rsatadi.
select
  (select count(*) from public.roles where grants_all) as grants_all_rol,
  (select string_agg(name, ', ' order by name) from public.roles where grants_all) as qaysi_rol,
  (select count(*) from public.permissions) as katalogdagi_kalitlar,
  (select count(*) from public.users where is_superadmin) as toliq_huquqli_xodim,
  -- Kalit bor-yo'qligi bo'yicha tekshiruv: 0 bo'lishi kerak, ya'ni grants_all roli
  -- katalogdagi har bir kalitga ega.
  (select count(*) from public.permissions p
    where not exists (
      select 1 from public.role_permissions rp
      where rp.role_id = (select id from public.roles where grants_all limit 1)
        and rp.permission_id = p.id
    )) as grants_all_rolga_yetishmaydigan;
