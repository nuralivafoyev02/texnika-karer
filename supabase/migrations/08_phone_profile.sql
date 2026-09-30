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
